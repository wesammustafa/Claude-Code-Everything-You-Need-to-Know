// The host on real adapters, the real engine and the real clock (ticket
// 209): a practice copy made from the template plays b-1's version beat to
// done, changing nothing but its own .practice/; an Intermediate folder in
// another repository gets the checks and git while progress stays in the
// copy; and closing leaves no child running.
import { test } from "vitest";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { loadCourse } from "../../engine/src/course.mjs";
import { statusPaths } from "../../../practice-template/checks/paths.mjs";
import { repo } from "../../../practice-template/checks/test/helpers.mjs";
import { finishedBefore } from "../../engine/test/drive.mjs";
import { createHost, realAdapters } from "../src/index.mjs";
import { storePath } from "../src/store.mjs";
import { reducerCheck, reducerRepo } from "./repo.mjs";

const until = async (fn, ms = 60_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
};
// What git lists in `dir`, ignored files too: outside .practice/.
const outside = (dir) =>
  statusPaths(
    execFileSync(
      "git",
      ["status", "--porcelain", "--ignored", "--untracked-files=all"],
      { cwd: dir, encoding: "utf8" },
    ),
  );

// Real adapters with every check run recorded, so a test can wait for each
// to end.
function realHost(dir, saved) {
  const runs = [];
  const adapters = realAdapters({
    root: dir,
    runCheck: (...args) => {
      const run = reducerCheck(...args);
      runs.push(run);
      return run;
    },
  });
  writeFileSync(storePath(dir), JSON.stringify(saved));
  const host = createHost({
    root: dir,
    course: loadCourse(dir),
    saved: adapters.store.load(),
    env: process.env,
    platform: process.platform,
    adapters,
  });
  const heard = [];
  host.subscribe((h) => heard.push(h.input));
  return { host, adapters, heard, runs };
}

// spec: never-runs-claude
// spec: folders.progress-in-copy
test("a real copy: writing version.txt turns b-1's beat done, nothing changes outside .practice/, and only learn.json is added", async () => {
  const dir = reducerRepo();
  // The solutions branch commits its .practice/ files; start from none.
  rmSync(join(dir, ".practice"), { recursive: true, force: true });
  const before = outside(dir);
  mkdirSync(join(dir, ".practice"));
  const { host, adapters, heard, runs } = realHost(dir, {
    format: 1,
    welcomed: true,
    lessons: { "b-1": { step: "W3", beat: 0, done: ["W1", "W2"] } },
  });
  try {
    const s = await host.open();
    assert.equal(s.facts.gitError, null);
    host.start();
    host.firstLook();
    host.dispatch({ type: "lesson.open", lesson: "b-1" });
    assert.equal(host.snapshot().beat.status, "opening");
    // Its first check finds no file yet.
    assert.ok(await until(() => heard.some((i) => i.type === "check")));
    assert.notEqual(host.snapshot().beat.status, "done");
    writeFileSync(
      join(dir, ".practice", "version.txt"),
      "2.1.285 (Claude Code)\n",
    );
    assert.ok(
      await until(() => host.snapshot().beat.status === "done"),
      JSON.stringify(host.snapshot().beat),
    );
    assert.ok(heard.some((i) => i.type === "activity" || i.type === "tick"));
  } finally {
    host.close();
  }
  await Promise.all(runs);
  try {
    assert.equal(adapters.children.size(), 0, "no child is left");
    assert.deepEqual(
      outside(dir),
      before,
      "the host changed something outside .practice/",
    );
    assert.deepEqual(readdirSync(join(dir, ".practice")).sort(), [
      "learn.json",
      "version.txt",
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 150_000);

// spec: folders.progress-in-copy
test("an Intermediate folder in another repository gets the checks and git, and learn.json is written only in the copy; closing stops the children", async () => {
  const dir = reducerRepo();
  const mine = repo();
  rmSync(join(dir, ".practice"), { recursive: true, force: true });
  mkdirSync(join(dir, ".practice"));
  const course = loadCourse(dir);
  const { host, adapters, heard, runs } = realHost(dir, {
    format: 1,
    welcomed: true,
    lessons: finishedBefore("i-1", course),
    folders: { intermediate: mine },
  });
  try {
    const s = await host.open();
    assert.equal(s.lesson, "i-1");
    host.start();
    host.firstLook();
    // git looks at the folder: a repository that ignores .practice/.
    assert.ok(
      await until(() =>
        heard.some((i) => i.type === "probed" && i.path === mine),
      ),
    );
    assert.deepEqual(host.snapshot().probes[mine], {
      missing: false,
      git: true,
      gitBroken: null,
      practice: true,
    });
    // The overview's first look runs i-1's check there, in the check child.
    assert.ok(
      await until(() =>
        heard.some((i) => i.type === "check" && i.dir === mine),
      ),
      JSON.stringify(heard.map((i) => i.type)),
    );
    host.dispatch({ type: "lesson.restart", lesson: "i-1" });
    assert.ok(existsSync(storePath(dir)), "progress saves to the copy");
    assert.equal(existsSync(join(mine, ".practice")), false);
    // A run still going when the host closes is stopped.
    host.firstLook();
    assert.ok(adapters.children.size() > 0, "i-1's check child runs");
  } finally {
    host.close();
  }
  try {
    assert.equal(adapters.children.size(), 0);
    await Promise.all(runs);
    const n = heard.length;
    await new Promise((r) => setTimeout(r, 1_200));
    assert.equal(heard.length, n, "nothing is heard after close");
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(mine, { recursive: true, force: true });
  }
}, 150_000);
