// The lesson engine's package entry (ticket 210): what the host and the
// snapshot read. The step-file parser is "./content" and the course loader
// "./course".

// The interface: one input in, the state, effects and events out; the
// snapshot of a state (ticket 212), and the lesson a reduce starts playing.
export {
  ACTION_TYPES,
  EFFECT_TYPES,
  EVENT_TYPES,
  HELP_USED,
  IDLE_MS,
  initialState,
  reduce,
} from "./engine.ts";
export { project, startedLesson } from "./project.ts";

// What the host reads off the state: what to watch, what an overview asks
// about, where the Learner is and works, and the evidence a check guards.
export {
  beatOf,
  contentOf,
  evidence,
  folderOf,
  introAsks,
  onCard,
  opensWithCheck,
  stepOf,
  stepsOf,
  watching,
  workFolder,
} from "./engine.ts";

// The verification helpers the host's adapters share: a file's stamp and
// whether it only grew, and git status's listing and stamp.
export { grewFrom, stampFor } from "./holds.ts";
export { isStaged, listing, statusStamp } from "./status.ts";

// The selectors project(state) builds the snapshot from (project.ts).
export {
  answerKey,
  answersGit,
  asStarted,
  asksFolder,
  asksHere,
  authoredTier,
  backOffered,
  backTo,
  beatShown,
  cardOf,
  doneBefore,
  easeLands,
  folderKey,
  folderOptions,
  folderProblem,
  hidesRuns,
  hintAvailable,
  hintStatus,
  introNotes,
  introOptions,
  isDone,
  isLastBeat,
  lessonNumber,
  lessonOf,
  levelFolder,
  levelKey,
  levelLessons,
  levelOf,
  levelsOf,
  longWait,
  missingNeeds,
  moreHelpGives,
  nextLessonOf,
  offered,
  pickWarmups,
  pinOf,
  recallOf,
  repoNeed,
  ruleTiers,
  rungsOf,
  stepNote,
  tearDownLeft,
  tierOf,
  tiersOf,
  toFinish,
  tryFirst,
  unmet,
  whileRunsOf,
  whileRunsOpen,
} from "./engine.ts";
export { mix, TIERS } from "./tiers.ts";

// The engine's types, for the host and the server that drive it.
export type { EngineSnapshot } from "./project.ts";
export type {
  BeatState,
  CourseEntry,
  Effect,
  EngineInput,
  EngineState,
  Facts,
  HostInput,
  LessonProgress,
  SavedProgress,
  Watch,
} from "./types.ts";
