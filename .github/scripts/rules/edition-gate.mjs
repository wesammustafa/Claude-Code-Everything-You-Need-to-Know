// On a release tag, the stamped pages match the release.
// - Edition tag vYYYY.MM: every stamped page's Stamp names the version that
//   the tag's CHANGELOG entry was verified against.
// - Correction tag vYYYY.MM.N: every stamped page changed since the previous
//   tag carries a Stamp dated after that tag's CHANGELOG entry.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readText } from '../lib/tree.mjs';
import { changedBetween, previousTag } from '../lib/git.mjs';
import { editions, isStamped, readStamp } from '../lib/stamps.mjs';

export const id = 'edition-gate';
export const modes = ['release'];

export function run(ctx) {
  const fail = (...problems) => ({ status: 'fail', problems });
  if (!ctx.tag) return fail('release mode needs --tag');
  const shape = ctx.tag.match(/^v\d{4}\.\d{2}(\.\d+)?$/);
  if (!shape) return fail(`${ctx.tag} is neither an edition tag (vYYYY.MM) nor a correction tag (vYYYY.MM.N)`);
  const entries = editions(existsSync(join(ctx.root, 'CHANGELOG.md')) ? readText(ctx.root, 'CHANGELOG.md') : '');
  const entry = entries.find((e) => e.tag === ctx.tag);
  if (!entry) return fail(`CHANGELOG.md has no "## ${ctx.tag} - YYYY-MM-DD" entry`);

  const problems = [];
  if (!shape[1]) {
    if (!entry.version) return fail(`CHANGELOG.md's ${ctx.tag} entry has no "Verified against Claude Code vX.Y.Z (stable)" line`);
    const pages = ctx.files.filter(isStamped);
    for (const page of pages) {
      const stamp = readStamp(readText(ctx.root, page));
      if (stamp.error) problems.push(`${page}: ${stamp.error}`);
      else if (stamp.version !== entry.version) problems.push(`${page}: stamped v${stamp.version}, but edition ${ctx.tag} is verified against v${entry.version}; re-verify and re-stamp it`);
    }
    return problems.length ? fail(...problems) : { status: 'pass', summary: `${pages.length} stamped pages carry v${entry.version}` };
  }

  const prev = previousTag(ctx.root, ctx.tag);
  if (!prev) return fail(`no release tag before ${ctx.tag} to compare against`);
  const prevEntry = entries.find((e) => e.tag === prev);
  if (!prevEntry) return fail(`CHANGELOG.md has no entry for the previous tag, ${prev}`);
  const changed = changedBetween(ctx.root, prev, ctx.tag).filter((p) => isStamped(p) && existsSync(join(ctx.root, p)));
  for (const page of changed) {
    const stamp = readStamp(readText(ctx.root, page));
    if (stamp.error) problems.push(`${page}: ${stamp.error}`);
    else if (!(stamp.date > prevEntry.date)) problems.push(`${page}: changed since ${prev} but its Stamp (${stamp.date}) is not dated after ${prev} (${prevEntry.date}); re-verify and re-stamp it`);
  }
  return problems.length ? fail(...problems) : { status: 'pass', summary: `${changed.length} stamped pages changed since ${prev}, all re-stamped` };
}
