// The hint ladders of the learn app's lesson files. Each FAIL message a
// lesson's check can give gets one narrow question of its own: the first hint
// a learner sees after "not yet". Every way an item can fail is produced here
// from a practice copy, so a new FAIL message in a check needs a new scenario.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLesson } from '../../learn/lib/content.mjs';
import { lessons } from '../lessons/index.mjs';
import { openRepo } from '../repo.mjs';
import { commit, repo, withRepo, write } from './helpers.mjs';
import { root } from './learn-drive.mjs';

const dir = join(root, 'learn', 'lessons');
const ids = readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')).sort();

// The places an item's check can return something other than a pass.
const failReturns = (check) => (check.toString().match(/\breturn\s+(?!true\b)/g) ?? []).length;

for (const id of ids) {
  test(`${id}: every FAIL message has its own first hint`, async () => {
    const content = parseLesson(readFileSync(join(dir, `${id}.md`), 'utf8'), `${id}.md`);
    const file = join(root, 'checks', 'test', 'ladders', `${id}.mjs`);
    assert.ok(existsSync(file), `checks/test/ladders/${id}.mjs is missing`);
    const { scenarios } = await import(file);
    for (const [index, item] of lessons[id].items.entries()) {
      const ladder = content.ladder.find((l) => l.item === item.text);
      assert.ok(ladder, `${id}: no ladder for "${item.text}"`);
      for (const n of ladder.narrow) assert.match(n.question, /\?$/, `${id}: "${n.question}" is a question`);
      const mine = scenarios.filter((x) => x.item === index);
      assert.ok(mine.length >= failReturns(item.check), `${id} item ${index}: ${mine.length} scenarios for ${failReturns(item.check)} ways to fail`);
      for (const sc of mine) {
        const hint = withRepo(() => repo(), (d) => {
          if (sc.files) write(d, sc.files);
          if (sc.setup) sc.setup(d, { write, commit });
          if (sc.command) {
            write(d, { 'bin/claude': sc.command });
            chmodSync(join(d, 'bin/claude'), 0o755);
          }
          const previous = process.env.PATH;
          try {
            if (sc.path) process.env.PATH = join(d, sc.path);
            return item.check(openRepo(d));
          } finally {
            if (previous === undefined) delete process.env.PATH;
            else process.env.PATH = previous;
          }
        });
        assert.equal(typeof hint, 'string', `${id} item ${index}, ${sc.name}: the check passed`);
        const matched = ladder.narrow.filter((n) => hint.includes(n.part));
        assert.equal(matched.length, 1, `${id} item ${index}, ${sc.name}: ${matched.length} narrow questions for: ${hint}`);
      }
    }
  });
}

// A capstone item reused from a lesson, and reworded for the capstone,
// shows that lesson item's code, so the count above, and the SLOW scan in
// learn-io.test.mjs, read the check that runs.
test('a capstone item reused from a lesson shows the lesson item\'s code', () => {
  const ids = Object.keys(lessons);
  for (const id of ids.filter((x) => x.endsWith('-capstone'))) {
    for (const [index, item] of lessons[id].items.entries()) {
      for (const other of ids.filter((x) => x !== id)) {
        const same = lessons[other].items.find((it) => it.text === item.text);
        if (same) assert.equal(item.check.toString(), same.check.toString(), `${id} item ${index} comes from ${other}`);
      }
    }
  }
  const total = lessons['i-capstone'].items.reduce((n, item) => n + failReturns(item.check), 0);
  assert.equal(total, 44);
});
