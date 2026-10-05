// No change may drop an anchor that inbound links can rely on: every id in the
// committed baseline list, and every id on the base in README.md and docs/
// (except previous-edition pages under docs/legacy/), must still exist at
// head, as a heading slug or an <a id>.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pageIds } from '../lib/markdown.mjs';
import { filesAt, readAt } from '../lib/git.mjs';
import { readText } from '../lib/tree.mjs';

export const id = 'anchor-diff';
export const modes = ['pr', 'release'];

export const ANCHORS_FILE = '.github/compat/anchors.txt';

const covered = (path) =>
  (path === 'README.md' || (path.startsWith('docs/') && !path.startsWith('docs/legacy/'))) && path.endsWith('.md');

export function run(ctx) {
  const required = new Map(); // page -> Set of ids
  const need = (page, anchor) => {
    if (!required.has(page)) required.set(page, new Set());
    required.get(page).add(anchor);
  };

  if (existsSync(join(ctx.root, ANCHORS_FILE))) {
    for (const line of readText(ctx.root, ANCHORS_FILE).split('\n')) {
      if (!line.trim() || line.startsWith('#')) continue;
      const at = line.indexOf('#');
      need(line.slice(0, at), line.slice(at + 1));
    }
  }
  if (ctx.base.sha) {
    for (const page of filesAt(ctx.root, ctx.base.sha).filter(covered)) {
      for (const anchor of pageIds(readAt(ctx.root, ctx.base.sha, page))) need(page, anchor);
    }
  }
  if (required.size === 0) {
    return { status: 'skip', summary: `no ${ANCHORS_FILE} and ${ctx.base.note ?? 'no base'}` };
  }

  const problems = [];
  let count = 0;
  for (const [page, anchors] of [...required].sort()) {
    count += anchors.size;
    const present = existsSync(join(ctx.root, page)) ? new Set(pageIds(readText(ctx.root, page))) : null;
    const missing = [...anchors].filter((a) => !present?.has(a)).sort();
    if (missing.length === 0) continue;
    problems.push(present
      ? `${page}: ${missing.length} anchor(s) gone; keep each as <a id="..."></a> above its new heading: ${missing.join(', ')}`
      : `${page}: page removed, taking ${missing.length} anchor(s); leave a Stub with them: ${missing.join(', ')}`);
  }
  const against = ctx.base.sha ? `the baseline list and ${ctx.base.ref ?? ctx.base.sha.slice(0, 7)}` : `the baseline list only (${ctx.base.note})`;
  if (problems.length) return { status: 'fail', problems };
  return { status: 'pass', summary: `${count} anchors on ${required.size} pages, against ${against}` };
}
