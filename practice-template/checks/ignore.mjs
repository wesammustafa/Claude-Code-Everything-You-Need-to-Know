// @ts-check
// Ignore-rule helpers shared by the Advanced checks: whether a committed
// .gitignore ignores a path. The machine's global excludes file is switched
// off, so a rule that lives only on the Learner's machine never counts.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
/** @import { Repo } from './repo.mjs' */

/** @type {(cwd: string, args: string[], input?: string) => string} */
const run = (cwd, args, input) => execFileSync('git', args, { cwd, input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });

// The rule that decides `probe` in the repository at `cwd`, as
// `{ source, line, pattern, negated }`, or null when no rule matches it.
// --no-index asks about the rules even when the path is tracked.
/** @typedef {{ source: string, line: number, pattern: string, negated: boolean }} Rule */

/**
 * @param {string} cwd
 * @param {string} probe
 * @returns {Rule | null}
 */
function rule(cwd, probe) {
  let out;
  try {
    out = run(cwd, ['-c', `core.excludesFile=${devNull}`, 'check-ignore', '--stdin', '-z', '-v', '--no-index'], `${probe}\0`);
  } catch (error) {
    if (/** @type {{ status?: number | null }} */ (error).status === 1) return null;
    throw error;
  }
  const [source, line, pattern] = out.split('\0');
  return source ? { source, line: Number(line), pattern: /** @type {string} */ (pattern), negated: /** @type {string} */ (pattern).startsWith('!') } : null;
}

// A per-directory .gitignore, which git reports relative to the repository's
// root; .git/info/exclude is reported by its path into .git, or in full from
// a linked worktree.
const perDirectory = (/** @type {string} */ source) => /(^|\/)\.gitignore$/.test(source) && !source.startsWith('.git/') && !/^([a-zA-Z]:)?\//.test(source);

/**
 * @param {Repo} repo
 * @param {string} source
 */
function committedClean(repo, source) {
  try {
    repo.git('cat-file', '-e', `HEAD:${source}`);
    repo.git('diff', '--quiet', 'HEAD', '--', source);
    return true;
  } catch {
    return false;
  }
}

// The same question asked of the .gitignore files committed at HEAD alone,
// in a scratch repository that holds only them: a rule in .git/info/exclude
// or an uncommitted edit can't hide or stand in for a committed rule there.
/**
 * @param {Repo} repo
 * @param {string} probe
 */
function committedRule(repo, probe) {
  const parts = probe.split('/');
  const files = parts.map((_, /** @type {number} */ i) => [...parts.slice(0, i), '.gitignore'].join('/'));
  let listed;
  try {
    listed = repo.git('ls-tree', '-r', '--name-only', 'HEAD', '--', ...files).split('\n').filter(Boolean);
  } catch {
    return null;
  }
  if (!listed.length) return null;
  const dir = mkdtempSync(join(tmpdir(), 'ignore-'));
  try {
    run(dir, ['init', '-q']);
    // A template directory could seed rules here.
    writeFileSync(join(dir, '.git', 'info', 'exclude'), '');
    for (const path of listed) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), execFileSync('git', ['show', `HEAD:${path}`], { cwd: repo.dir, stdio: ['ignore', 'pipe', 'pipe'] }));
    }
    return rule(dir, probe);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Whether a .gitignore committed at HEAD ignores `probe`, a path relative to
// the repository's root. Returns `{ source, line, pattern }` when it does,
// and otherwise `{ problem }` with what stands in its way: 'none' (no rule),
// 'negated' (a `!` rule keeps the path), 'exclude' (only .git/info/exclude
// ignores it) or 'uncommitted' (a .gitignore rule that isn't committed).
/**
 * @typedef {(Rule & { problem?: undefined }) | ({ problem: 'none' } & Partial<Rule>) | ({ problem: 'negated' | 'exclude' | 'uncommitted' } & Rule)} Ignore
 */

/**
 * @param {Repo} repo
 * @param {string} probe
 * @returns {Ignore}
 */
export function committedIgnore(repo, probe) {
  const live = rule(repo.dir, probe);
  if (!live) return { problem: 'none' };
  if (live.negated) return { problem: 'negated', ...live };
  if (perDirectory(live.source) && committedClean(repo, live.source)) return live;
  // .git/info/exclude can shadow a committed rule, such as `.claude/` there
  // over `.claude/worktrees/` in .gitignore, and an unrelated edit to a
  // .gitignore leaves its committed rules in force: ask the committed files.
  const committed = committedRule(repo, probe);
  if (committed && !committed.negated) return committed;
  return { problem: perDirectory(live.source) ? 'uncommitted' : 'exclude', ...live };
}

// What to do when committedIgnore finds no committed rule, given the line
// the Learner should add, such as `.claude/worktrees/`.
/**
 * @param {{ problem?: string, source?: string, line?: number, pattern?: string }} result
 * @param {string} line
 */
export function ignoreHint(result, line) {
  if (result.problem === 'negated') return `Line ${result.line} of \`${result.source}\`, \`${result.pattern}\`, keeps \`${line}\` from being ignored. Delete it, add the line \`${line}\` to \`.gitignore\` and commit.`;
  if (result.problem === 'exclude') return `Only \`.git/info/exclude\` ignores \`${line}\`, and git never commits that file, so your teammates don't get the rule. Add the line \`${line}\` to \`.gitignore\` and commit it.`;
  if (result.problem === 'uncommitted') return `\`${result.source}\` ignores \`${line}\`, but that rule isn't committed. Run \`git add ${result.source}\` and commit it.`;
  return `No committed \`.gitignore\` ignores \`${line}\`. Add the line \`${line}\` to \`.gitignore\` and commit it. A rule in your global git excludes file doesn't count: it isn't in the repository.`;
}
