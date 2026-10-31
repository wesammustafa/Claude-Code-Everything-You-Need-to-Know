// Every FAIL message of Advanced lesson 4's check, each from a work folder
// that produces it: `files` to write, or `setup(dir, { write, commit })`.
// Each scenario breaks one thing, so one narrow question matches its message.
// The script items run the committed script with the check's stand-in for
// `claude`, never Claude Code itself.
import { chmodSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = 'scripts/review-staged.sh';
const RESULT = '.practice/a-4-result.json';
const PROMPT = 'Review this staged diff for bugs and missing tests. List each problem as file:line and one sentence, or say there are none.';
const TOOLS = '--tools "Read,Grep,Glob"';
const HOOKS = `--settings '{"disableAllHooks": true}'`;
const STRICT = '--strict-mcp-config';
// What keeps the run to the three read tools, with no hooks and no MCP server.
const LIMITS = `${TOOLS} ${HOOKS} ${STRICT}`;
const FLAGS = `--output-format json --permission-mode dontAsk --allowedTools "Read,Grep,Glob" --max-turns 5 ${LIMITS}`;
const CALL = `claude -p "${PROMPT}" ${FLAGS}`;
const GUARD = 'if git diff --cached --quiet; then echo "Nothing is staged." >&2; exit 2; fi';
const SAVE = `git diff --cached | ${CALL} > "$out"`;
const PRINT = 'jq -r \'.result // empty\' "$out"';
const FAILS = 'if [ "$status" -ne 0 ] || [ "$(jq -r \'.is_error\' "$out")" != "false" ]; then';
const REVIEW = [
  '#!/usr/bin/env bash',
  '# Review the staged diff with Claude Code and save the JSON result.',
  'set -uo pipefail',
  'out="${1:-.practice/a-4-result.json}"',
  GUARD,
  'mkdir -p "$(dirname "$out")"',
  SAVE,
  'status=$?',
  PRINT,
  FAILS,
  '  echo "The review failed." >&2; exit 1',
  'fi',
  '',
].join('\n');

// The review script with each `[from, to]` replaced.
const edited = (...pairs) => pairs.reduce((text, [from, to]) => {
  if (!text.includes(from)) throw new Error(`the review script has no ${from}`);
  return text.replace(from, () => to);
}, REVIEW);
const flags = (to) => edited([FLAGS, to]);

// Commits `text` as the script, executable unless `mode` says otherwise.
const committed = (text, mode = 0o755) => (dir, { write, commit }) => {
  write(dir, { 'README.md': '# A project\n', 'src/total.js': 'export const total = 0;\n' });
  commit(dir, 'Start');
  write(dir, { [SCRIPT]: text });
  chmodSync(join(dir, SCRIPT), mode);
  commit(dir, 'Add the review script', [SCRIPT]);
};
const saved = (run) => ({ [RESULT]: typeof run === 'string' ? run : JSON.stringify(run) });
const REAL = {
  type: 'result', subtype: 'success', is_error: false, num_turns: 3,
  result: 'src/total.js:1: no test covers this.', session_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', total_cost_usd: 0.01, permission_denials: [],
};
const run = (change) => saved({ ...REAL, ...change });

export const scenarios = [
  { item: 0, name: 'no script', files: { 'README.md': '# A project\n' } },
  {
    item: 0,
    name: 'the script saved but not committed',
    setup: (dir, { write, commit }) => {
      write(dir, { 'README.md': '# A project\n' });
      commit(dir, 'Start');
      write(dir, { [SCRIPT]: REVIEW });
    },
  },
  { item: 0, name: 'the script committed without its executable bit', setup: committed(REVIEW, 0o644) },
  {
    item: 0,
    name: 'a link committed in place of the script',
    setup: (dir, { write, commit }) => {
      write(dir, { 'README.md': '# A project\n', 'tools/review.sh': REVIEW, 'scripts/README.md': 'Scripts.\n' });
      symlinkSync('../tools/review.sh', join(dir, SCRIPT));
      commit(dir, 'Add a link to the review script');
    },
  },
  { item: 1, name: 'the script not committed', files: { 'README.md': '# A project\n' } },
  { item: 1, name: 'Windows line ends', setup: committed(REVIEW.replace(/\n/g, '\r\n')) },
  { item: 1, name: 'claude run without -p', setup: committed(edited([`claude -p "${PROMPT}"`, `claude "${PROMPT}"`])) },
  { item: 1, name: 'a script that never calls claude', setup: committed(edited([SAVE, 'echo "{}" > "$out"'])) },
  { item: 1, name: 'nothing after -p', setup: committed(edited([`claude -p "${PROMPT}" ${FLAGS}`, `claude ${FLAGS} -p`])) },
  { item: 1, name: 'a flag between -p and the prompt', setup: committed(edited([`claude -p "${PROMPT}" --output-format json`, `claude -p --output-format json "${PROMPT}"`])) },
  { item: 1, name: 'an empty prompt', setup: committed(edited([`"${PROMPT}"`, '""'])) },
  { item: 1, name: 'no output format', setup: committed(flags(`--permission-mode dontAsk --allowedTools "Read,Grep,Glob" --max-turns 5 ${LIMITS}`)) },
  { item: 1, name: 'text output', setup: committed(flags(`--output-format text --permission-mode dontAsk --allowedTools "Read,Grep,Glob" --max-turns 5 ${LIMITS}`)) },
  { item: 1, name: 'no permission mode', setup: committed(flags(`--output-format json --allowedTools "Read,Grep,Glob" --max-turns 5 ${LIMITS}`)) },
  { item: 1, name: 'dontAsk in the wrong case', setup: committed(flags(`--output-format json --permission-mode dontask --allowedTools "Read,Grep,Glob" --max-turns 5 ${LIMITS}`)) },
  { item: 1, name: 'another permission mode', setup: committed(flags(`--output-format json --permission-mode acceptEdits --allowedTools "Read,Grep,Glob" --max-turns 5 ${LIMITS}`)) },
  { item: 1, name: 'permissions skipped', setup: committed(flags(`${FLAGS} --dangerously-skip-permissions`)) },
  { item: 1, name: 'no allowed tools', setup: committed(flags(`--output-format json --permission-mode dontAsk --max-turns 5 ${LIMITS}`)) },
  { item: 1, name: 'a tool name in the wrong case', setup: committed(flags(`--output-format json --permission-mode dontAsk --allowedTools "read,Grep,Glob" --max-turns 5 ${LIMITS}`)) },
  { item: 1, name: 'Bash among the allowed tools', setup: committed(flags(`--output-format json --permission-mode dontAsk --allowedTools "Read,Grep,Glob,Bash" --max-turns 5 ${LIMITS}`)) },
  { item: 1, name: 'no turn cap', setup: committed(flags(`--output-format json --permission-mode dontAsk --allowedTools "Read,Grep,Glob" ${LIMITS}`)) },
  { item: 1, name: 'a turn cap above 10', setup: committed(flags(`--output-format json --permission-mode dontAsk --allowedTools "Read,Grep,Glob" --max-turns 20 ${LIMITS}`)) },
  { item: 1, name: 'a turn cap that is no number', setup: committed(flags(`--output-format json --permission-mode dontAsk --allowedTools "Read,Grep,Glob" --max-turns five ${LIMITS}`)) },
  { item: 1, name: 'no format after the output flag', setup: committed(flags(`--permission-mode dontAsk --allowedTools "Read,Grep,Glob" --max-turns 5 ${LIMITS} --output-format`)) },
  { item: 1, name: 'no mode after the permission flag', setup: committed(flags(`--output-format json --allowedTools "Read,Grep,Glob" --max-turns 5 ${LIMITS} --permission-mode`)) },
  { item: 1, name: 'an empty tool list', setup: committed(flags(`--output-format json --permission-mode dontAsk --allowedTools "" --max-turns 5 ${LIMITS}`)) },
  { item: 1, name: 'a word of the prompt in the tool list', setup: committed(flags(`--output-format json --permission-mode dontAsk --allowedTools "Read,Grep,Glob" review --max-turns 5 ${LIMITS}`)) },
  { item: 1, name: 'no number after the turn cap', setup: committed(flags(`--output-format json --permission-mode dontAsk --allowedTools "Read,Grep,Glob" ${LIMITS} --max-turns`)) },
  { item: 1, name: 'no --tools', setup: committed(edited([`${TOOLS} `, ''])) },
  { item: 1, name: 'Bash kept by --tools', setup: committed(edited([TOOLS, '--tools "Read,Grep,Glob,Bash"'])) },
  { item: 1, name: 'a read tool left out of --tools', setup: committed(edited([TOOLS, '--tools "Read"'])) },
  { item: 1, name: 'nothing after --tools', setup: committed(edited([`${TOOLS} `, ''], [STRICT, `${STRICT} --tools`])) },
  { item: 1, name: 'hooks left on', setup: committed(edited([`${HOOKS} `, ''])) },
  { item: 1, name: 'nothing after --settings', setup: committed(edited([`${HOOKS} `, ''], [STRICT, `${STRICT} --settings`])) },
  { item: 1, name: 'a settings file in place of inline JSON', setup: committed(edited([HOOKS, '--settings .claude/review-settings.json'])) },
  { item: 1, name: 'settings JSON that leaves hooks on', setup: committed(edited([HOOKS, `--settings '{"disableAllHooks": false}'`])) },
  { item: 1, name: 'no --strict-mcp-config', setup: committed(edited([` ${STRICT}`, ''])) },
  { item: 1, name: 'claude called by its path', setup: committed(edited([`claude -p "${PROMPT}"`, `/usr/local/bin/claude -p "${PROMPT}"`])) },
  { item: 2, name: 'the script not committed', files: { 'README.md': '# A project\n' } },
  { item: 2, name: 'Windows line ends', setup: committed(REVIEW.replace(/\n/g, '\r\n')) },
  { item: 2, name: 'two calls for one diff', setup: committed(edited([SAVE, `${SAVE}\n${SAVE}`])) },
  { item: 2, name: 'an interactive call besides the review', setup: committed(edited([SAVE, `${SAVE}\nstatus=$?\nclaude "Say hello" > /dev/null`])) },
  { item: 2, name: 'the diff in the prompt', setup: committed(edited([SAVE, `claude -p "${PROMPT} $(git diff --cached)" ${FLAGS} < /dev/null > "$out"`])) },
  { item: 2, name: 'the unstaged diff piped in', setup: committed(edited([SAVE, `git diff | ${CALL} > "$out"`])) },
  { item: 2, name: 'staged and unstaged changes piped in', setup: committed(edited([SAVE, `git diff HEAD | ${CALL} > "$out"`])) },
  { item: 2, name: 'a review that exits non-zero', setup: committed(`${REVIEW}exit 3\n`) },
  { item: 2, name: 'the review not printed', setup: committed(edited([`${PRINT}\n`, ''])) },
  { item: 2, name: 'the JSON saved nowhere the argument says', setup: committed(edited([SAVE, `dest="$out"; if [ -n "\${1:-}" ]; then dest="$1.saved"; fi\ngit diff --cached | ${CALL} > "$dest"\nstatus=$?; out="$dest"`])) },
  { item: 2, name: 'the JSON changed before it is kept', setup: committed(`${REVIEW}if [ -n "\${1:-}" ]; then echo '{}' > "$out"; fi\n`) },
  { item: 2, name: 'no folder made for the default path', setup: committed(edited(['mkdir -p "$(dirname "$out")"\n', ''])) },
  { item: 2, name: 'another default path', setup: committed(edited(['out="${1:-.practice/a-4-result.json}"', 'out="${1:-review.json}"'])) },
  { item: 2, name: 'a failed run that exits 0', setup: committed(edited([FAILS, 'if [ "$(jq -r \'.is_error\' "$out" 2>/dev/null)" = "true" ]; then'])) },
  { item: 2, name: 'is_error left unread', setup: committed(edited([FAILS, 'if [ "$status" -ne 0 ]; then'])) },
  { item: 2, name: 'a call with nothing staged', setup: committed(edited([`${GUARD}\n`, ''], [SAVE, `${SAVE}\nstatus=$?\n${GUARD}`])) },
  { item: 2, name: 'exit 0 with nothing staged', setup: committed(edited([GUARD, 'if git diff --cached --quiet; then echo "Nothing is staged." >&2; exit 0; fi'])) },
  { item: 2, name: 'silence with nothing staged', setup: committed(edited([GUARD, 'if git diff --cached --quiet; then exit 2; fi'])) },
  { item: 2, name: 'claude reached through npx', setup: committed(edited([`claude -p "${PROMPT}"`, `npx claude -p "${PROMPT}"`])) },
  { item: 2, name: 'jq missing', setup: committed(edited([PRINT, 'echo "scripts/review-staged.sh: line 9: jq: command not found" >&2; exit 127'])) },
  { item: 2, name: 'no review call when given a path', setup: committed(edited([SAVE, `if [ -z "\${1:-}" ]; then ${SAVE}; fi`])) },
  { item: 2, name: 'the JSON saved to the default path only', setup: committed(edited(['out="${1:-.practice/a-4-result.json}"', 'out=".practice/a-4-result.json"'])) },
  { item: 2, name: 'other JSON saved at the default path', setup: committed(`${REVIEW}if [ -z "\${1:-}" ]; then echo '{}' > "$out"; fi\n`) },
  { item: 3, name: 'no saved run', files: { 'README.md': '# A project\n' } },
  { item: 3, name: 'a saved file that is no JSON', files: saved('The review said nothing.\n') },
  { item: 3, name: 'JSON that is no result', files: run({ type: 'assistant' }) },
  { item: 3, name: 'the check\'s stand-in reply saved', files: run({ session_id: '00000000-0000-4000-8000-00000000c0de' }) },
  { item: 3, name: 'a run that stopped at the cap', files: run({ subtype: 'error_max_turns', is_error: true, result: undefined }) },
  { item: 3, name: 'a run that failed', files: run({ is_error: true, result: '' }) },
  { item: 3, name: 'a run with an empty result', files: run({ result: ' ' }) },
  { item: 3, name: 'a run with no session id', files: run({ session_id: '' }) },
  { item: 3, name: 'a run with no turn count', files: run({ num_turns: undefined }) },
  { item: 3, name: 'a run over the cap', files: run({ num_turns: 12 }) },
];
