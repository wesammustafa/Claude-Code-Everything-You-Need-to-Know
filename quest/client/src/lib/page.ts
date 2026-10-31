// What the browser says about the page: whether it is hidden, and whether
// motion should be reduced. Both are followed as they change.
import { useSyncExternalStore } from "react";

/** Whether the page is hidden (another tab, a minimised window). */
export function pageHidden(): boolean {
  return document.visibilityState === "hidden";
}

function onVisibilityChange(changed: () => void): () => void {
  document.addEventListener("visibilitychange", changed);
  return () => {
    document.removeEventListener("visibilitychange", changed);
  };
}

export function usePageHidden(): boolean {
  return useSyncExternalStore(onVisibilityChange, pageHidden, () => false);
}

const REDUCE = "(prefers-reduced-motion: reduce)";

/**
 * Whether motion is reduced: the Settings choice on <html> (`data-motion`,
 * "reduce" or "full") wins, as in the stylesheet's `reduced` variant;
 * otherwise the system setting.
 */
export function motionReduced(): boolean {
  const picked = document.documentElement.dataset.motion;
  if (picked === "reduce") return true;
  if (picked === "full") return false;
  return typeof window.matchMedia === "function"
    ? window.matchMedia(REDUCE).matches
    : false;
}

function onMotionChange(changed: () => void): () => void {
  const list =
    typeof window.matchMedia === "function"
      ? window.matchMedia(REDUCE)
      : undefined;
  list?.addEventListener("change", changed);
  const observer = new MutationObserver(changed);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-motion"],
  });
  return () => {
    list?.removeEventListener("change", changed);
    observer.disconnect();
  };
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(onMotionChange, motionReduced, () => false);
}

export type Theme = "light" | "dark";

const DARK = "(prefers-color-scheme: dark)";

/**
 * The theme the page shows: the Settings choice on <html> (`data-theme`,
 * "light" or "dark") wins; otherwise the system setting.
 */
export function resolvedTheme(): Theme {
  const picked = document.documentElement.dataset.theme;
  if (picked === "light" || picked === "dark") return picked;
  return typeof window.matchMedia === "function" &&
    window.matchMedia(DARK).matches
    ? "dark"
    : "light";
}

function onThemeChange(changed: () => void): () => void {
  const list =
    typeof window.matchMedia === "function"
      ? window.matchMedia(DARK)
      : undefined;
  list?.addEventListener("change", changed);
  const observer = new MutationObserver(changed);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => {
    list?.removeEventListener("change", changed);
    observer.disconnect();
  };
}

export function useResolvedTheme(): Theme {
  return useSyncExternalStore(onThemeChange, resolvedTheme, () => "light");
}
