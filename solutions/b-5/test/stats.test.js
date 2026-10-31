import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countLinks } from '../src/stats.js';

test('counts the links in a page', () => {
  assert.equal(countLinks('[a](a.md) and [b](b.md)'), 2);
});

test('a page without links counts zero', () => {
  assert.equal(countLinks('# Title\n\nNo links here.\n'), 0);
});
