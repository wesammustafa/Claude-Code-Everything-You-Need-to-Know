// Read-only git access for diff-scoped rules: what a file looked like at the
// base, and which lines a change adds. "Head" is the working tree, so
// uncommitted and untracked files count as part of the change.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isExcluded } from './tree.mjs';

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

// The commit a change is compared against: the merge base of `ref` and HEAD,
// so commits that landed on the base branch later are not counted as removals.
export function resolveBase(root, ref) {
  if (!existsSync(join(root, '.git'))) return { sha: null, note: 'not a git repository' };
  const wanted = ref ?? 'origin/main';
  try {
    git(root, ['rev-parse', '--verify', '--quiet', `${wanted}^{commit}`]);
  } catch {
    return { sha: null, note: `base ${wanted} not found` };
  }
  try {
    return { sha: git(root, ['merge-base', wanted, 'HEAD']).trim(), ref: wanted };
  } catch {
    return { sha: null, note: `no merge base between ${wanted} and HEAD` };
  }
}

export function filesAt(root, sha) {
  return git(root, ['ls-tree', '-r', '--name-only', sha]).split('\n').filter((f) => f && !isExcluded(f));
}

export function readAt(root, sha, path) {
  try {
    return git(root, ['show', `${sha}:${path}`]);
  } catch {
    return null;
  }
}

// The nearest tag matching v[0-9]* that git describe finds from the first
// parent of `tag`, or null for the first one.
export function previousTag(root, tag) {
  try {
    return git(root, ['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', `${tag}^`]).trim();
  } catch {
    return null;
  }
}

export function changedBetween(root, from, to) {
  return git(root, ['diff', '--name-only', from, to]).split('\n').filter((f) => f && !isExcluded(f));
}

// The lines each changed file adds relative to the base, as 1-based line
// numbers in the working tree: { path: Set(lines) }. Untracked files count as
// wholly added.
export function addedLines(root, sha) {
  const added = new Map();
  let file = null;
  let line = 0;
  const diff = git(root, ['diff', '-U0', '--no-color', '--no-ext-diff', sha, '--']);
  for (const row of diff.split('\n')) {
    if (row.startsWith('+++ ')) {
      file = row === '+++ /dev/null' ? null : row.slice(6);
      if (file && !added.has(file)) added.set(file, new Set());
    } else if (row.startsWith('@@')) {
      line = Number(row.match(/\+(\d+)/)[1]);
    } else if (file && row.startsWith('+')) {
      added.get(file).add(line++);
    }
  }
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  for (const path of untracked) added.set(path, 'all');
  for (const path of [...added.keys()]) if (isExcluded(path)) added.delete(path);
  return added;
}

// Files added, changed or deleted relative to the base, untracked included.
// A rename that git detects lists only its new path.
export function changedFiles(root, sha) {
  const tracked = git(root, ['diff', '--name-only', sha, '--']).split('\n');
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard']).split('\n');
  return [...tracked, ...untracked].filter((f) => f && !isExcluded(f));
}
