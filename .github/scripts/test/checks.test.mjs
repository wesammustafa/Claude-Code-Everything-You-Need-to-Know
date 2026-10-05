// Self-test for the guide checks: every committed fixture must get the
// verdict it declares from the rule it names, and the real tree must pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { materialize, runChecks } from './harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, '..', 'fixtures');

for (const name of readdirSync(fixturesDir).sort()) {
  const dir = join(fixturesDir, name);
  if (!existsSync(join(dir, 'fixture.json'))) continue;
  const spec = JSON.parse(readFileSync(join(dir, 'fixture.json'), 'utf8'));
  test(`${name}: ${spec.rule} should ${spec.expect}`, async () => {
    const tree = await materialize(dir, spec);
    try {
      const { code, output } = runChecks(tree.root, {
        only: spec.rule,
        mode: spec.mode ?? 'pr',
        base: tree.base,
        tag: spec.tag,
      });
      if (spec.expect === 'fail') {
        assert.notEqual(code, 0, output);
        assert.match(output, new RegExp(`^FAIL ${spec.rule}\\b`, 'm'), output);
      } else {
        assert.equal(code, 0, output);
        assert.doesNotMatch(output, /^FAIL /m, output);
      }
    } finally {
      tree.cleanup();
    }
  });
}

test('the real tree passes in pr mode', () => {
  const repoRoot = join(here, '..', '..', '..');
  const { code, output } = runChecks(repoRoot, { mode: 'pr' });
  assert.equal(code, 0, output);
});
