// The Stamp, the stamped set and the CHANGELOG's edition entries.

// `Verified against Claude Code vX.Y.Z (stable) on YYYY-MM-DD`
export const STAMP = /Verified against Claude Code v(\d+)\.(\d+)\.(\d+) \(stable\) on (\d{4}-\d{2}-\d{2})/;

// Pages from before the rework that are not yet split. They carry a
// "From the previous edition, not yet re-verified" note instead of a Stamp.
export const PRE_REWORK = [
  'docs/reference/faq.md',
];

// Pages exempt until a pull request rewrites them.
export const AWAITING_REWRITE = [];

// Stub pages inside the stamped folders.
export const STUBS = [
  'docs/reference/changelog.md',
  'docs/reference/effort-levels.md',
];

const STAMPED = /^docs\/(beginner|intermediate|advanced)\/.+\.md$|^docs\/topics\/[^/]+\.md$|^docs\/reference\/[^/]+\.md$/;

export function isStamped(path) {
  if (!STAMPED.test(path)) return false;
  return ![...PRE_REWORK, ...AWAITING_REWRITE, ...STUBS].includes(path);
}

export function today() {
  return process.env.CHECKS_TODAY ?? new Date().toISOString().slice(0, 10);
}

export function isRealDate(date) {
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

export function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

// The line under the H1, where a page's Stamp lives.
export function headerLine(markdown) {
  const lines = markdown.split(/\r?\n/);
  const h1 = lines.findIndex((l) => /^# \S/.test(l));
  if (h1 === -1) return null;
  return lines.slice(h1 + 1).find((l) => l.trim() !== '') ?? '';
}

// Parses a page's Stamp: { version, date } or { error }.
export function readStamp(markdown) {
  const line = headerLine(markdown);
  if (line === null) return { error: 'no H1, so no header line to hold the Stamp' };
  const m = line.match(STAMP);
  if (!m) {
    return /Verified against/i.test(line)
      ? { error: `malformed Stamp in the header line; expected "Verified against Claude Code vX.Y.Z (stable) on YYYY-MM-DD": ${line.trim()}` }
      : { error: 'no Stamp in the line under the H1' };
  }
  const [, major, minor, patch, date] = m;
  if (!isRealDate(date)) return { error: `Stamp date ${date} is not a real date` };
  if (date > today()) return { error: `Stamp date ${date} is in the future` };
  return { version: `${major}.${minor}.${patch}`, date };
}

// Edition entries in CHANGELOG.md, newest first:
//   ## vYYYY.MM - YYYY-MM-DD           (an edition)
//   ## vYYYY.MM.N - YYYY-MM-DD         (a correction)
// followed by a line "Verified against Claude Code vX.Y.Z (stable)."
export function editions(changelog) {
  const out = [];
  let current = null;
  for (const line of (changelog ?? '').split(/\r?\n/)) {
    const h = line.match(/^## (v\d{4}\.\d{2}(?:\.\d+)?) - (\d{4}-\d{2}-\d{2})\s*$/);
    if (h) {
      current = { tag: h[1], date: h[2], correction: /\.\d+\.\d+$/.test(h[1]), version: null };
      out.push(current);
    } else if (/^## /.test(line)) {
      current = null;
    } else if (current && !current.version) {
      const v = line.match(/Verified against Claude Code v(\d+\.\d+\.\d+) \(stable\)/);
      if (v) current.version = v[1];
    }
  }
  return out;
}
