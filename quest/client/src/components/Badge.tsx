import { m } from "motion/react";
import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import { popEntrance, useMotionTokens } from "../lib/motion";

export type BadgeShape = "circle" | "hexagon" | "shield";

// One family on a 64 grid: a shape per Level.
const SHAPES: Record<BadgeShape, ReactNode> = {
  circle: <circle cx="32" cy="32" r="25" />,
  hexagon: <path d="M32 6.5 54 19.2v25.6L32 57.5 10 44.8V19.2z" />,
  shield: (
    <path d="M32 6 53 13.5v17.2C53 44 44.2 53.4 32 58 19.8 53.4 11 44 11 30.7V13.5z" />
  ),
};

// A capstone is a quarter larger, with an inner ring. xs sits in a list row
// (Progress), xl is the Lesson complete reveal.
const SIZES = {
  xs: { plain: "size-7", capstone: "size-9" },
  sm: { plain: "size-12", capstone: "size-15" },
  lg: { plain: "size-16", capstone: "size-20" },
  xl: { plain: "size-22", capstone: "size-28" },
} as const;

export type BadgeSize = keyof typeof SIZES;

// The symbol's stroke, on its 24 grid: thicker at xs so it holds at 28 px.
const SYMBOL_STROKE: Record<BadgeSize, string> = {
  xs: "2.6",
  sm: "1.8",
  lg: "1.8",
  xl: "1.8",
};

/** The reveal's words above the name, also for 249's announcement. */
export const NEW_BADGE = "New badge";

export interface BadgeProps {
  shape: BadgeShape;
  earned: boolean;
  capstone?: boolean;
  size?: BadgeSize;
  /** The badge's name, its accessible name. */
  name: string;
  /** The Lesson's symbol, on a 24 grid at the badge's centre (The Badge family). */
  symbol?: ReactNode;
  /** Pops in, the moment it is earned; it always shows its caption. */
  reveal?: boolean;
  /**
   * The name under the shape, with "Not yet" until earned. It repeats the
   * image's name, so screen readers skip it. Off for a row that names it.
   */
  caption?: boolean;
}

/**
 * A badge's shape: drawn in coral once earned, a dashed outline in the mark
 * colour until then, never a lock. A badge that is revealed pops on a spring
 * from --pop-from over --duration-moment; under reduced motion it fades.
 */
export function Badge({
  shape,
  earned,
  capstone = false,
  size = "lg",
  name,
  symbol,
  reveal = false,
  caption = true,
}: BadgeProps) {
  const entrance = popEntrance(useMotionTokens());
  const art = (
    <svg
      role="img"
      aria-label={earned ? name : `${name}, not yet`}
      data-earned={earned ? "" : undefined}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx(
        "shrink-0",
        SIZES[size][capstone ? "capstone" : "plain"],
        earned ? "text-accent-mark" : "text-mark",
      )}
    >
      <m.g
        data-badge-shape=""
        initial={reveal ? entrance.initial : false}
        animate={entrance.animate}
        transition={entrance.transition}
      >
        <g strokeDasharray={earned ? undefined : "4 3"}>{SHAPES[shape]}</g>
        {capstone && (
          <g
            transform="translate(32 32) scale(.78) translate(-32 -32)"
            strokeDasharray={earned ? undefined : "4 3"}
          >
            {SHAPES[shape]}
          </g>
        )}
        {symbol !== undefined && (
          <g transform="translate(20 20)" strokeWidth={SYMBOL_STROKE[size]}>
            {symbol}
          </g>
        )}
      </m.g>
    </svg>
  );
  if (!caption && !reveal) return art;
  return (
    <figure className="inline-flex flex-col items-center gap-1.5">
      {art}
      <figcaption
        aria-hidden="true"
        className="flex flex-col items-center text-xs"
      >
        {reveal && (
          <span className="font-semibold text-accent-text">{NEW_BADGE}</span>
        )}
        <span className="text-text">{name}</span>
        {!earned && <span className="text-muted">Not yet</span>}
      </figcaption>
    </figure>
  );
}
