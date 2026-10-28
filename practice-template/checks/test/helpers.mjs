// Shared by the checks' tests: a throwaway git repository to point a check at,
// and the check command run the way a Learner runs it.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const runner = join(dirname(fileURLToPath(import.meta.url)), '..', 'run.mjs');

// A git repository in a temporary folder, holding `files` (path to text),
// with `.practice/` ignored as a Learner's own repository would have it. It
// ignores the machine's global excludes file, which may list `.claude`.
export function repo(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'practice-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'core.excludesFile', '/dev/null'], { cwd: dir });
  writeFileSync(join(dir, '.git', 'info', 'exclude'), '.practice/\n');
  write(dir, files);
  return dir;
}

export function write(dir, files) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
}

// Stages `paths`, or everything when `paths` is omitted, and commits; returns
// the sha. An empty list commits nothing new.
export function commit(dir, message, paths) {
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' }).trim();
  if (!paths) git('add', '-A');
  else if (paths.length) git('add', ...paths);
  git('commit', '-q', '--allow-empty', '-m', message);
  return git('rev-parse', 'HEAD');
}

// HEAD as git archive exports it, in a new repository with one commit, as
// "Use this template" makes a copy. `drop` is a folder to leave out, with any
// parent it leaves empty. It reads the commit, not the working tree: commit a
// change before you test it.
export function exportHead(root, drop) {
  const dir = repo();
  const tar = execFileSync('git', ['archive', '--format=tar', 'HEAD'], { cwd: root, maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  if (drop) {
    rmSync(join(dir, drop), { recursive: true, force: true });
    for (let p = dirname(drop); p !== '.'; p = dirname(p)) {
      try {
        rmdirSync(join(dir, p));
      } catch {
        break;
      }
    }
  }
  commit(dir, 'Initial commit');
  return dir;
}

// The runner gets the environment a Learner's shell has. NODE_TEST_CONTEXT,
// set by `node --test`, would make an `npm test` a check runs skip its tests.
export function check(args, env = {}) {
  const { GITHUB_ACTIONS, NODE_TEST_CONTEXT, ...rest } = process.env;
  const result = spawnSync(process.execPath, [runner, ...args], { encoding: 'utf8', env: { ...rest, ...env } });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

// Runs `fn` with a repository built by `make`, then deletes it.
export function withRepo(make, fn) {
  const dir = make();
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
