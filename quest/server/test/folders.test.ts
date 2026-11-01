// folder.choose's path checks on a real file system: a temporary home
// (its real path), git repositories made in it, and GIT_CEILING_DIRECTORIES
// at the home so git never finds a repository above it.
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { checkFolder, gitTop, homeOf, type GitTop } from "../src/folders.ts";
import { actionKit, at } from "./action-kit.ts";

let home: string;
let outside: string;
const ceiling = process.env.GIT_CEILING_DIRECTORIES;

beforeAll(() => {
  home = realpathSync(mkdtempSync(join(tmpdir(), "quest-home-")));
  outside = realpathSync(mkdtempSync(join(tmpdir(), "quest-outside-")));
  process.env.GIT_CEILING_DIRECTORIES = `${home}:${outside}`;
  const repo = (dir: string) => {
    mkdirSync(dir, { recursive: true });
    execFileSync("git", ["init", "-q", dir]);
  };
  repo(join(home, "repo"));
  mkdirSync(join(home, "repo/sub"));
  repo(join(home, "copy"));
  repo(join(home, "outer"));
  repo(join(home, "outer/copy"));
  mkdirSync(join(home, "plain"));
  writeFileSync(join(home, "file.txt"), "a file");
  repo(join(outside, "elsewhere"));
  symlinkSync(join(outside, "elsewhere"), join(home, "out"));
  symlinkSync(join(home, "repo"), join(home, "link"));
});
afterAll(() => {
  if (ceiling === undefined) delete process.env.GIT_CEILING_DIRECTORIES;
  else process.env.GIT_CEILING_DIRECTORIES = ceiling;
  rmSync(home, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

// The real git, counted.
function counted(): { git: GitTop; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    git: (dir) => {
      calls.push(dir);
      return gitTop(dir);
    },
  };
}

const check = (path: string, root = join(home, "copy")) => {
  const { git, calls } = counted();
  return checkFolder(path, { home, root, git }).then((result) => ({
    result,
    calls,
  }));
};

describe("a refused path", () => {
  test("traversal out of home is outside-home, and git never runs", async () => {
    const { result, calls } = await check(
      join(home, "repo/../../", outside.split("/").pop() ?? ""),
    );
    expect(result).toEqual({ refused: "outside-home" });
    expect(calls).toEqual([]);
  });

  test("traversal to the root is outside-home", async () => {
    const { result, calls } = await check(`${home}/../../../../../../..`);
    expect(result).toEqual({ refused: "outside-home" });
    expect(calls).toEqual([]);
  });

  test("a symlink out of home is outside-home, and git never runs", async () => {
    const { result, calls } = await check(join(home, "out"));
    expect(result).toEqual({ refused: "outside-home" });
    expect(calls).toEqual([]);
  });

  test("a folder that is not a repository is not-repo-root", async () => {
    expect((await check(join(home, "plain"))).result).toEqual({
      refused: "not-repo-root",
    });
  });

  test("a repository's subfolder is not-repo-root", async () => {
    expect((await check(join(home, "repo/sub"))).result).toEqual({
      refused: "not-repo-root",
    });
  });

  test("the Practice copy is is-copy, and git never runs", async () => {
    const { result, calls } = await check(join(home, "copy"));
    expect(result).toEqual({ refused: "is-copy" });
    expect(calls).toEqual([]);
  });

  test("a repository holding the Practice copy is contains-copy", async () => {
    const { result, calls } = await check(
      join(home, "outer"),
      join(home, "outer/copy"),
    );
    expect(result).toEqual({ refused: "contains-copy" });
    expect(calls).toEqual([]);
  });

  test("home holding the copy is contains-copy", async () => {
    expect((await check(home)).result).toEqual({ refused: "contains-copy" });
  });

  test("a missing path is missing", async () => {
    expect((await check(join(home, "nothing"))).result).toEqual({
      refused: "missing",
    });
  });

  test("a file is missing: only a folder answers", async () => {
    expect((await check(join(home, "file.txt"))).result).toEqual({
      refused: "missing",
    });
  });

  // macOS caps a path at 1,024 bytes, so only a longer limit can reach it.
  test.skipIf(process.platform === "darwin")(
    "a resolved path over 1,024 characters is too-long",
    async () => {
      let deep = home;
      while (deep.length <= 1024) {
        deep = join(deep, "d".repeat(100));
        mkdirSync(deep);
      }
      expect((await check(deep)).result).toEqual({ refused: "too-long" });
    },
  );
});

describe("an accepted path", () => {
  test("a repository's root in home is its real path", async () => {
    const { result, calls } = await check(join(home, "repo"));
    expect(result).toEqual({ path: join(home, "repo") });
    expect(calls).toEqual([join(home, "repo")]);
  });

  test("a repository reached through a symlink is its real path", async () => {
    expect((await check(join(home, "link"))).result).toEqual({
      path: join(home, "repo"),
    });
  });

  test("the home folder is HOME, then USERPROFILE", () => {
    expect(homeOf({ HOME: "/h", USERPROFILE: "/u" })).toBe("/h");
    expect(homeOf({ USERPROFILE: "/u" })).toBe("/u");
  });
});

describe("through the app", () => {
  const choose = (path: string) => ({
    type: "folder.choose",
    key: "intermediate",
    to: { path },
  });

  test("a refused folder is a 400 with its reason, never dispatched", async () => {
    const kit = await actionKit({
      checkFolder: (path) =>
        checkFolder(path, { home, root: join(home, "copy") }),
    });
    for (const [path, reason] of [
      [join(home, "out"), "outside-home"],
      [join(home, "plain"), "not-repo-root"],
      [join(home, "copy"), "is-copy"],
    ] as const) {
      const response = await kit.post(at(kit.host, choose(path)));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "folder", reason });
    }
    expect(kit.dispatched).toEqual([]);
  });

  test("an accepted folder is dispatched as its real path", async () => {
    const kit = await actionKit({
      checkFolder: (path) =>
        checkFolder(path, { home, root: join(home, "copy") }),
    });
    await kit.post(at(kit.host, choose(join(home, "link"))));
    expect(kit.dispatched).toEqual([
      {
        type: "folder.choose",
        key: "intermediate",
        to: { path: join(home, "repo") },
      },
    ]);
  });
});

describe("read-only", () => {
  test("the server's only child processes are git rev-parse and the browser opener", () => {
    const dir = new URL("../src/", import.meta.url);
    const uses: string[] = [];
    for (const name of readdirSync(dir)) {
      const text = readFileSync(new URL(name, dir), "utf8");
      for (const match of text.matchAll(
        /(?<![.\w])(execFile|execFileSync|exec|execSync|spawn|spawnSync|fork)\(\s*("[^"]*"(?:,\s*\[[^\]]*\])?|\w+)/g,
      ))
        uses.push(
          `${name}: ${match[1] ?? ""}(${(match[2] ?? "").replace(/\s+/g, " ")}`,
        );
    }
    expect(uses.sort()).toEqual([
      'folders.ts: execFile("git", ["rev-parse", "--show-toplevel"]',
      "launch.ts: spawn(command",
    ]);
  });
});
