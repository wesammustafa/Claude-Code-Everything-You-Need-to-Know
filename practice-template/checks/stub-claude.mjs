// @ts-check
// Runs a script the Learner committed with a stand-in for Claude Code, so a
// check can see how the script calls `claude` without spending any usage.
// Shared by the Advanced checks of lessons 4 and 7 and the Advanced capstone.
//
// The committed copy runs in a scratch git repository, with a POSIX-sh
// `claude` first on PATH that records each call's arguments and stdin,
// prints a canned reply and exits with a set code. HOME and
// CLAUDE_CONFIG_DIR point at empty folders and the credential variables are
// removed, so even a real Claude Code would find no sign-in. A script that
// could reach the real one anyway, by its path, through a package runner, by
// changing PATH or through a login shell or a profile that sets PATH anew, is
// refused before it runs. On Windows itself nothing runs: there `bash` can be
// WSL's launcher, which doesn't hand the stand-in's PATH, HOME and
// CLAUDE_CONFIG_DIR to the script.
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, join, posix, relative, sep } from 'node:path';
/** @import { Repo } from './repo.mjs' */

// The session id of every stand-in reply, fixed so a check can tell the
// stand-in's reply from a real run's.
export const STUB_SESSION = '00000000-0000-4000-8000-00000000c0de';

// The longest the script may run, in milliseconds.
export const TIME_LIMIT = 20_000;

const REMOVED = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'BASH_ENV', 'ENV'];

// Ways a script could call the real Claude Code. Whole-line comments are
// skipped before these are tested.
/** @type {[RegExp, (m: RegExpMatchArray) => string][]} */
const REACHES = [
  [/(?:^|[\s;&|(`$])(npx|bunx|pnpx)\s+(?:-\S+\s+)*(?:@anthropic-ai\/claude-code|claude)\b/m, (m) => `runs Claude Code through \`${m[1]}\``],
  [/@anthropic-ai\/claude-code/, () => 'names the `@anthropic-ai/claude-code` package'],
  [/[^\s'"`=;|&(){}<>]*\/claude(?:\.exe)?(?=$|[\s'"`;|&)])/m, (m) => `calls Claude Code by its path, \`${m[0]}\``],
  [/(?:^|[\s;&|(`$'"])claude\.exe\b/m, () => 'calls `claude.exe`'],
  [/(?:^|[\s;&|({`])(?:(?:export|declare|typeset|local|readonly)\s+(?:-\w+\s+)*)?PATH\+?=/m, () => 'changes `PATH`'],
  [/(?:^|[\s;&|(`$'"])(?:[\w./-]*\/)?(?:ba|da|k|z|fi)?sh\s+(?:-[A-Za-z]*\s+|--[\w-]+\s+)*?(?:-[A-Za-z]*l[A-Za-z]*|--login)(?=$|[\s'"`;|&)])/m, () => 'starts a login shell, with `-l` or `--login`'],
  [/(?:^|[\s;&|(`])(?:\.|source)\s+["']?(\/etc\/z?profile(?:\.d\/[^\s'"`;|&)]*)?)/m, (m) => `reads \`${m[1]}\``],
  [/\bpath_helper\b/, () => 'runs `path_helper`'],
];

// Why the committed text can't run under the stand-in, or null.
/** @param {string} text */
function refusal(text) {
  const code = text.split(/\r?\n/).filter((line) => !/^\s*#/.test(line)).join('\n');
  for (const [pattern, why] of REACHES) {
    const m = code.match(pattern);
    if (m) return why(m);
  }
  return null;
}

const quote = (/** @type {string} */ path) => `'${path.replace(/'/g, `'\\''`)}'`;

// The stand-in: it records its arguments, NUL-separated, the folder it runs
// in and up to 1 MiB of stdin, answers `--version` and `-v` itself, and
// otherwise prints the reply and the error text, if any, to stderr.
const stub = (/** @type {string} */ base) => `#!/bin/sh
# Stands in for Claude Code while a practice check runs your script.
d=${quote(base)}
i=0
while [ -e "$d/calls/$i.argv" ]; do i=$((i + 1)); done
: > "$d/calls/$i.argv"
for a in "$@"; do printf '%s\\000' "$a" >> "$d/calls/$i.argv"; done
pwd > "$d/calls/$i.cwd"
case "$1" in -v|--version) echo '2.1.285 (Claude Code)'; exit 0 ;; esac
head -c 1048576 > "$d/calls/$i.stdin"
cat "$d/reply.json"
if [ -s "$d/stderr" ]; then cat "$d/stderr" >&2; fi
exit "$(cat "$d/exit")"
`;

/** @param {Record<string, string>} [extra] */
function scrubbed(extra) {
  const env = { ...process.env, ...extra };
  for (const key of Object.keys(env)) {
    // Exported bash functions could stand in for `claude` themselves, and
    // GIT_ variables could point git at the Learner's repository.
    if (REMOVED.includes(key) || key.startsWith('BASH_FUNC_') || key.startsWith('GIT_')) delete env[key];
  }
  return env;
}

/**
 * @param {string} dir
 * @param {Record<string, string | Buffer>} files
 */
function write(dir, files) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
}

// Every regular file under `dir`, by its path from `prefix`, as text. Links,
// pipes and devices are left out.
/**
 * @param {string} dir
 * @param {string} prefix
 * @returns {Record<string, string>}
 */
function files(dir, prefix) {
  /** @type {Record<string, string>} */
  const found = {};
  if (!existsSync(dir)) return found;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const key = posix.join(prefix, name);
    const stat = lstatSync(path);
    if (stat.isDirectory()) Object.assign(found, files(path, key));
    else if (stat.isFile()) found[key] = readFileSync(path, 'utf8');
  }
  return found;
}

// `path` relative to the first of `roots` it is inside, in POSIX form, or
// null when it is inside none of them.
/**
 * @param {string[]} roots
 * @param {string} path
 */
function within(roots, path) {
  for (const root of roots) {
    const rel = relative(root, path);
    if (!isAbsolute(rel) && rel.split(sep)[0] !== '..') return rel.split(sep).join('/');
  }
  return null;
}

/** @typedef {{ argv: string[], stdin: string, cwd: string | null }} Call */

/**
 * @param {string} dir
 * @param {string[]} roots
 * @returns {Call[]}
 */
function calls(dir, roots) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.argv'))
    .map((name) => Number.parseInt(name, 10))
    .sort((a, b) => a - b)
    .map((i) => {
      const argv = readFileSync(join(dir, `${i}.argv`), 'utf8').split('\0');
      argv.pop();
      const stdin = existsSync(join(dir, `${i}.stdin`)) ? readFileSync(join(dir, `${i}.stdin`), 'utf8') : '';
      const pwd = existsSync(join(dir, `${i}.cwd`)) ? readFileSync(join(dir, `${i}.cwd`), 'utf8').replace(/\n$/, '') : null;
      return { argv, stdin, cwd: pwd === null ? null : within(roots, pwd) };
    });
}

// Runs the committed copy of `script` with bash, from the root of a scratch
// repository that holds it and `commit` (path to text) in one commit, then
// `stage` written and staged, then `change` written and left unstaged.
// `.practice/` is there and ignored, as in a Learner's repository. `args`
// takes `out`, an empty folder outside the repository, and returns the
// script's arguments; `reply` is what the stand-in prints (nothing when
// null), `stderr` what it prints to stderr and `exit` its exit code.
// `practice: false` leaves `.practice/` out, as in a fresh copy, and
// `platform` stands in for `process.platform`.
//
// Returns `{ windows }` on Windows, where it runs nothing, `{ missing }` when
// HEAD lacks the script, `{ crlf }` when it has
// Windows line ends, or `{ refused }` with why it would reach the real
// Claude Code; otherwise `{ status, signal, timedOut, error, stdout, stderr,
// calls, saved, roots }`: `calls` holds each call's `argv`, `stdin` and
// `cwd`, the folder it ran in relative to the scratch repository ('' at its
// root, null outside it); `saved` the files left under `out/` and the
// scratch `.practice/`, by those paths; and `roots` the scratch
// repository's path, for `scratchPath`.
/**
 * A run that went ahead: every field but the skips.
 * @typedef {{ status: number | null, signal: NodeJS.Signals | null, timedOut: boolean, error: NodeJS.ErrnoException | null, stdout: string, stderr: string, calls: Call[], saved: Record<string, string>, roots: string[] }} Ran
 */

/**
 * What runStubbed returns: a skip, or a Ran. notRun returns null only for a Ran.
 * @typedef {Partial<Ran> & { windows?: true, missing?: true, crlf?: true, refused?: string }} Stubbed
 */

/**
 * @typedef {{ args?: (out: string) => string[], commit?: Record<string, string>, stage?: Record<string, string>, change?: Record<string, string>, reply?: unknown, stderr?: string | undefined, exit?: number, timeout?: number, practice?: boolean, platform?: string }} StubOptions
 */

/**
 * @param {Repo} repo
 * @param {string} script
 * @param {StubOptions} [options]
 * @returns {Stubbed}
 */
export function runStubbed(repo, script, { args = () => [], commit = {}, stage = {}, change = {}, reply = {}, stderr = '', exit = 0, timeout = TIME_LIMIT, practice = true, platform = process.platform } = {}) {
  if (platform === 'win32') return { windows: true };
  let text;
  try {
    text = execFileSync('git', ['show', `HEAD:${script}`], { cwd: repo.dir, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    return { missing: true };
  }
  if (text.includes('\r')) return { crlf: true };
  const refused = refusal(text.toString('utf8'));
  if (refused) return { refused };

  const base = mkdtempSync(join(tmpdir(), 'stub-claude-'));
  try {
    const dir = join(base, 'repo');
    const out = join(base, 'out');
    for (const folder of ['bin', 'calls', 'home', 'config', 'out', practice ? 'repo/.practice' : 'repo']) mkdirSync(join(base, folder), { recursive: true });
    writeFileSync(join(base, 'bin', 'claude'), stub(base));
    chmodSync(join(base, 'bin', 'claude'), 0o755);
    writeFileSync(join(base, 'reply.json'), reply === null ? '' : `${JSON.stringify(reply)}\n`);
    writeFileSync(join(base, 'stderr'), stderr ? `${stderr}\n` : '');
    writeFileSync(join(base, 'exit'), `${exit}\n`);

    // The script may see the repository's path with symlinks resolved.
    const roots = [...new Set([dir, realpathSync(dir)])];
    const git = (/** @type {string[]} */ ...a) => execFileSync('git', ['-c', 'user.name=Practice check', '-c', 'user.email=check@example.invalid', '-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${devNull}`, '-c', `core.excludesFile=${devNull}`, ...a], { cwd: dir, env: scrubbed(), stdio: ['ignore', 'pipe', 'pipe'] });
    git('init', '-q');
    writeFileSync(join(dir, '.git', 'info', 'exclude'), '.practice/\n');
    write(dir, { ...commit, [script]: text });
    chmodSync(join(dir, script), 0o755);
    git('add', '-A');
    git('commit', '-q', '--no-verify', '-m', 'Start');
    write(dir, stage);
    if (Object.keys(stage).length) git('add', '--', ...Object.keys(stage));
    write(dir, change);

    // Node's types leave out spawnSync's `detached`, which it honours.
    const run = spawnSync('bash', [script, ...args(out)], /** @type {{ encoding: 'utf8' }} */ ({
      cwd: dir,
      env: scrubbed({ HOME: join(base, 'home'), CLAUDE_CONFIG_DIR: join(base, 'config'), PATH: `${join(base, 'bin')}${delimiter}${process.env.PATH ?? ''}` }),
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout,
      killSignal: 'SIGKILL',
      // Its own process group, so whatever the script left running stops too.
      detached: true,
    }));
    if (run.pid) {
      try {
        process.kill(-run.pid, 'SIGKILL');
      } catch {
        // The group has already exited.
      }
    }
    return {
      status: run.status,
      signal: run.signal,
      timedOut: /** @type {NodeJS.ErrnoException | undefined} */ (run.error)?.code === 'ETIMEDOUT',
      error: run.error && /** @type {NodeJS.ErrnoException} */ (run.error).code !== 'ETIMEDOUT' ? run.error : null,
      stdout: run.stdout ?? '',
      stderr: run.stderr ?? '',
      calls: calls(join(base, 'calls'), roots),
      saved: { ...files(out, 'out'), ...files(join(dir, '.practice'), '.practice') },
      roots,
    };
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
}

// The file in the scratch repository that `path`, an argument of `call`,
// names, as the call would open it: relative to the repository's root, in
// POSIX form, or null when it is outside the repository.
/**
 * @param {Stubbed} run
 * @param {{ cwd?: string | null }} call
 * @param {unknown} path
 */
export function scratchPath(run, call, path) {
  if (!run.roots || typeof path !== 'string' || !path) return null;
  if (isAbsolute(path)) return within(run.roots, path);
  if (call.cwd === null || call.cwd === undefined) return null;
  return within(run.roots, join(/** @type {string} */ (run.roots[0]), call.cwd, path));
}

// The hint for a script the stand-in didn't run, or null when it ran.
/**
 * @param {Stubbed} run
 * @param {string} script
 */
export function notRun(run, script) {
  if (run.windows) return `The check didn't run \`${script}\`: it runs scripts with bash and a stand-in for \`claude\` only from WSL 2, macOS or Linux, not from Windows itself. Run the check there.`;
  if (run.missing) return `Commit \`${script}\` first: the check runs the committed script.`;
  if (run.crlf) return `The committed \`${script}\` has Windows line ends (CRLF), which bash can't run. Save it with LF line ends (your editor has a setting for this), then commit it again.`;
  if (run.refused) return `\`${script}\` ${run.refused}, which the stand-in can't replace, so the check didn't run it. Call \`claude\` by name, leave \`PATH\` as it is, and commit.`;
  if (run.error?.code === 'ENOENT') return `The check runs \`${script}\` with bash, which it couldn't find. Run the check where bash is installed: macOS, Linux or WSL.`;
  if (run.error) return `The check couldn't run \`${script}\`: ${run.error.message}`;
  return null;
}

// The last lines a run printed to stderr, for a hint.
/** @param {{ stderr: string }} run */
export function stderrTail(run, lines = 2) {
  const tail = run.stderr.trim().split(/\r?\n/).slice(-lines).join(' ').trim();
  return tail.length > 200 ? `${tail.slice(0, 200)}...` : tail;
}
