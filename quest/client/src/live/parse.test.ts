import type { QuestEvent } from "@quest/contract";
import { describe, expect, test } from "vitest";
import { readEventEnvelope } from "./parse";

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
