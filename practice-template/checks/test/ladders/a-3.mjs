// Every FAIL message of Advanced lesson 3's check, each from a work folder
// that produces it: `files` to write, or `setup(dir, { write, commit })`.
// Each scenario breaks one thing, so one narrow question matches its message.
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT = '.claude/workflows/audit-dropped-errors.js';
const META = "export const meta = {\n  name: 'audit-dropped-errors',\n  description: 'Audit a folder for errors that are caught and then ignored, reporting only confirmed findings',\n}\n";
const BODY = "\nconst folder = Array.isArray(args) ? args[0] : args\nconst found = await agent(`Find errors under ${folder}/ that are caught and then ignored.`)\nconst checked = await agent(`Try to refute each of these findings:\\n${found}`)\nreturn checked\n";
const GOOD = `${META}${BODY}`;
const OLD = {
  'src/paths.js': "import { fileURLToPath } from 'node:url';\n\nexport const root = fileURLToPath(new URL('..', import.meta.url));\n",
  'test/paths.test.js': "import { test } from 'node:test';\n\nconst fixtures = new URL('fixtures/', import.meta.url);\ntest('root', () => {});\n",
};
const NEW = {
  'test/paths.test.js': "import { test } from 'node:test';\nimport { join } from 'node:path';\n\nconst fixtures = join(import.meta.dirname, 'fixtures');\ntest('root', () => {});\n",
};
const PATTERN = 'import\\.meta\\.url\n';

// The old form committed in src/ and test/, then test/ migrated, committed
// or (with `uncommitted`) left in the working tree, or (with `none`) not at
// all, and the pattern as given (null for none).
const migration = ({ uncommitted = false, none = false, pattern = PATTERN } = {}) => (dir, { write, commit }) => {
  write(dir, { 'README.md': '# A project\n', ...OLD });
  commit(dir, 'Start');
  if (!none) {
    write(dir, NEW);
    if (!uncommitted) commit(dir, 'Migrate test/', Object.keys(NEW));
  }
  if (pattern !== null) write(dir, { '.practice/a-3-pattern.txt': pattern });
};

// A workflow script committed at `path`.
const committed = (text, path = SCRIPT) => (dir, { write, commit }) => {
  write(dir, { 'README.md': '# A project\n' });
  commit(dir, 'Start');
  write(dir, { [path]: text });
  commit(dir, 'Add the workflow', [path]);
};
const noArgs = (line) => GOOD.replace('const folder = Array.isArray(args) ? args[0] : args', line);

export const scenarios = [
  { item: 0, name: 'no workflow script', files: { 'README.md': '# A project\n' } },
  {
    item: 0,
    name: 'the script saved but not committed',
    setup: (dir, { write, commit }) => {
      write(dir, { 'README.md': '# A project\n' });
      commit(dir, 'Start');
      write(dir, { [SCRIPT]: GOOD });
    },
  },
  {
    item: 0,
    name: 'the script hidden by an ignore rule',
    setup: (dir, { write, commit }) => {
      write(dir, { 'README.md': '# A project\n' });
      commit(dir, 'Start');
      appendFileSync(join(dir, '.git', 'info', 'exclude'), '.claude/\n');
      write(dir, { [SCRIPT]: GOOD });
    },
  },
  { item: 0, name: 'the script in a subfolder', setup: committed(GOOD, '.claude/workflows/team/audit-dropped-errors.js') },
  { item: 0, name: 'code before meta', setup: committed(`const folder = args\n${GOOD}`) },
  { item: 0, name: 'a variable in meta', setup: committed(GOOD.replace("name: 'audit-dropped-errors'", 'name: NAME')) },
  { item: 0, name: 'meta without a description', setup: committed(GOOD.replace(/\n {2}description: .*\n/, '\n')) },
  { item: 0, name: 'a script that does not compile', setup: committed(`${GOOD}const late = await agent(\nlet x = 1\n`) },
  { item: 0, name: 'a script that never reads args', setup: committed(noArgs("const folder = 'src'")) },
  { item: 0, name: 'args only in a comment', setup: committed(noArgs("// TODO: read the folder from args\nconst folder = 'src'")) },
  { item: 0, name: 'a script that declares its own args', setup: committed(noArgs("const args = 'src'\nconst folder = args")) },
  { item: 0, name: 'a script that starts no subagent', setup: committed(`${META}\nconst folder = args\nreturn folder\n`) },
  { item: 0, name: 'a script with one agent call', setup: committed(GOOD.replace(/const checked[^\n]*\nreturn checked/, 'return found')) },
  { item: 1, name: 'no pattern file', setup: migration({ pattern: null }) },
  { item: 1, name: 'an empty pattern file', setup: migration({ pattern: '\n' }) },
  { item: 1, name: 'a pattern git cannot read', setup: migration({ pattern: 'import\\.meta\\.(url\n' }) },
  { item: 1, name: 'a pattern that never matched', setup: migration({ pattern: 'nothingLikeThis\n' }) },
  { item: 1, name: 'a migration left uncommitted', setup: migration({ uncommitted: true }) },
  { item: 1, name: 'no folder migrated', setup: migration({ none: true }) },
];
