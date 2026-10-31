import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test } from "vitest";
import {
  expectStylesFromTokens,
  stateUtilities,
} from "../../test/token-classes";
import { Segmented } from "./Segmented";

type Theme = "system" | "dark" | "light";

function Harness() {
  const [value, setValue] = useState<Theme>("system");
  return (
    <Segmented<Theme>
      legend="Theme"
      value={value}
      onChange={setValue}
      options={[
        { value: "system", label: "System" },
        { value: "dark", label: "Dark" },
        { value: "light", label: "Light" },
      ]}
    />
  );
}

test("is a named group of radios: Tab reaches the choice, the arrows move it", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const group = screen.getByRole("group", { name: "Theme" });
  const system = screen.getByRole("radio", { name: "System" });
  expect(group).toContainElement(system);
  expect(system).toBeChecked();

  await user.tab();
  expect(system).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Dark" })).toHaveFocus();
  await user.click(screen.getByText("Light"));
  expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
});

test("lifts the chosen one on a surface fill with a line ring, every state from tokens", () => {
  render(<Harness />);
  const chosen = screen.getByRole("radio", { name: "System" }).closest("label");
  const other = screen.getByRole("radio", { name: "Dark" }).closest("label");
  expect(chosen).toHaveClass(
    "bg-surface",
    "shadow-sm",
    "ring-line",
    "text-text",
  );
  expect(other).toHaveClass("text-muted");
  expect(other).not.toHaveClass("bg-surface");
  for (const label of [chosen, other]) {
    const classes = label?.className ?? "";
    expect(stateUtilities(classes, "has-focus-visible")).toEqual(
      expect.arrayContaining([
        "outline-2",
        "outline-offset-2",
        "outline-focus",
      ]),
    );
    expectStylesFromTokens(classes);
  }
});
