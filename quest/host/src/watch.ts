// Notices file changes in a folder: its root, `.practice/` (armed again
// when it appears), `.git/` for commits and staging, and `.claude/` with the
// folders right in it, where skills, agents and settings go (ticket 88).
// Events only speed things up; the host's poll is the truth where events
// don't arrive (WSL on /mnt/c, network folders). `timers` is the debounce's
// clock: the real one unless a test hands its own.
import { existsSync, readdirSync, watch, type FSWatcher } from "node:fs";
import { join } from "node:path";

// The debounce's clock: the real timers, or a test's.
export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

const REAL_TIMERS: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => {
    clearTimeout(id as ReturnType<typeof setTimeout> | undefined);
  },
};

export interface Watcher {
  dirs(): string[];
  close(): void;
  arm(): void;
}

export function watchDirs(
  root: string,
  onChange: () => void,
  {
    debounceMs = 150,
    timers = REAL_TIMERS,
  }: { debounceMs?: number; timers?: Timers } = {},
): Watcher {
  const watchers = new Map<string, FSWatcher>();
  let timer: unknown = null;
  const fire = () => {
    timers.clearTimeout(timer);
    timer = timers.setTimeout(() => {
      arm();
      onChange();
    }, debounceMs);
  };
  // `.claude/`'s own folders, as they are now: none where it isn't there.
  const claude = join(root, ".claude");
  const inClaude = () => {
    try {
      return readdirSync(claude, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => join(claude, e.name));
    } catch {
      return [];
    }
  };
  const arm = () => {
    for (const dir of [
      root,
      join(root, ".practice"),
      join(root, ".git"),
      claude,
      ...inClaude(),
    ]) {
      if (watchers.has(dir) || !existsSync(dir)) continue;
      try {
        const w = watch(dir, { persistent: false }, fire);
        w.on("error", () => {
          w.close();
          watchers.delete(dir);
        });
        watchers.set(dir, w);
      } catch {
        // Not watchable here: the poll covers it.
      }
    }
  };
  arm();
  return {
    dirs: () => [...watchers.keys()],
    close() {
      timers.clearTimeout(timer);
      for (const w of watchers.values()) w.close();
      watchers.clear();
    },
    arm,
  };
}
