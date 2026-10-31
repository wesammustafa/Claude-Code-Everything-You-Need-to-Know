// The lesson-quotes rule is retired (261): the in-repo lesson test is the
// only quote check, and it keeps every case.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

const root = new URL("../../../", import.meta.url);

function grep(...patterns) {
  try {
    return execFileSync(
      "git",
      ["grep", "-l", ...patterns.flatMap((p) => ["-e", p]), "--", ":!CHANGELOG.md", ":!.github/scripts/test/retired-rules.test.mjs"],
      { cwd: root, encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
}

test("nothing outside the CHANGELOG names the retired rule", () => {
  assert.equal(grep("lesson-quotes", "lessonQuotes", "LEARN_DIR", "learn.txt"), "");
});

test("the lesson test keeps all 29 cases", () => {
  const cases = readdirSync(new URL("quest/engine/test/fixtures/lessons/", root), {
    withFileTypes: true,
  }).filter((entry) => entry.isDirectory());
  assert.equal(cases.length, 29);
});
