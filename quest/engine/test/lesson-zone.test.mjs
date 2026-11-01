// Scripted learners played through the real Beginner lessons with the
// engine, by actions: whatever they do, the help each step gets stays where
// the design puts it, and the card claims only the help it gives.
import assert from "node:assert/strict";
import { test } from "vitest";
import {
  IDLE_MS,
  NEW_COPY,
  TIERS,
  course,
  driver,
  failCheck,
  hintAvailable,
  nextLessonOf,
  playUntil,
  ruleTiers,
  showsMoreHelp,
  stepOf,
  stepsOf,
  tierOf,
  tiersOf,
} from "./drive.mjs";

const contents = course.map((l) => l.content);
const rank = (t) => TIERS.indexOf(t);
// The course plan for the steps of a lesson as they are played: a warm-up
// is always CHALLENGE, every other step gets what `ruleTiers` gives it with
// no third argument.
function plan(s) {
  const idx = course.findIndex((l) => l.id === s.lesson);
  return [
    ...s.progress[s.lesson].warm.map(() => "challenge"),
    ...ruleTiers(contents, idx),
  ];
}
const place = (s) => `${s.lesson} ${stepOf(s).id}`;
// A step card, or the step-down offered over it.
const onStep = (s) =>
  Boolean(s.beat) && (s.phase === "playing" || s.phase === "step-down");
const onCard = (s) => Boolean(s.beat) && s.phase === "playing";

// The driver, with `look(state)` after every input the learner causes,
// whichever helper sends it.
const watched = (d, look) =>
  new Proxy(d, {
    get(target, key) {
      const v = Reflect.get(target, key);
      if (typeof v !== "function") return v;
      return (...args) => {
        const r = v(...args);
        look(target.state);
        return r;
      };
    },
  });

// Plays on as playUntil's learner, one move at a time, calling `atBeat(d)`
// once as each beat opens, until `stop(state)` holds.
function play(d, stop, atBeat) {
  const seen = new Set();
  for (let n = 0; !stop(d.state); n++) {
    if (n > 20_000)
      throw new Error(
        `play: stuck at ${d.state.phase} ${d.state.lesson} ${d.state.beat ? stepOf(d.state).id : ""}`,
      );
    const s = d.state;
    const at = onCard(s) && `${place(s)}.${s.pos.beat}`;
    if (at && !seen.has(at)) {
      seen.add(at);
      atBeat(d);
      if (stop(d.state)) return;
    }
    playUntil(d, (x) => x !== s || stop(x));
  }
}
// Climbs to the exact command on the beat on the card, where it has one: at
// CHALLENGE, hints open after a try or two quiet minutes.
function exactCommand(d) {
  if (["done", "already"].includes(d.state.beat.status)) return false;
  failCheck(d);
  if (!hintAvailable(d.state)) d.tick(IDLE_MS + 1_000);
  for (let i = 0; i < 8 && hintAvailable(d.state) && !d.state.beat.confirm; i++)
    d.hint();
  if (!d.state.beat.confirm) return false;
  d.exact(true);
  return true;
}

// The learners. Each starts afresh and calls `look` after every input.
// The end of the last lesson with a lesson file, or the end of a lesson
// with no next lesson to open, where the old play went to the map.
const last = course.filter((l) => l.content).at(-1).id;
const finale = (s) =>
  s.phase === "complete" && (s.lesson === last || !nextLessonOf(s));
// A learner who plays every lesson in order: one that runs in a new copy
// (a-5) has its folder, as the learner gives it at its overview.
const inOrderDriver = () =>
  driver({
    course,
    saved: {
      format: 1,
      folders: Object.fromEntries(
        course.filter((l) => l.newCopy).map((l) => [l.id, NEW_COPY]),
      ),
    },
  });
// Every lesson in order, needing no help.
function inOrder(look) {
  playUntil(watched(inOrderDriver(), look), finale);
}
// Every lesson in order, climbing to the exact command on every beat of a
// step that isn't GUIDED. Returns the steps where it was shown.
function exactEverywhere(look) {
  const taken = [];
  play(watched(inOrderDriver(), look), finale, (d) => {
    if (tierOf(d.state) !== "guided" && exactCommand(d))
      taken.push(place(d.state));
  });
  return taken;
}
// A lesson opened with nothing done, played to its end. `first(d)` plays
// the first warm-up, where given; it plays only on a skill in `missed`, the
// skills missed before (194).
function fromMap(id, look, first, missed = []) {
  const d = watched(
    driver({
      course,
      saved: { format: 1, welcomed: true, missed, lessons: {} },
    }),
    look,
  );
  // dropped: T-cursor the map's m, down and enter; lesson.open does it
  d.open(id);
  assert.deepEqual([d.state.phase, d.state.lesson], ["overview", id]);
  d.start();
  first?.(d);
  playUntil(d, (s) => s.lesson === id && s.phase === "complete");
}
const b4FromMap = (look) => fromMap("b-4", look);
// b-2 opened, R1 (start) answered right the first time.
const b2Recalled = (look) =>
  fromMap(
    "b-2",
    look,
    (d) => {
      assert.deepEqual(
        [stepOf(d.state).id, stepOf(d.state).skill],
        ["R1", "start"],
      );
    },
    ["start"],
  );
// b-3 opened, R1 (plan-mode) typed wrong twice: the ease waits past W1,
// GUIDED on a first meeting, for Y1.
const b3Missed = (look) =>
  fromMap(
    "b-3",
    look,
    (d) => {
      assert.deepEqual(
        [stepOf(d.state).id, stepOf(d.state).skill],
        ["R1", "plan-mode"],
      );
      // dropped: T-input the typed buffer, key by key; answer.type sends it
      for (const word of ["tab", "tab"]) d.type(word);
      assert.deepEqual(d.state.eased, ["plan-mode"]);
    },
    ["plan-mode"],
  );

// was learn-zone:118
// spec: tiers.rule
test("in order, with no hints: every tier equals the course plan", () => {
  const met = new Set();
  inOrder((s) => {
    if (!onStep(s)) return;
    assert.deepEqual(tiersOf(s), plan(s), place(s));
    met.add(place(s));
  });
  const played = course.slice(0, course.findIndex((l) => l.id === last) + 1);
  for (const l of played.filter((x) => x.content))
    for (const step of l.content.steps)
      assert.ok(met.has(`${l.id} ${step.id}`), `${l.id} ${step.id} was met`);
});

// was learn-zone:129
// spec: tiers.less-help
test("in order, taking the exact command on every non-guided step: no step ever gets less help than the plan", () => {
  let easier = 0;
  const taken = exactEverywhere((s) => {
    if (!onStep(s)) return;
    const tiers = tiersOf(s);
    plan(s).forEach((t, i) => {
      assert.ok(
        rank(tiers[i]) <= rank(t),
        `${s.lesson} ${stepsOf(s)[i].id} at ${place(s)}: ${tiers[i]}, the plan says ${t}`,
      );
      if (rank(tiers[i]) < rank(t)) easier += 1;
    });
  });
  assert.ok(
    taken.length > 20,
    `the exact command was shown ${taken.length} times`,
  );
  assert.ok(easier > 0, "some step got more help than the plan");
});

// was learn-zone:143
// spec: tiers.rule
test("b-4 opened from the map with nothing done: each step gets a first meeting's tier, and the Check is CHALLENGE", () => {
  // dropped: T-cursor in fromMap, the map's m, down and enter
  // A first meeting: a worked example is GUIDED, a turn HINTED, the last turn
  // the app checks CHALLENGE. No step is done, and b-4's warm-ups recall no
  // skill b-4 uses, so no b-4 skill was met.
  const first = {
    W1: "guided",
    W2: "guided",
    W3: "guided",
    W4: "guided",
    W5: "guided",
    W6: "guided",
    W7: "guided",
    Y1: "hinted",
    Y2: "hinted",
    Y3: "hinted",
    Y4: "hinted",
    Y5: "challenge",
    C: "challenge",
  };
  const idx = course.findIndex((l) => l.id === "b-4");
  assert.deepEqual(
    contents[idx].steps.map((x) => x.id),
    Object.keys(first),
  );
  assert.deepEqual(
    ruleTiers(contents, idx, () => false),
    Object.values(first),
    "what ruleTiers gives a first meeting",
  );
  const met = new Set();
  b4FromMap((s) => {
    if (!onStep(s)) return;
    assert.equal(s.lesson, "b-4");
    const tiers = tiersOf(s);
    stepsOf(s).forEach((step, i) =>
      assert.equal(
        tiers[i],
        step.part === "Warm-up" ? "challenge" : first[step.id],
        `${step.id} at ${place(s)}`,
      ),
    );
    met.add(stepOf(s).id);
  });
  for (const id of Object.keys(first)) assert.ok(met.has(id), `${id} was met`);
});

// was learn-zone:162
// spec: warmups.first-missed
// spec: tiers.eases
test("opened from the map with nothing done: a warm-up right the first time puts its skill on the plan, one missed waits past a GUIDED step", () => {
  // dropped: T-cursor in fromMap, the map's m, down and enter; T-input in b3Missed, the typed buffer key by key
  // b-2: R1 recalls start, so W1 gets the plan; every other step a first meeting.
  const b2 = course.findIndex((l) => l.id === "b-2");
  const recalled = ruleTiers(contents, b2, (k, skill) => skill === "start");
  assert.deepEqual(
    [
      recalled[0],
      ruleTiers(contents, b2)[0],
      ruleTiers(contents, b2, () => false)[0],
    ],
    ["hinted", "hinted", "guided"],
    "W1 (start)",
  );
  const met = new Set();
  b2Recalled((s) => {
    if (!onStep(s) || stepOf(s).part === "Warm-up") return;
    assert.deepEqual(
      tiersOf(s).slice(s.progress[s.lesson].warm.length),
      recalled,
      place(s),
    );
    met.add(stepOf(s).id);
  });
  assert.ok(met.has("W1"));
  // b-3: plan-mode was missed, so W1 stays GUIDED with no line, and Y1, HINTED
  // on a first meeting, takes the ease. The line opens a step's first beat.
  const seen = { W1: new Set(), Y1: new Set() };
  b3Missed((s) => {
    if (onCard(s) && s.pos.beat === 0 && seen[stepOf(s).id])
      seen[stepOf(s).id].add(
        `${tierOf(s)} ${showsMoreHelp(s) ? "with" : "without"} the line`,
      );
  });
  assert.deepEqual(
    Object.fromEntries(Object.entries(seen).map(([id, x]) => [id, [...x]])),
    { W1: ["guided without the line"], Y1: ["guided with the line"] },
  );
});

// was learn-zone:183
// spec: tiers.more-help
test('throughout every run: a card with the "more help" line gives one tier more help than it would without the ease', () => {
  // dropped: T-cursor in fromMap, the map's m, down and enter; T-input in b3Missed, the typed buffer key by key
  const shown = new Set();
  const look = (s) => {
    if (!onCard(s) || !showsMoreHelp(s)) return;
    const p = s.progress[s.lesson];
    const { [stepOf(s).id]: _, ...others } = p.easedSteps;
    const without = tiersOf({
      ...s,
      progress: { ...s.progress, [s.lesson]: { ...p, easedSteps: others } },
    })[s.pos.step];
    assert.equal(
      rank(tierOf(s)),
      rank(without) - 1,
      `${place(s)}: ${tierOf(s)} with the ease, ${without} without`,
    );
    shown.add(place(s));
  };
  inOrder(look);
  b4FromMap(look);
  b2Recalled(look);
  assert.equal(
    shown.size,
    0,
    `a learner who needed no help saw the line on ${[...shown].join(", ")}`,
  );
  b3Missed(look);
  assert.ok(shown.has("b-3 Y1"), "the missed warm-up's ease landed on Y1");
  exactEverywhere(look);
  assert.ok(shown.size > 5, `the line showed on ${[...shown].join(", ")}`);
});
