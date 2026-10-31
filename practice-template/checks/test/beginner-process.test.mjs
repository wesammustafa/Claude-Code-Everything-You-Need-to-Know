// Runner failures cannot prove that the learner's regression test failed.
// Patch the builtin only in a child process; actual check items still copy
// files and execute their normal local git history/clone operations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { openRepo } from '../repo.mjs';
import { commit, repo, withRepo, write } from './helpers.mjs';
import { fileURLToPath } from 'node:url';

const helper = new URL('./helpers.mjs', import.meta.url).href;
const repoModule = new URL('../repo.mjs', import.meta.url).href;
const lessonModule = (lesson) => new URL(`../lessons/${lesson}.mjs`, import.meta.url).href;

function runItem(lesson, item, outcomes) {
  const script = `
    import childProcess from 'node:child_process';
    import { syncBuiltinESMExports } from 'node:module';
    import { withRepo, repo, write, commit } from ${JSON.stringify(helper)};
    import { openRepo } from ${JSON.stringify(repoModule)};
    const outcomes = ${JSON.stringify(outcomes)};
    const original = childProcess.spawnSync;
    let calls = 0;
    childProcess.spawnSync = (command, args, options) => {
      if (command.split(' ')[0] !== 'npm') return original(command, args, options);
      calls++;
      if (outcomes === null) return original(command, args, options);
      const result = outcomes[calls - 1];
      if (!result) throw new Error('unexpected extra npm test run');
      return { stdout: '', stderr: '', signal: null, ...result,
        ...(result.error ? { error: Object.assign(new Error('runner failure'), result.error) } : {}) };
    };
    syncBuiltinESMExports();
    const { items } = await import(${JSON.stringify(lessonModule(lesson))});
    const result = withRepo(() => repo(), dir => {
      write(dir, {
        'package.json': JSON.stringify({ type: 'module', scripts: { test: 'node --test test/*.test.js' } }),
        'src/cli.js': 'console.log("All relative links resolve.");',
        'src/links.js': 'export function isExternal(target) { return target.startsWith("//"); }',
        'src/fix.js': 'export const fixed = false;',
      });
      commit(dir, 'Initial');
      write(dir, { 'src/fix.js': 'export const fixed = true;', 'test/fix.test.js': ${JSON.stringify(lesson === 'b-3' ? `import assert from 'node:assert/strict'; import { isExternal } from '../src/links.js'; assert.equal(isExternal('/docs/setup.md'), false);` : `import assert from 'node:assert/strict'; import { fixed } from '../src/fix.js'; assert.equal(fixed, true);`)} });
      const sha = commit(dir, 'Fix with regression test');
      write(dir, { '.practice/capstone-commit.txt': sha });
      return items[${item}].check(openRepo(dir));
    });
    process.stdout.write(JSON.stringify({ result, calls }));
  `;
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const run = spawnSync(process.execPath, ['--input-type=module'], { input: script, encoding: 'utf8', env, cwd: fileURLToPath(new URL('../../', import.meta.url)) });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
}

const faults = [
  ['missing executable', { status: null, error: { code: 'ENOENT' } }, 'ENOENT'],
  ['timeout', { status: null, error: { code: 'ETIMEDOUT' } }, 'ETIMEDOUT'],
  ['output limit', { status: null, error: { code: 'ENOBUFS' }, stdout: '# fail 1\n' }, 'ENOBUFS'],
  ['signal', { status: null, signal: 'SIGTERM' }, 'SIGTERM'],
  ['missing exit status', { status: null }, 'exit status'],
  ['error despite numeric status', { status: 1, error: { code: 'ENOBUFS' }, stdout: '# fail 1\n' }, 'ENOBUFS'],
  ['shell lookup failure', { status: 127, stderr: 'npm: command not found' }, '127'],
  ['Windows shell lookup failure', { status: 9009, stderr: "'npm' is not recognized" }, '9009'],
  ['Windows command processor error', { status: 1, stderr: "'npm' is not recognized as an internal or external command" }, '1'],
  ['script failure after passing tests', { status: 1, stdout: '# tests 1\n# pass 1\n# fail 0\n' }, '1'],
];

for (const [name, failure, reason] of faults) {
  test(`b-3: ${name} in the mutant run is not a caught regression`, () => {
    const { result, calls } = runItem('b-3', 2, [{ status: 0 }, failure]);
    assert.equal(calls, 2);
    assert.equal(typeof result, 'string', 'the check must fail rather than credit the mutant');
    assert.match(result, /did not finish/);
    assert.ok(result.includes(reason), result);
  });
  test(`capstone: ${name} without the fix is not a failing regression test`, () => {
    const { result, calls } = runItem('b-capstone', 2, [failure]);
    assert.equal(calls, 1);
    assert.equal(typeof result, 'string', 'the check must fail rather than credit the missing fix');
    assert.match(result, /did not finish/);
    assert.ok(result.includes(reason), result);
  });
}

for (const lesson of ['b-3', 'b-capstone']) {
  for (const [reporter, output] of [['TAP', '# tests 1\n# fail 1\n'], ['ANSI spec', '\x1b[34mℹ fail 2\x1b[39m\n']]) {
    test(`${lesson}: a nonzero exit with ${reporter} failing-test evidence proves the regression`, () => {
      const failed = { status: 1, stdout: output };
      const outcomes = lesson === 'b-3' ? [{ status: 0 }, failed] : [failed];
      assert.equal(runItem(lesson, 2, outcomes).result, true);
    });
  }
  test(`${lesson}: passing tests without the fix still fail the check`, () => {
    const outcomes = lesson === 'b-3' ? [{ status: 0 }, { status: 0 }] : [{ status: 0 }];
    assert.match(runItem(lesson, 2, outcomes).result, /still pass/);
  });
}

test('b-3: an execution failure before mutation reports the runner problem', () => {
  const { result, calls } = runItem('b-3', 2, [{ status: null, error: { code: 'ENOENT' } }]);
  assert.equal(calls, 1);
  assert.match(result, /did not finish/);
  assert.match(result, /ENOENT/);
});

test('the ordinary tests-pass item refuses a runner error even with status zero', () => {
  const { result, calls } = runItem('b-3', 4, [{ status: 0, error: { code: 'ENOBUFS' } }]);
  assert.equal(calls, 1);
  assert.equal(typeof result, 'string');
  assert.match(result, /`npm test` fails/);
  assert.match(result, /ENOBUFS/);
});

for (const lesson of ['b-3', 'b-capstone']) {
  test(`${lesson}: real npm tests reject the planted or pre-fix source`, () => {
    const { result, calls } = runItem(lesson, 2, null);
    assert.equal(result, true);
    assert.equal(calls, lesson === 'b-3' ? 2 : 1);
  });
}

// A copy's git root sits above project/, where the checks run: git names
// paths from the root there, and `HEAD:path` reads from it too.
const runGit = (dir, ...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
const lessonItems = Object.fromEntries(await Promise.all(['b-2', 'b-3', 'b-4', 'b-5', 'b-capstone']
  .map(async (lesson) => [lesson, (await import(lessonModule(lesson))).items])));
const outcomes = (lesson, dir, which) => {
  const repo = openRepo(dir);
  return which.map((i) => lessonItems[lesson][i].check(repo));
};
const pkg = JSON.stringify({ name: 'claude-code-practice', type: 'module', scripts: { test: 'node --test test/', linkcheck: 'node src/cli.js' } });

test('nested: b-2 reads its snapshots from project/', () => {
  withRepo(() => repo({ 'package.json': pkg, 'src/config.js': 'export const a = 1;\n' }, { nested: true }), (dir) => {
    commit(dir, 'Start');
    write(dir, { '.practice/b-2-before.txt': runGit(dir, 'status', '--porcelain'), '.practice/b-2-plan.txt': 'src/config.js\n' });
    write(dir, { 'src/config.js': 'export const a = 2;\n' });
    write(dir, { '.practice/b-2-after.txt': runGit(dir, 'status', '--porcelain') });
    assert.deepEqual(outcomes('b-2', dir, [0, 1]), [true, true]);
  });
});

test('nested: b-3 reads the last commit and the tree from project/', () => {
  withRepo(() => repo({ 'package.json': pkg, 'src/a.js': 'export const a = 1;\n' }, { nested: true }), (dir) => {
    commit(dir, 'Start');
    write(dir, { 'src/a.js': 'export const a = 2;\n', 'test/a.test.js': 'import "../src/a.js";\n' });
    commit(dir, 'Fix');
    assert.deepEqual(outcomes('b-3', dir, [3, 5]), [true, true]);
    write(dir, { 'src/a.js': 'export const a = 3;\n' });
    assert.match(outcomes('b-3', dir, [5])[0], /uncommitted: src\/a\.js\./);
  });
});

test('nested: b-4 reads the refactor and the rewind snapshots from project/', () => {
  const files = {
    'package.json': pkg,
    'src/links.js': 'export function findLinks() { return []; }\n',
    'src/check-links.js': 'export async function brokenLinks() { return []; }\n',
    'src/cli.js': 'console.log("All relative links resolve.");\n',
  };
  withRepo(() => repo(files, { nested: true }), (dir) => {
    commit(dir, 'Start');
    write(dir, { 'src/check-links.js': 'export function brokenLinks() { return []; }\n' });
    commit(dir, 'Refactor');
    write(dir, { 'src/links.js': 'export function extractLinks() { return []; }\n', 'src/check-links.js': '// edited\nexport function brokenLinks() { return []; }\n' });
    write(dir, { '.practice/b-4-before-rewind.txt': runGit(dir, 'status', '--porcelain') });
    runGit(dir, 'checkout', '--', 'src/check-links.js');
    write(dir, { '.practice/b-4-after-rewind.txt': runGit(dir, 'status', '--porcelain') });
    runGit(dir, 'checkout', '--', 'src/links.js');
    assert.deepEqual(outcomes('b-4', dir, [0, 1, 2, 3]), [true, true, true, true]);
  });
});

test('nested: b-5 reads CLAUDE.md, the ignore rule and the history from project/', () => {
  withRepo(() => repo({ 'package.json': pkg, 'src/a.js': 'export const a = 1;\n' }, { nested: true }), (dir) => {
    commit(dir, 'Start');
    write(dir, {
      'CLAUDE.md': '## Conventions\n- Every new JavaScript file in `src/` starts with the line `// SPDX-License-Identifier: MIT`.\n- CLI errors start with `linkcheck:`.\n- Run `npm run linkcheck -- docs`.\n',
      '.gitignore': 'CLAUDE.local.md\n',
      'CLAUDE.local.md': '- linkcheck-docs\n',
    });
    commit(dir, 'Memory', ['CLAUDE.md', '.gitignore']);
    write(dir, { 'src/stats.js': '// SPDX-License-Identifier: MIT\nexport const n = 1;\n' });
    commit(dir, 'Stats', ['src/stats.js']);
    assert.deepEqual(outcomes('b-5', dir, [0, 1, 2, 3]), [true, true, true, true]);
  });
});

test('nested: b-capstone runs the tests without the fix from the clone\'s project/', () => {
  const files = { 'package.json': pkg, 'src/fix.js': 'export const fixed = false;\n', 'CLAUDE.md': 'Run `npm test`.\n' };
  withRepo(() => repo(files, { nested: true }), (dir) => {
    commit(dir, 'Start');
    write(dir, { '.practice/capstone-before.txt': runGit(dir, 'status', '--porcelain'), '.practice/capstone-plan.txt': 'src/fix.js\ntest/fix.test.js\n' });
    write(dir, { 'src/fix.js': 'export const fixed = true;\n', 'test/fix.test.js': 'import assert from "node:assert/strict";\nimport { fixed } from "../src/fix.js";\nassert.equal(fixed, true);\n' });
    const sha = commit(dir, 'Fix');
    write(dir, { '.practice/capstone-commit.txt': `${sha}\n` });
    // NODE_TEST_CONTEXT would make the check's own `npm test` skip its tests.
    const saved = process.env.NODE_TEST_CONTEXT;
    delete process.env.NODE_TEST_CONTEXT;
    try {
      assert.deepEqual(outcomes('b-capstone', dir, [0, 1, 2, 5, 6]), [true, true, true, true, true]);
    } finally {
      if (saved !== undefined) process.env.NODE_TEST_CONTEXT = saved;
    }
  });
});

test('every HEAD: read in the checks is cwd-relative', () => {
  const root = new URL('../', import.meta.url);
  const files = [...readdirSync(root).filter((f) => f.endsWith('.mjs')).map((f) => new URL(f, root)),
    ...readdirSync(new URL('lessons/', root)).filter((f) => f.endsWith('.mjs')).map((f) => new URL(`lessons/${f}`, root))];
  const bare = files.flatMap((url) => readFileSync(url, 'utf8').split('\n')
    .map((line, i) => [line, i + 1])
    .filter(([line]) => /HEAD:(?:\$\{|[A-Za-z])/.test(line))
    .map(([, n]) => `${fileURLToPath(url)}:${n}`));
  assert.deepEqual(bare, [], 'write HEAD:./<path>: in a copy the git root is above project/');
});
