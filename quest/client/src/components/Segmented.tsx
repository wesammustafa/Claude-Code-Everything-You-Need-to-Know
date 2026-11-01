import { useId } from "react";
import { cx } from "../lib/cx";

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
}

export interface SegmentedProps<V extends string> {
  /** The group's name, shown above it. */
  legend: string;
  options: readonly SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
}

const ITEM =
  "relative inline-flex h-8 cursor-pointer items-center rounded-sm px-3 text-sm font-semibold select-none " +
  "transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-out " +
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus";

// A contrast theme drops fills and shadows, so there the chosen one takes the
// theme's highlight colour, as the current Lesson does on the Journey.
const SELECTED =
  "bg-surface text-text shadow-sm ring-1 ring-line " +
  "forced-colors:bg-(--forced-current) forced-colors:text-(--forced-current-ink) forced-colors:shadow-none forced-colors:ring-0 forced-colors:forced-color-adjust-none forced-colors:has-focus-visible:outline-(--forced-mark)";
const IDLE = "text-muted hover:text-text";

/**
 * One choice of a few, side by side (the theme, the motion setting): native
 * radios, so Tab reaches the group once and the arrow keys move the choice.
 * The chosen one is lifted on a surface fill with a line ring.
 */
export function Segmented<V extends string>({
  legend,
  options,
  value,
  onChange,
}: SegmentedProps<V>) {
  const name = useId();
  return (
    <fieldset className="grid justify-items-start gap-2">
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="inline-flex gap-0.5 rounded-md border border-line bg-surface-2 p-0.5">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              data-selected={selected ? "" : undefined}
              className={cx(ITEM, selected ? SELECTED : IDLE)}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => {
                  onChange(option.value);
                }}
                className="sr-only"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
