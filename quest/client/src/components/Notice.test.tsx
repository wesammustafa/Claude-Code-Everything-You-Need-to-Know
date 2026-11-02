import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { Notice } from "./Notice";

const region = () =>
  document.querySelector<HTMLElement>("[data-notice-region]");

test("keeps an empty polite live region in <body>, kept live, while connected; the strip stays in the page's flow", () => {
  const { container } = render(<Notice kind={null} />);
  const live = screen.getByRole("status");
  expect(live).toBe(region());
  expect(live).toHaveAttribute("aria-live", "polite");
  expect(live).toHaveAttribute("data-keep-live");
  expect(live).toBeEmptyDOMElement();
  // Beside the page, so a Panel's inert page never silences it (268).
  expect(live.parentElement).toBe(document.body);
  expect(container).not.toContainElement(live);
  // The strip is in flow, not a fixed layer: the screen moves down beneath a notice.
  const strip = container.querySelector<HTMLElement>("[data-notice-strip]");
  expect(strip).not.toBeNull();
  expect(strip?.className ?? "").not.toMatch(/\b(fixed|absolute)\b/);
});

test("says Reconnecting in the same live region, as a sentence, and the strip shows it", () => {
  const { container, rerender } = render(<Notice kind={null} />);
  const live = screen.getByRole("status");
  rerender(<Notice kind="reconnecting" />);
  expect(region()).toBe(live);
  expect(live).toHaveTextContent(
    "Reconnecting to Claude Code Quest. Your place is saved.",
  );
  expect(
    container.querySelector("[data-notice=reconnecting]"),
  ).toHaveTextContent("Reconnecting to Claude Code Quest.Your place is saved.");
  // The strip's words are not a second live region.
  expect(screen.getAllByRole("status")).toEqual([live]);
});

test("when stopped, shows how to start again with Copy, the command at its own width", () => {
  const { container } = render(<Notice kind="stopped" />);
  const strip = within(container);
  expect(strip.getByText(/Claude Code Quest stopped/)).toBeInTheDocument();
  const copy = screen.getByRole("button", { name: "Copy npm run learn" });
  const command = copy.parentElement;
  expect(command?.classList).toContain("w-fit");
  expect(command?.classList).not.toContain("w-full");
  // The pause icon and the sentence wrap as one piece, so the icon never stands alone.
  const sentence = strip.getByText(/Claude Code Quest stopped/);
  expect(sentence.parentElement?.querySelector("svg")).not.toBeNull();
  expect(container.querySelector("[data-notice=stopped]")).not.toBeNull();
});

test("when stopped, the region says how to start again, and Copy is said by the Copy's own region alone", async () => {
  const user = userEvent.setup();
  render(<Notice kind="stopped" />);
  const live = region();
  expect(live).toHaveTextContent(
    "Claude Code Quest stopped. Start it again in your terminal: npm run learn",
  );
  await user.click(screen.getByRole("button", { name: "Copy npm run learn" }));
  await screen.findByRole("button", { name: "Copied" });
  const copied = screen
    .getAllByRole("status")
    .filter((el) => el.textContent.includes("Copied"));
  expect(copied).toHaveLength(1);
  expect(copied[0]).not.toBe(live);
  expect(live).not.toHaveTextContent("Copied");
});
