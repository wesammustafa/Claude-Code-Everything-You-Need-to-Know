// The Check child: a lesson's check, or one git probe, run in a child
// process so a slow item never freezes the app. Each run is tracked in a
// host's registry (children.mjs), so closing the host stops it.
import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { STUB_RUNS } from "../../../practice-template/checks/lessons/a-4.mjs";
import { NPM_TEST_LIMIT } from "../../../practice-template/checks/lessons/b-3.mjs";
import { lessons } from "../../../practice-template/checks/lessons/index.mjs";
import { TIME_LIMIT } from "../../../practice-template/checks/stub-claude.mjs";
import { shared } from "./children.mjs";
import { SLOW } from "./engine.mjs";

const RUN_CHECK = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../practice-template/learn/run-check.mjs",
);
// The most a run may print: a check's JSON, and a probe's.
export const CHECK_BUFFER = 4 << 20;
export const PROBE_BUFFER = 1 << 20;

// The environment for every child: git must not hold .git/index.lock while
// the learner or Claude Code commits, and no color codes in what we parse.
export function childEnv(env = process.env) {
  const { NODE_TEST_CONTEXT, ...rest } = env;
  return { ...rest, GIT_OPTIONAL_LOCKS: "0", NO_COLOR: "1" };
}

// How long the check child may run each item, from that item's start: the
// slowest items' own limits (b-3's npm test; a-4's script, run once in each
// of its scenarios), with room for the git and node around them. So the slow
// items of one run add up without ending it, items that share what a run
// found (a-7's) stay in one child, and a run of m items ends within m + 1
// times this, its start counting as one. i-capstone's hook item has no
// limit of its own: it runs each hook script it finds twice (hooks.mjs
// runCommitted), so enough scripts that hang still end the run.
export const ITEM_LIMIT =
  Math.max(NPM_TEST_LIMIT, STUB_RUNS * TIME_LIMIT) + 30_000;

// Runs `items` of a lesson's check (all when null). Slow items are left out
// unless `slow` is set, and come back marked `slow` so the screen can say
// "press r". As the child starts each item, onRunning(n, m) hears that it
// is on the nth of the m items it runs. An item still running `limit` ms
// after it started stops the child; only tests pass a shorter one.
export function runCheck(
  dir,
  lesson,
  items,
  {
    slow = false,
    onRunning = () => {},
    limit = ITEM_LIMIT,
    children = shared,
  } = {},
) {
  const all = lessons[lesson].items.map((_, i) => i);
  const skipped = slow
    ? []
    : (SLOW[lesson] ?? []).filter((i) => (items ?? all).includes(i));
  const wanted = (items ?? all).filter((i) => !skipped.includes(i));
  const placeholders = skipped.map((index) => ({
    index,
    text: lessons[lesson].items[index].text,
    pass: false,
    slow: true,
    hint: "",
  }));
  if (!wanted.length) return Promise.resolve({ items: placeholders });
  return new Promise((resolve) => {
    let timer;
    const child = children.track(
      execFile(
        process.execPath,
        [RUN_CHECK, lesson, dir, ...wanted.map(String)],
        { env: childEnv(), windowsHide: true, maxBuffer: CHECK_BUFFER },
        (error, stdout) => {
          clearTimeout(timer);
          try {
            const out = JSON.parse(stdout.trim().split("\n").pop());
            if (out.error) return resolve({ error: out.error });
            resolve({
              items: [...out.items, ...placeholders].sort(
                (a, b) => a.index - b.index,
              ),
            });
          } catch {
            resolve({
              error: error
                ? error.killed
                  ? "it took too long"
                  : error.message.split("\n")[0]
                : "it printed something unexpected",
            });
          }
        },
      ),
    );
    // The clock starts with the child, and again as each item starts.
    const limitFrom = () => {
      clearTimeout(timer);
      timer = setTimeout(() => child.kill(), limit);
    };
    limitFrom();
    // The child's reports, a line each; anything else on stderr is skipped.
    let rest = "";
    child.stderr.on("data", (chunk) => {
      const lines = (rest + chunk).split("\n");
      rest = lines.pop();
      for (const line of lines) {
        let n;
        try {
          n = JSON.parse(line).running;
        } catch {}
        if (!Number.isInteger(n)) continue;
        limitFrom();
        onRunning(n, wanted.length);
      }
    });
  });
}

// Runs one git probe (checks/probes.mjs, ticket 105) in the check child, in
// `dir`: { pass, hint, evidence, state }, or { error }. It never fetches.
export function runProbe(
  dir,
  name,
  args,
  { limit = ITEM_LIMIT, children = shared } = {},
) {
  return new Promise((resolve) => {
    children.track(
      execFile(
        process.execPath,
        [RUN_CHECK, "--probe", name, dir, ...args],
        {
          env: { ...childEnv(), GIT_NO_LAZY_FETCH: "1" },
          windowsHide: true,
          timeout: limit,
          maxBuffer: PROBE_BUFFER,
        },
        (error, stdout) => {
          try {
            const out = JSON.parse(stdout.trim().split("\n").pop());
            resolve(
              out.error
                ? { error: out.error }
                : {
                    pass: out.pass,
                    hint: out.hint,
                    evidence: out.evidence,
                    state: out.state,
                  },
            );
          } catch {
            resolve({
              error: error
                ? error.killed
                  ? "it took too long"
                  : error.message.split("\n")[0]
                : "it printed something unexpected",
            });
          }
        },
      ),
    );
  });
}
