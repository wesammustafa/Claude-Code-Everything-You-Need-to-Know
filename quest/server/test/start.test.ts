import type { Server } from "node:http";
import type { Adapters } from "@quest/host";
import { afterEach, describe, expect, test } from "vitest";
import { tryListen } from "../src/listen.ts";
import { startWith, stopAll, type Kit } from "./start-kit.ts";

const kits: Kit[] = [];
afterEach(() => {
  for (const kit of kits.splice(0)) stopAll(kit);
});
async function launch(...args: Parameters<typeof startWith>) {
  const kit = await startWith(...args);
  kits.push(kit);
  return kit;
}

async function health(kit: Kit): Promise<Response> {
  return fetch(`http://127.0.0.1:${String(kit.started?.port)}/api/health`);
}

describe("start", () => {
  test("creates the host with the real platform, env and saved state", async () => {
    const env = { HOME: "/home/l" };
    const kit = await launch({ platform: "win32", env, root: "/copy" });
    expect(kit.hostOptions).toEqual([
      {
        root: "/copy",
        course: [],
        saved: { saved: true },
        env,
        platform: "win32",
        adapters: expect.anything() as unknown,
      },
    ]);
  });

  // Loading moves an unreadable save aside (ticket 213), so a second load
  // would find nothing and the Learner's notice would be lost.
  test("loads the save once and hands an unreadable marker to the host", async () => {
    let loads = 0;
    const kit = await launch({
      realAdapters: () =>
        ({
          store: {
            load: () => {
              loads++;
              return { unreadable: "moved" };
            },
          },
        }) as unknown as Adapters,
    });
    expect(loads).toBe(1);
    expect(kit.hostOptions.map((o) => o.saved)).toEqual([
      { unreadable: "moved" },
    ]);
  });

  test("listens, then opens the host, starts it and takes the first look", async () => {
    const kit = await launch();
    expect(kit.calls).toEqual([
      "loadCourse",
      "listen",
      "open",
      "start",
      "firstLook",
    ]);
    expect((await health(kit)).status).toBe(200);
  });

  test("reads the course from courseRoot when given", async () => {
    const roots: string[] = [];
    await launch({
      courseRoot: "/repo/practice-template",
      loadCourse: (root) => {
        roots.push(root);
        return [];
      },
    });
    expect(roots).toEqual(["/repo/practice-template"]);
  });

  test("an unknown argument prints the usage line and exits 2", async () => {
    for (const argv of [["--calm"], ["extra"], ["--dir"]]) {
      const kit = await launch({ argv });
      expect(kit.stderr).toEqual([
        "Usage: npm run learn [-- --dir <folder>]\n",
      ]);
      expect(kit.exits).toEqual([2]);
      expect(kit.started).toBeNull();
      expect(kit.calls).toEqual([]);
    }
  });

  test("--dir is accepted and not read yet", async () => {
    const kit = await launch({ argv: ["--dir", "/x"] });
    expect(kit.stderr).toEqual([
      "--dir is not read yet: starting without it.\n",
    ]);
    expect(kit.exits).toEqual([]);
    expect(kit.started).not.toBeNull();
  });

  test("announce: false prints no address and opens nothing (dev)", async () => {
    const kit = await launch({ announce: false, isTTY: true });
    expect(kit.stdout).toEqual([]);
    expect(kit.opened).toEqual([]);
    expect((await health(kit)).status).toBe(200);
  });

  test("when all ten ports are taken it says so and exits 1", async () => {
    const tried: number[] = [];
    const kit = await launch({
      base: 4747,
      probe: () => (port) => {
        tried.push(port);
        return Promise.resolve("taken");
      },
    });
    expect(tried).toHaveLength(10);
    expect(kit.stderr).toEqual([
      "Claude Code Quest could not start: ports 4747 to 4756 on 127.0.0.1 are all in use. Stop what is using them, then run npm run learn again.\n",
    ]);
    expect(kit.exits).toEqual([1]);
    expect(kit.closes()).toBe(1);
    expect(kit.stdout).toEqual([]);
  });
});

describe("a git error at start", () => {
  test("open() rejecting still leaves the server answering", async () => {
    const kit = await launch({
      open: () => Promise.reject(new Error("spawn git ENOENT")),
    });
    expect(kit.stderr).toEqual([
      "Claude Code Quest could not read the folder: spawn git ENOENT\n",
    ]);
    expect((await health(kit)).status).toBe(200);
    expect(kit.exits).toEqual([]);
  });

  test("health and the address answer while open() still waits on git", async () => {
    let answer: () => void = () => undefined;
    const waiting = new Promise<null>((resolve) => {
      answer = () => {
        resolve(null);
      };
    });
    let opened: () => void = () => undefined;
    const opening = new Promise<void>((resolve) => {
      opened = resolve;
    });
    let listening: Server | undefined;
    const stdout: string[] = [];
    const pending = startWith({
      open: () => {
        opened();
        return waiting;
      },
      stdout: { write: (text: string) => stdout.push(text) },
      probe: (server) => async (port) => {
        listening = server;
        return tryListen(server, port);
      },
    });
    await opening;
    const address = listening?.address();
    const port = typeof address === "object" && address ? address.port : 0;
    expect(stdout).toEqual([
      `Claude Code Quest is running at http://127.0.0.1:${String(port)}\n`,
    ]);
    const response = await fetch(`http://127.0.0.1:${String(port)}/api/health`);
    expect(await response.json()).toEqual({
      ok: true,
      instance: "test-instance",
    });
    answer();
    kits.push(await pending);
  });
});

describe("a signal", () => {
  test.each(["SIGTERM", "SIGINT", "SIGHUP"])(
    "%s closes the host once, closes the server, says where to start again and exits 0",
    async (signal) => {
      const kit = await launch({ root: "/home/l/practice" });
      const server = kit.started?.server;
      kit.signals.emit(signal);
      kit.signals.emit("SIGINT");
      kit.signals.emit("SIGTERM");
      expect(kit.closes()).toBe(1);
      expect(server?.listening).toBe(false);
      expect(kit.stdout.at(-1)).toBe(
        "Claude Code Quest stopped. To start it again, run npm run learn in /home/l/practice.\n",
      );
      expect(kit.stdout).toHaveLength(2);
      expect(kit.exits).toEqual([0]);
    },
  );

  test.each(["SIGTERM", "SIGINT", "SIGHUP"])(
    "%s keeps its handler, so a second signal cannot take the default action",
    async (signal) => {
      const kit = await launch({ root: "/home/l/practice" });
      kit.signals.emit(signal);
      for (const each of ["SIGTERM", "SIGINT", "SIGHUP"])
        expect(kit.signals.listenerCount(each)).toBeGreaterThan(0);
    },
  );

  test("the process's exit closes the host too", async () => {
    const kit = await launch();
    kit.signals.emit("exit");
    expect(kit.closes()).toBe(1);
  });
});
