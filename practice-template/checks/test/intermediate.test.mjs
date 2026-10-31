// The Intermediate checks, run the way a Learner runs them: against their own
// repository with --dir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, realpathSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { check, commit, repo, withRepo, write } from './helpers.mjs';
import { buggyApp, fixedApp } from './fixtures/intermediate-app.mjs';

// The tdd skill as lesson i-1's Your turn leaves it once finished.
const FINISHED_TDD = `---
name: tdd
description: Builds a feature test-first, one behavior at a time. Use when the user asks for a new function or feature with tests, or says test-first or TDD.
---

Build this test-first, one behavior at a time: $ARGUMENTS

1. Red: write one failing test for the next behavior and run it.
2. Green: write the least code that makes the tests pass, and run them.
3. Refactor: tidy the code with the tests still passing.
`;

// A repository with the tdd skill committed, then the reviewed commit of a
// /tdd run's work, saved for the check as lesson i-1 asks.
function skillRepo({ skill = FINISHED_TDD, commitSkill = true, change = { 'src/slug.js': 'export {}\n', 'test/slug.test.js': '// test\n' } } = {}) {
  return () => {
    const dir = repo({ '.claude/skills/tdd/SKILL.md': skill });
    commit(dir, 'Add the tdd skill', commitSkill ? ['.claude/skills/tdd/SKILL.md'] : []);
    write(dir, change);
    const sha = commit(dir, 'Add slugify', Object.keys(change));
    write(dir, { '.practice/i-1-commit.txt': `${sha}\n` });
    return dir;
  };
}

test('i-1 passes with the finished skill committed and a commit that changes a test and its code', () => {
  withRepo(skillRepo(), (dir) => {
    const { code, out } = check(['i-1', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

test('i-1 fails while the skill is not committed, and says how to commit it', () => {
  withRepo(skillRepo({ commitSkill: false }), (dir) => {
    const { code, out } = check(['i-1', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /git add \.claude\/skills\/tdd\/SKILL\.md/);
  });
});

test('i-1 fails when there is no tdd skill at all', () => {
  withRepo(() => repo(), (dir) => {
    const { code, out } = check(['i-1', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /There is no \.claude\/skills\/tdd\/SKILL\.md/);
  });
});

test('i-1 fails on the unfinished skill: TODOs, no description and run-by-name only', () => {
  const partial = '---\nname: tdd\ndescription: TODO\ndisable-model-invocation: true\n---\n\n1. Red: write a failing test.\n2. Green: TODO\n3. Refactor: TODO\n';
  withRepo(skillRepo({ skill: partial }), (dir) => {
    const { code, out } = check(['i-1', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /TODO on lines 3, 8, 9/);
    assert.match(out, /disable-model-invocation: true/);
  });
});

test('i-1 asks for a description that says what the skill does and when to use it', () => {
  const short = FINISHED_TDD.replace(/^description: .*$/m, 'description: Test-first.');
  withRepo(skillRepo({ skill: short }), (dir) => {
    const { code, out } = check(['i-1', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /when Claude should use it/);
  });
});

test('i-1 reads a description written as a folded block over several lines', () => {
  const folded = FINISHED_TDD.replace(/^description: .*$/m, 'description: >-\n  Builds a feature test-first, one behavior at a time.\n  Use when the user asks for a feature with tests.');
  withRepo(skillRepo({ skill: folded }), (dir) => {
    const { code, out } = check(['i-1', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

test('i-1 fails when the frontmatter name means /tdd would not run the skill', () => {
  withRepo(skillRepo({ skill: FINISHED_TDD.replace('name: tdd', 'name: test-first') }), (dir) => {
    const { code, out } = check(['i-1', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /\/test-first/);
  });
});

test('i-1 fails when the saved commit changes only tests, or only code', () => {
  for (const change of [{ 'test/slug.test.js': '// test\n' }, { 'src/slug.js': 'export {}\n' }]) {
    withRepo(skillRepo({ change }), (dir) => {
      const { code, out } = check(['i-1', '--dir', dir]);
      assert.equal(code, 1, out);
      assert.match(out, /test and the code it tests/);
    });
  }
});

test('nested: i-1 reads the saved commit\'s files from project/, so a .claude/ file is not code', () => {
  for (const [path, expected] of [['.claude/notes.md.js', 1], ['src/slug.js', 0]]) {
    withRepo(() => {
      const dir = repo({ '.claude/skills/tdd/SKILL.md': FINISHED_TDD }, { nested: true });
      commit(dir, 'Add the tdd skill');
      write(dir, { 'test/slug.test.js': '// test\n', [path]: 'export {}\n' });
      const sha = commit(dir, 'Add slugify', ['test/slug.test.js', path]);
      write(dir, { '.practice/i-1-commit.txt': `${sha}\n` });
      return dir;
    }, (dir) => {
      const { code, out } = check(['i-1', '--dir', dir]);
      assert.equal(code, expected, out);
    });
  }
});

test('i-1 says how to save the commit when none is saved', () => {
  withRepo(() => {
    const dir = repo({ '.claude/skills/tdd/SKILL.md': FINISHED_TDD });
    commit(dir, 'Add the tdd skill');
    return dir;
  }, (dir) => {
    const { code, out } = check(['i-1', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /git rev-parse HEAD > \.practice\/i-1-commit\.txt/);
  });
});

// A repository after lesson i-2: CLAUDE.md imports package.json, a rule is
// scoped to the test files, and the load log a session wrote.
const LOG = (dir, lines) => lines.map(([reason, path]) => `${reason}\t${dir}/${path}`).join('\n') + '\n';
function memoryRepo({
  claudeMd = '# linkcheck\n\n- npm scripts: @package.json\n',
  rules = { 'testing.md': '---\npaths:\n  - "test/**/*.js"\n---\n\n- Use node:test.\n' },
  log = [['session_start', 'CLAUDE.md'], ['include', 'package.json'], ['path_glob_match', '.claude/rules/testing.md']],
} = {}) {
  return () => {
    const files = { 'CLAUDE.md': claudeMd, 'package.json': '{}\n', 'test/links.test.js': '// test\n', 'src/cli.js': '// cli\n' };
    for (const [name, text] of Object.entries(rules)) files[`.claude/rules/${name}`] = text;
    const dir = repo(files);
    commit(dir, 'Organize project memory');
    if (log) write(dir, { '.practice/i-2-loaded.txt': LOG(dir, log) });
    return dir;
  };
}

test('i-2 passes with an import, a scoped rule that matches files, and a log of both loading', () => {
  withRepo(memoryRepo(), (dir) => {
    const { code, out } = check(['i-2', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

test('i-2 fails without an @path import in the committed CLAUDE.md, and ignores one in backticks', () => {
  withRepo(memoryRepo({ claudeMd: '# linkcheck\n\n- The scripts are in `@package.json`.\n' }), (dir) => {
    const { code, out } = check(['i-2', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /no @path import/);
  });
});

test('i-2 says a period after the imported path becomes part of it', () => {
  withRepo(memoryRepo({ claudeMd: '# linkcheck\n\nThe npm scripts are in @package.json.\n' }), (dir) => {
    const { code, out } = check(['i-2', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /package\.json\. doesn't exist/);
    assert.match(out, /first space/);
  });
});

test('i-2 fails for a scoped rule whose paths match no file, and names it', () => {
  const rules = { 'testing.md': '---\npaths: "test/**/*.js"\n---\n', 'cli.md': '---\npaths:\n  - "source/**/*.js"\n---\n' };
  withRepo(memoryRepo({ rules }), (dir) => {
    const { code, out } = check(['i-2', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /\.claude\/rules\/cli\.md/);
    assert.match(out, /source\/\*\*\/\*\.js/);
  });
});

test('i-2 needs at least one rule scoped with paths', () => {
  withRepo(memoryRepo({ rules: { 'style.md': '- Two spaces.\n' } }), (dir) => {
    const { code, out } = check(['i-2', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /paths:/);
  });
});

test('i-2 matches brace patterns and a comma-separated paths value', () => {
  const rules = { 'code.md': '---\npaths:\n  - "src/**/*.{js,ts}"\n---\n', 'lib.md': '---\npaths: lib/*.js, src/*.js\n---\n' };
  const log = [['include', 'package.json'], ['path_glob_match', '.claude/rules/code.md']];
  withRepo(memoryRepo({ rules, log }), (dir) => {
    const { code, out } = check(['i-2', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

// git's pathspec globs don't expand braces, so the check expands each brace
// group into its alternatives before it matches the tracked files: a rule
// whose only matching alternative comes last passes, and one with no match
// in any alternative still fails.
test('i-2 expands brace patterns before matching tracked files', () => {
  const log = [['include', 'package.json'], ['path_glob_match', '.claude/rules/code.md']];
  withRepo(memoryRepo({ rules: { 'code.md': '---\npaths:\n  - "src/**/*.{ts,tsx,js}"\n---\n' }, log }), (dir) => {
    const { code, out } = check(['i-2', '--dir', dir]);
    assert.equal(code, 0, out);
  });
  withRepo(memoryRepo({ rules: { 'code.md': '---\npaths:\n  - "src/**/*.{ts,tsx}"\n---\n' }, log }), (dir) => {
    const { code, out } = check(['i-2', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /code\.md is scoped to src\/\*\*\/\*\.\{ts,tsx\}, which matches no file/);
  });
});

test('i-2 says how to start a logged session when there is no log', () => {
  withRepo(memoryRepo({ log: null }), (dir) => {
    const { code, out } = check(['i-2', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /--settings \.practice\/i-2-hook\.json/);
  });
});

test('i-2 fails when the log shows no scoped rule loading, and says to read a file the pattern matches', () => {
  withRepo(memoryRepo({ log: [['session_start', 'CLAUDE.md'], ['include', 'package.json']] }), (dir) => {
    const { code, out } = check(['i-2', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /read a file the rule covers/);
    assert.match(out, /from the project root/);
  });
});

// A repository after lesson i-3: the changelog skill with its model and
// effort filled in, and the entry a /changelog run committed.
const CHANGELOG_SKILL = (model, effort) => `---
name: changelog
description: Adds a one-line entry for the staged changes to CHANGELOG.md. Use when the user asks for a changelog entry.
model: ${model}
effort: ${effort}
disable-model-invocation: true
---

Read the staged changes and add one line under ## Unreleased in CHANGELOG.md.
`;
function effortRepo({ model = 'sonnet', effort = 'low', changelog = '## Unreleased\n\n- Report broken links in headings.\n' } = {}) {
  return () => {
    const files = { '.claude/skills/changelog/SKILL.md': CHANGELOG_SKILL(model, effort) };
    if (changelog !== null) files['CHANGELOG.md'] = changelog;
    const dir = repo(files);
    commit(dir, 'Add a changelog skill and an entry');
    return dir;
  };
}

test('i-3 passes for a small model at low effort and a committed entry', () => {
  withRepo(effortRepo(), (dir) => {
    const { code, out } = check(['i-3', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

test('i-3 accepts haiku, a full Sonnet model name, sonnet[1m] and medium effort', () => {
  for (const [model, effort] of [['haiku', 'low'], ['claude-sonnet-5-5', 'medium'], ['sonnet[1m]', 'low']]) {
    withRepo(effortRepo({ model, effort }), (dir) => {
      const { code, out } = check(['i-3', '--dir', dir]);
      assert.equal(code, 0, out);
    });
  }
});

test('i-3 fails while model and effort are still TODO', () => {
  withRepo(effortRepo({ model: 'TODO', effort: 'TODO' }), (dir) => {
    const { code, out } = check(['i-3', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /model/);
  });
});

test('i-3 says a routine task does not need a larger model or a higher effort', () => {
  for (const [model, effort, hint] of [['opus', 'low', /larger model/], ['sonnet', 'high', /higher effort/]]) {
    withRepo(effortRepo({ model, effort }), (dir) => {
      const { code, out } = check(['i-3', '--dir', dir]);
      assert.equal(code, 1, out);
      assert.match(out, hint);
    });
  }
});

test('i-3 accepts the Keep a Changelog heading `## [Unreleased]`, and needs an entry under it too', () => {
  withRepo(effortRepo({ changelog: '# Changelog\n\n## [Unreleased]\n\n### Added\n\n- Report broken links in headings.\n\n## [1.0.0] - 2026-10-01\n' }), (dir) => {
    const { code, out } = check(['i-3', '--dir', dir]);
    assert.equal(code, 0, out);
  });
  withRepo(effortRepo({ changelog: '# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-10-01\n\n- First release.\n' }), (dir) => {
    const { code, out } = check(['i-3', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /`## Unreleased` in CHANGELOG\.md has no entry/);
  });
});

test('i-3 fails without a committed changelog entry under Unreleased', () => {
  for (const changelog of [null, '## Unreleased\n\n']) {
    withRepo(effortRepo({ changelog }), (dir) => {
      const { code, out } = check(['i-3', '--dir', dir]);
      assert.equal(code, 1, out);
      assert.match(out, /\/changelog/);
    });
  }
});

// A repository after lesson i-4: team rules in the committed shared settings,
// and the sandbox turned on in the personal file that stays out of git.
const TEAM = { permissions: { allow: ['Bash(npm test)'], ask: ['Bash(git push *)'], deny: ['Read(./.env)', 'Read(./.env.*)'] } };
const LOCAL = { sandbox: { enabled: true, autoAllowBashIfSandboxed: true } };
function scopesRepo({ team = TEAM, local = LOCAL, commitLocal = false } = {}) {
  return () => {
    const files = {};
    if (team) files['.claude/settings.json'] = typeof team === 'string' ? team : JSON.stringify(team, null, 2);
    if (local) files['.claude/settings.local.json'] = JSON.stringify(local, null, 2);
    const dir = repo(files);
    commit(dir, 'Add team settings', [...(team ? ['.claude/settings.json'] : []), ...(commitLocal ? ['.claude/settings.local.json'] : [])]);
    return dir;
  };
}

test('i-4 passes with team rules committed and the sandbox on in the uncommitted local file', () => {
  withRepo(scopesRepo(), (dir) => {
    const { code, out } = check(['i-4', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

test('i-4 accepts the sandbox turned on in the shared file, with no local file', () => {
  withRepo(scopesRepo({ team: { ...TEAM, sandbox: { enabled: true } }, local: null }), (dir) => {
    const { code, out } = check(['i-4', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

test('i-4 fails while the partial file still has its TODOs', () => {
  const partial = { permissions: { allow: ['TODO: the command that runs your tests'], deny: ['TODO: reading .env'] } };
  withRepo(scopesRepo({ team: partial }), (dir) => {
    const { code, out } = check(['i-4', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /TODO/);
  });
});

test('i-4 needs deny rules for .env and the other .env files', () => {
  withRepo(scopesRepo({ team: { permissions: { allow: ['Bash(npm test)'], deny: ['Read(./.env)'] } } }), (dir) => {
    const { code, out } = check(['i-4', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /\.env\.\*/);
  });
});

test('i-4 refuses an allow rule that lets every command or every edit through', () => {
  for (const rule of ['Bash', 'Bash(*)', 'Bash(npm *)', 'Bash(npm:*)', 'Edit']) {
    withRepo(scopesRepo({ team: { permissions: { allow: ['Bash(npm test)', rule], deny: TEAM.permissions.deny } } }), (dir) => {
      const { code, out } = check(['i-4', '--dir', dir]);
      assert.equal(code, 1, `${rule}: ${out}`);
      assert.ok(out.includes(rule), out);
    });
  }
});

test('i-4 needs an ask rule for a command the team approves each time, not a deny rule or a TODO', () => {
  for (const [ask, deny, hint] of [
    [undefined, [...TEAM.permissions.deny, 'Bash(git push *)'], /Add an ask rule to `permissions\.ask`/],
    [['TODO: a command the team approves each time'], TEAM.permissions.deny, /Replace the TODO in `permissions\.ask`/],
  ]) {
    withRepo(scopesRepo({ team: { permissions: { allow: ['Bash(npm test)'], ...(ask ? { ask } : {}), deny } } }), (dir) => {
      const { code, out } = check(['i-4', '--dir', dir]);
      assert.equal(code, 1, out);
      assert.match(out, hint);
    });
  }
});

test('i-4 fails when the shared settings are not valid JSON', () => {
  withRepo(scopesRepo({ team: '{ "permissions": { "allow": ["Bash(npm test)"], } }' }), (dir) => {
    const { code, out } = check(['i-4', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /not valid JSON/);
  });
});

test('i-4 fails when the personal file is committed, and when the sandbox is off', () => {
  withRepo(scopesRepo({ commitLocal: true }), (dir) => {
    const { code, out } = check(['i-4', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /git rm --cached \.claude\/settings\.local\.json/);
  });
  withRepo(scopesRepo({ local: { sandbox: { enabled: false } } }), (dir) => {
    const { code, out } = check(['i-4', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /\/sandbox/);
  });
});

// A repository after lesson i-5: the hooks guide's protect-files script
// registered for Edit and Write with "onFailure": "block", and the test gate,
// a Stop hook, both committed and executable.
const PROTECT = '#!/bin/bash\ncat > /dev/null\nexit 0\n';
const GATE = `#!/bin/bash
INPUT=$(cat)
cd "$CLAUDE_PROJECT_DIR"

if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0
fi
if ! npm test 2>&1; then
  echo "Blocked: the tests fail. Fix them before you finish." >&2
  exit 2
fi

exit 0
`;
const HOOK_ENTRY = (script, extra = {}) => ({ type: 'command', command: `\${CLAUDE_PROJECT_DIR}/.claude/hooks/${script}`, args: [], ...extra });
const REGISTERED = { hooks: {
  PreToolUse: [{ matcher: 'Edit|Write', hooks: [HOOK_ENTRY('protect-files.sh', { onFailure: 'block' })] }],
  Stop: [{ hooks: [HOOK_ENTRY('test-gate.sh')] }],
} };
function hookRepo({ gate = GATE, mode = 0o755, settings = REGISTERED } = {}) {
  return () => {
    const dir = repo({ '.claude/hooks/protect-files.sh': PROTECT, '.claude/hooks/test-gate.sh': gate, '.claude/settings.json': JSON.stringify(settings, null, 2) });
    chmodSync(join(dir, '.claude/hooks/protect-files.sh'), 0o755);
    chmodSync(join(dir, '.claude/hooks/test-gate.sh'), mode);
    commit(dir, 'Protect files and gate the end of a turn on the tests');
    return dir;
  };
}

test('i-5 passes for both hooks committed, executable and registered, with a gate that works', () => {
  withRepo(hookRepo(), (dir) => {
    const { code, out } = check(['i-5', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

test('i-5 fails when the protection hook can fail open, with no onFailure', () => {
  const settings = { hooks: { ...REGISTERED.hooks, PreToolUse: [{ matcher: 'Edit|Write', hooks: [HOOK_ENTRY('protect-files.sh')] }] } };
  withRepo(hookRepo({ settings }), (dir) => {
    const { code, out } = check(['i-5', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /"onFailure": "block"/);
  });
});

test('i-5 fails when the protection hook is not registered for Edit and Write before tools run', () => {
  for (const pre of [undefined, [{ ...REGISTERED.hooks.PreToolUse[0], matcher: 'Bash' }]]) {
    const settings = { hooks: { Stop: REGISTERED.hooks.Stop, ...(pre ? { PreToolUse: pre } : { PostToolUse: REGISTERED.hooks.PreToolUse }) } };
    withRepo(hookRepo({ settings }), (dir) => {
      const { code, out } = check(['i-5', '--dir', dir]);
      assert.equal(code, 1, out);
      assert.match(out, /PreToolUse/);
    });
  }
});

test('i-5 fails when the gate is not registered as a Stop hook', () => {
  withRepo(hookRepo({ settings: { hooks: { PreToolUse: REGISTERED.hooks.PreToolUse } } }), (dir) => {
    const { code, out } = check(['i-5', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /`Stop` hook/);
  });
});

test('i-5 fails when the gate is not executable', () => {
  withRepo(hookRepo({ mode: 0o644 }), (dir) => {
    const { code, out } = check(['i-5', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /chmod \+x \.claude\/hooks\/test-gate\.sh/);
  });
});

test('i-5 fails for the skeleton, which runs no test command', () => {
  const skeleton = '#!/bin/bash\nINPUT=$(cat)\ncd "$CLAUDE_PROJECT_DIR"\n\n# TODO: exit 0 when stop_hook_active is true, so Claude can stop after one retry\n# TODO: run the test command; if it fails, print a reason to stderr and exit 2\n\nexit 0\n';
  withRepo(hookRepo({ gate: skeleton }), (dir) => {
    const { code, out } = check(['i-5', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /ran no test command/);
  });
});

test('i-5 names the case a gate gets wrong: exit 1, no reason, blocking a passing run, no loop guard, or test output on stderr', () => {
  for (const [gate, hint] of [
    [GATE.replace('  exit 2', '  exit 1'), /While the tests fail, the gate exits 1/],
    [GATE.replace('npm test 2>&1', 'npm test').replace('  echo "Blocked: the tests fail. Fix them before you finish." >&2\n', ''), /without a reason on stderr/],
    [GATE.replace('if ! npm test 2>&1; then', 'npm test 2>&1\nif true; then'), /With the tests passing, the gate exits 2/],
    [GATE.replace(/^if \[ "\$\(echo.*\n {2}exit 0\nfi\n/m, ''), /`stop_hook_active` true, the gate still blocks/],
    // On Stop, exit 2 with nothing on stdout and a missing-file error on
    // stderr is a non-blocking error (hooks reference, "Exit code output").
    [GATE.replace('npm test 2>&1', 'npm test >&2'), /missing-file error.*npm test 2>&1/s],
    [GATE.replace('if ! npm test 2>&1; then', 'OUT=$(npm test 2>/dev/null)\nif [ $? -ne 0 ] && [ -n "$OUT" ]; then'), /While the tests fail, the gate exits 0/],
  ]) {
    withRepo(hookRepo({ gate }), (dir) => {
      const { code, out } = check(['i-5', '--dir', dir]);
      assert.equal(code, 1, out);
      assert.match(out, hint);
    });
  }
});

test('i-5 runs the committed gate, not an uncommitted fix', () => {
  const skeleton = '#!/bin/bash\ncat > /dev/null\nexit 0\n';
  withRepo(hookRepo({ gate: skeleton }), (dir) => {
    write(dir, { '.claude/hooks/test-gate.sh': GATE });
    const { code, out } = check(['i-5', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /ran no test command/);
  });
});

test('i-5 runs a gate that uses another test command by name, such as pytest', () => {
  withRepo(hookRepo({ gate: GATE.replace('npm test', 'pytest') }), (dir) => {
    const { code, out } = check(['i-5', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

// A repository after lesson i-6: the finished test-gaps subagent, read-only,
// and the log a SubagentStart hook wrote when Claude delegated to it.
const TEST_GAPS = (fields) => `---
name: test-gaps
${fields}
---

You find code that no test exercises.
`;
const GAPS_FIELDS = 'description: Lists the functions in a project that no test calls, with the file each is in. Use when the user asks what is untested or where tests are missing.\ntools: Read, Grep, Glob';
function agentRepo({ fields = GAPS_FIELDS, log = 'Explore\ntest-gaps\n' } = {}) {
  return () => {
    const dir = repo({ '.claude/agents/test-gaps.md': TEST_GAPS(fields) });
    commit(dir, 'Add a test-gaps subagent');
    if (log !== null) write(dir, { '.practice/i-6-agents.txt': log });
    return dir;
  };
}

test('i-6 passes for a committed read-only subagent that Claude delegated to', () => {
  withRepo(agentRepo(), (dir) => {
    const { code, out } = check(['i-6', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

test('i-6 accepts tools written as a YAML list, indented or at the key\'s indent', () => {
  for (const tools of ['tools:\n  - Read\n  - Grep', 'tools:\n- Read\n- Grep\n- Glob']) {
    withRepo(agentRepo({ fields: GAPS_FIELDS.replace('tools: Read, Grep, Glob', tools) }), (dir) => {
      const { code, out } = check(['i-6', '--dir', dir]);
      assert.equal(code, 0, `${tools}: ${out}`);
    });
  }
});

test('i-6 reads a trailing comment and a description on the next line as Claude Code does', () => {
  const fields = 'description:\n  Lists the functions in a project that no test calls, with the file each is in.\n  Use when the user asks what is untested.\ntools: Read, Grep, Glob  # read-only';
  withRepo(agentRepo({ fields }), (dir) => {
    const { code, out } = check(['i-6', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

test('i-6 fails while the partial file still has its TODOs', () => {
  withRepo(agentRepo({ fields: 'description: TODO\ntools: TODO' }), (dir) => {
    const { code, out } = check(['i-6', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /description/);
    assert.match(out, /tools/);
  });
});

test('i-6 fails for a subagent that can edit files or run commands, or inherits every tool', () => {
  for (const tools of ['tools: Read, Grep, Bash', 'tools: Read, Edit', 'tools:\n- Read\n- Bash', '']) {
    withRepo(agentRepo({ fields: GAPS_FIELDS.replace('tools: Read, Grep, Glob', tools) }), (dir) => {
      const { code, out } = check(['i-6', '--dir', dir]);
      assert.equal(code, 1, `${tools}: ${out}`);
      assert.match(out, /read-only|every tool/);
    });
  }
});

test('i-6 fails for a subagent with a web tool, which reading code never needs', () => {
  for (const tools of ['tools: Read, Grep, Glob, WebFetch', 'tools:\n- Read\n- WebSearch']) {
    withRepo(agentRepo({ fields: GAPS_FIELDS.replace('tools: Read, Grep, Glob', tools) }), (dir) => {
      const { code, out } = check(['i-6', '--dir', dir]);
      assert.equal(code, 1, `${tools}: ${out}`);
      assert.match(out, /reaches the web/);
    });
  }
});

test('i-6 says how to log delegations when there is no log, and fails when test-gaps never ran', () => {
  withRepo(agentRepo({ log: null }), (dir) => {
    const { code, out } = check(['i-6', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /--settings \.practice\/i-6-hook\.json/);
  });
  withRepo(agentRepo({ log: 'Explore\n' }), (dir) => {
    const { code, out } = check(['i-6', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /Use the test-gaps agent/);
  });
});

// A repository after lesson i-7: Chrome DevTools MCP shared at project scope,
// pinned and with its data flows off, and the screenshot a session saved.
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const MCP = (args, env = { CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: '1' }) => JSON.stringify({ mcpServers: { 'chrome-devtools': { type: 'stdio', command: 'npx', args, env } } }, null, 2);
const PINNED = ['-y', 'chrome-devtools-mcp@1.10.1', '--isolated', '--no-usage-statistics', '--no-performance-crux'];
function mcpRepo({ mcp = MCP(PINNED), shot = PNG } = {}) {
  return () => {
    const dir = repo({ '.mcp.json': mcp });
    commit(dir, 'Share Chrome DevTools MCP');
    // The repaired demo first, then the capture of it.
    write(dir, { '.practice/demo.html': '<a href="#guide">Guide</a> <a href="#reference">Reference</a>\n<p id="link-count">Counting links...</p>\n<script>\nconst links = document.querySelectorAll(\'a\');\ndocument.querySelector(\'#link-count\').textContent = `${links.length} links ready`;\n</script>' });
    if (shot) write(dir, { '.practice/i-7-page.png': shot });
    return dir;
  };
}

test('i-7 passes for a pinned server, a repaired demo and a saved screenshot', () => {
  withRepo(mcpRepo(), (dir) => {
    const { code, out } = check(['i-7', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

test('i-7 accepts the flags written as --flag=false', () => {
  withRepo(mcpRepo({ mcp: MCP(['-y', 'chrome-devtools-mcp@1.10.1', '--usage-statistics=false', '--performance-crux=false']) }), (dir) => {
    const { code, out } = check(['i-7', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

test('i-7 fails for @latest, and for each data flow left on', () => {
  for (const [args, env, hint] of [
    [['-y', 'chrome-devtools-mcp@latest', '--no-usage-statistics', '--no-performance-crux'], undefined, /exact version/],
    [['-y', 'chrome-devtools-mcp@1.10.1', '--no-performance-crux'], undefined, /usage statistics/],
    [['-y', 'chrome-devtools-mcp@1.10.1', '--no-usage-statistics'], undefined, /CrUX/],
    [PINNED, {}, /update checks/],
  ]) {
    withRepo(mcpRepo({ mcp: MCP(args, env) }), (dir) => {
      const { code, out } = check(['i-7', '--dir', dir]);
      assert.equal(code, 1, out);
      assert.match(out, hint);
    });
  }
});

test('i-7 fails without a committed .mcp.json, and without a server running chrome-devtools-mcp', () => {
  withRepo(() => repo(), (dir) => {
    const { code, out } = check(['i-7', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /\.mcp\.json/);
  });
  withRepo(mcpRepo({ mcp: JSON.stringify({ mcpServers: {} }) }), (dir) => {
    const { code, out } = check(['i-7', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /chrome-devtools-mcp/);
  });
});

test('i-7 fails when the screenshot was taken before the demo\'s last change', () => {
  withRepo(mcpRepo(), (dir) => {
    const old = new Date(Date.now() - 60_000);
    utimesSync(join(dir, '.practice/i-7-page.png'), old, old);
    const { code, out } = check(['i-7', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /Capture the page again after the repair/);
  });
});

test('i-7 fails when the screenshot is missing or is not a PNG', () => {
  for (const shot of [null, Buffer.from('not an image')]) {
    withRepo(mcpRepo({ shot }), (dir) => {
      const { code, out } = check(['i-7', '--dir', dir]);
      assert.equal(code, 1, out);
      assert.match(out, /i-7-page\.png/);
    });
  }
});

// A repository after lesson i-8: a plugin from an Anthropic marketplace
// enabled for the project, and the plugin list a shell saved there.
const PLUGIN = 'claude-code-setup@claude-plugins-official';
const LSP = 'typescript-lsp@claude-plugins-official';
const TRIAL = (dir) => ({ id: LSP, version: '1.0.0', scope: 'local', enabled: true, installPath: '/tmp/y', projectPath: dir, projectEnabled: false });
function pluginRepo({ enabled = { [PLUGIN]: true }, list = (dir) => [{ id: PLUGIN, version: '1.0.0', scope: 'project', enabled: true, installPath: '/tmp/x', projectPath: dir, projectEnabled: true }, TRIAL(dir)] } = {}) {
  return () => {
    const dir = repo({ '.claude/settings.json': JSON.stringify({ enabledPlugins: enabled }, null, 2) });
    commit(dir, 'Enable claude-code-setup for the project');
    if (list) write(dir, { '.practice/i-8-plugins.json': JSON.stringify(list(realpathSync(dir)), null, 2) });
    return dir;
  };
}

test('i-8 passes for an Anthropic plugin enabled and installed at project scope', () => {
  withRepo(pluginRepo(), (dir) => {
    const { code, out } = check(['i-8', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

test('i-8 fails while the enabledPlugins entry is a TODO, or names a third-party marketplace', () => {
  for (const enabled of [{ 'TODO: claude-code-setup@<marketplace>': true }, { 'formatter@acme-tools': true }]) {
    withRepo(pluginRepo({ enabled }), (dir) => {
      const { code, out } = check(['i-8', '--dir', dir]);
      assert.equal(code, 1, out);
      assert.match(out, /claude-plugins-official/);
    });
  }
});

test('i-8 fails when the saved list has the plugin only at another scope or for another project', () => {
  const lists = [
    (dir) => [{ id: PLUGIN, version: '1.0.0', scope: 'user', enabled: true, installPath: '/tmp/x' }],
    () => [{ id: PLUGIN, version: '1.0.0', scope: 'project', enabled: true, installPath: '/tmp/x', projectPath: '/somewhere/else', projectEnabled: false }],
  ];
  for (const list of lists) {
    withRepo(pluginRepo({ list }), (dir) => {
      const { code, out } = check(['i-8', '--dir', dir]);
      assert.equal(code, 1, out);
      assert.match(out, /--scope project/);
    });
  }
});

test('i-8 fails when the saved list shows the install for another project on this machine', () => {
  const other = realpathSync(repo({ 'README.md': '# other\n' }));
  const list = () => [{ id: PLUGIN, version: '1.0.0', scope: 'project', enabled: true, installPath: '/tmp/x', projectPath: other, projectEnabled: true }];
  withRepo(pluginRepo({ list }), (dir) => {
    const { code, out } = check(['i-8', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /--scope project/);
  });
});

test('i-8 fails when the code intelligence trial is missing, at another scope, or turned on for the team', () => {
  const project = (dir) => ({ id: PLUGIN, version: '1.0.0', scope: 'project', enabled: true, installPath: '/tmp/x', projectPath: dir, projectEnabled: true });
  for (const [list, enabled, hint] of [
    [(dir) => [project(dir)], undefined, /no code intelligence plugin at local scope/],
    [(dir) => [project(dir), { ...TRIAL(dir), scope: 'user', projectPath: undefined }], undefined, /no code intelligence plugin at local scope/],
    [(dir) => [project(dir), TRIAL(dir)], { [PLUGIN]: true, [LSP]: true }, /every teammate gets your trial/],
  ]) {
    withRepo(pluginRepo({ list, ...(enabled ? { enabled } : {}) }), (dir) => {
      const { code, out } = check(['i-8', '--dir', dir]);
      assert.equal(code, 1, out);
      assert.match(out, hint);
    });
  }
});

test('i-8 says how to save the plugin list when it is missing or not JSON', () => {
  withRepo(pluginRepo({ list: null }), (dir) => {
    const { code, out } = check(['i-8', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /claude plugin list --json > \.practice\/i-8-plugins\.json/);
  });
});

// The Intermediate capstone: everything the brief asks for, committed.
const SAMPLES_HOOK = `#!/bin/bash
FILE_PATH=$(jq -r '.tool_input.file_path // empty')
case "$FILE_PATH" in
  "$CLAUDE_PROJECT_DIR"/samples/*) echo "Blocked: samples/ is test data" >&2; exit 2 ;;
esac
exit 0
`;
function capstoneRepo({ omit = [], hook = SAMPLES_HOOK, files: extra = {}, settings: patch = {}, log = 'Explore\nreviewer\n' } = {}) {
  return () => {
    const settings = {
      permissions: { allow: ['Bash(npm test)'], ask: ['Bash(git push *)'], deny: ['Read(./.env)', 'Read(./.env.*)'] },
      sandbox: { enabled: true },
      enabledPlugins: { 'claude-code-setup@claude-plugins-official': true },
      hooks: { PreToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: '${CLAUDE_PROJECT_DIR}/.claude/hooks/protect-samples.sh', args: [], onFailure: 'block' }] }] },
      ...patch,
    };
    const files = {
      'package.json': JSON.stringify({ type: 'module', scripts: { test: 'node -e "process.exit(0)"' } }),
      'samples/guide.md': '# Guide\n',
      ...fixedApp,
      'test/links.test.js': '// test\n',
      'CLAUDE.md': '# linkcheck\n\n- npm scripts: @package.json\n',
      '.claude/rules/testing.md': '---\npaths:\n  - "test/**/*.js"\n---\n\n- Use node:test.\n',
      '.claude/skills/check-links/SKILL.md': '---\nname: check-links\ndescription: Runs the link checker on a folder and explains each broken link it finds. Use when someone asks to check links or find broken links.\n---\n\nRun npm run linkcheck on $ARGUMENTS and explain each broken link.\n',
      '.claude/agents/reviewer.md': '---\nname: reviewer\ndescription: Reviews changes before a commit and reports problems by severity, without editing anything.\ntools: Read, Grep, Glob\n---\n\nReview the changes you are given.\n',
      '.mcp.json': MCP(PINNED),
      '.claude/settings.json': JSON.stringify(settings, null, 2),
      '.claude/hooks/protect-samples.sh': hook,
      ...extra,
    };
    for (const path of omit) delete files[path];
    const dir = repo(files);
    if (files['.claude/hooks/protect-samples.sh']) chmodSync(join(dir, '.claude/hooks/protect-samples.sh'), 0o755);
    commit(dir, 'Get linkcheck ready for a new teammate');
    // The log of the review the fix got, in the ignored .practice/ folder.
    if (log !== null) write(dir, { '.practice/i-capstone-agents.txt': log });
    return dir;
  };
}

test('the Intermediate capstone rejects the original malformed-percent crash', () => {
  withRepo(capstoneRepo({ files: buggyApp }), dir => {
    const { code, out } = check(['i-capstone', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /malformed percent/);
  });
});

test('the Intermediate capstone does not accept an uncommitted malformed-percent fix', () => {
  withRepo(capstoneRepo({ files: buggyApp }), dir => {
    write(dir, fixedApp);
    const { code, out } = check(['i-capstone', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /mishandles malformed percent/);
  });
});

test('the Intermediate capstone rejects skipping malformed targets or breaking encoded paths', () => {
  const skip = buggyApp['src/check-links.js'].replace('      const target = link.target.split', '      try { decodeURIComponent(link.target); } catch { continue; }\n      const target = link.target.split');
  const raw = buggyApp['src/check-links.js'].replace('decodeURIComponent(target)', 'target');
  for (const source of [skip, raw]) withRepo(capstoneRepo({ files: { 'src/check-links.js': source } }), dir => {
    const { code, out } = check(['i-capstone', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /mishandles malformed percent/);
  });
});

test('the Intermediate capstone passes when everything in the brief is committed', () => {
  withRepo(capstoneRepo(), (dir) => {
    const { code, out } = check(['i-capstone', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

test('the Intermediate capstone fails without a skill, a reviewer or a hook, naming each', () => {
  for (const [path, hint] of [['.claude/skills/check-links/SKILL.md', /skill/], ['.claude/agents/reviewer.md', /subagent/], ['.claude/hooks/protect-samples.sh', /samples\//]]) {
    withRepo(capstoneRepo({ omit: [path] }), (dir) => {
      const { code, out } = check(['i-capstone', '--dir', dir]);
      assert.equal(code, 1, out);
      assert.match(out, hint);
    });
  }
});

// Items 3, 4, 5 and 7 come from lessons 7, 8, 4 and 2: with their file
// missing, or a server file without the lesson's server, they send the
// learner to the capstone, and the lessons' own checks still name the lesson.
test('the Intermediate capstone names the capstone, not a lesson, for a missing .mcp.json, settings file or CLAUDE.md, or a server file without the server', () => {
  const noServer = JSON.stringify({ mcpServers: { other: { type: 'stdio', command: 'npx', args: ['-y', 'other-mcp@1.0.0'] } } }, null, 2);
  for (const [setup, says, own] of [
    [{ omit: ['.mcp.json'] }, ['There is no .mcp.json at the repository root. Write the one the capstone asks for there, as in lesson 7.'], [['i-7', 'Save the partial file from the lesson\'s Your turn there.']]],
    [{ files: { '.mcp.json': noServer } }, ['No server in .mcp.json runs chrome-devtools-mcp. Add it under `mcpServers`, as in lesson 7.'], [['i-7', 'Add it under `mcpServers`, as in the lesson.']]],
    [{ omit: ['.claude/settings.json'] }, [
      'There is no committed .claude/settings.json that parses as JSON. Add the `enabledPlugins` entry the capstone asks for and commit it, as in lesson 8.',
      'There is no .claude/settings.json. Write the team settings the capstone asks for there, as in lesson 4.',
    ], [['i-8', 'Add the `enabledPlugins` entry from the lesson and commit it.'], ['i-4', 'Save the partial file from the lesson\'s Your turn there.']]],
    [{ omit: ['CLAUDE.md'] }, ['There is no committed CLAUDE.md. Commit the one the capstone asks for, as in lesson 2.'], [['i-2', 'Commit the one you organize in this lesson.']]],
  ]) {
    withRepo(capstoneRepo(setup), (dir) => {
      const { code, out } = check(['i-capstone', '--dir', dir]);
      assert.equal(code, 1, out);
      for (const line of says) assert.ok(out.includes(line), out);
      assert.doesNotMatch(out, /Your turn|this lesson|the lesson/, out);
      for (const [lesson, said] of own) {
        const mine = check([lesson, '--dir', dir]);
        assert.ok(mine.out.includes(said), mine.out);
      }
    });
  }
});

test('the Intermediate capstone fails for a hook that blocks too much, or not samples/', () => {
  const blocksAll = '#!/bin/bash\ncat >/dev/null\necho "Blocked" >&2\nexit 2\n';
  const blocksNone = '#!/bin/bash\ncat >/dev/null\nexit 0\n';
  // A substring match also blocks src/samples.js, which is no part of samples/.
  const substring = '#!/bin/bash\ncase "$(cat)" in *samples*) echo "Blocked" >&2; exit 2 ;; esac\nexit 0\n';
  for (const hook of [blocksAll, blocksNone, substring]) {
    withRepo(capstoneRepo({ hook }), (dir) => {
      const { code, out } = check(['i-capstone', '--dir', dir]);
      assert.equal(code, 1, out);
      assert.match(out, /samples\//);
    });
  }
});

test('the Intermediate capstone does not count lesson leftovers as the brief\'s skill and reviewer', () => {
  const files = { '.claude/skills/tdd/SKILL.md': FINISHED_TDD, '.claude/agents/test-gaps.md': TEST_GAPS(GAPS_FIELDS) };
  withRepo(capstoneRepo({ omit: ['.claude/skills/check-links/SKILL.md', '.claude/agents/reviewer.md'], files }), (dir) => {
    const { code, out } = check(['i-capstone', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /npm run linkcheck/);
    assert.match(out, /reviews changes/);
  });
});

test('the Intermediate capstone finds the hook script in args or behind a quoted project path', () => {
  for (const entry of [
    { type: 'command', command: 'bash', args: ['.claude/hooks/protect-samples.sh'], onFailure: 'block' },
    { type: 'command', command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/protect-samples.sh', onFailure: 'block' },
    { type: 'command', command: '"$CLAUDE_PROJECT_DIR/.claude/hooks/protect-samples.sh"', onFailure: 'block' },
  ]) {
    const settings = { hooks: { PreToolUse: [{ matcher: 'Edit|Write', hooks: [entry] }] } };
    withRepo(capstoneRepo({ settings }), (dir) => {
      const { code, out } = check(['i-capstone', '--dir', dir]);
      assert.equal(code, 0, out);
    });
  }
});

test('the Intermediate capstone wants the sandbox in the committed team settings', () => {
  withRepo(capstoneRepo({ settings: { sandbox: { enabled: false } } }), (dir) => {
    write(dir, { '.claude/settings.local.json': JSON.stringify({ sandbox: { enabled: true } }) });
    const { code, out } = check(['i-capstone', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /sandbox/);
  });
});

test('the Intermediate capstone accepts a committed Edit deny rule for samples/ in place of a hook', () => {
  for (const rule of ['Edit(./samples/**)', 'Edit(samples/**)', 'Edit(/samples/**)', 'Edit(**/samples/**)']) {
    const settings = { permissions: { allow: ['Bash(npm test)'], ask: ['Bash(git push *)'], deny: ['Read(./.env)', 'Read(./.env.*)', rule] }, hooks: {} };
    withRepo(capstoneRepo({ omit: ['.claude/hooks/protect-samples.sh'], settings }), (dir) => {
      const { code, out } = check(['i-capstone', '--dir', dir]);
      assert.equal(code, 0, `${rule}: ${out}`);
    });
  }
});

test('the Intermediate capstone wants a samples/ hook to fail closed', () => {
  const settings = { hooks: { PreToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: '${CLAUDE_PROJECT_DIR}/.claude/hooks/protect-samples.sh', args: [] }] }] } };
  withRepo(capstoneRepo({ settings }), (dir) => {
    const { code, out } = check(['i-capstone', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /"onFailure": "block"/);
  });
});

test('the Intermediate capstone wants the review of the fix logged, by a committed reviewer', () => {
  for (const [log, hint] of [[null, /--settings \.practice\/i-capstone-hook\.json/], ['Explore\ntest-gaps\n', /names no committed reviewer/]]) {
    withRepo(capstoneRepo({ log }), (dir) => {
      const { code, out } = check(['i-capstone', '--dir', dir]);
      assert.equal(code, 1, out);
      assert.match(out, hint);
    });
  }
});

test('the Intermediate capstone wants a person to approve a push', () => {
  const settings = { permissions: { allow: ['Bash(npm test)'], deny: ['Read(./.env)', 'Read(./.env.*)'] } };
  withRepo(capstoneRepo({ settings }), (dir) => {
    const { code, out } = check(['i-capstone', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /Add an ask rule to `permissions\.ask`/);
  });
});
