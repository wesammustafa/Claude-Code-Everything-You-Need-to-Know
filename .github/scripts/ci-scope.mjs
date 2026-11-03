#!/usr/bin/env node
// Which Guide checks jobs a pull request needs, from the files it changes.
// The guide job always runs. `code` runs the quest job: anything outside the
// files only the guide job reads. `app` runs e2e and template: code that is
// not only the app's unit tests or their config. `platforms` runs the
// macOS and Windows job: app, or the Checks' tests it runs there.
//
//   node .github/scripts/ci-scope.mjs --base <ref>
//
// With --base it diffs <ref>...HEAD and appends code=, app= and platforms= to
// $GITHUB_OUTPUT (or prints them). A failed diff runs everything.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

// Read by the guide job alone: README, the repository's own docs and
// images, the check scripts and the workflows that pull requests don't run.
const GUIDE_ONLY = [
  /^(README|CONTRIBUTING|SECURITY)\.md$/,
  /^LICENSE$/,
  /^assets\//,
  /^\.github\/(scripts|compat|ISSUE_TEMPLATE)\//,
  /^\.github\/PULL_REQUEST_TEMPLATE\.md$/,
  /^\.github\/workflows\/(drift-weekly|expiry-daily|links-weekly|release)\.yml$/,
];

// The app's unit tests and the config only they and lint read: the quest job
// runs them, and nothing they change reaches the build, the template or e2e.
const UNIT_ONLY = [
  /^quest\/[^/]+\/test\//,
  /^quest\/.+\.test\.(ts|tsx|mjs)$/,
  /^(eslint|vitest)\.config\.mjs$/,
];

// The Checks' tests, which the platforms job runs on macOS and Windows.
const CHECKS_TESTS = /^practice-template\/checks\/test\//;

const any = (patterns, path) => patterns.some((re) => re.test(path));

/**
 * The jobs `files` need.
 * @param {string[]} files paths from the repository root
 */
export function scope(files) {
  const code = files.filter((f) => !any(GUIDE_ONLY, f));
  const app = code.filter((f) => !any(UNIT_ONLY, f) && !CHECKS_TESTS.test(f));
  return {
    code: code.length > 0,
    app: app.length > 0,
    platforms: app.length > 0 || code.some((f) => CHECKS_TESTS.test(f)),
  };
}

function main() {
  const { base } = parseArgs({ options: { base: { type: 'string' } } }).values;
  let jobs = { code: true, app: true, platforms: true };
  if (base) {
    try {
      const out = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' });
      jobs = scope(out.split('\n').filter(Boolean));
    } catch (error) {
      console.error(`ci-scope: ${String(error)}; running every job`);
    }
  }
  const lines = Object.entries(jobs).map(([k, v]) => `${k}=${v}`);
  console.log(lines.join('\n'));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
