import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { cx } from "../lib/cx";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

// Each state from tokens: hover and pressed change colour, pressing also
// travels by --press-y and --press-scale (zero under reduced motion), focus
// draws the focus ring, and disabled fades the control by --opacity-disabled
// and stops it. Hover and press apply only to a control that is not disabled
// (a link never is). Each variant sets its own border colour: a second
// border colour in BASE would win or lose by Tailwind's order, not by
// intent. Every class is written out in full, never composed, so Tailwind
// finds it in this file.
const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap select-none border font-semibold tracking-tight no-underline cursor-pointer " +
  "transition-[background-color,border-color,color,box-shadow,translate,scale] duration-(--duration-fast) ease-out " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

const PRESS =
  "not-disabled:active:duration-(--duration-press) not-disabled:active:translate-y-(--press-y) not-disabled:active:scale-(--press-scale)";

const DISABLED = "disabled:cursor-not-allowed disabled:opacity-disabled";

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm rounded-sm",
  md: "h-9.5 px-4 text-control rounded-md",
  lg: "h-12 px-5.5 text-base rounded-lg",
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-accent text-accent-ink shadow-sm " +
    "not-disabled:hover:bg-accent-hover not-disabled:active:bg-accent-pressed",
  secondary:
    "border-line-2 bg-surface-2 text-text " +
    "not-disabled:hover:border-accent not-disabled:active:bg-pressed",
  ghost:
    "border-transparent bg-transparent text-muted " +
    "not-disabled:hover:bg-surface-2 not-disabled:hover:text-text not-disabled:active:bg-pressed not-disabled:active:text-text",
};

/** The classes for a control that looks like a button. */
export function buttonClasses(
  variant: ButtonVariant,
  size: ButtonSize,
  element: "button" | "link" = "button",
): string {
  return cx(
    BASE,
    SIZES[size],
    VARIANTS[variant],
    PRESS,
    element === "button" && DISABLED,
  );
}

interface ButtonLookProps {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  /** An icon before the label. */
  icon?: IconName | undefined;
  /** An icon after the label, such as an arrow that leads on. */
  iconEnd?: IconName | undefined;
  children: ReactNode;
}

function Content({
  icon,
  iconEnd,
  size,
  children,
}: Omit<ButtonLookProps, "variant">) {
  const iconSize = size === "lg" ? "lg" : "md";
  return (
    <>
      {icon && <Icon name={icon} size={iconSize} />}
      <span>{children}</span>
      {iconEnd && (
        <Icon
          name={iconEnd}
          size={iconSize}
          className="transition-transform duration-(--duration-fast) ease-out group-hover:translate-x-(--nudge) group-disabled:translate-x-0"
        />
      )}
    </>
  );
}

export type ButtonProps = ButtonLookProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconEnd,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx("group", buttonClasses(variant, size), className)}
      {...rest}
    >
      <Content icon={icon} iconEnd={iconEnd} size={size}>
        {children}
      </Content>
    </button>
  );
}

export type ButtonLinkProps = ButtonLookProps & Omit<LinkProps, "children">;

/** A link that moves to another screen, drawn as a button. */
export function ButtonLink({
  variant = "secondary",
  size = "md",
  icon,
  iconEnd,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={cx("group", buttonClasses(variant, size, "link"), className)}
      {...rest}
    >
      <Content icon={icon} iconEnd={iconEnd} size={size}>
        {children}
      </Content>
    </Link>
  );
}
