// Every FAIL message of Intermediate lesson 2's check, each from a work
// folder that produces it: `files` to write, or `setup(dir, { write, commit })`.
// Each scenario breaks one thing, so one narrow question matches its message.
const MEMORY = '# CLAUDE.md\n\n- npm scripts: @package.json\n';
const PACKAGE = '{ "name": "demo" }\n';
const TESTING = '---\npaths:\n  - "test/**/*.js"\n---\n\n# Testing\n\n- Use `node:test` and `node:assert/strict`; no other test libraries.\n';
const CLI = (glob) => `---\npaths:\n  - "${glob}"\n---\n\n# CLI output\n\n- Print errors to stderr, starting with \`linkcheck:\`.\n`;
const LOG = '.practice/i-2-loaded.txt';

// A folder where items 0 and 1 pass: an import of a file that exists and a
// committed testing rule that matches a test file.
function organized(dir, { write, commit }) {
  write(dir, { 'CLAUDE.md': MEMORY, 'package.json': PACKAGE, '.claude/rules/testing.md': TESTING, 'test/config.test.js': '// a test\n' });
  commit(dir, 'Organize project memory');
}

export const scenarios = [
  { item: 0, name: 'no CLAUDE.md committed', files: { 'package.json': PACKAGE } },
  {
    item: 0,
    name: 'the import is added but not committed',
    setup(dir, { write, commit }) {
      write(dir, { 'CLAUDE.md': '# CLAUDE.md\n\nRun the tests with `npm test`.\n', 'package.json': PACKAGE });
      commit(dir, 'Add project instructions');
      write(dir, { 'CLAUDE.md': MEMORY });
    },
  },
  {
    item: 0,
    name: 'a period right after the import path',
    setup(dir, { write, commit }) {
      write(dir, { 'CLAUDE.md': '# CLAUDE.md\n\nThe npm scripts are in @package.json.\n', 'package.json': PACKAGE });
      commit(dir, 'Import the npm scripts');
    },
  },
  { item: 1, name: 'the rule is saved but not committed', files: { '.claude/rules/testing.md': TESTING, 'test/config.test.js': '// a test\n' } },
  {
    item: 1,
    name: 'the misspelled folder in a committed pattern',
    setup(dir, { write, commit }) {
      write(dir, { 'src/cli.js': '// the CLI\n', '.claude/rules/cli.md': CLI('source/**/*.js') });
      commit(dir, 'Add a CLI rule');
    },
  },
  { item: 2, name: 'no load log', setup: organized },
  {
    item: 2,
    name: 'a log from a session with no import',
    setup(dir, helpers) {
      organized(dir, helpers);
      helpers.write(dir, { [LOG]: `session_start\t${dir}/CLAUDE.md\n` });
    },
  },
  {
    item: 2,
    name: 'a log where no scoped rule loaded',
    setup(dir, helpers) {
      organized(dir, helpers);
      helpers.write(dir, { [LOG]: `session_start\t${dir}/CLAUDE.md\ninclude\t${dir}/package.json\n` });
    },
  },
  {
    item: 2,
    name: 'the fixed rule loaded before its commit',
    setup(dir, helpers) {
      organized(dir, helpers);
      helpers.write(dir, { 'src/cli.js': '// the CLI\n', '.claude/rules/cli.md': CLI('src/**/*.js') });
      helpers.write(dir, { [LOG]: `session_start\t${dir}/CLAUDE.md\ninclude\t${dir}/package.json\npath_glob_match\t${dir}/.claude/rules/cli.md\n` });
    },
  },
];
