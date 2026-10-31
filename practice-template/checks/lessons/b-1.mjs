// @ts-check
// Install, sign in and look around (Beginner, lesson 1). The check runs
// `claude --version` itself, and reads the onboarding note the Learner
// corrects against the code in Your turn.
import { spawnSync } from 'node:child_process';
/** @import { Item } from './index.mjs' */

export const title = 'Install, sign in and look around';

// The longest `claude --version` may run, in milliseconds.
export const VERSION_LIMIT = 30_000;

const VERSION = /^\d+\.\d+\.\d+ \(Claude Code\)/m;
const FIX_PATH = 'Open a new terminal. If it still fails, use lesson 1, Worked example step 2 to fix PATH, then retry.';

/** @type {Item} */
export const claudeVersion = {
  text: '`claude --version` prints a Claude Code version',
  // It runs on the Learner's machine: a GitHub runner has no Claude Code.
  local: true,
  check(repo) {
    // On Windows, `claude` can be an npm shim, which only a shell can start.
    const run = spawnSync('claude', ['--version'], { cwd: repo.dir, encoding: 'utf8', shell: process.platform === 'win32', timeout: VERSION_LIMIT });
    if (/** @type {NodeJS.ErrnoException | undefined} */ (run.error)?.code === 'ENOENT') return `The check couldn't find \`claude\` on the PATH of the shell it ran in. ${FIX_PATH}`;
    if (/** @type {NodeJS.ErrnoException | undefined} */ (run.error)?.code === 'ETIMEDOUT') return `\`claude --version\` didn't finish within ${VERSION_LIMIT / 1000} seconds. Run it on its own and see what it waits for.`;
    if (run.error) return `The check couldn't run \`claude --version\`: ${run.error.message}`;
    const out = `${run.stdout ?? ''}`;
    if (run.status === 0 && VERSION.test(out)) return true;
    const said = `${out}\n${run.stderr ?? ''}`.trim().split(/\r?\n/)[0] ?? '';
    return `\`claude --version\` printed ${said ? `"${said.slice(0, 120)}"` : 'nothing'}${run.status ? ` and exited with ${run.status}` : ''}, not a line such as \`2.1.0 (Claude Code)\`. ${FIX_PATH}`;
  },
};

export const NOTE = 'practice/b-1/onboarding.md';

// The note's one wrong claim: src/cli.js exits with 1 when it finds a broken
// link (and 2 on a bad linkcheck.json), so linkcheck can fail a CI job. A
// claim is stale when it pairs exit code 0 with broken links, or says
// linkcheck can't fail a CI job; it is corrected when it pairs 1, or a
// non-zero code, with broken links. Each pairing is read within one part of a
// sentence, so "1 when it finds a broken link and 0 when every link resolves"
// is right and "1 when every link resolves and 0 when it finds broken links"
// is wrong.
const EXIT = /\bexit|\breturns?\b|\bstatus\b|\bcode\s+\d|\bnon-?zero\b|\bCI\b/i;
const CANT_FAIL = /\b(?:can(?:not|['’]t)|never|won['’]t|will not|does(?:n['’]t| not))\s+fail\s+(?:a\s+|the\s+|any\s+|your\s+)?(?:CI|build|pull request|PR)\b/i;
const NONZERO = /\b(?:not|other than|anything but)\s+(?:0|zero)\b|\bnon-?zero\b/gi;
const NOT_BROKEN = /\b(?:no|without|not a single)\s+(?:[\w-]+\s+){0,3}?(?:broken|dead|missing)\b|(?<![\w.])(?:0|zero)\s+broken\b|\b(?:none|nothing)\s+(?:[\w-]+\s+){0,2}?(?:is|are)\s+(?:broken|dead|missing)\b|\b(?:isn['’]t|aren['’]t|is not|are not)\s+(?:broken|dead|missing)\b/gi;
// A broken link, but not a missing linkcheck.json, which gives 0.
const BROKEN = /\bbroken\b|\bdead\b|\b(?:target|file|page)s?\s+(?:[\w-]+\s+){0,2}?(?:is|are)\s+missing\b|\bmissing\s+(?:target|file|page)|\bdoes(?:n['’]t| not) exist\b/i;
const ZERO = /(?<![\w.])(?:0|zero)(?![\w.])/i;
const ONE = /(?<![\w.])1(?![\w.])|\bNONZERO\b/;
// "0 unless it finds a broken link" gives broken links a non-zero code.
const ZERO_UNLESS = /(?<![\w.])(?:0|zero)(?![\w.])[^.;:]*?\bunless\b[^.;:]*?\b(?:broken|dead|missing)\b/gi;
const ONLY_IF = /\bonly (?:when|if)\b/i;
const ALL_RESOLVE = /\b(?:all|every)\s+(?:[\w-]+\s+){0,2}?(?:links?|targets?)\s+(?:resolves?|exists?|works?|(?:is|are) fine)\b/i;
// Where one part of a sentence ends and the next begins: a comma only when a
// new code follows it, as in "1 when ..., 0 when ...".
const PART = /[;:!?()\[\]–—]|\.(?=\s|$)|,(?=\s*`?(?:\d+|zero|code|exit)\b)|\b(?:and|but|while|whereas|otherwise|else|so|then|unless)\b/i;

// The note's claims, one per list item or paragraph, each on one line, so a
// claim wrapped over several lines still reads as one. Struck-through text
// (`~~like this~~`) is left out: it is what the claim no longer says.
/** @param {string} text */
function claims(text) {
  return text
    .split(/\r?\n(?=\s*(?:[-*+]|\d+[.)])\s)|\r?\n\s*\r?\n/)
    .map((claim) => claim.replace(/~~[^~]*~~/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

// How a claim pairs exit codes with broken links: 'stale' if any part gives
// them 0 or the claim says linkcheck can't fail CI, 'right' if a part gives
// them 1 or a non-zero code, or gives 0 only to a run with none, otherwise
// null.
/** @param {string} claim */
export function exitClaim(claim) {
  if (CANT_FAIL.test(claim)) return 'stale';
  let right = false;
  let zeroWhenNone = false;
  let failing = false;
  const rest = claim.replace(ZERO_UNLESS, () => { right = true; return ' . '; });
  for (const raw of rest.split(PART)) {
    const coded = (raw ?? '').replace(NONZERO, ' NONZERO ');
    const none = coded.search(NOT_BROKEN) >= 0 || ONLY_IF.test(coded) || ALL_RESOLVE.test(coded);
    const part = coded.replace(NOT_BROKEN, ' resolves ');
    if (ONE.test(part)) failing = true;
    if (!BROKEN.test(part)) {
      if (none && ZERO.test(part)) zeroWhenNone = true;
      continue;
    }
    if (ZERO.test(part)) return 'stale';
    if (ONE.test(part)) right = true;
  }
  // "0 when no link is broken and 1 otherwise", or "0 only when every link resolves".
  if (zeroWhenNone && (failing || ONLY_IF.test(rest))) right = true;
  return right ? 'right' : null;
}

/** @type {Item} */
export const noteCorrected = {
  text: 'the claim in `practice/b-1/onboarding.md` that the code contradicts is corrected',
  check(repo) {
    const text = repo.read(NOTE);
    if (text === null) {
      if (!repo.exists('checks/run.mjs')) return `This folder has no \`${NOTE}\`: Your turn uses the note in your practice copy. Run \`npm run check -- b-1\` there, without \`--dir\`.`;
      return `\`${NOTE}\` is missing. Bring it back with \`git checkout HEAD -- ${NOTE}\`, then correct the one claim the code contradicts.`;
    }
    const exits = claims(text).filter((claim) => EXIT.test(claim) || CANT_FAIL.test(claim));
    const stale = exits.find((claim) => exitClaim(claim) === 'stale');
    if (stale) return `The note still says "${stale.replace(/^[-*+]\s+/, '').replace(/[.\s]+$/, '').slice(0, 120)}". Ask Claude which file decides how linkcheck exits, open that line yourself, and write what the code does.`;
    if (!exits.some((claim) => exitClaim(claim) === 'right')) return 'No line in the note says which exit code linkcheck gives for a broken link. Open the line Claude cites for it and write that code into the claim: CI depends on it.';
    return true;
  },
};

/** @type {Item[]} */
export const items = [claudeVersion, noteCorrected];
