import { NotFound } from "./NotFound";
import { COLUMN } from "./layout";
import { useUnknownLesson } from "./lesson";

/**
 * What a Lesson screen shows until the snapshot has the Lesson the route
 * names in its phase: NotFound for an id the course does not have, else a
 * quiet, empty column while the engine moves there.
 */
export function LessonGate() {
  const unknown = useUnknownLesson();
  if (unknown) return <NotFound />;
  return <main className={COLUMN} aria-busy="true" data-lesson-waiting="" />;
}
