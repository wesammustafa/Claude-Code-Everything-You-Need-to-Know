// The capstones' reused check items (the hint ladders' own test moved to
// quest/engine/test/ladders.test.mjs in ticket 210). Every way an item can
// fail is produced there from a practice copy, by a scenario in ladders/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lessons } from '../lessons/index.mjs';

// The places an item's check can return something other than a pass.
const failReturns = (check) => (check.toString().match(/\breturn\s+(?!true\b)/g) ?? []).length;

// A capstone item reused from a lesson, and reworded for the capstone,
// shows that lesson item's code, so the ladders test's count of ways to
// fail, and the SLOW scan in learn-io.test.mjs, read the check that runs.
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
