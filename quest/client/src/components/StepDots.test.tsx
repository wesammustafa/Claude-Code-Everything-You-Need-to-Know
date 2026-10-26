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
