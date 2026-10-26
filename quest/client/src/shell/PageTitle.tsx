import { useEffect, type ReactNode } from "react";
import { cx } from "../lib/cx";

export interface PageTitleProps {
  /** The tab's title; the brand follows it. */
  title: string;
  className?: string;
  children?: ReactNode;
}

/**
 * A screen's one heading. It names the browser tab, and the shell moves focus
 * to it after a route change so a screen reader starts at the new screen.
 */
export function PageTitle({ title, className, children }: PageTitleProps) {
  useEffect(() => {
    document.title = `${title} · Claude Code Quest`;
  }, [title]);
  return (
    <h1
      tabIndex={-1}
      data-page-title=""
      className={cx("focus:outline-none", className)}
    >
      {children ?? title}
    </h1>
  );
}
