import { cx } from "../lib/cx";

export interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * On or off, at once (a setting, not a form field): a button with the switch
 * role. Off, the track is an outline in the mark colour; on, it fills with
 * coral and the thumb moves across by --switch-travel. Its colour changes
 * over --duration-fast; under reduced motion the thumb snaps to its place.
 * A contrast theme drops every fill, so there the switch keeps its own in the
 * theme's colours: off, an outlined track with a text-coloured thumb; on, a
 * track in the highlight colour with a thumb in the highlight's text colour.
 */
export function Switch({ label, checked, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        onChange(!checked);
      }}
      className="inline-flex cursor-pointer items-center gap-3 rounded-sm text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <span
        aria-hidden="true"
        data-track=""
        className={cx(
          "relative h-5 w-9 shrink-0 rounded-full border transition-[background-color,border-color] duration-(--duration-fast) ease-out forced-colors:forced-color-adjust-none",
          checked
            ? "border-accent-mark bg-accent-mark forced-colors:border-(--forced-current) forced-colors:bg-(--forced-current)"
            : "border-mark bg-surface-2 forced-colors:border-(--forced-mark) forced-colors:bg-transparent",
        )}
      >
        <span
          data-thumb=""
          className={cx(
            "absolute top-0.5 left-0.5 size-3.5 rounded-full shadow-sm transition-[translate,background-color] duration-(--duration-fast) ease-out reduced:transition-[background-color] forced-colors:shadow-none",
            checked
              ? "translate-x-(--switch-travel) bg-accent-ink forced-colors:bg-(--forced-current-ink)"
              : "bg-mark forced-colors:bg-(--forced-mark)",
          )}
        />
      </span>
      <span>{label}</span>
    </button>
  );
}
