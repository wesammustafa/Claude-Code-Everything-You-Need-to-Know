// The raw-HTTP security suite's trust cases (spec, Server security): the
// Host and X-Forwarded-Host rules on every route, the POST rules, GETs that
// change nothing and no CORS header anywhere. ROUTES (./routes.ts) is
// re-exported here; it holds /api/events, whose stream each test cancels.
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createApp } from "../src/app.ts";
import { codespaceHost } from "../src/launch.ts";
import { loadStatics } from "../src/statics.ts";
import { mediaType, trustedHost } from "../src/trust.ts";
import { HOST, actionKit, at, trusted, type ActionKit } from "./action-kit.ts";
import { TABLE, removeTrees, staticTree } from "./fixture.ts";
import { raw, rawHead, request, serve } from "./raw.ts";
import { ROUTES } from "./routes.ts";

export { ROUTES };

const CODESPACE = {
  CODESPACE_NAME: "fuzzy-robot-123",
  GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
};

let kit: ActionKit;
let statics: ReturnType<typeof loadStatics>;
beforeAll(async () => {
  statics = loadStatics(staticTree(), TABLE);
  kit = await actionKit({ statics });
});
afterAll(removeTrees);

const body = () => JSON.stringify(at(kit.host, { type: "answer.reveal" }));

// A request on `route` with `headers` over the trusted ones; a POST carries
// a valid action.
function send(
  [method, path]: readonly [string, string],
  headers: Record<string, string | undefined> = {},
  app = kit.app,
) {
  const post = method !== "GET" && method !== "HEAD";
  return app.request(path, {
    method,
    headers: post
      ? trusted(headers)
      : trusted({
          Origin: undefined,
          "Content-Type": undefined,
          "Sec-Fetch-Site": undefined,
          ...headers,
        }),
    ...(post ? { body: body() } : {}),
  });
}

function expectRefused(response: Response) {
  expect(response.status).toBe(403);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  const cors = [...response.headers.keys()].filter((name) =>
    name.startsWith("access-control-"),
  );
  expect(cors).toEqual([]);
}

describe("the Host", () => {
  test.each(ROUTES)(
    "%s %s is answered with a trusted Host",
    async (...route) => {
      const response = await send(route);
      expect(response.status).not.toBe(403);
      await response.body?.cancel();
    },
  );

  test.each(ROUTES)("%s %s refuses a rebound Host", async (...route) => {
    const response = await send(route, { Host: "evil.example:4800" });
    expectRefused(response);
    await response.body?.cancel();
    expect(kit.logged).toEqual([]);
  });

  test.each(["127.0.0.1", "127.0.0.1:4747", "localhost", "LOCALHOST:65535"])(
    "%s is trusted",
    (host) => {
      expect(trustedHost(host)).toBe(true);
    },
  );

  test.each([
    "[::1]:4747",
    "localhost.:4747",
    "127.0.0.1.:4747",
    "127.0.0.2:4747",
    "localhost.evil.example",
    "user@localhost:4747",
    "localhost:4747, evil.example",
    "localhost:123456",
    "",
  ])("%s is refused", async (host) => {
    expect(trustedHost(host)).toBe(false);
    expectRefused(await send(["GET", "/api/health"], { Host: host }));
  });

  test("a missing Host is refused", async () => {
    const response = await kit.app.request("/api/health");
    expectRefused(response);
  });
});

describe("the Host over a socket", () => {
  let server: Server;
  let port: number;
  beforeAll(async () => {
    ({ server, port } = await serve(kit.app.fetch));
  });
  afterAll(() => {
    server.closeAllConnections();
    server.close();
  });

  test("a trusted Host is answered", async () => {
    const reply = await raw(
      port,
      request("GET", "/api/health", { Host: HOST }),
    );
    expect(reply?.status).toBe(200);
  });

  test("a duplicated Host is refused", async () => {
    const reply = await raw(
      port,
      "GET /api/health HTTP/1.1\r\nHost: 127.0.0.1:4800\r\nHost: evil.example\r\nConnection: close\r\n\r\n",
    );
    expect(reply?.status).toBeGreaterThanOrEqual(400);
    expect(reply?.status).toBeLessThan(500);
    expect(reply?.body).not.toContain('"ok"');
  });

  test("the stream answers a trusted Host", async () => {
    const reply = await rawHead(
      port,
      request("GET", "/api/events", { Host: HOST }),
    );
    expect(reply?.status).toBe(200);
    expect(reply?.headers.get("content-type")).toContain("text/event-stream");
  });

  test("the stream refuses a rebound Host", async () => {
    const reply = await raw(
      port,
      request("GET", "/api/events", { Host: "evil.example:4800" }),
    );
    expect(reply?.status).toBe(403);
    expect(reply?.headers.get("content-type")).not.toContain(
      "text/event-stream",
    );
  });

  test("the stream refuses a duplicated Host", async () => {
    const reply = await rawHead(
      port,
      "GET /api/events HTTP/1.1\r\nHost: 127.0.0.1:4800\r\nHost: evil.example\r\nConnection: close\r\n\r\n",
    );
    expect(reply?.status).toBeGreaterThanOrEqual(400);
    expect(reply?.status).toBeLessThan(500);
    expect(reply?.headers.get("content-type") ?? "").not.toContain(
      "text/event-stream",
    );
  });

  test("an absolute-form request naming another host is refused", async () => {
    const reply = await raw(
      port,
      request("GET", "http://evil.example/api/health", { Host: HOST }),
    );
    expect(reply?.status).toBe(403);
  });

  test("a missing Host is refused before the app", async () => {
    const reply = await raw(
      port,
      "GET /api/health HTTP/1.1\r\nConnection: close\r\n\r\n",
    );
    expect(reply?.status).toBe(400);
  });
});

describe("X-Forwarded-Host", () => {
  const port = 4800;
  const forwarded = codespaceHost(CODESPACE, port) ?? "";
  const inCodespace = async (bound: number | null = port) =>
    (
      await actionKit({
        host: kit.host,
        open: false,
        statics,
        env: CODESPACE,
        port: () => bound ?? undefined,
      })
    ).app;

  test("outside a codespace, any value is refused", async () => {
    expectRefused(
      await send(["GET", "/api/health"], { "X-Forwarded-Host": forwarded }),
    );
  });

  test.each(ROUTES)("%s %s refuses a wrong one", async (...route) => {
    const app = await inCodespace();
    const response = await send(
      route,
      { "X-Forwarded-Host": "evil.example" },
      app,
    );
    expectRefused(response);
    await response.body?.cancel();
  });

  test("a spoofed one, another codespace's port, is refused", async () => {
    const app = await inCodespace();
    expectRefused(
      await send(
        ["GET", "/api/health"],
        { "X-Forwarded-Host": codespaceHost(CODESPACE, 4747) ?? "" },
        app,
      ),
    );
  });

  test("a duplicated one is refused", async () => {
    const app = await inCodespace();
    expectRefused(
      await send(
        ["GET", "/api/health"],
        { "X-Forwarded-Host": `${forwarded}, ${forwarded}` },
        app,
      ),
    );
  });

  test("before the port is bound, the right name is refused", async () => {
    const app = await inCodespace(null);
    expectRefused(
      await send(
        ["GET", "/api/health"],
        { "X-Forwarded-Host": forwarded },
        app,
      ),
    );
  });

  test("the codespace's own name is answered, and a POST from https://localhost:<port>", async () => {
    const app = await inCodespace();
    const host = `localhost:${String(port)}`;
    expect(
      (
        await send(
          ["GET", "/api/health"],
          { Host: host, "X-Forwarded-Host": forwarded },
          app,
        )
      ).status,
    ).toBe(200);
    const post = await send(
      ["POST", "/api/actions"],
      { Host: host, "X-Forwarded-Host": forwarded, Origin: `https://${host}` },
      app,
    );
    expect(post.status).toBe(200);
  });

  test.each(["127.0.0.1", "LOCALHOST"])(
    "a forwarded POST from https://%s:<port> is refused",
    async (name) => {
      const app = await inCodespace();
      const host = `${name}:${String(port)}`;
      expectRefused(
        await send(
          ["POST", "/api/actions"],
          {
            Host: host,
            "X-Forwarded-Host": forwarded,
            Origin: `https://${host}`,
          },
          app,
        ),
      );
    },
  );

  test("a forwarded POST from https://localhost on another port is refused", async () => {
    const app = await inCodespace();
    const host = `localhost:${String(port)}`;
    expectRefused(
      await send(
        ["POST", "/api/actions"],
        {
          Host: host,
          "X-Forwarded-Host": forwarded,
          Origin: `https://localhost:${String(port + 1)}`,
        },
        app,
      ),
    );
  });

  test("an https Origin without the forwarded header is refused", async () => {
    expectRefused(
      await send(["POST", "/api/actions"], { Origin: `https://${HOST}` }),
    );
  });
});

describe("a POST", () => {
  const actions = ["POST", "/api/actions"] as const;

  test("a same-origin JSON POST is answered", async () => {
    expect((await send(actions)).status).toBe(200);
  });

  test("a cross-site Origin is refused", async () => {
    expectRefused(await send(actions, { Origin: "http://evil.example" }));
  });

  test("another local port's Origin is refused", async () => {
    expectRefused(await send(actions, { Origin: "http://127.0.0.1:5173" }));
  });

  test("a missing Origin is refused", async () => {
    expectRefused(await send(actions, { Origin: undefined }));
  });

  test("a null Origin is refused", async () => {
    expectRefused(await send(actions, { Origin: "null" }));
  });

  test.each([
    ["text/plain", "text/plain"],
    ["a form", "application/x-www-form-urlencoded"],
    ["multipart", "multipart/form-data; boundary=x"],
    ["json-like", "application/json-patch+json"],
  ])("%s content type is refused", async (_, type) => {
    expectRefused(await send(actions, { "Content-Type": type }));
  });

  test("a missing content type is refused", async () => {
    expectRefused(await send(actions, { "Content-Type": undefined }));
  });

  test("JSON with a charset is answered", async () => {
    expect(
      (
        await send(actions, {
          "Content-Type": "Application/JSON; charset=utf-8",
        })
      ).status,
    ).toBe(200);
    expect(mediaType(" application/json ;x")).toBe("application/json");
  });

  test("Sec-Fetch-Site: cross-site is refused", async () => {
    expectRefused(await send(actions, { "Sec-Fetch-Site": "cross-site" }));
  });

  test("Sec-Fetch-Site: same-site is refused", async () => {
    expectRefused(await send(actions, { "Sec-Fetch-Site": "same-site" }));
  });

  test("Sec-Fetch-Site: none is refused", async () => {
    expectRefused(await send(actions, { "Sec-Fetch-Site": "none" }));
  });

  test("no Sec-Fetch-Site is answered", async () => {
    expect((await send(actions, { "Sec-Fetch-Site": undefined })).status).toBe(
      200,
    );
  });

  test.each(["OPTIONS", "PUT", "DELETE", "PATCH"])(
    "%s is refused under the POST rules, with no CORS header",
    async (method) => {
      // A preflight carries no JSON content type and no same-origin Origin.
      expectRefused(
        await kit.app.request("/api/actions", {
          method,
          headers: {
            Host: HOST,
            Origin: "http://evil.example",
            "Access-Control-Request-Method": "POST",
          },
        }),
      );
    },
  );
});

describe("a GET", () => {
  test("no GET or HEAD route changes the revision or dispatches", async () => {
    const revision = kit.host.revision();
    const snapshot = JSON.stringify(kit.host.snapshot());
    const seen = kit.dispatched.length;
    for (const [method, path] of ROUTES.filter(([m]) => m !== "POST"))
      await (await send([method, path])).body?.cancel();
    for (const method of ["GET", "HEAD"])
      await kit.app.request("/api/actions", {
        method,
        headers: trusted({ "Content-Type": undefined }),
      });
    expect(kit.host.revision()).toBe(revision);
    expect(JSON.stringify(kit.host.snapshot())).toBe(snapshot);
    expect(kit.dispatched.length).toBe(seen);
  });
});

describe("no route", () => {
  test("an app without a host answers POST /api/actions 404", async () => {
    const app = createApp({
      health: () => ({ ok: true, instance: "i-1" }),
      statics: new Map(),
      log: () => undefined,
    });
    const response = await app.request("/api/actions", {
      method: "POST",
      headers: trusted(),
      body: "{}",
    });
    expect(response.status).toBe(404);
  });
});
