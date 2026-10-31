// The CI template job runs the whole fresh-copy proof on Node 22 and on the
// .nvmrc line, with Claude Code at the CHANGELOG baseline and Chromium
// installed, and the required checks job fails when it does. A skip flag, a
// dropped leg, a dropped install or a dropped need would let the proof go
// partial or quiet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const workflow = readFileSync(join(root, '.github/workflows/checks.yml'), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const release = JSON.parse(readFileSync(join(root, 'quest/release/package.json'), 'utf8'));

// The text of one top-level job: from its id line to the next job id. Copied
// from e2e-job.test.mjs.
function job(id) {
  const lines = workflow.split('\n');
  const start = lines.indexOf(`  ${id}:`);
  assert.notEqual(start, -1, `no ${id} job`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^  [a-z][\w-]*:\s*$/.test(l));
  return rest.slice(0, end === -1 ? undefined : end).join('\n');
}

test('the template job runs on Node 22 and the .nvmrc line, neither cancelling the other', () => {
  const template = job('template');
  assert.match(template, /^\s+fail-fast: false$/m);
  assert.match(template, /^\s+node-version: '22'$/m);
  assert.match(template, /^\s+node-version-file: \.nvmrc$/m);
  assert.match(template, /^\s+node-version: \$\{\{ matrix\.node-version \}\}$/m);
  assert.match(template, /^\s+node-version-file: \$\{\{ matrix\.node-version-file \}\}$/m);
});

test('the template job runs npm run proof once, with no flag', () => {
  const runs = [...job('template').matchAll(/^\s+(?:- )?run: (.*\bproof\b.*)$/gm)].map((m) => m[1].trim());
  assert.deepEqual(runs, ['npm run proof']);
});

test('npm run proof is the proof script with nothing added', () => {
  assert.equal(pkg.scripts.proof, 'npm run proof --workspace @quest/release --');
  assert.equal(release.scripts.proof, 'node src/proof.mjs');
});

test('the template job installs Claude Code at the CHANGELOG baseline, and Chromium', () => {
  const template = job('template');
  assert.match(
    template,
    /v=\$\(sed -n 's\/\^Baseline: Claude Code v\\\(\[0-9\.\]\*\\\) \.\*\/\\1\/p' CHANGELOG\.md\) && test -n "\$v" && npm i -g "@anthropic-ai\/claude-code@\$v" && claude --version/,
  );
  assert.match(template, /^\s+- run: npx playwright install --with-deps chromium$/m);
});

test('the required checks job needs template and fails unless it succeeded', () => {
  const checks = job('checks');
  assert.match(checks, /^\s+needs: \[[^\]]*\btemplate\b[^\]]*\]$/m);
  assert.match(checks, /^\s+if: always\(\)$/m);
  assert.match(checks, /all\(\.\[\]; \.result == "success"\)/);
});
