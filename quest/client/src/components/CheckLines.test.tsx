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
    evidence: "never shown for a met line",
  },
];

test("reads each line with its result, and shows evidence under a line not met yet", () => {
  render(<CheckLines lines={LINES} />);
  const items = screen.getAllByRole("listitem");
  expect(items.map((li) => li.textContent)).toEqual([
    "Passes: the tests pass",
    "Not yet: nothing is left uncommittedThese changes are uncommitted: test/external.test.js",
    "Passes: your last commit changes a test file",
  ]);
  expect(
    within(items[1] as HTMLElement).getByText(/These changes are uncommitted/),
  ).toBeInTheDocument();
  expect(
    screen.queryByText("never shown for a met line"),
  ).not.toBeInTheDocument();
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
