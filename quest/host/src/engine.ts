// The host's one way into the lesson engine and its content (ticket 209).
// It names the engine's modules by relative path, as the read-only guard's
// walk follows only relative imports: the package entry for the engine,
// and the course and step-file modules for the rest. The host's probes.ts
// alone imports quest/engine/src/probes.ts directly: the probe table, data
// with no engine module behind it.
export {
  ACTION_TYPES,
  EFFECT_TYPES,
  EVENT_TYPES,
  HELP_USED,
  beatOf,
  contentOf,
  evidence,
  folderOf,
  grewFrom,
  initialState,
  introAsks,
  isStaged,
  listing,
  onCard,
  opensWithCheck,
  project,
  reduce,
  stampFor,
  startedLesson,
  statusStamp,
  stepOf,
  stepsOf,
  watching,
  workFolder,
} from "../../engine/src/index.ts";
export { FOLDER_KEYS, SLOW } from "../../engine/src/course.ts";
export {
  PATH_MAX,
  STEP_ID,
  globName,
  isGlob,
} from "../../engine/src/content.ts";
