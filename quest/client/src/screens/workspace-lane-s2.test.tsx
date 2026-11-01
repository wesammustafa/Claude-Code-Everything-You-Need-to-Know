// Lane S2's re-homed workspace rules (254 D22+): the 2 s hint lock (rehoming
// rows 44, 605, 755, 828), Command's prompt mark (rows 644, 645) and the
// Not yet words under the first Check item not met (row 37).
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { PlayingLesson } from "@quest/contract";
import { Command, promptOf } from "../components/Command";
import {
  confirmExact,
  playing,
  playingWith,
  snapshotOf,
} from "../../e2e/snapshots";
import { renderConnected } from "../../test/connected";

afterEach(() => {
  vi.useRealTimers();
});

/** The post's answer lands, so the next press is not caught as in flight. */
const settle = () =>
  act(async () => {
    await new Promise((done) => setTimeout(done, 300));
  });

/**
 * Only Date is faked, and it runs on: the lock reads the wall clock, and the
 * live store's requests wait on it. Each test sets it from the first press.
 */
function fakeClock() {
  vi.useFakeTimers({ toFake: ["Date"], shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-10-31T12:00:00Z"));
}

const oneRung: PlayingLesson = {
  ...playing,
  hints: {
    ...playing.hints,
    shown: [{ kind: "check", text: "Does the claim state the exit code?" }],
  },
};

describe("the 2 second hint lock", () => {
  test("a second Show a hint within 2 s posts no second hint.next and opens one rung, with no countdown", async () => {
    fakeClock();
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1/step", snapshotOf(playing));
    const pressed = Date.now();
    await user.click(screen.getByRole("button", { name: "Show a hint" }));
    await settle();
    expect(page.posts).toEqual([{ type: "hint.next" }]);
    // The rung opens at once: a second press inside the lock would skip one.
    page.send(snapshotOf(oneRung, { revision: 2 }));
    expect(await screen.findAllByText(/Does the claim/)).toHaveLength(1);
    const again = () => screen.getByRole("button", { name: "Another hint" });
    vi.setSystemTime(pressed + 1000);
    await user.click(again());
    await settle();
    expect(page.posts).toEqual([{ type: "hint.next" }]);
    expect(document.querySelectorAll("[data-hint-rung]")).toHaveLength(1);
    // Nothing counts the lock down.
    expect(document.querySelector("[data-check-clock]")).toBeNull();
    expect(document.body.textContent).not.toMatch(/\b\d+ ?s\b|second/);
    vi.setSystemTime(pressed + 2500);
    await user.click(again());
    expect(page.posts).toEqual([{ type: "hint.next" }, { type: "hint.next" }]);
  });

  test("the exact-command confirm ignores a repeat take within 2 s", async () => {
    fakeClock();
    const user = userEvent.setup();
    const page = renderConnected("/lesson/b-1/step", snapshotOf(confirmExact));
    const take = () =>
      screen.getByRole("button", { name: "Show the exact command" });
    const pressed = Date.now();
    await user.click(take());
    await settle();
    vi.setSystemTime(pressed + 1000);
    await user.click(take());
    await settle();
    expect(page.posts).toEqual([{ type: "hint.takeExact", take: true }]);
    expect(document.body.textContent).not.toMatch(/\b\d+ ?s\b|second/);
    vi.setSystemTime(pressed + 2500);
    await user.click(take());
    expect(page.posts).toEqual([
      { type: "hint.takeExact", take: true },
      { type: "hint.takeExact", take: true },
    ]);
  });
});

/** The prompt mark each run line of the card shows, in order. */
function marks(): [string, string][] {
  return [...document.querySelectorAll("[data-pip-target=command]")].map(
    (el) => [
      el.querySelector("code")?.textContent ?? "",
      el.querySelector("[data-prompt]")?.textContent ?? "",
    ],
  );
}

const runs = (
  kind: NonNullable<NonNullable<PlayingLesson["step"]>["where"]>["kind"],
  texts: string[],
) =>
  playingWith({
    step: { where: { kind, terminal: null, folder: null } },
    beat: {
      decidedBy: "learner",
      kind: "do",
      status: "waiting",
      verification: [],
      fail: null,
      lines: texts.map((text) => ({ kind: "run" as const, text })),
    },
  });

describe("Command's prompt mark", () => {
  test("on a Claude Code beat, a command that starts Claude Code reads as the shell's; a prompt for the session reads as Claude Code's", () => {
    renderConnected(
      "/lesson/b-1/step",
      snapshotOf(
        runs("claude", [
          "claude --worktree docs-pass",
          "/status",
          "claude",
          "explain src/cli.js",
        ]),
      ),
    );
    expect(marks()).toEqual([
      ["claude --worktree docs-pass", "$"],
      ["/status", "›"],
      ["claude", "$"],
      ["explain src/cli.js", "›"],
    ]);
  });

  test("a slash command reads as Claude Code's on any beat, an editor beat's too; a path that starts with / reads as the shell's", () => {
    renderConnected(
      "/lesson/b-1/step",
      snapshotOf(
        runs("editor", [
          "/reload-plugins",
          "/plugin install team-kit",
          "/tmp/x",
        ]),
      ),
    );
    expect(marks()).toEqual([
      ["/reload-plugins", "›"],
      ["/plugin install team-kit", "›"],
      ["/tmp/x", "$"],
    ]);
    cleanup();
    expect(promptOf("/status", "shell")).toBe("claude");
    expect(promptOf("/usr/bin/env node", "claude-2")).toBe("claude");
    expect(promptOf("/usr/bin/env node", "terminal")).toBe("shell");
    render(<Command text="/help" prompt="claude" />);
    expect(
      within(
        screen.getByText("/help").closest("[data-pip-target]") as HTMLElement,
      ).getByText("›"),
    ).toBeInTheDocument();
  });
});

describe("the Check's lines", () => {
  test("the Not yet words sit under the first item not met only, whole, a list of names kept together", () => {
    const fail =
      "The note still names `diagnosis`, `triage` and `fix` as steps. Write what the code does.";
    const lesson = playingWith({
      beat: {
        decidedBy: "check",
        status: "fail",
        verification: [
          { text: "the version prints", pass: true },
          { text: "the claim is corrected", pass: false },
          { text: "the tree is clean", pass: false },
        ],
        fail,
      },
    });
    renderConnected("/lesson/b-1/step", snapshotOf(lesson));
    const lines = [...document.querySelectorAll("[data-pip-target=lines] li")];
    expect(lines.map((li) => li.getAttribute("data-state"))).toEqual([
      "ok",
      "not-yet",
      "not-yet",
    ]);
    expect(
      lines.map((li) => li.querySelector("[data-not-yet]") !== null),
    ).toEqual([false, true, false]);
    expect(lines[1]?.querySelector("[data-not-yet]")?.textContent).toBe(
      fail.replaceAll("`", ""),
    );
    expect(document.querySelector("[data-says-words]")?.textContent).toMatch(
      /^Not yet\./,
    );
  });
});
