// Every FAIL message of Intermediate lesson 5's check, each from a work
// folder that produces it: `files` to write, or `setup(dir, { write, commit })`.
// Each scenario holds one problem, so its message matches one narrow question.
// The gates read their input without jq, so a machine without jq still gets
// each scenario's own message.
import { chmodSync } from 'node:fs';
import { join } from 'node:path';

const HOOK = '.claude/hooks/protect-files.sh';
const GATE = '.claude/hooks/test-gate.sh';
const SETTINGS = '.claude/settings.json';

const PROTECT = '#!/bin/bash\ncat > /dev/null\nexit 0\n';
const command = (script, extra = {}) => ({ type: 'command', command: `\${CLAUDE_PROJECT_DIR}/${script}`, args: [], ...extra });
const settings = ({ matcher = 'Edit|Write', onFailure = 'block', stop = true } = {}) => `${JSON.stringify({
  permissions: { allow: ['Bash(npm test)'] },
  hooks: {
    PreToolUse: [{ matcher, hooks: [command(HOOK, onFailure ? { onFailure } : {})] }],
    ...(stop ? { Stop: [{ hooks: [command(GATE)] }] } : {}),
  },
}, null, 2)}\n`;

// A gate that blocks while the tests fail, with a reason, and lets Claude stop
// once they pass or after one retry. The tests' output goes to stdout, so its
// stderr holds only the reason.
const FINISHED = [
  '#!/bin/bash',
  'INPUT=$(cat)',
  'case "$INPUT" in *\'"stop_hook_active":true\'*) exit 0 ;; esac',
  'if ! npm test 2>&1; then',
  '  echo "Blocked: the tests fail. Fix them before you finish." >&2',
  '  exit 2',
  'fi',
  'exit 0',
  '',
].join('\n');

// The page's skeleton, committed as it is: it runs no test command.
const SKELETON = ['#!/bin/bash', 'INPUT=$(cat)', 'cd "$CLAUDE_PROJECT_DIR"', '', '# TODO: exit 0 when stop_hook_active is true, so Claude can stop after one retry', '# TODO: run the test command; if it fails, print a reason to stderr and exit 2', '', 'exit 0', ''].join('\n');
const NO_JQ = ['#!/bin/bash', 'INPUT=$(cat)', 'echo "$INPUT" | PATH=/nonexistent jq -r \'.stop_hook_active\'', 'exit 0', ''].join('\n');
const FLOOD = ['#!/bin/bash', 'cat > /dev/null', 'head -c 2000000 /dev/zero', 'exit 0', ''].join('\n');
const EXIT_1 = FINISHED.replace('  exit 2', '  exit 1');
const QUIET = FINISHED.replace('npm test 2>&1', 'npm test').replace('  echo "Blocked: the tests fail. Fix them before you finish." >&2\n', '');
const ALWAYS = FINISHED.replace('if ! npm test 2>&1; then', 'npm test 2>&1\nif true; then');
// The tests' output on stderr, beside the reason: a missing-file error there,
// with nothing on stdout, turns the block into a non-blocking error.
const TO_STDERR = FINISHED.replace('npm test 2>&1', 'npm test >&2');
// A gate that blocks only when the tests print to stdout.
const STDOUT_ONLY = FINISHED.replace('if ! npm test 2>&1; then', 'OUT=$(npm test 2>/dev/null)\nif [ $? -ne 0 ] && [ -n "$OUT" ]; then');
const NO_GUARD = FINISHED.replace('case "$INPUT" in *\'"stop_hook_active":true\'*) exit 0 ;; esac\n', '');

// Commits both scripts, executable, with `text` as the settings, as Your turn
// step 4 does, so only the item a scenario is about can fail.
const committed = (gate = FINISHED, text = settings()) => (dir, { write, commit }) => {
  write(dir, { [HOOK]: PROTECT, [GATE]: gate, [SETTINGS]: text });
  chmodSync(join(dir, HOOK), 0o755);
  chmodSync(join(dir, GATE), 0o755);
  commit(dir, 'Protect files and gate the end of a turn on the tests', [HOOK, GATE, SETTINGS]);
};

// Both scripts committed and executable, and `text` as the settings, saved
// but not committed.
const scriptsOnly = (text) => (dir, { write, commit }) => {
  write(dir, { [HOOK]: PROTECT, [GATE]: FINISHED });
  chmodSync(join(dir, HOOK), 0o755);
  chmodSync(join(dir, GATE), 0o755);
  commit(dir, 'Add the hook scripts', [HOOK, GATE]);
  if (text) write(dir, { [SETTINGS]: text });
};

export const scenarios = [
  { item: 0, name: 'no protect-files script', files: { [GATE]: FINISHED, [SETTINGS]: settings() } },
  { item: 0, name: 'the protect-files script saved but not committed', files: { [HOOK]: PROTECT, [GATE]: FINISHED, [SETTINGS]: settings() } },
  {
    item: 0,
    name: 'the gate committed without its executable bit',
    setup(dir, { write, commit }) {
      write(dir, { [HOOK]: PROTECT, [GATE]: FINISHED, [SETTINGS]: settings() });
      chmodSync(join(dir, HOOK), 0o755);
      chmodSync(join(dir, GATE), 0o644);
      commit(dir, 'Add the hooks', [HOOK, GATE, SETTINGS]);
    },
  },

  { item: 1, name: 'the settings saved but never committed', setup: scriptsOnly(settings()) },
  { item: 1, name: 'a missing comma before the hooks block', setup: committed(FINISHED, settings().replace('},\n  "hooks"', '}\n  "hooks"')) },
  { item: 1, name: 'the guard registered for Bash only', setup: committed(FINISHED, settings({ matcher: 'Bash' })) },
  { item: 1, name: 'the guard registered without onFailure', setup: committed(FINISHED, settings({ onFailure: null })) },

  { item: 2, name: 'the gate saved but not committed', files: { [GATE]: FINISHED } },
  { item: 2, name: 'a gate whose output is too large to read', setup: committed(FLOOD) },
  { item: 2, name: 'jq not installed', setup: committed(NO_JQ) },
  { item: 2, name: 'the skeleton committed with its TODOs', setup: committed(SKELETON) },
  { item: 2, name: 'a gate that exits 1 while the tests fail', setup: committed(EXIT_1) },
  { item: 2, name: 'a gate that blocks with no reason on stderr', setup: committed(QUIET) },
  { item: 2, name: 'a gate that blocks even when the tests pass', setup: committed(ALWAYS) },
  { item: 2, name: 'a gate without the stop_hook_active guard', setup: committed(NO_GUARD) },
  { item: 2, name: 'a gate that sends the tests\' output to stderr', setup: committed(TO_STDERR) },
  { item: 2, name: 'a gate that blocks only when the tests print to stdout', setup: committed(STDOUT_ONLY) },

  { item: 3, name: 'the settings saved but never committed', setup: scriptsOnly(settings()) },
  { item: 3, name: 'a missing comma before the hooks block', setup: committed(FINISHED, settings().replace('},\n  "hooks"', '}\n  "hooks"')) },
  { item: 3, name: 'the gate never registered under Stop', setup: committed(FINISHED, settings({ stop: false })) },
];
