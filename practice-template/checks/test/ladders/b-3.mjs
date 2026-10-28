// Each small CLI emits the checker's public output format. These copies
// isolate a failure without invoking the learner's whole application.
const tool = (output) => ({
  'package.json': '{"type":"module","scripts":{"test":"exit 0"}}',
  'src/links.js': 'export function isExternal(x) { return x.startsWith("//"); }',
  'src/cli.js': `console.log(${JSON.stringify(output)});`,
});
const missing = { item: 0, name: 'outside the template', files: {} };
const broken = (rows) => tool(`${rows}\n3 broken link(s)`);
const committed = (files) => (dir, { write, commit }) => { write(dir, { 'README.md': 'initial' }); commit(dir, 'Initial'); write(dir, files); commit(dir, 'Patch'); };
export const scenarios = [
  missing,
  { item: 0, name: 'CLI crashes', files: { ...tool(''), 'src/cli.js': 'throw new Error("broken");' } },
  { item: 0, name: 'existing titled link reported', files: broken('doc.md:1: broken link to setup.md "Setup guide"') },
  { item: 0, name: 'titles skipped', files: tool('All relative links resolve.') },
  { item: 0, name: 'target includes title', files: broken('doc.md:2: broken link to gone.md "Old page"\ndoc.md:3: broken link to old.md') },
  { item: 1, name: 'outside the template', files: {} },
  { item: 1, name: 'CLI crashes', files: { ...tool(''), 'src/cli.js': 'throw new Error("broken");' } },
  { item: 1, name: 'protocol relative not skipped', files: broken('doc.md:1: broken link to //cdn.example.com/app.js') },
  { item: 1, name: 'uncommitted patch skips other links', files: tool('All relative links resolve.') },
  { item: 1, name: 'committed patch skips other links', setup: committed({ ...tool('All relative links resolve.'), 'test/external.test.js': '// patch test' }) },
  { item: 2, name: 'outside the template', files: {} },
  { item: 2, name: 'tests already fail', files: { ...tool(''), 'package.json': '{"scripts":{"test":"exit 1"}}' } },
  { item: 2, name: 'test runner is missing', files: tool(''), path: 'missing-npm' },
  { item: 2, name: 'uncommitted tests miss flaw', files: tool('All relative links resolve.') },
  { item: 2, name: 'committed tests miss flaw', setup: committed({ ...tool('All relative links resolve.'), 'test/external.test.js': '// patch test' }) },
  { item: 3, name: 'no learner commit', files: {} },
  { item: 3, name: 'last commit has no test', setup: committed({ 'src/x.js': 'export const x = 1;' }) },
  { item: 3, name: 'last commit has tests alone', setup: committed({ 'test/x.test.js': '// test' }) },
  { item: 4, name: 'npm tests fail', files: { 'package.json': '{"scripts":{"test":"exit 1"}}' } },
  { item: 4, name: 'no npm test script', files: {} },
  { item: 4, name: 'saved exit is not a number', files: { '.practice/b-3-tests.txt': 'True' } },
  { item: 4, name: 'saved exit is nonzero', files: { '.practice/b-3-tests.txt': '1' } },
  { item: 5, name: 'uncommitted source', files: { 'src/x.js': '// work' } },
];
