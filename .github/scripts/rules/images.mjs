// Images and diagrams stay accessible and the assets/ tree stays tidy:
// - every Markdown image and <img> has alt text;
// - every Mermaid block declares accTitle and accDescr;
// - files under assets/ have kebab-case names, an allowed type, fit the size
//   budget, and are referenced by a page (the brand sources, the social card
//   and its rig-rendered Pip are the only allowed orphans);
// - the only animation is README's Pip GIFs: assets/readme/pip-*.gif, each
//   shown by README alone and within PIP_GIF_BUDGET, so a PNG or WebP that is
//   animated (APNG, animated WebP) fails too;
// - a capture named for a theme (-light or -dark) comes as a pair.
import { readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { readText } from '../lib/tree.mjs';

export const id = 'images';
export const modes = ['pr', 'release'];

const KB = 1024;
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+)*$/;
// README's Pip GIFs, captured from the app.
const PIP_GIF = /^assets\/readme\/pip-[^/]+\.gif$/;
// The largest measured Pip GIF plus about 15%, set with CONTRIBUTING's image rules.
const PIP_GIF_BUDGET = 900 * KB;
const isPipGif = (asset) => PIP_GIF.test(asset);
const THEMED = /^(assets\/(?:lessons|readme)\/.+)-(light|dark)\.(png|jpe?g|webp)$/;
const BUDGET = [
  [/\.svg$/, 50 * KB, 'an SVG may be up to 50 KB'],
  [/^assets\/(lessons|readme)\/.+\.(png|jpe?g|webp)$/, 200 * KB, 'a capture may be up to 200 KB'],
  [/^assets\/brand\/social-card(?:-pip)?\.png$/, 1000 * KB, 'the social card and its Pip must each be under 1 MB'],
  [{ test: isPipGif }, PIP_GIF_BUDGET, `a Pip GIF may be up to ${PIP_GIF_BUDGET / KB} KB`],
];
const ALLOWED_ORPHANS = [/^assets\/brand\/[^/]+\.svg$/, /^assets\/brand\/social-card(?:-pip)?\.png$/];

// An APNG declares its animation in an acTL chunk before the first IDAT.
function isAnimatedPng(buf) {
  const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) return false;
  // Each chunk: 4-byte big-endian length, 4-byte type, data, 4-byte CRC.
  for (let at = 8; at + 8 <= buf.length; ) {
    const length = buf.readUInt32BE(at);
    const type = buf.toString('latin1', at + 4, at + 8);
    if (type === 'acTL') return true;
    if (type === 'IDAT' || type === 'IEND') return false;
    at += 12 + length;
  }
  return false;
}

// An animated WebP sets the animation flag in its VP8X chunk and carries ANIM
// and ANMF chunks.
function isAnimatedWebp(buf) {
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return false;
  const end = Math.min(buf.length, 8 + buf.readUInt32LE(4));
  // Each chunk: 4-byte FourCC, 4-byte little-endian size, data padded to even.
  for (let at = 12; at + 8 <= end; ) {
    const type = buf.toString('latin1', at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    if (type === 'VP8X' && at + 8 < end && buf[at + 8] & 0x02) return true;
    if (type === 'ANIM' || type === 'ANMF') return true;
    at += 8 + size + (size & 1);
  }
  return false;
}

function isAnimated(root, asset) {
  if (/\.png$/.test(asset)) return isAnimatedPng(readFileSync(join(root, asset)));
  if (/\.webp$/.test(asset)) return isAnimatedWebp(readFileSync(join(root, asset)));
  return false;
}

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
  // Pages that show each GIF: README alone may.
  const gifPages = new Map();
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
        if (!path) continue;
        referenced.add(path);
        if (path.endsWith('.gif') && page !== 'README.md') gifPages.set(path, `${at}`);
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
    if (!/\.(svg|png|jpe?g|webp)$/.test(asset) && !isPipGif(asset)) problems.push(`${asset}: only SVG, PNG, JPEG and WebP files belong under assets/; the only animation is README's Pip GIFs, assets/readme/pip-*.gif`);
    if (isAnimated(ctx.root, asset)) problems.push(`${asset}: an animated image; the only animation is README's Pip GIFs, assets/readme/pip-*.gif`);
    const size = statSync(join(ctx.root, asset)).size;
    for (const [pattern, limit, rule] of BUDGET) {
      if (pattern.test(asset) && size > limit) problems.push(`${asset}: ${Math.ceil(size / KB)} KB; ${rule}`);
    }
    if (!referenced.has(asset) && !ALLOWED_ORPHANS.some((p) => p.test(asset))) {
      problems.push(`${asset}: no page references it; delete it or use it`);
    }
  }

  for (const [gif, at] of gifPages) problems.push(`${at}: shows ${gif}; only README shows the Pip GIFs`);

  const present = new Set(assets);
  for (const asset of assets) {
    const m = asset.match(THEMED);
    if (!m) continue;
    const other = m[2] === 'light' ? 'dark' : 'light';
    if (![...present].some((a) => a.startsWith(`${m[1]}-${other}.`))) problems.push(`${asset}: a ${m[2]} capture needs its ${other} pair beside it`);
  }

  if (problems.length) return { status: 'fail', problems };
  return { status: 'pass', summary: `${pages.length} pages, ${assets.length} files under assets/` };
}
