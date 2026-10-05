// Added prose lines carry no em dash (U+2014). Text in backticks, in code
// blocks or in double quotes is exempt, and so is a line that carries the
// marker <!-- allow-em-dash -->. Lines a change does not touch are not checked.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readText } from '../lib/tree.mjs';
import { addedLines } from '../lib/git.mjs';

export const id = 'em-dash';
export const modes = ['pr'];

const PROSE = /\.(md|ya?ml|txt)$/;
const ALLOW = '<!-- allow-em-dash -->';

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
    if (!PROSE.test(path) || !existsSync(join(ctx.root, path))) continue;
    const text = readText(ctx.root, path);
    const code = path.endsWith('.md') ? codeLines(text) : new Set();
    text.split(/\r?\n/).forEach((raw, i) => {
      const n = i + 1;
      if (lines !== 'all' && !lines.has(n)) return;
      checked += 1;
      if (code.has(n) || raw.includes(ALLOW)) return;
      const prose = raw.replace(/(`+)[^`]*?\1/g, '').replace(/"[^"]*"|“[^”]*”/g, '');
      if (prose.includes('—')) problems.push(`${path}:${n}: use a comma, colon, parentheses or a new sentence instead of the em dash`);
    });
  }
  if (problems.length) return { status: 'fail', problems };
  return { status: 'pass', summary: `${checked} added lines against ${ctx.base.ref ?? ctx.base.sha.slice(0, 7)}` };
}
