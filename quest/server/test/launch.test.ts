import type { spawn } from "node:child_process";
import { afterEach, describe, expect, test } from "vitest";
import { codespaceUrl, openBrowser, stopLine } from "../src/launch.ts";
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
const portOf = (kit: Kit) => kit.started?.port ?? -1;

describe("the address", () => {
  test("in a codespace is the forwarded https address alone, and nothing opens", async () => {
    const kit = await launch({
      isTTY: true,
      env: {
        CODESPACE_NAME: "fuzzy-robot-123",
        GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "app.github.dev",
      },
    });
    expect(kit.stdout).toEqual([
      `https://fuzzy-robot-123-${String(portOf(kit))}.app.github.dev\n`,
    ]);
    expect(kit.opened).toEqual([]);
  });

  test("with only CODESPACE_NAME set is the local one, and nothing opens", async () => {
    const kit = await launch({ env: { CODESPACE_NAME: "fuzzy-robot-123" } });
    expect(kit.stdout).toEqual([
      `Claude Code Quest is running at http://127.0.0.1:${String(portOf(kit))}\n`,
    ]);
    expect(kit.opened).toEqual([]);
  });

  test("outside a codespace, in a terminal, opens the browser once at it", async () => {
    const kit = await launch({ isTTY: true });
    expect(kit.opened).toEqual([`http://127.0.0.1:${String(portOf(kit))}`]);
  });

  test("without a terminal opens nothing", async () => {
    const kit = await launch({ isTTY: false });
    expect(kit.opened).toEqual([]);
    expect(kit.stdout).toHaveLength(1);
  });

  test("codespaceUrl needs both variables", () => {
    expect(
      codespaceUrl({ GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "d" }, 1),
    ).toBeNull();
    expect(
      codespaceUrl(
        { CODESPACE_NAME: "", GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "d" },
        1,
      ),
    ).toBeNull();
    expect(
      codespaceUrl(
        { CODESPACE_NAME: "c", GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: "d" },
        4748,
      ),
    ).toBe("https://c-4748.d");
  });
});

describe("the opener", () => {
  function spy(fail = false) {
    const runs: {
      command: string;
      args: readonly string[];
      options: object;
      unref: boolean;
    }[] = [];
    const fake = ((
      command: string,
      args: readonly string[],
      options: object,
    ) => {
      if (fail) throw new Error("spawn ENOENT");
      const run = { command, args, options, unref: false };
      runs.push(run);
      return {
        on: () => undefined,
        unref: () => {
          run.unref = true;
        },
      };
    }) as unknown as typeof spawn;
    return { runs, fake };
  }

  test.each([
    ["darwin", "open", ["http://127.0.0.1:4747"]],
    ["linux", "xdg-open", ["http://127.0.0.1:4747"]],
    ["freebsd", "xdg-open", ["http://127.0.0.1:4747"]],
    ["win32", "cmd", ["/c", "start", '""', "http://127.0.0.1:4747"]],
  ])("on %s runs %s, detached and unreferenced", (platform, command, args) => {
    const { runs, fake } = spy();
    openBrowser("http://127.0.0.1:4747", platform, fake);
    expect(runs).toEqual([
      {
        command,
        args,
        options: {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
          // cmd gets `/c start "" <url>` as written, not Node's quoting.
          ...(platform === "win32" ? { windowsVerbatimArguments: true } : {}),
        },
        unref: true,
      },
    ]);
  });

  test("a failed opener is swallowed", () => {
    const { fake } = spy(true);
    expect(() => {
      openBrowser("http://127.0.0.1:4747", "linux", fake);
    }).not.toThrow();
  });
});

test("the stop line names the copy, in plain text", () => {
  expect(stopLine({ copy: "/home/l/practice" })).toBe(
    "Claude Code Quest stopped. To start it again, run npm run learn in /home/l/practice.",
  );
});
