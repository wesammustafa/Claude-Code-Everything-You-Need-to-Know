// The bundle itself: one file that imports only node: built-ins, under its
// 1 MB budget, with the Check child's entry beside it, and it starts from a
// folder with no node_modules (smoke.mjs). Built here from a fixture client,
// so the test needs no client build.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build, type Rolldown } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
  checkClientFresh,
  checkPagesBuilt,
  staticTable,
} from "../build/statics.ts";
import { STAMP, inputsDigest } from "../../client/build/inputs.ts";
import { checksSpecifier, runCheckBuild } from "../vite.run-check.config.ts";
import { repoRoot, serverBuild, serverRoot } from "../vite.config.ts";

const MB = 1024 * 1024;

// Every temporary folder a test makes, removed in afterAll.
const temporary: string[] = [];
function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  temporary.push(dir);
  return dir;
}

function fixtureClient(): string {
  const dir = tempDir("quest-client-");
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>Quest</title>");
  writeFileSync(join(dir, "assets/app-abc123.js"), "console.log(1);\n");
  writeFileSync(
    join(dir, "assets/rive-1.wasm"),
    Buffer.from([0, 0x61, 0x73, 0x6d]),
  );
  writeFileSync(join(dir, "favicon.svg"), "<svg/>");
  return dir;
}

function fixturePages(): string {
  const dir = tempDir("quest-pages-");
  mkdirSync(join(dir, "intermediate"));
  writeFileSync(join(dir, "index.json"), '{"ref":"v0","pages":[]}\n');
  writeFileSync(join(dir, "intermediate/05-hooks.html"), "<h1>Hooks</h1>");
  writeFileSync(join(dir, "intermediate/05-hooks.d1.light.svg"), "<svg/>");
  return dir;
}

function chunksOf(
  out: Awaited<ReturnType<typeof build>>,
): Rolldown.OutputChunk[] {
  const outputs = Array.isArray(out) ? out : [out];
  return outputs.flatMap((o) =>
    "output" in o ? o.output.filter((x) => x.type === "chunk") : [],
  );
}

// Import and export statements, dynamic imports and CommonJS loads, with
// block comments (JSDoc's import() types) left out.
function loads(code: string): string[] {
  const text = code.replace(/\/\*[\s\S]*?\*\//g, "");
  return [
    ...text.matchAll(
      /^\s*(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/gm,
    ),
    ...text.matchAll(/^\s*import\s*["']([^"']+)["']/gm),
    ...text.matchAll(/\bimport\s*\(\s*([^)]*)\)/g),
    ...text.matchAll(/\brequire\s*\(\s*([^)]*)\)/g),
    ...text.matchAll(/\b(createRequire)\b/g),
  ].map((m) => m[1] ?? "");
}

let made = "";
let outDir = "";
let chunks: Rolldown.OutputChunk[] = [];
let runCheck: Rolldown.OutputChunk[] = [];

beforeAll(async () => {
  mkdirSync(join(serverRoot, "dist"), { recursive: true });
  made = mkdtempSync(join(serverRoot, "dist/bundle-test-"));
  outDir = join(made, "learn");
  chunks = chunksOf(
    await build({
      ...serverBuild({
        clientDir: fixtureClient(),
        pagesDir: fixturePages(),
        outDir,
        checkFresh: false,
      }),
      configFile: false,
    }),
  );
  runCheck = chunksOf(
    await build({ ...runCheckBuild({ outDir }), configFile: false }),
  );
}, 120_000);
afterAll(() => {
  for (const dir of [made, ...temporary])
    if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("app.mjs", () => {
  test("is one chunk that imports only node: built-ins", () => {
    expect(chunks.map((c) => c.fileName)).toEqual(["app.mjs"]);
    const [app] = chunks;
    expect(app?.dynamicImports).toEqual([]);
    expect(app?.imports.filter((id) => !id.startsWith("node:"))).toEqual([]);
    const code = readFileSync(join(outDir, "app.mjs"), "utf8");
    expect(loads(code).filter((spec) => !/^["']?node:/.test(spec))).toEqual([]);
  });

  test("is at most 1 MB", () => {
    expect(readFileSync(join(outDir, "app.mjs")).length).toBeLessThanOrEqual(
      MB,
    );
  });

  test("has the compiled course and the listed client files beside it", () => {
    expect(existsSync(join(outDir, "course.json"))).toBe(true);
    expect(readFileSync(join(outDir, "course.json"), "utf8")).toBe(
      readFileSync(join(repoRoot, "quest/engine/dist/course.json"), "utf8"),
    );
    // The engine's own reader, loadCourse, is not in the bundle.
    expect(readFileSync(join(outDir, "app.mjs"), "utf8")).not.toContain(
      "../dist/course.json",
    );
    for (const file of [
      "index.html",
      "assets/app-abc123.js",
      "assets/rive-1.wasm",
      "favicon.svg",
    ])
      expect(existsSync(join(outDir, "app", file)), file).toBe(true);
  });

  test("has the rendered pages beside it, each listed by name", () => {
    const code = readFileSync(join(outDir, "app.mjs"), "utf8");
    for (const file of [
      "index.json",
      "intermediate/05-hooks.html",
      "intermediate/05-hooks.d1.light.svg",
    ]) {
      expect(existsSync(join(outDir, "app/pages", file)), file).toBe(true);
      expect(code).toContain(`"/pages/${file}"`);
    }
  });
});

describe("run-check.mjs", () => {
  test("imports only node: built-ins and the copy's own checks/, each of which exists", () => {
    expect(runCheck.map((c) => c.fileName)).toEqual(["run-check.mjs"]);
    const code = readFileSync(join(outDir, "run-check.mjs"), "utf8");
    const specs = loads(code).filter((spec) => !spec.startsWith("node:"));
    expect(specs.length).toBeGreaterThan(0);
    for (const spec of specs) {
      expect(spec).toMatch(/^\.\.\/checks\//);
      const target = resolve(repoRoot, "practice-template/learn", spec);
      expect(existsSync(target), spec).toBe(true);
    }
  });

  test("maps only files under practice-template/checks/", () => {
    const checks = join(repoRoot, "practice-template/checks");
    expect(checksSpecifier(join(checks, "lessons/index.mjs"))).toBe(
      "../checks/lessons/index.mjs",
    );
    expect(
      checksSpecifier(join(repoRoot, "quest/host/src/probes.ts")),
    ).toBeUndefined();
    expect(
      checksSpecifier(join(repoRoot, "practice-template/checks-extra/x.mjs")),
    ).toBeUndefined();
  });
});

test("the static list refuses a file type it has no content type for", () => {
  const dir = fixtureClient();
  writeFileSync(join(dir, "notes.txt"), "x");
  expect(() =>
    staticTable([{ from: "fixture", at: "/", immutable: () => false, dir }]),
  ).toThrow(/fixture\/notes\.txt: no content type for \.txt/);
});

test("the bundle starts from a folder with no node_modules and answers its health", () => {
  const run = spawnSync(
    process.execPath,
    [join(serverRoot, "test/smoke.mjs"), outDir],
    {
      encoding: "utf8",
      timeout: 30_000,
    },
  );
  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  expect(run.stdout).toMatch(/answered GET \/api\/health/);
}, 40_000);

test("the build refuses a client build that is missing or stale", () => {
  const client = tempDir("quest-client-root-");
  mkdirSync(join(client, "src"));
  writeFileSync(join(client, "src/main.ts"), "export {};\n");
  expect(() => {
    checkClientFresh(client);
  }).toThrow(/missing or was built from other sources/);
  mkdirSync(join(client, "dist/app"), { recursive: true });
  writeFileSync(join(client, "dist/app/index.html"), "<!doctype html>");
  writeFileSync(join(client, STAMP), `${inputsDigest(client)}\n`);
  expect(() => {
    checkClientFresh(client);
  }).not.toThrow();
  writeFileSync(join(client, "src/main.ts"), "export const changed = 1;\n");
  expect(() => {
    checkClientFresh(client);
  }).toThrow(/missing or was built from other sources/);
});

test("the build refuses a missing pages folder", () => {
  expect(() => {
    checkPagesBuilt(tempDir("quest-no-pages-"));
  }).toThrow(/has no rendered pages\. Run `npm run build -w @quest\/release`/);
  expect(() => {
    checkPagesBuilt(fixturePages());
  }).not.toThrow();
});

test("QUEST_BASE_PORT must be a port", () => {
  for (const value of ["99999", "65527", "-1", "4747x", "127.0.0.1"]) {
    const run = spawnSync(process.execPath, [join(outDir, "app.mjs")], {
      encoding: "utf8",
      env: { ...process.env, QUEST_BASE_PORT: value },
      timeout: 10_000,
    });
    expect(run.status, value).toBe(2);
    expect(run.stderr).toBe(
      "QUEST_BASE_PORT must be a port from 0 to 65526.\n",
    );
    expect(run.stdout).toBe("");
  }
});
