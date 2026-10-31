import { useEffect, useRef, useState } from "react";
import type { OverviewNote, StairStep } from "@quest/contract";
import { Button } from "../components/Button";
import { CODE, InlineText } from "../components/InlineText";
import { Says } from "../components/Says";
import { Tier } from "../components/Tier";
import { LessonBadge } from "../components/badges";
import { lessonEyebrow } from "../course/labels";
import { useActionProps } from "../live/useAction";
import { ReadLesson } from "../pages/ReadLesson";
import { PageTitle } from "../shell/PageTitle";
import { CheckLooksFor } from "./CheckLooksFor";
import { LessonGate } from "./LessonGate";
import { COLUMN, EYEBROW } from "./layout";
import {
  summaryOf,
  useActiveLesson,
  useCourseSnapshot,
  useOpenLesson,
} from "./lesson";

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
    case "need":
      // The needs list says these, each line once with its state.
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
  const start = useActionProps("lesson.start", {
    type: "lesson.start",
    help: "planned",
  });
  const startLess = useActionProps("lesson.start.less", {
    type: "lesson.start",
    help: "less",
  });
  // Start over unmounts with the confirm that had focus: once the restart
  // lands, focus moves to Start.
  const actions = useRef<HTMLDivElement>(null);
  const resumable = active?.lesson.resumable ?? false;
  const wasResumable = useRef(resumable);
  useEffect(() => {
    if (wasResumable.current && !resumable)
      actions.current?.querySelector<HTMLElement>("[data-start]")?.focus();
    wasResumable.current = resumable;
  }, [resumable]);
  if (!active) return <LessonGate />;
  const { lesson, summary } = active;
  const intro = lesson.intro;
  const first = lesson.start?.first ?? null;
  // The open-first offer goes after the first unmet note that names it.
  const offerAt = lesson.notes.findIndex(
    (note) =>
      note.kind === "unmet" && note.lesson !== null && note.lesson === first,
  );
  const notes = lesson.notes.flatMap((note, at) => {
    const text = noteText(note);
    const offer = at === offerAt && first !== null;
    if (text === null || (text.trim() === "" && !offer)) return [];
    return [{ text, offer, key: `${String(at)} ${note.kind}` }];
  });

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

      <CheckLooksFor items={lesson.check} />

      {lesson.needs.length > 0 && (
        <section
          aria-label="What you need"
          className="grid gap-2"
          data-overview-needs=""
        >
          <h2 className="text-sm text-muted">What you need</h2>
          <ul className="grid gap-1.5 text-sm">
            {lesson.needs.map(({ quote, missing }, i) => (
              <li key={i} className="grid justify-items-start gap-0.5">
                <span>
                  <InlineText text={quote} />
                </span>
                {missing === null ? (
                  <span className="text-muted">Looking on your PATH...</span>
                ) : missing.length === 0 ? (
                  <span>Found on your PATH.</span>
                ) : (
                  <span>
                    Not found on your PATH:
                    {missing.map((name, k) => (
                      <span key={k}>
                        {" "}
                        <code className={CODE}>{name}</code>
                      </span>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {notes.length > 0 && (
        <ul className="grid gap-1 text-sm" data-overview-notes="">
          {notes.map(({ text, offer, key }) => (
            <li key={key} className="grid justify-items-start gap-1.5">
              {text.trim() !== "" && (
                <span>
                  <InlineText text={text} />
                </span>
              )}
              {offer && first !== null && <OpenFirst lesson={first} />}
            </li>
          ))}
        </ul>
      )}

      {lesson.folderQuestion !== null && (
        // The Work folder question's slot: 252 fills it.
        <div data-folder-question="" />
      )}

      <div ref={actions} className="flex flex-wrap items-center gap-2.5">
        {/* No start while the folder question waits for its answer (252). */}
        {lesson.start?.planned && (
          <Button
            variant="primary"
            size="lg"
            iconEnd="arrow"
            data-start=""
            {...start}
          >
            {lesson.resumable ? "Resume" : "Start"}
          </Button>
        )}
        {lesson.start?.less && (
          <Button size="lg" {...startLess}>
            Start with less help
          </Button>
        )}
        {lesson.resumable && <StartOver lesson={lesson.id} />}
        <span className="grow" />
        <ReadLesson />
      </div>
    </main>
  );
}

/** The offer to open a failed prerequisite's Lesson first. */
function OpenFirst({ lesson }: { lesson: string }) {
  const open = useOpenLesson(lesson);
  const title = summaryOf(useCourseSnapshot(), lesson)?.title;
  if (!title) return null;
  return (
    <Button size="sm" {...open}>
      Open <InlineText text={title} /> first
    </Button>
  );
}

/**
 * Start over, asked first inline: keeping the place is the default, so it
 * takes focus, and Escape says the same. The engine keeps the Badge and the
 * help used ("lesson.restart").
 */
function StartOver({ lesson }: { lesson: string }) {
  const [asking, setAsking] = useState(false);
  const trigger = useRef<HTMLSpanElement>(null);
  const group = useRef<HTMLDivElement>(null);
  const answered = useRef(false);
  const restart = useActionProps("lesson.restart", {
    type: "lesson.restart",
    lesson,
  });
  // Escape inside the question keeps the place, as "Keep my place" does.
  useEffect(() => {
    const at = group.current;
    if (!asking || !at) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      answered.current = true;
      setAsking(false);
    };
    at.addEventListener("keydown", onKey);
    return () => {
      at.removeEventListener("keydown", onKey);
    };
  }, [asking]);
  useEffect(() => {
    if (asking)
      group.current?.querySelector<HTMLElement>("[data-keep]")?.focus();
    else if (answered.current)
      trigger.current?.querySelector("button")?.focus();
  }, [asking]);
  const keep = () => {
    answered.current = true;
    setAsking(false);
  };
  if (!asking)
    return (
      <span ref={trigger} className="contents">
        <Button
          variant="ghost"
          size="lg"
          onClick={() => {
            setAsking(true);
          }}
        >
          Start over
        </Button>
      </span>
    );
  return (
    <div
      ref={group}
      role="group"
      aria-label="Start over"
      className="flex flex-wrap items-center gap-2.5 rounded-lg border border-line bg-surface px-4 py-2"
    >
      <span className="text-sm">
        Start this lesson over? Your Badge and the help you used are kept.
      </span>
      <Button size="sm" {...restart}>
        Start over
      </Button>
      <Button size="sm" variant="primary" data-keep="" onClick={keep}>
        Keep my place
      </Button>
    </div>
  );
}
