import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../src/slug.js';

test('lowercases a heading and joins its words with hyphens', () => {
  assert.equal(slugify('Getting Started'), 'getting-started');
});

test('drops punctuation but keeps hyphens and underscores', () => {
  assert.equal(slugify('What is `npm test`?'), 'what-is-npm-test');
  assert.equal(slugify('snake_case and kebab-case'), 'snake_case-and-kebab-case');
});

test('trims the spaces around a heading', () => {
  assert.equal(slugify('  Getting Started  '), 'getting-started');
});
