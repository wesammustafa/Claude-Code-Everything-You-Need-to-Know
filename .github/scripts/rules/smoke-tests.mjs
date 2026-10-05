// Each example's Claude-free smoke test, examples/**/test.sh, passes. On a
// pull request they run only when the change touches examples/.
import { spawnSync } from 'node:child_process';
import { join, posix } from 'node:path';
import { changedFiles } from '../lib/git.mjs';

export const id = 'smoke-tests';
export const modes = ['pr', 'release'];

const TIMEOUT_MS = 120_000;

export function run(ctx) {
  const tests = ctx.files.filter((f) => f.startsWith('examples/') && f.endsWith('/test.sh'));
  if (ctx.mode === 'pr' && ctx.base.sha && !changedFiles(ctx.root, ctx.base.sha).some((f) => f.startsWith('examples/'))) {
    return { status: 'pass', summary: 'no change under examples/' };
  }
  const problems = [];
  for (const test of tests) {
    const result = spawnSync('bash', ['test.sh'], { cwd: join(ctx.root, posix.dirname(test)), encoding: 'utf8', timeout: TIMEOUT_MS });
    if (result.status !== 0) {
      const tail = `${result.stdout}${result.stderr}`.trim().split('\n').slice(-5).join(' | ');
      problems.push(`${test}: ${result.error ? result.error.message : `exited ${result.status}`}${tail ? `: ${tail}` : ''}`);
    }
  }
  if (problems.length) return { status: 'fail', problems };
  return { status: 'pass', summary: `${tests.length} smoke tests` };
}
