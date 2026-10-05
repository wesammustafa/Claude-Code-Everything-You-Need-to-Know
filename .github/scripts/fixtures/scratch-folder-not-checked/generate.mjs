// Generated rather than committed: the maintainer's clone ignores every
// .scratch/ folder, so a plain `git add` would leave a copy out of the index.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default function generate(root) {
  mkdirSync(join(root, '.scratch'), { recursive: true });
  writeFileSync(join(root, '.scratch', 'notes.md'), '# Notes\n\nA [draft link](missing.md#nowhere).\n');
}
