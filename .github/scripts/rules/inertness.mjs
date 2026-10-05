// Nothing under examples/ sits at a path Claude Code can load on its own:
// no .claude/ folder, .mcp.json, CLAUDE.md, CLAUDE.local.md or AGENTS.md.
// Examples use dot-claude/, dot-mcp.json and CLAUDE.example.md instead. The
// folder is read from disk, so files git ignores are caught too.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const id = 'inertness';
export const modes = ['pr', 'release'];

const LIVE = new Set(['.claude', '.mcp.json', 'CLAUDE.md', 'CLAUDE.local.md', 'AGENTS.md']);
const RENAME = { '.claude': 'dot-claude/', '.mcp.json': 'dot-mcp.json', 'CLAUDE.md': 'CLAUDE.example.md', 'CLAUDE.local.md': 'CLAUDE.example.md', 'AGENTS.md': 'AGENTS.example.md' };

function walk(root, rel, out) {
  for (const entry of readdirSync(join(root, rel))) {
    const path = `${rel}/${entry}`;
    if (LIVE.has(entry)) out.push(`${path}: Claude Code can load this; rename it to ${RENAME[entry]}`);
    else if (statSync(join(root, path)).isDirectory()) walk(root, path, out);
  }
  return out;
}

export function run(ctx) {
  if (!existsSync(join(ctx.root, 'examples'))) return { status: 'pass', summary: 'no examples/ folder' };
  const problems = walk(ctx.root, 'examples', []);
  if (problems.length) return { status: 'fail', problems };
  return { status: 'pass', summary: 'examples/ is inert' };
}
