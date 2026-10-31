// The Step-down screen (ticket 248, AC1): the real Lesson 1 driven to its
// first Step-down shows it once per tier, as the engine decides, and its two
// answers change nothing earned.
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { PlayingLesson, StepDownLesson } from "@quest/contract";
import { initialState, project, reduce } from "@quest/engine";
import { FOLDER_KEYS, loadCourse } from "@quest/engine/course";

const course = loadCourse(
  fileURLToPath(new URL("../../../practice-template", import.meta.url)),
);
const folders = Object.fromEntries(
  [...FOLDER_KEYS].map((key) => [key, `/home/sam/work-${key}`]),
);
const MILESTONES = ["lesson.completed", "level.completed", "course.completed"];

type State = ReturnType<typeof initialState>;
type Input = Parameters<typeof reduce>[1];

/** Lesson 1 at its last Guided step, W6, with W1 to W5 done. */
function atW6() {
  let state: State = initialState({
    course,
    saved: {
      folders,
      welcomed: true,
      lessons: {
        "b-1": { step: "W6", beat: 0, done: ["W1", "W2", "W3", "W4", "W5"] },
      },
    },
    facts: { root: "/copy" },
  });
  const events: string[] = [];
  const send = (input: Input) => {
    const r = reduce(state, input);
    state = r.state;
    events.push(...r.events.map((e) => e.type));
  };
  send({ type: "lesson.open", lesson: "b-1" });
  return {
    get state() {
      return state;
    },
    events,
    send,
    lesson: () => project(state).lesson,
    /** The phase, and the step on screen with its tier while playing. */
    step: () => {
      const lesson = project(state).lesson as PlayingLesson;
      return [lesson.phase, lesson.step?.id, lesson.step?.tier];
    },
  };
}
type Driver = ReturnType<typeof atW6>;

/** W6 marked done goes on to the Step-down from Guided to Hinted, before Y1. */
const toStepDown = (): Driver => {
  const d = atW6();
  expect(d.step()).toEqual(["playing", "W6", "guided"]);
  d.send({ type: "step.markDone" });
  return d;
};

// What a Learner has earned: every Lesson's complete (its Badge), its done
// steps and its saved Mastery. Only `levels` and `moreHelpAt` may move.
const earned = (d: Driver) =>
  Object.fromEntries(
    Object.entries(d.state.progress).map(([id, p]) => [
      id,
      { complete: p.complete, done: p.done, help: p.help ?? null },
    ]),
  );

describe("Lesson 1's first Step-down", () => {
  test("is the projected phase, from Guided to Hinted, reached once", () => {
    const d = toStepDown();
    const lesson = d.lesson() as StepDownLesson;
    expect([lesson.phase, lesson.from, lesson.to]).toEqual([
      "step-down",
      "guided",
      "hinted",
    ]);
    expect(d.events.filter((t) => t === "stepDown.reached")).toHaveLength(1);
  });

  test.each(["stepDown.accept", "stepDown.moreHelp"] as const)(
    "%s goes on to Y1, changes nothing earned and marks no milestone",
    (type) => {
      const d = toStepDown();
      const before = earned(d);
      const seen = d.events.length;
      d.send({ type });
      expect(d.step()).toEqual([
        "playing",
        "Y1",
        type === "stepDown.accept" ? "hinted" : "guided",
      ]);
      expect(earned(d)).toEqual(before);
      expect(
        d.events.slice(seen).filter((t) => MILESTONES.includes(t)),
      ).toEqual([]);
    },
  );

  test("accepted, it is not shown again on the way back and on", () => {
    const d = toStepDown();
    d.send({ type: "stepDown.accept" });
    d.send({ type: "step.back" });
    expect(d.step()).toEqual(["playing", "W6", "guided"]);
    d.send({ type: "step.markDone" });
    expect(d.step()).toEqual(["playing", "Y1", "hinted"]);
    expect(d.events.filter((t) => t === "stepDown.reached")).toHaveLength(1);
  });

  // Back is no answer, so the Step-down shows again, and each showing is a
  // new reach: Pip is Curious again (the engine's moments.ts, rule 10).
  test("after Back it shows again, as a new reach", () => {
    const d = toStepDown();
    d.send({ type: "stepDown.back" });
    expect(d.step()).toEqual(["playing", "W6", "guided"]);
    expect(d.state.progress["b-1"]?.levels).toEqual([]);
    d.send({ type: "step.markDone" });
    expect(d.lesson().phase).toBe("step-down");
    expect(d.events.filter((t) => t === "stepDown.reached")).toHaveLength(2);
  });

  test("a restart forgets the accepted tiers, so a replay shows it again", () => {
    const d = toStepDown();
    d.send({ type: "stepDown.accept" });
    expect(d.state.progress["b-1"]?.levels).toContain("hinted");
    d.send({ type: "lesson.restart", lesson: "b-1" });
    expect(d.lesson().phase).toBe("overview");
    expect(d.state.progress["b-1"]).toMatchObject({
      levels: [],
      moreHelpAt: null,
      done: [],
      complete: false,
    });
  });
});
