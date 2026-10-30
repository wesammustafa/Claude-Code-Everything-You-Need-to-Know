// Logs never carry a header value, a cookie or a token (spec, Server
// security): sentinels in X-Github-Token, Cookie and Authorization go
// through every route and every refusal, a forced 500 included, and appear
// in nothing the server writes: its log, stdout, stderr or the console.
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { BODY_LIMIT } from "../src/actions.ts";
import { HOST, INSTANCE, actionKit, questHost, trusted } from "./action-kit.ts";
import { raw, request, serve } from "./raw.ts";
import { ROUTES } from "./routes.ts";

const SENTINELS = {
  "X-Github-Token": "ghs_SENTINEL_token_217",
  Cookie: "session=SENTINEL_cookie_217",
  Authorization: "Bearer SENTINEL_auth_217",
};

let server: Server;
let port: number;
const logged: string[] = [];
const written: string[] = [];

beforeAll(async () => {
  const log = (line: string) => logged.push(line);
  const kit = await actionKit({ log });
  // A forced 500: this host throws inside an action.
  const broken = questHost();
  await broken.open();
  broken.dispatch = () => {
    throw new Error("dispatch broke");
  };
  kit.app.route("/broken", (await actionKit({ host: broken, log })).app);
  ({ server, port } = await serve(kit.app.fetch));

  for (const stream of [process.stdout, process.stderr])
    vi.spyOn(stream, "write").mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    });
  for (const name of ["error", "info", "log", "warn"] as const)
    vi.spyOn(console, name).mockImplementation((...args: unknown[]) => {
      written.push(args.map(String).join(" "));
    });
});
afterAll(() => {
  vi.restoreAllMocks();
  server.closeAllConnections();
  server.close();
});

const valid = (instance = INSTANCE) =>
  JSON.stringify({ action: { type: "answer.reveal" }, instance, revision: 1 });

type Case = [string, string, string, Record<string, string>, string];
const CASES: readonly Case[] = [
  ...ROUTES.map(([method, path]): Case => {
    const post = method === "POST";
    return [
      `${method} ${path}`,
      method,
      path,
      post ? trusted() : { Host: HOST },
      post ? valid() : "",
    ];
  }),
  ["a rebound Host", "GET", "/api/health", { Host: "evil.example" }, ""],
  [
    "a cross-site POST",
    "POST",
    "/api/actions",
    trusted({ Origin: "http://evil.example" }),
    valid(),
  ],
  ["malformed JSON", "POST", "/api/actions", trusted(), "{"],
  ["an extra key", "POST", "/api/actions", trusted(), '{"x":1}'],
  ["another instance", "POST", "/api/actions", trusted(), valid("other")],
  [
    "an oversized body",
    "POST",
    "/api/actions",
    trusted(),
    "x".repeat(BODY_LIMIT + 1),
  ],
  ["a forced 500", "POST", "/broken/api/actions", trusted(), valid()],
];

describe("redaction", () => {
  test.each(CASES)(
    "%s writes no header value, cookie or token",
    async (_, method, path, headers, body) => {
      const reply = await raw(
        port,
        request(method, path, { ...headers, ...SENTINELS }, body),
      );
      expect(reply).not.toBeNull();
      const everything = [...logged, ...written, reply?.body ?? ""].join("\n");
      expect(everything).not.toContain("SENTINEL");
    },
  );

  test("the forced 500 is logged by its message alone", () => {
    expect(logged).toEqual(["Claude Code Quest: dispatch broke"]);
  });

  test("a request with no Host, refused before the app, writes nothing", async () => {
    const before = written.length;
    const reply = await raw(
      port,
      `GET /api/health HTTP/1.1\r\nCookie: ${SENTINELS.Cookie}\r\nConnection: close\r\n\r\n`,
    );
    expect(reply?.status).toBe(400);
    expect(written.slice(before).join("")).not.toContain("SENTINEL");
  });
});
