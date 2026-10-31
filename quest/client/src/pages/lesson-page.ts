import type { Snapshot } from "@quest/contract";

/** The rendered page "Read the full lesson" opens, by repository path. */
export type LessonPage = { page: string };

const LEVEL_INDEX = /^(beginner|intermediate|advanced)-index$/;

/**
 * During a warm-up, the page it recalls: the earlier Lesson's, or the
 * Level's README for a `<level>-index` warm-up. Otherwise the active
 * Lesson's own page. Null while the snapshot does not name it.
 */
export function lessonPageOf(snapshot: Snapshot | null): LessonPage | null {
  if (!snapshot) return null;
  const { lesson } = snapshot;
  const pageOf = (id: string): string | undefined =>
    snapshot.course.levels
      .flatMap((level) => level.lessons)
      .find((summary) => summary.id === id)?.page;
  const from =
    lesson.phase === "playing" ? lesson.step?.warmup?.from : undefined;
  if (from !== undefined) {
    const level = LEVEL_INDEX.exec(from)?.[1];
    if (level !== undefined) return { page: `docs/${level}/README.md` };
    const recalled = pageOf(from);
    if (recalled !== undefined) return { page: recalled };
  }
  const own = pageOf(lesson.id);
  return own === undefined ? null : { page: own };
}
