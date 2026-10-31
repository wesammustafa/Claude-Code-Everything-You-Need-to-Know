// The lesson test (spec, The lesson test): every step file in course/steps/,
// read by the engine's parser, against this repo's pages. `npm run
// test:lessons` runs this file alone.
//
// The cases under fixtures/lessons/ are the Guide's lesson-quotes fixtures
// rewritten for this test: case `<name>` comes from
// .github/scripts/fixtures/lesson-quotes-<name>/, and its case.json records
// that fixture's verdict (`was`) next to its own (`expect`). Each case holds
// course/manifest.json, its step files and its pages, laid out as this repo
// lays them out, and lists the problems it must report, in order, as
// regular expressions.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { lessons } from "../../../practice-template/checks/lessons/index.mjs";
import { PROBES, probeError } from "../src/probes.ts";
import { STAMP, checkLessons } from "../src/lessons.ts";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const probes = { PROBES, probeError };

// A course laid out under `dir` as this repo lays it out: the manifest, the
// step files it lists and every page it lists, Lessons' and Level indexes'.
// A file that doesn't exist is left out, for the test to report.
function courseAt(dir, { crlf = false } = {}) {
  const read = (path) => readFileSync(`${dir}${path}`, "utf8");
  const manifest = JSON.parse(read("course/manifest.json"));
  const present = (paths, as = (text) => text) =>
    Object.fromEntries(
      paths
        .filter((path) => existsSync(`${dir}${path}`))
        .map((path) => [path, as(read(path))]),
    );
  return {
    manifest,
    stepFiles: present(
      manifest.lessons.map((lesson) => lesson.steps),
      crlf ? (text) => text.replace(/\r?\n/g, "\r\n") : undefined,
    ),
    pages: present([
      ...manifest.lessons.map((lesson) => lesson.page),
      ...manifest.levels.map((level) => level.index),
    ]),
  };
}

const repo = courseAt(root);
const check = (course) => checkLessons({ ...course, checks: lessons, probes });
const stepFile = (id) => `course/steps/${id}.md`;
const pageOf = (id) =>
  repo.manifest.lessons.find((lesson) => lesson.id === id).page;
const flat = (text) => text.replace(/\s+/g, " ").trim();
// The problems a change to this repo's course adds, so that each change below
// is judged on its own even while the repo itself fails.
const added = (course) => {
  const before = new Set(check(repo).problems);
  return check(course).problems.filter((problem) => !before.has(problem));
};

describe("the lesson test on this repo", () => {
  test("every step file matches its page, and every Level index is in place", () => {
    const result = check(repo);
    expect(result.problems).toEqual([]);
    expect(Object.keys(repo.stepFiles)).toHaveLength(23);
    expect(repo.manifest.levels.map((level) => level.index)).toEqual([
      "docs/beginner/README.md",
      "docs/intermediate/README.md",
      "docs/advanced/README.md",
    ]);
    expect(result.lessons).toBe(23);
    expect(result.quotes).toBeGreaterThan(0);
    expect(result.blocks).toBeGreaterThan(0);
    expect(result.from).toBeGreaterThan(0);
  });

  test("changing one quoted word in a page fails it", () => {
    const page = pageOf("b-1");
    const text = repo.pages[page];
    // A quote of b-1's step file that the page holds once, word for word on
    // one line, so changing its last word there takes it off the page.
    const quote = [
      ...repo.stepFiles[stepFile("b-1")].matchAll(/^- [a-z-]+: "(.+)"$/gm),
    ]
      .map((match) => match[1])
      .find(
        (q) =>
          /\w{4,}\W*$/.test(q) &&
          text.split(q).length === 2 &&
          flat(text).split(flat(q)).length === 2,
      );
    expect(quote).toBeDefined();
    const changed = quote.replace(/\w+(?=\W*$)/, "Changedword");
    const problems = added({
      ...repo,
      pages: { ...repo.pages, [page]: text.replace(quote, changed) },
    });
    expect(problems.length).toBeGreaterThan(0);
    for (const problem of problems)
      expect(problem).toMatch(
        new RegExp(
          `^course/steps/b-1\\.md:\\d+: quotes ".*" \\(.*\\), which is not in ${page.replace(/\./g, "\\.")}\\.$`,
        ),
      );
    expect(problems.join("\n")).toContain(`quotes "${quote}"`);
  });

  test("re-stamping a page without its step file fails it", () => {
    const page = pageOf("i-3");
    const stamp = repo.pages[page].match(STAMP)[0];
    const restamped = stamp.replace(/\d{4}-\d{2}-\d{2}$/, "2099-01-01");
    const pages = {
      ...repo.pages,
      [page]: repo.pages[page].replace(stamp, restamped),
    };
    expect(added({ ...repo, pages })).toEqual([
      `course/steps/i-3.md:3: is stamped "${stamp}", but ${page} is stamped "${restamped}". Re-verify the step file and copy the page's Stamp.`,
    ]);
    const stepFiles = {
      ...repo.stepFiles,
      [stepFile("i-3")]: repo.stepFiles[stepFile("i-3")].replace(
        stamp,
        restamped,
      ),
    };
    expect(added({ ...repo, pages, stepFiles })).toEqual([]);
  });

  test("a page or step file the manifest lists must exist", () => {
    const pages = { ...repo.pages };
    delete pages["docs/advanced/README.md"];
    const stepFiles = { ...repo.stepFiles };
    delete stepFiles[stepFile("a-7")];
    expect(added({ ...repo, pages, stepFiles })).toEqual([
      "course/manifest.json:1: lists docs/advanced/README.md, which doesn't exist",
      "course/manifest.json:1: lists course/steps/a-7.md, which doesn't exist",
    ]);
  });

  test("a missing Lesson page is reported once, not again for each warm-up from it", () => {
    const pages = { ...repo.pages };
    delete pages[pageOf("i-6")];
    expect(added({ ...repo, pages })).toEqual([
      `course/manifest.json:1: lists ${pageOf("i-6")}, which doesn't exist`,
    ]);
  });

  test("a quoted back reason must be in the page", () => {
    const file = stepFile("i-1");
    const line = "- back: Y2 Review the workflow here.";
    const at = repo.stepFiles[file].split("\n").indexOf(line) + 1;
    expect(at).toBeGreaterThan(0);
    const stepFiles = {
      ...repo.stepFiles,
      [file]: repo.stepFiles[file].replace(
        line,
        '- back: Y2 "A sentence no page holds at all."',
      ),
    };
    expect(added({ ...repo, stepFiles })).toEqual([
      expect.stringMatching(
        new RegExp(
          `^course/steps/i-1\\.md:${at}: quotes "A sentence no page holds at all\\." \\(.*\\), which is not in ${pageOf("i-1").replace(/\./g, "\\.")}\\.$`,
        ),
      ),
    ]);
  });

  test("a step file with no stamp or no lesson, or a page with no Stamp, fails", () => {
    const file = stepFile("b-1");
    const page = pageOf("b-1");
    const stamp = repo.pages[page].match(STAMP)[0];
    const without = (key) => ({
      ...repo.stepFiles,
      [file]: repo.stepFiles[file].replace(
        new RegExp(`^${key}:.*\\n`, "m"),
        "",
      ),
    });
    expect(added({ ...repo, stepFiles: without("stamp") })).toEqual([
      `${file}:1: has no stamp, but ${page} is stamped "${stamp}". Re-verify the step file and copy the page's Stamp.`,
    ]);
    expect(added({ ...repo, stepFiles: without("lesson") })).toEqual([
      `${file}:1: has no lesson, but course/manifest.json lists this file for b-1`,
    ]);
    const pages = {
      ...repo.pages,
      [page]: repo.pages[page].replace(stamp, ""),
    };
    const problem = `${page}:1: has no Stamp, so ${file} has none to match.`;
    expect(added({ ...repo, pages })).toEqual([problem]);
    expect(added({ ...repo, pages, stepFiles: without("stamp") })).toEqual([
      problem,
    ]);
  });
});

const casesDir = fileURLToPath(new URL("fixtures/lessons/", import.meta.url));
const cases = readdirSync(casesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const dir = `${casesDir}${entry.name}/`;
    const spec = JSON.parse(readFileSync(`${dir}case.json`, "utf8"));
    return { name: entry.name, dir, spec };
  });

describe("the rewritten lesson-quotes cases", () => {
  test.each(cases.map((c) => [c.name, c]))("%s", (_, { dir, spec }) => {
    const result = checkLessons({
      ...courseAt(dir, { crlf: spec.crlf === true }),
      probes,
    });
    expect(result.problems.length > 0 ? "fail" : "pass").toBe(spec.expect);
    expect(result.problems).toHaveLength(spec.problems.length);
    spec.problems.forEach((pattern, k) =>
      expect(result.problems[k]).toMatch(new RegExp(pattern)),
    );
    if (spec.compared) expect(result).toMatchObject(spec.compared);
  });

  // Parity with the Guide's fixtures while lesson-quotes keeps them: one case
  // for each, failing where it failed and passing where it passed. Its two
  // offline warnings (pr-warn, index-pr-warn) have no offline mode to map
  // to here, where the step files sit beside the pages: each case runs the
  // comparison the warning asked for, and fails.
  test("one case per lesson-quotes fixture, with its verdict", () => {
    const guide = `${root}.github/scripts/fixtures/`;
    const fixtures = readdirSync(guide)
      .filter((name) => existsSync(`${guide}${name}/fixture.json`))
      .map((name) => ({
        name,
        spec: JSON.parse(readFileSync(`${guide}${name}/fixture.json`, "utf8")),
      }))
      .filter(({ spec }) => spec.rule === "lesson-quotes");
    expect(fixtures).toHaveLength(29);
    expect(cases.map((c) => c.spec.origin).sort()).toEqual(
      fixtures.map((f) => f.name).sort(),
    );
    for (const { name, spec } of fixtures) {
      const rewritten = cases.find((c) => c.spec.origin === name);
      expect(rewritten.name).toBe(name.replace(/^lesson-quotes-/, ""));
      expect(rewritten.spec.was).toBe(spec.expect);
      expect(rewritten.spec.expect).toBe(
        spec.expect === "warn" ? "fail" : spec.expect,
      );
    }
  });
});
