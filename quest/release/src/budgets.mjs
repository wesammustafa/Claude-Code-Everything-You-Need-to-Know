// The size budgets of an assembled Practice template's learn/ folder, and the
// time `npm run learn` takes to listen (spec: Performance budget, items 1 to
// 5). Reads the tree `npm run template` wrote and the client's Vite manifest,
// prints every number, appends them to $GITHUB_STEP_SUMMARY when it is set,
// and exits 1 when a budget that is on is over its limit.
//   npm run budgets -w @quest/release -- <template-dir> [--manifest <file>]
import { spawn } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import { walk } from "./template.mjs";

const KIB = 1024;
const MIB = 1024 * KIB;

/**
 * The budgets. A limit changes only on purpose, with the reason in the PR.
 * `on: false` measures and prints a budget without failing on it.
 */
export const BUDGETS = Object.freeze(
  [
    /** Item 1: all of learn/ on disk. */
    {
      id: "learn",
      label: "learn/ total",
      limit: 6 * MIB,
      unit: "bytes",
      on: true,
    },
    /** Item 2: the entry chunk and its static imports, gzipped. */
    {
      id: "first-screen-js",
      label: "First-screen JS (gzip)",
      limit: 250 * KIB,
      unit: "bytes",
      on: true,
    },
    /** Item 3: the Latin subsets of the bundled fonts. */
    {
      id: "fonts-latin",
      label: "Latin fonts",
      limit: 150 * KIB,
      unit: "bytes",
      on: true,
    },
    /** Item 4: each rendered page. */
    {
      id: "page",
      label: "Largest page",
      limit: 100 * KIB,
      unit: "bytes",
      on: true,
    },
    /** Item 4: Pip's .riv; switched on by ticket 240. */
    { id: "riv", label: "Pip .riv", limit: 64 * KIB, unit: "bytes", on: false },
    /** Item 4: all posters together; switched on by ticket 240. */
    {
      id: "posters",
      label: "Posters",
      limit: 300 * KIB,
      unit: "bytes",
      on: false,
    },
    /** Item 5: the server bundle, learn/app.mjs. */
    {
      id: "server-bundle",
      label: "Server bundle",
      limit: 1 * MIB,
      unit: "bytes",
      on: true,
    },
    /** Item 5: `npm run learn` listening, the median of three starts. */
    {
      id: "startup",
      label: "Start-up (median of 3)",
      limit: 1000,
      unit: "ms",
      on: true,
    },
  ].map((budget) => Object.freeze(budget)),
);

/** Every file under `dir`, as sorted "/"-separated paths. */
const files = (dir) =>
  walk(dir)
    .filter((e) => !e.dir)
    .map((e) => e.path);

const size = (file) => statSync(file).size;

/** A size in KiB or MiB, as the table prints it. */
export function formatBytes(bytes) {
  if (bytes >= MIB) return `${(bytes / MIB).toFixed(2)} MiB`;
  return `${(bytes / KIB).toFixed(1)} KiB`;
}

const format = (value, unit) =>
  unit === "ms" ? `${String(Math.round(value))} ms` : formatBytes(value);

/**
 * One row per budget. A budget that cannot be measured gets `error` and no
 * `value`; `on` overrides a budget's switch (tests switch on riv and posters).
 */
export function measureTree(dir, { manifestFile, on = {} } = {}) {
  const learn = join(dir, "learn");
  const app = join(learn, "app");
  /** @type {Record<string, { value?: number, error?: string, detail?: string }>} */
  const measured = {};
  const tryMeasure = (id, fn) => {
    try {
      measured[id] = fn();
    } catch (error) {
      measured[id] = {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };
  const notTemplate =
    "found none: not an assembled template: run npm run template first";
  const all = existsSync(learn) ? files(learn) : null;

  tryMeasure("learn", () => {
    if (!all?.length) throw new Error(notTemplate);
    return {
      value: all.reduce((sum, path) => sum + size(join(learn, path)), 0),
      detail: `${String(all.length)} files`,
    };
  });

  tryMeasure("first-screen-js", () => {
    if (!all) throw new Error(notTemplate);
    if (!manifestFile || !existsSync(manifestFile))
      throw new Error(
        `found none: no Vite manifest at ${String(manifestFile)}`,
      );
    const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
    const entries = Object.keys(manifest).filter(
      (key) => manifest[key].isEntry,
    );
    if (entries.length === 0)
      throw new Error("found none: the manifest has no entry");
    const html = existsSync(join(app, "index.html"))
      ? readFileSync(join(app, "index.html"), "utf8")
      : "";
    const src = /<script[^>]*type="module"[^>]*src="\/?([^"]+)"/.exec(
      html,
    )?.[1];
    if (!entries.some((key) => manifest[key].file === src))
      throw new Error(
        `stale manifest: learn/app/index.html loads ${String(src)}, not the manifest's entry`,
      );
    const seen = new Set();
    const visit = (key) => {
      const chunk = manifest[key];
      if (!chunk || seen.has(chunk.file)) return;
      seen.add(chunk.file);
      for (const next of chunk.imports ?? []) visit(next);
    };
    for (const key of entries) visit(key);
    const js = [...seen].filter((file) => file.endsWith(".js")).sort();
    let total = 0;
    for (const file of js) {
      const path = join(app, file);
      if (!existsSync(path))
        throw new Error(`stale manifest: ${file} is not in learn/app`);
      total += gzipSync(readFileSync(path)).length;
    }
    return { value: total, detail: js.join(", ") };
  });

  const assets = all
    ? all
        .filter((path) => path.startsWith("app/assets/"))
        .map((path) => path.slice(11))
    : [];

  tryMeasure("fonts-latin", () => {
    const fonts = assets.filter(
      (name) => /-latin-(?!ext)/.test(name) && name.endsWith(".woff2"),
    );
    if (fonts.length === 0)
      throw new Error("found none: no Latin .woff2 in learn/app/assets");
    return {
      value: fonts.reduce(
        (sum, name) => sum + size(join(app, "assets", name)),
        0,
      ),
      detail: fonts.join(", "),
    };
  });

  tryMeasure("page", () => {
    const pages = (all ?? [])
      .filter((path) => path.startsWith("app/pages/") && path.endsWith(".html"))
      .map((path) => ({ path: path.slice(4), bytes: size(join(learn, path)) }));
    if (pages.length === 0)
      throw new Error("found none: no page in learn/app/pages");
    const largest = pages.reduce((a, b) => (b.bytes > a.bytes ? b : a));
    const limit = BUDGETS.find((b) => b.id === "page")?.limit ?? 0;
    const over = pages.filter((p) => p.bytes > limit).map((p) => p.path);
    return {
      value: largest.bytes,
      detail: over.length
        ? `${largest.path}; over: ${over.join(", ")}`
        : `${largest.path} (${String(pages.length)} pages)`,
    };
  });

  tryMeasure("riv", () => {
    const rivs = assets.filter((name) => name.endsWith(".riv"));
    if (rivs.length === 0)
      throw new Error("found none: no .riv in learn/app/assets");
    const sizes = rivs.map((name) => ({
      name,
      bytes: size(join(app, "assets", name)),
    }));
    const largest = sizes.reduce((a, b) => (b.bytes > a.bytes ? b : a));
    return { value: largest.bytes, detail: largest.name };
  });

  tryMeasure("posters", () => {
    const pngs = assets.filter((name) => name.endsWith(".png"));
    if (pngs.length === 0)
      throw new Error("found none: no .png in learn/app/assets");
    return {
      value: pngs.reduce(
        (sum, name) => sum + size(join(app, "assets", name)),
        0,
      ),
      detail: `${String(pngs.length)} files`,
    };
  });

  tryMeasure("server-bundle", () => {
    if (!existsSync(join(learn, "app.mjs")))
      throw new Error("found none: no learn/app.mjs");
    return { value: size(join(learn, "app.mjs")) };
  });

  return BUDGETS.filter((budget) => budget.id !== "startup").map((budget) => ({
    ...budget,
    on: on[budget.id] ?? budget.on,
    ...measured[budget.id],
  }));
}

/** Milliseconds from spawning `command` in `dir` to its address on stdout. */
function startOnce(dir, command, deadline) {
  return new Promise((done, fail) => {
    const started = performance.now();
    const [file, ...args] = command;
    const child = spawn(file, args, {
      cwd: dir,
      env: { ...process.env, QUEST_BASE_PORT: "0" },
      // Piped, not a TTY, so the app opens no browser.
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let settled = false;
    const finish = (error, ms) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (child.exitCode === null) child.kill("SIGTERM");
      if (error) fail(error);
      else done(ms);
    };
    const timer = setTimeout(() => {
      finish(new Error(`not listening after ${String(deadline)} ms`));
    }, deadline);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (/http:\/\/127\.0\.0\.1:(\d+)/.test(stdout))
        finish(null, performance.now() - started);
    });
    child.on("error", (error) => finish(error));
    child.on("exit", (code) => {
      finish(new Error(`exited ${String(code)} before listening`));
    });
  });
}

/**
 * Starts `npm run learn` in `dir` `runs` times, one after another, and
 * returns every time and their median. Ticket 230 reuses it.
 */
export async function startupMs(
  dir,
  {
    runs = 3,
    command = ["npm", "run", "--silent", "learn"],
    deadline = 10_000,
  } = {},
) {
  const times = [];
  for (let i = 0; i < runs; i++)
    times.push(await startOnce(dir, command, deadline));
  const sorted = [...times].sort((a, b) => a - b);
  return { median: sorted[Math.floor(sorted.length / 2)], times };
}

/** The start-up row, from startupMs or its failure. */
export async function measureStartup(dir, options) {
  const budget = BUDGETS.find((b) => b.id === "startup");
  try {
    const { median, times } = await startupMs(dir, options);
    return {
      ...budget,
      value: median,
      detail: times.map((t) => `${String(Math.round(t))} ms`).join(", "),
    };
  } catch (error) {
    return {
      ...budget,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** A value with its exact bytes, so one just over a limit never reads as equal to it. */
const exact = (value, unit) =>
  unit === "ms"
    ? format(value, unit)
    : `${format(value, unit)} (${String(value)} B)`;

/** One line per budget that is on and over its limit or unmeasured. */
export function budgetProblems(rows) {
  return rows
    .filter((row) => row.on)
    .flatMap((row) => {
      if (row.error !== undefined) return [`${row.label}: ${row.error}`];
      if (row.value > row.limit)
        return [
          `${row.label}: ${exact(row.value, row.unit)} is over ${exact(row.limit, row.unit)}`,
        ];
      return [];
    });
}

const result = (row) => {
  if (row.error !== undefined) return row.on ? "FAIL" : "off (ticket 240)";
  if (!row.on) return "off (ticket 240)";
  return row.value > row.limit ? "FAIL" : "ok";
};

const measuredText = (row) =>
  row.error !== undefined
    ? row.error
    : row.unit === "bytes"
      ? `${format(row.value, row.unit)} (${String(row.value)} B)`
      : format(row.value, row.unit);

/** The plain table for the terminal and the Markdown one for the CI summary. */
export function report(rows) {
  const lines = rows.map((row) => [
    row.label,
    measuredText(row),
    format(row.limit, row.unit),
    result(row),
    row.detail ?? "",
  ]);
  const head = ["Budget", "Measured", "Limit", "Result"];
  const widths = head.map((h, i) =>
    Math.max(h.length, ...lines.map((l) => l[i].length)),
  );
  const pad = (cells) =>
    cells
      .slice(0, 4)
      .map((c, i) => c.padEnd(widths[i]))
      .join("  ")
      .trimEnd();
  const text = [
    pad(head),
    ...lines.flatMap((l) => [pad(l), ...(l[4] ? [`    ${l[4]}`] : [])]),
  ].join("\n");
  const cell = (c) => c.replace(/\|/g, "\\|");
  const markdown = [
    "### Size budgets",
    "",
    `| ${head.join(" | ")} |`,
    "|---|---|---|---|",
    ...lines.map((l) => `| ${l.slice(0, 4).map(cell).join(" | ")} |`),
    "",
  ].join("\n");
  return { text, markdown };
}

async function main() {
  const args = process.argv.slice(2);
  const at = args.indexOf("--manifest");
  const manifestArg = at === -1 ? undefined : args.splice(at, 2)[1];
  // npm runs workspace scripts in quest/release; INIT_CWD is where it was typed.
  const base = process.env.INIT_CWD ?? process.cwd();
  const dir = args[0] && resolve(base, args[0]);
  if (!dir) {
    console.error(
      "Usage: npm run budgets -w @quest/release -- <template-dir> [--manifest <file>]",
    );
    process.exit(1);
  }
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const manifestFile = manifestArg
    ? resolve(base, manifestArg)
    : join(repoRoot, "quest/client/dist/app/.vite/manifest.json");
  const rows = measureTree(dir, { manifestFile });
  // The tests' seam, a JSON array: their planted app starts with node, not
  // npm, whose own start-up on a loaded machine is not what they test.
  const seam = process.env.QUEST_BUDGETS_START_COMMAND;
  const command = seam ? JSON.parse(seam) : undefined;
  rows.push(await measureStartup(dir, command && { command }));
  const { text, markdown } = report(rows);
  console.log(text);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    try {
      appendFileSync(summary, markdown);
    } catch (error) {
      console.error(
        `Could not write the CI summary: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  const problems = budgetProblems(rows);
  if (problems.length) {
    console.error(
      `\nOver budget:\n${problems.map((p) => `  ${p}`).join("\n")}`,
    );
    // exitCode, not exit(): the table on a piped stdout is flushed first.
    process.exitCode = 1;
    return;
  }
  console.log("\nEvery budget that is on holds.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
