import { useEffect, useState } from "react";
import { Button, ButtonLink } from "../components/Button";
import { Disclosure } from "../components/Disclosure";
import { InlineText } from "../components/InlineText";
import { Panel } from "../components/Panel";
import { Says } from "../components/Says";
import { lessonLabel, levelOf } from "../course/placeholder";
import { usePipInput } from "../pip/PipStage";
import { PageTitle } from "../shell/PageTitle";
import { NotFound } from "./NotFound";
import { COLUMN, EYEBROW } from "./layout";
import { useLesson } from "./lesson";

/** A Lesson's overview: Pip with one line, the title, what the check looks for, and how to start. */
export function LessonOverview() {
  const lesson = useLesson();
  const [reading, setReading] = useState(false);
  // Pip rests while the lesson page is open beside it.
  const tellPip = usePipInput();
  useEffect(() => {
    tellPip({ type: "pagePanel", open: reading });
  }, [tellPip, reading]);
  useEffect(
    () => () => {
      tellPip({ type: "pagePanel", open: false });
    },
    [tellPip],
  );
  if (!lesson) return <NotFound />;
  const level = levelOf(lesson);

  return (
    <main className={COLUMN}>
      <Says>Ready when you are.</Says>
      <header className="grid gap-2">
        <span
          className={EYEBROW}
        >{`${level.name} · ${lessonLabel(lesson)}`}</span>
        <PageTitle title={lesson.title} className="text-3xl max-sm:text-2xl">
          <InlineText text={lesson.title} />
        </PageTitle>
      </header>

      <Disclosure summary="What the check looks for" variant="card">
        <p>The Check's lines for this Lesson show here.</p>
      </Disclosure>

      <div className="flex flex-wrap items-center gap-2.5">
        <ButtonLink
          to={`/lesson/${lesson.id}/step`}
          variant="primary"
          size="lg"
          iconEnd="arrow"
        >
          Start
        </ButtonLink>
        <ButtonLink to={`/lesson/${lesson.id}/step`} size="lg">
          Start with less help
        </ButtonLink>
        <span className="grow" />
        <Button
          variant="ghost"
          icon="book"
          aria-haspopup="dialog"
          onClick={() => {
            setReading(true);
          }}
        >
          Read the full lesson
        </Button>
      </div>

      <Panel
        title="Read the full lesson"
        wide
        open={reading}
        onClose={() => {
          setReading(false);
        }}
      >
        <article className="grid max-w-measure gap-3">
          <h3 className="text-2xl">
            <InlineText text={lesson.title} />
          </h3>
          <p className="text-muted">
            The lesson page renders here, offline, from the release's copy.
          </p>
        </article>
      </Panel>
    </main>
  );
}
