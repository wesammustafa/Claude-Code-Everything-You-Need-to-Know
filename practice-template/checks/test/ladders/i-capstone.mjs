// Every FAIL message of the Intermediate capstone's check, each from a
// practice copy that produces it: `files` to write, or
// `setup(dir, { write, commit })`. Each scenario breaks one thing, so one
// narrow question matches its message.
import { chmodSync } from 'node:fs';
import { join } from 'node:path';
import { buggyApp } from '../fixtures/intermediate-app.mjs';

const SHARED = '.claude/settings.json';
const LOCAL = '.claude/settings.local.json';
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

// A link-checker skill the check passes, with one field changed by `extra`.
const SKILL = (extra = '') => `---\nname: check-links\ndescription: Runs the link checker on a folder and explains each broken link it reports. Use when someone asks to check links.\n${extra}---\n\nRun \`npm run linkcheck -- $ARGUMENTS\` and explain each broken link.\n`;

// Commits `files`, with every script under .claude/hooks/ executable.
const committed = (files) => (dir, { write, commit }) => {
  write(dir, files);
  for (const path of Object.keys(files)) if (path.startsWith('.claude/hooks/')) chmodSync(join(dir, path), 0o755);
  commit(dir, 'Set up the repository');
};

// The settings that run one script before Edit and Write, failing closed, as
// lesson 5 does, and the same without onFailure.
const hooked = (extra = { onFailure: 'block' }) => json({ hooks: { PreToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: '${CLAUDE_PROJECT_DIR}/.claude/hooks/protect-samples.sh', args: [], ...extra }] }] } });
const HOOKED = hooked();
const HOOK = '.claude/hooks/protect-samples.sh';
const script = (body) => `#!/bin/bash\nINPUT=$(cat)\n${body}\nexit 0\n`;
const READS_PATH = 'FILE_PATH=$(echo "$INPUT" | jq -r \'.tool_input.file_path // empty\')';

// A reviewer subagent, with its tools line.
const REVIEWER = (tools) => `---\nname: reviewer\ndescription: Reviews uncommitted changes for bugs and missing tests.\ntools: ${tools}\n---\n\nReview the changes and report the findings.\n`;

// The server entry from lesson 7, with `args` and `env` as given.
const SERVER = (args, env = { CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: '1' }) => json({ mcpServers: { 'chrome-devtools': { type: 'stdio', command: 'npx', args, env } } });
const PINNED = ['-y', 'chrome-devtools-mcp@1.10.1', '--isolated', '--no-usage-statistics', '--no-performance-crux'];

const rules = (allow, deny = ['Read(./.env)', 'Read(./.env.*)']) => json({ permissions: { allow, deny } });
const TEAM = rules(['Bash(npm test)']);

const MEMORY = '# CLAUDE.md\n\n- npm scripts: @package.json\n';
const PACKAGE = '{ "name": "demo" }\n';
const TESTING = '---\npaths:\n  - "test/**/*.js"\n---\n\n# Testing\n\n- Use `node:test` and `node:assert/strict`; no other test libraries.\n';

export const scenarios = [
  { item: 0, name: 'no skill committed', files: {} },
  { item: 0, name: 'a committed skill that only runs by name', setup: committed({ '.claude/skills/check-links/SKILL.md': SKILL('disable-model-invocation: true\n') }) },
  {
    item: 0,
    name: 'a committed skill whose body never runs the link checker',
    setup: committed({ '.claude/skills/check-links/SKILL.md': SKILL().replace('Run `npm run linkcheck -- $ARGUMENTS` and explain', 'Read the folder and explain') }),
  },
  {
    item: 0,
    name: 'a committed skill with a short description',
    setup: committed({ '.claude/skills/check-links/SKILL.md': SKILL().replace(/description: .*\n/, 'description: Checks links.\n') }),
  },

  { item: 1, name: 'no hook registered', setup: committed({ [SHARED]: TEAM }) },
  { item: 1, name: 'jq is not installed', setup: committed({ [SHARED]: HOOKED, [HOOK]: script(`PATH=/nonexistent\n${READS_PATH}`) }) },
  { item: 1, name: 'a hook that blocks nothing', setup: committed({ [SHARED]: HOOKED, [HOOK]: script(READS_PATH) }) },
  {
    item: 1,
    name: 'a hook that blocks every path',
    setup: committed({ [SHARED]: HOOKED, [HOOK]: script(`${READS_PATH}\necho "Blocked: $FILE_PATH" >&2\nexit 2`) }),
  },
  {
    item: 1,
    name: 'a samples/ hook that fails open',
    setup: committed({ [SHARED]: hooked({}), [HOOK]: script('case "$INPUT" in *\'/samples/\'*) echo "Blocked: samples/ is test data" >&2; exit 2 ;; esac') }),
  },

  { item: 2, name: 'no subagent committed', files: {} },
  { item: 2, name: 'a reviewer that can run commands', setup: committed({ '.claude/agents/reviewer.md': REVIEWER('Read, Grep, Glob, Bash') }) },

  { item: 3, name: '.mcp.json saved but not committed', files: { '.mcp.json': SERVER(PINNED) } },
  { item: 3, name: 'no .mcp.json', files: {} },
  { item: 3, name: 'a trailing comma in the committed file', setup: committed({ '.mcp.json': '{\n  "mcpServers": {},\n}\n' }) },
  { item: 3, name: 'a server that is not chrome-devtools-mcp', setup: committed({ '.mcp.json': SERVER(['-y', 'some-other-server@1.0.0']) }) },
  { item: 3, name: 'the package at @latest', setup: committed({ '.mcp.json': SERVER(['-y', 'chrome-devtools-mcp@latest', '--isolated', '--no-usage-statistics', '--no-performance-crux']) }) },
  { item: 3, name: 'usage statistics left on', setup: committed({ '.mcp.json': SERVER(['-y', 'chrome-devtools-mcp@1.10.1', '--isolated', '--no-performance-crux']) }) },
  { item: 3, name: 'CrUX lookups left on', setup: committed({ '.mcp.json': SERVER(['-y', 'chrome-devtools-mcp@1.10.1', '--isolated', '--no-usage-statistics']) }) },
  { item: 3, name: 'update checks left on', setup: committed({ '.mcp.json': SERVER(PINNED, {}) }) },

  { item: 4, name: 'no committed settings file', files: { [SHARED]: json({ enabledPlugins: { 'claude-code-setup@claude-plugins-official': true } }) } },
  { item: 4, name: 'a plugin from its repository name', setup: committed({ [SHARED]: json({ enabledPlugins: { 'claude-code-setup@anthropics/claude-plugins-official': true } }) }) },

  { item: 5, name: 'the shared file saved but not committed', files: { [SHARED]: TEAM } },
  { item: 5, name: 'no shared settings file', files: {} },
  { item: 5, name: 'a trailing comma in the committed file', setup: committed({ [SHARED]: '{\n  "permissions": {\n    "allow": ["Bash(npm test)"],\n    "deny": ["Read(./.env)", "Read(./.env.*)"],\n  }\n}\n' }) },
  { item: 5, name: 'a TODO left in a rule', setup: committed({ [SHARED]: rules(['TODO: the command that runs your tests']) }) },
  { item: 5, name: 'no deny rule for .env itself', setup: committed({ [SHARED]: rules(['Bash(npm test)'], ['Read(./.env.*)']) }) },
  { item: 5, name: 'no deny rule for the .env.* files', setup: committed({ [SHARED]: rules(['Bash(npm test)'], ['Read(./.env)']) }) },
  { item: 5, name: 'a broad allow rule', setup: committed({ [SHARED]: rules(['Bash(npm *)']) }) },
  { item: 5, name: 'no allow rule for a command', setup: committed({ [SHARED]: rules([]) }) },

  { item: 6, name: 'the personal file committed', setup: committed({ [LOCAL]: json({ sandbox: { enabled: true } }) }) },
  // `/sandbox` saved to the personal file, which teammates don't get.
  {
    item: 6,
    name: 'the sandbox on only in the personal file',
    setup(dir, helpers) {
      committed({ [SHARED]: TEAM })(dir, helpers);
      helpers.write(dir, { [LOCAL]: json({ sandbox: { enabled: true } }) });
    },
  },

  { item: 7, name: 'no CLAUDE.md committed', files: { 'package.json': PACKAGE } },
  { item: 7, name: 'the import inside backticks', setup: committed({ 'CLAUDE.md': '# CLAUDE.md\n\n- npm scripts: `@package.json`\n', 'package.json': PACKAGE }) },
  { item: 7, name: 'a period right after the import path', setup: committed({ 'CLAUDE.md': '# CLAUDE.md\n\nThe npm scripts are in @package.json.\n', 'package.json': PACKAGE }) },

  { item: 8, name: 'the rule saved but not committed', files: { '.claude/rules/testing.md': TESTING, 'test/config.test.js': '// a test\n' } },
  { item: 8, name: 'a pattern for a folder with no files', setup: committed({ '.claude/rules/testing.md': TESTING.replace('test/**/*.js', 'tests/**/*.js'), 'test/config.test.js': '// a test\n', 'CLAUDE.md': MEMORY }) },

  { item: 9, name: 'the tests fail', files: { 'package.json': '{ "scripts": { "test": "exit 1" } }\n' } },
  { item: 9, name: 'no test script and no saved exit code', files: {} },
  { item: 9, name: 'a PowerShell True instead of an exit code', files: { '.practice/b-3-tests.txt': 'True\n' } },
  { item: 9, name: 'a saved exit code that is not 0', files: { '.practice/b-3-tests.txt': '1\n' } },

  { item: 10, name: 'a new file not committed', files: { '.claude/agents/reviewer.md': REVIEWER('Read, Grep, Glob') } },
  { item: 11, name: 'no committed CLI source', files: {} },
  { item: 11, name: 'committed CLI output exceeds the bound', setup: committed({ 'src/cli.js': 'process.stdout.write("x".repeat(1000000));\n' }) },
  { item: 11, name: 'the original malformed-percent crash', setup: committed(buggyApp) },

  { item: 12, name: 'no delegation log', setup: committed({ '.claude/agents/reviewer.md': REVIEWER('Read, Grep, Glob') }) },
  {
    item: 12,
    name: 'a log of another subagent only',
    setup(dir, helpers) {
      committed({ '.claude/agents/reviewer.md': REVIEWER('Read, Grep, Glob') })(dir, helpers);
      helpers.write(dir, { '.practice/i-capstone-agents.txt': 'Explore\n' });
    },
  },

  { item: 13, name: 'no committed settings file', files: { [SHARED]: TEAM } },
  { item: 13, name: 'the ask rule still TODO', setup: committed({ [SHARED]: json({ permissions: { allow: ['Bash(npm test)'], ask: ['TODO: a command the team approves each time'] } }) }) },
  { item: 13, name: 'no ask rule', setup: committed({ [SHARED]: TEAM }) },
];
