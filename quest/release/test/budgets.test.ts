// The size budgets on a planted template tree: the tree passes, each budget
// that is on fails on one oversized file, the controls it must not count
// pass, an empty set or a stale manifest fails, and the CLI's exit codes and
// CI summary.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  BUDGETS,
  budgetProblems,
  measureStartup,
  measureTree,
  report,
  type BudgetRow,
} from "../src/budgets.mjs";
import { removeTemp, tempDir } from "./pages-fixture";

const KIB = 1024;
// The planted app starts with node: npm's own start-up under load is not tested.
const node = [process.execPath, "learn/app.mjs"];
const script = fileURLToPath(new URL("../src/budgets.mjs", import.meta.url));

let dir: string;
let manifestFile: string;

const put = (path: string, content: string | Buffer) => {
  const file = join(dir, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
};

const appMjs = (delayMs = 0, exitEarly = false) =>
  exitEarly
    ? "process.exit(3);\n"
    : `setTimeout(() => { console.log("http://127.0.0.1:4320"); }, ${String(delayMs)});\nprocess.on("SIGTERM", () => process.exit(0));\nsetInterval(() => {}, 1000);\n`;

beforeEach(() => {
  dir = tempDir("quest-budgets-");
  manifestFile = join(dir, "manifest.json");
  put(
    "learn/app/index.html",
    '<!doctype html><script type="module" crossorigin src="/assets/index-a.js"></script>',
  );
  put("learn/app/assets/index-a.js", "import './shared-b.js';\n");
  put("learn/app/assets/shared-b.js", "export const b = 1;\n");
  put("learn/app/assets/lazy-c.js", "export const c = 1;\n");
  put("learn/app/assets/inter-latin-opsz-normal-x.woff2", Buffer.alloc(KIB));
  put(
    "learn/app/assets/inter-latin-ext-opsz-normal-x.woff2",
    Buffer.alloc(KIB),
  );
  put("learn/app/assets/pip-x.riv", Buffer.alloc(KIB));
  put("learn/app/assets/idle-x.png", Buffer.alloc(KIB));
  put("learn/app/pages/beginner/one.html", "<p>one</p>");
  put("learn/app/pages/beginner/two.html", "<p>two</p>");
  put("learn/app.mjs", appMjs());
  put(
    "package.json",
    JSON.stringify({ scripts: { learn: "node learn/app.mjs" } }),
  );
  writeFileSync(
    manifestFile,
    JSON.stringify({
      "index.html": {
        file: "assets/index-a.js",
        isEntry: true,
        imports: ["_shared-b.js"],
        dynamicImports: ["src/lazy.ts"],
      },
      "_shared-b.js": { file: "assets/shared-b.js" },
      "src/lazy.ts": { file: "assets/lazy-c.js", isDynamicEntry: true },
    }),
  );
});

afterEach(() => {
  removeTemp();
});

const failing = (rows: BudgetRow[]) =>
  budgetProblems(rows).map((p) => p.split(":")[0]);
const label = (id: string) => BUDGETS.find((b) => b.id === id)?.label;
const row = (rows: BudgetRow[], id: string) => rows.find((r) => r.id === id);

describe("the planted tree", () => {
  test("passes every budget and measures each one", () => {
    const rows = measureTree(dir, { manifestFile });
    expect(budgetProblems(rows)).toEqual([]);
    expect(rows.every((r) => typeof r.value === "number")).toBe(true);
    expect(row(rows, "first-screen-js")?.detail).toBe(
      "assets/index-a.js, assets/shared-b.js",
    );
    expect(row(rows, "fonts-latin")?.value).toBe(KIB);
  });

  test.each([
    ["learn", "learn/app/pad.bin", 6 * 1024 * KIB + 1],
    [
      "fonts-latin",
      "learn/app/assets/jetbrains-mono-latin-wght-normal-y.woff2",
      150 * KIB,
    ],
    ["page", "learn/app/pages/advanced/big.html", 100 * KIB + 1],
    ["server-bundle", "learn/app.mjs", 1024 * KIB + 1],
  ])("%s fails on a planted oversized file", (id, path, bytes) => {
    put(path, Buffer.alloc(bytes));
    expect(failing(measureTree(dir, { manifestFile }))).toEqual([label(id)]);
  });

  test("first-screen-js fails on an incompressible static import", () => {
    put("learn/app/assets/shared-b.js", randomBytes(260 * KIB));
    expect(failing(measureTree(dir, { manifestFile }))).toEqual([
      label("first-screen-js"),
    ]);
  });

  test("the page row lists every page over the limit", () => {
    put("learn/app/pages/a.html", Buffer.alloc(101 * KIB));
    put("learn/app/pages/b.html", Buffer.alloc(102 * KIB));
    expect(row(measureTree(dir, { manifestFile }), "page")?.detail).toBe(
      "pages/b.html; over: pages/a.html, pages/b.html",
    );
  });

  test("a dynamic chunk and a latin-ext font do not count", () => {
    put("learn/app/assets/lazy-c.js", randomBytes(300 * KIB));
    put(
      "learn/app/assets/inter-latin-ext-opsz-normal-x.woff2",
      Buffer.alloc(200 * KIB),
    );
    expect(budgetProblems(measureTree(dir, { manifestFile }))).toEqual([]);
  });

  test("riv and posters are measured off, and fail once switched on", () => {
    put("learn/app/assets/pip-x.riv", Buffer.alloc(65 * KIB));
    put("learn/app/assets/hero-x.png", Buffer.alloc(300 * KIB));
    const off = measureTree(dir, { manifestFile });
    expect(budgetProblems(off)).toEqual([]);
    expect(report(off).text).toMatch(/Pip \.riv .*off \(ticket 240\)/);
    const on = measureTree(dir, {
      manifestFile,
      on: { riv: true, posters: true },
    });
    expect(failing(on)).toEqual([label("riv"), label("posters")]);
  });
});

describe("what the budgets refuse", () => {
  test("a manifest file missing from the tree is stale", () => {
    rmSync(join(dir, "learn/app/assets/shared-b.js"));
    expect(budgetProblems(measureTree(dir, { manifestFile }))).toEqual([
      `${String(label("first-screen-js"))}: stale manifest: assets/shared-b.js is not in learn/app`,
    ]);
  });

  test("an entry index.html does not load is stale", () => {
    put(
      "learn/app/index.html",
      '<script type="module" src="/assets/index-z.js"></script>',
    );
    expect(budgetProblems(measureTree(dir, { manifestFile }))[0]).toMatch(
      /stale manifest: learn\/app\/index\.html loads assets\/index-z\.js/,
    );
  });

  test.each([
    [
      "first-screen-js",
      () => {
        writeFileSync(manifestFile, "{}");
      },
    ],
    [
      "fonts-latin",
      () => {
        rmSync(join(dir, "learn/app/assets/inter-latin-opsz-normal-x.woff2"));
      },
    ],
    [
      "page",
      () => {
        rmSync(join(dir, "learn/app/pages"), { recursive: true });
      },
    ],
    [
      "server-bundle",
      () => {
        rmSync(join(dir, "learn/app.mjs"));
      },
    ],
  ])("%s fails as found none on an empty set", (id, plant) => {
    plant();
    const problems = budgetProblems(measureTree(dir, { manifestFile }));
    expect(problems).toEqual([
      `${String(label(id))}: ${String(row(measureTree(dir, { manifestFile }), id)?.error)}`,
    ]);
    expect(problems[0]).toMatch(/found none/);
  });

  test("a folder with no learn/ is not an assembled template", () => {
    rmSync(join(dir, "learn"), { recursive: true });
    const problems = budgetProblems(measureTree(dir, { manifestFile }));
    expect(problems[0]).toMatch(
      /not an assembled template: run npm run template first/,
    );
  });
});

describe("start-up", () => {
  test("passes a quick start and prints all three times", async () => {
    const startup = await measureStartup(dir, { command: node });
    expect(budgetProblems([startup])).toEqual([]);
    expect(startup.detail?.split(", ")).toHaveLength(3);
  }, 30_000);

  test("fails a start that listens after 1500 ms", async () => {
    put("learn/app.mjs", appMjs(1500));
    expect(failing([await measureStartup(dir, { command: node })])).toEqual([
      label("startup"),
    ]);
  }, 30_000);

  test("fails an app that exits before listening", async () => {
    put("learn/app.mjs", appMjs(0, true));
    expect(
      budgetProblems([await measureStartup(dir, { command: node })])[0],
    ).toMatch(/exited 3 before listening/);
  }, 30_000);
});

describe("npm run budgets", () => {
  const run = (args: string[], env: Record<string, string> = {}) => {
    const clean = { ...process.env };
    delete clean.GITHUB_STEP_SUMMARY;
    delete clean.INIT_CWD;
    return spawnSync(process.execPath, [script, ...args], {
      encoding: "utf8",
      // A hang fails the test instead of the run: the CI step once hung.
      timeout: 20_000,
      env: {
        ...clean,
        QUEST_BUDGETS_START_COMMAND: JSON.stringify(node),
        ...env,
      },
    });
  };

  test("prints usage and exits 1 with no folder", () => {
    const result = run([]);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/^Usage: npm run budgets/);
  });

  test("exits 0 on the planted tree, printing to stdout only", () => {
    const result = run([dir, "--manifest", manifestFile]);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^Budget +Measured +Limit +Result/);
    expect(result.stdout).not.toMatch(/### Size budgets/);
  }, 30_000);

  test("exits 1 over budget and appends the table to the CI summary", () => {
    put("learn/app.mjs", Buffer.alloc(1024 * KIB + 1));
    const summary = join(dir, "summary.md");
    writeFileSync(summary, "before\n");
    const result = run([dir, "--manifest", manifestFile], {
      GITHUB_STEP_SUMMARY: summary,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /Server bundle: 1\.00 MiB \(1048577 B\) is over 1\.00 MiB \(1048576 B\)/,
    );
    const written = readFileSync(summary, "utf8");
    expect(written).toMatch(
      /^before\n### Size budgets\n\n\| Budget \| Measured \| Limit \| Result \|/,
    );
    expect(written).toMatch(/\| Server bundle \| .* \| FAIL \|/);
  }, 30_000);

  // On Linux npm's child is dash, which dies on SIGTERM without passing it on
  // (run 41230844036 hung after its table). This wrapper does the same on
  // every platform: it starts the server and leaves it running when ended.
  test("exits and leaves no server when a wrapper does not pass SIGTERM on", () => {
    put(
      "learn/app.mjs",
      `import { appendFileSync } from "node:fs";\nappendFileSync("pids", \`\${String(process.pid)}\\n\`);\n${appMjs()}`,
    );
    put(
      "wrapper.mjs",
      `import { spawn } from "node:child_process";\nspawn(process.execPath, ["learn/app.mjs"], { stdio: "inherit" });\nprocess.on("SIGTERM", () => process.exit(0));\n`,
    );
    const wrapper = [process.execPath, "wrapper.mjs"];
    const result = run([dir, "--manifest", manifestFile], {
      QUEST_BUDGETS_START_COMMAND: JSON.stringify(wrapper),
    });
    const pids = readFileSync(join(dir, "pids"), "utf8")
      .split("\n")
      .filter(Boolean)
      .map(Number);
    const alive = pids.filter((pid) => {
      try {
        process.kill(pid, 0);
      } catch {
        return false;
      }
      process.kill(pid, "SIGKILL");
      return true;
    });
    // It ended by itself; 0 or 1 hangs on the machine's speed, not on this.
    expect(result.error).toBeUndefined();
    expect(result.stdout).toMatch(/Start-up \(median of 3\) +\d+ ms/);
    expect(pids).toHaveLength(3);
    expect(alive).toEqual([]);
  }, 30_000);
});
