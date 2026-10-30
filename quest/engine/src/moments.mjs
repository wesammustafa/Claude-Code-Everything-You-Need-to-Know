// The moments one input marks (ticket 212), each an event for the browser
// to react to once.
// Pure: it compares the state before an input with the state after it, with
// the input the engine handled (the input, `stale`, or null for an action
// whose guard failed). The names and fields are the contract's events
// (quest/contract/src/events.ts).
import { GIT, READS } from "./content.ts";
import { cleanLine } from "./status.ts";
import {
  beatOf,
  contentOf,
  isDone,
  isLastBeat,
  levelLessons,
  levelsOf,
  stepOf,
  watching,
} from "./engine.mjs";

// Every event type, in the contract's order.
export const EVENT_TYPES = Object.freeze([
  "check.started",
  "check.progress",
  "check.passed",
  "check.notYet",
  "check.broken",
  "check.ended",
  "answer.right",
  "answer.wrong",
  "hint.shown",
  "warmup.recalled",
  "warmup.missed",
  "step.completed",
  "stepDown.reached",
  "lesson.completed",
  "level.completed",
  "course.completed",
  "work.changed",
  "help.offered",
  "notice",
]);

// The beats a result passes: a check, a file the app reads, git status or a
// probe. A question or a self beat turns done by an answer or a click.
const CHECKED = new Set(["check", ...READS, ...GIT, "probe"]);

// The same beat on screen before and after: the same lesson, step and beat.
const sameBeat = (prev, next) =>
  Boolean(prev.beat && next.beat) &&
  prev.phase === "playing" &&
  next.phase === "playing" &&
  prev.lesson === next.lesson &&
  prev.pos.step === next.pos.step &&
  prev.pos.beat === next.pos.beat &&
  stepOf(prev).id === stepOf(next).id;

const allComplete = (s, lessons) =>
  lessons.length > 0 && lessons.every((l) => s.progress[l.id].complete);

// The Not yet line a FAIL is about (the contract's `evidence`): the check's
// message, or the engine's line about a file or git status.
const notYetLine = (s) =>
  s.beat.fail?.hint ?? cleanLine(beatOf(s).verify, s.beat.fail?.paths ?? []);

/** The events `handled` marked, from `prev` to `next`, in order. */
export function momentsOf(prev, next, handled) {
  const events = [];
  const type = handled?.type ?? null;
  const same = sameBeat(prev, next);
  const was = prev.beat;
  const st = next.beat;
  const turned = same && !isDone(was) && isDone(st);
  const checked = same && CHECKED.has(beatOf(next).verify.kind);
  const warmup = same && stepOf(next).part === "Warm-up";
  const stepId = same ? stepOf(next).id : null;

  // 1-2. A run the card says "Checking" for starts, and its items count.
  if (same && st.run && !was.run) events.push({ type: "check.started" });
  if (same && st.run && st.running && !sameRunning(was.running, st.running))
    events.push({
      type: "check.progress",
      n: st.running.n,
      m: st.running.m,
    });

  // 3-5. What the beat's Check came to: a pass (replays nod), a Not yet,
  // or a Check that could not run.
  let verdict = false;
  if (turned && checked) {
    events.push({
      type: "check.passed",
      firstTime: !prev.progress[prev.lesson].done.includes(stepId),
    });
    verdict = true;
  } else if (
    checked &&
    st.status === "fail" &&
    (was.status !== "fail" ||
      JSON.stringify(was.fail) !== JSON.stringify(st.fail))
  ) {
    events.push({ type: "check.notYet", evidence: notYetLine(next) });
    verdict = true;
  } else if (checked && st.status === "broken" && was.status !== "broken") {
    events.push({ type: "check.broken" });
    verdict = true;
  }
  // 6. A started run that ended with none of those: its result was the
  // first look, stale, about another folder, or left a slow item for r; or
  // the Learner left the beat while it ran.
  if (was?.run && !(same && st.run) && !verdict)
    events.push({ type: "check.ended" });

  // 7. An answer, right or wrong; on a warm-up, recalled or missed. A
  // guess, a choice, "stuck" and a shown answer are neither, but a shown
  // warm-up answer is missed.
  if (same && (type === "answer.pick" || type === "answer.type")) {
    const right =
      st.feedback?.kind === "right" && was.feedback?.kind !== "right";
    const wrong =
      st.wrongs.length > was.wrongs.length || st.typedWrong > was.typedWrong;
    if (right)
      events.push({ type: warmup ? "warmup.recalled" : "answer.right" });
    else if (wrong)
      events.push({ type: warmup ? "warmup.missed" : "answer.wrong" });
  }
  if (same && warmup && type === "answer.reveal")
    events.push({ type: "warmup.missed" });

  // 8. A hint rung opened, never the question before the exact command.
  if (
    same &&
    (type === "hint.next" || type === "hint.takeExact") &&
    st.rung > was.rung
  )
    events.push({ type: "hint.shown", rung: st.rung + 1 });

  // 9. The step's last beat done, by any route but going on or skipping:
  // a pass, an answer, a guess, a shown answer, or the Learner's own click.
  if (
    (turned && isLastBeat(next)) ||
    (type === "step.markDone" && isLastBeat(prev))
  )
    events.push({ type: "step.completed" });

  // 10. A Step-down.
  if (prev.phase !== "step-down" && next.phase === "step-down")
    events.push({
      type: "stepDown.reached",
      from: next.levelFrom,
      to: next.levelTo,
    });

  // 11-13. The Lesson's end, and its Level's and the course's.
  if (
    next.phase === "complete" &&
    (prev.phase !== "complete" || prev.lesson !== next.lesson)
  ) {
    const l = next.lesson;
    const badge = contentOf(next, l)?.badge;
    events.push({
      type: "lesson.completed",
      ...(badge ? { badge } : {}),
      capstone: l.endsWith("capstone"),
      firstTime: !prev.progress[l].complete,
    });
  }
  for (const level of levelsOf(next)) {
    const lessons = levelLessons(next, level);
    if (allComplete(next, lessons) && !allComplete(prev, lessons))
      events.push({ type: "level.completed", level });
  }
  if (allComplete(next, next.course) && !allComplete(prev, prev.course))
    events.push({ type: "course.completed" });

  // 14. The Learner's work changed: a file change while something is
  // watched, or a look that differs from the last one with no file change
  // said since (the look the change brings is the same change). Never while
  // a run goes (Pip thinks then), and never on the look that passes the step.
  const looked =
    same &&
    !was.touched &&
    was.look !== null &&
    st.look !== null &&
    was.look !== undefined &&
    st.look !== undefined &&
    was.look !== st.look;
  const active = type === "activity" && watching(next) !== null;
  if (
    (looked || active) &&
    !st?.run &&
    !was?.run &&
    !events.some((e) => e.type === "check.passed")
  )
    events.push({ type: "work.changed" });

  // 15. Something the Learner should read.
  if (type === "notice")
    events.push({ type: "notice", kind: String(handled.kind) });
  return events;
}

const sameRunning = (a, b) => a?.n === b?.n && a?.m === b?.m;
