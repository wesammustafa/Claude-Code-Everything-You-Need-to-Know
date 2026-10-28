const BEFORE = '.practice/b-4-before-rewind.txt';
const AFTER = '.practice/b-4-after-rewind.txt';
const saved = (text) => (dir, { write, commit }) => { write(dir, { 'src/check-links.js': 'export function brokenLinks() { return []; }', 'src/links.js': 'export function findLinks() { return []; }' }); commit(dir, 'Initial'); write(dir, { 'src/check-links.js': text }); commit(dir, 'Refactor'); };
const clean = (files) => (dir, { write, commit }) => { write(dir, files); commit(dir, 'Initial'); };
export const scenarios = [
  { item: 0, name: 'no refactor commit', files: {} },
  { item: 0, name: 'export lost', setup: saved('export function checkFile() { return []; }') },
  { item: 0, name: 'still asynchronous', setup: saved('export async function brokenLinks() { return []; }') },
  { item: 1, name: 'no before snapshot', files: {} },
  { item: 1, name: 'script not run', files: { [BEFORE]: ' M src/check-links.js\n' } },
  { item: 2, name: 'no after snapshot', files: {} },
  { item: 2, name: 'caller not restored', files: { [AFTER]: ' M src/links.js\n M src/check-links.js\n' } },
  { item: 2, name: 'command change also gone', files: { [AFTER]: '' } },
  { item: 3, name: 'source still changed', files: { 'src/links.js': 'export const extractLinks = () => [];' } },
  { item: 3, name: 'rename committed', setup: clean({ 'src/links.js': 'export function extractLinks() { return []; }' }) },
  { item: 3, name: 'tool crashes', setup: clean({ 'src/links.js': 'export function findLinks() { return []; }', 'src/cli.js': 'throw new Error("broken");' }) },
];
