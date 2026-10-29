// learn-flow's first range (ticket 208), driven by actions: a check beat's
// life and its results, questions, guesses and typed answers, a Codespace,
// the review fixes, the grammar, and the hint gates at CHALLENGE.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  b1Item,
  b1Only,
  beatOf,
  checkOnly,
  course,
  courseWith,
  DEMO_B2,
  DEMO_I1,
  DEMO_I1_INDEX,
  driver,
  FACTS,
  finished,
  finishedBefore,
  GIT,
  hintAvailable,
  normalize,
  parseLesson,
  pending,
  READS,
  rungsOf,
  save,
  stepNote,
  stepOf,
  tierOf,
  tiersOf,
  tryFirst,
  watching,
  where,
} from "./drive.mjs";

// A saved place in lesson 1, opened.
const at = (step, extra = {}) => {
  const d = driver({
    saved: save({ lessons: { "b-1": { step, beat: 0, ...extra } } }),
    ...extra.driver,
  });
  d.open();
  return d;
};
// Lesson 1 finished on the path, every step of it done.
const b1Done = finished(course.find((l) => l.id === "b-1"));
const missing = b1Item(null);
const empty = b1Item("");
const passed = b1Item("2.1.285 (Claude Code)\n");
// At CHALLENGE, hints wait for a first try: h names it and does nothing.
const hintsLater = (d, kind) => {
  assert.equal(hintAvailable(d.state), false);
  assert.equal(tryFirst(d.state), kind);
  d.refused("hint.next");
};

// was learn-flow:30
// spec: verify.value.check-items
// spec: guards.1-ask-numbers
// spec: verify.beat.do
// spec: guards.7-baseline
test('a check step waits, says "not yet" only when something changed, and turns done on a pass', () => {
  const d = at("W3");
  assert.equal(d.state.beat.status, "opening");
  assert.deepEqual(
    d.last.effects.map((e) => e.type),
    ["check", "save"],
    "the opening check goes out before the save",
  );
  assert.deepEqual(d.last.effects[0], {
    type: "check",
    lesson: "b-1",
    items: [0],
    evidence: ".practice/version.txt",
    dir: FACTS.root,
  });
  d.send({ type: "check", lesson: "b-1", items: [missing] });
  assert.equal(d.state.beat.status, "waiting");
  d.refused("step.continue");
  assert.equal(
    stepOf(d.state).id,
    "W3",
    "enter does nothing until the step is done",
  );
  d.send({ type: "check", lesson: "b-1", items: [missing] });
  assert.equal(
    d.state.beat.status,
    "waiting",
    'the same FAIL as on opening is not "not yet"',
  );
  d.run();
  assert.equal(d.state.beat.status, "opening", "r shows its run");
  d.send({
    type: "check",
    lesson: "b-1",
    items: [missing],
    asked: d.state.beat.asked,
  });
  assert.equal(d.state.beat.status, "fail", "r asks, so the answer is shown");
  d.send({ type: "check", lesson: "b-1", items: [empty] });
  assert.equal(d.state.beat.fail.hint, empty.hint);
  d.send({
    type: "check",
    lesson: "b-1",
    items: [passed],
    read: Buffer.from("2.1.285 (Claude Code)\n"),
  });
  assert.equal(d.state.beat.status, "done");
  assert.equal(d.state.beat.evidence, "2.1.285 (Claude Code)");
  assert.equal(watching(d.state), null, "a done step watches nothing");
  d.cont();
  assert.equal(stepOf(d.state).id, "W4");
});

// was learn-flow:54
test("a check that already passes when the step opens counts at once", () => {
  const d = at("Y1", { levels: ["hinted"] });
  d.send({ type: "check", lesson: "b-1", items: [passed] });
  assert.equal(d.state.beat.status, "already");
  const broken = at("W3");
  broken.send({
    type: "check-error",
    lesson: "b-1",
    message: "it took too long",
  });
  assert.equal(broken.state.beat.status, "broken");
});

// was learn-flow:63
// spec: verify.beat.ask
// spec: verify.beat.predict
// spec: verify.value.answer
test("questions: a wrong pick explains, a second reveals; s reveals; a guess is never wrong", () => {
  const d = at("W5");
  d.pick(0);
  assert.equal(d.state.beat.status, "waiting");
  assert.equal(d.state.beat.feedback.kind, "wrong");
  assert.match(d.state.beat.feedback.because, /header above the prompt/);
  assert.match(d.state.beat.feedback.point, /Login method/);
  d.pick(2);
  assert.equal(d.state.beat.status, "done");
  assert.equal(d.state.beat.revealed, true);
  const s = at("W5");
  s.reveal();
  assert.equal(s.state.beat.revealed, true);
  const other = at("W5");
  other.pick(3);
  assert.equal(
    other.state.beat.status,
    "done",
    '"I saw something different" is never called wrong',
  );
  const stuck = at("W2");
  stuck.pick(1);
  assert.equal(
    stuck.state.beat.status,
    "waiting",
    "the PATH fix keeps the step open",
  );
  assert.equal(stuck.state.beat.feedback.kind, "stuck");
  const guess = at("W4");
  guess.pick(1);
  assert.equal(guess.state.beat.status, "done");
  assert.equal(
    guess.state.progress["b-1"].answers["W4.0"],
    "**Yes, I trust this folder**",
  );
});

// was learn-flow:89
test("a guess revealed later is recalled at its step", () => {
  const d = at("W7");
  d.pick(0);
  assert.equal(d.state.beat.status, "done");
  const y2 = at("Y2", {
    answers: { "W7.0": "Yes, it will ask again" },
    levels: ["hinted"],
  });
  assert.equal(stepOf(y2.state).id, "Y2");
  assert.equal(
    y2.state.progress["b-1"].answers["W7.0"],
    "Yes, it will ask again",
  );
});

// was learn-flow:98
// spec: verify.beat.type
test("typed answers ignore case, spaces and a leading slash; empty enter shows the answer", () => {
  assert.equal(normalize("  /Status "), "status");
  const d = at("C", { levels: ["hinted", "challenge"] });
  d.send({ type: "check", lesson: "b-1", items: [passed] });
  d.cont();
  d.type("STATUS");
  assert.equal(d.state.beat.status, "done");
  assert.equal(d.state.beat.feedback.kind, "right");
  const w = at("C", { levels: ["hinted", "challenge"] });
  w.send({ type: "check", lesson: "b-1", items: [passed] });
  w.cont();
  w.type("/usage");
  assert.match(w.state.beat.feedback.because, /session cost/);
  w.type("");
  assert.equal(w.state.beat.revealed, true);
  // dropped: T-input q typed into the answer line, not quit
});

// was learn-flow:125
// spec: tiers.eases
test("hints: one rung per press, a 2 second lock, y/n before the exact command, and the skill eases", () => {
  const d = at("W3");
  d.send({ type: "check", lesson: "b-1", items: [missing] });
  d.send({ type: "check", lesson: "b-1", items: [empty] });
  assert.ok(hintAvailable(d.state));
  const rungs = rungsOf(d.state);
  assert.equal(rungs[0].kind, "ask");
  assert.match(
    rungs[0].text,
    /on its own\?$/,
    "the empty-file FAIL gets its own first question",
  );
  assert.equal(rungs.at(-1).kind, "bottom");
  d.hint();
  assert.equal(d.state.beat.rung, 0);
  // dropped: T-time h ignored for 2 seconds after a rung
  d.hint();
  assert.equal(d.state.beat.rung, 1);
  while (!d.state.beat.confirm) d.hint();
  assert.equal(d.state.beat.rung, rungs.length - 2);
  d.exact(false);
  assert.equal(d.state.beat.confirm, false);
  d.hint();
  d.exact(true);
  assert.equal(d.state.beat.rung, rungs.length - 1);
  assert.deepEqual(d.state.eased, ["save-version"]);
  // Y1 asks for the same skill: it comes back GUIDED, once.
  d.send({ type: "check", lesson: "b-1", items: [passed] });
  // W4 to W7: the guess, two self beats, W5's answer, W6's done-label and
  // question, W7's guess and its self beat.
  d.cont();
  d.pick(0);
  d.cont();
  d.markDone();
  d.markDone();
  d.pick(1);
  d.cont();
  d.markDone();
  d.pick(0);
  d.cont();
  d.pick(1);
  d.cont();
  d.markDone();
  d.send({ type: "git", paths: [] });
  d.cont();
  assert.equal(stepOf(d.state).id, "Y1");
  assert.equal(tierOf(d.state), "guided");
  assert.deepEqual(d.state.eased, []);
});

// was learn-flow:159
// spec: tiers.challenge-try
// spec: tiers.idle
test('hint gates: CHALLENGE opens hints only after a "not yet" or two quiet minutes', () => {
  const d = at("Y4", { levels: ["hinted", "challenge"] });
  assert.equal(tierOf(d.state), "challenge");
  d.send({ type: "git", paths: [] });
  assert.equal(hintAvailable(d.state), false);
  d.tick(121_000);
  assert.equal(d.state.beat.idle, true);
  assert.equal(hintAvailable(d.state), true);
  const f = at("Y4", { levels: ["hinted", "challenge"] });
  f.ended();
  f.send({ type: "git", paths: ["notes.md"] });
  assert.equal(f.state.beat.status, "fail");
  assert.equal(hintAvailable(f.state), true);
  f.send({ type: "git", paths: [] });
  assert.equal(f.state.beat.status, "done");
});

// was learn-flow:176
// spec: verify.value.git-clean
test("a git step with a done-label decides only after the learner says the session ended", () => {
  const d = at("Y4", { levels: ["hinted", "challenge"] });
  d.send({ type: "git", paths: [] });
  assert.equal(d.state.beat.status, "waiting");
  d.ended();
  // git runs in the lesson's folder, as every other look does.
  assert.deepEqual(d.effects.at(-1), { type: "git", dir: FACTS.root });
  d.send({ type: "git", paths: [] });
  assert.equal(d.state.beat.status, "done");
  const w7 = at("W7", { beat: 2 });
  assert.equal(stepOf(w7.state).id, "W7");
  w7.send({ type: "git", paths: [] });
  assert.equal(
    w7.state.beat.status,
    "done",
    "without a done-label the clean tree is enough",
  );
});

// was learn-flow:191
// spec: tiers.less-help
// spec: tiers.more-help
test('difficulty: the level-up shows once per tier, "less help" hides the commands, g gives more help', () => {
  const d = at("W7", { beat: 2, done: ["W1", "W2", "W3", "W4", "W5", "W6"] });
  d.send({ type: "git", paths: [] });
  d.cont();
  assert.equal(d.state.phase, "step-down");
  assert.equal(d.state.levelTo, "hinted");
  d.accept();
  assert.equal(d.state.phase, "playing");
  assert.ok(d.state.progress["b-1"].levels.includes("hinted"));
  d.back();
  d.cont();
  d.send({ type: "git", paths: [] });
  d.cont();
  assert.deepEqual(
    [d.state.phase, stepOf(d.state).id],
    ["playing", "Y1"],
    "not twice",
  );

  const less = driver({ saved: save() });
  less.start("less");
  assert.equal(less.state.progress["b-1"].lessHelp, true);
  assert.deepEqual(tiersOf(less.state).slice(0, 7), Array(7).fill("hinted"));
  less.markDone();
  less.pick(0);
  less.cont();
  assert.equal(stepOf(less.state).id, "W3");
  assert.deepEqual(
    rungsOf(less.state)
      .at(-1)
      .lines.map((l) => l.text),
    [
      "cd <your practice copy>",
      "mkdir -p .practice",
      "claude --version > .practice/version.txt",
    ],
  );
  // The safety guess stays.
  less.send({ type: "check", lesson: "b-1", items: [passed] });
  less.cont();
  assert.equal(stepOf(less.state).beats[less.state.pos.beat].kind, "predict");

  const g = at("W7", { beat: 2 });
  g.send({ type: "git", paths: [] });
  g.cont();
  g.moreHelp();
  assert.equal(g.state.progress["b-1"].moreHelpAt, "Y1");
  assert.equal(tierOf(g.state), "guided");
});

// was learn-flow:229
// spec: where.codespaces
test("a Codespace is credited for the install steps", () => {
  const d = driver({ saved: save(), facts: { codespace: true } });
  d.start();
  assert.equal(d.state.beat.status, "already");
  d.cont();
  assert.equal(d.state.beat.status, "already");
});

// was learn-flow:237
test("resume: the saved step opens; unknown steps and lessons are ignored", () => {
  const d = driver({
    saved: save({
      lessons: { "b-1": { step: "Y3", beat: 0, done: ["W1", "ZZ"] } },
    }),
  });
  assert.deepEqual(
    [d.state.phase, d.state.beat],
    ["playing", null],
    "a resume",
  );
  assert.deepEqual(d.state.progress["b-1"].done, ["W1"]);
  d.open();
  assert.equal(stepOf(d.state).id, "Y3");
  const gone = driver({ saved: save({ lessons: { "b-1": { step: "W9" } } }) });
  assert.equal(gone.state.phase, "overview");
  const start = driver();
  assert.equal(start.state.welcomed, false);
});

// was learn-flow:263
test("map and check-only mode: a lesson without a content file watches its check", () => {
  const d = driver({ course: b1Only, saved: save() });
  // dropped: T-view the map opened with m, its cursor moved down
  d.open("b-2");
  assert.ok(checkOnly(d.state));
  assert.equal(d.state.lesson, "b-2");
  assert.deepEqual(watching(d.state), {
    check: { lesson: "b-2", items: null },
    dir: FACTS.root,
  });
  d.run();
  assert.deepEqual(d.effects.at(-1), {
    type: "check",
    lesson: "b-2",
    items: null,
    slow: true,
    dir: FACTS.root,
  });
});

// was learn-flow:276
test("review fixes: CHALLENGE hints open after the idle offer", () => {
  const d = at("Y4", { levels: ["hinted", "challenge"] });
  d.send({ type: "git", paths: [] });
  d.tick(121_000);
  d.hint();
  assert.equal(
    d.state.beat.rung,
    0,
    'h after the "Stuck?" offer opens the first hint',
  );
});

// was learn-flow:284
test("review fixes: an error while a hint is open closes it", () => {
  const d = at("W3");
  d.send({ type: "check", lesson: "b-1", items: [missing] });
  d.send({ type: "check", lesson: "b-1", items: [empty] });
  d.hint();
  d.send({ type: "check-error", lesson: "b-1", message: "it took too long" });
  assert.equal(d.state.beat.status, "broken");
  assert.equal(d.state.beat.rung, -1);
  d.send({ type: "check", lesson: "b-1", items: [empty] });
  assert.equal(d.state.beat.status, "fail", 'a good result clears "broken"');
});

// was learn-flow:296
test("review fixes: a saved place past the end of a step opens its first beat", () => {
  const d = driver({
    saved: save({ lessons: { "b-1": { step: "W5", beat: 3 } } }),
  });
  assert.equal(d.state.progress["b-1"].beat, 0);
  d.open();
  assert.equal(stepOf(d.state).id, "W5");
  assert.equal(d.state.pos.beat, 0);
});

// was learn-flow:304
test("review fixes: a finished lesson stays finished", () => {
  const done = save({
    lessons: { "b-1": { complete: true, done: ["W1", "W2"] } },
  });
  const d = driver({ course: b1Only, saved: done });
  // dropped: T-view the app opens on the map; the engine is at the next
  // lesson's check-only overview
  assert.equal(d.state.lesson, "b-2");
  assert.ok(checkOnly(d.state));
  // Playing it again from the map keeps the badge and the ticks.
  d.open("b-1");
  assert.equal(d.state.phase, "overview");
  d.start();
  assert.equal(d.state.progress["b-1"].complete, true);
  assert.deepEqual(d.state.progress["b-1"].done, ["W1", "W2"]);
});

// was learn-flow:342
test("review fixes: starting over asks first", () => {
  const d = driver({
    saved: save({ lessons: { "b-1": { step: "Y3", done: ["W1"] } } }),
  });
  d.refused("check.run");
  assert.deepEqual(
    [d.state.phase, d.state.beat],
    ["playing", null],
    "r no longer starts over",
  );
  // dropped: T-view the restart prompt, x then n keeps the place
  assert.deepEqual(d.state.progress["b-1"].done, ["W1"]);
  d.restart();
  assert.deepEqual(d.state.progress["b-1"].done, []);
  assert.equal(d.state.phase, "overview");
});

// was learn-flow:356
test("review fixes: the y/n prompt closes when the step passes", () => {
  const d = at("W3");
  d.send({ type: "check", lesson: "b-1", items: [missing] });
  d.send({ type: "check", lesson: "b-1", items: [empty] });
  while (!d.state.beat.confirm) d.hint();
  d.send({ type: "check", lesson: "b-1", items: [passed] });
  assert.equal(d.state.beat.confirm, false);
  d.cont();
  assert.equal(stepOf(d.state).id, "W4");
  assert.deepEqual(
    d.state.eased,
    [],
    "nothing eased: the exact command was never shown",
  );
});

// was learn-flow:368
test('review fixes: the status follows the check, with no stale "not yet"', () => {
  const d = at("W3");
  const wrong = b1Item("hello\n");
  d.send({ type: "check", lesson: "b-1", items: [missing] });
  d.send({ type: "check", lesson: "b-1", items: [empty] });
  d.send({ type: "check", lesson: "b-1", items: [missing] });
  assert.equal(
    d.state.beat.fail.hint,
    missing.hint,
    "back to the first message: the screen says so",
  );
  d.send({ type: "check", lesson: "b-1", items: [wrong] });
  assert.equal(d.state.beat.fail.hint, wrong.hint);
  // An error while opening: the first good answer is still the baseline.
  const e = at("W3");
  e.send({ type: "check-error", lesson: "b-1", message: "boom" });
  e.send({ type: "check", lesson: "b-1", items: [missing] });
  assert.equal(e.state.beat.status, "waiting");
});

// was learn-flow:384
// spec: guards.3-full-coverage
test("review fixes: a result that misses an item decides nothing, and a slow item waits for r", () => {
  const d = at("W3");
  d.send({ type: "check", lesson: "b-1", items: [] });
  assert.equal(d.state.beat.status, "opening");
  d.send({
    type: "check",
    lesson: "b-1",
    items: [{ ...passed, slow: true, pass: false }],
  });
  assert.equal(d.state.beat.status, "waiting", 'not "Checking" for ever');
  assert.equal(d.state.beat.slowWait, true, "the card says to press r");
  d.run();
  assert.equal(pending(d, "check").slow, true, "r runs slow items too");
});

// Lessons after the first: warm-ups, a third terminal, and fresh checks.
const demo = courseWith({ "b-2": DEMO_B2 });
const onB2 = (b2 = {}, top = {}) =>
  driver({
    course: demo,
    saved: save({ ...top, lessons: { "b-1": b1Done, "b-2": b2 } }),
  });
const item = (pass, hint = "") => ({ index: 0, text: "x", pass, hint });

// was learn-flow:400
test("the grammar: warm-ups in their own section, a fresh check names its file, three places to type", () => {
  const l = parseLesson(DEMO_B2, "demo");
  assert.deepEqual(
    l.warmup.map((w) => [w.id, w.part, w.from]),
    [
      ["R1", "Warm-up", "b-1"],
      ["R2", "Warm-up", "b-1"],
      ["R3", "Warm-up", "b-1"],
    ],
  );
  assert.deepEqual(
    l.steps.map((s) => s.id),
    ["W1", "Y1", "C"],
  );
  assert.deepEqual(l.steps[1].beats[0].verify, {
    kind: "check",
    items: [0],
    fresh: true,
    since: null,
  });
  const since = parseLesson(
    DEMO_B2.replace(
      "- verify: check 0 fresh",
      "- verify: check 0 fresh since W1",
    ),
    "demo",
  );
  assert.equal(since.steps[1].beats[0].verify.since, "W1");
  const file = parseLesson(
    DEMO_B2.replace(
      "- verify: check 0 fresh\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt",
      "- verify: file .practice/b-2-plan.txt fresh",
    ),
    "demo",
  );
  assert.deepEqual(file.steps[1].beats[0].verify, {
    kind: "file",
    path: ".practice/b-2-plan.txt",
    fresh: true,
    since: null,
  });
  assert.equal(file.steps[1].beats[0].evidence, ".practice/b-2-plan.txt");
  assert.throws(
    () =>
      parseLesson(
        DEMO_B2.replace("- verify: check 0 fresh", "- verify: self fresh"),
        "demo",
      ),
    /only a check, a file or a probe can be fresh/,
  );
  assert.equal(l.steps[0].beats[0].where, "shell");
  assert.throws(
    () =>
      parseLesson(
        DEMO_B2.replace(
          "### R1 | Warm-up |",
          "### W9 | Worked example step 1 of 1 |",
        ),
        "demo",
      ),
    /step heading in the warm-up section/,
  );
  assert.throws(
    () =>
      parseLesson(
        DEMO_B2.replace("### C | Check | Check", "### C | Warm-up | Check"),
        "demo",
      ),
    /warm-up heading in the steps section/,
  );
  assert.throws(
    () =>
      parseLesson(
        DEMO_B2.replace(
          "- evidence: .practice/b-2-before.txt\n- goal",
          "- goal",
        ),
        "demo",
      ),
    /a fresh check needs an evidence file/,
  );
  assert.throws(
    () =>
      parseLesson(DEMO_B2.replace("- where: shell", "- where: moon"), "demo"),
    /unknown where moon/,
  );
  // The app can't see a browser: W1's check there is refused (ticket 103).
  assert.throws(
    () =>
      parseLesson(
        DEMO_B2.replace("- where: shell", "- where: browser"),
        "demo",
      ),
    /a browser beat verifies with self/,
  );
  assert.throws(
    () =>
      parseLesson(
        DEMO_B2.replace(
          "- skill: snapshot\n- where: shell",
          "- skill: snapshot\n- from: b-1\n- where: shell",
        ),
        "demo",
      ),
    /only a warm-up names the lesson it comes from/,
  );
  // A "Done when" in the app's words is a check's or a file's expectation.
  const said = parseLesson(
    DEMO_B2.replace(
      '- goal: "Save it again."',
      '- goal: "Save it again."\n- say: Done when the file lists it.\n- say: Then press r.',
    ),
    "demo",
  );
  assert.deepEqual(
    said.steps[1].beats[0].lines
      .filter((x) => x.key === "say")
      .map((x) => x.doneWhen ?? false),
    [true, false],
  );
  assert.throws(
    () =>
      parseLesson(
        DEMO_B2.replace(
          "- verify: check all",
          "- verify: none\n- say: Done when it runs.",
        ),
        "demo",
      ),
    /a "Done when" say line needs a check beat or a beat that reads a file/,
  );
  // A path git status is asked about is named as git names it, from the
  // work folder: ./, / and .. would match nothing it lists.
  const scoped = parseLesson(
    DEMO_B2.replace(
      "- verify: check all",
      "- verify: git-clean secrets/ .claude/settings.local.json",
    ),
    "demo",
  );
  assert.deepEqual(
    scoped.steps
      .flatMap((x) => x.beats)
      .find((x) => x.verify.kind === "git-clean").verify.paths,
    ["secrets/", ".claude/settings.local.json"],
  );
  for (const verify of [
    "git-clean ./secrets/",
    "git-clean secrets/ /src",
    "git-changed .",
    "git-only ../other/",
    "git-changed src//a.js",
    "git-only src\\a.js",
  ]) {
    assert.throws(
      () =>
        parseLesson(
          DEMO_B2.replace("- verify: check all", `- verify: ${verify}`),
          "demo",
        ),
      /a git path is named from the work folder/,
      verify,
    );
  }
});

// Ticket 178: a warm-up may quote a level's index page, as the guide's quote
// check allows: from beginner-index, intermediate-index or advanced-index.
// was learn-flow:434
test("the grammar: a warm-up may come from a level index, and only a warm-up", () => {
  assert.deepEqual(
    parseLesson(DEMO_I1_INDEX, "demo").warmup.map((w) => w.from),
    ["b-5", "intermediate-index"],
  );
  for (const id of ["beginner-index", "advanced-index"]) {
    assert.equal(
      parseLesson(
        DEMO_I1_INDEX.replace("- from: intermediate-index", `- from: ${id}`),
        "demo",
      ).warmup[1].from,
      id,
    );
  }
  // Any other index is an error that names the three.
  for (const id of ["reference-index", "Intermediate-index", "i-index"]) {
    const text = DEMO_I1_INDEX.replace(
      "- from: intermediate-index",
      `- from: ${id}`,
    );
    const line = text.split("\n").indexOf(`- from: ${id}`) + 1;
    assert.throws(
      () => parseLesson(text, "demo"),
      new RegExp(
        `^Error: demo:${line}: from ${id}: a level index is beginner-index, intermediate-index or advanced-index$`,
      ),
      id,
    );
  }
  assert.throws(
    () =>
      parseLesson(
        DEMO_I1.replace(
          "- skill: skill-file\n",
          "- skill: skill-file\n- from: intermediate-index\n",
        ),
        "demo",
      ),
    /only a warm-up names the lesson it comes from/,
  );
});

// was learn-flow:448
test("the grammar: an intro holds one quoted why and one quoted payoff", () => {
  const intro = (lines) =>
    DEMO_B2.replace('- can: "do it"', `- can: "do it"\n${lines}`);
  const l = parseLesson(
    intro('- why: "It matters."\n- payoff: "do it"'),
    "demo",
  );
  assert.equal(l.intro.why, "It matters.");
  assert.equal(l.intro.payoff, "do it");
  assert.deepEqual(l.intro.can, ["do it"]);
  assert.throws(
    () => parseLesson(intro("- why: It matters."), "demo"),
    /demo:\d+: why must be a quote of the lesson/,
  );
  assert.throws(
    () => parseLesson(intro("- payoff: do it"), "demo"),
    /demo:\d+: payoff must be a quote of the lesson/,
  );
  assert.throws(
    () =>
      parseLesson(
        intro('- why: "It matters."\n- why: "So does this."'),
        "demo",
      ),
    /demo:\d+: a second why line in the intro/,
  );
  assert.throws(
    () => parseLesson(intro('- payoff: "do it"\n- payoff: "do it"'), "demo"),
    /demo:\d+: a second payoff line in the intro/,
  );
  // The payoff is one of the can lines, or the screen would flag nothing.
  const typo = intro('- payoff: "do it now"');
  const line = typo.split("\n").indexOf('- payoff: "do it now"') + 1;
  assert.throws(
    () => parseLesson(typo, "demo"),
    new RegExp(
      `^Error: demo:${line}: the payoff "do it now" is not one of the intro's can lines$`,
    ),
  );
});

// was learn-flow:464
test("the grammar: an intro holds one quoted read line with one link, at most", () => {
  const intro = (lines) =>
    DEMO_B2.replace('- can: "do it"', `- can: "do it"\n${lines}`);
  const line = "[Read this](https://example.com/page): what it covers.";
  assert.equal(
    parseLesson(intro(`- read: "${line}"`), "demo").intro.read,
    line,
  );
  assert.equal(parseLesson(DEMO_B2, "demo").intro.read, undefined);
  assert.throws(
    () => parseLesson(intro(`- read: ${line}`), "demo"),
    /demo:\d+: read must be a quote of the lesson/,
  );
  assert.throws(
    () => parseLesson(intro(`- read: "${line}"\n- read: "${line}"`), "demo"),
    /demo:\d+: a second read line in the intro/,
  );
  // The p overlay spells out its one link's address.
  for (const bad of [
    "Read this next: what it covers.",
    `${line} [And this](https://example.com/other).`,
  ]) {
    assert.throws(
      () => parseLesson(intro(`- read: "${bad}"`), "demo"),
      /^Error: demo:\d+: a read line links one page to read, with a Markdown link$/,
      bad,
    );
  }
});

// was learn-flow:477
test("the grammar: a card section holds entries of a skill, a quoted command and a quoted description", () => {
  const card = (lines) => `${DEMO_B2}\n## card\n${lines}\n`;
  const entry =
    '- skill: snapshot\n- show: "git status --porcelain"\n- does: "Save what git sees"';
  assert.deepEqual(
    parseLesson(
      card(
        `${entry}\n- skill: check\n- show: "npm run check"\n- does: "Run the check."`,
      ),
      "demo",
    ).card,
    [
      {
        skill: "snapshot",
        show: "git status --porcelain",
        does: "Save what git sees",
      },
      { skill: "check", show: "npm run check", does: "Run the check." },
    ],
  );
  assert.deepEqual(parseLesson(DEMO_B2, "demo").card, []);
  assert.throws(
    () =>
      parseLesson(
        card(
          entry.replace('"git status --porcelain"', "git status --porcelain"),
        ),
        "demo",
      ),
    /demo:\d+: show must be a quote of the lesson/,
  );
  assert.throws(
    () =>
      parseLesson(
        card(entry.replace('"Save what git sees"', "Save what git sees")),
        "demo",
      ),
    /demo:\d+: does must be a quote of the lesson/,
  );
  assert.throws(
    () =>
      parseLesson(
        card(entry.replace("- skill: snapshot", '- skill: "snapshot"')),
        "demo",
      ),
    /demo:\d+: skill holds the app's own words: no quotes/,
  );
  assert.throws(
    () => parseLesson(card(entry.replace("- show:", "- run:")), "demo"),
    /demo:\d+: unknown card key run/,
  );
  assert.throws(
    () => parseLesson(card(entry.replace("- skill: snapshot\n", "")), "demo"),
    /demo:\d+: a card line before its skill line/,
  );
  assert.throws(
    () => parseLesson(card(`${entry}\n- does: "Save it again."`), "demo"),
    /demo:\d+: a second does line in a card entry/,
  );
  // An entry shows after a finished step on its skill: one this lesson has, and both quotes.
  assert.throws(
    () =>
      parseLesson(
        card(entry.replace("- skill: snapshot", "- skill: status")),
        "demo",
      ),
    /demo:\d+: the card entry's skill status is no step of this lesson/,
  );
  assert.throws(
    () => parseLesson(card(entry.replace(/\n- does: .*/, "")), "demo"),
    /demo:\d+: a card entry needs a show and a does line/,
  );
});

// Ticket 194 (the lesson value rework's rule 4): one warm-up, on a skill the
// learner missed, or none.
// was learn-flow:498
// spec: warmups.at-most-one
// spec: warmups.first-missed
// spec: warmups.challenge
// spec: warmups.right-clears
test("warm-ups: one opens the lesson, on a missed skill, always CHALLENGE, and no part of the climb", () => {
  const d = onB2({}, { missed: ["exit"] });
  assert.equal(d.state.phase, "overview");
  assert.equal(d.state.lesson, "b-2");
  d.start();
  assert.deepEqual(
    d.state.progress["b-2"].warm,
    ["R3"],
    "the missed skill alone",
  );
  assert.equal(stepOf(d.state).id, "R3");
  assert.deepEqual(tiersOf(d.state), [
    "challenge",
    "guided",
    "challenge",
    "challenge",
  ]);
  d.pick(0);
  assert.equal(d.state.beat.status, "done");
  assert.ok(
    !d.state.missed.includes("exit"),
    "recalled at once: the mark clears",
  );
  d.cont();
  assert.equal(stepOf(d.state).id, "W1", "one warm-up, then the lesson");
  assert.equal(
    d.state.phase,
    "playing",
    "from a warm-up back to GUIDED is no level-up",
  );
  // A wrong pick keeps the mark for a later warm-up.
  const w = onB2({}, { missed: ["status"] });
  w.start();
  assert.equal(stepOf(w.state).id, "R1");
  w.pick(1);
  assert.ok(
    w.state.missed.includes("status"),
    "a wrong pick marks the skill for a later warm-up",
  );
  // Two skills missed: still one warm-up, the first in the file's order.
  const two = onB2({}, { missed: ["exit", "status"] });
  two.start();
  assert.deepEqual(two.state.progress["b-2"].warm, ["R1"]);
  // Nothing missed: no warm-up, and the lesson opens on its own first step.
  const none = onB2();
  none.start();
  assert.deepEqual(none.state.progress["b-2"].warm, []);
  assert.equal(stepOf(none.state).id, "W1");
  assert.deepEqual(tiersOf(none.state), ["guided", "challenge", "challenge"]);
  // Resuming inside the warm-ups keeps the ones the play started with, two
  // in a save from before ticket 194.
  const r = onB2({ step: "R1", beat: 0, warm: ["R3", "R1"] });
  r.open();
  assert.equal(stepOf(r.state).id, "R1");
  assert.equal(r.state.pos.step, 1);
  // A typed warm-up answered wrong marks its skill too.
  const t = onB2({ step: "R2", beat: 0, warm: ["R2", "R1"] });
  t.open();
  t.type("claude");
  assert.ok(t.state.missed.includes("save-version"));
});

// was learn-flow:542
// spec: verify.value.fresh
// spec: guards.6-fresh
test("a fresh check waits for new work, not for what an earlier step left behind", () => {
  const d = onB2({
    step: "Y1",
    beat: 0,
    warm: ["R1", "R2"],
    levels: ["challenge"],
  });
  d.open();
  assert.equal(stepOf(d.state).id, "Y1");
  const path = ".practice/b-2-before.txt";
  d.send({
    type: "check",
    lesson: "b-2",
    items: [item(true)],
    path,
    stamp: "A",
  });
  assert.equal(
    d.state.beat.status,
    "waiting",
    "it passes, but the file is the one W1 made",
  );
  assert.equal(d.state.beat.stale, true);
  assert.equal(d.state.progress["b-2"].stamps["Y1.0"], "A");
  d.send({
    type: "check",
    lesson: "b-2",
    items: [item(true)],
    path,
    stamp: "A",
  });
  assert.equal(d.state.beat.status, "waiting");
  d.send({
    type: "check",
    lesson: "b-2",
    items: [item(true)],
    path: ".practice/other.txt",
    stamp: "B",
  });
  assert.equal(
    d.state.beat.status,
    "waiting",
    "a result about another file decides nothing",
  );
  d.send({
    type: "check",
    lesson: "b-2",
    items: [item(false, "lists 1 changed file: src/a.js")],
    path,
    stamp: "C",
  });
  assert.equal(
    d.state.beat.status,
    "fail",
    'new work that fails says "not yet"',
  );
  d.send({
    type: "check",
    lesson: "b-2",
    items: [item(true)],
    path,
    stamp: "D",
  });
  assert.equal(d.state.beat.status, "done");
  // Back after a break, with the work done meanwhile: it counts.
  const r = onB2({
    step: "Y1",
    beat: 0,
    warm: ["R1", "R2"],
    levels: ["challenge"],
    stamps: { "Y1.0": "A" },
  });
  r.open();
  r.send({
    type: "check",
    lesson: "b-2",
    items: [item(true)],
    path,
    stamp: "B",
  });
  assert.equal(r.state.beat.status, "already");
  // Playing the lesson again from its start forgets the old files.
  const again = onB2({
    ...finished(demo.find((l) => l.id === "b-2")),
    warm: ["R1", "R2"],
    stamps: { "Y1.0": "A" },
  });
  // dropped: T-view the app opens on the map
  again.open("b-2");
  assert.equal(again.state.phase, "overview");
  again.start();
  assert.deepEqual(again.state.progress["b-2"].stamps, {});
});

// was learn-flow:584
// spec: verify.value.file
test("a file check is done once its file holds a line, and a fresh one once it changed", () => {
  const text = DEMO_B2.replace(
    "- verify: check 0 fresh\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt",
    "- verify: file .practice/b-2-plan.txt fresh",
  );
  const d = driver({
    course: courseWith({ "b-2": text }),
    saved: save({
      lessons: {
        "b-1": b1Done,
        "b-2": { warm: ["R1", "R2"], done: ["R1", "R2"], step: "W1", beat: 0 },
      },
    }),
  });
  d.open();
  d.send({
    type: "check",
    lesson: "b-2",
    items: [{ index: 0, text: "x", pass: true, hint: "" }],
  });
  assert.equal(d.state.beat.status, "already");
  const out = d.cont().effects;
  // Opening Y1 asks for its file's state now, before the learner touches it.
  assert.deepEqual(
    out.find((e) => e.type === "stamp"),
    {
      type: "stamp",
      key: "Y1.0",
      path: ".practice/b-2-plan.txt",
      dir: FACTS.root,
    },
  );
  assert.equal(d.state.phase, "step-down");
  assert.ok(
    d
      .accept()
      .effects.some(
        (e) => e.type === "file" && e.path === ".practice/b-2-plan.txt",
      ),
  );
  d.send({ type: "stamp", key: "Y1.0", stamp: "A" });
  d.send({
    type: "file",
    path: ".practice/b-2-plan.txt",
    read: Buffer.from("src/config.js"),
    stamp: "A",
  });
  assert.equal(d.state.beat.status, "waiting", "the file W1 left behind");
  d.send({
    type: "file",
    path: ".practice/other.txt",
    read: Buffer.from("x"),
    stamp: "B",
  });
  assert.equal(d.state.beat.status, "waiting", "another file decides nothing");
  d.send({
    type: "file",
    path: ".practice/b-2-plan.txt",
    read: null,
    stamp: "B",
  });
  d.run();
  d.send({
    type: "file",
    path: ".practice/b-2-plan.txt",
    read: null,
    stamp: "B",
    asked: d.state.beat.asked,
  });
  assert.equal(d.state.beat.status, "fail");
  assert.equal(
    d.state.beat.fail.hint,
    ".practice/b-2-plan.txt is not there yet.",
    "a missing file is not there, not empty (r27 E1)",
  );
  d.send({
    type: "file",
    path: ".practice/b-2-plan.txt",
    read: Buffer.from("src/config.js\nsrc/cli.js\n"),
    stamp: "C",
  });
  assert.equal(d.state.beat.status, "done");
  assert.equal(
    d.state.beat.evidence,
    "src/config.js and 1 more line",
    "a list shows how long it is",
  );
});

// was learn-flow:610
// spec: verify.value.fresh-since
test("fresh since: the file is compared with how it was when an earlier step opened", () => {
  const text = DEMO_B2.replace(
    "- verify: check 0 fresh",
    "- verify: check 0 fresh since W1",
  );
  const d = driver({
    course: courseWith({ "b-2": text }),
    saved: save({
      lessons: { "b-1": b1Done, "b-2": { warm: ["R1"], step: "R1", beat: 0 } },
    }),
  });
  d.open();
  d.pick(0);
  const out = d.cont().effects;
  assert.equal(stepOf(d.state).id, "W1");
  assert.deepEqual(
    out.find((e) => e.type === "stamp"),
    {
      type: "stamp",
      key: "Y1.0",
      path: ".practice/b-2-before.txt",
      dir: FACTS.root,
    },
  );
});

// A lesson whose help goes up and down: new skills are GUIDED, `status`
// (from lesson 1) is HINTED.
const SAW = DEMO_B2.replace(
  /## steps[\s\S]*$/,
  `## steps

### W1 | Worked example step 1 of 3 | New
- tier: guided
- skill: brand-new
- where: claude
- beat: do
- verify: self
- goal: "Do it."

### W2 | Worked example step 2 of 3 | Old
- tier: hinted
- skill: status
- where: claude
- beat: do
- verify: self
- goal: "Do it."

### W3 | Worked example step 3 of 3 | New again
- tier: guided
- skill: other-new
- where: claude
- beat: do
- verify: self
- goal: "Do it."

### Y1 | Your turn step 1 of 1 | Yours
- tier: hinted
- skill: brand-new
- where: claude
- beat: do
- verify: self
- goal: "Do it."

### C | Check | Check
- tier: challenge
- skill: check
- where: terminal
- beat: do
- verify: self
- goal: "Do it."
`,
);

// was learn-flow:665
test("a level-up shows only when the help stays lower; a single harder step gets a line instead", () => {
  const d = driver({
    course: courseWith({ "b-2": SAW }),
    saved: save({
      lessons: { "b-1": b1Done, "b-2": { warm: [], step: "W1", beat: 0 } },
    }),
  });
  d.open();
  assert.deepEqual(tiersOf(d.state), [
    "guided",
    "hinted",
    "guided",
    "hinted",
    "challenge",
  ]);
  d.markDone();
  assert.equal(stepOf(d.state).id, "W2");
  assert.equal(
    d.state.phase,
    "playing",
    "W3 gets more help again: no level-up",
  );
  assert.equal(stepNote(d.state), "hinted");
  d.markDone();
  assert.equal(stepNote(d.state), null);
  d.back();
  assert.equal(stepNote(d.state), "hinted", "going back keeps the line");
  d.markDone();
  d.markDone();
  assert.equal(d.state.phase, "step-down", "from Y1 on the help stays lower");
  assert.equal(d.state.levelTo, "hinted");
});

// was learn-flow:683
test('review fixes: a slow item clears an old "not yet", and r shows the run', () => {
  const d = at("C", { levels: ["hinted", "challenge"] });
  const slowItem = { index: 0, text: "x", pass: false, slow: true, hint: "" };
  d.send({ type: "check", lesson: "b-1", items: [empty] });
  d.run();
  d.send({
    type: "check",
    lesson: "b-1",
    items: [missing],
    asked: d.state.beat.asked,
  });
  assert.equal(d.state.beat.status, "fail");
  d.send({ type: "check", lesson: "b-1", items: [slowItem] });
  assert.equal(d.state.beat.status, "waiting");
  assert.equal(d.state.beat.fail, null, "the old message goes");
  assert.equal(d.state.beat.slowWait, true);
  d.run();
  assert.equal(
    d.state.beat.status,
    "opening",
    "r shows that the slow part runs",
  );
  d.send({
    type: "check-error",
    lesson: "b-1",
    message: "it took too long",
    asked: d.state.beat.asked,
  });
  assert.equal(d.state.beat.status, "broken");
  d.send({ type: "check", lesson: "b-1", items: [slowItem] });
  assert.equal(d.state.beat.status, "waiting");
  assert.equal(d.state.beat.error, null);
});

// was learn-flow:703
// spec: warmups.wrong-saved
test("review fixes: a warm-up leaves an ease for the lesson's own step, and a missed mark is saved", () => {
  const text = DEMO_B2.replace(
    "### W1 | Worked example step 1 of 1 | Save the list\n- tier: guided\n- skill: snapshot",
    "### W1 | Worked example step 1 of 1 | Save the list\n- tier: hinted\n- skill: status",
  );
  const d = driver({
    course: courseWith({ "b-2": text }),
    saved: save({
      eased: ["status"],
      missed: ["status"],
      lessons: { "b-1": b1Done },
    }),
  });
  d.start();
  assert.equal(stepOf(d.state).id, "R1");
  assert.equal(d.state.beat.eased, false, 'no "more help" line on a warm-up');
  assert.deepEqual(d.state.eased, ["status"]);
  const out = d.pick(1).effects;
  assert.ok(d.state.missed.includes("status"));
  assert.ok(
    out.some((e) => e.type === "save"),
    "the mark is saved at once",
  );
  d.pick(0);
  d.cont();
  assert.equal(stepOf(d.state).id, "W1");
  assert.equal(tierOf(d.state), "guided", "W1 comes back one tier easier");
  // Back to a warm-up just missed, answered right: the mark stays for later.
  const r = driver({
    course: courseWith({ "b-2": text }),
    saved: save({
      lessons: {
        "b-1": b1Done,
        "b-2": { warm: ["R1", "R3"], step: "R1", beat: 0 },
      },
    }),
  });
  r.open();
  r.pick(1);
  r.pick(0);
  r.cont();
  assert.equal(stepOf(r.state).id, "R3");
  r.back();
  assert.equal(stepOf(r.state).id, "R1");
  r.pick(0);
  assert.ok(r.state.missed.includes("status"));
});

// was learn-flow:730
test("review fixes: a recall question marks the skill it recalls, and an unreadable file decides nothing", () => {
  const text = DEMO_B2.replace(
    "- accept: claude --version",
    "- skill: save-version\n- accept: claude --version",
  ).replace(
    "- skill: save-version\n- from: b-1",
    "- skill: check\n- from: b-1",
  );
  const d = driver({
    course: courseWith({ "b-2": text }),
    saved: save({
      lessons: { "b-1": b1Done, "b-2": { warm: ["R2"], step: "R2", beat: 0 } },
    }),
  });
  d.open();
  d.type("claude");
  assert.ok(
    d.state.missed.includes("save-version"),
    "the beat's skill, not the step's",
  );
  assert.ok(!d.state.missed.includes("check"));
  const y = onB2({
    step: "Y1",
    beat: 0,
    warm: ["R1", "R2"],
    levels: ["challenge"],
  });
  y.open();
  y.send({
    type: "check",
    lesson: "b-2",
    items: [item(true)],
    path: ".practice/b-2-before.txt",
    stamp: null,
  });
  assert.deepEqual(
    y.state.progress["b-2"].stamps,
    {},
    "no stamp from a file that could not be read",
  );
  assert.equal(y.state.beat.status, "opening");
  y.send({ type: "stamp", key: "Y1.0", stamp: null });
  assert.deepEqual(y.state.progress["b-2"].stamps, {});
});

// was learn-flow:747
test("review fixes: a FAIL about a slow item keeps its hints when a poll leaves that item out", () => {
  const d = at("C", { levels: ["hinted", "challenge"] });
  // The 2-second poll runs the check without slow items: they come back as placeholders.
  const placeholder = {
    index: 0,
    text: passed.text,
    pass: false,
    slow: true,
    hint: "",
  };
  const slowFail = {
    ...passed,
    pass: false,
    hint: "The tool exited with code 0, not 2.",
  };
  d.send({ type: "check", lesson: "b-1", items: [placeholder] });
  assert.equal(d.state.beat.slowWait, true);
  d.run();
  d.send({
    type: "check",
    lesson: "b-1",
    items: [slowFail],
    asked: d.state.beat.asked,
  });
  assert.equal(d.state.beat.status, "fail");
  d.hint();
  assert.equal(d.state.beat.rung, 0);
  d.send({ type: "check", lesson: "b-1", items: [placeholder] });
  assert.equal(
    d.state.beat.status,
    "fail",
    "the poll knows nothing new about the slow item",
  );
  assert.equal(d.state.beat.rung, 0, "the hint on screen stays");
  assert.ok(hintAvailable(d.state));
  d.run();
  assert.equal(d.state.beat.status, "opening", "r runs the slow item again");
  d.send({
    type: "check",
    lesson: "b-1",
    items: [passed],
    asked: d.state.beat.asked,
  });
  assert.equal(d.state.beat.status, "done");
});

// was learn-flow:769
test("review fixes: a bottom rung eases its skill from the next step on, not the rest of its own step", () => {
  const text = DEMO_B2.replace(
    "- where: shell\n- beat: do\n- verify: check 0\n",
    '- where: shell\n- beat: do\n- verify: self\n- goal: "Open a terminal."\n- bottom: "git status"\n- beat: do\n- verify: check 0\n',
  );
  const d = driver({
    course: courseWith({ "b-2": text }),
    saved: save({
      lessons: { "b-1": b1Done, "b-2": { warm: [], step: "W1", beat: 0 } },
    }),
  });
  d.open();
  d.hint();
  assert.equal(d.state.beat.confirm, true);
  d.exact(true);
  assert.deepEqual(d.state.eased, ["snapshot"]);
  d.markDone();
  assert.deepEqual([stepOf(d.state).id, d.state.pos.beat], ["W1", 1]);
  assert.equal(
    d.state.progress["b-2"].easedSteps.W1,
    undefined,
    "the rest of W1 is not eased",
  );
  assert.deepEqual(
    d.state.eased,
    ["snapshot"],
    "the ease waits for the next step",
  );
  d.send({ type: "check", lesson: "b-2", items: [item(true)] });
  d.cont();
  assert.equal(stepOf(d.state).id, "Y1");
  assert.equal(d.state.progress["b-2"].easedSteps.Y1, true);
  assert.deepEqual(d.state.eased, []);
});

// was learn-flow:788
test("review fixes: a stuck option may say what the learner saw in the app's own words", () => {
  const l = parseLesson(
    DEMO_B2.replace(
      '- wrong: "`/usage`"\n- because: "Usage is something else."',
      '- stuck: a plan with no test\n- because: "Usage is something else."',
    ),
    "demo",
  );
  assert.deepEqual(l.warmup[0].beats[0].options[1], {
    kind: "stuck",
    text: "a plan with no test",
    quoted: false,
    because: "Usage is something else.",
  });
});

// was learn-flow:793
test("real-run fixes: a question starts with nothing picked, and h says when hints open", () => {
  const d = at("W5");
  // dropped: T-cursor nothing picked at first, T-toast pickFirst on a stray enter
  d.refused("step.continue");
  assert.equal(d.state.beat.status, "waiting", "going on answers nothing");
  d.pick(0);
  assert.equal(
    d.state.beat.feedback.kind,
    "wrong",
    "a pick answers with the option it names",
  );
  const c = at("Y4", { levels: ["hinted", "challenge"] });
  // dropped: T-toast hintsLater; the engine fact behind it
  hintsLater(c, "r");
  assert.equal(c.state.beat.rung, -1);
});

// A saved place in the whole course, opened.
const open = (id, step, extra = {}, lessons = course) => {
  const d = driver({
    course: lessons,
    saved: save({
      lessons: {
        ...finishedBefore(id, lessons),
        [id]: { step, beat: 0, warm: [], ...extra },
      },
    }),
  });
  d.open();
  return d;
};

// was learn-flow:816
test("h at CHALLENGE: a beat nothing checks opens the first hint at once", () => {
  for (const [id, step] of [
    ["b-capstone", "T5"],
    ["b-4", "Y5"],
  ]) {
    const d = open(id, step);
    assert.equal(tierOf(d.state), "challenge", `${id} ${step}`);
    assert.equal(beatOf(d.state).verify.kind, "self");
    d.hint();
    assert.equal(
      d.state.beat.rung,
      0,
      `${id} ${step}.0 opens rung 0 with no tick`,
    );
    // dropped: T-toast no toast
  }
});

// was learn-flow:827
// spec: tiers.challenge-try
test("h at CHALLENGE: every beat waits for a try only where a try can show", () => {
  for (const l of course.filter((x) => x.content)) {
    for (const step of l.content.steps) {
      step.beats.forEach((beat, b) => {
        const d = driver({
          course,
          saved: save({
            lessons: {
              ...finishedBefore(l.id),
              [l.id]: { step: step.id, beat: b, warm: [] },
            },
          }),
        });
        d.open();
        const here = `${l.id} ${step.id}.${b}`;
        if (
          tierOf(d.state) !== "challenge" ||
          beat.kind === "type" ||
          !rungsOf(d.state).length ||
          ["done", "already"].includes(d.state.beat.status)
        )
          return;
        // What the app looks at: a check, git status, a file it reads or a
        // git probe (ticket 105).
        const watched =
          ["check", "probe"].includes(beat.verify.kind) ||
          GIT.has(beat.verify.kind) ||
          READS.has(beat.verify.kind);
        const scored =
          Boolean(beat.ask) &&
          beat.kind !== "predict" &&
          beat.options.some((o) => ["wrong", "decoy"].includes(o.kind));
        if (watched || scored) {
          assert.equal(hintAvailable(d.state), false, here);
          assert.equal(tryFirst(d.state), watched ? "r" : "pick", here);
          d.refused("hint.next");
          assert.equal(d.state.beat.rung, -1, here);
        } else {
          d.hint();
          assert.ok(
            d.state.beat.rung === 0 || d.state.beat.confirm,
            `${here} opens at once`,
          );
        }
      });
    }
  }
});

// was learn-flow:850
test("h at CHALLENGE: on a done-label git beat, r is the try", () => {
  const d = at("Y4", { levels: ["hinted", "challenge"] });
  assert.equal(tierOf(d.state), "challenge");
  d.send({ type: "git", paths: ["notes.md"] });
  hintsLater(d, "r");
  assert.equal(d.state.beat.rung, -1, "nothing opens before a try");
  d.run();
  d.send({ type: "git", paths: ["notes.md"], asked: d.state.beat.asked });
  assert.equal(
    d.state.beat.status,
    "waiting",
    "the tree still decides nothing until the session ends",
  );
  d.hint();
  assert.equal(d.state.beat.rung, 0);
});

// was learn-flow:864
test("h at CHALLENGE: on a stale fresh beat, r is the try", () => {
  const path = ".practice/b-5-rule.txt";
  const d = open("b-5", "Y2", { stamps: { "Y2.0": "a" } });
  assert.equal(tierOf(d.state), "challenge");
  d.send({
    type: "file",
    path,
    read: Buffer.from("// linkcheck source."),
    stamp: "a",
  });
  assert.equal(d.state.beat.status, "waiting");
  hintsLater(d, "r");
  assert.equal(d.state.beat.rung, -1);
  d.run();
  assert.deepEqual(d.effects.at(-1), {
    type: "file",
    path,
    asked: d.state.asks,
    dir: FACTS.root,
  });
  d.send({
    type: "file",
    path,
    read: Buffer.from("// linkcheck source."),
    stamp: "a",
    asked: d.state.beat.asked,
  });
  assert.equal(
    d.state.beat.status,
    "waiting",
    "an unchanged file is still not done",
  );
  d.hint();
  assert.equal(d.state.beat.rung, 0);
});

const DEMO_ASK = DEMO_B2.replace(
  /## warm-up[\s\S]*$/,
  `## steps

### C | Check | Check
- tier: challenge
- skill: check
- where: claude
- beat: predict
- ask: Guess: which one?
- right: "One"
- option: "Two"
- hint: "A hint for the guess."
- beat: ask
- ask: Which one?
- right: "One"
- wrong: "Two"
- because: "Two is something else."
- wrong: "Three"
- because: "Three is something else."
- hint: "A hint for the question."
`,
);

// was learn-flow:901
test("h at CHALLENGE: on a question the first wrong pick is the try, and a guess gates nothing", () => {
  const demo = courseWith({ "b-2": DEMO_ASK });
  const guess = open("b-2", "C", {}, demo);
  assert.equal(tierOf(guess.state), "challenge");
  assert.equal(beatOf(guess.state).kind, "predict");
  guess.hint();
  assert.equal(guess.state.beat.rung, 0, "a guess has nothing to try first");
  const d = open("b-2", "C", {}, demo);
  d.pick(0);
  assert.equal(d.state.beat.status, "done");
  assert.equal(d.state.beat.unlocked, false, "a guess unlocks nothing");
  d.cont();
  assert.equal(beatOf(d.state).kind, "ask");
  hintsLater(d, "pick");
  assert.equal(d.state.beat.rung, -1);
  d.pick(1);
  assert.equal(d.state.beat.feedback.kind, "wrong");
  assert.equal(d.state.beat.unlocked, true);
  d.hint();
  assert.equal(d.state.beat.rung, 0);
});

// A question nothing can fail (no wrong or decoy option), and a stuck option
// on one that can.
const DEMO_SELF_REPORT = DEMO_B2.replace(
  /## warm-up[\s\S]*$/,
  `## steps

### C | Check | Check
- tier: challenge
- skill: check
- where: claude
- beat: do
- do: "Run it."
- ask: Did it work?
- right: "It worked"
- stuck: I got an error
- because: "That's the fix."
- hint: "A hint for the run."
- beat: ask
- ask: Which one?
- right: "One"
- stuck: Something odd
- because: "That's the odd one."
- wrong: "Three"
- because: "Three is something else."
- hint: "A hint for the question."
`,
);

// was learn-flow:949
test("h at CHALLENGE: a question with no wrong answer opens at once, and a stuck pick is a try", () => {
  const demo = courseWith({ "b-2": DEMO_SELF_REPORT });
  const d = open("b-2", "C", {}, demo);
  assert.equal(tierOf(d.state), "challenge");
  assert.equal(
    tryFirst(d.state),
    null,
    "right or stuck: no pick can fail, so nothing waits",
  );
  // dropped: T-toast no toast
  d.hint();
  assert.equal(d.state.beat.rung, 0);
  d.pick(0);
  d.cont();
  assert.equal(beatOf(d.state).kind, "ask");
  hintsLater(d, "pick");
  d.pick(1);
  assert.equal(d.state.beat.feedback.kind, "stuck");
  assert.equal(d.state.beat.unlocked, true, "saying it went wrong is a try");
  d.hint();
  assert.equal(d.state.beat.rung, 0);
});
