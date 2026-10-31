// @ts-check
// Parallel sessions with worktrees (Advanced, lesson 1). The Learner ignores
// .claude/worktrees/ in a committed .gitignore, runs two sessions at once,
// each in a worktree that `claude --worktree <name>` makes there, merges both
// branches and removes the worktrees. A worktree listing saved while both
// existed names the commit each session made. What a fresh worktree lacked,
// and whether .worktreeinclude or the session supplied it, is a decision the
// check can't see, so the lesson self-checks it. The Advanced capstone reuses these items with its own
// listing.
import { execFileSync } from 'node:child_process';
import { committedIgnore, ignoreHint } from '../ignore.mjs';
import { claudeWorktrees, CLAUDE_WORKTREES, liveWorktrees, parseWorktrees } from '../worktrees.mjs';
/** @import { Worktree } from '../worktrees.mjs' */
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Parallel sessions with worktrees';

const SNAPSHOT = '.practice/a-1-worktrees.txt';

const save = (/** @type {string} */ snapshot) => `\`git worktree list --porcelain > ${snapshot}\``;
const short = (/** @type {string} */ sha) => sha.slice(0, 7);
const label = (/** @type {Worktree} */ r) => r.branch ?? short(/** @type {string} */ (r.head));
const shell = (/** @type {string} */ path) => (/\s/.test(path) ? `"${path}"` : path);

// Whether a lock is a running Claude Code session's: its reason reads like
// `claude session <name> (pid <n> start <date>)` and that process is alive
// (EPERM means it exists under another user). Unlocking such a worktree
// would pull its folder from under the session. That reason's form is what
// Claude Code wrote in the r27 dry-run, not a documented format, so any
// other lock may still be a session's: its message says to exit one first.
/** @param {string | true} reason */
function sessionRunning(reason) {
  const pid = Number(String(reason).match(/^"?claude session\b.*\(pid (\d+)\b/)?.[1]);
  if (!Number.isSafeInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return /** @type {NodeJS.ErrnoException} */ (error).code === 'EPERM';
  }
}

/**
 * @param {Repo} repo
 * @param {string} sha
 */
function isCommit(repo, sha) {
  try {
    repo.gitLocal('cat-file', '-e', `${sha}^{commit}`);
    return true;
  } catch {
    return false;
  }
}

// `git merge-base --is-ancestor`, remembered: it exits 1 for "no".
/** @param {Repo} repo */
function ancestry(repo) {
  /** @type {Map<string, boolean>} */
  const known = new Map();
  /** @type {(a: string, b: string) => boolean} */
  return (a, b) => {
    const key = `${a} ${b}`;
    if (!known.has(key)) {
      try {
        repo.gitLocal('merge-base', '--is-ancestor', a, b);
        known.set(key, true);
      } catch (error) {
        if (/** @type {{ status?: number | null }} */ (error).status !== 1) throw error;
        known.set(key, false);
      }
    }
    return /** @type {boolean} */ (known.get(key));
  };
}

// The patch-ids `git patch-id --stable` gives for a diff or a log with
// patches, one `<patch-id> <commit>` line each.
/**
 * @param {Repo} repo
 * @param {string} text
 */
function patchIds(repo, text) {
  if (!text.trim()) return [];
  const out = execFileSync('git', ['patch-id', '--stable'], { cwd: repo.dir, input: text, encoding: 'utf8', env: { ...process.env, GIT_NO_LAZY_FETCH: '1' }, stdio: ['pipe', 'pipe', 'pipe'] });
  return out.split('\n').filter(Boolean).map((line) => line.split(' ')[0]);
}

// Whether a worktree commit's change is in HEAD: HEAD holds the commit
// itself (a merge or a fast-forward), every commit of its branch as an
// equal patch (a rebase or a cherry-pick), or one commit whose patch is the
// branch's whole change (a squash merge). Remembered per commit.
/**
 * @param {Repo} repo
 * @param {(a: string, b: string) => boolean} isAncestor
 */
function integration(repo, isAncestor) {
  /** @type {Map<string, boolean>} */
  const known = new Map();
  return (/** @type {string} */ sha) => {
    if (!known.has(sha)) known.set(sha, isAncestor(sha, 'HEAD') || copied(repo, sha));
    return /** @type {boolean} */ (known.get(sha));
  };
}

/**
 * @param {Repo} repo
 * @param {string} sha
 */
function copied(repo, sha) {
  try {
    const base = repo.gitLocal('merge-base', sha, 'HEAD');
    if (!base || base === sha) return false;
    // `git cherry` marks with `-` each commit whose patch HEAD already has.
    const marks = repo.gitLocal('cherry', 'HEAD', sha).split('\n').filter(Boolean);
    if (marks.length && marks.every((line) => line.startsWith('-'))) return true;
    const [whole] = patchIds(repo, `${repo.gitLocal('diff', '--no-color', '--no-ext-diff', base, sha)}\n`);
    if (!whole) return false;
    const log = repo.gitLocal('log', '-p', '--no-color', '--no-ext-diff', '--no-merges', '--format=commit %H', `${base}..HEAD`);
    return patchIds(repo, `${log}\n`).includes(whole);
  } catch {
    return false;
  }
}

// What a saved listing shows: the Claude Code worktrees it lists (with
// `anywhere`, every linked worktree, wherever it is), the two whose commits
// split from each other (a merged pair first, as any two pass), and a hint,
// which is null when both changes of that pair are in HEAD.
/**
 * @param {Repo} repo
 * @param {string} snapshot
 * @returns {{ worktrees: Worktree[], pair?: Worktree[], hint: string | null }}
 */
function review(repo, snapshot, anywhere = false) {
  const text = repo.read(snapshot);
  if (text === null || !text.trim()) return { worktrees: [], hint: `While both worktree sessions exist, and after each has committed, run ${save(snapshot)} from your main checkout.` };
  const records = parseWorktrees(text);
  if (!records.length) return { worktrees: [], hint: `\`${snapshot}\` isn't a listing from \`git worktree list --porcelain\`. While both worktrees exist, save it again: ${save(snapshot)}.` };
  const worktrees = anywhere ? records.slice(1).filter((r) => !r.bare) : claudeWorktrees(records);
  if (worktrees.length < 2) {
    if (anywhere) return { worktrees, hint: `\`${snapshot}\` lists ${worktrees.length ? 'one worktree' : 'no worktree'} besides the main checkout. Give each session a worktree of its own, and save ${save(snapshot)} while both worktrees exist.` };
    const others = records.slice(1).filter((r) => !r.bare && !worktrees.includes(r));
    const elsewhere = others.length ? ` It also lists ${others.map((r) => `\`${r.path}\``).join(', ')}, but the check counts only the worktrees \`claude --worktree <name>\` makes, under \`.claude/worktrees/\`.` : '';
    return { worktrees, hint: `\`${snapshot}\` lists ${worktrees.length ? 'one worktree' : 'no worktree'} under \`.claude/worktrees/\`.${elsewhere} Start each session with \`claude --worktree <name>\`, and save ${save(snapshot)} while both worktrees exist.` };
  }
  const known = worktrees.filter((r) => r.head && isCommit(repo, r.head));
  if (known.length < 2) {
    const missing = /** @type {Worktree} */ (worktrees.find((r) => !known.includes(r)));
    const what = missing.head ? `commit ${short(missing.head)}, which isn't in this repository` : `\`${missing.path}\` without a commit`;
    return { worktrees, hint: `\`${snapshot}\` names ${what}. Save the listing from this repository's main checkout, while its worktrees exist: ${save(snapshot)}.` };
  }
  const isAncestor = ancestry(repo);
  const inHead = integration(repo, isAncestor);
  // Every worktree in `known` has a head.
  /** @type {Worktree[][]} */
  const pairs = [];
  for (const [i, a] of known.entries()) {
    for (const b of known.slice(i + 1)) {
      if (a.head !== b.head && !isAncestor(/** @type {string} */ (a.head), /** @type {string} */ (b.head)) && !isAncestor(/** @type {string} */ (b.head), /** @type {string} */ (a.head))) pairs.push([a, b]);
    }
  }
  if (!pairs.length) return { worktrees, hint: `\`${snapshot}\` was saved before both sessions committed: its worktrees point at one commit, or one at an earlier commit of the other's. Save it again before you remove them: ${save(snapshot)}.` };
  const [{ pair, unmerged }] = /** @type {[{ pair: Worktree[], unmerged: Worktree[] }]} */ (pairs
    .map((p) => ({ pair: p, unmerged: p.filter((r) => !inHead(/** @type {string} */ (r.head))) }))
    .sort((x, y) => x.unmerged.length - y.unmerged.length));
  if (!unmerged.length) return { worktrees, pair, hint: null };
  const names = unmerged.map(label);
  return { worktrees, pair, hint: `${names.length > 1 ? 'The changes on' : 'The change on'} ${names.map((n) => `\`${n}\``).join(' and ')} ${names.length > 1 ? "aren't" : "isn't"} in your current branch. From your main checkout, bring ${names.length > 1 ? 'each one' : 'it'} in the way your team does: ${names.map((n) => `\`git merge ${n}\``).join(', then ')}, or a rebase or a squash merge.` };
}

/** @type {Item} */
export const ignoresWorktrees = {
  text: 'a committed `.gitignore` ignores `.claude/worktrees/` and not the rest of `.claude/`',
  check(repo) {
    const worktrees = committedIgnore(repo, '.claude/worktrees/a-1-probe/file');
    if (worktrees.problem) return ignoreHint(worktrees, '.claude/worktrees/');
    const settings = committedIgnore(repo, '.claude/settings.json');
    if (settings.problem || settings.source !== worktrees.source) return true;
    return `Line ${settings.line} of \`${settings.source}\`, \`${settings.pattern}\`, also ignores \`.claude/settings.json\`, so it would hide the settings you share with your team. Ignore only \`.claude/worktrees/\`, and commit.`;
  },
};

// With `anywhere`, as the Advanced capstone asks, a worktree may sit
// anywhere, not only where `claude --worktree` makes it.
/**
 * @param {string} snapshot
 * @param {{ anywhere?: boolean }} [options]
 * @returns {Item}
 */
export function mergedWorktrees(snapshot, { anywhere = false } = {}) {
  return {
    text: `\`${snapshot}\` lists two worktrees ${anywhere ? 'of this repository' : 'under `.claude/worktrees/`'} whose commits split from each other, and both changes are in your branch`,
    local: true,
    check: (repo) => review(repo, snapshot, anywhere).hint ?? true,
  };
}

/**
 * @param {string} snapshot
 * @returns {Item}
 */
export function removedWorktrees(snapshot) {
  return {
    text: 'neither of those worktrees still exists',
    local: true,
    check(repo) {
      const text = repo.read(snapshot);
      if (text === null || !text.trim()) return `There is no \`${snapshot}\`, so the check can't tell which worktrees should be gone. Save it as the item above says.`;
      const { worktrees, pair } = review(repo, snapshot);
      if (!worktrees.length) return `\`${snapshot}\` lists no worktree under \`.claude/worktrees/\`, so the check can't tell which worktrees should be gone. Save it as the item above says.`;
      // Paths as git printed them: one that isn't on this machine was saved elsewhere.
      const records = liveWorktrees(repo);
      const live = new Map(records.map((r) => [r.path, r]));
      const left = /** @type {Worktree[]} */ ((pair ?? worktrees).map((r) => live.get(r.path)).filter(Boolean));
      if (!left.length) return true;
      // A worktree under the main checkout's .claude/worktrees/, named from
      // there, so a long repository path shows once, not three times.
      const main = records[0]?.path ?? '';
      const named = (/** @type {string} */ p) => (main && p.startsWith(`${main}${CLAUDE_WORKTREES}`) ? p.slice(main.length + 1) : p);
      return left.map((r) => {
        const at = named(r.path);
        const path = shell(at);
        if (r.locked && sessionRunning(r.locked)) return `\`${at}\` still exists, and the Claude Code session in it is still running: once its branch is merged, run \`/exit\` in that session and choose to remove the worktree, or keep it and then run \`git worktree remove ${path}\` from your main checkout.`;
        if (r.locked) return `\`${at}\` still exists and is locked: exit any Claude Code session open in it. Once its branch is merged, run \`git worktree remove ${path}\` from your main checkout, after \`git worktree unlock\` if git says it is still locked.`;
        if (r.prunable) return `git still lists \`${r.path}\`, whose folder is gone: run \`git worktree prune\`.`;
        return `\`${at}\` still exists: once its branch is merged, run \`git worktree remove ${path}\` from your main checkout.`;
      }).join(' ');
    },
  };
}

/** @type {Item[]} */
export const items = [ignoresWorktrees, mergedWorktrees(SNAPSHOT), removedWorktrees(SNAPSHOT)];
