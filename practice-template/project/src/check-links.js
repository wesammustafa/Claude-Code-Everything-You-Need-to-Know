import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { findLinks, isExternal } from './links.js';

function markdownFiles(root, entry) {
  const path = join(root, entry);
  if (!existsSync(path)) return [];
  if (statSync(path).isFile()) return path.endsWith('.md') ? [path] : [];
  return readdirSync(path)
    .filter((name) => !name.startsWith('.') && name !== 'node_modules')
    .flatMap((name) => markdownFiles(root, join(entry, name)));
}

// Returns every relative link whose target file does not exist.
export function brokenLinks(root, config) {
  const broken = [];
  const files = [...new Set(config.files.flatMap((entry) => markdownFiles(root, entry)))].sort();
  for (const file of files) {
    for (const link of findLinks(readFileSync(file, 'utf8'))) {
      const target = link.target.split('#')[0];
      if (!target || isExternal(link.target)) continue;
      if (config.ignore.some((prefix) => link.target.startsWith(prefix))) continue;
      if (!existsSync(join(dirname(file), decodeURIComponent(target)))) {
        broken.push({ file: relative(root, file), line: link.line, target: link.target });
      }
    }
  }
  return broken;
}
