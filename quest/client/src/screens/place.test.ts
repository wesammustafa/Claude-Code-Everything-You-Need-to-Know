import { describe, expect, test } from "vitest";
import type { Snapshot } from "@quest/contract";
import {
  complete,
  fullCourse,
  overviewAt,
  playing,
  snapshotOf,
  stepDown,
} from "../../e2e/snapshots";
import { journeyPlace, nodeState } from "./place";
import { summaryOf } from "./lesson";

const on = (
  lesson: Snapshot["lesson"],
  next: string | null = fullCourse.next,
) => snapshotOf(lesson, { course: { ...fullCourse, next } });

describe("journeyPlace", () => {
  test("a Lesson in play, or at a Step-down, continues", () => {
    for (const lesson of [playing, stepDown]) {
      const place = journeyPlace(on(lesson));
      expect(place.current?.id).toBe("b-1");
      expect(place.label).toBe("Continue");
    }
  });

  test("a Lesson open on its overview starts", () => {
    const place = journeyPlace(on(overviewAt("b-4")));
    expect(place.current?.id).toBe("b-4");
    expect(place.label).toBe("Start");
  });

  test("after a complete Lesson, the course's next starts", () => {
    const place = journeyPlace(on(complete, "i-2"));
    expect(place.current?.id).toBe("i-2");
    expect(place.label).toBe("Start");
  });

  test("with nothing left, there is no current Lesson", () => {
    expect(journeyPlace(on(complete, null))).toEqual({
      current: null,
      label: null,
    });
  });
});

describe("nodeState", () => {
  const snapshot = on(overviewAt("b-4"));
  const { current } = journeyPlace(snapshot);
  const state = (id: string) => {
    const summary = summaryOf(snapshot, id);
    if (!summary) throw new Error(id);
    return nodeState(summary, current);
  };

  test("complete Lessons are done, the place is current, the rest to do", () => {
    expect(
      ["b-1", "b-2", "b-3", "b-4", "b-5", "b-capstone", "a-7"].map(state),
    ).toEqual(["done", "done", "done", "current", "to do", "to do", "to do"]);
  });

  test("current wins over done", () => {
    const summary = summaryOf(snapshot, "b-2");
    if (!summary) throw new Error("b-2");
    expect(nodeState(summary, summary)).toBe("current");
  });
});
