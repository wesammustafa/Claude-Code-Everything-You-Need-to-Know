// The template is built from this repo's checkout and stores each file's
// bytes as they are. Windows' git checks out with core.autocrlf=true, so
// without the root .gitattributes the template's blobs would carry CRLF and
// the upgrade's hash-object check would refuse every copy (ticket 257).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, encoding: 'utf8' });

test('every text file the template copies checks out with LF', () => {
  const files = git(root, 'ls-files', '--', 'practice-template').split('\n').filter(Boolean);
  const attrs = git(root, 'check-attr', 'eol', '--', ...files).split('\n').filter(Boolean);
  const wrong = attrs.filter((line) => !line.endsWith(': eol: lf'));
  assert.deepEqual(wrong, []);
});

test('with core.autocrlf=true, the root .gitattributes still checks out LF', () => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'eol-')));
  try {
    git(dir, 'init', '-q', '-b', 'main');
    copyFileSync(join(root, '.gitattributes'), join(dir, '.gitattributes'));
    writeFileSync(join(dir, 'run.mjs'), 'one\ntwo\n');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'init');
    rmSync(join(dir, 'run.mjs'));
    git(dir, '-c', 'core.autocrlf=true', 'checkout', '--', 'run.mjs');
    assert.equal(readFileSync(join(dir, 'run.mjs'), 'utf8'), 'one\ntwo\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
