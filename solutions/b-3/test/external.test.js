import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isExternal } from '../src/links.js';

test('protocol-relative links point to another site', () => {
  assert.equal(isExternal('//cdn.example.com/app.js'), true);
});

test('a link with one leading slash remains a project link', () => {
  assert.equal(isExternal('/docs/setup.md'), false);
});
