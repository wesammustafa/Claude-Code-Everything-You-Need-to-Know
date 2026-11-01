import { describe, expect, test } from "vitest";
import type { PlayingLesson } from "@quest/contract";
import {
  fullCourse,
  overviewAt,
  playing,
  snapshotOf,
} from "../../e2e/snapshots";
import { lessonPageOf } from "./lesson-page";

const pageOf = (id: string) =>
  fullCourse.levels
    .flatMap((level) => level.lessons)
    .find((lesson) => lesson.id === id)?.page;

function playingAt(
  id: string,
  warmup: { from: string; explainer: boolean } | null,
): PlayingLesson {
  if (!playing.step) throw new Error("playing has no step");
  return { ...playing, id, step: { ...playing.step, warmup } };
}

describe("lessonPageOf", () => {
  test("a step of b-3 opens b-3's page", () => {
    const snapshot = snapshotOf(playingAt("b-3", null), { course: fullCourse });
    expect(lessonPageOf(snapshot)).toEqual({ page: pageOf("b-3") });
  });

  test("b-2's warm-up from b-1 opens b-1's page", () => {
    const snapshot = snapshotOf(
      playingAt("b-2", { from: "b-1", explainer: true }),
      { course: fullCourse },
    );
    expect(lessonPageOf(snapshot)).toEqual({
      page: "docs/beginner/01-install-and-look-around.md",
    });
  });

  test("a Level index warm-up opens the Level's README on GitHub", () => {
    const snapshot = snapshotOf(
      playingAt("i-1", { from: "beginner-index", explainer: false }),
      { course: fullCourse },
    );
    expect(lessonPageOf(snapshot)).toEqual({
      github: "docs/beginner/README.md",
    });
  });

  test("the overview opens the active Lesson's page", () => {
    const snapshot = snapshotOf(overviewAt("b-2"), { course: fullCourse });
    expect(lessonPageOf(snapshot)).toEqual({ page: pageOf("b-2") });
  });

  test("no snapshot, no page", () => {
    expect(lessonPageOf(null)).toBeNull();
  });
});
