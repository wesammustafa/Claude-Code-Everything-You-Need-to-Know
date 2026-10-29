import { useRef, type ReactNode } from "react";
import { FixedLayer } from "../components/FixedLayer";
import { useHeightProperty } from "../lib/height-property";

export interface ActionBarProps {
  /** The way back, at the start of the bar. */
  start?: ReactNode;
  /** What the moment needs, at the end of the bar, the main action last. */
  children: ReactNode;
}

const GROUP =
  "flex items-center gap-2 max-sm:gap-1.5 max-sm:[&_svg]:hidden max-sm:[&>a]:px-3 max-sm:[&>a]:text-sm max-sm:[&>button]:px-3 max-sm:[&>button]:text-sm";

/**
 * The workspace's sticky action bar, fixed to the bottom of the window through
 * a portal. Its height feeds the page's scroll padding, so a control the
 * keyboard focuses never sits behind it.
 */
export function ActionBar({ start, children }: ActionBarProps) {
  const bar = useRef<HTMLElement>(null);
  useHeightProperty(bar, "--action-bar-height");
  return (
    <FixedLayer>
      {/* A named region, not a <footer>: in <body> a footer would be the page's contentinfo. */}
      <section
        ref={bar}
        aria-label="Step actions"
        data-action-bar=""
        className="fixed right-(--scroll-lock-gap) bottom-0 left-0 z-20 border-t border-line bg-surface/88 pt-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))] backdrop-blur-md backdrop-saturate-140"
      >
        {/* The lesson column's width and padding, so the bar's ends line up with the cards above it. */}
        <div className="mx-auto flex max-w-column flex-wrap items-center gap-2 px-5 max-sm:gap-1.5 max-sm:px-3">
          {start && <div className={GROUP}>{start}</div>}
          <div className={`${GROUP} ml-auto`}>{children}</div>
        </div>
      </section>
    </FixedLayer>
  );
}
