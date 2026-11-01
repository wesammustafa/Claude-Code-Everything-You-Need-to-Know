import { Command } from "./Command";
import { Icon } from "./Icon";

export type NoticeKind = "reconnecting" | "stopped";

export interface NoticeProps {
  /** The connection notice to show, or null while connected. */
  kind: NoticeKind | null;
}

/**
 * The slim strip under the top bar while Claude Code Quest is away. It sits in
 * the page's flow, so the screen moves down beneath it rather than hide under
 * it; the shell holds it at the top of the window with the top bar. The live
 * region stays mounted while connected, so a notice reaches screen readers
 * once, politely, when it appears.
 */
export function Notice({ kind }: NoticeProps) {
  return (
    <div role="status" aria-live="polite" data-notice-region="">
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
                <span>Reconnecting to Claude Code Quest</span>
                <span className="text-muted">Your place is saved.</span>
              </>
            ) : (
              <>
                {/* The icon stays beside the sentence when the sentence wraps. */}
                <span className="flex min-w-0 items-start gap-2.5">
                  <Icon name="pause" className="mt-0.5 text-wait" />
                  <span>
                    Claude Code Quest stopped. Start it again in your terminal:
                  </span>
                </span>
                <Command text="npm run learn" fit />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
