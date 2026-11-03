import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import type { FolderQuestion, FolderRefusal } from "@quest/contract";
import { fullCourse, overviewAt, snapshotOf } from "../../e2e/snapshots";
import { renderConnected } from "../../test/connected";
import { refusalText } from "../screens/folderWords";

const COPY = "/home/ali/practice";
const question = (over: Partial<FolderQuestion> = {}): FolderQuestion => ({
  key: "intermediate",
  asks: "work",
  current: null,
  problem: null,
  open: true,
  checking: false,
  ...over,
});
const at = (id: string, q: FolderQuestion | null, revision = 1) =>
  snapshotOf(
    {
      ...overviewAt(id),
      folderQuestion: q,
      start: q?.open ? null : overviewAt(id).start,
    },
    { course: fullCourse, revision },
  );
const field = () =>
  screen.getByRole("textbox", { name: "The folder's full path" });
const use = () => screen.getByRole("button", { name: "Use this folder" });

describe("FolderForm", () => {
  test("a Level's form offers this practice copy by default and sends it", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/i-1", at("i-1", question()));
    expect(
      screen.getByRole("heading", { name: "The work folder for Intermediate" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "In this practice copy" }),
    ).toBeChecked();
    expect(screen.queryByRole("textbox")).toBeNull();
    await user.click(use());
    expect(page.posts).toEqual([
      { type: "folder.choose", key: "intermediate", to: "practice-copy" },
    ]);
  });

  test("another folder opens the path field, which sends the path typed", async () => {
    const user = userEvent.setup();
    const page = renderConnected("/lesson/i-1", at("i-1", question()));
    await user.click(
      screen.getByRole("radio", {
        name: "In another folder, such as your repository",
      }),
    );
    expect(field()).toHaveAttribute("spellcheck", "false");
    expect(field()).toHaveAttribute("autocomplete", "off");
    expect(field()).toHaveAttribute("maxlength", "1024");
    await user.type(field(), "  /home/ali/app ");
    await user.click(use());
    expect(page.posts).toEqual([
      {
        type: "folder.choose",
        key: "intermediate",
        to: { path: "/home/ali/app" },
      },
    ]);
  });

  test("a relative or ~ path is turned down before anything is sent, until it is edited", async () => {
    const user = userEvent.setup();
    const page = renderConnected(
      "/lesson/a-5",
      at("a-5", question({ key: "a-5", asks: "new-copy" })),
    );
    expect(
      screen.getByRole("heading", { name: "Give the folder of your new copy" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio")).toBeNull();
    await user.type(field(), "code/app");
    await user.click(use());
    expect(screen.getByRole("alert")).toHaveTextContent(
      refusalText("relative", "new-copy", "", COPY),
    );
    await user.clear(field());
    expect(screen.queryByRole("alert")).toBeNull();
    await user.type(field(), "~/app");
    await user.click(use());
    expect(screen.getByRole("alert")).toHaveTextContent(/~/);
    expect(page.posts).toEqual([]);
  });

  test("each server refusal is worded, and stays until the path is edited", async () => {
    const user = userEvent.setup();
    const page = renderConnected(
      "/lesson/a-5",
      at("a-5", question({ key: "a-5", asks: "new-copy" })),
    );
    const reasons: (FolderRefusal | "invalid")[] = [
      "missing",
      "too-long",
      "outside-home",
      "is-copy",
      "contains-copy",
      "not-repo-root",
      "invalid",
    ];
    await user.type(field(), "/home/ali/app");
    for (const reason of reasons) {
      page.refuse(
        400,
        reason === "invalid"
          ? { error: "invalid" }
          : { error: "folder", reason },
      );
      await user.click(use());
      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          refusalText(reason, "new-copy", "/home/ali/app", COPY),
        );
      });
    }
    await user.type(field(), "x");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("a path inside the practice copy gets the copy's words", async () => {
    const user = userEvent.setup();
    const page = renderConnected(
      "/lesson/a-5",
      at("a-5", question({ key: "a-5", asks: "new-copy" })),
    );
    await user.type(field(), `${COPY}/project`);
    page.refuse(400, { error: "folder", reason: "not-repo-root" });
    await user.click(use());
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        refusalText("is-copy", "new-copy", COPY, COPY),
      );
    });
  });

  test("the engine's missing and is-copy problems use the same words", () => {
    const page = renderConnected(
      "/lesson/a-5",
      at("a-5", question({ key: "a-5", asks: "new-copy", problem: "missing" })),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      refusalText("missing", "new-copy", "", COPY),
    );
    page.send(
      at(
        "a-5",
        question({ key: "a-5", asks: "new-copy", problem: "is-copy" }),
        2,
      ),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      refusalText("is-copy", "new-copy", "", COPY),
    );
  });

  test("while the host looks, the field waits and Cancel drops the answer", async () => {
    const user = userEvent.setup();
    const page = renderConnected(
      "/lesson/a-5",
      at("a-5", question({ key: "a-5", asks: "new-copy", checking: true })),
    );
    expect(screen.getByText("Looking at that folder...")).toBeInTheDocument();
    expect(field()).toHaveAttribute("aria-disabled", "true");
    await user.click(use());
    expect(page.posts).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(page.posts).toEqual([{ type: "folder.cancel" }]);
  });
});
