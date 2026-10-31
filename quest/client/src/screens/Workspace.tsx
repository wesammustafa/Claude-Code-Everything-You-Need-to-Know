import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  BeatLine,
  BeatView,
  HintView,
  PlayingLesson,
  StepDownLesson,
  StepView,
} from "@quest/contract";
import { Button } from "../components/Button";
import { CheckLines } from "../components/CheckLines";
import { Choice } from "../components/Choice";
import { CodeBlock } from "../components/CodeBlock";
import { Command } from "../components/Command";
import { HelpOffer } from "../components/HelpOffer";
import { Hints } from "../components/Hints";
import { CODE, InlineText } from "../components/InlineText";
import { Says } from "../components/Says";
import { StepDots } from "../components/StepDots";
import { Tier } from "../components/Tier";
import { Where } from "../components/Where";
import { lessonEyebrow } from "../course/labels";
import { useAct, useActionsEnabled } from "../live/LiveProvider";
import { useActionProps, useSend } from "../live/useAction";
import { ReadLesson } from "../pages/ReadLesson";
import {
  useHelpShowing,
  usePipInput,
  usePipLook,
  usePipStep,
} from "../pip/PipStage";
import { ActionBar } from "../shell/ActionBar";
import { Pip } from "../pip/Pip";
import { PageTitle } from "../shell/PageTitle";
import { LessonGate } from "./LessonGate";
import { EYEBROW, MOMENT, WORKSPACE_COLUMN } from "./layout";
import {
  checkLines,
  decidedByOf,
  isDone,
  isTearDown,
  primaryAction,
  ranInOf,
  statusOf,
  type BeatCheckLine,
} from "./beat";
import { useActiveLesson } from "./lesson";
import { useCheckClock } from "./useCheckClock";

type Status = BeatView["status"];

const WHERE: Record<NonNullable<StepView["where"]>["kind"], string> = {
  terminal: "Your terminal",
  claude: "Claude Code",
  "claude-2": "Claude Code",
  shell: "A shell",
  editor: "Your editor",
  browser: "Your browser",
};

/** The Tear down steps' opening line, while they are still to do. */
const TEAR_DOWN_LINE =
  "The Check passed. These steps put things back as they were.";

/** The line under passed Check lines once the Practice copy ran it too. */
const RUN_IT_TOO =
  "Run it in your practice copy too: you will see the same result.";

/** A hint rung as one line of text. */
function hintText(hint: HintView): string {
  if (hint.kind !== "exact") return hint.text;
  return hint.commands
    .map((command) =>
      command.leadIn
        ? `${command.leadIn} \`${command.text}\``
        : `\`${command.text}\``,
    )
    .join(" ");
}

/** A new key for each Check run, so its lines stagger in again (241 D13). */
function useRunKey(status: Status): number {
  const [seen, setSeen] = useState(status);
  const [runs, setRuns] = useState(0);
  if (status !== seen) {
    setSeen(status);
    if (status === "checking") setRuns(runs + 1);
  }
  return runs;
}

/**
 * The Lesson workspace: step dots, Pip beside the step saying the status,
 * the step card, its hints and the sticky action bar, all from the
 * snapshot. A Step-down shows here too, as its own calm card. Pip watches a
 * copied command, a hint opening and the check's lines, and offers the hint
 * when the step seems stuck (the director's stuck rule).
 */
export function Workspace() {
  const active = useActiveLesson("playing", "step-down");
  if (!active) return <LessonGate />;
  const { lesson } = active;
  const number = active.summary?.number ?? null;
  if (lesson.phase === "step-down")
    return <StepDown lesson={lesson} number={number} />;
  if (lesson.step === null || lesson.beat === null)
    // A resume with no beat open: the shell sends lesson.open for it.
    return <LessonGate />;
  return (
    <Play
      lesson={lesson}
      step={lesson.step}
      beat={lesson.beat}
      number={number}
      tearDownLeft={active.summary?.tearDownLeft ?? false}
    />
  );
}

function Play({
  lesson,
  step,
  beat,
  number,
  tearDownLeft,
}: {
  lesson: PlayingLesson;
  step: StepView;
  beat: BeatView;
  number: number | null;
  tearDownLeft: boolean;
}) {
  const main = useRef<HTMLElement>(null);
  const newestHint = useRef<HTMLDivElement>(null);
  const tellPip = usePipInput();
  const look = usePipLook();
  const offering = useHelpShowing();
  const shownHints = lesson.hints.shown.length;
  usePipStep(
    `${lesson.id}:${step.id}:${String(beat.index)}`,
    lesson.hints.available,
  );

  // A hint that opens takes focus, since the button that opened it has gone,
  // and Pip looks at it.
  const hintsBefore = useRef(shownHints);
  useEffect(() => {
    const opened = shownHints > hintsBefore.current;
    hintsBefore.current = shownHints;
    const hint = newestHint.current;
    if (!opened || hint === null) return;
    hint.focus();
    look("hint", hint);
  }, [shownHints, look]);

  const send = useSend();
  const showNextHint = () => {
    // Any rung opening closes the offer and starts the 45 s clock again.
    tellPip({ type: "hintOpened" });
    send("hint.next", { type: "hint.next" });
  };
  const dismissOffer = () => {
    tellPip({ type: "helpDismissed" });
    // The offer's buttons have gone: focus goes back to the step's heading.
    main.current?.querySelector<HTMLElement>("[data-page-title]")?.focus();
  };

  const runKey = useRunKey(beat.status);
  const seconds = useCheckClock(beat.status);
  const status = statusOf(beat);
  const at = lesson.steps.findIndex((s) => s.id === step.id);
  const hints = lesson.hints.shown.map(hintText);
  const tearDown = isTearDown(step);
  const tearDowns = lesson.steps.filter(isTearDown);
  const firstTearDown = tearDown && tearDowns[0]?.id === step.id;
  const lines = checkLines(beat);
  const ranIn = ranInOf(beat);
  const where = step.where;
  const passed = lines.length > 0 && lines.every((l) => l.state === "pass");
  const eyebrow = tearDown
    ? `Tear down, step ${String(tearDowns.findIndex((s) => s.id === step.id) + 1)} of ${String(tearDowns.length)}`
    : `Step ${String(at + 1)} of ${String(lesson.steps.length)}`;
  const priorNote = cardNote(step, lesson.capstone);

  return (
    <>
      <main ref={main} className={WORKSPACE_COLUMN}>
        <StepDots
          steps={lesson.steps.map((s) => s.title)}
          at={Math.max(at, 0)}
          states={lesson.steps.map((s) => s.state)}
        />
        {/* The status words stay keyed as they are while the offer comes
            and goes, so the live region never says them twice. The seconds
            sit beside the live region, so their ticks are never said. */}
        <Says
          tone={offering ? "offer" : status.tone}
          textKey={status.key}
          aside={
            seconds !== null && (
              <span
                data-check-clock=""
                className="shrink-0 text-sm text-muted"
                aria-hidden="true"
              >
                {`${String(seconds)} s`}
              </span>
            )
          }
        >
          <span>
            {beat.status === "waiting" && (
              <span
                className="mr-2 inline-block size-2 animate-breathe rounded-full bg-teal align-middle"
                aria-hidden="true"
              />
            )}
            {status.words}
          </span>
          <HelpOffer
            open={offering}
            onShowHint={showNextHint}
            onDismiss={dismissOffer}
          />
        </Says>
        <article
          data-step-card=""
          className="grid gap-5 rounded-xl border border-line bg-surface p-6.5 shadow-md max-sm:p-5 [&>*]:min-w-0"
        >
          <header className="grid gap-1.5">
            <span className={EYEBROW}>
              {`${lessonEyebrow(lesson.level, number, lesson.capstone)} · ${eyebrow}`}
            </span>
            <PageTitle
              title={`${step.title}: ${lesson.title}`}
              className="text-2xl"
            >
              <InlineText text={step.title} />
            </PageTitle>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted">{step.part}</span>
              <Tier tier={step.tier} />
              {where && (
                <Where
                  kind={where.kind}
                  label={WHERE[where.kind]}
                  // The terminal's number where the page numbers them; a
                  // second Claude Code session is 2 by the client's default.
                  {...(where.terminal !== null
                    ? { number: where.terminal }
                    : where.kind === "claude-2"
                      ? { number: 2 }
                      : {})}
                  {...(where.folder ? { note: `in ${where.folder}` } : {})}
                />
              )}
              <ReadLesson size="sm" className="ml-auto" />
            </div>
            {priorNote && (
              <p data-step-note="" className="text-sm text-muted">
                {priorNote}
              </p>
            )}
          </header>
          {firstTearDown && tearDownLeft && (
            <p data-tear-down="">{TEAR_DOWN_LINE}</p>
          )}
          {step.extraHelp && !isDone(beat) && (
            <aside data-extra-help="" className="text-sm text-muted">
              More help on this step.
            </aside>
          )}
          {beat.status === "already" && beat.codespace && (
            <p data-codespace="">
              <InlineText text={beat.codespace} />
            </p>
          )}
          <BeatBody beat={beat} />
          {lines.length > 0 && (
            <CheckLines
              key={runKey}
              lines={lines.map((line) => ({
                text: <InlineText text={line.text} />,
                ok: line.state === "pass",
                state: line.state,
                ...(line.fail !== undefined ||
                line.found !== undefined ||
                line.evidence !== undefined
                  ? { evidence: <Evidence line={line} /> }
                  : {}),
              }))}
            />
          )}
          {passed && ranIn !== null && <p data-ran-in="">{RUN_IT_TOO}</p>}
          {beat.winNote && (
            <p data-win-note="">
              <InlineText text={beat.winNote} />
            </p>
          )}
        </article>
        {(hints.length > 0 || lesson.hints.available) && (
          <Hints
            // One more entry than is shown, while another can open: Hints
            // offers the next rung while it has one, and the engine words it.
            hints={lesson.hints.available ? [...hints, ""] : hints}
            shown={hints.length}
            onShowNext={showNextHint}
            newestRef={newestHint}
          />
        )}
        <Offers lesson={lesson} />
      </main>
      <Actions lesson={lesson} beat={beat} />
    </>
  );
}

/** The step's note on help: a harder step, or a skill done before (row 49). */
function cardNote(step: StepView, capstone: boolean): string | null {
  const parts: string[] = [];
  if (step.note !== null && capstone) parts.push("No commands this time.");
  if (step.doneBefore)
    parts.push(
      capstone ? "You've done each part before." : "You've done this before.",
    );
  return parts.length > 0 ? parts.join(" ") : null;
}

/** Under a Check line: the Not yet words, the file found, what it holds. */
function Evidence({ line }: { line: BeatCheckLine }) {
  return (
    <>
      {line.fail !== undefined && (
        <span data-not-yet="" className="block">
          <InlineText text={line.fail} />
        </span>
      )}
      {line.found !== undefined && (
        <span className="block">
          Found <code className={CODE}>{line.found}</code>.
        </span>
      )}
      {line.evidence !== undefined && (
        <pre className="font-mono text-code whitespace-pre-wrap wrap-anywhere">
          {line.evidence}
        </pre>
      )}
    </>
  );
}

const BACK_NOTE = "workspace-back-note";
const SKIP_NOTE = "workspace-skip-note";

/** Why Back and Skip are offered, the line the bar's buttons point to. */
function Offers({ lesson }: { lesson: PlayingLesson }) {
  const { back, skip } = lesson.offers;
  if (!back && !skip) return null;
  return (
    <div data-offers="" className="grid gap-1 text-sm text-muted">
      {back && (
        <p id={BACK_NOTE}>
          {"Back to "}
          <InlineText text={back.title} />
          {": "}
          <InlineText text={back.why} />
        </p>
      )}
      {skip && (
        <p id={SKIP_NOTE}>
          <InlineText text={skip.when} />
        </p>
      )}
    </div>
  );
}

/** A beat line's look, by its kind. */
const LINE_CLASS: Partial<Record<BeatLine["kind"], string>> = {
  goal: "text-lg font-semibold tracking-tight",
  say: "text-muted",
};

/** One line of the beat, by its kind. */
function Line({ line }: { line: BeatLine }): ReactNode {
  if (line.kind === "run")
    return <Command text={line.text} watched={line.watched === true} />;
  if (line.kind === "expect")
    return (
      <p>
        <span className="font-semibold">You should see </span>
        <InlineText text={line.text} />
      </p>
    );
  return (
    <p className={LINE_CLASS[line.kind]} data-line-kind={line.kind}>
      <InlineText text={line.text} />
    </p>
  );
}

/**
 * The beat's body. `do` and `self` beats show their lines, the code with
 * Copy, and why. The question kinds (predict, ask, type) get a plain
 * fallback here, their lines and choices, until 247 builds them. A watched
 * beat's "Done when" line is its Check line instead, and a done beat with
 * evidence hides it.
 */
function BeatBody({ beat }: { beat: BeatView }) {
  const watched = decidedByOf(beat) === "watch";
  const shown = beat.lines.filter(
    (line) =>
      !(
        line.doneWhen === true &&
        (watched || (isDone(beat) && beat.evidence !== null))
      ),
  );
  const after = shown.filter((line) => line.kind === "after");
  const lines = (
    <>
      {shown
        .filter((line) => line.kind !== "after")
        .map((line, i) => (
          <Line key={i} line={line} />
        ))}
      {beat.code && <CodeBlock code={beat.code} />}
      {beat.commandsInHints && (
        <p className="text-muted">The commands are in the hints.</p>
      )}
      {beat.self && (
        <p>
          <InlineText text={beat.self} />
        </p>
      )}
    </>
  );
  const closing = after.map((line, i) => (
    <Line key={`after-${String(i)}`} line={line} />
  ));
  switch (beat.kind) {
    case "do":
    case "self":
      return (
        <div className="grid justify-items-start gap-3.5 [&>*]:max-w-full">
          {lines}
          {beat.why.onCard && (
            <p data-why="">
              <span className="font-semibold text-accent-text">Why: </span>
              <InlineText text={beat.why.onCard} />
            </p>
          )}
          {closing}
        </div>
      );
    default:
      return (
        <div className="grid justify-items-start gap-3.5 [&>*]:max-w-full">
          {lines}
          {beat.options.length > 0 && <Question beat={beat} />}
          {beat.answer.reveal && (
            <p>
              <InlineText text={beat.answer.reveal} />
            </p>
          )}
          {closing}
        </div>
      );
  }
}

/** The beat's question: its answers, each pick sent as `answer.pick`. */
function Question({ beat }: { beat: BeatView }) {
  const send = useSend();
  const { pending } = useAct();
  const enabled = useActionsEnabled();
  const picked = beat.answer.picked;
  const done = beat.status === "done" || beat.status === "already";
  // The answer to mark: the one picked once judged, else the last wrong one
  // tried (an ask beat keeps no pick after a wrong one, only its kind).
  const tried = beat.options.findLastIndex((option) => option.kind === "wrong");
  const marked: { id: string; state: "right" | "notYet" } | null =
    picked !== null && beat.answer.feedback !== null
      ? {
          id: String(picked),
          state: beat.answer.feedback === "right" ? "right" : "notYet",
        }
      : tried >= 0
        ? { id: String(tried), state: "notYet" }
        : null;
  return (
    <div className="w-full">
      <Choice
        legend={<InlineText text={beat.ask ?? ""} />}
        options={beat.options.map((option, i) => ({
          id: String(i),
          text: <InlineText text={option.text} />,
          ...(option.because
            ? { because: <InlineText text={option.because} /> }
            : {}),
        }))}
        value={picked === null ? null : String(picked)}
        {...(marked === null ? {} : { result: marked })}
        disabled={done || !enabled || pending("answer.pick")}
        onChange={(id) => {
          send("answer.pick", { type: "answer.pick", option: Number(id) });
        }}
      />
    </div>
  );
}

/**
 * The sticky action bar: what the moment needs, the main action last. Back
 * and Skip show only where the snapshot offers them, each pointing to the
 * line that says why. Each press sends exactly one action.
 */
function Actions({ lesson, beat }: { lesson: PlayingLesson; beat: BeatView }) {
  const revisit = useActionProps("step.revisit", { type: "step.revisit" });
  const skip = useActionProps("step.skip", { type: "step.skip" });
  const check = useActionProps("check.run", { type: "check.run" });
  const markDone = useActionProps("step.markDone", { type: "step.markDone" });
  const ended = useActionProps("session.ended", { type: "session.ended" });
  const next = useActionProps("step.continue", { type: "step.continue" });
  const props = {
    "step.continue": next,
    "check.run": check,
    "step.markDone": markDone,
    "session.ended": ended,
  };
  const action = primaryAction(beat);

  return (
    <ActionBar
      start={
        lesson.offers.back && (
          <Button
            variant="ghost"
            icon="back"
            aria-describedby={BACK_NOTE}
            {...revisit}
          >
            Back
          </Button>
        )
      }
    >
      {lesson.offers.skip && (
        <Button variant="ghost" aria-describedby={SKIP_NOTE} {...skip}>
          Skip
        </Button>
      )}
      {action &&
        (action.type === "check.run" ? (
          <Button icon="refresh" {...props[action.type]}>
            {action.label}
          </Button>
        ) : (
          <Button variant="primary" iconEnd="arrow" {...props[action.type]}>
            {action.label}
          </Button>
        ))}
    </ActionBar>
  );
}

const ACCEPT: Record<StepDownLesson["to"], string> = {
  guided: "Go on",
  hinted: "Go on with hints",
  challenge: "Go on on your own",
};
const MORE_HELP: Record<StepDownLesson["from"], string> = {
  guided: "Keep every command shown",
  hinted: "Keep the hints",
  challenge: "Keep going",
};

/** A Step-down: the next steps give less help. Calm, one choice. */
function StepDown({
  lesson,
  number,
}: {
  lesson: StepDownLesson;
  number: number | null;
}) {
  const accept = useActionProps("stepDown.accept", { type: "stepDown.accept" });
  const moreHelp = useActionProps("stepDown.moreHelp", {
    type: "stepDown.moreHelp",
  });
  const back = useActionProps("stepDown.back", { type: "stepDown.back" });
  return (
    <main className={MOMENT}>
      <Pip size="hero" className="mb-2" />
      <span className={EYEBROW}>
        {lessonEyebrow(lesson.level, number, lesson.capstone)}
      </span>
      <PageTitle
        title={`Less help from here: ${lesson.title}`}
        className="text-3xl max-sm:text-2xl"
      >
        Less help from here
      </PageTitle>
      <p
        className="flex flex-wrap items-center justify-center gap-3"
        data-pip-target="tiers"
      >
        <Tier tier={lesson.from} />
        <span aria-hidden="true">→</span>
        <span className="sr-only">to</span>
        <Tier tier={lesson.to} />
      </p>
      <div className="flex w-full max-w-moment flex-wrap items-center gap-2.5">
        <Button variant="ghost" icon="back" {...back}>
          Back
        </Button>
        <span className="grow" />
        {lesson.moreHelp && (
          <Button {...moreHelp}>{MORE_HELP[lesson.from]}</Button>
        )}
        <Button variant="primary" iconEnd="arrow" {...accept}>
          {ACCEPT[lesson.to]}
        </Button>
      </div>
    </main>
  );
}
