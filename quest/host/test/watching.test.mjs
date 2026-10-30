// Watching (spec: Watching; ticket 209), on a fake clock and fake
// adapters: the tick, the poll that is the truth, the save's quiet window,
// the copy's .practice/ appearing, a bad work folder looked at again, and
// the work folder's own watcher.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  DEMO_I1,
  finishedBefore,
  threeLevels,
} from "../../engine/test/drive.mjs";
import {
  evidence,
  initialState,
  opensWithCheck,
  reduce,
  workFolder,
} from "../src/engine.ts";
import { fakeClock } from "../src/fake.ts";
import {
  AT_W3,
  fakeHost,
  PRACTICE,
  ROOT,
  turn,
  typesOf,
  VERSION,
  w3,
} from "./scripted.mjs";

const MINE = "/home/sam/mine";
const fine = (path) => ({
  path,
  missing: false,
  git: true,
  gitBroken: null,
  practice: true,
});
const count = (heard, type) =>
  heard.filter((h) => h.input.type === type).length;
// i-1 in the Intermediate folder MINE, its Worked example in the copy.
const workedInCopy = DEMO_I1.replace(
  "next: i-2\n---",
  "next: i-2\nworked: copy\n---",
);
const atI1 = (extra = {}) => {
  const course = threeLevels({ "i-1": workedInCopy });
  return fakeHost({
    course,
    saved: {
      format: 1,
      welcomed: true,
      lessons: finishedBefore("i-1", course),
      folders: { intermediate: MINE },
    },
    ...extra,
  });
};

// spec: watching
test("the tick comes every second, and stops with the host", async () => {
  const { host, clock, heard } = fakeHost({ saved: AT_W3 });
  await host.open();
  host.start();
  await clock.advance(3_000);
  assert.equal(count(heard, "tick"), 3);
  host.close();
  await clock.advance(3_000);
  assert.equal(count(heard, "tick"), 3);
});

// spec: watching
test("the poll looks every 500 ms and asks again for what the beat waits on at most every 2 s", async () => {
  const { host, clock, adapters } = fakeHost({
    saved: AT_W3,
    checks: () => w3(false),
  });
  await host.open();
  host.start();
  host.dispatch({ type: "lesson.open", lesson: "b-1" });
  await turn();
  assert.equal(adapters.checks.calls.length, 1, "the beat's opening run");
  await clock.advance(500);
  assert.equal(adapters.checks.calls.length, 2, "the first poll asks at once");
  await clock.advance(1_999);
  assert.equal(adapters.checks.calls.length, 2, "none 1999 ms later");
  await clock.advance(1);
  assert.equal(adapters.checks.calls.length, 3, "one 2 s later");
  // Nothing to wait on: the poll asks for nothing.
  const quiet = fakeHost({ checks: () => w3(false) });
  await quiet.host.open();
  quiet.host.start();
  await quiet.clock.advance(5_000);
  assert.equal(quiet.adapters.checks.calls.length, 0);
});

// spec: watching
test("a change within 400 ms of a save is the save's own, and one at 400 ms counts", async () => {
  const { host, clock, adapters, heard } = fakeHost({ saved: AT_W3 });
  await host.open();
  host.start();
  host.dispatch({ type: "lesson.open", lesson: "b-1" });
  assert.equal(adapters.store.saves.length, 1);
  clock.spend(399);
  adapters.fire(ROOT);
  assert.equal(count(heard, "activity"), 0);
  clock.spend(1);
  adapters.fire(ROOT);
  assert.equal(count(heard, "activity"), 1);
});

// spec: watching
test("a change in the app's first 400 ms counts on a clock that starts at 0, as performance.now() does (learn-io 951)", async () => {
  const { host, clock, adapters, heard } = fakeHost({
    saved: AT_W3,
    clock: fakeClock(0),
  });
  await host.open();
  host.start();
  await clock.advance(100);
  adapters.fire(ROOT);
  assert.equal(count(heard, "activity"), 1);
});

// spec: watching
test("a change says the copy's .practice/ appeared only when it did, then that the Learner is working, then asks again", async () => {
  const { host, clock, adapters, heard, state } = fakeHost({
    saved: AT_W3,
    tree: {},
  });
  await host.open();
  host.start();
  host.dispatch({ type: "lesson.open", lesson: "b-1" });
  await turn();
  adapters.checks.calls[0].resolve(w3(false));
  await turn();
  clock.spend(400);
  const from = heard.length;
  adapters.fire(ROOT);
  assert.deepEqual(typesOf(heard.slice(from)), ["activity"]);
  adapters.files.folder(PRACTICE);
  adapters.files.write(`${ROOT}/${VERSION}`, "2.1.285 (Claude Code)\n");
  const next = heard.length;
  adapters.fire(ROOT);
  assert.deepEqual(
    heard.slice(next).map((h) => h.input),
    [{ type: "facts", facts: { practiceDir: true } }, { type: "activity" }],
  );
  assert.equal(state().facts.practiceDir, true);
  assert.equal(
    adapters.checks.calls.length,
    2,
    "the beat's check is asked again",
  );
});

// spec: watching
test("a work folder that was wrong is looked at again on a change and on the poll, one look at a time; a folder that was fine is left alone", async () => {
  const { host, clock, adapters, heard, state } = atI1();
  await host.open();
  host.start();
  await turn();
  assert.deepEqual(adapters.folders.looked, [MINE]);
  assert.equal(state().probes[MINE].missing, true);
  // From now each look waits for the test.
  const held = [];
  adapters.folders.look = (path) => {
    adapters.folders.looked.push(path);
    return new Promise((r) => held.push(r));
  };
  adapters.fire(ROOT);
  adapters.fire(ROOT);
  assert.equal(adapters.folders.looked.length, 2, "one look at a time");
  await clock.advance(2_500);
  assert.equal(adapters.folders.looked.length, 2, "the poll waits for it too");
  held[0](fine(MINE));
  await turn();
  assert.equal(state().probes[MINE].missing, false);
  assert.ok(heard.some((h) => h.input.type === "probed" && !h.input.missing));
  adapters.fire(ROOT);
  await clock.advance(5_000);
  assert.equal(
    adapters.folders.looked.length,
    2,
    "a fine folder is left alone",
  );
});

// spec: watching
test("the poll looks again at a wrong folder every 2 s", async () => {
  const { host, clock, adapters } = atI1();
  await host.open();
  host.start();
  await turn();
  assert.equal(adapters.folders.looked.length, 1);
  await clock.advance(500);
  assert.equal(adapters.folders.looked.length, 2, "the first poll");
  await clock.advance(1_500);
  assert.equal(adapters.folders.looked.length, 2);
  await clock.advance(500);
  assert.equal(adapters.folders.looked.length, 3, "2 s after the last look");
});

// spec: watching
// spec: folders.progress-in-copy
test("the work folder has its own watcher, armed again as the Learner moves to a step in another folder (FO:1688); checks run there and progress saves to the copy (FO:809)", async () => {
  const { host, adapters, clock, heard } = atI1({
    folders: { [MINE]: fine(MINE) },
    checks: () => ({ items: [] }),
  });
  await host.open();
  host.start();
  await turn();
  // The overview: the lesson's folder.
  assert.deepEqual(adapters.armed(), [ROOT, MINE]);
  host.dispatch({ type: "lesson.start", help: "planned" });
  await turn();
  // A Worked example step that runs in the copy is watched there alone.
  assert.equal(host.snapshot().lesson.phase, "playing");
  assert.deepEqual(adapters.armed(), [ROOT]);
  assert.deepEqual(
    adapters.checks.calls.map((c) => c.dir),
    [ROOT],
    "its check runs in the copy",
  );
  // Back to another lesson in the copy and to i-1's overview again.
  host.dispatch({ type: "lesson.restart", lesson: "i-1" });
  assert.deepEqual(adapters.armed(), [ROOT, MINE]);
  host.firstLook();
  await turn();
  assert.equal(
    adapters.checks.calls.at(-1).dir,
    MINE,
    "the lesson's check runs in its folder",
  );
  // A change in the work folder counts, and progress saves to the copy.
  clock.spend(400);
  adapters.fire(MINE);
  assert.equal(count(heard, "activity"), 1);
  assert.ok(adapters.store.saves.length > 0);
  assert.equal(
    adapters.arms.filter((a) => a.dir === ROOT).length,
    1,
    "one watcher on the copy",
  );
});

// The selectors the host reads off the engine's state alone (209's, lifted
// into the engine in 210).
test("the host's selectors: evidence only on a card, the work folder of the step", () => {
  const course = threeLevels({ "i-1": workedInCopy });
  const facts = { root: ROOT, name: "", gitError: null, practiceDir: true };
  let s = initialState({
    course,
    saved: {
      format: 1,
      welcomed: true,
      lessons: finishedBefore("i-1", course),
      folders: { intermediate: MINE },
    },
    facts,
    now: 0,
  });
  assert.equal(workFolder(s), MINE, "an overview: the lesson's folder");
  assert.equal(opensWithCheck(s), true);
  s = reduce(s, { type: "lesson.start", help: "planned", now: 1 }).state;
  assert.equal(workFolder(s), ROOT, "a Worked example in the copy");
  assert.equal(evidence(s), null, "W1 names no evidence file");
  const b1 = initialState({ course, saved: AT_W3, facts, now: 0 });
  assert.equal(evidence(b1), null, "a resume with no beat open: no card");
  const onW3 = reduce(b1, { type: "lesson.open", lesson: "b-1", now: 1 }).state;
  assert.equal(evidence(onW3), VERSION);
});
