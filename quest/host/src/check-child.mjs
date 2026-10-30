// The Check child: a lesson's check, or one git probe, run in a child
// process so a slow item never freezes the app. Each run is tracked in a
// host's registry (children.mjs), so closing the host stops it, with every
// process it started.
import { spawn } from "node:child_process";
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
  "run-check.mjs",
);
// The most a run may print, its stdout and stderr together: a check's JSON
// line and its reports, or a probe's line. Every ladder scenario's real
// output is under 1 KB, and a whole lesson's run under 8 KB (ticket 211).
export const OUTPUT_CAP = 1 << 20;
// The timers a call outside a host uses; a host passes its clock.
const TIMERS = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
};

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

// Ends `child` and every process it started that is still in its group:
// on POSIX the child leads a group of its own (startChild), so a check's
// npm test or tool goes with it. Windows ends the child alone. A group that
// has already ended is no error.
function killTree(child) {
  if (process.platform === "win32" || !child.pid) return void child.kill();
  try {
    process.kill(-child.pid, "SIGKILL");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

// Splits text that comes in chunks into lines, for onLine. The run's
// output cap bounds a line still unfinished, as it bounds every byte.
export function lineReader(onLine) {
  let rest = "";
  return (chunk) => {
    const lines = (rest + chunk).split("\n");
    rest = lines.pop();
    for (const line of lines) onLine(line);
  };
}

// Starts run-check.mjs with `args`. Its stderr goes to onLine a line at a
// time, with `restart` to start the limit again. It is ended with its group
// when an item runs `limit` ms (overran) or it prints more than `cap` bytes
// (capped), and its group is ended again once it exits, so nothing it
// started outlives it. The limit runs on until its output closes: a process
// that left the group and holds the pipes is cut off then.
function startChild(args, { env, limit, cap, clock, children, onLine }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [RUN_CHECK, ...args], {
      env,
      windowsHide: true,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.track(child, () => killTree(child));
    let timer;
    let overran = false;
    let capped = false;
    let used = 0;
    const stdout = [];
    const restart = () => {
      clock.clearTimeout(timer);
      timer = clock.setTimeout(() => {
        overran = true;
        killTree(child);
      }, limit);
    };
    const overflow = () => {
      if (capped) return;
      capped = true;
      killTree(child);
    };
    const counted = (chunk) => {
      used += Buffer.byteLength(chunk);
      if (used > cap) overflow();
      return !capped;
    };
    const lines = lineReader((line) => onLine(line, restart));
    restart();
    child.stdout.on("data", (chunk) => counted(chunk) && stdout.push(chunk));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => counted(chunk) && lines(chunk));
    child.once("exit", () => {
      killTree(child);
      clock.clearTimeout(timer);
      timer = clock.setTimeout(() => {
        overran = true;
        child.stdout.destroy();
        child.stderr.destroy();
      }, limit);
    });
    child.once("error", (error) => {
      clock.clearTimeout(timer);
      resolve({ error });
    });
    child.once("close", (code) => {
      clock.clearTimeout(timer);
      resolve({
        stdout: Buffer.concat(stdout).toString("utf8"),
        overran,
        capped,
        code,
      });
    });
  });
}

// The child's last line of JSON, or why there is none.
function outcome(r, args) {
  if (r.error) return { error: r.error.message.split("\n")[0] };
  if (r.overran) return { error: "it took too long" };
  if (r.capped) return { error: "it printed too much" };
  try {
    return JSON.parse(r.stdout.trim().split("\n").pop());
  } catch {
    return {
      error:
        r.code === 0
          ? "it printed something unexpected"
          : `Command failed: ${[process.execPath, RUN_CHECK, ...args].join(" ")}`,
    };
  }
}

// Runs `items` of a lesson's check (all when null). Slow items are left out
// unless `slow` is set, and come back marked `slow` so the screen can say
// "press r". As the child starts each item, onRunning(n, m) hears that it
// is on the nth of the m items it runs. An item still running `limit` ms
// after it started stops the child, as printing more than `cap` bytes
// does; only tests pass other ones.
export function runCheck(
  dir,
  lesson,
  items,
  {
    slow = false,
    onRunning = () => {},
    limit = ITEM_LIMIT,
    cap = OUTPUT_CAP,
    clock = TIMERS,
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
  const args = [lesson, dir, ...wanted.map(String)];
  // The child's reports, a line each; anything else on stderr is skipped.
  // The limit starts with the child, and again as each item starts.
  const onLine = (line, restart) => {
    let n;
    try {
      n = JSON.parse(line).running;
    } catch {}
    if (!Number.isInteger(n)) return;
    restart();
    onRunning(n, wanted.length);
  };
  return startChild(args, {
    env: childEnv(),
    limit,
    cap,
    clock,
    children,
    onLine,
  }).then((r) => {
    const out = outcome(r, args);
    if (out.error) return { error: out.error };
    return {
      items: [...out.items, ...placeholders].sort((a, b) => a.index - b.index),
    };
  });
}

// Runs one git probe (probes.mjs, beside this file; ticket 105) in the
// check child, in `dir`: { pass, hint, evidence, state }, or { error }. It
// never fetches. The whole run has one `limit`.
export function runProbe(
  dir,
  name,
  args,
  {
    limit = ITEM_LIMIT,
    cap = OUTPUT_CAP,
    clock = TIMERS,
    children = shared,
  } = {},
) {
  const argv = ["--probe", name, dir, ...args];
  return startChild(argv, {
    env: { ...childEnv(), GIT_NO_LAZY_FETCH: "1" },
    limit,
    cap,
    clock,
    children,
    onLine: () => {},
  }).then((r) => {
    const out = outcome(r, argv);
    return out.error
      ? { error: out.error }
      : {
          pass: out.pass,
          hint: out.hint,
          evidence: out.evidence,
          state: out.state,
        };
  });
}
