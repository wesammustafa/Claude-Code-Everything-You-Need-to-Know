// Starting the server for one Practice copy: the arguments, the lesson host,
// the port, then the address, and a single shutdown on a signal.
import type { Server } from "node:http";
import { parseArgs } from "node:util";
import type { CourseEntry } from "@quest/engine";
import type { Adapters, Host, HostOptions, RealOptions } from "@quest/host";
import { createApp } from "./app.ts";
import { createStreams } from "./events.ts";
import { codespaceUrl, localUrl, stopLine, type Env } from "./launch.ts";
import { BASE_PORT, PORT_TRIES, listen, type TryListen } from "./listen.ts";
import type { Statics } from "./statics.ts";

export const USAGE = "Usage: npm run learn [-- --dir <folder>]";

export interface Output {
  write(text: string): unknown;
}

/** What delivers the signals and the exit: the process, or a test's emitter. */
export interface Signals {
  on(event: "SIGINT" | "SIGTERM" | "SIGHUP" | "exit", fn: () => void): unknown;
}

export interface StartOptions {
  /** The Practice copy the app runs in. */
  root: string;
  /** Where the course is read from: the copy, or the repo's template in development. */
  courseRoot?: string;
  argv: readonly string[];
  env: Env;
  platform: string;
  /** The first port to try: 4747, or 0 for any free port (a test). */
  base?: number;
  statics: Statics;
  signals: Signals;
  stdout: Output;
  stderr: Output;
  exit: (code: number) => void;
  isTTY: boolean;
  /** Print the address and open the browser: false in dev, whose app is Vite's. */
  announce?: boolean;
  openBrowser: (url: string) => void;
  createHost: (options: HostOptions) => Host;
  realAdapters: (options: RealOptions) => Adapters;
  loadCourse: (root: string) => readonly CourseEntry[];
  /** Replaces the real listen, for a test. */
  probe?: (server: Server) => TryListen;
}

export interface Started {
  server: Server;
  port: number;
  host: Host;
}

export async function start({
  root,
  courseRoot = root,
  argv,
  env,
  platform,
  base = BASE_PORT,
  statics,
  signals,
  stdout,
  stderr,
  exit,
  isTTY,
  announce = true,
  openBrowser,
  createHost,
  realAdapters,
  loadCourse,
  probe,
}: StartOptions): Promise<Started | null> {
  let dir: string | undefined;
  try {
    dir = parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: false,
      options: { dir: { type: "string" } },
    }).values.dir;
  } catch {
    stderr.write(`${USAGE}\n`);
    exit(2);
    return null;
  }
  // Ticket 252 reads --dir.
  if (dir !== undefined)
    stderr.write("--dir is not read yet: starting without it.\n");

  const course = loadCourse(courseRoot);
  const adapters = realAdapters({ root, env, platform });
  const host = createHost({
    root,
    course,
    saved: adapters.store.load(),
    env,
    platform,
    adapters,
  });

  // Listen before the host opens: open() waits on git, and the health check
  // and the static files never need the snapshot.
  // Actions wait for open() to settle; the trust checks read the port once
  // it is bound.
  const opened = Promise.withResolvers<undefined>();
  const bound: { port?: number } = {};
  const streams = createStreams();
  const app = createApp({
    health: () => ({ ok: true, instance: host.instance }),
    statics,
    env,
    port: () => bound.port,
    host,
    ready: opened.promise,
    root,
    streams,
    log: (line) => stderr.write(`${line}\n`),
  });
  const up = await listen({
    fetch: app.fetch,
    base,
    ...(probe ? { probe } : {}),
  });
  if (!up) {
    host.close();
    stderr.write(
      `Claude Code Quest could not start: ports ${String(base)} to ${String(base + PORT_TRIES - 1)} on 127.0.0.1 are all in use. Stop what is using them, then run npm run learn again.\n`,
    );
    exit(1);
    return null;
  }
  const { server, port } = up;
  bound.port = port;

  const shutdown = { done: false };
  const stop = () => {
    if (shutdown.done) return;
    shutdown.done = true;
    host.close();
    server.close();
    // Each stream ends itself first; closeAllConnections is the backstop.
    streams.closeAll();
    server.closeAllConnections();
    stdout.write(`${stopLine({ copy: root })}\n`);
    exit(0);
  };
  // `on`, not `once`: Node restores a signal's default action when its last
  // listener goes, so a second signal during shutdown (Ctrl+C reaches the
  // server from the terminal and again through npm) would kill it before the
  // stop line and exit 0. stop() runs once.
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const)
    signals.on(signal, stop);
  // close() is sync and idempotent: it ends each Check child's process group
  // on any exit, a crash included.
  signals.on("exit", () => {
    host.close();
  });

  // The address goes out as soon as the server listens, not after git: the
  // page waits for its first snapshot (ticket 218).
  if (announce) {
    const forwarded = codespaceUrl(env, port);
    const local = localUrl(port);
    stdout.write(
      `${forwarded ?? `Claude Code Quest is running at ${local}`}\n`,
    );
    if (!forwarded && isTTY) openBrowser(local);
  }

  try {
    await host.open();
  } catch (error) {
    // The server keeps answering; the page shows what the host knows.
    stderr.write(
      `Claude Code Quest could not read the folder: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  } finally {
    opened.resolve(undefined);
  }
  // A signal while git answered has already stopped everything.
  if (shutdown.done) return { ...up, host };
  host.start();
  host.firstLook();
  return { ...up, host };
}
