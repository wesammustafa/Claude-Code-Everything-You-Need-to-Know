import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import { Pip } from "../pip/Pip";

/**
 * What the status bubble is saying: its border and fill take the status
 * colour. While Pip offers help the bubble warms to the accent.
 */
export type SaysTone =
  "idle" | "watching" | "checking" | "notYet" | "passed" | "broken" | "offer";

const TONES: Record<SaysTone, string> = {
  idle: "border-line bg-surface",
  watching: "border-teal-edge bg-surface",
  checking: "border-accent-edge bg-surface",
  notYet: "border-wait bg-wait-soft",
  passed: "border-pass bg-pass-soft",
  broken: "border-broken bg-broken-soft",
  offer: "border-accent-edge bg-accent-soft",
};

export interface SaysProps {
  tone?: SaysTone;
  /** Pip beside the bubble: by default the page's own Pip. */
  pip?: ReactNode;
  /**
   * Changes whenever the status words change, so they fade in again after
   * Pip's Reaction. Keep it while they stay the same: a new key re-inserts
   * them, and the live region would say them again.
   */
  textKey?: string;
  children: ReactNode;
}

/**
 * Pip beside the step, saying the status in a bubble that is a polite live
 * region. Pip holds his place at the top of the row: a bubble shorter than
 * him sits centred on him, and one that grows (the help offer opening) grows
 * downward, its tail still at his middle, so neither he nor the tail moves.
 */
export function Says({ tone = "idle", pip, textKey, children }: SaysProps) {
  return (
    <div className="flex items-start gap-3.5" data-tone={tone}>
      {pip ?? <Pip size="beside" />}
      {/* As tall as the beside Pip, so a short bubble centres on him. */}
      <div className="grid min-h-19 min-w-0 flex-1 items-center">
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className={cx(
            "relative min-w-0 rounded-lg border px-4.5 py-3.25 shadow-md",
            "transition-[border-color,background-color] duration-(--duration-base) ease-out",
            // The tail: a rotated square sharing the bubble's fill and border,
            // at the bubble's middle, or at Pip's once the bubble outgrows him.
            "before:absolute before:top-[min(50%,calc(var(--spacing)*9.5))] before:-left-1.75 before:size-3 before:-translate-y-1/2 before:rotate-45 before:border-b before:border-l before:border-inherit before:bg-inherit before:content-['']",
            TONES[tone],
          )}
        >
          <div key={textKey} className="relative grid animate-says">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
