import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

export default function generate(root) {
  const source = readFileSync(join(repo, '.claude', 'workflows', 'stale-docs-audit.js'), 'utf8');
  const dir = join(root, '.claude', 'workflows');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'stale-docs-audit.js'), `${source}\nconst broken = {;\n`);
}
