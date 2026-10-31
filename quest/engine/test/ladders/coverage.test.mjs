// Each manifest lesson has its ladder test file, and each file is a lesson's.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(
    new URL("../../../../course/manifest.json", import.meta.url),
    "utf8",
  ),
);

test("every lesson has a ladder test file, and every ladder test file a lesson", () => {
  const files = readdirSync(new URL(".", import.meta.url))
    .filter((f) => f.endsWith(".test.mjs") && f !== "coverage.test.mjs")
    .map((f) => f.slice(0, -".test.mjs".length));
  assert.deepEqual(files.sort(), manifest.lessons.map((l) => l.id).sort());
});

test("each ladder test file runs its own lesson", () => {
  for (const { id } of manifest.lessons) {
    const text = readFileSync(
      new URL(`${id}.test.mjs`, import.meta.url),
      "utf8",
    );
    assert.match(text, new RegExp(`ladderTest\\("${id}"\\)`));
  }
});
