// The names the contract's actions, events and snapshot share. Types only.

/** A Level of the course. */
export type LevelId = "beginner" | "intermediate" | "advanced";

/** A Help tier: Guided shows every command, Hinted hints, Challenge neither. */
export type HelpTier = "guided" | "hinted" | "challenge";

/** A Lesson's id in the course manifest, such as `b-1` or `i-capstone`. */
export type LessonId = string;

/** A step's id within its Lesson, such as `W1`, `Y2`, `C` or `R1`. */
export type StepId = string;

/**
 * What a Work folder is saved under: a Level with a Work folder
 * (`intermediate`, `advanced`), or a Lesson that runs in a new copy of the
 * template (`a-5`, `a-capstone`).
 */
export type FolderKey = string;

/**
 * The server process's random instance ID. It never contains `.`, so an
 * event ID splits at its last `.`.
 */
export type InstanceId = string;

/** A revision: an integer that grows with each change within one instance. */
export type Revision = number;

/**
 * A skill's Mastery: the help used the last time the Learner finished a step
 * on it (on their own, with hints, or with every command shown), and when,
 * in epoch milliseconds. Information, never a reward.
 */
export interface Mastery {
  used: "own" | "hints" | "commands";
  at: number;
}
