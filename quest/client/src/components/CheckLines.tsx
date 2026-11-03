import type { CSSProperties, ReactNode } from "react";
import { cx } from "../lib/cx";
import { Icon } from "./Icon";

/**
 * Where a line of the Check stands: still being checked, met, not met yet,
 * not known because the Check could not run (rose, never a judgement), or a
 * slow line that runs only on Check again (ticket 314).
 */
export type CheckLineState =
  "waiting" | "pass" | "notYet" | "broken" | "pending";

export interface CheckLine {
  /** The Check's line, in the engine's words. */
  text: ReactNode;
  ok: boolean;
  /** Where the line stands, when it is more than met or not: by default `ok` says. */
  state?: CheckLineState;
  /** What the Check saw, shown under the line. */
  evidence?: ReactNode;
}

export interface CheckLinesProps {
  lines: readonly CheckLine[];
}

const MARK = "-mt-px grid size-5.5 shrink-0 place-items-center rounded-full";
const EVIDENCE =
  "mt-1.5 rounded-r-sm border-l-3 bg-surface-2 px-3 py-2 text-sm text-text";

// Each state's look, every class written out so Tailwind finds it here.
const LOOKS: Record<
  CheckLineState,
  {
    data: string;
    said: string;
    mark: string;
    icon: "check" | "circle";
    text: string;
    evidence: string;
  }
> = {
  waiting: {
    data: "waiting",
    said: "Checking: ",
    mark: "bg-teal-soft text-teal",
    icon: "circle",
    text: "text-muted",
    evidence: "border-teal",
  },
  pass: {
    data: "ok",
    said: "Passes: ",
    mark: "bg-pass-soft text-pass",
    icon: "check",
    text: "text-muted",
    evidence: "border-pass",
  },
  notYet: {
    data: "not-yet",
    said: "Not yet: ",
    mark: "bg-wait-soft text-wait",
    icon: "circle",
    text: "text-text",
    evidence: "border-wait",
  },
  pending: {
    data: "pending",
    said: "Runs on Check again: ",
    mark: "bg-teal-soft text-teal",
    icon: "circle",
    text: "text-muted",
    evidence: "border-teal",
  },
  broken: {
    data: "broken",
    said: "Could not check: ",
    mark: "bg-broken-soft text-broken",
    icon: "circle",
    text: "text-text",
    evidence: "border-broken",
  },
};

/**
 * The Check's lines: met ones quiet, the rest amber, never red, and a line
 * still being checked in teal; any line may show what the Check saw. They
 * arrive one after another, --stagger apart. Pip watches them as they arrive.
 * A line keeps its place (and does not arrive again) as its state and words
 * change; to stagger a new Check run's lines in again, the caller gives
 * CheckLines a new `key` for each run.
 */
export function CheckLines({ lines }: CheckLinesProps) {
  return (
    <ul data-pip-target="lines" className="grid gap-2.5">
      {lines.map((line, i) => {
        const look = LOOKS[line.state ?? (line.ok ? "pass" : "notYet")];
        return (
          <li
            // A line keeps its place as its state and words change.
            key={i}
            data-state={look.data}
            className="flex animate-line items-start gap-2.5 text-sm [animation-delay:calc(var(--i)*var(--stagger))]"
            style={{ "--i": i } as CSSProperties}
          >
            <span className={cx(MARK, look.mark)}>
              <Icon name={look.icon} size="sm" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="sr-only">{look.said}</span>
              <span className={look.text}>{line.text}</span>
              {line.evidence !== undefined && (
                <div className={cx(EVIDENCE, look.evidence)}>
                  {line.evidence}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
