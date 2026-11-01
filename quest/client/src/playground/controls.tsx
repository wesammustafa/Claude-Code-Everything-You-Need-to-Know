// The Pip Playground's controls: native radios, buttons and ranges under a
// light skin, so every one works with the keyboard as the browser defines it
// (Tab between controls, arrows within a group or along a range).
import { useId, type ReactNode } from "react";
import { cx } from "../lib/cx";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** A titled group of controls. */
export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div className="grid gap-0.5">
        <h2 className="text-xs font-semibold tracking-eyebrow text-muted uppercase">
          {title}
        </h2>
        {hint !== undefined && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export interface Choice<T extends string> {
  value: T;
  label: string;
}

/** One choice of a few, as a radio group: one Tab stop, arrows move the choice. */
export function Segmented<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm text-muted">{legend}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-md border border-line bg-surface-2 p-0.5">
        {options.map((option) => (
          <label key={option.value} className="relative min-w-0">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => {
                onChange(option.value);
              }}
              className="peer sr-only"
            />
            <span
              className={cx(
                "block cursor-pointer truncate rounded-sm px-2 py-1.5 text-center text-sm text-muted select-none",
                "transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-out",
                "hover:text-text peer-checked:bg-surface peer-checked:font-medium peer-checked:text-text peer-checked:shadow-sm",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-focus",
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** An on and off switch: Space or Enter flips it. */
export function Switch({
  label,
  checked,
  onChange,
  detail,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  detail?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        onChange(!checked);
      }}
      className={cx(
        "group flex w-full cursor-pointer items-center justify-between gap-3 rounded-md py-1 text-left",
        FOCUS,
      )}
    >
      <span className="grid">
        <span className="text-sm text-text">{label}</span>
        {detail !== undefined && (
          <span className="text-xs text-muted">{detail}</span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={cx(
          "flex h-5 w-9 shrink-0 items-center rounded-full border p-0.5",
          "transition-colors duration-(--duration-fast) ease-out",
          checked ? "border-accent bg-accent" : "border-line-2 bg-surface-2",
        )}
      >
        <span
          className={cx(
            "size-3.5 rounded-full shadow-sm transition-[translate,background-color] duration-(--duration-fast) ease-out",
            checked ? "translate-x-4 bg-accent-ink" : "bg-mark",
          )}
        />
      </span>
    </button>
  );
}

/** A number on a range: arrows step it, Home and End go to its ends. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  marks,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Values the range marks with a tick. */
  marks?: readonly number[];
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const list = `${id}-marks`;
  return (
    <div className={cx("grid gap-1", disabled === true && "opacity-disabled")}>
      <span className="flex items-baseline justify-between text-sm">
        <label htmlFor={id} className="text-muted">
          {label}
        </label>
        {/* The range already tells assistive technology its value: this
            readout is for the eye, and never a live region of its own. */}
        <span
          aria-hidden="true"
          className="font-mono text-xs text-text tabular-nums"
        >
          {value.toFixed(2)}
        </span>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        list={marks === undefined ? undefined : list}
        onChange={(event) => {
          onChange(Number(event.currentTarget.value));
        }}
        className={cx("w-full cursor-pointer accent-accent", FOCUS)}
      />
      {marks !== undefined && (
        <datalist id={list}>
          {marks.map((mark) => (
            <option key={mark} value={mark} />
          ))}
        </datalist>
      )}
    </div>
  );
}

/**
 * A small button for the Playground's many actions. `reserveDetail` keeps the
 * detail line's room while there is no detail, so one arriving moves nothing.
 */
export function Action({
  children,
  detail,
  reserveDetail = false,
  onClick,
  pressed,
  className,
}: {
  children: ReactNode;
  detail?: string | undefined;
  reserveDetail?: boolean;
  onClick: () => void;
  pressed?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cx(
        "grid min-w-0 cursor-pointer content-start gap-0.5 rounded-md border px-2.5 py-1.5 text-left",
        "transition-[background-color,border-color,translate,scale] duration-(--duration-fast) ease-out",
        "active:translate-y-(--press-y) active:scale-(--press-scale) active:duration-(--duration-press)",
        pressed === true
          ? "border-accent bg-accent-soft"
          : "border-line bg-surface-2 hover:border-accent-edge active:bg-pressed",
        FOCUS,
        className,
      )}
    >
      <span className="truncate text-sm font-medium text-text">{children}</span>
      {detail !== undefined ? (
        <span className="truncate text-xs text-muted">{detail}</span>
      ) : (
        reserveDetail && (
          <span aria-hidden="true" className="text-xs">
            {"\u00a0"}
          </span>
        )
      )}
    </button>
  );
}
