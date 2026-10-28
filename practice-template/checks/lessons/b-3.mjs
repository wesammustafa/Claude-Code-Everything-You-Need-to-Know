// Your first change, from request to commit (Beginner, lesson 3). The check
// gathers its own evidence: it runs the practice app's link checker on
// Markdown it writes to a temporary folder, runs the Learner's tests against
// the planted patch's flaw, and reads the last commit and the working tree.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { isTestFile } from '../paths.mjs';

export const title = 'Your first change, from request to commit';

// The longest `npm test` may run, in milliseconds.
export const NPM_TEST_LIMIT = 120_000;

const npmTest = (dir) => spawnSync('npm', ['test', '--silent'], { cwd: dir, encoding: 'utf8', shell: process.platform === 'win32', timeout: NPM_TEST_LIMIT });

// A shell lookup or script failure is not evidence of a failing Node test.
// Mutation checks require its TAP/spec failure summary as well as an exit.
export function testRunError(run, { requireFailure = false } = {}) {
  const completed = !run.error && !run.signal && Number.isInteger(run.status) && run.status >= 0;
  if (completed) {
    if (!requireFailure || run.status === 0) return null;
    const output = stripVTControlCharacters(`${run.stdout ?? ''}\n${run.stderr ?? ''}`);
    if (/^[ \t]*(?:#|ℹ)[ \t]+fail[ \t]+[1-9]\d*[ \t\r]*$/m.test(output)) return null;
  }
  const reason = run.error?.code || run.signal || run.error?.message
    || (completed ? `exit ${run.status}, no failing Node test result` : 'no exit status');
  return `\`npm test\` did not finish (${reason}). Fix the test runner and retry; this does not prove a failing test.`;
}

// Lesson 3 runs the template's own link checker and plants its patch there, so
// it can't check another repository.
function notTemplate(repo) {
  const missing = ['src/cli.js', 'src/links.js'].filter((path) => !repo.exists(path));
  return missing.length ? `This folder has no ${missing.map((p) => `\`${p}\``).join(' or ')}. Lesson 3 runs the practice template's link checker and reviews a patch planted in it, so do this lesson in your template copy and run the check there.` : null;
}

// Runs the repository's link checker on a folder holding `files`, and returns
// the targets it reports as broken, by line of doc.md.
function brokenIn(repo, files) {
  const dir = mkdtempSync(join(tmpdir(), 'b3-links-'));
  try {
    for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
    const run = spawnSync(process.execPath, [join(repo.dir, 'src', 'cli.js'), dir], { encoding: 'utf8', timeout: 30_000 });
    // Node also exits with 1 when the checker crashes, so a run counts only
    // when it ends with the checker's own summary line.
    const stdout = run.stdout ?? '';
    if (![0, 1].includes(run.status) || !/^(\d+ broken link\(s\)|All relative links resolve\.)$/m.test(stdout)) {
      const lines = (run.stderr ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
      const first = lines.find((l) => /^[A-Za-z]*Error\b/.test(l)) ?? lines[0];
      return { error: `\`node src/cli.js\` crashed${first ? `: ${first}` : ` (exit code ${run.status})`}. Run \`npm test\`, read the first failure, and ask Claude to fix the code.` };
    }
    const broken = new Map();
    for (const m of stdout.matchAll(/^doc\.md:(\d+): broken link to (.*)$/gm)) broken.set(Number(m[1]), m[2]);
    return { broken };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Whether the last commit holds the patch's test: the Learner committed their
// fix, so a flaw that is still there gets a more specific hint.
function patchCommitted(repo) {
  try {
    repo.gitLocal('cat-file', '-e', 'HEAD:test/external.test.js');
    return true;
  } catch {
    return false;
  }
}

// isExternal as the patch practice/b-3/protocol-relative.patch writes it.
const PLANTED = `export * from './links.checked.js';
export function isExternal(target) {
  return target.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(target);
}
`;

export const testsPass = {
  text: 'the tests pass',
  check(repo) {
    const pkg = repo.read('package.json');
    let hasScript = false;
    try { hasScript = Boolean(pkg && JSON.parse(pkg).scripts?.test); } catch { /* not JSON */ }
    if (hasScript) {
      const run = npmTest(repo.dir);
      const error = testRunError(run);
      return error ? `\`npm test\` fails. ${error}` : run.status === 0 ? true : '`npm test` fails. Run it, read the first failure, and ask Claude to fix the code, not the test.';
    }
    const saved = repo.read('.practice/b-3-tests.txt');
    const save = '`<your test command>; echo $? > .practice/b-3-tests.txt` (Windows: end with `$LASTEXITCODE > .practice/b-3-tests.txt`)';
    if (saved === null) return `This repository has no \`npm test\` script. Save your tests' exit code: ${save}.`;
    const code = saved.trim();
    if (code === '0') return true;
    // In PowerShell, `$?` is True or False rather than an exit code.
    if (!/^-?\d+$/.test(code)) return `\`.practice/b-3-tests.txt\` holds "${code}", not an exit code. Save it again: ${save}.`;
    return `\`.practice/b-3-tests.txt\` says the tests exited with ${code}, not 0.`;
  },
};

export const nothingUncommitted = {
  text: 'nothing is left uncommitted',
  check(repo) {
    const status = repo.git('status', '--porcelain').split('\n').filter((l) => l && !l.slice(3).startsWith('.practice/'));
    // Plain `git stash` leaves new, untracked files behind.
    return status.length ? `These changes are uncommitted: ${status.map((l) => l.slice(3)).join(', ')}. Commit them, or set them aside with \`git stash push --include-untracked\`.` : true;
  },
};

export const items = [
  {
    text: 'links with a title, in double or single quotes, are checked',
    check(repo) {
      const other = notTemplate(repo);
      if (other) return other;
      const { broken, error } = brokenIn(repo, {
        'setup.md': '# Setup\n',
        'doc.md': '[setup](setup.md "Setup guide")\n[gone](gone.md "Old page")\n[old](old.md \'Old page\')\n',
      });
      if (error) return error;
      if (broken.has(1)) return `The checker reports \`[setup](setup.md "Setup guide")\` as a broken link to \`${broken.get(1)}\`, though setup.md exists. Ask Claude to leave the title out of the target, with a test.`;
      const links = { 2: ['`[gone](gone.md "Old page")`', 'gone.md'], 3: ['`[old](old.md \'Old page\')`', 'old.md'] };
      const skipped = [2, 3].filter((line) => !broken.has(line)).map((line) => links[line][0]);
      if (skipped.length) return `The checker skips ${skipped.join(' and ')}. Finish the worked example: links with a title, in double or single quotes, are checked, with a test for each.`;
      const wrong = [2, 3].filter((line) => broken.get(line) !== links[line][1]);
      return wrong.length ? `The checker reads the target of ${links[wrong[0]][0]} as \`${broken.get(wrong[0])}\`, not \`${links[wrong[0]][1]}\`. Ask Claude to leave the title out of the target, with a test for it.` : true;
    },
  },
  {
    text: 'protocol-relative links, such as `//cdn.example.com/app.js`, are skipped, and every other link is checked as before',
    check(repo) {
      const other = notTemplate(repo);
      if (other) return other;
      const { broken, error } = brokenIn(repo, { 'doc.md': '[app](//cdn.example.com/app.js)\n[root](/missing.md)\n[page](missing.md)\n' });
      if (error) return error;
      if (broken.has(1)) return 'The checker still reports `//cdn.example.com/app.js` as broken. Apply `git apply practice/b-3/protocol-relative.patch`, then fix the flaw (Your turn, step 2).';
      const links = { 2: '`[root](/missing.md)`', 3: '`[page](missing.md)`' };
      const skipped = [2, 3].filter((line) => !broken.has(line));
      if (!skipped.length) return true;
      // Before the Learner commits a fix, the hint leaves finding the flaw to them.
      if (!patchCommitted(repo)) return 'The checker skips a link that the patch\'s description says is still checked: the flaw is still there. Compare that description with what the new line skips, and tell Claude (Your turn, steps 1 and 3).';
      return `Your commit still skips ${skipped.map((line) => links[line]).join(' and ')}. Compare that with the patch's description, fix the rule, add a test that fails on the patch, and commit both.`;
    },
  },
  {
    text: 'your tests catch the planted flaw: with the patch\'s `isExternal` put back, they fail',
    check(repo) {
      const other = notTemplate(repo);
      if (other) return other;
      const dir = mkdtempSync(join(tmpdir(), 'b3-planted-'));
      try {
        cpSync(repo.dir, dir, { recursive: true, filter: (src) => !/[\\/](\.git|node_modules|\.practice)$/.test(src) });
        const before = npmTest(dir);
        const beforeError = testRunError(before);
        if (beforeError || before.status !== 0) return beforeError ?? 'The tests fail as they are. Make `npm test` pass first.';
        cpSync(join(dir, 'src', 'links.js'), join(dir, 'src', 'links.checked.js'));
        writeFileSync(join(dir, 'src', 'links.js'), PLANTED);
        const mutant = npmTest(dir);
        const mutantError = testRunError(mutant, { requireFailure: true });
        if (mutantError || mutant.status !== 0) return mutantError ?? true;
        if (!patchCommitted(repo)) return 'Your tests still pass with the patch\'s `isExternal` put back, so none of them catches its flaw yet. Once you have found the flaw (Your turn, step 1), ask Claude for a test that fails on the patch\'s version.';
        return 'Your tests still pass with the patch\'s `isExternal` put back: none of them fails on a link the patch skips by mistake. Add a regression case for that link and commit it.';
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  },
  {
    text: 'your last commit changes a test file and at least one other file',
    check(repo) {
      try {
        repo.git('rev-parse', '--verify', '--quiet', 'HEAD^');
      } catch {
        return 'There is no commit of yours yet. Once the fix and its test are in, ask Claude to commit them together.';
      }
      // A merge's combined diff can omit files changed by only one parent.
      const files = repo.git('diff', '--name-only', 'HEAD^', 'HEAD').split('\n').filter(Boolean);
      const tests = files.filter(isTestFile);
      if (!tests.length) return `Your last commit changes no test file (${files.join(', ') || 'no files'}): none is in a test/ folder or named like links.test.js. Add one, then \`git commit --amend\`.`;
      if (tests.length === files.length) return `Your last commit changes only tests (${files.join(', ')}). If the code change is in the commit before it, ask Claude to combine the two commits into one.`;
      return true;
    },
  },
  testsPass,
  nothingUncommitted,
];
