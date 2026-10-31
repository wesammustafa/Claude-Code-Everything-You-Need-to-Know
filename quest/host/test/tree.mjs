// A Check child's process tree for the tree-kill tests (not a test file):
// a b-capstone copy whose tool writes its own pid and a child's to
// `pids.json`, then waits. run-check runs it at item 3, and its child is no
// group leader, so only a group kill ends both.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  repo,
  write,
} from "../../../practice-template/checks/test/helpers.mjs";

export const holding = () => {
  const dir = repo();
  write(dir, {
    "src/cli.js": `const cp = require("node:child_process");
const fs = require("node:fs");
const kid = cp.spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: "ignore" });
fs.writeFileSync(${JSON.stringify(join(dir, "pids.json"))}, JSON.stringify([process.pid, kid.pid]));
setInterval(() => {}, 1000);
`,
  });
  return dir;
};

export const until = async (ok, what) => {
  const deadline = Date.now() + 20_000;
  while (!ok()) {
    if (Date.now() > deadline) throw new Error(`timed out: ${what}`);
    await new Promise((r) => setTimeout(r, 50));
  }
};

export const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
};

// The tool's pid and its child's, once the tool has written them whole.
export const pidsOf = async (dir) => {
  const file = join(dir, "pids.json");
  await until(() => existsSync(file), "the tool's pids");
  // The write may be seen before it ends.
  let pids;
  await until(() => {
    try {
      pids = JSON.parse(readFileSync(file, "utf8"));
      return true;
    } catch {
      return false;
    }
  }, "the tool's pids, whole");
  return pids;
};

// Ends whatever a failed test left running.
export const sweep = (pids) => {
  for (const pid of pids ?? [])
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
};
