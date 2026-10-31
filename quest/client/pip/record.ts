// The record `npm run pip:build` writes beside the rig, and the checks CI runs
// on it without the Rive CLI: the hash of the rig's sources it was built from,
// the poster spec it rendered the posters to, and the hash of each output it
// wrote (the .riv and the posters).
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pngSize } from "./png.ts";
import { allPosters, posterSpec, type PosterSpec } from "./posters.ts";

/** quest/client/pip/, where the rig, its outputs and the record live. */
export const PIP_DIR = import.meta.dirname;

/** The Rive CLI version the rig is built with. A different one refuses to build until this changes on purpose. */
export const RIVE_CLI_VERSION = "1.7.0";

/** The rig's sources (the CLI project), relative to quest/client/pip/. */
export const RIG = "rig";
/** The built file, relative to quest/client/pip/. */
export const RIV = "pip.riv";
/** The record of a build, relative to quest/client/pip/. */
export const RECORD = "build-record.json";

export interface BuildRecord {
  /** The Rive CLI version that built the outputs. */
  rive: string;
  /** sha256 of the rig's sources (see rigSources), by path and content. */
  rig: string;
  /** The posters' scale, sizes, poses and turns (posters.ts) they were rendered to. */
  posters: PosterSpec;
  /** sha256 of each output, by its path relative to quest/client/pip/. */
  outputs: Record<string, string>;
}

/** Every file under a folder, as sorted forward-slash paths relative to it. */
export function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(dir, join(entry.parentPath, entry.name)).replaceAll("\\", "/"),
    )
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * A rig's sources: its project config (`rive.yaml`) and every `.rml` file,
 * outside the `build/` folder the CLI's own preview writes. pip:build compiles
 * a copy of exactly these files, so nothing else under rig/ reaches the .riv:
 * not a file git ignores, such as the .DS_Store Finder writes, which a CI
 * checkout never has. (A script or an asset would need more: strayFiles
 * refuses a script, and an asset the RML names is missing from the copy, so
 * the build fails.)
 */
export function rigSources(rigDir: string): string[] {
  return filesUnder(rigDir).filter(
    (file) =>
      !file.startsWith("build/") &&
      (file === "rive.yaml" || file.endsWith(".rml")),
  );
}

/**
 * The sha256 of a rig's sources: each one's path and bytes, in path order.
 * quest/client/pip/.gitattributes keeps them LF on every platform.
 */
export function rigDigest(rigDir: string): string {
  const hash = createHash("sha256");
  for (const file of rigSources(rigDir)) {
    hash.update(`${file}\0`);
    hash.update(readFileSync(join(rigDir, file)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export function fileDigest(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

/** The outputs a build writes, relative to quest/client/pip/. */
export function expectedOutputs(): string[] {
  return [RIV, ...allPosters().map((p) => p.file)].sort();
}

/**
 * A value as JSON with every object's keys in order, so two specs compare
 * equal however their keys were written, and the record reads the same.
 */
export function canonical<T>(value: T): T {
  if (Array.isArray(value)) return value.map(canonical) as T;
  if (typeof value !== "object" || value === null) return value;
  const object = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(object)
      .sort()
      .map((key) => [key, canonical(object[key])]),
  ) as T;
}

export function readRecord(pipDir: string): BuildRecord {
  return JSON.parse(readFileSync(join(pipDir, RECORD), "utf8")) as BuildRecord;
}

/**
 * Every way the committed outputs disagree with the rig and the record; empty
 * when the rig is unchanged since the build and every output is the one the
 * build wrote.
 */
export function recordProblems(pipDir: string): string[] {
  const rebuild = "Run `npm run pip:build` and commit what it writes.";
  if (!existsSync(join(pipDir, RECORD)))
    return [`${RECORD} is missing. ${rebuild}`];
  const record = readRecord(pipDir);
  const problems: string[] = [];
  if (record.rive !== RIVE_CLI_VERSION) {
    problems.push(
      `the outputs were built with Rive CLI ${record.rive}, not the pinned ${RIVE_CLI_VERSION}. ${rebuild}`,
    );
  }
  if (record.rig !== rigDigest(join(pipDir, RIG))) {
    problems.push(
      `the rig's sources changed since the last build: their hash is not the one ${RECORD} records. ${rebuild}`,
    );
  }
  if (
    JSON.stringify(canonical(record.posters)) !==
    JSON.stringify(canonical(posterSpec()))
  ) {
    problems.push(
      `the posters' scale, sizes, poses or turns in posters.ts changed since the last build: they are not the ones ${RECORD} records. ${rebuild}`,
    );
  }
  const expected = expectedOutputs();
  const recorded = Object.keys(record.outputs).sort();
  for (const file of expected) {
    if (!recorded.includes(file))
      problems.push(`${RECORD} records no ${file}. ${rebuild}`);
  }
  for (const file of recorded) {
    if (!expected.includes(file))
      problems.push(`${RECORD} records ${file}, which no build writes`);
  }
  for (const [file, digest] of Object.entries(record.outputs)) {
    const path = join(pipDir, file);
    if (!existsSync(path)) problems.push(`${file} is missing. ${rebuild}`);
    else if (fileDigest(path) !== digest)
      problems.push(`${file} is not the file the last build wrote. ${rebuild}`);
  }
  // Each poster at POSTER_SCALE times its size in PIP_SIZES, whatever the record says.
  for (const { file, px } of allPosters()) {
    const path = join(pipDir, file);
    if (!existsSync(path)) continue;
    let size: { width: number; height: number };
    try {
      size = pngSize(readFileSync(path));
    } catch {
      problems.push(`${file} is not a PNG. ${rebuild}`);
      continue;
    }
    const { width, height } = size;
    if (width !== px || height !== px)
      problems.push(
        `${file} is ${String(width)} by ${String(height)} pixels, not the ${String(px)} by ${String(px)} posters.ts asks for. ${rebuild}`,
      );
  }
  const posters = filesUnder(join(pipDir, "posters")).filter((file) =>
    file.endsWith(".png"),
  );
  for (const file of posters) {
    if (!expected.includes(`posters/${file}`))
      problems.push(`posters/${file} is not a poster the build writes`);
  }
  return problems;
}

// Files Claude Code or another agent loads as instructions, which `rive
// create` writes into a project; a Luau or AnimaScript file, which would make
// the rig scripted (the web runtimes reject unsigned scripts).
const AGENT_FILES = new Set(["claude.md", "claude.local.md", "agents.md"]);
const SCRIPT = /\.(luau|as)$/i;
// RML that would embed a script or a scripted object: every type in the pinned
// CLI's schema (`rive schema --list`) that carries or runs a script starts with
// Script (ScriptAsset, ScriptModuleAsset, the ScriptInput and Scripted types).
const SCRIPT_ELEMENT = /<Script[A-Za-z]*\b/;

/** Every file under quest/client/pip/ that breaks the Pip rules, with the reason. */
export function strayFiles(pipDir: string): string[] {
  const problems: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const rel = relative(pipDir, path).replaceAll("\\", "/");
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (AGENT_FILES.has(name.toLowerCase())) {
        problems.push(
          `${rel}: an agent instructions file (rive create writes one); never commit it under quest/client/pip/`,
        );
      } else if (SCRIPT.test(name)) {
        problems.push(`${rel}: a script; Pip's rig stays script-free`);
      } else if (
        name.endsWith(".rml") &&
        SCRIPT_ELEMENT.test(readFileSync(path, "utf8"))
      ) {
        problems.push(
          `${rel}: RML with a script in it; Pip's rig stays script-free`,
        );
      }
    }
  };
  walk(pipDir);
  return problems;
}
