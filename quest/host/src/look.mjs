// What the host reads off the engine's state on its own (ticket 209): the
// folder to watch, the evidence file a check guards, and whether the app
// opens with a check. The terminal passes its own (its translator's
// screens) until ticket 210 lifts these into the engine.
import {
  beatOf,
  contentOf,
  folderOf,
  onCard,
  stepOf,
  stepsOf,
} from "./engine.mjs";

// The folder the Learner works in now: the step on screen's, or, before
// its beat opens, the saved step's; else the lesson's.
export const workFolder = (s) =>
  s.phase === "playing" && contentOf(s)
    ? folderOf(
        s,
        s.lesson,
        s.beat
          ? stepOf(s)
          : (stepsOf(s).find((x) => x.id === s.progress[s.lesson].step) ??
              null),
      )
    : folderOf(s);

// The file whose change during a check makes it run again (guard 8): the
// beat on the card's, as the engine's own re-ask names it.
export const evidence = (s) =>
  onCard(s) ? (beatOf(s).evidence ?? null) : null;

// Whether the app opens with a look at the lesson's check: a Learner
// welcomed back to a lesson with a page that is not complete.
export const opensWithCheck = (s) =>
  s.welcomed && Boolean(contentOf(s)) && !s.progress[s.lesson].complete;
