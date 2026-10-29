import { expect, test } from "vitest";

// Components take colour, size, duration and easing from tokens.css only.
const sources = import.meta.glob<string>(
  ["../**/*.{ts,tsx}", "!../**/*.test.{ts,tsx}", "!./tokens.ts"],
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
];

test("the client's source writes no colour, size or duration literal", () => {
  const files = Object.keys(sources);
  expect(files.length).toBeGreaterThan(10);
  const found = Object.entries(sources).flatMap(([file, text]) =>
    LITERALS.filter(([, pattern]) => pattern.test(text)).map(
      ([what]) => `${file}: ${what}`,
    ),
  );
  expect(found).toEqual([]);
});

// A hover or press that moves a control takes its travel from a motion token
// (--press-y, --press-scale, --hover-scale, --nudge), which reduced motion
// sets to none. A literal such as hover:scale-106 would still move.
function literalMoves(text: string): string[] {
  return text.split(/[\s"'`]+/).filter((utility) => {
    const variants = utility.split(":");
    const base = variants.pop() ?? "";
    if (!variants.some((v) => /(^|-)(hover|active)$/.test(v))) return false;
    const value = /^-?(?:scale|rotate|skew|translate)(?:-[xyz])?-(.+)$/.exec(
      base,
    )?.[1];
    return value !== undefined && value !== "0" && !value.startsWith("(--");
  });
}

test("hover and press move a control only by a motion token", () => {
  expect(
    literalMoves("a hover:scale-106 group-hover:-translate-y-1 b"),
  ).toEqual(["hover:scale-106", "group-hover:-translate-y-1"]);
  expect(
    literalMoves(
      "group-hover:translate-x-(--nudge) hover:-translate-y-(--nudge) enabled:active:scale-(--press-scale) group-disabled:translate-x-1 hover:translate-x-0",
    ),
  ).toEqual([]);
  const found = Object.entries(sources).flatMap(([file, text]) =>
    literalMoves(text).map((utility) => `${file}: ${utility}`),
  );
  expect(found).toEqual([]);
});
