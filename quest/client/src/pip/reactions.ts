// The Reaction map: which engine events make Pip react, with which Reaction
// and how strongly. Pure: one revision's events and the context in, one
// Reaction or none out. Pip reacts only to what the engine already decided.
import type { EventEnvelope, EventId, QuestEvent } from "@quest/contract";
import type { PipReactionKind } from "../../pip/contract";

/** What Pip looks at during a Reaction; the page says where each one is. */
export type PipGazeTarget = "hint" | "tiers" | "work";

/** A Reaction an event earned, before the director decides how it plays. */
export interface Reaction {
  kind: PipReactionKind;
  /** 0..1. */
  intensity: number;
  /** Set only for Explaining and Curious. */
  gaze: PipGazeTarget | null;
  /** The event that earned it, whose ID the Reaction plays under. */
  eventId: EventId;
  eventType: QuestEvent["type"];
}

export interface ReactionContext {
  /** Whether a `work.changed` glance may play: at most one every 20 s. */
  glanceReady: boolean;
}

/** When several events share a revision, the first kind here wins. */
export const REACTION_RANK = [
  "celebration",
  "success",
  "retry",
  "explaining",
  "curious",
] as const satisfies readonly PipReactionKind[];

/**
 * The intensity of a row the Reaction map gives none: the Reaction's full
 * version. The map sets an intensity only where a Reaction must play softer
 * (Retry, the nod) or graded (Celebration).
 */
export const FULL = 1;

/** A nod: Success, or any Reaction repeated within 3 s, at its smallest. */
export const NOD = 0.2;

/**
 * The `work.changed` glance: Curious, softer than a full Curious, since it
 * only glances at the Work folder (the owner's decision, 2026-10-26).
 */
export const GLANCE = 0.4;

type Row = Omit<Reaction, "eventId" | "eventType">;

const row = (
  kind: PipReactionKind,
  intensity: number,
  gaze: PipGazeTarget | null = null,
): Row => ({ kind, intensity, gaze });

/** One event's row of the Reaction map, or null when it earns no Reaction. */
function rowFor(event: QuestEvent, context: ReactionContext): Row | null {
  switch (event.type) {
    // Thinking is a mode, not a Reaction: the director holds it from
    // check.started to the Check's result. check.progress changes nothing,
    // and check.ended, a run with no verdict to show, only ends Thinking.
    case "check.started":
    case "check.progress":
    case "check.ended":
      return null;
    // A step that already passed gets only a nod, so repeated Check clicks
    // are never rewarded.
    case "check.passed":
      return row("success", event.firstTime ? FULL : NOD);
    case "answer.right":
    case "warmup.recalled":
    case "step.completed":
      return row("success", FULL);
    // A brief surprise, then reassurance. A broken Check is not the
    // Learner's failure, so it plays softest.
    case "check.notYet":
      return row("retry", 0.5);
    case "answer.wrong":
      return row("retry", 0.4);
    case "warmup.missed":
    case "check.broken":
      return row("retry", 0.3);
    case "hint.shown":
    case "help.offered":
      return row("explaining", FULL, "hint");
    // The map places stepDown.reached "on the Step-down screen": that is
    // where the screen shows it, so the Reaction does not wait on the
    // browser's screen, which the snapshot before this event already set.
    case "stepDown.reached":
      return row("curious", FULL, "tiers");
    case "work.changed":
      return context.glanceReady ? row("curious", GLANCE, "work") : null;
    case "lesson.completed":
      if (!event.firstTime) return row("success", FULL);
      return row("celebration", event.capstone ? 0.85 : 0.7);
    case "level.completed":
      return row("celebration", 0.9);
    case "course.completed":
      return row("celebration", 1);
    // Its text says it.
    case "notice":
      return null;
  }
}

const rank = (kind: PipReactionKind): number => {
  const at = (REACTION_RANK as readonly PipReactionKind[]).indexOf(kind);
  // Greeting comes from the browser, never from an event, so it is unranked.
  return at === -1 ? REACTION_RANK.length : at;
};

/**
 * The one Reaction a revision's events earn: the highest-ranked kind, and
 * within it the strongest (so a Lesson, its Level and the course completing
 * together celebrate at the course's 1.0). Null when none earns one.
 */
export function reactionFor(
  events: readonly EventEnvelope[],
  context: ReactionContext,
): Reaction | null {
  let best: Reaction | null = null;
  for (const event of events) {
    const found = rowFor(event, context);
    if (found === null) continue;
    const candidate: Reaction = {
      ...found,
      eventId: event.id,
      eventType: event.type,
    };
    if (
      best === null ||
      rank(candidate.kind) < rank(best.kind) ||
      (candidate.kind === best.kind && candidate.intensity > best.intensity)
    ) {
      best = candidate;
    }
  }
  return best;
}
