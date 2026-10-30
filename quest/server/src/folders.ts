// folder.choose's path, checked before the host sees it (spec, Server
// security, the action boundary): resolved through symlinks, an existing
// folder inside the Learner's home folder, not the Practice copy and not
// holding it, and the root of a git working tree. Git runs last, so a path
// the cheap checks refuse never reaches it.
import { execFile } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { relative, isAbsolute, sep } from "node:path";
import type { FolderRefusal } from "@quest/contract";
import type { Env } from "./launch.ts";

export const PATH_LIMIT = 1024;
const GIT_LIMIT = 30_000;

/** The toplevel git prints for `dir`, or null when it is not in a working tree. */
export type GitTop = (dir: string) => Promise<string | null>;

export type Checked = { path: string } | { refused: FolderRefusal };

/** The Learner's home folder, as the host reads it. */
export function homeOf(env: Env): string {
  return env.HOME || env.USERPROFILE || homedir();
}

/** `git rev-parse --show-toplevel` in `dir`: read-only, no optional locks. */
export const gitTop: GitTop = (dir) =>
  new Promise((resolve) => {
    execFile(
      "git",
      ["rev-parse", "--show-toplevel"],
      {
        cwd: dir,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
        timeout: GIT_LIMIT,
        windowsHide: true,
      },
      (error, stdout) => {
        resolve(error ? null : stdout.trim() || null);
      },
    );
  });

// `inner` is `outer` or inside it.
function within(outer: string, inner: string): boolean {
  const rel = relative(outer, inner);
  return (
    rel === "" ||
    (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel))
  );
}

async function real(path: string): Promise<string | null> {
  try {
    return await realpath(path);
  } catch {
    return null;
  }
}

/**
 * Checks an absolute path (the schema has refused anything else) and returns
 * the resolved folder, or why it was refused.
 */
export async function checkFolder(
  path: string,
  { home, root, git = gitTop }: { home: string; root: string; git?: GitTop },
): Promise<Checked> {
  const resolved = await real(path);
  if (resolved === null) return { refused: "missing" };
  try {
    if (!(await stat(resolved)).isDirectory()) return { refused: "missing" };
  } catch {
    return { refused: "missing" };
  }
  if (resolved.length > PATH_LIMIT) return { refused: "too-long" };
  const realHome = (await real(home)) ?? home;
  if (!within(realHome, resolved)) return { refused: "outside-home" };
  const realRoot = (await real(root)) ?? root;
  if (resolved === realRoot) return { refused: "is-copy" };
  if (within(resolved, realRoot)) return { refused: "contains-copy" };
  const top = await git(resolved);
  if (top === null || (await real(top)) !== resolved)
    return { refused: "not-repo-root" };
  return { path: resolved };
}
