// The host's adapters and interface, as JSDoc types only (ticket 209). Real
// adapters (real.mjs) and fake ones (fake.mjs) share these shapes; ticket
// 215's TypeScript conversion starts from them.

/**
 * The host's one clock: monotonic milliseconds, the intervals of the tick
 * and the poll, and the Check child's per-item limit. The watcher's debounce
 * and git's own time limit do not go through it. `epoch` is the wall clock
 * in epoch milliseconds, for the server time events and heartbeats carry.
 * @typedef {object} Clock
 * @property {() => number} now
 * @property {() => number} epoch
 * @property {(fn: () => void, ms: number) => unknown} setInterval
 * @property {(id: unknown) => void} clearInterval
 * @property {(fn: () => void, ms: number) => unknown} setTimeout
 * @property {(id: unknown) => void} clearTimeout
 */

/**
 * @typedef {object} CheckItem
 * @property {number} index
 * @property {string} text
 * @property {boolean} pass
 * @property {string} hint
 * @property {boolean} [slow]
 */

/**
 * A lesson's check, in the Check child: its items, or why it could not run.
 * @typedef {object} Checks
 * @property {(dir: string, lesson: string, items: number[] | null, opts?: { slow?: boolean, onRunning?: (n: number, m: number) => void }) => Promise<{ items: CheckItem[] } | { error: string }>} run
 */

/**
 * One git probe, in the Check child.
 * @typedef {object} Probes
 * @property {(dir: string, name: string, args: string[]) => Promise<{ pass: boolean, hint?: string, evidence?: string | null, state: string } | { error: string }>} run
 */

/**
 * Read-only git: its first answers about the copy, [why it is no
 * repository or null, a first name], and status.
 * @typedef {object} Git
 * @property {(root: string) => Promise<[string | null, string]>} ask
 * @property {(dir: string, opts?: { files?: boolean, head?: boolean }) => Promise<{ paths: string[], staged: string[], head?: string | null } | { error: string }>} status
 */

/**
 * @typedef {object} FolderLook
 * @property {string} path
 * @property {boolean} missing
 * @property {boolean} git
 * @property {string | null} gitBroken
 * @property {boolean} practice
 */

/**
 * @typedef {object} Folders
 * @property {(path: string) => Promise<FolderLook>} look
 */

/**
 * Files in a work folder, read as they are now. A path is from `dir`; a
 * glob matches the newest file.
 * @typedef {object} Files
 * @property {(dir: string, path: string) => string | null} match
 * @property {(dir: string, path: string) => Buffer | null} bytes
 * @property {(dir: string, path: string) => string | null} stamp
 * @property {(abs: string) => boolean} exists
 */

/**
 * Arms a watcher on a folder; it calls onChange after changes settle.
 * @typedef {(dir: string, onChange: () => void) => { close: () => void }} Watch
 */

/**
 * The store, bound to the practice copy: save returns false, writing
 * nothing, while `.practice/` is missing, and throws where the write fails.
 * @typedef {object} Store
 * @property {() => object | null} load
 * @property {(data: object) => boolean} save
 */

/**
 * The PATH lookup, bound to the environment: no process starts.
 * @typedef {object} Commands
 * @property {(name: string) => boolean} has
 */

/**
 * @typedef {object} Adapters
 * @property {Clock} clock
 * @property {Checks} checks
 * @property {Probes} probes
 * @property {Git} git
 * @property {Folders} folders
 * @property {Files} files
 * @property {Watch} watch
 * @property {Store} store
 * @property {Commands} commands
 * @property {() => void} stop kills this host's children
 * @property {{ size: () => number }} [children] the real adapters' registry, for tests
 */

/**
 * The lesson engine the host runs: the real one by default. It is an
 * option only so a test can wrap the real engine, to add effects to an
 * input, log what was reduced or read the state (quest/host/test's tap).
 * `events` are the contract's QuestEvent values, without their envelope.
 * @typedef {object} EngineSeam
 * @property {(state: object, input: object) => { state: object, effects: object[], events: import("@quest/contract").QuestEvent[] }} reduce
 * @property {(args: object) => object} initialState
 */

/**
 * @typedef {object} HostOptions
 * @property {string} [instance] this process's instance ID, random by default
 * @property {string} root the practice copy
 * @property {object[]} course
 * @property {object | null} [saved]
 * @property {Record<string, string | undefined>} [env]
 * @property {string} [platform]
 * @property {Adapters} adapters
 * @property {object} [facts] facts the client knows, over the host's own
 * @property {EngineSeam} [engine] the real engine unless a test wraps it
 * @property {FolderLook | null} [ahead] the folder --dir gave, looked at
 */

/**
 * What a listener hears after each change: the revision and snapshot after
 * it, its events in their envelopes, and the input. Never the raw state.
 * `input` is the host's own, for its tests and its wiring, and never goes
 * to a client: a host input carries file bytes, folders and messages.
 * @typedef {object} Heard
 * @property {number} revision
 * @property {import("@quest/contract").Snapshot} snapshot
 * @property {import("@quest/contract").EventEnvelope[]} events
 * @property {object} input host-only, never sent to a client
 */

/**
 * What dispatch returns: the revision and snapshot after the action, with
 * `stale` where it was based on an older place, or on another instance's,
 * and applied nothing.
 * @typedef {object} Dispatched
 * @property {number} revision
 * @property {import("@quest/contract").Snapshot | null} snapshot
 * @property {true} [stale]
 */

/**
 * @typedef {object} Host
 * @property {() => Promise<import("@quest/contract").Snapshot | null>} open
 * @property {() => void} start
 * @property {() => void} firstLook
 * @property {(action: object, opts?: { revision?: number, instance?: string }) => Dispatched} dispatch
 * @property {() => import("@quest/contract").Snapshot | null} snapshot
 * @property {(id: string) => import("@quest/contract").EventEnvelope[] | null} eventsAfter
 * @property {(fn: (heard: Heard) => void) => () => void} subscribe
 * @property {() => void} close
 * @property {Clock} clock
 * @property {string} instance
 * @property {() => number} revision
 * @property {() => number} serverTime
 */

/**
 * @typedef {object} RealOptions
 * @property {string} root
 * @property {Record<string, string | undefined>} [env]
 * @property {string} [platform]
 * @property {Clock} [clock]
 * @property {(dir: string, onChange: () => void) => { close: () => void }} [watch]
 * @property {(root: string) => Promise<[string | null, string]>} [askGit]
 * @property {Function} [runCheck]
 * @property {Function} [runProbe]
 */

export {};
