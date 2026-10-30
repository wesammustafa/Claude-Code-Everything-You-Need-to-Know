// The store, real (ticket 209, ported from learn-io and learn-folder):
// atomic saves only once .practice/ exists, format 1, and what it keeps.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  repo,
  withRepo,
} from "../../../practice-template/checks/test/helpers.mjs";
import {
  FORMAT,
  loadState,
  sanitize,
  saveState,
  storePath,
} from "../src/store.mjs";
import { realAdapters } from "../src/real.mjs";

const MINE = "/home/sam/code/my-app";

test("saved state: round trip, nothing written before .practice/ exists, junk ignored", () => {
  withRepo(
    () => repo(),
    (dir) => {
      const data = sanitize({
        welcomed: true,
        eased: ["status"],
        lessons: {
          "b-1": {
            step: "W3",
            beat: 0,
            done: ["W1"],
            answers: { "W4.0": "x" },
          },
        },
      });
      assert.equal(saveState(dir, data), false);
      assert.equal(
        existsSync(join(dir, ".practice")),
        false,
        "the app never creates .practice/",
      );
      mkdirSync(join(dir, ".practice"));
      assert.equal(saveState(dir, data), true);
      assert.deepEqual(loadState(dir), data);
      assert.deepEqual(
        readdirSync(join(dir, ".practice")),
        ["learn.json"],
        "no temp file left",
      );
      // A file the app can't read is moved aside (ticket 213), each to a
      // name of its own.
      writeFileSync(storePath(dir), "{nope");
      assert.deepEqual(loadState(dir), { unreadable: "moved" });
      writeFileSync(storePath(dir), JSON.stringify({ format: 99 }));
      assert.deepEqual(
        loadState(dir),
        { unreadable: "moved" },
        "a newer format starts fresh",
      );
      assert.deepEqual(readdirSync(join(dir, ".practice")).sort(), [
        "learn.json.unreadable",
        "learn.json.unreadable-2",
      ]);
      const clean = sanitize({
        welcomed: "yes",
        lessons: {
          "b-1": { step: 3, done: [1, "W1"], evil: true },
          "../x": {},
        },
        extra: 1,
      });
      assert.ok(!("extra" in clean), "an unknown top-level key is dropped");
      assert.deepEqual(Object.keys(clean.lessons), ["b-1"]);
      assert.equal(clean.welcomed, false);
      assert.equal(clean.lessons["b-1"].step, null);
      assert.deepEqual(clean.lessons["b-1"].done, ["W1"]);
      assert.equal(clean.lessons["b-1"].evil, undefined);
    },
  );
});

test("saved state: recalled keeps only warm-up ids, and an old file loads with none", () => {
  const data = sanitize({
    lessons: {
      "b-3": { recalled: ["R1", "W1", "R", 3, "R12", "../R2", null] },
    },
  });
  assert.deepEqual(data.lessons["b-3"].recalled, ["R1", "R12"]);
  assert.deepEqual(
    sanitize({ lessons: { "b-3": { recalled: "R1" } } }).lessons["b-3"]
      .recalled,
    [],
  );
  withRepo(
    () => repo(),
    (dir) => {
      mkdirSync(join(dir, ".practice"));
      // Written before `recalled` existed.
      writeFileSync(
        storePath(dir),
        JSON.stringify({
          format: 1,
          welcomed: true,
          lessons: {
            "b-3": { step: "R1", beat: 0, warm: ["R1", "R2"], done: [] },
          },
        }),
      );
      assert.deepEqual(loadState(dir).lessons["b-3"].recalled, []);
      const saved = sanitize({
        lessons: { "b-3": { warm: ["R1", "R2"], recalled: ["R1"] } },
      });
      assert.equal(saveState(dir, saved), true);
      assert.deepEqual(
        loadState(dir).lessons["b-3"].recalled,
        ["R1"],
        "it survives a save and a load",
      );
    },
  );
});

test("saved state: moreHelpAt keeps a step id, an old keepGuided maps to the saved step, anything else drops", () => {
  const one = (p) => sanitize({ lessons: { "b-1": p } }).lessons["b-1"];
  assert.equal(one({ keepGuided: true, step: "Y1" }).moreHelpAt, "Y1");
  assert.equal(
    one({ keepGuided: true, step: "Y1" }).keepGuided,
    undefined,
    "keepGuided is not saved again",
  );
  assert.equal(one({ moreHelpAt: "Y3", step: "Y4" }).moreHelpAt, "Y3");
  assert.equal(one({ moreHelpAt: "C" }).moreHelpAt, "C");
  for (const bad of [true, 3, "y1", "../Y1", "Y1 ", "", null])
    assert.equal(one({ moreHelpAt: bad }).moreHelpAt, null, String(bad));
  assert.equal(
    one({ keepGuided: true }).moreHelpAt,
    null,
    "no saved step, nothing to map to",
  );
  assert.equal(one({ keepGuided: true, step: "../x" }).moreHelpAt, null);
  assert.equal(one({ keepGuided: "yes", step: "Y1" }).moreHelpAt, null);
  assert.equal(one({ keepGuided: false, step: "Y1" }).moreHelpAt, null);
  assert.equal(one({}).moreHelpAt, null);
});

test("saved state: the work folders are an optional key, kept per level and per pinned lesson, as absolute paths only", () => {
  const folders = {
    intermediate: MINE,
    advanced: "/home/sam/code/other",
    "a-5": "/home/sam/claude-actions-practice",
    "a-capstone": "/home/sam/ci-review",
  };
  assert.deepEqual(sanitize({ folders }).folders, folders);
  // Nothing else: Beginner practises in the copy, other lessons use their level's.
  const kept = sanitize({
    folders: {
      ...folders,
      beginner: MINE,
      "i-1": MINE,
      "b-1": MINE,
      reason: "my app",
      "../x": MINE,
    },
  }).folders;
  assert.deepEqual(kept, folders);
  for (const bad of [
    "code/my-app",
    "./my-app",
    "",
    3,
    null,
    true,
    ["/x"],
    { path: "/x" },
    `/x\n/y`,
    `/x\0`,
    `/${"a".repeat(1024)}`,
  ]) {
    assert.equal(
      sanitize({ folders: { intermediate: bad } }).folders,
      undefined,
      JSON.stringify(bad),
    );
  }
  assert.equal(
    sanitize({ folders: { intermediate: `/${"a".repeat(1023)}` } }).folders
      .intermediate.length,
    1024,
    "a path of 1024 characters is kept",
  );
  // A file with no folder saves none: the key is left out, not written empty.
  assert.equal("folders" in sanitize({ welcomed: true, lessons: {} }), false);
  assert.equal("folders" in sanitize({ folders: "nope" }), false);
});

test("saved state: FORMAT stays 1, and a learn.json today's app wrote loads with its progress intact", () => {
  assert.equal(FORMAT, 1);
  withRepo(
    () => repo(),
    (dir) => {
      mkdirSync(join(dir, ".practice"));
      // Written by the app before the work folder: no `folders` key.
      const today = {
        format: 1,
        welcomed: true,
        eased: ["status"],
        missed: ["exit"],
        lessons: {
          "b-1": {
            step: null,
            beat: 0,
            done: ["W1", "W2", "W3"],
            answers: { "W4.0": "Yes" },
            levels: ["hinted"],
            lessHelp: false,
            moreHelpAt: null,
            easedSteps: { Y1: true },
            complete: true,
            warm: [],
            recalled: [],
            stamps: {},
            bottomAt: "W3",
          },
          "b-2": {
            step: "W2",
            beat: 1,
            done: ["R1", "W1"],
            answers: {},
            levels: [],
            lessHelp: true,
            moreHelpAt: "W2",
            easedSteps: {},
            complete: false,
            warm: ["R1", "R2"],
            recalled: ["R1"],
            stamps: { "Y1.0": "1:2:abc" },
            bottomAt: null,
          },
        },
      };
      writeFileSync(storePath(dir), `${JSON.stringify(today, null, 1)}\n`);
      assert.deepEqual(loadState(dir), today);
      // With folders, the same progress, and the folders round trip.
      const withFolders = sanitize({
        ...today,
        folders: { intermediate: MINE },
      });
      assert.equal(saveState(dir, withFolders), true);
      assert.deepEqual(loadState(dir), {
        ...today,
        folders: { intermediate: MINE },
      });
    },
  );
});

test("saved state: a lesson's fingerprint and the help its steps used are kept, anything malformed drops", () => {
  const print = "0123456789abcdef".repeat(4);
  const one = (p) => sanitize({ lessons: { "b-1": p } }).lessons["b-1"];
  assert.equal(one({ fingerprint: print }).fingerprint, print);
  for (const bad of [print.toUpperCase(), print.slice(1), `${print}0`, 3, null])
    assert.equal(
      "fingerprint" in one({ fingerprint: bad }),
      false,
      String(bad),
    );
  const help = {
    W1: { used: "own", at: 0 },
    W2: { used: "hints", at: 1_700_000_000_000 },
    C: { used: "commands", at: 5, extra: true },
  };
  assert.deepEqual(one({ help }).help, {
    ...help,
    C: { used: "commands", at: 5 },
  });
  const bad = one({
    help: {
      "../W1": { used: "own", at: 1 },
      w1: { used: "own", at: 1 },
      W2: { used: "guided", at: 1 },
      W3: { used: "own", at: -1 },
      W4: { used: "own", at: Number.NaN },
      W5: { used: "own", at: "1" },
      W6: "own",
      W7: null,
      W8: { used: "hints", at: 2 },
    },
  });
  assert.deepEqual(bad.help, { W8: { used: "hints", at: 2 } });
  assert.equal("help" in one({ help: { W1: null } }), false, "none: no key");
  assert.equal("help" in one({ help: "own" }), false);
  assert.equal("help" in one({}), false);
});

test("saved state: no file loads as null and moves nothing; an unreadable one is moved aside, never over an earlier one, and the next save writes a fresh file", () => {
  withRepo(
    () => repo(),
    (dir) => {
      const practice = join(dir, ".practice");
      mkdirSync(practice);
      assert.equal(loadState(dir), null);
      assert.deepEqual(readdirSync(practice), []);
      writeFileSync(join(practice, "learn.json.unreadable"), "earlier");
      writeFileSync(storePath(dir), "[1, 2]");
      assert.deepEqual(loadState(dir), { unreadable: "moved" });
      assert.equal(
        readFileSync(join(practice, "learn.json.unreadable"), "utf8"),
        "earlier",
        "the earlier file is kept byte for byte",
      );
      assert.equal(
        readFileSync(join(practice, "learn.json.unreadable-2"), "utf8"),
        "[1, 2]",
      );
      assert.equal(existsSync(storePath(dir)), false);
      const fresh = sanitize({ welcomed: true });
      assert.equal(saveState(dir, fresh), true);
      assert.deepEqual(loadState(dir), fresh);
      for (const text of ["null", '"x"', "3", '{"format":"1"}', ""]) {
        writeFileSync(storePath(dir), text);
        assert.deepEqual(loadState(dir), { unreadable: "moved" }, text);
      }
      assert.equal(
        readdirSync(practice).filter((f) => f.startsWith("learn.json.")).length,
        7,
      );
    },
  );
});

test("saved state: a learn.json that is a folder is moved aside too", () => {
  withRepo(
    () => repo(),
    (dir) => {
      mkdirSync(join(dir, ".practice"));
      mkdirSync(storePath(dir));
      writeFileSync(join(storePath(dir), "inside"), "x");
      assert.deepEqual(loadState(dir), { unreadable: "moved" });
      assert.equal(
        readFileSync(
          join(dir, ".practice", "learn.json.unreadable", "inside"),
          "utf8",
        ),
        "x",
      );
      assert.equal(saveState(dir, sanitize({})), true);
    },
  );
});

test.skipIf(process.platform === "win32" || process.getuid?.() === 0)(
  "saved state: a file that can't be moved aside stays where it is, and the real store then saves nothing",
  () => {
    withRepo(
      () => repo(),
      (dir) => {
        const practice = join(dir, ".practice");
        mkdirSync(practice);
        writeFileSync(storePath(dir), "{nope");
        chmodSync(practice, 0o555);
        try {
          const store = realAdapters({ root: dir }).store;
          assert.deepEqual(store.load(), { unreadable: "kept" });
          assert.equal(store.save(sanitize({})), false);
          assert.equal(readFileSync(storePath(dir), "utf8"), "{nope");
          assert.deepEqual(readdirSync(practice), ["learn.json"]);
        } finally {
          chmodSync(practice, 0o755);
        }
      },
    );
  },
);

test("saved state: no .practice/, no save and no temp file; a .practice that is a file loads as no save", () => {
  withRepo(
    () => repo(),
    (dir) => {
      assert.equal(saveState(dir, sanitize({})), false);
      writeFileSync(join(dir, ".practice"), "x");
      assert.equal(loadState(dir), null);
      assert.equal(readFileSync(join(dir, ".practice"), "utf8"), "x");
      rmSync(join(dir, ".practice"));
      assert.equal(existsSync(join(dir, ".practice")), false);
      assert.deepEqual(
        readdirSync(dir).filter((f) => f.endsWith(".tmp")),
        [],
      );
    },
  );
});
