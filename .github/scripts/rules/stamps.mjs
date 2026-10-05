// Every page in the stamped set carries a well-formed Stamp, and README's
// trust strip, once it exists, names the latest edition's verified version.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readText } from '../lib/tree.mjs';
import { editions, isStamped, readStamp } from '../lib/stamps.mjs';

export const id = 'stamps';
export const modes = ['pr', 'release'];

const TRUST_STRIP = /Verified against Claude Code v(\d+\.\d+\.\d+) \(stable\)/;

export function run(ctx) {
  const problems = [];
  const pages = ctx.files.filter(isStamped);
  for (const page of pages) {
    const stamp = readStamp(readText(ctx.root, page));
    if (stamp.error) problems.push(`${page}: ${stamp.error}`);
  }

  let strip = 'README has no trust strip yet, so the strip check is skipped';
  const readme = existsSync(join(ctx.root, 'README.md')) ? readText(ctx.root, 'README.md') : '';
  const m = readme.match(TRUST_STRIP);
  if (m) {
    const changelog = existsSync(join(ctx.root, 'CHANGELOG.md')) ? readText(ctx.root, 'CHANGELOG.md') : '';
    const latest = editions(changelog).find((e) => !e.correction);
    if (!latest) problems.push(`README.md: the trust strip says v${m[1]}, but CHANGELOG.md has no edition entry`);
    else if (latest.version !== m[1]) problems.push(`README.md: the trust strip says v${m[1]}, but the latest edition, ${latest.tag}, was verified against v${latest.version}`);
    strip = `trust strip matches v${m[1]}`;
  }

  if (problems.length) return { status: 'fail', problems };
  return { status: 'pass', summary: `${pages.length} stamped pages; ${strip}` };
}
