import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default function generate(root) {
  const dir = join(root, 'assets', 'lessons', 'b-4');
  mkdirSync(dir, { recursive: true });
  const rects = '<rect width="1" height="1"/>'.repeat(2200);
  writeFileSync(join(dir, 'context-grid.svg'), `<svg xmlns="http://www.w3.org/2000/svg">${rects}</svg>`);
}
