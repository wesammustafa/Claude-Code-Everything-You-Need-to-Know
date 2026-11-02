import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { expectStylesFromTokens } from "../../test/token-classes";
import { HELP_OFFER_TEXT, HelpOffer } from "./HelpOffer";

const none = () => undefined;

test("offers the hint in words that never judge, with a button that opens it", async () => {
  const user = userEvent.setup();
  const onShowHint = vi.fn();
  const onDismiss = vi.fn();
  const { container } = render(
    <HelpOffer open onShowHint={onShowHint} onDismiss={onDismiss} />,
  );
  expect(container).toHaveTextContent(HELP_OFFER_TEXT);
  await user.click(screen.getByRole("button", { name: "Show the hint" }));
  expect(onShowHint).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "Not now" }));
  expect(onDismiss).toHaveBeenCalledOnce();
});

test("its words keep the copy rules", () => {
  const { container } = render(
    <HelpOffer open onShowHint={none} onDismiss={none} />,
  );
  const words = container.textContent;
  // App words: no Claude Code fact, no key, no judging, no em dash.
  expect(words).not.toMatch(/claude|key|press|stuck|wrong|fail/i);
  expect(words).not.toContain(String.fromCodePoint(0x2014));
});

test("closed, only its empty live region is on the page", () => {
  const { container } = render(
    <HelpOffer open={false} onShowHint={none} onDismiss={none} />,
  );
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  expect(container.querySelector("[data-help-offer]")).toBeNull();
  expect(container).toHaveTextContent("");
});

test("its own region says the offer as it opens, holds no control, and clears as it closes", () => {
  const { rerender } = render(
    <HelpOffer open={false} onShowHint={none} onDismiss={none} />,
  );
  const region = screen.getByRole("status");
  rerender(<HelpOffer open onShowHint={none} onDismiss={none} />);
  expect(screen.getByRole("status")).toBe(region);
  expect(region).toHaveTextContent(HELP_OFFER_TEXT);
  expect(region.querySelector("button")).toBeNull();
  // The words show once to a screen reader: the visible line is hidden from it.
  expect(screen.getAllByText(HELP_OFFER_TEXT)).toHaveLength(2);
  for (const el of screen.getAllByText(HELP_OFFER_TEXT))
    if (el !== region) expect(el).toHaveAttribute("aria-hidden", "true");
  rerender(<HelpOffer open={false} onShowHint={none} onDismiss={none} />);
  expect(region).toBeEmptyDOMElement();
});

test("its height opens and closes from tokens, and only fades under reduced motion", () => {
  const { container } = render(
    <HelpOffer open onShowHint={none} onDismiss={none} />,
  );
  const box = container.querySelector<HTMLElement>("[data-help-offer]");
  const classes = box?.className ?? "";
  expect(classes).toContain("transition-[grid-template-rows,opacity]");
  expect(classes).toContain("duration-(--duration-slow)");
  expect(classes).toContain("starting:grid-rows-[0fr]");
  expect(classes).toContain("reduced:transition-opacity");
  expectStylesFromTokens(classes);
});

test("closing, it stays as it was, inert, until its transitions end, then leaves", async () => {
  let finish: () => void = () => undefined;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  // jsdom runs no transitions: this one runs until the test finishes it.
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [{ finished } as unknown as Animation],
  });
  const { container, rerender } = render(
    <HelpOffer open onShowHint={none} onDismiss={none} />,
  );
  const box = container.querySelector("[data-help-offer]");
  rerender(<HelpOffer open={false} onShowHint={none} onDismiss={none} />);
  // The same box, not re-inserted, while it closes.
  expect(container.querySelector("[data-help-offer]")).toBe(box);
  expect(box).toHaveAttribute("data-help-offer", "leaving");
  expect(box).toHaveAttribute("inert");
  expect(box?.className).toContain("grid-rows-[0fr]");
  await act(async () => {
    finish();
    await finished;
  });
  expect(container.querySelector("[data-help-offer]")).toBeNull();
  expect(container).toHaveTextContent("");
  Reflect.deleteProperty(Element.prototype, "getAnimations");
});
