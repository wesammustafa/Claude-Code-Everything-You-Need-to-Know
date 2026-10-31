import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { CompleteLesson } from "@quest/contract";
import { Button } from "../components/Button";
import { CheckLines } from "../components/CheckLines";
import { InlineText } from "../components/InlineText";
import { Tier } from "../components/Tier";
import { LessonBadge } from "../components/badges";
import { lessonLabel } from "../course/labels";
import { useMilestone } from "../live/LiveProvider";
import { Pip } from "../pip/Pip";
import { PageTitle } from "../shell/PageTitle";
import { LessonGate } from "./LessonGate";
import { BOX, EYEBROW, MOMENT, QUIET_LINK } from "./layout";
import { useActiveLesson, useOpenLesson } from "./lesson";

/**
 * Whether this tab reveals the Lesson's Badge: only on its first
 * completion, and only when this tab won its pending milestone, so a reload
 * or a second tab shows it earned but never reveals it again.
 */
function useReveal(lesson: CompleteLesson | null): boolean {
  const { milestone, show } = useMilestone();
  const [revealed, setRevealed] = useState<string | null>(null);
  const id =
    lesson?.firstTime &&
    milestone?.type === "lesson.completed" &&
    milestone.badge === lesson.badge
      ? milestone.id
      : null;
  useEffect(() => {
    if (id === null) return;
    // Not cancelled when `id` clears: winning the claim is what clears it.
    void show(id).then((won) => {
      if (won) setRevealed(id);
    });
  }, [id, show]);
  return revealed !== null;
}

/** Lesson complete: Pip, the Badge, the check result, the skills practised and the next Lesson. */
export function LessonComplete() {
  const active = useActiveLesson("complete");
  const reveal = useReveal(active?.lesson ?? null);
  if (!active) return <LessonGate />;
  const { lesson, summary } = active;
  const passed = lesson.checkSummary.filter((line) => line.pass).length;
  const total = lesson.checkSummary.length;

  return (
    <main className={MOMENT}>
      <Pip size="hero" className="mb-2" />
      <span className={EYEBROW}>
        {`${lessonLabel(summary?.number ?? null, lesson.capstone)} complete`}
      </span>
      <PageTitle
        title={`Complete: ${lesson.title}`}
        className="text-3xl max-sm:text-2xl"
      >
        <InlineText text={lesson.title} />
      </PageTitle>
      <LessonBadge
        lesson={lesson.id}
        name={lesson.badge}
        earned
        size="lg"
        reveal={reveal}
      />
      {!lesson.firstTime && lesson.badge !== null && (
        <p className="text-sm text-muted">You already earned this badge.</p>
      )}
      {total > 0 && (
        <section
          aria-label="The check"
          className={`${BOX} w-full max-w-moment text-left`}
        >
          <p className="text-sm text-muted">{`${String(passed)} of ${String(total)} lines pass`}</p>
          <CheckLines
            lines={lesson.checkSummary.map((line) => ({
              text: line.text,
              ok: line.pass,
            }))}
          />
        </section>
      )}
      {lesson.practised.length > 0 && (
        <section
          aria-label="Skills practised"
          className="grid w-full max-w-moment gap-2 text-left"
        >
          <h2 className="text-sm text-muted">Skills practised</h2>
          <ul className="grid gap-1.5">
            {lesson.practised.map(({ skill, mastery }) => (
              <li key={skill} className="flex flex-wrap items-center gap-3">
                <span className="min-w-20 font-semibold">{skill}</span>
                {mastery && <Tier mastery={mastery.used} />}
              </li>
            ))}
          </ul>
        </section>
      )}
      {lesson.next && <NextLesson next={lesson.next} />}
      <Link to="/journey" className={QUIET_LINK}>
        Back to the learning journey
      </Link>
    </main>
  );
}

/** Opens the next Lesson: it sends lesson.open, as browsing to it would not. */
function NextLesson({ next }: { next: NonNullable<CompleteLesson["next"]> }) {
  const open = useOpenLesson(next.id);
  return (
    <Button
      variant="primary"
      size="lg"
      iconEnd="arrow"
      className="mt-2"
      {...open}
    >
      <span>
        Next: <InlineText text={next.title} />
      </span>
    </Button>
  );
}
