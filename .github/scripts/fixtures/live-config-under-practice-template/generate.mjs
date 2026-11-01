import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default function generate(root) {
  const template = join(root, 'practice-template');
  mkdirSync(join(template, 'starter', '.claude'), { recursive: true });
  writeFileSync(join(template, 'CLAUDE.md'), '# Practice project\n');
  writeFileSync(join(template, 'starter', '.claude', 'settings.json'), '{}\n');
  writeFileSync(join(template, '.mcp.json'), '{ "mcpServers": {} }\n');
}
