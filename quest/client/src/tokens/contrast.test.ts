import { describe, expect, test } from "vitest";
import css from "../styles/tokens.css?raw";
import { contrast, resolveColor, themes, type Theme } from "./tokens";

// Every pairing the components draw, ported from the design-system
// prototype's contrast check and widened to each state's fill. WCAG 2.2 AA:
// 4.5:1 for text (1.4.3), 3:1 for focus rings, icons and other non-text
// marks (1.4.11); code text keeps the prototype's 7:1.
const TEXT = 4.5;
const NON_TEXT = 3;
const CODE = 7;

const PAIRS: readonly (readonly [fg: string, bg: string, need: number])[] = [
  ...["bg", "surface", "surface-2", "accent-soft"].flatMap((bg) => [
    ["text", bg, TEXT] as const,
    ["muted", bg, TEXT] as const,
  ]),
  ["text", "pressed", TEXT],
  ["accent-text", "bg", TEXT],
  ["accent-text", "surface", TEXT],
  ["accent-text", "surface-2", TEXT],
  ["accent-ink", "accent", TEXT],
  ["accent-ink", "accent-hover", TEXT],
  ["accent-ink", "accent-pressed", TEXT],
  ...["teal", "pass", "wait", "broken"].flatMap((status) => [
    [status, `${status}-soft`, TEXT] as const,
    ["text", `${status}-soft`, TEXT] as const,
    [status, "surface", NON_TEXT] as const,
  ]),
  ["wait", "surface-2", NON_TEXT],
  // Marks that carry a state or are a control's only edge: the selected Level
  // card's border (ringed by accent-soft), the current lesson node and step
  // dot, done step dots, to-do step dots and the other lesson nodes' edges.
  ...["bg", "surface", "surface-2", "accent-soft"].map(
    (bg) => ["accent-mark", bg, NON_TEXT] as const,
  ),
  ...["bg", "surface", "surface-2"].map(
    (bg) => ["mark", bg, NON_TEXT] as const,
  ),
  ["pass", "bg", NON_TEXT],
  // A ProgressBar's pass fill, and a Switch's thumb on its coral track.
  ["pass", "surface-2", NON_TEXT],
  ["accent-ink", "accent-mark", NON_TEXT],
  ["code-text", "code-bg", CODE],
  ["code-text", "code-control", TEXT],
  ["code-text", "code-control-hover", TEXT],
  ["code-muted", "code-bg", TEXT],
  ["focus", "bg", NON_TEXT],
  ["focus", "surface", NON_TEXT],
  ["focus", "surface-2", NON_TEXT],
  // The ring drawn on the accent-soft halo of the selected Level and the
  // current lesson, and on the Next band's fill.
  ["focus", "accent-soft", NON_TEXT],
  ["focus-on-code", "code-bg", NON_TEXT],
  ["focus-on-code", "code-control", NON_TEXT],
];

const tokens = themes(css);

describe.each<Theme>(["dark", "light"])("the %s theme", (theme) => {
  const measure = (fg: string, bg: string) =>
    contrast(
      resolveColor(tokens[theme], `--color-${fg}`),
      resolveColor(tokens[theme], `--color-${bg}`),
    );

  test.each(PAIRS)("%s on %s reaches %s:1", (fg, bg, need) => {
    expect(measure(fg, bg)).toBeGreaterThanOrEqual(need);
  });

  test("defines every colour the dark theme does", () => {
    for (const name of tokens.dark.keys()) {
      if (name.startsWith("--color-"))
        expect(() => resolveColor(tokens[theme], name)).not.toThrow();
    }
  });
});

describe("the measurement", () => {
  test("matches WCAG's own end points", () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrast([118, 118, 118], [255, 255, 255])).toBeCloseTo(4.54, 2);
  });

  test("fails a pairing below AA", () => {
    // Board coral carries no text on white: 2.6:1.
    expect(contrast([0xff, 0x78, 0x4e], [0xff, 0xff, 0xff])).toBeLessThan(TEXT);
  });

  test("the light theme sets only colours the dark theme has", () => {
    const lightColors = [...tokens.light.keys()].filter((name) =>
      name.startsWith("--color-"),
    );
    expect(lightColors.filter((name) => !tokens.dark.has(name))).toEqual([]);
    expect(tokens.light.get("--color-text")).not.toBe(
      tokens.dark.get("--color-text"),
    );
  });
});
