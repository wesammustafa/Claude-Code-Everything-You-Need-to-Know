// The Check child, real (ticket 209, ported from learn-io): its reports, its
// per-item limit, its environment and its slow items, and each host's own
// registry of children.
import { test } from "vitest";
import assert from "node:assert/strict";
import { execFile, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { STUB_RUNS } from "../../../practice-template/checks/lessons/a-4.mjs";
import { NPM_TEST_LIMIT } from "../../../practice-template/checks/lessons/b-3.mjs";
import { lessons } from "../../../practice-template/checks/lessons/index.mjs";
import { TIME_LIMIT } from "../../../practice-template/checks/stub-claude.mjs";
import {
  repo,
  withRepo,
  write,
} from "../../../practice-template/checks/test/helpers.mjs";
import {
  CHECK_BUFFER,
  childEnv,
  ITEM_LIMIT,
  PROBE_BUFFER,
  runCheck,
} from "../src/check-child.mjs";
import { createChildren } from "../src/children.mjs";
import { GIT_LIMIT } from "../src/git.mjs";
import { root } from "../../engine/test/drive.mjs";

const RUN_CHECK = fileURLToPath(
  new URL("../src/run-check.mjs", import.meta.url),
);
const SLOW_TEST = 60_000;
const child = (args, extraEnv = {}) => {
  const { NODE_TEST_CONTEXT: _, ...env } = process.env;
  const r = spawnSync(process.execPath, [RUN_CHECK, ...args], {
    encoding: "utf8",
    env: { ...env, ...extraEnv },
  });
  return {
    code: r.status,
    out: r.stdout.trim() ? JSON.parse(r.stdout.trim()) : null,
  };
};

// spec: subprocess-limits
test("today's limits: 150 s an item from the slowest items' own, 4 MB for a check, 1 MB for a probe, 30 s for git", () => {
  assert.equal(ITEM_LIMIT, 150_000);
  assert.equal(
    ITEM_LIMIT,
    Math.max(NPM_TEST_LIMIT, STUB_RUNS * TIME_LIMIT) + 30_000,
  );
  assert.equal(CHECK_BUFFER, 4 * 1024 * 1024);
  assert.equal(PROBE_BUFFER, 1024 * 1024);
  assert.equal(GIT_LIMIT, 30_000);
});

test(
  "the check child gives the live version and note checks their own words",
  () => {
    withRepo(
      () => repo(),
      (dir) => {
        const none = child(["b-1", dir], { PATH: dir });
        assert.equal(none.code, 0);
        assert.equal(none.out.items.length, 2);
        assert.equal(none.out.items[0].pass, false);
        assert.match(none.out.items[0].hint, /couldn't find `claude`/);
        assert.equal(
          none.out.items[1].hint,
          lessons["b-1"].items[1].check({
            dir,
            read: () => null,
            exists: () => false,
          }),
        );
        // An obsolete saved version cannot make the live installation pass.
        write(dir, { ".practice/version.txt": "2.1.285 (Claude Code)" });
        assert.equal(
          child(["b-1", dir, "0"], { PATH: dir }).out.items[0].pass,
          false,
        );
        write(dir, {
          "practice/b-1/onboarding.md":
            "linkcheck exits 1 when it finds broken links.",
        });
        assert.equal(child(["b-1", dir, "1"]).out.items[0].pass, true);
        assert.equal(child(["b-9", dir]).code, 2);
        assert.equal(child(["b-1", dir, "7"]).code, 2);
      },
    );
  },
  SLOW_TEST,
);

test(
  'the check child writes {"running": n} to stderr before each item it runs, and stdout stays one line of JSON',
  () => {
    withRepo(
      () => repo(),
      (dir) => {
        const { NODE_TEST_CONTEXT: _, ...env } = process.env;
        const run = (args) =>
          spawnSync(process.execPath, [RUN_CHECK, ...args], {
            encoding: "utf8",
            env,
          });
        const two = run(["b-3", dir, "0", "2"]);
        assert.equal(two.status, 0);
        assert.equal(two.stderr, '{"running":1}\n{"running":2}\n');
        assert.equal(two.stdout.split("\n").filter(Boolean).length, 1);
        assert.deepEqual(
          JSON.parse(two.stdout).items.map((i) => i.index),
          [0, 2],
        );
        assert.equal(
          run(["b-1", dir]).stderr,
          '{"running":1}\n{"running":2}\n',
          "every item when none is named",
        );
        const bad = run(["b-9", dir]);
        assert.equal(bad.status, 2);
        assert.equal(bad.stderr, "", "no item runs, so none is reported");
        assert.equal(bad.stdout.split("\n").filter(Boolean).length, 1);
      },
    );
  },
  SLOW_TEST,
);

test(
  "runCheck passes on each report as item n of the m items the child runs, before its result",
  async () => {
    const dir = repo();
    try {
      const seen = [];
      const r = await runCheck(dir, "b-3", [3, 5], {
        onRunning: (n, m) => seen.push([n, m]),
      });
      assert.deepEqual(seen, [
        [1, 2],
        [2, 2],
      ]);
      assert.deepEqual(
        r.items.map((i) => i.index),
        [3, 5],
      );
      // The four process-running items are left out, so the child runs the two fast items.
      seen.length = 0;
      await runCheck(dir, "b-3", null, {
        onRunning: (n, m) => seen.push([n, m]),
      });
      assert.deepEqual(seen, [
        [1, 2],
        [2, 2],
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  SLOW_TEST,
);

// spec: subprocess-limits
test(
  "the check child's time limit runs from the start of each item, so slow items add up in one run without ending it",
  async () => {
    // b-capstone's two slow items, each 2 s here, the tool then npm test, and
    // together past the limit: each well under it.
    const nap = (ms) =>
      `setTimeout(() => { console.error('docs missing'); process.exit(2); }, ${ms});\n`;
    const dir = repo({
      "src/cli.js": nap(2_000),
      "package.json": JSON.stringify({
        scripts: { test: 'node -e "setTimeout(() => {}, 2000)"' },
      }),
    });
    try {
      const r = await runCheck(dir, "b-capstone", [3, 4], {
        slow: true,
        limit: 4_000,
      });
      assert.deepEqual(
        r.items?.map((i) => [i.index, i.pass]),
        [
          [3, true],
          [4, true],
        ],
        JSON.stringify(r),
      );
      // One item that runs past it still ends the run.
      write(dir, { "src/cli.js": nap(6_000) });
      assert.deepEqual(
        await runCheck(dir, "b-capstone", [3], { slow: true, limit: 2_000 }),
        { error: "it took too long" },
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  SLOW_TEST,
);

// spec: subprocess-limits
test(
  "children never take git's index lock or print color, and slow items wait for r",
  async () => {
    const env = childEnv({ NODE_TEST_CONTEXT: "child", PATH: "/bin" });
    assert.equal(env.GIT_OPTIONAL_LOCKS, "0");
    assert.equal(env.NO_COLOR, "1");
    assert.equal(env.NODE_TEST_CONTEXT, undefined);
    assert.equal(env.PATH, "/bin");
    const r = await runCheck(root, "b-3", null);
    assert.equal(
      r.items.find((i) => i.index === 1).slow,
      true,
      "the test run is left for r",
    );
  },
  SLOW_TEST,
);

// spec: subprocess-limits
test("a child that fails to start leaves the registry", async () => {
  const children = createChildren();
  const code = await new Promise((resolve) =>
    children.track(
      execFile("quest-no-such-program", [], (error) => resolve(error?.code)),
    ),
  );
  assert.equal(code, "ENOENT");
  await new Promise((r) => setImmediate(r));
  assert.equal(children.size(), 0);
});

// spec: subprocess-limits
test("each host's registry stops only its own children", async () => {
  const sleeper = (children) =>
    new Promise((resolve) => {
      const c = children.track(
        execFile(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], () =>
          resolve(c.signalCode ?? "exited"),
        ),
      );
    });
  const one = createChildren();
  const two = createChildren();
  const a = sleeper(one);
  let bEnded = false;
  const b = sleeper(two).then((how) => ((bEnded = true), how));
  assert.deepEqual([one.size(), two.size()], [1, 1]);
  one.stop();
  assert.equal(await a, "SIGTERM");
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(bEnded, false, "the other host's child still runs");
  assert.equal(two.size(), 1);
  two.stop();
  assert.equal(await b, "SIGTERM");
});
