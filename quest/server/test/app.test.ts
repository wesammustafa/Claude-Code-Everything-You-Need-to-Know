import { afterAll, describe, expect, test } from "vitest";
import { PREVIEW_HEADERS } from "../../client/build/plugins.ts";
import { createApp } from "../src/app.ts";
import { SECURITY_HEADERS } from "../src/headers.ts";
import { loadStatics } from "../src/statics.ts";
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

describe("every response", () => {
  test.each([
    ["GET", "/api/health", 200],
    ["GET", "/", 200],
    ["HEAD", "/", 200],
    ["GET", "/assets/app-abc123.js", 200],
    ["GET", "/assets/missing.js", 404],
    ["GET", "/api/nothing", 404],
    ["POST", "/api/nothing", 404],
    ["POST", "/", 404],
    ["GET", "/boom", 500],
  ])(
    "%s %s carries the headers and no CORS header",
    async (method, path, status) => {
      const response = await app.request(path, { method });
      expect(response.status).toBe(status);
      expectHeaders(response);
    },
  );

  test("the headers are the client preview's, byte for byte", () => {
    expect(SECURITY_HEADERS).toEqual(PREVIEW_HEADERS);
    expect(Object.isFrozen(SECURITY_HEADERS)).toBe(true);
  });
});

describe("the API", () => {
  test("GET /api/health answers ok with the instance, never cached", async () => {
    const response = await app.request("/api/health");
    expect(await response.json()).toEqual({ ok: true, instance: "i-1" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  test("an unknown API route is a JSON 404, never cached", async () => {
    const response = await app.request("/api/nothing");
    expect(response.headers.get("Content-Type")).toMatch(/^application\/json/);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  test("an error logs only its message and answers 500", async () => {
    logged.length = 0;
    const response = await app.request("/boom", {
      headers: { Cookie: "secret=1", "X-Github-Token": "ghs_secret" },
    });
    expect(await response.text()).toBe("Internal error");
    expect(logged).toEqual(["Claude Code Quest: it broke"]);
  });
});

describe("a static file", () => {
  test("HEAD sends the headers of GET and no body", async () => {
    const get = await app.request("/");
    const head = await app.request("/", { method: "HEAD" });
    expect(head.headers.get("Content-Type")).toBe(
      get.headers.get("Content-Type"),
    );
    expect(head.headers.get("Content-Length")).toBe(
      get.headers.get("Content-Length"),
    );
    expect(await head.text()).toBe("");
  });

  test("is not answered to a POST", async () => {
    const response = await app.request("/assets/app-abc123.js", {
      method: "POST",
    });
    expect(response.status).toBe(404);
  });
});
