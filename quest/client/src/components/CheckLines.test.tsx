import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { expectStylesFromTokens } from "../../test/token-classes";
import { CheckLines } from "./CheckLines";

const LINES = [
  { text: "the tests pass", ok: true },
  {
    text: "nothing is left uncommitted",
    ok: false,
    evidence: "These changes are uncommitted: test/external.test.js",
  },
  {
    text: "your last commit changes a test file",
    ok: true,
    evidence: "Your last commit changes test/app.test.js",
  },
];

test("reads each line with its result, and shows evidence under a line in any state", () => {
  render(<CheckLines lines={LINES} />);
  const items = screen.getAllByRole("listitem");
  expect(items.map((li) => li.textContent)).toEqual([
    "Passes: the tests pass",
    "Not yet: nothing is left uncommittedThese changes are uncommitted: test/external.test.js",
    "Passes: your last commit changes a test fileYour last commit changes test/app.test.js",
  ]);
  expect(
    within(items[1] as HTMLElement).getByText(/These changes are uncommitted/),
  ).toBeInTheDocument();
});

test("a line's own state wins over ok: still being checked, in teal", () => {
  const { container, rerender } = render(
    <CheckLines
      lines={[
        { text: "the tests pass", ok: false, state: "waiting" },
        { text: "the build runs", ok: false },
      ]}
    />,
  );
  const [first, second] = screen.getAllByRole("listitem");
  expect(first).toHaveAttribute("data-state", "waiting");
  expect(first).toHaveTextContent("Checking: the tests pass");
  expect(first?.innerHTML).toContain("text-teal");
  expect(second).toHaveAttribute("data-state", "not-yet");

  // The same line, now met, keeps its place: keyed by position, not words.
  rerender(
    <CheckLines
      lines={[
        { text: "the tests pass", ok: true, state: "pass" },
        { text: "the build runs", ok: false },
      ]}
    />,
  );
  expect(screen.getAllByRole("listitem")[0]).toBe(first);
  expect(first).toHaveAttribute("data-state", "ok");
  for (const node of container.querySelectorAll("[class]"))
    expectStylesFromTokens(node.getAttribute("class") ?? "");
});

test("marks Not yet in amber, never red, from tokens, and staggers the lines", () => {
  const { container } = render(<CheckLines lines={LINES} />);
  const items = screen.getAllByRole("listitem");
  for (const [i, li] of items.entries()) {
    expect(li.style.getPropertyValue("--i")).toBe(String(i));
    expect(li.className).toContain(
      "[animation-delay:calc(var(--i)*var(--stagger))]",
    );
  }
  const notYet = items[1] as HTMLElement;
  expect(notYet).toHaveAttribute("data-state", "not-yet");
  expect(notYet.innerHTML).toContain("text-wait");
  expect(container.innerHTML).not.toMatch(/broken/);
  for (const node of container.querySelectorAll("[class]"))
    expectStylesFromTokens(node.getAttribute("class") ?? "");
});

test("a line keeps its place as it changes; a new key for a new run staggers the lines in again", () => {
  const { container, rerender } = render(
    <CheckLines key="run-1" lines={LINES} />,
  );
  const first = container.querySelector("li");
  rerender(
    <CheckLines
      key="run-1"
      lines={LINES.map((line) => ({ ...line, text: `${line.text}!` }))}
    />,
  );
  expect(container.querySelector("li")).toBe(first);
  rerender(<CheckLines key="run-2" lines={LINES} />);
  const arrived = container.querySelector("li");
  expect(arrived).not.toBe(first);
  expect(arrived?.className).toContain("animate-line");
});
