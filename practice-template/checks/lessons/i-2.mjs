// Organize project memory and see what loaded (Intermediate, lesson 2). The
// Learner imports a file into CLAUDE.md with @path, scopes a rule in
// .claude/rules/ to the files it applies to, and saves the log an
// InstructionsLoaded hook wrote, which shows both loading. What /context
// lists shows only in a session, so the lesson self-checks it.
import { existsSync } from 'node:fs';
import { isAbsolute, posix } from 'node:path';
import { homedir } from 'node:os';
import { frontmatter } from '../frontmatter.mjs';

export const title = 'Organize project memory and see what loaded';

const START = 'Start the session with `claude --settings .practice/i-2-hook.json`, the hook file from the lesson';

function committed(repo, path) {
  try {
    return repo.git('show', `HEAD:${path}`);
  } catch {
    return null;
  }
}

function committedMemory(repo) {
  for (const path of ['CLAUDE.md', '.claude/CLAUDE.md']) {
    const text = committed(repo, path);
    if (text !== null) return { path, text };
  }
  return null;
}

// @path imports outside fenced code and code spans. An @ after a non-space,
// as in an email address, doesn't start one.
export function imports(text) {
  let fence = false;
  const found = [];
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    for (const m of line.replace(/`[^`]*`/g, '').matchAll(/(?:^|\s)@((?:\\ |\S)+)/g)) found.push(m[1].replace(/\\ /g, ' '));
  }
  return found;
}

// Whether an import's file exists: a relative path resolves from the file
// that holds the import.
function importExists(repo, memoryPath, target) {
  if (target.startsWith('~/')) return existsSync(posix.join(homedir(), target.slice(2)));
  if (isAbsolute(target)) return existsSync(target);
  return repo.exists(posix.join(posix.dirname(memoryPath), target));
}

// A rule's `paths` value: a YAML list, or a string of comma-separated
// patterns (commas inside {braces} belong to the pattern).
function patterns(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  const out = [];
  let depth = 0;
  let current = '';
  for (const ch of String(value ?? '')) {
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(current.trim());
      current = '';
    } else current += ch;
  }
  out.push(current.trim());
  return out.filter(Boolean).map((p) => p.replace(/^(['"])(.*)\1$/, '$2'));
}

function expandBraces(pattern) {
  const m = pattern.match(/^(.*?)\{([^{}]*)\}(.*)$/);
  if (!m) return [pattern];
  return m[2].split(',').flatMap((alt) => expandBraces(`${m[1]}${alt}${m[3]}`));
}

// Glob to RegExp, relative to the project root: ** spans folders, * and ?
// stay within one.
export function globMatcher(pattern) {
  const regexes = expandBraces(pattern.replace(/^\.\//, '')).map((p) => {
    let re = '';
    for (let i = 0; i < p.length; i += 1) {
      if (p.startsWith('**/', i)) { re += '(?:.*/)?'; i += 2; }
      else if (p.startsWith('**', i)) { re += '.*'; i += 1; }
      else if (p[i] === '*') re += '[^/]*';
      else if (p[i] === '?') re += '[^/]';
      else re += p[i].replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${re}$`);
  });
  return (path) => regexes.some((r) => r.test(path));
}

function scopedRules(repo) {
  let names;
  try {
    names = repo.git('ls-tree', '-r', '--name-only', 'HEAD', '--', '.claude/rules').split('\n').filter((f) => f.endsWith('.md'));
  } catch {
    names = [];
  }
  return names.map((path) => ({ path, globs: patterns(frontmatter(committed(repo, path) ?? '')?.fields.paths) })).filter((r) => r.globs.length);
}

export const items = [
  {
    text: 'a committed CLAUDE.md imports a file with `@path`, and the file exists',
    check(repo) {
      const memory = committedMemory(repo);
      if (!memory) return 'There is no committed CLAUDE.md. Commit the one you organize in this lesson.';
      const found = imports(memory.text);
      if (!found.length) return `The committed ${memory.path} has no @path import outside backticks. Add a line such as \`- npm scripts: @package.json\` and commit it.`;
      const missing = found.filter((target) => !importExists(repo, memory.path, target));
      if (missing.length < found.length) return true;
      return `${memory.path} imports ${missing.map((m) => `@${m}`).join(', ')}, but ${missing[0]} doesn't exist. An import path runs until the first space; remove trailing punctuation or fix the target.`;
    },
  },
  {
    text: 'a committed rule in `.claude/rules/` is scoped with `paths:`, and every scoped rule matches a file in the repository',
    check(repo) {
      const rules = scopedRules(repo);
      if (!rules.length) return 'No committed file in .claude/rules/ has `paths:` frontmatter. Scope a rule to the files it applies to, such as `test/**/*.js`, and commit it.';
      const files = repo.git('ls-files').split('\n').filter(Boolean);
      const dead = rules.filter((r) => !r.globs.some((g) => files.some(globMatcher(g))));
      if (!dead.length) return true;
      return dead.map((r) => `${r.path} is scoped to ${r.globs.join(', ')}, which matches no file in the repository.`).join(' ') + ' Fix the pattern and commit it.';
    },
  },
  {
    text: '`.practice/i-2-loaded.txt` shows the imported file and a scoped rule loading',
    local: true,
    check(repo) {
      const log = repo.read('.practice/i-2-loaded.txt');
      if (log === null) return `There is no load log. ${START}, then ask Claude to read a file that your scoped rule covers.`;
      const lines = log.split(/\r?\n/).map((l) => l.split('\t')).filter((p) => p.length >= 2);
      const rules = scopedRules(repo).map((r) => r.path);
      if (!lines.some(([reason]) => reason === 'include')) return `The log has no \`include\` line, so no imported file loaded. Check the import's path, then ${START[0].toLowerCase()}${START.slice(1)}.`;
      const loaded = lines.filter(([reason, path]) => reason === 'path_glob_match' && rules.some((r) => path.replace(/\\/g, '/').endsWith(`/${r}`)));
      if (loaded.length) return true;
      return 'The log shows no scoped rule loading. In a session started with the hook, ask Claude to read a file the rule covers, and check that its pattern, read from the project root, matches that file.';
    },
  },
];
