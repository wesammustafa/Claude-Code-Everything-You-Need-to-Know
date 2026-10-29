import { useLayoutEffect, type RefObject } from "react";

/**
 * Holds a custom property on <html> at an element's rendered height while the
 * element is mounted, following it as it resizes, so the stylesheet can keep
 * clear of it (the scroll padding in app.css). Unmounting removes the
 * property, and the stylesheet's default applies again.
 */
export function useHeightProperty(
  ref: RefObject<HTMLElement | null>,
  property: `--${string}`,
): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = document.documentElement;
    const measure = () => {
      html.style.setProperty(
        property,
        `${String(el.getBoundingClientRect().height)}px`,
      );
    };
    measure();
    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(measure)
        : undefined;
    observer?.observe(el);
    return () => {
      observer?.disconnect();
      html.style.removeProperty(property);
    };
  }, [ref, property]);
}
