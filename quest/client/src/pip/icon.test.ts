import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import favicon from "../../public/favicon.svg?raw";
import css from "../styles/tokens.css?raw";
import {
  contrast,
  resolveColor,
  themes,
  type Rgb,
  type Theme,
} from "../tokens/tokens";
import {
  PIP_ICON_GROUND,
  PIP_ICON_PARTS,
  PIP_ICON_TOKENS,
  PIP_ICON_VIEW_BOX,
  type PipIconTone,
} from "./icon";
import { PipIcon } from "./PipIcon";

// Pip's icon in its two forms, the favicon file and the inline PipIcon,
// measured from the colours each actually paints. WCAG 2.2 AA 1.4.11: the
// icon's marks reach 3:1 against every surface it sits on in both themes, and
// the eyes 3:1 against the face.
const NON_TEXT = 3;
const SURFACES = ["bg", "surface", "surface-2"] as const;
const MAX_BYTES = 50 * 1024;
const TONES = Object.keys(PIP_ICON_TOKENS) as PipIconTone[];

const tokens = themes(css);
const token = (theme: Theme, name: string): Rgb =>
  resolveColor(tokens[theme], `--color-${name}`);

function hex(value: string): Rgb {
  const m = /^#([0-9a-f]{6})$/i.exec(value);
  if (m?.[1] === undefined) throw new Error(`not a six-digit hex: ${value}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const parse = (svg: string) =>
  new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;

/** The favicon's fill for each tone: the dark theme's, then the light theme's. */
function faviconPalette(): Record<Theme, Map<string, Rgb>> {
  const style = parse(favicon).querySelector("style")?.textContent ?? "";
  const [dark = "", light = ""] = style.split(
    "@media (prefers-color-scheme: light)",
  );
  const fills = (rules: string) =>
    new Map(
      [...rules.matchAll(/\.([\w-]+)\s*\{\s*fill:\s*(#[0-9a-f]+);\s*\}/gi)].map(
        ([, tone = "", value = ""]) => [tone, hex(value)] as const,
      ),
    );
  return { dark: fills(dark), light: fills(light) };
}

/** The inline icon's fill for each tone, resolved from the utility each part uses. */
function inlinePalette(theme: Theme): Map<string, Rgb> {
  const svg = parse(renderToStaticMarkup(createElement(PipIcon)));
  const found = new Map<string, Rgb>();
  [...svg.querySelectorAll("path")].forEach((path, i) => {
    const part = PIP_ICON_PARTS[i];
    const name = /(?:^|\s)fill-([\w-]+)/.exec(
      path.getAttribute("class") ?? "",
    )?.[1];
    if (part === undefined || name === undefined)
      throw new Error(`path ${String(i)} has no part or no fill utility`);
    found.set(part.tone, token(theme, name));
  });
  return found;
}

function measureMarks(palette: Map<string, Rgb>, theme: Theme) {
  const color = (tone: string) => {
    const rgb = palette.get(tone);
    if (rgb === undefined) throw new Error(`no colour for ${tone}`);
    return rgb;
  };
  return TONES.flatMap((tone) => {
    const ground = PIP_ICON_GROUND[tone];
    const grounds =
      ground === null
        ? SURFACES.map((s) => [s, token(theme, s)] as const)
        : [[ground, color(ground)] as const];
    return grounds.map(([on, rgb]) => ({
      mark: `${tone} on ${on}`,
      ratio: contrast(color(tone), rgb),
    }));
  });
}

describe.each<Theme>(["dark", "light"])("in the %s theme", (theme) => {
  test("the favicon's marks reach 3:1 on every surface, and the eyes on the face", () => {
    const marks = measureMarks(faviconPalette()[theme], theme);
    expect(marks).toHaveLength(SURFACES.length * 2 + 1);
    for (const { mark, ratio } of marks)
      expect(ratio, mark).toBeGreaterThanOrEqual(NON_TEXT);
  });

  test("the inline icon's marks reach 3:1 on every surface, and the eyes on the face", () => {
    for (const { mark, ratio } of measureMarks(inlinePalette(theme), theme))
      expect(ratio, mark).toBeGreaterThanOrEqual(NON_TEXT);
  });

  test("the favicon paints the same colours as the tokens", () => {
    const palette = faviconPalette()[theme];
    expect([...palette.keys()].sort()).toEqual([...TONES].sort());
    for (const tone of TONES)
      expect(palette.get(tone), tone).toEqual(
        token(theme, PIP_ICON_TOKENS[tone]),
      );
  });
});

describe("the favicon", () => {
  test("draws the same parts as PipIcon, in the same order", () => {
    const svg = parse(favicon);
    expect(svg.getAttribute("viewBox")).toBe(PIP_ICON_VIEW_BOX);
    expect(
      [...svg.querySelectorAll("path")].map((path) => ({
        tone: path.getAttribute("class"),
        d: path.getAttribute("d"),
      })),
    ).toEqual(PIP_ICON_PARTS);
  });

  test("puts every coordinate on an even unit of the 32 grid", () => {
    // Absolute moves and lines and relative h and v steps alike: with every
    // number even, each edge falls on a whole pixel at 16 and 32 px.
    expect(PIP_ICON_VIEW_BOX).toBe("0 0 32 32");
    for (const { d } of PIP_ICON_PARTS) {
      const numbers = d.match(/-?\d+(?:\.\d+)?/g) ?? [];
      expect(numbers.length, d).toBeGreaterThan(0);
      for (const n of numbers)
        expect(Number(n) % 2 === 0, `${n} in ${d}`).toBe(true);
    }
  });

  test("is at most 50 KB, with no embedded raster or outside reference", () => {
    expect(new TextEncoder().encode(favicon).length).toBeLessThanOrEqual(
      MAX_BYTES,
    );
    const svg = parse(favicon);
    expect(svg.querySelector("parsererror")).toBeNull();
    expect(
      svg.querySelectorAll("image, foreignObject, use, script"),
    ).toHaveLength(0);
    expect(favicon).not.toMatch(/href|data:|base64|url\(|@import/i);
  });
});

describe("the inline icon", () => {
  const markup = renderToStaticMarkup(createElement(PipIcon));

  test("is at most 50 KB, with no embedded raster or outside reference", () => {
    expect(new TextEncoder().encode(markup).length).toBeLessThanOrEqual(
      MAX_BYTES,
    );
    expect(
      parse(markup).querySelectorAll("image, foreignObject, use"),
    ).toHaveLength(0);
    expect(markup).not.toMatch(/href|data:|base64|url\(/i);
  });
});
