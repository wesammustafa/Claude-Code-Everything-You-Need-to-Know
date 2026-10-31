// @ts-check
// Run and save a dynamic workflow (Advanced, lesson 3). In the Worked
// example the Learner migrates one folder in a single session gated by a
// `/goal` condition, saving the old form's `git grep -E` pattern in
// .practice/a-3-pattern.txt; the history then shows a folder where the
// pattern matched before and matches nothing at HEAD. In Your turn they have
// Claude write an audit workflow whose findings a second agent checks, save
// the run from /workflows as a project command in .claude/workflows/, have
// it read a folder from `args`, commit it and run it on a second folder.
// What each run found and what the Learner read in the script before
// approving it, the lesson self-checks: the check reads no report Claude
// wrote. The Advanced capstone reuses the script item with its own options.
import { posix } from 'node:path';
import { findWorkflows, readWorkflow, STAGES, tokenize } from '../workflow-script.mjs';
/** @import { Workflow } from '../workflow-script.mjs' */
/** @import { Item } from './index.mjs' */
/** @import { Repo } from '../repo.mjs' */

export const title = 'Run and save a dynamic workflow';

const PATTERN = '.practice/a-3-pattern.txt';

const and = (/** @type {unknown[]} */ list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0]);
const code = (/** @type {unknown} */ text) => `\`${text}\``;
const shell = (/** @type {string} */ path) => (/\s/.test(path) ? `"${path}"` : path);
const SAVE = 'When a workflow run finishes, run `/workflows`, select the run, press `s`, keep the project location, `.claude/workflows/`, and press `Enter`. Then commit the `.js` file it saves.';

// Where a misplaced script should go: a .js file directly in the
// .claude/workflows/ folder it sits under.
/** @param {string} path */
function placed(path) {
  const at = path.lastIndexOf('.claude/workflows/') + '.claude/workflows/'.length;
  return `${path.slice(0, at)}${posix.basename(path).replace(/\.[^.]+$/, '')}.js`;
}

/** @param {{ path: string, result: Workflow, changed: boolean }} script */
function scriptHint({ path, result, changed }) {
  const p = code(path);
  const hint = /** @type {() => string} */ (/** @type {Record<string, () => string>} */ ({
    first: () => `${p} doesn't start with \`export const meta\`${result.found ? `: its code starts with ${code(result.found)}` : ''}. Claude Code needs \`export const meta = { ... }\` as the script's first statement. Move it to the top (comments may stay above it) and commit.`,
    literal: () => `Line ${result.line} of ${p}: \`meta\` holds ${result.what}. When \`meta\` holds anything but literal values, Claude Code drops \`/<name>\` from \`/\` autocomplete. Write each value out as a string, number, list or object, and commit.`,
    fields: () => `\`meta\` in ${p} needs ${/** @type {string[]} */ (result.missing).map((f) => `a non-empty \`${f}\` string`).join(' and ')}. Add ${/** @type {string[]} */ (result.missing).length > 1 ? 'them' : 'it'} and commit.`,
    compile: () => `${p} doesn't compile${result.line ? ` (line ${result.line})` : ''}: ${result.message}. Fix it, or ask Claude to, and commit.`,
    args: () => {
      const why = result.declared
        ? `Line ${result.declared} of ${p} declares its own \`args\`, which hides the input Claude passes to the workflow.`
        : result.mentioned
          ? `${p} mentions \`args\` only in a comment, a string or a property name, so it never reads its input.`
          : `${p} never reads \`args\`, so it can't take a folder as input.`;
      return `${why} Run \`/workflow-authoring\`, ask Claude to change the script so it reads the folder from \`args\`, run \`/reload-skills\`, and commit.`;
    },
    agent: () => `${p} never calls \`agent()\`, so it starts no subagent. Have Claude write the workflow for the task again, save the run from \`/workflows\`, and commit.`,
    check: () => `${p} calls \`agent()\` only once, so no second agent checks what the first one finds. Run \`/workflow-authoring\`, ask Claude to have a second agent check each finding before it's reported, and commit.`,
  })[/** @type {string} */ (result.problem)])();
  const pending = changed ? ` Your copy of ${p} has changes that aren't committed: if they fix this, commit them.` : '';
  return `${hint}${pending}`;
}

/** @param {{ path: string, rule: { line: number, source: string, pattern: string | undefined } | null }} script */
function uncommittedHint({ path, rule }) {
  if (!rule) return `${code(path)} isn't committed. Run \`git add ${shell(path)}\` and commit it.`;
  return `${code(path)} isn't committed, and line ${rule.line} of ${code(rule.source)}, ${code(rule.pattern)}, ignores it. Run \`git add -f ${shell(path)}\` and commit it.`;
}

// The places a script calls `agent(...)`: the name read as a value and
// called, not a method, a declaration or a word in a comment or a string.
/** @param {string} text */
function agentCalls(text) {
  const tokens = tokenize(text.replace(/^\uFEFF/, ''));
  return tokens.filter((t, k) => t.type === 'name' && t.value === 'agent' && tokens[k + 1]?.value === '('
    && !/** @type {(string | undefined)[]} */ (['.', '?.']).includes(tokens[k - 1]?.value) && !/** @type {(string | undefined)[]} */ (['function', 'async', 'const', 'let', 'var']).includes(tokens[k - 1]?.value)).length;
}

// The stage a script got to, past readWorkflow's: `check` comes after them.
const RANKS = [...STAGES, 'check'];

// One script read the way the item wants it: readWorkflow's result, or a
// `check` problem when `needCheck` asks for a second agent() call.
/** @typedef {{ needArgs?: boolean, needAgentCall?: boolean, needCheck?: boolean }} ScriptOptions */

/**
 * @param {string} text
 * @param {ScriptOptions} options
 * @returns {Workflow}
 */
function readScript(text, options) {
  const result = readWorkflow(text, options);
  if (result.ok && options.needCheck && agentCalls(text) < 2) return { problem: 'check' };
  return result;
}

// The script item. Options as readWorkflow takes them: `needArgs`, the script
// reads its input from `args`; `needAgentCall`, it starts subagents; and
// `needCheck`, it calls `agent()` at least twice, so a second agent can check
// what the first finds.
/**
 * @param {ScriptOptions} [options]
 * @returns {Item}
 */
export function savedWorkflow(options = {}) {
  const needs = [options.needArgs && 'reads its input from `args`', options.needCheck ? 'calls `agent()` at least twice' : options.needAgentCall && 'starts subagents with `agent()`'].filter(Boolean);
  return {
    text: `a committed script in \`.claude/workflows/\` has a literal \`export const meta\`, with a \`name\` and a \`description\`, as its first statement${needs.length ? `, and ${and(needs)}` : ''}`,
    check(repo) {
      const { scripts, misplaced, uncommitted } = findWorkflows(repo);
      const results = scripts.map((s) => ({ ...s, result: readScript(s.text, options) }));
      if (results.some((r) => r.result.ok)) return true;
      if (results.length) {
        const rank = (/** @type {{ result: Workflow }} */ r) => RANKS.indexOf(/** @type {string} */ (r.result.problem));
        const other = uncommitted.length ? ` Also, ${uncommittedHint(/** @type {NonNullable<typeof uncommitted[0]>} */ (uncommitted[0]))}` : '';
        return `${scriptHint(results.reduce((best, r) => (rank(r) > rank(best) ? r : best)))}${other}`;
      }
      if (misplaced.length) {
        const [path] = /** @type {[string]} */ (misplaced);
        return `${code(path)} is under \`.claude/workflows/\`, but the check reads only \`.js\` files directly in that folder, where \`/workflows\` saves them. Move it to ${code(placed(path))} and commit.`;
      }
      if (uncommitted.length) return uncommittedHint(/** @type {NonNullable<typeof uncommitted[0]>} */ (uncommitted[0]));
      return `There is no workflow script in \`.claude/workflows/\`. ${SAVE}`;
    },
  };
}

// The pattern's first non-blank line, without the backticks or quotes a
// Learner may have kept around it.
/** @param {Repo} repo */
function readPattern(repo) {
  const text = repo.read(PATTERN);
  if (text === null) return { missing: true };
  const line = text.split(/\r?\n/).find((l) => l.trim())?.trim() ?? '';
  const quoted = line.match(/^(`|'|")(.+)\1$/);
  return { pattern: quoted ? quoted[2] : line };
}

// Whether `git grep -E` finds the pattern in `folder` at the trees `revs`, or
// in the working tree's tracked files when `revs` is empty: true, false, or
// git's own error for a pattern it can't read.
/**
 * @param {Repo} repo
 * @param {string} pattern
 * @param {string} folder
 * @param {string[]} [revs]
 * @returns {boolean | { error: string | undefined }}
 */
function grep(repo, pattern, folder, revs = []) {
  try {
    repo.gitLocal('grep', '-q', '-E', '-e', pattern, ...revs, '--', folder);
    return true;
  } catch (error) {
    if (/** @type {{ status?: number | null }} */ (error).status === 1) return false;
    return { error: `${/** @type {{ stderr?: unknown }} */ (error).stderr ?? /** @type {Error} */ (error).message}`.trim().split('\n')[0] };
  }
}

// The recent commits whose trees the check searches for the old form.
/** @param {Repo} repo */
function recentCommits(repo) {
  try {
    return repo.gitLocal('rev-list', '--max-count=60', 'HEAD').split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

// The practice copy's course code, which is not the Learner's migration.
const COURSE = new Set(['learn', 'checks', 'capstone']);

// The folders where the pattern matched in a recent commit, each the folder
// that held a matching file ('.' for the repository's root), leaving out the
// course's own folders.
/**
 * @param {Repo} repo
 * @param {string} pattern
 * @param {string[]} revs
 */
function matchedFolders(repo, pattern, revs) {
  if (!revs.length) return [];
  let out = '';
  try {
    out = repo.gitLocal('grep', '-l', '-E', '-e', pattern, ...revs, '--');
  } catch (error) {
    if (/** @type {{ status?: number | null }} */ (error).status !== 1) throw error;
  }
  /** @type {Set<string>} */
  const folders = new Set();
  for (const line of out.split('\n').filter(Boolean)) {
    const path = line.slice(line.indexOf(':') + 1);
    if (COURSE.has(/** @type {string} */ (path.split('/')[0]))) continue;
    folders.add(posix.dirname(path));
  }
  return [...folders].sort();
}

/** @type {Item} */
export const migratedFolder = {
  text: `the \`git grep -E\` pattern in \`${PATTERN}\` matched in a folder at an earlier commit and matches nothing in that folder at \`HEAD\``,
  local: true,
  check(repo) {
    const { missing, pattern } = readPattern(repo);
    if (missing) return `There is no ${code(PATTERN)}. Save the \`git grep -E\` pattern that finds the old form there, on one line, such as \`import\\.meta\\.url\`.`;
    if (!pattern) return `${code(PATTERN)} is empty. Save the \`git grep -E\` pattern that finds the old form there, on one line.`;
    const shown = code(pattern);
    const now = grep(repo, pattern, '.', ['HEAD']);
    if (/** @type {{ error?: string }} */ (now)?.error) return `git can't use the pattern in ${code(PATTERN)}, ${shown}: ${/** @type {{ error: string }} */ (now).error}. Write it as \`git grep -E\` reads it, and test it with \`git grep -n -E '<pattern>' -- <folder>\`.`;
    const folders = matchedFolders(repo, pattern, recentCommits(repo));
    if (!folders.length) return `${shown} matches nothing in this repository's recent commits, so the check can't see a migration. Write the pattern for the old form, and test it on a commit from before the migration: \`git grep -n -E '<pattern>' <commit> -- <folder>\` should list the old form.`;
    if (folders.some((folder) => grep(repo, pattern, folder, ['HEAD']) === false)) return true;
    const where = (/** @type {string} */ folder) => (folder === '.' ? 'your repository' : code(`${folder}/`));
    const clean = folders.find((folder) => grep(repo, pattern, folder) === false);
    if (clean) return `${where(clean)} is migrated in your working tree, but ${shown} still matches there at \`HEAD\`. Review the changes and commit them.`;
    const named = folders.slice(0, 3).map(where);
    const more = folders.length > 3 ? ` and ${folders.length - 3} more` : '';
    return `${shown} still matches inside ${and(named)}${more} at \`HEAD\`, in every folder where it ever matched: \`git grep -n -E '${pattern}'\` lists the lines. Set the goal again for the folder you're migrating, review the changes and commit them.`;
  },
};

/** @type {Item[]} */
export const items = [savedWorkflow({ needArgs: true, needAgentCall: true, needCheck: true }), migratedFolder];
