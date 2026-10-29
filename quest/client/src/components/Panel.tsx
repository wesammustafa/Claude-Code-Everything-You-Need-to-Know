import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { cx } from "../lib/cx";
import { FixedLayer } from "./FixedLayer";
import { IconButton } from "./IconButton";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export interface PanelProps {
  title: string;
  open: boolean;
  onClose: () => void;
  /** The wider sheet, for reading a lesson page. */
  wide?: boolean;
  children: ReactNode;
}

// While a Panel is open, everything else in <body> is inert: #root and the
// fixed layers portaled beside it (the action bar, notices), including any
// that mount while it is open. Returns the undo.
function makeRestInert(own: Element): () => void {
  const made: Element[] = [];
  const mark = (el: Element) => {
    if (el === own || el.hasAttribute("inert")) return;
    el.setAttribute("inert", "");
    made.push(el);
  };
  for (const el of document.body.children) mark(el);
  const observer = new MutationObserver((records) => {
    for (const record of records)
      for (const node of record.addedNodes)
        if (node instanceof Element) mark(node);
  });
  observer.observe(document.body, { childList: true });
  return () => {
    observer.disconnect();
    for (const el of made) el.removeAttribute("inert");
  };
}

// Stops the page scrolling behind the Panel without moving it: the space the
// scrollbar took (none for an overlay scrollbar) becomes padding, and the
// fixed bars keep clear of it through --scroll-lock-gap.
function lockScroll(): () => void {
  const html = document.documentElement;
  const gap = Math.max(0, window.innerWidth - html.clientWidth);
  html.style.setProperty("--scroll-lock-gap", `${String(gap)}px`);
  html.setAttribute("data-scroll-locked", "");
  return () => {
    html.removeAttribute("data-scroll-locked");
    html.style.removeProperty("--scroll-lock-gap");
  };
}

// Whether the element's content is taller than the element, following the
// element as it resizes and its content changes.
function useOverflows(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
): boolean {
  const subscribe = useCallback(
    (changed: () => void) => {
      // The element exists only while the Panel is open, so opening it subscribes again.
      const el = open ? ref.current : null;
      if (!el || typeof ResizeObserver !== "function") return () => undefined;
      const resize = new ResizeObserver(changed);
      const watch = () => {
        resize.disconnect();
        resize.observe(el);
        for (const child of el.children) resize.observe(child);
      };
      watch();
      const content = new MutationObserver(() => {
        watch();
        changed();
      });
      content.observe(el, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      return () => {
        resize.disconnect();
        content.disconnect();
      };
    },
    [ref, open],
  );
  return useSyncExternalStore(
    subscribe,
    () => {
      const el = ref.current;
      return el ? el.scrollHeight > el.clientHeight : false;
    },
    () => false,
  );
}

/**
 * A sheet from the right. While open, the page behind it is inert and still,
 * Escape or a click on the scrim closes it, Tab stays inside, and focus
 * returns to the control that opened it. A body taller than the sheet is a
 * tab stop of its own, so the keyboard can scroll it.
 */
export function Panel({
  title,
  open,
  onClose,
  wide = false,
  children,
}: PanelProps) {
  const titleId = useId();
  const scrim = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const scrolls = useOverflows(body, open);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const scrimNode = scrim.current;
    if (!scrimNode) return;
    const restoreInert = makeRestInert(scrimNode);
    const unlockScroll = lockScroll();
    close.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !sheet.current) return;
      const focusable = [
        ...sheet.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onScrimClick = (event: MouseEvent) => {
      if (event.target === scrim.current) onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    scrimNode.addEventListener("click", onScrimClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      scrimNode.removeEventListener("click", onScrimClick);
      restoreInert();
      unlockScroll();
      opener?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <FixedLayer>
      <div
        ref={scrim}
        data-panel-scrim=""
        className="fixed inset-0 z-50 flex animate-fade justify-end bg-scrim/50"
      >
        <section
          ref={sheet}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={cx(
            "flex h-full w-full animate-sheet flex-col border-l border-line bg-surface shadow-lg",
            wide ? "max-w-reading" : "max-w-sheet",
          )}
        >
          <header className="flex items-center justify-between gap-3 border-b border-line py-3.5 pr-4 pl-5.5">
            <h2 id={titleId} className="text-lg">
              {title}
            </h2>
            <IconButton
              ref={close}
              icon="close"
              label="Close"
              onClick={onClose}
            />
          </header>
          {/* Tab can reach a body that scrolls, which the arrow and page keys then
              move; the trap above finds it through its tabindex. */}
          <div
            ref={body}
            tabIndex={scrolls ? 0 : undefined}
            role={scrolls ? "region" : undefined}
            aria-labelledby={scrolls ? titleId : undefined}
            className="grid flex-1 content-start gap-5.5 overflow-auto px-5.5 pt-5 pb-10 focus-visible:-outline-offset-2"
          >
            {children}
          </div>
        </section>
      </div>
    </FixedLayer>
  );
}
