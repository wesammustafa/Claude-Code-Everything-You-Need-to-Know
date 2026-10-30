// The app around a real lesson host on fake adapters: the repo's compiled
// course, a fake Practice copy at /copy, a pinned instance, and trusted()
// headers for a same-origin POST. Nothing here binds a port.
import { fileURLToPath } from "node:url";
import { createHost, type Host } from "@quest/host";
import { fakeAdapters } from "@quest/host/fake";
import { loadCourse } from "@quest/engine/course";
import type { Hono } from "hono";
import { createApp, type AppOptions } from "../src/app.ts";

export const INSTANCE = "i-217";
export const HOST = "127.0.0.1:4800";
const TEMPLATE = fileURLToPath(
  new URL("../../../practice-template", import.meta.url),
);

export function questHost(): Host {
  const adapters = fakeAdapters({
    root: "/copy",
    tree: { "/copy/.practice": null },
  });
  return createHost({
    root: "/copy",
    course: loadCourse(TEMPLATE),
    saved: null,
    env: { HOME: "/home/sam" },
    platform: "linux",
    adapters,
    instance: INSTANCE,
  });
}

/** A same-origin JSON POST's headers, with `extra` over them (undefined drops one). */
export function trusted(
  extra: Record<string, string | undefined> = {},
): Record<string, string> {
  const headers: Record<string, string | undefined> = {
    Host: HOST,
    Origin: `http://${HOST}`,
    "Content-Type": "application/json",
    "Sec-Fetch-Site": "same-origin",
    ...extra,
  };
  return Object.fromEntries(
    Object.entries(headers).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

export interface ActionKit {
  app: Hono;
  host: Host;
  logged: string[];
  dispatched: unknown[];
  /** POSTs `body` (JSON unless a string) to /api/actions. */
  post(
    body: unknown,
    headers?: Record<string, string | undefined>,
  ): Promise<Response>;
}

/** The app over an opened host (unless `open` is false), dispatch recorded. */
export async function actionKit(
  options: Partial<AppOptions> & { open?: boolean } = {},
): Promise<ActionKit> {
  const { open = true, ...rest } = options;
  const host = rest.host ?? questHost();
  const dispatched: unknown[] = [];
  const dispatch = host.dispatch.bind(host);
  host.dispatch = (action, opts) => {
    dispatched.push(action);
    return dispatch(action, opts);
  };
  if (open) await host.open();
  const logged: string[] = [];
  const app = createApp({
    health: () => ({ ok: true, instance: host.instance }),
    statics: new Map(),
    log: (line) => logged.push(line),
    env: {},
    port: () => 4800,
    root: "/copy",
    checkFolder: () => Promise.resolve({ refused: "missing" }),
    ...rest,
    host,
  });
  return {
    app,
    host,
    logged,
    dispatched,
    post: (body, headers = {}) =>
      Promise.resolve(
        app.request("/api/actions", {
          method: "POST",
          headers: trusted(headers),
          body: typeof body === "string" ? body : JSON.stringify(body),
        }),
      ),
  };
}

/** A request for `action` at the host's current place. */
export function at(host: Host, action: object): object {
  return { action, instance: host.instance, revision: host.revision() };
}
