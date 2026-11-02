import { useEffect, useRef, useState } from "react";
import type { FolderKey, FolderQuestion, Snapshot } from "@quest/contract";
import { Button } from "../components/Button";
import { FolderForm } from "../components/FolderForm";
import { InlineText } from "../components/InlineText";
import { workFolderLabel } from "../screens/folderWords";
import { useCourseSnapshot } from "../screens/lesson";

interface Row {
  key: FolderKey;
  asks: FolderQuestion["asks"];
  name: string;
  path: string | null;
}

const LEVELS = [
  { key: "intermediate", name: "Intermediate" },
  { key: "advanced", name: "Advanced" },
] as const;

/** Intermediate's and Advanced's Work folders, then each new copy saved. */
function rowsOf(snapshot: Snapshot): Row[] {
  const saved = new Map(
    snapshot.learner.workFolders.map(({ key, path }) => [key, path]),
  );
  const levels: Row[] = LEVELS.filter(({ key }) =>
    snapshot.course.levels.some((level) => level.id === key),
  ).map(({ key, name }) => ({
    key,
    asks: "work",
    name,
    path: saved.get(key) ?? null,
  }));
  const copies: Row[] = snapshot.course.levels.flatMap((level) =>
    level.lessons.flatMap((lesson) => {
      const path = saved.get(lesson.id);
      return lesson.folder.kind === "new-copy" && path !== undefined
        ? [
            {
              key: lesson.id,
              asks: "new-copy" as const,
              name: lesson.title,
              path,
            },
          ]
        : [];
    }),
  );
  return [...levels, ...copies];
}

/**
 * Settings' Work folders (ticket 252): each later Level's folder, this
 * practice copy or a path, and each new copy a Lesson was given, with Change,
 * which opens the folder form in place, focus on its first field; closing it
 * (Cancel, sent, or Escape) gives focus back to Change. A refusal is the
 * server's; what the host then finds there the overview says.
 */
export function WorkFolders() {
  const snapshot = useCourseSnapshot();
  const [editing, setEditing] = useState<FolderKey | null>(null);
  const list = useRef<HTMLUListElement>(null);
  // The row last opened, whose Change takes focus back when its form closes.
  const opened = useRef<FolderKey | null>(null);
  useEffect(() => {
    const at = (key: FolderKey) =>
      list.current?.querySelector<HTMLElement>(`[data-work-folder="${key}"]`);
    if (editing !== null) {
      opened.current = editing;
      const row = at(editing);
      // The chosen radio, as Tab into the group would land, or the path.
      (
        row?.querySelector<HTMLElement>("input:checked") ??
        row?.querySelector<HTMLElement>("input")
      )?.focus();
      // Escape closes the form, not the Settings panel round it.
      const onKey = (event: KeyboardEvent) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        setEditing(null);
      };
      row?.addEventListener("keydown", onKey);
      return () => {
        row?.removeEventListener("keydown", onKey);
      };
    }
    if (opened.current !== null)
      at(opened.current)?.querySelector<HTMLElement>("button")?.focus();
    opened.current = null;
    return undefined;
  }, [editing]);
  const rows = snapshot ? rowsOf(snapshot) : [];
  // A course of Beginner alone has no Work folder.
  if (!snapshot || rows.length === 0) return null;
  const practiceCopy = snapshot.learner.practiceCopy;
  return (
    <div className="grid gap-2">
      <ul ref={list} className="grid gap-2" data-work-folders="">
        {rows.map((row) => (
          <li key={row.key} className="grid gap-1.5" data-work-folder={row.key}>
            {editing === row.key ? (
              <FolderForm
                folderKey={row.key}
                asks={row.asks}
                practiceCopy={practiceCopy}
                heading="h4"
                onCancel={() => {
                  setEditing(null);
                }}
                onSent={() => {
                  setEditing(null);
                }}
              />
            ) : (
              <div className="flex flex-wrap items-center gap-2.5 text-sm">
                <span className="font-semibold">
                  <InlineText text={row.name} />
                </span>
                <span className="min-w-0 break-all text-muted">
                  {row.path === null
                    ? "Not chosen yet"
                    : row.asks === "work" &&
                        workFolderLabel(row.path, practiceCopy) !== row.path
                      ? "This practice copy"
                      : row.path}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Change the folder for ${row.name}`}
                  onClick={() => {
                    setEditing(row.key);
                  }}
                >
                  Change
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        Changing a folder clears the Check results found in the old one.
      </p>
    </div>
  );
}
