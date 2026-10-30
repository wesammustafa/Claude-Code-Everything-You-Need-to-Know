import { useParams } from "react-router";
import type { ActiveLesson, LessonSummary, Snapshot } from "@quest/contract";
import { useSnapshot } from "../live/LiveProvider";

type Phase = ActiveLesson["phase"];

export interface ActiveOn<P extends Phase> {
  lesson: Extract<ActiveLesson, { phase: P }>;
  /** The Lesson's line in the course: its number, time and Badge. */
  summary: LessonSummary | null;
  snapshot: Snapshot;
}

/**
 * The snapshot when it has a body: readSnapshot checks only the header, and
 * the preview specs' minimal fake stream sends nothing else, so a screen
 * reads the course, the Learner and the Lesson only through this.
 */
export function useCourseSnapshot(): Snapshot | null {
  const snapshot = useSnapshot();
  const body = snapshot as Partial<Snapshot> | null;
  return body?.course && body.learner && body.lesson ? snapshot : null;
}

/** The Lesson's line in the snapshot's course, or null. */
export function summaryOf(
  snapshot: Snapshot | null,
  id: string | undefined,
): LessonSummary | null {
  for (const level of snapshot?.course.levels ?? [])
    for (const lesson of level.lessons) if (lesson.id === id) return lesson;
  return null;
}

/** The phase's path: the engine owns the place, the route follows it. */
export function pathOf(lesson: ActiveLesson): string {
  if (lesson.phase === "overview") return `/lesson/${lesson.id}`;
  if (lesson.phase === "complete") return `/lesson/${lesson.id}/complete`;
  return `/lesson/${lesson.id}/step`;
}

/**
 * The active Lesson, when it is the one the route names and in one of
 * `phases`; null before the snapshot, while the engine moves to it, or for a
 * snapshot with no Lesson.
 */
export function useActiveLesson<P extends Phase>(
  ...phases: P[]
): ActiveOn<P> | null {
  const snapshot = useCourseSnapshot();
  const { lessonId } = useParams();
  const lesson = snapshot?.lesson;
  if (!snapshot || !lesson || lesson.id !== lessonId) return null;
  if (!(phases as Phase[]).includes(lesson.phase)) return null;
  return {
    lesson: lesson as Extract<ActiveLesson, { phase: P }>,
    summary: summaryOf(snapshot, lesson.id),
    snapshot,
  };
}

/**
 * Whether the route names no Lesson of the course. Unknown only once a
 * snapshot with a course says so: before that nothing is known.
 */
export function useUnknownLesson(): boolean {
  const snapshot = useCourseSnapshot();
  const { lessonId } = useParams();
  if (!snapshot) return false;
  return summaryOf(snapshot, lessonId) === null;
}
