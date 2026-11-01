// Request trust (spec, Server security), on every route before any handler:
// the Host, then X-Forwarded-Host, then, for every method but GET and HEAD,
// the JSON, Origin and Sec-Fetch-Site rules. A refusal is a 403 that logs
// nothing; no response ever carries a CORS header.
import type { MiddlewareHandler } from "hono";
import type { ActionError } from "@quest/contract";
import { API_CACHE } from "./headers.ts";
import { codespaceHost, type Env } from "./launch.ts";

// The whole header: one name, an optional port, nothing else. A list (a
// duplicated Host), `[::1]`, a trailing dot or a userinfo part fails.
const LOOPBACK = /^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/i;

/** Whether a Host header (or a URL's host) names this machine's loopback. */
export function trustedHost(host: string | undefined): boolean {
  return host !== undefined && LOOPBACK.test(host);
}

/** The media type of a Content-Type header, lowercased, parameters dropped. */
export function mediaType(contentType: string | undefined): string | null {
  if (contentType === undefined) return null;
  return contentType.split(";", 1)[0]?.trim().toLowerCase() ?? null;
}

const SAFE = new Set(["GET", "HEAD"]);

export const FORBIDDEN: ActionError = { error: "forbidden" };

export interface TrustOptions {
  env: Env;
  /** The bound port, undefined until the server listens. */
  port: () => number | undefined;
}

export function trust({ env, port }: TrustOptions): MiddlewareHandler {
  return async (c, next) => {
    const refuse = () => {
      c.header("Cache-Control", API_CACHE);
      return c.json(FORBIDDEN, 403);
    };
    const host = c.req.header("host");
    // An absolute-form request line puts its own host in the URL.
    if (!trustedHost(host) || !trustedHost(new URL(c.req.url).host))
      return refuse();

    const forwardedHeader = c.req.header("x-forwarded-host");
    const forwarded = forwardedHeader !== undefined;
    if (forwarded) {
      const bound = port();
      const expected = bound === undefined ? null : codespaceHost(env, bound);
      if (expected === null || forwardedHeader !== expected) return refuse();
    }

    if (!SAFE.has(c.req.method)) {
      if (mediaType(c.req.header("content-type")) !== "application/json")
        return refuse();
      const origin = c.req.header("origin");
      // Forwarded, the browser's origin is the codespace's own localhost
      // form (spec, Server security, item 3), on the bound port only.
      const same =
        origin === `http://${String(host)}` ||
        (forwarded && origin === `https://localhost:${String(port())}`);
      if (!same) return refuse();
      const site = c.req.header("sec-fetch-site");
      if (site !== undefined && site !== "same-origin") return refuse();
    }
    await next();
    return undefined;
  };
}
