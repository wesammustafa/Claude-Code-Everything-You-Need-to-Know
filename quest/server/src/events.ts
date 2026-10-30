// GET /api/events, live delivery (spec, Live delivery): an SSE stream that
// opens with the current snapshot, replays the events after a reconnect's
// last one, then sends each change's snapshot (coalesced to the latest
// within 50 ms when it has no events) and its events, never coalesced, each
// with its `id:`. A heartbeat every 15 seconds keeps an idle stream open
// (Codespaces cuts one after 100 seconds). At most 8 streams are open: a
// ninth closes the oldest. A reader that stops reading while still
// connected closes once MAX_BACKLOG frames wait: the tab reconnects with
// Last-Event-ID and misses nothing the buffer still holds.
//
// The request timeouts (listen.ts SERVER_LIMITS) cover only receiving the
// request, which a GET finishes with its headers, so a stream is exempt from
// them with no code here.
import type { Context, Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { EventEnvelope, Snapshot, StreamMessages } from "@quest/contract";
import type { Heard, Host } from "@quest/host";
import { API_CACHE } from "./headers.ts";

export const MAX_STREAMS = 8;
export const COALESCE_MS = 50;
export const HEARTBEAT_MS = 15_000;
export const RETRY_MS = 1000;
/** Frames a stream may have waiting to write before it closes. */
export const MAX_BACKLOG = 64;

/** The open streams, oldest first, each by its close function. */
export interface Streams {
  /** Holds `close`, closing the oldest first when full; returns the removal. */
  add(close: () => void): () => void;
  size(): number;
  closeAll(): void;
}

export function createStreams({ limit = MAX_STREAMS } = {}): Streams {
  const open = new Map<number, () => void>();
  let next = 0;
  return {
    add(close) {
      for (const [key, oldest] of open) {
        if (open.size < limit) break;
        open.delete(key);
        oldest();
      }
      const key = next++;
      open.set(key, close);
      return () => {
        open.delete(key);
      };
    },
    size: () => open.size,
    closeAll() {
      for (const close of [...open.values()]) close();
      open.clear();
    },
  };
}

export interface EventsOptions {
  host: Host;
  /** Settles when the host's open() settles. */
  ready: Promise<unknown>;
  streams: Streams;
}

function answer(
  c: Context,
  error: "forbidden" | "starting",
  status: 403 | 503,
) {
  c.header("Cache-Control", API_CACHE);
  if (status === 503) c.header("Retry-After", "1");
  return c.json({ error }, status);
}

// The events after a reconnect's last one: Last-Event-ID when sent, else
// ?after=, even when the header is empty. An unknown or malformed value replays nothing; an invalid header
// never falls back to ?after=, which can be older than what the tab saw.
function replay(c: Context, host: Host): EventEnvelope[] {
  const position = c.req.header("Last-Event-ID") ?? c.req.query("after");
  return (position && host.eventsAfter(position)) || [];
}

export function eventsRoute(
  app: Hono,
  { host, ready, streams }: EventsOptions,
): void {
  // Settled either way: a failed open() answers 503, never an error.
  const opened = ready.then(
    () => undefined,
    () => undefined,
  );
  app.get("/api/events", async (c) => {
    // A stream from another site or port is refused before it opens: it
    // could otherwise take all 8 places and close the Learner's.
    const site = c.req.header("Sec-Fetch-Site");
    if (site !== undefined && site !== "same-origin")
      return answer(c, "forbidden", 403);
    await opened;
    if (host.snapshot() === null) return answer(c, "starting", 503);

    const response = streamSSE(c, async (stream) => {
      let tail = Promise.resolve();
      let backlog = 0;
      let done = false;
      const send = <K extends keyof StreamMessages>(
        event: K,
        data: StreamMessages[K],
        extra: { id?: string; retry?: number } = {},
      ) => {
        if (done) return;
        if (++backlog > MAX_BACKLOG) {
          close();
          return;
        }
        // hono's write() swallows a failed write, so this never rejects: a
        // dead socket ends the stream through onAbort.
        tail = tail.then(async () => {
          if (!done)
            await stream.writeSSE({
              event,
              data: JSON.stringify(data),
              ...extra,
            });
          backlog--;
        });
      };

      let pending: Snapshot | null = null;
      let timer: unknown = null;
      const flush = () => {
        timer = null;
        if (pending && pending.revision > sent) {
          sent = pending.revision;
          send("snapshot", pending);
        }
        pending = null;
      };
      // Only these three fields: the host's `input` never reaches a frame.
      const onHeard = ({ revision, snapshot, events }: Heard) => {
        if (revision <= sent) return;
        if (events.length === 0) {
          pending = snapshot;
          timer ??= host.clock.setTimeout(flush, COALESCE_MS);
          return;
        }
        if (timer !== null) host.clock.clearTimeout(timer);
        timer = null;
        pending = null;
        send("snapshot", snapshot);
        sent = revision;
        for (const envelope of events)
          send("event", envelope, { id: envelope.id });
      };
      const beat = () => {
        send("heartbeat", {
          serverTime: host.serverTime(),
          instance: host.instance,
          revision: host.revision(),
        });
      };

      const finished = Promise.withResolvers<undefined>();
      let remove: () => void = () => undefined;
      let interval: unknown = null;
      // One close for an abort, an eviction, closeAll and a full backlog.
      function close() {
        if (done) return;
        done = true;
        unsubscribe();
        if (interval !== null) host.clock.clearInterval(interval);
        if (timer !== null) host.clock.clearTimeout(timer);
        remove();
        finished.resolve(undefined);
        void stream.close();
      }

      // Synchronous from here to the first write, with no await between the
      // steps: the snapshot read and the subscription see the same change,
      // so no event is lost or sent twice.
      const unsubscribe = host.subscribe(onHeard);
      const snapshot = host.snapshot() as Snapshot;
      const replayed = replay(c, host);
      let sent = snapshot.revision;
      remove = streams.add(close);
      interval = host.clock.setInterval(beat, HEARTBEAT_MS);
      stream.onAbort(close);
      send("snapshot", snapshot, { retry: RETRY_MS });
      for (const envelope of replayed)
        send("event", envelope, { id: envelope.id });
      await finished.promise;
    });
    // streamSSE's no-cache gives way to the API's no-store.
    response.headers.set("Cache-Control", API_CACHE);
    return response;
  });
}
