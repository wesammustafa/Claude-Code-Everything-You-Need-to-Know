import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default function generate(root) {
  const dir = join(root, 'examples', 'intermediate', '01-first-skill', '.claude', 'skills', 'five-whys');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), '---\ndescription: Ask why five times\n---\n\nAsk why five times.\n');
}
