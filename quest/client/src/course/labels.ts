// The app's own names for a Level and a Lesson's place in it: words the
// browser writes, not quotes from the course.
import type { LevelId } from "@quest/contract";

export const LEVEL_NAMES: Readonly<Record<LevelId, string>> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/**
 * "Lesson 3" or "Capstone", as the Learner reads a lesson's place in its
 * Level; plain "Lesson" when the course gives no number.
 */
export function lessonLabel(number: number | null, capstone: boolean): string {
  if (capstone) return "Capstone";
  return number === null ? "Lesson" : `Lesson ${String(number)}`;
}

/** "Beginner · Lesson 1": the eyebrow above a Lesson's title. */
export function lessonEyebrow(
  level: LevelId,
  number: number | null,
  capstone: boolean,
): string {
  return `${LEVEL_NAMES[level]} · ${lessonLabel(number, capstone)}`;
}
