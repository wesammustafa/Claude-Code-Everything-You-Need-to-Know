import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// A one-pixel GIF, written here rather than committed.
export default function generate(root) {
  mkdirSync(join(root, 'assets', 'readme'), { recursive: true });
  writeFileSync(join(root, 'assets', 'readme', 'learn-demo.gif'), Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
}
