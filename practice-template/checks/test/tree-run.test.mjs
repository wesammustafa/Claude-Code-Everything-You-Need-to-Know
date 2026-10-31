import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { findBash } from '../stub-claude.mjs';

const TREE_RUN = fileURLToPath(new URL('../tree-run.mjs', import.meta.url));

// The bash the stand-in uses, never WSL's launcher from PATH.
const bash = findBash();

const treeRun = (args, timeout) => {
  const run = spawnSync(process.execPath, [TREE_RUN], { input: JSON.stringify({ command: bash, args, cwd: tmpdir(), env: process.env, timeout }), encoding: 'utf8', timeout: timeout + 10_000 });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout);
};

test('tree-run relays the status, stdout and stderr of a command that ends on its own', { skip: bash === null && 'no Git Bash' }, () => {
  const told = treeRun(['-c', 'echo out; echo err >&2; exit 3'], 10_000);
  assert.deepEqual(told, { status: 3, signal: null, timedOut: false, stdout: 'out\n', stderr: 'err\n' });
});

test('tree-run ends the command and what it left running at the time limit', { skip: bash === null && 'no Git Bash' }, async () => {
  const outside = mkdtempSync(join(tmpdir(), 'tree-run-'));
  const beat = join(outside, 'beat');
  try {
    const started = Date.now();
    const told = treeRun(['-c', `( while :; do date > "${beat}"; sleep 0.1; done ) & sleep 30`], 1000);
    assert.equal(told.timedOut, true);
    assert.ok(Date.now() - started < 10_000, 'the run went on past the time limit');
    const last = statSync(beat).mtimeMs;
    await wait(600);
    assert.equal(statSync(beat).mtimeMs, last, 'the background loop is still running');
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
});

test('tree-run says when the command cannot start', () => {
  const run = spawnSync(process.execPath, [TREE_RUN], { input: JSON.stringify({ command: join(tmpdir(), 'no-such-command'), args: [], cwd: tmpdir(), env: process.env, timeout: 1000 }), encoding: 'utf8', timeout: 10_000 });
  assert.equal(JSON.parse(run.stdout).error.code, 'ENOENT');
});
