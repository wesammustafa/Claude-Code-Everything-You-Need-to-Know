import type { EventEnvelope } from "@quest/contract";
import { describe, expect, test, vi } from "vitest";
import { envelope } from "../../test/events";
import {
  EVENT_LOCK_PREFIX,
  LOCAL_EVENTS,
  SHOWN_LIMIT,
  createLocalEventFeed,
  createShownEvents,
  onceAcrossTabs,
  type EventFeed,
  type EventLocks,
  type ShownChannel,
} from "./events";

/** Two tabs' channels, joined: what one posts, the other hears, asynchronously as a BroadcastChannel does. */
function channelPair() {
  const make = () => {
    const listeners = new Set<(event: MessageEvent) => void>();
    let peer: { deliver: (data: unknown) => void } | undefined;
    const channel = {
      /** What a message from the other tab does on arrival. */
      deliver(data: unknown) {
        for (const listener of listeners)
          listener(new MessageEvent("message", { data }));
      },
      postMessage(data: unknown) {
        const target = peer;
        queueMicrotask(() => target?.deliver(structuredClone(data)));
      },
      addEventListener(
        _type: "message",
        listener: (event: MessageEvent) => void,
      ) {
        listeners.add(listener);
      },
      removeEventListener(
        _type: "message",
        listener: (event: MessageEvent) => void,
      ) {
        listeners.delete(listener);
      },
      close: vi.fn(),
      link(other: { deliver: (data: unknown) => void }) {
        peer = other;
      },
    };
    return channel;
  };
  const a = make();
  const b = make();
  a.link(b);
  b.link(a);
  return [a, b] satisfies [ShownChannel, ShownChannel];
}

/** A feed the test pushes batches into. */
function manualFeed() {
  let push: (events: readonly EventEnvelope[]) => void = () => undefined;
  const feed: EventFeed = {
    subscribe(listener) {
      push = listener;
      return () => {
        push = () => undefined;
      };
    },
  };
  return {
    feed,
    push: (...events: EventEnvelope[]) => {
      push(events);
    },
  };
}

/**
 * The page's tabs' shared Web Locks: a request is answered asynchronously, as
 * the browser answers it (here on a microtask, so a test can wait for every
 * answer), and a lock is held until its callback's promise settles.
 */
function sharedLocks() {
  const held = new Set<string>();
  const locks: EventLocks = {
    async request(name, _options, callback) {
      await Promise.resolve();
      if (held.has(name)) return callback(null);
      held.add(name);
      try {
        await callback({ name, mode: "exclusive" });
      } finally {
        held.delete(name);
      }
    },
  };
  return { locks, held };
}

/**
 * Lets every queued lock request, message and delivery run: all of them are
 * microtasks, which run before the next task.
 */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

const ids = (batches: (readonly EventEnvelope[])[]) =>
  batches.map((batch) => batch.map((event) => event.id));

describe("the page's local event source", () => {
  test("delivers each dispatch as one batch of well-formed envelopes", () => {
    const target = new EventTarget();
    const heard: (readonly EventEnvelope[])[] = [];
    const stop = createLocalEventFeed(target).subscribe((batch) =>
      heard.push(batch),
    );
    const passed = envelope({ type: "check.passed", firstTime: true });
    const progress = envelope({ type: "check.progress", n: 1, m: 2 });
    target.dispatchEvent(
      new CustomEvent(LOCAL_EVENTS, {
        detail: [passed, { id: "x", type: "nonsense" }, progress],
      }),
    );
    expect(heard).toEqual([[passed, progress]]);

    stop();
    target.dispatchEvent(new CustomEvent(LOCAL_EVENTS, { detail: [passed] }));
    expect(heard).toHaveLength(1);
  });

  test("ignores a dispatch with no envelope in it", () => {
    const target = new EventTarget();
    const listener = vi.fn();
    createLocalEventFeed(target).subscribe(listener);
    target.dispatchEvent(new CustomEvent(LOCAL_EVENTS, { detail: "nope" }));
    target.dispatchEvent(new CustomEvent(LOCAL_EVENTS, { detail: [{}] }));
    target.dispatchEvent(new Event(LOCAL_EVENTS));
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("each event ID at most once", () => {
  test("in one tab: a repeat, within a batch or later, is dropped, and batches keep their order", async () => {
    const { feed, push } = manualFeed();
    const heard: (readonly EventEnvelope[])[] = [];
    onceAcrossTabs(
      feed,
      createShownEvents(null, sharedLocks().locks),
      () => true,
    ).subscribe((batch) => heard.push(batch));
    const a = envelope({ type: "answer.right" });
    const b = envelope({ type: "answer.wrong" });
    const c = envelope({ type: "work.changed" });
    push(a, a, b);
    push(a);
    push(b, c);
    await settled();
    expect(ids(heard)).toEqual([[a.id, b.id], [c.id]]);
  });

  test("across tabs: an ID both visible tabs hear at the same moment plays in exactly one", async () => {
    const [one, two] = channelPair();
    const { locks } = sharedLocks();
    const first = manualFeed();
    const second = manualFeed();
    const heardFirst: (readonly EventEnvelope[])[] = [];
    const heardSecond: (readonly EventEnvelope[])[] = [];
    onceAcrossTabs(
      first.feed,
      createShownEvents(one, locks),
      () => true,
    ).subscribe((batch) => heardFirst.push(batch));
    onceAcrossTabs(
      second.feed,
      createShownEvents(two, locks),
      () => true,
    ).subscribe((batch) => heardSecond.push(batch));

    const shared = envelope({ type: "check.passed", firstTime: true });
    first.push(shared);
    second.push(shared);
    await settled();
    expect([...heardFirst, ...heardSecond]).toEqual([[shared]]);
  });

  test("across tabs: the winner keeps the lock, so a tab the message has not reached yet still drops the ID", async () => {
    const { locks, held } = sharedLocks();
    const first = manualFeed();
    const second = manualFeed();
    const heardSecond: (readonly EventEnvelope[])[] = [];
    // No channel between them: only the lock tells the second tab.
    onceAcrossTabs(
      first.feed,
      createShownEvents(null, locks),
      () => true,
    ).subscribe(() => undefined);
    onceAcrossTabs(
      second.feed,
      createShownEvents(null, locks),
      () => true,
    ).subscribe((batch) => heardSecond.push(batch));

    const event = envelope({ type: "answer.right" });
    first.push(event);
    await settled();
    expect(held.has(EVENT_LOCK_PREFIX + event.id)).toBe(true);
    second.push(event);
    await settled();
    expect(heardSecond).toEqual([]);
  });

  test("across tabs: an ID one visible tab showed never reaches the other", async () => {
    const [one, two] = channelPair();
    const { locks } = sharedLocks();
    const first = manualFeed();
    const second = manualFeed();
    const heardFirst: (readonly EventEnvelope[])[] = [];
    const heardSecond: (readonly EventEnvelope[])[] = [];
    const shownSecond = createShownEvents(two, locks);
    onceAcrossTabs(
      first.feed,
      createShownEvents(one, locks),
      () => true,
    ).subscribe((batch) => heardFirst.push(batch));
    onceAcrossTabs(second.feed, shownSecond, () => true).subscribe((batch) =>
      heardSecond.push(batch),
    );

    const shared = envelope({ type: "check.passed", firstTime: true });
    first.push(shared);
    await settled();
    // The message reached the second tab.
    expect(shownSecond.has(shared.id)).toBe(true);
    second.push(shared);
    const own = envelope({ type: "hint.shown", rung: 1 });
    second.push(own);
    await settled();
    first.push(own);
    await settled();

    expect(ids(heardFirst)).toEqual([[shared.id]]);
    expect(ids(heardSecond)).toEqual([[own.id]]);
  });

  test("without the Web Locks API, the message alone shares what was shown", async () => {
    const [one, two] = channelPair();
    const first = manualFeed();
    const second = manualFeed();
    const heardFirst: (readonly EventEnvelope[])[] = [];
    const heardSecond: (readonly EventEnvelope[])[] = [];
    onceAcrossTabs(first.feed, createShownEvents(one), () => true).subscribe(
      (batch) => heardFirst.push(batch),
    );
    onceAcrossTabs(second.feed, createShownEvents(two), () => true).subscribe(
      (batch) => heardSecond.push(batch),
    );

    const shared = envelope({ type: "check.passed", firstTime: true });
    first.push(shared);
    await settled();
    second.push(shared);
    await settled();
    expect(ids(heardFirst)).toEqual([[shared.id]]);
    expect(heardSecond).toEqual([]);
  });

  test("a lock request the browser refuses falls back to the message alone", async () => {
    const refusing: EventLocks = {
      request: () => Promise.reject(new DOMException("refused")),
    };
    const { feed, push } = manualFeed();
    const heard: (readonly EventEnvelope[])[] = [];
    onceAcrossTabs(
      feed,
      createShownEvents(null, refusing),
      () => true,
    ).subscribe((batch) => heard.push(batch));
    const event = envelope({ type: "answer.right" });
    push(event);
    push(event);
    await settled();
    expect(ids(heard)).toEqual([[event.id]]);
  });

  test("a hidden tab keeps what it heard to itself, and claims nothing", async () => {
    const [one, two] = channelPair();
    const { locks, held } = sharedLocks();
    const hidden = manualFeed();
    const visible = manualFeed();
    const heardHidden: (readonly EventEnvelope[])[] = [];
    const heardVisible: (readonly EventEnvelope[])[] = [];
    onceAcrossTabs(
      hidden.feed,
      createShownEvents(one, locks),
      () => false,
    ).subscribe((batch) => heardHidden.push(batch));
    onceAcrossTabs(
      visible.feed,
      createShownEvents(two, locks),
      () => true,
    ).subscribe((batch) => heardVisible.push(batch));

    const event = envelope({ type: "answer.right" });
    hidden.push(event);
    await settled();
    expect(held.size).toBe(0);
    visible.push(event);
    hidden.push(event);
    await settled();
    expect(ids(heardHidden)).toEqual([[event.id]]);
    expect(ids(heardVisible)).toEqual([[event.id]]);
  });

  test("a listener that throws never stops the batches after it", async () => {
    const { feed, push } = manualFeed();
    const heard: string[] = [];
    onceAcrossTabs(feed, createShownEvents(null), () => true).subscribe(
      (batch) => {
        heard.push(...batch.map((event) => event.id));
        if (heard.length === 1) throw new Error("listener failed");
      },
    );
    const reported = vi.fn();
    vi.stubGlobal("reportError", reported);
    const a = envelope({ type: "answer.right" });
    const b = envelope({ type: "answer.wrong" });
    push(a);
    push(b);
    await settled();
    vi.unstubAllGlobals();
    expect(heard).toEqual([a.id, b.id]);
    expect(reported).toHaveBeenCalledWith(new Error("listener failed"));
  });

  test("stops delivering once unsubscribed, even a batch still being claimed", async () => {
    const { feed, push } = manualFeed();
    const listener = vi.fn();
    const stop = onceAcrossTabs(
      feed,
      createShownEvents(null, sharedLocks().locks),
      () => true,
    ).subscribe(listener);
    push(envelope({ type: "answer.right" }));
    stop();
    await settled();
    expect(listener).not.toHaveBeenCalled();
  });

  test("ignores a message on the channel that is not a list of IDs", () => {
    const [one] = channelPair();
    const shown = createShownEvents(one);
    one.deliver({
      shown: [1, "", null, "ok"],
    });
    one.deliver("noise");
    expect(shown.has("ok")).toBe(true);
    expect(shown.has("")).toBe(false);
  });

  test("remembers only the newest IDs", () => {
    const shown = createShownEvents(null);
    const all = Array.from(
      { length: SHOWN_LIMIT + 1 },
      (_, i) => `i.${String(i)}`,
    );
    shown.record(all);
    expect(shown.has("i.0")).toBe(false);
    expect(shown.has("i.1")).toBe(true);
    expect(shown.has(`i.${String(SHOWN_LIMIT)}`)).toBe(true);
  });

  test("lets an ID's lock go once it forgets the ID, and every lock on closing", async () => {
    const { locks, held } = sharedLocks();
    const shown = createShownEvents(null, locks);
    await shown.claim(["first", "second"]);
    expect([...held]).toEqual([
      EVENT_LOCK_PREFIX + "first",
      EVENT_LOCK_PREFIX + "second",
    ]);
    shown.record(
      Array.from({ length: SHOWN_LIMIT - 1 }, (_, i) => `i.${String(i)}`),
    );
    await settled();
    expect([...held]).toEqual([EVENT_LOCK_PREFIX + "second"]);
    shown.close();
    await settled();
    expect(held.size).toBe(0);
    // A closed ledger claims nothing.
    expect(await shown.claim(["third"])).toEqual(new Set());
  });

  test("closing stops listening and closes the channel", () => {
    const [one] = channelPair();
    const shown = createShownEvents(one);
    shown.close();
    expect(one.close).toHaveBeenCalled();
    one.deliver({
      shown: ["late"],
    });
    expect(shown.has("late")).toBe(false);
  });
});
