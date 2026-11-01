import { cx } from "../lib/cx";

export interface StepDotsProps {
  /** Every step's title, in order. */
  steps: readonly string[];
  /** The index of the current step; steps before it are done. */
  at: number;
  /**
   * Each step's state, where it is not simply the order: a step done after
   * a later one, or skipped. Overrides the states `at` gives.
   */
  states?: readonly StepState[];
}

export type StepState = "done" | "current" | "todo";

/** The Lesson's steps as dots: done in green, the current one longer in coral. */
export function StepDots({ steps, at, states }: StepDotsProps) {
  return (
    <ol aria-label="Steps" className="flex flex-wrap justify-center gap-1.25">
      {steps.map((title, i) => {
        const given = states?.[i];
        const state =
          given === undefined
            ? i < at
              ? "done"
              : i === at
                ? "now"
                : "todo"
            : given === "current"
              ? "now"
              : given;
        return (
          <li
            key={`${String(i)}-${title}`}
            data-state={state}
            aria-current={state === "now" ? "step" : undefined}
            title={title}
            className={cx(
              "h-1.25 w-5.5 rounded-full bg-mark transition-[width,background-color] duration-(--duration-slow) ease-out data-[state=done]:bg-pass data-[state=now]:w-8.5 data-[state=now]:bg-accent-mark",
              // A contrast theme drops every fill, so there the dots keep
              // theirs in the theme's own colours: to do an outline, done
              // filled, the current one filled in the highlight colour.
              "forced-colors:border forced-colors:border-(--forced-mark) forced-colors:bg-transparent forced-colors:forced-color-adjust-none data-[state=done]:forced-colors:bg-(--forced-mark) data-[state=now]:forced-colors:border-(--forced-current) data-[state=now]:forced-colors:bg-(--forced-current)",
            )}
          >
            <span className="sr-only">
              {`Step ${String(i + 1)}, ${title}: ${state === "done" ? "done" : state === "now" ? "current" : "to do"}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
