// `npm run pip:build`: rebuilds Pip from quest/client/pip/rig/ with the pinned
// Rive CLI, on a maintainer's machine only. CI never runs the CLI (a
// proprietary binary); it checks the outputs this writes against the record.
//
// It refuses unless `rive --version` is the pinned version, then works on a
// copy of the rig's sources (the files the record hashes) in a temporary
// folder, so nothing the CLI writes lands in them: `--verify` must report 0
// errors and 0 warnings and `rive inspect` no problems; `--once` builds the
// .riv; every trigger and mode is shown to move Pip, the gaze to point the way
// it should and reduced motion to keep Pip in place; the posters are rendered
// with `--screenshot`, `--data` and `--advance` and made transparent; and the
// record of the sources' hash, the poster spec and each output's hash is
// written last.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { PIP_MODES, PIP_REACTIONS } from "./contract.ts";
import {
  changedShare,
  decodePng,
  drawnBounds,
  encodePng,
  eyes,
  largestDifference,
  matte,
  over,
  type Rgba,
} from "./png.ts";
import { POSTER_POSES, allPosters, posterSpec } from "./posters.ts";
import {
  PIP_DIR,
  RECORD,
  RIG,
  RIVE_CLI_VERSION,
  RIV,
  canonical,
  expectedOutputs,
  fileDigest,
  rigDigest,
  rigSources,
  strayFiles,
  type BuildRecord,
} from "./record.ts";

/** The budgets the built app holds Pip to (spec, Performance budget). */
const RIV_BUDGET = 50 * 1024;
const POSTERS_BUDGET = 300 * 1024;

/** The CLI's capture background when the scene draws none: opaque #1D1D1D. */
const CLI_BACKGROUND = [0x1d, 0x1d, 0x1d] as const;

class BuildError extends Error {}

function fail(message: string): never {
  throw new BuildError(message);
}

/** Runs the Rive CLI; returns its standard output, or its whole log with `log`. */
function rive(args: readonly string[], log = true): string {
  const run = spawnSync("rive", args, { encoding: "utf8" });
  if (run.error) {
    fail(
      `Could not run the Rive CLI (${run.error.message}). pip:build runs on a maintainer's machine with the Rive CLI ${RIVE_CLI_VERSION} installed.`,
    );
  }
  const output = `${run.stdout}${run.stderr}`;
  if (run.status !== 0) fail(`rive ${args.join(" ")} failed:\n${output}`);
  return log ? output : run.stdout;
}

function requirePinnedCli(): void {
  const version = rive(["--version"]).trim();
  if (version !== `rive ${RIVE_CLI_VERSION}`) {
    fail(
      `pip:build is pinned to the Rive CLI ${RIVE_CLI_VERSION}, and this machine has "${version}". ` +
        "Build with the pinned version, or change RIVE_CLI_VERSION in quest/client/pip/record.ts on purpose.",
    );
  }
}

/** Runs --verify and returns the CLI's report line, refusing any error or warning. */
function verify(project: string): string {
  const output = rive([project, "--verify"]);
  const report = output
    .split("\n")
    .find((line) => /\bverified \(/.test(line))
    ?.trim();
  const counts = report?.match(/(\d+) errors?, (\d+) warnings?/);
  if (!report || !counts) fail(`--verify printed no report:\n${output}`);
  if (counts[1] !== "0" || counts[2] !== "0")
    fail(`--verify must report 0 errors and 0 warnings:\n${output}`);
  return report.replace(/^\[[\d:.]+\]\s+/, "");
}

function inspectProblems(project: string): void {
  const inspected = JSON.parse(rive(["inspect", project, "--json"], false)) as {
    problems?: unknown[];
  };
  if (!Array.isArray(inspected.problems))
    fail("rive inspect printed no problems list");
  if (inspected.problems.length > 0) {
    fail(
      `rive inspect reports problems:\n${JSON.stringify(inspected.problems, null, 2)}`,
    );
  }
}

// A copy of the project whose artboard draws a solid background, so a capture
// over black and one over white can be turned into a transparent poster.
function withBackground(rig: string, work: string, argb: string): string {
  const dir = join(work, `rig-${argb}`);
  cpSync(rig, dir, { recursive: true });
  const artboardFile = readdirSync(dir)
    .filter((name) => name.endsWith(".rml"))
    .find((name) =>
      readFileSync(join(dir, name), "utf8").includes("<Artboard"),
    );
  if (!artboardFile) fail("no .rml file in the rig declares the artboard");
  const path = join(dir, artboardFile);
  const text = readFileSync(path, "utf8");
  const tag = /<Artboard\b[^>]*>/.exec(text);
  if (!tag) fail(`${artboardFile} has no <Artboard> tag`);
  const at = tag.index + tag[0].length;
  writeFileSync(
    path,
    `${text.slice(0, at)}<Fill name="Poster Background"><SolidColor colorValue="${argb}"/></Fill>${text.slice(at)}`,
  );
  return dir;
}

let captures = 0;
function capture(
  project: string,
  work: string,
  px: number,
  data: Readonly<Record<string, string>>,
  advance: string,
): Rgba {
  const file = join(work, `capture-${String(captures++)}.png`);
  rive([
    project,
    `--screenshot=${file}`,
    `--viewport=${String(px)}x${String(px)}`,
    "--fit=contain",
    "--quiet",
    ...Object.entries(data).map(([k, v]) => `--data=${k}=${v}`),
    `--advance=${advance}`,
  ]);
  return decodePng(readFileSync(file));
}

// The centre of the eyes, over a white background.
function eyesCentre(image: Rgba): { x: number; y: number } {
  return eyes(image) ?? fail("found no eyes in the gaze capture");
}

// The top edge of everything drawn, over a white background.
function topEdge(image: Rgba): number {
  return drawnBounds(image)?.top ?? image.height;
}

/** Shows the rig does what the contract says, with the CLI's own renderer. */
function checkBehaviour(white: string, work: string): string[] {
  const px = 240;
  const lines: string[] = [];
  const shot = (data: Record<string, string>, advance: string) =>
    capture(white, work, px, data, advance);

  for (const reaction of PIP_REACTIONS) {
    const moved = Math.max(
      ...["300ms", "600ms"].map((t) =>
        changedShare(shot({}, t), shot({ [reaction]: "1" }, t)),
      ),
    );
    if (moved < 0.01)
      fail(
        `the ${reaction} trigger barely changes Pip (${fmtShare(moved)} of pixels)`,
      );
    lines.push(`${reaction}: moves ${fmtShare(moved)} of pixels`);
  }
  for (const mode of PIP_MODES.filter((m) => m !== "idle")) {
    const moved = changedShare(shot({}, "1s"), shot({ mode }, "1s"));
    lines.push(
      `mode ${mode}: accepted, ${fmtShare(moved)} of pixels differ from idle`,
    );
  }
  if (changedShare(shot({}, "1s"), shot({ mode: "thinking" }, "1s")) < 0.01)
    fail("mode thinking barely changes Pip");

  // Past the gaze's 220 ms ease.
  const right = eyesCentre(shot({ gazeX: "1" }, "500ms"));
  const left = eyesCentre(shot({ gazeX: "-1" }, "500ms"));
  const down = eyesCentre(shot({ gazeY: "1" }, "500ms"));
  const up = eyesCentre(shot({ gazeY: "-1" }, "500ms"));
  if (!(right.x > left.x + 2))
    fail(
      "gazeX 1 must turn Pip's eyes to the right of the screen, toward the content",
    );
  if (!(down.y > up.y + 2)) fail("gazeY 1 must turn Pip's eyes down");
  lines.push(
    `gaze: eyes move ${(right.x - left.x).toFixed(1)} px right and ${(down.y - up.y).toFixed(1)} px down across the range`,
  );

  for (const reaction of ["success", "retry", "celebration"] as const) {
    const blend = Math.max(
      ...["150ms", "300ms"].map((t) =>
        changedShare(
          shot({ intensity: "0", [reaction]: "1" }, t),
          shot({ intensity: "1", [reaction]: "1" }, t),
        ),
      ),
    );
    if (blend < 0.005)
      fail(
        `${reaction} at intensity 0 and 1 barely differ (${fmtShare(blend)} of pixels)`,
      );
    lines.push(
      `${reaction}: intensity 0 and 1 differ in ${fmtShare(blend)} of pixels`,
    );
  }

  for (const reaction of ["success", "celebration"] as const) {
    const still = shot({ reducedMotion: "true", [reaction]: "1" }, "300ms");
    const full = shot({ [reaction]: "1" }, "450ms");
    const idle = shot({}, "300ms");
    if (Math.abs(topEdge(still) - topEdge(idle)) > 1)
      fail(`${reaction} under reduced motion must not move Pip`);
    if (!(topEdge(full) < topEdge(idle) - 4))
      fail(`${reaction} at full motion should lift Pip`);
    if (changedShare(idle, still) < 0.001)
      fail(`${reaction} under reduced motion must still show an expression`);
  }
  lines.push(
    "reduced motion: Success and Celebration show an expression, with no travel",
  );
  return lines;
}

function fmtShare(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

function main(): void {
  requirePinnedCli();
  const stray = strayFiles(PIP_DIR);
  if (stray.length > 0)
    fail(`quest/client/pip/ breaks the Pip rules:\n${stray.join("\n")}`);

  const sourceRig = join(PIP_DIR, RIG);
  const sourceDigest = rigDigest(sourceRig);
  const work = mkdtempSync(join(tmpdir(), "pip-build-"));
  try {
    // The CLI compiles exactly the files the record hashes.
    const rig = join(work, "rig");
    for (const file of rigSources(sourceRig)) {
      mkdirSync(dirname(join(rig, file)), { recursive: true });
      cpSync(join(sourceRig, file), join(rig, file));
    }

    const report = verify(rig);
    inspectProblems(rig);
    rive([rig, "--once"]);
    const riv = readFileSync(join(rig, "build", "pip.riv"));
    if (riv.length > RIV_BUDGET)
      fail(
        `the .riv is ${String(riv.length)} bytes, over its ${String(RIV_BUDGET)}-byte budget`,
      );

    const black = withBackground(rig, work, "FF000000");
    const white = withBackground(rig, work, "FFFFFFFF");
    const behaviour = checkBehaviour(white, work);

    const posters = new Map<string, Buffer>();
    for (const { file, pose, px } of allPosters()) {
      const { data, advance } = POSTER_POSES[pose];
      const onBlack = capture(black, work, px, data, advance);
      const onWhite = capture(white, work, px, data, advance);
      const poster = matte(onBlack, onWhite);
      // The transparent poster over the CLI's own background must match the
      // CLI's own capture there, so the matte lost nothing.
      const direct = capture(rig, work, px, data, advance);
      const error = largestDifference(over(poster, CLI_BACKGROUND), direct);
      if (error > 3)
        fail(
          `${file}: the transparent poster is off by ${String(error)} levels`,
        );
      posters.set(file, encodePng(poster));
    }
    const postersBytes = [...posters.values()].reduce(
      (n, b) => n + b.length,
      0,
    );
    if (postersBytes > POSTERS_BUDGET)
      fail(
        `the posters are ${String(postersBytes)} bytes, over their ${String(POSTERS_BUDGET)}-byte budget`,
      );

    // The CLI must not have written into the sources it was given (it adds
    // missing ids to RML in some modes), and the sources must not have
    // changed while the build ran.
    if (rigDigest(rig) !== sourceDigest)
      fail(
        "the Rive CLI rewrote the rig's sources; give every element it touched an id, then build again",
      );
    if (rigDigest(sourceRig) !== sourceDigest)
      fail("the rig's sources changed during the build; build again");

    writeFileSync(join(PIP_DIR, RIV), riv);
    rmSync(join(PIP_DIR, "posters"), { recursive: true, force: true });
    mkdirSync(join(PIP_DIR, "posters"));
    for (const [file, png] of posters) writeFileSync(join(PIP_DIR, file), png);
    const record: BuildRecord = {
      rive: RIVE_CLI_VERSION,
      rig: sourceDigest,
      posters: canonical(posterSpec()),
      outputs: Object.fromEntries(
        expectedOutputs().map((file) => [
          file,
          fileDigest(join(PIP_DIR, file)),
        ]),
      ),
    };
    writeFileSync(
      join(PIP_DIR, RECORD),
      `${JSON.stringify(record, null, 2)}\n`,
    );

    console.log(`rive --verify: ${report}`);
    for (const line of behaviour) console.log(`checked ${line}`);
    console.log(
      `wrote ${RIV} (${String(riv.length)} bytes), ${String(posters.size)} posters (${String(postersBytes)} bytes) and ${RECORD}`,
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  if (!(error instanceof BuildError)) throw error;
  console.error(`pip:build: ${error.message}`);
  process.exitCode = 1;
}
