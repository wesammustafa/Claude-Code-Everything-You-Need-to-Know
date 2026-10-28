// Git probes (ticket 105): what an Advanced step leaves in git where no
// check item applies, such as worktrees, branches, merges and pushes. The
// learn app runs them in its check child (learn/run-check.mjs --probe), in
// the work folder, and a lesson file names one on a beat:
//
//   - verify: probe <name> [args] [fresh [since <step>]]
//
// Each answers `{ pass, hint, evidence, state }`: `hint` says what is not
// there yet, `evidence` what a pass found, and `state` is a short digest of
// what it looked at, so a fresh beat passes only once that changed since its
// step opened. Read-only, and never fetches: every git call is a local read
// (repo.gitLocal), so a partial clone fails as if an object were missing.
import { createHash } from 'node:crypto';
import { claudeWorktrees, liveWorktrees, CLAUDE_WORKTREES } from './worktrees.mjs';

const digest = (text) => createHash('sha1').update(text).digest('hex').slice(0, 16);
// git's answer, or null where it exits non-zero (no such ref, no upstream).
const ask = (repo, ...args) => {
  try {
    return repo.gitLocal(...args);
  } catch {
    return null;
  }
};
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const some = (names) => names.slice(0, 3).join(', ') + (names.length > 3 ? ` and ${names.length - 3} more` : '');
// The worktrees git lists now that are still there: a prunable one's folder is gone.
const live = (repo) => liveWorktrees({ git: (...args) => repo.gitLocal(...args) }).filter((r) => !r.prunable);
const nameOf = (path) => path.replace(/\/+$/, '').split('/').pop();
const branchSha = (repo, branch) => ask(repo, 'rev-parse', '--verify', '-q', `refs/heads/${branch}^{commit}`);

// `worktrees <n>`: at least n live worktrees under .claude/worktrees/.
function worktrees(repo, [n]) {
  const found = claudeWorktrees(live(repo));
  const names = found.map((r) => nameOf(r.path));
  const state = digest(found.map((r) => `${r.path} ${r.head}`).join('\n'));
  if (found.length >= Number(n)) return { pass: true, evidence: `Worktrees under ${CLAUDE_WORKTREES.slice(1)}: ${some(names)}`, state };
  const hint = found.length
    ? `git worktree list shows ${plural(found.length, 'worktree')} under ${CLAUDE_WORKTREES.slice(1)} (${some(names)}); this step needs ${n}.`
    : `git worktree list shows no worktree under ${CLAUDE_WORKTREES.slice(1)} yet.`;
  return { pass: false, hint, state };
}

// `branch-ahead <branch>`: the branch is there; always fresh, so it passes
// once the branch moved since the step opened.
function branchAhead(repo, [branch]) {
  const sha = branchSha(repo, branch);
  if (!sha) return { pass: false, hint: `No branch ${branch} yet.`, state: '' };
  const subject = ask(repo, 'log', '-1', '--format=%s', sha) ?? '';
  return { pass: true, evidence: `${branch} is at ${sha.slice(0, 7)}${subject ? `: ${subject}` : ''}`, state: sha };
}

// `merged <branch>...`: each branch is an ancestor of HEAD.
function merged(repo, branches) {
  const head = ask(repo, 'rev-parse', '--verify', '-q', 'HEAD^{commit}') ?? '';
  const missing = branches.filter((b) => !branchSha(repo, b));
  if (missing.length) return { pass: false, hint: `No branch ${some(missing)} here.`, state: head };
  const behind = branches.filter((b) => ask(repo, 'merge-base', '--is-ancestor', `refs/heads/${b}`, 'HEAD') === null);
  if (behind.length) return { pass: false, hint: `Not merged into HEAD yet: ${some(behind)}.`, state: head };
  return { pass: true, evidence: `Merged into HEAD: ${some(branches)}`, state: head };
}

// `gone <path>`: no live worktree at that path, named from the work folder.
function gone(repo, [path]) {
  const want = `/${path.replace(/\/+$/, '')}`;
  const at = live(repo).slice(1).filter((r) => r.path.replace(/\/+$/, '').endsWith(want));
  const state = digest(at.map((r) => r.path).join('\n'));
  if (at.length) return { pass: false, hint: `git worktree list still shows ${path}.`, state };
  return { pass: true, evidence: `No worktree at ${path}`, state };
}

// `pushed`: HEAD has an upstream and nothing to push.
function pushed(repo) {
  const branch = ask(repo, 'symbolic-ref', '--short', '-q', 'HEAD');
  const head = ask(repo, 'rev-parse', '--verify', '-q', 'HEAD^{commit}') ?? '';
  if (!branch) return { pass: false, hint: 'HEAD is on no branch, so there is nothing to push.', state: head };
  const upstream = ask(repo, 'rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}');
  if (!upstream) return { pass: false, hint: `${branch} has no upstream yet: push it with git push -u.`, state: head };
  const state = digest(`${head} ${ask(repo, 'rev-parse', '-q', '@{upstream}') ?? ''}`);
  const ahead = Number(ask(repo, 'rev-list', '--count', '@{upstream}..HEAD') ?? 0);
  if (ahead) return { pass: false, hint: `${plural(ahead, 'commit')} on ${branch} not pushed to ${upstream} yet.`, state };
  return { pass: true, evidence: `${branch} is pushed to ${upstream}`, state };
}

// `removed <path>...`: none of the paths is in HEAD, and HEAD is pushed
// (r27 pattern U), so a beat that deletes files passes on their removal's
// push, not on any push. Its state is the push's.
function removed(repo, paths) {
  const head = ask(repo, 'rev-parse', '--verify', '-q', 'HEAD^{commit}') ?? '';
  const left = paths.filter((p) => ask(repo, 'cat-file', '-e', `HEAD:${p}`) !== null);
  if (left.length) return { pass: false, hint: `Still in the last commit: ${some(left)}. Delete ${left.length === 1 ? 'it' : 'them'} with git rm, then commit and push.`, state: head };
  const p = pushed(repo);
  return p.pass ? { pass: true, evidence: `Removed and pushed: ${some(paths)}`, state: p.state } : p;
}

// `todos <n>`: TODO or FIXME in tracked files of at least n top-level folders.
function todos(repo, [n]) {
  const files = (ask(repo, 'grep', '-l', '-I', '-E', 'TODO|FIXME') ?? '').split('\n').filter(Boolean);
  const folders = [...new Set(files.filter((f) => f.includes('/')).map((f) => `${f.split('/')[0]}/`))].sort();
  const state = digest(folders.join('\n'));
  if (folders.length >= Number(n)) return { pass: true, evidence: `TODO or FIXME in ${some(folders)}`, state };
  const where = folders.length ? `${plural(folders.length, 'top-level folder')} (${some(folders)})` : 'no top-level folder';
  return { pass: false, hint: `git grep finds TODO or FIXME in ${where} here; this needs ${n}.`, state };
}

const COUNT = /^[1-9]\d{0,2}$/;
// A branch name as a probe takes it: no spaces, no leading dash, no `..`.
const BRANCH = /^(?!-)(?!.*\.\.)[\w./-]+$/;
// A path named from the work folder, like .claude/worktrees/docs-pass:
// never /, ./ or .. in it, nor a backslash or a space.
const PATH = { test: (p) => !/[\s\\]/.test(p) && !p.startsWith('/') && !p.replace(/\/$/, '').split('/').some((part) => ['', '.', '..'].includes(part)) };

// Each probe: its arguments (`many`: one or more of the last), what the
// card says it watches, and whether it is always fresh.
export const PROBES = {
  worktrees: { args: [COUNT], watching: 'git worktree list', run: worktrees },
  'branch-ahead': { args: [BRANCH], watching: 'git branch', fresh: true, run: branchAhead },
  merged: { args: [BRANCH], many: true, watching: 'git log', run: merged },
  gone: { args: [PATH], watching: 'git worktree list', run: gone },
  pushed: { args: [], watching: 'git status', run: pushed },
  removed: { args: [PATH], many: true, watching: 'git log', run: removed },
  todos: { args: [COUNT], watching: 'git grep', run: todos },
};

// Why `name args` is no probe, or null where it is one.
export function probeError(name, args) {
  const p = PROBES[name];
  if (!p) return `unknown probe ${name}: one of ${Object.keys(PROBES).join(', ')}`;
  const count = p.many ? args.length >= p.args.length : args.length === p.args.length;
  const bad = args.find((a, i) => !p.args[Math.min(i, p.args.length - 1)]?.test(a));
  if (!count || bad !== undefined) return `probe ${name} takes ${p.args.length ? `${p.args.map((r) => (r === COUNT ? '<n>' : r === BRANCH ? '<branch>' : '<path>')).join(' ')}${p.many ? '...' : ''}` : 'no arguments'}${bad !== undefined ? `, not ${bad}` : ''}`;
  return null;
}

// Runs a probe on `repo` (checks/repo.mjs openRepo).
export function runProbe(repo, name, args) {
  const error = probeError(name, args);
  if (error) throw new Error(error);
  return PROBES[name].run(repo, args);
}
