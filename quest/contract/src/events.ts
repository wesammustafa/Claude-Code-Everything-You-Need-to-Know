// The events (the spec's catalogue, "Actions, events and the snapshot"):
// moments to react to once. The browser never infers a moment by comparing
// snapshots. Types only.
import type { HelpTier, LevelId, Revision } from "./common";

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

/**
 * The step's Check did not pass yet. `evidence` is the verification line it
 * is about: the Check's FAIL message, or the engine's line about a file or
 * git status. Never a path alone, and never a file's bytes.
 */
export interface CheckNotYetEvent {
  type: "check.notYet";
  evidence: string;
}

/** The Check itself could not run to a verdict: not the Learner's failure. */
export interface CheckBrokenEvent {
  type: "check.broken";
}

/**
 * A started Check ended with no verdict to show: its result was the first
 * look the step starts from, about another folder, about a file that has not
 * changed since the step opened, or left a slow item for Check again; or the
 * Learner left the step while it ran. Every `check.started` is followed by
 * exactly one of `check.passed`, `check.notYet`, `check.broken` or this.
 */
export interface CheckEndedEvent {
  type: "check.ended";
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
  | CheckEndedEvent
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
 * ID and a sequence number within it, from 1, so an ID never repeats, even
 * across restarts. It splits at its last `.`: the instance has none.
 */
export type EventId = string;

/** What every event carries besides its own fields. */
export interface EventHeader {
  id: EventId;
  /** The revision the event produced. */
  revision: Revision;
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
