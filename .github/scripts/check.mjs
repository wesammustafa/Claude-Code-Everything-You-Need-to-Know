#!/usr/bin/env node
// Runs the guide's checks over a repo tree and exits non-zero if any fails.
//
//   node .github/scripts/check.mjs [--root .] [--mode pr|release|scheduled]
//                                  [--base <ref>] [--tag <tag>] [--only <rule,...>]
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { rules } from './rules/index.mjs';
import { listFiles } from './lib/tree.mjs';
import { resolveBase } from './lib/git.mjs';

const MODES = ['pr', 'release', 'scheduled'];

function usage(message) {
  console.error(`${message}\nusage: node .github/scripts/check.mjs [--root DIR] [--mode ${MODES.join('|')}] [--base REF] [--tag TAG] [--only RULE,...]`);
  process.exit(2);
}

let args;
try {
  args = parseArgs({
    options: {
      root: { type: 'string', default: '.' },
      mode: { type: 'string', default: 'pr' },
      base: { type: 'string' },
      tag: { type: 'string' },
      only: { type: 'string' },
    },
  }).values;
} catch (error) {
  usage(error.message);
}
if (!MODES.includes(args.mode)) usage(`unknown mode: ${args.mode}`);

const known = new Set(rules.map((r) => r.id));
const only = args.only ? args.only.split(',') : null;
for (const name of only ?? []) if (!known.has(name)) usage(`unknown rule: ${name}`);

const root = resolve(args.root);
const ctx = { root, mode: args.mode, tag: args.tag, files: listFiles(root), base: resolveBase(root, args.base) };

let failed = false;
for (const rule of rules) {
  if (only ? !only.includes(rule.id) : !rule.modes.includes(args.mode)) continue;
  let result;
  try {
    result = await rule.run(ctx);
  } catch (error) {
    result = { status: 'fail', problems: [`crashed: ${error.stack ?? error}`] };
  }
  const label = result.status.toUpperCase();
  console.log(`${label} ${rule.id}${result.summary ? `: ${result.summary}` : ''}`);
  for (const problem of result.problems ?? []) console.log(`  ${problem}`);
  if (result.status === 'fail') failed = true;
}
process.exit(failed ? 1 : 0);
