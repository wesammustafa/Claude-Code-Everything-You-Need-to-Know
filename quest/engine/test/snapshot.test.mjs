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
  beatOf,
  folderKey,
  gitResult,
  pending,
  playUntil,
  probed,
  reduce,
  running,
  save,
  stepOf,
  stepsOf,
  struggles,
  withCode,
} from "./drive.mjs";
import { project, startedLesson } from "../src/index.ts";

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
const DECOYS = ["/home/ali/decoy-missing", "/home/ali/decoy-probe"];
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
      folders: { advanced: "/home/ali/advanced-work" },
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
  // The outline is every step to come, none done or current.
  assert.ok(v.steps.length > 0);
  assert.ok(v.steps.every((x) => x.state === "todo"));
  // The staircase is the help the play starts with, and the outline is
  // the play's, warm-ups included.
  d.start();
  assert.deepEqual(
    view(d).steps.map(({ part, tier }) => ({ part, tier })),
    v.staircase.planned,
  );
  assert.deepEqual(
    v.steps.map(({ part, tier }) => ({ part, tier })),
    v.staircase.planned,
  );
  const fields = ({ id, title, part, optional, tier }) => ({
    id,
    title,
    part,
    optional,
    tier,
  });
  assert.deepEqual(v.steps.map(fields), view(d).steps.map(fields));
  const s = project(d.state);
  assert.equal(s.learner.name, "Ali");
  assert.equal(s.learner.welcomed, true);
  assert.deepEqual(s.learner.workFolders, []);
  assert.deepEqual(
    s.course.levels.map((l) => l.id),
    ["beginner", "intermediate", "advanced"],
  );
  assert.equal(s.course.next, "b-1");
});

test("overview: a resumable Lesson's outline shows its ticked steps done, the rest to do, and none current", () => {
  const d = at("b-1", { step: "W3", beat: 0, done: ["W1", "W2"] });
  // The overview of a saved place, as the app shows it before a resume.
  const v = project({ ...d.state, phase: "overview", beat: null }).lesson;
  assert.equal(v.phase, "overview");
  assert.equal(v.resumable, true);
  assert.deepEqual(
    v.steps.filter((x) => x.state === "done").map((x) => x.id),
    ["W1", "W2"],
  );
  assert.ok(
    v.steps
      .filter((x) => !["W1", "W2"].includes(x.id))
      .every((x) => x.state === "todo"),
  );
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
  d.folderChoose("intermediate", { path: "/home/ali/gone" });
  assert.equal(view(d).folderQuestion.checking, true);
  d.send(probed(pending(d, "folder"), { missing: true }));
  assert.deepEqual(
    [view(d).folderQuestion.problem, view(d).folderQuestion.checking],
    ["missing", false],
  );
  d.folderChoose("intermediate", { path: "/home/ali/work" });
  d.send(probed(pending(d, "folder")));
  const q = view(d).folderQuestion;
  assert.deepEqual(
    [q.current, q.open, q.problem],
    ["/home/ali/work", false, null],
  );
  assert.notEqual(view(d).start, null);
  const s = project(d.state);
  assert.deepEqual(s.learner.workFolders, [
    { key: "intermediate", path: "/home/ali/work" },
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

test("overview: every Lesson's overview lists its Check items in order, slow items kept", () => {
  const check = (id) => {
    const d = driver({
      course,
      saved: save({ lessons: finishedBefore(id) }),
    });
    d.open(id);
    assert.deepEqual([d.state.phase, d.state.lesson], ["overview", id]);
    return view(d).check;
  };
  for (const { id } of course) assert.deepEqual(check(id), lesson(id).items);
  // Slow items stay where the Lesson lists them.
  assert.deepEqual(lesson("b-3").slow, [1]);
  assert.equal(check("b-3")[1], lesson("b-3").items[1]);
  assert.deepEqual(lesson("b-capstone").slow, [3, 4]);
  assert.deepEqual(
    check("b-capstone").slice(3, 5),
    lesson("b-capstone").items.slice(3, 5),
  );
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
    [
      v.intro,
      v.staircase,
      v.check,
      v.needs,
      v.notes,
      v.folderQuestion,
      v.start,
      v.steps,
    ],
    [null, { planned: [], less: null }, [], [], [], null, null, []],
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

// scenarios.spec keyboard b-1 (254): b-1's item 0 is slow, so a poll leaves
// it out (a placeholder marked slow). A poll that lands after r passed the
// beat must not take its line away.
test("a passed beat keeps the verification lines of the run that passed it: a later poll that leaves the slow item out removes none", () => {
  const d = at("b-1", { step: "W3", beat: 0, done: ["W1", "W2"] });
  const eff = pending(d, "check");
  const left = checkItems(d.state, false).map((it) => ({ ...it, slow: true }));
  d.send(checkResult(eff, left));
  assert.equal(view(d).beat.status, "waiting");
  d.run();
  d.send(
    checkResult(pending(d, "check"), checkItems(d.state, true), {
      asked: d.state.beat.asked,
    }),
  );
  const passed = [{ text: lesson("b-1").items[0], pass: true }];
  assert.equal(view(d).beat.status, "done");
  assert.deepEqual(view(d).beat.verification, passed);
  d.send(checkResult(eff, left));
  assert.equal(view(d).beat.status, "done");
  assert.deepEqual(view(d).beat.verification, passed);
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

test("playing: after a failed Check and a Check again that still fails, the hints advance one rung at a time to a check rung holding the failing item's message (rehoming row 422)", () => {
  const d = at("b-1", { step: "W3", beat: 0, done: ["W1", "W2"] });
  const eff = pending(d, "check");
  d.send(checkResult(eff, checkItems(d.state, false)));
  d.run();
  d.send(
    checkResult(pending(d, "check"), checkItems(d.state, false), {
      asked: d.state.beat.asked,
    }),
  );
  const message = checkItems(d.state, false)[0].hint;
  let count = view(d).hints.shown.length;
  for (let i = 0; i < 8 && view(d).hints.shown.at(-1)?.kind !== "check"; i++) {
    d.hint();
    const next = view(d).hints.shown.length;
    assert.equal(next, count + 1, "one rung at a time");
    count = next;
  }
  const last = view(d).hints.shown.at(-1);
  assert.equal(last?.kind, "check");
  assert.equal(last.text, message);
});

// ---- render.mjs's rules -----------------------------------------------------------
test("warm-ups on the plan count as steps: b-2 has 15 with one, 14 with none, 16 from an older save with two", () => {
  const steps = (missed, place) => {
    const d = driver({
      course,
      saved: save({
        missed,
        lessons: {
          "b-1": finished(lesson("b-1")),
          ...(place ? { "b-2": place } : {}),
        },
      }),
    });
    d.open("b-2");
    if (!place) d.start();
    return view(d).steps.map((x) => x.id);
  };
  const one = steps(["status"]);
  assert.equal(one.length, 15);
  assert.equal(one[0], "R2");
  assert.equal(steps([]).length, 14);
  const older = steps([], { step: "W1", beat: 0, warm: ["R1", "R2"] });
  assert.equal(older.length, 16);
  assert.deepEqual(older.slice(0, 2), ["R1", "R2"]);
});

test("a card entry waits for a step of its own lesson: the capstone's, though b-3 teaches its skill, and b-1's", () => {
  const cardWith = (lessons) =>
    project(driver({ course, saved: save({ lessons }) }).state).learner.card;
  assert.deepEqual(cardWith({}), []);
  const before = cardWith(finishedBefore("b-capstone"));
  assert.ok(
    before.some((e) => e.lesson === "b-3" && e.skill === "review-diff"),
  );
  assert.ok(before.some((e) => e.lesson === "b-1"));
  assert.ok(before.every((e) => e.lesson !== "b-capstone"));
  const after = cardWith({
    ...finishedBefore("b-capstone"),
    "b-capstone": finished(lesson("b-capstone")),
  });
  assert.ok(after.some((e) => e.lesson === "b-capstone"));
});

test("a saved new copy for a-5 or the Advanced capstone leaves each lesson's done state alone", () => {
  const lessonsOf = (d) =>
    project(d.state).course.levels.flatMap((l) => l.lessons);
  for (const id of ["a-5", "a-capstone"]) {
    const without = driver({
      course,
      saved: save({ lessons: finishedBefore(id) }),
    });
    const key = folderKey(without.state, id);
    const d = driver({
      course,
      saved: save({
        lessons: finishedBefore(id),
        folders: { [key]: NEW_COPY },
      }),
    });
    assert.ok(
      project(d.state).learner.workFolders.some((f) => f.path === NEW_COPY),
      `${id}: the new copy is saved`,
    );
    assert.equal(lessonsOf(d).find((x) => x.id === id).complete, false, id);
    assert.deepEqual(
      lessonsOf(d).map((x) => x.complete),
      lessonsOf(without).map((x) => x.complete),
      id,
    );
  }
});

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

test("playing: i-1's Y2 card closes its do list with a line that another edit follows the question", () => {
  const d = at("i-1", { step: "Y2", beat: 0 });
  const lines = view(d).beat.lines;
  assert.deepEqual(
    lines.map((l) => l.kind),
    ["goal", "do", "do", "say"],
  );
  assert.equal(lines.at(-1).text, "One more edit follows the question.");
  assert.ok(lines.at(-2).text.endsWith("keeping the Red step's style;"));
});

test("a beat's Windows note shows on native Windows only", () => {
  for (const win32 of [false, true]) {
    const d = at("b-1", { step: "C", beat: 0 }, { facts: { win32 } });
    const note = lesson("b-1").content.steps.at(-1).beats[0].winNote;
    assert.ok(note);
    assert.equal(view(d).beat.winNote, win32 ? note : null);
  }
});

test("the cd line quotes the practice copy's folder: plain, POSIX single quotes, Windows double quotes", () => {
  const cd = (facts) => {
    const d = at("b-1", { step: "W3", beat: 1, done: ["W1", "W2"] }, { facts });
    return view(d)
      .beat.lines.map((l) => l.text)
      .find((t) => t.startsWith("cd "));
  };
  assert.equal(cd({ root: "/home/ali/practice" }), "cd /home/ali/practice");
  assert.equal(
    cd({ root: "/home/ali/Ali's practice" }),
    "cd '/home/ali/Ali'\\''s practice'",
  );
  assert.equal(
    cd({ root: "C:\\Users\\Ali\\my practice", win32: true }),
    'cd "C:\\Users\\Ali\\my practice"',
  );
});

test("a run line's <your repo> shows the Work folder, shell-quoted when it has a space", () => {
  const MINE = "/home/ali/code/my app";
  const d = at(
    "i-1",
    { step: "C", beat: 0 },
    { saved: { folders: { intermediate: MINE } } },
  );
  const texts = view(d).beat.lines.map((l) => l.text);
  assert.ok(
    texts.includes("npm run check -- i-1 --dir '/home/ali/code/my app'"),
    texts.join("\n"),
  );
  assert.ok(texts.every((t) => !t.includes("<your repo>")));
});

test("an i-1 step in the Learner's own repository names that folder", () => {
  const MINE = "/home/ali/code/my-app";
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

test("a waiting beat names the Work folder it watches before the first look; the Practice copy names none", () => {
  const MINE = "/home/ali/code/my-app";
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
      stepOf(s).part !== "Worked example" &&
      beatOf(s).verify.kind === "check",
  );
  assert.equal(view(d).beat.ranIn, null, "no first look yet");
  assert.equal(view(d).beat.watches, MINE);
  const b = driver();
  playUntil(b, (s) => Boolean(s.beat) && beatOf(s).verify.kind === "check");
  assert.equal(view(b).beat.watches, null);
});

// ---- step-down and complete --------------------------------------------------------
test("step-down: from and to, the steps still to come, and no more help into the Check, and the step it opens on", () => {
  const d = driver({ course });
  playUntil(d, (s) => s.phase === "step-down");
  let v = view(d);
  assert.deepEqual([v.from, v.to], [d.state.levelFrom, d.state.levelTo]);
  assert.deepEqual(v.step, {
    id: stepOf(d.state).id,
    title: stepOf(d.state).title,
    index: d.state.pos.step,
    of: stepsOf(d.state).length,
  });
  assert.deepEqual([v.step.id, v.step.index], ["Y1", 7]);
  const opensOn = v.step.id;
  const of = v.step.of;
  // A Step-down on the first step still names it.
  const first = project({
    ...d.state,
    pos: { ...d.state.pos, step: 0 },
  }).lesson;
  assert.deepEqual(
    [first.step.id, first.step.index, first.step.of],
    [stepsOf(d.state)[0].id, 0, of],
  );
  assert.ok(v.toCome.reduce((n, x) => n + x.count, 0) > 0);
  assert.equal(v.moreHelp, true);
  // The outline: steps passed are done, the one it opens on current, the
  // rest to do; the next play frame lists the same.
  const outlinePinned = (v) => {
    assert.equal(v.steps.length, v.step.of);
    assert.equal(v.steps[v.step.index].id, v.step.id);
    assert.deepEqual(
      v.steps.map((x) => x.state),
      v.steps.map((_, i) =>
        i < v.step.index ? "done" : i === v.step.index ? "current" : "todo",
      ),
    );
    return v.steps.map(({ id, state }) => ({ id, state }));
  };
  let outline = outlinePinned(v);
  d.accept();
  assert.equal(stepOf(d.state).id, opensOn);
  // `of` counts every step the playing outline lists.
  assert.equal(view(d).steps.length, of);
  assert.deepEqual(
    view(d).steps.map(({ id, state }) => ({ id, state })),
    outline,
  );
  playUntil(d, (s) => s.phase === "step-down" && stepOf(s).part === "Check");
  v = view(d);
  assert.deepEqual([v.step.id, v.step.title], ["C", "Check"]);
  assert.equal(v.step.index, v.step.of - 1);
  assert.equal(v.moreHelp, false);
  assert.deepEqual(v.toCome, [{ tier: "challenge", count: 1 }]);
  outline = outlinePinned(v);
  assert.equal(outline.at(-1).state, "current");
  d.accept();
  assert.deepEqual(
    view(d).steps.map(({ id, state }) => ({ id, state })),
    outline,
  );
});

test("step-down: its step count includes the warm-ups, as the outline does", () => {
  const d = driver({
    course,
    saved: save({
      missed: ["start"],
      lessons: { "b-1": finished(course.find((l) => l.id === "b-1")) },
    }),
  });
  d.open("b-2");
  d.start();
  assert.equal(stepOf(d.state).part, "Warm-up");
  const outline = view(d).steps.length;
  const v = project({
    ...d.state,
    phase: "step-down",
    levelFrom: "guided",
    levelTo: "hinted",
  }).lesson;
  assert.deepEqual([v.step.index, v.step.of], [0, outline]);
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
  // Each skill practised has the help its latest step used (ticket 213).
  assert.ok(
    v.practised.every((x) =>
      ["own", "hints", "commands"].includes(x.mastery?.used),
    ),
  );
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
