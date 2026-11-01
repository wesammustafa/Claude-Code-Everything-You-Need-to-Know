// learn-flow's places (ticket 208): the saved places and results more than
// one of its ranges starts from, ported from learn-flow.test.mjs for the
// lesson-flow-*.test.mjs files. Where learn-flow pressed enter on a saved
// place, these open its lesson; where it asserted a view, these assert the
// engine's phase.
import assert from "node:assert/strict";
import {
  b1Item,
  course,
  courseWith,
  DEMO_B2,
  driver,
  finished,
  finishedBefore,
  save,
  snapshot,
  stepOf,
} from "./drive.mjs";

// Lesson 1 opened at a saved step; `extra` joins its saved place, and
// `extra.driver` the driver's options.
export const at = (step, extra = {}) => {
  const { driver: options = {}, ...place } = extra;
  const d = driver({
    saved: save({ lessons: { "b-1": { step, beat: 0, ...place } } }),
    ...options,
  });
  d.open();
  return d;
};
// Lesson 1 finished on the path, every step of it done.
export const b1Done = finished(course.find((l) => l.id === "b-1"));
export const missing = b1Item(null);
export const empty = b1Item("");
export const passed = b1Item("2.1.285 (Claude Code)\n");

// Lessons after the first: warm-ups, a third terminal, and fresh checks.
export const demo = courseWith({ "b-2": DEMO_B2 });
export const onB2 = (b2 = {}, top = {}) =>
  driver({
    course: demo,
    saved: save({ ...top, lessons: { "b-1": b1Done, "b-2": b2 } }),
  });
export const item = (pass, hint = "") => ({ index: 0, text: "x", pass, hint });

// A saved place in the whole course, opened.
export const open = (id, step, extra = {}, lessons = course) => {
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

// A Beginner lesson opened at a saved step, with every lesson before it done.
export const midway = (
  id,
  step,
  { eased = [], missed = [], beat = 0, ...extra } = {},
) => {
  const lessons = {
    ...finishedBefore(id),
    [id]: { step, beat, warm: [], ...extra },
  };
  const d = driver({ course, saved: save({ eased, missed, lessons }) });
  d.open();
  return d;
};

// A Beginner lesson at its overview, with every lesson before it done;
// lesson.start starts it with the warm-up on the first skill in `top.missed`
// its pool recalls, or with none (194).
export const fresh = (id, top = {}) => {
  const d = driver({
    course,
    saved: save({ ...top, lessons: finishedBefore(id) }),
  });
  assert.equal(d.state.phase, "overview");
  assert.equal(d.state.lesson, id);
  d.start();
  return d;
};
// Whether the card is on step `id` with its beat open.
export const atStep = (id) => (s) =>
  s.phase === "playing" && Boolean(s.beat) && stepOf(s).id === id;

// The same play after a quit: the save, resumed and opened again.
export const reopen = (d) => {
  const r = driver({ course, saved: snapshot(d.state) });
  assert.equal(r.state.phase, "playing");
  assert.equal(r.state.beat, null, "a saved place resumes with no beat open");
  r.open();
  return r;
};
