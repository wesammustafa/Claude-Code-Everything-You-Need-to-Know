// The lesson host (ticket 209): createHost runs the lesson engine's effects
// through adapters, real (realAdapters) or fake (./fake).
export {
  createHost,
  POLL_CHECK_MS,
  POLL_GIT_MS,
  POLL_MS,
  SAVE_QUIET_MS,
  TICK_MS,
} from "./host.mjs";
export { folderPath } from "./folders.mjs";
export { perf, realAdapters, realClock } from "./real.mjs";
