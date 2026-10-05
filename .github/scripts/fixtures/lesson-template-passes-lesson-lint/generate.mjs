import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

export default function generate(root) {
  const source = readFileSync(join(repo, '.github', 'lesson-template.md'), 'utf8');
  const template = source.match(/^````markdown\n([\s\S]*?)\n````$/m)[1];
  mkdirSync(join(root, 'docs', 'beginner'), { recursive: true });
  writeFileSync(join(root, 'docs', 'beginner', '01-example-lesson.md'), `${template}\n`);
}
