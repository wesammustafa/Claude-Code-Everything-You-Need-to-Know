import { m } from "motion/react";
import { useId, type ReactNode } from "react";
import { cx } from "../lib/cx";
import { revealEntrance, useMotionTokens } from "../lib/motion";
import { Button } from "./Button";
import { Icon } from "./Icon";

export interface ChoiceOption {
  id: string;
  text: ReactNode;
  /** Why this answer is right or not yet, shown once it is marked. */
  because?: ReactNode;
}

/** How a marked answer is drawn: judged right or not yet, the Learner's own guess, or the answer shown. */
export type ChoiceMark = "right" | "notYet" | "chosen" | "shown";

export interface ChoiceResult {
  id: string;
  state: ChoiceMark;
}

export interface ChoiceProps {
  /** The question. */
  legend: ReactNode;
  options: readonly ChoiceOption[];
  /** The picked option's id, or null before one is picked. */
  value: string | null;
  onChange: (id: string) => void;
  /** The marked answers, once the engine has judged them. */
  result?: ChoiceResult | readonly ChoiceResult[];
  disabled?: boolean;
  /**
   * Send the selection with a button under the answers: picking one then
   * only selects it, and the form sends it. The button waits for a pick.
   */
  submit?: { label: string; onSubmit: (id: string) => void; pending?: boolean };
}

const OPTION =
  "flex w-full items-start gap-3 rounded-lg border px-4 py-3 " +
  "transition-[background-color,border-color] duration-(--duration-fast) ease-out " +
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus " +
  "in-data-disabled:cursor-not-allowed in-data-disabled:opacity-disabled";

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
  chosen: cx("border-accent-mark bg-surface", CHOSEN),
  shown: cx("border-pass bg-pass-soft", CHOSEN),
} as const;

const KEYS = {
  idle: "border-line-2 text-muted",
  picked: "border-accent-mark text-accent-text",
  right: "border-pass text-pass",
  notYet: "border-wait text-wait",
  chosen: "border-accent-mark text-accent-text",
  shown: "border-pass text-pass",
} as const;

/**
 * A question with a few answers: a native fieldset of radios, so the arrow
 * keys move between answers and a screen reader hears the question with each.
 * A marked answer turns green when right, amber with "Not yet" otherwise
 * (never red), and its reason opens below it. A guess with no right answer
 * is drawn chosen, with no word; an answer shown for the Learner says "The
 * answer". The reason is plain text in the page: the screen's own status
 * region says the result. With `submit`, the answers sit in a form whose
 * button sends the selection, so moving between answers sends nothing.
 */
export function Choice({
  legend,
  options,
  value,
  onChange,
  result,
  disabled = false,
  submit,
}: ChoiceProps) {
  const name = useId();
  const entrance = revealEntrance(useMotionTokens());
  const marks: readonly ChoiceResult[] =
    result === undefined ? [] : "id" in result ? [result] : result;
  const fieldset = (
    // Not the native disabled: that would drop a focused answer's focus to
    // the page when the connection goes, so the answers stay focusable and
    // take no change while disabled.
    <fieldset
      {...(disabled ? { "aria-disabled": true, "data-disabled": "" } : {})}
      className="grid gap-2.5"
    >
      <legend className="mb-2.5 font-semibold">{legend}</legend>
      {options.map((option, i) => {
        const marked = marks.find((mark) => mark.id === option.id)?.state;
        const state = marked ?? (value === option.id ? "picked" : "idle");
        return (
          <div key={option.id} className="grid gap-1.5">
            <label data-state={state} className={cx(OPTION, LOOKS[state])}>
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={value === option.id}
                {...(disabled ? { "aria-disabled": true } : {})}
                onChange={() => {
                  if (!disabled) onChange(option.id);
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
              {marked === "shown" && (
                <span className="pt-0.5 text-sm font-semibold text-pass">
                  The answer
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
  if (!submit) return fieldset;
  const ready = value !== null && !disabled && submit.pending !== true;
  return (
    <form
      className="grid justify-items-start gap-3.5 [&>*]:w-full"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) submit.onSubmit(value);
      }}
    >
      {fieldset}
      <div>
        <Button
          type="submit"
          variant="primary"
          pending={submit.pending === true}
          {...(ready ? {} : { "aria-disabled": true })}
        >
          {submit.label}
        </Button>
      </div>
    </form>
  );
}
