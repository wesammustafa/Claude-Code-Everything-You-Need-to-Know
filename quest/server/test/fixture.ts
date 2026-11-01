// A small static tree in a temporary folder, for the app and statics tests.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { StaticEntry } from "../src/statics.ts";

export const PAGE = `<!doctype html><title>Quest</title>${"<p>Claude Code Quest</p>".repeat(200)}`;
export const SCRIPT = `export const answer = 42;\n`.repeat(200);
export const WASM = Buffer.concat([
  Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]),
  Buffer.alloc(4096),
]);
export const PNG = Buffer.alloc(4096, 7);

export const TABLE: readonly StaticEntry[] = [
  {
    path: "/",
    file: "index.html",
    type: "text/html; charset=utf-8",
    immutable: false,
  },
  {
    path: "/assets/app-abc123.js",
    file: "assets/app-abc123.js",
    type: "text/javascript; charset=utf-8",
    immutable: true,
  },
  {
    path: "/assets/rive-1.wasm",
    file: "assets/rive-1.wasm",
    type: "application/wasm",
    immutable: true,
  },
  { path: "/pip.png", file: "pip.png", type: "image/png", immutable: false },
];

const trees: string[] = [];

export function staticTree(): string {
  const dir = mkdtempSync(join(tmpdir(), "quest-statics-"));
  trees.push(dir);
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), PAGE);
  writeFileSync(join(dir, "assets/app-abc123.js"), SCRIPT);
  writeFileSync(join(dir, "assets/rive-1.wasm"), WASM);
  writeFileSync(join(dir, "pip.png"), PNG);
  // On disk but not listed: never served.
  writeFileSync(join(dir, "secret.txt"), "not listed");
  return dir;
}

/** Removes every tree staticTree made: a test file's afterAll. */
export function removeTrees(): void {
  for (const dir of trees.splice(0))
    rmSync(dir, { recursive: true, force: true });
}
