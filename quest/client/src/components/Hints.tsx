import type { Ref } from "react";
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
}

/**
 * Hints inline under the step card, one rung at a time. The newest open one
 * is Pip's `hint` target.
 */
export function Hints({ hints, shown, onShowNext, newestRef }: HintsProps) {
  const open = hints.slice(0, shown);
  return (
    <div className="grid justify-items-start gap-2.5">
      {open.map((hint, i) => {
        const newest = i === open.length - 1;
        return (
          <div
            key={hint}
            ref={newest ? newestRef : undefined}
            tabIndex={newest ? -1 : undefined}
            data-pip-target={newest ? "hint" : undefined}
            className="flex w-full animate-fade items-start gap-2.5 rounded-lg border border-line bg-surface-2 px-4.5 py-3.5 text-sm focus:outline-none"
          >
            <Icon name="bulb" className="mt-0.5 text-accent-text" />
            <p>
              <span className="text-muted">{`Hint ${String(i + 1)}. `}</span>
              <InlineText text={hint} />
            </p>
          </div>
        );
      })}
      {shown < hints.length && (
        <Button variant="ghost" icon="bulb" onClick={onShowNext}>
          {shown === 0 ? "Show a hint" : "Another hint"}
        </Button>
      )}
    </div>
  );
}
