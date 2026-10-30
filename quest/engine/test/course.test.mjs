import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { lessons } from "../../../practice-template/checks/lessons/index.mjs";
import { PROBES, probeError } from "../src/probes.ts";
import {
  compileCourse,
  generateCheckIndex,
  parseLesson,
  parseManifest,
} from "../src/content.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const manifestText = readFileSync(`${root}course/manifest.json`, "utf8");
const manifestValue = JSON.parse(manifestText);
const stepFiles = Object.fromEntries(
  manifestValue.lessons.map((lesson) => [
    lesson.steps,
    readFileSync(`${root}${lesson.steps}`, "utf8"),
  ]),
);
const pages = Object.fromEntries(
  [
    ...manifestValue.lessons.map((lesson) => lesson.page),
    ...manifestValue.levels.map((level) => level.index),
  ].map((page) => [page, readFileSync(`${root}${page}`, "utf8")]),
);
const checks = { lessons, probes: { PROBES, probeError } };

describe("course manifest", () => {
  test("validates and compiles all 23 Lessons from their pages and step files", () => {
    const course = compileCourse(manifestValue, stepFiles, pages, checks);
    expect(course.lessons).toHaveLength(23);
    expect(course.levels.map((level) => level.id)).toEqual([
      "beginner",
      "intermediate",
      "advanced",
    ]);
    expect(course.lessons[0]).toMatchObject({
      id: "b-1",
      title: "Install, sign in and look around",
      minutes: "about 20 minutes",
      next: "b-2",
      folder: "copy",
      fingerprint: course.lessons[0].legacyFingerprint,
    });
    expect(course.lessons[0].content.lesson).toBe("b-1");
    expect(course.lessons.at(-1).next).toBeNull();
    expect(course.lessons.map((lesson) => lesson.order)).toEqual(
      Array.from({ length: 23 }, (_, index) => index + 1),
    );
    expect(JSON.stringify(course)).not.toContain("source-commit");
  });

  test("the course loader reads the compiled course", async () => {
    const expected = compileCourse(manifestValue, stepFiles, pages, checks);
    const { loadCourse } = await import("../src/course.mjs");
    const actual = loadCourse(`${root}practice-template`);
    expect(actual).toHaveLength(23);
    expect(actual[0].content.steps).toEqual(expected.lessons[0].content.steps);
    expect(actual[0].content.stamp).toBe(expected.lessons[0].content.stamp);
    expect(actual[0].content.source).toBeUndefined();
    expect(actual[0].title).toBe(lessons["b-1"].title);
  });

  test("rejects a malformed manifest with its file and line", () => {
    expect(() =>
      parseManifest({ levels: [], lessons: [{}] }, "course/manifest.json"),
    ).toThrow(/course\/manifest\.json:1:/);
  });

  test("rejects a malformed step file with its file and line", () => {
    expect(() =>
      parseLesson(
        "---\nlesson: b-1\n---\n## steps\nnot a step\n",
        "course/steps/b-1.md",
        {
          manifest: parseManifest(manifestValue),
          checks: lessons,
          probes: checks.probes,
        },
      ),
    ).toThrow(/course\/steps\/b-1\.md:5:/);
  });

  test("rejects a step-file folder rule because the manifest owns it", () => {
    const text = stepFiles["course/steps/i-capstone.md"].replace(
      "badge: Intermediate",
      "badge: Intermediate\nfolder: copy",
    );
    expect(() =>
      compileCourse(
        manifestValue,
        { ...stepFiles, "course/steps/i-capstone.md": text },
        pages,
        checks,
      ),
    ).toThrow(
      /course\/steps\/i-capstone\.md:5: folder is declared only in course\/manifest\.json/,
    );
  });
});

describe("generated Checks index", () => {
  test("matches the manifest and detects a hand edit", () => {
    const generated = generateCheckIndex(manifestValue);
    expect(
      readFileSync(`${root}practice-template/checks/lessons/index.mjs`, "utf8"),
    ).toBe(generated);
    expect(generated).not.toBe(`${generated}// hand edit\n`);
  });
});
