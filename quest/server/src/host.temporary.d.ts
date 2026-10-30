// TEMPORARY: ticket 215 deletes this file (214 deletes the @quest/engine/course block).
//
// The quest/host and quest/engine surface the server imports, typed by hand
// while both are still .mjs (owner, 2026-10-30: 216 runs before 215). Kept to
// what the server calls; the source of truth is quest/host/src/types.mjs.

declare module "@quest/host" {
  import type {
    InstanceId,
    QuestActionType,
    Revision,
    Snapshot,
  } from "@quest/contract";

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
  }

  /** The engine's action types plus `milestone.shown`. */
  export const HOST_ACTION_TYPES: readonly QuestActionType[];

  export function createHost(options: HostOptions): Host;
  export function realAdapters(options: RealOptions): Adapters;
}

declare module "@quest/host/fake" {
  import type { Adapters } from "@quest/host";

  export function fakeClock(from?: number, epoch0?: number): object;
  /** In-memory adapters for a test: `root` is the copy, `tree` its files ({abs: text, or null for a folder}). */
  export function fakeAdapters(options?: {
    root?: string;
    clock?: object;
    tree?: Record<string, string | null>;
    saved?: object | null;
  }): Adapters;
}

declare module "@quest/engine/course" {
  export function loadCourse(root: string): readonly object[];
}
