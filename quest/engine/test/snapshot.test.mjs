// The snapshot (ticket 212): project(state) for each phase, the fields that
// render.mjs decided until ticket 210, and what it leaves out: saved
// stamps, earlier answers but the one on screen, raw check output beyond
// the verification lines, and any path but the practice copy and the Work
// folders.
import { test } from "vitest";
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import {
  FACTS,
  NEW_COPY,
  checkError,
  checkItems,
  checkResult,
  course,
  courseWith,
  driver,
  finished,
  finishedBefore,
  gitResult,
  pending,
  playUntil,
  probed,
  reduce,
  running,
  save,
  stepOf,
  struggles,
  withCode,
} from "./drive.mjs";
import { project, startedLesson } from "../src/index.mjs";

const lesson = (id) => course.find((l) => l.id === id);
// A driver on a saved place, the lesson opened.
function at(id, place, { lessons: extra = {}, ...options } = {}) {
  const d = driver({
    course,
    saved: save({
      lessons: {
        ...finishedBefore(id),
        [id]: { warm: [], ...place },
        ...extra,
      },
      ...(options.saved ?? {}),
    }),
    ...(options.facts ? { facts: options.facts } : {}),
    ...(options.course ? { course: options.course } : {}),
  });
  d.open(id);
  return d;
}
const view = (d) => project(d.state).lesson;
const mixOf = (stairs) =>
  ["guided", "hinted", "challenge"].map(
    (t) => stairs.filter((x) => x.tier === t).length,
  );

// ---- what it leaves out ---------------------------------------------------------
// Keys of the engine's state no snapshot holds at any depth: the stamps,
// the earlier answers, the raw check output, and the engine's counters.
const EXCLUDED = [
  "stamps",
  "opened",
  "now",
  "lastActivity",
  "answers",
  "missed",
  "eased",
  "missedNow",
  "answeredNow",
  "recalled",
  "warm",
  "whileShown",
  "error",
  "baseline",
  "passed",
  "paths",
  "gitError",
  "probes",
  "prereqs",
  "folderAsk",
  "accept",
  "asks",
  "prereqAsks",
  "asked",
  "explicit",
  "idle",
  "unlocked",
  "before",
  "look",
  "touched",
  "session",
  "folderAnswered",
  "firstCompletion",
];
const SENTINEL = `SENTINEL-${"x".repeat(4_000)}`;
const DECOYS = ["/home/sam/decoy-missing", "/home/sam/decoy-probe"];
const SAVED_ANSWER = "ANSWER-SENTINEL";
const SAVED_STAMP = "STAMP-SENTINEL";
const GIT_PATH = "GIT-SENTINEL.txt";

function* entries(value, path = "") {
  if (Array.isArray(value))
    for (const [i, v] of value.entries()) yield* entries(v, `${path}[${i}]`);
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) {
      yield [k, v, `${path}.${k}`];
      yield* entries(v, `${path}.${k}`);
    }
}

// Every exclusion, on the snapshot of `s`.
function assertExcluded(s) {
  const snap = project(s);
  const json = JSON.stringify(snap);
  for (const [k, v, path] of entries(snap)) {
    // The folder question's `asks` says what it asks: the engine's counter
    // of asks is a number.
    const named = k === "asks" && typeof v === "string";
    assert.ok(!EXCLUDED.includes(k) || named, `${path} is excluded`);
    assert.notEqual(v, undefined, `${path} is undefined`);
    if (typeof v !== "string") continue;
    // Any absolute path, POSIX or Windows, is the practice copy's or a Work
    // folder's. Two segments at least, so a slash command is not a path.
    for (const m of v.matchAll(
      /(?:^|[\s'"`(])((?:\/[^\s/'"`)]+){2,}|[A-Za-z]:\\[^\s'"`)]+)/g,
    )) {
      const ok = [s.facts.root, ...Object.values(s.folders)].some(
        (dir) => m[1] === dir || m[1].startsWith(`${dir}/`),
      );
      assert.ok(ok, `${path} names ${m[1]}`);
    }
  }
  assert.ok(!json.includes("SENTINEL-"), "raw check output");
  assert.ok(!json.includes(SAVED_ANSWER), "an earlier answer");
  assert.ok(!json.includes(SAVED_STAMP), "a saved stamp");
  // A path git status listed: only in the verification line that names it.
  const lineless = JSON.stringify(snap, (k, v) =>
    k === "fail" ? undefined : v,
  );
  assert.ok(!lineless.includes(GIT_PATH), "git status's listing");
  for (const decoy of DECOYS) assert.ok(!json.includes(decoy), decoy);
  // An option's kind only once answered, or on a wrong pick.
  const beat = snap.lesson.phase === "playing" ? snap.lesson.beat : null;
  if (beat && s.beat && !s.beat.answer)
    beat.options.forEach((o, i) =>
      assert.ok(
        !("kind" in o) || s.beat.wrongs.includes(i),
        `option ${i}'s kind before an answer`,
      ),
    );
  // `last` on a beat is whether it is its step's last, never the last FAIL.
  if (beat) assert.equal(typeof beat.last, "boolean");
  return snap;
}

// A whole play, walked: b-1 struggling at each kind of beat, with a saved
// answer on a beat not on screen, a check that could not run with a long
// message, saved stamps and a git status listing; i-1's folder question
// with a folder that is not there and a look at another; a-5's new copy.
function walk(look) {
  const d = driver({
    course,
    saved: save({
      lessons: { "b-1": { answers: { "W5.0": SAVED_ANSWER } } },
    }),
  });
  d.finishWelcome();
  d.start("less");
  playUntil(d, (s) => s.phase === "complete", { todo: struggles(), look });
  look(d.state);
  const w = driver({
    course,
    saved: save({
      lessons: {
        "b-1": { step: "W3", beat: 0, stamps: { "W1.0": SAVED_STAMP } },
      },
    }),
  });
  w.open("b-1");
  w.send(checkError(pending(w, "check"), SENTINEL));
  assert.equal(w.state.progress["b-1"].stamps["W1.0"], SAVED_STAMP);
  look(w.state);
  // b-1 Y4, a git-clean beat: its first look, then r's.
  const g = driver({
    course,
    saved: save({ lessons: { "b-1": { step: "Y4", beat: 0 } } }),
  });
  g.open("b-1");
  g.send(gitResult(pending(g, "git"), { paths: [GIT_PATH] }));
  look(g.state);
  g.run();
  g.send(gitResult(pending(g, "git"), { paths: [GIT_PATH, "b.txt"] }));
  assert.ok(g.state.git.paths.includes(GIT_PATH));
  look(g.state);
  const f = driver({ course, saved: save({ lessons: finishedBefore("i-1") }) });
  f.open("i-1");
  f.folderChoose("intermediate", { path: DECOYS[0] });
  f.send(probed(pending(f, "folder"), { path: DECOYS[0], missing: true }));
  look(f.state);
  f.send({
    type: "probed",
    path: DECOYS[1],
    missing: false,
    git: false,
    practice: false,
  });
  f.folderChoose("intermediate", "practice-copy");
  playUntil(f, (s) => s.phase === "complete", { look });
  const n = driver({
    course,
    saved: save({
      lessons: finishedBefore("a-5"),
      folders: { advanced: "/home/sam/advanced-work" },
    }),
  });
  n.open("a-5");
  playUntil(n, (s) => s.phase === "complete", { look });
}

test("no snapshot of a whole play holds an excluded key, a path but the copy's and the Work folders', raw check output, an earlier answer or an option's kind before an answer", () => {
  let n = 0;
  walk((s) => {
    assertExcluded(s);
    n += 1;
  });
  assert.ok(n > 100, `${n} snapshots`);
});

test("a snapshot does not change on a tick, and is the same for the same state", () => {
  const d = at("b-1", { step: "W3", beat: 0 });
  const before = project(d.state);
  d.tick(500);
  assert.notEqual(d.state.now, before.now);
  assert.deepEqual(project(d.state), before);
  assert.deepEqual(project(structuredClone(d.state)), before);
});

// ---- overview -------------------------------------------------------------------
test("overview: a fresh b-1's intro, its planned and less-help staircases, its start options and no folder question", () => {
  const d = driver({ course });
  d.finishWelcome();
  const v = view(d);
  assert.equal(v.phase, "overview");
  assert.deepEqual(v.intro.can, lesson("b-1").content.intro.can);
  assert.equal(v.intro.payoff, lesson("b-1").content.intro.payoff);
  assert.deepEqual(mixOf(v.staircase.planned), [7, 3, 2]);
  assert.deepEqual(mixOf(v.staircase.less), [0, 10, 2]);
  assert.deepEqual(v.start, { planned: true, less: true, first: null });
  assert.equal(v.folderQuestion, null);
  assert.deepEqual(v.notes, []);
  assert.equal(v.resumable, false);
  // The staircase is the help the play starts with.
  d.start();
  assert.deepEqual(
    view(d).steps.map(({ part, tier }) => ({ part, tier })),
    v.staircase.planned,
  );
  const s = project(d.state);
  assert.equal(s.learner.name, "Sam");
  assert.equal(s.learner.welcomed, true);
  assert.deepEqual(s.learner.workFolders, []);
  assert.deepEqual(
    s.course.levels.map((l) => l.id),
    ["beginner", "intermediate", "advanced"],
  );
  assert.equal(s.course.next, "b-1");
});

test("overview: i-1 asks for the Intermediate work folder, says what the host found, and starts nothing until it has an answer", () => {
  const d = driver({
    course,
    saved: save({ lessons: finishedBefore("i-1") }),
  });
  d.open("i-1");
  assert.deepEqual(view(d).folderQuestion, {
    key: "intermediate",
    asks: "work",
    current: null,
    problem: null,
    open: true,
    checking: false,
  });
  assert.equal(view(d).start, null);
  d.folderChoose("intermediate", { path: "/home/sam/gone" });
  assert.equal(view(d).folderQuestion.checking, true);
  d.send(probed(pending(d, "folder"), { missing: true }));
  assert.deepEqual(
    [view(d).folderQuestion.problem, view(d).folderQuestion.checking],
    ["missing", false],
  );
  d.folderChoose("intermediate", { path: "/home/sam/work" });
  d.send(probed(pending(d, "folder")));
  const q = view(d).folderQuestion;
  assert.deepEqual(
    [q.current, q.open, q.problem],
    ["/home/sam/work", false, null],
  );
  assert.notEqual(view(d).start, null);
  const s = project(d.state);
  assert.deepEqual(s.learner.workFolders, [
    { key: "intermediate", path: "/home/sam/work" },
  ]);
  const i1 = s.course.levels[1].lessons[0];
  assert.deepEqual(i1.folder, {
    kind: "work",
    level: "intermediate",
    set: true,
  });
  assert.deepEqual(
    s.course.levels[1].lessons.find((l) => l.id === "i-capstone").folder,
    { kind: "pinned" },
  );
  assert.deepEqual(
    s.course.levels[2].lessons.find((l) => l.id === "a-5").folder,
    { kind: "new-copy", lesson: "a-5", set: false },
  );
  assert.deepEqual(s.course.levels[0].lessons[0].folder, { kind: "copy" });
});

test("overview: the page's Windows note shows on native Windows only", () => {
  const note = lesson("i-1").content.intro["win-note"];
  assert.ok(note);
  for (const win32 of [false, true]) {
    const d = at(
      "i-1",
      {},
      {
        saved: { folders: { intermediate: FACTS.root } },
        facts: { win32 },
      },
    );
    const notes = view(d).notes.filter((n) => n.kind === "win-note");
    assert.deepEqual(notes, win32 ? [{ kind: "win-note", text: note }] : []);
    assert.equal(project(d.state).learner.windows, win32);
  }
});

test("overview: a lesson with no lesson file is never opened, and its overview, where the app opens on it, says nothing", () => {
  const b1Only = course.map((l) =>
    l.id === "b-1" ? l : { ...l, content: null },
  );
  const d = driver({
    course: b1Only,
    saved: save({ lessons: { "b-1": finished(lesson("b-1")) } }),
  });
  assert.deepEqual([d.state.lesson, d.state.phase], ["b-2", "overview"]);
  const v = view(d);
  assert.deepEqual(
    [v.intro, v.staircase, v.notes, v.folderQuestion, v.start],
    [null, { planned: [], less: null }, [], null, null],
  );
  assert.equal(project(d.state).course.next, null);
});

// ---- playing --------------------------------------------------------------------
test("playing: a resume with no beat open names its steps and the step it opens on, and nothing of a beat", () => {
  const d = driver({
    course,
    saved: save({
      lessons: { "b-1": { step: "W3", beat: 0, done: ["W1", "W2"] } },
    }),
  });
  assert.deepEqual([d.state.phase, d.state.beat], ["playing", null]);
  const v = view(d);
  assert.deepEqual([v.step, v.beat, v.waitQuestion], [null, null, null]);
  assert.deepEqual(
    v.steps.slice(0, 4).map((x) => x.state),
    ["done", "done", "current", "todo"],
  );
  assert.equal(v.hints.available, false);
});

test("playing: a do beat's lines with its commands for this platform and the practice copy's path, the watched tick, what it checks while it runs, and its verification lines", () => {
  const d = at("b-1", { step: "W3", beat: 0, done: ["W1", "W2"] });
  let b = view(d).beat;
  assert.equal(b.status, "checking");
  assert.equal(b.checking, ".practice/version.txt");
  assert.deepEqual(
    b.lines.filter((l) => l.kind === "run").map((l) => [l.text, l.watched]),
    [
      [`cd ${FACTS.root}`, false],
      ["mkdir -p .practice", true],
      ["claude --version > .practice/version.txt", false],
    ],
  );
  assert.ok(b.lines.some((l) => l.kind === "expect" && l.doneWhen));
  assert.equal(view(d).step.where.kind, "terminal");
  const eff = pending(d, "check");
  d.send(checkResult(eff, checkItems(d.state, false)));
  d.run();
  d.send(
    checkResult(pending(d, "check"), checkItems(d.state, false), {
      asked: d.state.beat.asked,
    }),
  );
  b = view(d).beat;
  assert.equal(b.status, "fail");
  assert.equal(b.fail, checkItems(d.state, false)[0].hint);
  assert.deepEqual(b.verification, [
    { text: lesson("b-1").items[0], pass: false },
  ]);
  d.send(checkResult(eff, checkItems(d.state, true)));
  b = view(d).beat;
  assert.equal(b.status, "done");
  assert.deepEqual(
    b.lines.filter((l) => l.kind === "run").map((l) => l.watched),
    [true, true, true],
    "a command ticks once the app saw the step pass",
  );
  // Done on opening (no FAIL first): the app never saw the commands run.
  const already = at(
    "b-1",
    { step: "W3", beat: 0, done: ["W1", "W2"] },
    {
      saved: {},
      facts: { practiceDir: false },
    },
  );
  already.send(
    checkResult(pending(already, "check"), checkItems(already.state, true)),
  );
  assert.equal(view(already).beat.status, "already");
  assert.deepEqual(
    view(already)
      .beat.lines.filter((l) => l.kind === "run")
      .map((l) => l.watched),
    [false, false, false],
  );
});

test("playing: a recall question shows the guess it recalls, the one earlier answer on screen", () => {
  const d = at("b-1", {
    step: "Y2",
    beat: 0,
    done: ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "Y1"],
    answers: { "W7.0": "Yes, the old one", "W5.0": SAVED_ANSWER },
  });
  const b = view(d).beat;
  assert.equal(b.answer.recall, "Yes, the old one");
  assert.ok(!JSON.stringify(project(d.state)).includes(SAVED_ANSWER));
});

test("playing: a typed answer beat shows no options, and its feedback after a wrong answer", () => {
  const d = at("b-1", { step: "C", beat: 1 });
  let b = view(d).beat;
  assert.equal(b.kind, "type");
  assert.deepEqual(b.options, []);
  assert.ok(b.ask);
  d.type("not it");
  b = view(d).beat;
  assert.equal(b.answer.feedback, "wrong");
  assert.ok(
    !JSON.stringify(b).includes(
      lesson("b-1").content.steps.at(-1).beats[1].accept[0],
    ),
  );
});

test("playing: a code beat's window keeps each line's number and the block whole for Copy; on Windows its win line stands in for it", () => {
  const block = ["one", "  two", "three", "four"];
  const text = withCode([
    "- code: lines 2-3 point 3",
    "```bash",
    ...block,
    "```",
    '- win: "Write-Output two three"',
  ]);
  for (const win32 of [false, true]) {
    const d = driver({
      course: courseWith({ "b-2": text }),
      saved: save({
        lessons: {
          "b-1": finished(lesson("b-1")),
          "b-2": { step: "W1", beat: 0, warm: [] },
        },
      }),
      facts: { win32 },
    });
    d.open("b-2");
    const b = view(d).beat;
    if (win32) {
      assert.equal(b.code, null);
      assert.deepEqual(
        b.lines.filter((l) => l.kind === "run").map((l) => l.text),
        ["Write-Output two three"],
      );
    } else
      assert.deepEqual(b.code, {
        lines: [
          { n: 2, text: "  two" },
          { n: 3, text: "three" },
        ],
        point: 3,
        copy: block.join("\n"),
      });
  }
});

test("playing: at Challenge before a first try, why the hints wait: run the check, or pick an answer", () => {
  // b-1 Y4: a git-clean beat at Challenge.
  const withHint = (id, step, beat) =>
    course.map((l) => {
      if (l.id !== id) return l;
      const content = structuredClone(l.content);
      const b = content.steps.find((x) => x.id === step).beats[beat];
      if (!b.hints.length) b.hints.push("Look again.");
      return { ...l, content };
    });
  const r = at(
    "b-1",
    { step: "Y4", beat: 0 },
    { course: withHint("b-1", "Y4", 0) },
  );
  assert.equal(view(r).step.tier, "challenge");
  assert.deepEqual(
    [view(r).hints.available, view(r).hints.unavailable],
    [false, "run-check"],
  );
  r.run();
  assert.equal(view(r).hints.unavailable, null, "r is a try");
  const p = at(
    "i-2",
    { step: "Y5", beat: 0 },
    { course: withHint("i-2", "Y5", 0) },
  );
  assert.equal(view(p).step.tier, "challenge");
  assert.deepEqual(
    [view(p).hints.available, view(p).hints.unavailable],
    [false, "pick-answer"],
  );
});

test("playing: the exact command behind the hints fills in the practice copy's path, and on Windows is its win line", () => {
  const d = at("b-1", { step: "W3", beat: 0, done: ["W1", "W2"] });
  const eff = pending(d, "check");
  d.send(checkResult(eff, checkItems(d.state, false)));
  d.run();
  d.send(
    checkResult(pending(d, "check"), checkItems(d.state, false), {
      asked: d.state.beat.asked,
    }),
  );
  for (let i = 0; i < 8 && !d.state.beat.confirm; i++) d.hint();
  d.exact(true);
  const shown = view(d).hints.shown;
  const exact = shown.at(-1);
  assert.equal(exact.kind, "exact");
  assert.ok(
    exact.commands.every((c) => !c.text.includes("<your practice copy>")),
    JSON.stringify(exact),
  );
});

// ---- render.mjs's rules -----------------------------------------------------------
test("the warm-up explainer: on the Level's first warm-up the Learner plays, not on a later one, and not on the step after it", () => {
  const b2 = driver({
    course,
    saved: save({
      missed: ["status"],
      lessons: { "b-1": finished(lesson("b-1")) },
    }),
  });
  b2.open("b-2");
  b2.start();
  assert.equal(stepOf(b2.state).id, "R2", "the missed skill's warm-up");
  assert.deepEqual(view(b2).step.warmup, { from: "b-1", explainer: true });
  b2.pick(0);
  b2.cont();
  assert.equal(view(b2).step.warmup, null, "the Worked example after it");
  // b-3 after b-2 played one: none.
  const later = (warmB2) =>
    driver({
      course,
      saved: save({
        missed: ["status"],
        lessons: {
          ...finishedBefore("b-3"),
          "b-2": { ...finished(lesson("b-2")), warm: warmB2 },
        },
      }),
    });
  const b3 = later(["R2"]);
  b3.open("b-3");
  b3.start();
  assert.equal(stepOf(b3.state).part, "Warm-up");
  assert.equal(view(b3).step.warmup.explainer, false);
  // b-2 played none: b-3's is the Level's first.
  const first = later([]);
  first.open("b-3");
  first.start();
  assert.equal(view(first).step.warmup.explainer, true);
  // Each Level has its own first: Beginner's warm-ups don't count for i-1.
  const i1 = driver({
    course,
    saved: save({
      missed: ["compact"],
      lessons: {
        ...finishedBefore("i-1"),
        "b-2": { ...finished(lesson("b-2")), warm: ["R2"] },
      },
      folders: { intermediate: FACTS.root },
    }),
  });
  i1.open("i-1");
  i1.start();
  assert.equal(stepOf(i1.state).part, "Warm-up");
  assert.equal(view(i1).step.warmup.explainer, true);
});

test("the Why line on the card: at Guided on do and ask beats, the beat's first reason; never at less help; all its reasons kept", () => {
  const d = at("b-1", { step: "W3", beat: 0, done: ["W1", "W2"] });
  const why = lesson("b-1").content.steps.find((x) => x.id === "W3").beats[0]
    .why;
  assert.deepEqual(view(d).beat.why, { onCard: why[0], all: why });
  // Less help lifts the step to Hinted: the reason waits behind the card.
  const less = at("b-1", {
    step: "W3",
    beat: 0,
    done: ["W1", "W2"],
    lessHelp: true,
  });
  assert.equal(view(less).step.tier, "hinted");
  assert.deepEqual(view(less).beat.why, { onCard: null, all: why });
  // A type beat never shows it on the card.
  const typed = at("b-2", { step: "C", beat: 1 });
  assert.equal(view(typed).beat.kind, "type");
  assert.equal(view(typed).beat.why.onCard, null);
  assert.ok(view(typed).beat.why.all.length > 0);
});

test("a beat's Windows note shows on native Windows only", () => {
  for (const win32 of [false, true]) {
    const d = at("b-1", { step: "C", beat: 0 }, { facts: { win32 } });
    const note = lesson("b-1").content.steps.at(-1).beats[0].winNote;
    assert.ok(note);
    assert.equal(view(d).beat.winNote, win32 ? note : null);
  }
});

test("an i-1 step in the Learner's own repository names that folder", () => {
  const MINE = "/home/sam/code/my-app";
  const d = driver({
    course,
    saved: save({
      lessons: finishedBefore("i-1"),
      folders: { intermediate: MINE },
    }),
  });
  d.open("i-1");
  playUntil(
    d,
    (s) =>
      Boolean(s.beat) &&
      stepOf(s).part === "Your turn" &&
      ["terminal", "shell", "claude"].includes(
        view({ state: s }).step?.where?.kind,
      ),
  );
  assert.equal(view(d).step.where.folder, MINE);
});

// ---- step-down and complete --------------------------------------------------------
test("step-down: from and to, the steps still to come, and no more help into the Check", () => {
  const d = driver({ course });
  playUntil(d, (s) => s.phase === "step-down");
  let v = view(d);
  assert.deepEqual([v.from, v.to], [d.state.levelFrom, d.state.levelTo]);
  assert.ok(v.toCome.reduce((n, x) => n + x.count, 0) > 0);
  assert.equal(v.moreHelp, true);
  d.accept();
  playUntil(d, (s) => s.phase === "step-down" && stepOf(s).part === "Check");
  v = view(d);
  assert.equal(v.moreHelp, false);
  assert.deepEqual(v.toCome, [{ tier: "challenge", count: 1 }]);
});

test("complete: b-1's Badge and first time, its check summary, the help used, and a next lesson in the same Level", () => {
  const d = driver({ course });
  playUntil(d, (s) => s.phase === "complete");
  let v = view(d);
  assert.deepEqual(
    [v.badge, v.firstTime, v.handover, v.invitation],
    ["Explorer", true, false, false],
  );
  assert.equal(v.next.id, "b-2");
  assert.ok(v.staircase.length > 0);
  assert.ok(v.practised.length > 0);
  assert.ok(v.practised.every((x) => x.mastery === null));
  // Played again: no first time.
  d.open("b-1");
  playUntil(d, (s) => s.phase === "complete");
  v = view(d);
  assert.equal(v.firstTime, false);
});

test("complete: a capstone's handover without the exact command, its invitation, and none after the exact command", () => {
  const d = driver({
    course,
    saved: save({ lessons: finishedBefore("b-capstone") }),
  });
  d.open("b-capstone");
  playUntil(d, (s) => s.phase === "complete");
  assert.deepEqual(
    [view(d).handover, view(d).invitation, view(d).capstone],
    [true, true, true],
  );
  const helped = driver({
    course,
    saved: save({
      lessons: {
        ...finishedBefore("b-capstone"),
        "b-capstone": { bottomAt: "T1" },
      },
    }),
  });
  helped.open("b-capstone");
  playUntil(helped, (s) => s.phase === "complete");
  // A new play from the overview clears it.
  assert.equal(view(helped).handover, true);
  const kept = driver({
    course,
    saved: save({
      lessons: {
        ...finishedBefore("b-capstone"),
        "b-capstone": { step: "C", beat: 0, bottomAt: "T1", warm: [] },
      },
    }),
  });
  kept.open("b-capstone");
  playUntil(kept, (s) => s.phase === "complete");
  assert.deepEqual([view(kept).handover, view(kept).invitation], [false, true]);
});

test('complete: "a notch harder" from i-3 to i-4, not from i-2 to i-3, nor into the next Level', () => {
  const notch = (id) => {
    const d = driver({
      course,
      saved: save({
        lessons: finishedBefore(id),
        folders: { intermediate: FACTS.root },
      }),
    });
    d.open(id);
    playUntil(d, (s) => s.phase === "complete");
    return view(d).next;
  };
  assert.deepEqual(notch("i-3"), {
    id: "i-4",
    title: lesson("i-4").title,
    notchHarder: true,
  });
  assert.equal(notch("i-2").notchHarder, false);
  const cap = driver({
    course,
    saved: save({ lessons: finishedBefore("b-capstone") }),
  });
  cap.open("b-capstone");
  playUntil(cap, (s) => s.phase === "complete");
  assert.equal(view(cap).next.notchHarder, false, "i-1 starts a Level");
});

test("the course's lessons: each one's state, Badge and folder need, and the Tear down still to do", () => {
  const d = driver({
    course,
    saved: save({
      lessons: {
        ...finishedBefore("a-5"),
        "a-capstone": { done: ["C"] },
      },
      folders: { "a-5": NEW_COPY },
    }),
  });
  const s = project(d.state);
  const all = s.course.levels.flatMap((l) => l.lessons);
  assert.equal(all.length, 23);
  assert.ok(s.course.levels[0].complete);
  assert.deepEqual(all.find((l) => l.id === "a-5").folder, {
    kind: "new-copy",
    lesson: "a-5",
    set: true,
  });
  const cap = all.find((l) => l.id === "a-capstone");
  assert.equal(cap.tearDownLeft, true);
  assert.equal(cap.capstone, true);
  assert.equal(all.find((l) => l.id === "b-1").badge, "Explorer");
  assert.equal(s.course.next, "a-5");
});

test("playing: an opening run's count, while the beat opens", () => {
  const d = at("b-1", { step: "W3", beat: 0, done: ["W1", "W2"] });
  const eff = pending(d, "check");
  d.send(running(eff, 1, 2));
  assert.deepEqual(view(d).beat.running, { n: 1, m: 2 });
  d.send(checkResult(eff, checkItems(d.state, false)));
  assert.equal(view(d).beat.running, null, "only while the beat opens");
});

// The steps before `step`, done, and `step` open at its first beat.
const upTo = (id, step) => {
  const steps = lesson(id).content.steps.map((x) => x.id);
  return { step, beat: 0, done: steps.slice(0, steps.indexOf(step)) };
};

test("playing: a step's tier, its commands only at Guided, its note where the help steps down, and the extra help an earlier bottom rung left", () => {
  const runs = (d) => view(d).beat.lines.filter((l) => l.kind === "run");
  const guided = at("b-1", upTo("b-1", "W1"));
  assert.equal(view(guided).step.tier, "guided");
  assert.equal(runs(guided).length, 1);
  const hinted = at("b-1", upTo("b-1", "Y1"));
  assert.equal(view(hinted).step.tier, "hinted");
  assert.deepEqual(runs(hinted), [], "the command waits in the hints");
  assert.equal(view(hinted).step.note, null);
  assert.equal(view(at("i-1", upTo("i-1", "Y3"))).step.note, "challenge");
  assert.equal(view(at("i-1", upTo("i-1", "Y4"))).step.note, null);
  const b5 = finished(lesson("b-5"));
  const eased = at("b-5", {
    ...b5,
    complete: false,
    done: b5.done.filter((id) => id !== "Y1"),
    step: "Y1",
    beat: 0,
    easedSteps: { Y1: true },
  });
  assert.equal(stepOf(eased.state).id, "Y1");
  assert.equal(view(eased).step.extraHelp, true);
  const plain = at("b-5", {
    ...b5,
    complete: false,
    done: b5.done.filter((id) => id !== "Y1"),
    step: "Y1",
    beat: 0,
  });
  assert.equal(view(plain).step.extraHelp, false);
});

// ---- startedLesson ------------------------------------------------------------------
test("startedLesson: a lesson starting play from its overview or from another lesson; not the next beat, a Step-down's accept or a resume of the same lesson", () => {
  const step = (d, fn) => {
    const prev = d.state;
    fn();
    return startedLesson(prev, d.state);
  };
  const d = driver({ course });
  d.finishWelcome();
  assert.equal(
    step(d, () => d.start()),
    "b-1",
  );
  assert.equal(
    step(d, () => d.markDone()),
    null,
  );
  playUntil(d, (s) => s.phase === "step-down");
  assert.equal(
    step(d, () => d.accept()),
    null,
  );
  // A resume of the same lesson.
  const r = driver({
    course,
    saved: save({ lessons: { "b-1": { step: "W3", beat: 0 } } }),
  });
  assert.equal(
    step(r, () => r.open("b-1")),
    null,
  );
  // Another lesson's saved place, from this one's play.
  const o = driver({
    course,
    saved: save({
      lessons: {
        "b-1": { step: "W3", beat: 0 },
        "b-2": { step: "W2", beat: 0, warm: [] },
      },
    }),
  });
  o.open("b-1");
  assert.equal(
    step(o, () => o.open("b-2")),
    "b-2",
  );
  // An overview starts nothing.
  assert.equal(
    step(o, () => o.restart("b-2")),
    null,
  );
  assert.equal(startedLesson(o.state, o.state), null);
  assert.ok(isDeepStrictEqual(reduce(o.state, { type: "tick" }).events, []));
});
