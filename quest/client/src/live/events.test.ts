import type { EventEnvelope } from "@quest/contract";
import { describe, expect, test, vi } from "vitest";
import { envelope } from "../../test/events";
import { channelPair, sharedLocks } from "../../test/live";
import {
  EVENT_LOCK_PREFIX,
  REACTION_KEEP_MS,
  SHOWN_LIMIT,
  createShownEvents,
  onceAcrossTabs,
  type EventFeed,
  type EventLocks,
} from "./events";

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
 * Lets every queued lock request, message and delivery run: all of them are
 * microtasks, which run before the next task.
 */
const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

const ids = (batches: (readonly EventEnvelope[])[]) =>
  batches.map((batch) => batch.map((event) => event.id));

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

  test("a hidden tab delivers nothing and claims nothing, keeping its IDs to itself", async () => {
    const [one, two] = channelPair();
    const { locks, held } = sharedLocks();
    const hidden = manualFeed();
    const visible = manualFeed();
    const heardHidden: (readonly EventEnvelope[])[] = [];
    const heardVisible: (readonly EventEnvelope[])[] = [];
    const shownHidden = createShownEvents(one, locks);
    onceAcrossTabs(hidden.feed, shownHidden, () => false).subscribe((batch) =>
      heardHidden.push(batch),
    );
    onceAcrossTabs(
      visible.feed,
      createShownEvents(two, locks),
      () => true,
    ).subscribe((batch) => heardVisible.push(batch));

    const first = envelope({ type: "answer.right" });
    const second = envelope({ type: "answer.wrong" });
    hidden.push(first);
    hidden.push(second);
    await settled();
    expect(held.size).toBe(0);
    expect(heardHidden).toEqual([]);
    // The replaced batch is recorded, to itself; the held one is not yet.
    expect(shownHidden.has(first.id)).toBe(true);
    expect(shownHidden.has(second.id)).toBe(false);
    visible.push(first);
    await settled();
    expect(ids(heardVisible)).toEqual([[first.id]]);
  });

  describe("a hidden tab's waiting Reaction", () => {
    /** A hidden tab with a switch for its visibility and a server clock. */
    function hiddenTab(serverNow?: () => number) {
      const { feed, push } = manualFeed();
      const shown = createShownEvents(null, sharedLocks().locks);
      let hidden = true;
      let show: () => void = () => undefined;
      const heard: (readonly EventEnvelope[])[] = [];
      onceAcrossTabs(feed, shown, () => !hidden, {
        onVisible: (visible) => {
          show = visible;
          return () => undefined;
        },
        ...(serverNow ? { serverNow } : {}),
      }).subscribe((batch) => heard.push(batch));
      return {
        push,
        shown,
        heard,
        reveal: () => {
          hidden = false;
          show();
        },
      };
    }

    test("only the newest plays on return, alone, and the ones it replaced are recorded", async () => {
      const tab = hiddenTab(() => 1000);
      const old = envelope({ type: "answer.wrong" }, 1, 900);
      const newest = envelope(
        { type: "check.passed", firstTime: true },
        2,
        950,
      );
      tab.push(old);
      tab.push(newest);
      tab.reveal();
      await settled();
      expect(ids(tab.heard)).toEqual([[newest.id]]);
      expect(tab.shown.has(old.id)).toBe(true);
      // Heard again later, neither plays.
      tab.push(old, newest);
      await settled();
      expect(tab.heard).toHaveLength(1);
    });

    test("is dropped when older than REACTION_KEEP_MS by server time", async () => {
      const tab = hiddenTab(() => 10 + REACTION_KEEP_MS + 1);
      const event = envelope({ type: "answer.right" }, 1, 10);
      tab.push(event);
      tab.reveal();
      await settled();
      expect(tab.heard).toEqual([]);
      expect(tab.shown.has(event.id)).toBe(true);
    });

    test("plays at exactly REACTION_KEEP_MS old", async () => {
      const tab = hiddenTab(() => 10 + REACTION_KEEP_MS);
      const event = envelope({ type: "answer.right" }, 1, 10);
      tab.push(event);
      tab.reveal();
      await settled();
      expect(ids(tab.heard)).toEqual([[event.id]]);
    });

    test("is dropped when another tab showed it meanwhile", async () => {
      const tab = hiddenTab(() => 0);
      const event = envelope({ type: "answer.right" });
      tab.push(event);
      tab.shown.record([event.id]);
      tab.reveal();
      await settled();
      expect(tab.heard).toEqual([]);
    });
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
