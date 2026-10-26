// The types the engine, host, server and client share. Types only: the
// browser imports this package and never any engine or host code.
//
// The events are the spec's catalogue ("Actions, events and the snapshot"):
// moments to react to once. The browser never infers a moment by comparing
// snapshots. Later tickets add the actions and the snapshot beside them.

/** A Level of the course. */
export type LevelId = "beginner" | "intermediate" | "advanced";

/** A Help tier: Guided shows every command, Hinted hints, Challenge neither. */
export type HelpTier = "guided" | "hinted" | "challenge";

/** A Check started running on the active step. */
export interface CheckStartedEvent {
  type: "check.started";
}

/** A running Check finished item `n` of `m`. */
export interface CheckProgressEvent {
  type: "check.progress";
  n: number;
  m: number;
}

/** The step's Check passed; `firstTime` is false when the step had already passed. */
export interface CheckPassedEvent {
  type: "check.passed";
  firstTime: boolean;
}

/** The step's Check did not pass yet; `evidence` is the line it is about. */
export interface CheckNotYetEvent {
  type: "check.notYet";
  evidence: string;
}

/** The Check itself could not run to a verdict: not the Learner's failure. */
export interface CheckBrokenEvent {
  type: "check.broken";
}

export interface AnswerRightEvent {
  type: "answer.right";
}

export interface AnswerWrongEvent {
  type: "answer.wrong";
}

/** A hint was shown: `rung` is its place on the hint ladder, from 1. */
export interface HintShownEvent {
  type: "hint.shown";
  rung: number;
}

export interface WarmupRecalledEvent {
  type: "warmup.recalled";
}

export interface WarmupMissedEvent {
  type: "warmup.missed";
}

export interface StepCompletedEvent {
  type: "step.completed";
}

/** The Learner reached a Step-down, from one Help tier to one with less help. */
export interface StepDownReachedEvent {
  type: "stepDown.reached";
  from: HelpTier;
  to: HelpTier;
}

/**
 * A Lesson completed. `badge` is its Badge, when it has one; `firstTime` is
 * false on a replay, which keeps the Badge and never awards it again.
 */
export interface LessonCompletedEvent {
  type: "lesson.completed";
  badge?: string;
  capstone: boolean;
  firstTime: boolean;
}

/** Every Lesson of a Level and its capstone are complete. */
export interface LevelCompletedEvent {
  type: "level.completed";
  level: LevelId;
}

/** All three Levels are complete. */
export interface CourseCompletedEvent {
  type: "course.completed";
}

/** The engine saw the Learner's work change in the folder it watches. */
export interface WorkChangedEvent {
  type: "work.changed";
}

/** The engine offers more help on the active step. */
export interface HelpOfferedEvent {
  type: "help.offered";
}

/** Something the Learner should read; its text says it. */
export interface NoticeEvent {
  type: "notice";
  kind: string;
}

/** Every event the engine emits. */
export type QuestEvent =
  | CheckStartedEvent
  | CheckProgressEvent
  | CheckPassedEvent
  | CheckNotYetEvent
  | CheckBrokenEvent
  | AnswerRightEvent
  | AnswerWrongEvent
  | HintShownEvent
  | WarmupRecalledEvent
  | WarmupMissedEvent
  | StepCompletedEvent
  | StepDownReachedEvent
  | LessonCompletedEvent
  | LevelCompletedEvent
  | CourseCompletedEvent
  | WorkChangedEvent
  | HelpOfferedEvent
  | NoticeEvent;

export type QuestEventType = QuestEvent["type"];

/**
 * An event ID, `<instance>.<sequence>`: the server process's random instance
 * ID and a sequence number within it, so an ID never repeats, even across
 * restarts.
 */
export type EventId = string;

/** What every event carries besides its own fields. */
export interface EventHeader {
  id: EventId;
  /** The revision the event produced. */
  revision: number;
  /** The server's time when the event happened, in epoch milliseconds. */
  serverTime: number;
}

/**
 * The event envelope: the header and the event's own fields, side by side.
 * Narrow it by `type`.
 */
export type EventEnvelope<E extends QuestEvent = QuestEvent> = E extends unknown
  ? EventHeader & E
  : never;
