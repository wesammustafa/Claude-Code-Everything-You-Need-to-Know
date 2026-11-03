// Ticket 254, lane S1: the overview's Why line (row 71), the saved Work
// folder named on the overview and in the waiting bubble (row 671), and
// focus after the open-first offer leaves (row 705).
import { act, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import type { CourseView, OverviewLesson, Snapshot } from "@quest/contract";
import {
  fullCourse,
  overview,
  overviewAt,
  snapshotOf,
  watchWaiting,
} from "../../e2e/snapshots";
import { renderConnected } from "../../test/connected";

const WORK = "/home/ali/work";

/** fullCourse with i-1's Intermediate Work folder set, and that folder saved. */
function withSavedFolder(lesson: OverviewLesson): Snapshot {
  const course: CourseView = {
    ...fullCourse,
    levels: fullCourse.levels.map((level) => ({
      ...level,
      lessons: level.lessons.map((summary) =>
        summary.id === "i-1"
          ? {
              ...summary,
              folder: { kind: "work", level: "intermediate", set: true },
            }
          : summary,
      ),
    })),
  };
  const snapshot = snapshotOf(lesson, { welcomed: true, course });
  return {
    ...snapshot,
    learner: {
      ...snapshot.learner,
      workFolders: [{ key: "intermediate", path: WORK }],
    },
  };
}

describe("Lesson overview, lane S1", () => {
  test("the overview shows its Why line from intro.why, in the page's words", () => {
    renderConnected("/lesson/b-1", snapshotOf(overview));
    const why = document.querySelector("[data-overview-why]");
    expect(why).toHaveTextContent(`Why: ${overview.intro?.why ?? "?"}`);
  });

  test("no Why line when the intro has none", () => {
    renderConnected(
      "/lesson/b-1",
      snapshotOf({
        ...overview,
        intro: overview.intro && { ...overview.intro, why: null },
      }),
    );
    expect(document.querySelector("[data-overview-why]")).toBeNull();
  });

  test("with a saved Work folder the overview names it", () => {
    renderConnected(
      "/lesson/i-1",
      withSavedFolder({ ...overviewAt("i-1"), folderQuestion: null }),
    );
    expect(document.querySelector("[data-overview-folder]")).toHaveTextContent(
      `Work folder: ${WORK}`,
    );
  });

  test("a Lesson in the Practice copy names no Work folder", () => {
    renderConnected("/lesson/b-1", snapshotOf(overview));
    expect(document.querySelector("[data-overview-folder]")).toBeNull();
  });

  test("focus moves to Start when the focused open-first offer leaves", () => {
    const offering: OverviewLesson = {
      ...overview,
      notes: [
        {
          kind: "unmet",
          line: "Lesson 2's plan is not there.",
          lesson: "b-2",
        },
      ],
      start: { planned: true, less: true, first: "b-2" },
    };
    const page = renderConnected(
      "/lesson/b-1",
      snapshotOf(offering, { welcomed: true }),
    );
    const offer = screen.getByRole("button", {
      name: "Open Permission modes and plan mode first",
    });
    act(() => {
      offer.focus();
    });
    expect(offer).toHaveFocus();
    // The prerequisite passes: its note and its offer go.
    page.send(
      snapshotOf(
        {
          ...offering,
          notes: [],
          start: { planned: true, less: true, first: null },
        },
        { welcomed: true, revision: 2 },
      ),
    );
    expect(
      screen.queryByRole("button", {
        name: "Open Permission modes and plan mode first",
      }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Start" })).toHaveFocus();
  });
});

describe("Lesson workspace, lane S1", () => {
  const bubble = () =>
    document.querySelector("[data-says-words]")?.textContent ?? "";

  test("the waiting bubble names the Work folder it watches before the first look", () => {
    renderConnected(
      "/lesson/b-1/step",
      snapshotOf({
        ...watchWaiting,
        beat: watchWaiting.beat && {
          ...watchWaiting.beat,
          ranIn: null,
          watches: WORK,
        },
      }),
    );
    expect(bubble()).toBe(`Watching your work folder: ${WORK}.`);
  });

  test("the waiting bubble names the Practice copy when it watches the copy", () => {
    renderConnected("/lesson/b-1/step", snapshotOf(watchWaiting));
    expect(bubble()).toBe("Watching your Practice copy.");
  });
});
