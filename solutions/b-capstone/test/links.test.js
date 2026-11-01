import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { findLinks, isExternal } from '../src/links.js';
import { brokenLinks } from '../src/check-links.js';

const samples = join(dirname(fileURLToPath(import.meta.url)), '..', 'samples');

test('finds inline links with their line numbers', () => {
  const links = findLinks('# Title\n\nSee [setup](setup.md) and [docs](https://example.com).\n');
  assert.deepEqual(links.map((l) => [l.target, l.line]), [['setup.md', 3], ['https://example.com', 3]]);
});

test('skips images and links inside code', () => {
  const md = '![logo](logo.png)\n`[not](a-link.md)`\n```\n[also not](code.md)\n```\n';
  assert.deepEqual(findLinks(md), []);
});

test('tells external links from relative ones', () => {
  assert.equal(isExternal('https://example.com'), true);
  assert.equal(isExternal('mailto:me@example.com'), true);
  assert.equal(isExternal('docs/setup.md'), false);
});

test('reports only the relative links whose file is missing', () => {
  const broken = brokenLinks(samples, { files: ['.'], ignore: [] });
  assert.deepEqual(broken, [{ file: 'guide.md', line: 5, target: 'missing.md' }]);
});

test('finds links that have a title', () => {
  const links = findLinks('See [setup](setup.md "Setup guide") and [faq](faq.md \'FAQ\').\n');
  assert.deepEqual(links.map((l) => l.target), ['setup.md', 'faq.md']);
});

test('finds links whose target sits in angle brackets', () => {
  assert.deepEqual(findLinks('Read [my notes](<my notes.md>).\n').map((l) => l.target), ['my notes.md']);
});

test('a percent-encoded link to a file that exists resolves', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'linkcheck-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'my notes.md'), '# Notes\n');
  writeFileSync(join(dir, 'doc.md'), '[notes](my%20notes.md)\n');
  assert.deepEqual(brokenLinks(dir, { files: ['.'], ignore: [] }), []);
});

test('a folder listed in the config that does not exist is an error', () => {
  assert.throws(() => brokenLinks(samples, { files: ['nowhere'], ignore: [] }), /no such file or folder: nowhere/);
});
