import type {
  BeatView,
  DecidedBy,
  StepSummary,
  StepView,
} from "@quest/contract";
import type { SaysTone } from "../components/Says";

export type { DecidedBy };

/** The beat is done, by its own look or because it was done already. */
export function isDone(beat: BeatView): boolean {
  return beat.status === "done" || beat.status === "already";
}

/** A question still open on the beat: its answers wait for a pick. */
export function asking(beat: BeatView): boolean {
  return beat.options.length > 0 && !isDone(beat);
}

/** What decides the beat, as the snapshot says it. */
export function decidedByOf(beat: BeatView): DecidedBy {
  return beat.decidedBy;
}

/** The Work folder the beat's last result ran in; null in the Practice copy. */
export function ranInOf(beat: BeatView): string | null {
  return beat.ranIn;
}

export type ActionType =
  "step.continue" | "check.run" | "step.markDone" | "session.ended";

/** The action bar's main action: what it sends, its words and its weight. */
export interface PrimaryAction {
  type: ActionType;
  label: string;
  variant: "primary" | "secondary";
}

/**
 * The action the moment needs, or null while a question waits for a pick
 * (its answers are the action). Check again shows on a checked or watched
 * beat in every state, before the first look too.
 */
export function primaryAction(beat: BeatView): PrimaryAction | null {
  if (isDone(beat))
    return { type: "step.continue", label: "Next step", variant: "primary" };
  if (asking(beat)) return null;
  switch (decidedByOf(beat)) {
    case "check":
    case "watch":
      return { type: "check.run", label: "Check again", variant: "secondary" };
    case "session":
      return {
        type: "session.ended",
        label: beat.doneLabel ?? "The session has ended",
        variant: "primary",
      };
    case "learner":
      return {
        type: "step.markDone",
        label: beat.doneLabel ?? "I've done it",
        variant: "primary",
      };
    case "answer":
      return null;
  }
}

/** The status bubble: its tone, its words, and a key that changes with them. */
export interface StatusWords {
  tone: SaysTone;
  words: string;
  key: string;
}

const BROKEN: Record<NonNullable<BeatView["broken"]>, string> = {
  timeout: "The check took too long this time.",
  output: "The check's answer could not be read this time.",
  crashed: "The check stopped before it finished.",
};

/**
 * The status bubble's words, in the app's words: what it saw, never a
 * judgement. The first variant that holds wins.
 */
export function statusOf(beat: BeatView): StatusWords {
  const say = (tone: SaysTone, key: string, words: string): StatusWords => ({
    tone,
    words,
    key,
  });
  if (beat.status === "broken")
    return say(
      "broken",
      `broken-${beat.broken ?? "unknown"}`,
      beat.broken ? BROKEN[beat.broken] : "The check could not run this time.",
    );
  if (beat.same && beat.status === "fail")
    return say(
      "notYet",
      "same",
      "The check saw the same as last time. The cause may be in an earlier step.",
    );
  if (beat.stale && beat.status === "fail")
    return say(
      "notYet",
      "stale",
      "Nothing has changed there since this step opened.",
    );
  if (beat.slowWait && !isDone(beat) && beat.status !== "checking")
    return say(
      "watching",
      "slowWait",
      "Everything else passes. Check again runs the slow part.",
    );
  if (beat.status === "checking") {
    if (beat.running)
      return say(
        "checking",
        `running-${String(beat.running.n)}`,
        `Checking item ${String(beat.running.n)} of ${String(beat.running.m)}…`,
      );
    return say(
      "checking",
      "checking",
      beat.checking ? `Checking ${beat.checking}…` : "Checking…",
    );
  }
  if (decidedByOf(beat) === "answer") {
    const { feedback } = beat.answer;
    if (feedback === "right")
      return say("passed", "answer-right", "That's right.");
    if (feedback === "revealed")
      return say("idle", "answer-revealed", "Here is the answer.");
    if (!isDone(beat)) {
      if (feedback === "wrong")
        return say("notYet", "answer-wrong", "Not yet. Try another answer.");
      if (beat.kind === "predict")
        return say("idle", "asking-predict", "Make your guess.");
      if (beat.kind === "type")
        return say("idle", "asking-type", "Type your answer.");
      return say("idle", "asking-ask", "Pick an answer.");
    }
  }
  if (beat.status === "waiting") {
    if (decidedByOf(beat) === "session")
      return say("watching", "waiting", "Waiting for the session to end.");
    // The folder actually watched: the step's Work folder, known before
    // any first look; the Practice copy otherwise.
    if (beat.watches !== null)
      return say(
        "watching",
        "waiting-work",
        `Watching your work folder: ${beat.watches}.`,
      );
    return say("watching", "waiting", "Watching your Practice copy.");
  }
  if (beat.status === "already")
    return say("passed", "already", "Already done, so this step counts.");
  if (beat.status === "done")
    return say("passed", "done", "That step is done.");
  return say(
    "notYet",
    "fail",
    "Not yet. The lines below say what the check saw.",
  );
}

/** A line of the Check as the card shows it, before it is drawn. */
export interface BeatCheckLine {
  text: string;
  state: "waiting" | "pass" | "notYet" | "broken" | "pending";
  /** The Not yet words, in the page's words (InlineText). */
  fail?: string;
  /** The file a glob matched. */
  found?: string;
  /** What the passing look saw, shown as it is (monospace). */
  evidence?: string;
}

/** The words for a watched beat that names no "Done when" line. */
export const WATCH_FALLBACK = "What the step asks for";

/**
 * The card's Check lines. A checked beat shows its Check items: the Not yet
 * words under the first item not met, the evidence under the passed group. A
 * watched beat shows one line, its "Done when" words. The Learner's beats, a
 * session and a question show none.
 */
export function checkLines(beat: BeatView): BeatCheckLine[] {
  const decided = decidedByOf(beat);
  const running = beat.status === "checking";
  const broken = beat.status === "broken";
  const done = isDone(beat);
  if (decided === "check") {
    let failShown = false;
    const lines: BeatCheckLine[] = beat.verification.map((line) => {
      const state = running
        ? "waiting"
        : line.pending
          ? "pending"
          : line.pass
            ? "pass"
            : broken
              ? "broken"
              : "notYet";
      const out: BeatCheckLine = { text: line.text, state };
      if (state === "notYet" && !failShown && beat.fail !== null) {
        out.fail = beat.fail;
        failShown = true;
      }
      return out;
    });
    const lastPass = lines.findLastIndex((line) => line.state === "pass");
    const last = lines[lastPass];
    if (last && beat.evidence !== null) last.evidence = beat.evidence;
    return lines;
  }
  if (decided !== "watch") return [];
  const text =
    beat.lines.find((line) => line.doneWhen === true)?.text ?? WATCH_FALLBACK;
  if (done) {
    const line: BeatCheckLine = { text, state: "pass" };
    if (beat.found !== null) line.found = beat.found;
    if (beat.evidence !== null) line.evidence = beat.evidence;
    return [line];
  }
  if (broken) return [{ text, state: "broken" }];
  if (beat.status === "fail")
    return [
      {
        text,
        state: "notYet",
        ...(beat.fail !== null ? { fail: beat.fail } : {}),
      },
    ];
  return [{ text, state: "waiting" }];
}

/** A Tear down step: it puts things back after the Check. */
export function isTearDown(
  step: Pick<StepView | StepSummary, "part">,
): boolean {
  return step.part === "Tear down";
}

/** How a marked answer is drawn (Choice's marks). */
export type AnswerMark = "right" | "notYet" | "chosen" | "shown";

/**
 * The marks on a question's answers, from the snapshot: every wrong answer
 * tried (a decoy too) says Not yet, and the one picked is drawn by its
 * feedback: right, the answer shown, or a guess with no right answer
 * (a predict, or a choice that shows later beats). A "stuck" pick names no
 * option in the snapshot, so it marks none; its words still show.
 */
export function answerMarks(
  beat: BeatView,
): { id: string; state: AnswerMark }[] {
  const { picked, feedback } = beat.answer;
  const marks = beat.options.flatMap((option, i) =>
    (option.kind === "wrong" || option.kind === "decoy") && i !== picked
      ? [{ id: String(i), state: "notYet" as const }]
      : [],
  );
  if (picked === null) return marks;
  const state: AnswerMark =
    feedback === "right"
      ? "right"
      : feedback === "revealed"
        ? "shown"
        : feedback === "wrong"
          ? "notYet"
          : "chosen";
  return [...marks, { id: String(picked), state }];
}

/**
 * Show the answer is offered once a wrong pick has been tried on an ask
 * beat: a judged wrong pick means the beat has a right answer, which the
 * engine needs before it reveals one. A predict has none, and a typed
 * answer shows it on an empty send.
 */
export function revealable(beat: BeatView): boolean {
  return (
    beat.kind === "ask" && !isDone(beat) && beat.answer.feedback === "wrong"
  );
}
