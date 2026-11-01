// The page's one event stream, `GET /api/events` ("Live delivery"). It
// reconnects itself rather than leave that to the EventSource, which gives up
// on a non-200 answer (a 503 while the server starts): every failure closes
// it and opens a new one after a backoff. It stays open while the page is
// visible and for HIDE_KEEP_MS after it hides, then closes until the page is
// visible again; a reopen asks for the events after the last one held.
import type { StreamMessages } from "@quest/contract";

/** How long a hidden page keeps its stream open. */
export const HIDE_KEEP_MS = 120_000;
/** A stream silent this long is taken for dead: the heartbeat comes every 15 s. */
export const SILENCE_MS = 40_000;
/** The first wait before a reconnect, doubled after each failure up to the most. */
export const BACKOFF_MIN_MS = 1000;
export const BACKOFF_MAX_MS = 5000;
/** How long a drop lasts before the Reconnecting notice. */
export const NOTICE_MS = 3000;
/** How long a drop lasts before a failing health request means stopped. */
export const STOPPED_MS = 15_000;

export type FrameName = keyof StreamMessages;
const FRAMES: readonly FrameName[] = ["snapshot", "event", "heartbeat"];

/** The part of an EventSource the stream uses, so tests can supply one. */
export interface EventSourceLike {
  addEventListener(type: string, listener: (event: Event) => void): void;
  close(): void;
}

export interface StreamDeps {
  EventSource: new (url: string) => EventSourceLike;
  setTimeout: (run: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  /** Whether the page is hidden now. */
  hidden: () => boolean;
  /** Calls `changed` each time the page's visibility changes; returns the unsubscribe. */
  onVisibility: (changed: () => void) => () => void;
}

export interface StreamHandlers {
  /** The last event ID held, for a reopen's `?after=`, or null. */
  after: () => string | null;
  /** One frame, its data parsed from JSON but not yet read. */
  frame: (name: FrameName, data: unknown, lastEventId: string) => void;
  /** The stream failed or fell silent; a reconnect is on its way. */
  failed: () => void;
  /** The page stayed hidden for HIDE_KEEP_MS and the stream closed until it is visible. */
  parked: () => void;
}

export interface Stream {
  close(): void;
}

export function openStream(deps: StreamDeps, handlers: StreamHandlers): Stream {
  let source: EventSourceLike | null = null;
  let silence: unknown = null;
  let retry: unknown = null;
  let hiding: unknown = null;
  let backoff = BACKOFF_MIN_MS;
  let parked = false;
  let closed = false;

  const clear = (handle: unknown) => {
    if (handle !== null) deps.clearTimeout(handle);
  };
  const drop = () => {
    source?.close();
    source = null;
    clear(silence);
    silence = null;
  };
  const fail = () => {
    drop();
    handlers.failed();
    if (closed) return;
    retry = deps.setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, BACKOFF_MAX_MS);
  };
  const armSilence = () => {
    clear(silence);
    silence = deps.setTimeout(fail, SILENCE_MS);
  };
  function connect() {
    retry = null;
    if (closed) return;
    const after = handlers.after();
    const url =
      after === null
        ? "/api/events"
        : `/api/events?after=${encodeURIComponent(after)}`;
    const opened = new deps.EventSource(url);
    source = opened;
    for (const name of FRAMES) {
      opened.addEventListener(name, (event) => {
        if (source !== opened || !(event instanceof MessageEvent)) return;
        armSilence();
        if (name === "snapshot") backoff = BACKOFF_MIN_MS;
        let data: unknown;
        try {
          data = JSON.parse(String(event.data));
        } catch {
          return;
        }
        handlers.frame(name, data, event.lastEventId);
      });
    }
    opened.addEventListener("error", () => {
      if (source === opened) fail();
    });
    armSilence();
  }

  // Hidden long enough, the stream closes: not a failure, so no backoff.
  const park = () => {
    hiding = null;
    clear(retry);
    retry = null;
    drop();
    parked = true;
    handlers.parked();
  };
  const visibility = () => {
    if (deps.hidden()) {
      hiding ??= deps.setTimeout(park, HIDE_KEEP_MS);
      return;
    }
    clear(hiding);
    hiding = null;
    if (parked) {
      parked = false;
      connect();
    }
  };
  const stopVisibility = deps.onVisibility(visibility);
  connect();
  visibility();

  return {
    close() {
      closed = true;
      stopVisibility();
      clear(retry);
      clear(hiding);
      drop();
    },
  };
}
