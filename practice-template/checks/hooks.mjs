// Hook helpers shared by lesson 5's check and the Intermediate capstone: which
// scripts the committed settings run before Edit and Write, and how to run the
// committed copy of a script with the JSON a tool call sends.
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';

const editWrite = (matcher) => matcher === '' || matcher === '*' || (/\bEdit\b/.test(matcher) && /\bWrite\b/.test(matcher));

// A script path as a hook command or argument writes it, made relative to the
// repository: `${CLAUDE_PROJECT_DIR}/.claude/hooks/x.sh`, `"$CLAUDE_PROJECT_DIR"/.claude/hooks/x.sh`
// and `./.claude/hooks/x.sh` all become `.claude/hooks/x.sh`.
function relative(token) {
  return token.replace(/["']/g, '').replace(/^\$\{?CLAUDE_PROJECT_DIR\}?\/?/, '').replace(/^\.\//, '');
}

// The scripts under .claude/hooks/ that the settings run as PreToolUse hooks
// for Edit and Write, whether exec form (`command` plus `args`) or shell form.
export function editWriteScripts(settings) {
  const groups = settings?.hooks?.PreToolUse;
  if (!Array.isArray(groups)) return [];
  const scripts = groups
    .filter((g) => editWrite(g?.matcher ?? ''))
    .flatMap((g) => g?.hooks ?? [])
    .flatMap((h) => [h?.command, ...(Array.isArray(h?.args) ? h.args : [])])
    .flatMap((t) => String(t ?? '').split(/\s+/))
    .map(relative)
    .filter((p) => p.startsWith('.claude/hooks/'));
  return [...new Set(scripts)];
}

// The committed mode of a file, such as '100755', or null when HEAD lacks it.
export function committedMode(repo, path) {
  try {
    const line = repo.git('ls-tree', 'HEAD', '--', path);
    return line ? line.split(/\s+/)[0] : null;
  } catch {
    return null;
  }
}

// Runs the committed copy of a hook script, as Claude Code would for a tool
// call on `path`, and returns spawnSync's result, or null when HEAD lacks it.
export function runCommitted(repo, script, path, tool = 'Edit') {
  let text;
  try {
    text = repo.git('show', `HEAD:${script}`);
  } catch {
    return null;
  }
  const dir = mkdtempSync(join(tmpdir(), 'hook-'));
  try {
    const file = join(dir, posix.basename(script));
    writeFileSync(file, text);
    chmodSync(file, 0o755);
    return spawnSync('bash', [file], {
      cwd: repo.dir,
      env: { ...process.env, CLAUDE_PROJECT_DIR: repo.dir },
      input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { file_path: posix.join(repo.dir.replace(/\\/g, '/'), path) } }),
      encoding: 'utf8',
      timeout: 10_000,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export const missingJq = (run) => /jq: (command )?not found/.test(run?.stderr ?? '');
