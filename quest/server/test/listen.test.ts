// The port order, through an injected probe: these tests never bind the real
// ports 4747 to 4756, which other worktrees may be using.
import { createServer, type Server } from "node:http";
import { connect } from "node:net";
import { afterEach, describe, expect, test } from "vitest";
import { SECURITY_HEADERS } from "../src/headers.ts";
import {
  BASE_PORT,
  PORT_TRIES,
  firstFreePort,
  listen,
  tryListen,
  type Tried,
} from "../src/listen.ts";

function probe(taken: (port: number) => Tried | Error) {
  const calls: number[] = [];
  const tryListen = (port: number) => {
    calls.push(port);
    const result = taken(port);
    return result instanceof Error
      ? Promise.reject(result)
      : Promise.resolve(result);
  };
  return { calls, tryListen };
}

const fetch = () => new Response("ok");
const servers: Server[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

// A server whose listen fails at once with `code`, as the system would.
function failing(code: string): Server {
  const server = createServer();
  server.listen = (() => {
    queueMicrotask(() =>
      server.emit("error", Object.assign(new Error(code), { code })),
    );
    return server;
  }) as Server["listen"];
  return server;
}

describe("the port", () => {
  test("is 4748 when 4747 is taken", async () => {
    const p = probe((port) => (port === 4747 ? "taken" : "listening"));
    const got = await firstFreePort({
      base: BASE_PORT,
      tries: PORT_TRIES,
      tryListen: p.tryListen,
    });
    expect(got).toBe(4748);
    expect(p.calls).toEqual([4747, 4748]);
  });

  test("is tried 4747 to 4756 in order, and none is taken when all ten are", async () => {
    const p = probe(() => "taken");
    const got = await firstFreePort({
      base: BASE_PORT,
      tries: PORT_TRIES,
      tryListen: p.tryListen,
    });
    expect(got).toBeNull();
    expect(p.calls).toEqual([
      4747, 4748, 4749, 4750, 4751, 4752, 4753, 4754, 4755, 4756,
    ]);
  });

  test("is asked of the system once from base 0", async () => {
    const p = probe(() => "taken");
    await firstFreePort({ base: 0, tries: PORT_TRIES, tryListen: p.tryListen });
    expect(p.calls).toEqual([0]);
  });

  test("propagates any other error", async () => {
    const odd = Object.assign(new Error("odd"), { code: "EINVAL" });
    const p = probe(() => odd);
    await expect(
      firstFreePort({
        base: BASE_PORT,
        tries: PORT_TRIES,
        tryListen: p.tryListen,
      }),
    ).rejects.toBe(odd);
    expect(p.calls).toEqual([4747]);
  });
});

describe("one try", () => {
  test("is taken when the port is in use", async () => {
    const holder = createServer();
    servers.push(holder);
    expect(await tryListen(holder, 0)).toBe("listening");
    const address = holder.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const second = createServer();
    servers.push(second);
    // Node's own listeners, which tryListen must leave as it found them.
    const before = [
      second.listenerCount("listening"),
      second.listenerCount("error"),
    ];
    expect(await tryListen(second, port)).toBe("taken");
    expect([
      second.listenerCount("listening"),
      second.listenerCount("error"),
    ]).toEqual(before);
  });

  test("is taken when the port is refused (EACCES, as Windows' reserved ranges)", async () => {
    const server = failing("EACCES");
    const before = server.listenerCount("listening");
    expect(await tryListen(server, 4747)).toBe("taken");
    expect(server.listenerCount("listening")).toBe(before);
  });

  test("rejects on any other error", async () => {
    await expect(tryListen(failing("EINVAL"), 4747)).rejects.toMatchObject({
      code: "EINVAL",
    });
  });

  test("taken lets listen move on to the next port", async () => {
    const calls: number[] = [];
    const got = await listen({
      fetch,
      base: BASE_PORT,
      probe: () => (port) => {
        calls.push(port);
        return Promise.resolve(port === BASE_PORT ? "taken" : "listening");
      },
    });
    expect(calls).toEqual([4747, 4748]);
    expect(got?.port).toBe(4748);
  });
});

describe("a request the adaptor refuses", () => {
  test("a missing Host is a 400 that still carries the headers", async () => {
    const got = await listen({ fetch, base: 0 });
    if (!got) throw new Error("no port");
    servers.push(got.server);
    const reply = await new Promise<string>((resolve, reject) => {
      let text = "";
      const socket = connect(got.port, "127.0.0.1", () => {
        socket.end("GET / HTTP/1.0\r\n\r\n");
      });
      socket.setEncoding("utf8");
      socket.on("data", (chunk: string) => (text += chunk));
      socket.on("end", () => {
        resolve(text);
      });
      socket.on("error", reject);
    });
    const [status, ...lines] = reply.split("\r\n\r\n")[0]?.split("\r\n") ?? [];
    expect(status).toBe("HTTP/1.1 400 Bad Request");
    const headers = new Map(
      lines.map((line) => {
        const at = line.indexOf(":");
        return [line.slice(0, at).toLowerCase(), line.slice(at + 1).trim()];
      }),
    );
    for (const [name, value] of Object.entries(SECURITY_HEADERS))
      expect(headers.get(name.toLowerCase()), name).toBe(value);
  });
});
