// Every FAIL message of lesson 2's check, each from a practice copy that
// produces it: `files` to write, or `setup(dir, { write, commit })`.
export const scenarios = [
  { item: 0, name: 'no snapshot while the plan was on screen', files: {} },
  {
    item: 0,
    name: 'a changed file in the snapshot taken before approving',
    files: { '.practice/b-2-before.txt': ' M src/config.js\n?? notes.md\n' },
  },
  { item: 1, name: 'no plan file', files: { '.practice/b-2-after.txt': ' M src/config.js\n' } },
  {
    item: 1,
    name: 'a blank plan file',
    files: { '.practice/b-2-plan.txt': '\n  \n', '.practice/b-2-after.txt': ' M src/config.js\n' },
  },
  { item: 1, name: 'no snapshot after the edits', files: { '.practice/b-2-plan.txt': 'src/config.js\n' } },
  {
    item: 1,
    name: 'a snapshot saved before Claude changed any file (190)',
    files: { '.practice/b-2-plan.txt': 'src/config.js\n', '.practice/b-2-after.txt': '' },
  },
  {
    item: 1,
    name: 'a changed file not in the plan',
    files: {
      '.practice/b-2-plan.txt': 'src/config.js\ntest/config.test.js\n',
      '.practice/b-2-after.txt': ' M src/config.js\n M test/config.test.js\n?? src/empty.js\n',
    },
  },
];

const tool = (source) => ({ 'package.json': '{"name":"claude-code-practice","type":"module"}', 'src/cli.js': source });
scenarios.push(
  { item: 2, name: 'not the practice template', files: {} },
  { item: 2, name: 'unknown key accepted', files: tool('process.exit(0);') },
  { item: 2, name: 'error omits the key', files: tool('console.error("invalid config"); process.exit(2);') },
  { item: 3, name: 'not the practice template', files: {} },
  { item: 3, name: 'broken links pass CI', files: tool('process.exit(0);') },
  { item: 3, name: 'CLI crashes instead of reporting a link', files: tool('throw new Error("crash");') },
);
