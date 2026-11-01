// The CI e2e job runs every Playwright spec, the browser security suite
// included, and the required checks job fails when e2e does. A spec filter,
// a --grep, a dropped step or a dropped need would let the suite go quiet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const workflow = readFileSync(join(root, '.github/workflows/checks.yml'), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

// The text of one top-level job: from its id line to the next job id.
function job(id) {
  const lines = workflow.split('\n');
  const start = lines.indexOf(`  ${id}:`);
  assert.notEqual(start, -1, `no ${id} job`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^  [a-z][\w-]*:\s*$/.test(l));
  return rest.slice(0, end === -1 ? undefined : end).join('\n');
}

test('the e2e job runs npm run e2e with no filter', () => {
  const runs = [...job('e2e').matchAll(/^\s+(?:- )?run: (.*npm run e2e.*)$/gm)].map((m) => m[1].trim());
  assert.deepEqual(runs, ['npm run e2e']);
});

test('npm run e2e is the whole Playwright suite', () => {
  assert.equal(pkg.scripts.e2e, 'playwright test -c quest/client/playwright.config.ts');
  const config = readFileSync(join(root, 'quest/client/playwright.config.ts'), 'utf8');
  assert.doesNotMatch(config, /\b(grep|grepInvert|testIgnore|testMatch)\s*:/);
  assert.ok(existsSync(join(root, 'quest/client/e2e/security.spec.ts')));
});

test('the required checks job needs e2e and fails unless it succeeded', () => {
  const checks = job('checks');
  assert.match(checks, /^\s+needs: \[[^\]]*\be2e\b[^\]]*\]$/m);
  assert.match(checks, /^\s+if: always\(\)$/m);
  assert.match(checks, /all\(\.\[\]; \.result == "success"\)/);
});
