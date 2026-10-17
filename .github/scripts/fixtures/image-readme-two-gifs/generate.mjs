import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Two one-pixel GIFs.
export default function generate(root) {
  mkdirSync(join(root, 'assets', 'readme'), { recursive: true });
  for (const name of ['learn-one.gif', 'learn-two.gif']) writeFileSync(join(root, 'assets', 'readme', name), Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
}
