// Links to other sites still resolve. Weekly and scheduled only: other sites
// throttle and flake, so this opens an issue instead of blocking a pull
// request. A 429 (rate limited) counts as alive.
import { lychee } from './internal-links.mjs';

export const id = 'external-links';
export const modes = ['scheduled'];

export function run(ctx) {
  return lychee(ctx, ['--accept', '100..=103,200..=299,429', '--max-concurrency', '8', '--max-retries', '2']);
}
