// Notices file changes in the practice copy: its root, `.practice/` (armed
// again when it appears), `.git/` for commits and staging, and `.claude/`
// with the folders right in it, where skills, agents and settings go (ticket
// 88). Events only speed things up; a poll in main.mjs is the truth where
// events don't arrive (WSL on /mnt/c, network folders).
import { existsSync, readdirSync, watch } from 'node:fs';
import { join } from 'node:path';

export function watchDirs(root, onChange, { debounceMs = 150 } = {}) {
  const watchers = new Map();
  let timer = null;
  const fire = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      arm();
      onChange();
    }, debounceMs);
  };
  // `.claude/`'s own folders, as they are now: none where it isn't there.
  const claude = join(root, '.claude');
  const inClaude = () => {
    try {
      return readdirSync(claude, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => join(claude, e.name));
    } catch {
      return [];
    }
  };
  const arm = () => {
    for (const dir of [root, join(root, '.practice'), join(root, '.git'), claude, ...inClaude()]) {
      if (watchers.has(dir) || !existsSync(dir)) continue;
      try {
        const w = watch(dir, { persistent: false }, fire);
        w.on('error', () => {
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
      clearTimeout(timer);
      for (const w of watchers.values()) w.close();
      watchers.clear();
    },
    arm,
  };
}
