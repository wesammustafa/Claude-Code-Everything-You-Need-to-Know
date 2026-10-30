import type {
  EventEnvelope,
  Milestone,
  QuestAction,
  Snapshot,
} from "@quest/contract";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { envelope } from "../../test/events";
import {
  FakeEventSource,
  channelPair,
  fakeFetch,
  sharedLocks,
  type FakeAnswer,
  type FetchCall,
} from "../../test/live";
import {
  REACTION_KEEP_MS,
  createShownEvents,
  type EventLocks,
  type ShownChannel,
} from "./events";
import { BATCH_MS, createLiveStore, type LiveStore } from "./store";
import {
  BACKOFF_MAX_MS,
  HIDE_KEEP_MS,
  NOTICE_MS,
  SILENCE_MS,
  STOPPED_MS,
} from "./stream";

/** A snapshot with only what the store reads. */
function snap(
  instance: string,
  revision: number,
  milestones: Milestone[] = [],
): Snapshot {
  return { instance, revision, milestones } as unknown as Snapshot;
}

function milestoneOf(id: string, revision = 1): Milestone {
  return {
    id,
    revision,
    serverTime: 0,
    type: "lesson.completed",
    capstone: false,
    firstTime: true,
  };
}

interface Tab {
  store: LiveStore;
  disconnect: () => void;
  source: () => FakeEventSource;
  heard: string[][];
  calls: FetchCall[];
  setHidden: (hidden: boolean) => void;
}

let answer: (call: FetchCall) => FakeAnswer | Promise<FakeAnswer>;

/** One tab: a store on a fake stream, fetch and clock, its feed heard. */
function tab(
  options: {
    channel?: ShownChannel | null;
    locks?: EventLocks | null;
    hidden?: boolean;
    eventSource?: boolean;
  } = {},
): Tab {
  let hidden = options.hidden ?? false;
  const visibility = new Set<() => void>();
  const { fetch, calls } = fakeFetch((call) => answer(call));
  const store = createLiveStore({
    EventSource: options.eventSource === false ? null : FakeEventSource,
    setTimeout: (run, ms) => setTimeout(run, ms),
    clearTimeout: (handle) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    },
    hidden: () => hidden,
    onVisibility: (changed) => {
      visibility.add(changed);
      return () => visibility.delete(changed);
    },
    fetch,
    now: () => Date.now(),
    shown: () =>
      createShownEvents(
        options.channel ?? null,
        options.locks === undefined ? sharedLocks().locks : options.locks,
      ),
  });
  const disconnect = store.connect();
  const heard: string[][] = [];
  store.feed.subscribe((batch) => heard.push(batch.map((event) => event.id)));
  return {
    store,
    disconnect,
    // The newest stream: a test with two tabs reads each one's own.
    source: () => FakeEventSource.last,
    heard,
    calls,
    setHidden: (value) => {
      hidden = value;
      for (const changed of visibility) changed();
    },
  };
}

/** Lets timers and every queued microtask run. */
async function pass(ms = 0) {
  await vi.advanceTimersByTimeAsync(ms);
}

const emitEvent = (source: FakeEventSource, event: EventEnvelope) => {
  source.emit("event", event, event.id);
};

const ok = (snapshot: Snapshot): FakeAnswer => ({
  status: 200,
  body: { revision: snapshot.revision, snapshot },
});

beforeEach(() => {
  vi.useFakeTimers({ now: 1_000_000 });
  FakeEventSource.reset();
  answer = () => ({ status: 200, body: { ok: true, instance: "a" } });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("snapshots", () => {
  test("waits until the first snapshot, then is connected with actions enabled", () => {
    const { store, source } = tab();
    expect(store.getState()).toMatchObject({
      snapshot: null,
      connection: "waiting",
      actionsEnabled: false,
    });
    source().emit("snapshot", snap("a", 1));
    expect(store.getState()).toMatchObject({
      snapshot: snap("a", 1),
      connection: "connected",
      actionsEnabled: true,
    });
  });

  test("without an EventSource it stays waiting", () => {
    const { store } = tab({ eventSource: false });
    expect(FakeEventSource.made).toEqual([]);
    expect(store.getState().connection).toBe("waiting");
  });

  test("applies a snapshot only with a higher revision in the same instance", () => {
    const { store, source } = tab();
    source().emit("snapshot", snap("a", 3));
    source().emit("snapshot", snap("a", 2));
    source().emit("snapshot", snap("a", 3));
    expect(store.getState().snapshot?.revision).toBe(3);
    source().emit("snapshot", snap("a", 4));
    expect(store.getState().snapshot?.revision).toBe(4);
  });

  test("a new instance replaces everything held, at any revision, and forgets the last event ID", async () => {
    const { store, source } = tab();
    source().emit("snapshot", snap("a", 9));
    emitEvent(source(), envelope({ type: "answer.right" }, 9));
    source().emit("snapshot", snap("b", 1));
    expect(store.getState().snapshot).toEqual(snap("b", 1));
    source().fail();
    await pass(BACKOFF_MAX_MS);
    expect(FakeEventSource.last.url).toBe("/api/events");
  });

  test("a new instance keeps the shown ledger", async () => {
    const { source, heard } = tab();
    source().emit("snapshot", snap("a", 1));
    const event = envelope({ type: "answer.right" });
    emitEvent(source(), event);
    await pass(BATCH_MS);
    source().emit("snapshot", snap("b", 1));
    emitEvent(source(), event);
    await pass(BATCH_MS);
    expect(heard).toEqual([[event.id]]);
  });

  test("a frame that is not a snapshot is ignored", () => {
    const { store, source } = tab();
    source().emit("snapshot", { instance: "a" });
    expect(store.getState().connection).toBe("waiting");
  });
});

describe("events", () => {
  test("reach the feed once, a revision's events as one batch, never filtered by revision", async () => {
    const { source, heard } = tab();
    source().emit("snapshot", snap("a", 5));
    const a = envelope({ type: "check.started" }, 3);
    const b = envelope({ type: "check.passed", firstTime: true }, 3);
    const c = envelope({ type: "answer.right" }, 4);
    emitEvent(source(), a);
    emitEvent(source(), b);
    emitEvent(source(), c);
    emitEvent(source(), c);
    await pass(BATCH_MS);
    expect(heard).toEqual([[a.id, b.id], [c.id]]);
  });

  test("a reopen asks for the events after the last event frame's ID", async () => {
    const { source } = tab();
    source().emit("snapshot", snap("a", 1));
    emitEvent(source(), envelope({ type: "answer.right" }));
    const last = envelope({ type: "answer.wrong" });
    emitEvent(source(), last);
    source().emit("snapshot", snap("a", 2));
    source().fail();
    await pass(BACKOFF_MAX_MS);
    expect(FakeEventSource.last.url).toBe(
      `/api/events?after=${encodeURIComponent(last.id)}`,
    );
  });

  test("a milestone's event frame is neither routed nor claimed", async () => {
    const { locks, held } = sharedLocks();
    const { source, heard } = tab({ locks });
    source().emit("snapshot", snap("a", 1));
    emitEvent(
      source(),
      envelope({ type: "level.completed", level: "beginner" }),
    );
    emitEvent(
      source(),
      envelope({ type: "lesson.completed", capstone: false, firstTime: true }),
    );
    await pass(BATCH_MS);
    expect(heard).toEqual([]);
    expect(held.size).toBe(0);
  });

  test("two snapshots that differ, with no event and no pending milestone, make no moment", async () => {
    const { store, source, heard } = tab();
    source().emit("snapshot", snap("a", 1));
    const changed = {
      ...snap("a", 2),
      course: { levels: [], next: null },
    } as unknown as Snapshot;
    source().emit("snapshot", changed);
    await pass(BATCH_MS);
    expect(heard).toEqual([]);
    expect(store.getState().milestone).toBeNull();
  });
});

describe("a hidden tab's waiting Reaction", () => {
  test("only the newest plays when the tab returns", async () => {
    const page = tab({ hidden: true });
    page.source().emit("snapshot", snap("a", 1));
    page.source().emit("heartbeat", {
      serverTime: 5000,
      instance: "a",
      revision: 1,
    });
    const old = envelope({ type: "answer.wrong" }, 1, 4000);
    const newest = envelope({ type: "check.passed", firstTime: true }, 2, 4500);
    emitEvent(page.source(), old);
    await pass(BATCH_MS);
    emitEvent(page.source(), newest);
    await pass(BATCH_MS);
    expect(page.heard).toEqual([]);
    page.setHidden(false);
    await pass();
    expect(page.heard).toEqual([[newest.id]]);
  });

  test("is dropped past 15 minutes by the server's time, from the heartbeat's offset", async () => {
    const page = tab({ hidden: true });
    page.source().emit("snapshot", snap("a", 1));
    // The server's clock runs 1 hour behind the tab's.
    const server = Date.now() - 3_600_000;
    page.source().emit("heartbeat", {
      serverTime: server,
      instance: "a",
      revision: 1,
    });
    emitEvent(page.source(), envelope({ type: "answer.right" }, 1, server));
    await pass(BATCH_MS);
    // Within 2 minutes the stream stays; keep it alive while the time goes by.
    for (let gone = 0; gone < REACTION_KEEP_MS; gone += 15_000) {
      await pass(15_000);
      if (!FakeEventSource.last.closed)
        FakeEventSource.last.emit("heartbeat", {
          // The server's time when the beat is sent.
          serverTime: server + gone + 15_000,
          instance: "a",
          revision: 1,
        });
    }
    await pass(1);
    page.setHidden(false);
    await pass();
    expect(page.heard).toEqual([]);
  });

  test("a heartbeat sets the offset, down too after the tab's clock jumps forward", () => {
    const page = tab();
    page.source().emit("snapshot", snap("a", 1));
    const beat = (serverTime: number) => {
      page
        .source()
        .emit("heartbeat", { serverTime, instance: "a", revision: 1 });
    };
    beat(Date.now());
    expect(page.store.serverNow()).toBe(Date.now());
    // The tab's clock jumps an hour ahead; the server's does not.
    const server = Date.now();
    vi.setSystemTime(Date.now() + 3_600_000);
    beat(server);
    expect(page.store.serverNow()).toBe(server);
  });

  test("before any heartbeat, the newest event time heard stands for the server's clock", async () => {
    const page = tab({ hidden: true });
    page.source().emit("snapshot", snap("a", 1));
    const server = Date.now() + 3_600_000;
    // A replayed event from 20 minutes before a newer one.
    const old = envelope({ type: "answer.wrong" }, 1, server - 1_200_000);
    emitEvent(page.source(), old);
    await pass(BATCH_MS);
    page.setHidden(false);
    await pass();
    expect(page.heard).toEqual([[old.id]]);

    page.setHidden(true);
    const older = envelope({ type: "answer.right" }, 2, server - 1_200_000);
    emitEvent(
      page.source(),
      envelope({ type: "hint.shown", rung: 1 }, 3, server),
    );
    await pass(BATCH_MS);
    page.setHidden(false);
    await pass();
    // The newest batch played; then one older than 15 minutes by the newest
    // time seen is held and dropped.
    page.setHidden(true);
    emitEvent(page.source(), older);
    await pass(BATCH_MS);
    page.setHidden(false);
    await pass();
    expect(page.heard.flat()).not.toContain(older.id);
  });
});

describe("milestones", () => {
  test("the oldest pending one no tab showed, claimed and sent as milestone.shown", async () => {
    const { store, source, calls } = tab();
    const first = milestoneOf("a.1");
    const second = milestoneOf("a.2");
    source().emit("snapshot", snap("a", 3, [first, second]));
    expect(store.getState().milestone).toEqual(first);
    answer = () => ok(snap("a", 4, [second]));
    expect(await store.showMilestone(first.id)).toBe(true);
    await pass();
    expect(calls.map((call) => call.body)).toEqual([
      {
        action: { type: "milestone.shown", id: first.id },
        instance: "a",
        revision: 3,
      },
    ]);
    expect(store.getState().milestone).toEqual(second);
    expect(await store.showMilestone(first.id)).toBe(false);
  });

  test("a failed milestone.shown is sent once more while the next snapshot lists it, and never shown again", async () => {
    const { store, source, calls } = tab();
    const m = milestoneOf("a.1");
    source().emit("snapshot", snap("a", 1, [m]));
    answer = () => "fail";
    expect(await store.showMilestone(m.id)).toBe(true);
    await pass();
    expect(store.getState().milestone).toBeNull();
    source().emit("snapshot", snap("a", 2, [m]));
    await pass();
    expect(calls).toHaveLength(2);
    expect(store.getState().milestone).toBeNull();
    // Failed again: no third request.
    source().emit("snapshot", snap("a", 3, [m]));
    await pass();
    expect(calls).toHaveLength(2);
  });

  test("a failed milestone.shown is sent once more by a reconnect's snapshot at the same revision", async () => {
    const { store, source, calls } = tab();
    const m = milestoneOf("a.1");
    source().emit("snapshot", snap("a", 1, [m]));
    answer = () => "fail";
    await store.showMilestone(m.id);
    await pass();
    source().fail();
    await pass(BACKOFF_MAX_MS);
    answer = () => ok(snap("a", 2));
    FakeEventSource.last.emit("snapshot", snap("a", 1, [m]));
    await pass();
    expect(calls.map((call) => call.body)).toEqual([
      expect.objectContaining({ revision: 1 }),
      expect.objectContaining({
        action: { type: "milestone.shown", id: m.id },
        revision: 1,
      }),
    ]);
  });

  test("a failed milestone.shown whose milestone the next snapshot no longer lists is not sent again", async () => {
    const { store, source, calls } = tab();
    const m = milestoneOf("a.1");
    source().emit("snapshot", snap("a", 1, [m]));
    answer = () => ({ status: 503, body: { error: "starting" } });
    await store.showMilestone(m.id);
    await pass();
    source().emit("snapshot", snap("a", 2));
    await pass();
    expect(calls).toHaveLength(1);
  });
});

describe("no moment twice", () => {
  test("across two tabs: one milestone plays in one, with one milestone.shown", async () => {
    const [one, two] = channelPair();
    const { locks } = sharedLocks();
    const first = tab({ channel: one, locks });
    const firstSource = first.source();
    const second = tab({ channel: two, locks });
    const secondSource = FakeEventSource.last;
    const m = milestoneOf("a.1");
    firstSource.emit("snapshot", snap("a", 1, [m]));
    secondSource.emit("snapshot", snap("a", 1, [m]));
    answer = () => ok(snap("a", 2));
    const won = await Promise.all([
      first.store.showMilestone(m.id),
      second.store.showMilestone(m.id),
    ]);
    await pass();
    expect(won.filter(Boolean)).toEqual([true]);
    expect([...first.calls, ...second.calls]).toHaveLength(1);

    const event = envelope({ type: "check.passed", firstTime: true });
    emitEvent(firstSource, event);
    emitEvent(secondSource, event);
    await pass(BATCH_MS);
    expect([...first.heard, ...second.heard]).toEqual([[event.id]]);
  });

  test("across a reconnect whose replay overlaps what was heard", async () => {
    const { source, heard } = tab();
    source().emit("snapshot", snap("a", 2));
    const a = envelope({ type: "answer.right" }, 1);
    const b = envelope({ type: "answer.wrong" }, 2);
    emitEvent(source(), a);
    emitEvent(source(), b);
    await pass(BATCH_MS);
    source().fail();
    await pass(BACKOFF_MAX_MS);
    source().emit("snapshot", snap("a", 3));
    const c = envelope({ type: "hint.shown", rung: 1 }, 3);
    emitEvent(source(), a);
    emitEvent(source(), b);
    emitEvent(source(), c);
    await pass(BATCH_MS);
    expect(heard).toEqual([[a.id], [b.id], [c.id]]);
  });

  test("across a reload: a fresh tab after milestone.shown is not offered the milestone", async () => {
    const m = milestoneOf("a.1");
    const before = tab();
    before.source().emit("snapshot", snap("a", 1, [m]));
    answer = () => ok(snap("a", 2));
    await before.store.showMilestone(m.id);
    await pass();
    before.disconnect();
    // The reloaded page has a fresh ledger; the server's snapshot dropped it.
    const after = tab();
    after.source().emit("snapshot", snap("a", 2));
    expect(after.store.getState().milestone).toBeNull();
  });
});

describe("the connection", () => {
  test("a drop disables actions at once, shows Reconnecting at 3 s, and a snapshot clears it", async () => {
    const { store, source } = tab();
    source().emit("snapshot", snap("a", 1));
    source().fail();
    expect(store.getState()).toMatchObject({
      connection: "connected",
      actionsEnabled: false,
    });
    await pass(NOTICE_MS - 1);
    expect(store.getState().connection).toBe("connected");
    await pass(1);
    expect(store.getState().connection).toBe("reconnecting");
    FakeEventSource.last.emit("snapshot", snap("a", 1));
    expect(store.getState()).toMatchObject({
      connection: "connected",
      actionsEnabled: true,
      snapshot: snap("a", 1),
    });
  });

  test("a drop shorter than 3 s shows nothing", async () => {
    const { store, source } = tab();
    source().emit("snapshot", snap("a", 1));
    source().fail();
    await pass(1000);
    FakeEventSource.last.emit("snapshot", snap("a", 1));
    await pass(NOTICE_MS * 2);
    expect(store.getState().connection).toBe("connected");
  });

  test("40 seconds of silence counts as a drop", async () => {
    const { store, source } = tab();
    source().emit("snapshot", snap("a", 1));
    await pass(SILENCE_MS);
    expect(store.getState().actionsEnabled).toBe(false);
  });

  test("a stream answered 503 counts as a failure", async () => {
    const { store, source } = tab();
    source().emit("snapshot", snap("a", 1));
    // EventSource fires error on a non-200 answer.
    source().fail();
    await pass(NOTICE_MS);
    expect(store.getState().connection).toBe("reconnecting");
  });

  test("a failure before the first snapshot stays waiting, and stopped once health fails", async () => {
    const { store, source } = tab();
    source().fail();
    await pass(NOTICE_MS);
    expect(store.getState().connection).toBe("waiting");
    answer = () => "fail";
    await pass(STOPPED_MS - NOTICE_MS);
    expect(store.getState().connection).toBe("stopped");
  });

  test("from 15 s, a failing health request means stopped; a working one keeps Reconnecting", async () => {
    const { store, source, calls } = tab();
    source().emit("snapshot", snap("a", 1));
    source().fail();
    await pass(STOPPED_MS - 1);
    expect(calls).toEqual([]);
    await pass(1);
    expect(calls.map((call) => call.url)).toEqual(["/api/health"]);
    expect(store.getState().connection).toBe("reconnecting");
    answer = () => "fail";
    // Each later failure asks again.
    await pass(BACKOFF_MAX_MS);
    FakeEventSource.last.fail();
    await pass();
    expect(store.getState().connection).toBe("stopped");
    expect(calls.length).toBeGreaterThan(1);
    // A reconnect clears it quietly.
    await pass(BACKOFF_MAX_MS);
    FakeEventSource.last.emit("snapshot", snap("a", 1));
    expect(store.getState().connection).toBe("connected");
  });

  test("a health answer that is not ok counts as failing", async () => {
    const { store, source } = tab();
    answer = () => ({ status: 503, body: { error: "starting" } });
    source().fail();
    await pass(STOPPED_MS);
    expect(store.getState().connection).toBe("stopped");
  });

  test("hidden for 2 minutes is no drop", async () => {
    const page = tab();
    page.source().emit("snapshot", snap("a", 1));
    page.setHidden(true);
    for (let gone = 0; gone < HIDE_KEEP_MS + SILENCE_MS; gone += 15_000) {
      await pass(15_000);
      if (!FakeEventSource.last.closed)
        FakeEventSource.last.emit("heartbeat", {
          serverTime: 0,
          instance: "a",
          revision: 1,
        });
    }
    expect(page.store.getState().connection).toBe("connected");
  });

  test("a parked stream disables actions with no notice; the reopen's snapshot enables them", async () => {
    const page = tab();
    page.source().emit("snapshot", snap("a", 1));
    page.setHidden(true);
    for (let gone = 0; gone < HIDE_KEEP_MS; gone += 15_000) {
      await pass(15_000);
      if (!FakeEventSource.last.closed)
        FakeEventSource.last.emit("heartbeat", {
          serverTime: Date.now(),
          instance: "a",
          revision: 1,
        });
    }
    expect(FakeEventSource.last.closed).toBe(true);
    expect(page.store.getState()).toMatchObject({
      connection: "connected",
      actionsEnabled: false,
    });
    page.setHidden(false);
    expect(page.store.getState().actionsEnabled).toBe(false);
    FakeEventSource.last.emit("snapshot", snap("a", 1));
    expect(page.store.getState().actionsEnabled).toBe(true);
  });

  test("a disconnect leaves it waiting with actions disabled until the next connect's snapshot", () => {
    const page = tab();
    page.source().emit("snapshot", snap("a", 1));
    page.disconnect();
    expect(page.store.getState()).toMatchObject({
      connection: "waiting",
      actionsEnabled: false,
    });
    page.store.connect();
    expect(page.store.getState().actionsEnabled).toBe(false);
    FakeEventSource.last.emit("snapshot", snap("a", 1));
    expect(page.store.getState()).toMatchObject({
      connection: "connected",
      actionsEnabled: true,
    });
  });
});

describe("actions", () => {
  const action: QuestAction = { type: "welcome.finish" };

  test("are refused with no request while waiting, and after a drop", async () => {
    const { store, source, calls } = tab();
    expect(await store.act(action)).toEqual({ applied: false });
    source().emit("snapshot", snap("a", 1));
    source().fail();
    expect(await store.act(action)).toEqual({ applied: false });
    expect(calls).toEqual([]);
  });

  test("are POSTed as JSON, same-origin, with the instance and revision shown; a 200 applies its snapshot", async () => {
    const { store, source, calls } = tab();
    source().emit("snapshot", snap("a", 4));
    answer = () => ok(snap("a", 5));
    expect(await store.act(action)).toEqual({ applied: true });
    expect(calls[0]).toMatchObject({
      url: "/api/actions",
      method: "POST",
      body: { action, instance: "a", revision: 4 },
      init: {
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      },
    });
    expect(store.getState().snapshot?.revision).toBe(5);
  });

  test("a stale 409 applies the current snapshot and is not applied", async () => {
    const { store, source } = tab();
    source().emit("snapshot", snap("a", 4));
    answer = () => ({
      status: 409,
      body: { revision: 7, snapshot: snap("a", 7) },
    });
    expect(await store.act(action)).toEqual({ applied: false });
    expect(store.getState().snapshot?.revision).toBe(7);
  });

  test.each([
    [429, { error: "busy" }],
    [503, { error: "starting" }],
    [400, { error: "folder", reason: "not-repo-root" }],
    [400, { error: "invalid" }],
    [403, { error: "forbidden" }],
    [413, { error: "too large" }],
  ])(
    "a %i answers with its error and applies nothing",
    async (status, body) => {
      const { store, source } = tab();
      source().emit("snapshot", snap("a", 4));
      answer = () => ({ status, body });
      expect(await store.act(action)).toEqual({ applied: false, error: body });
      expect(store.getState().snapshot?.revision).toBe(4);
    },
  );

  test("a network failure applies nothing", async () => {
    const { store, source } = tab();
    source().emit("snapshot", snap("a", 4));
    answer = () => "fail";
    expect(await store.act(action)).toEqual({ applied: false });
  });

  test("its key is pending until the request settles", async () => {
    const { store, source } = tab();
    source().emit("snapshot", snap("a", 4));
    const { promise, resolve } = Promise.withResolvers<FakeAnswer>();
    answer = () => promise;
    const done = store.act(action, "finish");
    expect(store.getState().pending).toEqual(new Set(["finish"]));
    resolve(ok(snap("a", 5)));
    await done;
    expect(store.getState().pending).toEqual(new Set());
  });
});
