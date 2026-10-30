// TEMPORARY: ticket 215 deletes this file (214 deletes the @quest/engine/course block).
//
// The quest/host and quest/engine surface the server imports, typed by hand
// while both are still .mjs (owner, 2026-10-30: 216 runs before 215). Kept to
// what the server calls; the source of truth is quest/host/src/types.mjs.

declare module "@quest/host" {
  import type { InstanceId, Snapshot } from "@quest/contract";

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
  }

  export interface Host {
    open(): Promise<Snapshot | null>;
    start(): void;
    firstLook(): void;
    close(): void;
    instance: InstanceId;
  }

  export function createHost(options: HostOptions): Host;
  export function realAdapters(options: RealOptions): Adapters;
}

declare module "@quest/engine/course" {
  export function loadCourse(root: string): readonly object[];
}
