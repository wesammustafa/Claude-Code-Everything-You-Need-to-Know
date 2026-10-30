// Files read as they are now, real (ticket 209, ported from learn-io): a
// stamp, a glob's newest match, and no file.
import { test } from "vitest";
import assert from "node:assert/strict";
import { utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { grewFrom } from "../../../practice-template/learn/lib/holds.mjs";
import {
  repo,
  withRepo,
} from "../../../practice-template/checks/test/helpers.mjs";
import { bytesOf, matchOf, stampOf } from "../src/files.mjs";

test("a stamp stampOf takes on disk reads back in grewFrom: the bytes a file held, when it only grew since", () => {
  withRepo(
    () => repo({ "log.txt": "loaded: CLAUDE.md\n" }),
    (dir) => {
      const stamp = stampOf(dir, "log.txt");
      assert.equal(
        grewFrom(stamp, Buffer.from("loaded: CLAUDE.md\nsession started\n")),
        18,
      );
      assert.equal(
        grewFrom(stamp, Buffer.from("loaded: CLAUDE.md\n")),
        18,
        "the same bytes: nothing added",
      );
      assert.equal(
        grewFrom(stamp, Buffer.from("loaded: AGENTS.md\nsession started\n")),
        0,
        "rewritten",
      );
      assert.equal(
        grewFrom(stampOf(dir, "gone.txt"), Buffer.from("x\n")),
        0,
        "no file then",
      );
    },
  );
});

test("a glob path reads the newest file it matches, by its path, and none is no file (106)", () => {
  withRepo(
    () =>
      repo({
        ".claude/workflows/old.js": "export const a = 1;\n",
        ".claude/workflows/notes.md": "x\n",
      }),
    (dir) => {
      const glob = ".claude/workflows/*.js";
      assert.equal(matchOf(dir, glob), ".claude/workflows/old.js");
      writeFileSync(
        join(dir, ".claude/workflows/review.js"),
        "export const b = 2;\n",
      );
      utimesSync(join(dir, ".claude/workflows/old.js"), 1000, 1000);
      assert.equal(
        matchOf(dir, glob),
        ".claude/workflows/review.js",
        "the newest match",
      );
      assert.equal(bytesOf(dir, glob).toString(), "export const b = 2;\n");
      assert.equal(
        stampOf(dir, glob),
        stampOf(dir, ".claude/workflows/review.js"),
      );
      assert.equal(matchOf(dir, ".claude/workflows/*.ts"), null);
      assert.equal(matchOf(dir, ".claude/none/*.js"), null, "no folder");
      assert.equal(
        stampOf(dir, ".claude/none/*.js"),
        "",
        "no match stamps as no file",
      );
      assert.equal(bytesOf(dir, ".claude/none/*.js"), null);
      assert.equal(
        matchOf(dir, ".claude/workflows/notes.md"),
        ".claude/workflows/notes.md",
        "a plain path is itself",
      );
    },
  );
});

test("stampOf says no file with an empty string, and a file it can't read just now with null", () => {
  withRepo(
    () => repo({ "a.txt": "a\n" }),
    (dir) => {
      assert.equal(stampOf(dir, "gone.txt"), "");
      assert.equal(
        stampOf(dir, "a.txt/inside"),
        "",
        "a file where a folder should be",
      );
      assert.match(stampOf(dir, "a.txt"), /^\d+:2:/);
      assert.equal(bytesOf(dir, "gone.txt"), null);
      assert.equal(stampOf(dir, "."), null, "a folder is no file to read");
    },
  );
});
