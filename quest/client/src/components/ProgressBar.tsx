import { m } from "motion/react";
import { cx } from "../lib/cx";
import { fillEntrance, useMotionTokens } from "../lib/motion";

export interface ProgressBarProps {
  value: number;
  max: number;
  /** The bar's accessible name. */
  label: string;
  tone?: "accent" | "pass";
}

const FILLS = {
  accent: "bg-accent-mark",
  pass: "bg-pass",
} as const;

/**
 * How far along, as a bar: a track with its fill sliding in from the left
 * over --duration-slow. Under reduced motion the fill sits at its width and
 * fades in. The value is the bar's own; it announces nothing as it changes.
 * It is phrasing content (spans), so it may sit inside a button. A contrast
 * theme drops the fills, so there the track is an outline and the fill takes
 * the theme's text colour.
 */
export function ProgressBar({
  value,
  max,
  label,
  tone = "accent",
}: ProgressBarProps) {
  const t = useMotionTokens();
  const top = Math.max(max, 0);
  const now = Math.min(Math.max(value, 0), top);
  const ratio = top > 0 ? now / top : 0;
  const entrance = fillEntrance(t, ratio);
  const fill = cx(
    "block h-full w-full rounded-full forced-colors:bg-(--forced-mark) forced-colors:forced-color-adjust-none",
    FILLS[tone],
  );
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={top}
      aria-valuenow={now}
      className="block h-1.5 overflow-hidden rounded-full bg-surface-2 shadow-track forced-colors:outline"
    >
      {t.reduced ? (
        <m.span
          key="reduced"
          data-fill=""
          className={fill}
          style={{ width: `${String(ratio * 100)}%` }}
          initial={entrance.initial}
          animate={entrance.animate}
          transition={entrance.transition}
        />
      ) : (
        <m.span
          key="full"
          data-fill=""
          className={fill}
          initial={entrance.initial}
          animate={entrance.animate}
          transition={entrance.transition}
        />
      )}
    </span>
  );
}
