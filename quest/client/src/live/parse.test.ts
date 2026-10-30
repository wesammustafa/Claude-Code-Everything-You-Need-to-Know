import type { QuestEvent } from "@quest/contract";
import { describe, expect, test } from "vitest";
import {
  readActionError,
  readActionResponse,
  readEventEnvelope,
  readHealth,
  readHeartbeat,
  readSnapshot,
} from "./parse";

const header = { id: "i.1", revision: 3, serverTime: 1000 };

// One well-formed event of every type the contract names.
const EVERY_EVENT: readonly QuestEvent[] = [
  { type: "check.started" },
  { type: "check.progress", n: 1, m: 3 },
  { type: "check.passed", firstTime: true },
  { type: "check.notYet", evidence: "No commit yet" },
  { type: "check.broken" },
  { type: "check.ended" },
  { type: "answer.right" },
  { type: "answer.wrong" },
  { type: "hint.shown", rung: 2 },
  { type: "warmup.recalled" },
  { type: "warmup.missed" },
  { type: "step.completed" },
  { type: "stepDown.reached", from: "guided", to: "hinted" },
  { type: "lesson.completed", capstone: false, firstTime: true },
  { type: "lesson.completed", badge: "b-1", capstone: true, firstTime: false },
  { type: "level.completed", level: "beginner" },
  { type: "course.completed" },
  { type: "work.changed" },
  { type: "help.offered" },
  { type: "notice", kind: "folder" },
];

describe("readEventEnvelope", () => {
  test.each(EVERY_EVENT.map((event) => [event.type, event] as const))(
    "reads a well-formed %s",
    (_type, event) => {
      expect(readEventEnvelope({ ...header, ...event })).toEqual({
        ...header,
        ...event,
      });
    },
  );

  test("copies only the contract's fields", () => {
    expect(
      readEventEnvelope({
        ...header,
        type: "check.passed",
        firstTime: false,
        extra: "<script>",
      }),
    ).toEqual({ ...header, type: "check.passed", firstTime: false });
  });

  test.each([
    ["not an object", "check.started"],
    ["an array", [header]],
    ["null", null],
    ["no id", { revision: 1, serverTime: 0, type: "check.started" }],
    ["an empty id", { ...header, id: "", type: "check.started" }],
    ["a numeric id", { ...header, id: 7, type: "check.started" }],
    ["no revision", { id: "i.1", serverTime: 0, type: "check.started" }],
    [
      "an infinite time",
      { ...header, serverTime: Infinity, type: "work.changed" },
    ],
    ["an unknown type", { ...header, type: "check.exploded" }],
    ["an inherited type name", { ...header, type: "toString" }],
    ["a missing field", { ...header, type: "check.passed" }],
    ["a field of the wrong type", { ...header, type: "hint.shown", rung: "1" }],
    [
      "an unknown Help tier",
      { ...header, type: "stepDown.reached", from: "guided", to: "expert" },
    ],
    [
      "an unknown Level",
      { ...header, type: "level.completed", level: "expert" },
    ],
    [
      "a Badge that is not text",
      {
        ...header,
        type: "lesson.completed",
        badge: 1,
        capstone: false,
        firstTime: true,
      },
    ],
  ])("refuses %s", (_name, value) => {
    expect(readEventEnvelope(value)).toBeNull();
  });
});

const milestone = {
  id: "i.4",
  revision: 4,
  serverTime: 10,
  type: "level.completed",
  level: "beginner",
};
const snapshot = { instance: "i", revision: 4, milestones: [milestone] };

describe("readSnapshot", () => {
  test("reads the header and keeps the rest", () => {
    expect(readSnapshot({ ...snapshot, course: { next: null } })).toEqual({
      ...snapshot,
      course: { next: null },
    });
  });

  test("keeps only well-formed milestones of a milestone type", () => {
    expect(
      readSnapshot({
        ...snapshot,
        milestones: [
          milestone,
          { ...header, type: "answer.right" },
          { id: "x" },
        ],
      })?.milestones,
    ).toEqual([milestone]);
  });

  test.each([
    ["not an object", 1],
    ["no instance", { revision: 1, milestones: [] }],
    ["an empty instance", { ...snapshot, instance: "" }],
    ["a negative revision", { ...snapshot, revision: -1 }],
    ["a fractional revision", { ...snapshot, revision: 1.5 }],
    ["no milestones", { instance: "i", revision: 1 }],
  ])("refuses %s", (_name, value) => {
    expect(readSnapshot(value)).toBeNull();
  });
});

describe("the other answers", () => {
  test("a heartbeat", () => {
    const beat = { serverTime: 5, instance: "i", revision: 2 };
    expect(readHeartbeat({ ...beat, extra: 1 })).toEqual(beat);
    expect(readHeartbeat({ ...beat, serverTime: "5" })).toBeNull();
    expect(readHeartbeat(null)).toBeNull();
  });

  test("an action response, whose revision is its snapshot's", () => {
    expect(readActionResponse({ revision: 4, snapshot })).toEqual({
      revision: 4,
      snapshot,
    });
    expect(readActionResponse({ revision: 3, snapshot })).toBeNull();
    expect(readActionResponse({ revision: 4 })).toBeNull();
  });

  test("an action error", () => {
    expect(readActionError({ error: "busy" })).toEqual({ error: "busy" });
    expect(readActionError({ error: "folder", reason: "is-copy" })).toEqual({
      error: "folder",
      reason: "is-copy",
    });
    expect(readActionError({ error: "folder", reason: "gone" })).toBeNull();
    expect(readActionError({ error: "stale" })).toBeNull();
    expect(readActionError("busy")).toBeNull();
  });

  test("a health answer", () => {
    expect(readHealth({ ok: true, instance: "i" })).toEqual({
      ok: true,
      instance: "i",
    });
    expect(readHealth({ ok: false, instance: "i" })).toBeNull();
    expect(readHealth({ ok: true })).toBeNull();
  });
});
