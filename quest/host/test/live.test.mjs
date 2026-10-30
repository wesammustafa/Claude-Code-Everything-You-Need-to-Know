// What the host keeps for live delivery (ticket 212), on fake adapters with
// a pinned instance: each event in its envelope, the revision, the recent
// events a reconnect reads, the pending milestones, a stale place, and the
// failed-save notice. All of it is in memory: a new host starts over.
import { test } from "vitest";
import assert from "node:assert/strict";
import { initialState, reduce } from "../src/engine.mjs";
import { EVENT_KEEP_MS, EVENT_LIMIT, POLL_CHECK_MS } from "../src/host.mjs";
import {
  course,
  DEMO_I1,
  finishedBefore,
  threeLevels,
} from "../../engine/test/drive.mjs";
import { AT_W3, fakeHost, turn, w3 } from "./scripted.mjs";

const MINE = "/home/sam/mine";
const b1 = course.find((l) => l.id === "b-1");
// b-1 saved at its last beat, a self beat: one step.markDone finishes it.
const AT_END = {
  format: 1,
  welcomed: true,
  lessons: {
    "b-1": {
      step: "C",
      beat: 2,
      done: b1.content.steps.map((x) => x.id).filter((id) => id !== "C"),
    },
  },
};

// A host at b-1's last beat, its lesson on screen.
async function atEnd(options = {}) {
  const h = fakeHost({ instance: "i1", course, saved: AT_END, ...options });
  await h.host.open();
  h.host.dispatch({ type: "lesson.open", lesson: "b-1" });
  return h;
}
const finish = (host) => host.dispatch({ type: "step.markDone" });
const pendingIds = (host) => host.snapshot().milestones.map((m) => m.id);

// The real engine, with one notice event for each folder.cancel (an action
// that changes nothing), so a test can fill the ring.
const noisy = {
  initialState,
  reduce(state, input) {
    const r = reduce(state, input);
    return input.type === "folder.cancel"
      ? { ...r, events: [...r.events, { type: "notice", kind: "test" }] }
      : r;
  },
};

test("each event goes out in its envelope: an ID <instance>.<n> that grows, the revision of its input and the server's time", async () => {
  const { host, heard, clock } = await atEnd();
  const before = host.revision();
  const r = finish(host);
  const events = heard.at(-1).events;
  assert.deepEqual(
    events.map((e) => e.type),
    ["step.completed", "lesson.completed"],
  );
  assert.equal(r.revision, before + 1, "one input, one revision");
  assert.deepEqual(
    events.map((e) => [e.id, e.revision, e.serverTime]),
    [
      ["i1.1", r.revision, clock.epoch()],
      ["i1.2", r.revision, clock.epoch()],
    ],
  );
  assert.deepEqual(events[1], {
    id: "i1.2",
    revision: r.revision,
    serverTime: clock.epoch(),
    type: "lesson.completed",
    badge: b1.content.badge,
    capstone: false,
    firstTime: true,
  });
  assert.equal(heard.at(-1).revision, r.revision);
  assert.equal(heard.at(-1).snapshot.revision, r.revision);
  assert.equal(host.snapshot().instance, "i1");
});

test("the revision holds where nothing a tab sees changed: a refused action, a tick, an identical poll", async () => {
  const { host, clock } = fakeHost({
    instance: "i1",
    saved: AT_W3,
    checks: () => w3(false),
  });
  await host.open();
  host.start();
  host.firstLook();
  await turn();
  clock.spend(POLL_CHECK_MS);
  await turn();
  const settled = host.revision();
  const snap = JSON.stringify(host.snapshot());
  // A check beat: nothing to mark done.
  assert.deepEqual(host.dispatch({ type: "step.markDone" }).revision, settled);
  for (let i = 0; i < 3; i++) {
    clock.spend(POLL_CHECK_MS);
    await turn();
  }
  assert.equal(host.revision(), settled, "the same Not yet, polled again");
  assert.equal(JSON.stringify(host.snapshot()), snap);
});

test("the ring keeps the last 256 events: the 257th evicts the first", async () => {
  const { host } = fakeHost({ instance: "i1", engine: noisy });
  await host.open();
  for (let i = 0; i < EVENT_LIMIT; i++)
    host.dispatch({ type: "folder.cancel" });
  assert.equal(host.eventsAfter("i1.1").length, EVENT_LIMIT - 1);
  assert.deepEqual(host.eventsAfter(`i1.${EVENT_LIMIT}`), []);
  host.dispatch({ type: "folder.cancel" });
  assert.equal(host.eventsAfter("i1.1"), null, "evicted");
  assert.deepEqual(
    host.eventsAfter("i1.2").map((e) => e.id),
    Array.from({ length: EVENT_LIMIT - 1 }, (_, i) => `i1.${i + 3}`),
  );
});

test("an event older than 15 minutes goes, by the host's clock", async () => {
  const { host, clock } = fakeHost({ instance: "i1", engine: noisy });
  await host.open();
  host.dispatch({ type: "folder.cancel" });
  clock.spend(EVENT_KEEP_MS - 1);
  host.dispatch({ type: "folder.cancel" });
  assert.deepEqual(
    host.eventsAfter("i1.1").map((e) => e.id),
    ["i1.2"],
  );
  clock.spend(2);
  assert.equal(host.eventsAfter("i1.1"), null, "past 15 minutes");
  assert.deepEqual(host.eventsAfter("i1.2"), []);
  clock.spend(EVENT_KEEP_MS);
  assert.equal(host.eventsAfter("i1.2"), null);
});

test("eventsAfter: the events after a held ID, oldest first; [] after the newest; null for one it can't replay from", async () => {
  const { host } = fakeHost({ instance: "i1", engine: noisy });
  await host.open();
  for (let i = 0; i < 3; i++) host.dispatch({ type: "folder.cancel" });
  assert.deepEqual(
    host.eventsAfter("i1.1").map((e) => [e.id, e.type, e.kind]),
    [
      ["i1.2", "notice", "test"],
      ["i1.3", "notice", "test"],
    ],
  );
  assert.deepEqual(host.eventsAfter("i1.3"), []);
  for (const id of [
    "i1.4",
    "i1.0",
    "i1.01",
    "i1.x",
    "i1.",
    ".1",
    "i1",
    "i2.1",
    "",
    null,
    undefined,
    7,
  ])
    assert.equal(host.eventsAfter(id), null, String(id));
});

test("an instance ID with a dot is refused: an event ID splits at its last dot", () => {
  assert.throws(() => fakeHost({ instance: "a.b" }), {
    name: "TypeError",
  });
});

test("a milestone is pending until a tab shows it, and goes once", async () => {
  const { host, heard } = await atEnd();
  finish(host);
  const [id] = pendingIds(host);
  assert.equal(id, "i1.2");
  assert.equal(host.snapshot().milestones[0].type, "lesson.completed");
  const before = host.revision();
  const heardBefore = heard.length;
  // A milestone shown is never stale, whatever revision the tab saw.
  const r = host.dispatch({ type: "milestone.shown", id }, { revision: 0 });
  assert.equal(r.stale, undefined);
  assert.deepEqual(pendingIds(host), []);
  assert.equal(r.revision, before + 1);
  assert.equal(heard.length, heardBefore + 1);
  assert.deepEqual(heard.at(-1).events, []);
  // Again, or one never pending: nothing changes and no one hears it.
  host.dispatch({ type: "milestone.shown", id });
  host.dispatch({ type: "milestone.shown", id: "i1.99" });
  assert.equal(host.revision(), before + 1);
  assert.equal(heard.length, heardBefore + 1);
});

test("a milestone lapses when another lesson starts playing, and stays on its overview and on a replay of its own lesson", async () => {
  const { host, state } = await atEnd();
  finish(host);
  const pending = pendingIds(host);
  // The next lesson's overview: not started yet.
  host.dispatch({ type: "lesson.next" });
  assert.equal(state().phase, "overview");
  assert.equal(state().lesson, "b-2");
  assert.deepEqual(pendingIds(host), pending);
  // Back to b-1, replayed: its own milestone stays.
  host.dispatch({ type: "lesson.open", lesson: "b-1" });
  host.dispatch({ type: "lesson.start", help: "planned" });
  assert.equal(state().phase, "playing");
  assert.equal(state().lesson, "b-1");
  assert.deepEqual(pendingIds(host), pending);
  // b-2 starts playing: b-1's milestone lapses.
  const before = host.revision();
  host.dispatch({ type: "lesson.open", lesson: "b-2" });
  host.dispatch({ type: "lesson.start", help: "planned" });
  assert.equal(state().phase, "playing");
  assert.equal(state().lesson, "b-2");
  assert.deepEqual(pendingIds(host), []);
  assert.ok(host.revision() > before);
});

test("a new host over the same save: no milestone pending, a new instance, IDs that never meet the old ones", async () => {
  const first = await atEnd();
  finish(first.host);
  const saved = first.adapters.store.saves.at(-1);
  assert.equal(saved.lessons["b-1"].complete, true);
  const second = fakeHost({ instance: "i2", course, saved });
  await second.host.open();
  assert.deepEqual(pendingIds(second.host), []);
  assert.equal(second.host.snapshot().instance, "i2");
  second.host.dispatch({ type: "lesson.open", lesson: "b-1" });
  second.host.dispatch({ type: "lesson.restart", lesson: "b-1" });
  second.host.dispatch({ type: "lesson.start", help: "planned" });
  second.host.dispatch({ type: "step.continue" });
  const ids = [first, second].map(({ heard }) =>
    heard.flatMap((h) => h.events.map((e) => e.id)),
  );
  assert.ok(ids[0].every((id) => id.startsWith("i1.")));
  assert.ok(ids[1].every((id) => id.startsWith("i2.")));
  assert.equal(second.host.eventsAfter(ids[0][0]), null);
  assert.equal(first.host.eventsAfter("i2.1"), null);
});

test("two hosts with no instance given: each a random one, and neither replays the other's events", async () => {
  const a = fakeHost({ engine: noisy });
  const b = fakeHost({ engine: noisy });
  await Promise.all([a.host.open(), b.host.open()]);
  assert.notEqual(a.host.instance, b.host.instance);
  assert.ok(!a.host.instance.includes("."));
  a.host.dispatch({ type: "folder.cancel" });
  b.host.dispatch({ type: "folder.cancel" });
  const [ea] = a.heard.at(-1).events;
  const [eb] = b.heard.at(-1).events;
  assert.equal(ea.id, `${a.host.instance}.1`);
  assert.equal(eb.id, `${b.host.instance}.1`);
  assert.equal(a.host.eventsAfter(eb.id), null);
  assert.deepEqual(b.host.eventsAfter(eb.id), []);
});

test("dispatch gives the revision and snapshot after the action; one sent from an older place applies nothing and comes back stale", async () => {
  const { host, heard, state } = fakeHost({ instance: "i1", saved: AT_W3 });
  assert.equal((await host.open()).revision, 1);
  const seen = host.dispatch({ type: "lesson.open", lesson: "b-1" }).revision;
  assert.equal(state().pos.beat, 0);
  // The Learner steps back to W2: the place changed.
  const back = host.dispatch({ type: "step.back" }, { revision: seen });
  assert.equal(back.stale, undefined);
  assert.ok(back.revision > seen);
  assert.deepEqual(back.snapshot, host.snapshot());
  const step = state().pos.step;
  const count = heard.length;
  // A tab still on W3 asks to step back again.
  const stale = host.dispatch({ type: "step.back" }, { revision: seen });
  assert.deepEqual(stale, {
    stale: true,
    revision: back.revision,
    snapshot: host.snapshot(),
  });
  assert.equal(state().pos.step, step, "nothing applied");
  assert.equal(heard.length, count, "nothing reduced");
  // The same action from the place now applies; one with no revision too.
  const now = host.dispatch(
    { type: "step.continue" },
    { revision: back.revision },
  );
  assert.equal(now.stale, undefined);
  assert.equal(heard.length, count + 1);
  host.dispatch({ type: "step.back" });
  assert.equal(heard.length, count + 2);
});

test("an action from another instance's tab is stale: one that names that instance, and a revision this one has not reached", async () => {
  const { host, heard } = fakeHost({ instance: "i2", saved: AT_W3 });
  await host.open();
  const at = host.dispatch({ type: "lesson.open", lesson: "b-1" }).revision;
  const count = heard.length;
  for (const opts of [
    { instance: "i1", revision: at },
    { revision: at + 40 },
    { instance: "i1", revision: at + 40 },
  ])
    assert.deepEqual(
      host.dispatch({ type: "step.back" }, opts),
      { stale: true, revision: at, snapshot: host.snapshot() },
      JSON.stringify(opts),
    );
  assert.equal(heard.length, count, "nothing reduced");
  // A milestone shown is never stale.
  assert.equal(
    host.dispatch(
      { type: "milestone.shown", id: "i1.1" },
      { instance: "i1", revision: at + 40 },
    ).stale,
    undefined,
  );
  // This instance's own place now applies.
  const own = host.dispatch(
    { type: "step.back" },
    { instance: "i2", revision: at },
  );
  assert.equal(own.stale, undefined);
  assert.ok(heard.length > count);
});

test("an unknown action type throws, and nothing is reduced", async () => {
  const { host, heard } = fakeHost({ instance: "i1", saved: AT_W3 });
  await host.open();
  for (const type of ["tick", "notice", "run-start", "nope", undefined])
    assert.throws(() => host.dispatch({ type }), { name: "TypeError" });
  assert.equal(heard.length, 0);
});

test("a failed save sends one notice event of kind save", async () => {
  const { host, adapters, heard } = await atEnd();
  adapters.store.fail("EACCES");
  finish(host);
  await turn();
  const notices = heard
    .flatMap((h) => h.events)
    .filter((e) => e.type === "notice");
  assert.equal(notices.length, 1);
  assert.deepEqual(
    { ...notices[0], id: undefined, revision: undefined, serverTime: 0 },
    {
      id: undefined,
      revision: undefined,
      serverTime: 0,
      type: "notice",
      kind: "save",
    },
  );
  // The same reason again sends none.
  host.dispatch({ type: "lesson.next" });
  await turn();
  assert.equal(
    heard.flatMap((h) => h.events).filter((e) => e.type === "notice").length,
    1,
  );
});

// The lesson parser refuses a slow item as a prerequisite, so the course is
// patched after parsing: the host's guard is for a course the parser let by.
test("a prerequisite's slow check item runs as r runs it, with slow (D13)", async () => {
  const i1 = DEMO_I1.replace(
    "next: i-2\n---",
    "next: i-2\nrequires: [b-5 check 0, b-2 check 1]\n---",
  );
  const lessons = threeLevels({ "i-1": i1 }).map((l) =>
    l.id === "i-1"
      ? {
          ...l,
          content: {
            ...l.content,
            requires: l.content.requires.map((r) =>
              r.lesson === "b-2" ? { ...r, item: 2 } : r,
            ),
          },
        }
      : l,
  );
  const { host, adapters } = fakeHost({
    instance: "i1",
    course: lessons,
    saved: {
      format: 1,
      welcomed: true,
      lessons: finishedBefore("i-1", lessons),
      folders: { intermediate: MINE },
    },
    checks: (call) => ({
      items: (call.items ?? [0]).map((index) => ({
        index,
        text: "item",
        pass: true,
        hint: "",
      })),
    }),
  });
  await host.open();
  host.firstLook();
  await turn();
  assert.deepEqual(
    adapters.checks.calls
      .filter((c) => c.lesson !== "i-1")
      .map((c) => [c.lesson, c.items, c.slow]),
    [
      ["b-5", [0], false],
      ["b-2", [2], true],
    ],
  );
});
