// `npm run pip:build`: rebuilds Pip from quest/client/pip/rig/ with the pinned
// Rive CLI, on a maintainer's machine only. CI never runs the CLI (a
// proprietary binary); it checks the outputs this writes against the record.
//
// It refuses unless Node is the major .nvmrc pins, its zlib re-encodes a
// committed poster to the same bytes (the posters' bytes depend on it) and
// `rive --version` is the pinned version, then works on a
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
  existsSync,
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
  type Bounds,
  type Rgba,
} from "./png.ts";
import { POSTER_POSES, allPosters, posterSpec } from "./posters.ts";
import {
  NVMRC,
  PIP_DIR,
  RECORD,
  RIG,
  RIVE_CLI_VERSION,
  RIV,
  canonical,
  expectedOutputs,
  fileDigest,
  encoderMismatch,
  nodeMismatch,
  rigDigest,
  rigSources,
  strayFiles,
  type BuildRecord,
} from "./record.ts";

/**
 * The budgets the built app holds Pip to (spec, Performance budget). The
 * .riv's is 64 KB (owner, 2026-10-29), raised from 50 KB for the board's
 * elements, the eye expressions and Sleep.
 */
const RIV_BUDGET = 64 * 1024;
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

function requirePinnedNode(): void {
  const problem = nodeMismatch(process.version, readFileSync(NVMRC, "utf8"));
  if (problem) fail(problem);
  const committed = allPosters()
    .map((poster) => join(PIP_DIR, poster.file))
    .find((file) => existsSync(file));
  const encoder = committed && encoderMismatch(readFileSync(committed));
  if (encoder) fail(encoder);
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

// Marker colours for the parts the checks find: the hands in green, the ears
// in blue, the head's front face in magenta, the eye bars in cyan and the
// board's elements round Pip in yellow, colours Pip never draws.
const HAND_MARKER = [0, 255, 0] as const;
const EAR_MARKER = [0, 0, 255] as const;
const FACE_MARKER = [255, 0, 255] as const;
const EYE_MARKER = [0, 255, 255] as const;
const ELEMENT_MARKER = [255, 255, 0] as const;

/**
 * The board's elements round Pip: the shapes each one draws, how many, and
 * when it shows. Each belongs to one Reaction or mode; `hold` is a moment it
 * is fully shown, `later` a moment after it in which it has visibly moved, and
 * `still` the two moments its reduced-motion version shows it, or "rest" for a
 * mode that holds Rest under reduced motion. `takeOff`, for an element that
 * bursts out as Pip leaves the floor, is the last moment in ms (after the
 * Reaction's 160 ms blend-in) before which it must not show at any
 * intensity. `place` is where it sits: above
 * the head's front face, beside the head's top (outside the face's columns, in
 * the head's upper half), out to the right of the pointing fist, or anywhere
 * round Pip inside the canvas.
 */
const ELEMENTS = [
  {
    name: 'Curious\'s "?"',
    shapes: "Question Mark",
    count: 1,
    data: { curious: "1" },
    hold: "600ms",
    later: "800ms",
    still: ["300ms", "700ms"],
    place: "above",
  },
  {
    name: "Greeting's crosses",
    shapes: "Cross Shape",
    count: 3,
    data: { greeting: "1" },
    hold: "500ms",
    later: "800ms",
    still: ["300ms", "700ms"],
    place: "above",
  },
  {
    name: "Explaining's pointer",
    shapes: "Pointer Stick|Pointer Tip|Pointer Spark",
    count: 3,
    data: { explaining: "1" },
    hold: "600ms",
    later: "750ms",
    still: ["300ms", "700ms"],
    place: "pointer",
  },
  {
    name: 'Thinking\'s "..."',
    shapes: "Dot Shape",
    count: 3,
    data: { mode: "thinking" },
    hold: "1s",
    later: "2200ms",
    still: "rest",
    place: "above",
  },
  {
    name: "Success's strokes",
    shapes: "Stroke Shape",
    count: 2,
    data: { intensity: "1", success: "1" },
    takeOff: 160,
    hold: "450ms",
    later: "750ms",
    still: ["300ms", "700ms"],
    place: "beside",
  },
  {
    name: "Retry's crosses",
    shapes: "Cheer Shape",
    count: 4,
    data: { intensity: "1", retry: "1" },
    hold: "650ms",
    later: "1000ms",
    still: ["600ms", "1000ms"],
    place: "beside",
  },
  {
    name: "Celebration's confetti",
    shapes: "Confetti Shape",
    count: 9,
    data: { intensity: "1", celebration: "1" },
    hold: "600ms",
    later: "1000ms",
    still: ["300ms", "700ms"],
    place: "around",
  },
  {
    name: 'Sleep\'s "z Z"',
    shapes: "Z Shape",
    count: 2,
    data: { mode: "sleep" },
    hold: "2s",
    later: "2500ms",
    still: "rest",
    place: "above",
  },
] as const;

// A copy of a project with the hands, ears, the head's front face, the eye
// bars and the board's elements (or only the one named) painted in marker
// colours, so a capture shows exactly where they are.
function withMarkers(
  rig: string,
  work: string,
  only?: { readonly shapes: string; readonly count: number },
): string {
  const dir = join(
    work,
    only
      ? `rig-markers-${only.shapes.replace(/[^A-Za-z]+/g, "-")}`
      : "rig-markers",
  );
  cpSync(rig, dir, { recursive: true });
  const path = join(dir, "pip.rml");
  let text = readFileSync(path, "utf8");
  const paint = (block: RegExp, argb: string, count = 2) => {
    let found = 0;
    text = text.replace(block, (part) => {
      found++;
      return part.replace(/colorValue="[0-9A-F]{8}"/g, `colorValue="${argb}"`);
    });
    if (found !== count)
      fail(
        `the marker copy found ${String(found)} of ${String(block)}, not ${String(count)}`,
      );
  };
  paint(
    /<Shape\b[^>]*name="Hand (?:Left|Right)">[\s\S]*?<\/Shape>/g,
    "FF00FF00",
  );
  paint(
    /<Shape\b[^>]*name="Thumb (?:Left|Right)">[\s\S]*?<\/Shape>/g,
    "FF00FF00",
  );
  paint(
    /<Node\b[^>]*name="Ear (?:Left|Right)"[^>]*>[\s\S]*?<\/Node>/g,
    "FF0000FF",
  );
  paint(
    /<Shape\b[^>]*name="Eye (?:Left|Right)">[\s\S]*?<\/Shape>/g,
    "FF00FFFF",
  );
  for (const element of only ? [only] : ELEMENTS)
    paint(
      new RegExp(
        `<Shape\\b[^>]*name="(?:${element.shapes})">[\\s\\S]*?<\\/Shape>`,
        "g",
      ),
      "FFFFFF00",
      element.count,
    );
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

// A copy of a project painted by withMarkers for one element alone, with that
// element painted black instead of yellow: the two differ only where the
// element draws, however faint or small it is.
function withElementInBlack(
  own: string,
  element: { readonly shapes: string },
): string {
  const dir = `${own}-black`;
  cpSync(own, dir, { recursive: true });
  const path = join(dir, "pip.rml");
  const text = readFileSync(path, "utf8");
  const painted = text.replace(
    new RegExp(
      `<Shape\\b[^>]*name="(?:${element.shapes})">[\\s\\S]*?<\\/Shape>`,
      "g",
    ),
    (part) => part.replaceAll('colorValue="FFFFFF00"', 'colorValue="FF000000"'),
  );
  if (painted === text)
    fail(`the black copy found no ${element.shapes} to paint`);
  writeFileSync(path, painted);
  return dir;
}

// A copy of the marker project whose Blink timeline blinks once at frame 30
// (500 ms) instead of first at 3 s, so a blink lands inside a Reaction and
// shows whether the Blink layer still closes the eyes over its expression.
function withEarlyBlink(marked: string, work: string): string {
  const dir = join(work, "rig-early-blink");
  cpSync(marked, dir, { recursive: true });
  const path = join(dir, "pip.rml");
  const text = readFileSync(path, "utf8");
  const blink =
    /(<LinearAnimation\b[^>]*name="Blink"[^>]*>\s*<KeyedObject objectId="0:121">[^\n]*\n\s*<KeyedProperty property="scaleY">)[\s\S]*?(<\/KeyedProperty>)/;
  if (!blink.test(text)) fail("the early-blink copy found no Blink timeline");
  writeFileSync(
    path,
    text.replace(
      blink,
      '$1<KeyFrameDouble value="1" frame="26" interpolationType="linear"/><KeyFrameDouble value="0.08" frame="30" interpolationType="linear"/><KeyFrameDouble value="1" frame="36"/>$2',
    ),
  );
  return dir;
}

// A copy of the marker project whose Explaining holds the head straight ahead
// (its Turn Lead keys at rest, the gaze alone turning the head), so a capture
// shows what the eyes do on their own.
function withoutExplainingTurn(marked: string, work: string): string {
  const dir = join(work, "rig-unturned");
  cpSync(marked, dir, { recursive: true });
  const path = join(dir, "pip.rml");
  const text = readFileSync(path, "utf8");
  const turn =
    /(<LinearAnimation\b[^>]*name="Explaining"[^>]*>[\s\S]*?)<KeyedObject objectId="0:716">[\s\S]*?<\/KeyedObject>/;
  if (!turn.test(text))
    fail("the unturned copy found no Turn Lead keys in Explaining");
  writeFileSync(
    path,
    text.replace(
      turn,
      '$1<KeyedObject objectId="0:716"><KeyedProperty property="x"><KeyFrameDouble value="0" frame="0"/></KeyedProperty><KeyedProperty property="scaleX"><KeyFrameDouble value="1" frame="0"/></KeyedProperty></KeyedObject>',
    ),
  );
  return dir;
}

// A copy of a project whose Body layer starts asleep and wakes by itself at
// the end of Sleep's first loop (4 s), getting up through Wake, and whose Idle
// never goes back to sleep, so a run with mode sleep captures the wake: the CLI sets the view
// model only before the scene runs.
function withWakeAt4s(rig: string, work: string): string {
  const dir = join(work, "rig-wake");
  cpSync(rig, dir, { recursive: true });
  const path = join(dir, "pip.rml");
  let text = readFileSync(path, "utf8");
  const wake =
    /(<AnimationState\b[^>]*id="0:424"[^>]*>[^\n]*\n\s*<StateTransition stateToId="0:425"[^>]*?)(>)(?:\s*<TransitionViewModelCondition\b[^>]*>[\s\S]*?<\/TransitionViewModelCondition>)+\s*(<\/StateTransition>)/;
  const fallAsleep =
    /(<AnimationState\b[^>]*id="0:12"[^>]*>[\s\S]*?)<StateTransition stateToId="0:424"[\s\S]*?<\/StateTransition>/;
  const entry =
    /(<EntryState\b[^>]*>\s*<StateTransition stateToId=")0:12("\/>)/;
  if (!wake.test(text) || !fallAsleep.test(text) || !entry.test(text))
    fail(
      "the wake copy found no Body entry, Sleep to Wake or Idle to Sleep transition",
    );
  // The Body layer's entry comes first; the Blink layer's enters 0:14.
  text = text.replace(entry, "$10:424$2");
  text = text.replace(
    wake,
    '$1 enableExitTime="true" exitTimeIsPercetange="true" exitTime="100"$2$3',
  );
  writeFileSync(path, text.replace(fallAsleep, "$1"));
  return dir;
}

/**
 * Every Body timeline keys the whole rest pose: each property Rest keys
 * (every part's place, the draw rules and each element group's opacity), so
 * any state blends back to it without a jump. Returns the gaps.
 */
function restPoseGaps(rml: string): string[] {
  const timelines = [
    ...rml.matchAll(
      /<LinearAnimation\b[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/LinearAnimation>/g,
    ),
  ];
  const keyed = (body: string) =>
    new Set(
      [
        ...body.matchAll(
          /<KeyedObject objectId="([^"]+)">([\s\S]*?)<\/KeyedObject>/g,
        ),
      ].flatMap(([, id, keys]) =>
        [...(keys ?? "").matchAll(/<KeyedProperty property="([^"]+)">/g)].map(
          ([, property]) => `${id ?? ""} ${property ?? ""}`,
        ),
      ),
    );
  const rest = timelines.find(([, name]) => name === "Rest");
  if (!rest) return ["no Rest timeline"];
  const pose = keyed(rest[2] ?? "");
  const notBody = new Set(["Blink", "Eyes Open", "Cock", "Turn", "Pitch"]);
  return timelines
    .filter(([, name]) => !notBody.has(name ?? ""))
    .flatMap(([, name, body]) => {
      const has = keyed(body ?? "");
      return [...pose]
        .filter((key) => !has.has(key))
        .map((key) => `${name ?? ""} does not key ${key}`);
    });
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

  // Sleep: Pip lies down, his head on the floor, so the top of his face
  // drops by more than a tenth of the canvas; he wakes smoothly, the face
  // rising over many frames with no step more than a quarter of the way.
  const marked = withMarkers(white, work);
  const faceTop = (project: string, data: Record<string, string>, t: string) =>
    colourBounds(capture(project, work, px, data, t), FACE_MARKER)?.top ??
    fail(`the face is missing in ${JSON.stringify(data)} at ${t}`);
  const standing = faceTop(marked, {}, "1s");
  const lying = faceTop(marked, { mode: "sleep" }, "2s");
  if (!(lying > standing + px * 0.1))
    fail(
      `Sleep must lie Pip down (face top at ${String(lying)} px; standing ${String(standing)} px)`,
    );
  const waking = withWakeAt4s(marked, work);
  const tops: number[] = [];
  for (let ms = 3900; ms <= 4900; ms += 33)
    tops.push(faceTop(waking, { mode: "sleep" }, `${String(ms)}ms`));
  const first = tops[0] ?? 0;
  const last = tops[tops.length - 1] ?? 0;
  const travel = first - last;
  const steepest = Math.max(
    ...tops.slice(1).map((top, i) => Math.abs(top - (tops[i] ?? top))),
  );
  if (!(travel > px * 0.1) || !(steepest <= travel * 0.25))
    fail(
      `Pip must wake from Sleep smoothly (his top rises ${String(travel)} px, at most ${String(steepest)} px in one 33 ms step)`,
    );
  lines.push(
    `sleep: Pip lies down (his face's top ${String(lying - standing)} px lower) and wakes over many frames (at most ${String(steepest)} of ${String(travel)} px in one 33 ms step)`,
  );

  // Past the gaze's 150 ms ease.
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
  // face; the arms come down behind the head and the ears.
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

  const half = Math.floor(px / 2);
  const rightHalf = { top: 0, bottom: px - 1, left: half, right: px - 1 };
  const wave = capture(marked, work, px, { greeting: "1" }, "450ms");
  const wavingFist = colourBounds(wave, HAND_MARKER, rightHalf);
  const wavingEar = colourBounds(wave, EAR_MARKER, rightHalf);
  if (!wavingFist || !wavingEar)
    fail("Greeting's waving fist or ear is missing from the capture");
  if (
    wavingFist.bottom >= wavingEar.top ||
    (wavingFist.left + wavingFist.right) / 2 <= wavingEar.left
  )
    fail(
      `Greeting must raise its waving fist above and outside the ear (fist columns ${String(wavingFist.left)}-${String(wavingFist.right)}, rows ${String(wavingFist.top)}-${String(wavingFist.bottom)}; ear columns ${String(wavingEar.left)}-${String(wavingEar.right)}, rows ${String(wavingEar.top)}-${String(wavingEar.bottom)})`,
    );
  lines.push("greeting: the waving fist rises above and outside the ear");
  // From the raise to the lowering, every other frame, the fist never paints
  // over the ear's face, inset past its rounded corners, where the fist may
  // show beside it. The waving arm stays behind the ear the whole time; the
  // pointing arm lifts out under it, at gaze 0 (centred at hero size) and at
  // the resting 0.4 beside the content alike. Celebration lifts and lowers
  // both arms behind the head and the ears, so it is checked on both sides,
  // every frame, and a fist that shows wholly below its ear's top never reaches
  // out past the ear's outer edge (the arm's long horizontal stick) by more
  // than a third of a fist, the edge it peeks round as it rises behind the ear.
  const leftHalf = { top: 0, bottom: px - 1, left: 0, right: half - 1 };
  const peek = Math.round(px * 0.025);
  const clearsEar = (
    reaction: string,
    gazeX: string,
    until: number,
    { both = false, step = 33 } = {},
  ): void => {
    for (let ms = 0; ms <= until; ms += step) {
      const at = capture(
        marked,
        work,
        px,
        { gazeX, [reaction]: "1" },
        `${String(ms)}ms`,
      );
      for (const [side, box] of both
        ? ([
            ["left", leftHalf],
            ["right", rightHalf],
          ] as const)
        : ([["right", rightHalf]] as const)) {
        const ear = colourBounds(at, EAR_MARKER, box);
        if (!ear) fail(`${reaction} at ${String(ms)} ms shows no ${side} ear`);
        const face = {
          top: ear.top + 4,
          bottom: ear.bottom - 4,
          left: ear.left + 4,
          right: ear.right - 4,
        };
        const fist =
          face.left <= face.right && face.top <= face.bottom
            ? colourBounds(at, HAND_MARKER, face)
            : null;
        if (fist)
          fail(
            `${reaction} at gazeX ${gazeX}, ${String(ms)} ms in: the ${side} fist paints over the ear (fist pixels in columns ${String(fist.left)}-${String(fist.right)}, rows ${String(fist.top)}-${String(fist.bottom)})`,
          );
        const element =
          face.left <= face.right && face.top <= face.bottom
            ? colourBounds(at, ELEMENT_MARKER, face)
            : null;
        if (element)
          fail(
            `${reaction} at gazeX ${gazeX}, ${String(ms)} ms in: its board element paints over the ${side} ear (columns ${String(element.left)}-${String(element.right)}, rows ${String(element.top)}-${String(element.bottom)})`,
          );
        if (!both) continue;
        const shown = colourBounds(at, HAND_MARKER, box);
        if (
          shown &&
          shown.top > ear.top &&
          (side === "left"
            ? shown.left < ear.left - peek
            : shown.right > ear.right + peek)
        )
          fail(
            `${reaction} at gazeX ${gazeX}, ${String(ms)} ms in: the ${side} fist reaches out past the ear below its top, a long arm (fist columns ${String(shown.left)}-${String(shown.right)}, rows ${String(shown.top)}-${String(shown.bottom)}; ear columns ${String(ear.left)}-${String(ear.right)}, top ${String(ear.top)})`,
          );
      }
    }
  };
  for (const gazeX of ["0", "0.4"]) clearsEar("greeting", gazeX, 1200);
  lines.push(
    "greeting: at gazeX 0 and 0.4 the waving fist never paints over the ear",
  );
  // The wave lowers as gently as it rose: from the end of the wave to past the
  // settle, every 17 ms, the waving fist's centre never travels faster than
  // 0.0033 of the canvas per millisecond between two moments it shows,
  // across the stretch it is hidden behind the ear as well. The previous rig,
  // which dropped it from beside the head to the hip in about 80 ms, moves it
  // 0.0037 at gazeX 0.
  const lowering: string[] = [];
  for (const gazeX of ["0", "0.4"]) {
    let seen: { ms: number; x: number; y: number } | null = null;
    let fastest = 0;
    for (let ms = 833; ms <= 1250; ms += 17) {
      const fist = colourBounds(
        capture(marked, work, px, { gazeX, greeting: "1" }, `${String(ms)}ms`),
        HAND_MARKER,
        rightHalf,
      );
      if (!fist) continue;
      const at = {
        ms,
        x: (fist.left + fist.right) / 2,
        y: (fist.top + fist.bottom) / 2,
      };
      if (seen) {
        const speed =
          Math.hypot(at.x - seen.x, at.y - seen.y) / (ms - seen.ms) / px;
        fastest = Math.max(fastest, speed);
        if (speed > 0.0033)
          fail(
            `Greeting at gazeX ${gazeX}: the waving fist drops too fast between ${String(seen.ms)} and ${String(ms)} ms (${speed.toFixed(4)} of the canvas per ms, bar 0.0033)`,
          );
      }
      seen = at;
    }
    lowering.push(`${gazeX} ${fastest.toFixed(4)}`);
  }
  lines.push(
    `greeting: the wave lowers gently, the fist's fastest move per ms as a share of the canvas at gazeX ${lowering.join(", ")}`,
  );
  for (const gazeX of ["0", "0.4"]) clearsEar("explaining", gazeX, 1600);
  lines.push(
    "explaining: at gazeX 0 and 0.4 neither the pointing fist nor the pointer paints over the ear",
  );
  for (const gazeX of ["0", "0.4"])
    clearsEar("celebration", gazeX, 1500, { both: true, step: 17 });
  lines.push(
    "celebration: at gazeX 0 and 0.4, every frame, neither fist paints over an ear or reaches out past it below its top",
  );
  // Success throws the arms up and out, the board's Happy: at the top of the
  // jump each fist sits above the shoulder line (the resting shoulder, art
  // (290, 590), lifted as far as the face rose) and outside the head's
  // silhouette, its centre out past the ear's outer edge and none of it on the
  // face. It stays at the ear's top corner, its bottom below the ear's top,
  // where Celebration's fists rise wholly above the ears. Both arms are drawn
  // behind the head and the ears, as in Celebration, and are checked the same
  // way, every frame: neither fist paints over an ear or reaches out past it
  // below its top.
  {
    const restShoulder = (305 / 400) * px;
    const where = (b: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    }) =>
      `columns ${String(b.left)}-${String(b.right)}, rows ${String(b.top)}-${String(b.bottom)}`;
    const restFace =
      colourBounds(capture(marked, work, px, {}, "300ms"), FACE_MARKER) ??
      fail("the face is missing from the capture");
    for (const gazeX of ["0", "0.4"])
      for (const t of ["450ms", "550ms"]) {
        const peak = capture(
          marked,
          work,
          px,
          { gazeX, intensity: "1", success: "1" },
          t,
        );
        const face =
          colourBounds(peak, FACE_MARKER) ??
          fail("the face is missing from the capture");
        const shoulderLine = restShoulder - (restFace.top - face.top);
        for (const [side, box] of [
          ["left", leftHalf],
          ["right", rightHalf],
        ] as const) {
          const fist = colourBounds(peak, HAND_MARKER, box);
          const ear = colourBounds(peak, EAR_MARKER, box);
          if (!fist || !ear)
            fail(`Success's ${side} fist or ear is missing at ${t}`);
          const middle = (fist.left + fist.right) / 2;
          const outside =
            side === "left" ? middle < ear.left : middle > ear.right;
          if (
            !(fist.bottom < shoulderLine) ||
            !outside ||
            colourBounds(peak, HAND_MARKER, face) ||
            !(fist.bottom > ear.top)
          )
            fail(
              `Success at gazeX ${gazeX}, ${t} in: the ${side} fist must sit above the shoulder line (row ${shoulderLine.toFixed(0)}), outside the head and at the ear's top corner, not above it (fist ${where(fist)}; ear ${where(ear)}; face ${where(face)})`,
            );
        }
      }
  }
  for (const gazeX of ["0", "0.4"])
    clearsEar("success", gazeX, 1100, { both: true, step: 17 });
  lines.push(
    "success: at the top of the jump both fists are above the shoulders, outside the head and at the ears' top corners (below Celebration's); at gazeX 0 and 0.4, every frame, neither fist paints over an ear or reaches out past it below its top",
  );

  // Explaining points: at the hold the fist is out to the right and raised,
  // and at every frame the arm stays short, its fist within 1.75 times the
  // resting distance from the shoulder (art (290, 590), on the artboard
  // (248, 305)), so it never becomes a long thin stick.
  const shoulder = { x: (248 / 400) * px, y: (305 / 400) * px };
  const centre = (b: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }) => ({
    x: (b.left + b.right) / 2,
    y: (b.top + b.bottom) / 2,
  });
  const restFist =
    colourBounds(
      capture(marked, work, px, {}, "300ms"),
      HAND_MARKER,
      rightHalf,
    ) ?? fail("the resting fist is missing from the capture");
  const rest = centre(restFist);
  const restReach = Math.hypot(rest.x - shoulder.x, rest.y - shoulder.y);
  for (const gazeX of ["0", "0.4"]) {
    const held = colourBounds(
      capture(marked, work, px, { gazeX, explaining: "1" }, "450ms"),
      HAND_MARKER,
      rightHalf,
    );
    if (!held) fail("Explaining's pointing fist is missing from the capture");
    const at = centre(held);
    if (!(at.x > rest.x + px * 0.05 && at.y < rest.y - px * 0.02))
      fail(
        `Explaining at gazeX ${gazeX} must lift the fist out to the right, toward the hint (fist centre ${at.x.toFixed(1)}, ${at.y.toFixed(1)}; at rest ${rest.x.toFixed(1)}, ${rest.y.toFixed(1)})`,
      );
    for (let ms = 0; ms <= 1600; ms += 33) {
      const fist = colourBounds(
        capture(
          marked,
          work,
          px,
          { gazeX, explaining: "1" },
          `${String(ms)}ms`,
        ),
        HAND_MARKER,
        rightHalf,
      );
      if (!fist) continue;
      const c = centre(fist);
      const reach = Math.hypot(c.x - shoulder.x, c.y - shoulder.y);
      if (reach > restReach * 1.75)
        fail(
          `Explaining at gazeX ${gazeX}, ${String(ms)} ms in: the arm reaches ${(reach / restReach).toFixed(2)} times its resting length, a long thin arm (at most 1.75)`,
        );
    }
  }
  lines.push(
    "explaining: the fist lifts out toward the hint and the arm stays short",
  );

  // Explaining turns the head toward the hint on its own, blended with the
  // gaze: from gazeX 0 it turns at least as far as gazeX 0.3 does, and from the
  // resting 0.4 no further than gazeX 0.7 does.
  const faceX = (data: Record<string, string>) =>
    centre(
      colourBounds(capture(marked, work, px, data, "600ms"), FACE_MARKER) ??
        fail("the face is missing from the capture"),
    ).x;
  const fromAhead = faceX({ gazeX: "0", explaining: "1" });
  const fromResting = faceX({ gazeX: "0.4", explaining: "1" });
  const least = faceX({ gazeX: "0.3" });
  const most = faceX({ gazeX: "0.7" });
  if (!(fromAhead >= least))
    fail(
      `Explaining at gazeX 0 must turn the head toward the hint (face centre ${fromAhead.toFixed(1)}, gazeX 0.3 turns it to ${least.toFixed(1)})`,
    );
  if (!(fromResting <= most))
    fail(
      `Explaining at gazeX 0.4 turns the head too far (face centre ${fromResting.toFixed(1)}, gazeX 0.7 turns it to ${most.toFixed(1)})`,
    );
  lines.push(
    "explaining: the head turns toward the hint on its own, blended with the gaze",
  );

  // Curious cocks the head toward the side it turned to: the face's top edge
  // drops on the target's side, against the same gaze with no Reaction.
  const tilt = (data: Record<string, string>): number => {
    const image = capture(marked, work, px, data, "600ms");
    const face =
      colourBounds(image, FACE_MARKER) ??
      fail("the face is missing from the capture");
    const width = face.right - face.left;
    const topAt = (x: number): number => {
      const column = colourBounds(image, FACE_MARKER, {
        top: 0,
        bottom: px - 1,
        left: x,
        right: x,
      });
      return column?.top ?? fail("the face has a gap in the capture");
    };
    const left = face.left + Math.floor(width / 4);
    const right = face.right - Math.floor(width / 4);
    // Positive when the face's right side is lower.
    return (topAt(right) - topAt(left)) / (right - left);
  };
  for (const [gazeX, side] of [
    ["-1", -1],
    ["0", 1],
    ["1", 1],
  ] as const) {
    const cock = tilt({ gazeX, curious: "1" }) - tilt({ gazeX });
    if (!(cock * side > 0.06))
      fail(
        `Curious at gazeX ${gazeX} must cock the head toward that side (the face's top edge slopes ${cock.toFixed(3)} against no Reaction)`,
      );
  }
  lines.push(
    "curious: the head cocks toward the side it turned to, both ways, and toward the content's side straight ahead",
  );

  // The board's elements: each shows only in its own Reaction or mode, from
  // soon after it starts until it ends, moving while it shows, inside the
  // canvas at every gaze and in its place round the head; under reduced
  // motion a Reaction's Still shows it in place, and a mode holds Rest, which
  // shows none. Each is painted alone in a copy of its own, so a capture
  // shows that element and no other.
  const box = (b: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }) =>
    `columns ${String(b.left)}-${String(b.right)}, rows ${String(b.top)}-${String(b.bottom)}`;
  const elsewhere: [string, Record<string, string>, string][] = [
    ["idle", {}, "300ms"],
    ["rest", { mode: "rest" }, "1s"],
    ["thinking", { mode: "thinking" }, "1s"],
    ["sleep", { mode: "sleep" }, "2s"],
    ["success", { intensity: "1", success: "1" }, "450ms"],
    ["retry", { intensity: "1", retry: "1" }, "650ms"],
    ["celebration", { intensity: "1", celebration: "1" }, "600ms"],
    ["greeting", { greeting: "1" }, "500ms"],
    ["curious", { curious: "1" }, "600ms"],
    ["explaining", { explaining: "1" }, "600ms"],
  ];
  const yellow = (image: Rgba) => {
    let n = 0;
    for (let i = 0; i < image.data.length; i += 4)
      if (
        (image.data[i] ?? 0) > 231 &&
        (image.data[i + 1] ?? 0) > 231 &&
        (image.data[i + 2] ?? 255) < 24
      )
        n++;
    return n;
  };
  for (const element of ELEMENTS) {
    const own = withMarkers(white, work, element);
    const at = (data: Record<string, string>, t: string) =>
      capture(own, work, px, data, t);
    const owner = JSON.stringify(element.data);
    for (const [name, data, t] of elsewhere) {
      if (JSON.stringify(data) === owner) continue;
      const seen = colourBounds(at(data, t), ELEMENT_MARKER);
      if (seen)
        fail(
          `${element.name} shows in ${name} at ${t}, where it does not belong (${box(seen)})`,
        );
    }
    if (!("mode" in element.data)) {
      if (colourBounds(at(element.data, "33ms"), ELEMENT_MARKER))
        fail(`${element.name} shows before its Reaction starts it`);
      if (colourBounds(at(element.data, "2500ms"), ELEMENT_MARKER))
        fail(`${element.name} stays after its Reaction ends`);
    }
    // An element that bursts out at take-off shows in no frame before it, at
    // either end of the intensity blend, through the blend-in from Idle too.
    // Painting it another colour changes no pixel while it is hidden, so even
    // a faint or tiny trace of it (half-mixed in as the Reaction blends in)
    // shows as a difference between the two.
    if ("takeOff" in element) {
      const black = withElementInBlack(own, element);
      for (const intensity of ["0", "1"])
        for (let ms = 16; ms <= element.takeOff; ms += 16) {
          const data = { ...element.data, intensity };
          const t = `${String(ms)}ms`;
          const trace = largestDifference(
            at(data, t),
            capture(black, work, px, data, t),
          );
          if (trace > 4)
            fail(
              `${element.name} shows at intensity ${intensity}, ${String(ms)} ms in, before take-off (a channel differs by ${String(trace)})`,
            );
        }
    }
    const held = at(element.data, element.hold);
    const later = at(element.data, element.later);
    const shownHeld =
      colourBounds(held, ELEMENT_MARKER) ??
      fail(`${element.name} is missing at ${element.hold}`);
    const shownLater =
      colourBounds(later, ELEMENT_MARKER) ??
      fail(`${element.name} is missing at ${element.later}`);
    const sameBox =
      shownHeld.left === shownLater.left &&
      shownHeld.right === shownLater.right &&
      shownHeld.top === shownLater.top &&
      shownHeld.bottom === shownLater.bottom;
    if (sameBox && Math.abs(yellow(held) - yellow(later)) < 4)
      fail(
        `${element.name} holds still from ${element.hold} to ${element.later}; it must move while it shows`,
      );
    for (const gazeX of ["-1", "0", "0.4", "1"]) {
      const image = at({ ...element.data, gazeX }, element.hold);
      const shown =
        colourBounds(image, ELEMENT_MARKER) ??
        fail(`${element.name} at gazeX ${gazeX} is missing at ${element.hold}`);
      // At least 1.5% of the canvas from each edge: the contract test's
      // margin of 2 px at the hero size's 208.
      const edge = Math.ceil(px * 0.015);
      if (
        shown.left < edge ||
        shown.top < edge ||
        shown.right > px - 1 - edge ||
        shown.bottom > px - 1 - edge
      )
        fail(
          `${element.name} at gazeX ${gazeX} leaves the canvas or comes within ${String(edge)} px of its edge (${box(shown)})`,
        );
      const face =
        colourBounds(image, FACE_MARKER) ??
        fail("the face is missing from the capture");
      if (element.place === "above" && !(shown.bottom < face.top))
        fail(
          `${element.name} at gazeX ${gazeX} must sit above the head (${box(shown)}; face top ${String(face.top)})`,
        );
      if (element.place === "beside") {
        const middle = Math.floor((face.top + face.bottom) / 2);
        const left = colourBounds(image, ELEMENT_MARKER, {
          ...shown,
          right: Math.floor(px / 2),
        });
        const right = colourBounds(image, ELEMENT_MARKER, {
          ...shown,
          left: Math.floor(px / 2) + 1,
        });
        if (
          !left ||
          !right ||
          !(shown.bottom < middle) ||
          !(left.left < face.left) ||
          !(right.right > face.right)
        )
          fail(
            `${element.name} at gazeX ${gazeX} must sit beside the head's top on both sides (${box(shown)}; face ${box(face)})`,
          );
      }
      if (element.place === "pointer") {
        const fist =
          colourBounds(image, HAND_MARKER, rightHalf) ??
          fail("Explaining's pointing fist is missing from the capture");
        if (
          !(shown.right > fist.right + px * 0.04) ||
          !(shown.right > face.right + px * 0.04) ||
          !(shown.left >= fist.left)
        )
          fail(
            `Explaining at gazeX ${gazeX}: the pointer must reach out to the right of the fist and the face (${box(shown)}; fist ${box(fist)})`,
          );
      }
    }
    if (element.still === "rest") {
      const rest = shot({ mode: "rest", reducedMotion: "true" }, "1s");
      for (const t of ["300ms", "1s"]) {
        const image = at({ ...element.data, reducedMotion: "true" }, t);
        if (colourBounds(image, ELEMENT_MARKER))
          fail(`${element.name} shows under reduced motion at ${t}`);
      }
      const held = shot({ ...element.data, reducedMotion: "true" }, "1s");
      if (changedShare(rest, held) > 0.002)
        fail(
          `${owner} under reduced motion must hold Rest (${fmtShare(changedShare(rest, held))} of pixels differ)`,
        );
    } else {
      const [a, b] = element.still.map(
        (t) =>
          colourBounds(
            at({ ...element.data, reducedMotion: "true" }, t),
            ELEMENT_MARKER,
          ) ?? fail(`${element.name} under reduced motion is missing at ${t}`),
      );
      if (!a || !b) fail(`${element.name} under reduced motion: no stills`);
      if (
        Math.abs(a.left - b.left) > 1 ||
        Math.abs(a.right - b.right) > 1 ||
        Math.abs(a.top - b.top) > 1 ||
        Math.abs(a.bottom - b.bottom) > 1
      )
        fail(
          `${element.name} moves under reduced motion (${box(a)}, then ${box(b)})`,
        );
    }
  }
  // Explaining's pointer is the state's main cue, so it must read at the
  // beside size: at 76 px the stick paints at least 2 px across along its
  // length, and the spark strokes reach out past its end.
  {
    const small = 76;
    const stickOnly = withMarkers(white, work, {
      shapes: "Pointer Stick",
      count: 1,
    });
    const sparksOnly = withMarkers(white, work, {
      shapes: "Pointer Spark",
      count: 1,
    });
    // At least half covered by the marker yellow over the white background.
    const isMarker = (image: Rgba, x: number, y: number) => {
      const i = (y * image.width + x) * 4;
      return (
        (image.data[i] ?? 0) > 200 &&
        (image.data[i + 1] ?? 0) > 200 &&
        (image.data[i + 2] ?? 255) < 128
      );
    };
    // The box round the pixels at least half covered.
    const covered = (image: Rgba): Bounds | null => {
      let found: Bounds | null = null;
      for (let y = 0; y < image.height; y++)
        for (let x = 0; x < image.width; x++) {
          if (!isMarker(image, x, y)) continue;
          if (!found) found = { top: y, bottom: y, left: x, right: x };
          found.top = Math.min(found.top, y);
          found.bottom = y;
          found.left = Math.min(found.left, x);
          found.right = Math.max(found.right, x);
        }
      return found;
    };
    for (const gazeX of ["0", "0.4"]) {
      const data = { explaining: "1", gazeX };
      const image = capture(stickOnly, work, small, data, "600ms");
      const stick =
        covered(image) ??
        fail(`Explaining's stick is missing at ${String(small)} px`);
      const widths: number[] = [];
      for (let x = stick.left; x <= stick.right; x++) {
        let n = 0;
        for (let y = stick.top; y <= stick.bottom; y++)
          if (isMarker(image, x, y)) n++;
        if (n > 0) widths.push(n);
      }
      widths.sort((a, b) => a - b);
      const width = widths[Math.floor(widths.length / 2)] ?? 0;
      if (widths.length < 4 || width < 2)
        fail(
          `Explaining at gazeX ${gazeX}: the pointer stick must paint at least 2 px across (half covered or more) over at least 4 columns at ${String(small)} px (median ${String(width)} px over ${String(widths.length)} columns)`,
        );
      const sparks =
        covered(capture(sparksOnly, work, small, data, "600ms")) ??
        fail(`Explaining's spark strokes vanish at ${String(small)} px`);
      if (!(sparks.right > stick.right + 2) || sparks.bottom - sparks.top < 5)
        fail(
          `Explaining at gazeX ${gazeX}: the spark strokes must reach past the stick's end and span at least 6 px at ${String(small)} px (${box(sparks)}; stick ${box(stick)})`,
        );
    }
  }
  lines.push(
    `elements: ${ELEMENTS.map((e) => e.name).join(", ")} each show only in their own Reaction or mode (Success's strokes in no frame before take-off, 160 ms, at intensity 0 or 1), move while they show, stay inside the canvas at gazeX -1, 0, 0.4 and 1 in their place round the head, and hold still under reduced motion (Thinking and Sleep hold Rest there); at 76 px the pointer stick paints at least 2 px across and its strokes reach past it`,
  );

  // The eyes carry each emotion: the eye bars' size and place against Idle's,
  // in full motion and under reduced motion (an expression, not travel).
  const bars = (project: string, data: Record<string, string>, t: string) => {
    const image = capture(project, work, px, data, t);
    const both =
      colourBounds(image, EYE_MARKER) ??
      fail(`no eye bars in ${JSON.stringify(data)} at ${t}`);
    const mid = Math.floor((both.left + both.right) / 2);
    const side = (left: number, right: number) => {
      const b = colourBounds(image, EYE_MARKER, {
        top: 0,
        bottom: px - 1,
        left,
        right,
      });
      return b ? b.bottom - b.top + 1 : 0;
    };
    return {
      both,
      tallest: Math.max(side(both.left, mid), side(mid + 1, both.right)),
    };
  };
  const idleBars = bars(marked, {}, "300ms");
  const height = idleBars.tallest;
  const expressions: [
    string,
    Record<string, string>,
    string,
    "shorter" | "taller",
    number,
  ][] = [
    ["success", { intensity: "1", success: "1" }, "450ms", "shorter", 0.86],
    [
      "celebration",
      { intensity: "1", celebration: "1" },
      "550ms",
      "shorter",
      0.86,
    ],
    ["greeting", { greeting: "1" }, "500ms", "shorter", 0.5],
    ["retry", { intensity: "1", retry: "1" }, "700ms", "shorter", 0.95],
    [
      "retry's surprise",
      { intensity: "1", retry: "1" },
      "200ms",
      "taller",
      1.08,
    ],
    ["sleep", { mode: "sleep" }, "2s", "shorter", 0.7],
    ["curious", { curious: "1" }, "600ms", "taller", 1.08],
    [
      "success still",
      { reducedMotion: "true", success: "1" },
      "300ms",
      "shorter",
      0.86,
    ],
    [
      "celebration still",
      { reducedMotion: "true", celebration: "1" },
      "400ms",
      "shorter",
      0.86,
    ],
    [
      "greeting still",
      { reducedMotion: "true", greeting: "1" },
      "300ms",
      "shorter",
      0.5,
    ],
    [
      "retry still",
      { reducedMotion: "true", retry: "1" },
      "700ms",
      "shorter",
      0.95,
    ],
    [
      "retry still's surprise",
      { reducedMotion: "true", retry: "1" },
      "200ms",
      "taller",
      1.08,
    ],
    [
      "curious still",
      { reducedMotion: "true", curious: "1" },
      "300ms",
      "taller",
      1.08,
    ],
  ];
  const measured: string[] = [];
  for (const [name, data, t, way, bar] of expressions) {
    const seen = bars(marked, data, t);
    const ratio = seen.tallest / height;
    if (way === "shorter" ? ratio > bar : ratio < bar)
      fail(
        `${name}: the eye bars must be ${way} than Idle's (${ratio.toFixed(2)} of Idle's height, bar ${bar.toFixed(2)})`,
      );
    measured.push(`${name} ${ratio.toFixed(2)}`);
  }
  // Thinking looks up and aside, toward the "..." on the right as on the
  // board, with the bars at their full height (lowered lids read as bored or
  // drowsy); Explaining looks along the pointer, toward the hint on the right.
  const thinkingBars = bars(marked, { mode: "thinking" }, "1s");
  const thinking = thinkingBars.both;
  if (
    !(thinking.bottom < idleBars.both.bottom - 2) ||
    !(thinking.left > idleBars.both.left + 1)
  )
    fail(
      `thinking must look up and aside, toward the "..." (eye bars ${box(thinking)}; Idle's ${box(idleBars.both)})`,
    );
  if (thinkingBars.tallest / height < 0.95)
    fail(
      `thinking must keep the bars at full height (${(thinkingBars.tallest / height).toFixed(2)} of Idle's height, bar 0.95)`,
    );
  measured.push(`thinking ${(thinkingBars.tallest / height).toFixed(2)}`);
  for (const data of [
    { explaining: "1" },
    { reducedMotion: "true", explaining: "1" },
  ]) {
    const looking = bars(marked, data, "600ms").both;
    if (!(looking.left > idleBars.both.left + 2))
      fail(
        `${JSON.stringify(data)}: the eyes must look toward the hint (eye bars ${box(looking)}; Idle's ${box(idleBars.both)})`,
      );
  }
  // Explaining's eyes look toward the hint on their own, not only because the
  // head turns: in a copy whose Explaining holds the head straight ahead (its
  // Turn Lead keys at rest), the bars still move toward the hint, at 400 px.
  const unturned = withoutExplainingTurn(marked, work);
  const at400 = (project: string, data: Record<string, string>) =>
    colourBounds(capture(project, work, 400, data, "600ms"), EYE_MARKER) ??
    fail("no eye bars at 400 px");
  const idle400 = at400(unturned, {});
  const looking400 = at400(unturned, { explaining: "1" });
  if (!(looking400.left > idle400.left + 2))
    fail(
      `Explaining with the head held straight must still turn the eyes toward the hint (eye bars ${box(looking400)}; Idle's ${box(idle400)})`,
    );
  // The Blink layer still closes the eyes over an expression: with a blink
  // moved into Success's squint, the bars all but vanish at its closed frame.
  const blinking = withEarlyBlink(marked, work);
  const squint = bars(
    blinking,
    { intensity: "1", success: "1" },
    "350ms",
  ).tallest;
  const closed = colourBounds(
    capture(blinking, work, px, { intensity: "1", success: "1" }, "500ms"),
    EYE_MARKER,
  );
  const shut = closed ? closed.bottom - closed.top + 1 : 0;
  if (!(shut < squint * 0.3))
    fail(
      `a blink over Success's squint must close the eyes (${String(shut)} rows at the blink, ${String(squint)} in the squint)`,
    );
  lines.push(
    `eyes: each emotion's bars against Idle's height, ${measured.join(", ")}; thinking looks up and aside, explaining toward the hint (with the head held straight too, ${String(looking400.left - idle400.left)} px at 400), and a blink still closes them over an expression`,
  );

  // Each Reaction's still version: an expression of its own, in place.
  const reactions = PIP_REACTIONS;
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

  // The head nod: gazeY moves the whole head, not only the eyes, both ways.
  const headDown = shot({ mode: "rest", gazeY: "1" }, "500ms");
  const headUp = shot({ mode: "rest", gazeY: "-1" }, "500ms");
  const pitch = Math.min(
    changedShare(ahead, headDown),
    changedShare(ahead, headUp),
  );
  if (pitch < 0.05)
    fail(`gazeY barely nods Pip's head (${fmtShare(pitch)} of pixels)`);
  lines.push(
    `head pitch: both gazeY directions change at least ${fmtShare(pitch)} of pixels`,
  );
  return lines;
}

function fmtShare(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

function main(): void {
  requirePinnedNode();
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

    const gaps = restPoseGaps(readFileSync(join(rig, "pip.rml"), "utf8"));
    if (gaps.length > 0)
      fail(
        `every Body timeline must key the whole rest pose:\n${gaps.join("\n")}`,
      );
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
