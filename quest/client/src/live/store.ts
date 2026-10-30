// The page's live state, fed only by the stream ("Live delivery"): the
// snapshot on screen, the connection's state, the actions in flight, and the
// events for the page's consumers, each ID at most once across tabs.
// Moments come only from events and the snapshot's pending milestones; no
// code here compares two snapshots.
import type {
  ActionError,
  EventEnvelope,
  Milestone,
  QuestAction,
  Snapshot,
} from "@quest/contract";
import {
  onceAcrossTabs,
  type EventBatchListener,
  type EventFeed,
  type ShownEvents,
} from "./events";
import {
  MILESTONE_TYPES,
  readActionError,
  readActionResponse,
  readEventEnvelope,
  readHealth,
  readHeartbeat,
  readSnapshot,
} from "./parse";
import {
  NOTICE_MS,
  STOPPED_MS,
  openStream,
  type FrameName,
  type Stream,
  type StreamDeps,
} from "./stream";

/**
 * `waiting` before the first snapshot of a connect, `connected` while the stream answers,
 * `reconnecting` once a drop has lasted NOTICE_MS, `stopped` once it has
 * lasted STOPPED_MS and a health request failed too.
 */
export type Connection = "waiting" | "connected" | "reconnecting" | "stopped";

export interface LiveState {
  snapshot: Snapshot | null;
  connection: Connection;
  /** The keys of the actions in flight. */
  pending: ReadonlySet<string>;
  /** Actions may be sent: a snapshot is held and the stream is up. */
  actionsEnabled: boolean;
  /** The oldest pending milestone no tab has shown, or null. */
  milestone: Milestone | null;
}

export type ActOutcome =
  { applied: true } | { applied: false; error?: ActionError };

/** Events of one revision that arrive this close together go as one batch. */
export const BATCH_MS = 16;

export interface LiveDeps extends Omit<StreamDeps, "EventSource"> {
  /** Null where the browser has none: the store then stays waiting. */
  EventSource: StreamDeps["EventSource"] | null;
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  /** The tab's clock, in epoch milliseconds. */
  now: () => number;
  /** Opens the shown-ID ledger the page's tabs share, once per connect. */
  shown: () => ShownEvents;
}

export interface LiveStore {
  subscribe: (listener: () => void) => () => void;
  getState: () => LiveState;
  /** The events for the page's consumers, each ID at most once across tabs. */
  feed: EventFeed;
  /** Sends an action with the instance and revision shown; `key` names it in `pending`. */
  act: (action: QuestAction, key?: string) => Promise<ActOutcome>;
  /**
   * Claims a pending milestone for this tab and tells the server it was
   * shown; resolves to whether this tab won it and should show it.
   */
  showMilestone: (id: string) => Promise<boolean>;
  /** The server's time now, as near as the tab knows it. */
  serverNow: () => number;
  /**
   * Opens the stream and the ledger; returns the disconnect, which closes
   * both. Creating a store opens nothing, so a page can make one in render.
   */
  connect: () => () => void;
}

const INITIAL: LiveState = {
  snapshot: null,
  connection: "waiting",
  pending: new Set(),
  actionsEnabled: false,
  milestone: null,
};

export function createLiveStore(deps: LiveDeps): LiveStore {
  let state = INITIAL;
  let closed = true;
  // The ledger while connected; while not, nothing is shown or claimed.
  let ledger: ShownEvents | null = null;
  const shown: ShownEvents = {
    has: (id) => ledger?.has(id) ?? false,
    record: (ids) => ledger?.record(ids),
    claim: (ids) => ledger?.claim(ids) ?? Promise.resolve(new Set()),
    close: () => undefined,
  };
  const listeners = new Set<() => void>();
  const set = (next: Partial<LiveState>) => {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  };

  // ---- the server's time ----
  // How far the server's clock is ahead of the tab's. A heartbeat is sent
  // now, so it sets the offset, down too when the tab's clock jumps forward.
  // An event's time is when it happened, so a replayed one only ever
  // understates it: it can only raise the offset.
  let offset: number | null = null;
  const heardTime = (serverTime: number, live: boolean) => {
    const ahead = serverTime - deps.now();
    offset = offset === null || live ? ahead : Math.max(offset, ahead);
  };
  const serverNow = () => deps.now() + (offset ?? 0);

  // ---- snapshots and milestones ----
  let lastId: string | null = null;
  // Milestones whose milestone.shown failed: sent once more while listed.
  let unsent = new Set<string>();
  const nextMilestone = (snapshot: Snapshot | null) =>
    snapshot?.milestones.find((m) => !shown.has(m.id)) ?? null;

  const apply = (snapshot: Snapshot) => {
    // Any snapshot that still lists a failed milestone.shown sends it once
    // more, a reconnect's at the same revision too, after it is held.
    const retry = [...unsent].filter((id) =>
      snapshot.milestones.some((m) => m.id === id),
    );
    unsent = new Set();
    const held = state.snapshot;
    if (held === null || held.instance !== snapshot.instance) {
      // A new server process: nothing held from the last one stands, but the
      // shown ledger, which is the page's, not the server's.
      lastId = null;
      set({ snapshot, milestone: nextMilestone(snapshot) });
    } else if (snapshot.revision > held.revision) {
      set({ snapshot, milestone: nextMilestone(snapshot) });
    }
    for (const id of retry) void sendShown(id, false);
  };

  const post = async (action: QuestAction) => {
    const snapshot = state.snapshot;
    if (snapshot === null) return null;
    const response = await deps.fetch("/api/actions", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        instance: snapshot.instance,
        revision: snapshot.revision,
      }),
    });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // A body that is not JSON reads as nothing.
    }
    if (response.status === 200 || response.status === 409) {
      const answer = readActionResponse(body);
      if (answer !== null) apply(answer.snapshot);
    }
    return { status: response.status, body };
  };

  const sendShown = async (id: string, retry: boolean) => {
    let ok = false;
    try {
      const answer = await post({ type: "milestone.shown", id });
      ok = answer?.status === 200 || answer?.status === 409;
    } catch {
      // A network failure: retried below.
    }
    if (!ok && retry && !closed) unsent.add(id);
  };

  // ---- events ----
  const feedListeners = new Set<EventBatchListener>();
  let batch: EventEnvelope[] = [];
  let batchTimer: unknown = null;
  const flush = () => {
    if (batchTimer !== null) deps.clearTimeout(batchTimer);
    batchTimer = null;
    if (batch.length === 0) return;
    const events = batch;
    batch = [];
    for (const listener of feedListeners) listener(events);
  };
  const heardEvent = (envelope: EventEnvelope) => {
    if (batch.length > 0 && batch[0]?.revision !== envelope.revision) flush();
    batch.push(envelope);
    batchTimer ??= deps.setTimeout(flush, BATCH_MS);
  };
  const raw: EventFeed = {
    subscribe(listener) {
      feedListeners.add(listener);
      return () => {
        feedListeners.delete(listener);
      };
    },
  };
  const feed = onceAcrossTabs(raw, shown, () => !deps.hidden(), {
    onVisible: (visible) =>
      deps.onVisibility(() => {
        if (!deps.hidden()) visible();
      }),
    serverNow,
    instance: () => state.snapshot?.instance ?? null,
  });

  // ---- the connection ----
  let droppedAt: number | null = null;
  const timers: unknown[] = [];
  const clearTimers = () => {
    for (const timer of timers) deps.clearTimeout(timer);
    timers.length = 0;
  };
  const checkHealth = async () => {
    let up = false;
    try {
      const response = await deps.fetch("/api/health", {
        credentials: "same-origin",
      });
      up = response.ok && readHealth(await response.json()) !== null;
    } catch {
      // Down.
    }
    if (!up && droppedAt !== null && !closed) set({ connection: "stopped" });
  };
  const failed = () => {
    flush();
    const now = deps.now();
    if (droppedAt === null) {
      droppedAt = now;
      set({ actionsEnabled: false });
      timers.push(
        // Reconnecting only once a snapshot was held: before that the page
        // stays waiting, though a failing health check still means stopped.
        deps.setTimeout(() => {
          if (state.connection !== "stopped" && state.snapshot !== null)
            set({ connection: "reconnecting" });
        }, NOTICE_MS),
        deps.setTimeout(() => void checkHealth(), STOPPED_MS),
      );
    } else if (now - droppedAt >= STOPPED_MS) {
      void checkHealth();
    }
  };
  // Parked while hidden: no stream, so no actions, but no drop either.
  const parked = () => {
    flush();
    if (state.actionsEnabled) set({ actionsEnabled: false });
  };
  const connected = () => {
    droppedAt = null;
    clearTimers();
    if (state.connection !== "connected" || !state.actionsEnabled)
      set({ connection: "connected", actionsEnabled: true });
  };

  const frame = (name: FrameName, data: unknown, eventId: string) => {
    if (name === "snapshot") {
      const snapshot = readSnapshot(data);
      if (snapshot === null) return;
      flush();
      apply(snapshot);
      connected();
      return;
    }
    if (name === "heartbeat") {
      const beat = readHeartbeat(data);
      if (beat !== null) heardTime(beat.serverTime, true);
      return;
    }
    const envelope = readEventEnvelope(data);
    if (envelope === null) return;
    if (eventId !== "") lastId = eventId;
    heardTime(envelope.serverTime, false);
    // A milestone reaches the page through the snapshot's pending list only.
    if (!MILESTONE_TYPES.has(envelope.type)) heardEvent(envelope);
  };

  const { EventSource } = deps;
  let stream: Stream | null = null;

  const inFlight = new Set<string>();
  const setPending = (key: string, pending: boolean) => {
    if (pending) inFlight.add(key);
    else inFlight.delete(key);
    set({ pending: new Set(inFlight) });
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getState: () => state,
    feed,
    async act(action, key = action.type) {
      if (!state.actionsEnabled || closed) return { applied: false };
      // One request per key at a time: a second press while the first is in
      // flight would post the same action twice.
      if (inFlight.has(key)) return { applied: false };
      setPending(key, true);
      try {
        const answer = await post(action);
        if (answer === null) return { applied: false };
        if (answer.status === 200 && readActionResponse(answer.body) !== null)
          return { applied: true };
        const error =
          answer.status === 409 ? null : readActionError(answer.body);
        return error === null ? { applied: false } : { applied: false, error };
      } catch {
        return { applied: false };
      } finally {
        setPending(key, false);
      }
    },
    async showMilestone(id) {
      const won = await shown.claim([id]);
      set({ milestone: nextMilestone(state.snapshot) });
      if (!won.has(id)) return false;
      void sendShown(id, true);
      return true;
    },
    serverNow,
    connect() {
      if (EventSource === null || !closed) return () => undefined;
      closed = false;
      ledger = deps.shown();
      stream = openStream(
        { ...deps, EventSource },
        { after: () => lastId, frame, failed, parked },
      );
      return () => {
        closed = true;
        stream?.close();
        stream = null;
        clearTimers();
        droppedAt = null;
        if (batchTimer !== null) deps.clearTimeout(batchTimer);
        batchTimer = null;
        batch = [];
        ledger?.close();
        ledger = null;
        // Closed is not connected: a later connect waits for its own snapshot.
        set({
          connection: "waiting",
          actionsEnabled: false,
        });
      };
    },
  };
}
