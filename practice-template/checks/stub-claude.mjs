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
// refused before it runs. On Windows the script runs with Git Bash, found
// from git's own folder, never from PATH, where `bash` can be WSL's launcher,
// which doesn't hand the stand-in's PATH, HOME and CLAUDE_CONFIG_DIR to the
// script; without Git Bash nothing runs.
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, join, posix, relative, sep, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  [/(?:^|[\s;&|(`$'"])claude\.(cmd|ps1)\b/m, (m) => `calls \`claude.${m[1]}\``],
  [/[^\s'"`=;|&(){}<>]+\\claude(?:\.\w+)?(?=$|[\s'"`;|&)])/m, (m) => `calls Claude Code by its path, \`${m[0]}\``],
  // cmd and PowerShell look `claude` up through PATHEXT, past the
  // extensionless stand-in, and WSL has a PATH of its own.
  [/(?:^|[;&|(`{]|\$\(|\b(?:exec|command|env|xargs|then|do|else)\s)\s*(?:[^\s'"`=;|&(){}<>]*[/\\])?(cmd|powershell|pwsh|wsl)(?:\.exe)?(?=$|[\s'"`;|&)])/im, (m) => `starts \`${m[1]}\``],
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

// A Windows path with forward slashes, which Git Bash and git both take.
const slashed = (/** @type {string} */ path) => path.replace(/\\/g, '/');

// The stand-in: it records its arguments, NUL-separated, the folder it runs
// in and up to 1 MiB of stdin, answers `--version` and `-v` itself, and
// otherwise prints the reply and the error text, if any, to stderr. On
// Windows it records the folder as Windows names it (`pwd -W`).
/**
 * @param {string} base
 * @param {string} [platform]
 */
export const stubText = (base, platform = process.platform) => `#!/bin/sh
# Stands in for Claude Code while a practice check runs your script.
d=${quote(platform === 'win32' ? slashed(base) : base)}
i=0
while [ -e "$d/calls/$i.argv" ]; do i=$((i + 1)); done
: > "$d/calls/$i.argv"
for a in "$@"; do printf '%s\\000' "$a" >> "$d/calls/$i.argv"; done
${platform === 'win32' ? 'pwd -W' : 'pwd'} > "$d/calls/$i.cwd"
case "$1" in -v|--version) echo '2.1.285 (Claude Code)'; exit 0 ;; esac
head -c 1048576 > "$d/calls/$i.stdin"
cat "$d/reply.json"
if [ -s "$d/stderr" ]; then cat "$d/stderr" >&2; fi
exit "$(cat "$d/exit")"
`;

/**
 * @param {Record<string, string>} [extra]
 * @param {string} [bin] put first on PATH
 * @param {string} [platform]
 * @param {NodeJS.ProcessEnv} [from] the environment to start from
 */
export function scrubbed(extra, bin, platform = process.platform, from = process.env) {
  /** @type {Record<string, string | undefined>} */
  const env = { ...from, ...extra };
  if (bin !== undefined) {
    if (platform === 'win32') {
      // Windows names it `Path`, and with a second key spelled `PATH` the
      // script could get either one.
      const key = Object.keys(env).find((k) => /^path$/i.test(k));
      const original = key === undefined ? '' : env[key] ?? '';
      for (const k of Object.keys(env)) if (/^path$/i.test(k)) delete env[k];
      env.PATH = `${bin};${original}`;
    } else env.PATH = `${bin}${delimiter}${from.PATH ?? ''}`;
  }
  for (const key of Object.keys(env)) {
    // Exported bash functions could stand in for `claude` themselves, and
    // GIT_ variables could point git at the Learner's repository.
    if (REMOVED.includes(platform === 'win32' ? key.toUpperCase() : key) || key.startsWith('BASH_FUNC_') || key.startsWith('GIT_')) delete env[key];
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
// null when it is inside none of them. On Windows case and slashes don't
// count, and Git Bash's `/c/...` is `C:/...`.
/**
 * @param {string[]} roots
 * @param {string} path
 * @param {string} [platform]
 */
export function within(roots, path, platform = process.platform) {
  const win = platform === 'win32';
  const target = win ? path.replace(/^\/([A-Za-z])(?=\/|$)/, (_, drive) => `${drive.toUpperCase()}:`) : path;
  for (const root of roots) {
    const rel = win ? win32.relative(root, target) : relative(root, target);
    const s = win ? win32.sep : sep;
    if (!(win ? win32.isAbsolute(rel) : isAbsolute(rel)) && rel.split(s)[0] !== '..') return rel.split(s).join('/');
  }
  return null;
}

/** @typedef {{ argv: string[], stdin: string, cwd: string | null }} Call */

/**
 * @param {string} dir
 * @param {string[]} roots
 * @param {string} [platform]
 * @returns {Call[]}
 */
function calls(dir, roots, platform = process.platform) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.argv'))
    .map((name) => Number.parseInt(name, 10))
    .sort((a, b) => a - b)
    .map((i) => {
      const argv = readFileSync(join(dir, `${i}.argv`), 'utf8').split('\0');
      argv.pop();
      const stdin = existsSync(join(dir, `${i}.stdin`)) ? readFileSync(join(dir, `${i}.stdin`), 'utf8') : '';
      const pwd = existsSync(join(dir, `${i}.cwd`)) ? readFileSync(join(dir, `${i}.cwd`), 'utf8').replace(/\n$/, '') : null;
      return { argv, stdin, cwd: pwd === null ? null : within(roots, pwd.replace(/\r$/, ''), platform) };
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
// `platform` stands in for `process.platform`, and `bash` for the Git Bash
// found on Windows (null for none; elsewhere it is plain `bash`).
//
// Returns `{ windows }` on Windows without Git Bash, where it runs nothing,
// `{ missing }` when HEAD lacks the script, `{ crlf }` when it has Windows
// line ends, or `{ refused }` with why it would reach the real
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
 * @typedef {{ args?: (out: string) => string[], commit?: Record<string, string>, stage?: Record<string, string>, change?: Record<string, string>, reply?: unknown, stderr?: string | undefined, exit?: number, timeout?: number, practice?: boolean, platform?: string, bash?: string | null }} StubOptions
 */

/**
 * @param {Repo} repo
 * @param {string} script
 * @param {StubOptions} [options]
 * @returns {Stubbed}
 */
export function runStubbed(repo, script, { args = () => [], commit = {}, stage = {}, change = {}, reply = {}, stderr = '', exit = 0, timeout = TIME_LIMIT, practice = true, platform = process.platform, bash } = {}) {
  const win = platform === 'win32';
  const shell = bash === undefined ? findBash({ platform }) : bash;
  if (win && !shell) return { windows: true };
  let text;
  try {
    text = execFileSync('git', ['show', `HEAD:./${script}`], { cwd: repo.dir, stdio: ['ignore', 'pipe', 'pipe'] });
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
    writeFileSync(join(base, 'bin', 'claude'), stubText(base, platform));
    chmodSync(join(base, 'bin', 'claude'), 0o755);
    writeFileSync(join(base, 'reply.json'), reply === null ? '' : `${JSON.stringify(reply)}\n`);
    writeFileSync(join(base, 'stderr'), stderr ? `${stderr}\n` : '');
    writeFileSync(join(base, 'exit'), `${exit}\n`);

    // The script may see the repository's path with symlinks resolved, or
    // on Windows with 8.3 names expanded.
    // Git Bash names it through its mounts too, as `/tmp/...` for the
    // temporary folder, so its own `pwd` is a root as well.
    const named = win ? [execFileSync(/** @type {string} */ (shell), ['-c', 'pwd'], { cwd: dir, env: scrubbed(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim()] : [];
    const roots = [...new Set([dir, realpathSync(dir), realpathSync.native(dir), ...named])];
    const git = (/** @type {string[]} */ ...a) => execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'user.name=Practice check', '-c', 'user.email=check@example.invalid', '-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${devNull}`, '-c', `core.excludesFile=${devNull}`, ...a], { cwd: dir, env: scrubbed(), stdio: ['ignore', 'pipe', 'pipe'] });
    git('init', '-q');
    writeFileSync(join(dir, '.git', 'info', 'exclude'), '.practice/\n');
    write(dir, { ...commit, [script]: text });
    chmodSync(join(dir, script), 0o755);
    git('add', '-A');
    git('commit', '-q', '--no-verify', '-m', 'Start');
    write(dir, stage);
    if (Object.keys(stage).length) git('add', '--', ...Object.keys(stage));
    write(dir, change);

    const finish = (/** @type {Omit<Ran, 'calls' | 'saved' | 'roots'>} */ run) => ({
      ...run,
      calls: calls(join(base, 'calls'), roots, platform),
      saved: { ...files(out, 'out'), ...files(join(dir, '.practice'), '.practice') },
      roots,
    });
    if (win) {
      // spawnSync's time limit would end bash alone, so tree-run.mjs ends
      // the whole process tree.
      const home = { HOME: slashed(join(base, 'home')), CLAUDE_CONFIG_DIR: slashed(join(base, 'config')) };
      const spec = { command: shell, args: [script, ...args(out)], cwd: dir, env: scrubbed(home, join(base, 'bin'), platform), timeout };
      const run = spawnSync(process.execPath, [TREE_RUN], { input: JSON.stringify(spec), encoding: 'utf8', timeout: timeout + 10_000, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
      /** @type {{ status?: number | null, signal?: NodeJS.Signals | null, timedOut?: boolean, error?: { code?: string, message: string }, stdout?: string, stderr?: string }} */
      let told = {};
      try {
        told = JSON.parse(run.stdout);
      } catch {
        told = { error: { message: run.error?.message ?? `tree-run exited with ${run.status}: ${(run.stderr ?? '').trim()}` } };
      }
      /** @type {NodeJS.ErrnoException | null} */
      let error = null;
      if (told.error) {
        error = new Error(told.error.message);
        if (told.error.code) error.code = told.error.code;
      }
      return finish({ status: told.status ?? null, signal: told.signal ?? null, timedOut: told.timedOut === true, error, stdout: told.stdout ?? '', stderr: told.stderr ?? '' });
    }

    // Node's types leave out spawnSync's `detached`, which it honours.
    const run = spawnSync('bash', [script, ...args(out)], /** @type {{ encoding: 'utf8' }} */ ({
      cwd: dir,
      env: scrubbed({ HOME: join(base, 'home'), CLAUDE_CONFIG_DIR: join(base, 'config') }, join(base, 'bin'), platform),
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
    return finish({
      status: run.status,
      signal: run.signal,
      timedOut: /** @type {NodeJS.ErrnoException | undefined} */ (run.error)?.code === 'ETIMEDOUT',
      error: run.error && /** @type {NodeJS.ErrnoException} */ (run.error).code !== 'ETIMEDOUT' ? run.error : null,
      stdout: run.stdout ?? '',
      stderr: run.stderr ?? '',
    });
  } finally {
    // On Windows something the script left running may still hold the
    // folder: retry, then leave it behind rather than fail the check.
    try {
      rmSync(base, { recursive: true, force: true, maxRetries: 5 });
    } catch {
      // Left in the temporary folder.
    }
  }
}

// The file in the scratch repository that `path`, an argument of `call`,
// names, as the call would open it: relative to the repository's root, in
// POSIX form, or null when it is outside the repository.
/**
 * @param {Stubbed} run
 * @param {{ cwd?: string | null }} call
 * @param {unknown} path
 * @param {string} [platform]
 */
export function scratchPath(run, call, path, platform = process.platform) {
  if (!run.roots || typeof path !== 'string' || !path) return null;
  if (platform === 'win32' ? win32.isAbsolute(path) : isAbsolute(path)) return within(run.roots, path, platform);
  if (call.cwd === null || call.cwd === undefined) return null;
  return within(run.roots, (platform === 'win32' ? win32.join : join)(/** @type {string} */ (run.roots[0]), call.cwd, path), platform);
}

const TREE_RUN = fileURLToPath(new URL('tree-run.mjs', import.meta.url));

// The Git Bash to run scripts with on Windows: bin/bash.exe or
// usr/bin/bash.exe in a folder above git's own (`git --exec-path`), never
// one under the Windows folder or WindowsApps, whose `bash` is WSL's
// launcher. Null when there is none; plain `bash` elsewhere.
/**
 * @param {{ platform?: string, execPath?: string, exists?: (path: string) => boolean, env?: Record<string, string | undefined> }} [options]
 * @returns {string | null}
 */
export function findBash({ platform = process.platform, execPath, exists = existsSync, env = process.env } = {}) {
  if (platform !== 'win32') return 'bash';
  let start = execPath;
  if (start === undefined) {
    try {
      start = execFileSync('git', ['--exec-path'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }).trim();
    } catch {
      return null;
    }
  }
  const fold = (/** @type {string} */ path) => slashed(path).replace(/\/+$/, '').toLowerCase();
  const rootKey = Object.keys(env).find((k) => /^systemroot$/i.test(k));
  const windows = fold((rootKey && env[rootKey]) || 'C:\\Windows');
  let dir = slashed(start).replace(/\/+$/, '');
  while (dir) {
    for (const candidate of [`${dir}/bin/bash.exe`, `${dir}/usr/bin/bash.exe`]) {
      if (!exists(candidate)) continue;
      const folded = fold(candidate);
      return folded.startsWith(`${windows}/`) || folded.includes('/windowsapps/') ? null : candidate;
    }
    const up = dir.lastIndexOf('/');
    if (up < 0) break;
    dir = dir.slice(0, up);
  }
  return null;
}

// The hint for a script the stand-in didn't run, or null when it ran.
/**
 * @param {Stubbed} run
 * @param {string} script
 */
export function notRun(run, script) {
  if (run.windows) return `The check didn't run \`${script}\`: on Windows it runs scripts with Git Bash and a stand-in for \`claude\`, and it found no Git Bash. Install Git for Windows, or run the check from WSL 2, macOS or Linux.`;
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
