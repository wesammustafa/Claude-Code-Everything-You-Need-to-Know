#!/usr/bin/env node
// Checks the relative links in a folder's Markdown files.
//   node src/cli.js [folder]
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseConfig, DEFAULTS } from './config.js';
import { brokenLinks } from './check-links.js';

const root = resolve(process.argv[2] ?? '.');
const configPath = join(root, 'linkcheck.json');
let config = DEFAULTS;
try {
  if (existsSync(configPath)) config = parseConfig(readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error(`linkcheck: ${error.message}`);
  process.exit(2);
}

let broken;
try {
  broken = brokenLinks(root, config);
} catch (error) {
  console.error(`linkcheck: ${error.message}`);
  process.exit(2);
}
for (const b of broken) console.log(`${b.file}:${b.line}: broken link to ${b.target}`);
console.log(broken.length ? `${broken.length} broken link(s)` : 'All relative links resolve.');
process.exit(broken.length ? 1 : 0);
