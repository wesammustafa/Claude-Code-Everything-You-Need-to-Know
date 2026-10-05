// The files a check looks at, and the folders every check leaves out.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// The private scratch folder and the checks' own fixtures are never checked
// as part of the guide.
export const EXCLUDED = ['.git/', '.scratch/', '.github/scripts/fixtures/', 'node_modules/'];

export function isExcluded(path) {
  return EXCLUDED.some((prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix));
}

function walk(root, dir = root, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(root, full).split(sep).join('/');
    if (isExcluded(rel) || isExcluded(`${rel}/`)) continue;
    if (statSync(full).isDirectory()) walk(root, full, out);
    else out.push(rel);
  }
  return out;
}

export function listFiles(root) {
  if (existsSync(join(root, '.git'))) {
    const out = execFileSync(
      'git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    return out.split('\0').filter((f) => f && !isExcluded(f) && existsSync(join(root, f))).sort();
  }
  return walk(root).sort();
}

export function readText(root, path) {
  return readFileSync(join(root, path), 'utf8');
}
