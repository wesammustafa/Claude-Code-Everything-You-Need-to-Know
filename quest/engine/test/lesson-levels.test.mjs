// A course of three levels (ticket 82), driven by actions (ticket 208): each
// lesson's level from its PATH entry, lesson numbers within a level, a
// warm-up's source lesson and level, the step from one level to the next,
// and skill counts that carry across levels. The map, the welcome and every
// screen's text were the terminal's, and went with it in ticket 210.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEMO_B2,
  DEMO_I1,
  PATH,
  asksFolder,
  driver,
  finishedBefore,
  lessonNumber,
  levelOf,
  nextLessonOf,
  playUntil,
  root,
  save,
  stepOf,
  threeLevels,
  tierOf,
  where,
} from "./drive.mjs";

// Every lesson before `id` complete, with no step of it done.
const completeBefore = (course, id) =>
  Object.fromEntries(
    course
      .slice(
        0,
        course.findIndex((l) => l.id === id),
      )
      .map((l) => [l.id, { complete: true }]),
  );
// On a step card, not an overview or a resume.
const onCard = (s) => s.phase === "playing" && Boolean(s.beat);

// was learn-levels:27
test("every PATH entry carries its level, the folder of its page, and the level names are the guide's", () => {
  for (const p of PATH) assert.equal(p.level, p.page.split("/")[1], p.id);
  // dropped: T-render C.levels, the level names the screens show
  assert.deepEqual(
    PATH.map((p) => p.level),
    [
      ...Array(6).fill("beginner"),
      ...Array(9).fill("intermediate"),
      ...Array(8).fill("advanced"),
    ],
  );
});

// A made-up i-2: the demo lesson 2, whose warm-ups recall b-1.
const I2 = DEMO_B2.replace("lesson: b-2", "lesson: i-2").replace(
  "next: b-3",
  "next: i-3",
);

// was learn-levels:67
test("lesson numbers count within a level: i-2 is lesson 2, and its warm-ups from b-1 name Beginner", () => {
  const course = threeLevels({ "i-2": I2 });
  // status missed before, so R1 (from b-1) plays (194).
  const d = driver({
    course,
    saved: save({ missed: ["status"], lessons: completeBefore(course, "i-2") }),
  });
  assert.equal(d.state.phase, "overview");
  assert.equal(d.state.lesson, "i-2");
  // The level's first overview in the app asks where to practise (ticket
  // 86): this practice copy.
  assert.ok(asksFolder(d.state));
  assert.equal(d.folderChoose("intermediate", "practice-copy").changed, true);
  assert.ok(!asksFolder(d.state));
  // dropped: T-render "Start lesson 2" on the overview at 60x20 and 80x24
  assert.equal(lessonNumber(d.state), 2);
  d.start();
  const step = stepOf(d.state);
  assert.equal(step.part, "Warm-up");
  // dropped: T-render "Warm-up from Beginner lesson 1"; the facts behind it
  assert.equal(step.from, "b-1");
  assert.equal(lessonNumber(d.state, step.from), 1);
  assert.equal(levelOf(d.state, step.from), "beginner");
  assert.notEqual(levelOf(d.state, step.from), levelOf(d.state));
  playUntil(d, (s) => s.phase === "complete");
  // dropped: T-render "Lesson 2 done! You practised:"
  assert.deepEqual([d.state.lesson, lessonNumber(d.state)], ["i-2", 2]);
  // dropped: T-render "start I3" on the next screen; the lesson it opens
  assert.equal(nextLessonOf(d.state)?.id, "i-3");
});

// was learn-levels:85
test('a warm-up from its own level names no level: b-2\'s from b-1 says "Warm-up from lesson 1"', () => {
  const course = threeLevels();
  const d = driver({
    course,
    saved: save({ missed: ["start"], lessons: completeBefore(course, "b-2") }),
  });
  d.start();
  const step = stepOf(d.state);
  assert.equal(step.part, "Warm-up");
  // dropped: T-render "Warm-up from lesson 1"; the facts behind it
  assert.equal(step.from, "b-1");
  assert.equal(lessonNumber(d.state, step.from), 1);
  assert.equal(levelOf(d.state, step.from), levelOf(d.state));
});

// The Beginner capstone, with i-1 as its next lesson.
const CAPSTONE_TO_I1 = readFileSync(
  join(root, "learn", "lessons", "b-capstone.md"),
  "utf8",
).replace(/^---\n/, "---\nnext: i-1\n");

// Help fades within a level (ticket 85): a level's first lesson may start
// with more help than the capstone before it.
// was learn-levels:310
test("the next screen from b-capstone to i-1 names i-1 and says nothing of a notch harder, nor draws its bar, though i-1 has a lesson file", () => {
  const course = threeLevels({ "b-capstone": CAPSTONE_TO_I1, "i-1": DEMO_I1 });
  const d = driver({
    course,
    saved: save({ lessons: finishedBefore("b-capstone", course) }),
  });
  playUntil(d, (s) => s.phase === "complete" && s.lesson === "b-capstone");
  const up = nextLessonOf(d.state);
  assert.equal(up?.id, "i-1");
  // dropped: T-render the next screen's rows, "A notch harder" and its bar.
  // The facts render.mjs decides them on: i-1 has a lesson file, and it is
  // in another level, so neither shows.
  assert.ok(up.content);
  assert.notEqual(levelOf(d.state, up.id), levelOf(d.state));
  d.next();
  assert.deepEqual([d.state.phase, d.state.lesson], ["overview", "i-1"]);
});

// was learn-levels:352
test("skill counts carry across levels: after Beginner, i-1 opens GUIDED on its new skill and commit comes back at CHALLENGE", () => {
  const course = threeLevels({ "i-1": DEMO_I1 });
  const d = driver({
    course,
    saved: save({ lessons: finishedBefore("i-1", course) }),
  });
  assert.deepEqual([d.state.phase, d.state.lesson], ["overview", "i-1"]);
  playUntil(d, (s) => onCard(s) && stepOf(s).part !== "Warm-up");
  assert.deepEqual([stepOf(d.state).id, tierOf(d.state)], ["W1", "guided"]);
  playUntil(d, (s) => onCard(s) && stepOf(s).id === "W2");
  assert.equal(where(d.state).step, "W2");
  assert.equal(tierOf(d.state), "challenge");
});
