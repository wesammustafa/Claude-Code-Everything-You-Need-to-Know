// Ticket 326: a relative link in a Lesson's words is the quoted page's, so
// the compile step resolves it against that page's folder. A Guide page
// opens in the page panel by its repository path, any other repository file
// on GitHub, and a link that reaches no page, heading or file stops the
// compile at its line.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { lessons } from "../../../practice-template/checks/lessons/index.mjs";
import { guideIndex } from "../../release/src/guide-index.mjs";
import { compileCourse, GUIDE } from "../src/content.ts";
import { linkTarget, mapLinks, resolveLink } from "../src/links.ts";
import { PROBES, probeError } from "../src/probes.ts";

const PAGE = "docs/beginner/03-first-change.md";
const fixture = {
  pages: {
    [PAGE]: ["worked-example", "your-turn"],
    "docs/beginner/02-permission-modes-and-plan-mode.md": ["worked-example"],
    "docs/intermediate/README.md": ["what-you-learn"],
  },
  files: [
    PAGE,
    "docs/beginner/02-permission-modes-and-plan-mode.md",
    "docs/beginner/old-page.md",
    "docs/intermediate/README.md",
    "docs/topics/README.md",
    "examples/beginner/03/README.md",
    "examples/beginner/03/a b.json",
  ],
};
const at = (href) => resolveLink(PAGE, href, fixture, GUIDE);

describe("each link form", () => {
  test("a bare page and a page's heading open in the page panel", () => {
    expect(at("02-permission-modes-and-plan-mode.md")).toBe(
      "docs/beginner/02-permission-modes-and-plan-mode.md",
    );
    expect(at("02-permission-modes-and-plan-mode.md#worked-example")).toBe(
      "docs/beginner/02-permission-modes-and-plan-mode.md#worked-example",
    );
    expect(at("./02-permission-modes-and-plan-mode.md")).toBe(
      "docs/beginner/02-permission-modes-and-plan-mode.md",
    );
  });

  test("a ../ page resolves above the page's folder", () => {
    expect(at("../intermediate/README.md")).toBe("docs/intermediate/README.md");
    expect(at("../intermediate/README.md#what-you-learn")).toBe(
      "docs/intermediate/README.md#what-you-learn",
    );
  });

  test("a bare #heading is the quoted page's own", () => {
    expect(at("#worked-example")).toBe(`${PAGE}#worked-example`);
  });

  test("a leading / is the repository root", () => {
    expect(at("/docs/intermediate/README.md")).toBe(
      "docs/intermediate/README.md",
    );
  });

  test("a repository file or folder that is no Guide page opens on GitHub", () => {
    expect(at("../../examples/beginner/03/README.md")).toBe(
      `${GUIDE}/blob/main/examples/beginner/03/README.md`,
    );
    expect(at("../../examples/beginner/03/a%20b.json")).toBe(
      `${GUIDE}/blob/main/examples/beginner/03/a%20b.json`,
    );
    expect(at("../../examples/beginner/03/")).toBe(
      `${GUIDE}/tree/main/examples/beginner/03`,
    );
    expect(at("../topics/README.md")).toBe(
      `${GUIDE}/blob/main/docs/topics/README.md`,
    );
  });

  test("a web address and another scheme stay as written", () => {
    for (const href of [
      "https://code.claude.com/docs/en/permissions.md",
      "mailto:a@b.c",
      "//example.com/x",
    ])
      expect(at(href)).toBe(href);
    expect(linkTarget(PAGE, "https://e.com")).toBeNull();
  });

  test("a link that reaches nothing says why", () => {
    expect(() => at("02-permission-modes-and-plan-mode.md#nope")).toThrow(
      "docs/beginner/02-permission-modes-and-plan-mode.md has no heading or anchor #nope",
    );
    expect(() => at("#")).toThrow(`${PAGE} has no heading or anchor #`);
    expect(() => at("09-gone.md")).toThrow(
      "docs/beginner/09-gone.md is no page in the Guide's index",
    );
    // A Stub is a file, but no page in the index.
    expect(() => at("old-page.md")).toThrow(
      "docs/beginner/old-page.md is no page in the Guide's index",
    );
    expect(() => at("../../examples/none.md")).toThrow(
      "examples/none.md is no file or folder in the repository",
    );
    expect(() => at("../../../../x.md")).toThrow(
      "climbs above the repository root",
    );
  });
});

// The course as compileCourse builds it from this tree.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8");
const manifest = JSON.parse(read("course/manifest.json"));
const stepFiles = Object.fromEntries(
  manifest.lessons.map((l) => [l.steps, read(l.steps)]),
);
const pages = Object.fromEntries(
  [
    ...manifest.lessons.map((l) => l.page),
    ...manifest.levels.map((l) => l.index),
  ].map((page) => [page, read(page)]),
);
const guide = guideIndex(root);
const compile = (files = stepFiles) =>
  compileCourse(manifest, files, pages, {
    lessons,
    probes: { PROBES, probeError },
    guide,
  });
const words = (lesson) => JSON.stringify(lesson.content);

describe("the compiled course", () => {
  const course = compile();
  const lesson = (id) => course.lessons.find((l) => l.id === id);

  test("holds the Beginner links as the page panel opens them", () => {
    expect(words(lesson("b-3"))).toContain(
      "(docs/beginner/02-permission-modes-and-plan-mode.md#worked-example)",
    );
    expect(words(lesson("b-3"))).toContain(
      "[Worked example](docs/beginner/03-first-change.md#worked-example)",
    );
    expect(words(lesson("b-5"))).toContain(
      "[Intermediate level](docs/intermediate/README.md)",
    );
    const capstone = words(lesson("b-capstone"));
    for (const page of [
      "02-permission-modes-and-plan-mode.md",
      "03-first-change.md",
      "05-project-memory.md",
    ])
      expect(capstone).toContain(`(docs/beginner/${page}#worked-example)`);
  });

  test("leaves no relative link and every page link in the Guide's index", () => {
    for (const l of course.lessons) {
      const hrefs = [];
      JSON.stringify(l.content, (_, value) => {
        if (typeof value === "string")
          mapLinks(value, (href) => {
            hrefs.push(href);
            return href;
          });
        return value;
      });
      for (const href of hrefs) {
        if (/^https?:\/\//.test(href)) continue;
        const [path, fragment] = href.split("#");
        expect(guide.pages[path], `${l.id}: ${href}`).toBeDefined();
        if (fragment !== undefined)
          expect(guide.pages[path], `${l.id}: ${href}`).toContain(fragment);
      }
    }
  });

  test("keeps a link inside a code span as written", () => {
    expect(words(lesson("i-capstone"))).toContain("`[broken](bad%.md)`");
  });

  test("fails at the line of a link that reaches no page or heading", () => {
    const file = "course/steps/b-3.md";
    const text = stepFiles[file];
    const line =
      text
        .split("\n")
        .findIndex((l) =>
          l.includes("(02-permission-modes-and-plan-mode.md#worked-example)"),
        ) + 1;
    expect(line).toBeGreaterThan(0);
    for (const [from, to, why] of [
      [
        "02-permission-modes-and-plan-mode.md#worked-example",
        "02-permission-modes-and-plan-mode.md#no-such-heading",
        "docs/beginner/02-permission-modes-and-plan-mode.md has no heading or anchor #no-such-heading",
      ],
      [
        "02-permission-modes-and-plan-mode.md#worked-example",
        "02-no-such-page.md#worked-example",
        "docs/beginner/02-no-such-page.md is no page in the Guide's index",
      ],
    ]) {
      const broken = text.replace(`(${from})`, `(${to})`);
      expect(() => compile({ ...stepFiles, [file]: broken })).toThrow(
        `${file}:${String(line)}: [lesson 2](${to}): ${why}`,
      );
    }
  });

  test("names the failing link's own line, past a code span and an earlier warm-up with the same href", () => {
    const file = "course/steps/b-3.md";
    const lines = stepFiles[file].split("\n");
    const to = "02-no-such-page.md#worked-example";
    const at = (words) => lines.findIndex((l) => l.includes(words));
    const r1 = at('- because: "If you could describe the diff');
    const w2 = at('- hint: "A precise request needs fewer corrections');
    const link = at("(02-permission-modes-and-plan-mode.md#worked-example)");
    expect(r1).toBeGreaterThan(0);
    expect(w2).toBeGreaterThan(r1);
    expect(link).toBeGreaterThan(w2);
    lines[r1] = lines[r1].replace(/"$/, ` [lesson 2](${to})"`);
    lines[w2] = lines[w2].replace(/"$/, ` \`[lesson 2](${to})\`"`);
    lines[link] = lines[link].replace(
      "(02-permission-modes-and-plan-mode.md#worked-example)",
      `(${to})`,
    );
    expect(() => compile({ ...stepFiles, [file]: lines.join("\n") })).toThrow(
      `${file}:${String(link + 1)}: [lesson 2](${to}): `,
    );
  });
});
