// The legacy fingerprints: every Lesson's fingerprint at the template commit
// the Terminal app last shipped, read from that commit's learn/lessons/*.md
// with the engine's parser, and written to course/legacy-fingerprints.json
// for the compile step. A Terminal app save carries no fingerprint, so the
// engine compares it with these. Recompute when the template's main moves:
//   git clone --no-tags <template> <dir>
//   npm run course:legacy -- <dir>
// It reads only the given clone and never touches the network.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  coursePath,
  fingerprint,
  parseLesson,
  parseManifest,
} from "../../engine/src/content.ts";
import { lessons } from "../../../practice-template/checks/lessons/index.mjs";
import { PROBES, probeError } from "../../host/src/probes.ts";
import { TEMPLATE_REMOTE } from "./publish.mjs";

/**
 * Every manifest Lesson's fingerprint from `<lessonsDir>/<id>.md`. Throws on
 * a missing or unreadable file, naming it; no Lesson is ever left out.
 */
export function legacyFingerprints(
  lessonsDir,
  manifestValue,
  commit,
  template = TEMPLATE_REMOTE,
) {
  const manifest = parseManifest(manifestValue);
  const context = { manifest, checks: lessons, probes: { PROBES, probeError } };
  const prints = {};
  for (const entry of coursePath(manifest)) {
    const file = join(lessonsDir, `${entry.id}.md`);
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      throw new Error(`${file}: no such Lesson file`);
    }
    prints[entry.id] = fingerprint(parseLesson(text, file, context));
  }
  return { template, commit, lessons: prints };
}

function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error("Usage: npm run course:legacy -- <clone dir>");
  const git = (...args) =>
    execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  const commit = git("rev-parse", "HEAD").trim();
  if (!/^[0-9a-f]{40}$/.test(commit))
    throw new Error(`${dir}: HEAD is not a commit (${commit})`);
  if (git("status", "--porcelain") !== "")
    throw new Error(`${dir}: the clone has local changes`);
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const manifest = JSON.parse(
    readFileSync(join(root, "course/manifest.json"), "utf8"),
  );
  const data = legacyFingerprints(join(dir, "learn/lessons"), manifest, commit);
  writeFileSync(
    join(root, "course/legacy-fingerprints.json"),
    `${JSON.stringify(data, null, 2)}\n`,
  );
  console.log(
    `Wrote ${String(Object.keys(data.lessons).length)} legacy fingerprints from ${commit}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
