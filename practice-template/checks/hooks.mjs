// @ts-check
// Hook helpers shared by lesson 5's check and the Intermediate capstone: which
// scripts the committed settings run before Edit and Write, and how to run the
// committed copy of a script with the JSON a tool call sends.
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { findBash } from './stub-claude.mjs';
/** @import { Repo } from './repo.mjs' */

// Whether a matcher fires for both Edit and Write, read as Claude Code reads
// it (hooks reference, "Matcher patterns",
// https://code.claude.com/docs/en/hooks.md#matcher-patterns): `"*"`, `""` or
// none matches every tool; a matcher of only letters, digits, `_`, `-`,
// spaces, `,` and `|` is a list of exact names split on `|` or `,`
// ("Matchers are case-sensitive": hooks guide, "Hook not firing",
// https://code.claude.com/docs/en/hooks-guide.md#hook-not-firing); any other
// character makes it an unanchored JavaScript regex. An
// array matcher is an invalid entry (debug-your-config, "Check hooks",
// https://code.claude.com/docs/en/debug-your-config.md#check-hooks); any other
// non-string is rejected too, which the docs don't cover.
/** @param {unknown} matcher */
export function matchesEditWrite(matcher) {
  if (matcher === undefined || matcher === '' || matcher === '*') return true;
  if (typeof matcher !== 'string') return false;
  if (/^[\w\- ,|]*$/.test(matcher)) {
    const names = matcher.split(/[|,]/).map((name) => name.trim());
    return names.includes('Edit') && names.includes('Write');
  }
  try {
    const pattern = new RegExp(matcher);
    return pattern.test('Edit') && pattern.test('Write');
  } catch {
    return false;
  }
}

// The first list matcher that keeps the file's hooks from loading, with its
// event, or null. A list `matcher` under PreToolUse or PermissionRequest
// stops every other hook in that settings file loading too
// (debug-your-config, "Check hooks").
/**
 * @param {any} settings The parsed settings file, of any shape.
 * @returns {{ event: string, matcher: unknown[] } | null}
 */
export function listMatcher(settings) {
  for (const event of ['PreToolUse', 'PermissionRequest']) {
    const groups = settings?.hooks?.[event];
    const group = Array.isArray(groups) ? groups.find((g) => Array.isArray(g?.matcher)) : undefined;
    if (group) return { event, matcher: group.matcher };
  }
  return null;
}

// A script path as a hook command or argument writes it, made relative to the
// repository: `${CLAUDE_PROJECT_DIR}/.claude/hooks/x.sh`, `"$CLAUDE_PROJECT_DIR"/.claude/hooks/x.sh`
// and `./.claude/hooks/x.sh` all become `.claude/hooks/x.sh`.
/** @param {string} token */
function relative(token) {
  return token.replace(/["']/g, '').replace(/^\$\{?CLAUDE_PROJECT_DIR\}?\/?/, '').replace(/^\.\//, '');
}

// Every word of a matcher group's hook commands and arguments, made relative
// to the repository, whether exec form (`command` plus `args`) or shell form.
/** @param {any} group A matcher group, of any shape. */
export function hookWords(group) {
  return (Array.isArray(group?.hooks) ? group.hooks : [])
    .flatMap((/** @type {any} */ h) => [h?.command, ...(Array.isArray(h?.args) ? h.args : [])])
    .flatMap((/** @type {unknown} */ t) => String(t ?? '').split(/\s+/))
    .map(relative);
}

// The scripts under .claude/hooks/ that the settings run as PreToolUse hooks
// for Edit and Write. None when a list matcher keeps the file's hooks from
// loading.
/**
 * @param {any} settings The parsed settings file, of any shape.
 * @returns {string[]}
 */
export function editWriteScripts(settings) {
  const groups = settings?.hooks?.PreToolUse;
  if (!Array.isArray(groups) || listMatcher(settings)) return [];
  const scripts = groups
    .filter((g) => matchesEditWrite(g?.matcher))
    .flatMap(hookWords)
    .filter((p) => p.startsWith('.claude/hooks/'));
  return [...new Set(scripts)];
}

// The committed mode of a file, such as '100755', or null when HEAD lacks it.
/**
 * @param {Repo} repo
 * @param {string} path
 */
export function committedMode(repo, path) {
  try {
    const line = repo.git('ls-tree', 'HEAD', '--', path);
    return line ? /** @type {string} */ (line.split(/\s+/)[0]) : null;
  } catch {
    return null;
  }
}

// Runs the committed copy of a hook script, as Claude Code would for a tool
// call on `path`, and returns spawnSync's result, or null when HEAD lacks it.
// On Windows it runs with Git Bash, as runStubbed does: the `bash` on PATH
// can be WSL's launcher, which can't open a Windows path.
/**
 * @param {Repo} repo
 * @param {string} script
 * @param {string} path
 */
export function runCommitted(repo, script, path, tool = 'Edit') {
  let text;
  try {
    text = repo.git('show', `HEAD:./${script}`);
  } catch {
    return null;
  }
  const dir = mkdtempSync(join(tmpdir(), 'hook-'));
  try {
    const file = join(dir, posix.basename(script));
    writeFileSync(file, text);
    chmodSync(file, 0o755);
    return spawnSync(findBash() ?? 'bash', [file.replace(/\\/g, '/')], {
      cwd: repo.dir,
      env: { ...process.env, CLAUDE_PROJECT_DIR: repo.dir.replace(/\\/g, '/') },
      input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { file_path: posix.join(repo.dir.replace(/\\/g, '/'), path) } }),
      encoding: 'utf8',
      timeout: 10_000,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export const missingJq = (/** @type {{ stderr?: string } | null | undefined} */ run) => /jq: (command )?not found/.test(run?.stderr ?? '');
