// The bundle's entry, learn/app.mjs in a Practice copy: `npm run learn`.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHost, realAdapters } from "@quest/host";
import type { CompiledCourse } from "@quest/engine/content";
import { courseFrom } from "@quest/engine/course";
import table from "virtual:quest-statics";
import { openBrowser } from "./launch.ts";
import { BASE_PORT, PORT_TRIES } from "./listen.ts";
import { start } from "./start.ts";
import { loadStatics, type Statics } from "./statics.ts";

const bundle = dirname(fileURLToPath(import.meta.url));
// learn/ is the copy's own folder: the copy is its parent.
const root = resolve(bundle, "..");

// A test seam, not a CLI flag: the first port to try, 0 for any free one,
// so a smoke test never takes 4747. It is a port, never an address, low
// enough that all ten tries stay at or under 65535.
const HIGHEST_BASE = 65536 - PORT_TRIES;
function basePort(): number | null {
  const value = process.env.QUEST_BASE_PORT;
  if (value === undefined) return BASE_PORT;
  const port = Number(value);
  return /^\d+$/.test(value) && port <= HIGHEST_BASE ? port : null;
}

const base = basePort();
let statics: Statics | null = null;
if (base === null) {
  process.stderr.write(
    `QUEST_BASE_PORT must be a port from 0 to ${String(HIGHEST_BASE)}.\n`,
  );
  process.exitCode = 2;
} else {
  try {
    statics = loadStatics(bundle, table);
  } catch (error) {
    process.stderr.write(
      `Claude Code Quest could not start: its files are incomplete (${error instanceof Error ? error.message : String(error)}). Update the copy, then run npm run learn again.\n`,
    );
    process.exitCode = 1;
  }
}
if (base !== null && statics) {
  await start({
    root,
    argv: process.argv.slice(2),
    env: process.env,
    platform: process.platform,
    base,
    statics,
    signals: process,
    stdout: process.stdout,
    stderr: process.stderr,
    exit: (code) => process.exit(code),
    // A terminal on either end: `npm run learn | tee log` still opens it,
    // and a spawned run with piped stdio (the smoke test, CI) never does.
    isTTY: process.stdin.isTTY || process.stdout.isTTY,
    openBrowser: (url) => {
      openBrowser(url, process.platform, spawn);
    },
    createHost,
    realAdapters,
    // The compiled course ships beside app.mjs; the copy has no step files.
    loadCourse: () =>
      courseFrom(
        JSON.parse(
          readFileSync(new URL("./course.json", import.meta.url), "utf8"),
        ) as CompiledCourse,
      ),
  });
}
