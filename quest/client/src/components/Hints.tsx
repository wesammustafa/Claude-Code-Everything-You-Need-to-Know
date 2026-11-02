import { m } from "motion/react";
import { useEffect, useRef, type ReactNode, type Ref } from "react";
import { revealEntrance, useMotionTokens } from "../lib/motion";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { InlineText } from "./InlineText";

export interface HintsProps {
  /** The step's hints, one rung each: text in the page's words, or a rung drawn by the caller. */
  hints: readonly ReactNode[];
  /** How many are open. */
  shown: number;
  onShowNext: () => void;
  /** The newest open hint, to move focus to and for Pip to look at. */
  newestRef?: Ref<HTMLDivElement>;
  /** Why no further hint can open now, shown in place of the button that opens one. */
  unavailable?: ReactNode;
  /** The offer of the step's exact command, once the hints are open; the caller asks before taking it. */
  exact?: { label: string; onTake: () => void };
  /**
   * The question before the exact command, in place of the button that
   * opens the next rung: take it or not now. It takes focus as it opens.
   * While `busy` (an answer is in flight, or actions are off) both answers
   * are aria-disabled but keep their place and focus.
   */
  confirm?: { onTake: () => void; onDecline: () => void; busy?: boolean };
}

/** The question before the exact command, and what taking it means. */
export const CONFIRM_EXACT =
  "Show the exact command? This step then counts as Every command shown.";

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
  confirm,
}: HintsProps) {
  const open = hints.slice(0, shown);
  const entrance = revealEntrance(useMotionTokens());
  const question = useRef<HTMLParagraphElement>(null);
  const asking = confirm !== undefined;
  // The button that asked has gone: the question takes focus.
  const root = useRef<HTMLDivElement>(null);
  const wasAsking = useRef(asking);
  useEffect(() => {
    const closed = wasAsking.current && !asking;
    wasAsking.current = asking;
    if (asking) question.current?.focus();
    // Not now took the question's buttons away and opened no rung: focus
    // goes to the button that opens the next one, or the newest rung.
    const lost =
      document.activeElement === null ||
      document.activeElement === document.body ||
      !document.activeElement.isConnected;
    if (!closed || !lost) return;
    (
      root.current?.querySelector<HTMLElement>("[data-hints-next]") ??
      root.current?.querySelector<HTMLElement>(
        "[data-hint-rung]:last-of-type [tabindex]",
      )
    )?.focus();
  }, [asking]);
  return (
    <div ref={root} className="grid justify-items-start gap-2.5">
      {open.map((hint, i) => {
        const newest = i === open.length - 1;
        return (
          <m.div
            // Two rungs may read the same: each keeps its place.
            key={i}
            data-hint-rung=""
            className="w-full overflow-hidden"
            initial={entrance.initial}
            animate={entrance.animate}
            transition={entrance.transition}
          >
            {/* Focus put on the newest rung draws the ring inside it: the
                rung's box clips what spills past it while it opens. */}
            <div
              ref={newest ? newestRef : undefined}
              tabIndex={newest ? -1 : undefined}
              data-pip-target={newest ? "hint" : undefined}
              className="flex w-full items-start gap-2.5 rounded-lg border border-line bg-surface-2 px-4.5 py-3.5 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            >
              <Icon name="bulb" className="mt-0.5 text-accent-text" />
              {typeof hint === "string" ? (
                <p>
                  <span className="text-muted">{`Hint ${String(i + 1)}. `}</span>
                  <InlineText text={hint} />
                </p>
              ) : (
                // A drawn rung (the exact command, with Copy) is blocks, not a line.
                <div className="grid min-w-0 flex-1 gap-2">
                  <span className="text-muted">{`Hint ${String(i + 1)}.`}</span>
                  {hint}
                </div>
              )}
            </div>
          </m.div>
        );
      })}
      {confirm ? (
        <div data-hints-confirm="" className="grid justify-items-start gap-2.5">
          <p
            ref={question}
            tabIndex={-1}
            className="text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {CONFIRM_EXACT}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon="terminal"
              {...(confirm.busy ? { "aria-disabled": true } : {})}
              onClick={confirm.onTake}
            >
              Show the exact command
            </Button>
            <Button
              variant="ghost"
              size="sm"
              {...(confirm.busy ? { "aria-disabled": true } : {})}
              onClick={confirm.onDecline}
            >
              Not now
            </Button>
          </div>
        </div>
      ) : (
        shown < hints.length &&
        (unavailable === undefined ? (
          <Button
            data-hints-next=""
            variant="ghost"
            icon="bulb"
            onClick={onShowNext}
          >
            {shown === 0 ? "Show a hint" : "Another hint"}
          </Button>
        ) : (
          <p data-hints-unavailable="" className="text-sm text-muted">
            {unavailable}
          </p>
        ))
      )}
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
