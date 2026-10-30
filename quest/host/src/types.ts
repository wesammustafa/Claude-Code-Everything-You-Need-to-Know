// The host's adapters and interface, as types only (ticket 209). Real
// adapters (real.ts) and fake ones (fake.ts) share these shapes.
import type {
  EventEnvelope,
  InstanceId,
  QuestEvent,
  Revision,
  Snapshot,
} from "@quest/contract";
import type {
  CheckItem,
  CourseEntry,
  Effect,
  EngineInput,
  EngineState,
  Facts,
  SavedProgress,
} from "@quest/engine";
import type { Children } from "./children.ts";

/**
 * The host's one clock: monotonic milliseconds, the intervals of the tick
 * and the poll, and the Check child's per-item limit. The watcher's debounce
 * and git's own time limit do not go through it. `epoch` is the wall clock
 * in epoch milliseconds, for the server time events and heartbeats carry.
 */
export interface Clock {
  now(): number;
  epoch(): number;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

export type { CheckItem };

export interface CheckOptions {
  slow?: boolean | undefined;
  onRunning?: ((n: number, m: number) => void) | undefined;
}

export type CheckResult = { items: CheckItem[] } | { error: string };

export interface ProbePassed {
  pass: boolean;
  hint?: string | undefined;
  evidence?: string | null | undefined;
  state: string;
}

export type ProbeResult = ProbePassed | { error: string };

/** A lesson's check, in the Check child: its items, or why it could not run. */
export interface Checks {
  run(
    dir: string,
    lesson: string,
    items: number[] | null,
    opts?: CheckOptions,
  ): Promise<CheckResult>;
}

/** One git probe, in the Check child. */
export interface Probes {
  run(dir: string, name: string, args: string[]): Promise<ProbeResult>;
}

export interface GitStatus {
  paths: string[];
  staged: string[];
  head?: string | null;
}

/**
 * Read-only git: its first answers about the copy, [why it is no
 * repository or null, a first name], and status.
 */
export interface Git {
  ask(root: string): Promise<[string | null, string]>;
  status(
    dir: string,
    opts?: { files?: boolean | undefined; head?: boolean | undefined },
  ): Promise<GitStatus | { error: string }>;
}

export interface FolderLook {
  path: string;
  missing: boolean;
  git: boolean;
  gitBroken: string | null;
  practice: boolean;
}

export interface Folders {
  look(path: string): Promise<FolderLook>;
}

/**
 * Files in a work folder, read as they are now. A path is from `dir`; a
 * glob matches the newest file.
 */
export interface Files {
  match(dir: string, path: string): string | null;
  bytes(dir: string, path: string): Buffer | null;
  stamp(dir: string, path: string): string | null;
  exists(abs: string): boolean;
}

/** Arms a watcher on a folder; it calls onChange after changes settle. */
export type Watch = (dir: string, onChange: () => void) => { close(): void };

/**
 * What the store loads: the saved file, null where there is none, or, for a
 * file it could not read, `{ unreadable: "moved" }` once it moved the file
 * aside, or `{ unreadable: "kept" }` where it could not.
 */
export type StoreLoad = SavedProgress | null | { unreadable: "moved" | "kept" };

/**
 * The store, bound to the practice copy: save returns false, writing
 * nothing, while `.practice/` is missing, and throws where the write fails.
 * After `{ unreadable: "kept" }`, save writes nothing and returns false.
 */
export interface Store {
  load(): StoreLoad;
  save(data: object): boolean;
}

/** The PATH lookup, bound to the environment: no process starts. */
export interface Commands {
  has(name: string): boolean;
}

export interface Adapters {
  clock: Clock;
  checks: Checks;
  probes: Probes;
  git: Git;
  folders: Folders;
  files: Files;
  watch: Watch;
  store: Store;
  commands: Commands;
  /** Kills this host's children. */
  stop(): void;
  /** The real adapters' registry, for tests. */
  children?: Pick<Children, "size">;
}

/**
 * The lesson engine the host runs: the real one by default. It is an
 * option only so a test can wrap the real engine, to add effects to an
 * input, log what was reduced or read the state (quest/host/test's tap).
 * `events` are the contract's QuestEvent values, without their envelope.
 */
export interface EngineSeam {
  reduce(
    state: EngineState,
    input: EngineInput,
  ): { state: EngineState; effects: Effect[]; events: QuestEvent[] };
  initialState(args: {
    course: CourseEntry[];
    saved?: SavedProgress | null;
    facts: Facts;
    now?: number;
    epoch?: number;
  }): EngineState;
}

export interface HostOptions {
  /** This process's instance ID, random by default. */
  instance?: InstanceId | undefined;
  /** The practice copy. */
  root: string;
  course: readonly CourseEntry[];
  saved?: StoreLoad | undefined;
  env?: Record<string, string | undefined> | undefined;
  platform?: string | undefined;
  adapters: Adapters;
  /** Facts the client knows, over the host's own. */
  facts?: Partial<Facts> | undefined;
  /** The real engine unless a test wraps it. */
  engine?: EngineSeam | undefined;
  /** The folder --dir gave, looked at. */
  ahead?: FolderLook | null | undefined;
}

/**
 * What a listener hears after each change: the revision and snapshot after
 * it and its events in their envelopes. Never the raw state, and never the
 * host's input: a host input carries file bytes, folders and messages.
 */
export interface Heard {
  revision: Revision;
  snapshot: Snapshot;
  events: EventEnvelope[];
}

/** What the host's own tests and wiring hear: Heard and the input. */
export interface HostHeard extends Heard {
  input: object;
}

/**
 * What dispatch returns: the revision and snapshot after the action, with
 * `stale` where it was based on an older place, or on another instance's,
 * and applied nothing.
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
  /** Throws a TypeError for a type not in HOST_ACTION_TYPES. */
  dispatch(
    action: { type: string },
    opts?: { revision?: Revision; instance?: InstanceId },
  ): Dispatched;
  /** Null until open() resolves. */
  snapshot(): Snapshot | null;
  /** The envelopes after `id`, oldest first; null when this instance no longer holds it. */
  eventsAfter(id: string): EventEnvelope[] | null;
  /** Calls `fn` after each change; returns the unsubscribe. */
  subscribe(fn: (heard: HostHeard) => void): () => void;
  close(): void;
  clock: Clock;
  instance: InstanceId;
  revision(): Revision;
  /** The clock's epoch milliseconds, for the heartbeat. */
  serverTime(): number;
}

export type RunCheck = (
  dir: string,
  lesson: string,
  items: number[] | null,
  opts?: CheckOptions & {
    limit?: number;
    cap?: number;
    clock?: Pick<Clock, "setTimeout" | "clearTimeout">;
    children?: Children;
  },
) => Promise<CheckResult>;

export type RunProbe = (
  dir: string,
  name: string,
  args: string[],
  opts?: {
    limit?: number;
    cap?: number;
    clock?: Pick<Clock, "setTimeout" | "clearTimeout">;
    children?: Children;
  },
) => Promise<ProbeResult>;

export interface RealOptions {
  root: string;
  env?: Record<string, string | undefined>;
  platform?: string;
  clock?: Clock;
  watch?: Watch;
  askGit?: (root: string) => Promise<[string | null, string]>;
  runCheck?: RunCheck;
  runProbe?: RunProbe;
}
