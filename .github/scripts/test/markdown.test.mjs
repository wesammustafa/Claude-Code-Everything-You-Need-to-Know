// sectionBlocks: the fenced blocks under one H2, which the upgrade proof
// reads README's commands from.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sectionBlocks } from '../lib/markdown.mjs';

const page = [
  '## Try it now',
  '```bash',
  'npm run learn',
  '```',
  '## Already have a practice copy?',
  'Some text.',
  '   ```shell',
  '   git fetch x',
  '   node y',
  '   ```',
  '~~~',
  'plain',
  '~~~',
  '### A smaller heading',
  '```js',
  'z',
  '```',
  '## Next',
  '```sh',
  'after',
  '```',
].join('\n');

test('sectionBlocks gives each block under the H2 with its language, less the fence indent', () => {
  assert.deepEqual(sectionBlocks(page, 'already-have-a-practice-copy'), [
    { lang: 'shell', lines: ['git fetch x', 'node y'] },
    { lang: '', lines: ['plain'] },
    { lang: 'js', lines: ['z'] },
  ]);
});

test('sectionBlocks stops at the next H2', () => {
  assert.deepEqual(sectionBlocks(page, 'next'), [{ lang: 'sh', lines: ['after'] }]);
  assert.deepEqual(sectionBlocks(page, 'try-it-now'), [{ lang: 'bash', lines: ['npm run learn'] }]);
});

test('sectionBlocks gives nothing for an unknown slug, and a ## inside a fence is no heading', () => {
  assert.deepEqual(sectionBlocks(page, 'missing'), []);
  assert.deepEqual(sectionBlocks('```\n## Fake\n```\n```sh\nx\n```', 'fake'), []);
});
