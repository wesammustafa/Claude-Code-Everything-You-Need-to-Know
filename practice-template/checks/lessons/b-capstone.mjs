// @ts-check
// The Beginner capstone: fix the bug in capstone/beginner-bug.md from plan to
// commit. It checks the parts of the Beginner Exit statements B2, B3 and B5
// that a script can see in files and git: the plan came before any edit, the
// commit stays inside the plan and carries a test that fails without the fix,
// and the tool does what the bug report asks. The rest, B1, B4 and the
// new-session half of B5 included, is self-assessed on the capstone page.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { NPM_TEST_LIMIT, testRunError, testsPass, nothingUncommitted } from './b-3.mjs';
import { isTestFile, planPaths, statusPaths } from '../paths.mjs';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Beginner capstone';

const lines = (/** @type {string | null} */ text) => (text ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const SAVE_COMMIT = '`git rev-parse HEAD > .practice/capstone-commit.txt`';
const AMEND = `\`git commit --amend\` and run ${SAVE_COMMIT} again`;
// A test committed after its fix: the saved commit holds no fix to test.
const ONLY_TESTS = `The commit changes only tests. Combine it with the fix before it, if you haven't pushed, or amend with \`git commit --amend\` to include the fix. Then run ${SAVE_COMMIT} again.`;

// The commit the Learner saved and the files it changes, or what to fix.
// Callers return `error` before they read the rest.
/** @typedef {{ error?: string, sha: string, files: string[] }} Saved */

/**
 * @param {Repo} repo
 * @returns {Saved}
 */
function savedCommit(repo) {
  const sha = lines(repo.read('.practice/capstone-commit.txt'))[0];
  if (!sha) return /** @type {Saved} */ ({ error: `After you commit the fix, run ${SAVE_COMMIT}.` });
  try {
    return { sha, files: repo.git('show', '--name-only', '--format=', sha).split('\n').filter(Boolean) };
  } catch {
    return /** @type {Saved} */ ({ error: `\`.practice/capstone-commit.txt\` names ${sha}, which is not a commit in this repository.` });
  }
}

const git = (/** @type {string} */ cwd, /** @type {string[]} */ ...args) => spawnSync('git', ['-c', 'advice.detachedHead=false', ...args], { cwd, encoding: 'utf8' });

// Runs `npm test` on the saved commit with every file it changes, except its
// tests, put back as it was in the commit before it. In a scratch clone, so
// the Learner's working tree and branches stay as they are.
/**
 * @param {Repo} repo
 * @param {string} sha
 * @param {string[]} files
 * @returns {{ error?: string, passed?: boolean }}
 */
function testsWithoutFix(repo, sha, files) {
  const dir = mkdtempSync(join(tmpdir(), 'capstone-before-fix-'));
  try {
    if (git(tmpdir(), 'clone', '--quiet', '--shared', '--no-checkout', repo.dir, dir).status !== 0) return { error: 'The check could not copy this repository to run the tests without the fix.' };
    if (git(dir, 'checkout', '--quiet', sha).status !== 0) return { error: `The check could not check out ${sha} to run the tests without the fix.` };
    if (git(dir, 'rev-parse', '--verify', '--quiet', `${sha}^`).status !== 0) return { error: `${sha} is the first commit in this repository, so there is no code from before the fix to test.` };
    for (const file of files.filter((f) => !isTestFile(f))) {
      const before = git(dir, 'cat-file', '-e', `${sha}^:${file}`).status === 0;
      if (before) git(dir, 'checkout', '--quiet', `${sha}^`, '--', file);
      else rmSync(join(dir, file), { force: true });
    }
    const run = spawnSync('npm', ['test', '--silent'], { cwd: dir, encoding: 'utf8', shell: process.platform === 'win32', timeout: NPM_TEST_LIMIT });
    const error = testRunError(run, { requireFailure: true });
    return error ? { error } : { passed: run.status === 0 };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** @type {Item[]} */
export const items = [
  {
    text: '`.practice/capstone-before.txt`, saved while the plan was on screen, lists no changed files',
    local: true,
    check(repo) {
      const before = repo.read('.practice/capstone-before.txt');
      if (before === null) return 'While the plan is on screen, run `git status --porcelain > .practice/capstone-before.txt`.';
      const changed = statusPaths(before);
      return changed.length ? `Files had changed before you approved the plan: ${changed.join(', ')}. Commit or stash them, then snapshot again in plan mode.` : true;
    },
  },
  {
    text: 'the commit in `.practice/capstone-commit.txt` changes only files listed in `.practice/capstone-plan.txt`, including a test',
    local: true,
    check(repo) {
      const plan = planPaths(repo.read('.practice/capstone-plan.txt'), repo.dir);
      if (!plan.size) return 'Save the files the plan will change, one per line, to `.practice/capstone-plan.txt` before you approve.';
      const { files, error } = savedCommit(repo);
      if (error) return error;
      const extra = files.filter((f) => !plan.has(f));
      if (extra.length) return `The commit changes files the plan didn't name: ${extra.join(', ')}. If the plan named them, add them to \`.practice/capstone-plan.txt\`; if not, take them out of the commit. Re-save the SHA (task 8).`;
      if (!files.some(isTestFile)) return `The commit changes no test file. The test goes in the same commit as the fix: ask Claude to add it, then ${AMEND}.`;
      return files.every(isTestFile) ? ONLY_TESTS : true;
    },
  },
  {
    text: 'the commit\'s test fails without its fix: with the other files it changes as they were before it, `npm test` fails',
    local: true,
    check(repo) {
      const { sha, files, error } = savedCommit(repo);
      if (error) return error;
      if (!files.some(isTestFile)) return `The commit changes no test file, so no test runs without the fix. Ask Claude to add one to the fix commit, then ${AMEND}.`;
      if (files.every(isTestFile)) return ONLY_TESTS;
      const result = testsWithoutFix(repo, sha, files);
      if (result.error) return result.error;
      return result.passed ? `Without the fix, \`npm test\` still passes, so the new test doesn't catch the bug. Add a regression test that fails on the old code, amend the fix and run ${SAVE_COMMIT} again.` : true;
    },
  },
  {
    text: 'the reported bug is fixed: a missing folder in `linkcheck.json` makes the tool exit with code 2 and name the folder',
    check(repo) {
      const dir = mkdtempSync(join(tmpdir(), 'linkcheck-'));
      try {
        writeFileSync(join(dir, 'linkcheck.json'), '{ "files": ["docs"] }\n');
        const run = spawnSync(process.execPath, [join(repo.dir, 'src', 'cli.js'), dir], { encoding: 'utf8', timeout: 30_000 });
        if (run.status !== 2) return `The tool exited with code ${run.status}, not 2. Read capstone/beginner-bug.md again.`;
        // The scratch folder's own path may hold any word, so it doesn't count.
        const said = `${run.stderr}\n${run.stdout}`.split(dir).join('');
        return /\bdocs\b/.test(said) ? true : `The tool exits with code 2, but its error doesn't name the missing folder, \`docs\`. Fix that inside the plan, amend the commit and run ${SAVE_COMMIT} again.`;
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  },
  testsPass,
  {
    text: 'a committed CLAUDE.md names the test command, `npm test`',
    check(repo) {
      for (const path of ['CLAUDE.md', '.claude/CLAUDE.md']) {
        try {
          return repo.git('show', `HEAD:${path}`).includes('npm test') ? true : 'The committed CLAUDE.md doesn\'t mention `npm test`. Add the test command and commit it.';
        } catch { /* not committed at this path */ }
      }
      return 'There is no committed CLAUDE.md. Run `/init` in a session, check the file, and commit it.';
    },
  },
  nothingUncommitted,
];
