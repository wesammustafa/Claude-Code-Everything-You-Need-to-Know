import type { CSSProperties } from "react";
import { Icon } from "./Icon";

export interface CheckLine {
  /** The Check's line, in the engine's words. */
  text: string;
  ok: boolean;
  /** What the Check saw, shown under a line that is not met yet. */
  evidence?: string;
}

export interface CheckLinesProps {
  lines: readonly CheckLine[];
}

/** The Check's lines: met ones quiet, the rest amber with their evidence, never red. */
export function CheckLines({ lines }: CheckLinesProps) {
  return (
    <ul className="grid gap-2.5">
      {lines.map((line, i) => (
        <li
          key={line.text}
          data-state={line.ok ? "ok" : "not-yet"}
          className="flex animate-line items-start gap-2.5 text-sm [animation-delay:calc(var(--i)*var(--stagger))]"
          style={{ "--i": i } as CSSProperties}
        >
          <span
            className={
              line.ok
                ? "-mt-px grid size-5.5 shrink-0 place-items-center rounded-full bg-pass-soft text-pass"
                : "-mt-px grid size-5.5 shrink-0 place-items-center rounded-full bg-wait-soft text-wait"
            }
          >
            <Icon name={line.ok ? "check" : "circle"} size="sm" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="sr-only">
              {line.ok ? "Passes: " : "Not yet: "}
            </span>
            <span className={line.ok ? "text-muted" : "text-text"}>
              {line.text}
            </span>
            {line.evidence !== undefined && !line.ok && (
              <p className="mt-1.5 rounded-r-sm border-l-3 border-wait bg-surface-2 px-3 py-2 text-sm text-text">
                {line.evidence}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
