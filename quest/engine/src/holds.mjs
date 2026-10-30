// What a file holds, for the beats that read it (ticket 87): `file`, `json`,
// `match` and `no-match`, and the evidence line a check shows. Main reads
// the file's bytes as they are now, in the lesson's work folder; these
// decide what they mean. Pure: nothing here reads the disk or starts a
// process.
import { createHash } from "node:crypto";
import { isGlob } from "./content.mjs";
import { C } from "./copy.ts";
import { cut, graphemes, isEmoji, strip } from "./text.ts";

// A file's text: UTF-16 with a byte-order mark (Windows PowerShell 5.1
// writes it), or UTF-8 with or without one.
function textOf(buf) {
  return buf[0] === 0xff && buf[1] === 0xfe
    ? buf.subarray(2).toString("utf16le")
    : buf.toString("utf8").replace(/^﻿/, "");
}

// What a binary file is, in place of its bytes: a PNG's width and height,
// or any other's size. Null for text, which holds no NUL byte (UTF-16 with a
// byte-order mark is text).
const PNG = Buffer.from("89504e470d0a1a0a", "hex");
function binaryOf(buf) {
  if (
    (buf[0] === 0xff && buf[1] === 0xfe) ||
    !buf.subarray(0, 8000).includes(0)
  )
    return null;
  if (
    buf.length >= 24 &&
    buf.subarray(0, 8).equals(PNG) &&
    buf.toString("latin1", 12, 16) === "IHDR"
  )
    return C.pngImage(buf.readUInt32BE(16), buf.readUInt32BE(20));
  return C.binaryData(
    buf.length < 1024
      ? `${buf.length} bytes`
      : `${Math.round(buf.length / 1024)} KB`,
  );
}

// Text from the learner's file as one screen row, at most `max` columns:
// escape sequences and control characters go (a tab or line break becomes a
// space), and each emoji after the first becomes *, so a row holds one. A
// longer row is cut and ends in …, the way the render cuts one; the reset
// `cut` adds goes, since the row may sit inside a sentence.
const ESC = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)?|.)?/gs;
function oneRow(s, max = 60) {
  let emoji = 0;
  const flat = s
    .replace(ESC, "")
    .replace(/[\t\n\v\f\r]+/g, " ")
    .replace(/\p{Cc}/gu, "")
    .trim();
  // One grapheme past `max` is enough to tell that the row needs the cut.
  const row = graphemes(flat)
    .slice(0, max + 1)
    .map((g) => (isEmoji(g) && emoji++ ? "*" : g))
    .join("");
  return max === Infinity ? row : strip(cut(row, max));
}

// The line a file shows of itself: its first line that says something, not
// in a leading front matter block and not only ---, { or [, which open one.
// A file that is all front matter shows its first line inside, and one
// whose every line only opens a block shows that line.
const OPENS = ["---", "{", "["];
function firstOf(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const end = lines[0] === "---" ? lines.indexOf("---", 1) : -1;
  const says = (l) => !OPENS.includes(l);
  const line = lines.slice(end + 1).find(says) ?? lines.find(says) ?? lines[0];
  return line === undefined ? null : oneRow(line);
}

// What a file is, to tell whether it changed (verify.mjs stampOf builds it
// with this; grewFrom reads it back): its time, its size and the start of
// its SHA-1. A fresh beat keeps the stamp its step opened with.
const sha = (buf) => createHash("sha1").update(buf).digest("hex").slice(0, 12);
export const stampFor = (mtimeMs, buf) =>
  `${Math.trunc(mtimeMs)}:${buf.length}:${sha(buf)}`;

// How many bytes the file stamped `stamp` held, when it only grew since:
// what it held then is the start of `buf`. 0 when it was rewritten, or the
// stamp holds nothing (no file then).
export function grewFrom(stamp, buf) {
  const [, size, hash] = (stamp ?? "").split(":");
  const n = Number(size);
  return n > 0 && n <= buf.length && sha(buf.subarray(0, n)) === hash ? n : 0;
}

// The lines a match reads: all of them, or past the file's first `from`
// bytes only the lines written or added to since the stamp.
function linesOf(buf, text, from) {
  const lines = text.split(/\r?\n/);
  if (!from) return lines;
  const before = textOf(buf.subarray(0, from)).length;
  let start = 0;
  return lines.filter((line) => {
    const added = start >= before || start + line.length > before;
    start = text.indexOf("\n", start) + 1 || text.length;
    return added;
  });
}

// The line a done beat shows of its file, to show what the learner made.
export function evidenceOf(buf) {
  if (!buf) return null;
  return binaryOf(buf) ?? firstOf(textOf(buf));
}

// The value at a dotted key path, or `undefined` where any part is missing.
// An array's parts are its indexes, so `length` is no key of one.
function at(value, key) {
  let v = value;
  for (const part of key.split(".")) {
    if (v === null || typeof v !== "object") return undefined;
    if (
      Array.isArray(v)
        ? !/^\d+$/.test(part) || Number(part) >= v.length
        : !Object.hasOwn(v, part)
    )
      return undefined;
    v = v[part];
  }
  return v;
}
const shown = (v) => oneRow(typeof v === "string" ? v : JSON.stringify(v));

// Whether `buf` (null: no file) passes a reading beat's verify, with the
// evidence a pass shows or the not-yet line a miss gets. A fresh match reads
// only what was added past `from` (grewFrom); a no-match reads the whole file
// when nothing was added, so a line it forbids that is still there counts.
export function judge(verify, buf, from = 0) {
  const { path } = verify;
  if (!buf)
    return {
      pass: false,
      hint: isGlob(path) ? C.noMatch(path) : C.noFile(path),
    };
  const binary = binaryOf(buf);
  if (binary)
    return verify.kind === "file"
      ? { pass: true, evidence: binary }
      : { pass: false, hint: C.notText(path, binary) };
  const text = textOf(buf);
  if (verify.kind === "file") {
    // Done once it holds any line. A list shows its first line that says
    // something and how many more lines it holds, so a short list shows.
    const count = text.split(/\r?\n/).filter((l) => l.trim()).length;
    if (!count) return { pass: false, hint: C.fileEmpty(path) };
    const first = firstOf(text);
    return {
      pass: true,
      evidence: count > 1 ? C.andMore(first, count - 1) : first,
    };
  }
  if (verify.kind === "match" || verify.kind === "no-match") {
    const re = new RegExp(verify.regex);
    const hit = linesOf(
      buf,
      text,
      verify.kind === "no-match" && from === buf.length ? 0 : from,
    ).find((l) => re.test(l));
    const line = hit === undefined ? null : oneRow(hit);
    // A matched line shows without a list's trailing comma (r27 E12).
    if (verify.kind === "match")
      return line === null
        ? { pass: false, hint: from ? C.noNewLine(path) : C.noLine(path) }
        : { pass: true, evidence: line.replace(/,\s*$/, "") };
    return line === null
      ? { pass: true, evidence: null }
      : { pass: false, hint: C.stillHas(path, line) };
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return {
      pass: false,
      hint: C.notJson(path, oneRow(error.message, Infinity)),
    };
  }
  if (!verify.key) return { pass: true, evidence: evidenceOf(buf) };
  const found = at(value, verify.key);
  if (found === undefined)
    return { pass: false, hint: C.noKey(path, verify.key) };
  // A value given as text equals a string with that text, or any other
  // value written that way in JSON: `=success`, `=false`, `=3`.
  if (
    verify.value !== null &&
    verify.value !== (typeof found === "string" ? found : JSON.stringify(found))
  ) {
    return {
      pass: false,
      hint: C.notValue(path, verify.key, shown(found), verify.value),
    };
  }
  // The key with its value, so the line says what holds it (r27 E12).
  return { pass: true, evidence: `${verify.key} = ${shown(found)}` };
}
