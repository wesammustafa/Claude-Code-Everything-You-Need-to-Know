import { expect, test } from "vitest";
import { literalMoves } from "../../test/token-classes";

// Components take colour, size, duration and easing from tokens.css only.
const sources = import.meta.glob<string>(
  ["../**/*.{ts,tsx}", "!../**/*.test.{ts,tsx}", "!./tokens.ts"],
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);

// The app's stylesheets other than the token file. The Pip Playground's
// playground.css is development-only tooling with its own board, and Pip's
// contract page (pip/contract-page) is a test page outside src: neither ships.
const stylesheets = import.meta.glob<string>(
  ["../**/*.css", "!../styles/tokens.css", "!../playground/playground.css"],
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);

const LITERALS: readonly [string, RegExp][] = [
  ["a hex colour", /#[0-9a-f]{3,8}\b/i],
  ["a colour function", /\b(rgba?|hsla?|oklch|oklab|lab|lch|hwb|color-mix)\(/],
  ["a length, time or angle", /\b\d+(\.\d+)?(px|rem|em|ms|s|deg|vh|vw|dvh)\b/],
  ["an easing curve", /cubic-bezier\(/],
  // Tailwind still builds a bare-number timing utility (duration-200 is
  // 200ms) with the theme cleared, so it carries no unit for the pattern above.
  ["a bare-number timing utility", /\b(duration|delay)-\[?\d/],
];

// Motion for React takes seconds and curves as bare numbers, so a duration
// or easing written into a transition carries no unit for the patterns
// above. A component reads them from the tokens (src/lib/motion.ts). Out of
// scope: behaviour timers named *_MS (how long Copied shows, when Pip may
// glance), which are not motion, and SVG geometry, which is unitless.
const MOTION_LITERALS: readonly [string, RegExp][] = [
  [
    "a motion number",
    /\b(duration|delay|stiffness|damping|bounce|mass|visualDuration|staggerChildren|delayChildren)\s*:\s*-?\d/,
  ],
  ["an easing array", /\bease\s*:\s*\[/],
];

const found = (
  files: Record<string, string>,
  patterns: readonly [string, RegExp][],
) =>
  Object.entries(files).flatMap(([file, text]) =>
    patterns
      .filter(([, pattern]) => pattern.test(text))
      .map(([what]) => `${file}: ${what}`),
  );

test("the client's source writes no colour, size or duration literal", () => {
  expect(Object.keys(sources).length).toBeGreaterThan(10);
  expect(found(sources, [...LITERALS, ...MOTION_LITERALS])).toEqual([]);
});

test("the app's stylesheets take every colour, size and duration from the token file", () => {
  expect(Object.keys(stylesheets)).toEqual(["../styles/app.css"]);
  expect(found(stylesheets, LITERALS)).toEqual([]);
});

test("a transition's numbers count as literals", () => {
  const caught = (text: string) =>
    MOTION_LITERALS.some(([, pattern]) => pattern.test(text));
  expect(caught("transition={{ duration: 0.2 }}")).toBe(true);
  expect(caught("{ type: 'spring', bounce: 0.3 }")).toBe(true);
  expect(caught("ease: [0.2, 0.8, 0.2, 1]")).toBe(true);
  expect(caught("{ duration: t.base, delay: t.saysDelay, ease: t.out }")).toBe(
    false,
  );
});

test("a timing utility's bare number counts as a literal", () => {
  const caught = (text: string) =>
    LITERALS.some(([, pattern]) => pattern.test(text));
  expect(caught("transition duration-200 ease-out")).toBe(true);
  expect(caught("hover:delay-80")).toBe(true);
  expect(caught("duration-[250]")).toBe(true);
  expect(
    caught(
      "duration-(--duration-fast) [animation-delay:calc(var(--i)*var(--stagger))]",
    ),
  ).toBe(false);
});

test("hover and press move a control only by a motion token", () => {
  expect(
    literalMoves("a hover:scale-106 group-hover:-translate-y-1 b"),
  ).toEqual(["hover:scale-106", "group-hover:-translate-y-1"]);
  expect(
    literalMoves(
      "group-hover:translate-x-(--nudge) hover:-translate-y-(--nudge) enabled:active:scale-(--press-scale) group-disabled:translate-x-1 hover:translate-x-0",
    ),
  ).toEqual([]);
  const moves = Object.entries(sources).flatMap(([file, text]) =>
    literalMoves(text).map((utility) => `${file}: ${utility}`),
  );
  expect(moves).toEqual([]);
});
