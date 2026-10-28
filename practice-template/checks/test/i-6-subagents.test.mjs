import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLesson } from '../../learn/lib/content.mjs';
import { judge } from '../../learn/lib/holds.mjs';
import { check, commit, repo, withRepo, write } from './helpers.mjs';

const path = '.claude/agents/test-gaps.md';
const lesson = parseLesson(readFileSync(new URL('../../learn/lessons/i-6.md', import.meta.url), 'utf8'), 'i-6.md');
const description = lesson.steps.flatMap(step => step.beats).find(beat =>
  beat.verify.path === path && beat.verify.regex?.startsWith('^description:'));

for (const [words, accepted] of [
  ['Finds untested functions.', false],
  ['Finds exported functions without tests and reports.', false],
  ['Finds exported functions without tests and reports gaps.', true],
  ['Finds untested exported functions. Use when identifying missing tests.', true],
]) {
  test(`i-6 description card and committed check agree on: ${words}`, () => {
    const agent = `---\nname: test-gaps\ndescription: ${words}\ntools: Read, Grep, Glob\n---\n\nList exported functions no test calls. Never change files.\n`;
    assert.ok(description, 'the lesson must have a description beat');
    assert.equal(judge(description.verify, Buffer.from(agent)).pass, accepted,
      'the editing card must not confirm a description the next committed check rejects');
    withRepo(() => repo({ [path]: agent }), dir => {
      commit(dir, 'Add test-gaps');
      write(dir, { '.practice/i-6-agents.txt': 'test-gaps\n' });
      const result = check(['i-6', '--dir', dir]);
      assert.equal(result.code, accepted ? 0 : 1, result.out);
      if (!accepted) assert.match(result.out, /Write a description of a sentence or two/);
    });
  });
}
