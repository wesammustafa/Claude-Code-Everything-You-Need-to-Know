#!/usr/bin/env node
// Starts a built server bundle the way a Practice copy does, from a folder
// with no node_modules, and asks it for its health. Plain .mjs with node:
// imports only, so CI runs it on Node 22 too.
//
//   node quest/server/test/smoke.mjs [dist/learn]
//
// It copies the bundle's folder to <tmp>/<x>/learn, runs `node learn/app.mjs`
// in <x> with QUEST_BASE_PORT=0 (never 4747, which another run may hold),
// expects 200 from GET /api/health and the page at / from the printed
// address, then (not on Windows, where SIGTERM is not delivered) stops it
// with SIGTERM and expects exit 0 and the stop line. Every wait has a limit,
// and a SIGTERM to the smoke itself (spawnSync's timeout) stops the server
// and removes the copy too.
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const built = resolve(
  process.argv[2] ?? fileURLToPath(new URL("../dist/learn", import.meta.url)),
);
if (!existsSync(join(built, "app.mjs"))) {
  console.error(`smoke: no app.mjs in ${built}. Run npm run build first.`);
  process.exit(1);
}

const copy = realpathSync(mkdtempSync(join(tmpdir(), "quest-smoke-")));
cpSync(built, join(copy, "learn"), { recursive: true });

const fail = (message) => {
  console.error(`smoke: ${message}`);
  child.kill("SIGKILL");
  rmSync(copy, { recursive: true, force: true });
  process.exit(1);
};

const began = performance.now();
const child = spawn(process.execPath, ["learn/app.mjs"], {
  cwd: copy,
  env: { ...process.env, QUEST_BASE_PORT: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});
let stdout = "";
let stderr = "";
child.stderr.on("data", (chunk) => (stderr += chunk));
process.once("SIGTERM", () => fail("stopped by SIGTERM."));
const timer = setTimeout(
  () => fail(`no address within 10 s.\n${stderr}`),
  10_000,
);
const exited = new Promise((done) => child.on("exit", (code) => done(code)));

let address = null;
await new Promise((done) => {
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    const match = /http:\/\/127\.0\.0\.1:(\d+)/.exec(stdout);
    if (match && !address) {
      address = match[0];
      done();
    }
  });
  exited.then(
    (code) =>
      !address &&
      fail(`exited ${code} before listening.\n${stdout}\n${stderr}`),
  );
});
clearTimeout(timer);
const ms = performance.now() - began;
const deadline = setTimeout(
  () => fail(`no answer or exit within 10 s.\n${stderr}`),
  10_000,
);
const get = (path) =>
  fetch(`${address}${path}`, { signal: AbortSignal.timeout(5_000) }).catch(
    (error) => fail(`GET ${path} failed: ${error.message}`),
  );

const response = await get("/api/health");
const body = await response.json();
if (response.status !== 200 || body.ok !== true)
  fail(`GET /api/health answered ${response.status} ${JSON.stringify(body)}`);

const page = await get("/");
await page.arrayBuffer();
if (
  page.status !== 200 ||
  !page.headers.get("content-type")?.startsWith("text/html")
)
  fail(`GET / answered ${page.status} ${page.headers.get("content-type")}`);

if (process.platform !== "win32") {
  child.kill("SIGTERM");
  const code = await exited;
  if (code !== 0) fail(`exited ${code} after SIGTERM.\n${stderr}`);
  if (
    !stdout.includes(
      `Claude Code Quest stopped. To start it again, run npm run learn in ${copy}.`,
    )
  )
    fail(`no stop line naming the copy:\n${stdout}`);
} else {
  child.kill();
}
clearTimeout(deadline);
rmSync(copy, { recursive: true, force: true });
console.log(
  `smoke: Node ${process.versions.node} listened in ${Math.round(ms)} ms and answered GET /api/health and GET /`,
);
