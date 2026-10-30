import { m } from "motion/react";
import { useId, type ReactNode } from "react";
import { cx } from "../lib/cx";
import { revealEntrance, useMotionTokens } from "../lib/motion";
import { Icon } from "./Icon";

export interface ChoiceOption {
  id: string;
  text: ReactNode;
  /** Why this answer is right or not yet, shown once it is marked. */
  because?: ReactNode;
}

export interface ChoiceProps {
  /** The question. */
  legend: ReactNode;
  options: readonly ChoiceOption[];
  /** The picked option's id, or null before one is picked. */
  value: string | null;
  onChange: (id: string) => void;
  /** The marked answer, once the engine has judged it. */
  result?: { id: string; state: "right" | "notYet" };
  disabled?: boolean;
}

const OPTION =
  "flex w-full items-start gap-3 rounded-lg border px-4 py-3 " +
  "transition-[background-color,border-color] duration-(--duration-fast) ease-out " +
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus " +
  "has-disabled:cursor-not-allowed has-disabled:opacity-disabled";

// A contrast theme draws every border in one colour and drops the fills, so
// there the picked or marked answer shows by a thicker edge (its padding
// gives back the width, so nothing moves).
const CHOSEN =
  "forced-colors:border-3 forced-colors:px-3.5 forced-colors:py-2.5";

// Each state's look, written out so Tailwind finds every class here.
const LOOKS = {
  idle: "cursor-pointer border-line bg-surface hover:border-line-2",
  picked: cx("cursor-pointer border-accent-mark bg-accent-soft", CHOSEN),
  right: cx("border-pass bg-pass-soft", CHOSEN),
  notYet: cx("border-wait bg-wait-soft", CHOSEN),
} as const;

const KEYS = {
  idle: "border-line-2 text-muted",
  picked: "border-accent-mark text-accent-text",
  right: "border-pass text-pass",
  notYet: "border-wait text-wait",
} as const;

/**
 * A question with a few answers: a native fieldset of radios, so the arrow
 * keys move between answers and a screen reader hears the question with each.
 * A marked answer turns green when right, amber with "Not yet" otherwise
 * (never red), and its reason opens below it. The reason is plain text in
 * the page: the screen's own status region says the result.
 */
export function Choice({
  legend,
  options,
  value,
  onChange,
  result,
  disabled = false,
}: ChoiceProps) {
  const name = useId();
  const entrance = revealEntrance(useMotionTokens());
  return (
    <fieldset disabled={disabled} className="grid gap-2.5">
      <legend className="mb-2.5 font-semibold">{legend}</legend>
      {options.map((option, i) => {
        const marked = result?.id === option.id ? result.state : undefined;
        const state = marked ?? (value === option.id ? "picked" : "idle");
        return (
          <div key={option.id} className="grid gap-1.5">
            <label data-state={state} className={cx(OPTION, LOOKS[state])}>
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={value === option.id}
                onChange={() => {
                  onChange(option.id);
                }}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cx(
                  "grid size-6 shrink-0 place-items-center rounded-sm border font-mono text-xs font-semibold",
                  KEYS[state],
                )}
              >
                {String.fromCharCode("A".charCodeAt(0) + i)}
              </span>
              <span className="min-w-0 flex-1 pt-0.5">{option.text}</span>
              {marked === "right" && (
                <span className="inline-flex items-center gap-1 pt-0.5 text-sm font-semibold text-pass">
                  <Icon name="check" size="sm" />
                  Right
                </span>
              )}
              {marked === "notYet" && (
                <span className="pt-0.5 text-sm font-semibold text-wait">
                  Not yet
                </span>
              )}
            </label>
            {marked !== undefined && option.because !== undefined && (
              <m.div
                data-because=""
                className="overflow-hidden"
                initial={entrance.initial}
                animate={entrance.animate}
                transition={entrance.transition}
              >
                <p className="px-4 pb-1 text-sm text-muted">{option.because}</p>
              </m.div>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
