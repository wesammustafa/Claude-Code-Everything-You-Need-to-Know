import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type {
  BeatKey,
  BeatLine,
  BeatView,
  HintView,
  LessonId,
  PlayingLesson,
  Snapshot,
  StepDownLesson,
  StepId,
  StepView,
} from "@quest/contract";
import { Button } from "../components/Button";
import { CheckLines } from "../components/CheckLines";
import { Choice } from "../components/Choice";
import { CodeBlock } from "../components/CodeBlock";
import { Command, promptOf } from "../components/Command";
import { HelpOffer } from "../components/HelpOffer";
import { Hints } from "../components/Hints";
import { CODE, InlineText } from "../components/InlineText";
import { Says } from "../components/Says";
import { StepDots } from "../components/StepDots";
import { Tier } from "../components/Tier";
import { Where } from "../components/Where";
import { LEVEL_NAMES, lessonEyebrow } from "../course/labels";
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
  answerMarks,
  checkLines,
  decidedByOf,
  isDone,
  isTearDown,
  primaryAction,
  ranInOf,
  revealable,
  statusOf,
  type BeatCheckLine,
} from "./beat";
import { summaryOf, useActiveLesson } from "./lesson";
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

/** Why no hint opens yet, at Challenge before a first try. */
const UNAVAILABLE: Record<
  NonNullable<PlayingLesson["hints"]["unavailable"]>,
  string
> = {
  "run-check": "Hints open once you have run Check again.",
  "pick-answer": "Hints open once you have tried an answer.",
};

/**
 * After a hint rung is asked for or the exact command is taken, a repeat
 * ask within this long opens nothing, so a double press never skips a rung.
 * Nothing on the screen counts it down.
 */
export const HINT_LOCK_MS = 2000;

/** The line under a warm-up's card when the engine explains warm-ups. */
const WARMUP_EXPLAINER =
  "Warm-ups bring back a skill from before, so it sticks.";

// The beat's key, as its card's data-beat renders it and Check again sends it.
const beatKey = (lesson: LessonId, step: StepId, index: number): BeatKey =>
  `${lesson}:${step}:${String(index)}`;

/** A hint rung: the page's words, or the exact command with Copy. */
function hintRung(hint: HintView, where: string | null): ReactNode {
  if (hint.kind !== "exact") return hint.text;
  return hint.commands.map((command, i) => (
    <div key={i} className="grid gap-2">
      {command.leadIn && (
        <p>
          <InlineText text={command.leadIn} />
        </p>
      )}
      <Command text={command.text} prompt={promptOf(command.text, where)} />
      {command.code && <CodeBlock code={command.code} />}
    </div>
  ));
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
      snapshot={active.snapshot}
    />
  );
}

function Play({
  lesson,
  step,
  beat,
  number,
  tearDownLeft,
  snapshot,
}: {
  lesson: PlayingLesson;
  step: StepView;
  beat: BeatView;
  number: number | null;
  tearDownLeft: boolean;
  snapshot: Snapshot;
}) {
  const main = useRef<HTMLElement>(null);
  const newestHint = useRef<HTMLDivElement>(null);
  const tellPip = usePipInput();
  const look = usePipLook();
  const offering = useHelpShowing();
  const shownHints = lesson.hints.shown.length;
  usePipStep(beatKey(lesson.id, step.id, beat.index), lesson.hints.available);

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
  const { pending } = useAct();
  const actionsOn = useActionsEnabled();
  const lockUntil = useRef(0);
  // True, and the lock starts, when no ask came within the last HINT_LOCK_MS.
  const unlocked = () => {
    const now = Date.now();
    if (now < lockUntil.current) return false;
    lockUntil.current = now + HINT_LOCK_MS;
    return true;
  };
  const showNextHint = () => {
    if (!unlocked()) return;
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
  const hints = lesson.hints.shown.map((hint) =>
    hintRung(hint, step.where?.kind ?? null),
  );
  const { available, unavailable, confirmExact } = lesson.hints;
  // An ask that only opens the exact-command question opens no rung, so it
  // leaves no lock: the take, or a later ask after Not now, is not held.
  useEffect(() => {
    if (confirmExact) lockUntil.current = 0;
  }, [confirmExact]);
  // Busy first: a press the store would drop starts no lock.
  const exactBusy = !actionsOn || pending("hint.takeExact");
  const takeExact = (take: boolean) => {
    if (exactBusy) return;
    if (take && !unlocked()) return;
    if (!take) lockUntil.current = 0;
    send("hint.takeExact", { type: "hint.takeExact", take });
  };
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
            sit beside the live region, so their ticks are never said, and
            the offer under it, so its buttons are never said with them. */}
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
          after={
            <HelpOffer
              open={offering}
              onShowHint={showNextHint}
              onDismiss={dismissOffer}
            />
          }
        >
          <span>
            {beat.status === "waiting" && decidedByOf(beat) !== "answer" && (
              <span
                className="mr-2 inline-block size-2 animate-breathe rounded-full bg-teal align-middle"
                aria-hidden="true"
              />
            )}
            {status.words}
          </span>
        </Says>
        <article
          data-step-card=""
          // The beat on screen, for a test that acts only on the beat it read.
          data-beat={beatKey(lesson.id, step.id, beat.index)}
          data-beat-status={beat.status}
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
            {step.warmup && <Warmup warmup={step.warmup} snapshot={snapshot} />}
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
          <BeatBody beat={beat} where={step.where?.kind ?? null} />
          <WaitQuestion lesson={lesson} step={step} />
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
        {(hints.length > 0 ||
          available ||
          unavailable !== null ||
          confirmExact) && (
          <Hints
            // One more entry than is shown, while another can open or waits
            // for a first try: Hints offers the next rung, or says why not,
            // and the engine words it.
            hints={available || unavailable !== null ? [...hints, ""] : hints}
            shown={hints.length}
            onShowNext={showNextHint}
            newestRef={newestHint}
            {...(unavailable !== null
              ? { unavailable: UNAVAILABLE[unavailable] }
              : {})}
            {...(confirmExact
              ? {
                  confirm: {
                    busy: exactBusy,
                    onTake: () => {
                      takeExact(true);
                    },
                    onDecline: () => {
                      takeExact(false);
                    },
                  },
                }
              : {})}
          />
        )}
        <Offers lesson={lesson} />
      </main>
      <Actions lesson={lesson} step={step} beat={beat} />
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
function Line({
  line,
  where,
}: {
  line: BeatLine;
  where: string | null;
}): ReactNode {
  if (line.kind === "run")
    return (
      <Command
        text={line.text}
        watched={line.watched === true}
        prompt={promptOf(line.text, where)}
      />
    );
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
 * Copy, and why. The question kinds (predict, ask, type) show their lines,
 * the question (answers to pick, or a box to type in), what to look for and
 * the words after the answer. A watched beat's "Done when" line is its
 * Check line instead, and a done beat with evidence hides it.
 */
function BeatBody({ beat, where }: { beat: BeatView; where: string | null }) {
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
          <Line key={i} line={line} where={where} />
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
    <Line key={`after-${String(i)}`} line={line} where={where} />
  ));
  const why = beat.why.onCard && (
    <p data-why="">
      <span className="font-semibold text-accent-text">Why: </span>
      <InlineText text={beat.why.onCard} />
    </p>
  );
  switch (beat.kind) {
    case "do":
    case "self":
      return (
        <div className="grid justify-items-start gap-3.5 [&>*]:max-w-full">
          {lines}
          {why}
          {closing}
        </div>
      );
    default: {
      const { answer } = beat;
      // An answer's own reason shows under it; the beat's reason shows here
      // only when no marked answer carries one (a typed answer, a typed miss).
      const marked = answerMarks(beat).map((mark) => Number(mark.id));
      const underAnswer = marked.some(
        (i) => beat.options[i]?.because !== undefined,
      );
      return (
        <div className="grid justify-items-start gap-3.5 [&>*]:max-w-full">
          {lines}
          {beat.kind === "type" ? (
            <TypedAnswer beat={beat} />
          ) : (
            beat.options.length > 0 && <Question beat={beat} />
          )}
          {answer.because && !underAnswer && (
            <p data-answer-because="">
              <InlineText text={answer.because} />
            </p>
          )}
          {answer.point && (
            <p data-answer-point="" className="text-muted">
              <InlineText text={answer.point} />
            </p>
          )}
          {answer.recall && (
            <p data-answer-recall="" className="text-muted">
              <InlineText text={answer.recall} />
            </p>
          )}
          {answer.reveal && (
            <p>
              <InlineText text={answer.reveal} />
            </p>
          )}
          {why}
          {closing}
        </div>
      );
    }
  }
}

/** A predict is a guess; every other question is checked. */
const SUBMIT: Record<"predict" | "ask", string> = {
  predict: "That's my guess",
  ask: "Check my answer",
};

/**
 * The beat's question: its answers to select, the selection sent as one
 * `answer.pick` by the button under them, and Show the answer once a wrong
 * one was tried. The selection is the Learner's until sent: it clears on a
 * new beat and after each judged pick.
 */
function Question({ beat }: { beat: BeatView }) {
  const send = useSend();
  const { pending } = useAct();
  const enabled = useActionsEnabled();
  const done = isDone(beat);
  const [selected, setSelected] = useState<string | null>(null);
  const judged = `${String(beat.index)}:${beat.answer.feedback ?? ""}:${String(beat.options.filter((o) => o.kind !== undefined).length)}`;
  const [seen, setSeen] = useState(judged);
  if (judged !== seen) {
    setSeen(judged);
    setSelected(null);
  }
  const marks = answerMarks(beat);
  const picked = beat.answer.picked;
  const reveal = useActionProps("answer.reveal", { type: "answer.reveal" });
  return (
    <div className="grid w-full justify-items-start gap-2.5">
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
          value={done && picked !== null ? String(picked) : selected}
          {...(marks.length > 0 ? { result: marks } : {})}
          disabled={done || !enabled}
          onChange={setSelected}
          {...(done
            ? {}
            : {
                submit: {
                  label: SUBMIT[beat.kind === "predict" ? "predict" : "ask"],
                  pending: pending("answer.pick"),
                  onSubmit: (id: string) => {
                    send("answer.pick", {
                      type: "answer.pick",
                      option: Number(id),
                    });
                  },
                },
              })}
        />
      </div>
      {revealable(beat) && (
        <Button variant="ghost" size="sm" {...reveal}>
          Show the answer
        </Button>
      )}
    </div>
  );
}

/**
 * A typed answer, at most 200 characters, sent as `answer.type`; an empty
 * one shows the answer. It stays after a miss, to edit, and clears on a new
 * beat.
 */
function TypedAnswer({ beat }: { beat: BeatView }) {
  const send = useSend();
  const { pending } = useAct();
  const enabled = useActionsEnabled();
  const id = useId();
  const [text, setText] = useState("");
  const [seen, setSeen] = useState(beat.index);
  if (beat.index !== seen) {
    setSeen(beat.index);
    setText("");
  }
  const done = isDone(beat);
  const busy = pending("answer.type");
  const ready = !done && enabled && !busy;
  return (
    <form
      className="grid w-full justify-items-start gap-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) send("answer.type", { type: "answer.type", text });
      }}
    >
      <label htmlFor={id} className="font-semibold">
        <InlineText text={beat.ask ?? ""} />
      </label>
      <input
        id={id}
        type="text"
        value={text}
        maxLength={200}
        autoComplete="off"
        spellCheck={false}
        // Read-only, not disabled: a disabled box drops its focus (255).
        readOnly={done || busy}
        {...(done || busy ? { "aria-disabled": true } : {})}
        onChange={(event) => {
          setText(event.target.value);
        }}
        className="h-10 w-full rounded-md border border-line-2 bg-surface px-3 font-mono text-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-disabled:cursor-not-allowed aria-disabled:opacity-disabled"
      />
      {!done && (
        <Button
          type="submit"
          variant="primary"
          pending={busy}
          {...(ready ? {} : { "aria-disabled": true })}
        >
          Check my answer
        </Button>
      )}
    </form>
  );
}

/** The warm-up's line: the Lesson it looks back at, and why warm-ups come. */
function Warmup({
  warmup,
  snapshot,
}: {
  warmup: NonNullable<StepView["warmup"]>;
  snapshot: Snapshot;
}) {
  const level = /^(beginner|intermediate|advanced)-index$/.exec(
    warmup.from,
  )?.[1] as keyof typeof LEVEL_NAMES | undefined;
  const title = summaryOf(snapshot, warmup.from)?.title;
  return (
    <div data-warmup="" className="grid gap-1 text-sm text-muted">
      <p>
        {level !== undefined ? (
          `A quick look back at the ${LEVEL_NAMES[level]} level.`
        ) : title !== undefined ? (
          <>
            {"A quick look back at "}
            <InlineText text={title} />
            {"."}
          </>
        ) : (
          "A quick look back at an earlier lesson."
        )}
      </p>
      {warmup.explainer && <p>{WARMUP_EXPLAINER}</p>}
    </div>
  );
}

type WaitQuestionView = NonNullable<PlayingLesson["waitQuestion"]>;

/**
 * The question a long wait offers, held on the card until it is answered or
 * dismissed: the Terminal app removed it when the result landed, which the
 * spec turns down (ticket 27, Q2). Once the wait ends it stays, read only.
 */
function useHeldWaitQuestion(
  lesson: PlayingLesson,
  step: StepView,
): {
  question: WaitQuestionView | null;
  ended: boolean;
  dismiss: () => void;
} {
  const place = `${lesson.id}:${step.id}`;
  const live = lesson.waitQuestion;
  const [held, setHeld] = useState<{
    place: string;
    question: WaitQuestionView;
  } | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  if (live !== null && (held?.place !== place || held.question !== live))
    setHeld({ place, question: live });
  if (held !== null && held.place !== place) setHeld(null);
  const question =
    live ?? (held !== null && held.place === place ? held.question : null);
  return {
    question: dismissed === place ? null : question,
    ended: live === null,
    dismiss: () => {
      setDismissed(place);
    },
  };
}

/** The waiting question: never scored, answered or put away. */
function WaitQuestion({
  lesson,
  step,
}: {
  lesson: PlayingLesson;
  step: StepView;
}) {
  const { question, ended, dismiss } = useHeldWaitQuestion(lesson, step);
  const send = useSend();
  const { pending } = useAct();
  const enabled = useActionsEnabled();
  const [selected, setSelected] = useState<string | null>(null);
  if (question === null) return null;
  const answered = question.answered;
  const closed = answered !== null || ended;
  return (
    <section
      data-wait-question=""
      aria-labelledby="wait-question-heading"
      className="grid justify-items-start gap-2.5 rounded-lg border border-line bg-surface-2 p-4.5 [&>*]:w-full"
    >
      <h2 id="wait-question-heading" className={EYEBROW}>
        While you wait
      </h2>
      <Choice
        legend={<InlineText text={question.prompt} />}
        options={question.options.map((option, i) => ({
          id: String(i),
          text: <InlineText text={option.text} />,
        }))}
        value={answered !== null ? String(answered) : selected}
        {...(answered !== null
          ? { result: [{ id: String(answered), state: "chosen" as const }] }
          : {})}
        disabled={closed || !enabled}
        onChange={setSelected}
        {...(closed
          ? {}
          : {
              submit: {
                label: "Check my answer",
                pending: pending("waitQuestion.answer"),
                onSubmit: (id: string) => {
                  send("waitQuestion.answer", {
                    type: "waitQuestion.answer",
                    option: Number(id),
                  });
                },
              },
            })}
      />
      {question.words && (
        <p data-wait-words="">
          <InlineText text={question.words} />
        </p>
      )}
      {ended && <p className="text-sm text-muted">Your result is in.</p>}
      {!closed && (
        <div>
          <Button variant="ghost" size="sm" onClick={dismiss}>
            Not now
          </Button>
        </div>
      )}
    </section>
  );
}

/**
 * The sticky action bar: what the moment needs, the main action last. Back
 * and Skip show only where the snapshot offers them, each pointing to the
 * line that says why. Each press sends exactly one action.
 */
function Actions({
  lesson,
  step,
  beat,
}: {
  lesson: PlayingLesson;
  step: StepView;
  beat: BeatView;
}) {
  const revisit = useActionProps("step.revisit", { type: "step.revisit" });
  const skip = useActionProps("step.skip", { type: "step.skip" });
  const check = useActionProps("check.run", {
    type: "check.run",
    beat: beatKey(lesson.id, step.id, beat.index),
  });
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
