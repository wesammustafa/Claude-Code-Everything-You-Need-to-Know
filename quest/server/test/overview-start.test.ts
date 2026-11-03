// The Lesson overview's two starts (ticket 245, AC3): for every Lesson of
// the compiled course, Start and Start with less help reach the workspace
// with each step at the tier the overview's staircase showed.
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { OverviewLesson, PlayingLesson } from "@quest/contract";
import { initialState, project, reduce } from "@quest/engine";
import { FOLDER_KEYS, loadCourse } from "@quest/engine/course";

const course = loadCourse(
  fileURLToPath(new URL("../../../practice-template", import.meta.url)),
);
// Every Work folder answered, so each overview offers its starts.
const folders = Object.fromEntries(
  [...FOLDER_KEYS].map((key) => [key, `/home/ali/work-${key}`]),
);
const fresh = () =>
  initialState({
    course,
    saved: { folders, welcomed: true },
    facts: { root: "/copy" },
  });

describe.each(course.filter((l) => l.content).map((l) => l.id))("%s", (id) => {
  const opened = reduce(fresh(), { type: "lesson.open", lesson: id }).state;
  const overview = project(opened).lesson as OverviewLesson;

  test("the overview's outline is its planned staircase, nothing started", () => {
    expect(overview.steps.map(({ part, tier }) => ({ part, tier }))).toEqual(
      overview.staircase.planned,
    );
    expect(overview.steps.every((x) => x.state === "todo")).toBe(true);
  });

  test.each(["planned", "less"] as const)(
    "Start (%s) reaches the workspace at the overview's tiers",
    (help) => {
      const stairs =
        help === "planned"
          ? overview.staircase.planned
          : (overview.staircase.less ?? overview.staircase.planned);
      // Less help is offered exactly where it changes a step; a capstone
      // has none, and a start with less help there starts as planned.
      expect(overview.start?.less).toBe(overview.staircase.less !== null);
      const started = reduce(opened, { type: "lesson.start", help }).state;
      const playing = project(started).lesson as PlayingLesson;
      expect(playing.phase).toBe("playing");
      expect(playing.steps.map(({ part, tier }) => ({ part, tier }))).toEqual(
        stairs,
      );
    },
  );
});
