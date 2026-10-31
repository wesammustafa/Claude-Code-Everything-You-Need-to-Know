// Spec behaviors no old key-driven test pinned (ticket 208), proved through
// actions, with the spec's project/ clauses (the 208 map's G3, ticket 277).
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  asksFolder,
  beatOf,
  checkItems,
  checkResult,
  contentOf,
  course,
  courseWith,
  DEMO_B2,
  DEMO_I1,
  driver,
  FACTS,
  finished,
  finishedBefore,
  folderHere,
  folderOf,
  isDone,
  levelFolder,
  NEW_COPY,
  NEW_PROJECT,
  normalize,
  onReading,
  pending,
  playUntil,
  probed,
  probeResult,
  PROJECT,
  respond,
  running,
  save,
  stepOf,
  threeLevels,
  watching,
  where,
} from "./drive.mjs";

// spec: guards.4-watch-shape
test("a probe's answer counts only for the arguments the beat names", () => {
  const d = onReading("probe worktrees 2");
  const eff = pending(d, "probe");
  assert.deepEqual(eff, {
    type: "probe",
    name: "worktrees",
    args: ["2"],
    dir: PROJECT,
  });
  respond(d, eff, { state: "a" });
  assert.equal(
    d.state.beat.status,
    "waiting",
    "the first answer is a baseline",
  );
  for (const args of [["3"], [], ["2", "2"]]) {
    d.send(probeResult(eff, { args, pass: true, state: "b" }));
    assert.equal(d.last.changed, false, `args ${JSON.stringify(args)}`);
    assert.equal(d.state.beat.status, "waiting");
  }
  d.send(probeResult(eff, { pass: true, state: "b", evidence: "found" }));
  assert.equal(d.state.beat.status, "done");
});

// spec: guards.9-engine
test("only the current run's progress counts, and a poll's check runs no slow item", () => {
  const d = driver({
    saved: save({ lessons: { "b-1": { step: "W3", beat: 0 } } }),
  });
  d.open();
  const poll = pending(d, "check");
  assert.equal("slow" in poll, false, "a poll leaves the slow items out");
  assert.equal("asked" in poll, false);
  assert.deepEqual(watching(d.state), {
    check: { lesson: "b-1", items: [0] },
    dir: PROJECT,
  });
  d.send(running(poll, 1, 1));
  assert.deepEqual(d.state.beat.running, { n: 1, m: 1 });
  d.send(checkResult(poll, checkItems(d.state, false)));
  assert.equal(d.state.beat.running, null, "a result ends its run");
  d.run();
  const run = pending(d, "check");
  assert.equal(run.slow, true, "an asked-for run takes the slow items too");
  assert.equal(run.asked, d.state.beat.asked);
  d.send(running(poll, 1, 1));
  assert.equal(d.state.beat.running, null, "a poll's run is not the one asked");
  d.send(running(run, 1, 1, { items: [1] }));
  assert.equal(d.state.beat.running, null, "another beat's items");
  d.send(running(run, 1, 1, { lesson: "b-2" }));
  assert.equal(d.state.beat.running, null, "another lesson's check");
  d.send(running(run, 1, 1));
  assert.deepEqual(d.state.beat.running, { n: 1, m: 1 });
  d.send(checkResult(run, checkItems(d.state, false)));
  assert.deepEqual([d.state.beat.status, d.state.beat.running], ["fail", null]);
});

// spec: where.where
// spec: where.terminals
test("each beat says where its work happens, and a page's terminals keep their numbers", () => {
  const text = DEMO_B2.replace(
    "next: b-3\n",
    "next: b-3\nterminals: [shell, terminal]\n",
  );
  const b1 = course.find((l) => l.id === "b-1");
  const d = driver({
    course: courseWith({ "b-2": text }),
    saved: save({
      lessons: {
        "b-1": finished(b1),
        "b-2": {
          warm: ["R1", "R2", "R3"],
          done: ["R1", "R2", "R3"],
          step: "W1",
          beat: 0,
        },
      },
    }),
  });
  d.open("b-2");
  assert.equal(where(d.state).step, "W1");
  assert.equal(beatOf(d.state).where, "shell");
  assert.deepEqual(contentOf(d.state).terminals, { shell: 1, terminal: 2 });
  const plain = driver({
    saved: save({ lessons: { "b-1": { step: "W4", beat: 0 } } }),
  });
  plain.open();
  assert.equal(beatOf(plain.state).where, "terminal");
  assert.equal(contentOf(plain.state).terminals, null, "no terminals line");
});

// spec: where.codespaces
test("in a Codespace, a step Codespaces already did is done when it opens", () => {
  const place = save({ lessons: { "b-1": { step: "W1", beat: 0 } } });
  const d = driver({ saved: place, facts: { codespace: true } });
  d.open();
  assert.ok(beatOf(d.state).codespace);
  assert.deepEqual(
    [d.state.beat.status, d.state.beat.codespace],
    ["already", true],
  );
  const local = driver({ saved: place });
  local.open();
  assert.equal(isDone(local.state.beat), false);
  assert.equal(local.state.beat.codespace, undefined);
});

// spec: verify.beat.type
test("a typed-answer beat takes only typed text: pick and reveal do nothing", () => {
  const d = driver({
    saved: save({ lessons: { "b-1": { step: "C", beat: 1 } } }),
  });
  d.open();
  assert.equal(beatOf(d.state).kind, "type");
  assert.ok(
    beatOf(d.state).options.length > 0,
    "it lists a known wrong answer",
  );
  d.refused("answer.pick", { option: 0 });
  d.refused("answer.reveal");
  d.type("/usage");
  assert.deepEqual(
    [d.state.beat.typedWrong, d.state.beat.feedback.kind],
    [1, "wrong"],
  );
  d.type("/status");
  assert.equal(d.state.beat.status, "done");
  // A done beat takes no second answer: nothing counts as wrong, nothing saves.
  d.refused("answer.type", { text: "/usage" });
  assert.equal(d.state.beat.typedWrong, 1);
});

// spec: verify.value.git-clean
test("the session's end is a word only a git-clean beat with a done-label takes", () => {
  const d = onReading("git-clean");
  assert.deepEqual(
    [beatOf(d.state).verify.kind, beatOf(d.state).doneLabel ?? null],
    ["git-clean", null],
  );
  d.refused("session.ended");
  assert.ok(!d.state.beat.ended);
});

// spec: verify.value.self
test("a beat with its question still open is not marked done", () => {
  // A do beat the learner confirms, with a question to answer first.
  const d = onReading(
    'self\n- ask: Which file did it save?\n- right: "the list"\n- wrong: "the log"\n- because: "It saves the list."',
  );
  assert.ok(beatOf(d.state).ask, "the beat asks");
  assert.equal(beatOf(d.state).verify.kind, "self");
  d.refused("step.markDone");
  assert.equal(d.state.beat.status, "waiting");
  d.pick(beatOf(d.state).options.findIndex((o) => o.kind === "right"));
  assert.equal(d.state.beat.status, "done", "the answer decides it");
});

// spec: guards.7-baseline
test("a beat's first stamp holds: a later one for the same key changes nothing", () => {
  const d = onReading("match .practice/b-2-before.txt ^x fresh");
  const stamp = (value) => ({
    type: "stamp",
    key: "Y1.0",
    stamp: value,
    dir: PROJECT,
  });
  d.send(stamp("first"));
  assert.equal(d.state.progress["b-2"].stamps["Y1.0"], "first");
  d.send(stamp("second"));
  assert.deepEqual([d.last.changed, d.last.effects], [false, []]);
  assert.equal(d.state.progress["b-2"].stamps["Y1.0"], "first");
});

test("a typed answer reads escape as esc", () => {
  assert.equal(normalize(" Escape "), "esc");
  assert.equal(normalize("ESC"), "esc");
});

// spec: folders.asked-first-overview
test("an overview whose folder question has no answer yet starts nothing", () => {
  const d = driver({ course, saved: save({ lessons: finishedBefore("i-1") }) });
  assert.deepEqual(
    [d.state.lesson, d.state.phase, asksFolder(d.state)],
    ["i-1", "overview", true],
  );
  d.refused("lesson.start");
  d.folderChoose("intermediate", { path: NEW_COPY });
  d.refused("lesson.start", { help: "less" });
  respond(d, pending(d, "folder"));
  assert.equal(asksFolder(d.state), false);
  d.start();
  assert.deepEqual(
    [where(d.state).phase, where(d.state).step],
    ["playing", "W1"],
  );
});

// The spec's project/ clauses (Behavior the engine keeps, ticket 277): the
// Starter project lives in the copy's project/, and so does a new copy's.
const lastOf = (effects, type) => effects.filter((e) => e.type === type).at(-1);
// Plays on to the lesson's first check beat outside a Worked example and
// returns that check's folder.
const firstCheckDir = (d) => {
  playUntil(
    d,
    (s) =>
      Boolean(s.beat) &&
      beatOf(s).verify.kind === "check" &&
      stepOf(s).part !== "Worked example",
  );
  return lastOf(d.effects, "check")?.dir;
};
// A Learner on `id`'s overview with every earlier lesson finished.
const overview = (id, folders) => {
  const lessons = threeLevels({ "i-1": DEMO_I1 });
  const d = driver({
    course: lessons,
    saved: save({
      lessons: finishedBefore("i-1", lessons),
      ...(folders ? { folders } : {}),
    }),
  });
  if (id !== "i-1") d.open(id);
  assert.deepEqual([d.state.lesson, d.state.phase], [id, "overview"]);
  return d;
};
// A folder given for `key` and found by the host at `path`.
const give = (d, key, path) => {
  d.folderAsk(key);
  d.folderChoose(key, { path });
  d.send(probed(lastOf(d.effects, "folder"), { path }));
};

// spec: folders.default
test("Intermediate and Advanced default to the practice copy's project/ folder", () => {
  for (const choose of [false, true]) {
    const d = overview("i-1");
    if (choose) d.folderChoose("intermediate", "practice-copy");
    for (const level of ["intermediate", "advanced"])
      assert.equal(levelFolder(d.state, level), PROJECT, `${level} ${choose}`);
    if (choose) assert.equal(d.state.folders.intermediate, FACTS.root);
    assert.equal(folderOf(d.state), PROJECT);
    d.open("a-1");
    assert.equal(folderOf(d.state), PROJECT, `a-1 ${choose}`);
    d.open("i-1");
    if (!choose) d.folderChoose("intermediate", "practice-copy");
    assert.equal(firstCheckDir(d), PROJECT);
    assert.equal(folderHere(d.state), PROJECT);
    assert.equal(watching(d.state).dir, PROJECT);
  }
});

// spec: newcopy.by-lesson-id
test("a-5 and a-capstone run in the project/ folder of their new copy", () => {
  for (const id of ["a-5", "a-capstone"]) {
    const d = overview(id);
    assert.equal(lastOf(d.effects, "check"), undefined, id);
    assert.equal(folderOf(d.state), null, id);
    give(d, id, NEW_COPY);
    assert.equal(d.state.folders[id], NEW_COPY, id);
    assert.equal(folderOf(d.state), NEW_PROJECT, id);
    assert.equal(firstCheckDir(d), NEW_PROJECT, id);
    // Its project/ typed in full saves the copy itself.
    const typed = overview(id);
    give(typed, id, NEW_PROJECT);
    assert.equal(typed.state.folders[id], NEW_COPY, id);
    assert.equal(folderOf(typed.state), NEW_PROJECT, id);
  }
});

// spec: newcopy.copy-refused
test("the practice copy's project/ is refused as a new copy", () => {
  for (const path of [PROJECT, FACTS.root, `${PROJECT}/src`]) {
    const d = overview("a-5");
    give(d, "a-5", path);
    assert.equal(d.state.folderAsk?.isCopy, true, path);
    assert.equal(d.state.folders["a-5"], undefined, path);
    assert.equal(lastOf(d.effects, "check"), undefined, path);
  }
});

// spec: newcopy.i-capstone-pinned
test("i-capstone is pinned to the original copy's project/", () => {
  const d = overview("i-capstone", { intermediate: "/elsewhere" });
  assert.equal(folderHere(d.state), PROJECT);
  assert.equal(firstCheckDir(d), PROJECT);
});

// spec: folders.default
test("a Beginner Lesson's check and watcher run in the copy's project/", () => {
  const d = driver({
    saved: save({ lessons: { "b-1": { step: "W3", beat: 0 } } }),
  });
  d.open();
  assert.equal(pending(d, "check").dir, PROJECT);
  assert.deepEqual(watching(d.state), {
    check: { lesson: "b-1", items: [0] },
    dir: PROJECT,
  });
});
