// What goes between the server and a tab ("Live delivery"): the action
// request and its response, the heartbeat and the pending milestones. Types
// only.
//
// The host keeps the last 256 events (its EVENT_LIMIT) for up to 15 minutes
// (its EVENT_KEEP_MS, 900000 ms) for a reconnect to replay.
import type { InstanceId, Revision } from "./common";
import type { QuestAction } from "./actions";
import type {
  CourseCompletedEvent,
  EventEnvelope,
  LessonCompletedEvent,
  LevelCompletedEvent,
} from "./events";
import type { Snapshot } from "./snapshot";

/**
 * An action, with the instance and revision the tab was showing when it was
 * sent: a revision is comparable only within its instance.
 */
export interface ActionRequest {
  action: QuestAction;
  instance: InstanceId;
  revision: Revision;
}

/**
 * The response to an action: the revision and snapshot after it. It is the
 * body both when the action applied and when it was refused because the
 * Learner's place (the Lesson, phase or step) changed since its revision, or
 * the revision was another instance's.
 */
export interface ActionResponse {
  revision: Revision;
  snapshot: Snapshot;
}

/** Sent every 15 seconds on the stream, so an idle stream stays open. */
export interface Heartbeat {
  /** The server's time, in epoch milliseconds. */
  serverTime: number;
  instance: InstanceId;
  revision: Revision;
}

/**
 * A pending milestone: a Lesson's first completion, a Level complete or the
 * course complete, as the event that marked it. It stays in the snapshot
 * until a tab shows it and sends `milestone.shown` with its ID, and lapses
 * when the Learner starts another Lesson.
 */
export type Milestone = EventEnvelope<
  LessonCompletedEvent | LevelCompletedEvent | CourseCompletedEvent
>;
