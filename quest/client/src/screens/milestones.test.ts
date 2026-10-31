import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Milestone } from "@quest/contract";
import {
  beginnerDone,
  complete,
  completeCapstone,
  courseDone,
  levelCompleted,
  noticeFirst,
  snapshotOf,
} from "../../e2e/snapshots";
import {
  celebratable,
  levelMoment,
  levelOfKey,
  levelPath,
  useClaimMilestone,
} from "./milestones";

const live = vi.hoisted(() => ({
  milestone: null as Milestone | null,
  show: vi.fn<(id: string) => Promise<boolean>>(),
  pip: vi.fn(),
}));
vi.mock("../live/LiveProvider", () => ({
  useMilestone: () => ({ milestone: live.milestone, show: live.show }),
}));
vi.mock("../pip/PipStage", () => ({ usePipInput: () => live.pip }));

beforeEach(() => {
  live.milestone = null;
  live.show.mockReset();
  live.pip.mockReset();
});

describe("celebratable", () => {
  test("skips notices, keeping the rest oldest first", () => {
    const pending = celebratable(
      snapshotOf(complete, { milestones: noticeFirst }),
    );
    expect(pending.map((m) => m.type)).toEqual(["lesson.completed"]);
    expect(celebratable(null)).toEqual([]);
  });
});

describe("levelMoment", () => {
  test("the Level's Badges in course order, and the next Level", () => {
    const moment = levelMoment(
      snapshotOf(completeCapstone, { course: beginnerDone }),
      "beginner",
    );
    expect(moment?.badges.map((b) => b.lesson)).toEqual([
      "b-1",
      "b-2",
      "b-3",
      "b-4",
      "b-5",
      "b-capstone",
    ]);
    expect(moment?.next?.id).toBe("intermediate");
  });

  test("null for a Level that is not complete", () => {
    expect(
      levelMoment(
        snapshotOf(complete, { course: beginnerDone }),
        "intermediate",
      ),
    ).toBeNull();
  });

  test("no next Level after Advanced", () => {
    expect(
      levelMoment(snapshotOf(complete, { course: courseDone }), "advanced")
        ?.next,
    ).toBeNull();
  });

  test("a route key names its Level", () => {
    expect(levelOfKey("b")).toBe("beginner");
    expect(levelOfKey("x")).toBeNull();
    expect(levelPath("advanced")).toBe("/level/a/complete");
  });
});

describe("useClaimMilestone", () => {
  const level = levelCompleted[1] as Milestone;
  const isLevel = (m: Milestone) => m.type === "level.completed";

  test("a won claim sends Pip the milestone once", async () => {
    live.milestone = level;
    live.show.mockResolvedValue(true);
    const { result, rerender } = renderHook(() => useClaimMilestone(isLevel));
    await waitFor(() => {
      expect(result.current).toEqual({ won: true, envelope: level });
    });
    // Winning clears the pending milestone; nothing is claimed or sent again.
    live.milestone = null;
    rerender();
    expect(live.show).toHaveBeenCalledTimes(1);
    expect(live.pip.mock.calls).toEqual([
      [{ type: "events", events: [level] }],
    ]);
  });

  test("a lost claim plays nothing", async () => {
    live.milestone = level;
    live.show.mockResolvedValue(false);
    const { result } = renderHook(() => useClaimMilestone(isLevel));
    await waitFor(() => {
      expect(live.show).toHaveBeenCalledWith(level.id);
    });
    await Promise.resolve();
    expect(result.current).toEqual({ won: false });
    expect(live.pip).not.toHaveBeenCalled();
  });

  test("a milestone the match refuses is never claimed", () => {
    live.milestone = levelCompleted[0] as Milestone;
    const { result } = renderHook(() => useClaimMilestone(isLevel));
    expect(result.current).toEqual({ won: false });
    expect(live.show).not.toHaveBeenCalled();
  });
});
