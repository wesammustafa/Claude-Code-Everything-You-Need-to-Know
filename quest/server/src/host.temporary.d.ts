// TEMPORARY: ticket 215 deletes this file (214 deletes the @quest/engine/course block).
//
// The quest/host and quest/engine surface the server imports, typed by hand
// while both are still .mjs (owner, 2026-10-30: 216 runs before 215). Kept to
// what the server calls; the source of truth is quest/host/src/types.mjs.

declare module "@quest/host" {
  import type {
    EventEnvelope,
    InstanceId,
    QuestActionType,
    Revision,
    Snapshot,
  } from "@quest/contract";

  /** The host's one clock: its timers drive the stream's coalescing and heartbeat. */
  export interface Clock {
    now(): number;
    epoch(): number;
    setInterval(fn: () => void, ms: number): unknown;
    clearInterval(id: unknown): void;
    setTimeout(fn: () => void, ms: number): unknown;
    clearTimeout(id: unknown): void;
  }

  /**
   * What a listener hears after each change. The host's `input` is left out
   * on purpose: it is host-only and must never reach a frame.
   */
  export interface Heard {
    revision: Revision;
    snapshot: Snapshot;
    events: EventEnvelope[];
  }

  /** The event buffer's bounds: 256 events and 15 minutes. */
  export const EVENT_LIMIT: number;
  export const EVENT_KEEP_MS: number;

  /** The real adapters: opaque here, except the store the server loads once. */
  export interface Adapters {
    store: { load(): object | null };
  }

  export interface RealOptions {
    root: string;
    env?: Record<string, string | undefined>;
    platform?: string;
  }

  export interface HostOptions {
    root: string;
    course: readonly object[];
    saved: object | null;
    env: Record<string, string | undefined>;
    platform: string;
    adapters: Adapters;
    /** This process's instance: random unless a test pins it. */
    instance?: InstanceId;
  }

  /**
   * What dispatch() returns: the revision and snapshot after the action, or
   * `stale` when it applied nothing. The snapshot is null before open().
   */
  export interface Dispatched {
    stale?: true;
    revision: Revision;
    snapshot: Snapshot | null;
  }

  export interface Host {
    open(): Promise<Snapshot | null>;
    start(): void;
    firstLook(): void;
    close(): void;
    instance: InstanceId;
    /** Throws a TypeError for a type not in HOST_ACTION_TYPES. */
    dispatch(
      action: { type: string },
      opts?: { revision?: Revision; instance?: InstanceId },
    ): Dispatched;
    /** Null until open() resolves. */
    snapshot(): Snapshot | null;
    revision(): Revision;
    /** The clock's epoch milliseconds, for the heartbeat. */
    serverTime(): number;
    /** The envelopes after `id`, oldest first; null when this instance no longer holds it. */
    eventsAfter(id: string): EventEnvelope[] | null;
    /** Calls `fn` after each change; returns the unsubscribe. */
    subscribe(fn: (heard: Heard) => void): () => void;
    clock: Clock;
  }

  /** The engine's action types plus `milestone.shown`. */
  export const HOST_ACTION_TYPES: readonly QuestActionType[];

  export function createHost(options: HostOptions): Host;
  export function realAdapters(options: RealOptions): Adapters;
}

declare module "@quest/host/fake" {
  import type { Adapters, Clock } from "@quest/host";

  /** A clock whose timers run only when a test advances it. */
  export interface FakeClock extends Clock {
    advance(ms: number): Promise<void>;
    /** The timers waiting, as { ms, every } from now. */
    pending(): { ms: number; every: number | null }[];
  }

  export function fakeClock(from?: number, epoch0?: number): FakeClock;
  /** In-memory adapters for a test: `root` is the copy, `tree` its files ({abs: text, or null for a folder}). */
  export function fakeAdapters(options?: {
    root?: string;
    clock?: Clock;
    tree?: Record<string, string | null>;
    saved?: object | null;
  }): Adapters;
}

declare module "@quest/engine/course" {
  export function loadCourse(root: string): readonly object[];
}
