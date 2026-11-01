// Every FAIL message family of Advanced lesson 7's check, each from a work
// folder that produces it: `files` to write, or `setup(dir, { write, commit })`.
// Each scenario holds one problem, so its message matches one narrow question.
// The first four items run the committed runner with the check's stand-in
// for `claude`, never Claude Code itself.
import { chmodSync, mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { STUB_SESSION } from '../../stub-claude.mjs';

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const SCRIPT = 'scripts/bounded-run.sh';
const BOUNDS_PATH = '.claude/bounded-run.json';
const SLICE = '.practice/a-7-slice.json';
const CALL = [
  'claude -p "$1" \\',
  '  --setting-sources project \\',
  '  --strict-mcp-config \\',
  `  --settings ${BOUNDS_PATH} \\`,
  '  --permission-mode dontAsk \\',
  '  --model sonnet \\',
  '  --max-turns 15 \\',
  '  --max-budget-usd 2 \\',
  '  --output-format json > "$2"',
].join('\n');
// The lesson's runner, as the page saves it.
const RUNNER = [
  '#!/bin/bash',
  `# Runs one unattended task inside the bounds in ${BOUNDS_PATH}.`,
  'set -u',
  'if [ $# -ne 2 ]; then',
  '  echo \'Usage: scripts/bounded-run.sh "<task>" <result.json>\' >&2',
  '  exit 2',
  'fi',
  'before=$(git rev-parse --short HEAD)',
  CALL,
  'status=$?',
  'jq \'{subtype, num_turns, total_cost_usd, denied: [.permission_denials[]? | .tool_input.command // .tool_name]}\' "$2"',
  'echo "HEAD before: $before, after: $(git rev-parse --short HEAD)"',
  'git status --short',
  'exit "$status"',
  '',
].join('\n');
const BOUNDS = {
  permissions: {
    allow: ['Edit(./src/**)', 'Edit(./test/**)', 'Bash(npm test *)'],
    deny: ['Agent', 'Read(./.env)', 'Read(./.env.*)', 'Bash(git commit *)', 'Bash(git push *)'],
  },
  sandbox: { enabled: true, failIfUnavailable: true, allowUnsandboxedCommands: false, autoAllowBashIfSandboxed: false },
};
const SLICE_RUN = {
  type: 'result', subtype: 'success', is_error: false, num_turns: 9, total_cost_usd: 0.42,
  result: 'Added a test for total(); npm test passes. The commit was denied.',
  session_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', permission_denials: [{ tool_name: 'Bash', tool_input: { command: 'git commit -m "Add a test"' } }],
};

// The runner with each [from, to] replaced.
const runner = (...pairs) => pairs.reduce((text, [from, to]) => {
  if (!text.includes(from)) throw new Error(`the runner has no ${JSON.stringify(from)}`);
  return text.replace(from, () => to);
}, RUNNER);
const boundsWith = (change) => {
  const bounds = structuredClone(BOUNDS);
  change(bounds);
  return bounds;
};

// The finished lesson, with one step changed: `script` (null for none) is
// saved with `mode` and committed unless `commitScript` is false; `bounds`
// (null for none, text as it is) is committed unless `commitBounds` is
// false; `project` (text) is committed as .claude/settings.json; `slice`
// (null for none) is the saved run.
function bounded({ script = RUNNER, mode = 0o755, commitScript = true, bounds = BOUNDS, commitBounds = true, project = null, slice = SLICE_RUN } = {}) {
  return (dir, { write, commit }) => {
    write(dir, { '.gitignore': '.practice/\n', 'README.md': '# demo\n', 'src/total.js': 'export const total = (items) => items.length;\n', ...(project === null ? {} : { '.claude/settings.json': project }) });
    commit(dir, 'Start');
    if (bounds !== null) {
      write(dir, { [BOUNDS_PATH]: typeof bounds === 'string' ? bounds : json(bounds) });
      if (commitBounds) commit(dir, 'Add the bounds', [BOUNDS_PATH]);
    }
    if (script !== null) {
      write(dir, { [SCRIPT]: script });
      chmodSync(join(dir, SCRIPT), mode);
      if (commitScript) commit(dir, 'Add the bounded runner', [SCRIPT]);
    }
    if (slice !== null) write(dir, { [SLICE]: typeof slice === 'string' ? slice : json(slice) });
  };
}

const allowing = (...rules) => bounded({ bounds: boundsWith((b) => { b.permissions.allow = ['Edit(./src/**)', ...rules]; }) });
// The runner with its `--settings` value replaced.
const settingsFlag = (to) => runner([`  --settings ${BOUNDS_PATH} \\\n`, to]);
// A runner whose `claude -p` call never runs under the stand-in, so the
// check reads the call from the script's text, with `[from, to]` applied.
const unrun = (...pairs) => runner(['before=$(git rev-parse --short HEAD)', 'before=$(git rev-parse --short HEAD)\n[ -n "${NEVER:-}" ] || exit 0'], ...pairs);
// Each way the bounds a call names can't be read, as `{ name, setup }`.
const UNREADABLE = [
  { name: 'nothing after --settings', setup: bounded({ script: runner([`  --settings ${BOUNDS_PATH} \\\n`, ''], ['  --output-format json > "$2"', '  --output-format json --settings > "$2"']) }) },
  { name: 'inline settings that are no JSON', setup: bounded({ script: settingsFlag("  --settings '{allow: Edit}' \\\n") }) },
  { name: 'the settings file from a variable', setup: bounded({ script: unrun([`--settings ${BOUNDS_PATH}`, '--settings "$BOUNDS"']) }) },
  { name: 'a settings file outside the repository', setup: bounded({ script: settingsFlag('  --settings /etc/claude/bounded-run.json \\\n') }) },
  { name: 'the bounds file not committed', setup: bounded({ commitBounds: false }) },
  { name: 'a settings file that does not exist', setup: bounded({ script: settingsFlag('  --settings .claude/bounds.json \\\n') }) },
  { name: 'a bounds file that is no JSON', setup: bounded({ bounds: '{ "permissions": { "allow": [], } }\n' }) },
  { name: 'a bounds file that is a list', setup: bounded({ bounds: '[]\n' }) },
];
const NO_CALL = bounded({ script: runner([CALL, 'echo "{}" > "$2"']) });

export const scenarios = [
  // Item 0: the runner, committed and executable, and its one call.
  { item: 0, name: 'no runner', setup: bounded({ script: null }) },
  { item: 0, name: 'the runner not committed', setup: bounded({ commitScript: false }) },
  { item: 0, name: 'the runner not executable', setup: bounded({ mode: 0o644 }) },
  { item: 0, name: 'no permission mode', setup: bounded({ script: runner(['  --permission-mode dontAsk \\\n', '']) }) },
  { item: 0, name: 'no JSON output', setup: bounded({ script: runner(['  --output-format json > "$2"', '  > "$2"']) }) },
  { item: 0, name: 'no settings file', setup: bounded({ script: runner([`  --settings ${BOUNDS_PATH} \\\n`, '']) }) },
  { item: 0, name: 'no --strict-mcp-config', setup: bounded({ script: runner(['  --strict-mcp-config \\\n', '']) }) },
  { item: 0, name: 'the task without quotes', setup: bounded({ script: runner(['claude -p "$1"', 'claude -p $1']) }) },
  { item: 0, name: 'the JSON saved to the slice path', setup: bounded({ script: runner(['--output-format json > "$2"', `--output-format json > ${SLICE}`]) }) },
  { item: 0, name: 'claude run without -p', setup: bounded({ script: runner(['claude -p "$1"', 'claude "$1"']) }) },
  {
    item: 0,
    name: 'a link committed in place of the runner',
    setup: (dir, { write, commit }) => {
      bounded({ script: null })(dir, { write, commit });
      write(dir, { 'tools/bounded-run.sh': RUNNER });
      mkdirSync(join(dir, 'scripts'), { recursive: true });
      symlinkSync('../tools/bounded-run.sh', join(dir, SCRIPT));
      commit(dir, 'Add a link to the runner');
    },
  },
  { item: 0, name: 'Windows line ends', setup: bounded({ script: RUNNER.replace(/\n/g, '\r\n') }) },
  { item: 0, name: 'claude reached through npx', setup: bounded({ script: runner(['claude -p "$1"', 'npx claude -p "$1"']) }) },
  { item: 0, name: 'a runner that stops before its call', setup: bounded({ script: runner(['if [ $# -ne 2 ]', 'if [ $# -ne 3 ]']) }) },
  { item: 0, name: 'two runs for one task', setup: bounded({ script: runner([CALL, `${CALL}\n${CALL}`]) }) },
  { item: 0, name: 'an interactive call besides the run', setup: bounded({ script: runner(['status=$?\n', 'status=$?\nclaude doctor > /dev/null 2>&1\n']) }) },
  { item: 0, name: 'the task in a flag\'s value', setup: bounded({ script: runner(['claude -p "$1"', 'claude -p "Do the task." --append-system-prompt "$1"']) }) },
  { item: 0, name: 'the task never passed', setup: bounded({ script: runner(['claude -p "$1"', 'claude -p "Do the task."']) }) },
  { item: 0, name: 'the JSON thrown away', setup: bounded({ script: runner(['--output-format json > "$2"', '--output-format json > /dev/null']) }) },
  { item: 0, name: 'other JSON saved over the run', setup: bounded({ script: runner(['status=$?\n', 'status=$?\necho \'{}\' > "$2"\n']) }) },
  { item: 0, name: 'permissions skipped', setup: bounded({ script: runner(['  --model sonnet \\\n', '  --model sonnet \\\n  --dangerously-skip-permissions \\\n']) }) },
  { item: 0, name: 'a switch to skipped permissions allowed', setup: bounded({ script: runner(['  --model sonnet \\\n', '  --model sonnet \\\n  --allow-dangerously-skip-permissions \\\n']) }) },
  { item: 0, name: 'no mode after the permission flag', setup: bounded({ script: runner(['--permission-mode dontAsk', '--permission-mode']) }) },
  { item: 0, name: 'dontAsk in the wrong case', setup: bounded({ script: runner(['--permission-mode dontAsk', '--permission-mode dontask']) }) },
  { item: 0, name: 'another permission mode', setup: bounded({ script: runner(['--permission-mode dontAsk', '--permission-mode acceptEdits']) }) },
  { item: 0, name: 'no format after the output flag', setup: bounded({ script: runner(['--output-format json > "$2"', '--output-format > "$2"']) }) },
  { item: 0, name: 'text output', setup: bounded({ script: runner(['--output-format json > "$2"', '--output-format text > "$2"']) }) },
  ...UNREADABLE.filter((u) => u.name !== 'the settings file from a variable').map((u) => ({ item: 0, ...u })),

  // Item 1: the turn and spend limits.
  { item: 1, name: 'no turn limit', setup: bounded({ script: runner(['  --max-turns 15 \\\n', '']) }) },
  { item: 1, name: 'no spend limit', setup: bounded({ script: runner(['  --max-budget-usd 2 \\\n', '']) }) },
  { item: 1, name: 'a turn limit that is no whole number', setup: bounded({ script: runner(['--max-turns 15', '--max-turns abc']) }) },
  { item: 1, name: 'a turn limit below 1', setup: bounded({ script: runner(['--max-turns 15', '--max-turns 0']) }) },
  { item: 1, name: 'a spend limit with a dollar sign', setup: bounded({ script: runner(['--max-budget-usd 2', '--max-budget-usd \'$2\'']) }) },
  { item: 1, name: 'a spend limit of 0', setup: bounded({ script: runner(['--max-budget-usd 2', '--max-budget-usd 0']) }) },
  { item: 1, name: 'no claude -p call at all', setup: NO_CALL },
  { item: 1, name: 'no number after the turn limit', setup: bounded({ script: runner(['  --max-turns 15 \\\n', ''], ['--output-format json > "$2"', '--output-format json --max-turns > "$2"']) }) },
  { item: 1, name: 'a flag where the turn limit goes', setup: bounded({ script: runner(['  --max-turns 15 \\\n', ''], ['  --model sonnet', '  --max-turns --model sonnet']) }) },
  { item: 1, name: 'a flag where the spend limit goes', setup: bounded({ script: runner(['--max-budget-usd 2', '--max-budget-usd']) }) },
  { item: 1, name: 'a turn limit from a variable', setup: bounded({ script: unrun(['--max-turns 15', '--max-turns "$TURNS"']) }) },
  { item: 1, name: 'no amount after the spend limit', setup: bounded({ script: runner(['  --max-budget-usd 2 \\\n', ''], ['--output-format json > "$2"', '--output-format json --max-budget-usd > "$2"']) }) },

  // Item 2: narrow allow rules, and deny rules that stop commit and push.
  { item: 2, name: 'a bare Bash allow rule', setup: bounded({ bounds: boundsWith((b) => { b.permissions.allow = ['Edit(./src/**)', 'Bash']; }) }) },
  { item: 2, name: 'every npm command allowed', setup: bounded({ bounds: boundsWith((b) => { b.permissions.allow = ['Edit(./src/**)', 'Bash(npm *)']; }) }) },
  { item: 2, name: 'edits allowed in every folder', setup: bounded({ bounds: boundsWith((b) => { b.permissions.allow = ['Edit(./**)', 'Bash(npm test *)']; }) }) },
  { item: 2, name: 'no deny rule for git push', setup: bounded({ bounds: boundsWith((b) => { b.permissions.deny = b.permissions.deny.filter((r) => r !== 'Bash(git push *)'); }) }) },
  { item: 2, name: 'no deny rule for git commit', setup: bounded({ bounds: boundsWith((b) => { b.permissions.deny = b.permissions.deny.filter((r) => r !== 'Bash(git commit *)'); }) }) },
  { item: 2, name: 'a deny rule for the bare git push only', setup: bounded({ bounds: boundsWith((b) => { b.permissions.deny = b.permissions.deny.map((r) => (r === 'Bash(git push *)' ? 'Bash(git push)' : r)); }) }) },
  { item: 2, name: 'no claude -p call at all', setup: NO_CALL },
  ...UNREADABLE.map((u) => ({ item: 2, ...u })),
  { item: 2, name: 'project settings that are no JSON', setup: bounded({ project: '{ "permissions": { "deny": [], } }\n' }) },
  { item: 2, name: 'project settings that are a list', setup: bounded({ project: '[]\n' }) },
  { item: 2, name: 'git commit allowed', setup: allowing('Bash(git commit *)') },
  { item: 2, name: 'a wildcard in a tool name', setup: allowing('Bash*') },
  { item: 2, name: 'a whole MCP server allowed', setup: allowing('mcp__github') },
  { item: 2, name: 'a command rule that starts with a wildcard', setup: allowing('Bash(* test)') },
  { item: 2, name: 'Read on every file', setup: allowing('Read') },
  { item: 2, name: 'edits outside the project', setup: allowing('Edit(../shared/**)') },
  { item: 2, name: 'edits anywhere on the disk', setup: allowing('Edit(//**)') },
  { item: 2, name: 'edits anywhere in the home folder', setup: allowing('Edit(~/**)') },
  { item: 2, name: 'every use of a tool', setup: allowing('WebSearch') },
  { item: 2, name: 'fetches from every domain', setup: allowing('WebFetch(domain:*)') },
  { item: 2, name: 'no allow rule of its own', setup: bounded({ bounds: boundsWith((b) => { delete b.permissions.allow; }) }) },

  // Item 3: the strict sandbox.
  { item: 3, name: 'no sandbox block', setup: bounded({ bounds: boundsWith((b) => { delete b.sandbox; }) }) },
  { item: 3, name: 'no failIfUnavailable', setup: bounded({ bounds: boundsWith((b) => { delete b.sandbox.failIfUnavailable; }) }) },
  { item: 3, name: 'auto-allow left on', setup: bounded({ bounds: boundsWith((b) => { b.sandbox.autoAllowBashIfSandboxed = true; }) }) },
  { item: 3, name: 'the unsandboxed retry left on', setup: bounded({ bounds: boundsWith((b) => { delete b.sandbox.allowUnsandboxedCommands; }) }) },
  { item: 3, name: 'the sandbox not enabled', setup: bounded({ bounds: boundsWith((b) => { b.sandbox.enabled = false; }) }) },
  { item: 3, name: 'no claude -p call at all', setup: NO_CALL },
  ...UNREADABLE.map((u) => ({ item: 3, ...u })),
  { item: 3, name: 'no settings file passed', setup: bounded({ script: runner([`  --settings ${BOUNDS_PATH} \\\n`, '']) }) },

  // Item 4: the saved slice run.
  { item: 4, name: 'no saved slice', setup: bounded({ slice: null }) },
  { item: 4, name: 'the summary text saved', setup: bounded({ slice: 'Added a test for total(). npm test passes.\n' }) },
  { item: 4, name: 'a stream that never finished', setup: bounded({ slice: `${JSON.stringify({ type: 'system', subtype: 'init' })}\n${JSON.stringify({ type: 'assistant', message: { content: [] } })}\n` }) },
  { item: 4, name: 'no result message', setup: bounded({ slice: { ...SLICE_RUN, type: 'assistant' } }) },
  { item: 4, name: 'the check\'s stand-in reply', setup: bounded({ slice: { ...SLICE_RUN, session_id: STUB_SESSION } }) },
  { item: 4, name: 'the slice stopped at the spend limit', setup: bounded({ slice: { ...SLICE_RUN, subtype: 'error_max_budget_usd', is_error: true } }) },
  { item: 4, name: 'the slice stopped at the turn limit', setup: bounded({ slice: { ...SLICE_RUN, subtype: 'error_max_turns', is_error: true } }) },
  { item: 4, name: 'the slice ended in another error', setup: bounded({ slice: { ...SLICE_RUN, subtype: 'error_during_execution', is_error: true } }) },
  { item: 4, name: 'the slice run failed', setup: bounded({ slice: { ...SLICE_RUN, is_error: true, result: 'Not logged in' } }) },
  { item: 4, name: 'no cost estimate', setup: bounded({ slice: { ...SLICE_RUN, total_cost_usd: undefined } }) },
  { item: 4, name: 'no turn count', setup: bounded({ slice: { ...SLICE_RUN, num_turns: undefined } }) },
  { item: 4, name: 'no spend limit to compare with', setup: bounded({ script: runner(['  --max-budget-usd 2 \\\n', '']) }) },
  { item: 4, name: 'the slice cost more than the limit', setup: bounded({ slice: { ...SLICE_RUN, total_cost_usd: 2.37 } }) },
];
