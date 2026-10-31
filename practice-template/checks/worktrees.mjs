// @ts-check
/** @import { Repo } from './repo.mjs' */
// Worktree helpers shared by Advanced lesson 1's check and the Advanced
// capstone: the records of `git worktree list --porcelain`, from a listing
// the Learner saved under .practice/ or from the repository now.

// Where `claude --worktree <name>` puts a worktree, under the repository root.
export const CLAUDE_WORKTREES = '/.claude/worktrees/';

// The records of a porcelain listing, in git's order (the main worktree
// first), each `{ path, head, branch, bare, detached, locked, prunable }`.
// `locked` and `prunable` are false, true, or the reason git gives.
// `branch` drops `refs/heads/` and is null for a detached HEAD; `head` is null
// when the record has none, as for a bare repository. Paths keep their spaces
// and use forward slashes. Lines may end in CRLF; read the file with
// `repo.read`, which also decodes UTF-16 from Windows PowerShell.
/**
 * @typedef {{ path: string, head: string | null, branch: string | null, bare: boolean, detached: boolean, locked: boolean | string, prunable: boolean | string }} Worktree
 */

/**
 * @param {string | null | undefined} text
 * @returns {Worktree[]}
 */
export function parseWorktrees(text) {
  /** @type {Worktree[]} */
  const records = [];
  /** @type {Worktree | null} */
  let current = null;
  for (const line of (text ?? '').split(/\r?\n/)) {
    if (!line.trim()) {
      current = null;
      continue;
    }
    const [, key, value = ''] = line.match(/^(\S+)(?: (.*))?$/) ?? [];
    if (key === 'worktree') {
      current = { path: value.replace(/\\/g, '/'), head: null, branch: null, bare: false, detached: false, locked: false, prunable: false };
      records.push(current);
    } else if (!current) {
      continue;
    } else if (key === 'HEAD') {
      current.head = /^[0-9a-f]{40}([0-9a-f]{24})?$/i.test(value) && !/^0+$/.test(value) ? value.toLowerCase() : null;
    } else if (key === 'branch') {
      current.branch = value.replace(/^refs\/heads\//, '');
    } else if (/** @type {(string | undefined)[]} */ (['bare', 'detached']).includes(key)) {
      current[/** @type {'bare' | 'detached'} */ (key)] = true;
    } else if (/** @type {(string | undefined)[]} */ (['locked', 'prunable']).includes(key)) {
      // Each may carry a reason after a space, kept as git printed it.
      current[/** @type {'locked' | 'prunable'} */ (key)] = value || true;
    }
  }
  return records;
}

// The linked worktrees Claude Code made: every record after the main one,
// except a bare repository, whose path is under `.claude/worktrees/`.
/** @param {Worktree[]} records */
export function claudeWorktrees(records) {
  return records.slice(1).filter((r) => !r.bare && r.path.includes(CLAUDE_WORKTREES));
}

// The worktrees git lists for the repository now.
/** @param {Pick<Repo, 'git'>} repo */
export function liveWorktrees(repo) {
  return parseWorktrees(repo.git('worktree', 'list', '--porcelain'));
}
