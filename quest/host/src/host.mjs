// The lesson host (ticket 209): it runs the engine's effects through
// injected adapters, owns the clock and takes inputs one at a time. A
// client sends Learner actions with dispatch(), reads the snapshot with
// snapshot() and hears each change with subscribe(). Results, ticks, file
// activity and folder looks come in through the host's own input(), never
// from a client. Since ticket 212 it also holds what live delivery needs:
// a random instance ID, the revision, each event in its envelope with an
// ID `<instance>.<sequence>`, the recent events for a reconnect, and the
// pending milestones, all in memory only.
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  ACTION_TYPES,
  evidence,
  folderOf,
  initialState,
  introAsks,
  opensWithCheck,
  project,
  reduce,
  SLOW,
  startedLesson,
  statusStamp,
  stepOf,
  watching,
  workFolder,
} from "./engine.mjs";
import { oneAtATime, owing, singleFlight } from "./flight.mjs";
import { folderPath } from "./folders.mjs";
import { snapshot as toSave } from "./store.mjs";

export const TICK_MS = 1_000;
export const POLL_MS = 500;
export const POLL_CHECK_MS = 2_000;
export const POLL_GIT_MS = 2_000;
// Watcher events this soon after a save are the save's own.
export const SAVE_QUIET_MS = 400;
// The events kept for a reconnect to replay: the last 256, for up to 15
// minutes (spec, Live delivery).
export const EVENT_LIMIT = 256;
export const EVENT_KEEP_MS = 15 * 60_000;
// The actions a client sends: the engine's, and milestone.shown, which the
// host takes itself.
export const HOST_ACTION_TYPES = [...ACTION_TYPES, "milestone.shown"];

// The moments that stay pending until a tab shows them: a Lesson's first
// completion, a Level complete, the course complete, and the notice that
// the saved progress could not be read (ticket 213).
const isNotice = (e) =>
  e.type === "notice" &&
  (e.kind === "unreadable" || e.kind === "unreadable-kept");
const isMilestone = (e) =>
  (e.type === "lesson.completed" && e.firstTime) ||
  e.type === "level.completed" ||
  e.type === "course.completed" ||
  isNotice(e);
// Where the Learner is, for an action based on an older place: the lesson,
// its phase and the step on screen.
const placeOf = (s) =>
  JSON.stringify([
    s.lesson,
    s.phase,
    (s.phase === "playing" && s.beat) || s.phase === "step-down"
      ? stepOf(s).id
      : null,
  ]);

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
  // This process's instance: an event ID splits at its last ".".
  instance = randomUUID(),
}) {
  if (typeof instance !== "string" || !instance || instance.includes("."))
    throw new TypeError(`not an instance ID: ${instance}`);
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

  // What live delivery reads (ticket 212), in memory only: the revision,
  // which grows with each change; the last event's sequence number; the
  // revision at which the Learner's place last changed; the recent events,
  // each with when it happened on the host's clock; the pending
  // milestones, each with the lesson it came in; and the snapshot's view,
  // with its JSON to tell a change.
  let revision = 0;
  let seq = 0;
  let placeRevision = 0;
  let place = null;
  const ring = [];
  let milestones = [];
  let view = null;
  let viewJson = null;

  const snapshot = () =>
    view && {
      ...view,
      instance,
      revision,
      milestones: milestones.map((m) => m.envelope),
    };
  // The events older than 15 minutes, and any past the last 256, go.
  function evict() {
    const oldest = clock.now() - EVENT_KEEP_MS;
    while (ring.length > EVENT_LIMIT || ring[0]?.at < oldest) ring.shift();
  }
  const notify = (events, item) => {
    const heard = { revision, snapshot: snapshot(), events, input: item };
    for (const l of [...listeners]) l(heard);
  };

  // After a reduce: a lesson that starts playing lapses the milestones of
  // every other lesson; the revision grows where anything a tab sees
  // changed; and each event goes out in its envelope, kept for a reconnect,
  // a milestone pending too.
  function publish(prev, item, events) {
    const started = startedLesson(prev, state);
    const before = milestones.length;
    if (started !== null)
      milestones = milestones.filter(
        (m) => isNotice(m.envelope) || m.lesson === started,
      );
    const next = project(state);
    const json = JSON.stringify(next);
    if (events.length || milestones.length !== before || json !== viewJson)
      revision += 1;
    view = next;
    viewJson = json;
    const now = placeOf(state);
    if (now !== place) {
      place = now;
      placeRevision = revision;
    }
    const serverTime = clock.epoch();
    const at = clock.now();
    const envelopes = events.map((e) => ({
      id: `${instance}.${++seq}`,
      revision,
      serverTime,
      ...e,
    }));
    for (const envelope of envelopes) {
      ring.push({ at, envelope });
      if (isMilestone(envelope))
        milestones.push({ envelope, lesson: state.lesson });
    }
    evict();
    notify(envelopes, item);
  }

  // A tab showed a pending milestone: it goes, once. Never reduced.
  function shown(item) {
    const before = milestones.length;
    milestones = milestones.filter((m) => m.envelope.id !== item.id);
    if (milestones.length === before) return;
    revision += 1;
    notify([], item);
  }

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
        if (item.type === "milestone.shown") {
          shown(item);
          continue;
        }
        const prev = state;
        const r = engine.reduce(state, {
          now: clock.now(),
          epoch: clock.epoch(),
          ...item,
        });
        state = r.state;
        run(r.effects);
        if (!closed) watchWork();
        if (!closed) publish(prev, item, r.events ?? []);
      }
    } finally {
      busy = false;
    }
  }

  // When a check, git or probe child really starts: what it runs, the r
  // number it carries then and its folder, for the engine to tell the run
  // the card says "Checking" for. Like every input an effect causes, it
  // waits for the input that asked for the run to finish.
  const runStart = (run) =>
    queueMicrotask(() => !closed && input({ type: "run-start", ...run }));

  // One Check child at a time, whatever asked for it: a check, a probe, a
  // stamp's probe or a prerequisite's. Only the call that starts the child
  // waits in this lane, so nothing in it waits for another run in it. One
  // whose turn comes after close starts nothing.
  const lane = oneAtATime();
  const inLane = (fn) => lane(() => (closed ? { error: "closed" } : fn()));

  // Each run is in `dir`, the lesson's work folder, and its result says so:
  // the engine drops a result about a folder the lesson no longer uses. An
  // r while a run runs joins it when that run answers it: the same lesson,
  // folder and evidence, every item r asks for, and r's slow items if it
  // wants them. Its number is read as each input goes, so the run carries
  // the latest r's.
  const covers = ([lesson, items, ev, dir], flags, ask, { slow }) =>
    ask[0] === lesson &&
    ask[2] === ev &&
    ask[3] === dir &&
    (items == null ||
      (ask[1] != null && ask[1].every((i) => items.includes(i)))) &&
    (flags.slow || !slow);
  const check = owing(checkOnce, { covers });
  async function checkOnce(flags, lesson, items, ev, dir) {
    const { slow } = flags;
    // The evidence file's state before and after the run: if it changed while
    // the check ran, the result may be about the old file, so ask again.
    const before = ev ? files.stamp(dir, ev) : null;
    // Each item the child starts, for the checking label to count, with the
    // items this run was asked for.
    const onRunning = (n, m) =>
      !closed &&
      input({ type: "running", lesson, items, n, m, asked: flags.asked });
    // The child starts when its turn in the lane comes, not when the run was
    // asked for.
    const r = await inLane(() => {
      runStart({ run: "check", lesson, items, asked: flags.asked ?? 0, dir });
      return checks.run(dir, lesson, items, { slow, onRunning });
    });
    if (closed) return;
    // From here an r waits for another run: this one has answered.
    const asked = flags.report();
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
  }
  // `listed`: git lists each untracked file, for a beat on part of the tree.
  // `head`: and where HEAD is, for a head-moved beat (ticket 105).
  const gitRun = owing(async ({ asked }, dir, listed, head) => {
    runStart({ run: "git", asked: asked ?? 0, dir });
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
    const r = await inLane(() => {
      runStart({ run: "probe", name, asked: asked ?? 0, dir });
      return probes.run(dir, name, args);
    });
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
      const r = await inLane(() =>
        probes.run(e.dir, e.probe.name, e.probe.args),
      );
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
  // Each child waits its turn in the lane.
  const prereqs = singleFlight(async (e) => {
    for (const [at, req] of e.requires.entries()) {
      const found = await (req.path
        ? { read: files.bytes(e.dir, req.path) }
        : req.probe
          ? inLane(() => probes.run(e.dir, req.probe, req.args)).then((r) => ({
              pass: r.error ? null : r.pass,
              hint: r.hint ?? "",
            }))
          : inLane(() =>
              // A slow item runs as r runs it: a run without it would come
              // back a placeholder.
              (SLOW[req.lesson] ?? []).includes(req.item)
                ? checks.run(e.dir, req.lesson, [req.item], { slow: true })
                : checks.run(e.dir, req.lesson, [req.item]),
            ).then((r) => {
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
    // A save the store could not move aside is never written over, whatever
    // the store does.
    if (facts?.saveKept) return;
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
    instance,
    revision: () => revision,
    // The server's time, in epoch milliseconds, for a heartbeat.
    serverTime: () => clock.epoch(),
    // Git's first answers, then the first snapshot. Null where the host
    // closed while git answered.
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
        // A save the store could not move aside is never written over.
        saveKept: saved?.unreadable === "kept",
        ...given,
      };
      state = engine.initialState({
        course,
        saved,
        facts,
        now: clock.now(),
        epoch: clock.epoch(),
      });
      revision = 1;
      placeRevision = 1;
      place = placeOf(state);
      view = project(state);
      viewJson = JSON.stringify(view);
      // A save the store could not read: the first snapshot says so, a
      // pending milestone until a tab shows it.
      if (saved?.unreadable)
        input({
          type: "notice",
          kind: saved.unreadable === "moved" ? "unreadable" : "unreadable-kept",
        });
      return snapshot();
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
    // An action, with the instance and revision the tab showed when it sent
    // it. One based on an older place than the Learner's now (the lesson,
    // phase or step changed since), or on another instance's (a revision
    // this instance has not reached yet is one), applies nothing and comes
    // back `stale`; a milestone shown is never stale. The revision and
    // snapshot after it come back.
    dispatch(action, { revision: seen, instance: from } = {}) {
      const type = action?.type;
      if (!HOST_ACTION_TYPES.includes(type))
        throw new TypeError(`not an action: ${type}`);
      // The host's clock stamps every input: a client's own time is not one,
      // nor is its revision.
      const { now, revision: _, ...a } = action;
      if (
        state &&
        type !== "milestone.shown" &&
        ((from !== undefined && from !== instance) ||
          (typeof seen === "number" &&
            (seen < placeRevision || seen > revision)))
      )
        return { stale: true, revision, snapshot: snapshot() };
      input(a);
      return { revision, snapshot: snapshot() };
    },
    snapshot,
    // The events after the one with this ID, oldest first ([] when it is the
    // newest), or null when it is not one this instance still holds: then
    // nothing is replayed.
    eventsAfter(id) {
      evict();
      if (typeof id !== "string") return null;
      const dot = id.lastIndexOf(".");
      if (dot <= 0 || id.slice(0, dot) !== instance) return null;
      if (!/^[1-9]\d*$/.test(id.slice(dot + 1))) return null;
      const at = ring.findIndex((x) => x.envelope.id === id);
      return at < 0 ? null : ring.slice(at + 1).map((x) => x.envelope);
    },
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
