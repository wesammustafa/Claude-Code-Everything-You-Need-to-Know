import { useId, useState, type SyntheticEvent } from "react";
import type { FolderKey, FolderQuestion, QuestAction } from "@quest/contract";
import { useAct, useActionsEnabled } from "../live/LiveProvider";
import {
  clientRefusal,
  refusalText,
  type FolderReason,
} from "../screens/folderWords";
import { Button } from "./Button";

export interface FolderFormProps {
  folderKey: FolderKey;
  /** A Level's Work folder (the copy or a path), or a new copy (a path only). */
  asks: FolderQuestion["asks"];
  practiceCopy: string;
  /** The engine's word on the last answer: nothing there, or this copy. */
  problem?: FolderQuestion["problem"] | undefined;
  /** The host is looking at the folder given. */
  checking?: boolean | undefined;
  /** Shown as Cancel beside the send, where the form can be closed. */
  onCancel?: (() => void) | undefined;
  /** After an answer the engine took. */
  onSent?: (() => void) | undefined;
  /** The heading's level: h2 on the overview, h4 in Settings. */
  heading?: "h2" | "h4";
}

const KEY = "folder.choose";
const LEVEL_NAMES: Record<string, string> = {
  intermediate: "Intermediate",
  advanced: "Advanced",
};
const FIELD =
  "h-9.5 w-full rounded-md border border-line-2 bg-surface px-3 font-mono text-sm text-text " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-disabled:opacity-disabled";

/**
 * Where a Level's Lessons run, or a new copy's folder: the overview's folder
 * question and Settings' Change. A Level offers this practice copy (the
 * default) or another folder; a new copy takes a path only. A relative or ~
 * path is turned down here before anything is sent; the server's reason for
 * a refused path stays until the path is edited. While the host looks at
 * the folder, Cancel drops the answer (`folder.cancel`).
 */
export function FolderForm({
  folderKey,
  asks,
  practiceCopy,
  problem = null,
  checking = false,
  onCancel,
  onSent,
  heading: Heading = "h2",
}: FolderFormProps) {
  const { act, pending } = useAct();
  const enabled = useActionsEnabled();
  const [where, setWhere] = useState<"copy" | "other">(
    asks === "work" ? "copy" : "other",
  );
  const [path, setPath] = useState("");
  // The engine's problem is about the path last sent: an edit hides it.
  const [edited, setEdited] = useState(false);
  const [refused, setRefused] = useState<{
    reason: FolderReason;
    path: string;
  } | null>(null);
  const headingId = useId();
  const fieldId = useId();
  const busy = !enabled || pending(KEY) || checking;

  const send = (action: QuestAction, sent = "") => {
    setEdited(false);
    void act(action, KEY).then((outcome) => {
      if (outcome.applied) {
        onSent?.();
        return;
      }
      const error = outcome.error;
      if (error?.error === "folder")
        setRefused({ reason: error.reason, path: sent });
      else if (error?.error === "invalid")
        setRefused({ reason: "invalid", path: sent });
    });
  };
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (busy) return;
    if (where === "copy") {
      send({ type: "folder.choose", key: folderKey, to: "practice-copy" });
      return;
    }
    const typed = path.trim();
    const own = clientRefusal(typed);
    if (own) {
      setRefused({ reason: own, path: typed });
      return;
    }
    send({ type: "folder.choose", key: folderKey, to: { path: typed } }, typed);
  };

  const alert = refused
    ? refusalText(refused.reason, asks, refused.path, practiceCopy)
    : problem && !edited
      ? refusalText(problem, asks, path, practiceCopy)
      : null;
  const title =
    asks === "work"
      ? `The work folder for ${LEVEL_NAMES[folderKey] ?? folderKey}`
      : "Give the folder of your new copy";

  return (
    <form
      aria-labelledby={headingId}
      className="grid gap-3"
      data-folder-form={asks}
      onSubmit={submit}
    >
      <Heading id={headingId} className="text-base font-semibold">
        {title}
      </Heading>
      {asks === "work" && (
        <fieldset className="grid gap-1.5">
          <legend className="sr-only">Where to practise</legend>
          {(
            [
              ["copy", "In this practice copy"],
              ["other", "In another folder, such as your repository"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name={`${headingId}-where`}
                value={value}
                checked={where === value}
                onChange={() => {
                  setWhere(value);
                  setRefused(null);
                }}
              />
              {label}
            </label>
          ))}
        </fieldset>
      )}
      {where === "other" && (
        <div className="grid gap-1.5">
          <label htmlFor={fieldId} className="text-sm text-muted">
            The folder&apos;s full path
          </label>
          <input
            id={fieldId}
            type="text"
            className={FIELD}
            value={path}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            maxLength={1024}
            {...(checking ? { "aria-disabled": true, readOnly: true } : {})}
            {...(alert ? { "aria-describedby": `${fieldId}-why` } : {})}
            onChange={(event) => {
              setPath(event.target.value);
              setRefused(null);
              setEdited(true);
            }}
          />
        </div>
      )}
      {alert !== null && !checking && (
        <p id={`${fieldId}-why`} role="alert" className="text-sm">
          {alert}
        </p>
      )}
      <p aria-live="polite" className="text-sm text-muted">
        {checking ? "Looking at that folder..." : ""}
      </p>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          pending={pending(KEY)}
          {...(busy ? { "aria-disabled": true } : {})}
        >
          Use this folder
        </Button>
        {(checking || onCancel) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (checking)
                void act({ type: "folder.cancel" }, "folder.cancel");
              onCancel?.();
            }}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
