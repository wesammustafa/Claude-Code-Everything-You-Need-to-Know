import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import type { Milestone, Snapshot } from "@quest/contract";
import { overview, snapshotOf } from "../../e2e/snapshots";
import { renderConnected } from "../../test/connected";

const notice = (id: string, kind: string): Milestone => ({
  id,
  revision: 1,
  serverTime: 0,
  type: "notice",
  kind,
});

describe("SaveNotices", () => {
  test("an unreadable save is shown once, claimed with milestone.shown, until Got it", async () => {
    const user = userEvent.setup();
    const page = renderConnected(
      "/lesson/b-1",
      snapshotOf(overview, { milestones: [notice("e-1", "unreadable")] }),
    );
    await waitFor(() => {
      expect(page.posts).toEqual([{ type: "milestone.shown", id: "e-1" }]);
    });
    const shown = await screen.findByText(
      /could not be read, so it was moved aside/,
    );
    expect(shown.closest("[data-save-notice]")).toHaveTextContent(
      "learn.json.unreadable",
    );
    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByText(/moved aside/)).toBeNull();
    expect(page.posts).toHaveLength(1);
  });

  test("a save left in place says so; another notice kind is not this one's", async () => {
    const page = renderConnected(
      "/lesson/b-1",
      snapshotOf(overview, {
        milestones: [notice("e-2", "unreadable-kept"), notice("e-3", "other")],
      }),
    );
    expect(
      await screen.findByText(/could not be read or moved aside/),
    ).toBeInTheDocument();
    expect(page.posts).toEqual([{ type: "milestone.shown", id: "e-2" }]);
  });

  test("while progress is not saved a line stays, with no dismiss", () => {
    const base = snapshotOf(overview);
    const page = renderConnected("/lesson/b-1", {
      ...base,
      learner: { ...base.learner, saving: false },
    } satisfies Snapshot);
    expect(
      document.querySelector("[data-save-notice='not-saving']"),
    ).toHaveTextContent(
      "Progress is not being saved. If your practice copy has no .practice folder, run mkdir .practice there.",
    );
    expect(screen.queryByRole("button", { name: "Got it" })).toBeNull();
    page.send({ ...base, revision: 2 });
    expect(document.querySelector("[data-save-notice]")).toBeNull();
  });
});
