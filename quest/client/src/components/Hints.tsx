import { m } from "motion/react";
import type { ReactNode, Ref } from "react";
import { revealEntrance, useMotionTokens } from "../lib/motion";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { InlineText } from "./InlineText";

export interface HintsProps {
  /** The step's hints, one rung each. */
  hints: readonly string[];
  /** How many are open. */
  shown: number;
  onShowNext: () => void;
  /** The newest open hint, to move focus to and for Pip to look at. */
  newestRef?: Ref<HTMLDivElement>;
  /** Why no further hint can open now, shown in place of the button that opens one. */
  unavailable?: ReactNode;
  /** The offer of the step's exact command, once the hints are open; the caller asks before taking it. */
  exact?: { label: string; onTake: () => void };
}

/**
 * Hints inline under the step card, one rung at a time. A rung opens through
 * its height and fades in, or only fades under reduced motion. The newest
 * open one is Pip's `hint` target.
 */
export function Hints({
  hints,
  shown,
  onShowNext,
  newestRef,
  unavailable,
  exact,
}: HintsProps) {
  const open = hints.slice(0, shown);
  const entrance = revealEntrance(useMotionTokens());
  return (
    <div className="grid justify-items-start gap-2.5">
      {open.map((hint, i) => {
        const newest = i === open.length - 1;
        return (
          <m.div
            key={hint}
            data-hint-rung=""
            className="w-full overflow-hidden"
            initial={entrance.initial}
            animate={entrance.animate}
            transition={entrance.transition}
          >
            <div
              ref={newest ? newestRef : undefined}
              tabIndex={newest ? -1 : undefined}
              data-pip-target={newest ? "hint" : undefined}
              className="flex w-full items-start gap-2.5 rounded-lg border border-line bg-surface-2 px-4.5 py-3.5 text-sm focus:outline-none"
            >
              <Icon name="bulb" className="mt-0.5 text-accent-text" />
              <p>
                <span className="text-muted">{`Hint ${String(i + 1)}. `}</span>
                <InlineText text={hint} />
              </p>
            </div>
          </m.div>
        );
      })}
      {shown < hints.length &&
        (unavailable === undefined ? (
          <Button variant="ghost" icon="bulb" onClick={onShowNext}>
            {shown === 0 ? "Show a hint" : "Another hint"}
          </Button>
        ) : (
          <p data-hints-unavailable="" className="text-sm text-muted">
            {unavailable}
          </p>
        ))}
      {exact && (
        <Button
          variant="ghost"
          size="sm"
          icon="terminal"
          onClick={exact.onTake}
        >
          {exact.label}
        </Button>
      )}
    </div>
  );
}
