// A passed check beat in the save (ticket 314): reopening the app keeps it
// passed, with the run that passed it, instead of asking for Check again; a
// slow item a run left out shows as pending, not as missing.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  checkItems,
  checkResult,
  liveCourse as course,
  driver,
  finishedBefore,
  pending,
  sanitize,
  save,
  snapshot as toSave,
} from "./drive.mjs";
import { project } from "../src/project.ts";

const beatView = (d) => project(d.state).lesson.beat;
const at = (id, place, extra = {}) =>
  driver({
    course,
    saved: save({
      lessons: {
        ...finishedBefore(id, course),
        [id]: { warm: [], ...place, ...extra },
      },
    }),
  });
const checksAsked = (d) => d.effects.filter((e) => e.type === "check").length;
const lessonOf = (id) => course.find((l) => l.id === id);
// The first check beat of lesson `id` whose items include a slow one, or
// none: its place, with every step before it done.
function checkBeat(id, slow) {
  const l = lessonOf(id);
  const steps = l.content.steps;
  for (const [k, step] of steps.entries())
    for (const [beat, b] of step.beats.entries()) {
      if (b.verify.kind !== "check") continue;
      const items = b.verify.all ? l.items.map((_, i) => i) : b.verify.items;
      if (items.some((i) => (l.slow ?? []).includes(i)) !== slow) continue;
      return {
        place: {
          step: step.id,
          beat,
          done: steps.slice(0, k).map((x) => x.id),
        },
        items,
      };
    }
  throw new Error(`${id}: no check beat with slow ${String(slow)}`);
}
const PLAIN = checkBeat("b-1", false);
// A beat of b-1 that checks nothing.
const NOT_CHECK = (() => {
  for (const step of lessonOf("b-1").content.steps)
    for (const [beat, b] of step.beats.entries())
      if (b.verify.kind !== "check") return { step: step.id, beat };
  throw new Error("b-1: every beat checks");
})();
const SLOW = checkBeat("b-1", true);

test("a check beat that passed is saved with its run, and a reopen keeps it passed without running the Check again", () => {
  const d = at("b-1", PLAIN.place);
  d.open("b-1");
  const passing = checkItems(d.state, true);
  d.send(checkResult(pending(d, "check"), passing));
  assert.equal(beatView(d).status, "already");
  const saved = toSave(d.state);
  assert.deepEqual(saved.lessons["b-1"].passedCheck, {
    step: PLAIN.place.step,
    beat: PLAIN.place.beat,
    items: passing,
  });
  // Reopened from the save: passed, its lines met, and no Check asked for.
  const again = driver({ course, saved });
  again.open("b-1");
  assert.equal(beatView(again).status, "done");
  assert.deepEqual(
    beatView(again).verification,
    PLAIN.items.map((i) => ({ text: lessonOf("b-1").items[i], pass: true })),
  );
  assert.equal(checksAsked(again), 0);
});

test("moving on drops the saved pass; a pass saved for another place, or for a beat that is not a check, is dropped on load", () => {
  const d = at("b-1", PLAIN.place);
  d.open("b-1");
  d.send(checkResult(pending(d, "check"), checkItems(d.state, true)));
  assert.ok(d.state.progress["b-1"].passedCheck);
  d.cont();
  assert.notDeepEqual(
    [d.state.progress["b-1"].step, d.state.progress["b-1"].beat],
    [PLAIN.place.step, PLAIN.place.beat],
  );
  assert.equal(d.state.progress["b-1"].passedCheck, undefined);
  assert.equal(toSave(d.state).lessons["b-1"].passedCheck, undefined);
  const items = [{ index: 1, text: "x", pass: true, hint: "" }];
  // Saved at Y3 but placed at Y4: another place.
  const moved = at(
    "b-1",
    { step: "Y4", beat: 0 },
    { passedCheck: { step: "Y3", beat: 0, items } },
  );
  assert.equal(moved.state.progress["b-1"].passedCheck, undefined);
  // A beat that checks nothing.
  const notCheck = at("b-1", NOT_CHECK, {
    passedCheck: { ...NOT_CHECK, items },
  });
  assert.equal(notCheck.state.progress["b-1"].passedCheck, undefined);
});

test("a slow item the run left out is pending, waiting for Check again, not missing", () => {
  const d = at("b-1", SLOW.place);
  d.open("b-1");
  const slowAt = SLOW.items.find((i) => lessonOf("b-1").slow.includes(i));
  const items = checkItems(d.state, true).map((it) =>
    it.index === slowAt ? { ...it, pass: false, slow: true } : it,
  );
  d.send(checkResult(pending(d, "check"), items));
  const view = beatView(d);
  assert.equal(view.slowWait, true);
  const slow = lessonOf("b-1").items[slowAt];
  assert.deepEqual(
    view.verification.find((line) => line.text === slow),
    { text: slow, pass: false, pending: true },
  );
  assert.ok(
    view.verification
      .filter((line) => line.text !== slow)
      .every((line) => line.pass && !("pending" in line)),
  );
});

test("the save keeps a well-formed pass, capped, and drops a malformed one", () => {
  const items = [
    {
      index: 1,
      text: "t".repeat(400),
      pass: true,
      hint: "",
      slow: true,
      extra: 1,
    },
  ];
  const kept = sanitize({
    lessons: {
      "b-1": {
        step: "Y3",
        beat: 0,
        passedCheck: { step: "Y3", beat: 0, items },
      },
    },
  }).lessons["b-1"].passedCheck;
  assert.deepEqual(kept, {
    step: "Y3",
    beat: 0,
    items: [
      { index: 1, text: "t".repeat(300), pass: true, hint: "", slow: true },
    ],
  });
  for (const bad of [
    "yes",
    { step: "Y3", beat: -1, items },
    { step: "../x", beat: 0, items },
    { step: "Y3", beat: 0, items: "all" },
    { step: "Y3", beat: 0, items: [{ index: "1", text: "x", pass: true }] },
  ])
    assert.equal(
      sanitize({
        lessons: { "b-1": { step: "Y3", beat: 0, passedCheck: bad } },
      }).lessons["b-1"].passedCheck,
      undefined,
      JSON.stringify(bad),
    );
});
