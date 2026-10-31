// i-6's description beat and its committed Check agree (moved from the
// Checks' tests in ticket 210): a description the editing card accepts is
// one `npm run check` passes, and one it rejects fails there too.
import { test } from "vitest";
import assert from "node:assert/strict";
import { judge } from "../src/holds.ts";
import {
  check,
  commit,
  repo,
  withRepo,
  write,
} from "../../../practice-template/checks/test/helpers.mjs";
import { liveCourse } from "./drive.mjs";

const path = ".claude/agents/test-gaps.md";
const lesson = liveCourse.find((l) => l.id === "i-6").content;
const description = lesson.steps
  .flatMap((step) => step.beats)
  .find(
    (beat) =>
      beat.verify.path === path &&
      beat.verify.regex?.startsWith("^description:"),
  );

for (const [words, accepted] of [
  ["Finds untested functions.", false],
  ["Finds exported functions without tests and reports.", false],
  ["Finds exported functions without tests and reports gaps.", true],
  [
    "Finds untested exported functions. Use when identifying missing tests.",
    true,
  ],
]) {
  test(
    `i-6 description card and committed check agree on: ${words}`,
    { timeout: 60_000 },
    () => {
      const agent = `---\nname: test-gaps\ndescription: ${words}\ntools: Read, Grep, Glob\n---\n\nList exported functions no test calls. Never change files.\n`;
      assert.ok(description, "the lesson must have a description beat");
      assert.equal(
        judge(description.verify, Buffer.from(agent)).pass,
        accepted,
        "the editing card must not confirm a description the next committed check rejects",
      );
      withRepo(
        () => repo({ [path]: agent }),
        (dir) => {
          commit(dir, "Add test-gaps");
          write(dir, { ".practice/i-6-agents.txt": "test-gaps\n" });
          const result = check(["i-6", "--dir", dir]);
          assert.equal(result.code, accepted ? 0 : 1, result.out);
          if (!accepted)
            assert.match(
              result.out,
              /Write a description of a sentence or two/,
            );
        },
      );
    },
  );
}
