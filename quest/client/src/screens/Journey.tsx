import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router";
import type { LessonSummary, LevelId, Snapshot } from "@quest/contract";
import { Button, ButtonLink } from "../components/Button";
import { Disclosure } from "../components/Disclosure";
import { Icon } from "../components/Icon";
import { InlineText } from "../components/InlineText";
import { ProgressBar } from "../components/ProgressBar";
import { LessonBadge } from "../components/badges";
import { LEVEL_NAMES, lessonLabel } from "../course/labels";
import { cx } from "../lib/cx";
import { useBelow } from "../lib/media";
import { pageIndex, type PageEntry } from "../pages/fetch";
import { usePagePanel } from "../pages/PagePanel";
import { Pip } from "../pip/Pip";
import { PageTitle } from "../shell/PageTitle";
import { EYEBROW, WIDE } from "./layout";
import { pathOf, useCourseSnapshot, useOpenLesson } from "./lesson";
import { journeyPlace, nodeState, type JourneyPlace } from "./place";

type ElectiveList =
  | { state: "closed" | "loading" | "failed" }
  | { state: "ready"; pages: PageEntry[] };

/**
 * A Level's Electives by title, behind a quiet disclosure on its card. The
 * page index loads the first time one opens; each opens in the page panel.
 * No marks and nothing saved: an Elective is extra reading.
 */
function Electives({ level }: { level: LevelId }) {
  const [list, setList] = useState<ElectiveList>({ state: "closed" });
  const { open } = usePagePanel();
  const load = useCallback(() => {
    setList({ state: "loading" });
    pageIndex().then(
      (index) => {
        setList({
          state: "ready",
          pages: index.pages.filter(
            (p) => p.kind === "elective" && p.level === level,
          ),
        });
      },
      () => {
        setList({ state: "failed" });
      },
    );
  }, [level]);
  return (
    <Disclosure
      variant="quiet"
      summary="Electives"
      onToggle={(event) => {
        if (event.currentTarget.open && list.state === "closed") load();
      }}
    >
      {list.state === "loading" && <p>Loading the Electives.</p>}
      {list.state === "failed" && (
        <p className="flex flex-wrap items-center gap-2">
          <span>The Electives did not load.</span>
          <Button size="sm" onClick={load}>
            Retry
          </Button>
        </p>
      )}
      {list.state === "ready" &&
        (list.pages.length === 0 ? (
          <p>No Electives in this Level yet.</p>
        ) : (
          <ul className="grid justify-items-start gap-1">
            {list.pages.map((page) => (
              <li key={page.path}>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-haspopup="dialog"
                  onClick={() => {
                    open(page.path);
                  }}
                >
                  {page.title}
                </Button>
              </li>
            ))}
          </ul>
        ))}
    </Disclosure>
  );
}

const INTRO =
  "Three levels. Each lesson ends with a check you can also run yourself.";

/**
 * The Learning journey: three Level cards that select a Level, its Lessons on
 * one line, and one Next band, with Pip beside it, turned toward the lesson
 * ahead. Below the sm breakpoint Pip sits above the band, which keeps the
 * full width. Until the snapshot has its course, only the heading shows.
 * Browsing here never moves the Learner's place: a node goes to the
 * Lesson's preview, and only the band's Start sends lesson.open.
 */
export function Journey() {
  const snapshot = useCourseSnapshot();
  if (!snapshot) {
    return (
      <main className={WIDE}>
        <JourneyHeader />
      </main>
    );
  }
  return <Course snapshot={snapshot} />;
}

function JourneyHeader() {
  return (
    <header className="grid gap-2">
      <PageTitle
        title="Learning journey"
        className="text-3xl max-sm:text-2xl"
      />
      <p className="text-muted">{INTRO}</p>
    </header>
  );
}

function Course({ snapshot }: { snapshot: Snapshot }) {
  const levels = snapshot.course.levels;
  const place = journeyPlace(snapshot);
  const { current } = place;
  // First the Level of the Learner's place; then the Learner's own choice,
  // which a new snapshot leaves alone.
  const [selected, setSelected] = useState(() =>
    Math.max(
      0,
      levels.findIndex((l) => l.lessons.some((s) => s.id === current?.id)),
    ),
  );
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const level = levels[selected] ?? levels[0];

  // The Level cards sit in a row, and stack in a column below the md breakpoint.
  const stacked = useBelow("md");

  // The tabs pattern: arrow keys, Home and End move between Levels. Both
  // pairs of arrows work at every width, so the keys match the cards
  // whether they sit in a row or stack.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = levels.length - 1;
    const next = selected === last ? 0 : selected + 1;
    const previous = selected === 0 ? last : selected - 1;
    const moves: Record<string, number> = {
      ArrowRight: next,
      ArrowDown: next,
      ArrowLeft: previous,
      ArrowUp: previous,
      Home: 0,
      End: last,
    };
    const to = moves[event.key];
    if (to === undefined) return;
    event.preventDefault();
    setSelected(to);
    tabs.current[to]?.focus();
  };

  if (!level) return null;
  return (
    <main className={WIDE}>
      <JourneyHeader />

      <div
        role="tablist"
        aria-label="Levels"
        aria-orientation={stacked ? "vertical" : "horizontal"}
        className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1"
      >
        {levels.map((l, i) => {
          const done = l.lessons.filter((s) => s.complete).length;
          const name = LEVEL_NAMES[l.id];
          return (
            // The card's footer, outside the tab, holds the Level's Electives.
            <div key={l.id} className="grid content-start gap-2">
              <button
                ref={(node) => {
                  tabs.current[i] = node;
                }}
                type="button"
                role="tab"
                id={`level-tab-${l.id}`}
                aria-selected={i === selected}
                aria-controls="level-panel"
                tabIndex={i === selected ? 0 : -1}
                onClick={() => {
                  setSelected(i);
                }}
                onKeyDown={onKeyDown}
                className={cx(
                  "grid cursor-pointer content-start gap-2.5 rounded-lg border bg-surface p-4.5 text-left shadow-sm",
                  "transition-[border-color,box-shadow,translate] duration-(--duration-base) ease-out",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                  // A contrast theme draws every border in one colour and drops
                  // shadows, so there the selected card shows by a thicker edge
                  // (its padding gives back the width, so nothing moves).
                  i === selected
                    ? "border-accent-mark shadow-selected forced-colors:border-3 forced-colors:p-4"
                    : "border-line hover:-translate-y-(--nudge) hover:border-line-2",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <b className="text-lg">{name}</b>
                  {l.complete && (
                    <span className="flex items-center gap-1 text-sm text-accent-text">
                      <Icon name="check" size="sm" />
                      Complete
                    </span>
                  )}
                  <span className="ml-auto text-sm text-muted">{`${String(done)} of ${String(l.lessons.length)}`}</span>
                </span>
                {/* The words above already say how far: the tab's name stays theirs. */}
                <span aria-hidden="true" className="grid">
                  <ProgressBar
                    value={done}
                    max={l.lessons.length}
                    label={`${name} progress`}
                  />
                </span>
              </button>
              <div data-level-footer="" className="empty:hidden">
                <Electives level={l.id} />
              </div>
            </div>
          );
        })}
      </div>

      <section
        id="level-panel"
        role="tabpanel"
        aria-label={LEVEL_NAMES[level.id]}
        className="overflow-x-auto rounded-lg border border-line bg-surface px-4.5 pt-5.5 pb-4 shadow-sm"
      >
        {/* From lg the Lessons sit on one line, joined by a track. Narrower, a
            Level's eight or nine titles would crowd their columns, so they
            stack in one column down the same track, every Lesson (the
            capstone too) in view without scrolling sideways. */}
        <ol
          className={cx(
            "relative grid before:absolute before:rounded-full before:bg-line-2 before:content-['']",
            "lg:min-w-160 lg:auto-cols-fr lg:grid-flow-col lg:before:inset-x-[7%] lg:before:top-4 lg:before:h-0.5",
            "max-lg:gap-3 max-lg:before:inset-y-4 max-lg:before:left-4 max-lg:before:w-0.5",
          )}
        >
          {level.lessons.map((lesson) => (
            <Node key={lesson.id} lesson={lesson} current={current} />
          ))}
        </ol>
      </section>

      <NextBand snapshot={snapshot} place={place} />
    </main>
  );
}

const NODE_STATE = {
  current:
    "border-accent-mark bg-accent text-accent-ink shadow-current forced-colors:border-(--forced-current) forced-colors:bg-(--forced-current) forced-colors:text-(--forced-current-ink) forced-colors:shadow-none forced-colors:forced-color-adjust-none forced-colors:focus-visible:outline-(--forced-mark)",
  done: "border-accent-mark bg-surface text-accent-text hover:border-accent-mark",
  "to do": "border-mark bg-surface text-muted hover:border-accent-mark",
} as const;

/** A Lesson on the line: its node goes to the Lesson's route, its title carries the Badge. */
function Node({
  lesson,
  current,
}: {
  lesson: LessonSummary;
  current: LessonSummary | null;
}) {
  const state = nodeState(lesson, current);
  const label = lessonLabel(lesson.number, lesson.capstone);
  return (
    <li className="relative grid gap-1.5 text-sm max-lg:grid-cols-[auto_minmax(0,1fr)] max-lg:items-center max-lg:gap-3.5 lg:content-start lg:justify-items-center lg:px-1.5 lg:text-center">
      <Link
        to={`/lesson/${lesson.id}`}
        aria-label={`${label}: ${lesson.title}, ${state}`}
        data-state={state}
        className={cx(
          "grid size-8.5 place-items-center rounded-full border-2 no-underline",
          "transition-[translate,scale,border-color] duration-(--duration-fast) ease-out hover:scale-(--hover-scale)",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
          // In a contrast theme the current node keeps a fill, in the
          // theme's own highlight colours.
          NODE_STATE[state],
        )}
      >
        {/* A capstone keeps its sparkle, done or not. */}
        {lesson.capstone ? (
          <Icon name="sparkle" size="sm" />
        ) : (
          state === "done" && <Icon name="check" size="sm" />
        )}
      </Link>
      {/* The Badge sits by the title, never on the node's fill. */}
      <span
        className={cx(
          "grid gap-1 leading-4.5 max-lg:grid-cols-[minmax(0,1fr)_auto] max-lg:items-center lg:justify-items-center",
          state === "current" && "font-heading",
        )}
      >
        <span>
          <InlineText text={lesson.title} />
        </span>
        <LessonBadge
          lesson={lesson.id}
          name={lesson.badge}
          earned={lesson.complete}
          size="xs"
          caption={false}
        />
      </span>
    </li>
  );
}

/** The one Next band: the Learner's place, or the word that none is left. */
function NextBand({
  snapshot,
  place,
}: {
  snapshot: Snapshot;
  place: JourneyPlace;
}) {
  const { current, label } = place;
  return (
    <div className="flex items-center gap-3.5 max-sm:flex-col max-sm:items-start max-sm:gap-2">
      <Pip size="beside" />
      <div className="flex min-w-0 flex-1 items-center max-sm:self-stretch justify-between gap-4 rounded-lg border border-accent-edge bg-linear-100 from-accent-soft to-surface to-55% px-5.5 py-4.5 shadow-sm max-sm:flex-col max-sm:items-stretch">
        {current && label ? (
          <>
            <div className="grid gap-0.5">
              <span className={EYEBROW}>Next</span>
              <b className="text-lg">
                {`${LEVEL_NAMES[levelOf(snapshot, current)]}, ${lessonLabel(current.number, current.capstone)}: `}
                <InlineText text={current.title} />
              </b>
            </div>
            {snapshot.lesson.id === current.id ? (
              <ButtonLink
                to={pathOf(snapshot.lesson)}
                variant="primary"
                iconEnd="arrow"
              >
                {label}
              </ButtonLink>
            ) : (
              <OpenButton id={current.id}>{label}</OpenButton>
            )}
          </>
        ) : (
          <>
            <b className="text-lg">Every lesson is complete</b>
            <ButtonLink to="/progress" variant="primary" iconEnd="arrow">
              See your progress
            </ButtonLink>
          </>
        )}
      </div>
    </div>
  );
}

function OpenButton({ id, children }: { id: string; children: string }) {
  const open = useOpenLesson(id);
  return (
    <Button variant="primary" iconEnd="arrow" {...open}>
      {children}
    </Button>
  );
}

function levelOf(snapshot: Snapshot, lesson: LessonSummary) {
  const found = snapshot.course.levels.find((l) =>
    l.lessons.some((s) => s.id === lesson.id),
  );
  return found?.id ?? "beginner";
}
