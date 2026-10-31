// @ts-check
// Read-only access to the repository a check inspects: its files, its config
// and its git state. Checks never run Claude Code or read its replies.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Text as the Learner's shell wrote it: Windows PowerShell 5.1 redirects to
// UTF-16 with a byte-order mark, other shells to UTF-8.
/** @param {Buffer} buffer */
function decode(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString('utf16le');
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return buffer.subarray(3).toString('utf8');
  return buffer.toString('utf8');
}

/** @typedef {ReturnType<typeof openRepo>} Repo */

/** @param {string} dir */
export function openRepo(dir) {
  /** @type {string | undefined} */
  let prefix;
  /** @type {string | undefined} */
  let top;
  const repo = {
    dir,
    exists: (/** @type {string} */ path) => existsSync(join(dir, path)),
    read: (/** @type {string} */ path) => (existsSync(join(dir, path)) ? decode(readFileSync(join(dir, path))) : null),
    // Only trailing whitespace goes: `git status --porcelain` lines start with a space.
    git: (/** @type {string[]} */ ...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).replace(/\s+$/, ''),
    // The same for reads of the history. In a partial clone, git fetches an
    // object the clone lacks from the remote; this never does, and the call
    // fails as if the object didn't exist.
    gitLocal: (/** @type {string[]} */ ...args) => execFileSync('git', args, { cwd: dir, env: { ...process.env, GIT_NO_LAZY_FETCH: '1' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).replace(/\s+$/, ''),
    // A copy's git root sits above project/, where the checks run: `prefix`
    // is the folder's path from that root ('' at the root), `top` the root.
    get prefix() {
      prefix ??= execFileSync('git', ['rev-parse', '--show-prefix'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      return prefix;
    },
    get top() {
      top ??= execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      return top;
    },
    // A path git prints from the root (status, diff and log names), made
    // relative to this folder; a path outside it keeps its `../` steps.
    local: (/** @type {string} */ path) => localPath(path, repo.prefix),
  };
  return repo;
}

// `path`, relative to the git root, made relative to `prefix`, a folder under
// that root such as `project/`.
/**
 * @param {string} path
 * @param {string} [prefix]
 */
export function localPath(path, prefix = '') {
  if (!prefix || path.startsWith(prefix)) return path.slice(prefix.length);
  const up = prefix.split('/').filter(Boolean).map(() => '..');
  return [...up, path].join('/');
}
