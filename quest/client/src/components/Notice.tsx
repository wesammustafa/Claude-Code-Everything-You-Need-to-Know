import { createPortal } from "react-dom";
import { Command } from "./Command";
import { Icon } from "./Icon";

export type NoticeKind = "reconnecting" | "stopped";

export interface NoticeProps {
  /** The connection notice to show, or null while connected. */
  kind: NoticeKind | null;
}

// The strip's words, which its live region says too, so the two never differ.
const RECONNECTING = "Reconnecting to Claude Code Quest.";
const SAVED = "Your place is saved.";
const STOPPED = "Claude Code Quest stopped. Start it again in your terminal:";
const START = "npm run learn";

/** What the notice's live region says for each kind: the strip's words. */
const SAID: Record<NoticeKind, string> = {
  reconnecting: `${RECONNECTING} ${SAVED}`,
  stopped: `${STOPPED} ${START}`,
};

/**
 * The slim strip under the top bar while Claude Code Quest is away. It sits in
 * the page's flow, so the screen moves down beneath it rather than hide under
 * it; the shell holds it at the top of the window with the top bar. Its words
 * reach screen readers through a polite live region of their own, in <body>
 * beside the page and kept live while a Panel makes the page inert (ticket
 * 268), so a notice is said once when it appears, a Panel open or not. The
 * region stays mounted while connected.
 */
export function Notice({ kind }: NoticeProps) {
  return (
    <>
      <div data-notice-strip="">
        {kind && (
          <div
            key={kind}
            data-notice={kind}
            className="animate-drop border-b border-line bg-surface-2 shadow-sm"
          >
            <div className="mx-auto flex max-w-column flex-wrap items-center gap-x-2.5 gap-y-2 px-5 py-2 text-sm">
              {kind === "reconnecting" ? (
                <>
                  <span
                    className="size-2 animate-breathe rounded-full bg-wait"
                    aria-hidden="true"
                  />
                  <span>{RECONNECTING}</span>
                  <span className="text-muted">{SAVED}</span>
                </>
              ) : (
                <>
                  {/* The icon stays beside the sentence when the sentence wraps. */}
                  <span className="flex min-w-0 items-start gap-2.5">
                    <Icon name="pause" className="mt-0.5 text-wait" />
                    <span>{STOPPED}</span>
                  </span>
                  <Command text={START} fit />
                </>
              )}
            </div>
          </div>
        )}
      </div>
      {createPortal(
        <div
          role="status"
          aria-live="polite"
          data-notice-region=""
          data-keep-live=""
          className="sr-only"
        >
          {kind && SAID[kind]}
        </div>,
        document.body,
      )}
    </>
  );
}
