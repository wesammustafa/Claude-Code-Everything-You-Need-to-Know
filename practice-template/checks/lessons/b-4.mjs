// @ts-check
// Keep a session on track (Beginner, lesson 4). The check reads the refactor
// commit and the working tree itself. Only the moments around the rewind are
// saved by the Learner: git's status after the rename attempt, and just
// after rewinding it, which shows what rewind put back and what it left. The
// rename script changes src/links.js, a file Claude never edits in this
// conversation, so rewind leaves it; rewind would also restore a command's
// change to a file Claude had already edited (Checkpointing, Bash command
// changes not tracked).
import { spawnSync } from 'node:child_process';
import { statusEntries, statusPaths } from '../paths.mjs';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Keep a session on track';

const CHECK = 'src/check-links.js';
const LINKS = 'src/links.js';
const CLI = 'src/cli.js';
const SAVE_BEFORE = '`git status --porcelain > .practice/b-4-before-rewind.txt`';
const SAVE_AFTER = '`git status --porcelain > .practice/b-4-after-rewind.txt`';
// Your turn's files: the script changes src/links.js, and Claude updates its
// callers, src/check-links.js and test/links.test.js.
const inScope = (/** @type {string} */ path) => path.startsWith('src/') || path.startsWith('test/');
// The longest the link check may run, in milliseconds.
const LINKCHECK_LIMIT = 30_000;

// The commits after the copy's first one, newest first, that change a path.
/**
 * @param {Repo} repo
 * @param {string} path
 */
function laterCommits(repo, path) {
  let shas;
  try {
    shas = repo.gitLocal('log', '--format=%H', 'HEAD', '--', path).split('\n').filter(Boolean);
  } catch {
    return [];
  }
  const roots = new Set(repo.gitLocal('rev-list', '--max-parents=0', 'HEAD').split('\n'));
  return shas.filter((sha) => !roots.has(sha));
}

// JavaScript without its comments, so a note such as "async was tried and
// dropped" doesn't read as asynchronous code.
const withoutComments = (/** @type {string} */ text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
// Whether JavaScript exports `name`.
const hasExport = (/** @type {string} */ text, /** @type {string} */ name) => new RegExp(`export\\s+(async\\s+)?function\\s+${name}\\b|export\\s+(const|let)\\s+${name}\\b|export\\s*\\{[^}]*\\b${name}\\b`).test(withoutComments(text));

/** @type {Item[]} */
export const items = [
  {
    text: 'a commit after your copy\'s first one changes `src/check-links.js`, which still exports a synchronous `brokenLinks`',
    check(repo) {
      if (!laterCommits(repo, CHECK).length) return 'No commit since your copy\'s first one changes `src/check-links.js`. Finish the refactor in Worked example step 5 and commit it.';
      const text = withoutComments(repo.gitLocal('show', `HEAD:./${CHECK}`));
      if (!hasExport(text, 'brokenLinks')) {
        return 'The last commit\'s `src/check-links.js` exports no `brokenLinks`, which `src/cli.js` imports by that name. Ask Claude to keep `brokenLinks` exported, as Worked example step 5 asks, and commit.';
      }
      if (/\basync\b|\bawait\b|fs\/promises|\.then\(/.test(text)) {
        return 'The last commit\'s `src/check-links.js` is still asynchronous. Ask Claude to make `brokenLinks` synchronous again, as Worked example step 5 asks, and commit.';
      }
      return true;
    },
  },
  {
    text: '`.practice/b-4-before-rewind.txt` lists `src/links.js` and `src/check-links.js`',
    local: true,
    check(repo) {
      const before = repo.read('.practice/b-4-before-rewind.txt');
      if (before === null) return `After Claude runs the rename script and updates its callers, run ${SAVE_BEFORE}.`;
      const paths = statusPaths(before, repo.prefix);
      const missing = [LINKS, CHECK].filter((p) => !paths.includes(p));
      if (!missing.length) return true;
      return `It doesn't list ${missing.map((p) => `\`${p}\``).join(' or ')}. Save it once the script has renamed \`findLinks\` and Claude has updated \`src/check-links.js\`, before you rewind.`;
    },
  },
  {
    text: '`.practice/b-4-after-rewind.txt` lists `src/links.js` and no other file in `src/` or `test/`',
    local: true,
    check(repo) {
      const after = repo.read('.practice/b-4-after-rewind.txt');
      if (after === null) return `Right after rewinding with Restore code, run ${SAVE_AFTER}.`;
      const paths = statusPaths(after, repo.prefix).filter(inScope);
      const others = paths.filter((p) => p !== LINKS);
      if (others.length) {
        const list = others.map((p) => `\`${p}\``).join(', ');
        return `${list} ${others.length > 1 ? 'are' : 'is'} still changed. Use Restore code, then ${SAVE_AFTER}. If a command made the edit, use \`git restore src test\` and repeat Your turn from step 2.`;
      }
      if (!paths.includes(LINKS)) return `\`src/links.js\` isn't changed, so the script's rename is gone. If you restored it yourself, repeat step 2. Otherwise Claude had already edited it: run \`git restore src test\`, start a new session and repeat step 2.`;
      return true;
    },
  },
  {
    text: '`src/` and `test/` have no uncommitted changes, your last commit\'s `src/links.js` still exports `findLinks`, and `npm run linkcheck -- samples` runs without an error',
    check(repo) {
      const entries = statusEntries(repo.git('status', '--porcelain', '--', 'src', 'test'), repo.prefix).filter((e) => inScope(e.path));
      if (entries.length) {
        const left = entries.map((e) => e.path);
        const tracked = entries.filter((e) => e.xy !== '??').map((e) => e.path);
        const why = left.includes(LINKS) ? ' The rename script changed `src/links.js` with a command, and rewind leaves a command\'s change to a file Claude never edited.' : '';
        const fix = tracked.length ? ` Put it back with \`git restore ${tracked.join(' ')}\`.` : '';
        const extra = tracked.length < left.length ? ' Delete the new files you don\'t want.' : '';
        return `Still changed: ${left.join(', ')}.${why}${fix}${extra}`;
      }
      // The rename is dropped in Your turn: another tool imports findLinks by name.
      if (!hasExport(repo.gitLocal('show', `HEAD:./${LINKS}`), 'findLinks')) return 'Your last commit\'s `src/links.js` no longer exports `findLinks`. Undo the dropped rename with `git revert <sha>`; find that commit with `git log`.';
      const run = spawnSync(process.execPath, [CLI, 'samples'], { cwd: repo.dir, encoding: 'utf8', timeout: LINKCHECK_LIMIT });
      if (/** @type {(number | null)[]} */ ([0, 1]).includes(run.status) && /\d+ broken link\(s\)|All relative links resolve\./.test(run.stdout)) return true;
      return '`npm run linkcheck -- samples` stops with an error. Run it, read the error, and ask Claude to fix the code you committed.';
    },
  },
];
