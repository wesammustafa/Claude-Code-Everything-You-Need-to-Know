#!/usr/bin/env node
// @ts-check
// Moves a practice copy made before Claude Code Quest into the copy's
// current layout. README's "Already have a practice copy?" runs it at the
// copy's root, after fetching the template's main and checking out its
// checks/, capstone/ and learn/:
//   1 refuses, changing nothing, unless that checkout is in place and the
//     copy has no project/ yet, or only the one a stopped run left; an
//     upgraded copy is left as it is, and a stopped run finishes when rerun;
//   2 moves the Starter project (src/, test/, samples/, practice/, its
//     package files, LICENSE, .gitignore, .claude/ and CLAUDE.md) into
//     project/, with
//     git mv for what git tracks, so each file keeps its contents;
//   3 moves the lesson files under .practice/ to project/.practice/, leaving
//     the progress save and its unreadable-save backups at the root;
//   4 points project/'s check script at ../checks/run.mjs, and takes the
//     root package.json and .gitignore from the template;
//   5 removes the Terminal app's last files, moves any untracked file left
//     in checks/, capstone/ or learn/ to .practice/upgrade-kept/ and names
//     it, and leaves every other file, the Learner's own workflows and notes
//     too, where it is.
// It commits nothing: review the change with git status, then commit it.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** What moves into project/, in the copy's root. */
export const STARTER = ['src', 'test', 'samples', 'practice', 'package.json', 'package-lock.json', 'LICENSE', '.gitignore', '.claude', 'CLAUDE.md'];

/** The progress save and its backups, which stay in the root's .practice/. */
export const SAVE = /^learn\.json(\.unreadable(-\d+)?)?$/;

/** The Terminal app's files the template no longer has, outside checks/, capstone/ and learn/. */
export const RETIRED = ['.github/workflows/assert-checks.yml', '.github/readme/learn-lesson-complete.gif'];

/** The folders README's checkout replaces as wholes. */
export const REPLACED = ['checks', 'capstone', 'learn'];

/** Where untracked files left in the replaced folders go, kept. */
export const KEPT = '.practice/upgrade-kept';

export const CHECK = 'node ../checks/run.mjs';

/**
 * project/package.json's text with `check` run from project/ and the root's
 * scripts (`learn`, `test:checks`) gone. The indent and line endings stay.
 * @param {string} text
 */
export function rewriteProjectPackage(text) {
  const pkg = JSON.parse(text);
  pkg.scripts = { ...pkg.scripts, check: CHECK };
  delete pkg.scripts.learn;
  delete pkg.scripts['test:checks'];
  const indent = /^\{\r?\n([ \t]+)/.exec(text)?.[1] ?? '  ';
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const body = JSON.stringify(pkg, null, indent).replace(/\n/g, eol);
  return /\r?\n$/.test(text) ? `${body}${eol}` : body;
}

/**
 * @param {string[]} args
 * @param {string} cwd
 */
function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * @param {string[]} args
 * @param {string} cwd
 */
function gitOk(args, cwd) {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
}

/**
 * @param {string} cwd
 * @param {string} path
 */
const tracked = (cwd, path) => git(['ls-files', '-z', '--', path], cwd).length > 0;

/** @param {string} dir */
function upgraded(dir) {
  try {
    const pkg = JSON.parse(readFileSync(join(dir, 'project/package.json'), 'utf8'));
    return pkg.scripts?.check === CHECK && !existsSync(join(dir, 'src'));
  } catch {
    return false;
  }
}

/**
 * Why the upgrade may not run in `dir`, as a list (empty when it may).
 * @param {string} dir
 */
export function refusals(dir) {
  const top = gitOk(['rev-parse', '--show-toplevel'], dir)?.trim();
  if (!top || realpathSync(top) !== realpathSync(dir)) return ['run it in your practice copy\'s top folder, the one holding .git'];
  if (!gitOk(['rev-parse', '--verify', '-q', 'FETCH_HEAD^{commit}'], dir)) return ['FETCH_HEAD is missing: run the git fetch line first'];
  const problems = [];
  for (const path of ['checks/run.mjs', 'learn/app.mjs']) {
    const want = gitOk(['rev-parse', `FETCH_HEAD:${path}`], dir)?.trim();
    const have = existsSync(join(dir, path)) ? gitOk(['hash-object', '--', path], dir)?.trim() : undefined;
    if (!want || want !== have) problems.push(`${path} is not the template's: run the git checkout lines first`);
  }
  for (const path of ['package.json', '.gitignore'])
    if (!gitOk(['rev-parse', '--verify', '-q', `FETCH_HEAD:${path}`], dir)) problems.push(`FETCH_HEAD has no ${path}: fetch the template's main again`);
  if (existsSync(join(dir, 'project')) && !stopped(dir)) problems.push('project/ already exists: move it aside, then run this again');
  return problems;
}

/**
 * Whether project/ is one a stopped upgrade left: it holds only Starter
 * entries and .practice/, and none of them is also still at the root.
 * @param {string} dir
 */
function stopped(dir) {
  const project = join(dir, 'project');
  if (!statSync(project).isDirectory()) return false;
  return readdirSync(project).every((name) => name === '.practice' || (STARTER.includes(name) && !existsSync(join(dir, name))));
}

/**
 * Untracked files, ignored ones too, under the replaced folders.
 * @param {string} dir
 */
const leftovers = (dir) => git(['ls-files', '--others', '-z', '--', ...REPLACED], dir).split('\0').filter(Boolean);

/**
 * `at` and every folder under it, deepest first, as paths from `dir`.
 * @param {string} dir
 * @param {string} at
 * @returns {string[]}
 */
function emptyFolders(dir, at) {
  const full = join(dir, at);
  if (!existsSync(full) || !statSync(full).isDirectory()) return [];
  const below = readdirSync(full).flatMap((name) => emptyFolders(dir, `${at}/${name}`));
  return [...below, at];
}

/**
 * The upgrade in `dir`; returns the lines to print and the exit code.
 * @param {string} dir
 * @returns {{ code: number, lines: string[] }}
 */
export function upgrade(dir) {
  if (upgraded(dir)) return { code: 0, lines: ['upgrade: this copy is already upgraded; nothing changed.'] };
  const problems = refusals(dir);
  if (problems.length) return { code: 1, lines: ['upgrade: nothing changed, because:', ...problems.map((p) => `  ${p}`)] };
  try {
    return move(dir);
  } catch (error) {
    const why = error instanceof Error ? error.message.split('\n')[0] : String(error);
    return { code: 1, lines: [`upgrade: stopped partway: ${why}`, 'Fix that (close any editor holding these files), then run node checks/upgrade.mjs again to finish.'] };
  }
}

/**
 * The upgrade's changes, each safe to repeat after a stopped run.
 * @param {string} dir
 * @returns {{ code: number, lines: string[] }}
 */
function move(dir) {
  const project = join(dir, 'project');
  mkdirSync(project, { recursive: true });
  const moved = [];
  for (const name of STARTER) {
    if (!existsSync(join(dir, name))) {
      if (existsSync(join(project, name))) moved.push(name);
      continue;
    }
    // git mv renames the whole path on disk, untracked files inside it too.
    if (tracked(dir, name)) git(['mv', '--', name, `project/${name}`], dir);
    else renameSync(join(dir, name), join(project, name));
    moved.push(name);
  }

  const saves = join(dir, '.practice');
  if (existsSync(saves))
    for (const name of readdirSync(saves)) {
      if (SAVE.test(name)) continue;
      if (name === KEPT.split('/')[1]) continue;
      mkdirSync(join(project, '.practice'), { recursive: true });
      if (tracked(dir, `.practice/${name}`)) git(['mv', '--', `.practice/${name}`, `project/.practice/${name}`], dir);
      else renameSync(join(saves, name), join(project, '.practice', name));
    }

  const worktrees = join(project, '.claude/worktrees');
  if (existsSync(worktrees)) {
    const linked = readdirSync(worktrees).filter((n) => existsSync(join(worktrees, n, '.git'))).map((n) => `project/.claude/worktrees/${n}`);
    if (linked.length) git(['worktree', 'repair', ...linked], dir);
  }

  const pkg = join(project, 'package.json');
  if (existsSync(pkg)) {
    writeFileSync(pkg, rewriteProjectPackage(readFileSync(pkg, 'utf8')));
    git(['add', '--', 'project/package.json'], dir);
  }
  for (const path of ['package.json', '.gitignore']) {
    writeFileSync(join(dir, path), execFileSync('git', ['show', `FETCH_HEAD:${path}`], { cwd: dir }));
    git(['add', '--', path], dir);
  }

  // The Terminal app's own files go, even edited; nothing else in .github does.
  for (const path of RETIRED) if (tracked(dir, path)) git(['rm', '-q', '-f', '--', path], dir);
  const kept = leftovers(dir);
  for (const path of kept) {
    mkdirSync(dirname(join(dir, KEPT, path)), { recursive: true });
    renameSync(join(dir, path), join(dir, KEPT, path));
  }
  for (const at of REPLACED)
    for (const folder of emptyFolders(dir, at))
      if (readdirSync(join(dir, folder)).length === 0) rmdirSync(join(dir, folder));

  const lines = [`upgrade: moved ${moved.join(', ')} into project/.`];
  if (kept.length) lines.push(`kept: these untracked files from checks/, capstone/ and learn/ are now in ${KEPT}/:`, ...kept.map((p) => `  ${p}`));
  for (const name of ['settings.json', 'settings.local.json']) {
    const file = join(project, '.claude', name);
    if (existsSync(file) && readFileSync(file, 'utf8').includes('.practice/'))
      lines.push(`note: project/.claude/${name} names .practice/; your lesson files are now in project/.practice/.`);
  }
  lines.push(
    'Next:',
    '  npm run learn                                 opens Claude Code Quest where you left off',
    '  cd project && npm ci && npm run check -- <lesson>',
    'Review the change with git status, then commit it.',
  );
  return { code: 0, lines };
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const { code, lines } = upgrade(process.cwd());
  (code ? console.error : console.log)(lines.join('\n'));
  process.exitCode = code;
}
