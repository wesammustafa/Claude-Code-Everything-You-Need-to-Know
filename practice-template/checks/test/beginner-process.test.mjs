// Runner failures cannot prove that the learner's regression test failed.
// Patch the builtin only in a child process; actual check items still copy
// files and execute their normal local git history/clone operations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
      if (command !== 'npm') return original(command, args, options);
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
