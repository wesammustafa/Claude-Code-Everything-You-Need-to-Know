// Flags a new `stable` Claude Code release after the frozen baseline in the
// CHANGELOG's Unreleased entry, and lists the releases up to `latest`, which
// the taught native install runs, so the owner can sort each change into a
// baseline move or a version note. Weekly and scheduled only.
// CHECKS_STABLE_VERSION and CHECKS_LATEST_VERSION override the npm lookup;
// CHECKS_CLAUDE_CHANGELOG, a path under the root, overrides the CHANGELOG fetch.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readText } from '../lib/tree.mjs';
import { compareVersions } from '../lib/stamps.mjs';

export const id = 'drift';
export const modes = ['scheduled'];

const DIST_TAGS = 'https://registry.npmjs.org/-/package/@anthropic-ai/claude-code/dist-tags';
const CHANGELOG_RAW = 'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md';
const CHANGELOG_PAGE = 'https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md';

// `stable` and `latest` from one dist-tags fetch. A missing or older `latest`
// counts as `stable`, as does a stable override without a latest one.
async function distTags() {
  let { CHECKS_STABLE_VERSION: stable, CHECKS_LATEST_VERSION: latest } = process.env;
  if (!stable) {
    const res = await fetch(DIST_TAGS, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`npm dist-tags returned ${res.status}`);
    const tags = await res.json();
    stable = tags.stable;
    latest ||= tags.latest;
  }
  if (!latest || compareVersions(latest, stable) < 0) latest = stable;
  return { stable, latest };
}

async function claudeChangelog(root) {
  if (process.env.CHECKS_CLAUDE_CHANGELOG) return readText(root, process.env.CHECKS_CLAUDE_CHANGELOG);
  if (process.env.CHECKS_STABLE_VERSION || process.env.CHECKS_LATEST_VERSION) return '';
  try {
    const res = await fetch(CHANGELOG_RAW, { signal: AbortSignal.timeout(20_000) });
    return res.ok ? await res.text() : '';
  } catch {
    return '';
  }
}

// The official CHANGELOG's version headings between two versions, newest first.
async function releasesBetween(root, from, to) {
  return [...(await claudeChangelog(root)).matchAll(/^## (\d+\.\d+\.\d+)\b/gm)]
    .map((m) => m[1])
    .filter((v) => compareVersions(v, from) > 0 && compareVersions(v, to) <= 0);
}

export async function run(ctx) {
  const changelog = existsSync(join(ctx.root, 'CHANGELOG.md')) ? readText(ctx.root, 'CHANGELOG.md') : '';
  const m = changelog.match(/^Baseline: Claude Code v(\d+\.\d+\.\d+) \(stable\)/m);
  if (!m) return { status: 'fail', problems: ['CHANGELOG.md has no "Baseline: Claude Code vX.Y.Z (stable)" line'] };
  const baseline = m[1];
  const { stable, latest } = await distTags();
  if (compareVersions(stable, baseline) <= 0) {
    return { status: 'pass', summary: `stable is v${stable} and latest v${latest}; the baseline is v${baseline}` };
  }
  const releases = (await releasesBetween(ctx.root, baseline, latest))
    .map((v) => (compareVersions(v, stable) <= 0 ? `${v} (stable)` : v));
  return {
    status: 'fail',
    problems: [
      `stable is now v${stable} and latest v${latest}; the baseline is v${baseline}`,
      `Read the Claude Code CHANGELOG (${CHANGELOG_PAGE}) from v${baseline} to v${latest}${releases.length ? `: ${releases.join(', ')}` : ''}. A stable change that removes, renames or changes the default of something a lesson teaches moves the baseline, as its own pull request. Any other change to what a step, Check message or Go further line asks a Learner to type, press or see gets a version note (CONTRIBUTING.md#version-notes).`,
      `With Claude Code v${latest} installed, \`npm run proof -- --any-claude\` notes any option \`claude --help\` lists that the Checks don't know.`,
    ],
  };
}
