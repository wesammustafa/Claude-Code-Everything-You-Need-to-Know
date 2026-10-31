import { useParams } from "react-router";
import { LessonPreview } from "./LessonPreview";
import { NotFound } from "./NotFound";
import { COLUMN } from "./layout";
import { useCourseSnapshot, useUnknownLesson } from "./lesson";

/**
 * What a Lesson screen shows until the snapshot has the Lesson the route
 * names in its phase: NotFound for an id the course does not have, the
 * preview of a Lesson of the course that is not the active one (browsing
 * moves nothing), else a quiet, empty column while the engine moves there.
 */
export function LessonGate() {
  const unknown = useUnknownLesson();
  const snapshot = useCourseSnapshot();
  const { lessonId } = useParams();
  if (unknown) return <NotFound />;
  if (snapshot && lessonId !== undefined && lessonId !== snapshot.lesson.id)
    return <LessonPreview id={lessonId} />;
  return <main className={COLUMN} aria-busy="true" data-lesson-waiting="" />;
}
