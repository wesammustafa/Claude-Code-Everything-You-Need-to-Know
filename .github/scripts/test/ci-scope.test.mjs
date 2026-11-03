// The changes job runs only the Guide checks jobs a pull request needs. A
// file that reaches the build, the template or the app must run every job,
// and the required checks job must still fail when changes or guide fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scope } from '../ci-scope.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const workflow = readFileSync(join(root, '.github/workflows/checks.yml'), 'utf8');

const none = { code: false, app: false, platforms: false };
const all = { code: true, app: true, platforms: true };

test('README, images, the check scripts and the unscheduled-for-PR workflows run only guide', () => {
  assert.deepEqual(scope(['README.md', 'assets/brand/pip.svg', 'CONTRIBUTING.md']), none);
  assert.deepEqual(scope(['.github/scripts/rules/images.mjs', '.github/scripts/test/ci-scope.test.mjs']), none);
  assert.deepEqual(scope(['.github/workflows/links-weekly.yml', '.github/PULL_REQUEST_TEMPLATE.md']), none);
});

test('an app unit test or lint config adds quest only', () => {
  const quest = { code: true, app: false, platforms: false };
  assert.deepEqual(scope(['quest/engine/test/snapshot.test.mjs']), quest);
  assert.deepEqual(scope(['quest/client/src/screens/beat.test.ts', 'eslint.config.mjs']), quest);
});

test("the Checks' tests add quest and the macOS and Windows job", () => {
  assert.deepEqual(scope(['practice-template/checks/test/intermediate.test.mjs']), { code: true, app: false, platforms: true });
});

test('anything that reaches the build, the template or the app runs every job', () => {
  for (const file of [
    'quest/engine/src/engine.ts',
    'quest/client/e2e/play.ts',
    'course/steps/i-2.md',
    'docs/beginner/01-install-and-look-around.md',
    'practice-template/checks/lessons/i-8.mjs',
    'solutions/i-1/steps.sh',
    'examples/hooks/README.md',
    'package-lock.json',
    '.nvmrc',
    'CHANGELOG.md',
    '.github/workflows/checks.yml',
  ])
    assert.deepEqual(scope(['README.md', file]), all, file);
});

test('each job runs on its own output of the changes job', () => {
  for (const [job, out] of [['quest', 'code'], ['e2e', 'app'], ['template', 'app'], ['platforms', 'platforms']])
    assert.match(workflow, new RegExp(`^  ${job}:\\n    needs: changes\\n    if: needs\\.changes\\.outputs\\.${out} == 'true'\\n`, 'm'), job);
  assert.doesNotMatch(workflow, /^  guide:\n    needs:/m);
});

test('a push to main or a manual run runs every job', () => {
  assert.match(workflow, /if \[ -n "\$BASE_SHA" \]; then node \.github\/scripts\/ci-scope\.mjs --base "\$BASE_SHA"; else node \.github\/scripts\/ci-scope\.mjs; fi/);
  assert.match(workflow, /BASE_SHA: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
});
