import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders fixed layers (the action bar, panels) straight into <body>.
 * An animated ancestor with a transform becomes the containing block of
 * `position: fixed` in Chrome, so a fixed bar inside the screen's entrance
 * would scroll away with it.
 */
export function FixedLayer({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
