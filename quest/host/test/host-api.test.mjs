// The host's interface on fake adapters (ticket 209): what dispatch takes,
// the clock's stamp, the listener, one input at a time, the effects it
// runs, and opening, starting and closing. The raw state is read through
// the tapped engine: the host gives a client only the snapshot.
import { test } from "vitest";
import assert from "node:assert/strict";
import { ACTION_TYPES } from "../src/engine.mjs";
import { HOST_ACTION_TYPES } from "../src/host.mjs";
import {
  AT_W3,
  fakeHost,
  PRACTICE,
  ROOT,
  scripted,
  turn,
  typesOf,
  w3,
} from "./scripted.mjs";

const MINE = "/home/sam/mine";
const OTHER = "/home/sam/other";
const fine = (path) => ({
  path,
  missing: false,
  git: true,
  gitBroken: null,
  practice: true,
});

test("dispatch takes exactly HOST_ACTION_TYPES, the engine's actions and milestone.shown; a key input is a TypeError", async () => {
  assert.deepEqual(HOST_ACTION_TYPES, [...ACTION_TYPES, "milestone.shown"]);
  const { host, heard } = fakeHost({ saved: AT_W3 });
  await host.open();
  for (const type of [
    "check",
    "tick",
    "key",
    "paste",
    "flush",
    "probed",
    undefined,
  ])
    assert.throws(() => host.dispatch({ type }), {
      name: "TypeError",
      message: `not an action: ${type}`,
    });
  assert.equal(heard.length, 0, "nothing was reduced");
  // Each with the fields some action reads.
  const fields = { lesson: "b-1", option: 0, text: "x", help: "planned" };
  for (const type of HOST_ACTION_TYPES) host.dispatch({ type, ...fields });
  // A milestone no tab has pending changes nothing, so no one hears it.
  assert.deepEqual(typesOf(heard), ACTION_TYPES);
});

test("the host's clock stamps every input: a client's own now is dropped, and an input the host makes keeps its own", async () => {
  const { host, clock, heard, adapters, state, tapped } = fakeHost({
    saved: { ...AT_W3, folders: { intermediate: MINE } },
    folders: { [MINE]: { ...fine(MINE), now: 7 } },
  });
  await host.open();
  clock.spend(500);
  host.dispatch({ type: "lesson.open", lesson: "b-1", now: 5, revision: 1 });
  assert.equal("now" in heard[0].input, false);
  assert.equal("revision" in heard[0].input, false);
  assert.equal(state().now, clock.now());
  host.start();
  await turn();
  assert.deepEqual(adapters.folders.looked, [MINE]);
  const probed = tapped.states.find((x) => x.input.type === "probed");
  assert.equal(probed.state.now, 7, "the look's own now");
});

test("snapshot is null before open, then the snapshot of the state the last input left; dispatch gives the revision and snapshot after it", async () => {
  const { host } = fakeHost({ saved: AT_W3 });
  assert.equal(host.snapshot(), null);
  assert.deepEqual(
    host.dispatch({ type: "lesson.open", lesson: "b-1" }),
    { revision: 0, snapshot: null },
    "nothing to reduce before open",
  );
  const s = await host.open();
  assert.deepEqual(host.snapshot(), s);
  assert.equal(s.revision, 1);
  const after = host.dispatch({ type: "lesson.open", lesson: "b-1" });
  assert.deepEqual(after, { revision: 2, snapshot: host.snapshot() });
  assert.equal(after.snapshot.lesson.phase, "playing");
});

test("each listener hears each input once, with the revision and snapshot after it and its events, never the state, until it unsubscribes", async () => {
  const { host } = fakeHost({ saved: AT_W3 });
  await host.open();
  const one = [];
  const off = host.subscribe((h) => one.push(h));
  host.dispatch({ type: "lesson.open", lesson: "b-1" });
  assert.equal(one.length, 1);
  assert.deepEqual(Object.keys(one[0]).sort(), [
    "events",
    "input",
    "revision",
    "snapshot",
  ]);
  assert.deepEqual(one[0].input, { type: "lesson.open", lesson: "b-1" });
  assert.deepEqual(one[0].snapshot, host.snapshot());
  assert.equal(one[0].revision, host.revision());
  assert.deepEqual(one[0].events, []);
  off();
  host.dispatch({ type: "hint.next" });
  assert.equal(one.length, 1);
});

test("one input at a time: an answer that comes at once and a listener that dispatches wait their turn, in order", async () => {
  const { engine, log } = scripted();
  const { host } = fakeHost({
    saved: AT_W3,
    engine,
    checks: (call) => {
      call.onRunning(1, 1);
      return w3(false);
    },
  });
  await host.open();
  let sent = false;
  host.subscribe(({ input }) => {
    if (input.type === "lesson.open" && !sent) {
      sent = true;
      host.dispatch({ type: "hint.next" });
    }
  });
  host.dispatch({ type: "lesson.open", lesson: "b-1" });
  await turn();
  assert.deepEqual(
    log.slice(0, 3).map((x) => x.type),
    ["lesson.open", "running", "hint.next"],
  );
  assert.ok(
    log.every((x) => x.depth === 1),
    JSON.stringify(log.map((x) => [x.type, x.depth])),
  );
  assert.deepEqual(
    log.map((x) => x.type).filter((t) => ["run-start", "check"].includes(t)),
    ["run-start", "check"],
  );
});

test("an effect the host doesn't run is an error", async () => {
  const { engine } = scripted({
    effects: { "hint.next": [{ type: "terminal", text: "x" }] },
  });
  const { host } = fakeHost({ saved: AT_W3, engine });
  await host.open();
  assert.throws(() => host.dispatch({ type: "hint.next" }), {
    message: "unknown effect: terminal",
  });
  // The queue is free again.
  host.dispatch({ type: "step.continue" });
});

test("open: git's answers and the copy make the facts, and the client's facts go over the host's", async () => {
  const { host, adapters, state } = fakeHost({
    saved: AT_W3,
    git: { ask: ["this folder is not a git repository", "Ana"] },
    env: { CODESPACES: "true" },
    facts: { win32: true, clipboard: true },
  });
  const s = await host.open();
  assert.deepEqual(adapters.git.asked, [ROOT]);
  assert.deepEqual([s.learner.name, s.learner.windows], ["Ana", true]);
  assert.deepEqual(state().facts, {
    root: ROOT,
    name: "Ana",
    gitError: "this folder is not a git repository",
    practiceDir: true,
    codespace: true,
    win32: true,
    linux: true,
    clipboard: true,
  });
  const none = fakeHost({ saved: AT_W3, tree: {} });
  await none.host.open();
  assert.equal(none.state().facts.practiceDir, false);
});

test("start arms the copy's watcher, then the tick, then the poll; saves the folder --dir gave and looks at every saved work folder", async () => {
  const { host, adapters, clock, heard, state } = fakeHost({
    saved: { ...AT_W3, folders: { intermediate: MINE, advanced: OTHER } },
    ahead: fine(MINE),
    folders: { [OTHER]: fine(OTHER) },
  });
  await host.open();
  assert.deepEqual(
    [adapters.armed(), clock.pending()],
    [[], []],
    "open starts nothing",
  );
  host.start();
  assert.deepEqual(adapters.armed(), [ROOT]);
  assert.deepEqual(clock.pending(), [
    { ms: 1_000, every: 1_000 },
    { ms: 500, every: 500 },
  ]);
  assert.equal(adapters.store.saves.length, 1, "--dir's answer is saved");
  // --dir's look is used as it is; the other folder is looked at.
  assert.deepEqual(adapters.folders.looked, [OTHER]);
  assert.deepEqual(
    heard.map((h) => [h.input.type, h.input.path]),
    [["probed", MINE]],
  );
  await turn();
  assert.deepEqual(
    heard.map((h) => h.input.path),
    [MINE, OTHER],
  );
  assert.deepEqual(Object.keys(state().probes).sort(), [MINE, OTHER]);
  host.start();
  assert.equal(clock.pending().length, 2, "a second start starts nothing more");
});

test("firstLook: a Learner welcomed back runs the lesson's check, then what its overview asks", async () => {
  const back = fakeHost({ saved: AT_W3 });
  await back.host.open();
  back.host.start();
  back.host.firstLook();
  assert.deepEqual(
    back.adapters.checks.calls.map((c) => [c.dir, c.lesson, c.items, c.slow]),
    [[ROOT, "b-1", null, false]],
  );
  const fresh = fakeHost();
  await fresh.host.open();
  fresh.host.firstLook();
  assert.equal(
    fresh.adapters.checks.calls.length,
    0,
    "a first launch looks at nothing",
  );
  const done = fakeHost({
    saved: { ...AT_W3, lessons: { "b-1": { complete: true } } },
  });
  await done.host.open();
  done.host.firstLook();
  assert.equal(
    done.adapters.checks.calls.length,
    0,
    "nor does a lesson already complete",
  );
});

test("close stops the clock, the watchers and the children, and nothing that answers later is heard", async () => {
  const { host, adapters, clock, heard } = fakeHost({
    saved: { ...AT_W3, folders: { intermediate: MINE } },
  });
  await host.open();
  host.start();
  host.dispatch({ type: "lesson.open", lesson: "b-1" });
  const n = heard.length;
  assert.equal(adapters.checks.held().length, 1);
  host.close();
  host.close();
  assert.deepEqual(clock.pending(), []);
  assert.deepEqual(adapters.armed(), []);
  assert.equal(adapters.stopped, 1, "once, however often it closes");
  adapters.checks.held()[0].resolve(w3(true));
  adapters.fire(ROOT);
  await clock.advance(5_000);
  assert.equal(heard.length, n, "nothing after close");
  assert.deepEqual(host.dispatch({ type: "hint.next" }), {
    revision: host.revision(),
    snapshot: host.snapshot(),
  });
  assert.equal(heard.length, n);
});

test("close while git answers: open gives null, and start arms nothing", async () => {
  let answer;
  const { host, adapters, clock } = fakeHost({
    saved: AT_W3,
    git: { ask: () => new Promise((r) => (answer = r)) },
  });
  const opening = host.open();
  host.close();
  answer([null, "Sam"]);
  assert.equal(await opening, null);
  assert.equal(host.snapshot(), null);
  host.start();
  host.firstLook();
  assert.deepEqual(
    [adapters.armed(), clock.pending(), adapters.checks.calls],
    [[], [], []],
  );
});

test("a clock whose intervals have no id still closes", async () => {
  const { host, adapters, clock } = fakeHost({ saved: AT_W3 });
  const ids = [];
  Object.assign(clock, {
    setInterval: () => 0,
    clearInterval: (id) => ids.push(id),
  });
  await host.open();
  host.start();
  host.close();
  assert.deepEqual(ids, [0, 0]);
});

test("the practice copy without .practice/ saves nothing, and says nothing about it", async () => {
  const { host, adapters, heard } = fakeHost({ saved: AT_W3, tree: {} });
  await host.open();
  host.dispatch({ type: "lesson.open", lesson: "b-1" });
  await turn();
  assert.deepEqual(adapters.store.saves, []);
  assert.ok(!typesOf(heard).includes("notice"));
  adapters.files.folder(PRACTICE);
  host.dispatch({ type: "lesson.restart", lesson: "b-1" });
  assert.equal(adapters.store.saves.length, 1);
});
