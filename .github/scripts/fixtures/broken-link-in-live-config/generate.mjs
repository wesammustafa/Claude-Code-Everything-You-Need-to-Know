import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default function generate(root) {
  const dir = join(root, '.claude', 'skills', 'review');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'SKILL.md'),
    '---\ndescription: Review a page\n---\n\nFollow [the style guide](../../../STYLE.md).\n',
  );
}
