// The CI platforms job runs the Checks' tests and the template's start-up on
// macOS and Windows, and the required checks job fails when either leg does.
// A dropped leg, a step behind an if:, a continue-on-error, a dropped need or
// a single-quoted glob, which cmd.exe hands to node as is, would let a
// platform's failure go quiet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const workflow = readFileSync(join(root, '.github/workflows/checks.yml'), 'utf8');
const readJson = (path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

// Copied from e2e-job.test.mjs.
// The text of one top-level job: from its id line to the next job id.
function job(id) {
  const lines = workflow.split('\n');
  const start = lines.indexOf(`  ${id}:`);
  assert.notEqual(start, -1, `no ${id} job`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^  [a-z][\w-]*:\s*$/.test(l));
  return rest.slice(0, end === -1 ? undefined : end).join('\n');
}

test('the platforms job runs on macOS and Windows in bash, every leg to the end', () => {
  const platforms = job('platforms');
  assert.match(platforms, /^\s+os: \[macos-latest, windows-latest\]$/m);
  assert.match(platforms, /^\s+fail-fast: false$/m);
  assert.match(platforms, /^\s+runs-on: \$\{\{ matrix\.os \}\}$/m);
  assert.match(platforms, /^\s+defaults:\n\s+run:\n\s+shell: bash$/m);
});

test('the platforms job runs every step, in order, with no condition', () => {
  const platforms = job('platforms');
  const runs = [...platforms.matchAll(/^\s+(?:- )?run: (.*)$/gm)].map((m) => m[1].trim());
  assert.deepEqual(runs, [
    'npm ci',
    'npm run test:checks',
    'npm run build',
    'npm run template -- "$RUNNER_TEMP/tpl"',
    'npm run startup -- "$RUNNER_TEMP/tpl"',
  ]);
  assert.doesNotMatch(platforms, /^\s+(?:- )?if:/m);
  assert.doesNotMatch(platforms, /continue-on-error/);
});

test('npm run startup is the proof\'s start-up step without Chromium', () => {
  assert.equal(readJson('package.json').scripts.startup, 'npm run startup --workspace @quest/release --');
  assert.equal(readJson('quest/release/package.json').scripts.startup, 'node src/startup.mjs');
  const source = readFileSync(join(root, 'quest/release/src/startup.mjs'), 'utf8');
  assert.match(source, /\bserves\b/);
  assert.match(source, /chromium: false/);
});

test('the scripts the platforms job runs guard main() with isMain', () => {
  // A raw argv[1] string compare can miss on Windows and exit 0 unchecked.
  for (const file of ['startup.mjs', 'template.mjs', 'upgrade.mjs']) {
    const source = readFileSync(join(root, 'quest/release/src', file), 'utf8');
    assert.match(source, /^if \(isMain\(import\.meta\.url\)\)/m, file);
    assert.doesNotMatch(source, /process\.argv\[1\] ===/, file);
  }
});

test('the required checks job needs platforms and fails unless it succeeded', () => {
  const checks = job('checks');
  assert.match(checks, /^\s+needs: \[[^\]]*\bplatforms\b[^\]]*\]$/m);
  assert.match(checks, /^\s+if: always\(\)$/m);
  assert.match(checks, /all\(\.\[\]; \.result == "success"\)/);
});

test('no package script single-quotes a glob', () => {
  const files = [
    'package.json',
    ...readdirSync(join(root, 'practice-template'), { recursive: true })
      .filter((p) => p.endsWith('package.json') && !p.includes('node_modules'))
      .map((p) => join('practice-template', p)),
  ];
  for (const file of files) {
    for (const [name, script] of Object.entries(readJson(file).scripts ?? {})) {
      assert.doesNotMatch(script, /'[^']*\*[^']*'/, `${file} ${name}`);
    }
  }
});
