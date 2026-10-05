// The fragment ids GitHub gives a Markdown page: heading slugs plus explicit
// <a id> and <a name> anchors. Headings follow GitHub's rule: the heading's
// text, lowercased, with everything except letters, marks, digits,
// underscores, hyphens and spaces removed, and spaces turned into hyphens.
// A repeated slug gets -1, -2, ...

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
const ANCHOR = /<a\s[^>]*?\b(?:id|name)\s*=\s*["']([^"']+)["']/gi;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function headingText(raw) {
  let t = raw;
  t = t.replace(/`+([^`]*?)`+/g, (_, code) => code.replace(/[*_~\\]/g, (c) => `\u0000${c}`));
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  t = t.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1');
  t = t.replace(/<(https?:[^>]+)>/g, '$1');
  t = t.replace(/<[^>]+>/g, '');
  t = t.replace(/(\*\*|__|\*|_|~~)(?=\S)([^]*?\S)\1/g, '$2');
  t = t.replace(/\\([!-/:-@[-`{-~])/g, '$1');
  t = t.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
  return t.replace(/\u0000/g, '');
}

export function slug(text) {
  return headingText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{Nd}\p{Pc}\- ]/gu, '')
    .replace(/ /g, '-');
}

// Every id on the page, in document order. Heading slugs come first in their
// own line; explicit anchors are listed where they appear.
// The lines outside fenced code blocks, each with its 1-based number. A fence
// closes only on a line of the same character, at least as long, as
// CommonMark has it, so a ``` line inside a ~~~ block stays code.
export function outsideFences(markdown) {
  const out = [];
  let fence = null;
  markdown.split(/\r?\n/).forEach((line, i) => {
    const f = line.match(FENCE);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && /^\s*[`~]+\s*$/.test(line)) fence = null;
      return;
    }
    if (f) { fence = f[1]; return; }
    out.push({ n: i + 1, line });
  });
  return out;
}

export function pageIds(markdown) {
  const ids = [];
  const seen = new Map();
  const addHeading = (text) => {
    const base = slug(text);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    ids.push(n === 0 ? base : `${base}-${n}`);
  };
  let fence = null;
  let paragraph = null;
  for (const line of markdown.split(/\r?\n/)) {
    const f = line.match(FENCE);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && /^\s*[`~]+\s*$/.test(line)) fence = null;
      continue;
    }
    if (f) { fence = f[1]; paragraph = null; continue; }
    for (const m of line.matchAll(ANCHOR)) ids.push(m[1]);
    const atx = line.match(ATX);
    if (atx) { addHeading(atx[2] ?? ''); paragraph = null; continue; }
    if (paragraph !== null && SETEXT.test(line)) { addHeading(paragraph); paragraph = null; continue; }
    const plain = line.trim() !== ''
      && !/^ {0,3}([-*+]|\d+[.)])\s/.test(line)
      && !/^ {0,3}[>|<]/.test(line)
      && !/^ {4}/.test(line);
    paragraph = plain ? (paragraph === null ? line.trim() : `${paragraph} ${line.trim()}`) : null;
  }
  return ids;
}
