// Asking the lesson's own check, and git, without blocking the screen. Both
// run in child processes; the app writes nothing to the practice copy.
import { execFile } from 'node:child_process';
import { accessSync, constants, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUB_RUNS } from '../../checks/lessons/a-4.mjs';
import { NPM_TEST_LIMIT } from '../../checks/lessons/b-3.mjs';
import { lessons } from '../../checks/lessons/index.mjs';
import { statusEntries } from '../../checks/paths.mjs';
import { TIME_LIMIT } from '../../checks/stub-claude.mjs';
import { globName, isGlob, SLOW } from './content.mjs';
import { stampFor } from './holds.mjs';
import { isStaged, listing } from './status.mjs';

const RUN_CHECK = join(dirname(fileURLToPath(import.meta.url)), '..', 'run-check.mjs');

// The environment for every child: git must not hold .git/index.lock while
// the learner or Claude Code commits, and no color codes in what we parse.
export function childEnv(env = process.env) {
  const { NODE_TEST_CONTEXT, ...rest } = env;
  return { ...rest, GIT_OPTIONAL_LOCKS: '0', NO_COLOR: '1' };
}

// How long the check child may run each item, from that item's start: the
// slowest items' own limits (b-3's npm test; a-4's script, run once in each
// of its scenarios), with room for the git and node around them. So the slow
// items of one run add up without ending it, items that share what a run
// found (a-7's) stay in one child, and a run of m items ends within m + 1
// times this, its start counting as one. i-capstone's hook item has no
// limit of its own: it runs each hook script it finds twice (hooks.mjs
// runCommitted), so enough scripts that hang still end the run.
export const ITEM_LIMIT = Math.max(NPM_TEST_LIMIT, STUB_RUNS * TIME_LIMIT) + 30_000;

// Runs `items` of a lesson's check (all when null). Slow items are left out
// unless `slow` is set, and come back marked `slow` so the screen can say
// "press r". As the child starts each item, onRunning(n, m) hears that it
// is on the nth of the m items it runs. An item still running `limit` ms
// after it started stops the child; only tests pass a shorter one.
export function runCheck(dir, lesson, items, { slow = false, onRunning = () => {}, limit = ITEM_LIMIT } = {}) {
  const all = lessons[lesson].items.map((_, i) => i);
  const skipped = slow ? [] : (SLOW[lesson] ?? []).filter((i) => (items ?? all).includes(i));
  const wanted = (items ?? all).filter((i) => !skipped.includes(i));
  const placeholders = skipped.map((index) => ({ index, text: lessons[lesson].items[index].text, pass: false, slow: true, hint: '' }));
  if (!wanted.length) return Promise.resolve({ items: placeholders });
  return new Promise((resolve) => {
    let timer;
    const child = track(execFile(process.execPath, [RUN_CHECK, lesson, dir, ...wanted.map(String)], { env: childEnv(), windowsHide: true, maxBuffer: 4 << 20 }, (error, stdout) => {
      clearTimeout(timer);
      try {
        const out = JSON.parse(stdout.trim().split('\n').pop());
        if (out.error) return resolve({ error: out.error });
        resolve({ items: [...out.items, ...placeholders].sort((a, b) => a.index - b.index) });
      } catch {
        resolve({ error: error ? (error.killed ? 'it took too long' : error.message.split('\n')[0]) : 'it printed something unexpected' });
      }
    }));
    // The clock starts with the child, and again as each item starts.
    const limitFrom = () => {
      clearTimeout(timer);
      timer = setTimeout(() => child.kill(), limit);
    };
    limitFrom();
    // The child's reports, a line each; anything else on stderr is skipped.
    let rest = '';
    child.stderr.on('data', (chunk) => {
      const lines = (rest + chunk).split('\n');
      rest = lines.pop();
      for (const line of lines) {
        let n;
        try {
          n = JSON.parse(line).running;
        } catch {}
        if (!Number.isInteger(n)) continue;
        limitFrom();
        onRunning(n, wanted.length);
      }
    });
  });
}

// Runs one git probe (checks/probes.mjs, ticket 105) in the check child, in
// `dir`: { pass, hint, evidence, state }, or { error }. It never fetches.
export function runProbe(dir, name, args, { limit = ITEM_LIMIT } = {}) {
  return new Promise((resolve) => {
    track(execFile(process.execPath, [RUN_CHECK, '--probe', name, dir, ...args], { env: { ...childEnv(), GIT_NO_LAZY_FETCH: '1' }, windowsHide: true, timeout: limit, maxBuffer: 1 << 20 }, (error, stdout) => {
      try {
        const out = JSON.parse(stdout.trim().split('\n').pop());
        resolve(out.error ? { error: out.error } : { pass: out.pass, hint: out.hint, evidence: out.evidence, state: out.state });
      } catch {
        resolve({ error: error ? (error.killed ? 'it took too long' : error.message.split('\n')[0]) : 'it printed something unexpected' });
      }
    }));
  });
}

// What git status lists in `dir`, and which of those paths are staged. With
// `files`, a look at part of the tree: each untracked file on its own line,
// where git status lists a new folder whole, and only what is in `dir`,
// named from there, where `dir` is a folder inside a repository. With
// `head`, also the commit HEAD is at (ticket 105), null before the first.
export function gitStatus(dir, { files = false, head = false } = {}) {
  const opts = { cwd: dir, env: childEnv(), windowsHide: true, timeout: 30_000 };
  if (head) {
    return new Promise((resolve) => {
      track(execFile('git', ['rev-parse', '--verify', '-q', 'HEAD'], opts, (error, stdout) => {
        const at = error ? null : stdout.trim() || null;
        gitStatus(dir, { files }).then((r) => resolve(r.error ? r : { ...r, head: at }));
      }));
    });
  }
  return new Promise((resolve) => {
    const failed = (error) => resolve({ error: error.message.split('\n')[0] });
    if (!files) {
      track(execFile('git', ['status', '--porcelain'], opts, (error, stdout) => {
        if (error) return failed(error);
        const entries = statusEntries(stdout);
        resolve({ paths: entries.map((e) => e.path), staged: entries.filter(isStaged).map((e) => e.path) });
      }));
      return;
    }
    track(execFile('git', ['rev-parse', '--show-prefix'], opts, (error, prefix) => {
      if (error) return failed(error);
      track(execFile('git', ['status', '--porcelain', '--untracked-files=all', '--', '.'], opts, (again, stdout) => {
        if (again) failed(again);
        else resolve(listing(statusEntries(stdout), prefix.trim()));
      }));
    }));
  });
}

const NOT_A_REPO = 'this folder is not a git repository';
export function gitReady(dir) {
  return new Promise((resolve) => {
    execFile('git', ['rev-parse', '--is-inside-work-tree'], { cwd: dir, env: childEnv(), windowsHide: true, timeout: 30_000 }, (error) => {
      resolve(error ? (error.code === 'ENOENT' ? 'git is not installed' : error.killed ? 'git did not answer in time' : NOT_A_REPO) : null);
    });
  });
}

// What a work folder is (ticket 86): whether it is a folder at all, whether
// git says it is a repository, and whether git ignores the `.practice/`
// folder the lessons save to. The folder itself may not exist yet: a new
// copy of the template ignores it before a step makes it (r27 a-5); a file
// of that name holds nothing. Read, never changed. `gitBroken` is why git
// could not say (not installed, no answer), null where it did.
export async function probeFolder(path) {
  let folder = false;
  try {
    folder = statSync(path).isDirectory();
  } catch {}
  if (!folder) return { path, missing: true, git: false, gitBroken: null, practice: false };
  const said = await gitReady(path);
  const git = said === null;
  const gitBroken = said && said !== NOT_A_REPO ? said : null;
  let notFolder = false;
  try {
    notFolder = !statSync(join(path, '.practice')).isDirectory();
  } catch {}
  const practice = git && !notFolder && (await new Promise((resolve) => {
    execFile('git', ['check-ignore', '-q', '.practice/'], { cwd: path, env: childEnv(), windowsHide: true, timeout: 30_000 }, (error) => resolve(!error));
  }));
  return { path, missing: false, git, gitBroken, practice };
}

// Whether a command is on the PATH (ticket 89): a file of its name in one
// of the PATH folders that may run, or on Windows one with an extension
// PATHEXT lists. Found by reading the folders: no process starts, so
// nothing the learner installed runs.
export function onPath(name, env = process.env, platform = process.platform) {
  const win = platform === 'win32';
  // Windows names it Path as often as PATH.
  const get = (key) => env[Object.keys(env).find((k) => k.toUpperCase() === key) ?? key];
  const dirs = (get('PATH') ?? '').split(win ? ';' : ':').map((d) => d.replace(/^"(.*)"$/, '$1')).filter(Boolean);
  const exts = win ? (get('PATHEXT') ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : [''];
  return dirs.some((dir) => exts.some((ext) => {
    try {
      const file = join(dir, name + ext);
      if (!statSync(file).isFile()) return false;
      if (!win) accessSync(file, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }));
}

// The first word of git's user.name, to say hello. Read, never stored.
export function gitFirstName(dir) {
  return new Promise((resolve) => {
    execFile('git', ['config', 'user.name'], { cwd: dir, env: childEnv(), windowsHide: true, timeout: 30_000 }, (error, stdout) => {
      resolve(error ? '' : (stdout.trim().split(/\s+/)[0] ?? '').slice(0, 20));
    });
  });
}

// The file a path names: itself, or for a glob the newest file that matches
// it (the last one written, so the one Claude just made), null when none
// does. Named as the beat names it, from the work folder.
export function matchOf(dir, path) {
  if (!isGlob(path)) return path;
  const folder = posix.dirname(path);
  const name = globName(posix.basename(path));
  let best = null;
  try {
    for (const e of readdirSync(join(dir, folder), { withFileTypes: true })) {
      if (!e.isFile() || !name.test(e.name)) continue;
      const at = statSync(join(dir, folder, e.name)).mtimeMs;
      if (!best || at > best.at || (at === best.at && e.name < best.name)) best = { at, name: e.name };
    }
  } catch {
    return null;
  }
  return best && posix.join(folder, best.name);
}

// A file's bytes as they are now, for the reducer to read what it holds
// (holds.mjs); null when it isn't there or can't be read just now.
export function bytesOf(dir, path) {
  try {
    return readFileSync(join(dir, matchOf(dir, path) ?? path));
  } catch {
    return null;
  }
}

// What a file is now, to tell whether it changed: its time, size and
// content. An empty string when it doesn't exist, and null when it can't be
// read just now (another program holds it, or its permissions changed).
export function stampOf(dir, path) {
  try {
    const found = matchOf(dir, path);
    if (found === null) return '';
    const file = join(dir, found);
    return stampFor(statSync(file).mtimeMs, readFileSync(file));
  } catch (error) {
    return error.code === 'ENOENT' || error.code === 'ENOTDIR' ? '' : null;
  }
}

// Children still running, so quitting can stop them.
const children = new Set();
const track = (child) => {
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
};
export function stopChildren() {
  for (const child of children) child.kill();
  children.clear();
}

// One run at a time; a request during a run schedules exactly one more.
export function singleFlight(fn) {
  let running = null;
  let again = null;
  const go = (...args) => {
    if (running) {
      again = args;
      return running;
    }
    running = Promise.resolve(fn(...args)).finally(() => {
      running = null;
      if (again) {
        const next = again;
        again = null;
        go(...next);
      }
    });
    return running;
  };
  return go;
}

// A run asked for during another waits in line, and a later ask takes its
// place (singleFlight). What r asked for stays owed until a run starts:
// its slow items, and `asked`, the latest r's number, which goes back on
// the result so the card knows that r's run ended. Only while the ask that
// takes its place is for the same lesson (the first argument): another
// lesson's run is not r's, and r's run will not come.
export function owing(fn) {
  const none = { slow: false, asked: 0, lesson: undefined };
  let owed = none;
  const go = singleFlight((...args) => {
    const flags = owed;
    owed = none;
    return fn(flags, ...args);
  });
  return ({ slow, asked } = {}, ...args) => {
    const was = owed.lesson === args[0] ? owed : none;
    owed = { slow: was.slow || Boolean(slow), asked: Math.max(was.asked, asked ?? 0), lesson: args[0] };
    return go(...args);
  };
}
