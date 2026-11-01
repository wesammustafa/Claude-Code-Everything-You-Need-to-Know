// When Pip offers the hint on a step: the browser's own stuck rule, pure,
// with the time passed in. A hint that is ready and goes unused for 45 s, or
// a step's Check saying Not yet twice in a row, earns one offer per step;
// dismissing it ends it, and it never comes back on that step in this page
// load. Opening a hint rung closes the offer and starts the 45 s clock again
// from that moment, for the next rung. A pass ends the stuck rule for the
// step: a Learner whose step has passed is not stuck. The engine's timing
// stays the engine's: it decides when a hint is ready, and the 45 s clock
// starts only then. When the engine sends its own `help.offered` for the same
// moment (ticket 203 onward), that event replaces this rule.
import type { EventEnvelope } from "@quest/contract";

/** A ready hint unused this long earns the offer. */
export const HINT_UNUSED_MS = 45_000;
/** This many Not yets in a row on a step earn the offer. */
export const NOT_YETS_IN_A_ROW = 2;

export interface HelpState {
  /** The step on screen, by the page's key for it; null off the step. */
  step: string | null;
  /** Since when an unopened hint has been ready on this step. */
  hintReadySince: number | null;
  /** The step's Not yets since its last pass. */
  notYets: number;
  /** When the last of them came. */
  lastNotYetAt: number | null;
  /** The step has passed (check.passed or step.completed): it is not stuck. */
  passed: boolean;
  /** The offer is in the bubble now. */
  showing: boolean;
  /** Steps whose offer has shown in this page load: it never comes back on them. */
  spent: readonly string[];
}

export const initialHelpState: HelpState = {
  step: null,
  hintReadySince: null,
  notYets: 0,
  lastNotYetAt: null,
  passed: false,
  showing: false,
  spent: [],
};

/** A step came on screen, or the Learner left the step (null). */
export function helpStep(h: HelpState, step: string | null): HelpState {
  if (step === h.step) return h;
  // A new step starts its own count, with no hint ready until the page says so.
  return { ...initialHelpState, step, spent: h.spent };
}

/**
 * Whether an unopened hint is ready on the step now. Told again that it is
 * ready, the clock keeps running from when it first was.
 */
export function helpHint(h: HelpState, ready: boolean, now: number): HelpState {
  if (h.step === null) return h;
  if (ready)
    return h.hintReadySince === null ? { ...h, hintReadySince: now } : h;
  // The last hint was opened (or is gone): the offer has done its work.
  return { ...h, hintReadySince: null, showing: false };
}

/**
 * The Learner opened a hint rung: the offer closes, and the 45 s clock starts
 * again from now for the rung that is ready next.
 */
export function helpHintOpened(h: HelpState, now: number): HelpState {
  if (h.step === null) return h;
  return {
    ...h,
    showing: false,
    hintReadySince: h.hintReadySince === null ? null : now,
  };
}

/**
 * The step's Check results: Not yets count up in a row; a pass ends the stuck
 * rule for the step, and closes an offer that is showing.
 */
export function helpEvents(
  h: HelpState,
  events: readonly EventEnvelope[],
  now: number,
): HelpState {
  if (h.step === null) return h;
  let next = h;
  for (const event of events) {
    if (event.type === "check.notYet") {
      next = { ...next, notYets: next.notYets + 1, lastNotYetAt: now };
    } else if (
      event.type === "check.passed" ||
      event.type === "step.completed"
    ) {
      next = {
        ...next,
        notYets: 0,
        lastNotYetAt: null,
        passed: true,
        showing: false,
      };
    }
    // A broken Check is not the Learner's: it neither counts nor breaks the row.
  }
  return next;
}

/** The Learner closed the offer: it ends for this step. */
export function helpDismissed(h: HelpState): HelpState {
  return h.showing ? { ...h, showing: false } : h;
}

/**
 * When the offer is due on this step, or null when it never will be as
 * things stand: only with an unopened hint ready, never on a step that has
 * passed, and never twice on a step. The director decides whether it can
 * show then (helpHeldUntil in director.ts).
 */
export function helpDueAt(h: HelpState): number | null {
  if (h.step === null || h.hintReadySince === null || h.passed) return null;
  if (h.spent.includes(h.step)) return null;
  const unused = h.hintReadySince + HINT_UNUSED_MS;
  if (h.notYets >= NOT_YETS_IN_A_ROW && h.lastNotYetAt !== null) {
    return Math.min(unused, h.lastNotYetAt);
  }
  return unused;
}

/** Shows the offer, spending this step's one chance. */
export function helpOffer(h: HelpState): HelpState {
  if (h.step === null) return h;
  return { ...h, showing: true, spent: [...h.spent, h.step] };
}
