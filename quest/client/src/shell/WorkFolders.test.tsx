import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import type { Snapshot } from "@quest/contract";
import { fullCourse, playing, snapshotOf } from "../../e2e/snapshots";
import { renderConnected } from "../../test/connected";
import { refusalText } from "../screens/folderWords";

const COPY = "/home/ali/practice";
const withFolders = (workFolders: Snapshot["learner"]["workFolders"]) => {
  const base = snapshotOf(playing, { course: fullCourse });
  return { ...base, learner: { ...base.learner, workFolders } };
};

async function openFolders(snapshot: Snapshot) {
  const user = userEvent.setup();
  const page = renderConnected("/lesson/b-1/play", snapshot);
  await user.click(screen.getByRole("button", { name: "Settings" }));
  const dialog = screen.getByRole("dialog", { name: "Settings" });
  const region = within(dialog).getByRole("region", { name: "Work folders" });
  return { user, page, region };
}

const row = (region: HTMLElement, key: string) =>
  region.querySelector(`[data-work-folder="${key}"]`) as HTMLElement;

describe("Settings' Work folders", () => {
  test("one row for Intermediate and one for Advanced, and each saved new copy under its Lesson's title", async () => {
    const a5 = fullCourse.levels
      .flatMap((level) => level.lessons)
      .find((lesson) => lesson.id === "a-5");
    const { region } = await openFolders(
      withFolders([
        { key: "intermediate", path: COPY },
        { key: "a-5", path: "/home/ali/actions" },
      ]),
    );
    const rows = region.querySelectorAll("[data-work-folder]");
    expect([...rows].map((r) => r.getAttribute("data-work-folder"))).toEqual([
      "intermediate",
      "advanced",
      "a-5",
    ]);
    expect(row(region, "intermediate")).toHaveTextContent("This practice copy");
    expect(row(region, "advanced")).toHaveTextContent("Not chosen yet");
    expect(row(region, "a-5")).toHaveTextContent("/home/ali/actions");
    expect(row(region, "a-5")).toHaveTextContent(a5?.title ?? "missing");
    expect(region).toHaveTextContent(
      "Changing a folder clears the Check results found in the old one.",
    );
    expect(region.querySelector("[data-work-folder='beginner']")).toBeNull();
  });

  test("Change opens the form in place; a Level's sends the copy, a new copy's a path, and a refusal is worded", async () => {
    const { user, page, region } = await openFolders(
      withFolders([{ key: "a-5", path: "/home/ali/actions" }]),
    );
    await user.click(
      within(row(region, "advanced")).getByRole("button", { name: /Change/ }),
    );
    expect(
      within(region).getByRole("heading", {
        name: "The work folder for Advanced",
      }),
    ).toBeInTheDocument();
    await user.click(
      within(region).getByRole("button", { name: "Use this folder" }),
    );
    expect(page.posts).toEqual([
      { type: "folder.choose", key: "advanced", to: "practice-copy" },
    ]);
    await waitFor(() => {
      expect(within(region).queryByRole("form")).toBeNull();
    });
    await user.click(
      within(row(region, "a-5")).getByRole("button", { name: /Change/ }),
    );
    expect(within(region).queryByRole("radio")).toBeNull();
    await user.type(within(region).getByRole("textbox"), "/home/ali/other");
    page.refuse(400, { error: "folder", reason: "outside-home" });
    await user.click(
      within(region).getByRole("button", { name: "Use this folder" }),
    );
    await waitFor(() => {
      expect(within(region).getByRole("alert")).toHaveTextContent(
        refusalText("outside-home", "new-copy", "", COPY),
      );
    });
    await user.click(within(region).getByRole("button", { name: "Cancel" }));
    expect(within(region).queryByRole("textbox")).toBeNull();
  });

  test("Change puts focus in the form; Cancel, a send and Escape give it back to Change, and Escape leaves Settings open", async () => {
    const { user, region } = await openFolders(
      withFolders([{ key: "a-5", path: "/home/ali/actions" }]),
    );
    const change = (key: string) =>
      within(row(region, key)).getByRole("button", { name: /Change/ });

    await user.click(change("advanced"));
    expect(within(region).getAllByRole("radio")).toContain(
      document.activeElement,
    );
    await user.click(within(region).getByRole("button", { name: "Cancel" }));
    expect(change("advanced")).toHaveFocus();

    await user.click(change("a-5"));
    expect(within(region).getByRole("textbox")).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(within(region).queryByRole("textbox")).toBeNull();
    expect(change("a-5")).toHaveFocus();
    expect(
      screen.getByRole("dialog", { name: "Settings" }),
    ).toBeInTheDocument();

    await user.click(change("advanced"));
    await user.click(
      within(region).getByRole("button", { name: "Use this folder" }),
    );
    await waitFor(() => {
      expect(change("advanced")).toHaveFocus();
    });
  });
});
