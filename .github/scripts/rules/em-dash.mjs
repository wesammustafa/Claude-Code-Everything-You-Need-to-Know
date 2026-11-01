// Added lines carry no em dash (U+2014): in Markdown, YAML and text files
// anywhere, and in the quest/ source (TypeScript, TSX, CSS, JSON, HTML), whose
// strings are the app's own wording. In prose files, text in backticks, in
// code blocks or in double quotes is exempt, and so is a line that carries the
// marker <!-- allow-em-dash -->. The quest/ source exempts no string, quoted or
// not (Prettier double-quotes them all, so an exemption for quotes would
// exempt every word the app shows): only a line whose comment carries the
// marker (// allow-em-dash, /* allow-em-dash */ or <!-- allow-em-dash -->).
// An em dash counts however it is written: as the character, as an HTML
// entity (&mdash;, &#8212;, &#x2014;), which Markdown and JSX render too, and
// in the source also as an escape (\u2014, \u{2014}, or CSS's \2014).
// Lines a change does not touch are not checked.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readText } from '../lib/tree.mjs';
import { addedLines } from '../lib/git.mjs';

export const id = 'em-dash';
export const modes = ['pr'];

const PROSE = /\.(md|ya?ml|txt)$/;
const QUEST_SOURCE = /^quest\/.*\.(tsx?|css|json|html)$/;
const ALLOW = '<!-- allow-em-dash -->';
const SOURCE_ALLOW = /(?:\/\/|\/\*|<!--)\s*allow-em-dash\b/;
const FIX = 'use a comma, colon, parentheses or a new sentence instead of the em dash';
// The character or an HTML entity for it, which prose and JSX text render.
const PROSE_DASH = /\u2014|&mdash;|&#0*8212;|&#x0*2014;/i;
// Those, and the escapes a string or a stylesheet turns into one.
const SOURCE_DASH = /\u2014|&mdash;|&#0*8212;|&#x0*2014;|\\u2014|\\u\{0*2014\}|\\0*2014(?![0-9a-f])/i;

function codeLines(text) {
  const inCode = new Set();
  let fence = null;
  text.split(/\r?\n/).forEach((line, i) => {
    const f = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      inCode.add(i + 1);
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
    } else if (f) {
      fence = f[1];
      inCode.add(i + 1);
    }
  });
  return inCode;
}

export function run(ctx) {
  if (!ctx.base.sha) return { status: 'skip', summary: `diff-scoped: ${ctx.base.note}` };
  const problems = [];
  let checked = 0;
  for (const [path, lines] of addedLines(ctx.root, ctx.base.sha)) {
    if (!(PROSE.test(path) || QUEST_SOURCE.test(path)) || !existsSync(join(ctx.root, path))) continue;
    const text = readText(ctx.root, path);
    const source = QUEST_SOURCE.test(path);
    const code = path.endsWith('.md') ? codeLines(text) : new Set();
    text.split(/\r?\n/).forEach((raw, i) => {
      const n = i + 1;
      if (lines !== 'all' && !lines.has(n)) return;
      checked += 1;
      if (source) {
        if (SOURCE_DASH.test(raw) && !SOURCE_ALLOW.test(raw)) problems.push(`${path}:${n}: ${FIX}, in strings too`);
        return;
      }
      if (code.has(n) || raw.includes(ALLOW)) return;
      const prose = raw.replace(/(`+)[^`]*?\1/g, '').replace(/"[^"]*"|“[^”]*”/g, '');
      if (PROSE_DASH.test(prose)) problems.push(`${path}:${n}: ${FIX}`);
    });
  }
  if (problems.length) return { status: 'fail', problems };
  return { status: 'pass', summary: `${checked} added lines against ${ctx.base.ref ?? ctx.base.sha.slice(0, 7)}` };
}
