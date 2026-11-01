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
  NoticeEvent,
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

/**
 * Why `folder.choose`'s path was turned down before the host saw it: no
 * such folder, longer than 1,024 characters once resolved, outside the
 * Learner's home folder, the Practice copy itself, a folder holding the
 * copy, or not the root of a git working tree.
 */
export type FolderRefusal =
  | "missing"
  | "too-long"
  | "outside-home"
  | "is-copy"
  | "contains-copy"
  | "not-repo-root";

/**
 * The body of a refused action other than a stale one (`409`, an
 * `ActionResponse`): `forbidden` (`403`, an untrusted request), `invalid`
 * (`400`, not an action), `folder` (`400`, with the reason), `too large`
 * (`413`), `busy` (`429`, the queue is full) and `starting` (`503`, no
 * snapshot yet).
 */
export type ActionError =
  | { error: "forbidden" | "invalid" | "too large" | "busy" | "starting" }
  | { error: "folder"; reason: FolderRefusal };

/** `GET /api/health`: the server is up, with this process's instance. */
export interface HealthResponse {
  ok: true;
  instance: InstanceId;
}

/** Sent every 15 seconds on the stream, so an idle stream stays open. */
export interface Heartbeat {
  /** The server's time, in epoch milliseconds. */
  serverTime: number;
  instance: InstanceId;
  revision: Revision;
}

/**
 * What `GET /api/events` sends, keyed by each message's SSE event name. Only
 * an `event` message carries an `id:`, the event's ID, for a reconnect's
 * `Last-Event-ID`; the stream sends `retry: 1000` once.
 */
export interface StreamMessages {
  snapshot: Snapshot;
  event: EventEnvelope;
  heartbeat: Heartbeat;
}

/**
 * A pending milestone: a Lesson's first completion, a Level complete, the
 * course complete, or the notice that the saved progress could not be read
 * (`unreadable`: it was moved aside; `unreadable-kept`: it could not be, and
 * nothing is saved), as the event that marked it. It stays in the snapshot
 * until a tab shows it and sends `milestone.shown` with its ID; a completion
 * lapses when the Learner starts another Lesson, a notice does not.
 */
export type Milestone = EventEnvelope<
  | LessonCompletedEvent
  | LevelCompletedEvent
  | CourseCompletedEvent
  | NoticeEvent
>;
