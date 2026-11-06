import { useEffect } from "react";
import type { Snapshot } from "@quest/contract";
import { ButtonLink } from "../components/Button";
import { InlineText } from "../components/InlineText";
import { Tier } from "../components/Tier";
import { skillLabel } from "../lib/words";
import { LessonBadge } from "../components/badges";
import { LEVEL_NAMES, lessonLabel } from "../course/labels";
import { Pip } from "../pip/Pip";
import { usePipLook } from "../pip/PipStage";
import { PageTitle } from "../shell/PageTitle";
import { BOX, COLUMN, EYEBROW } from "./layout";
import { OpenLessonButton } from "./OpenLessonButton";
import { pathOf, useCourseSnapshot } from "./lesson";
import { courseCounts, journeyPlace, levelOf, stepPlace } from "./place";

/** Once the screen has settled in, Pip glances toward the next goal. */
const GLANCE_AFTER_MS = 600;

/**
 * Progress: counts, skills by the help last needed with Pip beside them (above
 * them below the sm breakpoint, so the box keeps the full width), the next
 * goal, and Badges. Completion and Mastery never share a number or a bar.
 */
export function Progress() {
  const look = usePipLook();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      look("goal");
    }, GLANCE_AFTER_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [look]);
  const snapshot = useCourseSnapshot();

  return (
    <main className={COLUMN}>
      <header className="grid gap-2">
        <PageTitle title="Progress" className="text-3xl max-sm:text-2xl" />
        <p className="text-muted">
          Only what your checks verified counts here.
        </p>
      </header>
      {snapshot && <ProgressBody snapshot={snapshot} />}
    </main>
  );
}

function ProgressBody({ snapshot }: { snapshot: Snapshot }) {
  const counts = courseCounts(snapshot);
  const stats = [
    { count: counts.lessons, label: "lessons done" },
    { count: counts.levels, label: "levels done" },
  ];
  const skills = Object.entries(snapshot.learner.mastery);
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        {stats.map(({ count, label }) => (
          <li key={label} className={`${BOX} gap-0`}>
            <b className="text-2xl">{`${String(count.done)} of ${String(count.total)}`}</b>
            <span className="text-sm text-muted">{label}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3.5 max-sm:flex-col max-sm:items-start max-sm:gap-2">
        <Pip size="beside" />
        <section
          className={`${BOX} min-w-0 flex-1 max-sm:self-stretch`}
          aria-labelledby="progress-skills"
        >
          <h2 id="progress-skills" className="text-lg">
            Skills
          </h2>
          {skills.length === 0 ? (
            <p className="text-sm text-muted">
              The help you used shows here once you finish a step.
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {skills.map(([skill, mastery]) => (
                <li
                  key={skill}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-2"
                >
                  <span className="min-w-0 font-semibold">
                    {skillLabel(skill)}
                  </span>
                  <Tier mastery={mastery.used} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <NextGoal snapshot={snapshot} />
      <section className={BOX} aria-labelledby="progress-badges">
        <h2 id="progress-badges" className="text-lg">
          Badges
        </h2>
        {snapshot.course.levels.map((level) => (
          <div key={level.id} className="grid gap-2">
            <h3 className="text-sm text-muted">{LEVEL_NAMES[level.id]}</h3>
            <ul className="flex flex-wrap gap-3">
              {level.lessons.map(
                (s) =>
                  s.badge !== null && (
                    <li key={s.id}>
                      <LessonBadge
                        lesson={s.id}
                        name={s.badge}
                        earned={s.complete}
                        size="sm"
                      />
                    </li>
                  ),
              )}
            </ul>
          </div>
        ))}
      </section>
    </>
  );
}

const GOAL =
  "flex items-center justify-between gap-4 rounded-lg border border-accent-edge bg-surface px-5 py-4 shadow-sm max-sm:flex-col max-sm:items-stretch";

/**
 * The next goal: the Journey's current Lesson. The Lesson the engine holds
 * open is a link to its phase's path; any other is opened with lesson.open.
 */
function NextGoal({ snapshot }: { snapshot: Snapshot }) {
  const place = journeyPlace(snapshot);
  const { current, label } = place;
  return (
    <section
      data-pip-target="goal"
      aria-labelledby="progress-goal"
      className={GOAL}
    >
      <div className="grid min-w-0 gap-0.5">
        <h2 id="progress-goal" className={EYEBROW}>
          Next goal
        </h2>
        {current ? (
          <>
            <b>
              {`${LEVEL_NAMES[levelOf(snapshot, current)]}, ${lessonLabel(current.number, current.capstone)}: `}
              <InlineText text={current.title} />
            </b>
            {snapshot.lesson.id === current.id && stepPlace(snapshot) && (
              <span className="text-sm text-muted" data-step-place="">
                {stepPlace(snapshot)}
              </span>
            )}
          </>
        ) : (
          <b>Every lesson is complete</b>
        )}
      </div>
      {current && label ? (
        snapshot.lesson.id === current.id ? (
          <ButtonLink to={pathOf(snapshot.lesson)} iconEnd="arrow">
            {label}
          </ButtonLink>
        ) : (
          <OpenLessonButton id={current.id}>{label}</OpenLessonButton>
        )
      ) : (
        <ButtonLink to="/journey" iconEnd="arrow">
          See the journey
        </ButtonLink>
      )}
    </section>
  );
}
