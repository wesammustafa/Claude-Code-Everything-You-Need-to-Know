import { Link } from "react-router";
import { Button } from "../components/Button";
import { InlineText } from "../components/InlineText";
import { LessonBadge } from "../components/badges";
import { LEVEL_NAMES, lessonLabel } from "../course/labels";
import { PageTitle } from "../shell/PageTitle";
import { COLUMN, EYEBROW, QUIET_LINK } from "./layout";
import { useCourseSnapshot, useOpenLesson } from "./lesson";

/**
 * A Lesson the Learner browses to but has not opened: its line in the
 * course, read only. Only "Open this lesson" moves the Learner's place.
 */
export function LessonPreview({ id }: { id: string }) {
  const snapshot = useCourseSnapshot();
  const open = useOpenLesson(id);
  const level = snapshot?.course.levels.find((l) =>
    l.lessons.some((lesson) => lesson.id === id),
  );
  const summary = level?.lessons.find((lesson) => lesson.id === id);
  if (!level || !summary) return null;
  return (
    <main className={COLUMN} data-lesson-preview="">
      <header className="grid gap-2">
        <span className={EYEBROW}>
          {`${LEVEL_NAMES[level.id]} · ${lessonLabel(summary.number, summary.capstone)}`}
        </span>
        <PageTitle title={summary.title} className="text-3xl max-sm:text-2xl">
          <InlineText text={summary.title} />
        </PageTitle>
        {summary.minutes !== "" && (
          <p className="text-muted">{summary.minutes}</p>
        )}
      </header>
      <div className="justify-self-start">
        <LessonBadge
          lesson={summary.id}
          name={summary.badge}
          earned={summary.complete}
          size="sm"
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="primary" iconEnd="arrow" {...open}>
          Open this lesson
        </Button>
        <Link to="/journey" className={QUIET_LINK}>
          Back to the learning journey
        </Link>
      </div>
    </main>
  );
}
