// Reads a component's Tailwind classes against tokens.css: which utilities a
// state applies, and whether every colour and opacity they use is a token.
import { expect } from "vitest";
import css from "../src/styles/tokens.css?raw";
import { themes } from "../src/tokens/tokens";

const declared = [...themes(css).dark.keys()];
const COLORS = new Set(
  declared
    .filter((n) => n.startsWith("--color-"))
    .map((n) => n.slice("--color-".length)),
);
const TEXT_SIZES = new Set(
  declared
    .filter((n) => n.startsWith("--text-") && !n.includes("--line-height"))
    .map((n) => n.slice("--text-".length)),
);
const OPACITIES = new Set(
  declared
    .filter((n) => n.startsWith("--opacity-"))
    .map((n) => n.slice("--opacity-".length)),
);
const KEYWORDS = new Set(["transparent", "inherit", "current"]);

export type State =
  | "hover"
  | "active"
  | "focus-visible"
  | "disabled"
  // A control drawn around a hidden native input (a radio) rings when the input has keyboard focus.
  | "has-focus-visible";

/** The utilities a class list applies in one state, with their variants stripped. */
export function stateUtilities(className: string, state: State): string[] {
  return className
    .split(/\s+/)
    .filter((u) => u.split(":").slice(0, -1).includes(state))
    .map((u) => u.split(":").at(-1) ?? "");
}

// The colour a utility sets, and the property it sets it on, if any.
function colorOf(
  utility: string,
): { property: string; name: string } | undefined {
  // Border widths and sides, such as border-b or border-l-3, set no colour.
  if (/^border(-[trblxy])?(-\d+)?$/.test(utility)) return undefined;
  const m =
    /^-?(bg|text|border(?:-[trblxy])?|outline|fill|stroke|ring|from|to|via)-(.+?)(\/\d+)?$/.exec(
      utility,
    );
  const [, kind, name] = m ?? [];
  if (kind === undefined || name === undefined) return undefined;
  if (kind === "text" && TEXT_SIZES.has(name)) return undefined;
  if (
    /^[\d.]+$/.test(name) ||
    name.startsWith("(") ||
    name.startsWith("linear") ||
    name.startsWith("[")
  )
    return undefined;
  if (
    kind === "outline" &&
    /^(offset|none|hidden|dashed|dotted|double|solid)/.test(name)
  )
    return undefined;
  if (kind.startsWith("border") && /^(solid|dashed|none)$/.test(name))
    return undefined;
  return { property: kind, name };
}

/**
 * Fails unless every colour and opacity in the class list is a token from
 * tokens.css, and no state sets two colours on the same property (Tailwind's
 * output order, not the class list, would pick the one that shows).
 */
export function expectStylesFromTokens(className: string): void {
  const setBy = new Map<string, string>();
  for (const utility of className.split(/\s+/).filter(Boolean)) {
    const variants = utility.split(":");
    const base = variants.pop() ?? "";
    const opacity = /^opacity-(.+)$/.exec(base)?.[1];
    if (opacity !== undefined)
      expect(OPACITIES, `${utility} names no opacity token`).toContain(opacity);
    const color = colorOf(base);
    if (color === undefined) continue;
    const slot = `${variants.sort().join(":")} ${color.property}`;
    const earlier = setBy.get(slot);
    expect(
      earlier,
      `${earlier ?? ""} and ${utility} both set ${color.property} colour`,
    ).toBeUndefined();
    setBy.set(slot, utility);
    if (KEYWORDS.has(color.name)) continue;
    expect(COLORS, `${utility} names no colour token`).toContain(color.name);
  }
}

// A hover or press that moves a control takes its travel from a motion token
// (--press-y, --press-scale, --hover-scale, --nudge), which reduced motion
// sets to none. A literal such as hover:scale-106 would still move.
export function literalMoves(text: string): string[] {
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
