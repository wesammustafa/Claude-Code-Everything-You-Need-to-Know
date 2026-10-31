#!/usr/bin/env node
// Renames findLinks to extractLinks in src/links.js, and nowhere else: its
// callers are left for Claude to update. Used by Beginner lesson 4, where a
// command changes a file Claude never edited in the conversation, so rewind
// leaves that change in place.
//   node practice/b-4/rename-export.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../../src/links.js', import.meta.url);
const text = readFileSync(file, 'utf8');
if (!/\bfindLinks\b/.test(text)) {
  console.error('rename-export: src/links.js has no findLinks to rename.');
  process.exit(1);
}
writeFileSync(file, text.replace(/\bfindLinks\b/g, 'extractLinks'));
console.log('Renamed findLinks to extractLinks in src/links.js. Its callers still use the old name.');
