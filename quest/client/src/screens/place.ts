import type { LessonSummary, LevelId, Snapshot } from "@quest/contract";
import { summaryOf } from "./lesson";

/** Where the Learner's place is on the journey, and the Next band's word. */
export interface JourneyPlace {
  /** The Lesson the Next band offers, or null when every one is complete. */
  current: LessonSummary | null;
  label: "Continue" | "Start" | null;
}

/**
 * The current Lesson: the active one while it is played or open on its
 * overview, the course's next once it is complete. The engine names both;
 * the client only picks between them.
 */
export function journeyPlace(snapshot: Snapshot): JourneyPlace {
  const { lesson, course } = snapshot;
  if (lesson.phase === "playing" || lesson.phase === "step-down")
    return { current: summaryOf(snapshot, lesson.id), label: "Continue" };
  if (lesson.phase === "overview")
    return { current: summaryOf(snapshot, lesson.id), label: "Start" };
  const next = summaryOf(snapshot, course.next ?? undefined);
  return next
    ? { current: next, label: "Start" }
    : { current: null, label: null };
}

/**
 * Where a lesson in play stands, as "Step 4 of 11", for the Next card: the
 * step on screen among the lesson's steps. Null outside play, or while a
 * resume waits with no step open.
 */
export function stepPlace(snapshot: Snapshot): string | null {
  const { lesson } = snapshot;
  if (lesson.phase !== "playing" || lesson.step === null) return null;
  const at = lesson.steps.findIndex((step) => step.id === lesson.step?.id);
  if (at < 0) return null;
  return `Step ${String(at + 1)} of ${String(lesson.steps.length)}`;
}

export type NodeState = "done" | "current" | "to do";

/** A Lesson's state on the journey: current wins over done. */
export function nodeState(
  summary: LessonSummary,
  current: LessonSummary | null,
): NodeState {
  if (summary.id === current?.id) return "current";
  return summary.complete ? "done" : "to do";
}

/** The Level a Lesson of the course sits in. */
export function levelOf(snapshot: Snapshot, lesson: LessonSummary): LevelId {
  const found = snapshot.course.levels.find((l) =>
    l.lessons.some((s) => s.id === lesson.id),
  );
  return found?.id ?? "beginner";
}

export interface Count {
  done: number;
  total: number;
}

/** How many Lessons, and how many Levels, are complete: completion only. */
export function courseCounts(snapshot: Snapshot): {
  lessons: Count;
  levels: Count;
} {
  const { levels } = snapshot.course;
  const lessons = levels.flatMap((level) => level.lessons);
  return {
    lessons: {
      done: lessons.filter((s) => s.complete).length,
      total: lessons.length,
    },
    levels: {
      done: levels.filter((l) => l.complete).length,
      total: levels.length,
    },
  };
}
