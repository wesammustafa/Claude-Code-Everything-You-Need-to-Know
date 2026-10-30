// The lesson test's checks (spec, The lesson test): every step file, read by
// the engine's own parser, against this repo's pages. It keeps every check
// the Guide's lesson-quotes rule makes, offline, apart from the title, which
// a step file no longer holds:
// - each double-quoted value is in its page, whitespace-flattened;
// - each code block equals a block of its page line for line, and every
//   block closes (the parser fails one that doesn't);
// - the step file's stamp equals its page's Stamp;
// - each "step N of M" heading of a Worked example, Your turn, The task or
//   Tear down counts the page's numbered steps under that heading;
// - a from line appears only in a warm-up (the parser fails one elsewhere)
//   and names a Lesson or Level index the manifest lists, and the warm-up's
//   quotes and blocks are compared with that page;
// - a Level index is docs/<level>/README.md.
// Pure: callers supply the manifest, the step files, the pages, the Check
// modules and the probes. It returns the problems, each naming its file and
// line (none when everything matches), and how many step files, quotes,
// code blocks and warm-ups from another page it compared.
import { coursePath, parseLesson, parseManifest } from "./content.ts";
import { frontmatter } from "./frontmatter.ts";

const MANIFEST = "course/manifest.json";

// `Verified against Claude Code vX.Y.Z (stable) on YYYY-MM-DD`, as the
// Guide's stamps rule reads it.
export const STAMP =
  /Verified against Claude Code v\d+\.\d+\.\d+ \(stable\) on \d{4}-\d{2}-\d{2}/;

// Front matter a step file dropped when it moved to course/steps/: the
// manifest and the page hold these now, so a step file that still has one
// would repeat, and could contradict, them. `folder` is the parser's own
// error (rejectFolder).
export const DROPPED = {
  title: "the title is the page's top heading",
  source: "the manifest names the page",
  "source-commit": "the Stamp dates the page",
  page: "the manifest names the page",
  stuck: "the manifest derives the report-a-problem link",
  next: "the manifest's order gives the next Lesson",
};

// The parts whose steps a "step N of M" heading counts.
export const COUNTED = ["Worked example", "Your turn", "The task", "Tear down"];

const flat = (text) => text.replace(/\s+/g, " ").trim();
const sameLines = (a, b) =>
  a.length === b.length && a.every((line, i) => line === b[i]);

// A page fence, as CommonMark reads one: indented at most three spaces and
// outside a blockquote, so a fence four or more spaces in, or in an alert,
// is no block here (though GitHub shows it as one). It closes on a line of
// the same character, at least as long, holding nothing else.
const PAGE_FENCE = /^ {0,3}(`{3,}|~{3,})/;
const closesPage = (mark, line) => {
  const f = line.match(PAGE_FENCE);
  return (
    Boolean(f) &&
    f[1][0] === mark[0] &&
    f[1].length >= mark.length &&
    /^\s*[`~]+\s*$/.test(line)
  );
};

// The page's lines outside its fenced blocks.
export function outsideFences(markdown) {
  const out = [];
  let mark = null;
  for (const line of markdown.split("\n")) {
    if (mark) {
      if (closesPage(mark, line)) mark = null;
      continue;
    }
    const f = line.match(PAGE_FENCE);
    if (f) mark = f[1];
    else out.push(line);
  }
  return out;
}

// The lines of each fenced block of the page, without its fences, less the
// indent its opening fence has (three spaces inside a numbered step). A block
// left open runs to the end of the page.
export function fencedBlocks(markdown) {
  const blocks = [];
  let fence = null;
  for (const line of markdown.split("\n")) {
    if (fence) {
      if (closesPage(fence.mark, line)) fence = null;
      else fence.lines.push(line.replace(fence.indent, ""));
      continue;
    }
    const f = line.match(PAGE_FENCE);
    if (f) {
      const indent = line.length - line.trimStart().length;
      fence = { mark: f[1], indent: new RegExp(`^ {0,${indent}}`), lines: [] };
      blocks.push(fence.lines);
    }
  }
  return blocks;
}

// The numbered steps at the top level under the page's `## <part>` heading.
export function stepCount(markdown, part) {
  let inside = false;
  let count = 0;
  for (const line of outsideFences(markdown)) {
    if (/^## /.test(line)) inside = line.trim() === `## ${part}`;
    else if (inside && /^\d+\. /.test(line)) count += 1;
  }
  return count;
}

function source(path, raw) {
  const text = raw.replace(/\r\n?/g, "\n");
  return { path, text, body: flat(text), blocks: fencedBlocks(text) };
}

export function checkLessons({
  manifest: value,
  stepFiles,
  pages,
  checks = {},
  probes,
}) {
  let manifest;
  try {
    manifest = parseManifest(value, MANIFEST);
  } catch (error) {
    const problem = error instanceof Error ? error.message : String(error);
    return { problems: [problem], lessons: 0, quotes: 0, blocks: 0, from: 0 };
  }
  const problems = [];
  const compared = { lessons: 0, quotes: 0, blocks: 0, from: 0 };
  // Every page a step file may quote: each Lesson's own, by its id, and each
  // Level index, by `<level>-index`, the name a warm-up's from line gives it.
  const sources = new Map();
  // Every name a warm-up's from line may give, whether or not its page
  // exists: a missing page is reported once, as the manifest's problem.
  const listed = new Set();
  const pageOf = (id, path) => {
    listed.add(id);
    const raw = pages[path];
    if (typeof raw !== "string")
      problems.push(`${MANIFEST}:1: lists ${path}, which doesn't exist`);
    else sources.set(id, source(path, raw));
  };
  for (const level of manifest.levels) {
    if (level.index !== `docs/${level.id}/README.md`)
      problems.push(
        `${MANIFEST}:1: lists ${level.index} as the ${level.id} index, but a Level index is docs/${level.id}/README.md`,
      );
    pageOf(`${level.id}-index`, level.index);
  }
  for (const entry of coursePath(manifest)) pageOf(entry.id, entry.page);

  for (const entry of coursePath(manifest)) {
    const file = entry.steps;
    const raw = stepFiles[file];
    if (typeof raw !== "string") {
      problems.push(`${MANIFEST}:1: lists ${file}, which doesn't exist`);
      continue;
    }
    const own = sources.get(entry.id);
    const shown = [];
    let lesson;
    try {
      lesson = parseLesson(raw, file, {
        manifest,
        checks,
        probes,
        rejectFolder: true,
        onPageText: (piece) => shown.push(piece),
      });
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    const lines = raw.replace(/\r\n?/g, "\n").split("\n");
    // A key the front matter lacks is reported at its opening line.
    const lineOf = (key) =>
      lines.findIndex((line) => line.startsWith(`${key}:`)) + 1 || 1;
    const fields = frontmatter(raw)?.fields ?? {};
    for (const [key, why] of Object.entries(DROPPED)) {
      if (key in fields)
        problems.push(
          `${file}:${lineOf(key)}: ${key} is no step-file field: ${why}`,
        );
    }
    if (lesson.lesson === undefined)
      problems.push(
        `${file}:1: has no lesson, but ${MANIFEST} lists this file for ${entry.id}`,
      );
    else if (lesson.lesson !== entry.id)
      problems.push(
        `${file}:${lineOf("lesson")}: lesson is ${lesson.lesson}, but ${MANIFEST} lists this file for ${entry.id}`,
      );
    if (!own) continue;
    compared.lessons += 1;

    const stamp = own.text.match(STAMP)?.[0];
    if (stamp === undefined)
      problems.push(
        `${own.path}:1: has no Stamp, so ${file} has none to match.`,
      );
    else if (lesson.stamp === undefined)
      problems.push(
        `${file}:1: has no stamp, but ${own.path} is stamped "${stamp}". Re-verify the step file and copy the page's Stamp.`,
      );
    else if (lesson.stamp !== stamp)
      problems.push(
        `${file}:${lineOf("stamp")}: is stamped "${lesson.stamp}", but ${own.path} is stamped "${stamp}". Re-verify the step file and copy the page's Stamp.`,
      );

    // A "Your turn part N of M" heading splits one step into parts, so it
    // isn't counted against the page's numbered steps.
    const miscounted = new Set();
    for (const step of lesson.steps) {
      if (step.unit !== "step" || miscounted.has(step.part)) continue;
      const count = stepCount(own.text, step.part);
      if (step.of !== count) {
        miscounted.add(step.part);
        problems.push(
          `${file}:${step.line}: counts ${step.of} steps in ${step.part}, but ${own.path} has ${count}.`,
        );
      }
    }

    for (const step of lesson.warmup) {
      if (step.from === undefined) continue;
      if (listed.has(step.from)) {
        if (sources.has(step.from)) compared.from += 1;
      } else
        problems.push(
          `${file}:${step.line}: a warm-up from ${step.from}, which ${MANIFEST} doesn't list as a Lesson or Level index`,
        );
    }

    for (const piece of shown) {
      const page = piece.from === null ? own : sources.get(piece.from);
      if (!page) continue;
      compared[piece.kind === "quote" ? "quotes" : "blocks"] += 1;
      const at = `${file}:${piece.line}`;
      if (piece.kind === "quote") {
        if (!page.body.includes(flat(piece.text)))
          problems.push(
            `${at}: quotes "${piece.text}" (${piece.heading}), which is not in ${page.path}.`,
          );
      } else if (!page.blocks.some((block) => sameLines(block, piece.lines))) {
        const first = piece.lines.find((line) => line.trim());
        problems.push(
          `${at}: shows a code block starting "${first}" (${piece.heading}), which is not in ${page.path}.`,
        );
      }
    }
  }
  return { problems, ...compared };
}
