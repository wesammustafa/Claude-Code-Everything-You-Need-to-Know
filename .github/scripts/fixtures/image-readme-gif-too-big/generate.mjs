import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// A GIF just over the budget.
export default function generate(root) {
  mkdirSync(join(root, 'assets', 'readme'), { recursive: true });
  writeFileSync(join(root, 'assets', 'readme', 'learn-big.gif'), Buffer.concat([Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"), Buffer.alloc(1001 * 1024)]));
}
