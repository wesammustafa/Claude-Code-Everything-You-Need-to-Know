// isTestFile's naming rules, which b-5, i-1 and the Beginner capstone use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTestFile } from '../paths.mjs';

test('isTestFile counts test files named the pytest, Java and .NET way', () => {
  for (const path of ['test_links.py', 'src/LinksTest.java', 'App.Tests/LinksTests.cs']) assert.equal(isTestFile(path), true, path);
});

test('isTestFile does not count a file whose name merely ends in "test"', () => {
  for (const path of ['src/Latest.java', 'contest.py']) assert.equal(isTestFile(path), false, path);
});
