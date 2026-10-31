// The fake adapters answer as the real ones do (ticket 209): the same file
// and store cases against a temporary folder and against the fakes, and the
// fake clock's order for timers due at once.
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
import { fakeAdapters, fakeClock } from "../src/fake.ts";
import { realAdapters } from "../src/real.ts";
import { sanitize } from "../src/store.ts";

// The same tree, made on disk, or in the fakes: files with their times.
const TREE = {
  "notes.md": ["n\n", 5_000],
  "wf/old.js": ["a\n", 1_000],
  "wf/b.js": ["b\n", 3_000],
  "wf/a.js": ["c\n", 3_000],
  "wf/x.md": ["x\n", 9_000],
};
function real() {
  const dir = mkdtempSync(join(tmpdir(), "host-fake-"));
  for (const [path, [text, ms]] of Object.entries(TREE)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
    utimesSync(join(dir, path), ms / 1000, ms / 1000);
  }
  return {
    dir,
    adapters: realAdapters({ root: dir }),
    done: () => rmSync(dir, { recursive: true, force: true }),
  };
}
function fake() {
  const dir = "/copy";
  const adapters = fakeAdapters({ root: dir });
  for (const [path, [text, ms]] of Object.entries(TREE))
    adapters.files.write(`${dir}/${path}`, text, ms);
  return { dir, adapters, done: () => {} };
}

// What a stamp says: no file, can't read, or a file of this size.
const kind = (stamp) =>
  stamp === ""
    ? "none"
    : stamp === null
      ? "unreadable"
      : stamp.split(":").slice(1, 2).join();
const answers = ({ dir, adapters: { files } }) => ({
  globNewest: files.match(dir, "wf/*.js"),
  globNone: files.match(dir, "wf/*.ts"),
  globNoFolder: files.match(dir, "none/*.js"),
  plain: files.match(dir, "notes.md"),
  bytes: files.bytes(dir, "wf/*.js")?.toString(),
  missingBytes: files.bytes(dir, "gone.md"),
  stamps: ["notes.md", "gone.md", "notes.md/inside", "none/*.js", "wf"].map(
    (p) => kind(files.stamp(dir, p)),
  ),
  exists: [files.exists(join(dir, "wf")), files.exists(join(dir, "gone.md"))],
});

test("the fake files read as the real ones: a glob's newest match, ties to the lower name, no file, and stamps", () => {
  const r = real();
  const f = fake();
  try {
    const want = answers(r);
    assert.equal(
      want.globNewest,
      "wf/a.js",
      "the newest, and of two as new the lower name",
    );
    assert.deepEqual(answers(f), want);
    // The same file stamps the same way: its time, size and content.
    utimesSync(join(r.dir, "notes.md"), 5, 5);
    assert.equal(
      r.adapters.files.stamp(r.dir, "notes.md"),
      f.adapters.files.stamp(f.dir, "notes.md"),
    );
  } finally {
    r.done();
  }
});

test("the fake store fails as the real one where .practice is a file", () => {
  const r = real();
  const f = fake();
  const data = sanitize({ welcomed: true, lessons: {} });
  try {
    writeFileSync(join(r.dir, ".practice"), "not a folder");
    f.adapters.files.write(join(f.dir, ".practice"), "not a folder");
    for (const { adapters } of [r, f])
      assert.throws(() => adapters.store.save(data), { code: "ENOTDIR" });
    assert.deepEqual(f.adapters.store.saves, []);
  } finally {
    r.done();
  }
});

test("the fake store saves as the real one: nothing while .practice/ is missing, then what it was given", () => {
  const r = real();
  const f = fake();
  const data = sanitize({ welcomed: true, lessons: { "b-1": { step: "W3" } } });
  try {
    for (const { dir, adapters } of [r, f]) {
      assert.equal(adapters.store.save(data), false);
      if (adapters === r.adapters) mkdirSync(join(dir, ".practice"));
      else adapters.files.folder(join(dir, ".practice"));
      assert.equal(adapters.store.save(data), true);
    }
    assert.deepEqual(r.adapters.store.load(), data);
    assert.deepEqual(f.adapters.store.saves, [data]);
    f.adapters.store.fail("EACCES");
    assert.throws(() => f.adapters.store.save(data), { code: "EACCES" });
  } finally {
    r.done();
  }
});

test("the fake clock runs timers due at once in the order they were set, and an interval keeps its place", async () => {
  const clock = fakeClock(0);
  const ran = [];
  clock.setInterval(() => ran.push(`tick ${clock.now()}`), 1_000);
  clock.setInterval(() => ran.push(`poll ${clock.now()}`), 500);
  clock.setTimeout(() => ran.push(`once ${clock.now()}`), 1_000);
  await clock.advance(1_000);
  assert.deepEqual(ran, ["poll 500", "tick 1000", "poll 1000", "once 1000"]);
  assert.deepEqual(clock.pending(), [
    { ms: 1_000, every: 1_000 },
    { ms: 500, every: 500 },
  ]);
});
