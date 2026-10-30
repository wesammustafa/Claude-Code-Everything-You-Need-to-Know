import { useEffect, useState } from "react";
import type { OverviewNote, StairStep } from "@quest/contract";
import { Button } from "../components/Button";
import { InlineText } from "../components/InlineText";
import { Panel } from "../components/Panel";
import { Says } from "../components/Says";
import { Tier } from "../components/Tier";
import { LessonBadge } from "../components/badges";
import { lessonEyebrow } from "../course/labels";
import { useActionProps } from "../live/useAction";
import { usePipInput } from "../pip/PipStage";
import { PageTitle } from "../shell/PageTitle";
import { LessonGate } from "./LessonGate";
import { COLUMN, EYEBROW } from "./layout";
import { useActiveLesson } from "./lesson";

/** The help by part of the lesson: each part once, with the tiers its steps meet. */
function partsOf(
  steps: readonly StairStep[],
): { part: string; tiers: StairStep["tier"][] }[] {
  const parts: { part: string; tiers: StairStep["tier"][] }[] = [];
  for (const step of steps) {
    const last = parts.at(-1);
    if (last?.part === step.part) {
      if (!last.tiers.includes(step.tier)) last.tiers.push(step.tier);
    } else parts.push({ part: step.part, tiers: [step.tier] });
  }
  return parts;
}

/** A note's words: the page's own where it has them, the app's otherwise. */
function noteText(note: OverviewNote): string | null {
  switch (note.kind) {
    case "need":
      return note.quote;
    case "need-repo":
    case "win-note":
      return note.text;
    case "unmet":
      return note.line;
    case "changed":
      return "This lesson changed since you started it, so it starts again here.";
    case "folder-problem":
      // The folder question's own screen (252) words these.
      return null;
  }
}

/**
 * A Lesson's overview: Pip with one line, the title, what the Lesson
 * teaches (quoted), its time and Badge, the help by part, and how to start.
 * Every word about Claude Code here is the snapshot's.
 */
export function LessonOverview() {
  const active = useActiveLesson("overview");
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
  const start = useActionProps("lesson.start", {
    type: "lesson.start",
    help: "planned",
  });
  const startLess = useActionProps("lesson.start.less", {
    type: "lesson.start",
    help: "less",
  });
  if (!active) return <LessonGate />;
  const { lesson, summary } = active;
  const intro = lesson.intro;
  const notes = lesson.notes
    .map(noteText)
    .filter((text): text is string => text !== null);

  return (
    <main className={COLUMN}>
      {/* Pip's one line: the `can` line the Lesson builds to, quoted. */}
      <Says>
        {intro?.payoff ? (
          <InlineText text={intro.payoff} />
        ) : (
          "Ready when you are."
        )}
      </Says>
      <header className="grid gap-2">
        <span className={EYEBROW}>
          {lessonEyebrow(
            lesson.level,
            summary?.number ?? null,
            lesson.capstone,
          )}
        </span>
        <PageTitle title={lesson.title} className="text-3xl max-sm:text-2xl">
          <InlineText text={lesson.title} />
        </PageTitle>
        {summary && (
          <p className="flex flex-wrap items-center gap-3 text-sm text-muted">
            <span>{summary.minutes}</span>
            <LessonBadge
              lesson={lesson.id}
              name={summary.badge}
              earned={summary.complete}
              size="xs"
            />
          </p>
        )}
      </header>

      {intro && intro.can.length > 0 && (
        <section aria-label="What you will do" className="grid gap-2">
          <h2 className="text-sm text-muted">After this lesson you can</h2>
          <ul className="grid list-disc gap-1 pl-5">
            {intro.can.map((can) => (
              <li key={can}>
                <InlineText text={can} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Help by part" className="grid gap-2">
        <h2 className="text-sm text-muted">Help by part of the lesson</h2>
        <ul className="grid gap-1.5">
          {partsOf(lesson.staircase.planned).map(({ part, tiers }) => (
            <li key={part} className="flex flex-wrap items-center gap-3">
              <span className="min-w-28 font-semibold">{part}</span>
              {tiers.map((tier) => (
                <Tier key={tier} tier={tier} />
              ))}
            </li>
          ))}
        </ul>
      </section>

      {notes.length > 0 && (
        <ul className="grid gap-1 text-sm" data-overview-notes="">
          {notes.map((text) => (
            <li key={text}>
              <InlineText text={text} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        {/* No start while the folder question waits for its answer (252). */}
        {lesson.start?.planned && (
          <Button variant="primary" size="lg" iconEnd="arrow" {...start}>
            {lesson.resumable ? "Resume" : "Start"}
          </Button>
        )}
        {lesson.start?.less && (
          <Button size="lg" {...startLess}>
            Start with less help
          </Button>
        )}
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
          {intro?.read && (
            <p>
              <InlineText text={intro.read} />
            </p>
          )}
        </article>
      </Panel>
    </main>
  );
}
