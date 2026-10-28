// Every FAIL message of Advanced lesson 1's check, each from a work folder
// that produces it: `files` to write, or `setup(dir, { write, commit })`.
// Each scenario breaks one thing, so one narrow question matches its message.
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const LISTING = '.practice/a-1-worktrees.txt';
const NAMES = ['docs-pass', 'test-pass'];
const git = (dir, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const branch = (name) => `worktree-${name}`;
const under = (name) => `.claude/worktrees/${name}`;

// Commits a .gitignore holding `rules`, so only the rule can be wrong.
const ignored = (rules) => (dir, { write, commit }) => {
  write(dir, { '.gitignore': rules, 'README.md': '# A project\n' });
  commit(dir, 'Start');
};

// A repository after the lesson's work, with one step changed: two
// worktrees where `claude --worktree` makes them, a commit in each, the
// listing saved (`saveBefore` saves it before the commits; `listing`
// rewrites it, or drops it by returning null), both branches merged
// (`merge: 'one'` merges only the first, `'none'` neither) and the
// worktrees removed, except those in `keep`, `lock` (locked with `reason`,
// when given) and `prune`.
const parallel = ({ saveBefore = false, merge = 'each', keep = [], lock = [], reason, prune = [], listing = (text) => text } = {}) => (dir, { write, commit }) => {
  write(dir, { '.gitignore': '.claude/worktrees/\n', 'README.md': '# A project\n' });
  commit(dir, 'Start');
  for (const name of NAMES) git(dir, 'worktree', 'add', '-q', '-b', branch(name), under(name));
  const save = () => {
    const text = listing(`${git(dir, 'worktree', 'list', '--porcelain')}\n`);
    if (text !== null) write(dir, { [LISTING]: text });
  };
  if (saveBefore) save();
  for (const name of NAMES) {
    write(join(dir, under(name)), { [`work/${name}.txt`]: `${name}\n` });
    commit(join(dir, under(name)), `Work in ${name}`);
  }
  if (!saveBefore) save();
  const [first, second] = NAMES.map(branch);
  if (merge === 'each') {
    git(dir, 'merge', '-q', '--ff-only', first);
    git(dir, 'merge', '-q', '--no-ff', '--no-edit', second);
  } else if (merge === 'one') {
    git(dir, 'merge', '-q', '--ff-only', first);
  }
  for (const name of lock) git(dir, 'worktree', 'lock', ...(reason ? ['--reason', reason] : []), under(name));
  for (const name of prune) rmSync(join(dir, under(name)), { recursive: true, force: true });
  for (const name of NAMES) if (![...keep, ...lock, ...prune].includes(name)) git(dir, 'worktree', 'remove', under(name));
};

// The listing with only the main checkout's record left.
const mainOnly = (text) => `${text.split('\n\n')[0]}\n`;
// The listing with every worktree's commit swapped for one this repository lacks.
const foreign = (text) => text.replace(/^HEAD [0-9a-f]+$/gm, (line, at) => (at === 0 ? line : `HEAD ${'1234567'.repeat(5)}12345`));

export const scenarios = [
  { item: 0, name: 'no rule for the worktrees folder', setup: ignored('node_modules/\n') },
  { item: 0, name: 'the rule saved in .gitignore but not committed', setup: (dir, { write, commit }) => {
    write(dir, { 'README.md': '# A project\n' });
    commit(dir, 'Start');
    write(dir, { '.gitignore': '.claude/worktrees/\n' });
  } },
  { item: 0, name: 'the rule only in .git/info/exclude', setup: (dir, { write, commit }) => {
    write(dir, { 'README.md': '# A project\n', '.git/info/exclude': '.practice/\n.claude/worktrees/\n' });
    commit(dir, 'Start');
  } },
  { item: 0, name: 'a committed ! line that keeps the folder', setup: ignored('.claude/worktrees/**\n!.claude/worktrees/**\n') },
  { item: 0, name: 'a committed rule for all of .claude/', setup: ignored('.claude/\n') },
  { item: 1, name: 'no listing saved', setup: parallel({ listing: () => null }) },
  { item: 1, name: 'a listing from another command', setup: parallel({ listing: () => 'docs-pass\ntest-pass\n' }) },
  { item: 1, name: 'a listing with only the main checkout', setup: parallel({ listing: mainOnly }) },
  { item: 1, name: 'a listing that names commits this repository lacks', setup: parallel({ listing: foreign }) },
  { item: 1, name: 'a listing saved before both sessions committed', setup: parallel({ saveBefore: true }) },
  { item: 1, name: 'one branch not merged', setup: parallel({ merge: 'one' }) },
  { item: 1, name: 'neither branch merged', setup: parallel({ merge: 'none' }) },
  { item: 2, name: 'no listing saved', setup: parallel({ listing: () => null }) },
  { item: 2, name: 'an empty listing', setup: parallel({ listing: () => '\n' }) },
  { item: 2, name: 'a listing with only the main checkout', setup: parallel({ listing: mainOnly }) },
  { item: 2, name: 'a worktree still there', setup: parallel({ keep: ['test-pass'] }) },
  { item: 2, name: 'a locked worktree still there', setup: parallel({ lock: ['test-pass'] }) },
  // A live process's pid, as the lock of a Claude Code session still open in it.
  { item: 2, name: 'a worktree whose Claude Code session is still running', setup: parallel({ lock: ['test-pass'], reason: `claude session test-pass (pid ${process.pid} start Sun Oct 25 10:43:31 2026)` }) },
  { item: 2, name: 'a worktree whose folder was deleted', setup: parallel({ prune: ['test-pass'] }) },
];
