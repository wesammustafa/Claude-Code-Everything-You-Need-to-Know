// Lesson complete's additions and the Level and course complete moments
// (249): the reference link, the announcement, the capstone lines, the
// hand-over to the Level moment, and each moment's claim.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { useCallback } from "react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Milestone } from "@quest/contract";
import {
  beginnerDone,
  complete,
  completeCapstone,
  completed,
  courseCompleted,
  courseDone,
  levelCompleted,
  overviewAt,
  snapshotOf,
} from "../../e2e/snapshots";
import { PAGE_INDEX, renderConnected } from "../../test/connected";
import { stubReducedMotion } from "../../test/motion";
import type { DirectorInput } from "../pip/director";
import { GUIDE_REPO } from "../pages/fetch";

const pip = vi.hoisted(() => ({
  inputs: [] as DirectorInput[],
  failIndex: false,
}));
vi.mock("../pages/fetch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../pages/fetch")>();
  return {
    ...actual,
    pageIndex: () =>
      pip.failIndex ? Promise.reject(new Error("down")) : actual.pageIndex(),
  };
});
vi.mock("../pip/PipStage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../pip/PipStage")>();
  return {
    ...actual,
    usePipInput: () => {
      const send = actual.usePipInput();
      return useCallback(
        (input: DirectorInput) => {
          pip.inputs.push(input);
          send(input);
        },
        [send],
      );
    },
  };
});

beforeEach(() => {
  pip.inputs = [];
  pip.failIndex = false;
});

/** The milestones Pip was sent as events, by type. */
const celebrated = () =>
  pip.inputs.flatMap((input) =>
    input.type === "events" ? input.events.map((e) => e.type) : [],
  );

const shownPosts = (posts: { type: string }[]) =>
  posts.filter((post) => post.type === "milestone.shown");

const capstoneAt = (milestones: Milestone[] = []) =>
  snapshotOf(completeCapstone, { course: beginnerDone, milestones });

describe("Lesson complete (249)", () => {
  test.each([false, true])(
    "every word is there on the first render: the completion, the Badge, the check and each skill practised in Mastery words, reduced motion %s (rehoming row 263)",
    (reduce) => {
      const MASTERY = {
        commands: "Every command shown",
        hints: "With hints",
        own: "On your own",
      } as const;
      {
        stubReducedMotion(reduce);
        renderConnected("/lesson/b-1/complete", snapshotOf(complete));
        // No await: this is the first frame the Learner sees.
        expect(screen.getByText("Lesson 1 complete")).toBeInTheDocument();
        expect(
          screen.getByRole("img", { name: "Explorer" }),
        ).toBeInTheDocument();
        expect(screen.getByText("2 of 2 lines pass")).toBeInTheDocument();
        const practised = within(
          screen.getByRole("region", { name: "You practised" }),
        ).getAllByRole("listitem");
        expect(practised.map((li) => li.textContent)).toEqual(
          complete.practised.map(
            ({ skill, mastery }) =>
              `${skill}${mastery ? MASTERY[mastery.used] : ""}`,
          ),
        );
      }
    },
  );

  test("links the reference solution at the release ref", async () => {
    renderConnected("/lesson/b-1/complete", snapshotOf(complete));
    const link = await screen.findByRole("link", {
      name: "Compare with a reference solution",
    });
    expect(link).toHaveAttribute(
      "href",
      `${GUIDE_REPO}/tree/${PAGE_INDEX.ref}/solutions/b-1`,
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(
      screen.getByRole("button", { name: "Read the full lesson" }),
    ).toBeInTheDocument();
  });

  test("no reference link when the page index fails", async () => {
    pip.failIndex = true;
    renderConnected("/lesson/b-1/complete", snapshotOf(complete));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(
      screen.queryByRole("link", { name: "Compare with a reference solution" }),
    ).toBeNull();
  });

  test("announces the new Badge only on a won reveal", async () => {
    renderConnected(
      "/lesson/b-1/complete",
      snapshotOf(complete, { milestones: completed }),
    );
    expect(await screen.findByText("New badge: Explorer")).toHaveAttribute(
      "role",
      "status",
    );
    expect(celebrated()).toEqual(["lesson.completed"]);
  });

  // The reveal is claimed asynchronously, so wait for the replay line and
  // for the claim to have had its chance before checking nothing showed.
  test("a replay announces nothing", async () => {
    renderConnected(
      "/lesson/b-1/complete",
      snapshotOf({ ...complete, firstTime: false }, { milestones: completed }),
    );
    expect(
      await screen.findByText("You already earned this badge."),
    ).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(/^New badge:/)).toBeNull();
    expect(celebrated()).toEqual([]);
  });

  test("the handover and the invitation on a capstone", () => {
    renderConnected("/lesson/b-capstone/complete", capstoneAt());
    expect(
      screen.getByText("You did every task without the exact command."),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Questions about anything/)).toBeInTheDocument();
  });

  test("with the handover off, the invitation still shows", () => {
    renderConnected(
      "/lesson/b-capstone/complete",
      snapshotOf(
        { ...completeCapstone, handover: false },
        { course: beginnerDone },
      ),
    );
    expect(screen.queryByText(/without the exact command/)).toBeNull();
    expect(screen.getByText(/^Questions about anything/)).toBeInTheDocument();
  });

  test("a notch harder before a harder next Lesson, and not into the next Level", () => {
    renderConnected("/lesson/b-1/complete", snapshotOf(complete));
    expect(screen.getByText(/^A notch harder/)).toBeInTheDocument();
  });

  test("a cross-Level next shows no notch line", () => {
    renderConnected("/lesson/b-capstone/complete", capstoneAt());
    expect(screen.queryByText(/^A notch harder/)).toBeNull();
    expect(
      screen.getByRole("button", { name: /Next: Turn a repeated/ }),
    ).toBeInTheDocument();
  });

  test("no next Lesson leaves the journey link only", () => {
    renderConnected(
      "/lesson/b-1/complete",
      snapshotOf({ ...complete, next: null }),
    );
    expect(screen.queryByRole("button", { name: /^Next/ })).toBeNull();
    expect(
      screen.getByRole("link", { name: "Back to the learning journey" }),
    ).toBeInTheDocument();
  });

  test("with the Level complete pending, the hand-over replaces Next", async () => {
    const page = renderConnected(
      "/lesson/b-capstone/complete",
      capstoneAt(levelCompleted),
    );
    const handOver = screen.getByRole("link", {
      name: "See the Beginner level complete",
    });
    expect(screen.queryByRole("button", { name: /^Next/ })).toBeNull();
    expect(screen.queryByText(/^A notch harder/)).toBeNull();
    await waitFor(() => {
      expect(shownPosts(page.posts)).toHaveLength(1);
    });
    await userEvent.click(handOver);
    expect(page.router.state.location.pathname).toBe("/level/b/complete");
  });
});

describe("Level complete", () => {
  test("the tab that wins the claim plays the Celebration", async () => {
    const page = renderConnected(
      "/level/b/complete",
      capstoneAt([levelCompleted[1] as Milestone]),
    );
    expect(screen.getByText("Level complete")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Beginner level complete",
      }),
    ).toHaveAttribute("data-page-title");
    const badges = within(
      screen.getByRole("list", { name: "The Beginner level's badges" }),
    ).getAllByRole("img");
    expect(badges).toHaveLength(6);
    await waitFor(() => {
      expect(celebrated()).toEqual(["level.completed"]);
    });
    expect(shownPosts(page.posts)).toEqual([
      { type: "milestone.shown", id: levelCompleted[1]?.id },
    ]);
    expect(
      screen.getByRole("button", { name: "Start the Intermediate level" }),
    ).toBeInTheDocument();
  });

  test("a reload shows the moment still, with no Celebration", async () => {
    const page = renderConnected("/level/b/complete", capstoneAt());
    expect(
      screen.getByRole("heading", { name: "Beginner level complete" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("img").length).toBeGreaterThanOrEqual(6);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(celebrated()).toEqual([]);
    expect(page.posts).toEqual([]);
  });

  test("a Level not complete says so", () => {
    renderConnected("/level/i/complete", capstoneAt());
    expect(
      screen.getByRole("heading", { name: "This level is not complete yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to the learning journey" }),
    ).toBeInTheDocument();
  });

  test("with the course complete pending, it hands over to the course", async () => {
    renderConnected(
      "/level/a/complete",
      snapshotOf(complete, { course: courseDone, milestones: courseCompleted }),
    );
    const next = screen.getByRole("link", { name: "See the course complete" });
    expect(next).toHaveAttribute("href", "/course/complete");
    await waitFor(() => {
      expect(celebrated()).toEqual(["level.completed"]);
    });
  });

  test("after Advanced with nothing pending, it offers the journey", () => {
    renderConnected(
      "/level/a/complete",
      snapshotOf(complete, { course: courseDone }),
    );
    expect(
      screen.getByRole("link", { name: "See the journey" }),
    ).toBeInTheDocument();
  });

  test("under reduced motion the first render holds the text and Badges", () => {
    stubReducedMotion(true);
    renderConnected(
      "/level/b/complete",
      capstoneAt([levelCompleted[1] as Milestone]),
    );
    expect(
      screen.getByRole("heading", { name: "Beginner level complete" }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("list", { name: "The Beginner level's badges" }),
      ).getAllByRole("img"),
    ).toHaveLength(6);
  });
});

describe("course complete", () => {
  test("every Level's Badges, and the Celebration for the winner", async () => {
    renderConnected(
      "/course/complete",
      snapshotOf(complete, {
        course: courseDone,
        milestones: [courseCompleted[1] as Milestone],
      }),
    );
    expect(
      screen.getByRole("heading", { name: "You finished Claude Code Quest" }),
    ).toBeInTheDocument();
    for (const name of ["Beginner", "Intermediate", "Advanced"])
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    await waitFor(() => {
      expect(celebrated()).toEqual(["course.completed"]);
    });
    expect(screen.getByRole("link", { name: /progress/ })).toHaveAttribute(
      "href",
      "/progress",
    );
  });
});

describe("a moment reached with no tab open", () => {
  test("the journey links it, and only links it", async () => {
    const page = renderConnected(
      "/journey",
      snapshotOf(overviewAt("i-1"), {
        course: beginnerDone,
        milestones: [levelCompleted[1] as Milestone],
      }),
    );
    const link = screen.getByRole("link", {
      name: "See the Beginner level complete",
    });
    expect(page.posts).toEqual([]);
    await userEvent.click(link);
    await waitFor(() => {
      expect(celebrated()).toEqual(["level.completed"]);
    });
  });
});

test("no word on the moments praises how the work was done", async () => {
  const banned = /first try|no hints|fast|quick(ly)?|streak/i;
  const views = [
    ["/lesson/b-1/complete", snapshotOf(complete, { milestones: completed })],
    ["/lesson/b-1/complete", snapshotOf({ ...complete, firstTime: false })],
    ["/lesson/b-capstone/complete", capstoneAt(levelCompleted)],
    ["/level/b/complete", capstoneAt()],
    ["/course/complete", snapshotOf(complete, { course: courseDone })],
  ] as const;
  for (const [path, snapshot] of views) {
    const page = renderConnected(path, snapshot);
    await screen.findByRole("heading", { level: 1 });
    expect(document.body.textContent).not.toMatch(banned);
    cleanup();
    page.router.dispose();
  }
});
