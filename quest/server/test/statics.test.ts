import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { createApp } from "../src/app.ts";
import { encoded, loadStatics, pickEncoding } from "../src/statics.ts";
import {
  PAGE,
  PNG,
  SCRIPT,
  TABLE,
  WASM,
  removeTrees,
  staticTree,
} from "./fixture.ts";

const dir = staticTree();
const statics = loadStatics(dir, TABLE);
const app = createApp({
  health: () => ({ ok: true, instance: "i-1" }),
  statics,
  log: () => undefined,
});
afterAll(removeTrees);

const get = (path: string, accept?: string) =>
  app.request(
    path,
    accept === undefined ? {} : { headers: { "Accept-Encoding": accept } },
  );

async function bytes(response: Response): Promise<Buffer> {
  return Buffer.from(await response.arrayBuffer());
}

describe("names", () => {
  test.each([
    "/secret.txt",
    "/index.html",
    "/assets/../index.html",
    "/assets/%2e%2e/secret.txt",
    "/%2e%2e/%2e%2e/etc/passwd",
    "/assets/..%2fsecret.txt",
    "//etc/passwd",
    "/assets/app-abc123.js/",
  ])("%s is 404: only a listed name is served", async (path) => {
    expect((await get(path)).status).toBe(404);
  });

  test("a listed file that is missing fails the start", () => {
    const gone = staticTree();
    rmSync(join(gone, "pip.png"));
    expect(() => loadStatics(gone, TABLE)).toThrow(/pip\.png/);
  });
});

describe("types and caching", () => {
  test("the WASM is application/wasm", async () => {
    const response = await get("/assets/rive-1.wasm");
    expect(response.headers.get("Content-Type")).toBe("application/wasm");
    expect(await bytes(response)).toEqual(WASM);
  });

  test("a hashed asset is immutable and a page is revalidated", async () => {
    expect(
      (await get("/assets/app-abc123.js")).headers.get("Cache-Control"),
    ).toBe("public, max-age=31536000, immutable");
    expect((await get("/")).headers.get("Cache-Control")).toBe("no-cache");
  });
});

describe("compression", () => {
  test("Brotli decompresses to the original bytes", async () => {
    const response = await get("/", "gzip, deflate, br");
    expect(response.headers.get("Content-Encoding")).toBe("br");
    expect(brotliDecompressSync(await bytes(response)).toString()).toBe(PAGE);
  });

  test("gzip decompresses to the original bytes", async () => {
    const response = await get("/assets/app-abc123.js", "gzip");
    expect(response.headers.get("Content-Encoding")).toBe("gzip");
    expect(gunzipSync(await bytes(response)).toString()).toBe(SCRIPT);
  });

  test("without Accept-Encoding the bytes are sent as they are", async () => {
    const response = await get("/");
    expect(response.headers.get("Content-Encoding")).toBeNull();
    expect((await bytes(response)).toString()).toBe(PAGE);
  });

  test("a compressible file varies by Accept-Encoding", async () => {
    expect((await get("/")).headers.get("Vary")).toBe("Accept-Encoding");
  });

  test("a coding with q=0 is never sent", async () => {
    const response = await get("/", "br;q=0, gzip");
    expect(response.headers.get("Content-Encoding")).toBe("gzip");
    const none = await get("/", "br;q=0, gzip;q=0");
    expect(none.headers.get("Content-Encoding")).toBeNull();
  });

  test("a PNG is never compressed again", async () => {
    const response = await get("/pip.png", "br, gzip");
    expect(response.headers.get("Content-Encoding")).toBeNull();
    expect(response.headers.get("Vary")).toBeNull();
    expect(await bytes(response)).toEqual(PNG);
  });

  test("concurrent first requests share one compression, kept in memory", async () => {
    const file = loadStatics(dir, TABLE).get("/assets/app-abc123.js");
    if (!file) throw new Error("fixture missing");
    const [a, b] = [encoded(file, "br"), encoded(file, "br")];
    expect(a).toBe(b);
    expect(await a).toBe(await encoded(file, "br"));
  });

  test.each([
    [undefined, null],
    ["", null],
    ["identity", null],
    ["gzip", "gzip"],
    ["br", "br"],
    ["gzip, br", "br"],
    ["*", "br"],
    ["*;q=0", null],
    ["br;q=0, *", "gzip"],
    ["GZIP;Q=0.5", "gzip"],
  ])("Accept-Encoding %j picks %j", (accept, want) => {
    expect(pickEncoding(accept)).toBe(want);
  });
});
