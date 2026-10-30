// Fake adapters for the host's tests (ticket 209): the clock, the Check
// child, git, folders, files, the watcher, the store and the PATH, all in
// memory. Each records what the host asked, and a test answers when it
// says, or at once where it gives an answer.
import { posix } from "node:path";
import { globName, isGlob, stampFor } from "./engine.mjs";

const turn = async () => {
  for (let i = 0; i < 3; i++) await new Promise((r) => setImmediate(r));
};

// A clock with timers. advance(ms) runs every timer that falls due, in time
// order (ties by the order they were set), each at its own time, and lets
// the event loop turn before and after each one. It reads `from` at first,
// and its wall clock `epoch0` more.
export function fakeClock(from = 1_000_000, epoch0 = 0) {
  let time = from;
  let seq = 0;
  const timers = new Map();
  const add = (fn, ms, every) => {
    seq += 1;
    timers.set(seq, { fn, due: time + Math.max(0, ms), every });
    return seq;
  };
  return {
    now: () => time,
    epoch: () => epoch0 + time,
    // Time passing inside a call, such as a slow write: no timer runs.
    spend: (ms) => {
      time += ms;
    },
    setTimeout: (fn, ms = 0) => add(fn, ms, null),
    setInterval: (fn, ms) => add(fn, ms, ms),
    clearTimeout: (id) => timers.delete(id),
    clearInterval: (id) => timers.delete(id),
    // The timers waiting, as { ms, every } from now.
    pending: () =>
      [...timers.values()].map((x) => ({ ms: x.due - time, every: x.every })),
    async advance(ms) {
      const end = time + ms;
      for (;;) {
        await turn();
        const next = [...timers.entries()]
          .filter(([, x]) => x.due <= end)
          .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
        if (!next) break;
        const [id, x] = next;
        time = x.due;
        if (x.every) x.due += x.every;
        else timers.delete(id);
        x.fn();
      }
      time = end;
      await turn();
    },
  };
}

// Runs the host asks for, held until the test resolves them, or answered at
// once by `answer(call)` where it returns a result.
function heldRuns(answer, shape) {
  const calls = [];
  return {
    calls,
    held: () => calls.filter((c) => !c.done),
    run(...args) {
      const call = shape(...args);
      calls.push(call);
      return new Promise((resolve) => {
        call.resolve = (result) => {
          call.done = true;
          resolve(result);
        };
        const now = answer?.(call);
        if (now !== undefined) call.resolve(now);
      });
    },
  };
}

// An in-memory tree: absolute paths to { bytes, mtimeMs }, or to a folder.
// A read of a path `fail` names throws its code.
function fakeFiles(tree = {}) {
  const entries = new Map();
  const failing = new Map();
  let clock = 1_000;
  const files = {
    write(abs, text, mtimeMs = (clock += 1)) {
      for (
        let d = posix.dirname(abs);
        d !== posix.dirname(d);
        d = posix.dirname(d)
      )
        if (!entries.has(d)) entries.set(d, { folder: true });
      entries.set(abs, { bytes: Buffer.from(text), mtimeMs });
    },
    folder(abs) {
      entries.set(abs, { folder: true });
    },
    remove(abs) {
      for (const k of [...entries.keys()])
        if (k === abs || k.startsWith(`${abs}/`)) entries.delete(k);
    },
    fail(abs, code) {
      if (code) failing.set(abs, code);
      else failing.delete(abs);
    },
    exists: (abs) => entries.has(abs),
    isFolder: (abs) => entries.get(abs)?.folder === true,
    match(dir, path) {
      if (!isGlob(path)) return path;
      const folder = posix.dirname(path);
      const name = globName(posix.basename(path));
      const at = posix.join(dir, folder);
      if (!entries.get(at)?.folder) return null;
      let best = null;
      for (const [k, e] of entries) {
        const base = posix.basename(k);
        if (e.folder || posix.dirname(k) !== at || !name.test(base)) continue;
        if (
          !best ||
          e.mtimeMs > best.at ||
          (e.mtimeMs === best.at && base < best.name)
        )
          best = { at: e.mtimeMs, name: base };
      }
      return best && posix.join(folder, best.name);
    },
    bytes(dir, path) {
      const abs = posix.join(dir, files.match(dir, path) ?? path);
      const e = entries.get(abs);
      return failing.has(abs) || !e || e.folder ? null : e.bytes;
    },
    stamp(dir, path) {
      const found = files.match(dir, path);
      if (found === null) return "";
      const abs = posix.join(dir, found);
      const code = failing.get(abs);
      if (code) return code === "ENOENT" || code === "ENOTDIR" ? "" : null;
      const e = entries.get(abs);
      // A folder can't be read (EISDIR).
      if (!e) return "";
      return e.folder ? null : stampFor(e.mtimeMs, e.bytes);
    },
  };
  for (const [abs, text] of Object.entries(tree))
    if (text === null) files.folder(abs);
    else files.write(abs, text);
  return files;
}

/**
 * The fake adapters: `root` is the practice copy; `tree` its files and
 * folders ({ abs: text, or null for a folder }); `checks` and `probes`
 * answer a call at once where they return a result; `git` is { ask, status }
 * (ask: the pair, or a function; status: a function, else held calls);
 * `folders` maps a path to its look (missing by default); `commands` names
 * what is on the PATH; `saved` is what the store loads.
 */
export function fakeAdapters({
  root = "/copy",
  clock = fakeClock(),
  tree = {},
  checks: checkAnswer,
  probes: probeAnswer,
  git: { ask = [null, "Sam"], status } = {},
  folders: looks = {},
  commands: names = [],
  saved = null,
} = {}) {
  const files = fakeFiles(tree);
  const checks = heldRuns(checkAnswer, (dir, lesson, items, opts = {}) => ({
    dir,
    lesson,
    items,
    slow: opts.slow ?? false,
    onRunning: opts.onRunning ?? (() => {}),
  }));
  const probes = heldRuns(probeAnswer, (dir, name, args) => ({
    dir,
    name,
    args,
  }));
  const gitCalls = heldRuns(
    status && ((call) => status(call.dir, call.opts)),
    (dir, opts = {}) => ({ dir, opts }),
  );
  const asked = [];
  const arms = [];
  let failing = null;
  const adapters = {
    clock,
    files,
    checks,
    probes,
    git: {
      asked,
      calls: gitCalls.calls,
      held: gitCalls.held,
      ask(dir) {
        asked.push(dir);
        return typeof ask === "function" ? ask(dir) : Promise.resolve(ask);
      },
      status: gitCalls.run,
    },
    folders: {
      looked: [],
      look(path) {
        adapters.folders.looked.push(path);
        return Promise.resolve(
          looks[path] ?? {
            path,
            missing: true,
            git: false,
            gitBroken: null,
            practice: false,
          },
        );
      },
    },
    watch(dir, onChange) {
      const arm = { dir, onChange, closed: false };
      arms.push(arm);
      return {
        close() {
          arm.closed = true;
        },
      };
    },
    // The watchers armed and not closed, by folder, in the order armed.
    armed: () => arms.filter((a) => !a.closed).map((a) => a.dir),
    arms,
    // A change the watcher on `dir` saw, after its debounce.
    fire(dir) {
      for (const a of arms) if (!a.closed && a.dir === dir) a.onChange();
    },
    store: {
      saves: [],
      load: () => saved,
      save(data) {
        if (failing) throw Object.assign(new Error("save failed"), failing);
        const practice = posix.join(root, ".practice");
        if (!files.exists(practice)) return false;
        if (!files.isFolder(practice))
          throw Object.assign(new Error("not a folder"), { code: "ENOTDIR" });
        adapters.store.saves.push(data);
        return true;
      },
      // Every save from now throws an error with this code (null: none).
      fail(code) {
        failing = code === null ? null : { code };
      },
    },
    commands: {
      names: new Set(names),
      has: (n) => adapters.commands.names.has(n),
    },
    stopped: 0,
    stop() {
      adapters.stopped += 1;
    },
  };
  return adapters;
}
