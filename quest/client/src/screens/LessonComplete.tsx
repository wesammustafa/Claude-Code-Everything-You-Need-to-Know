import { Link } from "react-router";
import { ButtonLink } from "../components/Button";
import { InlineText } from "../components/InlineText";
import { PipPlaceholder } from "../components/PipPlaceholder";
import { lessonLabel, nextLesson } from "../course/placeholder";
import { PageTitle } from "../shell/PageTitle";
import { NotFound } from "./NotFound";
import { EYEBROW, MOMENT, QUIET_LINK } from "./layout";
import { useLesson } from "./lesson";

/** Lesson complete: Pip, the check result and the next Lesson. */
export function LessonComplete() {
  const lesson = useLesson();
  if (!lesson) return <NotFound />;
  const next = nextLesson(lesson);

  return (
    <main className={MOMENT}>
      <PipPlaceholder size="hero" className="mb-2" />
      <span className={EYEBROW}>{`${lessonLabel(lesson)} complete`}</span>
      <PageTitle
        title={`Complete: ${lesson.title}`}
        className="text-3xl max-sm:text-2xl"
      >
        <InlineText text={lesson.title} />
      </PageTitle>
      <p className="text-muted">The lesson's check passes.</p>
      {next && (
        <ButtonLink
          to={`/lesson/${next.id}`}
          variant="primary"
          size="lg"
          iconEnd="arrow"
          className="mt-2"
        >
          {`Next: ${lessonLabel(next)}`}
        </ButtonLink>
      )}
      <Link to="/journey" className={QUIET_LINK}>
        Back to the learning journey
      </Link>
    </main>
  );
}
