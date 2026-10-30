// The snapshot: everything a tab shows, whole, never a patch ("Actions,
// events and the snapshot"). The engine's project(state) builds all but the
// header, which the host adds. Types only.
//
// Left out on purpose: saved stamps, earlier answers other than the one on
// screen, raw check output beyond the verification lines, and any path but
// the Practice copy and the Learner's Work folders. Words on screen are the
// client's, but for the course's own text and the verification lines.
import type {
  FolderKey,
  HelpTier,
  InstanceId,
  LessonId,
  LevelId,
  Mastery,
  Revision,
  StepId,
} from "./common";
import type { Milestone } from "./live";

/** The whole snapshot. */
export interface Snapshot {
  /** The server process's instance: a new one replaces all a tab holds. */
  instance: InstanceId;
  /** The revision within the instance: a tab applies only a higher one. */
  revision: Revision;
  /** The milestones no tab has shown yet, oldest first. */
  milestones: Milestone[];
  /** The course: its Levels and Lessons, and where the Learner goes next. */
  course: CourseView;
  /** What the app knows of the Learner. */
  learner: LearnerView;
  /** The active Lesson, by its phase. Never null. */
  lesson: ActiveLesson;
}

// ---- the course ---------------------------------------------------------------

export interface CourseView {
  /** The Levels in course order. */
  levels: LevelView[];
  /** The next Lesson the Learner can finish, or null when none is left. */
  next: LessonId | null;
}

export interface LevelView {
  id: LevelId;
  /** Every Lesson of the Level, its capstone too, is complete. */
  complete: boolean;
  /** Its Lessons in course order, the capstone last. */
  lessons: LessonSummary[];
}

export interface LessonSummary {
  id: LessonId;
  /** Its number within its Level, from 1. */
  number: number;
  /** The Lesson's title. */
  title: string;
  /** How long it takes, in the page's words. */
  minutes: string;
  /** The Guide page it teaches from, as a repository path. */
  page: string;
  /** The Level's capstone. */
  capstone: boolean;
  /** Completed once: a replay keeps it complete and keeps its Badge. */
  complete: boolean;
  /** Its Badge's name, or null for a Lesson with none. */
  badge: string | null;
  /** The folder it runs in, and whether that folder is set. */
  folder: FolderNeed;
  /** Its Check passed with Tear down steps still to do. */
  tearDownLeft: boolean;
}

/**
 * Where a Lesson runs: the Practice copy (Beginner), its Level's Work folder,
 * a new copy of the template saved under its own id, or the Practice copy
 * whatever the Level's Work folder is.
 */
export type FolderNeed =
  | { kind: "copy" }
  | { kind: "work"; level: LevelId; set: boolean }
  | { kind: "new-copy"; lesson: LessonId; set: boolean }
  | { kind: "pinned" };

// ---- the Learner --------------------------------------------------------------

export interface LearnerView {
  /** The welcome was read. */
  welcomed: boolean;
  /** The first name git gave, or null. */
  name: string | null;
  /** The Practice copy's folder. */
  practiceCopy: string;
  /** The Work folders the Learner chose, by key. */
  workFolders: { key: FolderKey; path: string }[];
  /** The skills card: each entry the Learner finished a step on. */
  card: { skill: string; show: string; does: string; lesson: LessonId }[];
  /** Each skill's Mastery; empty until saved progress keeps it (213). */
  mastery: Record<string, Mastery>;
  /** The app runs on native Windows: commands are its variants. */
  windows: boolean;
}

// ---- the active Lesson --------------------------------------------------------

/** What every phase of the active Lesson carries. */
interface LessonHead {
  id: LessonId;
  title: string;
  level: LevelId;
  capstone: boolean;
}

export type ActiveLesson =
  OverviewLesson | PlayingLesson | StepDownLesson | CompleteLesson;

/** A step of the help staircase: its part and its Help tier. */
export interface StairStep {
  part: string;
  tier: HelpTier;
}

/** The overview, before the Lesson starts. */
export interface OverviewLesson extends LessonHead {
  phase: "overview";
  /** The page's intro, or null for a Lesson with no step file. */
  intro: {
    /** What the Lesson teaches the Learner to do. */
    can: string[];
    /** The `can` line the Lesson builds to. */
    payoff: string | null;
    /** Why the Lesson matters. */
    why: string | null;
    /** One source to read next, as Markdown. */
    read: string | null;
  } | null;
  /** The help the play starts with: as planned, and with less help. */
  staircase: {
    planned: StairStep[];
    /** Null where less help changes no step. */
    less: StairStep[] | null;
  };
  /** What the overview has to say before the Learner starts. */
  notes: OverviewNote[];
  /** Where this Lesson's Work folder is, while the overview asks. */
  folderQuestion: FolderQuestion | null;
  /** The start options, or null while the folder question waits. */
  start: {
    /** Start as planned. */
    planned: boolean;
    /** Start with less help: offered where it changes a step. */
    less: boolean;
    /** The Lesson a failed prerequisite offers to do first, or null. */
    first: LessonId | null;
  } | null;
  /** The Lesson has a saved place to go back to. */
  resumable: boolean;
}

export type OverviewNote =
  /** A You need line whose commands no PATH folder has. */
  | { kind: "need"; quote: string; missing: string[] }
  /** The page's line for the Learner's own repository. */
  | { kind: "need-repo"; text: string }
  /** A prerequisite that failed: its line, and its Lesson where doing it helps. */
  | { kind: "unmet"; line: string; lesson: LessonId | null }
  /** What is wrong with the Work folder: the client words it. */
  | {
      kind: "folder-problem";
      problem: "missing" | "gitBroken" | "notGit" | "noPractice";
    }
  /** The page's note for native Windows. */
  | { kind: "win-note"; text: string }
  /** The Lesson's steps changed since it was started (213 emits it). */
  | { kind: "changed" };

export interface FolderQuestion {
  key: FolderKey;
  /** A Level's Work folder, or a Lesson's new copy of the template. */
  asks: "work" | "new-copy";
  /** The folder saved for it, or null. */
  current: string | null;
  /** Why the last answer was turned down: nothing there, or this copy. */
  problem: "missing" | "is-copy" | null;
  /** The question waits for an answer, or one is being edited. */
  open: boolean;
  /** The host is looking at the folder given. */
  checking: boolean;
}

/** A step in the playing Lesson's list. */
export interface StepSummary {
  id: StepId;
  part: string;
  title: string;
  tier: HelpTier;
  state: "done" | "current" | "todo";
  optional: boolean;
}

/** Lesson play. */
export interface PlayingLesson extends LessonHead {
  phase: "playing";
  /** Every step in play order, warm-ups first. */
  steps: StepSummary[];
  /** The step on screen; null while a resume waits with no beat open. */
  step: StepView | null;
  /** The beat on screen; null while a resume waits with no beat open. */
  beat: BeatView | null;
  /** The hints shown so far, and whether another is there. */
  hints: HintsView;
  /** Where the Learner may go besides on. */
  offers: {
    /** The earlier step a back line sends the Learner to, with its why. */
    back: { to: StepId; title: string; why: string } | null;
    /** An optional step: when to skip it, in the page's words. */
    skip: { when: string } | null;
  };
  /** The question a long wait offers, never scored, or null. */
  waitQuestion: {
    prompt: string;
    options: { text: string; kind?: "right" | "wrong" }[];
    /** The index picked, or null before. */
    answered: number | null;
    /** The page's words about the pick, once answered. */
    words: string | null;
  } | null;
}

export interface StepView {
  /** Its place in play order, from 0. */
  index: number;
  id: StepId;
  part: string;
  title: string;
  /** The Help tier the Learner meets. */
  tier: HelpTier;
  /** The tier the course plans for it. */
  authoredTier: HelpTier;
  /** Where its work happens, or null where it names nowhere. */
  where: {
    kind: "terminal" | "claude" | "claude-2" | "shell" | "editor" | "browser";
    /** The terminal's number where the page numbers them, else null. */
    terminal: number | null;
    /** The folder it runs in, where the Lesson has a Work folder; else null. */
    folder: string | null;
  } | null;
  /** The tier of a step harder on its own, said on its card; else null. */
  note: HelpTier | null;
  /** The Learner finished a step on this skill before (every skill, in a capstone). */
  doneBefore: boolean;
  /** An ease landed here: one tier more help than planned. */
  extraHelp: boolean;
  /** A warm-up: the Lesson it recalls, and whether to explain warm-ups. */
  warmup: { from: string; explainer: boolean } | null;
}

/** A line of the beat, in the page's words or the app's. */
export interface BeatLine {
  kind: "say" | "goal" | "do" | "run" | "expect" | "note" | "rule" | "after";
  /** For `run`, the command for this platform with its paths filled in. */
  text: string;
  /** A `run` line the app watched the Learner run. */
  watched?: boolean;
  /** A "Done when" line, which an evidence line replaces once done. */
  doneWhen?: boolean;
}

/** A code block the beat explains: the window it shows of the block. */
export interface CodeView {
  /** Each shown line with its number in the whole block. */
  lines: { n: number; text: string }[];
  /** The line the beat explains. */
  point: number | null;
  /** The whole block, for Copy. */
  copy: string;
}

export interface BeatView {
  /** Its place in the step, from 0. */
  index: number;
  kind: "do" | "predict" | "ask" | "type" | "self";
  /** The step's last beat that shows. */
  last: boolean;
  /** Its lines; empty under a tier that keeps its commands for the hints. */
  lines: BeatLine[];
  /** Its code block, or null (under such a tier too). */
  code: CodeView | null;
  /** Its commands wait in the hints: the tier gives less help than planned. */
  commandsInHints: boolean;
  /** The question it asks, or null. */
  ask: string | null;
  /** What the Learner does and then says is done, on a self beat. */
  self: string | null;
  /** The label of the button that says the session ended, or null. */
  doneLabel: string | null;
  /** A long wait: its words, or null for the app's own. Null when none. */
  wait: { text: string | null } | null;
  /** Why it matters: the line on the card at Guided, and all its reasons. */
  why: { onCard: string | null; all: string[] };
  /** The page's note for native Windows, on Windows only. */
  winNote: string | null;
  /** In a Codespace the step is already done: the page's words. */
  codespace: string | null;
  /** The options; `kind` and `because` only once answered or revealed. */
  options: {
    text: string;
    kind?: "right" | "wrong" | "decoy" | "option" | "stuck" | "other";
    because?: string;
  }[];
  answer: {
    /** The option picked, or the right one once revealed. */
    picked: number | null;
    feedback:
      "right" | "wrong" | "revealed" | "stuck" | "option" | "other" | null;
    /** The page's words for the feedback, or null. */
    because: string | null;
    /** What to look for after a wrong pick, or null. */
    point: string | null;
    /** The words after the answer, once answered. */
    reveal: string | null;
    /** The earlier guess this question recalls, or null. */
    recall: string | null;
  };
  status: "waiting" | "checking" | "fail" | "done" | "already" | "broken";
  /** How far a running Check has got, or null. */
  running: { n: number; m: number } | null;
  /** While checking, the watched path, relative to its folder, or null. */
  checking: string | null;
  /** The Check items of the beat's last result. */
  verification: { text: string; pass: boolean }[];
  /** What the passing look saw: what a file holds, or what changed. */
  evidence: string | null;
  /** The file a glob matched, relative to its folder, or null. */
  found: string | null;
  /** The Not yet line, or null. */
  fail: string | null;
  /** Why the Check could not run, or null. */
  broken: "timeout" | "output" | "crashed" | null;
  /** The Check said the same after a redo: the cause is likely earlier. */
  same: boolean;
  /** Everything passes but a slow item, which waits for Check again. */
  slowWait: boolean;
  /** The file has not changed since the step opened. */
  stale: boolean;
}

/** A hint rung shown: a question, the Check's message, the page's words, or the exact command. */
export type HintView =
  | { kind: "ask" | "check" | "quote"; text: string }
  | {
      kind: "exact";
      commands: {
        /** The page's words that frame the command, or null. */
        leadIn: string | null;
        /** The command for this platform, its paths filled in. */
        text: string;
        code: CodeView | null;
      }[];
    };

/** The beat's hints. The offer of one to a stuck Learner is the browser's own rule (client/src/pip/help.ts). */
export interface HintsView {
  shown: HintView[];
  /** Another hint can open now. */
  available: boolean;
  /** At Challenge before a first try: the try it waits for. */
  unavailable: "run-check" | "pick-answer" | null;
  /** The question before the exact command is up. */
  confirmExact: boolean;
}

/** A Step-down: the next step gives less help. */
export interface StepDownLesson extends LessonHead {
  phase: "step-down";
  from: HelpTier;
  to: HelpTier;
  /** The steps from this one on, counted by tier. */
  toCome: { tier: HelpTier; count: number }[];
  /** More help would give a step more help (never at the Check). */
  moreHelp: boolean;
}

/** Lesson complete. */
export interface CompleteLesson extends LessonHead {
  phase: "complete";
  /** The skills the Lesson practised, each with its Mastery or null. */
  practised: { skill: string; mastery: Mastery | null }[];
  badge: string | null;
  /** This completion is the Lesson's first. */
  firstTime: boolean;
  /** The Check's items as its passing run found them. */
  checkSummary: { text: string; pass: boolean }[];
  /** The help used, step by step, warm-ups aside. */
  staircase: StairStep[];
  /** A capstone done without the exact command. */
  handover: boolean;
  /** A capstone invites questions about its Level. */
  invitation: boolean;
  /** The next Lesson, or null for the map. */
  next: { id: LessonId; title: string; notchHarder: boolean } | null;
}
