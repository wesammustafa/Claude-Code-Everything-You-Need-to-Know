import { useEffect } from "react";
import { ButtonLink } from "../components/Button";
import { InlineText } from "../components/InlineText";
import { LESSONS, lessonLabel, levelOf } from "../course/placeholder";
import { Pip } from "../pip/Pip";
import { usePipLook } from "../pip/PipStage";
import { PageTitle } from "../shell/PageTitle";
import { BOX, COLUMN, EYEBROW } from "./layout";

const STATS = [
  { value: "0", label: `of ${String(LESSONS.length)} lessons` },
  { value: "0", label: "badges" },
  { value: "0", label: "skills done on your own" },
];

// Until the snapshot says where the Learner is, the first Lesson is the next goal.
const goal = LESSONS[0];

/** Once the screen has settled in, Pip glances toward the next goal. */
const GLANCE_AFTER_MS = 600;

/**
 * Progress: counts, skills by the help last needed with Pip beside them (above
 * them below the sm breakpoint, so the box keeps the full width), the next
 * goal, and Badges.
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

  return (
    <main className={COLUMN}>
      <header className="grid gap-2">
        <PageTitle title="Progress" className="text-3xl max-sm:text-2xl" />
        <p className="text-muted">
          Only what your checks verified counts here.
        </p>
      </header>
      <ul className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        {STATS.map((stat) => (
          <li key={stat.label} className={`${BOX} gap-0`}>
            <b className="text-2xl">{stat.value}</b>
            <span className="text-sm text-muted">{stat.label}</span>
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
          <p className="text-sm text-muted">
            The help you used the last time each skill came up shows here.
          </p>
        </section>
      </div>
      {goal && (
        <section
          data-pip-target="goal"
          aria-labelledby="progress-goal"
          className="flex items-center justify-between gap-4 rounded-lg border border-accent-edge bg-surface px-5 py-4 shadow-sm max-sm:flex-col max-sm:items-stretch"
        >
          <div className="grid min-w-0 gap-0.5">
            <h2 id="progress-goal" className={EYEBROW}>
              Next goal
            </h2>
            <b>
              {`${levelOf(goal).name}, ${lessonLabel(goal)}: `}
              <InlineText text={goal.title} />
            </b>
          </div>
          <ButtonLink to={`/lesson/${goal.id}`} iconEnd="arrow">
            Continue
          </ButtonLink>
        </section>
      )}
      <section className={BOX} aria-labelledby="progress-badges">
        <h2 id="progress-badges" className="text-lg">
          Badges
        </h2>
        <p className="text-sm text-muted">
          Each Lesson's Badge shows here, earned or not yet.
        </p>
      </section>
    </main>
  );
}
