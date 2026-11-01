import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test } from "vitest";
import {
  expectStylesFromTokens,
  stateUtilities,
} from "../../test/token-classes";
import { Switch } from "./Switch";

function Harness() {
  const [on, setOn] = useState(false);
  return <Switch label="Reduce motion" checked={on} onChange={setOn} />;
}

test("is a named switch, turned on and off from the keyboard", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const toggle = screen.getByRole("switch", { name: "Reduce motion" });
  expect(toggle).toHaveAttribute("aria-checked", "false");
  await user.tab();
  expect(toggle).toHaveFocus();
  expect(stateUtilities(toggle.className, "focus-visible")).toEqual(
    expect.arrayContaining(["outline-2", "outline-offset-2", "outline-focus"]),
  );
  await user.keyboard(" ");
  expect(toggle).toHaveAttribute("aria-checked", "true");
  await user.keyboard("{Enter}");
  expect(toggle).toHaveAttribute("aria-checked", "false");
});

test("off, an outline in the mark colour; on, coral with the thumb across; all from tokens", async () => {
  const user = userEvent.setup();
  const { container } = render(<Harness />);
  const track = () => container.querySelector("[data-track]");
  const thumb = () => container.querySelector("[data-thumb]");
  expect(track()).toHaveClass("border-mark");
  expect(thumb()).not.toHaveClass("translate-x-(--switch-travel)");
  await user.click(screen.getByRole("switch"));
  expect(track()).toHaveClass("border-accent-mark", "bg-accent-mark");
  expect(thumb()).toHaveClass("translate-x-(--switch-travel)");
  expect(track()?.className).toContain("duration-(--duration-fast)");
  // Under reduced motion the thumb snaps: only its colour transitions.
  expect(thumb()?.className).toContain("reduced:transition-[background-color]");
  for (const node of container.querySelectorAll("[class]"))
    expectStylesFromTokens(node.getAttribute("class") ?? "");
});
