import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// A one-pixel GIF in a lesson's folder.
export default function generate(root) {
  mkdirSync(join(root, 'assets', 'lessons', 'b-1'), { recursive: true });
  writeFileSync(join(root, 'assets', 'lessons', 'b-1', 'demo.gif'), Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
}
