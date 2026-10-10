import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// A capture just over the budget, written here rather than committed.
export default function generate(root) {
  mkdirSync(join(root, 'assets', 'readme'), { recursive: true });
  writeFileSync(join(root, 'assets', 'readme', 'learn-too-big.png'), Buffer.alloc(201 * 1024));
}
