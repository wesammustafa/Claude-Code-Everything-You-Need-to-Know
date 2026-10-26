import { cx } from "../lib/cx";
import { PIP_ICON_PARTS, PIP_ICON_VIEW_BOX, type PipIconTone } from "./icon";

// Written out whole so Tailwind finds each utility.
const FILL: Readonly<Record<PipIconTone, string>> = {
  body: "fill-pip",
  shade: "fill-pip-shade",
  eye: "fill-pip-eye",
};

export interface PipIconProps {
  /** Sets the icon's size; Pip's icon is shown at 32 px and below. */
  className?: string;
}

/**
 * Pip's static icon, drawn from tokens so it follows the theme. Decorative:
 * the words beside it carry the meaning. A contrast theme leaves its colours
 * as they are, as it would an image, so the eyes stay on the face.
 */
export function PipIcon({ className }: PipIconProps) {
  return (
    <svg
      viewBox={PIP_ICON_VIEW_BOX}
      aria-hidden="true"
      focusable="false"
      data-pip-icon=""
      className={cx("shrink-0 forced-color-adjust-none", className)}
    >
      {PIP_ICON_PARTS.map((part) => (
        <path key={part.d} d={part.d} className={FILL[part.tone]} />
      ))}
    </svg>
  );
}
