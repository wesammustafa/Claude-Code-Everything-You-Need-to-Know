import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Milestone, Snapshot } from "@quest/contract";
import { Button } from "../components/Button";
import { InlineText } from "../components/InlineText";
import { useMilestone, useSnapshot } from "../live/LiveProvider";

const WORDS: Record<string, string> = {
  unreadable:
    "Your saved progress could not be read, so it was moved aside in `.practice/` (as `learn.json.unreadable`) and the course starts fresh.",
  "unreadable-kept":
    "Your saved progress could not be read or moved aside, so it stays as it is and nothing new is saved. Move `.practice/learn.json` out of the way, then run `npm run learn` again.",
};

const NOT_SAVING =
  "Progress is not being saved. If your practice copy has no `.practice` folder, run `mkdir .practice` there.";

// What a screen reader hears: the words without their code marks.
const said = (text: string) => text.replaceAll("`", "");

const STRIP = "animate-drop border-b border-line bg-surface-2 shadow-sm";
const ROW =
  "mx-auto flex max-w-column flex-wrap items-center gap-x-2.5 gap-y-2 px-5 py-2 text-sm";

type Notice = Extract<Milestone, { type: "notice" }>;
const isSaveNotice = (m: Milestone): m is Notice =>
  m.type === "notice" && m.kind in WORDS;

/**
 * The save's notices under the top bar (ticket 213's kinds): a save that
 * could not be read, shown once, by the tab that claims it as milestones.ts
 * claims a moment (the claim sends `milestone.shown`), until Got it; and,
 * while progress is not being saved, a line that stays. Their words reach
 * screen readers through a polite live region in <body>, kept live while a
 * Panel makes the page inert (ticket 268), as the connection notice's is.
 */
export function SaveNotices() {
  // A snapshot may carry only its header.
  const snapshot = useSnapshot() as Partial<Snapshot> | null;
  const { show } = useMilestone();
  const [shown, setShown] = useState<Notice[]>([]);
  const claimed = useRef(new Set<string>());
  const waiting = (snapshot?.milestones ?? []).filter(isSaveNotice);
  const ids = waiting.map((m) => m.id).join(" ");
  useEffect(() => {
    for (const notice of waiting) {
      if (claimed.current.has(notice.id)) continue;
      claimed.current.add(notice.id);
      void show(notice.id).then((won) => {
        if (won) setShown((list) => [...list, notice]);
      });
    }
    // `ids` names the notices waiting; the list itself is new each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, show]);
  const saving = snapshot?.learner?.saving ?? true;
  return (
    <div data-save-notices="">
      {shown.map((notice) => (
        <div key={notice.id} data-save-notice={notice.kind} className={STRIP}>
          <div className={ROW}>
            <span className="min-w-0">
              <InlineText text={WORDS[notice.kind] ?? ""} />
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShown((list) => list.filter((n) => n.id !== notice.id));
              }}
            >
              Got it
            </Button>
          </div>
        </div>
      ))}
      {!saving && (
        <div data-save-notice="not-saving" className={STRIP}>
          <div className={ROW}>
            <InlineText text={NOT_SAVING} />
          </div>
        </div>
      )}
      {createPortal(
        <div
          role="status"
          aria-live="polite"
          data-save-notices-region=""
          data-keep-live=""
          className="sr-only"
        >
          {shown.map((notice) => (
            <p key={notice.id}>{said(WORDS[notice.kind] ?? "")}</p>
          ))}
          {!saving && <p>{said(NOT_SAVING)}</p>}
        </div>,
        document.body,
      )}
    </div>
  );
}
