// The practice template's learning app, `npm run learn`, quotes lessons word
// for word, from one lesson file per lesson (learn/lessons/<id>.md in the
// template); .github/compat/learn.txt lists them. In a lesson file, every
// double-quoted `- key: "…"` value is the lesson's own text. This rule fails
// when such a quote, the title, the Stamp or a step count no longer matches
// its lesson. It reads each line and the front matter as the app does
// (learn/lib/content.mjs and checks/frontmatter.mjs in the template), so no
// spacing, quoting or line ending the app accepts can hide a quote. It needs
// the template's lesson files: with LEARN_DIR set to a template checkout's
// learn/lessons folder, any mode reads them there; the weekly scheduled run
// fetches them from the template's main branch. A pull request run without
// LEARN_DIR stays offline and only warns when the change touches a listed
// lesson.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readText } from '../lib/tree.mjs';
import { changedFiles } from '../lib/git.mjs';
import { outsideFences } from '../lib/markdown.mjs';
import { STAMP } from '../lib/stamps.mjs';

export const id = 'lesson-quotes';
export const modes = ['pr', 'scheduled'];

const LIST = '.github/compat/learn.txt';
const RAW = 'https://raw.githubusercontent.com/wesammustafa/claude-code-practice/main/learn/lessons';
const flat = (text) => text.replace(/\s+/g, ' ').trim();

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

function compare(lesson, page, rawPage, rawFile) {
  const pageText = rawPage.replace(/\r\n?/g, '\n');
  const file = rawFile.replace(/\r\n?/g, '\n');
  const problems = [];
  const say = (msg) => problems.push(`${page}: the app's learn/lessons/${lesson}.md ${msg}`);
  const body = flat(pageText);
  const stamp = pageText.match(STAMP)?.[0];
  const fields = frontmatter(rawFile);
  const theirs = fields.stamp;
  if (theirs !== stamp) say(`is stamped "${theirs}", but the lesson is stamped "${stamp}". Re-verify the lesson file and copy the new Stamp.`);
  const title = fields.title;
  const h1 = pageText.match(/^# (.+)$/m)?.[1]?.trim();
  if (title !== h1) say(`is titled "${title}", but the lesson's heading is "${h1}".`);
  const recounted = new Set();
  let heading = '(front matter)';
  for (const line of file.split('\n')) {
    const h = line.match(/^#{2,3} (.+)$/);
    if (h) {
      heading = h[1];
      const counted = h[1].match(/(Worked example|Your turn) step \d+ of (\d+)/);
      if (counted && !recounted.has(counted[1]) && stepCount(pageText, counted[1]) !== Number(counted[2])) {
        recounted.add(counted[1]);
        say(`counts ${counted[2]} steps in ${counted[1]}, but the lesson has ${stepCount(pageText, counted[1])}.`);
      }
      continue;
    }
    const q = line.match(/^- [a-z-]+: (.+)$/)?.[1].trim().match(/^"(.*)"$/);
    if (q && !body.includes(flat(q[1]))) say(`quotes "${q[1]}" (${heading}), which is no longer in the lesson.`);
  }
  return problems;
}

export async function run(ctx) {
  const lessons = listed(ctx.root);
  if (!lessons.length) return { status: 'pass', summary: `no lessons listed in ${LIST}` };
  if (!process.env.LEARN_DIR && ctx.mode === 'pr') {
    if (!ctx.base.sha) return { status: 'skip', summary: `diff-scoped: ${ctx.base.note}` };
    const changed = new Set(changedFiles(ctx.root, ctx.base.sha));
    const touched = lessons.filter((l) => changed.has(l.page));
    if (!touched.length) return { status: 'pass', summary: `${lessons.length} lesson(s) in the app, none changed; the weekly run compares the quotes` };
    return {
      status: 'warn',
      problems: touched.map((l) => `${l.page} changed, and the practice template's learning app quotes it in learn/lessons/${l.lesson}.md. Before you merge, run LEARN_DIR=<template checkout>/learn/lessons node .github/scripts/check.mjs --only lesson-quotes, and if it fails, update the lesson file in the template first.`),
    };
  }
  const problems = [];
  for (const { lesson, page } of lessons) {
    if (!existsSync(join(ctx.root, page))) {
      problems.push(`${LIST} lists ${page}, which doesn't exist`);
      continue;
    }
    problems.push(...compare(lesson, page, readText(ctx.root, page), await lessonFile(ctx.root, lesson)));
  }
  if (problems.length) return { status: 'fail', problems };
  return { status: 'pass', summary: `${lessons.length} lesson(s) in the app match their lesson files` };
}
