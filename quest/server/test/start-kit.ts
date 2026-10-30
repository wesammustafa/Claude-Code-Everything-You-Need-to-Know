// start() with every outside piece replaced: a structural host stub, spies
// for the adapters and the course, signals as an emitter, and base 0, so no
// test binds the real ports 4747 to 4756.
import { EventEmitter } from "node:events";
import type { Host, HostOptions } from "@quest/host";
import { tryListen } from "../src/listen.ts";
import { start, type StartOptions, type Started } from "../src/start.ts";

export interface Kit {
  calls: string[];
  stdout: string[];
  stderr: string[];
  exits: number[];
  opened: string[];
  hostOptions: HostOptions[];
  signals: EventEmitter;
  closes: () => number;
  started: Started | null;
}

export async function startWith(
  overrides: Partial<StartOptions> & { open?: () => Promise<null> } = {},
): Promise<Kit> {
  const calls: string[] = [];
  let closed = 0;
  const kit: Kit = {
    calls,
    stdout: [],
    stderr: [],
    exits: [],
    opened: [],
    hostOptions: [],
    signals: new EventEmitter(),
    closes: () => closed,
    started: null,
  };
  const { open = () => Promise.resolve(null), ...options } = overrides;
  const host: Host = {
    open: () => {
      calls.push("open");
      return open();
    },
    start: () => calls.push("start"),
    firstLook: () => calls.push("firstLook"),
    close: () => {
      closed++;
    },
    instance: "test-instance",
    dispatch: () => {
      calls.push("dispatch");
      return { revision: 0, snapshot: null };
    },
    snapshot: () => null,
    revision: () => 0,
    serverTime: () => 0,
  };
  kit.started = await start({
    root: "/copy",
    argv: [],
    env: {},
    platform: "linux",
    base: 0,
    statics: new Map(),
    signals: kit.signals,
    stdout: { write: (text: string) => kit.stdout.push(text) },
    stderr: { write: (text: string) => kit.stderr.push(text) },
    exit: (code) => kit.exits.push(code),
    isTTY: false,
    openBrowser: (url) => kit.opened.push(url),
    createHost: (o) => {
      kit.hostOptions.push(o);
      return host;
    },
    realAdapters: () => ({ store: { load: () => ({ saved: true }) } }),
    loadCourse: () => {
      calls.push("loadCourse");
      return [];
    },
    // The real listen, recorded.
    probe: (server) => (port) => {
      calls.push("listen");
      return tryListen(server, port);
    },
    ...options,
  });
  return kit;
}

/** Closes what a test left open. */
export function stopAll(kit: Kit): void {
  kit.started?.server.closeAllConnections();
  kit.started?.server.close();
}
