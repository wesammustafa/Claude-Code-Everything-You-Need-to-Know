// @ts-check
// Project memory with CLAUDE.md (Beginner, lesson 5). The Learner commits a
// CLAUDE.md with a header rule for the JavaScript in src/, a later session
// commits a new file that follows it, and the Learner sorts the lesson's four
// notes into the project's CLAUDE.md, a gitignored CLAUDE.local.md and their
// user file. The check reads only what git holds, so it gives the same answer
// on the Learner's machine, in the progress run and on the solutions branch:
// what CLAUDE.local.md says is the Self-check's.
import { committedIgnore, ignoreHint } from '../ignore.mjs';
import { isTestFile } from '../paths.mjs';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Project memory with CLAUDE.md';

const MEMORY_PATHS = ['CLAUDE.md', '.claude/CLAUDE.md'];
const LOCAL = 'CLAUDE.local.md';
const RULE = /starts with the line `([^`]+)`/i;
// What the notes' two personal lines say, lowercased.
const PERSONAL = ['linkcheck-docs', 'summary at the end'];
// The files the rule covers: JavaScript in src/, not tests. Hooks, settings
// and other files later lessons commit are left out, so they can't undo a pass.
const isSource = (/** @type {string} */ f) => /^src\/.+\.[cm]?js$/i.test(f) && !isTestFile(f);
// `npm run <script>`, with any options before the script's name skipped.
const NPM_RUN = /npm run(?:-script)?(?:\s+--?[\w-]+(?:=\S+)?)*\s+([A-Za-z0-9:._][A-Za-z0-9:._-]*)/g;

// The committed project CLAUDE.md: its path and text at HEAD.
/** @param {Repo} repo */
function committedMemory(repo) {
  for (const path of MEMORY_PATHS) {
    try {
      return { path, text: repo.git('show', `HEAD:${path}`) };
    } catch { /* not in the last commit */ }
  }
  return null;
}

// The header rule in the committed CLAUDE.md: the line it names, and whether
// it says it covers `src/`. A rule scoped to src/ wins over a broader one.
/** @param {Repo} repo */
function rule(repo) {
  const memory = committedMemory(repo);
  const found = (memory?.text.split(/\r?\n/) ?? [])
    .map((text) => ({ text, match: text.match(RULE) }))
    .filter((l) => l.match);
  const best = found.find((l) => l.text.includes('src/')) ?? found[0];
  return best ? { memory, line: /** @type {string} */ (/** @type {RegExpMatchArray} */ (best.match)[1]).trim(), scoped: best.text.includes('src/') } : { memory, line: null };
}

// The commit that first put the rule's line into the project CLAUDE.md.
/**
 * @param {Repo} repo
 * @param {{ path: string }} memory
 * @param {string} line
 */
function ruleCommit(repo, memory, line) {
  const shas = repo.git('log', '--reverse', '--format=%H', '-S', line, '--', memory.path).split('\n').filter(Boolean);
  return shas[0] ?? null;
}

// The commits after `since`, newest first, that add JavaScript files to src/,
// each as `{ sha, sources }`.
/**
 * @param {Repo} repo
 * @param {string} since
 */
function addingSources(repo, since) {
  const log = repo.git('log', '--diff-filter=A', '--name-only', '--format=%x00%H', `${since}..HEAD`);
  return log.split('\0').filter((c) => c.trim())
    .map((c) => c.split('\n').map((l) => l.trim()).filter(Boolean))
    .map(([sha, ...files]) => ({ sha: /** @type {string} */ (sha), sources: files.filter(isSource) }))
    .filter((c) => c.sources.length);
}

const firstLine = (/** @type {Repo} */ repo, /** @type {string} */ sha, /** @type {string} */ path) => /** @type {string} */ (repo.git('show', `${sha}:${path}`).replace(/^﻿/, '').split(/\r?\n/)[0]).trim();

/** @param {Repo} repo */
function scripts(repo) {
  let text;
  try {
    text = repo.git('show', 'HEAD:package.json');
  } catch {
    text = repo.read('package.json');
  }
  try {
    return new Set(Object.keys(JSON.parse(text ?? '{}').scripts ?? {}));
  } catch {
    return null;
  }
}

const succeeds = (/** @type {() => unknown} */ fn) => {
  try {
    fn();
    return true;
  } catch {
    return false;
  }
};

/** @type {Item[]} */
export const items = [
  {
    text: 'a committed CLAUDE.md has a rule that every new JavaScript file in `src/` starts with a given line',
    check(repo) {
      const { memory, line, scoped } = rule(repo);
      if (!memory) return 'There is no committed CLAUDE.md. Run `/init`, edit what it wrote, then `git add CLAUDE.md` and commit it.';
      if (!line) return 'The committed CLAUDE.md has no line like ``- Every new JavaScript file in `src/` starts with the line `// SPDX-License-Identifier: MIT`.``. Add it under `## Conventions` and commit CLAUDE.md again.';
      return scoped ? true : `The rule for \`${line}\` doesn't say which files it covers. Scope it to "Every new JavaScript file in \`src/\`" and commit CLAUDE.md: a header can break shell scripts or JSON.`;
    },
  },
  {
    text: 'a commit made after that rule adds JavaScript files to `src/`, and each of them starts with the rule\'s line',
    check(repo) {
      const { memory, line } = rule(repo);
      if (!line) return 'Commit a CLAUDE.md with the header rule first.';
      // A rule's line comes from the committed CLAUDE.md, so memory is set.
      const since = ruleCommit(repo, /** @type {{ path: string }} */ (memory), line);
      if (!since) return `git has no commit that adds \`${line}\` to ${/** @type {{ path: string }} */ (memory).path}. Commit CLAUDE.md with the rule, then ask a new session for a new file.`;
      const commits = addingSources(repo, since);
      // Any such commit passes, so later work can't turn a finished lesson back.
      const wrongIn = (/** @type {{ sha: string, sources: string[] }} */ c) => c.sources.filter((f) => firstLine(repo, c.sha, f) !== line);
      if (commits.some((c) => !wrongIn(c).length)) return true;
      if (!commits.length) {
        const waiting = repo.git('status', '--porcelain', '--untracked-files=all').split('\n')
          .filter((l) => /^(\?\?|A.) /.test(l)).map((l) => l.slice(3))
          .filter(isSource);
        if (waiting.length) return `No commit after the rule adds a JavaScript file to \`src/\`, and these new files are not committed yet: ${waiting.join(', ')}. Ask Claude to commit them.`;
        return 'No commit after the rule adds a JavaScript file to `src/`. In a new session, ask for a change that creates one, such as `src/stats.js` with a test, and to commit it.';
      }
      const [latest] = /** @type {[{ sha: string, sources: string[] }]} */ (commits);
      return `In commit ${latest.sha.slice(0, 7)}, these new files don't start with \`${line}\`: ${wrongIn(latest).join(', ')}. In a new session, verify CLAUDE.md with \`/context all\`, then ask for a different new file and commit.`;
    },
  },
  {
    text: 'the committed CLAUDE.md holds the notes\' rule for CLI errors, and every `npm run` script it names is in `package.json`',
    check(repo) {
      const memory = committedMemory(repo);
      if (!memory) return 'There is no committed CLAUDE.md.';
      if (!memory.text.includes('linkcheck:')) return 'The committed CLAUDE.md doesn\'t have the rule from the lesson\'s notes that CLI errors start with `linkcheck:`. Add it and commit CLAUDE.md.';
      const known = scripts(repo);
      if (!known) return 'package.json doesn\'t parse, so the check can\'t read its scripts.';
      const missing = memory.text.split(/\r?\n/).flatMap((text) => [...text.matchAll(NPM_RUN)]
        .filter((m) => !known.has(/** @type {string} */ (m[1]))).map((m) => ({ script: m[1], text: text.trim() })));
      if (!missing.length) return true;
      const { script } = /** @type {{ script: string }} */ (missing[0]);
      return `The committed CLAUDE.md names \`npm run ${script}\`, but package.json has no such script. Fix or delete that line, then commit CLAUDE.md.`;
    },
  },
  {
    text: 'a committed `.gitignore` keeps `CLAUDE.local.md` out, git tracks no `CLAUDE.local.md`, and the committed CLAUDE.md holds neither personal note',
    check(repo) {
      const memory = committedMemory(repo);
      if (!memory) return 'There is no committed CLAUDE.md.';
      if (succeeds(() => repo.git('ls-files', '--error-unmatch', '--', LOCAL))) return `git tracks \`${LOCAL}\`, which is yours alone. Run \`git rm --cached ${LOCAL}\`, add the line \`${LOCAL}\` to \`.gitignore\`, and commit.`;
      if (succeeds(() => { if (!repo.git('ls-tree', '--name-only', 'HEAD', '--', LOCAL)) throw new Error(); })) return `\`${LOCAL}\` is still in your last commit. Commit its removal.`;
      const ignore = committedIgnore(repo, LOCAL);
      if (ignore.problem) return ignoreHint(ignore, LOCAL);
      const personal = PERSONAL.filter((note) => memory.text.toLowerCase().includes(note));
      return personal.length ? `The committed ${memory.path} still holds a note that is only yours (${personal.map((n) => `"${n}"`).join(', ')}). Move it to \`${LOCAL}\` or your user file, take it out of ${memory.path} and commit.` : true;
    },
  },
];
