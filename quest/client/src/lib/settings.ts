// The Settings choices, kept in this browser only: the theme and the motion
// choice live on <html> (data-theme, data-motion), where tokens.css and
// page.ts read them, and "system" is the absent attribute and the absent key.

export type ThemeChoice = "system" | "dark" | "light";
export type MotionChoice = "system" | "reduce" | "full";

const THEME_KEY = "quest.theme";
const MOTION_KEY = "quest.motion";
const THEMES: readonly ThemeChoice[] = ["system", "dark", "light"];
const MOTIONS: readonly MotionChoice[] = ["system", "reduce", "full"];

function read<C extends string>(
  key: string,
  known: readonly C[],
): C | "system" {
  try {
    const stored = localStorage.getItem(key);
    return known.find((choice) => choice === stored) ?? "system";
  } catch {
    return "system";
  }
}

function setAttribute(attribute: "theme" | "motion", choice: string): void {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute(`data-${attribute}`);
  else root.setAttribute(`data-${attribute}`, choice);
}

function apply<C extends string>(
  attribute: "theme" | "motion",
  key: string,
  known: readonly C[],
  choice: C,
): void {
  if (!known.includes(choice)) return;
  setAttribute(attribute, choice);
  // A storage failure (a private window, blocked site data) keeps the choice
  // for this page only.
  try {
    if (choice === "system") localStorage.removeItem(key);
    else localStorage.setItem(key, choice);
  } catch {
    // The attribute is already applied.
  }
}

export function readTheme(): ThemeChoice {
  return read(THEME_KEY, THEMES);
}

export function readMotion(): MotionChoice {
  return read(MOTION_KEY, MOTIONS);
}

export function applyTheme(choice: ThemeChoice): void {
  apply("theme", THEME_KEY, THEMES, choice);
}

export function applyMotion(choice: MotionChoice): void {
  apply("motion", MOTION_KEY, MOTIONS, choice);
}

/** Puts the stored choices back on <html> before the first render; writes nothing. */
export function restoreSettings(): void {
  setAttribute("theme", readTheme());
  setAttribute("motion", readMotion());
}
