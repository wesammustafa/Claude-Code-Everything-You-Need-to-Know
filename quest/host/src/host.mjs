// The lesson host (ticket 209): it runs the engine's effects through
// injected adapters, owns the clock and takes inputs one at a time. A
// client sends Learner actions with dispatch(), reads the state with
// snapshot() and hears each input with subscribe(). Results, ticks, file
// activity and folder looks come in through the host's own input(), never
// from a client.
import { homedir } from "node:os";
import { join } from "node:path";
import {
  ACTION_TYPES,
  evidence,
  folderOf,
  initialState,
  introAsks,
  opensWithCheck,
  reduce,
  statusStamp,
  watching,
  workFolder,
} from "./engine.mjs";
import { owing, singleFlight } from "./flight.mjs";
import { folderPath } from "./folders.mjs";
import { snapshot as toSave } from "./store.mjs";

export const TICK_MS = 1_000;
export const POLL_MS = 500;
export const POLL_CHECK_MS = 2_000;
export const POLL_GIT_MS = 2_000;
// Watcher events this soon after a save are the save's own.
export const SAVE_QUIET_MS = 400;

/** @param {import("./types.mjs").HostOptions} options @returns {import("./types.mjs").Host} */
export function createHost({
  root,
  course,
  saved = null,
  env = {},
  platform = "linux",
  adapters,
  facts: given = {},
  // The real engine; a test may pass one that wraps it.
  engine = { reduce, initialState },
  ahead = null,
}) {
  const { clock, checks, probes, git, folders, files, store, commands } =
    adapters;
  const home = env.HOME || env.USERPROFILE || homedir();

  let state = null;
  let facts = null;
  let closed = false;
  let started = false;
  let lastSave = -Infinity;
  const intervals = [];
  let watcher = null;
  // The lesson's work folder and its watcher, where it is not the copy.
  let work = { dir: root, watcher: null };
  const listeners = new Set();

  // One input at a time, in the order they came: an input sent while one
  // is reduced (a listener's, or an adapter that answers at once) waits.
  const queue = [];
  let busy = false;
  function input(ev) {
    // Nothing is reduced before open() has the first state, or after close.
    if (closed || !state) return;
    queue.push(ev);
    if (busy) return;
    busy = true;
    try {
      while (queue.length && !closed) {
        const item = queue.shift();
        const r = engine.reduce(state, { now: clock.now(), ...item });
        state = r.state;
        run(r.effects);
        if (!closed) watchWork();
        if (!closed)
          for (const l of [...listeners])
            l({ state, input: item, events: r.events ?? [] });
      }
    } finally {
      busy = false;
    }
  }

  // When a check or git child really starts. Like every input an effect
  // causes, it waits for the input that asked for the run to finish.
  const runStart = () =>
    queueMicrotask(() => !closed && input({ type: "run-start" }));

  // Each run is in `dir`, the lesson's work folder, and its result says so:
  // the engine drops a result about a folder the lesson no longer uses.
  const check = owing(async ({ slow, asked }, lesson, items, ev, dir) => {
    // The evidence file's state before and after the run: if it changed while
    // the check ran, the result may be about the old file, so ask again.
    const before = ev ? files.stamp(dir, ev) : null;
    // The child starts now, not when the run was asked for: a run asked for
    // during another waits in line.
    runStart();
    // Each item the child starts, for the checking label to count, with the
    // items this run was asked for.
    const onRunning = (n, m) =>
      !closed && input({ type: "running", lesson, items, n, m, asked });
    const r = await checks.run(dir, lesson, items, { slow, onRunning });
    if (closed) return;
    if (r.error)
      return input({
        type: "check-error",
        lesson,
        message: r.error,
        asked,
        dir,
      });
    if (ev && files.stamp(dir, ev) !== before)
      return queueMicrotask(
        () => !closed && check({ slow, asked }, lesson, items, ev, dir),
      );
    input({
      type: "check",
      lesson,
      items: r.items,
      read: ev ? files.bytes(dir, ev) : null,
      path: ev ?? null,
      found: ev ? files.match(dir, ev) : null,
      stamp: before,
      asked,
      dir,
    });
  });
  // `listed`: git lists each untracked file, for a beat on part of the tree.
  // `head`: and where HEAD is, for a head-moved beat (ticket 105).
  const gitRun = owing(async ({ asked }, dir, listed, head) => {
    runStart();
    const r = await git.status(dir, { files: listed, head });
    if (closed) return;
    input(
      r.error
        ? { type: "git-error", message: r.error, asked, dir }
        : {
            type: "git",
            paths: r.paths,
            staged: r.staged,
            files: Boolean(listed),
            ...(head ? { head: r.head } : {}),
            asked,
            dir,
          },
    );
  });
  // A git probe (ticket 105), in the check child.
  const probe = owing(async ({ asked }, dir, name, args) => {
    runStart();
    const r = await probes.run(dir, name, args);
    if (closed) return;
    input(
      r.error
        ? { type: "probe-error", message: r.error, asked, dir }
        : {
            type: "probe",
            name,
            args,
            pass: r.pass,
            hint: r.hint,
            evidence: r.evidence,
            state: r.state,
            asked,
            dir,
          },
    );
  });
  // The state a stamp effect asks for: a file's, a probe's, where HEAD is or
  // what git status lists; null where it can't be known just now.
  async function stampNow(e) {
    if (e.probe) {
      const r = await probes.run(e.dir, e.probe.name, e.probe.args);
      return r.error ? null : r.state;
    }
    if (e.git) {
      const r = await git.status(e.dir, { head: e.git === "head" });
      return r.error
        ? null
        : e.git === "head"
          ? (r.head ?? "")
          : statusStamp(r.paths);
    }
    return files.stamp(e.dir, e.path);
  }

  // A file's bytes and its state, read now in the lesson's folder: local and
  // quick, with no process. The engine decides what they mean. A glob reads
  // the file it matches now, and says which (`found`).
  const file = (path, asked, dir) =>
    queueMicrotask(() => {
      if (closed) return;
      const found = files.match(dir, path);
      input({
        type: "file",
        path,
        found,
        read: found && files.bytes(dir, found),
        stamp: found ? files.stamp(dir, found) : "",
        asked: asked ?? 0,
        dir,
      });
    });

  // A lesson's prerequisites, in its work folder, in turn: a check item
  // through the check child, a file read as it is now, with no process. One
  // ask at a time; a later ask waits in line and takes the place of one
  // already waiting (singleFlight), and each answer carries its ask's number.
  const prereqs = singleFlight(async (e) => {
    for (const [at, req] of e.requires.entries()) {
      const found = await (req.path
        ? { read: files.bytes(e.dir, req.path) }
        : req.probe
          ? probes.run(e.dir, req.probe, req.args).then((r) => ({
              pass: r.error ? null : r.pass,
              hint: r.hint ?? "",
            }))
          : checks.run(e.dir, req.lesson, [req.item]).then((r) => {
              const item = r.items?.find((it) => it.index === req.item);
              return { pass: item ? item.pass : null };
            }));
      if (closed) return;
      input({
        type: "prereq",
        lesson: e.lesson,
        dir: e.dir,
        at,
        asked: e.asked,
        ...found,
      });
    }
  });

  // The path prompt's ask: what is at that path, for the engine to take or
  // turn down.
  async function lookAt(e) {
    const found = await folders.look(
      folderPath(e.text, root, home, facts.win32),
    );
    if (!closed)
      input({ type: "probed", key: e.key, asked: e.asked, ...found });
  }

  // A failed save (a read-only folder, a full disk, a file another program
  // holds) never stops the lesson: the learner sees a note and goes on.
  let saveError = null;
  function save() {
    lastSave = clock.now();
    try {
      store.save(toSave(state));
      saveError = null;
    } catch (error) {
      if (saveError === error.code) return;
      saveError = error.code;
      queueMicrotask(
        () =>
          !closed &&
          input({
            type: "notice",
            kind: "save",
            message: error.code ?? error.message,
          }),
      );
    }
  }

  function run(effects) {
    for (const e of effects) {
      if (e.type === "check") check(e, e.lesson, e.items, e.evidence, e.dir);
      else if (e.type === "file") file(e.path, e.asked, e.dir);
      else if (e.type === "stamp")
        stampNow(e).then(
          (stamp) =>
            !closed && input({ type: "stamp", key: e.key, stamp, dir: e.dir }),
        );
      else if (e.type === "git") gitRun(e, e.dir, e.files, e.head);
      else if (e.type === "probe") probe(e, e.dir, e.name, e.args);
      else if (e.type === "folder") lookAt(e);
      else if (e.type === "prereqs") prereqs(e);
      else if (e.type === "commands")
        queueMicrotask(
          () =>
            !closed &&
            input({
              type: "commands",
              found: Object.fromEntries(
                e.names.map((n) => [n, commands.has(n)]),
              ),
            }),
        );
      else if (e.type === "save") save();
      else throw new Error(`unknown effect: ${e.type}`);
    }
  }

  // Ask again for whatever the Learner waits on.
  function poke() {
    const w = watching(state);
    if (w?.check)
      check({}, w.check.lesson, w.check.items, evidence(state), w.dir);
    if (w?.file) file(w.file, 0, w.dir);
    if (w?.git) gitRun({}, w.dir, w.files, w.head);
    if (w?.probe) probe({}, w.dir, w.probe.name, w.probe.args);
  }

  // The copy is always watched: its .practice/ decides whether progress
  // saves. The lesson's work folder, where it is another, is watched too,
  // armed again whenever the lesson moves to another folder, or the step
  // does: a Worked example that runs in the copy (ticket 183) is watched
  // there alone.
  const changed = () => {
    if (closed || clock.now() - lastSave < SAVE_QUIET_MS) return;
    const practiceDir = files.exists(join(root, ".practice"));
    if (practiceDir !== state.facts.practiceDir)
      input({ type: "facts", facts: { practiceDir } });
    // Only a change the watcher saw counts as the Learner working (D1).
    input({ type: "activity" });
    poke();
    reprobe();
  };
  // A work folder whose look found something wrong is looked at again when
  // something changes, and on the poll, so its note goes once the learner
  // sets it right. One look at a time; a folder that was fine is left alone.
  let probing = false;
  let lastProbe = -Infinity;
  function reprobe() {
    const dir = folderOf(state);
    const found = dir && dir !== root ? state.probes[dir] : null;
    if (
      closed ||
      probing ||
      !found ||
      (!found.missing && found.git && found.practice)
    )
      return;
    probing = true;
    lastProbe = clock.now();
    folders.look(dir).then((f) => {
      probing = false;
      if (!closed) input({ type: "probed", ...f });
    });
  }
  function watchWork() {
    if (closed || !started) return;
    const dir = workFolder(state) ?? root;
    if (dir === work.dir) return;
    work.watcher?.close();
    work = { dir, watcher: dir === root ? null : adapters.watch(dir, changed) };
  }

  return {
    clock,
    // Git's first answers, then the first state. Null where the host closed
    // while git answered.
    async open() {
      const [gitError, name] = await git.ask(root);
      if (closed) return null;
      facts = {
        root,
        name,
        gitError,
        practiceDir: files.exists(join(root, ".practice")),
        codespace: env.CODESPACES === "true",
        win32: platform === "win32",
        linux: platform === "linux",
        ...given,
      };
      state = engine.initialState({ course, saved, facts, now: clock.now() });
      return state;
    },
    // The watchers, the tick and the poll, then what --dir and the saved
    // folders need: the answer --dir gave is saved, and each saved work
    // folder (the copy needs none) is looked at for the notes.
    start() {
      if (closed || started || !state) return;
      started = true;
      watcher = adapters.watch(root, changed);
      watchWork();
      intervals.push(clock.setInterval(() => input({ type: "tick" }), TICK_MS));
      let lastPoll = -Infinity;
      intervals.push(
        clock.setInterval(() => {
          if (clock.now() - lastProbe >= POLL_CHECK_MS) reprobe();
          const w = watching(state);
          if (
            !w ||
            clock.now() - lastPoll < (w.git ? POLL_GIT_MS : POLL_CHECK_MS)
          )
            return;
          lastPoll = clock.now();
          poke();
        }, POLL_MS),
      );
      if (ahead) save();
      for (const dir of new Set(Object.values(state.folders))) {
        if (dir === root) continue;
        if (dir === ahead?.path) input({ type: "probed", ...ahead });
        else
          folders
            .look(dir)
            .then((found) => !closed && input({ type: "probed", ...found }));
      }
    },
    // The first look: the current lesson's check, for "welcome back" and the
    // map, and what its overview asks about.
    firstLook() {
      if (closed || !state) return;
      if (opensWithCheck(state) && folderOf(state))
        check({}, state.lesson, null, null, folderOf(state));
      run(introAsks(state));
    },
    dispatch(action) {
      const type = action?.type;
      if (!ACTION_TYPES.includes(type))
        throw new TypeError(`not an action: ${type}`);
      // The host's clock stamps every input: a client's own time is not one.
      const { now, ...a } = action;
      input(a);
      return state;
    },
    snapshot: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    close() {
      if (closed) return;
      closed = true;
      for (const id of intervals) clock.clearInterval(id);
      watcher?.close();
      work.watcher?.close();
      adapters.stop();
    },
  };
}
