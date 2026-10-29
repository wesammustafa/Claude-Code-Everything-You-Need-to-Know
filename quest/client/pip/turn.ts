// The head turn's derived values: the Turn timeline in rig/pip.rml, and the
// front-view values the art starts from, computed from a box model of the
// approved board's turnaround views. Nobody edits them by hand: change the
// model here and run `npm run pip:turn`, which writes the Turn timeline
// between its markers and sets each part's resting value, then
// `npm run pip:build`. turn.test.ts fails while the rig differs from what
// this writes.
//
// Units are the rig's 800-unit reference space. u runs to the right of Pip's
// centre on screen and z toward the viewer; the rig's root mirrors x, so an
// art x is 400 - u.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The head: a box with chamfered vertical edges (the board's front view is 107 by 78 px, its side view 72.5 px deep, at 5.4 units a px). */
const HEAD = { halfWidth: 290, halfDepth: 196, chamfer: 40 };
/** The silhouette's cut corners (its vertices' heights stay where the art puts them). */
const CORNER = 38;
/** Ears: blocks on the head's sides, set into it a little. */
const EAR = { out: 80, in: 8, halfDepth: 74 };
/** Antennas: on the top face, set back from its middle. */
const ANTENNA_Z = -46;
const ANTENNAS = {
  big: { u: 106, width: 92, depth: 76, id: 670 },
  small: { u: -144, width: 60, depth: 50, id: 675 },
} as const;
/** The torso turns this share of the head's angle. */
const TORSO = { halfWidth: 122, halfDepth: 96, chamfer: 20 };
const TORSO_SHARE = 0.2;
const TORSO_SHOWN = ["front", "front right", "right", "front left", "left"];
/** The face's features slide a little further toward the turn, as on a slightly rounded face. */
const FACE_SLIDE = 0.12;
/** The largest turn, at gazeX -1 or 1. */
export const TURN_LIMIT_DEGREES = 55;
const PHI_MAX = (TURN_LIMIT_DEGREES * Math.PI) / 180;
/** gazeX -1 to 1 in quarters: frames 0 to 8, the front view at frame 4. */
const SAMPLES = 9;
export const FRONT_FRAME = (SAMPLES - 1) / 2;
/** Each ear's outline shape and its rectangle, by the ear's front face id. */
const EAR_OUTLINE = { 610: [740, 741], 614: [742, 743] } as const;

type Face = [name: string, from: [number, number], to: [number, number]];
/** A span across the screen, from its left edge to its right, in u. */
type Span = [from: number, to: number];

function octagon(w: number, d: number, b: number): Face[] {
  return [
    ["front", [-w + b, d], [w - b, d]],
    ["front right", [w - b, d], [w, d - b]],
    ["right", [w, d - b], [w, -d + b]],
    ["back right", [w, -d + b], [w - b, -d]],
    ["back", [w - b, -d], [-w + b, -d]],
    ["back left", [-w + b, -d], [-w, -d + b]],
    ["left", [-w, -d + b], [-w, d - b]],
    ["front left", [-w, d - b], [-w + b, d]],
  ];
}

const project = (u: number, z: number, phi: number) =>
  u * Math.cos(phi) + z * Math.sin(phi);
const rotatedZ = (nu: number, nz: number, phi: number) =>
  -nu * Math.sin(phi) + nz * Math.cos(phi);

/** Each face's projected span and outward normal; a face turned away keeps a zero-width span at its near edge. */
function faces(w: number, d: number, b: number, phi: number) {
  return octagon(w, d, b).map(([name, p, q]) => {
    const a = project(p[0], p[1], phi);
    const e = project(q[0], q[1], phi);
    const n = Math.hypot(q[1] - p[1], q[0] - p[0]);
    const nu = -(q[1] - p[1]) / n;
    const nz = (q[0] - p[0]) / n;
    return e > a + 1e-6
      ? { name, from: a, to: e, nu, nz }
      : { name, from: a, to: a, nu, nz };
  });
}

function silhouette(w: number, d: number, b: number, phi: number) {
  const xs = octagon(w, d, b).map(([, p]) => project(p[0], p[1], phi));
  return { lo: Math.min(...xs), hi: Math.max(...xs) };
}

/** How lit a vertical face is: a soft key light from the viewer, a little from the left, as on the board. */
function light(nu: number, nz: number, phi: number): number {
  const su = nu * Math.cos(phi) + nz * Math.sin(phi);
  return Math.max(0, -0.18 * su + 0.92 * rotatedZ(nu, nz, phi));
}

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [
  parseInt(hex.slice(-6, -4), 16),
  parseInt(hex.slice(-4, -2), 16),
  parseInt(hex.slice(-2), 16),
];
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
/** Rounds half to even, as the values were first written. */
function roundHalfEven(v: number): number {
  const r = Math.round(v);
  return Math.abs(v % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}
const argb = (c: Rgb) =>
  `FF${c
    .map((v) =>
      Math.max(0, Math.min(255, roundHalfEven(v)))
        .toString(16)
        .toUpperCase()
        .padStart(2, "0"),
    )
    .join("")}`;

const SHADE_DARK = rgb("E0592E");
const SHADE_LIT = rgb("FD9A64");
const SHADE_HIGH = rgb("FFB884");

function faceColour(level: number): Rgb {
  if (level <= 0.92)
    return mix(SHADE_DARK, SHADE_LIT, Math.max(0, level) / 0.92);
  return mix(SHADE_LIT, SHADE_HIGH, Math.min(1, (level - 0.92) / 0.2));
}

/** A head face's gradient: lit at the top (the chamfers catch a little more), shaded at the bottom. */
function bandStops(level: number, name: string): [string, string] {
  const base = faceColour(level);
  const chamfer = name.startsWith("front") && name !== "front";
  const top = mix(base, [255, 214, 170], chamfer ? 0.1 : 0.05);
  const bottom = mix(base, rgb("B9461F"), 0.22);
  return [argb(top), argb(bottom)];
}

const art = (u: number) => 400 - u;

/**
 * Each ear's front face, its outer face (only on the near side) and the
 * outline round the faces that show. Whatever the head hides of the far ear
 * collapses onto the head's edge, so a hidden ear has no width anywhere and
 * the keys between two samples never reach inside the head.
 */
function ears(phi: number) {
  const head = silhouette(HEAD.halfWidth, HEAD.halfDepth, HEAD.chamfer, phi);
  return ([1, -1] as const).map((side) => {
    const inner = side * (HEAD.halfWidth - EAR.in);
    const outer = side * (HEAD.halfWidth + EAR.out);
    const a = project(inner, EAR.halfDepth, phi);
    const e = project(outer, EAR.halfDepth, phi);
    const near = side * phi < 0;
    const far = side * phi > 0;
    // The head's edge on this ear's side, where a hidden span collapses.
    const edge = side > 0 ? head.hi : head.lo;
    let lo = Math.min(a, e);
    let hi = Math.max(a, e);
    // The far ear: the head hides what lies inside its outline.
    if (far) {
      if (side > 0) lo = Math.max(lo, edge);
      else hi = Math.min(hi, edge);
    }
    const front: Span = hi > lo ? [lo, hi] : [edge, edge];
    const o1 = project(outer, EAR.halfDepth, phi);
    const o2 = project(outer, -EAR.halfDepth, phi);
    const outerSpan: Span =
      near && Math.max(o1, o2) > Math.min(o1, o2)
        ? [Math.min(o1, o2), Math.max(o1, o2)]
        : far
          ? [edge, edge]
          : [o1, o1];
    // The outline rounds only the faces that show.
    const shown = [front, outerSpan].filter(([from, to]) => to > from);
    const outline: Span =
      shown.length === 0
        ? [front[0], front[0]]
        : [
            Math.min(...shown.map(([from]) => from)),
            Math.max(...shown.map(([, to]) => to)),
          ];
    return { side, front, outer: outerSpan, outline };
  });
}

function antenna(name: keyof typeof ANTENNAS, phi: number) {
  const { u, width, depth } = ANTENNAS[name];
  const base = project(u, ANTENNA_Z, phi);
  const f1 = project(-width / 2, depth / 2, phi);
  const f2 = project(width / 2, depth / 2, phi);
  // The tip's side that shows.
  const [s1, s2] =
    Math.sin(phi) >= 0
      ? [project(-width / 2, -depth / 2, phi), f1]
      : [f2, project(width / 2, -depth / 2, phi)];
  return {
    base,
    front: [f1, f2] as const,
    lo: Math.min(f1, f2, s1, s2),
    hi: Math.max(f1, f2, s1, s2),
  };
}

/** Every value the Turn keys at a gaze, by object id and then property. */
export function turnValues(
  gaze: number,
): Map<string, Map<string, number | string>> {
  const phi = gaze * PHI_MAX;
  const c = Math.cos(phi);
  const values = new Map<string, Map<string, number | string>>();
  const set = (id: number, property: string, value: number | string) => {
    const key = `0:${String(id)}`;
    const object = values.get(key) ?? new Map<string, number | string>();
    object.set(property, value);
    values.set(key, object);
  };

  // The head's faces: each one's span and its two colours.
  for (const [i, f] of faces(
    HEAD.halfWidth,
    HEAD.halfDepth,
    HEAD.chamfer,
    phi,
  ).entries()) {
    set(620 + i, "x", art((f.from + f.to) / 2));
    set(630 + i, "width", f.to - f.from);
    const [top, bottom] = bandStops(light(f.nu, f.nz, phi), f.name);
    set(640 + 2 * i, "colorValue", top);
    set(641 + 2 * i, "colorValue", bottom);
  }
  // The silhouette's vertices (its left edge on screen is art's right), and
  // the same outline in the shape the upper arms clip to.
  const { lo, hi } = silhouette(
    HEAD.halfWidth,
    HEAD.halfDepth,
    HEAD.chamfer,
    phi,
  );
  const xs = [
    art(lo) - CORNER,
    art(hi) + CORNER,
    art(hi),
    art(hi),
    art(hi) + CORNER,
    art(lo) - CORNER,
    art(lo),
    art(lo),
  ];
  for (const [k, x] of xs.entries()) {
    set(660 + k, "x", x);
    set(760 + k, "x", x);
  }
  // The face rides the front plane and narrows as it turns away; its glow follows.
  const centre = (HEAD.halfDepth + FACE_SLIDE * HEAD.halfWidth) * Math.sin(phi);
  set(600, "x", art(centre));
  set(600, "scaleX", c);
  set(608, "x", art(centre - 30 * c));
  // Each ear's front face, outer face and the outline round both.
  for (const { side, front, outer, outline } of ears(phi)) {
    const id = side > 0 ? 610 : 614;
    set(id, "x", art((front[0] + front[1]) / 2));
    set(id + 1, "width", front[1] - front[0]);
    set(id + 2, "x", art((outer[0] + outer[1]) / 2));
    set(id + 3, "width", outer[1] - outer[0]);
    const [shape, rect] = EAR_OUTLINE[id];
    set(shape, "x", art((outline[0] + outline[1]) / 2));
    set(rect, "width", outline[1] - outline[0]);
  }
  // Each antenna's base on the top face, and its tip's outline and front
  // face relative to the base (art x runs the other way).
  for (const name of ["big", "small"] as const) {
    const a = antenna(name, phi);
    const id = ANTENNAS[name].id;
    set(id, "x", art(a.base));
    set(id + 1, "x", -(a.lo + a.hi) / 2);
    set(id + 2, "width", a.hi - a.lo);
    set(id + 3, "x", -(a.front[0] + a.front[1]) / 2);
    set(id + 4, "width", a.front[1] - a.front[0]);
  }
  // The torso turns a fifth as far.
  const psi = phi * TORSO_SHARE;
  const torso = faces(TORSO.halfWidth, TORSO.halfDepth, TORSO.chamfer, psi);
  for (const [i, name] of TORSO_SHOWN.entries()) {
    const f = torso.find((t) => t.name === name);
    if (!f) throw new Error(`no torso face ${name}`);
    set(680 + i, "x", art((f.from + f.to) / 2));
    set(690 + i, "width", f.to - f.from);
  }
  const body = silhouette(TORSO.halfWidth, TORSO.halfDepth, TORSO.chamfer, psi);
  set(170, "x", art((body.lo + body.hi) / 2));
  set(172, "width", body.hi - body.lo);
  return values;
}

/** A number as the rig writes it: at most three decimals, no trailing zeros. */
export function num(v: number): string {
  const r = Number(v.toFixed(3));
  return Object.is(r, -0) ? "0" : String(r);
}

/** What each keyed object is, for the comment beside it. */
function label(id: string): string {
  const n = Number(id.slice(2));
  const head = [
    "Front",
    "Front Right",
    "Right",
    "Back Right",
    "Back",
    "Back Left",
    "Left",
    "Front Left",
  ];
  if (n >= 620 && n < 628) return `Face ${head[n - 620] ?? ""}`;
  if (n >= 630 && n < 638) return `Face ${head[n - 630] ?? ""}: its width`;
  if (n >= 640 && n < 656)
    return `Face ${head[Math.floor((n - 640) / 2)] ?? ""}: its ${n % 2 === 0 ? "top" : "bottom"} colour`;
  if (n >= 660 && n < 668) return "Head Silhouette: a vertex";
  if (n >= 760 && n < 768) return "Outside Head: a vertex";
  if (n >= 680 && n < 685) return `Torso ${TORSO_SHOWN[n - 680] ?? ""}`;
  if (n >= 690 && n < 695)
    return `Torso ${TORSO_SHOWN[n - 690] ?? ""}: its width`;
  const named: Record<number, string> = {
    600: "Face: the eyes and mouth",
    608: "Soft Face Glow",
    610: "Ear Left Front",
    611: "Ear Left Front: its width",
    612: "Ear Left Outer",
    613: "Ear Left Outer: its width",
    614: "Ear Right Front",
    615: "Ear Right Front: its width",
    616: "Ear Right Outer",
    617: "Ear Right Outer: its width",
    740: "Ear Left Outline",
    741: "Ear Left Outline: its width",
    742: "Ear Right Outline",
    743: "Ear Right Outline: its width",
    670: "Antenna Left Turn: the stalk's base",
    671: "Antenna Left Tip",
    672: "Antenna Left Tip: its width",
    673: "Antenna Left Tip Front",
    674: "Antenna Left Tip Front: its width",
    675: "Antenna Right Turn: the stalk's base",
    676: "Antenna Right Tip",
    677: "Antenna Right Tip: its width",
    678: "Antenna Right Tip Front",
    679: "Antenna Right Tip Front: its width",
    170: "Torso",
    172: "Torso: its width",
  };
  const found = named[n];
  if (found === undefined) throw new Error(`no label for ${id}`);
  return found;
}

export const TURN_BEGIN =
  "<!-- Turn: written by quest/client/pip/turn.ts (npm run pip:turn); never edit it by hand. -->";
export const TURN_END = "<!-- Turn: end. -->";

/** The Turn timeline, with its markers, indented as pip.rml holds it. */
export function turnTimeline(indent = "        "): string {
  const samples = Array.from({ length: SAMPLES }, (_, i) =>
    turnValues(-1 + (2 * i) / (SAMPLES - 1)),
  );
  const lines = [
    TURN_BEGIN,
    "<!-- Turn: the head turn the joystick scrubs, from gazeX -1 (frame 0) through",
    `     the front view (frame ${String(FRONT_FRAME)}) to 1 (frame ${String(SAMPLES - 1)}), drawn from a box model of the`,
    `     board's turnaround views. The head is a box ${String(2 * HEAD.halfWidth)} wide, ${String(2 * HEAD.halfDepth)} deep, with`,
    `     ${String(HEAD.chamfer)}-unit chamfers on its vertical edges; gazeX turns it ${String(TURN_LIMIT_DEGREES)} degrees`,
    "     at most, and a point u across and z out of the face lands at",
    "     u cos(a) + z sin(a). So the face slides across the front plane and",
    "     narrows, the side planes trade width with it, the near ear shows its",
    "     outer face and the far one slips behind the head, and the antennas,",
    "     set back on the top face, close in. Each face's colour follows a soft",
    "     key light from the viewer. The torso turns a fifth as far. A face",
    "     turned away has no width. Keys are linear: the samples are close",
    "     enough that the curve between them is the turn itself. -->",
    `<LinearAnimation duration="${String(SAMPLES - 1)}" name="Turn" id="0:720">`,
  ];
  const first = samples[0];
  if (!first) throw new Error("no samples");
  for (const [id, properties] of first) {
    lines.push(`    <KeyedObject objectId="${id}"> <!-- ${label(id)} -->`);
    for (const property of properties.keys()) {
      lines.push(`        <KeyedProperty property="${property}">`);
      for (const [frame, sample] of samples.entries()) {
        const value = sample.get(id)?.get(property);
        if (value === undefined) throw new Error(`no ${id} ${property}`);
        const last = frame === SAMPLES - 1;
        const tail = last ? "" : ' interpolationType="linear"';
        lines.push(
          typeof value === "string"
            ? `            <KeyFrameColor value="${value}" frame="${String(frame)}"${tail}/>`
            : `            <KeyFrameDouble value="${num(value)}" frame="${String(frame)}"${tail}/>`,
        );
      }
      lines.push("        </KeyedProperty>");
    }
    lines.push("    </KeyedObject>");
  }
  lines.push("</LinearAnimation>", TURN_END);
  return lines.map((line) => indent + line).join("\n");
}

/** RML's default for a property an element leaves out. */
const DEFAULTS: Record<string, string> = { scaleX: "1", x: "0" };

/**
 * The rig with the Turn timeline written between its markers and every part
 * the Turn keys starting at its front-view value, so the art at rest is frame
 * 4 of the Turn.
 */
export function withTurn(rml: string): string {
  const begin = rml.indexOf(TURN_BEGIN);
  const end = rml.indexOf(TURN_END);
  if (begin < 0 || end < begin) throw new Error("pip.rml has no Turn markers");
  const lineStart = rml.lastIndexOf("\n", begin) + 1;
  let text =
    rml.slice(0, lineStart) +
    turnTimeline(rml.slice(lineStart, begin)) +
    rml.slice(end + TURN_END.length);
  const art = text.slice(0, lineStart);
  let rest = art;
  for (const [id, properties] of turnValues(0)) {
    const element = new RegExp(`<[A-Za-z]+\\b[^>]*\\bid="${id}"[^>]*>`);
    const found = element.exec(rest);
    if (!found) throw new Error(`pip.rml's art has no element ${id}`);
    let tag = found[0];
    for (const [property, value] of properties) {
      const written = typeof value === "string" ? value : num(value);
      const attribute = new RegExp(`\\b${property}="[^"]*"`);
      if (attribute.test(tag))
        tag = tag.replace(attribute, `${property}="${written}"`);
      else if (DEFAULTS[property] !== written)
        throw new Error(`${id} has no ${property} to set to ${written}`);
    }
    rest =
      rest.slice(0, found.index) +
      tag +
      rest.slice(found.index + found[0].length);
  }
  text = rest + text.slice(art.length);
  return text;
}

/** rig/pip.rml, relative to quest/client/pip/. */
export const RIG_RML = join("rig", "pip.rml");

if (import.meta.main) {
  const path = join(import.meta.dirname, RIG_RML);
  const before = readFileSync(path, "utf8");
  const after = withTurn(before);
  if (after === before) console.log("pip.rml's Turn is up to date");
  else {
    writeFileSync(path, after);
    console.log("wrote the Turn into pip.rml; run npm run pip:build next");
  }
}
