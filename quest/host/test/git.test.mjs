// Read-only git, real, against temporary repositories (ticket 209, ported
// from learn-io and learn-folder): status on the whole tree and on part of
// it, a folder's look, git's first answers.
import { test as vitest } from "vitest";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { judgeGit, listedUnder } from "../../engine/src/status.ts";
import { statusPaths } from "../../../practice-template/checks/paths.mjs";
import {
  commit,
  repo,
  write,
} from "../../../practice-template/checks/test/helpers.mjs";
import { probeFolder } from "../src/folders.mjs";
import { gitFirstName, gitReady, gitStatus, NOT_A_REPO } from "../src/git.mjs";

// Each makes git repositories: more time than Vitest's default.
const test = (name, fn) => vitest(name, fn, 60_000);

test("git status: a whole-tree look lists a new folder whole, a look at part of the tree lists each file, and the staged paths come from the index column", async () => {
  const dir = repo({
    "src/a.js": "a\n",
    "src/b.js": "b\n",
    "README.md": "r\n",
  });
  try {
    commit(dir);
    const git = (...args) => execFileSync("git", args, { cwd: dir });
    write(dir, {
      "src/a.js": "a2\n",
      "src/b.js": "b2\n",
      "README.md": "r2\n",
      ".claude/skills/five-whys/SKILL.md": "s\n",
      "notes.md": "n\n",
      ".practice/learn.json": "{}",
    });
    // Staged, staged then changed again, renamed and staged; changed only.
    git("add", "src/a.js", "README.md");
    write(dir, { "README.md": "r3\n" });
    git("mv", "src/b.js", "src/c.js");
    const whole = await gitStatus(dir);
    assert.deepEqual(
      [...whole.paths].sort(),
      [".claude/", "README.md", "notes.md", "src/a.js", "src/c.js"].sort(),
    );
    assert.deepEqual(
      whole.paths,
      statusPaths(
        execFileSync("git", ["status", "--porcelain"], {
          cwd: dir,
          encoding: "utf8",
        }),
      ),
      "the paths are the ones npm run check reads",
    );
    // A rename lists both its names; it is staged by its new one.
    const each = await gitStatus(dir, { files: true });
    assert.deepEqual(
      each.paths.sort(),
      [
        ".claude/skills/five-whys/SKILL.md",
        "README.md",
        "notes.md",
        "src/a.js",
        "src/b.js",
        "src/c.js",
      ].sort(),
    );
    assert.deepEqual(each.staged.sort(), ["README.md", "src/a.js", "src/c.js"]);
    // The work tree changed and nothing added: nothing staged.
    git("reset", "-q");
    assert.deepEqual((await gitStatus(dir, { files: true })).staged, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("git status on part of the tree: a work folder inside a repository sees only its own paths, named from there, and a file moved out of a folder is a change there", async () => {
  const top = repo({ "proj/secrets/old.txt": "o\n", "proj/README.md": "r\n" });
  try {
    commit(top, "start");
    const git = (...args) => execFileSync("git", args, { cwd: top });
    write(top, {
      "proj/secrets/key.txt": "k\n",
      "proj/src/a.js": "a\n",
      "other/o.txt": "o\n",
    });
    git("mv", "proj/secrets/old.txt", "proj/old.txt");
    const proj = join(top, "proj");
    assert.equal(
      (await probeFolder(proj)).git,
      true,
      "a folder inside a repository is a work folder",
    );
    const r = await gitStatus(proj, { files: true });
    assert.deepEqual([...r.paths].sort(), [
      "old.txt",
      "secrets/key.txt",
      "secrets/old.txt",
      "src/a.js",
    ]);
    assert.deepEqual(r.staged, ["old.txt"]);
    assert.deepEqual(
      listedUnder(r.paths, ["secrets/"]).sort(),
      ["secrets/key.txt", "secrets/old.txt"],
      "git-clean secrets/ is not done",
    );
    assert.equal(judgeGit({ kind: "git-changed", path: "src/" }, r).pass, true);
    // Staged and committed, only the move is left; it is still under secrets/.
    commit(top, "more", ["proj/secrets", "proj/src", "other"]);
    git("mv", "proj/secrets/key.txt", "proj/key.txt");
    const moved = await gitStatus(proj, { files: true });
    assert.deepEqual([...moved.paths].sort(), ["key.txt", "secrets/key.txt"]);
    assert.equal(
      judgeGit({ kind: "git-changed", path: "secrets/" }, moved).pass,
      true,
    );
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test("probeFolder says why git could not look, apart from a folder that is no repository", async () => {
  const mine = repo();
  const PATH = process.env.PATH;
  try {
    // repo() ignores .practice/, so it counts before the folder exists (r27 a-5).
    assert.deepEqual(await probeFolder(mine), {
      path: mine,
      missing: false,
      git: true,
      gitBroken: null,
      practice: true,
    });
    mkdirSync(join(mine, ".practice"));
    assert.equal((await probeFolder(mine)).practice, true);
    rmSync(join(mine, ".git"), { recursive: true, force: true });
    assert.deepEqual(await probeFolder(mine), {
      path: mine,
      missing: false,
      git: false,
      gitBroken: null,
      practice: false,
    });
    process.env.PATH = join(mine, "no-bin");
    assert.deepEqual(await probeFolder(mine), {
      path: mine,
      missing: false,
      git: false,
      gitBroken: "git is not installed",
      practice: false,
    });
  } finally {
    process.env.PATH = PATH;
    rmSync(mine, { recursive: true, force: true });
  }
  assert.equal((await probeFolder(join(mine, "gone"))).missing, true);
});

test("probeFolder: a folder whose git ignores .practice/ is fine before .practice/ exists; one git doesn't ignore it in, or a .practice file, is not", async () => {
  const mine = mkdtempSync(join(tmpdir(), "learn-probe-"));
  const git = (...args) => execFileSync("git", args, { cwd: mine });
  try {
    git("init", "-q");
    git("config", "core.excludesFile", "/dev/null");
    assert.equal(
      (await probeFolder(mine)).practice,
      false,
      "nothing ignores it",
    );
    writeFileSync(join(mine, ".gitignore"), ".practice/\nnode_modules/\n");
    assert.deepEqual(await probeFolder(mine), {
      path: mine,
      missing: false,
      git: true,
      gitBroken: null,
      practice: true,
    });
    mkdirSync(join(mine, ".practice"));
    assert.equal(
      (await probeFolder(mine)).practice,
      true,
      "and once it exists",
    );
    rmSync(join(mine, ".practice"), { recursive: true });
    writeFileSync(join(mine, ".practice"), "a file");
    assert.equal(
      (await probeFolder(mine)).practice,
      false,
      "a file named .practice holds no saved files",
    );
    rmSync(join(mine, ".practice"));
    writeFileSync(join(mine, ".gitignore"), "node_modules/\n");
    mkdirSync(join(mine, ".practice"));
    assert.equal(
      (await probeFolder(mine)).practice,
      false,
      "there, but git would list what it holds",
    );
  } finally {
    rmSync(mine, { recursive: true, force: true });
  }
});

test("git's first answers: whether the folder is a repository, and why not, and a first name cut to 20 characters", async () => {
  const mine = repo();
  const PATH = process.env.PATH;
  try {
    assert.equal(await gitReady(mine), null);
    execFileSync(
      "git",
      ["config", "user.name", "Maximiliana-Alexandrina Smith"],
      { cwd: mine },
    );
    assert.equal(await gitFirstName(mine), "Maximiliana-Alexandr");
    execFileSync("git", ["config", "user.name", "Sam Lee"], { cwd: mine });
    assert.equal(await gitFirstName(mine), "Sam");
    rmSync(join(mine, ".git"), { recursive: true, force: true });
    assert.equal(await gitReady(mine), NOT_A_REPO);
    process.env.PATH = join(mine, "no-bin");
    assert.equal(await gitReady(mine), "git is not installed");
    assert.equal(await gitFirstName(mine), "", "no name where git cannot say");
  } finally {
    process.env.PATH = PATH;
    rmSync(mine, { recursive: true, force: true });
  }
});
