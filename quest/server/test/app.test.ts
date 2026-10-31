import { afterAll, describe, expect, test } from "vitest";
import { PREVIEW_HEADERS } from "../../client/build/plugins.ts";
import { createApp } from "../src/app.ts";
import { SECURITY_HEADERS } from "../src/headers.ts";
import { loadStatics } from "../src/statics.ts";
import { BODY_LIMIT } from "../src/actions.ts";
import { createQueue } from "../src/queue.ts";
import { HOST, actionKit, at, questHost, trusted } from "./action-kit.ts";
import { TABLE, removeTrees, staticTree } from "./fixture.ts";

const logged: string[] = [];
const app = createApp({
  health: () => ({ ok: true, instance: "i-1" }),
  statics: loadStatics(staticTree(), TABLE),
  log: (line) => logged.push(line),
});
afterAll(removeTrees);
app.get("/boom", () => {
  throw new Error("it broke");
});

function expectHeaders(response: Response) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS))
    expect(response.headers.get(name), name).toBe(value);
  const cors = [...response.headers.keys()].filter((name) =>
    name.startsWith("access-control-"),
  );
  expect(cors).toEqual([]);
}

// Every request is sent with a trusted Host; a POST is same-origin JSON.
function send(path: string, init: RequestInit = {}) {
  const method = init.method ?? "GET";
  return app.request(path, {
    ...init,
    headers:
      method === "GET" || method === "HEAD"
        ? { Host: HOST, ...(init.headers as Record<string, string>) }
        : trusted(init.headers as Record<string, string>),
  });
}

describe("every response", () => {
  test.each([
    ["GET", "/api/health", 200],
    ["GET", "/", 200],
    ["HEAD", "/", 200],
    ["GET", "/assets/app-abc123.js", 200],
    ["GET", "/assets/missing.js", 404],
    ["GET", "/api/nothing", 404],
    ["POST", "/api/nothing", 404],
    ["POST", "/api/actions", 404],
    ["POST", "/", 404],
    ["GET", "/boom", 500],
  ])(
    "%s %s carries the headers and no CORS header",
    async (method, path, status) => {
      const response = await send(path, {
        method,
        body: method === "POST" ? "{}" : null,
      });
      expect(response.status).toBe(status);
      expectHeaders(response);
    },
  );

  // Each refusal of an action, through an app around a real host.
  test.each([
    [
      403,
      async () =>
        (await actionKit()).post({}, { Origin: "http://evil.example" }),
    ],
    [400, async () => (await actionKit()).post("{")],
    [
      409,
      async () => {
        const kit = await actionKit();
        return kit.post({
          ...at(kit.host, { type: "welcome.finish" }),
          instance: "other",
        });
      },
    ],
    [413, async () => (await actionKit()).post("x".repeat(BODY_LIMIT + 1))],
    [
      429,
      async () => {
        const kit = await actionKit({
          queue: createQueue(0),
          ready: new Promise(() => undefined),
          open: false,
          host: questHost(),
        });
        void kit.post(at(kit.host, { type: "welcome.finish" }));
        return kit.post(at(kit.host, { type: "welcome.finish" }));
      },
    ],
    [
      503,
      async () => {
        const kit = await actionKit({ open: false, host: questHost() });
        return kit.post(at(kit.host, { type: "welcome.finish" }));
      },
    ],
  ])(
    "a %i action answer carries the headers, no-store and no CORS header",
    async (status, answer) => {
      const response = await answer();
      expect(response.status).toBe(status);
      expectHeaders(response);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("Content-Type")).toMatch(
        /^application\/json/,
      );
    },
  );

  test("the headers are the client preview's, byte for byte", () => {
    expect(SECURITY_HEADERS).toEqual(PREVIEW_HEADERS);
    expect(Object.isFrozen(SECURITY_HEADERS)).toBe(true);
  });
});

describe("the API", () => {
  test("GET /api/health answers ok with the instance, never cached", async () => {
    const response = await send("/api/health");
    expect(await response.json()).toEqual({ ok: true, instance: "i-1" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  test("an unknown API route is a JSON 404, never cached", async () => {
    const response = await send("/api/nothing");
    expect(response.headers.get("Content-Type")).toMatch(/^application\/json/);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  test("an error logs only its message and answers 500", async () => {
    logged.length = 0;
    const response = await send("/boom", {
      headers: { Cookie: "secret=1", "X-Github-Token": "ghs_secret" },
    });
    expect(await response.text()).toBe("Internal error");
    expect(logged).toEqual(["Claude Code Quest: it broke"]);
  });
});

describe("a static file", () => {
  test("HEAD sends the headers of GET and no body", async () => {
    const get = await send("/");
    const head = await send("/", { method: "HEAD" });
    expect(head.headers.get("Content-Type")).toBe(
      get.headers.get("Content-Type"),
    );
    expect(head.headers.get("Content-Length")).toBe(
      get.headers.get("Content-Length"),
    );
    expect(await head.text()).toBe("");
  });

  test("is not answered to a POST", async () => {
    const response = await send("/assets/app-abc123.js", {
      method: "POST",
      body: "{}",
    });
    expect(response.status).toBe(404);
  });
});
