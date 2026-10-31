// The engine's events (ticket 212): each moment the old motion stamps
// marked, as an event a reduce returns once, at its moment and never on the
// next input. Driven by actions and results through the action driver.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  EVENT_TYPES,
  NEW_COPY,
  checkError,
  checkItems,
  checkResult,
  course,
  driver,
  finished,
  finishedBefore,
  gitLists,
  hintAvailable,
  IDLE_MS,
  onReading,
  pending,
  playUntil,
  running,
  save,
  stepOf,
} from "./drive.mjs";
import { C } from "../src/copy.ts";

const lesson = (id) => course.find((l) => l.id === id);
const types = (last) => last.events.map((e) => e.type);
// The events of the last input, then a tick that marks none: a moment
// fires once.
function once(d) {
  const events = d.last.events;
  d.tick(1);
  assert.deepEqual(d.last.events, [], "the next input marks nothing");
  return events;
}
// The host's run-start for an effect: its child really starts.
const runStart = (eff, asked = eff.asked ?? 0) => ({
  ...eff,
  type: "run-start",
  run: eff.type,
  asked,
});
// On b-1 W3, a check beat: its opening run asked for. `done` is the steps
// already done: W3 among them on a replay.
function onW3(done = ["W1", "W2"]) {
  const d = driver({
    course,
    saved: save({ lessons: { "b-1": { step: "W3", beat: 0, done } } }),
  });
  d.open("b-1");
  assert.equal(stepOf(d.state).id, "W3");
  return { d, eff: pending(d, "check") };
}
const failing = (d, hint) =>
  checkItems(d.state, false).map((it) => (hint ? { ...it, hint } : it));
// r, its child's start, and its result.
function rRun(d, items, extra = {}) {
  d.run();
  const eff = d.last.effects.find((e) => e.type === "check");
  d.send(runStart(eff));
  d.send(checkResult(eff, items, extra));
  return eff;
}
// How many runs started, and how many ended with each ending, over `events`.
const endings = ["check.passed", "check.notYet", "check.broken", "check.ended"];
const tally = (events) => ({
  started: events.filter((e) => e.type === "check.started").length,
  ended: events.filter((e) => endings.includes(e.type)).length,
});

test("the opening run: check.started when its child starts, check.progress per item, and the first look ends it with check.ended", () => {
  const { d, eff } = onW3();
  assert.deepEqual(d.last.events, [], "opening a beat is no moment");
  d.send(runStart(eff));
  assert.deepEqual(once(d), [{ type: "check.started" }]);
  d.send(runStart(eff));
  assert.deepEqual(d.last.events, [], "a second start of the same run");
  d.send(running(eff, 1, 2));
  assert.deepEqual(once(d), [{ type: "check.progress", n: 1, m: 2 }]);
  d.send(running(eff, 1, 2));
  assert.deepEqual(d.last.events, []);
  d.send(checkResult(eff, failing(d)));
  assert.equal(d.state.beat.status, "waiting", "the first look is a baseline");
  assert.deepEqual(once(d), [{ type: "check.ended" }]);
});

test("r: check.started, then one Not yet; an identical poll FAIL marks nothing, and a repeated r FAILs again", () => {
  const { d, eff } = onW3();
  d.send(checkResult(eff, failing(d)));
  d.run();
  assert.deepEqual(d.last.events, [], "r alone starts nothing yet");
  const again = d.last.effects.find((e) => e.type === "check");
  d.send(runStart(again));
  assert.deepEqual(once(d), [{ type: "check.started" }]);
  d.send(checkResult(again, failing(d)));
  const hint = failing(d)[0].hint;
  assert.deepEqual(once(d), [{ type: "check.notYet", evidence: hint }]);
  // The watcher's poll: the same FAIL, no run started.
  d.send(runStart(eff));
  d.send(checkResult(eff, failing(d)));
  assert.deepEqual(d.last.events, [], "an identical poll FAIL");
  // A poll with another message is a new Not yet, and a changed look.
  d.send(checkResult(eff, failing(d, "Still not there.")));
  assert.deepEqual(types(d.last), ["check.notYet", "work.changed"]);
  assert.equal(d.last.events[0].evidence, "Still not there.");
  rRun(d, failing(d, "Still not there."));
  assert.deepEqual(
    d.events.slice(-2).map((e) => e.type),
    ["check.started", "check.notYet"],
    "r that FAILs the same way says so again",
  );
});

test("a passing run: check.passed with firstTime, and the step's last beat completes the step", () => {
  const { d, eff } = onW3();
  d.send(runStart(eff));
  d.send(checkResult(eff, checkItems(d.state, true)));
  assert.equal(d.state.beat.status, "already");
  assert.deepEqual(once(d), [
    { type: "check.passed", firstTime: true },
    { type: "step.completed" },
  ]);
  d.cont();
  assert.deepEqual(d.last.events, [], "going on is no moment");
  // Played again, the step is done already: a nod.
  const replay = onW3(["W1", "W2", "W3"]).d;
  const e = pending(replay, "check");
  replay.send(checkResult(e, checkItems(replay.state, true)));
  assert.deepEqual(types(replay.last), ["check.passed", "step.completed"]);
  assert.equal(replay.last.events[0].firstTime, false);
});

test("every check.started is followed by exactly one ending: the baseline, an unchanged file, a slow item left for r, a later r, a Check that could not run, and leaving mid-run", () => {
  // The baseline.
  {
    const { d, eff } = onW3();
    d.send(runStart(eff));
    d.send(checkResult(eff, failing(d)));
    assert.deepEqual(tally(d.events), { started: 1, ended: 1 });
  }
  // A fresh beat whose file has not changed since its step opened.
  {
    const d = onReading(
      "check 0 fresh\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt",
    );
    const eff = pending(d, "check");
    d.send(runStart(eff));
    d.send(checkResult(eff, checkItems(d.state, true), { stamp: "x" }));
    assert.equal(d.state.beat.stale, true);
    assert.deepEqual(types(d.last), ["check.ended"]);
    assert.deepEqual(tally(d.events), { started: 1, ended: 1 });
  }
  // A run that leaves its slow item for r.
  {
    const { d, eff } = onW3();
    d.send(runStart(eff));
    const items = checkItems(d.state, false).map((it) => ({
      ...it,
      slow: true,
    }));
    d.send(checkResult(eff, items));
    assert.equal(d.state.beat.slowWait, true);
    assert.deepEqual(types(d.last), ["check.ended"]);
  }
  // r, then r again before the first answered: one run, one ending.
  {
    const { d, eff } = onW3();
    d.send(checkResult(eff, failing(d)));
    d.run();
    const first = d.last.effects.find((e) => e.type === "check");
    d.send(runStart(first));
    d.run();
    const second = d.last.effects.find((e) => e.type === "check");
    assert.deepEqual(d.last.events, []);
    d.send(runStart(second));
    assert.deepEqual(d.last.events, [], "the later r keeps the one run");
    d.send(checkResult(first, failing(d)));
    assert.deepEqual(d.last.events, [], "the earlier r's result is not it");
    d.send(checkResult(second, failing(d)));
    assert.deepEqual(types(d.last), ["check.notYet"]);
    assert.deepEqual(tally(d.events), { started: 1, ended: 1 });
  }
  // A Check that could not run.
  {
    const { d, eff } = onW3();
    d.send(checkResult(eff, failing(d)));
    d.run();
    const again = d.last.effects.find((e) => e.type === "check");
    d.send(runStart(again));
    d.send(checkError(again, "it took too long"));
    assert.deepEqual(once(d), [{ type: "check.broken" }]);
    assert.deepEqual(tally(d.events), { started: 1, ended: 1 });
  }
  // Leaving the beat while it runs.
  {
    const { d, eff } = onW3();
    d.send(runStart(eff));
    d.back();
    assert.deepEqual(types(d.last), ["check.ended"]);
    assert.deepEqual(tally(d.events), { started: 1, ended: 1 });
  }
});

test("check.started never fires for a poll's run, a result about another folder, a stamp, or a beat that reads its file itself", () => {
  const { d, eff } = onW3();
  d.send(checkResult(eff, failing(d)));
  // A poll while the beat waits: its child starts, but no card says "Checking".
  d.send(runStart(eff));
  assert.deepEqual(d.last.events, []);
  // Another folder's run while r's goes.
  d.run();
  const again = d.last.effects.find((e) => e.type === "check");
  d.send({ ...runStart(again), dir: "/home/sam/elsewhere" });
  assert.deepEqual(d.last.events, []);
  // A file the beat reads itself starts no child: a pass with no run.
  const f = onReading("file notes.txt");
  const read = pending(f, "file");
  f.send({ ...runStart(read), run: "check" });
  assert.deepEqual(f.last.events, []);
  f.send({
    type: "file",
    path: "notes.txt",
    read: Buffer.from("a line\n"),
    stamp: "b",
    found: "notes.txt",
    asked: 0,
    dir: read.dir,
  });
  assert.deepEqual(types(f.last), ["check.passed", "step.completed"]);
  assert.equal(tally(f.events).started, 0);
});

test("a scoped git beat: check.started on its run, then one ending; a newly staged path is a change, and a whole-tree result it does not read is none", () => {
  const d = onReading("git-changed src/");
  const eff = pending(d, "git");
  assert.equal(eff.files, true);
  d.send(runStart(eff));
  assert.deepEqual(once(d), [{ type: "check.started" }]);
  d.send(gitLists(["docs/a.md"], [], { dir: eff.dir }));
  assert.deepEqual(types(d.last), ["check.ended"]);
  // The same paths, one now staged: a change.
  d.send(gitLists(["docs/a.md"], ["docs/a.md"], { dir: eff.dir }));
  assert.deepEqual(types(d.last), ["work.changed"]);
  // git status of the whole tree: not what this beat reads.
  d.send({ type: "git", paths: ["x.txt"], dir: eff.dir });
  assert.deepEqual(d.last.events, []);
  d.send(gitLists(["src/new.js"], [], { dir: eff.dir }));
  assert.deepEqual(types(d.last), ["check.passed", "step.completed"]);
});

test("a git-clean Not yet's evidence is the verification line: one file's uncommitted changes, what changed under a folder, or what changed anywhere (D9)", () => {
  for (const [scope, listed, line] of [
    ["notes.md", ["notes.md"], C.uncommitted("notes.md")],
    [
      "src/",
      ["src/a.js", "src/b.js"],
      C.changedUnder(2, "src/", "src/a.js, src/b.js", 0),
    ],
    ["", ["x.txt"], C.dirty(1, "x.txt", 0)],
  ]) {
    const d = onReading(`git-clean ${scope}`.trim());
    // A scoped beat lists files; the whole tree's status lists paths.
    const result = (eff) =>
      scope
        ? gitLists(listed, [], { dir: eff.dir, asked: eff.asked })
        : { type: "git", paths: listed, dir: eff.dir, asked: eff.asked };
    d.send(result(pending(d, "git")));
    d.run();
    const eff = d.last.effects.find((e) => e.type === "git");
    d.send(runStart(eff));
    d.send(result(eff));
    const notYet = d.last.events.find((e) => e.type === "check.notYet");
    assert.deepEqual(notYet, { type: "check.notYet", evidence: line }, scope);
  }
});

test("work.changed: not on the first look, an identical look or another lesson's result; on a changed look and on a file change while watched; never during a run or on the passing look", () => {
  const { d, eff } = onW3();
  d.send(checkResult(eff, failing(d)));
  assert.ok(!types(d.last).includes("work.changed"), "the first look");
  d.send(checkResult(eff, failing(d)));
  assert.deepEqual(d.last.events, [], "an identical look");
  d.send({ ...checkResult(eff, failing(d, "Other.")), lesson: "b-2" });
  assert.deepEqual(d.last.events, [], "another lesson's result");
  d.activity();
  assert.deepEqual(once(d), [{ type: "work.changed" }], "a file change");
  // The look that file change brings (the host's poke): the same change,
  // so no second glance; a later changed look with no file change is one.
  d.send(checkResult(eff, failing(d, "Edited.")));
  assert.deepEqual(
    once(d),
    [{ type: "check.notYet", evidence: "Edited." }],
    "the file change's own look",
  );
  d.send(checkResult(eff, failing(d, "Edited again.")));
  assert.deepEqual(
    types(d.last),
    ["check.notYet", "work.changed"],
    "a changed look with no file change",
  );
  // During a run: Pip thinks, and does not glance.
  d.run();
  const again = d.last.effects.find((e) => e.type === "check");
  d.send(runStart(again));
  d.activity();
  assert.deepEqual(d.last.events, [], "a file change during a run");
  d.send(checkResult(eff, failing(d, "Changed meanwhile.")));
  assert.deepEqual(d.last.events, [], "a changed look during a run");
  d.send(checkResult(again, checkItems(d.state, true)));
  assert.deepEqual(types(d.last), ["check.passed", "step.completed"]);
  // A watched beat no more: a file change is no change of it.
  d.activity();
  assert.deepEqual(d.last.events, []);
  // The passing look itself, with no run: the pass, not a change.
  const p = onW3().d;
  const e = pending(p, "check");
  p.send(checkResult(e, failing(p)));
  p.send(checkResult(e, checkItems(p.state, true)));
  assert.deepEqual(types(p.last), ["check.passed", "step.completed"]);
});

test("answers: right and wrong once each, none for a guess, a choice, stuck or a shown answer; the second wrong that shows the answer is one answer.wrong", () => {
  const at = (step, beat = 0) => {
    const d = driver({
      course,
      saved: save({ lessons: { "b-1": { step, beat, done: [] } } }),
    });
    d.open("b-1");
    return d;
  };
  // W5: wrong, right, wrong, other.
  const w5 = at("W5");
  w5.pick(0);
  assert.deepEqual(once(w5), [{ type: "answer.wrong" }]);
  w5.pick(2);
  assert.equal(w5.state.beat.revealed, true);
  assert.deepEqual(types(w5.last), ["answer.wrong", "step.completed"]);
  const right = at("W5");
  right.pick(1);
  assert.deepEqual(types(right.last), ["answer.right", "step.completed"]);
  const other = at("W5");
  other.pick(3);
  assert.deepEqual(types(other.last), ["step.completed"], "other is fine");
  const shown = at("W5");
  shown.reveal();
  assert.deepEqual(types(shown.last), ["step.completed"], "a shown answer");
  // W2: right, stuck, other. Stuck is no answer.
  const w2 = at("W2");
  w2.pick(1);
  assert.deepEqual(w2.last.events, []);
  // W4.0: a guess, any pick; the step goes on.
  for (const option of [0, 1]) {
    const w4 = at("W4");
    w4.pick(option);
    assert.deepEqual(w4.last.events, [], `guess ${option}`);
  }
});

test("warm-ups: a right first answer is warmup.recalled, a wrong one or a shown answer warmup.missed, once each", () => {
  const onR = (missed) => {
    const d = driver({
      course,
      saved: save({ missed, lessons: { "b-1": finished(lesson("b-1")) } }),
    });
    d.open("b-2");
    d.start();
    assert.equal(stepOf(d.state).part, "Warm-up");
    return d;
  };
  const recalled = onR(["start"]);
  recalled.pick(1);
  assert.deepEqual(types(recalled.last), ["warmup.recalled", "step.completed"]);
  const missed = onR(["start"]);
  missed.pick(0);
  assert.deepEqual(once(missed), [{ type: "warmup.missed" }]);
  const shown = onR(["start"]);
  shown.reveal();
  assert.deepEqual(types(shown.last), ["warmup.missed", "step.completed"]);
  // R2: right, wrong, wrong; the second wrong shows the answer.
  const twice = onR(["status"]);
  assert.equal(stepOf(twice.state).id, "R2");
  twice.pick(1);
  twice.pick(2);
  assert.deepEqual(types(twice.last), ["warmup.missed", "step.completed"]);
});

test("hints: hint.shown with its rung from 1, never for the question before the exact command, and once more when it is taken", () => {
  const { d, eff } = onW3();
  d.send(checkResult(eff, failing(d)));
  rRun(d, failing(d));
  if (!hintAvailable(d.state)) d.tick(IDLE_MS + 1_000);
  d.hint();
  assert.deepEqual(once(d), [{ type: "hint.shown", rung: 1 }]);
  let rung = 1;
  for (let i = 0; i < 8 && !d.state.beat.confirm; i++) {
    d.hint();
    if (d.state.beat.confirm) assert.deepEqual(d.last.events, []);
    else
      assert.deepEqual(d.last.events, [{ type: "hint.shown", rung: ++rung }]);
  }
  assert.ok(d.state.beat.confirm);
  d.exact(false);
  assert.deepEqual(d.last.events, [], "no is no rung");
  d.hint();
  d.exact(true);
  assert.deepEqual(d.last.events, [
    { type: "hint.shown", rung: d.state.beat.rung + 1 },
  ]);
});

test("step.markDone on the step's last beat completes it; on an earlier beat, skipping and going on do not", () => {
  const w1 = driver({
    course,
    saved: save({ lessons: { "b-1": { step: "W1", beat: 0, done: [] } } }),
  });
  w1.open("b-1");
  w1.markDone();
  assert.deepEqual(once(w1), [{ type: "step.completed" }]);
  // W4: a guess, then two self beats.
  const w4 = driver({
    course,
    saved: save({ lessons: { "b-1": { step: "W4", beat: 1, done: [] } } }),
  });
  w4.open("b-1");
  w4.markDone();
  assert.deepEqual(w4.last.events, [], "beat 1 of 3");
  w4.markDone();
  assert.deepEqual(types(w4.last), ["step.completed"]);
  // An optional step skipped: no moment.
  const optional = course.map((l) =>
    l.id === "b-1"
      ? {
          ...l,
          content: {
            ...l.content,
            steps: l.content.steps.map((x) =>
              x.id === "W2" ? { ...x, optional: "Skip it." } : x,
            ),
          },
        }
      : l,
  );
  const o = driver({
    course: optional,
    saved: save({ lessons: { "b-1": { step: "W2", beat: 0, done: ["W1"] } } }),
  });
  o.open("b-1");
  o.skip();
  assert.equal(stepOf(o.state).id, "W3");
  assert.deepEqual(o.last.events, []);
});

test("stepDown.reached names the tiers, once", () => {
  const d = driver({ course });
  playUntil(d, (s) => s.phase === "step-down");
  assert.deepEqual(d.last.events.at(-1), {
    type: "stepDown.reached",
    from: d.state.levelFrom,
    to: d.state.levelTo,
  });
  d.tick(1);
  assert.deepEqual(d.last.events, []);
});

test("lesson.completed: its Badge, capstone and firstTime; a replay keeps the Badge and says firstTime: false, a restart and replay too", () => {
  const d = driver({ course });
  playUntil(d, (s) => s.phase === "complete");
  assert.deepEqual(d.last.events.at(-1), {
    type: "lesson.completed",
    badge: "Explorer",
    capstone: false,
    firstTime: true,
  });
  d.tick(1);
  assert.deepEqual(d.last.events, []);
  // Played again from its overview: complete all along.
  d.open("b-1");
  assert.equal(d.state.progress["b-1"].complete, true);
  playUntil(d, (s) => s.phase === "complete");
  assert.deepEqual(d.last.events.at(-1), {
    type: "lesson.completed",
    badge: "Explorer",
    capstone: false,
    firstTime: false,
  });
  // Restarted: the Badge stays, and the replay is no first time.
  d.restart("b-1");
  assert.equal(d.state.progress["b-1"].complete, true);
  assert.deepEqual(d.last.events, []);
  playUntil(d, (s) => s.phase === "complete");
  assert.equal(d.last.events.at(-1).firstTime, false);
  assert.ok(!d.events.some((e) => e.type === "level.completed"));
});

test("level.completed when a Level's last Lesson completes, course.completed when the last Level does, each once; a replay and a restart fire neither again", () => {
  const level = driver({
    course,
    saved: save({ lessons: finishedBefore("b-capstone") }),
  });
  level.open("b-capstone");
  playUntil(level, (s) => s.phase === "complete");
  assert.deepEqual(level.last.events.slice(-2), [
    {
      type: "lesson.completed",
      badge: "Beginner",
      capstone: true,
      firstTime: true,
    },
    { type: "level.completed", level: "beginner" },
  ]);
  level.restart("b-capstone");
  playUntil(level, (s) => s.phase === "complete");
  assert.deepEqual(types(level.last).slice(-1), ["lesson.completed"]);
  assert.equal(
    level.events.filter((e) => e.type === "level.completed").length,
    1,
  );
  // The course's last Lesson, in its new copy.
  const all = driver({
    course,
    saved: save({
      lessons: finishedBefore("a-capstone"),
      folders: { "a-capstone": NEW_COPY },
    }),
  });
  all.open("a-capstone");
  playUntil(all, (s) => s.phase === "complete");
  assert.deepEqual(all.last.events.slice(-3), [
    {
      type: "lesson.completed",
      badge: "Advanced",
      capstone: true,
      firstTime: true,
    },
    { type: "level.completed", level: "advanced" },
    { type: "course.completed" },
  ]);
  all.restart("a-capstone");
  playUntil(all, (s) => s.phase === "complete");
  assert.ok(!types(all.last).includes("course.completed"));
  assert.equal(
    all.events.filter((e) => e.type === "course.completed").length,
    1,
  );
});

test("notice: one event with its kind, and no state changes", () => {
  const { d } = onW3();
  d.send({ type: "notice", kind: "save", message: "EACCES" });
  assert.equal(d.last.changed, false);
  assert.deepEqual(d.last.events, [{ type: "notice", kind: "save" }]);
});

test("each event carries its contract fields and no other; a Lesson with no Badge has no badge key", () => {
  const KEYS = {
    "check.started": [],
    "check.progress": ["m", "n"],
    "check.passed": ["firstTime"],
    "check.notYet": ["evidence"],
    "check.broken": [],
    "check.ended": [],
    "answer.right": [],
    "answer.wrong": [],
    "hint.shown": ["rung"],
    "warmup.recalled": [],
    "warmup.missed": [],
    "step.completed": [],
    "stepDown.reached": ["from", "to"],
    "lesson.completed": ["capstone", "firstTime"],
    "level.completed": ["level"],
    "course.completed": [],
    "work.changed": [],
    "help.offered": [],
    notice: ["kind"],
  };
  assert.deepEqual(Object.keys(KEYS), [...EVENT_TYPES]);
  // A course whose b-1 has no Badge.
  const plain = course.map((l) =>
    l.id === "b-1" ? { ...l, content: { ...l.content, badge: null } } : l,
  );
  const d = driver({ course: plain });
  playUntil(d, (s) => s.phase === "complete", {
    todo: new Set(["check", "pick", "type", "stepDown.back", "step.back"]),
  });
  const done = d.last.events.at(-1);
  assert.equal(done.type, "lesson.completed");
  assert.ok(!("badge" in done), "no badge key");
  const { d: w } = onW3();
  w.send({ type: "notice", kind: "save" });
  for (const e of [...d.events, ...w.events]) {
    const extra =
      e.type === "lesson.completed" && "badge" in e ? ["badge"] : [];
    assert.deepEqual(
      Object.keys(e)
        .filter((k) => k !== "type")
        .sort(),
      [...KEYS[e.type], ...extra].sort(),
      e.type,
    );
    for (const v of Object.values(e)) assert.notEqual(v, undefined, e.type);
  }
});
