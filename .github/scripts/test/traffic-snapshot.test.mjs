// The owner-run traffic snapshot, run against a stand-in for the gh CLI that
// returns canned API responses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), '..', 'traffic-snapshot.sh');
const repo = 'owner/guide';

const responses = {
  [`api repos/${repo}/traffic/popular/paths`]: [
    { path: `/${repo}`, title: 'guide', count: 2400, uniques: 800 },
    { path: `/${repo}/tree/main/docs/beginner`, title: 'beginner', count: 150, uniques: 60 },
    { path: `/${repo}/blob/main/docs/beginner/README.md`, title: 'README', count: 50, uniques: 20 },
    { path: `/${repo}/blob/main/CONTRIBUTING.md`, title: 'CONTRIBUTING', count: 30, uniques: 10 },
  ],
  [`api repos/${repo}/traffic/popular/referrers`]: [
    { referrer: 'Google', count: 500, uniques: 300 },
    { referrer: 'github.com', count: 200, uniques: 120 },
    { referrer: 'Bing', count: 20, uniques: 9 },
  ],
  [`api repos/${repo}`]: { stargazers_count: 2345 },
};

function fakeGh(dir) {
  const table = JSON.stringify(responses);
  const body = `#!/usr/bin/env node
const args = process.argv.slice(2).filter((a) => !a.startsWith('-H') && !a.startsWith('Accept:') && a !== '--paginate');
const key = args.join(' ');
const table = ${table};
if (key.startsWith('api repos/${repo}/stargazers')) {
  const now = Date.now();
  const day = 86400000;
  process.stdout.write(JSON.stringify([{ starred_at: new Date(now - 2 * day).toISOString() }, { starred_at: new Date(now - 10 * day).toISOString() }]));
  process.stdout.write(JSON.stringify([{ starred_at: new Date(now - 90 * day).toISOString() }]));
} else if (key.startsWith('issue list')) {
  process.stdout.write(JSON.stringify([{ number: 7 }, { number: 9 }]));
} else if (key in table) {
  process.stdout.write(JSON.stringify(table[key]));
} else {
  process.stderr.write('unexpected gh call: ' + key + '\\n');
  process.exit(1);
}
`;
  writeFileSync(join(dir, 'gh'), body);
  chmodSync(join(dir, 'gh'), 0o755);
}

test('the traffic snapshot records a level path missing from the top 10 as below the 10th', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fake-gh-'));
  try {
    fakeGh(dir);
    const result = spawnSync('bash', [script, repo], { encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } });
    assert.equal(result.status, 0, result.stderr);
    const out = result.stdout;
    assert.match(out, /Repo root: 800 unique visitors/);
    assert.match(out, /Beginner: 80 unique visitors \(10% of the root\)/);
    assert.match(out, /Intermediate: below the 10th/);
    assert.match(out, /Advanced: below the 10th/);
    assert.doesNotMatch(out, /Intermediate: 0\b/);
    assert.match(out, /Stars: 2345 total, \+2 in the last 30 days/);
    assert.match(out, /Search referrers: Google \(300 unique\), Bing \(9 unique\)/);
    assert.match(out, /Lesson-feedback issues opened in the last 14 days: 2/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
