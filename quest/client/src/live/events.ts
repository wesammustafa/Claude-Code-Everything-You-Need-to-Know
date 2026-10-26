// How engine events reach the page's consumers (Pip's director, and later the
// moments), each event ID at most once. The connection layer (ticket 220)
// brings the real stream; until then the page's own local source feeds the
// same path, so Pip's director is wired once and 220 only swaps the source.
import type { EventEnvelope } from "@quest/contract";
import { readEventEnvelope } from "./parse";

/** One revision's events, in order. */
export type EventBatchListener = (events: readonly EventEnvelope[]) => void;

/** A source of event batches. */
export interface EventFeed {
  subscribe(listener: EventBatchListener): () => void;
}

/**
 * The DOM event the page's local source listens for: its `detail` is an array
 * of event envelopes, one revision's events. A stand-in for the stream until
 * the connection layer (ticket 220) replaces it, and the way the end-to-end
 * tests feed Pip's director meanwhile. Only same-origin script can dispatch it.
 */
export const LOCAL_EVENTS = "quest:events";

/**
 * The page's local event source. Each dispatch is one batch; envelopes that
 * are not well formed are dropped, and an empty batch is never delivered.
 */
export function createLocalEventFeed(target: EventTarget): EventFeed {
  return {
    subscribe(listener) {
      const onEvents = (event: Event) => {
        if (!(event instanceof CustomEvent)) return;
        const detail: unknown = event.detail;
        if (!Array.isArray(detail)) return;
        const batch = detail.flatMap((value: unknown) => {
          const envelope = readEventEnvelope(value);
          return envelope === null ? [] : [envelope];
        });
        if (batch.length > 0) listener(batch);
      };
      target.addEventListener(LOCAL_EVENTS, onEvents);
      return () => {
        target.removeEventListener(LOCAL_EVENTS, onEvents);
      };
    },
  };
}

/** The BroadcastChannel tabs share shown event IDs over. */
export const SHOWN_CHANNEL = "quest:shown-events";

/** The part of a BroadcastChannel the ledger uses, so tests can supply one. */
export interface ShownChannel {
  postMessage(message: unknown): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void;
  removeEventListener(
    type: "message",
    listener: (event: MessageEvent) => void,
  ): void;
  close(): void;
}

/** Each event ID's lock name, under the Web Locks API. */
export const EVENT_LOCK_PREFIX = "quest:event:";

/** The part of the Web Locks API the claims use, so tests can supply one. */
export interface EventLocks {
  request(
    name: string,
    options: { ifAvailable: true },
    callback: (lock: Lock | null) => Promise<void> | undefined,
  ): Promise<unknown>;
}

/**
 * The event IDs this tab and the page's other tabs have shown. An ID shown in
 * one tab is never shown again in another: the spec's "tabs share what
 * they've shown" (Live delivery). Only the newest IDs are kept: the host
 * replays at most its last 256 events, so twice that is plenty.
 */
export interface ShownEvents {
  has(id: string): boolean;
  /** Records IDs this tab delivered while hidden, keeping them to itself. */
  record(ids: readonly string[]): void;
  /**
   * Claims IDs for this tab, so no other tab shows them, and tells the other
   * tabs; resolves to the IDs this tab won. Two tabs that hear an ID at the
   * same moment both ask for its Web Lock, and only one gets it: the other
   * drops the ID. The winner holds each lock for as long as it remembers the
   * ID, well past the message to the other tabs, so a tab that hears the ID
   * later is refused too, whenever the message reaches it. Without the Web
   * Locks API the message alone shares what was shown.
   */
  claim(ids: readonly string[]): Promise<ReadonlySet<string>>;
  close(): void;
}

export const SHOWN_LIMIT = 512;

export function createShownEvents(
  channel: ShownChannel | null,
  locks: EventLocks | null = null,
): ShownEvents {
  // Insertion order is age order, so the oldest ID is the first one.
  const ids = new Set<string>();
  // The locks this tab holds, by ID, each released by calling it.
  const held = new Map<string, () => void>();
  let closed = false;
  const release = (id: string) => {
    held.get(id)?.();
    held.delete(id);
  };
  const remember = (id: string) => {
    ids.delete(id);
    ids.add(id);
    while (ids.size > SHOWN_LIMIT) {
      const oldest = ids.values().next();
      if (oldest.done === true) break;
      ids.delete(oldest.value);
      release(oldest.value);
    }
  };
  const onMessage = (event: MessageEvent) => {
    const message: unknown = event.data;
    if (typeof message !== "object" || message === null) return;
    const shown: unknown = (message as { shown?: unknown }).shown;
    if (!Array.isArray(shown)) return;
    for (const id of shown as unknown[]) {
      if (typeof id === "string" && id !== "") remember(id);
    }
  };
  channel?.addEventListener("message", onMessage);

  /** Takes an ID for this tab, under its lock when there are locks. */
  const take = (id: string): Promise<boolean> => {
    const free = () => {
      if (closed || ids.has(id)) return false;
      remember(id);
      return true;
    };
    if (locks === null) return Promise.resolve(free());
    return new Promise<boolean>((taken) => {
      locks
        .request(EVENT_LOCK_PREFIX + id, { ifAvailable: true }, (lock) => {
          if (lock === null || !free()) {
            taken(false);
            return undefined;
          }
          taken(true);
          return new Promise<void>((done) => {
            held.set(id, done);
          });
        })
        .catch(() => {
          // A browser that refuses the request falls back to the message alone.
          taken(free());
        });
    });
  };

  return {
    has: (id) => ids.has(id),
    record(shown) {
      for (const id of shown) remember(id);
    },
    async claim(wanted) {
      const results = await Promise.all(wanted.map(take));
      const won = wanted.filter((_, i) => results[i] === true);
      if (won.length > 0) channel?.postMessage({ shown: won });
      return new Set(won);
    },
    close() {
      closed = true;
      for (const id of [...held.keys()]) release(id);
      channel?.removeEventListener("message", onMessage);
      channel?.close();
    },
  };
}

/**
 * The feed with every event ID delivered at most once in this tab and never
 * after another tab showed it. A visible tab, where a Reaction can be seen,
 * claims each ID before it delivers it, and drops one another tab claimed
 * first. A hidden tab claims nothing and keeps its IDs to itself. (Which
 * waiting Reaction plays when a hidden tab returns is the connection layer's
 * rule, ticket 220. So is a visible tab whose Pip is scrolled off-screen:
 * it still claims an ID that its director then drops, so no tab plays it.)
 * Batches reach the listener in the order they came.
 */
export function onceAcrossTabs(
  feed: EventFeed,
  shown: ShownEvents,
  visible: () => boolean,
): EventFeed {
  return {
    subscribe(listener) {
      let open = true;
      let queue = Promise.resolve();
      const stop = feed.subscribe((events) => {
        const fresh: EventEnvelope[] = [];
        const ids = new Set<string>();
        for (const event of events) {
          if (shown.has(event.id) || ids.has(event.id)) continue;
          ids.add(event.id);
          fresh.push(event);
        }
        if (fresh.length === 0) return;
        const seen = visible();
        const deliver = async () => {
          let mine = fresh;
          if (seen) {
            const won = await shown.claim([...ids]);
            mine = fresh.filter((event) => won.has(event.id));
          } else {
            shown.record([...ids]);
          }
          if (!open || mine.length === 0) return;
          // A listener that throws is reported, and the next batch still goes.
          try {
            listener(mine);
          } catch (error) {
            reportError(error);
          }
        };
        queue = queue.then(deliver);
      });
      return () => {
        open = false;
        stop();
      };
    },
  };
}
