import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { expectStylesFromTokens } from "../../test/token-classes";
import { Says, type SaysTone } from "./Says";

test("says the status in a polite live region beside Pip", () => {
  const { container } = render(<Says>Watching your Practice copy.</Says>);
  const bubble = screen.getByRole("status");
  expect(bubble).toHaveAttribute("aria-live", "polite");
  expect(bubble).toHaveTextContent("Watching your Practice copy.");
  expect(container.querySelector("[data-pip-placeholder]")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});

test.each<[SaysTone, string]>([
  ["watching", "border-teal-edge"],
  ["checking", "border-accent-edge"],
  ["notYet", "border-wait"],
  ["passed", "border-pass"],
  ["broken", "border-broken"],
])("the %s bubble takes its status colour from tokens", (tone, border) => {
  render(<Says tone={tone}>Status</Says>);
  const bubble = screen.getByRole("status");
  expect(bubble.className).toContain(border);
  expectStylesFromTokens(bubble.className);
});

test("fades the words in again when they change, keeping the live region", () => {
  const { rerender } = render(<Says textKey="a">First</Says>);
  const bubble = screen.getByRole("status");
  const words = bubble.firstElementChild;
  expect(words?.className).toContain("animate-says");
  rerender(<Says textKey="b">Second</Says>);
  expect(screen.getByRole("status")).toBe(bubble);
  expect(bubble.firstElementChild).not.toBe(words);
  expect(bubble).toHaveTextContent("Second");
});
