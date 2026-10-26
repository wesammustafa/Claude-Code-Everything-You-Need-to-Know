import { LESSONS } from "../course/placeholder";
import { PageTitle } from "../shell/PageTitle";
import { BOX, COLUMN } from "./layout";

const STATS = [
  { value: "0", label: `of ${String(LESSONS.length)} lessons` },
  { value: "0", label: "badges" },
  { value: "0", label: "skills done on your own" },
];

/** Progress: counts, skills by the help last needed, Badges and the next goal. */
export function Progress() {
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
      <section className={BOX} aria-labelledby="progress-skills">
        <h2 id="progress-skills" className="text-lg">
          Skills
        </h2>
        <p className="text-sm text-muted">
          The help you used the last time each skill came up shows here.
        </p>
      </section>
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
