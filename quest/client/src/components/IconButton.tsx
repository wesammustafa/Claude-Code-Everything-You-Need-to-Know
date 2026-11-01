import type { ButtonHTMLAttributes, Ref } from "react";
import { cx } from "../lib/cx";
import { Icon, type IconName } from "./Icon";

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "aria-label"
> {
  icon: IconName;
  /** The button's accessible name: it has no visible text. */
  label: string;
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({
  icon,
  label,
  className,
  type = "button",
  ref,
  ...rest
}: IconButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      className={cx(
        "inline-grid size-8.5 shrink-0 place-items-center rounded-md border border-transparent bg-transparent text-muted cursor-pointer",
        "transition-[background-color,color,translate,scale] duration-(--duration-fast) ease-out",
        "enabled:hover:bg-surface-2 enabled:hover:text-text",
        "enabled:active:bg-pressed enabled:active:text-text enabled:active:duration-(--duration-press) enabled:active:translate-y-(--press-y) enabled:active:scale-(--press-scale)",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        "disabled:cursor-not-allowed disabled:opacity-disabled",
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size="lg" />
    </button>
  );
}
