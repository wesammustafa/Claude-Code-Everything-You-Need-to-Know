import { useEffect, useRef, useState } from "react";
import { cx } from "../lib/cx";
import { Button } from "./Button";

/** What Pip says when he offers the hint: what is there, never how the work is going. */
export const HELP_OFFER_TEXT = "A hint is here if you want it.";

export interface HelpOfferProps {
  /** Whether Pip is offering the hint now. */
  open: boolean;
  onShowHint: () => void;
  onDismiss: () => void;
}

/**
 * Pip's offer of the step's hint, inside his bubble: open it, or not now.
 * The bubble's height opens and closes smoothly with it, so the step card
 * below glides instead of jumping; under reduced motion it only fades. While
 * it closes it is inert and its words stay put, so the live region hears
 * nothing new: the offer is announced once, as it opens.
 */
export function HelpOffer({ open, onShowHint, onDismiss }: HelpOfferProps) {
  const [mounted, setMounted] = useState(open);
  // Opened all the way: only then may a focus ring spill past its edges.
  const [settled, setSettled] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  if (open && !mounted) setMounted(true);
  if (!open && settled) setSettled(false);
  const leaving = mounted && !open;

  // When its transitions finish (at once where there are none), an opening
  // offer has settled and a closing one leaves the page.
  useEffect(() => {
    if (!mounted) return;
    const el = box.current;
    // A browser with no Web Animations (jsdom) runs no transitions either.
    const running =
      el !== null && "getAnimations" in el ? el.getAnimations() : [];
    let current = true;
    void Promise.allSettled(running.map((a) => a.finished)).then(() => {
      if (!current) return;
      if (open) setSettled(true);
      else setMounted(false);
    });
    return () => {
      current = false;
    };
  }, [open, mounted]);

  if (!mounted) return null;
  return (
    <div
      ref={box}
      data-help-offer={leaving ? "leaving" : "open"}
      inert={leaving}
      className={cx(
        "grid transition-[grid-template-rows,opacity] duration-(--duration-slow) ease-out",
        "starting:grid-rows-[0fr] starting:opacity-gone reduced:transition-opacity",
        leaving
          ? "grid-rows-[0fr] opacity-gone reduced:grid-rows-[1fr]"
          : "grid-rows-[1fr]",
      )}
    >
      <div className={cx("min-h-0", !settled && "overflow-hidden")}>
        <div className="grid justify-items-start gap-2.5 pt-2">
          <p>{HELP_OFFER_TEXT}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon="bulb"
              onClick={onShowHint}
            >
              Show the hint
            </Button>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Not now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
