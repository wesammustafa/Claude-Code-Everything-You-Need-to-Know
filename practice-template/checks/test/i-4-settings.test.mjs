// Settings precedence must not let an explicitly disabled local sandbox pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { items } from '../lessons/i-4.mjs';
import { openRepo } from '../repo.mjs';
import { commit, repo, withRepo, write } from './helpers.mjs';

for (const [name, sharedEnabled, local, expected] of [
  ['an explicit local disable overrides shared enable', true, { sandbox: { enabled: false } }, false],
  ['an explicit local enable overrides shared disable', false, { sandbox: { enabled: true } }, true],
  ['an unrelated local setting keeps the shared enable', true, { permissions: { allow: [] } }, true],
]) {
  test(`i-4: ${name}`, () => {
    withRepo(() => {
      const shared = { sandbox: { enabled: sharedEnabled } };
      const dir = repo({ '.claude/settings.json': JSON.stringify(shared) });
      commit(dir, 'Share sandbox setting', ['.claude/settings.json']);
      write(dir, { '.claude/settings.local.json': JSON.stringify(local) });
      return dir;
    }, (dir) => {
      const result = items[1].check(openRepo(dir));
      if (expected) assert.equal(result, true);
      else {
        assert.equal(typeof result, 'string', 'the locally disabled sandbox must fail');
        assert.match(result, /sandbox is off/);
      }
    });
  });
}
