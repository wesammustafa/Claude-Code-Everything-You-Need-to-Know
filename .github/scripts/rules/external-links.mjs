// Links to other sites still resolve. Weekly and scheduled only: other sites
// throttle and flake, so this opens an issue instead of blocking a pull
// request. A 429 (rate limited) counts as alive. npm's website often answers
// automated requests, CI runners included, with a 403 bot challenge, so its
// pages are skipped; the drift rule reads the package from npm's registry.
import { lychee } from './internal-links.mjs';

export const id = 'external-links';
export const modes = ['scheduled'];

export function run(ctx) {
  return lychee(ctx, ['--accept', '100..=103,200..=299,429', '--exclude', '^https://www\\.npmjs\\.com/', '--max-concurrency', '8', '--max-retries', '2']);
}
