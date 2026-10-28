// File paths as the checks read them: from `git status --porcelain` lines,
// from a plan file the Learner wrote, and test files by their names.
import { realpathSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';

// `git status --porcelain` lines: each one's path (a rename's new name), the
// old name a rename or copy had (`from`) and the two status letters, leaving
// out the checks' own saved state under .practice/.
export function statusEntries(text) {
  const unquote = (path) => path.replace(/^"|"$/g, '').trim();
  return (text ?? '').split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => {
      const names = line.slice(3).split(' -> ');
      const path = unquote(names.pop());
      return names.length ? { xy: line.slice(0, 2), path, from: unquote(names.join(' -> ')) } : { xy: line.slice(0, 2), path };
    })
    .filter((e) => !e.path.startsWith('.practice/'));
}

// Paths from `git status --porcelain` lines, without the two status letters.
export const statusPaths = (text) => statusEntries(text).map((e) => e.path);

const real = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

// An absolute path into the repository, made relative to it. The second try
// follows symlinks, such as macOS's /tmp, on both sides.
function inRepo(dir, path) {
  for (const [base, target] of [[dir, path], [real(dir), real(path)]]) {
    const rel = relative(base, target);
    if (rel && !rel.startsWith('..') && !isAbsolute(rel)) return rel.replace(/\\/g, '/');
  }
  return path;
}

// The paths in a plan file, one per line, in git's form: `./src/a.js`,
// `src\a.js`, `` `src/a.js` `` and a full path into the repository all
// become `src/a.js`.
export function planPaths(text, dir) {
  return new Set((text ?? '').split(/\r?\n/)
    .map((line) => line.trim().replace(/^`(.*)`$/, '$1').replace(/\\/g, '/'))
    .filter(Boolean)
    .map((path) => (isAbsolute(path) ? inRepo(dir, path) : path.replace(/^(\.\/)+/, ''))));
}

// git lists a new, untracked folder as `dir/`, not the files in it, so the
// folder counts as planned when the plan names a file inside it.
export function inPlan(planned, path) {
  return planned.has(path) || (path.endsWith('/') && [...planned].some((p) => p.startsWith(path)));
}

// Test files by common convention: a test/, tests/, spec/ or __tests__/
// folder; names like links.test.js, links_test.go, test_links.py or Django's
// tests.py; and class files like LinksTest.java or LinksTests.cs. The class
// pattern is case-sensitive, so Latest.java is not a test.
const TEST_PATH = /(^|\/)(tests?|spec|__tests__)\/|[._-](test|spec)\.[a-z0-9]+$|(^|\/)(test_[^/]*|tests)\.py$/i;
const TEST_CLASS = /[a-z0-9](Tests?|Spec)\.(java|kt|scala|groovy|cs|swift|php)$/;

export const isTestFile = (path) => TEST_PATH.test(path) || TEST_CLASS.test(path);

export const TEST_NAMES = 'files in a test/, tests/, spec/ or __tests__/ folder, or named like links.test.js, links_test.go, test_links.py or LinksTest.java';
