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
