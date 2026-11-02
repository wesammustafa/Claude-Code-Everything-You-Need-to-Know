import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef, useState } from "react";
import { expect, test, vi } from "vitest";
import { renderWithMotion, setMotionSwitch } from "../../test/motion";
import { stateUtilities } from "../../test/token-classes";
import { Hints } from "./Hints";

const HINTS = ["Look in `src/`.", "Open the newest file."];

test("shows one rung at a time, the newest as Pip's hint target", async () => {
  const user = userEvent.setup();
  const onShowNext = vi.fn();
  const { container, rerender } = render(
    <Hints hints={HINTS} shown={0} onShowNext={onShowNext} />,
  );
  expect(container.querySelector("[data-pip-target]")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Show a hint" }));
  expect(onShowNext).toHaveBeenCalledOnce();

  rerender(<Hints hints={HINTS} shown={1} onShowNext={onShowNext} />);
  expect(container).toHaveTextContent("Hint 1. Look in src/.");
  expect(screen.getByRole("button", { name: "Another hint" })).toBeVisible();

  rerender(<Hints hints={HINTS} shown={2} onShowNext={onShowNext} />);
  const targets = container.querySelectorAll("[data-pip-target=hint]");
  expect(targets).toHaveLength(1);
  expect(targets[0]).toHaveTextContent("Hint 2. Open the newest file.");
  expect(screen.queryByRole("button")).toBeNull();
});

test("a new rung takes focus from the caller, and reads in order", async () => {
  function Step() {
    const [shown, setShown] = useState(0);
    const newest = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (shown > 0) newest.current?.focus();
    }, [shown]);
    return (
      <Hints
        hints={HINTS}
        shown={shown}
        newestRef={newest}
        onShowNext={() => {
          setShown((n) => n + 1);
        }}
      />
    );
  }
  const user = userEvent.setup();
  const { container } = renderWithMotion(<Step />);
  await user.tab();
  const show = screen.getByRole("button", { name: "Show a hint" });
  expect(show).toHaveFocus();
  expect(stateUtilities(show.className, "focus-visible")).toEqual(
    expect.arrayContaining(["outline-2", "outline-offset-2", "outline-focus"]),
  );
  await user.keyboard("{Enter}");
  const rung = container.querySelector("[data-pip-target=hint]");
  expect(rung).toHaveFocus();
  expect(rung).toHaveTextContent("Hint 1. Look in src/.");
  // The focus it is given draws the ring, inside the rung (268).
  expect(stateUtilities(rung?.className ?? "", "focus-visible")).toEqual(
    expect.arrayContaining(["outline-2", "-outline-offset-2", "outline-focus"]),
  );
});

test("the exact-command question, given focus, draws the focus ring (268)", () => {
  render(
    <Hints
      hints={HINTS}
      shown={1}
      onShowNext={() => undefined}
      confirm={{ onTake: vi.fn(), onDecline: vi.fn() }}
    />,
  );
  const question = screen.getByText(/Show the exact command\?/);
  expect(question).toHaveFocus();
  expect(question.className).not.toContain("focus:outline-none");
  expect(stateUtilities(question.className, "focus-visible")).toEqual(
    expect.arrayContaining(["outline-2", "outline-offset-2", "outline-focus"]),
  );
});

test("says why no further hint can open, in place of the button", () => {
  render(
    <Hints
      hints={HINTS}
      shown={1}
      onShowNext={vi.fn()}
      unavailable="Another hint opens after the next Check."
    />,
  );
  expect(screen.queryByRole("button")).toBeNull();
  expect(
    screen.getByText("Another hint opens after the next Check."),
  ).toBeInTheDocument();
});

test("offers the exact command in the caller's words, as a small quiet button", async () => {
  const user = userEvent.setup();
  const onTake = vi.fn();
  render(
    <Hints
      hints={HINTS}
      shown={2}
      onShowNext={vi.fn()}
      exact={{ label: "Show the command", onTake }}
    />,
  );
  const take = screen.getByRole("button", { name: "Show the command" });
  expect(take.className).toContain("h-8");
  expect(take.className).toContain("text-muted");
  await user.click(take);
  expect(onTake).toHaveBeenCalledOnce();
});

test("a rung opens through its height and fades in; under reduced motion it only fades", async () => {
  const { container, unmount } = renderWithMotion(
    <Hints hints={HINTS} shown={1} onShowNext={vi.fn()} />,
  );
  const rung = () =>
    container.querySelector<HTMLElement>("[data-hint-rung]")?.style;
  expect(rung()?.opacity).toBe("0");
  expect(rung()?.height).toBe("0px");
  unmount();

  await setMotionSwitch("reduce");
  const reduced = renderWithMotion(
    <Hints hints={HINTS} shown={1} onShowNext={vi.fn()} />,
  );
  const style =
    reduced.container.querySelector<HTMLElement>("[data-hint-rung]")?.style;
  expect(style?.opacity).toBe("0");
  expect(style?.height).toBe("");
  expect(style?.transform).toBe("");
});

test("its words keep the copy rules", () => {
  const { container } = render(
    <Hints hints={HINTS} shown={0} onShowNext={vi.fn()} />,
  );
  expect(container.textContent).not.toMatch(/press|stuck|wrong|fail/i);
  expect(container.textContent).not.toContain(String.fromCodePoint(0x2014));
});

test("the exact-command question takes the next rung's place and its focus, and each answer calls its handler (247)", async () => {
  const user = userEvent.setup();
  const onTake = vi.fn();
  const onDecline = vi.fn();
  render(
    <Hints
      hints={[...HINTS, ""]}
      shown={2}
      onShowNext={() => undefined}
      confirm={{ onTake, onDecline }}
    />,
  );
  expect(screen.queryByRole("button", { name: "Another hint" })).toBeNull();
  const question = screen.getByText(
    "Show the exact command? This step then counts as Every command shown.",
  );
  expect(question).toHaveFocus();
  await user.click(
    screen.getByRole("button", { name: "Show the exact command" }),
  );
  await user.click(screen.getByRole("button", { name: "Not now" }));
  expect(onTake).toHaveBeenCalledOnce();
  expect(onDecline).toHaveBeenCalledOnce();
});

test("two rungs that read the same both show, and a rung may be drawn by the caller (247)", () => {
  const { container } = render(
    <Hints
      hints={["Look again.", "Look again.", <code key="c">git status</code>]}
      shown={3}
      onShowNext={() => undefined}
    />,
  );
  const rungs = container.querySelectorAll("[data-hint-rung]");
  expect(rungs).toHaveLength(3);
  expect(rungs[1]).toHaveTextContent("Hint 2. Look again.");
  expect(rungs[2]).toHaveTextContent("Hint 3.git status");
});

test("Not now gives focus back to the button that opens the next rung (247)", async () => {
  const user = userEvent.setup();
  const props = {
    hints: [...HINTS, ""],
    shown: 2,
    onShowNext: () => undefined,
  };
  const { rerender } = render(
    <Hints
      {...props}
      confirm={{
        onTake: vi.fn(),
        onDecline: () => {
          rerender(<Hints {...props} />);
        },
      }}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Not now" }));
  expect(screen.getByRole("button", { name: "Another hint" })).toHaveFocus();
});
