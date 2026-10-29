// Help that comes and goes (ticket 208, from learn-flow 961-1756): where an
// ease lands, how warm-ups set the help, how help fades with what this
// Learner did, and what more help at a step-down gives, driven by actions.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  asStarted,
  bareExit,
  b1Only,
  beatOf,
  bottomRung,
  course,
  courseWith,
  DEMO_B2,
  DEMO_I1_INDEX,
  driver,
  finished,
  finishedBefore,
  mix,
  moreHelpGives,
  parseLesson,
  pickWarmups,
  playUntil,
  ruleTiers,
  save,
  snapshot,
  stepNote,
  stepOf,
  tierOf,
  tiersOf,
} from "./drive.mjs";
import { at, atStep, fresh, midway, reopen } from "./flow-places.mjs";

// On a step card, with a beat open.
const onCard = (s) => s.phase === "playing" && Boolean(s.beat);
// On b-5's step `id`, on its card or at its step-down.
const at5 = (id) => (s) =>
  (onCard(s) || s.phase === "step-down") &&
  s.lesson === "b-5" &&
  stepOf(s)?.id === id;

// spec: tiers.eases
test("an ease lands only where it changes the help: a GUIDED step keeps it waiting for the next one", () => {
  // was learn-flow:977
  const d = midway("b-5", "W4");
  bottomRung(d);
  assert.deepEqual(d.state.eased, ["memory"]);
  playUntil(d, at5("W5"));
  assert.equal(tierOf(d.state), "guided");
  assert.equal(
    d.state.beat.eased,
    false,
    'no "more help" line on a step that is GUIDED anyway',
  );
  assert.deepEqual(d.state.progress["b-5"].easedSteps, {});
  assert.deepEqual(d.state.eased, ["memory"], "the ease waits");
  playUntil(d, at5("Y1"));
  assert.ok(onCard(d.state));
  assert.equal(
    tierOf(d.state),
    "guided",
    "Y1, HINTED on the plan, opens GUIDED",
  );
  assert.equal(d.state.beat.eased, true);
  assert.deepEqual(d.state.eased, []);
});

// spec: tiers.eases
test("an ease lands only where it changes the help: the level-up forecast agrees with where it lands", () => {
  // was learn-flow:993
  const d = midway("b-5", "W4");
  bottomRung(d);
  playUntil(d, at5("W6"));
  assert.ok(onCard(d.state), "no level-up at W6: Y1 will get more help");
  assert.equal(stepNote(d.state), "hinted");
  // From here to the end, a level-up shows only where no later step gets more
  // help, and a step's own line only where one does.
  const rank = (t) => ["guided", "hinted", "challenge"].indexOf(t);
  const seen = new Map();
  playUntil(d, (s) => {
    if (onCard(s) && !seen.has(stepOf(s).id))
      seen.set(stepOf(s).id, { tier: tierOf(s), note: stepNote(s), up: null });
    if (s.phase === "step-down" && !seen.has(stepOf(s).id))
      seen.set(stepOf(s).id, { tier: s.levelTo, note: null, up: s.levelTo });
    return s.phase === "complete";
  });
  const played = [...seen.values()];
  assert.ok(
    played.some((x) => x.up),
    "a level-up shows later on",
  );
  played.forEach((x, i) => {
    const later = played.slice(i + 1);
    if (x.up)
      assert.ok(
        later.every((y) => rank(y.tier) >= rank(x.up)),
        `level-up at ${[...seen.keys()][i]}`,
      );
    if (x.note)
      assert.ok(
        later.some((y) => rank(y.tier) < rank(x.tier)),
        `line at ${[...seen.keys()][i]}`,
      );
  });
  // The step whose bottom rung set an ease gets none of it, in the forecast
  // too: back from the Check, Y6 is where the help stays lower.
  const c = midway("b-5", "C", { levels: ["hinted", "challenge"] });
  bottomRung(c);
  assert.deepEqual(c.state.eased, ["check"]);
  c.back();
  assert.equal(stepOf(c.state).id, "Y6");
  assert.equal(tiersOf(c.state).at(-1), "challenge");
  assert.equal(
    stepNote(c.state),
    null,
    "no line: the Check will not come back easier",
  );
});

// spec: tiers.eases
test("an ease lands only where it changes the help: hints short of the exact command neither add nor clear one", () => {
  // was learn-flow:1026
  const d = midway("b-5", "W4", { eased: ["memory"] });
  const l = course.find((x) => x.id === "b-5");
  const items = [
    {
      index: 0,
      text: l.items[0],
      pass: false,
      hint: `${l.items[0]} is not there yet.`,
    },
  ];
  d.send({ type: "check", lesson: "b-5", items });
  d.run();
  d.send({ type: "check", lesson: "b-5", items, asked: d.state.beat.asked });
  d.hint();
  d.hint();
  assert.equal(d.state.beat.rung, 1);
  assert.equal(d.state.beat.confirm, false);
  assert.deepEqual(d.state.eased, ["memory"], "still waiting");
  assert.deepEqual(d.state.progress["b-5"].easedSteps, {});
  const y = midway("b-5", "Y1");
  y.hint();
  assert.equal(y.state.beat.rung, 0);
  assert.deepEqual(y.state.eased, [], "nothing added");
});

test("an ease lands only where it changes the help: playing a lesson again starts from the plan", () => {
  // was learn-flow:1045
  const done = Object.fromEntries(
    course.filter((l) => l.content).map((l) => [l.id, finished(l)]),
  );
  const d = driver({
    course,
    saved: save({
      lessons: {
        ...done,
        "b-5": { ...done["b-5"], warm: ["R1", "R2"], easedSteps: { Y1: true } },
      },
    }),
  });
  // dropped: T-view the app opening on the map
  d.open("b-5");
  assert.deepEqual([d.state.phase, d.state.lesson], ["overview", "b-5"]);
  assert.deepEqual(d.state.progress["b-5"].easedSteps, { Y1: true });
  d.start();
  assert.deepEqual(d.state.progress["b-5"].easedSteps, {});
});

// The capstone's warm-ups recall b-4 and b-5 skills its steps never use (D12).
// Its rewind warm-up plays where rewind was missed before (194).
test("an ease lands only where it changes the help: one no later Beginner step uses stays saved (Q12)", () => {
  // was learn-flow:1059
  const toWarmup = () => {
    const d = midway("b-4", "Y4", { beat: 1, missed: ["rewind"] });
    bottomRung(d);
    assert.deepEqual(d.state.eased, ["rewind"]);
    playUntil(
      d,
      (s) =>
        s.lesson === "b-capstone" && onCard(s) && stepOf(s).skill === "rewind",
    );
    assert.equal(d.state.progress["b-5"].complete, true);
    assert.equal(stepOf(d.state).part, "Warm-up");
    assert.deepEqual(d.state.eased, ["rewind"]);
    return d;
  };
  // Missed at the capstone's warm-up: no step there uses it, so it stays.
  const d = toWarmup();
  for (let i = 0; i < 2; i++) d.type("/resume");
  assert.equal(d.state.beat.answer.kind, "revealed");
  playUntil(d, (s) => s.lesson === "b-capstone" && s.phase === "complete");
  assert.deepEqual(d.state.progress["b-capstone"].easedSteps, {});
  assert.deepEqual(d.state.eased, ["rewind"]);
  assert.deepEqual(snapshot(d.state).eased, ["rewind"]);
  // Recalled there at once: the waiting ease is cancelled.
  const r = toWarmup();
  playUntil(r, (s) => s.lesson === "b-capstone" && s.phase === "complete");
  assert.deepEqual(r.state.eased, []);
});

// spec: tiers.eases
test("an ease lands only where it changes the help: in a lesson played again, every step is done, so it waits", () => {
  // was learn-flow:1087
  const done = Object.fromEntries(
    course.filter((l) => l.content).map((l) => [l.id, finished(l)]),
  );
  const b5 = course.find((l) => l.id === "b-5").content.steps.map((x) => x.id);
  const d = driver({
    course,
    saved: save({
      lessons: { ...done, "b-5": { complete: true, done: b5 } },
    }),
  });
  d.open("b-5");
  d.start();
  playUntil(d, at5("W4"));
  bottomRung(d);
  assert.deepEqual(d.state.eased, ["memory"]);
  playUntil(d, at5("Y1"));
  assert.equal(tierOf(d.state), "hinted", "Y1 opens on the plan");
  assert.equal(d.state.beat.eased, false);
  assert.deepEqual(d.state.progress["b-5"].easedSteps, {});
  assert.deepEqual(
    d.state.eased,
    ["memory"],
    "the ease waits for a step not yet done",
  );
});

// The 0-based index of the beat's first option of `kind`.
const optionOf = (d, kind) =>
  beatOf(d.state).options.findIndex((o) => o.kind === kind);
// A typed answer, sent: the effects it caused.
const typeIn = (d, text) => d.type(text).effects;

// spec: warmups.wrong-saved
test("warm-ups set the help: b-3 R1 typed wrong twice opens W1 GUIDED, with the line", () => {
  // was learn-flow:1121
  const d = fresh("b-3", { missed: ["plan-mode"] });
  assert.equal(stepOf(d.state).id, "R1");
  assert.equal(stepOf(d.state).skill, "plan-mode");
  typeIn(d, "tab");
  typeIn(d, "tab");
  assert.equal(d.state.beat.revealed, true);
  assert.deepEqual(d.state.eased, ["plan-mode"]);
  assert.ok(d.state.missed.includes("plan-mode"), "the warm-up mark stays too");
  playUntil(d, atStep("W1"));
  assert.equal(
    tierOf(d.state),
    "guided",
    "W1, HINTED on the plan, opens GUIDED",
  );
  assert.equal(d.state.beat.eased, true, 'with the "more help" line');
  assert.deepEqual(d.state.progress["b-3"].easedSteps, { W1: true });
  assert.deepEqual(d.state.eased, []);
  // Without the miss, W1 is HINTED.
  const right = fresh("b-3", { missed: ["plan-mode"] });
  playUntil(right, atStep("W1"));
  assert.equal(tierOf(right.state), "hinted");
  assert.equal(right.state.beat.eased, false);
});

// Ticket 187: a typing beat takes s as a letter of the answer; an empty
// line is what shows it there.
test("a typed warm-up: s types into the answer, and enter on an empty line shows it", () => {
  // was learn-flow:1144
  for (const [id, skill, lessons] of [["b-4", "exit", bareExit]]) {
    const d = driver({
      course: lessons,
      saved: save({ missed: [skill], lessons: finishedBefore(id, lessons) }),
    });
    d.start();
    assert.equal(beatOf(d.state).kind, "type", id);
    assert.deepEqual(beatOf(d.state).hints, [], id);
    typeIn(d, "nope");
    assert.deepEqual(
      d.state.beat.feedback,
      { kind: "wrong", hint: undefined },
      id,
    );
    // dropped: T-input s typed into the line, and backspace
    d.refused("answer.reveal");
    assert.equal(d.state.beat.revealed, false, id);
    typeIn(d, "");
    assert.equal(d.state.beat.revealed, true);
  }
});

// spec: warmups.wrong-saved
test("warm-ups set the help: b-2 R1 (start) shown with s opens W1 GUIDED, with the line", () => {
  // was learn-flow:1162
  const d = fresh("b-2", { missed: ["start"] });
  assert.equal(stepOf(d.state).id, "R1");
  assert.equal(stepOf(d.state).skill, "start");
  d.reveal();
  assert.equal(d.state.beat.revealed, true);
  assert.deepEqual(d.state.eased, ["start"]);
  playUntil(d, atStep("W1"));
  assert.equal(stepOf(d.state).skill, "start");
  assert.equal(tierOf(d.state), "guided");
  assert.equal(d.state.beat.eased, true);
  assert.deepEqual(d.state.eased, []);
});

// spec: warmups.right-clears
test("warm-ups set the help: a warm-up answered right the first time cancels a waiting ease", () => {
  // was learn-flow:1176
  const d = fresh("b-2", { eased: ["start"], missed: ["start"] });
  assert.equal(stepOf(d.state).id, "R1");
  const out = d.pick(optionOf(d, "right")).effects;
  assert.equal(d.state.beat.status, "done");
  assert.deepEqual(d.state.eased, []);
  assert.deepEqual(d.state.missed, []);
  assert.ok(out.some((e) => e.type === "save"));
  assert.deepEqual(snapshot(d.state).eased, []);
  playUntil(d, atStep("W1"));
  assert.equal(tierOf(d.state), "hinted", "W1 opens on the plan");
  assert.equal(d.state.beat.eased, false, "with no line");
  assert.deepEqual(d.state.progress["b-2"].easedSteps, {});
});

// spec: warmups.wrong-saved
test("warm-ups set the help: answered wrong and then right, the ease stays", () => {
  // was learn-flow:1191
  const d = fresh("b-2", { missed: ["start"] });
  d.pick(optionOf(d, "wrong"));
  assert.equal(d.state.beat.status, "waiting");
  d.pick(optionOf(d, "right"));
  assert.equal(d.state.beat.status, "done");
  assert.deepEqual(d.state.eased, ["start"]);
  playUntil(d, atStep("W1"));
  assert.equal(tierOf(d.state), "guided");
  assert.equal(d.state.beat.eased, true);
  // A typed warm-up too: b-5 R2 (context) wrong, then right.
  const t = fresh("b-5", { missed: ["context"] });
  assert.ok(atStep("R2")(t.state));
  typeIn(t, "/compact");
  assert.equal(t.state.beat.status, "waiting");
  typeIn(t, "/context");
  assert.equal(t.state.beat.status, "done");
  assert.deepEqual(t.state.eased, ["context"]);
});

// spec: warmups.wrong-saved
test("warm-ups set the help: every kind of miss adds the ease, an empty answer too", () => {
  // was learn-flow:1211
  // A wrong pick.
  const pickWrong = fresh("b-5", { missed: ["start"] });
  pickWrong.pick(optionOf(pickWrong, "wrong"));
  assert.deepEqual(pickWrong.state.eased, ["start"]);
  // An empty answer shows it.
  const empty = fresh("b-5", { missed: ["context"] });
  assert.ok(atStep("R2")(empty.state));
  typeIn(empty, "");
  assert.equal(empty.state.beat.revealed, true);
  assert.deepEqual(empty.state.eased, ["context"]);
  // One miss, one skill: a second wrong pick doesn't add it twice.
  const twice = fresh("b-3", { missed: ["status"] });
  assert.ok(atStep("R2")(twice.state));
  typeIn(twice, "q");
  typeIn(twice, "q");
  assert.deepEqual(twice.state.eased, ["status"]);
});

// The warm-up closure test (MISSABLE in learn-content.test.mjs) counts the
// questions in this test and the next as ones that can mark a skill missed.
test("s on a question with no wrong option still marks its skill for a warm-up, and on a guess it does nothing", () => {
  // was learn-flow:1232
  const d = at("W2");
  assert.deepEqual(
    beatOf(d.state).options.map((o) => o.kind),
    ["right", "stuck", "other"],
  );
  d.reveal();
  assert.equal(d.state.beat.answer.kind, "revealed");
  assert.deepEqual(d.state.missed, ["install"]);
  const guess = at("W4");
  assert.equal(beatOf(guess.state).kind, "predict");
  guess.refused("answer.reveal");
  assert.equal(guess.state.beat.answer, null);
  assert.deepEqual(guess.state.missed, []);
});

test("a decoy pick on a question with no right option still marks its skill for a warm-up, and s there does nothing", () => {
  // was learn-flow:1245
  // b-1 W6's answers question, its right option made a plain option.
  const noRight = b1Only.map((l) => {
    if (l.id !== "b-1") return l;
    const content = structuredClone(l.content);
    content.steps.find((x) => x.id === "W6").beats[1].options[0].kind =
      "option";
    return { ...l, content };
  });
  const openW6 = () => {
    const d = driver({
      course: noRight,
      saved: save({ lessons: { "b-1": { step: "W6", beat: 1 } } }),
    });
    d.open();
    assert.deepEqual(
      beatOf(d.state).options.map((o) => o.kind),
      ["option", "decoy", "decoy", "other"],
    );
    return d;
  };
  const shown = openW6();
  shown.refused("answer.reveal");
  assert.equal(shown.state.beat.answer, null);
  assert.deepEqual(shown.state.missed, []);
  const d = openW6();
  d.pick(1);
  assert.equal(d.state.beat.feedback.kind, "wrong");
  assert.deepEqual(d.state.missed, ["ask"]);
});

test("warm-ups set the help: misses inside a lesson only mark a warm-up, and a guess touches nothing", () => {
  // was learn-flow:1269
  const d = at("W5");
  d.pick(0);
  assert.equal(d.state.beat.feedback.kind, "wrong");
  assert.ok(d.state.missed.includes("status"));
  assert.deepEqual(d.state.eased, [], "a lesson's own question eases nothing");
  d.reveal();
  assert.deepEqual(d.state.eased, []);
  const guess = at("W4");
  guess.pick(0);
  assert.equal(guess.state.beat.status, "done");
  assert.deepEqual(guess.state.missed, []);
  assert.deepEqual(guess.state.eased, []);
  // In a lesson with warm-ups, a step's own wrong pick eases nothing either.
  const w = fresh("b-2");
  playUntil(w, atStep("W1"));
  assert.equal(beatOf(w.state).kind, "do");
  playUntil(
    w,
    (s) =>
      onCard(s) &&
      beatOf(s).ask &&
      beatOf(s).kind !== "predict" &&
      beatOf(s).options.some((o) => o.kind === "wrong"),
  );
  w.pick(optionOf(w, "wrong"));
  assert.ok(w.state.missed.length > 0);
  assert.deepEqual(w.state.eased, []);
});

// spec: warmups.wrong-saved
test("warm-ups set the help: the ease is saved at once", () => {
  // was learn-flow:1292
  const d = fresh("b-3", { missed: ["plan-mode"] });
  // dropped: T-input typing into the line alone saves nothing
  const miss = typeIn(d, "x");
  assert.equal(d.state.beat.typedWrong, 1);
  assert.ok(
    miss.some((e) => e.type === "save"),
    "the miss saves",
  );
  assert.deepEqual(snapshot(d.state).eased, ["plan-mode"]);
});

const backTo = (d, id) => {
  for (let i = 0; i < 20 && !atStep(id)(d.state); i++) d.back();
  assert.ok(atStep(id)(d.state));
};

test("warm-ups set the help: a missed warm-up asked again after a quit keeps its ease", () => {
  // was learn-flow:1314
  const d = fresh("b-2", { missed: ["start"] });
  d.reveal();
  assert.deepEqual(d.state.eased, ["start"]);
  const r = reopen(d);
  assert.equal(stepOf(r.state).id, "R1", "the warm-up is asked again");
  r.pick(optionOf(r, "right"));
  assert.deepEqual(r.state.eased, ["start"], "its answer was just shown");
  assert.ok(r.state.missed.includes("start"));
  playUntil(r, atStep("W1"));
  assert.equal(tierOf(r.state), "guided");
  assert.equal(r.state.beat.eased, true);
  // Quit before answering: the answer after the quit is the first one.
  const q = fresh("b-2", { missed: ["start"] });
  const rq = reopen(q);
  rq.pick(optionOf(rq, "right"));
  assert.deepEqual(rq.state.missed, []);
  assert.deepEqual(rq.state.eased, []);
});

test("warm-ups set the help: going back to a warm-up asks nothing new of the help", () => {
  // was learn-flow:1334
  // Right at once, then the bottom rung on W1: a right pick on the way back
  // keeps that ease.
  const d = fresh("b-2", { missed: ["start"] });
  d.pick(optionOf(d, "right"));
  playUntil(d, atStep("W1"));
  bottomRung(d);
  assert.deepEqual(d.state.eased, ["start"]);
  backTo(d, "R1");
  d.pick(optionOf(d, "right"));
  assert.deepEqual(d.state.eased, ["start"]);
  // Shown, its ease spent on W1: shown again on the way back, no second ease.
  const s = fresh("b-2", { missed: ["start"] });
  s.reveal();
  playUntil(s, atStep("W1"));
  assert.equal(s.state.beat.eased, true);
  assert.deepEqual(s.state.eased, []);
  backTo(s, "R1");
  s.reveal();
  assert.deepEqual(s.state.eased, []);
  assert.deepEqual(snapshot(s.state).eased, []);
  // The same after a quit, on a lesson's first play.
  const q = fresh("b-2", { missed: ["start"] });
  q.pick(optionOf(q, "right"));
  playUntil(q, atStep("W1"));
  const r = reopen(q);
  backTo(r, "R1");
  r.reveal();
  assert.deepEqual(r.state.eased, []);
  // A lesson played again asks its warm-up afresh: shown, its skill stays
  // missed, so the replay asks it again.
  const again = fresh("b-2", { missed: ["start"] });
  again.reveal();
  playUntil(again, (st) => st.phase === "complete");
  assert.deepEqual(again.state.eased, []);
  again.open("b-2");
  assert.equal(again.state.phase, "overview");
  again.start();
  assert.equal(stepOf(again.state).id, "R1");
  again.reveal();
  assert.deepEqual(again.state.eased, ["start"]);
});

// A Beginner lesson opened at its overview, with `lessons` saved.
const fromMap = (id, lessons = {}, top = {}) => {
  const d = driver({ course, saved: save({ ...top, lessons }) });
  d.open(id);
  assert.deepEqual([d.state.phase, d.state.lesson], ["overview", id]);
  return d;
};
const lessonOfId = (id) => course.find((l) => l.id === id);
// The learner's tiers for a lesson's own steps, warm-ups aside.
const ownTiers = (s, id) =>
  tiersOf(s, id).filter((_, i) => i >= s.progress[id].warm.length);

// spec: tiers.counting
test("fading counts only what this learner did: b-4 opened from the map with nothing done", () => {
  // was learn-flow:1392
  const steps = lessonOfId("b-4").content.steps;
  const d = fromMap("b-4");
  const tiers = ownTiers(d.state, "b-4");
  assert.equal(steps[0].skill, "start");
  assert.equal(
    steps[0].tier,
    "challenge",
    "W1 is CHALLENGE on the course plan",
  );
  assert.equal(
    tiers[0],
    "guided",
    "W1 opens GUIDED for a learner who never finished a start step",
  );
  assert.equal(tiers.at(-1), "challenge", "the Check stays CHALLENGE");
  d.start();
  playUntil(d, atStep("W1"));
  assert.equal(tierOf(d.state), "guided");
  // On the path, W1 keeps the plan.
  const path = fromMap("b-4", finishedBefore("b-4"));
  assert.equal(ownTiers(path.state, "b-4")[0], "challenge");
});

test("b-5 opens at CHALLENGE on starting Claude Code, and /init comes in a GUIDED step (Q10)", () => {
  // was learn-flow:1408
  const d = fromMap("b-5", finishedBefore("b-5"));
  const tiers = ownTiers(d.state, "b-5");
  assert.deepEqual(tiers.slice(0, 2), ["challenge", "guided"]);
  assert.deepEqual(
    ["guided", "hinted", "challenge"].map(
      (t) => tiers.filter((x) => x === t).length,
    ),
    [4, 6, 4],
  );
  d.start();
  playUntil(d, atStep("W1"));
  assert.equal(stepOf(d.state).skill, "start");
  assert.equal(tierOf(d.state), "challenge");
  playUntil(d, atStep("W2"));
  assert.equal(stepOf(d.state).skill, "memory");
  assert.equal(tierOf(d.state), "guided");
  assert.ok(
    stepOf(d.state).beats.some((b) =>
      b.lines.some((l) => l.key === "run" && l.text === "/init"),
    ),
  );
});

// Pins what a b-5 save from before the split does today, until the owner
// chooses (ticket 135): every old id is still a step, so nothing starts over.
test("b-5 saved before the W1 split: each saved step id now names the step after it", () => {
  // was learn-flow:1425
  const old = (p) =>
    driver({
      course,
      saved: save({
        lessons: { ...finishedBefore("b-5"), "b-5": { warm: [], ...p } },
      }),
    });
  // Old W6 (Check the new file), beat 1, with old W1 to W5 done.
  const d = old({
    step: "W6",
    beat: 1,
    done: ["W1", "W2", "W3", "W4", "W5"],
    easedSteps: { W5: true },
  });
  assert.ok(d.state.phase === "playing" && !d.state.beat, "a resume");
  assert.deepEqual(d.state.progress["b-5"].done, [
    "W1",
    "W2",
    "W3",
    "W4",
    "W5",
  ]);
  assert.deepEqual(d.state.progress["b-5"].easedSteps, { W5: true });
  d.open();
  assert.deepEqual(
    [stepOf(d.state).title, d.state.pos.beat],
    ["Ask for a new file", 1],
  );
  // Old W1 after /init: its beat is past the new W1, which opens on the clean-copy check.
  const w1 = old({ step: "W1", beat: 3 });
  w1.open();
  assert.deepEqual(
    [stepOf(w1.state).id, w1.state.pos.beat, beatOf(w1.state).verify.kind],
    ["W1", 0, "git-clean"],
  );
});

// spec: tiers.counting
test("fading counts only what this learner did: a lesson marked complete with nothing done counts for nothing", () => {
  // was learn-flow:1440
  // The seeded b-5 run: b-1 to b-4 complete, with no step done.
  const skipped = Object.fromEntries(
    ["b-1", "b-2", "b-3", "b-4"].map((id) => [
      id,
      { complete: true, done: [] },
    ]),
  );
  const d = fromMap("b-5", skipped);
  d.start();
  playUntil(d, atStep("W7"));
  assert.equal(stepOf(d.state).skill, "commit");
  assert.equal(stepOf(d.state).tier, "hinted");
  assert.equal(
    tierOf(d.state),
    "guided",
    "W7, HINTED on the plan, opens GUIDED",
  );
});

// spec: tiers.counting
test("fading counts only what this learner did: on the path every Beginner lesson keeps the course plan", () => {
  // was learn-flow:1451
  // The plan of the course played: its Beginner lessons are the reducer
  // fixtures, which may ask a skill fewer times than the shipped files that
  // the authored tiers count (a-4 W1's ask: the fixtures ask it in b-1 only).
  const contents = course.map((x) => x.content);
  for (const l of course.filter((x) => x.content)) {
    const plan = ruleTiers(contents, course.indexOf(l));
    const d = driver({
      course,
      saved: save({ lessons: finishedBefore(l.id) }),
    });
    assert.deepEqual(ownTiers(d.state, l.id), plan, l.id);
    // With nothing done, every lesson after the first gives more help somewhere,
    // and a capstone none.
    const none = driver({ course, saved: save() });
    const rank = (t) => ["guided", "hinted", "challenge"].indexOf(t);
    const skipped = ownTiers(none.state, l.id);
    const authored = plan;
    skipped.forEach((t, i) =>
      assert.ok(
        rank(t) <= rank(authored[i]),
        `${l.id} ${l.content.steps[i].id}`,
      ),
    );
    if (l.id === "b-1" || l.id.endsWith("capstone"))
      assert.deepEqual(skipped, authored, l.id);
    else assert.notDeepEqual(skipped, authored, l.id);
  }
});

// Ticket 194: a warm-up spends a question only on a skill the learner
// missed, so an unmet skill or the file order alone asks nothing.
// spec: warmups.first-missed
test("fading counts only what this learner did: a warm-up asks a missed skill, the first in the file, and none when nothing was missed", () => {
  // was learn-flow:1474
  // b-4's pool: R1 review-diff (b-3), R2 exit (b-1), R3 approve-edits (b-2),
  // R4 run-tests (b-3).
  assert.deepEqual(
    lessonOfId("b-4").content.warmup.map((w) => w.skill),
    ["review-diff", "exit", "approve-edits", "run-tests"],
  );
  const b12 = {
    "b-1": finished(lessonOfId("b-1")),
    "b-2": finished(lessonOfId("b-2")),
  };
  const d = fromMap("b-4", b12);
  assert.deepEqual(
    pickWarmups(d.state, "b-4"),
    [],
    "b-3 skipped: its unmet skills ask nothing",
  );
  d.start();
  assert.deepEqual(d.state.progress["b-4"].warm, []);
  assert.equal(stepOf(d.state).part, "Worked example");
  const m = fromMap("b-4", b12, { missed: ["approve-edits"] });
  assert.deepEqual(
    pickWarmups(m.state, "b-4"),
    ["R3"],
    "the missed skill alone",
  );
  m.start();
  assert.deepEqual(m.state.progress["b-4"].warm, ["R3"]);
  assert.equal(stepOf(m.state).id, "R3");
  // Two missed: the first in the file's order, not the first missed.
  assert.deepEqual(
    pickWarmups(
      fromMap("b-4", b12, { missed: ["run-tests", "exit"] }).state,
      "b-4",
    ),
    ["R2"],
  );
  // A missed skill the pool doesn't recall asks nothing either.
  assert.deepEqual(
    pickWarmups(fromMap("b-4", b12, { missed: ["plan-mode"] }).state, "b-4"),
    [],
  );
  // A learner who skipped everything, with nothing missed, starts on the lesson's own first step.
  const none = fromMap("b-4");
  none.start();
  assert.deepEqual(none.state.progress["b-4"].warm, []);
  assert.ok(onCard(none.state));
  assert.equal(stepOf(none.state).id, "W1");
});

// Ticket 178: a level index warm-up recalls a level, not a skill a step
// practises; like any other, it is asked only where its skill was missed.
// i-1's R1 commit (b-5), R2 when-to-use (index).
// spec: warmups.first-missed
test("fading counts only what this learner did: a level index warm-up is asked only where its skill was missed", () => {
  // was learn-flow:1504
  const lessons = course.map((l) =>
    l.id === "i-1"
      ? { ...l, content: parseLesson(DEMO_I1_INDEX, "i-1.md") }
      : l,
  );
  const at = (saved) => driver({ course: lessons, saved: save(saved) }).state;
  const before = finishedBefore("i-1", lessons);
  assert.deepEqual(
    pickWarmups(at({ lessons: before }), "i-1"),
    [],
    "every earlier lesson done",
  );
  assert.deepEqual(pickWarmups(at({}), "i-1"), [], "nothing done");
  assert.deepEqual(
    pickWarmups(at({ lessons: before, missed: ["when-to-use"] }), "i-1"),
    ["R2"],
    "its skill missed",
  );
  assert.deepEqual(
    pickWarmups(
      at({ lessons: before, missed: ["when-to-use", "commit"] }),
      "i-1",
    ),
    ["R1"],
    "the file order among the missed",
  );
});

// spec: warmups.at-most-one
test("fading counts only what this learner did: one warm-up however many skills were missed, and a beat's own skill counts", () => {
  // was learn-flow:1514
  // b-3's pool: R1 plan-mode, R2 status, R3 and R4 approve-edits, R5
  // plan-ask, R6 plan-revise.
  const pool = lessonOfId("b-3").content.warmup;
  assert.deepEqual(
    pool.map((w) => w.skill),
    [
      "plan-mode",
      "status",
      "approve-edits",
      "approve-edits",
      "plan-ask",
      "plan-revise",
    ],
  );
  const m = fromMap("b-3", finishedBefore("b-3"), {
    missed: ["plan-ask", "approve-edits", "status"],
  });
  assert.deepEqual(pickWarmups(m.state, "b-3"), ["R2"]);
  // A recall beat files under its own skill (R2 here recalls save-version
  // in a step tagged check): a miss on that skill picks it.
  const text = DEMO_B2.replace(
    "- accept: claude --version",
    "- skill: save-version\n- accept: claude --version",
  ).replace(
    "- skill: save-version\n- from: b-1",
    "- skill: check\n- from: b-1",
  );
  const o = driver({
    course: courseWith({ "b-2": text }),
    saved: save({
      missed: ["save-version"],
      lessons: { "b-1": finished(lessonOfId("b-1")) },
    }),
  });
  assert.deepEqual(pickWarmups(o.state, "b-2"), ["R2"]);
  const step = driver({
    course: courseWith({ "b-2": text }),
    saved: save({
      missed: ["check"],
      lessons: { "b-1": finished(lessonOfId("b-1")) },
    }),
  });
  assert.deepEqual(
    pickWarmups(step.state, "b-2"),
    [],
    "the step's skill is not the one it recalls",
  );
});

// spec: warmups.right-clears
test("fading counts only what this learner did: a warm-up right the first time puts its skill back on the plan", () => {
  // was learn-flow:1530
  const b3 = lessonOfId("b-3").content;
  const plan = b3.steps.filter((x) => x.skill === "plan-mode");
  const planTiers = (s) =>
    ownTiers(s, "b-3").filter((_, i) => b3.steps[i].skill === "plan-mode");
  // b-1 done, b-2 skipped, plan-mode missed there: plan-mode is unmet, so
  // W1 opens GUIDED, and the miss asks its warm-up.
  const d = fromMap(
    "b-3",
    { "b-1": finished(lessonOfId("b-1")) },
    { missed: ["plan-mode"] },
  );
  assert.equal(planTiers(d.state)[0], "guided");
  assert.notDeepEqual(
    planTiers(d.state),
    plan.map((x) => x.tier),
  );
  d.start();
  assert.equal(stepOf(d.state).id, "R1");
  assert.equal(stepOf(d.state).skill, "plan-mode");
  const out = typeIn(d, beatOf(d.state).accept[0]);
  assert.equal(d.state.beat.status, "done");
  assert.deepEqual(d.state.progress["b-3"].recalled, ["R1"]);
  assert.ok(out.some((e) => e.type === "save"));
  assert.deepEqual(
    planTiers(d.state),
    plan.map((x) => x.tier),
    "every plan-mode step is on the course plan",
  );
  // It survives a resume.
  const r = reopen(d);
  assert.deepEqual(r.state.progress["b-3"].recalled, ["R1"]);
  assert.deepEqual(
    planTiers(r.state),
    plan.map((x) => x.tier),
  );
  playUntil(r, atStep("W1"));
  assert.equal(tierOf(r.state), plan[0].tier);
  // A replay clears it, and, with the miss cleared, asks no warm-up.
  playUntil(r, (st) => st.phase === "complete");
  assert.deepEqual(r.state.progress["b-3"].recalled, ["R1"]);
  r.open("b-3");
  assert.equal(r.state.phase, "overview");
  r.start();
  assert.deepEqual(r.state.progress["b-3"].recalled, []);
  assert.deepEqual(r.state.progress["b-3"].warm, []);
  assert.equal(planTiers(r.state)[0], "guided");
});

// spec: warmups.first-missed
test("fading counts only what this learner did: a replay asks again the warm-up on a skill still missed", () => {
  // was learn-flow:1565
  // b-1 done, b-2 skipped, b-3 finished with R1 (plan-mode) recalled and
  // plan-mode missed again since. The replay clears the recall, and b-3's
  // own steps don't fade b-3's help, so plan-mode is unmet again, and the
  // miss asks R1.
  const d = fromMap(
    "b-3",
    {
      "b-1": finished(lessonOfId("b-1")),
      "b-3": { ...finished(lessonOfId("b-3")), recalled: ["R1"] },
    },
    { missed: ["plan-mode"] },
  );
  assert.equal(
    ownTiers(d.state, "b-3")[0],
    "hinted",
    "before the replay, the recall keeps W1 on the plan",
  );
  const preview = asStarted(d.state);
  const shown = {
    warm: pickWarmups(preview),
    tiers: ownTiers(preview, "b-3"),
  };
  d.start();
  assert.deepEqual(d.state.progress["b-3"].recalled, []);
  assert.deepEqual(d.state.progress["b-3"].warm, ["R1"]);
  assert.deepEqual(ownTiers(d.state, "b-3")[0], "guided");
  // What the intro shows is what the play starts with.
  assert.deepEqual(shown, {
    warm: d.state.progress["b-3"].warm,
    tiers: ownTiers(d.state, "b-3"),
  });
  // R1 right the first time puts W1 back on the plan.
  typeIn(d, beatOf(d.state).accept[0]);
  assert.equal(ownTiers(d.state, "b-3")[0], "hinted");
});

test("fading counts only what this learner did: a warm-up right after a miss, or asked again, adds nothing to recalled", () => {
  // was learn-flow:1585
  const d = fromMap(
    "b-3",
    { "b-1": finished(lessonOfId("b-1")) },
    { missed: ["plan-mode"] },
  );
  d.start();
  typeIn(d, "tab");
  typeIn(d, beatOf(d.state).accept[0]);
  assert.equal(d.state.beat.status, "done");
  assert.deepEqual(d.state.progress["b-3"].recalled, []);
  // Gone back to and answered right: still not the first answer.
  playUntil(d, atStep("W1"));
  backTo(d, "R1");
  typeIn(d, beatOf(d.state).accept[0]);
  assert.deepEqual(d.state.progress["b-3"].recalled, []);
  // A lesson's own question never joins it.
  const own = at("W5");
  own.pick(optionOf(own, "right"));
  assert.deepEqual(own.state.progress["b-1"].recalled, []);
});

test("fading counts only what this learner did: an old save loads with an empty recalled list, and unknown ids drop", () => {
  // was learn-flow:1603
  const old = driver({
    course,
    saved: save({
      lessons: { "b-3": { step: "R1", beat: 0, warm: ["R1", "R2"] } },
    }),
  });
  assert.deepEqual(old.state.progress["b-3"].recalled, []);
  assert.deepEqual(old.state.progress["b-4"].recalled, []);
  const gone = driver({
    course,
    saved: save({ lessons: { "b-3": { recalled: ["R1", "R9"] } } }),
  });
  assert.deepEqual(
    gone.state.progress["b-3"].recalled,
    ["R1"],
    "a warm-up no longer in the file is dropped",
  );
});

// Lesson 1 at its HINTED step-down (Y1), every step before it done.
const toY1 = (eased = []) => {
  const d = driver({
    saved: save({
      eased,
      lessons: {
        "b-1": {
          step: "W7",
          beat: 2,
          done: ["W1", "W2", "W3", "W4", "W5", "W6"],
        },
      },
    }),
  });
  d.open();
  d.send({ type: "git", paths: [] });
  d.cont();
  return d;
};
const b1Ids = course.find((l) => l.id === "b-1").content.steps.map((x) => x.id);
const tierAt = (tiers, id) => tiers[b1Ids.indexOf(id)];

// spec: tiers.more-help
test("g is one notch more help: on the HINTED level-up, every later step but the Check, and the climb keeps the rest", () => {
  // was learn-flow:1622
  const d = toY1();
  assert.equal(d.state.phase, "step-down");
  assert.equal(d.state.levelTo, "hinted");
  const before = tiersOf(d.state);
  assert.equal(tierAt(before, "Y4"), "challenge");
  d.moreHelp();
  assert.ok(onCard(d.state));
  assert.equal(d.state.progress["b-1"].moreHelpAt, "Y1");
  const after = tiersOf(d.state);
  for (const id of ["Y1", "Y2", "Y3"])
    assert.equal(tierAt(after, id), "guided", id);
  assert.equal(tierAt(after, "Y4"), "hinted", "one notch, not GUIDED");
  assert.equal(tierAt(after, "C"), "challenge", "the Check stays CHALLENGE");
  playUntil(d, (s) => s.phase === "complete");
  // "Your climb" draws the lesson as it was played.
  const played = tiersOf(d.state);
  for (const id of ["W1", "W2", "W3", "W4", "W5", "W6", "W7"])
    assert.equal(tierAt(played, id), tierAt(before, id), id);
  assert.deepEqual(mix(played), [10, 1, 1]);
});

// spec: tiers.more-help
test("g is one notch more help: g on the Check's level-up after it gives nothing and takes nothing back", () => {
  // was learn-flow:1642
  const d = toY1();
  d.moreHelp();
  // Y4 is HINTED now, so the Check is where the help goes down to CHALLENGE.
  playUntil(d, (s) => s.phase === "step-down");
  assert.equal(stepOf(d.state).id, "C");
  assert.equal(d.state.levelTo, "challenge");
  assert.equal(
    moreHelpGives(d.state),
    false,
    "the Check stays CHALLENGE, so g has nothing to give",
  );
  d.moreHelp();
  assert.ok(onCard(d.state), "g there goes on like enter");
  assert.equal(
    d.state.progress["b-1"].moreHelpAt,
    "Y1",
    "the first g still counts from Y1",
  );
  assert.equal(tierOf(d.state), "challenge");
  playUntil(d, (s) => s.phase === "complete");
  const played = tiersOf(d.state);
  for (const id of ["Y1", "Y2", "Y3"])
    assert.equal(tierAt(played, id), "guided", id);
  assert.equal(tierAt(played, "Y4"), "hinted");
  assert.deepEqual(mix(played), [10, 1, 1]);
});

// spec: tiers.more-help
test("g is one notch more help: a later level-up never moves it later", () => {
  // was learn-flow:1661
  // A save with g counted from Y1 and no level-up seen yet: Y4 levels up to
  // HINTED, which the g from Y1 gives it already.
  const d = driver({
    saved: save({
      lessons: {
        "b-1": { step: "Y3", beat: 0, moreHelpAt: "Y1", levels: [] },
      },
    }),
  });
  d.open();
  playUntil(d, (s) => s.phase === "step-down");
  assert.equal(stepOf(d.state).id, "Y4");
  assert.equal(moreHelpGives(d.state), false);
  d.moreHelp();
  assert.ok(onCard(d.state));
  assert.equal(d.state.progress["b-1"].moreHelpAt, "Y1");
  for (const id of ["Y1", "Y2", "Y3"])
    assert.equal(tierAt(tiersOf(d.state), id), "guided", id);
});

// spec: tiers.more-help
test("g is one notch more help: on the CHALLENGE level-up too, and it stays for the rest of the play", () => {
  // was learn-flow:1675
  const d = driver({
    saved: save({
      lessons: { "b-1": { step: "Y3", beat: 0, levels: ["hinted"] } },
    }),
  });
  d.open();
  playUntil(d, (s) => s.phase === "step-down");
  assert.equal(stepOf(d.state).id, "Y4");
  assert.equal(d.state.levelTo, "challenge");
  d.moreHelp();
  assert.ok(onCard(d.state));
  assert.equal(d.state.progress["b-1"].moreHelpAt, "Y4");
  assert.equal(tierOf(d.state), "hinted");
  assert.ok(
    d.state.progress["b-1"].levels.includes("challenge"),
    "the level-up shows once",
  );
  playUntil(d, (s) => stepOf(s)?.id === "C");
  assert.ok(onCard(d.state), "no second level-up at the Check");
  assert.equal(tierOf(d.state), "challenge");
});

// dropped: learn-flow:1691 (T-time), both keys on the level-up's first frame:
// DEFER_MS and the key buffer are the translator's.

// spec: tiers.more-help
test("g is one notch more help: an ease waiting on a step g covers waits for a later step", () => {
  // was learn-flow:1703
  // Y4 (ask) is CHALLENGE on the plan: the waiting ease would make it HINTED,
  // which g does already.
  const d = toY1(["ask"]);
  assert.equal(d.state.phase, "step-down");
  d.moreHelp();
  playUntil(d, (s) => stepOf(s)?.id === "Y4");
  assert.equal(tierOf(d.state), "hinted");
  assert.equal(d.state.beat.eased, false, 'no "more help" line: g gave it');
  assert.deepEqual(d.state.progress["b-1"].easedSteps, {});
  assert.deepEqual(d.state.eased, ["ask"], "the ease waits");
});

// spec: tiers.more-help
test("g is one notch more help: an ease that landed on the level-up step goes back to waiting", () => {
  // was learn-flow:1716
  // b-5: the memory ease makes Y1 GUIDED, so Y2 (snapshot, eased to HINTED)
  // is where the help stays lower.
  const d = midway("b-5", "W4", { eased: ["snapshot"] });
  bottomRung(d);
  playUntil(d, (s) => s.phase === "step-down");
  assert.equal(stepOf(d.state).id, "Y2");
  assert.equal(d.state.progress["b-5"].easedSteps.Y2, true);
  d.moreHelp();
  assert.equal(
    tierOf(d.state),
    "hinted",
    "g gives the same help the ease gave",
  );
  assert.equal(d.state.beat.eased, false);
  assert.equal(d.state.progress["b-5"].easedSteps.Y2, undefined);
  assert.deepEqual(d.state.eased, ["snapshot"]);
});

// spec: tiers.more-help
test("g is one notch more help: the level-up forecast agrees that a covered step takes no ease", () => {
  // was learn-flow:1731
  // Back at Y1 after g on Y4's level-up, with an ease waiting on Y4's skill.
  const d = driver({
    saved: save({
      eased: ["ask"],
      lessons: {
        "b-1": {
          step: "Y1",
          beat: 0,
          levels: ["hinted", "challenge"],
          moreHelpAt: "Y4",
        },
      },
    }),
  });
  d.open();
  assert.equal(stepOf(d.state).id, "Y1");
  // Y1 is HINTED after GUIDED W7, and nothing later gets less: Y4 is HINTED
  // with g, and the ease will not land there.
  assert.equal(stepNote(d.state), null);
  playUntil(d, (s) => stepOf(s)?.id === "Y4");
  assert.equal(tierOf(d.state), "hinted");
  assert.deepEqual(d.state.eased, ["ask"]);
});

// spec: tiers.more-help
test("g is one notch more help: playing the lesson again starts without it", () => {
  // was learn-flow:1744
  const done = {
    ...finished(course.find((l) => l.id === "b-1")),
    moreHelpAt: "Y1",
  };
  const d = driver({ saved: save({ lessons: { "b-1": done } }) });
  d.open("b-1");
  assert.equal(d.state.phase, "overview");
  assert.equal(
    tiersOf(asStarted(d.state))[b1Ids.indexOf("Y1")],
    "hinted",
    "the intro shows the plan",
  );
  d.start();
  assert.equal(d.state.progress["b-1"].moreHelpAt, null);
  assert.equal(tierAt(tiersOf(d.state), "Y4"), "challenge");
  // A step id the lesson no longer has is dropped as the app starts.
  const old = driver({
    saved: save({ lessons: { "b-1": { step: "Y2", moreHelpAt: "Y9" } } }),
  });
  assert.equal(old.state.progress["b-1"].moreHelpAt, null);
});
