// The engine's own types (ticket 214): types and type imports only, so the
// import walks that read this file find no code in it.
import type {
  EngineAction,
  FolderKey,
  HelpTier,
  LessonId,
  LevelId,
  Mastery,
  StepId,
} from "@quest/contract";
import type {
  Bottom,
  CodeLine,
  LessonContent,
  Requirement,
} from "./content.ts";

// A Lesson on the course's path, as the manifest places it: its level and
// page, and where it runs when that is not its level's work folder.
export interface PathEntry {
  id: LessonId;
  level: LevelId;
  page: string;
  // A later level's lesson pinned to the practice copy (i-capstone).
  folder?: "copy";
  // A lesson that runs in a new copy of the template (a-5, a-capstone).
  newCopy?: true;
  // A lesson of a level that practises in a work folder.
  work?: true;
}

// A Lesson of the course the engine plays: its path entry, its page's
// title, time estimate and links, its Check items, and its parsed steps
// (null with no step file). The course loader gives every field; a test's
// course may leave out the page's.
export interface CourseEntry {
  id: LessonId;
  level: LevelId;
  page?: string;
  minutes?: string;
  folder?: "copy";
  newCopy?: true;
  work?: true;
  title?: string;
  url?: string;
  stuck?: string;
  items: string[];
  slow?: number[];
  content?: LessonContent | null;
  // The compiled course's fingerprints (ticket 213); none for a step file
  // read on its own.
  fingerprint?: string;
  legacyFingerprint?: string;
}

// ---- the engine's state (ticket 214) -------------------------------------------
// The help a finished step used: on the Learner's own, with hints, or with
// every command shown.
export type HelpUsed = Mastery["used"];

// A lesson's saved progress: its place, its ticks and answers, the help it
// gives, its fresh stamps, and (ticket 213) the fingerprint it was started
// under and the help each step used.
export interface LessonProgress {
  step: StepId | null;
  beat: number;
  done: StepId[];
  answers: Record<string, string>;
  levels: HelpTier[];
  lessHelp: boolean;
  moreHelpAt: StepId | null;
  easedSteps: Record<StepId, boolean>;
  complete: boolean;
  warm: StepId[];
  recalled: StepId[];
  stamps: Record<string, string>;
  bottomAt: StepId | null;
  fingerprint?: string;
  help?: Record<StepId, Mastery>;
}

// What initialState reads from a save: any part may be missing.
export interface SavedProgress {
  lessons?: Record<LessonId, Partial<LessonProgress> | undefined>;
  folders?: Record<FolderKey, string>;
  welcomed?: boolean;
  eased?: string[];
  missed?: string[];
}

// What the host knows about the Learner's machine and copy.
export interface Facts {
  root: string;
  name?: string | null;
  linux?: boolean;
  win32?: boolean;
  codespace?: boolean;
  practiceDir?: boolean;
  saveKept?: boolean;
}

// A beat's status: waiting for work, a run going ("opening"), done (or done
// already when the beat opened), a FAIL, or a Check that could not run.
export type BeatStatus =
  "waiting" | "opening" | "done" | "already" | "fail" | "broken";

// A Check item as a run reports it.
export interface CheckItem {
  index: number;
  text: string;
  pass: boolean;
  hint: string;
  slow?: boolean;
  local?: boolean;
}

// What a beat's FAIL is about: a Check item's message, a file's or git's
// not-yet line, or the paths a git-clean beat still finds.
export type Failing =
  | { item: string; hint: string; paths?: undefined }
  | { item?: undefined; hint: string | undefined; paths?: undefined };
export interface Dirty {
  paths: readonly string[];
  hint?: undefined;
  item?: undefined;
}

// What an answer or a pick said.
export interface Feedback {
  kind: "right" | "wrong" | "option" | "other" | "stuck" | "revealed";
  because?: string | undefined;
  point?: string | undefined;
  hint?: string | undefined;
}

// The beat on screen, in memory.
export interface BeatState {
  status: BeatStatus;
  rung: number;
  confirm: boolean;
  wrongs: number[];
  answer: { index: number; kind: string } | null;
  revealed: boolean;
  typedWrong: number;
  feedback: Feedback | null;
  idle: boolean;
  unlocked: boolean;
  explicit: boolean;
  ended: boolean;
  opened: number;
  eased: boolean;
  run: { asked: number } | null;
  look: string | null;
  touched: boolean;
  whileRuns?: { id: StepId; answer: number | null };
  codespace?: boolean;
  // The first answer the beat started from: undefined until there is one.
  baseline?: string | null | undefined;
  slowWait?: boolean;
  fail?: Failing | Dirty | null | undefined;
  error?: string | null;
  same?: boolean;
  sameShown?: boolean;
  stale?: boolean;
  passed?: CheckItem[] | undefined;
  evidence?: string | null;
  found?: string | null;
  last?: { hint: string | undefined; stamp: string | null } | null;
  asked?: number;
  running?: { n: number; m: number } | null;
  before?: BeatStatus | undefined;
}

// What the host found at a folder.
export interface ProbedFolder {
  missing: boolean;
  git: boolean;
  gitBroken: boolean | null;
  practice: boolean;
}

// The engine's state: the course, the Learner's place and progress, and
// what the host found, in memory.
export interface EngineState {
  course: CourseEntry[];
  facts: Facts;
  progress: Record<LessonId, LessonProgress>;
  now: number;
  eased: string[];
  missed: string[];
  missedNow: string[];
  answeredNow: string[];
  whileShown: string[];
  welcomed: boolean;
  lesson: LessonId;
  phase: "overview" | "playing" | "step-down" | "complete";
  pos: { step: number; beat: number };
  beat: BeatState | null;
  levelTo?: HelpTier;
  levelFrom?: HelpTier | null;
  checks: Record<
    LessonId,
    { items?: CheckItem[]; evidence?: string | null; error: string | null }
  >;
  git: { paths: readonly string[]; error: string | null } | null;
  session: number;
  lastActivity: number;
  asks: number;
  folders: Record<FolderKey, string>;
  probes: Record<string, ProbedFolder>;
  folderAsk: {
    key: FolderKey;
    missing: string | null;
    isCopy: boolean;
    asked: number;
  } | null;
  folderAnswered: LessonId | null;
  commands: Record<string, boolean>;
  prereqs: Record<
    LessonId,
    {
      dir: string;
      met: Record<
        number,
        { pass: boolean | null; hint: string | undefined; asked: number }
      >;
    }
  >;
  prereqAsks: number;
  firstCompletion: LessonId | null;
  epoch: number;
  // The help each step used in this play of its lesson: "<lesson> <step>".
  stepHelp: Record<string, HelpUsed>;
  changed: LessonId[];
}

// ---- inputs and effects ----------------------------------------------------------
// What the host sends besides the Learner's actions: the results of the
// effects, clock ticks and what it sees. Every result says the folder it is
// about, and r's number when r asked for it.
interface ResultFields {
  asked?: number;
  dir?: string | null;
  lesson?: LessonId;
}
export type HostInput = ResultFields &
  (
    | {
        type: "check";
        lesson: LessonId;
        items: CheckItem[];
        read?: Buffer | null;
        path?: string | null;
        found?: string | null;
        stamp?: string | null;
      }
    | { type: "check-error"; lesson: LessonId; message: string }
    | {
        type: "file";
        path: string;
        read: Buffer | null;
        found?: string | null;
        stamp?: string | null;
      }
    | {
        type: "git";
        paths: readonly string[];
        staged?: readonly string[];
        files?: boolean;
        head?: string | null;
      }
    | { type: "git-error"; message: string }
    | {
        type: "probe";
        name: string;
        args: string[];
        pass: boolean;
        hint?: string;
        evidence?: string | null;
        state?: string | null;
      }
    | { type: "probe-error"; message: string }
    | { type: "stamp"; key: string; stamp?: string | null; git?: string }
    | {
        type: "run-start";
        run: "check" | "git" | "probe";
        items?: number[] | null;
        name?: string;
      }
    | { type: "running"; n: number; m: number; items?: number[] | null }
    | { type: "tick" }
    | { type: "facts"; facts: Partial<Facts> }
    | { type: "commands"; found: Record<string, boolean> }
    | {
        type: "prereq";
        lesson: LessonId;
        at: number;
        dir: string;
        read?: Buffer | null;
        pass?: boolean | null;
        hint?: string;
      }
    | { type: "activity" }
    | { type: "notice"; kind: string; message?: string }
    | {
        type: "probed";
        path: string;
        missing: boolean;
        git: boolean;
        gitBroken?: boolean | null;
        practice: boolean;
        key?: FolderKey | null;
      }
    // A result about another folder than its lesson's, as apply hands it on.
    | { type: "stale" }
  );

// The host input of one type.
export type HostInputOf<K extends HostInput["type"]> = Extract<
  HostInput,
  { type: K }
>;

// One input: a Learner action or a host input, with the clocks the host
// stamps on it.
export type EngineInput = (EngineAction | HostInput) & {
  now?: number;
  epoch?: number;
};

// What the engine asks the host to do.
export type Effect =
  | { type: "save" }
  | {
      type: "check";
      lesson: LessonId;
      items: number[] | null;
      evidence: string | null;
      dir: string | null;
      slow?: true;
      asked?: number;
    }
  | { type: "file"; path: string; dir: string | null; asked?: number }
  | {
      type: "git";
      dir: string | null;
      files?: true;
      head?: true;
      asked?: number;
    }
  | {
      type: "probe";
      name: string;
      args: string[];
      dir: string | null;
      asked?: number;
    }
  | {
      type: "stamp";
      key: string;
      dir: string | null;
      path?: string | undefined;
      git?: "head" | "status";
      probe?: { name: string; args: string[] };
    }
  | { type: "folder"; key: FolderKey; text: string; asked: number }
  | {
      type: "prereqs";
      lesson: LessonId;
      dir: string;
      requires: Requirement[];
      asked?: number;
    }
  | { type: "commands"; names: string[] };

// What the beat on screen watches, in the folder it runs in.
export interface Watch {
  dir: string | null;
  check?: { lesson: LessonId; items: number[] | null };
  file?: string;
  git?: true;
  files?: true;
  head?: true;
  probe?: { name: string; args: string[] };
}

// Each Learner action's handler: false where its guard fails and it
// changes nothing.
export type ActionHandlers = {
  [K in EngineAction["type"]]: (
    s: EngineState,
    action: Extract<EngineAction, { type: K }>,
    effects: Effect[],
  ) => boolean;
};

// The state with a beat on the card (onCard).
export type CardState = EngineState & { beat: BeatState };

// A rung of the hint ladder: a question that narrows the FAIL, the check's
// message, a hint, or the bottom lines with the exact commands.
export type HintRung =
  | { kind: "ask" | "check" | "quote"; text: string }
  | { kind: "bottom"; lines: (Bottom | CodeLine)[] };

// What a result says, as the beat's verdict reads it: the file it is
// about, that file's state, the evidence a pass shows, the file a glob
// matched and the Check items.
export interface Outcome {
  path?: string | null | undefined;
  stamp?: string | null | undefined;
  evidence?: string | null | undefined;
  found?: string | null | undefined;
  items?: CheckItem[] | undefined;
}
