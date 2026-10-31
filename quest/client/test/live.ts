// Fakes for the connection layer's tests: the event stream, two tabs'
// BroadcastChannels and Web Locks, and fetch.
import { vi, type Mock } from "vitest";
import type { EventLocks, ShownChannel } from "../src/live/events";
import type { EventSourceLike } from "../src/live/stream";

/** An EventSource the test drives: every one made is kept, newest last. */
export class FakeEventSource implements EventSourceLike {
  static made: FakeEventSource[] = [];
  /** The newest one, which the test expects to exist. */
  static get last(): FakeEventSource {
    const source = FakeEventSource.made.at(-1);
    if (source === undefined) throw new Error("no EventSource was made");
    return source;
  }
  static reset() {
    FakeEventSource.made = [];
  }

  readonly url: string;
  closed = false;
  private readonly listeners = new Map<string, Set<(event: Event) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.made.push(this);
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    let set = this.listeners.get(type);
    if (set === undefined) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  close() {
    this.closed = true;
  }

  private dispatch(type: string, event: Event) {
    if (this.closed) return;
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  /** One frame: its SSE event name, its data (sent as JSON) and its id. */
  emit(name: string, data: unknown, id = "") {
    this.dispatch(
      name,
      new MessageEvent(name, { data: JSON.stringify(data), lastEventId: id }),
    );
  }

  /** One frame whose data is sent as it is. */
  emitRaw(name: string, data: string) {
    this.dispatch(name, new MessageEvent(name, { data }));
  }

  /** The connection failed: what a dropped stream or a non-200 answer fires. */
  fail() {
    this.dispatch("error", new Event("error"));
  }
}

/** A tab's channel in a pair, with what the test needs to reach into it. */
export type TestChannel = Omit<ShownChannel, "close"> & {
  close: Mock<() => void>;
  deliver: (data: unknown) => void;
};

/** Two tabs' channels, joined: what one posts, the other hears, asynchronously as a BroadcastChannel does. */
export function channelPair(): [TestChannel, TestChannel] {
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
      close: vi.fn<() => void>(),
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
  return [a, b];
}

/**
 * The page's tabs' shared Web Locks: a request is answered asynchronously, as
 * the browser answers it (here on a microtask, so a test can wait for every
 * answer), and a lock is held until its callback's promise settles.
 */
export function sharedLocks() {
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

/** One request fetch was asked for. */
export interface FetchCall {
  url: string;
  method: string;
  body: unknown;
  init: RequestInit | undefined;
}

/** What the fake answers: a status and a JSON body, or a network failure. */
export type FakeAnswer = { status: number; body?: unknown } | "fail";

/**
 * A fetch that records each request and answers it with `answer`'s reply,
 * which may wait on a promise so a test can hold a request in flight.
 */
export function fakeFetch(
  answer: (call: FetchCall) => FakeAnswer | Promise<FakeAnswer>,
) {
  const calls: FetchCall[] = [];
  const fetch = vi.fn(async (input: string, init?: RequestInit) => {
    const call: FetchCall = {
      url: input,
      method: init?.method ?? "GET",
      body:
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as unknown)
          : null,
      init,
    };
    calls.push(call);
    const reply = await answer(call);
    if (reply === "fail") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(reply.body ?? null), {
      status: reply.status,
      headers: { "Content-Type": "application/json" },
    });
  });
  return { fetch, calls };
}
