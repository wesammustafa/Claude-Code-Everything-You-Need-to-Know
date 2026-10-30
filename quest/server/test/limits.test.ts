// The limits (spec, Server security): a 16 KB action body, the queue of one
// running and 20 waiting, 64 connections, Node's header size and the
// header and request timeouts, and 8 event streams. Raw sockets on port 0.
import type { Server } from "node:http";
import { connect, type Socket } from "node:net";
import { afterEach, describe, expect, test } from "vitest";
import { BODY_LIMIT } from "../src/actions.ts";
import { MAX_STREAMS } from "../src/events.ts";
import { MAX_CONNECTIONS, SERVER_LIMITS } from "../src/listen.ts";
import { createQueue } from "../src/queue.ts";
import { HOST, actionKit, at, questHost, trusted } from "./action-kit.ts";
import { raw, request, serve } from "./raw.ts";

const servers: Server[] = [];
const sockets: Socket[] = [];
afterEach(() => {
  for (const socket of sockets.splice(0)) socket.destroy();
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    server.close();
  }
});

async function served(
  options: Parameters<typeof actionKit>[0] = {},
  serverOptions: Parameters<typeof serve>[1] = {},
) {
  const kit = await actionKit(options);
  const got = await serve(kit.app.fetch, serverOptions);
  servers.push(got.server);
  return { ...kit, ...got };
}

// A valid request padded with spaces to exactly `size` bytes.
function padded(body: string, size: number): string {
  return body.replace(/}$/, `${" ".repeat(size - body.length)}}`);
}

describe("the body", () => {
  test("a Content-Length of 16,385 is a 413", async () => {
    const { port, host } = await served();
    const body = padded(
      JSON.stringify(at(host, { type: "answer.reveal" })),
      BODY_LIMIT + 1,
    );
    const reply = await raw(
      port,
      request("POST", "/api/actions", trusted(), body),
    );
    expect(reply?.status).toBe(413);
    expect(JSON.parse(reply?.body ?? "")).toEqual({ error: "too large" });
    expect(reply?.headers.get("cache-control")).toBe("no-store");
  });

  test("a chunked body of 17 KB is a 413", async () => {
    const { port } = await served();
    const chunk = "x".repeat(1024);
    const chunks = Array.from({ length: 17 }, () => `400\r\n${chunk}\r\n`).join(
      "",
    );
    const head = request("POST", "/api/actions", {
      ...trusted(),
      "Transfer-Encoding": "chunked",
    });
    const reply = await raw(port, `${head}${chunks}0\r\n\r\n`);
    expect(reply?.status).toBe(413);
  });

  test("exactly 16,384 bytes is not refused for its size", async () => {
    const { port, host } = await served();
    const body = padded(
      JSON.stringify(at(host, { type: "answer.reveal" })),
      BODY_LIMIT,
    );
    expect(Buffer.byteLength(body)).toBe(BODY_LIMIT);
    const reply = await raw(
      port,
      request("POST", "/api/actions", trusted(), body),
    );
    expect(reply?.status).toBe(200);
  });

  test("a cross-site oversized body is a 403, never read", async () => {
    const { port } = await served();
    const reply = await raw(
      port,
      request(
        "POST",
        "/api/actions",
        trusted({ Origin: "http://evil.example" }),
        "x".repeat(BODY_LIMIT + 1),
      ),
    );
    expect(reply?.status).toBe(403);
  });
});

describe("the queue", () => {
  test("the 22nd action waiting is a 429, then all 21 settle", async () => {
    const host = questHost();
    const opened = Promise.withResolvers<undefined>();
    const kit = await actionKit({ host, open: false, ready: opened.promise });
    const send = () =>
      kit.post({
        action: { type: "answer.reveal" },
        instance: host.instance,
        revision: 1,
      });
    const first = Array.from({ length: 21 }, send);
    const refused = await send();
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ error: "busy" });
    expect(refused.headers.get("Cache-Control")).toBe("no-store");
    await host.open();
    opened.resolve(undefined);
    const statuses = (await Promise.all(first)).map((r) => r.status);
    expect(statuses).toHaveLength(21);
    expect(statuses.every((s) => s === 200 || s === 409)).toBe(true);
    // Room again.
    expect((await send()).status).not.toBe(429);
  });

  test("runs one task at a time, in order", async () => {
    const queue = createQueue(2);
    const log: string[] = [];
    const gate = Promise.withResolvers<undefined>();
    const a = queue.run(async () => {
      log.push("a start");
      await gate.promise;
      log.push("a end");
    });
    const b = queue.run(() => {
      log.push("b");
      return Promise.resolve();
    });
    await new Promise((r) => setImmediate(r));
    expect(log).toEqual(["a start"]);
    gate.resolve(undefined);
    await Promise.all([a, b]);
    expect(log).toEqual(["a start", "a end", "b"]);
  });

  test("holds one running and `limit` waiting, and refuses one more", async () => {
    const queue = createQueue(2);
    const gate = Promise.withResolvers<undefined>();
    const held = [1, 2, 3].map(() => queue.run(() => gate.promise));
    expect(held.every((p) => p !== null)).toBe(true);
    expect(queue.run(() => Promise.resolve())).toBeNull();
    expect(queue.size()).toBe(3);
    gate.resolve(undefined);
    await Promise.all(held.filter((p) => p !== null));
    expect(queue.size()).toBe(0);
  });

  test("a failed task never stops the next", async () => {
    const queue = createQueue();
    const failed = queue.run(() => Promise.reject(new Error("no")));
    const next = queue.run(() => Promise.resolve("ran"));
    await expect(failed).rejects.toThrow("no");
    await expect(next).resolves.toBe("ran");
  });
});

describe("connections and timeouts", () => {
  test("the server is configured with the timeouts and 64 connections", async () => {
    const { server } = await served();
    expect(server.headersTimeout).toBe(10_000);
    expect(server.requestTimeout).toBe(30_000);
    expect(server.maxConnections).toBe(MAX_CONNECTIONS);
    expect(MAX_CONNECTIONS).toBe(64);
    expect(SERVER_LIMITS).toEqual({
      headersTimeout: 10_000,
      requestTimeout: 30_000,
      connectionsCheckingInterval: 1_000,
    });
  });

  test("the 65th socket is dropped", async () => {
    const { port } = await served();
    for (let i = 0; i < MAX_CONNECTIONS; i++) {
      const socket = await new Promise<Socket>((resolve) => {
        const s = connect(port, "127.0.0.1", () => {
          resolve(s);
        });
      });
      sockets.push(socket);
    }
    // Let the server accept every one before the next arrives.
    await new Promise((r) => setTimeout(r, 50));
    const reply = await raw(
      port,
      request("GET", "/api/health", { Host: HOST }),
    );
    expect(reply).toBeNull();
    sockets.pop()?.destroy();
    await new Promise((r) => setTimeout(r, 50));
    const after = await raw(
      port,
      request("GET", "/api/health", { Host: HOST }),
    );
    expect(after?.status).toBe(200);
  });

  // Timing: rerun alone before believing a failure under load.
  test("headers that never finish get a 408", async () => {
    const { port } = await served(
      {},
      {
        headersTimeout: 200,
        requestTimeout: 300,
        connectionsCheckingInterval: 50,
      },
    );
    const reply = await raw(
      port,
      `GET /api/health HTTP/1.1\r\nHost: ${HOST}\r\n`,
    );
    expect(reply?.status).toBe(408);
  });

  test("headers over 16 KB are a 431", async () => {
    const { port } = await served();
    const reply = await raw(
      port,
      request("GET", "/api/health", {
        Host: HOST,
        "X-Big": "x".repeat(17 * 1024),
      }),
    );
    expect(reply?.status).toBe(431);
  });
});

describe("event streams", () => {
  // A stream held open on its own socket: settles once the head has come,
  // and `ended` settles when the server ends the response (its last chunk:
  // the stream keeps the connection alive) or the socket.
  function stream(port: number) {
    const ended = Promise.withResolvers<undefined>();
    return new Promise<{
      socket: Socket;
      head: string;
      ended: Promise<undefined>;
    }>((resolve) => {
      let got = "";
      const socket = connect(port, "127.0.0.1", () => {
        socket.write(request("GET", "/api/events", { Host: HOST }));
      });
      sockets.push(socket);
      socket.setEncoding("utf8");
      socket.on("data", (chunk: string) => {
        got += chunk;
        if (got.endsWith("\r\n0\r\n\r\n")) ended.resolve(undefined);
        if (got.includes("\r\n\r\n"))
          resolve({ socket, head: got, ended: ended.promise });
      });
      socket.on("end", () => {
        ended.resolve(undefined);
      });
      socket.on("close", () => {
        ended.resolve(undefined);
      });
    });
  }

  test("a ninth stream closes the oldest", async () => {
    const { port, streams } = await served();
    const open = [];
    for (let i = 0; i <= MAX_STREAMS; i++) open.push(await stream(port));
    for (const { head } of open) expect(head).toContain("text/event-stream");
    await open[0]?.ended;
    expect(streams.size()).toBe(MAX_STREAMS);
  });
});
