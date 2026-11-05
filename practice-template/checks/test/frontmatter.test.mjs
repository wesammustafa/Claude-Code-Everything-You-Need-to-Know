// The frontmatter reader's boolean fields, read as Claude Code reads a
// skill's: true/false, yes/no, on/off and 1/0, in any letter case.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flag, frontmatter } from '../frontmatter.mjs';

const field = (line) => /** @type {NonNullable<ReturnType<typeof frontmatter>>} */ (frontmatter(`---\n${line}\n---\n`)).fields.x;

test('flag reads every true and false spelling, in any letter case', () => {
  for (const value of ['true', 'True', 'TRUE', 'yes', 'YES', 'Yes', 'on', 'On', '1']) assert.equal(flag(field(`x: ${value}`)), true, value);
  for (const value of ['false', 'False', 'FALSE', 'no', 'No', 'NO', 'off', 'OFF', '0']) assert.equal(flag(field(`x: ${value}`)), false, value);
});

test('flag reads a quoted value or one with a trailing comment', () => {
  assert.equal(flag(field('x: "yes"')), true);
  assert.equal(flag(field('x: off # stays off')), false);
});

test('flag leaves anything else undefined: another word, a list, an empty or missing field', () => {
  for (const line of ['x: maybe', 'x: y', 'x: 2', 'x: [true]', 'x:', 'y: true']) assert.equal(flag(field(line)), undefined, line);
});
