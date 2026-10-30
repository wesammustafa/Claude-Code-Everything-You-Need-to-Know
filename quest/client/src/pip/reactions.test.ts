import type { QuestEvent, QuestEventType } from "@quest/contract";
import { describe, expect, test } from "vitest";
import { envelope } from "../../test/events";
import type { PipReactionKind } from "../../pip/contract";
import {
  REACTION_RANK,
  reactionFor,
  type PipGazeTarget,
  type ReactionContext,
} from "./reactions";

const ready: ReactionContext = { glanceReady: true };

type Expected = {
  kind: PipReactionKind;
  intensity: number;
  gaze: PipGazeTarget | null;
} | null;

interface Row {
  event: QuestEvent;
  expected: Expected;
}

// Every row of the spec's Reaction map, keyed by event type so a new event
// type fails the type check until it has its rows here.
const MAP: Record<QuestEventType, readonly Row[]> = {
  "check.started": [{ event: { type: "check.started" }, expected: null }],
  "check.progress": [
    { event: { type: "check.progress", n: 1, m: 3 }, expected: null },
  ],
  "check.passed": [
    {
      event: { type: "check.passed", firstTime: true },
      expected: { kind: "success", intensity: 1, gaze: null },
    },
    {
      event: { type: "check.passed", firstTime: false },
      expected: { kind: "success", intensity: 0.2, gaze: null },
    },
  ],
  "check.notYet": [
    {
      event: { type: "check.notYet", evidence: "subtype: error" },
      expected: { kind: "retry", intensity: 0.5, gaze: null },
    },
  ],
  "check.broken": [
    {
      event: { type: "check.broken" },
      expected: { kind: "retry", intensity: 0.3, gaze: null },
    },
  ],
  "check.ended": [{ event: { type: "check.ended" }, expected: null }],
  "answer.right": [
    {
      event: { type: "answer.right" },
      expected: { kind: "success", intensity: 1, gaze: null },
    },
  ],
  "answer.wrong": [
    {
      event: { type: "answer.wrong" },
      expected: { kind: "retry", intensity: 0.4, gaze: null },
    },
  ],
  "hint.shown": [
    {
      event: { type: "hint.shown", rung: 1 },
      expected: { kind: "explaining", intensity: 1, gaze: "hint" },
    },
  ],
  "warmup.recalled": [
    {
      event: { type: "warmup.recalled" },
      expected: { kind: "success", intensity: 1, gaze: null },
    },
  ],
  "warmup.missed": [
    {
      event: { type: "warmup.missed" },
      expected: { kind: "retry", intensity: 0.3, gaze: null },
    },
  ],
  "step.completed": [
    {
      event: { type: "step.completed" },
      expected: { kind: "success", intensity: 1, gaze: null },
    },
  ],
  "stepDown.reached": [
    {
      event: { type: "stepDown.reached", from: "guided", to: "hinted" },
      expected: { kind: "curious", intensity: 1, gaze: "tiers" },
    },
  ],
  "lesson.completed": [
    {
      event: {
        type: "lesson.completed",
        badge: "First words",
        capstone: false,
        firstTime: true,
      },
      expected: { kind: "celebration", intensity: 0.7, gaze: null },
    },
    {
      event: { type: "lesson.completed", capstone: true, firstTime: true },
      expected: { kind: "celebration", intensity: 0.85, gaze: null },
    },
    {
      event: { type: "lesson.completed", capstone: false, firstTime: false },
      expected: { kind: "success", intensity: 1, gaze: null },
    },
    {
      event: { type: "lesson.completed", capstone: true, firstTime: false },
      expected: { kind: "success", intensity: 1, gaze: null },
    },
  ],
  "level.completed": [
    {
      event: { type: "level.completed", level: "beginner" },
      expected: { kind: "celebration", intensity: 0.9, gaze: null },
    },
  ],
  "course.completed": [
    {
      event: { type: "course.completed" },
      expected: { kind: "celebration", intensity: 1, gaze: null },
    },
  ],
  "work.changed": [
    {
      event: { type: "work.changed" },
      expected: { kind: "curious", intensity: 0.4, gaze: "work" },
    },
  ],
  "help.offered": [
    {
      event: { type: "help.offered" },
      expected: { kind: "explaining", intensity: 1, gaze: "hint" },
    },
  ],
  notice: [{ event: { type: "notice", kind: "folder" }, expected: null }],
};

const rows = Object.values(MAP).flat();

describe("reactionFor: the Reaction map", () => {
  test.each(rows.map((r) => [JSON.stringify(r.event), r] as const))(
    "%s",
    (_name, { event, expected }) => {
      const e = envelope(event);
      const got = reactionFor([e], ready);
      if (expected === null) {
        expect(got).toBeNull();
      } else {
        expect(got).toEqual({
          ...expected,
          eventId: e.id,
          eventType: event.type,
        });
      }
    },
  );

  test("notice makes no Reaction", () => {
    expect(
      reactionFor([envelope({ type: "notice", kind: "saved" })], ready),
    ).toBeNull();
  });

  test("check.passed on a step that already passed is a nod at 0.2", () => {
    expect(
      reactionFor(
        [envelope({ type: "check.passed", firstTime: false })],
        ready,
      ),
    ).toMatchObject({ kind: "success", intensity: 0.2 });
  });

  test("work.changed earns no glance while the 20 s window holds", () => {
    expect(
      reactionFor([envelope({ type: "work.changed" })], { glanceReady: false }),
    ).toBeNull();
  });

  test("a revision with no events, or none that react, earns none", () => {
    expect(reactionFor([], ready)).toBeNull();
    expect(
      reactionFor(
        [
          envelope({ type: "check.started" }),
          envelope({ type: "check.progress", n: 1, m: 2 }),
          envelope({ type: "notice", kind: "x" }),
        ],
        ready,
      ),
    ).toBeNull();
  });
});

describe("reactionFor: one Reaction per revision", () => {
  const byKind: Record<(typeof REACTION_RANK)[number], QuestEvent> = {
    celebration: { type: "level.completed", level: "advanced" },
    success: { type: "answer.right" },
    retry: { type: "check.notYet", evidence: "no commit yet" },
    explaining: { type: "hint.shown", rung: 2 },
    curious: { type: "work.changed" },
  };

  test("ranks Celebration, Success, Retry, Explaining, Curious", () => {
    expect(REACTION_RANK).toEqual([
      "celebration",
      "success",
      "retry",
      "explaining",
      "curious",
    ]);
    // Drop the winner each time: the next in the ranking wins, whatever the
    // order the events came in.
    for (let i = 0; i < REACTION_RANK.length; i++) {
      const kinds = REACTION_RANK.slice(i);
      const events = [...kinds].reverse().map((k) => envelope(byKind[k]));
      expect(reactionFor(events, ready)?.kind).toBe(REACTION_RANK[i]);
      expect(reactionFor([...events].reverse(), ready)?.kind).toBe(
        REACTION_RANK[i],
      );
    }
  });

  test("a Check's result outranks its Thinking events", () => {
    const got = reactionFor(
      [
        envelope({ type: "check.started" }),
        envelope({ type: "check.progress", n: 1, m: 1 }),
        envelope({ type: "check.notYet", evidence: "x" }),
      ],
      ready,
    );
    expect(got?.kind).toBe("retry");
  });

  test("within a kind the strongest plays, under its own event's ID", () => {
    const lesson = envelope({
      type: "lesson.completed",
      capstone: true,
      firstTime: true,
    });
    const level = envelope({ type: "level.completed", level: "advanced" });
    const course = envelope({ type: "course.completed" });
    const got = reactionFor([lesson, level, course], ready);
    expect(got).toMatchObject({
      kind: "celebration",
      intensity: 1,
      eventId: course.id,
    });

    const retry = reactionFor(
      [envelope({ type: "check.broken" }), envelope({ type: "answer.wrong" })],
      ready,
    );
    expect(retry?.intensity).toBe(0.4);
  });

  test("a step's first pass with its step.completed plays full Success", () => {
    const got = reactionFor(
      [
        envelope({ type: "check.passed", firstTime: true }),
        envelope({ type: "step.completed" }),
      ],
      ready,
    );
    expect(got).toMatchObject({ kind: "success", intensity: 1 });
  });
});
