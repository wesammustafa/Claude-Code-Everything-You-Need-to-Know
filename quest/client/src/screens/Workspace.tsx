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
import { CheckLines, type CheckLine } from "../components/CheckLines";
import { Choice } from "../components/Choice";
import { Command } from "../components/Command";
import { HelpOffer } from "../components/HelpOffer";
import { Hints } from "../components/Hints";
import { InlineText } from "../components/InlineText";
import { Says, type SaysTone } from "../components/Says";
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
import { COLUMN, EYEBROW, MOMENT } from "./layout";
import { useActiveLesson } from "./lesson";

type Status = BeatView["status"];

// The status bubble's tone and words, in the app's words: what it saw,
// never a judgement.
const STATUS: Record<Status, { tone: SaysTone; words: string }> = {
  waiting: { tone: "watching", words: "Watching your Practice copy." },
  checking: { tone: "checking", words: "Checking your work." },
  fail: {
    tone: "notYet",
    words: "Not yet. The lines below say what the check saw.",
  },
  done: { tone: "passed", words: "That step is done." },
  already: { tone: "passed", words: "That was already done." },
  broken: { tone: "broken", words: "The check could not run this time." },
};

const WHERE: Record<NonNullable<StepView["where"]>["kind"], string> = {
  terminal: "Your terminal",
  claude: "Claude Code",
  "claude-2": "Claude Code",
  shell: "A shell",
  editor: "Your editor",
  browser: "Your browser",
};

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

/**
 * Whether the beat waits on its Check, not on the Learner saying it is done.
 * The snapshot has no field for it yet (a gap for 246): a beat with check
 * lines, a slow item waiting, or a Check under way is checked.
 */
function checked(beat: BeatView): boolean {
  return (
    beat.verification.length > 0 ||
    beat.slowWait ||
    ["checking", "fail", "broken"].includes(beat.status)
  );
}

/** A question still open on the beat: its answers wait for a pick. */
function asking(beat: BeatView): boolean {
  return (
    beat.options.length > 0 &&
    beat.status !== "done" &&
    beat.status !== "already"
  );
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
    />
  );
}

function Play({
  lesson,
  step,
  beat,
  number,
}: {
  lesson: PlayingLesson;
  step: StepView;
  beat: BeatView;
  number: number | null;
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
  const status = STATUS[beat.status];
  const at = lesson.steps.findIndex((s) => s.id === step.id);
  const hints = lesson.hints.shown.map(hintText);

  return (
    <>
      <main ref={main} className={`${COLUMN} gap-4.5 pt-5.5 pb-44`}>
        <StepDots
          steps={lesson.steps.map((s) => s.title)}
          at={Math.max(at, 0)}
          states={lesson.steps.map((s) => s.state)}
        />
        {/* The status words stay keyed as they are while the offer comes
            and goes, so the live region never says them twice. */}
        <Says tone={offering ? "offer" : status.tone} textKey={beat.status}>
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
        <article className="grid gap-5 rounded-xl border border-line bg-surface p-6.5 shadow-md max-sm:p-5 [&>*]:min-w-0">
          <header className="grid gap-1.5">
            <span className={EYEBROW}>
              {`${lessonEyebrow(lesson.level, number, lesson.capstone)} · Step ${String(at + 1)} of ${String(lesson.steps.length)}`}
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
              {step.where && (
                <Where
                  kind={step.where.kind}
                  label={WHERE[step.where.kind]}
                  {...(step.where.terminal !== null
                    ? { number: step.where.terminal }
                    : step.where.kind === "claude-2"
                      ? { number: 2 }
                      : {})}
                  {...(step.where.folder
                    ? { note: `in ${step.where.folder}` }
                    : {})}
                />
              )}
              <ReadLesson size="sm" className="ml-auto" />
            </div>
          </header>
          <BeatBody beat={beat} />
          {beat.verification.length > 0 && (
            <CheckLines key={runKey} lines={checkLines(beat)} />
          )}
          {beat.fail !== null && beat.verification.length === 0 && (
            <p data-not-yet="" className="text-sm text-wait">
              <InlineText text={beat.fail} />
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
      </main>
      <Actions lesson={lesson} beat={beat} />
    </>
  );
}

/** The check's lines: waiting while it runs, each line's state after. */
function checkLines(beat: BeatView): CheckLine[] {
  const running = beat.status === "checking";
  let failShown = false;
  return beat.verification.map((line) => {
    // The Not yet line goes under the first line that is not met.
    const evidence =
      !line.pass && !failShown && beat.fail !== null ? beat.fail : undefined;
    if (evidence !== undefined) failShown = true;
    return {
      text: line.text,
      ok: line.pass,
      state: running ? "waiting" : line.pass ? "pass" : "notYet",
      ...(evidence !== undefined && !running ? { evidence } : {}),
    };
  });
}

/** One line of the beat, by its kind. */
function Line({ line }: { line: BeatLine }): ReactNode {
  if (line.kind === "run") return <Command text={line.text} />;
  if (line.kind === "goal")
    return (
      <p className="text-lg font-semibold tracking-tight">
        <InlineText text={line.text} />
      </p>
    );
  return (
    <p className={line.kind === "say" ? "text-muted" : undefined}>
      <InlineText text={line.text} />
    </p>
  );
}

/**
 * The beat's body. `do` and `self` beats show their lines, the code with
 * Copy, and why. The question kinds (predict, ask, type) get a plain
 * fallback here, their lines and choices, until 247 builds them.
 */
function BeatBody({ beat }: { beat: BeatView }) {
  const lines = (
    <>
      {beat.lines.map((line, i) => (
        <Line key={i} line={line} />
      ))}
      {beat.code && <Command text={beat.code.copy} />}
      {beat.self && (
        <p>
          <InlineText text={beat.self} />
        </p>
      )}
    </>
  );
  switch (beat.kind) {
    case "do":
    case "self":
      return (
        <div className="grid justify-items-start gap-3.5 [&>*]:max-w-full">
          {lines}
          {beat.why.onCard && (
            <p className="text-sm text-muted">
              <InlineText text={beat.why.onCard} />
            </p>
          )}
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

/** The sticky action bar: what the moment needs, the main action last. */
function Actions({ lesson, beat }: { lesson: PlayingLesson; beat: BeatView }) {
  const revisit = useActionProps("step.revisit", { type: "step.revisit" });
  const skip = useActionProps("step.skip", { type: "step.skip" });
  const check = useActionProps("check.run", { type: "check.run" });
  const markDone = useActionProps("step.markDone", { type: "step.markDone" });
  const next = useActionProps("step.continue", { type: "step.continue" });
  const done = beat.status === "done" || beat.status === "already";

  let main: ReactNode = null;
  if (done)
    main = (
      <Button variant="primary" iconEnd="arrow" {...next}>
        Next step
      </Button>
    );
  else if (asking(beat)) main = null;
  else if (checked(beat))
    main = (
      <Button icon="refresh" {...check}>
        Check again
      </Button>
    );
  else
    main = (
      <Button variant="primary" iconEnd="arrow" {...markDone}>
        {beat.doneLabel ?? "I've done it"}
      </Button>
    );

  return (
    <ActionBar
      start={
        lesson.offers.back && (
          <Button variant="ghost" icon="back" {...revisit}>
            Back
          </Button>
        )
      }
    >
      {lesson.offers.skip && (
        <Button variant="ghost" {...skip}>
          Skip
        </Button>
      )}
      {main}
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
      <p className="flex flex-wrap items-center justify-center gap-3">
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
