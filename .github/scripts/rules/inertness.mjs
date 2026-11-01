// Nothing under examples/, practice-template/ or solutions/ sits at a path
// Claude Code can load on its own: no .claude/ folder, .mcp.json, CLAUDE.md,
// CLAUDE.local.md or AGENTS.md. These folders use dot-claude/, dot-mcp.json
// and CLAUDE.example.md instead. The folders are read from disk, so files git
// ignores are caught too.
//
// Nor can an example folder or the guide repository be added as a plugin
// marketplace by its folder path or as owner/repo. A plugin's own
// .claude-plugin/plugin.json may stay under examples/: Claude Code doesn't
// scan a project's .claude/plugins/, and examples/ holds no .claude/skills/.
// A marketplace manifest goes in dot-claude-plugin/ instead of .claude-plugin/,
// and the root holds no .claude-plugin/ folder, which an owner/repo
// marketplace add reads.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const id = 'inertness';
export const modes = ['pr', 'release'];

const INERT = ['examples', 'practice-template', 'solutions'];
const LIVE = new Set(['.claude', '.mcp.json', 'CLAUDE.md', 'CLAUDE.local.md', 'AGENTS.md']);
export const RENAME = { '.claude': 'dot-claude/', '.mcp.json': 'dot-mcp.json', 'CLAUDE.md': 'CLAUDE.example.md', 'CLAUDE.local.md': 'CLAUDE.local.example.md', 'AGENTS.md': 'AGENTS.example.md' };

function walk(root, rel, out) {
  for (const entry of readdirSync(join(root, rel))) {
    const path = `${rel}/${entry}`;
    if (LIVE.has(entry)) out.push(`${path}: Claude Code can load this; rename it to ${RENAME[entry]}`);
    else if (statSync(join(root, path)).isDirectory()) {
      if (entry === '.claude-plugin' && existsSync(join(root, path, 'marketplace.json'))) {
        out.push(`${path}/marketplace.json: a marketplace manifest here lets this folder be added as a plugin marketplace by its path; rename the folder to dot-claude-plugin/`);
      }
      walk(root, path, out);
    }
  }
  return out;
}

export function run(ctx) {
  const problems = [];
  if (existsSync(join(ctx.root, '.claude-plugin'))) {
    problems.push('.claude-plugin/: an owner/repo marketplace add reads this folder at the repository root; keep marketplace examples under examples/, in dot-claude-plugin/');
  }
  const present = INERT.filter((folder) => existsSync(join(ctx.root, folder)));
  for (const folder of present) walk(ctx.root, folder, problems);
  if (problems.length) return { status: 'fail', problems };
  return { status: 'pass', summary: present.length ? `inert: ${present.map((f) => `${f}/`).join(', ')}` : 'no examples/, practice-template/ or solutions/ folder' };
}
