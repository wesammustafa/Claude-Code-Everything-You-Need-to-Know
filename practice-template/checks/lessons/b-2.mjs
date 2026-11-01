// @ts-check
// Permission modes and plan mode (Beginner, lesson 2). Your turn works the
// ticket in practice/b-2/ticket.md and reviews the plan before approving.
// The Learner saves three snapshots under .practice/: git's status while the
// plan is on screen, the files the plan says it will change, and git's
// status after approving. The snapshots, not the live tree, prove the plan,
// since the Learner commits the change at the end of Your turn. The check
// runs the tool's behaviour itself, from the working tree.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inPlan, planPaths, statusPaths } from '../paths.mjs';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Permission modes and plan mode';

const SAVE_BEFORE = 'While the plan is on screen, run `git status --porcelain > .practice/b-2-before.txt` in another terminal.';

// Only the practice template's own tool is run: `--dir` pointed at another
// repository must not execute that repository's src/cli.js.
/** @param {Repo} repo */
function notTemplate(repo) {
  try {
    if (JSON.parse(repo.read('package.json') ?? '').name === 'claude-code-practice') return null;
  } catch {
    // Not JSON: not the template either.
  }
  return 'This runs the practice template\'s linkcheck tool, so run the check in your copy of the template: `npm run check -- b-2`.';
}

// Runs the working tree's CLI on a scratch folder holding `files`.
/**
 * @param {Repo} repo
 * @param {Record<string, string>} files
 */
function runTool(repo, files) {
  const work = mkdtempSync(join(tmpdir(), 'b-2-'));
  try {
    const docs = join(work, 'docs');
    mkdirSync(docs);
    for (const [name, text] of Object.entries(files)) writeFileSync(join(docs, name), text);
    return spawnSync(process.execPath, [join(repo.dir, 'src', 'cli.js'), docs], { encoding: 'utf8', timeout: 30_000 });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** @type {Item[]} */
export const items = [
  {
    text: '`.practice/b-2-before.txt`, saved while the plan was on screen, lists no changed files',
    local: true,
    check(repo) {
      const before = repo.read('.practice/b-2-before.txt');
      if (before === null) return SAVE_BEFORE;
      const changed = statusPaths(before, repo.prefix);
      if (changed.length) return `Files had changed before you approved the plan: ${changed.join(', ')}. Start from a clean tree (commit them, or set them aside with \`git stash push --include-untracked\`) and stay in plan mode until you approve.`;
      return true;
    },
  },
  {
    text: 'every file in `.practice/b-2-after.txt` is listed in `.practice/b-2-plan.txt`',
    local: true,
    check(repo) {
      const plan = repo.read('.practice/b-2-plan.txt');
      const after = repo.read('.practice/b-2-after.txt');
      if (plan === null || !plan.trim()) return 'Write the files the plan will change into `.practice/b-2-plan.txt`, one path per line, before you approve.';
      if (after === null) return 'After Claude finishes the edits, run `git status --porcelain > .practice/b-2-after.txt`.';
      // An empty snapshot is git seeing no edit yet, not a missing save: the
      // learner ran the command, so repeating it reads as stuck (190). It
      // keeps step 7's "or No" so it never says to approve every request,
      // and stays five lines in a 60x20 hint box so the card keeps its Goal
      // and border.
      if (!statusPaths(after, repo.prefix).length) return '`.practice/b-2-after.txt` lists no changed file yet. Approve the plan you reviewed; if Claude Code asks, read each request: plain Yes, or No if it does more than the plan needs. Once `git status` lists changes, save it again.';
      const planned = planPaths(plan, repo.dir);
      const extra = statusPaths(after, repo.prefix).filter((path) => !inPlan(planned, path));
      if (extra.length) return `Changed but not in the plan: ${extra.join(', ')}. Compare the plan you approved with what Claude changed.`;
      return true;
    },
  },
  {
    text: 'An unknown key in `linkcheck.json`, such as `ignores`, makes the tool exit with code 2 and name the key',
    // The committed change reaches GitHub's progress run, so these two items
    // report there; the snapshots above stay on the Learner's machine.
    check(repo) {
      const refused = notTemplate(repo);
      if (refused) return refused;
      const run = runTool(repo, { 'linkcheck.json': '{ "files": ["."], "ignores": ["vendor/"] }\n' });
      if (run.status !== 2) return `With \`"ignores"\` in \`linkcheck.json\`, the tool exited with code ${run.status}, not 2. Read the ticket's first request again: \`practice/b-2/ticket.md\`.`;
      if (!`${run.stderr}${run.stdout}`.includes('ignores')) return 'The tool exits with code 2 but its error doesn\'t name the key, `ignores`. The ticket asks for an error that names it.';
      return true;
    },
  },
  {
    text: 'A broken link still makes the tool exit with code 1 and report the link',
    check(repo) {
      const refused = notTemplate(repo);
      if (refused) return refused;
      const run = runTool(repo, { 'notes.md': 'See [the setup](missing.md).\n' });
      if (run.status !== 1) return `With a broken link, the tool exited with code ${run.status}, not 1, so CI would pass with broken links. Compare the plan you approved with the ticket, and tell Claude what to undo.`;
      // Node also exits with 1 when the CLI crashes, so the report must be there.
      if (!run.stdout.includes('broken link to missing.md')) return `With a broken link, the tool exited with code 1 but didn't report \`broken link to missing.md\`, so it failed for another reason: ${run.stderr.split('\n').find((line) => /Error/.test(line))?.trim() ?? 'it printed no error'}`;
      return true;
    },
  },
];
