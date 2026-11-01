import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { expectStylesFromTokens } from "../../test/token-classes";
import { Tier } from "./Tier";

const pipsOf = (chip: Element | null) =>
  [...(chip?.querySelectorAll("i") ?? [])].map((i) =>
    i.hasAttribute("data-on"),
  );

test.each([
  ["guided", "Guided", [true, true, true]],
  ["hinted", "Hinted", [true, true, false]],
  ["challenge", "Challenge", [true, false, false]],
] as const)(
  "the %s tier reads %s, with its filled pips",
  (tier, label, pips) => {
    const { container } = render(<Tier tier={tier} />);
    const chip = container.querySelector(`[data-tier=${tier}]`);
    expect(chip).toHaveTextContent(label);
    expect(pipsOf(chip)).toEqual(pips);
    // The words carry it; the pips are drawn for the eye only.
    expect(chip?.querySelector("[aria-hidden=true]")).toContainElement(
      chip?.querySelector("i") ?? null,
    );
  },
);

test.each([
  ["commands", "Every command shown", 3],
  ["hints", "With hints", 2],
  ["own", "On your own", 1],
] as const)("the Mastery chip %s reads %s", (mastery, words, filled) => {
  const { container } = render(<Tier mastery={mastery} />);
  expect(container).toHaveTextContent(words);
  expect(pipsOf(container.firstElementChild).filter(Boolean)).toHaveLength(
    filled,
  );
});

test("one hue: on-pips in the accent text colour, the rest in the mark colour, all from tokens", () => {
  const { container } = render(<Tier tier="hinted" note="Two hints ready" />);
  expect(screen.getByText("Two hints ready")).toHaveClass("text-muted");
  const [on, , off] = container.querySelectorAll("i");
  expect(on).toHaveClass("bg-accent-text");
  expect(off).toHaveClass("bg-mark");
  for (const node of container.querySelectorAll("[class]"))
    expectStylesFromTokens(node.getAttribute("class") ?? "");
});

test("its words keep the copy rules", () => {
  const { container } = render(
    <>
      <Tier tier="guided" />
      <Tier tier="hinted" />
      <Tier tier="challenge" />
      <Tier mastery="commands" />
      <Tier mastery="hints" />
      <Tier mastery="own" />
    </>,
  );
  expect(container.textContent).not.toMatch(/key|press|stuck|wrong|fail/i);
  expect(container.textContent).not.toContain(String.fromCodePoint(0x2014));
});
