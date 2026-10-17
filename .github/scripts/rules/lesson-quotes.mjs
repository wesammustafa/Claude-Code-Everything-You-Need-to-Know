// The practice template's learning app, `npm run learn`, quotes lessons word
// for word, from one lesson file per lesson (learn/lessons/<id>.md in the
// template); .github/compat/learn.txt lists them. In a lesson file, every
// double-quoted `- key: "…"` value is the lesson's own text, except in a
// warm-up block, whose `- from: <lesson>` line points its quotes at that
// earlier lesson's page, or whose `- from: <level>-index` line points them at
// that level's index page, which learn.txt also lists. A fenced code block in
// a lesson file is a block of that page, line for line, less the indent the
// page's fence has, and the lines inside it are code, never quotes or
// headings. This rule fails when such a quote or block, the title, the Stamp
// or a step count no longer matches its lesson, or a block doesn't close. It
// reads each line and the front matter as the app does (learn/lib/content.mjs
// and checks/frontmatter.mjs in the template), so no spacing, quoting or line
// ending the app accepts can hide a quote. It needs the template's lesson
// files: with LEARN_DIR set to a template checkout's learn/lessons folder, any
// mode reads them there; the weekly scheduled run fetches them from the
// template's main branch. A pull request run without LEARN_DIR stays offline
// and only warns when the change touches a listed lesson or level index.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readText } from '../lib/tree.mjs';
import { changedFiles } from '../lib/git.mjs';
import { fencedBlocks, outsideFences } from '../lib/markdown.mjs';
import { STAMP } from '../lib/stamps.mjs';

export const id = 'lesson-quotes';
export const modes = ['pr', 'scheduled'];

const LIST = '.github/compat/learn.txt';
const RAW = 'https://raw.githubusercontent.com/wesammustafa/claude-code-practice/main/learn/lessons';
const flat = (text) => text.replace(/\s+/g, ' ').trim();
// A code block in a lesson file opens on a fence at the first column, three
// backticks or tildes or more, and closes on a fence of the same character,
// at least as long, as the app reads it (learn/lib/content.mjs in the
// template). The app never shows the fence's info string, so only the
// block's lines are compared.
const LESSON_FENCE = /^(`{3,}|~{3,})([^`]*)$/;
const closes = (fence, line) => {
  const m = line.match(/^(`{3,}|~{3,})[ \t]*$/);
  return Boolean(m) && m[1][0] === fence[0] && m[1].length >= fence.length;
};
const sameLines = (a, b) => a.length === b.length && a.every((line, i) => line === b[i]);

// The front matter as the app reads it: a copy of checks/frontmatter.mjs in
// the template (`key: value` lines, quoted or not, a trailing ` # comment`,
// folded and literal blocks, lists, and plain values on indented lines), so a
// title or Stamp the app shows can't be read differently here.
const unquote = (value) => value.replace(/^(['"])(.*)\1$/, '$2');

function uncomment(value) {
  const v = value.trim();
  const quoted = v.match(/^(['"]).*?\1/);
  if (quoted) return quoted[0];
  return v.replace(/\s+#.*$/, '');
}

function scalar(value) {
  const v = uncomment(value);
  if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(',').map((s) => unquote(s.trim())).filter(Boolean);
  return unquote(v);
}

function frontmatter(text) {
  const lines = (text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines[0].trim() !== '---') return {};
  const end = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (end === -1) return {};
  const fields = {};
  let key = null;
  let block = null;
  let plain = false;
  for (const line of lines.slice(1, end)) {
    if (/^\s*#/.test(line) || !line.trim()) {
      if (block && !line.trim()) block.lines.push('');
      continue;
    }
    const top = line.match(/^([A-Za-z_][\w-]*):(?:\s+(.*))?$/);
    if (top) {
      key = top[1];
      const value = (top[2] ?? '').trim();
      block = /^[|>][+-]?$/.test(uncomment(value)) ? { folded: uncomment(value).startsWith('>'), lines: [] } : null;
      plain = false;
      fields[key] = block ? '' : uncomment(value) === '' ? [] : scalar(value);
      continue;
    }
    if (!key || !/^\s/.test(line)) continue;
    if (block) {
      block.lines.push(line.trim());
      fields[key] = block.lines.join(block.folded ? ' ' : '\n').replace(/\s+$/, '');
    } else if (!plain && Array.isArray(fields[key]) && /^\s*-\s+/.test(line)) {
      fields[key].push(unquote(uncomment(line.replace(/^\s*-\s+/, ''))));
    } else if (plain || (Array.isArray(fields[key]) && fields[key].length === 0)) {
      fields[key] = plain ? `${fields[key]} ${uncomment(line)}` : unquote(uncomment(line));
      plain = true;
    }
  }
  return fields;
}

// A `<level>-index` id names a level's index page (docs/<level>/README.md),
// which warm-ups may quote; it has no lesson file of its own.
const isIndex = (id) => /^[a-z]+-index$/.test(id);

function listed(root) {
  if (!existsSync(join(root, LIST))) return [];
  return readText(root, LIST).split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => { const [lesson, page] = l.split(/\s+/); return { lesson, page }; });
}

async function lessonFile(root, lesson) {
  const dir = process.env.LEARN_DIR;
  if (dir) return readFileSync(join(resolve(root, dir), `${lesson}.md`), 'utf8');
  const res = await fetch(`${RAW}/${lesson}.md`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`the template's learn/lessons/${lesson}.md returned ${res.status}`);
  return res.text();
}

// The number of top-level numbered steps under a `## <name>` heading.
function stepCount(text, name) {
  let inside = false;
  let count = 0;
  for (const { line } of outsideFences(text)) {
    if (/^## /.test(line)) inside = line.trim() === `## ${name}`;
    else if (inside && /^\d+\. /.test(line)) count += 1;
  }
  return count;
}

// `pages` maps every listed lesson or level index id whose page exists to
// its page, text and fenced blocks, for the lesson itself and for warm-ups;
// `listed` holds every listed id.
function compare(lesson, page, rawPage, rawFile, pages, listed) {
  const pageText = rawPage.replace(/\r\n?/g, '\n');
  const file = rawFile.replace(/\r\n?/g, '\n');
  const problems = [];
  const say = (msg) => problems.push(`${page}: the app's learn/lessons/${lesson}.md ${msg}`);
  const stamp = pageText.match(STAMP)?.[0];
  const fields = frontmatter(rawFile);
  const theirs = fields.stamp;
  if (theirs !== stamp) say(`is stamped "${theirs}", but the lesson is stamped "${stamp}". Re-verify the lesson file and copy the new Stamp.`);
  const title = fields.title;
  const h1 = pageText.match(/^# (.+)$/m)?.[1]?.trim();
  if (title !== h1) say(`is titled "${title}", but the lesson's heading is "${h1}".`);
  const recounted = new Set();
  let heading = '(front matter)';
  let from = null;
  let warmup = false;
  const lines = file.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    // What a block or quote on this line is compared with: the lesson's own
    // page, or in a warm-up the earlier lesson or level index its `from`
    // line names.
    const source = pages.get(from ?? lesson);
    const where = from ? `, from ${source?.page}` : '';
    const that = !from ? 'the lesson' : isIndex(from) ? 'that level index' : 'that lesson';
    const open = line.match(LESSON_FENCE);
    if (open) {
      const end = lines.findIndex((l, k) => k > i && closes(open[1], l));
      if (end === -1) {
        say(`has a code block (${heading}) with no closing fence.`);
        break;
      }
      const block = lines.slice(i + 1, end);
      i = end;
      if (source && !source.blocks.some((b) => sameLines(b, block))) {
        const first = block.find((l) => l.trim());
        say(`shows ${first === undefined ? 'an empty code block' : `a code block starting "${first}"`} (${heading}${where}), which is no longer in ${that}.`);
      }
      continue;
    }
    const h = line.match(/^#{2,3} (.+)$/);
    if (h) {
      heading = h[1];
      from = null;
      warmup = /^R\d+ \| Warm-up \|/.test(h[1]);
      const counted = h[1].match(/(Worked example|Your turn|The task) step \d+ of (\d+)/);
      if (counted && !recounted.has(counted[1]) && stepCount(pageText, counted[1]) !== Number(counted[2])) {
        recounted.add(counted[1]);
        say(`counts ${counted[2]} steps in ${counted[1]}, but the lesson has ${stepCount(pageText, counted[1])}.`);
      }
      continue;
    }
    const f = line.match(/^- from: (\S+)$/);
    if (f) {
      if (!warmup) say(`has a from line in ${heading}, which isn't a warm-up: only a warm-up quotes an earlier lesson or a level index.`);
      else if (!listed.has(f[1])) {
        const known = [...listed].filter(isIndex);
        const hint = !isIndex(f[1]) ? '' : known.length ? `; the level indexes it lists are ${known.join(', ')}` : '; it lists no level index';
        say(`has a warm-up (${heading}) from ${f[1]}, which ${LIST} doesn't list${hint}.`);
      } else from = f[1];
      continue;
    }
    const q = line.match(/^- [a-z-]+: (.+)$/)?.[1].trim().match(/^"(.*)"$/);
    if (q && source && !source.body.includes(flat(q[1]))) say(`quotes "${q[1]}" (${heading}${where}), which is no longer in ${that}.`);
  }
  return problems;
}

export async function run(ctx) {
  const entries = listed(ctx.root);
  const lessons = entries.filter((l) => !isIndex(l.lesson));
  const indexes = entries.filter((l) => isIndex(l.lesson));
  if (!lessons.length) return { status: 'pass', summary: `no lessons listed in ${LIST}` };
  if (!process.env.LEARN_DIR && ctx.mode === 'pr') {
    if (!ctx.base.sha) return { status: 'skip', summary: `diff-scoped: ${ctx.base.note}` };
    const changed = new Set(changedFiles(ctx.root, ctx.base.sha));
    const touched = entries.filter((l) => changed.has(l.page));
    if (!touched.length) return { status: 'pass', summary: `${lessons.length} lesson(s) in the app, none changed; the weekly run compares the quotes` };
    return {
      status: 'warn',
      problems: touched.map((l) => `${l.page} changed, and the practice template's learning app ${isIndex(l.lesson) ? `can quote it in a warm-up from ${l.lesson}` : `quotes it in learn/lessons/${l.lesson}.md`}. Before you merge, run LEARN_DIR=<template checkout>/learn/lessons node .github/scripts/check.mjs --only lesson-quotes, and if it fails, update the lesson file in the template first.`),
    };
  }
  const problems = [];
  const pages = new Map(entries.filter((l) => existsSync(join(ctx.root, l.page)))
    .map((l) => {
      const text = readText(ctx.root, l.page).replace(/\r\n?/g, '\n');
      return [l.lesson, { page: l.page, body: flat(text), blocks: fencedBlocks(text) }];
    }));
  for (const { lesson, page } of entries) {
    if (!existsSync(join(ctx.root, page))) {
      problems.push(`${LIST} lists ${page}, which doesn't exist`);
      continue;
    }
    if (isIndex(lesson)) continue;
    problems.push(...compare(lesson, page, readText(ctx.root, page), await lessonFile(ctx.root, lesson), pages, new Set(entries.map((l) => l.lesson))));
  }
  if (problems.length) return { status: 'fail', problems };
  const also = indexes.length ? `, and their warm-ups match the ${indexes.length} level index(es) listed` : '';
  return { status: 'pass', summary: `${lessons.length} lesson(s) in the app match their lesson files${also}` };
}
