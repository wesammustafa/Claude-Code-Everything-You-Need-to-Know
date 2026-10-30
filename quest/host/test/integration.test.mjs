// The host on real adapters, the real engine and the real clock (ticket
// 209): a practice copy made from the template plays b-1's version beat to
// done, changing nothing but its own .practice/; an Intermediate folder in
// another repository gets the checks and git while progress stays in the
// copy; and closing leaves no child running. Ticket 211: the probe, stamp
// and prerequisite effects answered by the real Check child, one child at a
// time, and closing ends a check's whole process tree.
import { test } from "vitest";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { loadCourse } from "../../engine/src/course.ts";
import { statusPaths } from "../../../practice-template/checks/paths.mjs";
import {
  commit,
  repo,
  write,
} from "../../../practice-template/checks/test/helpers.mjs";
import { b1Only, finishedBefore } from "../../engine/test/drive.mjs";
import { createHost, realAdapters } from "../src/index.ts";
import { storePath } from "../src/store.ts";
import { reducerCheck, reducerRepo } from "./repo.mjs";
import { AT_W3, scripted, tap } from "./scripted.mjs";
import { alive, holding, pidsOf, sweep } from "./tree.mjs";

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
// to end, and the engine tapped, so a test can read the raw state.
function realHost(dir, saved) {
  const engine = tap();
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
    engine,
  });
  const heard = [];
  host.subscribe((h) => heard.push(h.input));
  return { host, adapters, heard, runs, state: engine.state };
}

// spec: never-runs-claude
// spec: folders.progress-in-copy
test("a real copy: writing version.txt turns b-1's beat done, nothing changes outside .practice/, and only learn.json is added", async () => {
  const dir = reducerRepo();
  // The solutions branch commits its .practice/ files; start from none.
  rmSync(join(dir, ".practice"), { recursive: true, force: true });
  const before = outside(dir);
  mkdirSync(join(dir, ".practice"));
  const { host, adapters, heard, runs, state } = realHost(dir, {
    format: 1,
    welcomed: true,
    lessons: { "b-1": { step: "W3", beat: 0, done: ["W1", "W2"] } },
  });
  const status = () => host.snapshot().lesson.beat?.status;
  try {
    await host.open();
    assert.equal(state().facts.gitError, null);
    host.start();
    host.firstLook();
    host.dispatch({ type: "lesson.open", lesson: "b-1" });
    assert.equal(status(), "checking");
    // Its first check finds no file yet.
    assert.ok(await until(() => heard.some((i) => i.type === "check")));
    assert.notEqual(status(), "done");
    writeFileSync(
      join(dir, ".practice", "version.txt"),
      "2.1.285 (Claude Code)\n",
    );
    assert.ok(
      await until(() => status() === "done"),
      JSON.stringify(host.snapshot().lesson.beat),
    );
    // The poll can answer before the first tick, and the save's quiet
    // window can hide the write from the watcher: wait for either.
    assert.ok(
      await until(() =>
        heard.some((i) => i.type === "activity" || i.type === "tick"),
      ),
    );
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
  const { host, adapters, heard, runs, state } = realHost(dir, {
    format: 1,
    welcomed: true,
    lessons: finishedBefore("i-1", course),
    folders: { intermediate: mine },
  });
  try {
    const s = await host.open();
    assert.equal(s.lesson.id, "i-1");
    host.start();
    host.firstLook();
    // git looks at the folder: a repository that ignores .practice/.
    assert.ok(
      await until(() =>
        heard.some((i) => i.type === "probed" && i.path === mine),
      ),
    );
    assert.deepEqual(state().probes[mine], {
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

// A host on real adapters in `dir` whose answer to a wait question also
// asks for `effects`, with every Check child run counted while it runs.
function effectHost(dir, effects) {
  const adapters = realAdapters({ root: dir });
  let running = 0;
  const counts = { most: 0, runs: 0 };
  const counted =
    (run) =>
    (...args) => {
      running += 1;
      counts.runs += 1;
      counts.most = Math.max(counts.most, running);
      return run(...args).finally(() => (running -= 1));
    };
  adapters.checks.run = counted(adapters.checks.run);
  adapters.probes.run = counted(adapters.probes.run);
  const { engine } = scripted({
    effects: { "waitQuestion.answer": effects },
  });
  const host = createHost({
    root: dir,
    course: b1Only,
    saved: AT_W3,
    env: process.env,
    platform: process.platform,
    adapters,
    engine,
  });
  const heard = [];
  host.subscribe((h) => heard.push(h.input));
  return { host, adapters, heard, counts };
}

// spec: subprocess-limits
test("real probe, stamp and prerequisite effects get the Check child's answers, one child at a time", async () => {
  const dir = repo({ "README.md": "x\n", "notes.md": "a note\n" });
  commit(dir, "Initial");
  execFileSync("git", ["worktree", "add", "-q", ".claude/worktrees/one"], {
    cwd: dir,
  });
  const worktrees = { name: "worktrees", args: ["1"] };
  const { host, heard, counts } = effectHost(dir, [
    { type: "check", lesson: "b-1", items: [1], asked: 1, dir },
    { type: "probe", ...worktrees, asked: 1, dir },
    { type: "stamp", key: "k", probe: worktrees, dir },
    {
      type: "prereqs",
      lesson: "b-1",
      dir,
      requires: [{ probe: "worktrees", args: ["1"] }, { path: "notes.md" }],
      asked: 1,
    },
  ]);
  try {
    await host.open();
    host.dispatch({ type: "waitQuestion.answer", asked: 1 });
    const of = (type) => heard.filter((i) => i.type === type);
    assert.ok(
      await until(() => of("prereq").length === 2 && of("stamp").length),
      JSON.stringify(heard.map((i) => i.type)),
    );
    assert.ok(await until(() => of("check").length && of("probe").length));
    const [probe] = of("probe");
    assert.equal(probe.pass, true, JSON.stringify(probe));
    assert.match(probe.evidence, /one/);
    assert.equal(of("stamp")[0].stamp, probe.state, "the stamp is its state");
    assert.deepEqual(
      of("prereq").map((p) => [p.at, p.pass ?? String(p.read)]),
      [
        [0, true],
        [1, "a note\n"],
      ],
    );
    assert.equal(of("check")[0].items[0].index, 1);
    assert.equal(counts.runs, 4, "a check, a probe, a stamp's and a prereq's");
    assert.equal(counts.most, 1, "never two Check children at once");
  } finally {
    host.close();
    rmSync(dir, { recursive: true, force: true });
  }
}, 150_000);

// spec: subprocess-limits
test.skipIf(process.platform === "win32")(
  "closing the host while a check runs ends the Check child's tree",
  async () => {
    const dir = holding();
    const { host, adapters } = effectHost(dir, [
      {
        type: "check",
        lesson: "b-capstone",
        items: [3],
        slow: true,
        asked: 1,
        dir,
      },
    ]);
    let pids = [];
    try {
      await host.open();
      host.dispatch({ type: "waitQuestion.answer", asked: 1 });
      pids = await pidsOf(dir);
      host.close();
      assert.ok(
        await until(() => !pids.some(alive), 20_000),
        "the tool and its child end",
      );
      assert.equal(adapters.children.size(), 0);
    } finally {
      host.close();
      sweep(pids);
      rmSync(dir, { recursive: true, force: true });
    }
  },
  60_000,
);
