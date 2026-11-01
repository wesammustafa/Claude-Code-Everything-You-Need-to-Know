import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig } from '../src/config.js';

test('missing fields fall back to the defaults', () => {
  assert.deepEqual(parseConfig('{}'), { files: ['.'], ignore: [] });
});

test('fields from the file override the defaults', () => {
  assert.deepEqual(parseConfig('{"files": ["docs"], "ignore": ["#"]}'), { files: ['docs'], ignore: ['#'] });
});

test('a list field must hold strings', () => {
  assert.throws(() => parseConfig('{"files": "docs"}'), /"files" must be a list of strings/);
});

test('the file must hold an object', () => {
  assert.throws(() => parseConfig('[]'), /must hold a JSON object/);
});

test('an empty file is rejected with a clear message', () => {
  assert.throws(() => parseConfig('  \n'), /linkcheck\.json is empty/);
});

test('an unknown config key is rejected and named', () => {
  assert.throws(() => parseConfig('{"files": ["docs"], "ignores": ["vendor/"]}'), /unknown key.*ignores/i);
});
