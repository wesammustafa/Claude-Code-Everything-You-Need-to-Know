import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import {
  expectStylesFromTokens,
  stateUtilities,
} from "../../test/token-classes";
import { Disclosure } from "./Disclosure";

test("is a native disclosure: Tab reaches its summary, which opens and closes it", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <Disclosure
      summary="What the check looks for"
      count={{ value: 3, label: "3 lines" }}
    >
      <p>The Check's lines.</p>
    </Disclosure>,
  );
  const details = container.querySelector("details");
  const summary = container.querySelector("summary");
  // The number shows; a screen reader hears what it counts.
  expect(summary).toHaveTextContent("What the check looks for3, 3 lines");
  expect(summary?.querySelector("[aria-hidden]")).toHaveTextContent(/^3$/);
  expect(screen.getByText(", 3 lines")).toHaveClass("sr-only");
  expect(details).not.toHaveAttribute("open");
  await user.tab();
  expect(summary).toHaveFocus();
  expect(stateUtilities(summary?.className ?? "", "focus-visible")).toEqual(
    expect.arrayContaining(["outline-2", "outline-offset-2", "outline-focus"]),
  );
  // Enter and Space on a summary are the browser's own (jsdom has neither):
  // shell.spec.ts opens and closes one with them in Chromium.
  await user.click(summary as HTMLElement);
  expect(details).toHaveAttribute("open");
  expect(screen.getByText("The Check's lines.")).toBeVisible();
  await user.click(summary as HTMLElement);
  expect(details).not.toHaveAttribute("open");
});

test.each(["card", "quiet"] as const)(
  "the %s variant turns its chevron over --duration-turn and fades its body, from tokens",
  (variant) => {
    const { container } = render(
      <Disclosure summary="More" variant={variant}>
        Body
      </Disclosure>,
    );
    expect(container.querySelector("details")).toHaveAttribute(
      "data-disclosure",
      variant,
    );
    const chevron = container.querySelector("summary svg");
    expect(chevron?.getAttribute("class")).toContain(
      "duration-(--duration-turn)",
    );
    expect(chevron?.getAttribute("class")).toContain(
      "group-open/details:rotate-90",
    );
    expect(container.querySelector("summary + div")).toHaveClass(
      "animate-fade",
    );
    for (const node of container.querySelectorAll("[class]"))
      expectStylesFromTokens(node.getAttribute("class") ?? "");
  },
);
