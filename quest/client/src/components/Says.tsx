import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import { Pip } from "../pip/Pip";

/** What the status bubble is saying: its border and fill take the status colour. */
export type SaysTone =
  "idle" | "watching" | "checking" | "notYet" | "passed" | "broken";

const TONES: Record<SaysTone, string> = {
  idle: "border-line bg-surface",
  watching: "border-teal-edge bg-surface",
  checking: "border-accent-edge bg-surface",
  notYet: "border-wait bg-wait-soft",
  passed: "border-pass bg-pass-soft",
  broken: "border-broken bg-broken-soft",
};

export interface SaysProps {
  tone?: SaysTone;
  /** Pip beside the bubble: by default the page's own Pip. */
  pip?: ReactNode;
  /** Changes whenever the words change, so they fade in again after Pip's Reaction. */
  textKey?: string;
  children: ReactNode;
}

/** Pip beside the step, saying the status in a bubble that is a polite live region. */
export function Says({ tone = "idle", pip, textKey, children }: SaysProps) {
  return (
    <div className="flex items-center gap-3.5" data-tone={tone}>
      {pip ?? <Pip size="beside" />}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cx(
          "relative min-w-0 flex-1 rounded-lg border px-4.5 py-3.25 shadow-md",
          "transition-[border-color,background-color] duration-(--duration-base) ease-out",
          // The tail: a rotated square sharing the bubble's fill and border.
          "before:absolute before:top-1/2 before:-left-1.75 before:size-3 before:-translate-y-1/2 before:rotate-45 before:border-b before:border-l before:border-inherit before:bg-inherit before:content-['']",
          TONES[tone],
        )}
      >
        <div key={textKey} className="relative grid animate-says gap-2">
          {children}
        </div>
      </div>
    </div>
  );
}
