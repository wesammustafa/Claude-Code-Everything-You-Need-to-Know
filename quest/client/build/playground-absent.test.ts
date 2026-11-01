// @vitest-environment node
// The Pip Playground is development-only: the release build holds neither its
// route nor its code, its stylesheet or the approved board, and no crop of the
// board is committed. This builds the client as `npm run build` does, in
// memory, so `npm run test:quest` checks it with no browser and no dist.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  build,
  loadConfigFromFile,
  type PluginOption,
  type Plugin,
  type Rolldown,
} from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const clientRoot = fileURLToPath(new URL("../", import.meta.url));

interface Built {
  name: string;
  bytes: Buffer;
}

async function plugins(options: PluginOption[]): Promise<Plugin[]> {
  const out: Plugin[] = [];
  for (const option of options) {
    const settled = await option;
    if (Array.isArray(settled)) out.push(...(await plugins(settled)));
    else if (settled) out.push(settled);
  }
  return out;
}

/** The release build's files, built in memory with the client's own config. */
async function releaseBuild(): Promise<Built[]> {
  const loaded = await loadConfigFromFile(
    { command: "build", mode: "production" },
    join(clientRoot, "vite.config.ts"),
    clientRoot,
    "silent",
  );
  if (loaded === null) throw new Error("No quest/client/vite.config.ts");
  const { config } = loaded;
  // The stamp says which sources dist/app was built from; this build writes
  // no dist/app, so it must leave the stamp alone.
  const kept = (await plugins(config.plugins ?? [])).filter(
    (plugin) => plugin.name !== "quest:stamp-inputs",
  );
  const output = await build({
    ...config,
    configFile: false,
    root: clientRoot,
    mode: "production",
    logLevel: "silent",
    plugins: kept,
    build: { ...config.build, write: false },
  });
  return (Array.isArray(output) ? output : [output])
    .flatMap((o) => (o as Rolldown.RolldownOutput).output)
    .map((file) => ({
      name: file.fileName,
      bytes: Buffer.from(file.type === "chunk" ? file.code : file.source),
    }));
}

// A stand-in for the private board, where the dev server would find it.
const scratch = fileURLToPath(new URL("../dist/", import.meta.url));
let fixture = "";
const BOARD_BYTES = Buffer.from("PIP-APPROVED-BOARD-FIXTURE-1536x1024");
let files: Built[] = [];
const env = {
  NODE_ENV: process.env.NODE_ENV,
  PIP_BOARD: process.env.PIP_BOARD,
};

beforeAll(async () => {
  mkdirSync(scratch, { recursive: true });
  fixture = mkdtempSync(join(scratch, "absent-test-"));
  const board = join(fixture, "pip-approved-board.png");
  writeFileSync(board, BOARD_BYTES);
  // As `npm run build` runs: a production build, here with a board present.
  process.env.NODE_ENV = "production";
  process.env.PIP_BOARD = board;
  try {
    files = await releaseBuild();
  } finally {
    for (const [name, value] of Object.entries(env)) {
      if (value === undefined) Reflect.deleteProperty(process.env, name);
      else process.env[name] = value;
    }
  }
}, 120_000);

afterAll(() => {
  if (fixture !== "") rmSync(fixture, { recursive: true, force: true });
});

describe("the release build", () => {
  test("is the app: its page, script, stylesheet and fonts", () => {
    const names = files.map((file) => file.name);
    expect(names).toContain("index.html");
    expect(names.some((name) => /^assets\/index-.*\.js$/.test(name))).toBe(
      true,
    );
    expect(names.some((name) => /^assets\/index-.*\.css$/.test(name))).toBe(
      true,
    );
  });

  test("holds no file of the Playground's and no image of the board", () => {
    // Its route module would be a chunk of its own; the board and its crops
    // would be images the app never ships.
    expect(
      files
        .map((file) => file.name)
        .filter((name) => /playground|route-|board|\.webp$/i.test(name)),
    ).toEqual([]);
    expect(
      files
        .filter((file) => file.bytes.includes(BOARD_BYTES))
        .map((file) => file.name),
    ).toEqual([]);
  });

  test("holds no trace of the Playground's code, words or styles", () => {
    const traces = [
      /playground/i,
      // The page's own words and marks, as the dev build serves them.
      /Development only/,
      /What drives Pip/,
      /Rive unavailable: posters only/,
      /data-playground-/,
      /Intensity presets/,
      // The driver's log and the scenarios.
      /The waiting /,
      /Retry during a Success/,
      // The board: where the dev server serves it, and the crops' captions.
      /@playground\/board/,
      /pip-approved-board/,
      /Board not available/,
      /Working Together/,
      /Small Size Icons/,
      // Utilities only the Playground uses: its stylesheet stays out too.
      /\.accent-accent\b/,
      /\.tabular-nums\b/,
    ];
    const found = files.flatMap((file) => {
      if (!/\.(js|css|html|json|svg|txt)$/.test(file.name)) return [];
      const text = file.bytes.toString("utf8");
      return traces
        .filter((trace) => trace.test(text))
        .map((trace) => `${file.name}: ${String(trace)}`);
    });
    expect(found).toEqual([]);
  });
});

test("no crop of the private board is committed", () => {
  const tracked = execFileSync(
    "git",
    ["ls-files", "--", "src/playground", ":(glob)**/pip-approved-board*"],
    { cwd: clientRoot, encoding: "utf8" },
  )
    .split("\n")
    .filter((path) => /\.(webp|png|jpe?g|avif|gif)$/i.test(path));
  expect(tracked).toEqual([]);
});
