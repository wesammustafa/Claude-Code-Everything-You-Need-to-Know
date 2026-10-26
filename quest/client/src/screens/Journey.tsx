import { useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router";
import { ButtonLink } from "../components/Button";
import { Icon } from "../components/Icon";
import { InlineText } from "../components/InlineText";
import { LEVELS, LESSONS, lessonLabel, levelOf } from "../course/placeholder";
import { cx } from "../lib/cx";
import { useBelow } from "../lib/media";
import { Pip } from "../pip/Pip";
import { PageTitle } from "../shell/PageTitle";
import { EYEBROW, WIDE } from "./layout";

// Until the snapshot says where the Learner is, the first Lesson is current.
const current = LESSONS[0];

/**
 * The Learning journey: three Level cards that select a Level, its Lessons on
 * one line, and one Next band, with Pip beside it, turned toward the lesson
 * ahead. Below the sm breakpoint Pip sits above the band, which keeps the
 * full width.
 */
export function Journey() {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const level = LEVELS[selected] ?? LEVELS[0];

  // The Level cards sit in a row, and stack in a column below the md breakpoint.
  const stacked = useBelow("md");

  // The tabs pattern: arrow keys, Home and End move between Levels. Both
  // pairs of arrows work at every width, so the keys match the cards
  // whether they sit in a row or stack.
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = LEVELS.length - 1;
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
      <header className="grid gap-2">
        <PageTitle
          title="Learning journey"
          className="text-3xl max-sm:text-2xl"
        />
        <p className="text-muted">
          Three levels. Each lesson ends with a check you can also run yourself.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Levels"
        aria-orientation={stacked ? "vertical" : "horizontal"}
        className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1"
      >
        {LEVELS.map((l, i) => (
          <button
            key={l.id}
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
              <b className="text-lg">{l.name}</b>
              <span className="ml-auto text-sm text-muted">{`0 of ${String(l.lessons.length)}`}</span>
            </span>
            <span
              aria-hidden="true"
              className="h-1.5 overflow-hidden rounded-full bg-surface-2 shadow-track"
            />
          </button>
        ))}
      </div>

      <section
        id="level-panel"
        role="tabpanel"
        aria-label={level.name}
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
          {level.lessons.map((lesson) => {
            const isCurrent = lesson.id === current?.id;
            return (
              <li
                key={lesson.id}
                className="relative grid gap-1.5 text-sm max-lg:grid-cols-[auto_minmax(0,1fr)] max-lg:items-center max-lg:gap-3.5 lg:content-start lg:justify-items-center lg:px-1.5 lg:text-center"
              >
                <Link
                  to={`/lesson/${lesson.id}`}
                  aria-label={`${lessonLabel(lesson)}: ${lesson.title}${isCurrent ? ", current" : ""}`}
                  className={cx(
                    "grid size-8.5 place-items-center rounded-full border-2 no-underline",
                    "transition-[translate,scale,border-color] duration-(--duration-fast) ease-out hover:scale-(--hover-scale)",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                    // In a contrast theme the current node keeps a fill, in the
                    // theme's own highlight colours.
                    isCurrent
                      ? "border-accent-mark bg-accent text-accent-ink shadow-current forced-colors:border-(--forced-current) forced-colors:bg-(--forced-current) forced-colors:text-(--forced-current-ink) forced-colors:shadow-none forced-colors:forced-color-adjust-none forced-colors:focus-visible:outline-(--forced-mark)"
                      : "border-mark bg-surface text-muted hover:border-accent-mark",
                  )}
                >
                  {lesson.capstone && <Icon name="sparkle" size="sm" />}
                </Link>
                <span
                  className={cx("leading-4.5", isCurrent && "font-heading")}
                >
                  <InlineText text={lesson.title} />
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {current && (
        <div className="flex items-center gap-3.5 max-sm:flex-col max-sm:items-start max-sm:gap-2">
          <Pip size="beside" />
          <div className="flex min-w-0 flex-1 items-center max-sm:self-stretch justify-between gap-4 rounded-lg border border-accent-edge bg-linear-100 from-accent-soft to-surface to-55% px-5.5 py-4.5 shadow-sm max-sm:flex-col max-sm:items-stretch">
            <div className="grid gap-0.5">
              <span className={EYEBROW}>Next</span>
              <b className="text-lg">
                {`${levelOf(current).name}, ${lessonLabel(current)}: `}
                <InlineText text={current.title} />
              </b>
            </div>
            <ButtonLink
              to={`/lesson/${current.id}`}
              variant="primary"
              iconEnd="arrow"
            >
              Continue
            </ButtonLink>
          </div>
        </div>
      )}
    </main>
  );
}
