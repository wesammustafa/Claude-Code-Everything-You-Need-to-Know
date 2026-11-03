// Settings precedence must not let an explicitly disabled local sandbox pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { items } from '../lessons/i-4.mjs';
import { openRepo } from '../repo.mjs';
import { commit, repo, rootWrite, withRepo, write } from './helpers.mjs';

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

// Ticket 295: Claude Code keeps the local file at the git root, the folder
// above a Practice copy's project/.
test('i-4: in a Practice copy, a local sandbox enable at the git root passes', () => {
  withRepo(() => {
    const dir = repo({ 'README.md': '# demo\n' }, { nested: true });
    commit(dir, 'Start');
    rootWrite(dir, { '.claude/settings.local.json': JSON.stringify({ sandbox: { enabled: true } }) });
    return dir;
  }, (dir) => {
    assert.equal(items[1].check(openRepo(dir)), true);
  });
});

test('i-4: in a Practice copy, a local file committed at the git root fails', () => {
  withRepo(() => {
    const dir = repo({ 'README.md': '# demo\n' }, { nested: true });
    rootWrite(dir, { '.claude/settings.local.json': JSON.stringify({ sandbox: { enabled: true } }) });
    commit(dir, 'Start', ['.', '../.claude/settings.local.json']);
    return dir;
  }, (dir) => {
    const result = items[1].check(openRepo(dir));
    assert.equal(typeof result, 'string');
    assert.match(result, /^\.\.\/\.claude\/settings\.local\.json is committed/);
  });
});

test('i-4: in a Practice copy, a project/ local file without a sandbox key keeps the root enable', () => {
  withRepo(() => {
    const dir = repo({ 'README.md': '# demo\n' }, { nested: true });
    commit(dir, 'Start');
    rootWrite(dir, { '.claude/settings.local.json': JSON.stringify({ sandbox: { enabled: true } }) });
    write(dir, { '.claude/settings.local.json': JSON.stringify({ permissions: { allow: [] } }) });
    return dir;
  }, (dir) => {
    assert.equal(items[1].check(openRepo(dir)), true);
  });
});

test('i-4: in a Practice copy, a root local disable wins over a project/ enable', () => {
  withRepo(() => {
    const dir = repo({ 'README.md': '# demo\n' }, { nested: true });
    commit(dir, 'Start');
    rootWrite(dir, { '.claude/settings.local.json': JSON.stringify({ sandbox: { enabled: false } }) });
    write(dir, { '.claude/settings.local.json': JSON.stringify({ sandbox: { enabled: true } }) });
    return dir;
  }, (dir) => {
    assert.match(items[1].check(openRepo(dir)), /sandbox is off/);
  });
});
