import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Notice } from "./Notice";

test("keeps an empty polite live region in the page's flow while connected", () => {
  const { container } = render(<Notice kind={null} />);
  const region = screen.getByRole("status");
  expect(region).toHaveAttribute("aria-live", "polite");
  expect(region).toBeEmptyDOMElement();
  // In flow, not a fixed layer: the screen moves down beneath a notice.
  expect(container).toContainElement(region);
  expect(region.className).not.toMatch(/\b(fixed|absolute)\b/);
});

test("says Reconnecting in the same live region", () => {
  const { rerender } = render(<Notice kind={null} />);
  const region = screen.getByRole("status");
  rerender(<Notice kind="reconnecting" />);
  expect(screen.getByRole("status")).toBe(region);
  expect(region).toHaveTextContent(
    "Reconnecting to Claude Code QuestYour place is saved.",
  );
});

test("when stopped, shows how to start again with Copy, the command at its own width", () => {
  const { container } = render(<Notice kind="stopped" />);
  expect(screen.getByText(/Claude Code Quest stopped/)).toBeInTheDocument();
  const copy = screen.getByRole("button", { name: "Copy npm run learn" });
  const command = copy.parentElement;
  expect(command?.classList).toContain("w-fit");
  expect(command?.classList).not.toContain("w-full");
  // The pause icon and the sentence wrap as one piece, so the icon never stands alone.
  const sentence = screen.getByText(/Claude Code Quest stopped/);
  expect(sentence.parentElement?.querySelector("svg")).not.toBeNull();
  expect(container.querySelector("[data-notice=stopped]")).not.toBeNull();
});
