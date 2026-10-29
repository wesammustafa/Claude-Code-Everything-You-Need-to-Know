import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default function generate(root) {
  const b2 = join(root, 'solutions', 'b-2');
  const i1 = join(root, 'solutions', 'i-1');
  mkdirSync(join(b2, '.claude'), { recursive: true });
  mkdirSync(i1, { recursive: true });
  writeFileSync(join(b2, 'CLAUDE.md'), '# Project memory\n');
  writeFileSync(join(b2, '.claude', 'settings.json'), '{}\n');
  writeFileSync(join(i1, '.mcp.json'), '{ "mcpServers": {} }\n');
}
