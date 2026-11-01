// The head's turn and nod: the head's skinned faces, the Turn and Pitch
// timelines in rig/pip.rml, and the front-view values the art starts from,
// all computed from a box model of the approved board's turnaround views.
// Nobody edits them by hand: change the model here and run
// `npm run pip:turn`, which writes the head's faces and the two timelines
// between their markers and sets each part's resting value, then
// `npm run pip:build`. turn.test.ts fails while the rig differs from what
// this writes.
//
// Units are the rig's 800-unit reference space. u runs to the right of Pip's
// centre on screen, v down from the head's centre and z toward the viewer;
// the rig's root mirrors x, so an art x is 400 - u.
//
// The projection is a parallel one: a point (u, v, z) of the head lands at
// u cos(a) + z sin(a) across and v cos(b) + z sin(b) down, for a turn a
// (gazeX) and a nod b (gazeY, down positive). Across depends on the turn
// alone and down on the nod alone, so the Turn timeline (gazeX) and the
// Pitch timeline (gazeY) key separate properties and simply add up: any
// diagonal is the same projection of the same box, so no two faces ever
// overlap and no plane crosses another. The head's faces are skinned to
// static bones under three nodes whose scales are the projection's four
// terms: the Turn keys two of those scales and the Pitch the other two.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The head: a box with chamfered vertical edges and bevelled top and bottom edges (the board's front view is 107 by 78 px, its side view 72.5 px deep, at 5.4 units a px). */
const HEAD = {
  halfWidth: 290,
  halfDepth: 196,
  chamfer: 40,
  halfHeight: 211,
  bevel: 38,
};
/** The walls run between the bevels. */
const WALL_HALF_HEIGHT = HEAD.halfHeight - HEAD.bevel;
/** The head's centre in the art. */
const CENTRE = { x: 400, y: 365 };
/** Each face reaches this far past its edges, under its neighbours, so no seam shows between two faces. */
const SEAM = 1;
/** Ears: blocks on the head's sides, set into it a little. */
const EAR = { out: 80, in: 8, halfDepth: 74, centre: 83, top: -25 };
/** Antennas: on the top face, set back from its middle. */
const ANTENNA_Z = -46;
const ANTENNA_BASE_V = -195;
const ANTENNAS = {
  big: { u: 106, width: 92, depth: 76, id: 670, stalk: 1107 },
  small: { u: -144, width: 60, depth: 50, id: 675, stalk: 1109 },
} as const;
/** Each stalk's top, above its base. */
const STALK_TOP = -48;
/** The torso turns and nods this share of the head's angles. */
const TORSO = { halfWidth: 122, halfDepth: 96, chamfer: 20 };
const TORSO_SHARE = 0.2;
const TORSO_SHOWN = ["front", "front right", "right", "front left", "left"];
/** The face's features slide a little further toward the look, as on a slightly rounded face. */
const FACE_SLIDE = 0.12;
/** The face's eyes and mouth and its glow, down from the head's centre. */
const FACE_V = 3;
const GLOW_V = -17;
/** The largest turn, at gazeX -1 or 1. */
export const TURN_LIMIT_DEGREES = 55;
const PHI_MAX = (TURN_LIMIT_DEGREES * Math.PI) / 180;
/** The largest nod, at gazeY -1 (up) or 1 (down): a nod, not a flip. */
export const PITCH_LIMIT_DEGREES = 14;
const THETA_MAX = (PITCH_LIMIT_DEGREES * Math.PI) / 180;
/**
 * The Turn timeline runs gazeX -1 to 1 over 88 frames, the front view at
 * frame 44, so a face that turns away at 45 degrees does so on a whole frame
 * (80). The Pitch runs gazeY -1 to 1 over 80 frames, level at frame 40.
 */
export const TURN_FRAMES = 88;
export const FRONT_FRAME = TURN_FRAMES / 2;
export const PITCH_FRAMES = 80;
export const LEVEL_FRAME = PITCH_FRAMES / 2;
/** Each ear's outline shape and its rectangle, by the ear's front face id. */
const EAR_OUTLINE = { 610: [740, 741], 614: [742, 743] } as const;
/** Each ear's group and its light band (shape, rectangle), by the ear's front face id. */
const EAR_PARTS = {
  610: { group: 1101, light: [1103, 1104] },
  614: { group: 1102, light: [1105, 1106] },
} as const;
/** The box round the walls the upper arms clip against. */
const OUTSIDE_HEAD = 1111;
const TORSO_PITCH = 1112;
/** The nodes whose scales are the projection's terms, and the bones under them. */
const BASIS = { head: 1000, across: 1001, height: 1002, depth: 1003 };
const FIRST_BONE = 1200;

/** The colours of the faces that take no turn light. */
const TOP_BEVEL = "FFFFBA84";
const BOTTOM_BEVEL = "FFC85A2F";
const TOP = "FFFCB27C";
const UNDERSIDE = "FFB4461F";

type Face2 = [name: string, from: [number, number], to: [number, number]];
/** A span across the screen, from its left edge to its right, in u. */
type Span = [from: number, to: number];
/** A point of the head: u across, v down, z toward the viewer. */
export type Point = [u: number, v: number, z: number];

function octagon(w: number, d: number, b: number): Face2[] {
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

/** A wall's gradient: lit at the top (the chamfers catch a little more), shaded at the bottom. */
function bandStops(level: number, name: string): [string, string] {
  const base = faceColour(level);
  const chamfer = name.startsWith("front") && name !== "front";
  const top = mix(base, [255, 214, 170], chamfer ? 0.1 : 0.05);
  const bottom = mix(base, rgb("B9461F"), 0.22);
  return [argb(top), argb(bottom)];
}

const art = (u: number) => CENTRE.x - u;

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

/** Values by object id and then property. */
export type Values = Map<string, Map<string, number | string>>;

function valuesBuilder() {
  const values: Values = new Map();
  const set = (id: number, property: string, value: number | string) => {
    const key = `0:${String(id)}`;
    const object = values.get(key) ?? new Map<string, number | string>();
    object.set(property, value);
    values.set(key, object);
  };
  return { values, set };
}

// ---------------------------------------------------------------------------
// The head's faces in three dimensions.

/** The walls' octagon, corner by corner: corner i begins wall i. */
const WALLS = octagon(HEAD.halfWidth, HEAD.halfDepth, HEAD.chamfer).map(
  ([, p]) => p,
);

/** The top and bottom faces' octagon: the walls' octagon with each edge moved in by the bevel. */
const INSET: [number, number][] = (() => {
  const n = WALLS.length;
  const lines = WALLS.map((p, i) => {
    const q = WALLS[(i + 1) % n] ?? p;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    // Outward: the front edge's normal points toward the viewer.
    const nu = (q[1] - p[1]) / len;
    const nz = -(q[0] - p[0]) / len;
    return { nu: -nu, nz: -nz, k: -(p[0] * nu + p[1] * nz) - HEAD.bevel };
  });
  return lines.map((l, i) => {
    const m = lines[(i + n - 1) % n] ?? l;
    const det = m.nu * l.nz - m.nz * l.nu;
    return [(m.k * l.nz - l.k * m.nz) / det, (m.nu * l.k - l.nu * m.k) / det];
  });
})();

const WALL_NAMES = octagon(1, 1, 0).map(([name]) => name);
/** The faces that never turn toward the viewer within the turn and the nod: the back and its bevels. */
const NEVER_SEEN = new Set(["back"]);

export type HeadFace = {
  /** The face's name in the rig. */
  name: string;
  /** Its shape's id. */
  id: number;
  kind: "wall" | "top bevel" | "bottom bevel" | "top" | "underside";
  /** Its corners, in order round the face. */
  points: Point[];
  /** For a wall, its index round the octagon. */
  wall?: number;
};

const title = (s: string) =>
  s
    .split(" ")
    .map((w) => (w[0] ?? "").toUpperCase() + w.slice(1))
    .join(" ");

/** Every face of the head the viewer can see at some turn and nod. */
export function headFaces(): HeadFace[] {
  const list: HeadFace[] = [];
  const at = (corner: [number, number], v: number): Point => [
    corner[0],
    v,
    corner[1],
  ];
  let bevelId = 1030;
  for (const [i, name] of WALL_NAMES.entries()) {
    if (NEVER_SEEN.has(name)) continue;
    const p = WALLS[i] ?? [0, 0];
    const q = WALLS[(i + 1) % 8] ?? [0, 0];
    const P = INSET[i] ?? [0, 0];
    const Q = INSET[(i + 1) % 8] ?? [0, 0];
    const a = WALL_HALF_HEIGHT;
    const h = HEAD.halfHeight;
    list.push({
      name: `Face ${title(name)}`,
      id: 620 + i,
      kind: "wall",
      wall: i,
      points: [at(p, -a), at(q, -a), at(q, a), at(p, a)],
    });
    list.push({
      name: `Top Bevel ${title(name)}`,
      id: bevelId++,
      kind: "top bevel",
      wall: i,
      points: [at(P, -h), at(Q, -h), at(q, -a), at(p, -a)],
    });
    list.push({
      name: `Bottom Bevel ${title(name)}`,
      id: bevelId++,
      kind: "bottom bevel",
      wall: i,
      points: [at(p, a), at(q, a), at(Q, h), at(P, h)],
    });
  }
  list.push({
    name: "Top",
    id: 1020,
    kind: "top",
    points: INSET.map((c) => at(c, -HEAD.halfHeight)),
  });
  list.push({
    name: "Underside",
    id: 1021,
    kind: "underside",
    points: INSET.map((c) => at(c, HEAD.halfHeight)),
  });
  return list;
}

const sub = (a: Point, b: Point): Point => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: Point): Point => {
  const n = Math.hypot(...a) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};

/** A face's corners moved out within its plane by SEAM, so it reaches under its neighbours. */
export function grown(points: Point[]): Point[] {
  const n = points.length;
  const c: Point = [0, 0, 0];
  for (const p of points)
    for (let k = 0; k < 3; k++) c[k] = (c[k] ?? 0) + (p[k] ?? 0) / n;
  const p0 = points[0] ?? c;
  let normal: Point = [0, 0, 0];
  for (let i = 1; i + 1 < n; i++)
    normal = cross(sub(points[i] ?? c, p0), sub(points[i + 1] ?? c, p0));
  normal = unit(normal);
  const outward = (a: Point, b: Point): Point => {
    let o = unit(cross(sub(b, a), normal));
    const mid: Point = [
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
      (a[2] + b[2]) / 2,
    ];
    if (dot(o, sub(mid, c)) < 0) o = [-o[0], -o[1], -o[2]];
    return o;
  };
  return points.map((p, i) => {
    const prev = points[(i + n - 1) % n] ?? p;
    const next = points[(i + 1) % n] ?? p;
    const n1 = outward(prev, p);
    const n2 = outward(p, next);
    const k = SEAM / (1 + dot(n1, n2));
    return [
      p[0] + (n1[0] + n2[0]) * k,
      p[1] + (n1[1] + n2[1]) * k,
      p[2] + (n1[2] + n2[2]) * k,
    ];
  });
}

/** Where a point of the head lands on screen, in u (right) and down from the head's centre. */
export function projectPoint(p: Point, phi: number, theta: number) {
  return {
    x: p[0] * Math.cos(phi) + p[2] * Math.sin(phi),
    y: p[1] * Math.cos(theta) + p[2] * Math.sin(theta),
  };
}

/** Whether a face is turned toward the viewer at a turn and nod: its corners run clockwise on screen. */
export function facing(points: Point[], phi: number, theta: number): number {
  let area = 0;
  const s = points.map((p) => projectPoint(p, phi, theta));
  for (let i = 0; i < s.length; i++) {
    const a = s[i] ?? { x: 0, y: 0 };
    const b = s[(i + 1) % s.length] ?? a;
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

const phiAt = (gaze: number) => gaze * PHI_MAX;
const thetaAt = (gaze: number) => gaze * THETA_MAX;

/** Whether a wall shows at a turn: it faces the viewer, whatever the nod. */
function wallShows(i: number, phi: number): boolean {
  const f = faces(HEAD.halfWidth, HEAD.halfDepth, HEAD.chamfer, phi)[i];
  return f !== undefined && f.to > f.from;
}

// ---------------------------------------------------------------------------
// The values each timeline keys.

/** Every value the Turn keys at a gazeX, by object id and then property. */
export function turnValues(gaze: number): Values {
  const phi = phiAt(gaze);
  const c = Math.cos(phi);
  const { values, set } = valuesBuilder();

  // The projection's turn terms.
  set(BASIS.across, "scaleX", c);
  set(BASIS.depth, "scaleX", Math.sin(phi));
  // Each wall's colours, and whether it faces the viewer.
  for (const [i, f] of faces(
    HEAD.halfWidth,
    HEAD.halfDepth,
    HEAD.chamfer,
    phi,
  ).entries()) {
    if (NEVER_SEEN.has(f.name)) continue;
    const [top, bottom] = bandStops(light(f.nu, f.nz, phi), f.name);
    set(640 + 2 * i, "colorValue", top);
    set(641 + 2 * i, "colorValue", bottom);
    set(620 + i, "opacity", wallShows(i, phi) ? 1 : 0);
  }
  // The box round the walls the upper arms clip against.
  const { lo, hi } = silhouette(
    HEAD.halfWidth,
    HEAD.halfDepth,
    HEAD.chamfer,
    phi,
  );
  set(OUTSIDE_HEAD, "x", art((lo + hi) / 2));
  set(OUTSIDE_HEAD, "width", hi - lo);
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

/** Every value the Pitch keys at a gazeY (down positive), by object id and then property. */
export function pitchValues(gaze: number): Values {
  const theta = thetaAt(gaze);
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const { values, set } = valuesBuilder();
  const down = (v: number, z: number) => CENTRE.y + v * ct + z * st;

  // The projection's nod terms.
  set(BASIS.depth, "scaleY", st);
  set(BASIS.height, "scaleY", ct);
  // The top shows looking down, the underside looking up.
  // At level the top has no height: it counts as shown, so it shows from the
  // frame the nod turns down.
  set(1020, "opacity", gaze >= 0 ? 1 : 0);
  set(1021, "opacity", gaze < 0 ? 1 : 0);
  // The face rides the front plane down or up and foreshortens; its glow follows.
  const slide = HEAD.halfDepth + FACE_SLIDE * HEAD.halfHeight;
  set(600, "y", down(FACE_V, slide));
  set(600, "scaleY", ct);
  set(608, "y", down(GLOW_V, slide));
  // Each ear: its front face slides with the nod, and its outline grows
  // over the top or the bottom face that comes into view, the light band
  // over the top face.
  const reveal = 2 * EAR.halfDepth * Math.abs(st);
  const topShown = 2 * EAR.halfDepth * Math.max(0, st);
  for (const id of [610, 614] as const) {
    const { group, light: lightBand } = EAR_PARTS[id];
    const [shape, rect] = EAR_OUTLINE[id];
    set(group, "y", EAR.centre * (ct - 1) + EAR.halfDepth * st);
    set(shape, "y", CENTRE.y + EAR.centre - EAR.halfDepth * st);
    set(rect, "height", 216 + reveal);
    const top = CENTRE.y + EAR.top + 3 - topShown;
    set(lightBand[0], "y", top + (10 + topShown) / 2);
    set(lightBand[1], "height", 10 + topShown);
  }
  // Each antenna's base on the top face, and its stalk ending where the
  // head's top front edge hides it.
  const edge = -HEAD.halfHeight * ct + (INSET[0]?.[1] ?? 0) * st;
  for (const name of ["big", "small"] as const) {
    const { id, stalk } = ANTENNAS[name];
    const base = ANTENNA_BASE_V * ct + ANTENNA_Z * st;
    set(id, "y", CENTRE.y + base);
    const bottom = Math.min(0, edge - base);
    set(stalk, "y", (bottom + STALK_TOP) / 2);
    set(stalk + 1, "height", bottom - STALK_TOP);
  }
  // The torso nods a fifth as far.
  set(TORSO_PITCH, "y", TORSO.halfDepth * Math.sin(theta * TORSO_SHARE));
  // The box round the head the upper arms clip against: down to the bottom
  // front edge, and well above the top.
  const top = CENTRE.y - HEAD.halfHeight - HEAD.halfDepth;
  const bottom = CENTRE.y + HEAD.halfHeight * ct + (INSET[0]?.[1] ?? 0) * st;
  set(OUTSIDE_HEAD, "y", (top + bottom) / 2);
  set(OUTSIDE_HEAD, "height", bottom - top);
  return values;
}

/** A number as the rig writes it: at most three decimals, no trailing zeros. */
export function num(v: number): string {
  const r = Number(v.toFixed(3));
  return Object.is(r, -0) ? "0" : String(r);
}

// ---------------------------------------------------------------------------
// Writing the timelines.

/**
 * How far a key may stray from the curve before it needs another key, in
 * art units (a 400-pixel Pip draws an art unit as 0.44 px), scale or colour
 * levels. The head's faces stay one box at any scale, so their terms can
 * stray furthest; the ears, which meet the head's edge, least.
 */
function tolerance(id: string, property: string): number {
  if (property === "colorValue") return 3;
  if (property.startsWith("scale")) return 0.005;
  if (id === `0:${String(OUTSIDE_HEAD)}`) return 3;
  const n = Number(id.slice(2));
  if ((n >= 610 && n < 618) || (n >= 740 && n < 744)) return 1.25;
  return 2.75;
}

const channels = (v: number | string): number[] =>
  typeof v === "string" ? rgb(v) : [v];

/**
 * The fewest keys, from whole frames, whose straight lines stay within the
 * tolerance of the value at every frame and half frame: a step (an opacity)
 * keeps a held key where it changes.
 */
export function keysFor(
  at: (frame: number) => number | string,
  frames: number,
  property: string,
  tol = 0,
): { frame: number; value: number | string; hold: boolean }[] {
  if (property === "opacity") {
    // A face edge-on at a whole frame shows or not alike: the key changes
    // there, to what follows.
    const after = (f: number) => at(Math.min(frames, f + 0.25));
    const keys = [{ frame: 0, value: after(0), hold: true }];
    for (let f = 1; f <= frames; f++) {
      if (at(f - 0.75) !== at(f - 0.25))
        throw new Error(
          `${property} changes between frames ${String(f - 1)} and ${String(f)}`,
        );
      if (after(f) !== at(f - 0.25))
        keys.push({ frame: f, value: after(f), hold: true });
    }
    return keys;
  }
  const fits = (a: number, b: number) => {
    const va = channels(at(a));
    const vb = channels(at(b));
    for (let f = a; f <= b; f += 0.5) {
      const t = (f - a) / (b - a);
      const v = channels(at(f));
      for (const [k, x] of v.entries()) {
        const want = (va[k] ?? 0) + ((vb[k] ?? 0) - (va[k] ?? 0)) * t;
        if (Math.abs(want - x) > tol + 1e-9) return false;
      }
    }
    return true;
  };
  const keys = [{ frame: 0, value: at(0), hold: false }];
  let from = 0;
  while (from < frames) {
    let to = from + 1;
    while (to < frames && fits(from, to + 1)) to++;
    keys.push({ frame: to, value: at(to), hold: false });
    from = to;
  }
  // A property that never changes keeps one key.
  if (keys.every((k) => k.value === keys[0]?.value)) return keys.slice(0, 1);
  return keys;
}

/** What each keyed object is, for the comment beside it. */
function label(id: string): string {
  const n = Number(id.slice(2));
  const head = WALL_NAMES.map(title);
  if (n >= 620 && n < 628)
    return `Face ${head[n - 620] ?? ""}: whether it shows`;
  if (n >= 640 && n < 656)
    return `Face ${head[Math.floor((n - 640) / 2)] ?? ""}: its ${n % 2 === 0 ? "top" : "bottom"} colour`;
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
    741: "Ear Left Outline: its size",
    742: "Ear Right Outline",
    743: "Ear Right Outline: its size",
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
    1001: "Head Across: the turn's cosine",
    1002: "Head Height: the nod's cosine",
    1003: "Head Depth: the turn's and the nod's sines",
    1020: "Top: whether it shows",
    1021: "Underside: whether it shows",
    1101: "Ear Left: the nod",
    1102: "Ear Right: the nod",
    1103: "Ear Left Light",
    1104: "Ear Left Light: its height",
    1105: "Ear Right Light",
    1106: "Ear Right Light: its height",
    1107: "Antenna Left Stalk",
    1108: "Antenna Left Stalk: its height",
    1109: "Antenna Right Stalk",
    1110: "Antenna Right Stalk: its height",
    1111: "Outside Head: the box round the head",
    1112: "Torso Pitch",
  };
  const found = named[n];
  if (found === undefined) throw new Error(`no label for ${id}`);
  return found;
}

function timeline(
  name: string,
  id: string,
  frames: number,
  sample: (gaze: number) => Values,
  comment: string[],
): string[] {
  const at = (frame: number) => sample((2 * frame) / frames - 1);
  const first = at(0);
  const lines = [
    ...comment,
    `<LinearAnimation duration="${String(frames)}" name="${name}" id="${id}">`,
  ];
  const cache = new Map<number, Values>();
  const cached = (f: number) => {
    let v = cache.get(f);
    if (!v) {
      v = at(f);
      cache.set(f, v);
    }
    return v;
  };
  for (const [object, properties] of first) {
    lines.push(
      `    <KeyedObject objectId="${object}"> <!-- ${label(object)} -->`,
    );
    for (const property of properties.keys()) {
      const value = (f: number) => {
        const v = cached(f).get(object)?.get(property);
        if (v === undefined) throw new Error(`no ${object} ${property}`);
        return v;
      };
      const keys = keysFor(
        value,
        frames,
        property,
        tolerance(object, property),
      );
      lines.push(`        <KeyedProperty property="${property}">`);
      for (const [k, key] of keys.entries()) {
        const last = k === keys.length - 1;
        const tail = key.hold
          ? ' interpolationType="hold"'
          : last
            ? ""
            : ' interpolationType="linear"';
        lines.push(
          typeof key.value === "string"
            ? `            <KeyFrameColor value="${key.value}" frame="${String(key.frame)}"${tail}/>`
            : `            <KeyFrameDouble value="${num(key.value)}" frame="${String(key.frame)}"${tail}/>`,
        );
      }
      lines.push("        </KeyedProperty>");
    }
    lines.push("    </KeyedObject>");
  }
  lines.push("</LinearAnimation>");
  return lines;
}

const marker = (name: string) => ({
  begin: `<!-- ${name}: written by quest/client/pip/turn.ts (npm run pip:turn); never edit it by hand. -->`,
  end: `<!-- ${name}: end. -->`,
});
export const TURN = marker("Turn");
export const PITCH = marker("Pitch");
export const HEAD_FRONT = marker("Head front");
export const HEAD_BACK = marker("Head back");
export const TURN_BEGIN = TURN.begin;
export const TURN_END = TURN.end;

/** The Turn timeline, with its markers. */
export function turnTimeline(): string[] {
  return [
    TURN.begin,
    ...timeline("Turn", "0:720", TURN_FRAMES, turnValues, [
      "<!-- Turn: the head turn the joystick scrubs across, from gazeX -1 (frame 0)",
      `     through the front view (frame ${String(FRONT_FRAME)}) to 1 (frame ${String(TURN_FRAMES)}), up to ${String(TURN_LIMIT_DEGREES)} degrees each way.`,
      "     It keys the projection's turn terms (the head's faces follow them), each",
      "     wall's colour under a soft key light from the viewer and whether it",
      "     faces the viewer, the face sliding across the front and narrowing, the",
      "     near ear's outer face, the far ear slipping behind the head, the",
      "     antennas closing in, and the torso turning a fifth as far. Keys are",
      "     linear and only where a straight line between them would stray. -->",
    ]),
    TURN.end,
  ];
}

/** The Pitch timeline, with its markers. */
export function pitchTimeline(): string[] {
  return [
    PITCH.begin,
    ...timeline("Pitch", "0:721", PITCH_FRAMES, pitchValues, [
      "<!-- Pitch: the head's nod the joystick scrubs down, from gazeY -1, looking up",
      `     (frame 0), through level (frame ${String(LEVEL_FRAME)}) to 1, looking down (frame ${String(PITCH_FRAMES)}), up to`,
      `     ${String(PITCH_LIMIT_DEGREES)} degrees each way. It keys the projection's nod terms, the top`,
      "     showing looking down and the underside looking up, the face riding",
      "     the front down or up, each ear's top or bottom face, the antennas'",
      "     bases and stalks, and the torso nodding a fifth as far. -->",
    ]),
    PITCH.end,
  ];
}

// ---------------------------------------------------------------------------
// Writing the head's faces.

type Bone = { axis: "u" | "v" | "z"; value: number; id: number };

/** The static bones each face corner is a mix of, one per coordinate the faces use. */
export function headBones(): Bone[] {
  const seen = new Map<string, Bone>();
  let id = FIRST_BONE;
  for (const face of headFaces())
    for (const p of grown(face.points))
      for (const [k, axis] of (["u", "v", "z"] as const).entries()) {
        const value = Number((p[k] ?? 0).toFixed(3));
        const key = `${axis}${String(value)}`;
        if (!seen.has(key)) seen.set(key, { axis, value, id: id++ });
      }
  return [...seen.values()];
}

/** Each corner weighs its three bones a third each: 85 of 255. */
const THIRD = 85 | (85 << 8) | (85 << 16);

function faceShape(face: HeadFace, bones: Bone[], indent: string): string[] {
  const corners = grown(face.points);
  const find = (axis: Bone["axis"], value: number) => {
    const v = Number(value.toFixed(3));
    const bone = bones.find((b) => b.axis === axis && b.value === v);
    if (!bone) throw new Error(`no bone for ${axis} ${String(v)}`);
    return bone;
  };
  const tendons: Bone[] = [];
  const index = (bone: Bone) => {
    let i = tendons.indexOf(bone);
    if (i < 0) i = tendons.push(bone) - 1;
    return i + 1;
  };
  const vertices = corners.map((p) => {
    const slots = [find("u", p[0]), find("v", p[1]), find("z", p[2])].map(
      index,
    );
    const packed =
      (slots[0] ?? 0) | ((slots[1] ?? 0) << 8) | ((slots[2] ?? 0) << 16);
    return `${indent}        <StraightVertex><Weight values="${String(THIRD)}" indices="${String(packed)}"/></StraightVertex>`;
  });
  const opacity =
    face.kind === "wall"
      ? turnValues(0)
          .get(`0:${String(face.id)}`)
          ?.get("opacity")
      : face.kind === "top" || face.kind === "underside"
        ? pitchValues(0)
            .get(`0:${String(face.id)}`)
            ?.get("opacity")
        : undefined;
  const lines = [
    `${indent}<Shape${opacity === undefined ? "" : ` opacity="${String(opacity)}"`} name="${face.name}" id="0:${String(face.id)}">`,
    `${indent}    <PointsPath isClosed="true">`,
    ...vertices,
    `${indent}        <Skin>`,
    ...tendons.map(
      (b) =>
        `${indent}            <Tendon boneId="0:${String(b.id)}"/> <!-- ${b.axis} ${num(b.value)} -->`,
    ),
    `${indent}        </Skin>`,
    `${indent}    </PointsPath>`,
  ];
  if (face.kind === "wall") {
    const i = face.wall ?? 0;
    const rest = turnValues(0);
    const stop = (id: number) =>
      String(rest.get(`0:${String(id)}`)?.get("colorValue"));
    lines.push(
      `${indent}    <Fill>`,
      `${indent}        <LinearGradient startX="0" startY="${String(CENTRE.y - HEAD.halfHeight)}" endX="0" endY="${String(CENTRE.y + HEAD.halfHeight)}">`,
      `${indent}            <GradientStop colorValue="${stop(640 + 2 * i)}" position="0.12" id="0:${String(640 + 2 * i)}"/>`,
      `${indent}            <GradientStop colorValue="${stop(641 + 2 * i)}" position="1" id="0:${String(641 + 2 * i)}"/>`,
      `${indent}        </LinearGradient>`,
      `${indent}    </Fill>`,
    );
  } else {
    const colour =
      face.kind === "top bevel"
        ? TOP_BEVEL
        : face.kind === "bottom bevel"
          ? BOTTOM_BEVEL
          : face.kind === "top"
            ? TOP
            : UNDERSIDE;
    lines.push(
      `${indent}    <Fill><SolidColor colorValue="${colour}"/></Fill>`,
    );
  }
  if (face.kind === "underside")
    lines.push(
      `${indent}    <ClippingShape sourceId="0:1113" fillRule="evenOdd"/>`,
    );
  lines.push(`${indent}</Shape>`);
  return lines;
}

/** The order the faces draw in, front first, so a face turned toward the viewer always draws over one turned away. */
const FRONT_ORDER = [
  "Face Front",
  "Face Front Right",
  "Face Front Left",
  "Face Right",
  "Face Left",
  "Face Back Right",
  "Face Back Left",
  "Top Bevel Front",
  "Bottom Bevel Front",
];
const BACK_ORDER = [
  "Top",
  "Top Bevel Front Right",
  "Top Bevel Right",
  "Top Bevel Front Left",
  "Top Bevel Back Right",
  "Top Bevel Left",
  "Top Bevel Back Left",
  "Underside",
  "Bottom Bevel Front Right",
  "Bottom Bevel Right",
  "Bottom Bevel Front Left",
  "Bottom Bevel Back Right",
  "Bottom Bevel Left",
  "Bottom Bevel Back Left",
];
/** Every face, front first. */
export const DRAW_ORDER = [...FRONT_ORDER, ...BACK_ORDER];

function byName(name: string): HeadFace {
  const face = headFaces().find((f) => f.name === name);
  if (!face) throw new Error(`no face ${name}`);
  return face;
}

/** The head's front faces, drawn over the antennas, with their markers. */
export function headFront(): string[] {
  const bones = headBones();
  return [
    HEAD_FRONT.begin,
    "<!-- The head's faces: a box with chamfered vertical edges and bevelled top and",
    "     bottom edges. Each corner is a mix of three static bones, one for each of",
    "     its coordinates, under the Head Basis nodes, so the Turn and the Pitch",
    "     move every face by keying four scales. A wall shows only while it faces",
    "     the viewer, and the faces draw front first, so one turned away never",
    "     draws over one that shows. The walls and the front bevels draw over",
    "     the antennas, which draw over the top and the other bevels. -->",
    ...FRONT_ORDER.flatMap((name) => faceShape(byName(name), bones, "")),
    HEAD_FRONT.end,
  ];
}

/** The head's back faces and its bones, with their markers. */
export function headBack(): string[] {
  const bones = headBones();
  const group = (axis: Bone["axis"]) =>
    bones
      .filter((b) => b.axis === axis)
      .map((b) => {
        const x = axis === "v" ? 0 : -3 * b.value;
        const y = axis === "u" ? 0 : 3 * b.value;
        return `        <RootBone x="${num(x)}" y="${num(y)}" id="0:${String(b.id)}"/>`;
      });
  const rest = turnValues(0);
  const level = pitchValues(0);
  const scale = (values: Values, id: number, p: string) =>
    num(Number(values.get(`0:${String(id)}`)?.get(p)));
  return [
    HEAD_BACK.begin,
    ...BACK_ORDER.flatMap((name) => faceShape(byName(name), bones, "")),
    "<!-- The projection: a bone at three times each coordinate the faces use,",
    "     under a node that scales it by that coordinate's term. Across holds u",
    "     at cos(turn); Depth holds z at sin(turn) across and sin(nod) down;",
    "     Height holds v at cos(nod). Art x runs the other way. -->",
    `<Node x="${String(CENTRE.x)}" y="${String(CENTRE.y)}" name="Head Basis" id="0:${String(BASIS.head)}">`,
    `    <Node scaleX="${scale(rest, BASIS.across, "scaleX")}" name="Head Across" id="0:${String(BASIS.across)}">`,
    ...group("u"),
    "    </Node>",
    `    <Node scaleY="${scale(level, BASIS.height, "scaleY")}" name="Head Height" id="0:${String(BASIS.height)}">`,
    ...group("v"),
    "    </Node>",
    `    <Node scaleX="${scale(rest, BASIS.depth, "scaleX")}" scaleY="${scale(level, BASIS.depth, "scaleY")}" name="Head Depth" id="0:${String(BASIS.depth)}">`,
    ...group("z"),
    "    </Node>",
    "</Node>",
    HEAD_BACK.end,
  ];
}

// ---------------------------------------------------------------------------
// Writing it all into the rig.

/** RML's default for a property an element leaves out. */
const DEFAULTS: Record<string, string> = {
  scaleX: "1",
  scaleY: "1",
  x: "0",
  y: "0",
  opacity: "1",
};

function replaceBlock(
  rml: string,
  m: { begin: string; end: string },
  block: string[],
): string {
  const begin = rml.indexOf(m.begin);
  const end = rml.indexOf(m.end);
  if (begin < 0 || end < begin)
    throw new Error(
      `pip.rml has no ${m.begin.slice(5, m.begin.indexOf(":"))} markers`,
    );
  const lineStart = rml.lastIndexOf("\n", begin) + 1;
  const indent = rml.slice(lineStart, begin);
  return (
    rml.slice(0, lineStart) +
    block.map((line) => (line === "" ? "" : indent + line)).join("\n") +
    rml.slice(end + m.end.length)
  );
}

/** Sets each keyed part's resting value in the art, before the first timeline. */
function withRest(rml: string, values: Values): string {
  const stop = rml.indexOf("<StateMachine ");
  let art = rml.slice(0, stop);
  for (const [id, properties] of values) {
    const element = new RegExp(`<[A-Za-z]+\\b[^>]*\\bid="${id}"[^>]*>`);
    const found = element.exec(art);
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
    art =
      art.slice(0, found.index) +
      tag +
      art.slice(found.index + found[0].length);
  }
  return art + rml.slice(stop);
}

/**
 * The rig with the head's faces, the Turn and the Pitch written between
 * their markers, and every part they key starting at its resting value, so
 * the art at rest is the front view, level.
 */
export function withTurn(rml: string): string {
  if (!rml.includes(TURN.begin) || !rml.includes(TURN.end))
    throw new Error("pip.rml has no Turn markers");
  let text = replaceBlock(rml, HEAD_FRONT, headFront());
  text = replaceBlock(text, HEAD_BACK, headBack());
  text = replaceBlock(text, TURN, turnTimeline());
  text = replaceBlock(text, PITCH, pitchTimeline());
  text = withRest(text, turnValues(0));
  text = withRest(text, pitchValues(0));
  return text;
}

/** rig/pip.rml, relative to quest/client/pip/. */
export const RIG_RML = join("rig", "pip.rml");

if (import.meta.main) {
  const path = join(import.meta.dirname, RIG_RML);
  const before = readFileSync(path, "utf8");
  const after = withTurn(before);
  if (after === before) console.log("pip.rml's head is up to date");
  else {
    writeFileSync(path, after);
    console.log("wrote the head into pip.rml; run npm run pip:build next");
  }
}
