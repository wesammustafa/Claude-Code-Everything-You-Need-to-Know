// The card's "Same skill as an earlier step" (ticket 348): step.doneBefore
// holds only where the step's skill was practised at an earlier step the
// app saw done, not one finished by I've done it or an answer alone.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  REDUCER_COURSE,
  course,
  driver,
  save,
  stepOf,
  threeLevels,
} from "./drive.mjs";
import { project } from "../src/project.ts";

const stepIds = (id) =>
  course.find((l) => l.id === id).content.steps.map((x) => x.id);

// The step on screen once lesson `id` resumes at `step`, with `lessons`
// saved besides.
function at(id, step, done, lessons = {}, lessonCourse = course) {
  const d = driver({
    course: lessonCourse,
    saved: save({ lessons: { ...lessons, [id]: { step, beat: 0, done } } }),
  });
  d.open(id);
  assert.equal(stepOf(d.state).id, step);
  return project(d.state).lesson.step;
}

// The fixture course's steps (drive.mjs), so editorial changes to the live
// course leave these alone.
test("b-1 W2: W1 finished only by I've done it practises nothing the app saw", () => {
  assert.equal(at("b-1", "W2", ["W1"]).doneBefore, false);
});

test("an earlier step of the same lesson the app checked counts; the step itself does not", () => {
  // b-1 Y1 saves the version again: W3 saved it under a check.
  const before = stepIds("b-1").slice(0, stepIds("b-1").indexOf("Y1"));
  assert.equal(at("b-1", "Y1", before).doneBefore, true);
  assert.equal(
    at(
      "b-1",
      "Y1",
      before.filter((x) => x !== "W3"),
    ).doneBefore,
    false,
  );
  // W3 revisited: only steps before it count.
  assert.equal(at("b-1", "W3", ["W1", "W2", "W3"]).doneBefore, false);
});

test("an earlier step done by answers and I've done it alone does not count", () => {
  // b-1 Y2 starts again: W4 was a guess and two self beats.
  const before = stepIds("b-1").slice(0, stepIds("b-1").indexOf("Y2"));
  assert.equal(at("b-1", "Y2", before).doneBefore, false);
});

test("an earlier lesson's step the app saw on the skill counts", () => {
  // b-4 W4's skill, snapshot, is b-2 W6's, which a check decides.
  const all = { "b-2": { complete: true, done: stepIds("b-2") } };
  assert.equal(at("b-4", "W4", ["W1", "W2", "W3"], all).doneBefore, true);
  const notW6 = {
    "b-2": { done: stepIds("b-2").filter((x) => x !== "W6" && x !== "Y4") },
  };
  assert.equal(at("b-4", "W4", ["W1", "W2", "W3"], notW6).doneBefore, false);
});

test("a capstone step takes every skill earlier lessons practise on a step the app sees", () => {
  const all = Object.fromEntries(
    ["b-1", "b-2", "b-3", "b-4", "b-5"].map((id) => [
      id,
      { complete: true, done: stepIds(id) },
    ]),
  );
  assert.equal(at("b-capstone", "T2", ["T1"], all).doneBefore, true);
  const none = Object.fromEntries(
    Object.keys(all).map((id) => [id, { complete: true, done: [] }]),
  );
  assert.equal(at("b-capstone", "T2", ["T1"], none).doneBefore, false);
});

// The fixture course with b-1 W3 opening on a choice and Y1 on a self beat,
// and the check beats of W3 and Y1 (save-version's only seen beats) shown
// only for "Check it".
const CHECK_BEAT = "- beat: do\n- verify: check 0\n";
const b1 = readFileSync(join(REDUCER_COURSE, "b-1.md"), "utf8");
assert.equal(b1.split(CHECK_BEAT).length, 3, "W3 and Y1 hold the check beats");
const branched = threeLevels({
  "b-1": b1
    .replace(
      "- skill: save-version\n- where: terminal\n" + CHECK_BEAT,
      "- skill: save-version\n- where: terminal\n- beat: ask\n- ask: Which way?\n- option: Check it\n- option: Skip it\n" +
        CHECK_BEAT.replace("\n- verify", "\n- when: W3.0=Check it\n- verify"),
    )
    .replace(
      "- skill: save-version\n- where: terminal\n" + CHECK_BEAT,
      '- skill: save-version\n- where: terminal\n- beat: do\n- verify: self\n- done-label: it\'s open\n- goal: "Open that folder."\n' +
        CHECK_BEAT.replace("\n- verify", "\n- when: W3.0=Check it\n- verify"),
    ),
});
const pick = (option) => ({ "W3.0": option });

test("a finished step whose seen beat its pick hid practises nothing the app saw", () => {
  const before = stepIds("b-1").slice(0, stepIds("b-1").indexOf("Y1"));
  const on = (option) => {
    const d = driver({
      course: branched,
      saved: save({
        lessons: {
          "b-1": { step: "Y1", beat: 0, done: before, answers: pick(option) },
        },
      }),
    });
    d.open("b-1");
    assert.equal(stepOf(d.state).id, "Y1");
    return project(d.state).lesson.step.doneBefore;
  };
  assert.equal(on("Check it"), true);
  assert.equal(on("Skip it"), false);
});

test("a capstone passes over a step whose seen beats the learner's pick hid", () => {
  const ids = ["b-1", "b-2", "b-3", "b-4", "b-5"];
  const lessons = (option) =>
    Object.fromEntries(
      ids.map((id) => {
        const l = branched.find((x) => x.id === id);
        const done = l.content.steps.map((x) => x.id);
        return [
          id,
          id === "b-1"
            ? { complete: true, done, answers: pick(option) }
            : { complete: true, done },
        ];
      }),
    );
  for (const option of ["Check it", "Skip it"])
    assert.equal(
      at("b-capstone", "T1", [], lessons(option), branched).doneBefore,
      true,
      option,
    );
  // Picked "Check it" but never finished W3 or Y1: save-version is owed.
  // (T1, as the capstone's own T1 practises save-version for T2.)
  const owed = lessons("Check it");
  owed["b-1"].done = owed["b-1"].done.filter((x) => x !== "W3" && x !== "Y1");
  assert.equal(at("b-capstone", "T1", [], owed, branched).doneBefore, false);
});
