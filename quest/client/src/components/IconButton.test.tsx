import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import {
  expectStylesFromTokens,
  stateUtilities,
} from "../../test/token-classes";
import { IconButton } from "./IconButton";

test("is named by its label and operated from the keyboard", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(<IconButton icon="gear" label="Settings" onClick={onClick} />);
  const button = screen.getByRole("button", { name: "Settings" });
  expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  await user.tab();
  expect(button).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(onClick).toHaveBeenCalledOnce();
});

test("draws hover, pressed, focus and disabled from tokens", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(<IconButton icon="close" label="Close" disabled onClick={onClick} />);
  const button = screen.getByRole("button", { name: "Close" });
  const classes = button.className;
  expectStylesFromTokens(classes);
  expect(stateUtilities(classes, "hover")).toEqual(
    expect.arrayContaining(["bg-surface-2", "text-text"]),
  );
  expect(stateUtilities(classes, "active")).toEqual(
    expect.arrayContaining(["bg-pressed", "translate-y-(--press-y)"]),
  );
  expect(stateUtilities(classes, "focus-visible")).toContain("outline-focus");
  expect(stateUtilities(classes, "disabled")).toContain("opacity-disabled");
  expect(button).toBeDisabled();
  await user.click(button);
  expect(onClick).not.toHaveBeenCalled();
});
