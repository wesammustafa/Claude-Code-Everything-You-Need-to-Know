// Expiry markers, <!-- expires: YYYY-MM-DD -->, flag a dated fact before it
// goes stale. On pull requests a marker due within 30 days, or past due, only
// warns. The daily scheduled run fails on a past-due marker, which opens or
// updates the tracking issue.
import { readText } from '../lib/tree.mjs';
import { outsideFences } from '../lib/markdown.mjs';
import { isRealDate, today } from '../lib/stamps.mjs';

export const id = 'expiry';
export const modes = ['pr', 'scheduled'];

const MARKER = /<!--\s*expires:\s*(\S+?)\s*-->/g;
const WINDOW_DAYS = 30;

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function run(ctx) {
  const now = today();
  const soon = addDays(now, WINDOW_DAYS);
  const due = [];
  const pastDue = [];
  const malformed = [];
  let count = 0;
  for (const page of ctx.files.filter((f) => f.endsWith('.md'))) {
    // A marker shown in code is an example of the syntax, not a marker.
    for (const { n, line } of outsideFences(readText(ctx.root, page))) {
      for (const m of line.replace(/`[^`]*`/g, '').matchAll(MARKER)) {
        count += 1;
        const where = `${page}:${n}`;
        if (!isRealDate(m[1])) malformed.push(`${where}: "${m[1]}" is not a YYYY-MM-DD date`);
        else if (m[1] < now) pastDue.push(`${where}: expired on ${m[1]}; re-verify the fact and update or remove the marker`);
        else if (m[1] <= soon) due.push(`${where}: expires on ${m[1]}, within ${WINDOW_DAYS} days`);
      }
    }
  }
  if (malformed.length) return { status: 'fail', problems: malformed };
  if (ctx.mode === 'scheduled' && pastDue.length) return { status: 'fail', problems: pastDue };
  if (pastDue.length || due.length) return { status: 'warn', problems: [...pastDue, ...due] };
  return { status: 'pass', summary: `${count} expiry markers, none due within ${WINDOW_DAYS} days` };
}
