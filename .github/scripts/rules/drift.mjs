// Flags a new `stable` Claude Code release after the frozen baseline in the
// CHANGELOG's Unreleased entry, so the owner can check it for removals,
// renames or default changes to what the lessons teach. Weekly and scheduled
// only. CHECKS_STABLE_VERSION overrides the npm lookup.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readText } from '../lib/tree.mjs';
import { compareVersions } from '../lib/stamps.mjs';

export const id = 'drift';
export const modes = ['scheduled'];

const DIST_TAGS = 'https://registry.npmjs.org/-/package/@anthropic-ai/claude-code/dist-tags';
const CHANGELOG_RAW = 'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md';
const CHANGELOG_PAGE = 'https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md';

async function stableVersion() {
  if (process.env.CHECKS_STABLE_VERSION) return process.env.CHECKS_STABLE_VERSION;
  const res = await fetch(DIST_TAGS, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`npm dist-tags returned ${res.status}`);
  return (await res.json()).stable;
}

// The official CHANGELOG's version headings between two versions, newest first.
async function releasesBetween(from, to) {
  if (process.env.CHECKS_STABLE_VERSION) return [];
  try {
    const res = await fetch(CHANGELOG_RAW, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return [];
    return [...(await res.text()).matchAll(/^## (\d+\.\d+\.\d+)\b/gm)]
      .map((m) => m[1])
      .filter((v) => compareVersions(v, from) > 0 && compareVersions(v, to) <= 0);
  } catch {
    return [];
  }
}

export async function run(ctx) {
  const changelog = existsSync(join(ctx.root, 'CHANGELOG.md')) ? readText(ctx.root, 'CHANGELOG.md') : '';
  const m = changelog.match(/^Baseline: Claude Code v(\d+\.\d+\.\d+) \(stable\)/m);
  if (!m) return { status: 'fail', problems: ['CHANGELOG.md has no "Baseline: Claude Code vX.Y.Z (stable)" line'] };
  const baseline = m[1];
  const stable = await stableVersion();
  if (compareVersions(stable, baseline) <= 0) return { status: 'pass', summary: `stable is v${stable}; baseline v${baseline}` };
  const releases = await releasesBetween(baseline, stable);
  return {
    status: 'fail',
    problems: [
      `stable is now v${stable}; the baseline is v${baseline}`,
      `Read the Claude Code CHANGELOG (${CHANGELOG_PAGE}) from v${baseline} to v${stable}${releases.length ? ` (${releases.join(', ')})` : ''} for anything that removes, renames or changes the default of something a lesson teaches. Only those changes are pulled in early, each as its own pull request.`,
    ],
  };
}
