// Enforce a rule with a hook (Intermediate, lesson 5). The Learner registers
// the hooks guide's protect-files script as a PreToolUse hook for Edit and
// Write that fails closed ("onFailure": "block"), then writes a Stop hook, the
// test gate, that sends Claude back to work while the tests fail and lets it
// stop once they pass, or after one retry (stop_hook_active). The check runs
// the committed gate with the JSON a Stop event sends and a stand-in for the
// test command. On Stop, an exit 2 with nothing on stdout and stderr that says
// a file is missing is a non-blocking error (hooks reference, "Exit code
// output"), so the check also fails the tests with a missing-file error and
// wants the gate to keep that off its stderr, or print to stdout. Seeing the
// gate send Claude back in a session is self-checked.
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { committedMode, editWriteScripts, missingJq } from '../hooks.mjs';

export const title = 'Enforce a rule with a hook';

const HOOK = '.claude/hooks/protect-files.sh';
const GATE = '.claude/hooks/test-gate.sh';
const SETTINGS = '.claude/settings.json';

// Test commands a gate may run by name. The check puts a stand-in for each on
// the PATH, so the gate's run passes or fails as each case needs. A stand-in
// prints to stdout, as most test runners do, so a reason on stderr is the
// gate's own; with `missingFile`, it fails with a missing-file error on
// stderr and nothing on stdout, as a test that reads a missing fixture may.
const TEST_COMMANDS = ['npm', 'npx', 'pnpm', 'yarn', 'bun', 'node', 'deno', 'pytest', 'python', 'python3', 'tox', 'uv', 'poetry', 'go', 'cargo', 'make', 'mvn', 'gradle', 'bundle', 'rake', 'rspec', 'dotnet', 'mix'];

function committedSettings(repo) {
  let text;
  try {
    text = repo.git('show', `HEAD:./${SETTINGS}`);
  } catch {
    return { missing: true };
  }
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { error: error.message };
  }
}

function committedText(repo, path) {
  try {
    return repo.git('show', `HEAD:./${path}`);
  } catch {
    return null;
  }
}

// Runs the committed gate once, as Claude Code would when Claude finishes
// responding, with the stand-in test commands passing or failing. Returns
// spawnSync's result and whether the gate ran a test command, or null when
// HEAD lacks the gate.
function runGateScript(repo, { testsPass, retried, missingFile = false }) {
  const text = committedText(repo, GATE);
  if (text === null) return null;
  const dir = mkdtempSync(join(tmpdir(), 'gate-'));
  try {
    const bin = join(dir, 'bin');
    const ran = join(dir, 'ran');
    mkdirSync(bin);
    for (const name of TEST_COMMANDS) {
      const output = missingFile ? 'echo "Error: ENOENT: no such file or directory, open \'test/fixture.md\'" >&2' : 'echo "a stand-in test run"';
      writeFileSync(join(bin, name), `#!/bin/sh\necho "$0" >> '${ran}'\n${output}\nexit ${testsPass ? 0 : 1}\n`);
      chmodSync(join(bin, name), 0o755);
    }
    const file = join(dir, 'test-gate.sh');
    writeFileSync(file, text);
    chmodSync(file, 0o755);
    const run = spawnSync('bash', [file], {
      cwd: repo.dir,
      env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`, CLAUDE_PROJECT_DIR: repo.dir },
      input: JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: retried, last_assistant_message: 'Done.' }),
      encoding: 'utf8',
      timeout: 20_000,
      maxBuffer: 1024 * 1024,
    });
    return { ...run, ranTests: existsSync(ran) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export const items = [
  {
    text: '`.claude/hooks/protect-files.sh` and `.claude/hooks/test-gate.sh` are committed and executable',
    check(repo) {
      for (const path of [HOOK, GATE]) {
        const mode = committedMode(repo, path);
        if (mode === null) return repo.exists(path) ? `${path} is not committed. Run \`git add ${path}\` and commit it.` : `There is no ${path}. Save it as the lesson shows, then commit it.`;
        if (mode !== '100755') return `${path} isn't executable. Run \`chmod +x ${path}\`, then stage it and commit.`;
      }
      return true;
    },
  },
  {
    text: 'the committed `.claude/settings.json` runs protect-files.sh as a `PreToolUse` hook for Edit and Write, with `"onFailure": "block"`',
    check(repo) {
      const { missing, error, value } = committedSettings(repo);
      if (missing) return `There is no committed ${SETTINGS}. Add the hooks block from the lesson and commit it.`;
      if (error) return `The committed ${SETTINGS} is not valid JSON: ${error}`;
      if (!editWriteScripts(value).includes(HOOK)) return `${SETTINGS} doesn't run protect-files.sh as a PreToolUse hook for Edit and Write. Use \`"matcher": "Edit|Write"\`.`;
      // The same scripts, counting only the hook entries that fail closed.
      const groups = value.hooks.PreToolUse.map((g) => ({ ...g, hooks: (g?.hooks ?? []).filter((h) => h?.onFailure === 'block') }));
      return editWriteScripts({ hooks: { PreToolUse: groups } }).includes(HOOK) ? true : 'Add `"onFailure": "block"` to the protect-files.sh hook, so a hook that can\'t start or crashes blocks the edit instead of letting it through.';
    },
  },
  {
    text: 'the committed test gate exits 2 with a reason while the tests fail, and 0 once they pass or after one retry',
    check(repo) {
      const failing = runGateScript(repo, { testsPass: false, retried: false });
      if (failing === null) return `Commit ${GATE}: the check runs the committed gate, the one your teammates get.`;
      if (failing.error) return `The gate couldn't run: ${failing.error.message}`;
      if (missingJq(failing)) return 'The gate needs `jq`, which isn\'t installed. Install it and run the check again.';
      if (!failing.ranTests) return 'The gate ran no test command the check can stand in for. Run your test command by name, such as `npm test` or `pytest`.';
      if (failing.status !== 2) return `While the tests fail, the gate exits ${failing.status}, so Claude stops anyway. Exit 2 when the test command fails.`;
      if (!failing.stderr.trim()) return 'The gate blocks without a reason on stderr. Print why to stderr, so Claude knows what to fix.';
      const passing = runGateScript(repo, { testsPass: true, retried: false });
      if (passing.status !== 0) return `With the tests passing, the gate exits ${passing.status}. Exit 0 then, so Claude can stop.`;
      const retried = runGateScript(repo, { testsPass: false, retried: true });
      if (retried.status !== 0) return 'With `stop_hook_active` true, the gate still blocks. Exit 0 then, so a failure Claude can\'t fix doesn\'t keep it working.';
      const missing = runGateScript(repo, { testsPass: false, retried: false, missingFile: true });
      if (missing.status !== 2) return `While the tests fail, the gate exits ${missing.status}, so Claude stops anyway. Exit 2 when the test command fails.`;
      if (!missing.stdout.trim() && /no such file or directory/i.test(missing.stderr)) return 'A failing test\'s missing-file error reaches the gate\'s stderr with nothing on stdout, so Claude can still stop. Run `npm test 2>&1` and print only your reason to stderr.';
      return true;
    },
  },
  {
    text: 'the committed `.claude/settings.json` runs test-gate.sh as a `Stop` hook',
    check(repo) {
      const { missing, error, value } = committedSettings(repo);
      if (missing) return `There is no committed ${SETTINGS}. Add the Stop hook from the lesson and commit it.`;
      if (error) return `The committed ${SETTINGS} is not valid JSON: ${error}`;
      // A Stop hook takes no matcher: read its groups as matching every tool.
      const stop = Array.isArray(value?.hooks?.Stop) ? value.hooks.Stop.map((g) => ({ ...g, matcher: '' })) : [];
      return editWriteScripts({ hooks: { PreToolUse: stop } }).includes(GATE) ? true : `${SETTINGS} doesn't run test-gate.sh as a \`Stop\` hook. Add it under \`hooks.Stop\`, as the lesson shows.`;
    },
  },
];
