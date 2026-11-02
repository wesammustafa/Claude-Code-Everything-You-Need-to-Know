// The complete moments' milestones: which pending ones a screen may
// celebrate, the Level moment's Badges, and the claim that decides which
// tab plays a moment ("Moments, each shown once").
import { useEffect, useRef, useState } from "react";
import type {
  LessonId,
  LevelId,
  LevelView,
  Milestone,
  Snapshot,
} from "@quest/contract";
import { useMilestone } from "../live/LiveProvider";
import { usePipInput } from "../pip/PipStage";

/** A Level's key in a route, as its Lessons' ids start: b, i or a. */
export const LEVEL_KEYS: Readonly<Record<LevelId, string>> = {
  beginner: "b",
  intermediate: "i",
  advanced: "a",
};

/** The Level a route's key names, or null. */
export function levelOfKey(key: string | undefined): LevelId | null {
  const found = Object.entries(LEVEL_KEYS).find(([, k]) => k === key);
  return found ? (found[0] as LevelId) : null;
}

/** A Level moment's route. */
export function levelPath(level: LevelId): string {
  return `/level/${LEVEL_KEYS[level]}/complete`;
}

export const COURSE_PATH = "/course/complete";

/**
 * The snapshot's pending milestones a moment may celebrate, oldest first:
 * every one but a notice, which its own screen shows.
 */
export function celebratable(snapshot: Snapshot | null): Milestone[] {
  return (snapshot?.milestones ?? []).filter((m) => m.type !== "notice");
}

export interface LevelMoment {
  level: LevelView;
  /** Each Lesson of the Level with a Badge, in course order. */
  badges: { lesson: LessonId; name: string }[];
  /** The Level after it, or null after Advanced. */
  next: LevelView | null;
}

/** The Level moment of `level`, or null while the snapshot has it not complete. */
export function levelMoment(
  snapshot: Snapshot,
  level: LevelId,
): LevelMoment | null {
  const levels = snapshot.course.levels;
  const at = levels.findIndex((view) => view.id === level);
  const view = levels[at];
  if (view === undefined || !view.complete) return null;
  const badges = view.lessons.flatMap((lesson) =>
    lesson.badge === null ? [] : [{ lesson: lesson.id, name: lesson.badge }],
  );
  return { level: view, badges, next: levels[at + 1] ?? null };
}

export type Claim = { won: true; envelope: Milestone } | { won: false };

/**
 * Claims the oldest pending milestone when `match` accepts it, and tells
 * whether this tab won it. A win sends the milestone to Pip once, for his
 * Celebration; a lost claim, a reload or another tab plays nothing.
 */
export function useClaimMilestone(match: (m: Milestone) => boolean): Claim {
  const { milestone, show } = useMilestone();
  const pip = usePipInput();
  const [won, setWon] = useState<Milestone | null>(null);
  const sent = useRef<string | null>(null);
  const wanted = milestone !== null && match(milestone) ? milestone : null;
  const id = wanted?.id ?? null;
  const envelope = useRef<Milestone | null>(null);
  useEffect(() => {
    if (wanted !== null) envelope.current = wanted;
  }, [wanted]);
  useEffect(() => {
    if (id === null) return;
    const claimed = envelope.current;
    // Not cancelled when `id` clears: winning the claim is what clears it.
    void show(id).then((ok) => {
      if (!ok || claimed === null || sent.current === claimed.id) return;
      sent.current = claimed.id;
      setWon(claimed);
      pip({ type: "events", events: [claimed] });
    });
  }, [id, show, pip]);
  return won === null ? { won: false } : { won: true, envelope: won };
}
