// The widened read-only guard (ticket 209) on the engine and the host: the
// sources it reads, three planted breaks it must catch, the ways around it
// it must close, and the layering between the engine and the host.
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  asSources,
  readOnlyFindings,
  reached,
  relativeOf,
} from "./read-only.mjs";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const at = (path) => join(ROOT, path);
// The Checks' side: Guard B (learn-io) covers it, and the walk stops there.
const CHECKS = at("practice-template/checks") + "/";
const ENGINE = at("quest/engine/src/engine.mjs");
const HOST_ROOTS = [
  at("quest/host/src/index.mjs"),
  at("quest/host/src/fake.mjs"),
];

const mjsIn = (dir) =>
  readdirSync(at(dir), { recursive: true })
    .filter((f) => f.endsWith(".mjs"))
    .map((f) => join(at(dir), f));
const walk = (roots) => {
  const out = new Set();
  for (const r of roots)
    for (const f of reached(r, { stop: [CHECKS] })) out.add(f);
  return out;
};
// What the guard reads: the host's and the engine's own sources, and every
// module they reach short of the Checks.
function scope() {
  const files = new Set([
    ...mjsIn("quest/host/src"),
    ...mjsIn("quest/engine/src"),
    ...walk([...HOST_ROOTS, ENGINE]),
  ]);
  return asSources(ROOT, files);
}
const rel = (file) => relative(ROOT, file).split("\\").join("/");

// spec: never-runs-claude
test("the engine and the host make no network call, start only the Check child and read-only git, and write only through the store", () => {
  const sources = scope();
  const paths = sources.map((s) => s.path);
  // The scope can't shrink unseen: the files that run each kind of effect.
  for (const must of [
    "quest/host/src/host.mjs",
    "quest/host/src/check-child.mjs",
    "quest/host/src/git.mjs",
    "quest/host/src/store.mjs",
    "quest/host/src/run-check.mjs",
    "quest/host/src/probes.mjs",
    "quest/engine/src/probes.mjs",
    "quest/engine/src/engine.mjs",
    "quest/engine/src/course.mjs",
    "quest/engine/src/holds.mjs",
    "quest/engine/src/status.mjs",
  ])
    assert.ok(paths.includes(must), `the guard reads ${must}`);
  assert.ok(!paths.some((p) => p.startsWith("practice-template/checks/")));
  assert.deepEqual(readOnlyFindings(sources), []);
});

const planted = (text, path = "quest/host/src/planted.mjs") =>
  readOnlyFindings([{ path, text }]);

// spec: never-runs-claude
test("a planted network call, a planted process and a planted write each fail the guard", () => {
  assert.notDeepEqual(planted('fetch("https://example.com");\n'), []);
  assert.notDeepEqual(
    planted(
      'import { spawn } from "node:child_process";\nspawn("curl", ["x"]);\n',
    ),
    [],
  );
  const write =
    'import { writeFile } from "node:fs/promises";\nawait writeFile("a", "b");\n';
  assert.notDeepEqual(planted(write), []);
  assert.deepEqual(
    planted(write, "quest/host/src/store.mjs"),
    [],
    "the store may write",
  );
  const host = readFileSync(at("quest/host/src/host.mjs"), "utf8");
  const found = readOnlyFindings([
    { path: "quest/host/src/host.mjs", text: `${host}\nfetch(url);\n` },
  ]);
  assert.ok(
    found.some((f) => f.startsWith("quest/host/src/host.mjs:")),
    found.join("\n"),
  );
});

// The three planted breaks, each in the real text of the files that run
// effects: every one is found.
const PLANTS = {
  network: 'fetch("https://example.com");\n',
  process: 'import { spawn } from "node:child_process";\nspawn("curl", []);\n',
  write:
    'import { writeFile } from "node:fs/promises";\nawait writeFile("a", "b");\n',
};
const PLANTED_IN = [
  "quest/host/src/host.mjs",
  "quest/engine/src/engine.mjs",
  "quest/host/src/check-child.mjs",
  "quest/host/src/probes.mjs",
  "quest/engine/src/probes.mjs",
];

// spec: never-runs-claude
test("a network call, a process and a write planted in each real file that runs effects fail the guard", () => {
  for (const path of PLANTED_IN) {
    const text = readFileSync(at(path), "utf8");
    assert.deepEqual(readOnlyFindings([{ path, text }]), [], path);
    for (const [kind, plant] of Object.entries(PLANTS)) {
      const found = readOnlyFindings([{ path, text: `${text}\n${plant}` }]);
      assert.ok(
        found.some((f) => f.startsWith(`${path}:`)),
        `${kind} planted in ${path} is not found`,
      );
    }
  }
  // And through what the guard reads: one plant in one real entry.
  const sources = scope();
  const i = sources.findIndex((s) => s.path === "quest/host/src/probes.mjs");
  sources[i] = { ...sources[i], text: `${sources[i].text}\n${PLANTS.network}` };
  assert.ok(
    readOnlyFindings(sources).some((f) =>
      f.startsWith("quest/host/src/probes.mjs:"),
    ),
  );
});

// The Check child's entry, as check-child.mjs names it.
const RUN_CHECK =
  'const RUN_CHECK = join(\n  dirname(fileURLToPath(import.meta.url)),\n  "run-check.mjs",\n);\n';

test("the guard closes the ways around it, and lets a wrapped git call, a RegExp's exec, the Check child's spawn and its group kill pass", () => {
  const flagged = [
    'import { execFile } from "node:child_process";\nexecFile("curl", []);\n',
    'import { execFile } from "node:child_process";\nexecFile(process.execPath, ["-e", c, RUN_CHECK]);\n',
    'import { execFile } from "node:child_process";\nexecFile("git", args);\n',
    'import { execFile } from "node:child_process";\nexecFile("git", ["push"]);\n',
    'import { execFile } from "node:child_process";\nexecFile("git", ["config", "user.name", "x"]);\n',
    'import { execFile as run } from "node:child_process";\nrun("curl", []);\n',
    'import * as cp from "node:child_process";\ncp.execFile("git", ["status"]);\n',
    'const cp = require("child_process");\n',
    'const { execFile } = await import("node:child_process");\n',
    'import { execFile } from "node:child_process";\nconst run = execFile;\n',
    'const h = await import("node:http2");\n',
    'import { request } from "node:https";\n',
    'import "node:net";\n',
    'import { writeFileSync as w } from "node:fs";\nw("a", "b");\n',
    'import * as fs from "node:fs";\n',
    'import fs from "fs";\n',
    'export { writeFile } from "node:fs/promises";\n',
    'const w = new Worker("./x.mjs");\n',
    "const s = new WebSocket(url);\n",
    "if (import.meta.main) run();\n",
    'import { styleText } from "node:util";\n',
    "await globalThis.fetch(url);\n",
    'const m = await import(`node:${"child"}_process`);\n',
    'const m = await import("node:child" + "_process");\n',
    'm.spawn("curl", []);\n',
    'cp.execSync("curl x");\n',
    'm.execFile("curl", []);\n',
    'const cp = process.getBuiltinModule("node:child_" + "process");\n',
    'process.getBuiltinModule("node:https").get(u);\n',
    'const r = createRequire(import.meta.url);\nr("node:https").get(u);\n',
    "const h = require(name);\n",
    'import { readFileSync } from "node:fs";\nreadFileSync(p, { flag: "w" });\n',
    'import { spawn } from "node:child_process";\nspawn(process.execPath, ["-e", x]);\n',
    'import { spawn } from "node:child_process";\nconst s = spawn;\ns(RUN_CHECK);\n',
    'import { spawn as s } from "node:child_process";\ns(process.execPath, [RUN_CHECK]);\n',
    'import { execFile } from "node:child_process";\nexecFile("taskkill", ["/pid", p, "/T", "/F"]);\n',
    "process.kill(1234);\n",
    'process.kill(-process.pid, "SIGKILL");\n',
    'const o = { pid: 1 };\nprocess.kill(-o.pid, "SIGKILL");\n',
    'const { kill } = process;\nkill(-1, "SIGKILL");\n',
    "const p = process;\np.kill(-1);\n",
    'process["kill"](-1);\n',
    'Reflect.get(process, "kill")(-1);\n',
    'import { spawn } from "node:child_process";\nconst RUN_CHECK = "/tmp/x.mjs";\nspawn(process.execPath, [RUN_CHECK]);\n',
    `import { spawn } from "node:child_process";\n${RUN_CHECK}RUN_CHECK = "/tmp/x.mjs";\nspawn(process.execPath, [RUN_CHECK]);\n`,
  ];
  for (const text of flagged)
    assert.notDeepEqual(planted(text), [], `not flagged:\n${text}`);
  const passes = [
    'import { execFile } from "node:child_process";\nexecFile(\n  "git",\n  ["status", "--porcelain"],\n  opts,\n);\n',
    "const m = /x/.exec(s);\n",
    'import {\n  existsSync,\n  readFileSync,\n} from "node:fs";\n',
    'import { execFile } from "node:child_process";\nexecFile("git", ["config", "user.name"], opts);\n',
    '/** @param {import("./types.mjs").Host} host */\nconst page = await import("./page.mjs");\n',
    `import { execFile, spawn } from "node:child_process";\n${RUN_CHECK}spawn(process.execPath, [RUN_CHECK, a], { detached: true });\n`,
  ];
  for (const text of passes)
    assert.deepEqual(planted(text), [], `flagged:\n${text}`);
  // The group kill passes in the Check child's runner alone.
  const kill = 'process.kill(-child.pid, "SIGKILL");\n';
  assert.deepEqual(planted(kill, "quest/host/src/check-child.mjs"), []);
  assert.notDeepEqual(planted(kill), []);
});

test("the import walk follows imports wrapped over lines", () => {
  const text =
    'import {\n  a,\n  b,\n} from "./a.mjs";\nexport * from "../b.mjs";\nimport "./c.mjs";\nconst d = await import("./d.mjs");\n';
  assert.deepEqual(relativeOf(text), [
    "./a.mjs",
    "../b.mjs",
    "./c.mjs",
    "./d.mjs",
  ]);
});

test("the layering walk sees a module that reaches the host", () => {
  const dir = mkdtempSync(join(tmpdir(), "layering-"));
  try {
    const file = join(dir, "reaches.mjs");
    // The walk follows relative specifiers alone.
    const to = relative(dir, at("quest/host/src/children.mjs"));
    writeFileSync(
      file,
      `import { createChildren } from ${JSON.stringify(to.split("\\").join("/"))};\n`,
    );
    assert.ok(
      [...reached(file)].some((f) => rel(f).startsWith("quest/host/")),
      [...reached(file)].join("\n"),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the engine reaches no host module, and no module reaches the Terminal app's old practice-template/learn/", () => {
  for (const file of walk([ENGINE]))
    assert.ok(
      !rel(file).startsWith("quest/host/"),
      `the engine reaches ${rel(file)}`,
    );
  for (const file of walk([...HOST_ROOTS, ENGINE]))
    assert.ok(
      !rel(file).startsWith("practice-template/learn/"),
      `${rel(file)} is reached`,
    );
});
