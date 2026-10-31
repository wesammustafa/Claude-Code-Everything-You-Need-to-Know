import type { ReactNode } from "react";
import { cx } from "../lib/cx";

export type TierName = "guided" | "hinted" | "challenge";
export type MasteryName = "commands" | "hints" | "own";

export type TierProps = (
  { tier: TierName; mastery?: never } | { mastery: MasteryName; tier?: never }
) & {
  /** A line beside the label, from the caller. */
  note?: ReactNode;
};

const TIER_LABELS: Record<TierName, string> = {
  guided: "Guided",
  hinted: "Hinted",
  challenge: "Challenge",
};

// The Mastery chip's words: how a Lesson was last done.
const MASTERY_WORDS: Record<MasteryName, string> = {
  commands: "Every command shown",
  hints: "With hints",
  own: "On your own",
};

const FILLED: Record<TierName | MasteryName, number> = {
  guided: 3,
  hinted: 2,
  challenge: 1,
  commands: 3,
  hints: 2,
  own: 1,
};

const PIPS = [0, 1, 2] as const;

/**
 * The help tier, or the Mastery chip, in one hue: the amount of help as
 * filled pips (Guided three, Hinted two, Challenge one), the words beside
 * them saying the same.
 */
export function Tier({ tier, mastery, note }: TierProps) {
  const name = tier ?? mastery;
  return (
    <span
      data-tier={name}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 py-0.5 pr-2.5 pl-2 text-xs font-semibold text-text"
    >
      <span aria-hidden="true" className="inline-flex gap-0.75">
        {PIPS.map((i) => (
          <i
            key={i}
            data-on={i < FILLED[name] ? "" : undefined}
            className={cx(
              "size-1.5 rounded-full",
              i < FILLED[name] ? "bg-accent-text" : "bg-mark",
            )}
          />
        ))}
      </span>
      <span>{tier ? TIER_LABELS[tier] : MASTERY_WORDS[mastery]}</span>
      {note !== undefined && (
        <span className="font-normal text-muted">{note}</span>
      )}
    </span>
  );
}
