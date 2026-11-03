// Files read as they are now, real (ticket 209, ported from learn-io): a
// stamp, a glob's newest match, and no file.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { grewFrom } from "../src/engine.ts";
import {
  repo,
  withRepo,
} from "../../../practice-template/checks/test/helpers.mjs";
import { bytesOf, matchOf, stampOf } from "../src/files.ts";

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

// Ticket 295: a Practice copy's project/ sits below the git root, where
// Claude Code keeps .claude/settings.local.json and Project-scope workflows.
const copyTree = (fn) => {
  const top = mkdtempSync(join(tmpdir(), "files-copy-"));
  try {
    mkdirSync(join(top, ".git"));
    mkdirSync(join(top, "project", ".claude", "workflows"), {
      recursive: true,
    });
    mkdirSync(join(top, ".claude", "workflows"), { recursive: true });
    fn(top, join(top, "project"));
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
};
const LOCAL = ".claude/settings.local.json";
const at = (file, s) => {
  utimesSync(file, s, s);
};

test("with alt, a file only at the git root is read and stamped", () => {
  copyTree((top, dir) => {
    writeFileSync(join(top, LOCAL), "{}\n");
    assert.equal(matchOf(dir, LOCAL, top), `../${LOCAL}`);
    assert.equal(bytesOf(dir, matchOf(dir, LOCAL, top))?.toString(), "{}\n");
    assert.notEqual(stampOf(dir, LOCAL, top), "");
    assert.equal(stampOf(dir, "gone.json", top), "", "in neither place");
  });
});

test("with alt, a file in both places reads project/", () => {
  copyTree((top, dir) => {
    writeFileSync(join(top, LOCAL), "root\n");
    writeFileSync(join(dir, LOCAL), "project\n");
    assert.equal(matchOf(dir, LOCAL, top), LOCAL);
    assert.equal(
      bytesOf(dir, matchOf(dir, LOCAL, top))?.toString(),
      "project\n",
    );
  });
});

test("with alt, a glob takes the newest file across both bases", () => {
  copyTree((top, dir) => {
    const glob = ".claude/workflows/*.js";
    writeFileSync(join(dir, ".claude/workflows/old.js"), "a");
    at(join(dir, ".claude/workflows/old.js"), 1_000);
    writeFileSync(join(top, ".claude/workflows/new.js"), "b");
    at(join(top, ".claude/workflows/new.js"), 2_000);
    assert.equal(matchOf(dir, glob, top), "../.claude/workflows/new.js");
    assert.equal(bytesOf(dir, matchOf(dir, glob, top))?.toString(), "b");
    at(join(dir, ".claude/workflows/old.js"), 3_000);
    assert.equal(matchOf(dir, glob, top), ".claude/workflows/old.js");
  });
});

test("alt equal to the folder is read once, and a call without alt is as before", () => {
  copyTree((top, dir) => {
    writeFileSync(join(top, LOCAL), "{}\n");
    assert.equal(matchOf(top, LOCAL, top), LOCAL);
    assert.equal(matchOf(top, ".claude/workflows/*.js", top), null);
    assert.equal(matchOf(dir, LOCAL), LOCAL);
    assert.equal(bytesOf(dir, LOCAL), null);
    assert.equal(stampOf(dir, LOCAL), "");
  });
});
