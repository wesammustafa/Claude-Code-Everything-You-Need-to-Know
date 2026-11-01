// The legacy fingerprints generator (ticket 256): the in-repo template copy
// is byte-identical to the commit the data file names, so it yields the
// committed data.
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
};

describe("legacy fingerprints", () => {
  test("the template's Lesson files yield the committed data", () => {
    expect(
      legacyFingerprints(
        `${root}practice-template/learn/lessons`,
        manifest,
        data.commit,
        data.template,
      ),
    ).toEqual(data);
  });

  test("a missing Lesson file throws with its path", () => {
    expect(() =>
      legacyFingerprints(`${root}quest/release/test`, manifest, data.commit),
    ).toThrow(/quest\/release\/test\/b-1\.md: no such Lesson file/);
  });
});
