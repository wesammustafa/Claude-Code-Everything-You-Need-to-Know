// The watcher (spec: Watching; ticket 209, ported from learn-io): the
// folders it arms, and its 150 ms debounce on a fake clock.
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { repo } from "../../../practice-template/checks/test/helpers.mjs";
import { fakeClock } from "../src/fake.mjs";
import { watchDirs } from "../src/watch.mjs";

// spec: watching
test("the watcher arms a .practice folder made after it started", async () => {
  // Events only speed things up: they can lag or never come (WSL on
  // /mnt/c, network folders), so main.mjs also polls. What must hold is that
  // a change re-arms the watcher on the new folder.
  const dir = repo();
  const w = watchDirs(dir, () => {}, { debounceMs: 20 });
  try {
    assert.ok(!w.dirs().some((d) => d.endsWith(".practice")));
    mkdirSync(join(dir, ".practice"));
    w.arm();
    assert.ok(
      w.dirs().some((d) => d.endsWith(".practice")),
      "the new folder is watched",
    );
  } finally {
    w.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

// spec: watching
test("the watcher watches .claude/ and the folders right in it, when they exist, and arms ones made later", async () => {
  const dir = repo({
    ".claude/skills/five-whys/SKILL.md": "s\n",
    ".claude/settings.json": "{}\n",
  });
  const w = watchDirs(dir, () => {}, { debounceMs: 20 });
  const rel = () =>
    w
      .dirs()
      .map((d) => d.slice(dir.length + 1))
      .filter(Boolean)
      .sort();
  try {
    assert.deepEqual(
      rel(),
      [".claude", ".claude/skills", ".git"],
      "a folder deeper in, and a file, are not watched",
    );
    mkdirSync(join(dir, ".claude", "agents"));
    w.arm();
    assert.deepEqual(rel(), [
      ".claude",
      ".claude/agents",
      ".claude/skills",
      ".git",
    ]);
  } finally {
    w.close();
    rmSync(dir, { recursive: true, force: true });
  }
  // A .claude/ made after the watcher started.
  const later = repo();
  const v = watchDirs(later, () => {}, { debounceMs: 20 });
  try {
    assert.ok(!v.dirs().some((d) => d.endsWith(".claude")));
    mkdirSync(join(later, ".claude", "skills"), { recursive: true });
    v.arm();
    assert.ok(
      v.dirs().some((d) => d.endsWith(".claude")) &&
        v.dirs().some((d) => d.endsWith(join(".claude", "skills"))),
      `${v.dirs()}`,
    );
  } finally {
    v.close();
    rmSync(later, { recursive: true, force: true });
  }
});

// spec: watching
test("the watcher calls back once a burst of changes has been quiet for 150 ms, by default", async () => {
  const dir = repo();
  const clock = fakeClock();
  // Each event starts the wait again: count them, to know the burst is over.
  let events = 0;
  const timers = {
    setTimeout: (fn, ms) => ((events += 1), clock.setTimeout(fn, ms)),
    clearTimeout: clock.clearTimeout,
  };
  let calls = 0;
  const w = watchDirs(
    dir,
    () => {
      calls += 1;
    },
    { timers },
  );
  try {
    // The events land while the clock stands still. A change made just as
    // the watcher starts can go unreported (macOS), so keep making changes,
    // 50 ms apart, until one is seen; then wait until none has come for
    // 300 ms.
    for (let k = 0; events === 0 && k < 60; k += 1) {
      mkdirSync(join(dir, `d${k}`));
      await new Promise((r) => setTimeout(r, 50));
    }
    for (let seen = -1; seen !== events;) {
      seen = events;
      await new Promise((r) => setTimeout(r, 300));
    }
    assert.ok(events > 0, "the burst was seen");
    assert.deepEqual(
      clock.pending(),
      [{ ms: 150, every: null }],
      "one wait is left",
    );
    await clock.advance(149);
    assert.equal(calls, 0, "not before 150 ms of quiet");
    await clock.advance(1);
    assert.equal(calls, 1, "once, at 150 ms");
  } finally {
    w.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
