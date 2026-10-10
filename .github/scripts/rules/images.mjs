// Images and diagrams stay accessible and the assets/ tree stays tidy:
// - every Markdown image and <img> has alt text;
// - every Mermaid block declares accTitle and accDescr;
// - files under assets/ have kebab-case names, an allowed type, fit the size
//   budget, and are referenced by a page (the brand sources and the social
//   card are the only allowed orphans).
import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { readText } from '../lib/tree.mjs';

export const id = 'images';
export const modes = ['pr', 'release'];

const KB = 1024;
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+)*$/;
const BUDGET = [
  [/\.svg$/, 50 * KB, 'an SVG may be up to 50 KB'],
  [/^assets\/(lessons|readme)\/.+\.(png|jpe?g|webp)$/, 200 * KB, 'a capture may be up to 200 KB'],
  [/^assets\/brand\/social-card\.png$/, 1000 * KB, 'the social card must be under 1 MB'],
];
const ALLOWED_ORPHANS = [/^assets\/brand\/[^/]+\.svg$/, /^assets\/brand\/social-card\.png$/];

// Each line of a page with its code stripped: fenced blocks become null,
// inline code spans are removed. Mermaid blocks are returned separately.
function scan(text) {
  const lines = [];
  const mermaid = [];
  let fence = null;
  text.split(/\r?\n/).forEach((line, i) => {
    const f = line.match(/^ {0,3}(`{3,}|~{3,})\s*(\S*)/);
    if (fence) {
      if (f && f[1][0] === fence.marker[0] && f[1].length >= fence.marker.length && !f[2]) {
        if (fence.mermaid) mermaid.push(fence);
        fence = null;
      } else {
        fence.body.push(line);
      }
      lines.push(null);
    } else if (f) {
      fence = { marker: f[1], mermaid: f[2].toLowerCase() === 'mermaid', start: i + 1, body: [] };
      lines.push(null);
    } else {
      lines.push(line.replace(/(`+)[^`]*?\1/g, ''));
    }
  });
  return { lines, mermaid };
}

function targets(line) {
  const out = [];
  for (const m of line.matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) out.push(m[1]);
  for (const m of line.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) out.push(m[1]);
  for (const m of line.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
    for (const part of m[1].split(',')) out.push(part.trim().split(/\s+/)[0]);
  }
  return out;
}

function resolveFrom(page, target) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) return null;
  const clean = decodeURIComponent(target.split(/[?#]/)[0]);
  if (!clean) return null;
  return clean.startsWith('/') ? clean.slice(1) : posix.normalize(posix.join(posix.dirname(page), clean));
}

export function run(ctx) {
  const problems = [];
  const referenced = new Set();
  const pages = ctx.files.filter((f) => f.endsWith('.md'));
  for (const page of pages) {
    const { lines, mermaid } = scan(readText(ctx.root, page));
    lines.forEach((line, i) => {
      if (line === null) return;
      const at = `${page}:${i + 1}`;
      for (const m of line.matchAll(/!\[([^\]]*)\]\(/g)) {
        if (!m[1].trim()) problems.push(`${at}: image has no alt text; say what the reader should learn from it`);
      }
      for (const m of line.matchAll(/<img\b[^>]*>/gi)) {
        const alt = m[0].match(/\balt\s*=\s*["']([^"']*)["']/i);
        if (!alt || !alt[1].trim()) problems.push(`${at}: <img> has no alt text`);
      }
      for (const t of targets(line)) {
        const path = resolveFrom(page, t);
        if (path) referenced.add(path);
      }
    });
    for (const block of mermaid) {
      const body = block.body.join('\n');
      for (const key of ['accTitle', 'accDescr']) {
        if (!new RegExp(`^\\s*${key}\\s*[:{]`, 'm').test(body)) problems.push(`${page}:${block.start}: Mermaid block has no ${key}`);
      }
    }
  }

  const assets = ctx.files.filter((f) => f.startsWith('assets/'));
  for (const asset of assets) {
    const bad = asset.split('/').slice(1).find((part) => !KEBAB.test(part));
    if (bad) problems.push(`${asset}: "${bad}" is not kebab-case`);
    if (!/\.(svg|png|jpe?g|webp)$/.test(asset)) problems.push(`${asset}: only SVG, PNG, JPEG and WebP files belong under assets/`);
    const size = statSync(join(ctx.root, asset)).size;
    for (const [pattern, limit, rule] of BUDGET) {
      if (pattern.test(asset) && size > limit) problems.push(`${asset}: ${Math.ceil(size / KB)} KB; ${rule}`);
    }
    if (!referenced.has(asset) && !ALLOWED_ORPHANS.some((p) => p.test(asset))) {
      problems.push(`${asset}: no page references it; delete it or use it`);
    }
  }

  if (problems.length) return { status: 'fail', problems };
  return { status: 'pass', summary: `${pages.length} pages, ${assets.length} files under assets/` };
}
