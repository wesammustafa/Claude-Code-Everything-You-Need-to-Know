// The spec's behavior list (spec, Behavior the engine keeps), as ids the
// action-driven tests tag (ticket 208). A test that proves one has
// `// spec: <id>` on a line above it, one id a line. Host-owned ids are
// ticket 209's: the engine has nothing to prove for them, so no test here
// tags them. This file also keeps the lesson tests on the action
// interface: no terminal field, no key input.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import assert from "node:assert/strict";
import { SPEC } from "./spec.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const self = "spec-coverage.test.mjs";
// Every other test file in this folder, as text.
const files = readdirSync(here)
  .filter((f) => f.endsWith(".test.mjs") && f !== self)
  .map((f) => ({ name: f, text: readFileSync(join(here, f), "utf8") }));

// Each `// spec: <id>` tag, with its file and line.
const tags = files.flatMap(({ name, text }) =>
  text.split("\n").flatMap((line, i) => {
    const m = /^\s*\/\/ spec: (\S+)\s*$/.exec(line);
    return m ? [{ id: m[1], at: `${name}:${i + 1}` }] : [];
  }),
);

test("the spec list names each behavior once, with its owner", () => {
  const ids = SPEC.map((x) => x.id);
  assert.deepEqual(
    ids.filter((id, i) => ids.indexOf(id) !== i),
    [],
  );
  for (const x of SPEC) {
    assert.ok(["engine", "host"].includes(x.owner), x.id);
    if (x.owner === "host") assert.equal(x.ticket, 209, x.id);
  }
});

test("every spec tag names a known, engine-owned behavior", () => {
  const owner = new Map(SPEC.map((x) => [x.id, x.owner]));
  assert.deepEqual(
    tags.filter((t) => !owner.has(t.id)).map((t) => `${t.at} ${t.id}`),
    [],
    "tags with no spec id",
  );
  assert.deepEqual(
    tags
      .filter((t) => owner.get(t.id) === "host")
      .map((t) => `${t.at} ${t.id}`),
    [],
    "host-owned ids are ticket 209's to prove",
  );
});

test("every engine-owned behavior has at least one action-driven test", () => {
  const tagged = new Set(tags.map((t) => t.id));
  assert.deepEqual(
    SPEC.filter((x) => x.owner === "engine" && !tagged.has(x.id)).map(
      (x) => x.id,
    ),
    [],
  );
});

// What the terminal kept and the engine doesn't: views, overlays, cursors,
// toasts, motion, held keys, the restart confirm, the hint lock and the
// typed buffer; and the translator's inputs. Comments may name them, as a
// cut's `// dropped:` note does.
const TERMINAL_FIELD =
  /\.(?:view|overlay|toast|cursor|fx|held|typed)\b|\b(?:mapCursor|confirmRestart|lockUntil)\b/;
const KEY_INPUT =
  /type:\s*["'`](?:key|paste|flush|screen\.away|screen\.back)["'`]/;

test("the lesson tests speak actions: no terminal field, no key input", () => {
  const found = files
    .filter((f) => f.name.startsWith("lesson-"))
    .flatMap(({ name, text }) =>
      text.split("\n").flatMap((line, i) => {
        const code = line.replace(/(^|\s)\/\/.*$/, "");
        return TERMINAL_FIELD.test(code) || KEY_INPUT.test(code)
          ? [`${name}:${i + 1} ${line.trim()}`]
          : [];
      }),
    );
  assert.deepEqual(found, []);
});
