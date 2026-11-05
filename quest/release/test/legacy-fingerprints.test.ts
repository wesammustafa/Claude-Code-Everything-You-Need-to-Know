// The legacy fingerprints generator (ticket 256): the in-repo template copy
// is the commit the data file names, but for the Lessons whose Steps changed
// since, so it yields the committed data for every other Lesson.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { legacyFingerprints } from "../src/legacy-fingerprints.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const read = (path: string) => readFileSync(`${root}${path}`, "utf8");
const manifest: unknown = JSON.parse(read("course/manifest.json"));
const data = JSON.parse(read("course/legacy-fingerprints.json")) as {
  template: string;
  commit: string;
  lessons: Record<string, string>;
};
// i-2's W4 is self-verified since the legacy commit (304), and i-5's Y4
// runs the committed protect-files script (334).
const CHANGED_SINCE_LEGACY = ["i-2", "i-5"];

describe("legacy fingerprints", () => {
  test("the template's Lesson files yield the committed data", () => {
    const now = legacyFingerprints(
      `${root}practice-template/learn/lessons`,
      manifest,
      data.commit,
      data.template,
    );
    const unchanged = (lessons: Record<string, string>) =>
      Object.fromEntries(
        Object.entries(lessons).filter(
          ([id]) => !CHANGED_SINCE_LEGACY.includes(id),
        ),
      );
    for (const id of CHANGED_SINCE_LEGACY)
      expect(now.lessons[id], `${id} changed`).not.toBe(data.lessons[id]);
    expect({ ...now, lessons: unchanged(now.lessons) }).toEqual({
      ...data,
      lessons: unchanged(data.lessons),
    });
    expect(Object.keys(now.lessons)).toEqual(Object.keys(data.lessons));
  });

  test("a missing Lesson file throws with its path", () => {
    expect(() =>
      legacyFingerprints(`${root}quest/release/test`, manifest, data.commit),
    ).toThrow(/quest\/release\/test\/b-1\.md: no such Lesson file/);
  });
});
