import type { ReactNode, SyntheticEvent } from "react";
import { cx } from "../lib/cx";
import { Icon } from "./Icon";

export interface DisclosureProps {
  summary: ReactNode;
  /**
   * How many things it holds: the number shows beside the summary, and a
   * screen reader hears `label` (such as "3 lines") in its place.
   */
  count?: { value: number; label: string };
  /** A card of its own, or a quiet line inside another. */
  variant?: "card" | "quiet";
  /** Called as it opens or closes, from the details element's toggle event. */
  onToggle?: (event: SyntheticEvent<HTMLDetailsElement>) => void;
  children: ReactNode;
}

/**
 * More, behind a summary: native details and summary, so the browser and
 * every assistive technology already know how to open it. The chevron turns
 * over --duration-turn (it snaps under reduced motion) and the body fades in.
 */
export function Disclosure({
  summary,
  count,
  variant = "card",
  onToggle,
  children,
}: DisclosureProps) {
  const card = variant === "card";
  return (
    <details
      data-disclosure={variant}
      onToggle={onToggle}
      className={cx(
        "group/details",
        card && "rounded-lg border border-line bg-surface p-5 shadow-sm",
      )}
    >
      <summary
        className={cx(
          "flex cursor-pointer list-none items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden",
          card
            ? "font-semibold"
            : "w-fit text-sm text-muted transition-colors duration-(--duration-fast) ease-out hover:text-text",
        )}
      >
        {!card && (
          <Icon
            name="chevron"
            size="sm"
            className="transition-[rotate] duration-(--duration-turn) ease-out group-open/details:rotate-90"
          />
        )}
        <span>{summary}</span>
        {count !== undefined && (
          <>
            <span
              aria-hidden="true"
              className="rounded-full bg-surface-2 px-2 text-xs font-semibold text-muted"
            >
              {count.value}
            </span>
            <span className="sr-only">{`, ${count.label}`}</span>
          </>
        )}
        {card && (
          <Icon
            name="chevron"
            size="sm"
            className="ml-auto text-muted transition-[rotate] duration-(--duration-turn) ease-out group-open/details:rotate-90"
          />
        )}
      </summary>
      <div
        className={cx(
          "animate-fade text-sm text-muted",
          card ? "mt-3" : "mt-2 pl-5.5",
        )}
      >
        {children}
      </div>
    </details>
  );
}
