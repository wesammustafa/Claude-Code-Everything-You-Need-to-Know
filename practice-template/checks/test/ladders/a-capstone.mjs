// Every FAIL message family of the Advanced capstone's check, each from a
// new copy that produces it: `files` to write, or
// `setup(dir, { write, commit })`. The capstone reuses lesson items from
// a-1, a-3, a-4, a-5, a-6 and b-3 with its own files. Each scenario breaks
// one thing, so one narrow question matches its message. The review script
// runs with the check's stand-in for `claude`, never Claude Code itself.
import { execFileSync } from 'node:child_process';
import { chmodSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { STUB_SESSION } from '../../stub-claude.mjs';

const git = (dir, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

const LISTING = '.practice/a-capstone-worktrees.txt';
const RUN = '.practice/a-capstone-run.json';
const SCRIPT = 'scripts/review-staged.sh';
const CI = '.github/workflows/claude-review.yml';
const SETTINGS = '.claude/settings.json';
const WORKFLOW = '.claude/workflows/file-review.js';

// Commits `files`, with the review script executable.
const committed = (files) => (dir, { write, commit }) => {
  write(dir, files);
  if (files[SCRIPT]) chmodSync(join(dir, SCRIPT), 0o755);
  commit(dir, 'Build it');
};

// ---- lesson 1: the ignore rule and the worktrees ----------------------------

// Two worktrees where `claude --worktree` makes them, one commit in each,
// the listing saved (before the commits when `early`), and the branches
// merged unless `merge` is false. `listing` rewrites what is saved.
const worktrees = ({ merge = true, early = false, listing = (text) => text } = {}) => (dir, { write, commit }) => {
  write(dir, { '.gitignore': '.claude/worktrees/\n', 'README.md': '# linkcheck\n' });
  commit(dir, 'Start');
  const names = ['review-script', 'team-kit'];
  for (const name of names) git(dir, 'worktree', 'add', '-q', '-b', `worktree-${name}`, `.claude/worktrees/${name}`);
  const save = () => write(dir, { [LISTING]: listing(`${git(dir, 'worktree', 'list', '--porcelain')}\n`) });
  if (early) save();
  for (const name of names) {
    const at = join(dir, '.claude', 'worktrees', name);
    write(at, { [`work/${name}.txt`]: `${name}\n` });
    commit(at, `Build ${name}`);
  }
  if (!early) save();
  if (merge) for (const name of names) git(dir, 'merge', '-q', '--no-ff', '--no-edit', `worktree-${name}`);
};

// ---- lessons 2 and 3: the saved workflow -----------------------------------

const META = "export const meta = {\n  name: 'file-review',\n  description: 'Review each file under src/ and have a second agent verify each finding',\n}\n";
const BODY = "\nconst found = await agent('Review each file under src/ for bugs.')\nconst checked = await agent(`Check each finding: ${found}`)\nreturn checked\n";

// ---- lessons 4 and 7: the review script and its run ------------------------

const PROMPT = 'Review this staged diff for bugs and missing tests. List each problem as file:line and one sentence, or say there are none.';
const TOOLS = '--tools "Read,Grep,Glob"';
const HOOKS = `--settings '{"disableAllHooks": true}'`;
const STRICT = '--strict-mcp-config';
const FLAGS = `--output-format json --permission-mode dontAsk --allowedTools "Read,Grep,Glob" ${TOOLS} ${HOOKS} ${STRICT} --max-turns 5 --max-budget-usd 0.50`;
const CALL = `claude -p "${PROMPT}" \\\n  ${FLAGS}`;
const REVIEW = [
  '#!/usr/bin/env bash',
  '# Review the staged diff with Claude Code and save the JSON result.',
  'set -uo pipefail',
  'out="${1:-.practice/a-4-result.json}"',
  'if git diff --cached --quiet; then echo "Nothing is staged." >&2; exit 2; fi',
  'mkdir -p "$(dirname "$out")"',
  `git diff --cached | ${CALL} > "$out"`,
  'status=$?',
  'jq -r \'.result // empty\' "$out"',
  'if [ "$status" -ne 0 ] || [ "$(jq -r \'.is_error\' "$out")" != "false" ]; then',
  '  echo "The review failed: $(jq -r \'.subtype\' "$out")" >&2; exit 1',
  'fi',
  '',
].join('\n');
const REAL_RUN = {
  type: 'result', subtype: 'success', is_error: false, num_turns: 3,
  result: 'src/total.js:2: the sum is not rounded to cents, and no test covers it.',
  session_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', total_cost_usd: 0.01, permission_denials: [],
};

// The review script with each `[from, to]` replaced.
function edited(...pairs) {
  return pairs.reduce((text, [from, to]) => {
    if (!text.includes(from)) throw new Error(`the review script has no ${JSON.stringify(from)}`);
    return text.replace(from, () => to);
  }, REVIEW);
}
const withFlags = (flags) => edited([FLAGS, flags]);
const withCall = (call) => edited([CALL, call]);

// The script committed and executable, beside a file the stand-in's scratch
// copy doesn't need; `run` is the saved run, null for none.
const script = (text, run = null) => (dir, helpers) => {
  committed({ 'README.md': '# linkcheck\n', [SCRIPT]: text })(dir, helpers);
  if (run !== null) helpers.write(dir, { [RUN]: typeof run === 'string' ? run : json(run) });
};
const saved = (run) => ({ [RUN]: typeof run === 'string' ? run : json(run) });

// ---- lesson 5: the review workflow -----------------------------------------

const PIN = 'fd1c128679612beff4ca259c78021c506e8aa7a7';
const CLAUDE_REVIEW = [
  'name: Claude review',
  '',
  'on:',
  '  pull_request:',
  '    types: [opened, synchronize]',
  '',
  'permissions:',
  '  contents: read',
  '  pull-requests: read',
  '',
  'jobs:',
  '  review:',
  '    runs-on: ubuntu-latest',
  '    timeout-minutes: 10',
  '    steps:',
  '      - uses: actions/checkout@v7',
  '        with:',
  '          fetch-depth: 0',
  `      - uses: anthropics/claude-code-action@${PIN} # v1.0.237`,
  '        with:',
  '          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}',
  '          github_token: ${{ github.token }}',
  "          prompt: Review this pull request's changes against origin/main for bugs. List each finding as file:line and one sentence.",
  '          claude_args: --max-turns 5 --allowedTools "Read,Grep,Glob,Bash(git diff *)"',
  '',
].join('\n');
// A made-up key, built here so no file holds one written out.
const KEY = `${['sk', 'ant', 'api03'].join('-')}-${'Xy9_'.repeat(8)}`;

function reviewWith(...pairs) {
  return pairs.reduce((text, [from, to]) => {
    if (!text.includes(from)) throw new Error(`the review workflow has no ${JSON.stringify(from)}`);
    return text.replace(from, () => to);
  }, CLAUDE_REVIEW);
}
const ARGS = 'claude_args: --max-turns 5 --allowedTools "Read,Grep,Glob,Bash(git diff *)"';
const withArgs = (args) => reviewWith([ARGS, `claude_args: ${args}`]);
const ci = (text) => committed({ [CI]: text });

// CI's review run, as `gh run list --json ...` saves it, in a copy whose
// origin is CI_ORIGIN; `ciRecord` commits the review workflow and saves the
// record (text as it is).
const CI_RECORD = '.practice/a-capstone-ci.json';
const CI_ORIGIN = 'git@github.com:learner/claude-capstone.git';
const CI_URL = 'https://github.com/learner/claude-capstone/actions/runs/123456789';
const CI_RUN = { databaseId: 123456789, status: 'completed', conclusion: 'success', event: 'pull_request', url: CI_URL, workflowName: 'Claude review' };
const ciRecord = (record) => (dir, helpers) => {
  ci(CLAUDE_REVIEW)(dir, helpers);
  git(dir, 'remote', 'add', 'origin', CI_ORIGIN);
  helpers.write(dir, { [CI_RECORD]: typeof record === 'string' ? record : json(record) });
};

// The capstone's integration: one committed review skill that the script and
// CI both run, and a concurrency group that cancels a superseded review.
const SKILL = '.claude/skills/team-review/SKILL.md';
const TEAM_REVIEW = '---\nname: team-review\ndescription: Reviews a change the team\'s way.\n---\n\nReview the change for bugs.\n';
const SKILL_SCRIPT = edited([`"${PROMPT}"`, '"/team-review"']);
const GROUP = 'concurrency:\n  group: review-${{ github.event.pull_request.number }}\n  cancel-in-progress: true\n';
const CI_SKILL = `${reviewWith(["prompt: Review this pull request's changes against origin/main for bugs. List each finding as file:line and one sentence.", 'prompt: /team-review'])}\n${GROUP}`;

// ---- lesson 6: the team marketplace and the shared settings -----------------

const MARKET = 'team-marketplace/.claude-plugin/marketplace.json';
const KIT = 'team-marketplace/plugins/team-kit';
const TEAM_MARKET = { name: 'team-tools', owner: { name: 'Your team' }, plugins: [{ name: 'team-kit', source: './plugins/team-kit' }] };
const PLUGIN_JSON = json({ name: 'team-kit', version: '0.1.0', description: 'A team\'s shared setup' });
const ONBOARD = '---\nname: onboard\ndescription: Explains the shared setup to a new teammate.\n---\n\nExplain it.\n';
const KIT_FILES = {
  [MARKET]: json(TEAM_MARKET),
  [`${KIT}/.claude-plugin/plugin.json`]: PLUGIN_JSON,
  [`${KIT}/skills/onboard/SKILL.md`]: ONBOARD,
};
const withEntry = (entry) => ({ ...KIT_FILES, [MARKET]: json({ ...TEAM_MARKET, plugins: [entry] }) });
const TEAM_SETTINGS = {
  extraKnownMarketplaces: { 'team-tools': { source: { source: 'directory', path: './team-marketplace' } } },
  enabledPlugins: { 'team-kit@team-tools': true },
};
const withSource = (source) => ({ ...TEAM_SETTINGS, extraKnownMarketplaces: { 'team-tools': { source } } });
const kitWith = (settings) => committed({ ...KIT_FILES, [SETTINGS]: typeof settings === 'string' ? settings : json(settings) });

export const scenarios = [
  // 0: the committed ignore rule.
  { item: 0, name: 'a negated rule keeps the folder', setup: committed({ '.gitignore': '.claude/worktrees/**\n!.claude/worktrees/**\n' }) },
  { item: 0, name: 'the rule only in .git/info/exclude', files: { '.git/info/exclude': '.practice/\n.claude/worktrees/\n' } },
  { item: 0, name: 'the rule not committed', files: { '.gitignore': '.claude/worktrees/\n' } },
  { item: 0, name: 'no rule', files: {} },
  { item: 0, name: 'a rule that ignores all of .claude', setup: committed({ '.gitignore': '.claude/\n' }) },

  // 1: the saved listing and the merges.
  { item: 1, name: 'no listing saved', files: {} },
  { item: 1, name: 'a listing that is no porcelain listing', files: { [LISTING]: 'two worktrees, both merged\n' } },
  { item: 1, name: 'a listing with the main checkout only', setup: worktrees({ listing: (text) => text.split('\n\n')[0] }) },
  { item: 1, name: 'a listing that names a commit this copy lacks', setup: worktrees({ listing: (text) => text.replace(/(worktree [^\n]*team-kit\nHEAD )[0-9a-f]{40}/, `$1${'ab'.repeat(20)}`) }) },
  { item: 1, name: 'a listing saved before both sessions committed', setup: worktrees({ early: true }) },
  { item: 1, name: 'branches not merged', setup: worktrees({ merge: false }) },

  // 2: the saved workflow.
  { item: 2, name: 'meta is not the first statement', setup: committed({ [WORKFLOW]: `const when = Date.now()\n${META}${BODY}` }) },
  { item: 2, name: 'meta computes a value', setup: committed({ [WORKFLOW]: `export const meta = { name: 'file-review', description: 'Review ' + 'each file' }\n${BODY}` }) },
  { item: 2, name: 'meta has no description', setup: committed({ [WORKFLOW]: `export const meta = { name: 'file-review' }\n${BODY}` }) },
  { item: 2, name: 'the script does not compile', setup: committed({ [WORKFLOW]: `${META}\nconst found = await agent('Review src/'\n` }) },
  { item: 2, name: 'the script starts no subagent', setup: committed({ [WORKFLOW]: `${META}\nreturn 'nothing to review'\n` }) },
  { item: 2, name: 'the script starts one agent only', setup: committed({ [WORKFLOW]: `${META}\nreturn await agent('Review each file under src/ for bugs.')\n` }) },
  { item: 2, name: 'the script in a subfolder', setup: committed({ '.claude/workflows/review/file-review.js': `${META}${BODY}` }) },
  { item: 2, name: 'the script saved but not committed', files: { [WORKFLOW]: `${META}${BODY}` } },
  {
    item: 2,
    name: 'the script hidden by an ignore rule',
    setup(dir, { write, commit }) {
      committed({ '.gitignore': '.claude/\n' })(dir, { write, commit });
      write(dir, { [WORKFLOW]: `${META}${BODY}` });
    },
  },
  { item: 2, name: 'no workflow saved', files: {} },

  // 3: the review script committed and executable.
  { item: 3, name: 'no script', files: {} },
  { item: 3, name: 'the script not committed', files: { [SCRIPT]: REVIEW } },
  {
    item: 3,
    name: 'the script not executable',
    setup(dir, { write, commit }) {
      write(dir, { [SCRIPT]: REVIEW });
      chmodSync(join(dir, SCRIPT), 0o644);
      commit(dir, 'Add the script');
    },
  },
  {
    item: 3,
    name: 'the script committed as a link',
    setup(dir, { write, commit }) {
      write(dir, { 'tools/review.sh': REVIEW });
      execFileSync('mkdir', ['-p', join(dir, 'scripts')]);
      symlinkSync('../tools/review.sh', join(dir, SCRIPT));
      commit(dir, 'Add the script');
    },
  },

  // 4: the claude -p call's flags.
  { item: 4, name: 'the script not committed', files: { [SCRIPT]: REVIEW } },
  { item: 4, name: 'Windows line ends', setup: script(REVIEW.replace(/\n/g, '\r\n')) },
  { item: 4, name: 'claude called by its path', setup: script(withCall(`/usr/local/bin/claude -p "${PROMPT}" ${FLAGS}`)) },
  { item: 4, name: 'claude without -p', setup: script(withCall(`claude "${PROMPT}" ${FLAGS}`)) },
  { item: 4, name: 'claude never called', setup: script(edited([`git diff --cached | ${CALL} > "$out"`, 'echo "Claude is off today." >&2; exit 3'])) },
  { item: 4, name: 'nothing after -p', setup: script(withCall(`claude ${FLAGS} "${PROMPT}" -p`)) },
  { item: 4, name: 'a flag right after -p', setup: script(withCall(`claude -p --max-turns 5 "${PROMPT}" --output-format json --permission-mode dontAsk --allowedTools "Read,Grep,Glob" ${TOOLS} ${HOOKS} ${STRICT}`)) },
  { item: 4, name: 'an empty prompt', setup: script(withCall(`claude -p "" ${FLAGS}`)) },
  { item: 4, name: 'no JSON asked for', setup: script(withFlags(FLAGS.replace('--output-format json ', ''))) },
  { item: 4, name: 'no format after the flag', setup: script(withFlags(`${FLAGS.replace('--output-format json ', '')} --output-format`)) },
  { item: 4, name: 'text output', setup: script(withFlags(FLAGS.replace('json', 'text'))) },
  { item: 4, name: 'no permission mode', setup: script(withFlags(FLAGS.replace('--permission-mode dontAsk ', ''))) },
  { item: 4, name: 'no mode after the flag', setup: script(withFlags(`${FLAGS.replace('--permission-mode dontAsk ', '')} --permission-mode`)) },
  { item: 4, name: 'dontAsk spelled in lower case', setup: script(withFlags(FLAGS.replace('dontAsk', 'dontask'))) },
  { item: 4, name: 'acceptEdits mode', setup: script(withFlags(FLAGS.replace('dontAsk', 'acceptEdits'))) },
  { item: 4, name: 'permissions skipped', setup: script(withFlags(`${FLAGS} --dangerously-skip-permissions`)) },
  { item: 4, name: 'no tools pre-approved', setup: script(withFlags(FLAGS.replace('--allowedTools "Read,Grep,Glob" ', ''))) },
  { item: 4, name: 'an empty tool list', setup: script(withFlags(FLAGS.replace('"Read,Grep,Glob"', '""'))) },
  { item: 4, name: 'a tool in lower case', setup: script(withFlags(FLAGS.replace('"Read,Grep,Glob"', '"read,Grep,Glob"'))) },
  { item: 4, name: 'a word that is no tool', setup: script(withFlags(FLAGS.replace('"Read,Grep,Glob"', '"Read,Grep,Glob" review'))) },
  { item: 4, name: 'Bash pre-approved', setup: script(withFlags(FLAGS.replace('"Read,Grep,Glob"', '"Read,Grep,Glob,Bash"'))) },
  { item: 4, name: 'no turn cap', setup: script(withFlags(FLAGS.replace('--max-turns 5 ', ''))) },
  { item: 4, name: 'no number after the turn cap', setup: script(withFlags(`${FLAGS.replace('--max-turns 5 ', '')} --max-turns`)) },
  { item: 4, name: 'a turn cap in words', setup: script(withFlags(FLAGS.replace('--max-turns 5', '--max-turns five'))) },
  { item: 4, name: 'a turn cap above 10', setup: script(withFlags(FLAGS.replace('--max-turns 5', '--max-turns 25'))) },
  { item: 4, name: 'no --tools', setup: script(withFlags(FLAGS.replace(`${TOOLS} `, ''))) },
  { item: 4, name: 'Bash kept by --tools', setup: script(withFlags(FLAGS.replace(TOOLS, '--tools "Read,Grep,Glob,Bash"'))) },
  { item: 4, name: 'a read tool left out of --tools', setup: script(withFlags(FLAGS.replace(TOOLS, '--tools "Read,Grep"'))) },
  { item: 4, name: 'nothing after --tools', setup: script(withFlags(`${FLAGS.replace(`${TOOLS} `, '')} --tools`)) },
  { item: 4, name: 'hooks left on', setup: script(withFlags(FLAGS.replace(`${HOOKS} `, ''))) },
  { item: 4, name: 'nothing after --settings', setup: script(withFlags(`${FLAGS.replace(`${HOOKS} `, '')} --settings`)) },
  { item: 4, name: 'a settings file in place of inline JSON', setup: script(withFlags(FLAGS.replace(HOOKS, '--settings .claude/review-settings.json'))) },
  { item: 4, name: 'settings JSON that leaves hooks on', setup: script(withFlags(FLAGS.replace(HOOKS, `--settings '{"disableAllHooks": false}'`))) },
  { item: 4, name: 'no --strict-mcp-config', setup: script(withFlags(FLAGS.replace(`${STRICT} `, ''))) },

  // 5: what the script does around its call.
  { item: 5, name: 'the script not committed', files: { [SCRIPT]: REVIEW } },
  { item: 5, name: 'Windows line ends', setup: script(REVIEW.replace(/\n/g, '\r\n')) },
  { item: 5, name: 'claude reached through npx', setup: script(withCall(`npx claude -p "${PROMPT}" ${FLAGS}`)) },
  { item: 5, name: 'no review call when given a path', setup: script(edited([`git diff --cached | ${CALL} > "$out"`, `if [ -z "\${1:-}" ]; then git diff --cached | ${CALL} > "$out"; fi`])) },
  { item: 5, name: 'the JSON saved beside the path it was given', setup: script(edited(['out="${1:-.practice/a-4-result.json}"', 'out="${1:-.practice/a-4-result.json}"; [ $# -gt 0 ] && out="$1.saved"'])) },
  { item: 5, name: 'jq missing', setup: script(edited(['jq -r \'.result // empty\' "$out"', 'echo "scripts/review-staged.sh: line 9: jq: command not found" >&2; exit 127'])) },
  { item: 5, name: 'two claude -p calls', setup: script(edited(['status=$?\n', `status=$?\ngit diff --cached | ${CALL} > /dev/null\n`])) },
  { item: 5, name: 'a second claude without -p', setup: script(edited(['status=$?\n', 'status=$?\nclaude doctor > /dev/null 2>&1\n'])) },
  { item: 5, name: 'the diff in the prompt', setup: script(edited([`git diff --cached | ${CALL}`, `claude -p "${PROMPT} $(git diff --cached)" ${FLAGS}`])) },
  { item: 5, name: 'the unstaged diff piped in', setup: script(edited([`git diff --cached | ${CALL}`, `git diff | ${CALL}`])) },
  { item: 5, name: 'both diffs piped in', setup: script(edited([`git diff --cached | ${CALL}`, `git diff HEAD | ${CALL}`])) },
  { item: 5, name: 'a non-zero exit after a review', setup: script(`${REVIEW}exit 5\n`) },
  { item: 5, name: 'the review not printed', setup: script(edited(['jq -r \'.result // empty\' "$out"\n', ''])) },
  { item: 5, name: 'the JSON saved to the default path only', setup: script(edited(['out="${1:-.practice/a-4-result.json}"', 'out=".practice/a-4-result.json"'])) },
  { item: 5, name: 'other JSON saved over the run', setup: script(`${REVIEW}[ $# -gt 0 ] && echo '{}' > "$out"\n`) },
  { item: 5, name: 'no folder made for the default path', setup: script(edited(['mkdir -p "$(dirname "$out")"\n', ''])) },
  { item: 5, name: 'no default path', setup: script(edited(['out="${1:-.practice/a-4-result.json}"', 'out="$1"'])) },
  { item: 5, name: 'exit 0 when claude fails', setup: script(edited(['> "$out"\nstatus=$?', '> "$out" || true\nstatus=$?'], ['if [ "$status" -ne 0 ] || [ "$(jq -r \'.is_error\' "$out")" != "false" ]; then', 'if [ "$(jq -r \'.is_error\' "$out")" = "true" ]; then'])) },
  { item: 5, name: 'exit 0 when the JSON says the run failed', setup: script(edited(['if [ "$status" -ne 0 ] || [ "$(jq -r \'.is_error\' "$out")" != "false" ]; then', 'if [ "$status" -ne 0 ]; then'])) },
  { item: 5, name: 'claude called with nothing staged', setup: script(edited(['then echo "Nothing is staged." >&2; exit 2; fi', `then git diff --cached | claude -p "${PROMPT}" ${FLAGS} > /dev/null; echo "Nothing is staged." >&2; exit 2; fi`])) },
  { item: 5, name: 'exit 0 with nothing staged', setup: script(edited(['then echo "Nothing is staged." >&2; exit 2; fi', 'then echo "Nothing is staged."; exit 0; fi'])) },
  { item: 5, name: 'silence with nothing staged', setup: script(edited(['then echo "Nothing is staged." >&2; exit 2; fi', 'then exit 2; fi'])) },

  // 6: the saved run.
  { item: 6, name: 'no run saved', files: {} },
  { item: 6, name: 'the review text saved', files: saved('src/total.js:2: the sum is not rounded.\n') },
  { item: 6, name: 'JSON that is no result', files: saved({ type: 'system', subtype: 'init' }) },
  { item: 6, name: 'the stand-in reply saved', files: saved({ ...REAL_RUN, session_id: STUB_SESSION }) },
  { item: 6, name: 'a run stopped at the turn cap', files: saved({ ...REAL_RUN, subtype: 'error_max_turns', is_error: true }) },
  { item: 6, name: 'a failed run', files: saved({ ...REAL_RUN, is_error: true, result: 'Credit balance is too low' }) },
  { item: 6, name: 'a run with no review', files: saved({ ...REAL_RUN, result: '' }) },
  { item: 6, name: 'a run with no session id', files: saved({ ...REAL_RUN, session_id: '' }) },
  { item: 6, name: 'a run with no turn count', files: saved({ ...REAL_RUN, num_turns: 0 }) },
  { item: 6, name: 'a run with more turns than the cap', files: saved({ ...REAL_RUN, num_turns: 20 }) },

  // 7: the review workflow and its limits.
  {
    item: 7,
    name: 'a change to a committed workflow not committed',
    setup(dir, { write, commit }) {
      committed({ [CI]: 'name: Claude review\non: pull_request\njobs:\n  review:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo later\n' })(dir, { write, commit });
      write(dir, { [CI]: CLAUDE_REVIEW });
    },
  },
  { item: 7, name: 'the workflow not committed', files: { [CI]: CLAUDE_REVIEW } },
  { item: 7, name: 'the workflow starts by hand', setup: ci(reviewWith(['  pull_request:\n    types: [opened, synchronize]', '  workflow_dispatch:'])) },
  { item: 7, name: 'only a workflow that waits for a mention', setup: ci(reviewWith(['  pull_request:\n    types: [opened, synchronize]', '  issue_comment:\n    types: [created]'], ["          prompt: Review this pull request's changes against origin/main for bugs. List each finding as file:line and one sentence.\n", ''])) },
  { item: 7, name: 'no workflow', files: {} },
  { item: 7, name: 'a key in the workflow', setup: ci(reviewWith(['${{ secrets.ANTHROPIC_API_KEY }}', KEY])) },
  { item: 7, name: 'the action without a version', setup: ci(reviewWith([`@${PIN} # v1.0.237`, ''])) },
  { item: 7, name: 'a short commit SHA', setup: ci(reviewWith([`@${PIN} # v1.0.237`, `@${PIN.slice(0, 7)}`])) },
  { item: 7, name: 'a major version tag', setup: ci(reviewWith([`@${PIN} # v1.0.237`, '@v1'])) },
  { item: 7, name: 'no prompt', setup: ci(reviewWith(["          prompt: Review this pull request's changes against origin/main for bugs. List each finding as file:line and one sentence.\n", ''])) },
  { item: 7, name: 'an empty prompt', setup: ci(reviewWith(["prompt: Review this pull request's changes against origin/main for bugs. List each finding as file:line and one sentence.", 'prompt: ""'])) },
  { item: 7, name: 'no credential', setup: ci(reviewWith(['          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}\n', ''])) },
  { item: 7, name: 'a credential from the environment', setup: ci(reviewWith(['${{ secrets.ANTHROPIC_API_KEY }}', '${{ env.CLAUDE_KEY }}'])) },
  { item: 7, name: 'pull_request_target too', setup: ci(reviewWith(['    types: [opened, synchronize]', '    types: [opened, synchronize]\n  pull_request_target:'])) },
  { item: 7, name: 'no claude_args', setup: ci(reviewWith([`          ${ARGS}\n`, ''])) },
  { item: 7, name: 'a comment that hides the tool list', setup: ci(withArgs('|\n            --max-turns 5 # a small cap\n            --allowedTools "Read,Grep,Glob,Bash(git diff *)"')) },
  { item: 7, name: 'the turn cap written with =', setup: ci(withArgs('--max-turns=5 --allowedTools "Read,Grep,Glob,Bash(git diff *)"')) },
  { item: 7, name: 'no turn cap', setup: ci(withArgs('--allowedTools "Read,Grep,Glob,Bash(git diff *)"')) },
  { item: 7, name: 'no number after the turn cap', setup: ci(withArgs('--max-turns --allowedTools "Read,Grep,Glob,Bash(git diff *)"')) },
  { item: 7, name: 'a turn cap in words', setup: ci(withArgs('--max-turns five --allowedTools "Read,Grep,Glob,Bash(git diff *)"')) },
  { item: 7, name: 'a turn cap above 10', setup: ci(withArgs('--max-turns 25 --allowedTools "Read,Grep,Glob,Bash(git diff *)"')) },
  { item: 7, name: 'a turn cap of 0', setup: ci(withArgs('--max-turns 0 --allowedTools "Read,Grep,Glob,Bash(git diff *)"')) },
  { item: 7, name: 'no tool list', setup: ci(withArgs('--max-turns 5')) },
  { item: 7, name: 'an empty tool list', setup: ci(withArgs('--max-turns 5 --allowedTools ""')) },
  { item: 7, name: 'tool rules split at spaces', setup: ci(withArgs('--max-turns 5 --allowedTools Read Bash(git diff *)')) },
  { item: 7, name: 'every shell command allowed', setup: ci(withArgs('--max-turns 5 --allowedTools "Read,Grep,Glob,Bash"')) },
  { item: 7, name: 'no time limit', setup: ci(reviewWith(['    timeout-minutes: 10\n', ''])) },
  { item: 7, name: 'a time limit in words', setup: ci(reviewWith(['timeout-minutes: 10', 'timeout-minutes: ten'])) },
  { item: 7, name: 'a time limit above 30', setup: ci(reviewWith(['timeout-minutes: 10', 'timeout-minutes: 45'])) },
  { item: 7, name: 'a time limit of 0', setup: ci(reviewWith(['timeout-minutes: 10', 'timeout-minutes: 0'])) },
  { item: 7, name: 'no permissions', setup: ci(reviewWith(['permissions:\n  contents: read\n  pull-requests: read\n\n', ''])) },
  { item: 7, name: 'every write permission', setup: ci(reviewWith(['permissions:\n  contents: read\n  pull-requests: read\n', 'permissions: write-all\n'])) },
  { item: 7, name: 'write access to the contents', setup: ci(reviewWith(['  contents: read\n', '  contents: write\n'])) },
  { item: 7, name: 'no github_token', setup: ci(reviewWith(['          github_token: ${{ github.token }}\n', ''])) },
  { item: 7, name: 'another token as github_token', setup: ci(reviewWith(['${{ github.token }}', '${{ secrets.BOT_TOKEN }}'])) },

  // 8: no committed key.
  { item: 8, name: 'a key in a committed note', setup: committed({ 'notes/ci setup.txt': `Remember:\nANTHROPIC_API_KEY=${KEY}\n` }) },

  // 9: the team marketplace.
  { item: 9, name: 'a trailing comma in the marketplace file', setup: committed({ ...KIT_FILES, [MARKET]: '{\n  "name": "team-tools",\n}\n' }) },
  { item: 9, name: 'a marketplace file that is a list', setup: committed({ ...KIT_FILES, [MARKET]: '[]\n' }) },
  { item: 9, name: 'a reserved marketplace name', setup: committed({ ...KIT_FILES, [MARKET]: json({ ...TEAM_MARKET, name: 'claude-plugins-official' }) }) },
  { item: 9, name: 'no owner', setup: committed({ ...KIT_FILES, [MARKET]: json({ ...TEAM_MARKET, owner: undefined }) }) },
  { item: 9, name: 'no plugins listed', setup: committed({ ...KIT_FILES, [MARKET]: json({ ...TEAM_MARKET, plugins: [] }) }) },
  { item: 9, name: 'an entry that is no object', setup: committed(withEntry('team-kit')) },
  { item: 9, name: 'an entry with a spaced name', setup: committed(withEntry({ name: 'team kit', source: './plugins/team-kit' })) },
  { item: 9, name: 'a plugin fetched from GitHub', setup: committed(withEntry({ name: 'team-kit', source: { source: 'github', repo: 'team/kit' } })) },
  { item: 9, name: 'an entry with no source', setup: committed(withEntry({ name: 'team-kit' })) },
  { item: 9, name: 'a source with backslashes', setup: committed(withEntry({ name: 'team-kit', source: '.\\plugins\\team-kit' })) },
  { item: 9, name: 'a source without ./', setup: committed(withEntry({ name: 'team-kit', source: 'plugins/team-kit' })) },
  { item: 9, name: 'a source outside the marketplace', setup: committed(withEntry({ name: 'team-kit', source: './../team-kit' })) },
  {
    item: 9,
    name: 'the plugin not committed',
    setup(dir, { write, commit }) {
      committed({ [MARKET]: json(TEAM_MARKET) })(dir, { write, commit });
      write(dir, { [`${KIT}/.claude-plugin/plugin.json`]: PLUGIN_JSON, [`${KIT}/skills/onboard/SKILL.md`]: ONBOARD });
    },
  },
  { item: 9, name: 'a plugin folder with no plugin.json', setup: committed({ [MARKET]: json(TEAM_MARKET), [`${KIT}/skills/onboard/SKILL.md`]: ONBOARD }) },
  { item: 9, name: 'an entry that points at nothing', setup: committed({ [MARKET]: json(TEAM_MARKET) }) },
  { item: 9, name: 'a trailing comma in plugin.json', setup: committed({ ...KIT_FILES, [`${KIT}/.claude-plugin/plugin.json`]: '{\n  "name": "team-kit",\n}\n' }) },
  { item: 9, name: 'plugin.json with no name', setup: committed({ ...KIT_FILES, [`${KIT}/.claude-plugin/plugin.json`]: json({ version: '0.1.0' }) }) },
  { item: 9, name: 'two names for the plugin', setup: committed({ ...KIT_FILES, [`${KIT}/.claude-plugin/plugin.json`]: json({ name: 'team-tools-kit' }) }) },
  { item: 9, name: 'a plugin with no component', setup: committed({ [MARKET]: json(TEAM_MARKET), [`${KIT}/.claude-plugin/plugin.json`]: PLUGIN_JSON }) },
  { item: 9, name: 'the example folder not renamed', setup: committed({ 'team-marketplace/dot-claude-plugin/marketplace.json': json(TEAM_MARKET), [`${KIT}/.claude-plugin/plugin.json`]: PLUGIN_JSON }) },
  {
    item: 9,
    name: 'the marketplace hidden by an ignore rule',
    setup(dir, { write, commit }) {
      committed({ '.gitignore': 'team-marketplace/\n' })(dir, { write, commit });
      write(dir, KIT_FILES);
    },
  },
  { item: 9, name: 'no marketplace', files: {} },

  // 10: the shared settings.
  { item: 10, name: 'no marketplace passes', files: { [SETTINGS]: json(TEAM_SETTINGS) } },
  {
    item: 10,
    name: 'the settings not committed',
    setup(dir, { write, commit }) {
      committed(KIT_FILES)(dir, { write, commit });
      write(dir, { [SETTINGS]: json(TEAM_SETTINGS) });
    },
  },
  { item: 10, name: 'no settings', setup: committed(KIT_FILES) },
  { item: 10, name: 'a trailing comma in the settings', setup: kitWith('{\n  "enabledPlugins": {},\n}\n') },
  { item: 10, name: 'settings that are a list', setup: kitWith('[]\n') },
  { item: 10, name: 'no marketplace registered', setup: kitWith({ enabledPlugins: TEAM_SETTINGS.enabledPlugins }) },
  { item: 10, name: 'the marketplace under the other spelling too', setup: kitWith({ ...TEAM_SETTINGS, extraKnownMarketplaces: { other: { source: { source: 'github', repo: 'team/other' } } }, additionalMarketplaces: TEAM_SETTINGS.extraKnownMarketplaces }) },
  { item: 10, name: 'the marketplace under another key', setup: kitWith({ ...TEAM_SETTINGS, extraKnownMarketplaces: { team: TEAM_SETTINGS.extraKnownMarketplaces['team-tools'] } }) },
  { item: 10, name: 'another marketplace registered', setup: kitWith({ ...TEAM_SETTINGS, extraKnownMarketplaces: { other: { source: { source: 'github', repo: 'team/other' } } } }) },
  { item: 10, name: 'a registration with no source', setup: kitWith({ ...TEAM_SETTINGS, extraKnownMarketplaces: { 'team-tools': {} } }) },
  { item: 10, name: 'the marketplace from GitHub', setup: kitWith(withSource({ source: 'github', repo: 'team/tools' })) },
  { item: 10, name: 'a folder with no path', setup: kitWith(withSource({ source: 'directory' })) },
  { item: 10, name: 'a path on this machine', setup: kitWith(withSource({ source: 'directory', path: '/Users/me/claude-capstone/team-marketplace' })) },
  { item: 10, name: 'a path with backslashes', setup: kitWith(withSource({ source: 'directory', path: '.\\team-marketplace' })) },
  { item: 10, name: 'a path that leaves the repository', setup: kitWith(withSource({ source: 'directory', path: '../team-marketplace' })) },
  { item: 10, name: 'a path to another folder', setup: kitWith(withSource({ source: 'directory', path: './plugins' })) },
  { item: 10, name: 'the plugin turned off', setup: kitWith({ ...TEAM_SETTINGS, enabledPlugins: { 'team-kit@team-tools': false } }) },
  { item: 10, name: 'the plugin turned on with a string', setup: kitWith({ ...TEAM_SETTINGS, enabledPlugins: { 'team-kit@team-tools': 'true' } }) },
  { item: 10, name: 'the plugin under another marketplace name', setup: kitWith({ ...TEAM_SETTINGS, enabledPlugins: { 'team-kit@team-marketplace': true } }) },
  { item: 10, name: 'no plugin turned on', setup: kitWith({ extraKnownMarketplaces: TEAM_SETTINGS.extraKnownMarketplaces }) },
  {
    item: 10,
    name: 'the fix not committed',
    setup(dir, { write, commit }) {
      kitWith({ extraKnownMarketplaces: TEAM_SETTINGS.extraKnownMarketplaces })(dir, { write, commit });
      write(dir, { [SETTINGS]: json(TEAM_SETTINGS) });
    },
  },

  // 11 and 12: the tests and a clean tree, as b-3 checks them.
  { item: 11, name: 'the tests fail', files: { 'package.json': '{ "scripts": { "test": "exit 1" } }\n' } },
  { item: 11, name: 'no test script and no saved exit code', files: {} },
  { item: 11, name: 'a PowerShell True instead of an exit code', files: { '.practice/b-3-tests.txt': 'True\n' } },
  { item: 11, name: 'a saved exit code that is not 0', files: { '.practice/b-3-tests.txt': '1\n' } },
  { item: 12, name: 'a new file not committed', files: { 'src/new.js': '// not committed\n' } },

  // 13: the spend cap.
  { item: 13, name: 'no script', files: saved(REAL_RUN) },
  { item: 13, name: 'a script with no claude -p call', setup: script('#!/usr/bin/env bash\necho "No review today."\n', REAL_RUN) },
  { item: 13, name: 'no spend cap', setup: script(withFlags(FLAGS.replace(' --max-budget-usd 0.50', '')), REAL_RUN) },
  { item: 13, name: 'no amount after the cap', setup: script(withFlags(FLAGS.replace(' 0.50', '')), REAL_RUN) },
  { item: 13, name: 'the cap from a variable', setup: script(withFlags(FLAGS.replace('0.50', '"$BUDGET"')), REAL_RUN) },
  { item: 13, name: 'a cap of 0', setup: script(withFlags(FLAGS.replace('0.50', '0')), REAL_RUN) },
  { item: 13, name: 'no run saved', setup: script(REVIEW) },
  { item: 13, name: 'a run stopped at the cap', setup: script(REVIEW, { ...REAL_RUN, subtype: 'error_max_budget_usd', is_error: true }) },
  { item: 13, name: 'a run with no cost', setup: script(REVIEW, (({ total_cost_usd, ...rest }) => rest)(REAL_RUN)) },
  { item: 13, name: 'a run that cost the whole cap', setup: script(REVIEW, { ...REAL_RUN, total_cost_usd: 0.5 }) },

  // 14: one review, the same skill in the script and in CI.
  { item: 14, name: 'no script', files: {} },
  { item: 14, name: 'a script with no claude -p call', setup: committed({ [SCRIPT]: '#!/usr/bin/env bash\necho "No review today."\n' }) },
  { item: 14, name: 'no review workflow', setup: committed({ [SCRIPT]: SKILL_SCRIPT, [SKILL]: TEAM_REVIEW }) },
  { item: 14, name: 'a plain prompt in the script', setup: committed({ [SCRIPT]: REVIEW, [SKILL]: TEAM_REVIEW, [CI]: CI_SKILL }) },
  { item: 14, name: 'a plain prompt in CI', setup: committed({ [SCRIPT]: SKILL_SCRIPT, [SKILL]: TEAM_REVIEW, [CI]: CLAUDE_REVIEW }) },
  { item: 14, name: 'two different skills', setup: committed({ [SCRIPT]: SKILL_SCRIPT, [SKILL]: TEAM_REVIEW, [CI]: CI_SKILL.replace('/team-review', '/other-review') }) },
  { item: 14, name: 'a plugin skill in both', setup: committed({ [SCRIPT]: SKILL_SCRIPT.replace('/team-review', '/team-kit:review'), [CI]: CI_SKILL.replace('/team-review', '/team-kit:review') }) },
  { item: 14, name: 'the skill not committed', setup: committed({ [SCRIPT]: SKILL_SCRIPT, [CI]: CI_SKILL }) },

  // 15: a new push cancels the review still running.
  { item: 15, name: 'no review workflow', files: {} },
  { item: 15, name: 'no concurrency', setup: ci(CI_SKILL.replace(GROUP, '')) },
  { item: 15, name: 'a group that cancels nothing', setup: ci(CI_SKILL.replace(GROUP, 'concurrency: review\n')) },
  { item: 15, name: 'a job group that cancels nothing', setup: ci(CI_SKILL.replace(GROUP, '').replace('    runs-on: ubuntu-latest', '    runs-on: ubuntu-latest\n    concurrency: { group: review }')) },

  // 16: the saved record of CI's review run.
  { item: 16, name: 'no record saved', setup: ci(CLAUDE_REVIEW) },
  { item: 16, name: 'a record that is no JSON', setup: ciRecord('Run 1 passed.\n') },
  { item: 16, name: 'a record with no runs', setup: ciRecord([]) },
  { item: 16, name: 'a record without the fields', setup: ciRecord([{ databaseId: 1, url: CI_URL }]) },
  { item: 16, name: 'a record and no review workflow', setup: (dir, helpers) => { helpers.write(dir, { 'README.md': '# linkcheck\n', [CI_RECORD]: json([CI_RUN]) }); helpers.commit(dir, 'Start'); } },
  { item: 16, name: 'only another workflow\'s runs', setup: ciRecord([{ ...CI_RUN, workflowName: 'Progress', event: 'push' }]) },
  { item: 16, name: 'no run a pull request started', setup: ciRecord([{ ...CI_RUN, event: 'workflow_dispatch' }]) },
  { item: 16, name: 'a run with no URL', setup: ciRecord([{ ...CI_RUN, url: undefined }]) },
  { item: 16, name: 'a run in another repository', setup: ciRecord([{ ...CI_RUN, url: 'https://github.com/someone/else/actions/runs/1' }]) },
  { item: 16, name: 'a run still in progress', setup: ciRecord([{ ...CI_RUN, status: 'in_progress', conclusion: '' }]) },
  { item: 16, name: 'a run a newer push cancelled', setup: ciRecord([{ ...CI_RUN, conclusion: 'cancelled' }]) },
  { item: 16, name: 'a failed run', setup: ciRecord([{ ...CI_RUN, conclusion: 'failure' }]) },
  { item: 16, name: 'a run that timed out', setup: ciRecord([{ ...CI_RUN, conclusion: 'timed_out' }]) },
  { item: 16, name: 'a skipped run', setup: ciRecord([{ ...CI_RUN, conclusion: 'skipped' }]) },
];
