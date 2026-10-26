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
  colourBounds,
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

/** How much of Pip two Reactions' still versions must differ in. */
const STILLS_APART = 0.018;

/** The CLI's capture background when the scene draws none: opaque #1D1D1D. */
const CLI_BACKGROUND = [0x1d, 0x1d, 0x1d] as const;

class BuildError extends Error {}

function fail(message: string): never {
  throw new BuildError(message);
}

/** Runs the Rive CLI; returns its standard output, or its whole log with `log`. */
function rive(args: readonly string[], log = true): string {
  // `rive inspect --json` prints the whole resolved scene, well past
  // spawnSync's 1 MB default.
  const run = spawnSync("rive", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
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

// Marker colours for the parts the Celebration checks find: the hands in
// green, the ears in blue and the head's front face in magenta, colours Pip
// never draws.
const HAND_MARKER = [0, 255, 0] as const;
const EAR_MARKER = [0, 0, 255] as const;
const FACE_MARKER = [255, 0, 255] as const;

// A copy of a project with the hands, ears and the head's front face painted
// in marker colours, so a capture shows exactly where they are.
function withMarkers(rig: string, work: string): string {
  const dir = join(work, "rig-markers");
  cpSync(rig, dir, { recursive: true });
  const path = join(dir, "pip.rml");
  let text = readFileSync(path, "utf8");
  const paint = (block: RegExp, argb: string) => {
    let found = 0;
    text = text.replace(block, (part) => {
      found++;
      return part.replace(/colorValue="[0-9A-F]{8}"/g, `colorValue="${argb}"`);
    });
    if (found !== 2)
      fail(`the marker copy found ${String(found)} of ${String(block)}, not 2`);
  };
  paint(
    /<Shape\b[^>]*name="Hand (?:Left|Right)">[\s\S]*?<\/Shape>/g,
    "FF00FF00",
  );
  paint(
    /<Shape\b[^>]*name="Thumb (?:Left|Right)">[\s\S]*?<\/Shape>/g,
    "FF00FF00",
  );
  paint(/<Node name="Ear (?:Left|Right)">[\s\S]*?<\/Node>/g, "FF0000FF");
  // The front face's two colours, in the art and in the Turn's keys of them.
  const before = text;
  text = text.replace(
    /(<GradientStop colorValue=")[0-9A-F]{8}(" position="[^"]*" id="0:64[01]"\/>)/g,
    "$1FFFF00FF$2",
  );
  text = text.replace(
    /<KeyedObject objectId="0:64[01]">[\s\S]*?<\/KeyedObject>/g,
    (keys) => keys.replace(/value="[0-9A-F]{8}"/g, 'value="FFFF00FF"'),
  );
  if (text === before) fail("the marker copy found no front face to paint");
  writeFileSync(path, text);
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
    const full = shot({ [reaction]: "1" }, "450ms");
    if (!(topEdge(full) < topEdge(shot({}, "300ms")) - 4))
      fail(`${reaction} at full motion should lift Pip`);
  }
  // Celebration raises the arms up and out: at the top of the jump each fist
  // sits wholly above its ear (whose top is above the head's middle) and
  // outward of the ear's inner edge, the side of the head, at either
  // intensity.
  const marked = withMarkers(white, work);
  for (const intensity of ["0", "1"]) {
    const apex = capture(
      marked,
      work,
      px,
      { intensity, celebration: "1" },
      "550ms",
    );
    const half = Math.floor(px / 2);
    for (const [side, box] of [
      ["left", { top: 0, bottom: px - 1, left: 0, right: half - 1 }],
      ["right", { top: 0, bottom: px - 1, left: half, right: px - 1 }],
    ] as const) {
      const fist = colourBounds(apex, HAND_MARKER, box);
      const ear = colourBounds(apex, EAR_MARKER, box);
      if (!fist || !ear)
        fail(`Celebration's ${side} fist or ear is missing from the capture`);
      const centre = (fist.left + fist.right) / 2;
      const outward = side === "left" ? centre < ear.right : centre > ear.left;
      if (!(fist.bottom < ear.top) || !outward)
        fail(
          `Celebration at intensity ${intensity} must raise the ${side} fist above the ear and outside the head (fist rows ${String(fist.top)}-${String(fist.bottom)}, ear top ${String(ear.top)})`,
        );
    }
  }
  lines.push(
    "celebration: both fists rise above the ears and outside the head at the top of the jump",
  );
  // Then the landing: from the arms' swing down (frame 42, 700 ms) to past
  // the end, every other frame, neither fist ever crosses the head's front
  // face; the arms swing down round its sides.
  for (const intensity of ["0", "1"]) {
    for (let ms = 700; ms <= 1500; ms += 33) {
      const at = capture(
        marked,
        work,
        px,
        { intensity, celebration: "1" },
        `${String(ms)}ms`,
      );
      const face = colourBounds(at, FACE_MARKER);
      if (!face)
        fail(`Celebration's landing at ${String(ms)} ms shows no face`);
      const fist = colourBounds(at, HAND_MARKER, face);
      if (fist)
        fail(
          `Celebration at intensity ${intensity}, ${String(ms)} ms in: a fist crosses the head's front face (fist pixels in columns ${String(fist.left)}-${String(fist.right)}, rows ${String(fist.top)}-${String(fist.bottom)})`,
        );
    }
  }
  lines.push(
    "celebration: on the landing neither fist crosses the head's front face",
  );

  // Each Reaction's still version: an expression of its own, in place.
  const reactions = ["success", "retry", "celebration"] as const;
  const moments = ["300ms", "800ms"];
  const stills = moments.map((t) =>
    reactions.map((reaction) => {
      const still = shot({ reducedMotion: "true", [reaction]: "1" }, t);
      const idle = shot({ reducedMotion: "true" }, t);
      const drawn = drawnBounds(still);
      const rest = drawnBounds(idle);
      if (
        !drawn ||
        !rest ||
        Math.abs(drawn.top - rest.top) > 1 ||
        Math.abs(drawn.left - rest.left) > 1 ||
        Math.abs(drawn.right - rest.right) > 1
      )
        fail(`${reaction} under reduced motion must not move Pip`);
      if (t === moments[0] && changedShare(idle, still) < 0.001)
        fail(`${reaction} under reduced motion must still show an expression`);
      return still;
    }),
  );
  // Each pair, at whichever moment its two expressions differ most (300 ms,
  // as each one opens; 800 ms, as Retry's lids soften), measured over Pip
  // alone rather than the empty frame round him. The bar sits well above a
  // few pixels of cheek, so two stills drifting toward one look fail.
  const pip =
    drawnBounds(shot({ reducedMotion: "true" }, "300ms")) ??
    fail("Pip drew nothing under reduced motion");
  const apart: string[] = [];
  for (const [i, a] of reactions.entries())
    for (const [j, b] of reactions.entries()) {
      if (j <= i) continue;
      const most = Math.max(
        ...stills.map((at) => {
          const x = at[i];
          const y = at[j];
          return x && y ? changedShare(x, y, 8, pip) : 0;
        }),
      );
      if (most < STILLS_APART)
        fail(
          `${a} and ${b} under reduced motion differ in only ${fmtShare(most)} of Pip, under ${fmtShare(STILLS_APART)}; each must read differently`,
        );
      apart.push(`${a} and ${b} ${fmtShare(most)}`);
    }
  lines.push(
    `reduced motion: each Reaction shows its own expression with no travel, apart in ${apart.join(", ")} of Pip`,
  );

  // The head turn: gazeX turns the head, so the face's front plane slides
  // across and the silhouette changes, not the eyes alone.
  const ahead = shot({ mode: "rest" }, "500ms");
  const turned = shot({ mode: "rest", gazeX: "1" }, "500ms");
  const turn = changedShare(ahead, turned);
  if (turn < 0.05)
    fail(`gazeX 1 barely turns Pip's head (${fmtShare(turn)} of pixels)`);
  lines.push(`head turn: gazeX 1 changes ${fmtShare(turn)} of pixels`);
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
    for (const { file, pose, data, px } of allPosters()) {
      const { advance } = POSTER_POSES[pose];
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
    // Each short list of names on one line, as Prettier writes the file.
    const json = JSON.stringify(record, null, 2).replace(
      /\[\s+("[^"\n]*"(?:,\s+"[^"\n]*")*)\s+\]/g,
      (_, names: string) => `[${names.replace(/,\s+/g, ", ")}]`,
    );
    writeFileSync(join(PIP_DIR, RECORD), `${json}\n`);

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
