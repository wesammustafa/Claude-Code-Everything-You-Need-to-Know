// Motion for the component tests: the motion tokens on :root as tokens.css
// declares them, the system's reduced-motion setting, the Settings switch,
// and a render wrapped in the app's own QuestMotion.
import { act, render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, vi } from "vitest";
import { QuestMotion } from "../src/components/QuestMotion";
import css from "../src/styles/tokens.css?raw";
import { fullMotion, reducedMotion, themes } from "../src/tokens/tokens";

const styles: HTMLStyleElement[] = [];
let injected = false;

function addStyle(text: string): void {
  const style = document.createElement("style");
  style.textContent = text;
  document.head.append(style);
  styles.push(style);
}

const rules = (declarations: ReadonlyMap<string, string>) =>
  [...declarations].map(([name, value]) => `${name}: ${value};`).join(" ");

// The easings live in @theme, which Tailwind writes onto :root.
const easings = new Map(
  [...themes(css).dark].filter(([name]) => name.startsWith("--ease-")),
);

/**
 * The :root motion tokens from tokens.css, its easings included, with reduced motion's overrides
 * under data-motion="reduce" as the stylesheet's `reduced` variant applies
 * them. jsdom evaluates no media query, so stubReducedMotion(true) adds the
 * system's half of the variant itself.
 */
export function injectTokens(): void {
  injected = true;
  addStyle(`:root { ${rules(easings)} ${rules(fullMotion(css))} }`);
  addStyle(`:root[data-motion="reduce"] { ${rules(reducedMotion(css))} }`);
}

/** The system's reduced-motion setting, and `fire()` to tell listeners it changed. */
export function stubReducedMotion(matches: boolean): { fire: () => void } {
  const listeners = new Set<() => void>();
  const list = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => list),
  );
  if (matches)
    addStyle(
      `:root:not([data-motion="full"]) { ${rules(reducedMotion(css))} }`,
    );
  return {
    fire: () => {
      for (const listener of listeners) listener();
    },
  };
}

/** The Settings switch on <html>: "reduce", "full", or null for the system's choice. */
export async function setMotionSwitch(
  choice: "reduce" | "full" | null,
): Promise<void> {
  await act(async () => {
    if (choice === null) delete document.documentElement.dataset.motion;
    else document.documentElement.dataset.motion = choice;
    // MutationObserver records arrive as a microtask.
    await Promise.resolve();
  });
}

afterEach(() => {
  for (const style of styles.splice(0)) style.remove();
  injected = false;
  delete document.documentElement.dataset.motion;
  vi.unstubAllGlobals();
});

/** Renders `ui` as the app does: inside QuestMotion, with the motion tokens on :root. */
export function renderWithMotion(ui: ReactElement): RenderResult {
  if (!injected) injectTokens();
  return render(ui, { wrapper: QuestMotion });
}
