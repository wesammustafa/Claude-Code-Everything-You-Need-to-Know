import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Rewrites the lesson file with Windows line endings, as a checkout with
// core.autocrlf would, so the rule must still find the reworded quote.
export default function generate(root) {
  const path = join(root, 'practice', 'b-1.md');
  writeFileSync(path, readFileSync(path, 'utf8').replace(/\r?\n/g, '\r\n'));
}
