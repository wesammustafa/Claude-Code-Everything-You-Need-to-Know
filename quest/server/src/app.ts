// The server's routes, in a fixed order: the headers on every response, the
// trust checks (ticket 217), the API, then the static files by name.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { HealthResponse } from "@quest/contract";
import type { Host } from "@quest/host";
import { actionRoute, type CheckFolder } from "./actions.ts";
import { createStreams, eventsRoute, type Streams } from "./events.ts";
import { checkFolder as checkPath, homeOf } from "./folders.ts";
import { API_CACHE, SECURITY_HEADERS } from "./headers.ts";
import type { Env } from "./launch.ts";
import { createQueue, type Queue } from "./queue.ts";
import { trust } from "./trust.ts";
import {
  IMMUTABLE_CACHE,
  PAGE_CACHE,
  compressible,
  encoded,
  pickEncoding,
  type Statics,
} from "./statics.ts";

export interface AppOptions {
  health: () => HealthResponse;
  statics: Statics;
  /** Where an unexpected error's message goes: stderr by default. */
  log?: (line: string) => void;
  /** The environment: the codespace variables and the home folder. */
  env?: Env;
  /** The bound port, undefined until the server listens. */
  port?: () => number | undefined;
  /** The lesson host: without one, POST /api/actions and GET /api/events are 404s. */
  host?: Host;
  /** Settles when the host's open() settles: actions wait for it. */
  ready?: Promise<unknown>;
  /** The Practice copy, which folder.choose may not name or hold. */
  root?: string;
  checkFolder?: CheckFolder;
  queue?: Queue;
  /** The open event streams: start() closes them all on shutdown. */
  streams?: Streams;
}

export function createApp({
  health,
  statics,
  log = (line) => process.stderr.write(`${line}\n`),
  env = process.env,
  port = () => undefined,
  host,
  ready = Promise.resolve(),
  root = process.cwd(),
  checkFolder = (path) => checkPath(path, { home: homeOf(env), root }),
  queue = createQueue(),
  streams = createStreams(),
}: AppOptions): Hono {
  const app = new Hono();

  // Outermost, so the not-found and error responses carry them too.
  app.use(async (c, next) => {
    await next();
    for (const [name, value] of Object.entries(SECURITY_HEADERS))
      c.res.headers.set(name, value);
  });

  // Before every route: the Host, X-Forwarded-Host and POST checks.
  app.use(trust({ env, port }));

  app.get("/api/health", (c) => {
    c.header("Cache-Control", API_CACHE);
    return c.json(health());
  });

  if (host) actionRoute(app, { host, ready, queue, checkFolder });

  if (host) eventsRoute(app, { host, ready, streams });

  app.all("/api/*", (c) => {
    c.header("Cache-Control", API_CACHE);
    return c.json({ error: "not found" }, 404);
  });

  app.get("*", async (c, next) => {
    const file = statics.get(new URL(c.req.url).pathname);
    if (!file) return next();
    c.header("Content-Type", file.type);
    c.header("Cache-Control", file.immutable ? IMMUTABLE_CACHE : PAGE_CACHE);
    let body = file.bytes;
    if (compressible(file.type)) {
      c.header("Vary", "Accept-Encoding");
      const encoding = pickEncoding(c.req.header("Accept-Encoding"));
      const packed = encoding && (await encoded(file, encoding));
      if (encoding && packed) {
        c.header("Content-Encoding", encoding);
        body = packed;
      }
    }
    c.header("Content-Length", String(body.length));
    // A view of the kept bytes, not a copy.
    return c.body(new Uint8Array(body.buffer, body.byteOffset, body.length));
  });

  app.notFound((c) => c.text("Not found", 404));

  // Only the message: never a header, a body or a stack with paths in it.
  app.onError((error, c) => {
    log(`Claude Code Quest: ${error.message}`);
    if (error instanceof HTTPException) return error.getResponse();
    return c.text("Internal error", 500);
  });

  return app;
}
