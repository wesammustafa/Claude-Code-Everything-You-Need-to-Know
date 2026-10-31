// The fresh-copy proof: assembles the Practice template into a temporary
// folder, runs `npm run build` again and assembles a second copy from it, makes the first copy a fresh git repository, as
// "Use this template" does, and reports each step of the spec's proof:
//   1 the Starter project's tests, and the Checks' own tests in this repo;
//   2 every Check fails on the fresh copy, run from project/;
//   3 every Check passes after the full replay, with Claude Code at the
//     CHANGELOG baseline (the proof never installs it);
//   4 `npm run learn` starts on the second copy with no node_modules and no
//     network, serves on 127.0.0.1, and Chromium loads a Lesson;
//   5 the tree holds no step file, Terminal app or live config, laid out right;
//   6 the two copies, one per build, have identical bytes and modes.
// Every step runs, and reports, even when an earlier one failed. Plain Node
// with node: imports only; Playwright loads only for step 4's browser.
//   npm run proof -- [--skip-checks-tests] [--any-claude] [--keep]
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { applyLesson, lessonOrder, prepareCopy } from "./replay.mjs";
import {
  assembleTemplate,
  importProblems,
  layoutProblems,
  templateProblems,
  walk,
} from "./template.mjs";

const WINDOWS = process.platform === "win32";

/** The baseline Claude Code version in CHANGELOG.md's text. The regex is .github/scripts/rules/drift.mjs's. */
export function baselineVersion(text) {
  const m = text.match(/^Baseline: Claude Code v(\d+\.\d+\.\d+) \(stable\)/m);
  if (!m)
    throw new Error(
      'CHANGELOG.md has no "Baseline: Claude Code vX.Y.Z (stable)" line',
    );
  return m[1];
}

/** Every file under `dir` but .git, as a sorted path to {sha256, mode} map. */
export function snapshot(dir) {
  const files = {};
  for (const { path, dir: isDir } of walk(dir)) {
    if (isDir || path === ".git" || path.startsWith(".git/")) continue;
    const file = join(dir, path);
    files[path] = {
      sha256: createHash("sha256").update(readFileSync(file)).digest("hex"),
      mode: statSync(file).mode & 0o777,
    };
  }
  return files;
}

/** The paths whose bytes or mode differ between two snapshots, or that only one holds. */
export function sameBytes(a, b) {
  const paths = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return paths.filter(
    (p) =>
      a[p]?.sha256 !== b[p]?.sha256 ||
      a[p]?.mode !== b[p]?.mode ||
      !(p in a) ||
      !(p in b),
  );
}

/** Step 5: the assembly's own checks, on a pristine tree. */
export function treeProblems(dir) {
  return [
    ...templateProblems(dir),
    ...layoutProblems(dir),
    ...importProblems(readFileSync(join(dir, "learn/app.mjs"), "utf8")).map(
      (p) => `learn/app.mjs ${p}`,
    ),
  ];
}

// The test runner sets NODE_TEST_CONTEXT, which turns a nested node --test
// into a child reporter: leave it out so the run reports for itself.
function cleanEnv(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

function run(command, cwd, env = cleanEnv()) {
  const [file, ...args] = command;
  const result = spawnSync(file, args, {
    cwd,
    env,
    encoding: "utf8",
    shell: WINDOWS,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    status: result.status,
    error: result.error,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

const tail = (text, lines = 15) => text.trimEnd().split("\n").slice(-lines);

function commandStep(command, cwd) {
  const { status, error, output } = run(command, cwd);
  if (status === 0) return { ok: true, problems: [] };
  return {
    ok: false,
    problems: [
      `${command.join(" ")} ${error ? `failed: ${error.message}` : `exited ${String(status)}`}`,
      ...tail(output),
    ],
  };
}

/** Step 1a: the Starter project's tests, from the copy's project/. */
export function starterTests(copy, { command = ["npm", "test"] } = {}) {
  return commandStep(command, join(copy, "project"));
}

/** Step 1b: the Checks' own tests in this repo (test:checks without course:compile, which the build ran). */
export function checksTests(
  repoRoot,
  {
    command = [
      process.execPath,
      "--test",
      "practice-template/checks/test/*.test.mjs",
    ],
  } = {},
) {
  return commandStep(command, repoRoot);
}

// `check -- all --assert <mode>` from project/: exit 0 when every Lesson
// matched, 1 with one "<id>: expected ..." line per Lesson that didn't.
function assertChecks(copy, mode) {
  const command = ["npm", "run", "--silent", "check", "--", "all", "--assert"];
  const { status, error, output } = run(
    [...command, mode],
    join(copy, "project"),
  );
  if (status === 0) return { ok: true, problems: [] };
  const wrong = output.split("\n").filter((l) => /^\S+: expected /.test(l));
  if (status === 1 && wrong.length) return { ok: false, problems: wrong };
  return {
    ok: false,
    problems: [
      `check --assert ${mode} ${error ? `failed: ${error.message}` : `exited ${String(status)}`}`,
      ...tail(output),
    ],
  };
}

/** Step 2: every Check fails on the fresh copy. */
export function freshFails(copy) {
  return assertChecks(copy, "fail");
}

const VERSION = /\b(\d+\.\d+\.\d+)\b/;

/**
 * Step 3: the tools the replay and the Checks need, Claude Code at the
 * baseline, then every Lesson's solution on the one prepared copy and every
 * Check passing. `anyClaude` turns a version mismatch into a note.
 */
export function replayPasses({
  repoRoot,
  copy,
  solutionsDir,
  claude = "claude",
  anyClaude = false,
}) {
  const problems = [];
  for (const tool of ["jq", "bash"])
    if (run([tool, "--version"], copy).status !== 0)
      problems.push(`${tool} is not on PATH`);
  const baseline = baselineVersion(
    readFileSync(join(repoRoot, "CHANGELOG.md"), "utf8"),
  );
  const found = run([claude, "--version"], copy);
  const version =
    found.status === 0 ? VERSION.exec(found.output)?.[1] : undefined;
  let note;
  if (!version)
    problems.push(
      `Claude Code is not on PATH: install @anthropic-ai/claude-code@${baseline}`,
    );
  else if (version !== baseline) {
    const mismatch = `Claude Code is ${version}, not the baseline ${baseline}`;
    if (anyClaude) note = mismatch;
    else problems.push(mismatch);
  }
  if (problems.length) return { ok: false, problems, note };
  try {
    for (const id of lessonOrder(repoRoot))
      applyLesson({ repoRoot, copy, id, solutionsDir });
  } catch (error) {
    return {
      ok: false,
      problems: [error instanceof Error ? error.message : String(error)],
      note,
    };
  }
  return { ...assertChecks(copy, "pass"), note };
}

/**
 * Starts `npm run --silent learn` in `dir` with QUEST_BASE_PORT=0 and piped
 * stdio (no TTY, so no browser opens), and resolves at the first
 * http://127.0.0.1:<port> on stdout. stop() sends SIGTERM and resolves with the
 * exit code. Windows delivers no SIGTERM: the whole tree is ended with taskkill
 * and no exit code is expected.
 * Ticket 230 reuses it.
 */
export function startLearn(
  dir,
  { env = process.env, deadlineMs = 10_000 } = {},
) {
  return new Promise((done, fail) => {
    const started = performance.now();
    const child = spawn("npm", ["run", "--silent", "learn"], {
      cwd: dir,
      env: { ...env, QUEST_BASE_PORT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
      shell: WINDOWS,
    });
    // With shell: WINDOWS the child is cmd.exe, so ending it alone would leave
    // npm and the server holding the port and the folder.
    const killTree = (signal) => {
      if (WINDOWS)
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
      else child.kill(signal);
    };
    let output = "";
    let listening = false;
    const exited = new Promise((resolveExit) =>
      child.on("exit", (code) => resolveExit(code)),
    );
    const stop = async (waitMs = 10_000) => {
      if (child.exitCode !== null) return child.exitCode;
      killTree("SIGTERM");
      let timer;
      const code = await Promise.race([
        exited,
        new Promise((r) => (timer = setTimeout(() => r("timeout"), waitMs))),
      ]);
      clearTimeout(timer);
      if (code === "timeout") {
        killTree("SIGKILL");
        return null;
      }
      return code;
    };
    const timer = setTimeout(() => {
      killTree("SIGKILL");
      fail(
        new Error(`not listening after ${String(deadlineMs)} ms\n${output}`),
      );
    }, deadlineMs);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = /http:\/\/127\.0\.0\.1:\d+/.exec(output);
      if (match && !listening) {
        listening = true;
        clearTimeout(timer);
        done({
          url: match[0],
          ms: performance.now() - started,
          stop,
          output: () => output,
        });
      }
    });
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      fail(error);
    });
    exited.then((code) => {
      if (listening) return;
      clearTimeout(timer);
      fail(new Error(`exited ${String(code)} before listening\n${output}`));
    });
  });
}

// Loaded into every Node process `npm run learn` starts (npm and the app):
// any connection, lookup or listen off loopback is logged and refused.
const OFFLINE = `import net from "node:net";
import dns from "node:dns";
import { appendFileSync } from "node:fs";
const loopback = (h) =>
  h === "localhost" || /^127\\./.test(h) || h === "::1" || h === "::ffff:127.0.0.1";
const refuse = (what) => {
  appendFileSync(process.env.QUEST_PROOF_NET_LOG, \`\${what}\\n\`);
  throw new Error(\`proof: no network: \${what}\`);
};
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  let host = "localhost";
  if (first !== null && typeof first === "object") {
    if (first.path === undefined) host = first.host ?? "localhost";
  } else if (typeof first === "number" || /^\\d+$/.test(String(first)))
    host = typeof args[1] === "string" ? args[1] : "localhost";
  if (!loopback(host)) refuse(\`connect to \${host}\`);
  return connect.apply(this, args);
};
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  const first = args[0];
  let host;
  if (first !== null && typeof first === "object") {
    if (first.path !== undefined || first.fd !== undefined || first.handle || first._handle)
      return listen.apply(this, args);
    host = first.host;
  } else if (typeof first === "string" && !/^\\d+$/.test(first))
    return listen.apply(this, args);
  else host = typeof args[1] === "string" ? args[1] : undefined;
  if (!host || !loopback(host)) refuse(\`listen on \${host || "every interface"}\`);
  return listen.apply(this, args);
};
const lookup = dns.lookup;
dns.lookup = function (host, ...rest) {
  if (!loopback(host)) refuse(\`look up \${host}\`);
  return lookup.call(this, host, ...rest);
};
const lookupAsync = dns.promises.lookup;
dns.promises.lookup = function (host, ...rest) {
  if (!loopback(host)) refuse(\`look up \${host}\`);
  return lookupAsync.call(this, host, ...rest);
};
`;

// Chromium resolves no host but loopback: quest/client/playwright.config.ts's ONLY_LOOPBACK.
const ONLY_LOOPBACK =
  "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1";

// Not template.mjs walk(): that skips node_modules, and this lists them.
function nodeModules(dir, at = "") {
  return readdirSync(join(dir, at), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((e) => {
      const path = at ? `${at}/${e.name}` : e.name;
      return e.name === "node_modules" ? [path] : nodeModules(dir, path);
    });
}

async function loadsLesson(url, title) {
  const { chromium } = await import("@playwright/test");
  const problems = [];
  const browser = await chromium.launch({ args: [ONLY_LOOPBACK] });
  try {
    const page = await browser.newPage({ serviceWorkers: "block" });
    const origin = new URL(url).origin;
    await page.routeWebSocket(/.*/, (ws) => {
      if (new URL(ws.url()).origin.replace(/^ws/, "http") === origin)
        return ws.connectToServer();
      problems.push(`the page opened a WebSocket to ${ws.url()}`);
      return ws.close();
    });
    await page.route("**", (route) => {
      const target = route.request().url();
      if (new URL(target).origin === origin) return route.continue();
      problems.push(`the page asked for ${target}`);
      return route.abort();
    });
    page.on("pageerror", (error) =>
      problems.push(`page error: ${error.message}`),
    );
    await page.goto(`${url}/#/lesson/b-1`);
    try {
      await page.waitForFunction(
        (want) => document.querySelector("h1")?.textContent?.trim() === want,
        title,
        { timeout: 15_000 },
      );
    } catch {
      const h1 = await page
        .locator("h1")
        .first()
        .textContent({ timeout: 1_000 })
        .catch(() => null);
      problems.push(
        `b-1 did not load: the h1 is ${h1 === null ? "missing" : JSON.stringify(h1)}, not ${JSON.stringify(title)}`,
      );
    }
  } finally {
    await browser.close();
  }
  return problems;
}

/** Step 4: `npm run learn` with no node_modules and no network, on 127.0.0.1, and (with `chromium`) b-1 in the browser. */
export async function serves(
  dir,
  { chromium = true, deadlineMs = 10_000 } = {},
) {
  const problems = nodeModules(dir).map((p) => `${p}: node_modules`);
  if (problems.length) return { ok: false, problems };
  const work = realpathSync(mkdtempSync(join(tmpdir(), "quest-proof-net-")));
  const preload = join(work, "offline.mjs");
  const log = join(work, "net.log");
  writeFileSync(preload, OFFLINE);
  writeFileSync(log, "");
  const offline = "http://127.0.0.1:9";
  const env = {
    ...process.env,
    HTTP_PROXY: offline,
    HTTPS_PROXY: offline,
    ALL_PROXY: offline,
    http_proxy: offline,
    https_proxy: offline,
    npm_config_offline: "true",
    npm_config_update_notifier: "false",
    NODE_OPTIONS: `--import=${pathToFileURL(preload).href}`,
    QUEST_PROOF_NET_LOG: log,
  };
  let note;
  try {
    let app;
    try {
      app = await startLearn(dir, { env, deadlineMs });
    } catch (error) {
      problems.push(
        ...`${error instanceof Error ? error.message : error}`
          .trimEnd()
          .split("\n"),
      );
    }
    if (app) {
      note = `listening at ${app.url} after ${String(Math.round(app.ms))} ms`;
      try {
        const health = await fetch(`${app.url}/api/health`, {
          signal: AbortSignal.timeout(5_000),
        });
        if (health.status !== 200)
          problems.push(`GET /api/health answered ${String(health.status)}`);
        if (chromium) {
          const course = JSON.parse(
            readFileSync(join(dir, "learn/course.json"), "utf8"),
          );
          const title = course.lessons.find((l) => l.id === "b-1")?.title;
          if (!title) problems.push("learn/course.json has no b-1");
          else problems.push(...(await loadsLesson(app.url, title)));
        }
      } catch (error) {
        problems.push(error instanceof Error ? error.message : String(error));
      } finally {
        const code = await app.stop();
        if (!WINDOWS && code !== 0)
          problems.push(`npm run learn exited ${String(code)} on SIGTERM`);
      }
    }
    problems.push(
      ...readFileSync(log, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => `went off loopback: ${l}`),
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return { ok: problems.length === 0, problems, note };
}

const STEPS = [
  [1, "the Starter project's and the Checks' tests pass"],
  [2, "every Check fails on the fresh copy"],
  [3, "every Check passes after the replay"],
  [4, "npm run learn serves offline and Chromium loads a Lesson"],
  [5, "the tree's contents and layout"],
  [6, "a second build gives identical bytes"],
];

const skip = (reason) => ({
  ok: true,
  skipped: true,
  problems: [],
  note: reason,
});

async function timed(fn) {
  const began = performance.now();
  try {
    return { ...(await fn()), ms: performance.now() - began };
  } catch (error) {
    return {
      ok: false,
      problems: [error instanceof Error ? error.message : String(error)],
      ms: performance.now() - began,
    };
  }
}

/**
 * Step 6's second build: `npm run build` again in this repo, so the second
 * copy is assembled from fresh output and a non-deterministic build shows up.
 */
export function rebuild(repoRoot) {
  const run = spawnSync("npm", ["run", "build"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: WINDOWS,
  });
  if (run.status === 0) return { ok: true, problems: [] };
  const tail = `${run.stdout ?? ""}${run.stderr ?? ""}`.trim().split("\n");
  return {
    ok: false,
    problems: [
      `the second npm run build exited ${String(run.status)}`,
      ...tail.slice(-5),
    ],
  };
}

/** The proof's last line and whether it failed. */
export function verdict(results) {
  const failed = results.filter((r) => !r.ok).map((r) => r.n);
  if (failed.length)
    return { failed: true, line: `proof: FAILED (steps ${failed.join(", ")})` };
  if (results.some((r) => r.skipped || r.partial))
    return { failed: false, line: "proof: PARTIAL (not a full proof)" };
  return {
    failed: false,
    line: `proof: ${String(results.length)} of ${String(results.length)} passed`,
  };
}

/**
 * Runs every step and prints its result. `steps` replaces any step function
 * (the tests' seam); `log` receives each line. Sets process.exitCode to 1 when
 * a step failed, and returns the per-step results.
 */
export async function runProof({
  repoRoot,
  skipChecksTests = false,
  anyClaude = false,
  keep = false,
  chromium = true,
  inputs,
  writeNotices,
  solutionsDir,
  steps = {},
  log = console.log,
}) {
  const fn = {
    assemble: assembleTemplate,
    rebuild,
    starterTests,
    checksTests,
    freshFails,
    replayPasses,
    serves,
    treeProblems,
    ...steps,
  };
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "quest-proof-")));
  const a = join(tmp, "a");
  const b = join(tmp, "b");
  const results = new Map();
  try {
    let assembled = null;
    try {
      const options = { repoRoot, inputs, writeNotices };
      const { ref } = await fn.assemble({ ...options, outDir: a });
      const snapA = snapshot(a);
      const rebuilt = await timed(() => fn.rebuild(repoRoot));
      await fn.assemble({ ...options, outDir: b });
      assembled = { ref, snapA, snapB: snapshot(b), rebuilt };
      log(`proof: the Practice template at ${ref}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.set(5, { ok: false, problems: message.split("\n"), ms: 0 });
      for (const n of [1, 2, 3, 4, 6])
        results.set(n, skip("the template did not assemble"));
    }
    if (assembled) {
      results.set(
        5,
        await timed(() => {
          const problems = fn.treeProblems(a);
          return { ok: problems.length === 0, problems };
        }),
      );
      let prepared = true;
      try {
        prepareCopy(a);
      } catch (error) {
        prepared = false;
        const reason = `the copy is not a git repository: ${error instanceof Error ? error.message : error}`;
        results.set(1, { ok: false, problems: [reason], ms: 0 });
        for (const n of [2, 3]) results.set(n, skip(reason));
      }
      if (prepared) {
        results.set(
          1,
          await timed(async () => {
            const starter = await fn.starterTests(a);
            const checks = skipChecksTests
              ? skip("the Checks' tests skipped (--skip-checks-tests)")
              : await fn.checksTests(repoRoot);
            return {
              ok: starter.ok && checks.ok,
              partial: Boolean(checks.skipped),
              problems: [
                ...starter.problems.map((p) => `starter: ${p}`),
                ...checks.problems.map((p) => `checks: ${p}`),
              ],
              note: checks.skipped ? checks.note : undefined,
            };
          }),
        );
        results.set(2, await timed(() => fn.freshFails(a)));
        results.set(
          3,
          await timed(async () => {
            const r = await fn.replayPasses({
              repoRoot,
              copy: a,
              solutionsDir,
              anyClaude,
            });
            return { ...r, partial: Boolean(r.note) };
          }),
        );
      }
      results.set(4, await timed(() => fn.serves(b, { chromium })));
      results.set(
        6,
        await timed(() => {
          const { rebuilt } = assembled;
          if (!rebuilt.ok) return { ...rebuilt, ok: false };
          const differ = sameBytes(assembled.snapA, assembled.snapB);
          return {
            ok: differ.length === 0,
            problems: differ.map((p) => `${p} differs`),
          };
        }),
      );
    }
    const ordered = STEPS.map(([n, name]) => ({ n, name, ...results.get(n) }));
    for (const r of ordered) {
      const mark = r.ok ? (r.skipped ? "SKIP" : "PASS") : "FAIL";
      log(
        `${mark} ${String(r.n)} ${r.name} (${String(Math.round(r.ms ?? 0))} ms)`,
      );
      if (r.note) log(`    note: ${r.note}`);
      for (const p of r.problems) log(`    ${p}`);
    }
    if (keep) log(`proof: kept the copies in ${tmp}`);
    const { failed, line } = verdict(ordered);
    log(line);
    if (failed) process.exitCode = 1;
    return ordered;
  } finally {
    if (!keep) rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  const usage =
    "Usage: npm run proof -- [--skip-checks-tests] [--any-claude] [--keep]";
  let parsed;
  try {
    parsed = parseArgs({
      options: {
        "skip-checks-tests": { type: "boolean" },
        "any-claude": { type: "boolean" },
        keep: { type: "boolean" },
      },
    });
  } catch (error) {
    console.error(`${error.message}\n${usage}`);
    process.exit(2);
  }
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
  await runProof({
    repoRoot,
    skipChecksTests: Boolean(parsed.values["skip-checks-tests"]),
    anyClaude: Boolean(parsed.values["any-claude"]),
    keep: Boolean(parsed.values.keep),
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
