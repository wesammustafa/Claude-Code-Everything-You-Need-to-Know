// Nothing listens on any address but loopback: a real socket on a port the
// system picks (never 4747 to 4756, which other worktrees may hold).
import { readFileSync, readdirSync } from "node:fs";
import { connect } from "node:net";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { listen, type Listening } from "../src/listen.ts";

let up: Listening | null = null;
beforeAll(async () => {
  up = await listen({ fetch: () => new Response("ok"), base: 0 });
});
afterAll(() => {
  up?.server.close();
});

function reaches(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      resolve(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

test("the server listens on 127.0.0.1 over IPv4", () => {
  expect(up?.server.address()).toMatchObject({
    address: "127.0.0.1",
    family: "IPv4",
  });
});

test("no other address of this machine reaches it", async () => {
  const port = up?.port ?? 0;
  expect(await reaches("127.0.0.1", port)).toBe(true);
  const others = Object.values(networkInterfaces())
    .flatMap((list) => list ?? [])
    .filter((info) => !info.internal)
    .map((info) =>
      info.family === "IPv6" && info.scopeid
        ? `${info.address}%${String(info.scopeid)}`
        : info.address,
    );
  const hosts = [...others, "::1"];
  const reached = await Promise.all(hosts.map((host) => reaches(host, port)));
  expect(hosts.filter((_, i) => reached[i])).toEqual([]);
}, 10_000);

test("the only listen in the server's source passes the literal host", () => {
  const src = join(import.meta.dirname, "../src");
  const calls = readdirSync(src, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".ts"))
    .flatMap((file) =>
      [
        ...readFileSync(join(src, file), "utf8").matchAll(/\.listen\(.*$/gm),
      ].map((m) => `${file}: ${m[0]}`),
    );
  expect(calls).toEqual(['listen.ts: .listen({ port, host: "127.0.0.1" });']);
});
