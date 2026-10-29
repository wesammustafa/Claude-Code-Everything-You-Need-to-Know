import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  expectStylesFromTokens,
  stateUtilities,
} from "../../test/token-classes";
import { Command } from "./Command";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Command", () => {
  test("shows the command and copies it from the keyboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    const { container } = render(<Command text="npm run learn" />);
    expect(container.querySelector("code")).toHaveTextContent(
      /^npm run learn$/,
    );

    const copy = screen.getByRole("button", { name: "Copy npm run learn" });
    await user.tab();
    expect(copy).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(writeText).toHaveBeenCalledWith("npm run learn");
    expect(await navigator.clipboard.readText()).toBe("npm run learn");
    expect(await screen.findByRole("button", { name: "Copied" })).toBe(copy);
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
  });

  test("reads Copy again after a moment", async () => {
    const user = userEvent.setup();
    render(<Command text="git status" />);
    await user.click(screen.getByRole("button", { name: "Copy git status" }));
    expect(
      await screen.findByRole("button", { name: "Copied" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole(
        "button",
        { name: "Copy git status" },
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
  });

  test("each Copy restarts the confirmation and is announced again", async () => {
    // Only the test moves the clock, so however slow the machine, the
    // confirmation lasts exactly as long as the test says. user-event waits
    // on a clock that moves by itself, so the clicks go straight to the
    // button, with a clipboard of the test's own.
    vi.useFakeTimers();
    const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    });
    const click = (element: HTMLElement) =>
      act(async () => {
        fireEvent.click(element);
        await Promise.resolve();
      });
    try {
      render(<Command text="git status" />);
      const copy = screen.getByRole("button", { name: "Copy git status" });
      const status = screen.getByRole("status");

      await click(copy);
      expect(copy).toHaveAccessibleName("Copied");
      const first = status.firstElementChild;
      expect(first).toHaveTextContent("Copied");

      act(() => {
        vi.advanceTimersByTime(1200);
      });
      await click(copy);
      // The same words, in a new node, so a screen reader hears the second copy.
      const second = status.firstElementChild;
      expect(second).toHaveTextContent("Copied");
      expect(second).not.toBe(first);

      // 2000 ms after the first Copy, 800 after the second: still confirmed.
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(copy).toHaveAccessibleName("Copied");
      // 1600 ms after the second: Copy again.
      act(() => {
        vi.advanceTimersByTime(799);
      });
      expect(copy).toHaveAccessibleName("Copied");
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(copy).toHaveAccessibleName("Copy git status");
      expect(status).toBeEmptyDOMElement();
    } finally {
      vi.useRealTimers();
      if (clipboard === undefined)
        Reflect.deleteProperty(navigator, "clipboard");
      else Object.defineProperty(navigator, "clipboard", clipboard);
    }
  });

  test("wraps a long command only between its arguments", () => {
    const text = "npm run check -- b-1";
    const { container } = render(<Command text={text} />);
    const code = container.querySelector("code");
    if (!code) throw new Error("no code");
    // Copying or selecting it still gives the command exactly.
    expect(code.textContent).toBe(text);
    // Each argument is one box that a line never breaks inside, unless it is wider than the line.
    const args = [...code.children];
    expect(args.map((el) => el.textContent)).toEqual([
      "npm",
      "run",
      "check",
      "--",
      "b-1",
    ]);
    for (const arg of args) {
      expect(arg.className.split(" ")).toEqual(
        expect.arrayContaining(["inline-block", "max-w-full", "wrap-anywhere"]),
      );
    }
    // The spaces between them are the only other content, and the only wrap points.
    expect(
      [...code.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent),
    ).toEqual([" ", " ", " ", " "]);
  });

  test("selects the command where the clipboard refuses", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
      new Error("denied"),
    );
    render(<Command text="claude --version" />);
    await user.click(
      screen.getByRole("button", { name: "Copy claude --version" }),
    );
    expect(window.getSelection()?.toString()).toBe("claude --version");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Selected: copy it with your keyboard",
    );
  });

  test("fills the line, or with fit sits at its own width, never both", () => {
    const { container, rerender } = render(<Command text="npm test" />);
    const block = () => (container.firstElementChild as HTMLElement).classList;
    expect(block()).toContain("w-full");
    expect(block()).not.toContain("w-fit");
    rerender(<Command text="npm test" fit />);
    expect(block()).toContain("w-fit");
    expect(block()).not.toContain("w-full");
  });

  test("draws the block and its Copy states from tokens", () => {
    const { container } = render(<Command text="npm test" />);
    const copy = screen.getByRole("button");
    expectStylesFromTokens(
      (container.firstElementChild as HTMLElement).className,
    );
    expectStylesFromTokens(copy.className);
    expect(stateUtilities(copy.className, "hover")).toContain(
      "bg-code-control-hover",
    );
    expect(stateUtilities(copy.className, "active")).toContain(
      "translate-y-(--press-y)",
    );
    expect(stateUtilities(copy.className, "focus-visible")).toContain(
      "outline-focus-on-code",
    );
  });
});
