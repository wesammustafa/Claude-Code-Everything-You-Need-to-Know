// Read-only access to the repository a check inspects: its files, its config
// and its git state. Checks never run Claude Code or read its replies.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Text as the Learner's shell wrote it: Windows PowerShell 5.1 redirects to
// UTF-16 with a byte-order mark, other shells to UTF-8.
function decode(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString('utf16le');
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return buffer.subarray(3).toString('utf8');
  return buffer.toString('utf8');
}

export function openRepo(dir) {
  return {
    dir,
    exists: (path) => existsSync(join(dir, path)),
    read: (path) => (existsSync(join(dir, path)) ? decode(readFileSync(join(dir, path))) : null),
    // Only trailing whitespace goes: `git status --porcelain` lines start with a space.
    git: (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).replace(/\s+$/, ''),
    // The same for reads of the history. In a partial clone, git fetches an
    // object the clone lacks from the remote; this never does, and the call
    // fails as if the object didn't exist.
    gitLocal: (...args) => execFileSync('git', args, { cwd: dir, env: { ...process.env, GIT_NO_LAZY_FETCH: '1' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).replace(/\s+$/, ''),
  };
}
