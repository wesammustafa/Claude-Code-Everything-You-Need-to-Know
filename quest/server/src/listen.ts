// Where the server listens: 127.0.0.1 only, with no option to bind anywhere
// else, on 4747 or the first free port of the nine after it.
import { createServer, type Server, type ServerOptions } from "node:http";
import { RequestError, getRequestListener } from "@hono/node-server";
import { SECURITY_HEADERS } from "./headers.ts";

export const BASE_PORT = 4747;
export const PORT_TRIES = 10;

/**
 * Node's limits for this server (spec, Server security): 10 s for the
 * headers, 30 s to receive a whole request, checked every second. Both
 * cover only receiving the request, so a stream (ticket 218), whose GET has
 * arrived, runs on. Headers keep Node's default 16 KB.
 */
export const SERVER_LIMITS: ServerOptions = {
  headersTimeout: 10_000,
  requestTimeout: 30_000,
  connectionsCheckingInterval: 1_000,
};
export const MAX_CONNECTIONS = 64;

export type Tried = "listening" | "taken";
export type TryListen = (port: number) => Promise<Tried>;

/**
 * Listens on `port` at 127.0.0.1, or reports it taken: in use, or refused
 * (EACCES covers the port ranges Windows reserves). Any other error rejects.
 */
export function tryListen(server: Server, port: number): Promise<Tried> {
  return new Promise((resolve, reject) => {
    const listening = () => {
      server.off("error", failed);
      resolve("listening");
    };
    const failed = (error: NodeJS.ErrnoException) => {
      server.off("listening", listening);
      if (error.code === "EADDRINUSE" || error.code === "EACCES")
        resolve("taken");
      else reject(error);
    };
    server.once("listening", listening);
    server.once("error", failed);
    server.listen({ port, host: "127.0.0.1" });
  });
}

/**
 * The first port from `base` on that `tryListen` gets, in order, or null
 * when all `tries` are taken. Base 0 asks the system for a port: one try.
 */
export async function firstFreePort({
  base,
  tries,
  tryListen: attempt,
}: {
  base: number;
  tries: number;
  tryListen: TryListen;
}): Promise<number | null> {
  const count = base === 0 ? 1 : tries;
  for (let i = 0; i < count; i++) {
    if ((await attempt(base + i)) === "listening") return base + i;
  }
  return null;
}

export interface Listening {
  server: Server;
  port: number;
}

/**
 * Serves `fetch` on the first free port from `base`, or returns null when
 * every port is taken. `serverOptions` reach Node's server over
 * SERVER_LIMITS; `probe` replaces the real listen, for a test.
 */
export async function listen({
  fetch,
  base = BASE_PORT,
  serverOptions = {},
  probe,
}: {
  fetch: (request: Request) => Response | Promise<Response>;
  base?: number;
  serverOptions?: ServerOptions;
  probe?: (server: Server) => TryListen;
}): Promise<Listening | null> {
  // A request the adaptor refuses itself (a missing or bad Host) never
  // reaches the app: its 400 carries the headers here instead.
  const handle = getRequestListener(fetch, {
    errorHandler: (error) =>
      new Response(null, {
        status: error instanceof RequestError ? 400 : 500,
        headers: SECURITY_HEADERS,
      }),
  });
  const server = createServer(
    { ...SERVER_LIMITS, ...serverOptions },
    (request, response) => {
      void handle(request, response);
    },
  );
  // Past 64, Node closes a new socket at once.
  server.maxConnections = MAX_CONNECTIONS;
  const attempt = probe?.(server) ?? ((port) => tryListen(server, port));
  const got = await firstFreePort({
    base,
    tries: PORT_TRIES,
    tryListen: attempt,
  });
  if (got === null) return null;
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : got;
  return { server, port };
}
