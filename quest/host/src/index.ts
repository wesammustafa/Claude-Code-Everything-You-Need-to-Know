// The lesson host (ticket 209): createHost runs the lesson engine's effects
// through adapters, real (realAdapters) or fake (./fake), and holds the
// instance, the revision, the recent events and the pending milestones
// (ticket 212).
export {
  createHost,
  EVENT_KEEP_MS,
  EVENT_LIMIT,
  HOST_ACTION_TYPES,
  POLL_CHECK_MS,
  POLL_GIT_MS,
  POLL_MS,
  SAVE_QUIET_MS,
  TICK_MS,
} from "./host.ts";
export { folderPath } from "./folders.ts";
export { perf, realAdapters, realClock } from "./real.ts";
export type {
  Adapters,
  Clock,
  Dispatched,
  FolderLook,
  Heard,
  Host,
  HostHeard,
  HostOptions,
  RealOptions,
  StoreLoad,
} from "./types.ts";
