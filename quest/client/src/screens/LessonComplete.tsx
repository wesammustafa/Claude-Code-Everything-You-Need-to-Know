import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router";
import type { CompleteLesson, LevelId } from "@quest/contract";
import { NEW_BADGE } from "../components/Badge";
import { Button, ButtonLink } from "../components/Button";
import { CheckLines } from "../components/CheckLines";
import { InlineText } from "../components/InlineText";
import { Tier } from "../components/Tier";
import { LessonBadge } from "../components/badges";
import { LEVEL_NAMES, lessonLabel } from "../course/labels";
import { githubTree, pageIndex } from "../pages/fetch";
import { ReadLesson } from "../pages/ReadLesson";
import { Pip } from "../pip/Pip";
import { PageTitle } from "../shell/PageTitle";
import { LessonGate } from "./LessonGate";
import { BOX, EYEBROW, MOMENT, QUIET_LINK } from "./layout";
import { useActiveLesson, useCourseSnapshot, useOpenLesson } from "./lesson";
import { celebratable, levelPath, useClaimMilestone } from "./milestones";

/**
 * Whether this tab reveals the Lesson's Badge: only on its first
 * completion, and only when this tab won its pending milestone, so a reload
 * or a second tab shows it earned but never reveals it again.
 */
function useReveal(lesson: CompleteLesson | null): boolean {
  const claim = useClaimMilestone(
    (m) =>
      lesson !== null &&
      lesson.firstTime &&
      m.type === "lesson.completed" &&
      (m.badge ?? null) === lesson.badge,
  );
  return claim.won;
}

/**
 * The Level complete milestone that follows this Lesson's own: the next
 * celebratable one after it, or already the oldest. While it is pending,
 * Next would open a Lesson and lapse it, so the hand-over replaces Next.
 */
function useLevelPending(lesson: CompleteLesson | null): LevelId | null {
  const pending = celebratable(useCourseSnapshot());
  if (lesson === null) return null;
  const at = pending.findIndex(
    (m) => m.type === "level.completed" && m.level === lesson.level,
  );
  if (at < 0) return null;
  const before = pending[at - 1];
  const own =
    before?.type === "lesson.completed" &&
    (before.badge ?? null) === lesson.badge;
  return at === 0 || own ? lesson.level : null;
}

/** The release ref the pages were built at, or null while unknown. */
function useReleaseRef(): string | null {
  const [ref, setRef] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    pageIndex().then(
      (index) => {
        if (live) setRef(index.ref);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  return ref;
}

const HANDOVER = "You did every task without the exact command.";
const INVITATION =
  "Questions about anything in this level? Ask Claude Code, then compare the answer with the lesson pages.";
const NOTCH_HARDER = "A notch harder: it starts with less help.";
// What each skill's Mastery says (ticket 348): the help on its latest step,
// as its tier showed it or as the Learner opened more (a hint, the exact
// command or a bottom rung). Shown only when a skill has one beside it.
const PRACTISED_HELP =
  "Beside each: the help on its latest step, counting any hint or exact command you opened.";

/** Lesson complete: Pip, the Badge, the check result, the skills practised and the next Lesson. */
export function LessonComplete() {
  const active = useActiveLesson("complete");
  const reveal = useReveal(active?.lesson ?? null);
  const levelPending = useLevelPending(active?.lesson ?? null);
  const ref = useReleaseRef();
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
      <span role="status" className="sr-only">
        {reveal && lesson.badge !== null ? `${NEW_BADGE}: ${lesson.badge}` : ""}
      </span>
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
              text: <InlineText text={line.text} />,
              ok: line.pass,
            }))}
          />
        </section>
      )}
      {lesson.handover && <p className="font-semibold">{HANDOVER}</p>}
      {lesson.invitation && <p className="text-muted">{INVITATION}</p>}
      {lesson.practised.length > 0 && (
        <section
          aria-labelledby="practised"
          className="grid w-full max-w-moment gap-2 text-left"
        >
          <h2 id="practised" className="text-sm text-muted">
            You practised
          </h2>
          {lesson.practised.some((p) => p.mastery) && (
            <p className="text-sm text-muted">{PRACTISED_HELP}</p>
          )}
          <ul className="grid gap-1.5">
            {lesson.practised.map(({ skill, steps, mastery }) => (
              <li key={skill} className="flex flex-wrap items-center gap-3">
                <span className="min-w-20 font-semibold">
                  {steps.map((title, i) => (
                    <Fragment key={title}>
                      {i > 0 && " · "}
                      <InlineText text={title} />
                    </Fragment>
                  ))}
                </span>
                {mastery && <Tier mastery={mastery.used} />}
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <ReadLesson size="sm" />
        {ref !== null && (
          <a
            href={githubTree(ref, `solutions/${lesson.id}`)}
            target="_blank"
            rel="noreferrer"
            className={QUIET_LINK}
          >
            Compare with a reference solution
          </a>
        )}
      </div>
      {levelPending !== null ? (
        <ButtonLink
          to={levelPath(levelPending)}
          variant="primary"
          size="lg"
          iconEnd="arrow"
          className="mt-2"
        >
          {`See the ${LEVEL_NAMES[levelPending]} level complete`}
        </ButtonLink>
      ) : (
        lesson.next && <NextLesson next={lesson.next} />
      )}
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
    <div className="grid justify-items-center gap-2">
      {next.notchHarder && <p className="text-sm text-muted">{NOTCH_HARDER}</p>}
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
    </div>
  );
}
