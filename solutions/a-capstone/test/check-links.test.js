import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brokenLinks } from '../src/check-links.js';

test('a malformed percent escape is a broken link, and later links are still checked', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'linkcheck-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'my notes.md'), '# Notes\n');
  writeFileSync(join(root, 'index.md'), '[broken](bad%.md)\n[notes](my%20notes.md)\n[missing](gone.md)\n');
  assert.deepEqual(brokenLinks(root, { files: ['.'], ignore: [] }), [
    { file: 'index.md', line: 1, target: 'bad%.md' },
    { file: 'index.md', line: 3, target: 'gone.md' },
  ]);
});

test('a query string after a link target is not part of the file name', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'linkcheck-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'setup.md'), '# Setup\n');
  writeFileSync(join(root, 'index.md'), '[setup](setup.md?plain=1)\n[missing](gone.md?plain=1)\n');
  assert.deepEqual(brokenLinks(root, { files: ['.'], ignore: [] }), [
    { file: 'index.md', line: 2, target: 'gone.md?plain=1' },
  ]);
});
