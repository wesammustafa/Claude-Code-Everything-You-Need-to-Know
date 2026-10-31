const HEADER = '// SPDX-License-Identifier: MIT';
const MEMORY = `# Project\n- Every new JavaScript file in \`src/\` starts with the line \`${HEADER}\`.\nCLI errors go to stderr and start with \`linkcheck:\`.\n`;
const memory = (text = MEMORY, files = {}) => (dir, { write, commit }) => { write(dir, { 'CLAUDE.md': text, 'package.json': '{"scripts":{"test":"exit 0"}}', ...files }); commit(dir, 'Instructions'); };
const source = (text) => (dir, api) => { memory()(dir, api); api.write(dir, { 'src/stats.js': text }); api.commit(dir, 'Add source'); };
export const scenarios = [
  { item: 0, name: 'memory not committed', files: {} },
  { item: 0, name: 'rule missing', setup: memory('# Project') },
  { item: 0, name: 'rule has no scope', setup: memory(`- Every new file starts with the line \`${HEADER}\`.`) },
  { item: 1, name: 'no memory rule', files: {} },
  { item: 1, name: 'new file not committed', setup(dir, api) { memory()(dir, api); api.write(dir, { 'src/stats.js': HEADER }); } },
  { item: 1, name: 'no new source', setup: memory() },
  { item: 1, name: 'test alone is not source', setup(dir, api) { memory()(dir, api); api.write(dir, { 'test/stats.test.js': HEADER }); api.commit(dir, 'Add test'); } },
  { item: 1, name: 'wrong first line', setup: source('export const x = 1;') },
  { item: 1, name: 'header later in file', setup: source(`export const x = 1;\n${HEADER}`) },
  { item: 2, name: 'no committed memory', files: {} },
  { item: 2, name: 'error convention missing', setup: memory('# Project') },
  { item: 2, name: 'package invalid', setup: memory(MEMORY, { 'package.json': '{' }) },
  { item: 2, name: 'script not real', setup: memory(`${MEMORY}\nRun npm run tests.`) },
  { item: 3, name: 'no committed memory', files: {} },
  { item: 3, name: 'personal file tracked', setup: memory(MEMORY, { 'CLAUDE.local.md': 'private' }) },
  { item: 3, name: 'personal removal not committed', setup(dir, api) { memory(MEMORY, { 'CLAUDE.local.md': 'private' })(dir, api); importGit(dir, 'rm', '--cached', 'CLAUDE.local.md'); } },
  { item: 3, name: 'ignore missing', setup: memory() },
  { item: 3, name: 'personal note in team instructions', setup: memory(`${MEMORY}\nMy path is linkcheck-docs.`, { '.gitignore': 'CLAUDE.local.md\n' }) },
];
import { execFileSync } from 'node:child_process';
const importGit = (dir, ...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' });

scenarios.push(
  { item: 3, name: 'negated personal ignore', setup: memory(MEMORY, { '.gitignore': 'CLAUDE.local.md\n!CLAUDE.local.md\n' }) },
  { item: 3, name: 'local exclude is not shared', setup(dir, api) { memory()(dir, api); api.write(dir, { '.git/info/exclude': '.practice/\nCLAUDE.local.md\n' }); } },
  { item: 3, name: 'ignore not committed', setup(dir, api) { memory()(dir, api); api.write(dir, { '.gitignore': 'CLAUDE.local.md\n' }); } },
);
