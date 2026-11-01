import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { expectStylesFromTokens } from "../../test/token-classes";
import { StepDots } from "./StepDots";

test("reads each step as done, current or to do, and marks the current one", () => {
  render(<StepDots steps={["Look around", "Plan", "Check"]} at={1} />);
  const list = screen.getByRole("list", { name: "Steps" });
  const items = screen.getAllByRole("listitem");
  expect(list).toContainElement(items[0] ?? null);
  expect(items.map((li) => li.textContent)).toEqual([
    "Step 1, Look around: done",
    "Step 2, Plan: current",
    "Step 3, Check: to do",
  ]);
  expect(items[1]).toHaveAttribute("aria-current", "step");
  expect(items.filter((li) => li.hasAttribute("aria-current"))).toHaveLength(1);
  for (const li of items) expectStylesFromTokens(li.className);
});

test("takes each step's state as given, where it is not simply the order", () => {
  render(
    <StepDots
      steps={["Look around", "Plan", "Check"]}
      at={0}
      states={["current", "done", "todo"]}
    />,
  );
  const items = screen.getAllByRole("listitem");
  expect(items.map((li) => li.getAttribute("data-state"))).toEqual([
    "now",
    "done",
    "todo",
  ]);
  expect(items[0]).toHaveAttribute("aria-current", "step");
  expect(items[1]).toHaveTextContent("Step 2, Plan: done");
});
