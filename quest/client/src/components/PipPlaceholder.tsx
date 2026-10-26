import { cx } from "../lib/cx";

// A stand-in for Pip until Pip's renderer and icon land: the brand mark's
// coral body and two eyes, drawn from tokens. Decorative: the words beside it
// carry the meaning.
const SIZES = {
  icon: { body: "h-4.5 w-5.5 rounded-sm gap-1", eye: "h-1.25 w-0.75" },
  beside: { body: "h-15 w-18 rounded-xl gap-3", eye: "h-5 w-2.5" },
  hero: { body: "h-38 w-44 rounded-2xl gap-7", eye: "h-12 w-6" },
} as const;

export interface PipPlaceholderProps {
  size: keyof typeof SIZES;
  className?: string;
}

export function PipPlaceholder({ size, className }: PipPlaceholderProps) {
  const s = SIZES[size];
  return (
    <span
      aria-hidden="true"
      data-pip-placeholder={size}
      className={cx(
        "inline-flex shrink-0 items-center justify-center bg-accent shadow-mark",
        s.body,
        className,
      )}
    >
      <i className={cx("rounded-full bg-accent-ink", s.eye)} />
      <i className={cx("rounded-full bg-accent-ink", s.eye)} />
    </span>
  );
}
