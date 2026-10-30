// The real adapters: the Check child, read-only git, the file system as it
// is, the watcher, the store in the practice copy and the PATH. Each host
// gets its own registry of children, so closing it stops its own.
import { existsSync } from "node:fs";
import { runCheck, runProbe } from "./check-child.mjs";
import { createChildren } from "./children.mjs";
import { bytesOf, matchOf, stampOf } from "./files.mjs";
import { probeFolder } from "./folders.mjs";
import { gitFirstName, gitReady, gitStatus } from "./git.mjs";
import { onPath } from "./path-lookup.mjs";
import { loadState, saveState } from "./store.mjs";
import { watchDirs } from "./watch.mjs";

// The app's one clock: monotonic, and on a 1/1024 ms grid so sums and
// differences of its times are exact (a deadline on the 40 ms grid lands on
// it, not a hair under, and `% 40` from it is 0, not 39.99...). A clock
// reading, not a pose: the step is under a microsecond. A whole-ms clock
// passes through unchanged.
export const perf = () => Math.round(performance.now() * 1024) / 1024;
export const realClock = {
  now: perf,
  // The wall clock, in epoch milliseconds, for the server time an event and
  // a heartbeat carry.
  epoch: () => Date.now(),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
};

/** @param {import("./types.mjs").RealOptions} options @returns {import("./types.mjs").Adapters} */
export function realAdapters({
  root,
  env = process.env,
  platform = process.platform,
  clock = realClock,
  watch = watchDirs,
  askGit,
  runCheck: checkChild = runCheck,
  runProbe: probeChild = runProbe,
}) {
  const children = createChildren();
  // What git says first: whether this folder is a repository, and a name to
  // greet.
  const ask =
    askGit ??
    ((dir) =>
      Promise.all([
        gitReady(dir, { children }),
        gitFirstName(dir, { children }),
      ]));
  return {
    clock,
    checks: {
      run: (dir, lesson, items, opts) =>
        checkChild(dir, lesson, items, { ...opts, children, clock }),
    },
    probes: {
      run: (dir, name, args) =>
        probeChild(dir, name, args, { children, clock }),
    },
    git: {
      ask,
      status: (dir, { files, head } = {}) =>
        gitStatus(dir, { files, head, children }),
    },
    folders: { look: (path) => probeFolder(path, { children }) },
    files: {
      match: matchOf,
      bytes: bytesOf,
      stamp: stampOf,
      exists: existsSync,
    },
    watch,
    store: {
      load: () => loadState(root),
      save: (data) => saveState(root, data),
    },
    commands: { has: (name) => onPath(name, env, platform) },
    stop: () => children.stop(),
    children,
  };
}
