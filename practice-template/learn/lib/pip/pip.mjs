/**
 * Pip: pure terminal artwork and an explicit-clock animation controller.
 * No stdout writes, timers, process handlers, files, network or dependencies.
 * All public times are monotonic milliseconds from ONE clock.
 *
 * Motion is layered, and every layer is a deterministic function of time:
 *   transition  eases between two semantic poses, features staggered by a few ms;
 *   reaction    finite choreography keyed to the time since the last state change;
 *   ambient     breathing, blinks, glances and antenna twitches, gated by the host.
 * Nothing here uses Math.random(), so a frame can always be reproduced.
 */
export const STATES = Object.freeze(['ready', 'thinking', 'working', 'success', 'retry', 'waiting', 'error']);
export const LABELS = Object.freeze({ ready: 'Ready', thinking: 'Thinking', working: 'Checking', success: 'Passed', retry: 'Try again', waiting: 'Waiting for you', error: 'Check unavailable' });
export const SIZES = Object.freeze({ hero: Object.freeze([48, 24]), standard: Object.freeze([32, 16]), small: Object.freeze([20, 10]), glyph: Object.freeze([9, 4]), compact: Object.freeze([7, 1]) });
export const PALETTE = Object.freeze({ outline: '#CE87F5', eyes: '#F2CC60', mouth: '#F4F1F6', background: '#1E1E1E' });
export const MOTION = Object.freeze({
  frame: 40, transition: 360, blink: 180, slowBlink: 300, celebration: 850, retry: 480, antenna: 900,
  activeTick: 80, slowTick: 240, slowAfter: 10_000,
  breath: 4000, breathTick: 120, glanceIn: 160, glanceHold: 1150, glanceOut: 260,
  ambientUntil: 30_000, restUntil: 600_000,
});

const clamp = (n, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
/** Quintic ease with a small anticipation dip and overshoot. Zero speed at both ends; settles exactly at 1. */
const lively = (t) => { t = clamp(t); const s = Math.sin(Math.PI * t); return ease(t) - 0.35 * s * s * Math.sin(2 * Math.PI * t); };
const hump = (t) => { const s = Math.sin(Math.PI * clamp(t)); return s * s; };

const base = { left: 1, right: 1, happy: 0, smile: 1, skew: 0, gazeX: 0, gazeY: 0, brow: 0, tilt: 0, lift: 0, spark: 0, signal: 0, antenna: 0 };
const KEYS = Object.keys(base);
const POSES = {
  ready: { ...base },
  thinking: { ...base, gazeX: 0.5, gazeY: -0.6, brow: 0.9, smile: 0.5, skew: 0.12, antenna: 0.03 },
  working: { ...base, left: 0.58, right: 0.58, smile: 0.1, gazeY: 0.12 },
  success: { ...base, happy: 1, smile: 1.2 },
  retry: { ...base, right: 0.82, brow: 0.72, smile: 0.65, skew: 0.22 },
  waiting: { ...base, left: 0.8, right: 0.8, smile: 0.75 },
  error: { ...base, left: 0.8, right: 0.8, smile: 0, brow: 0.4 },
};
for (const pose of Object.values(POSES)) Object.freeze(pose);
Object.freeze(POSES);
/** Reaction states arrive with anticipation and a little overshoot; calm states use the plain ease. */
const LIVELY = new Set(['success', 'retry', 'thinking']);
/** Features begin a transition a few ms apart: eyes lead, brow and mouth follow. All finish together. */
const STAGGER = { happy: 30, brow: 40, antenna: 50, smile: 70, skew: 70 };

const BLINK = Object.freeze({ normal: { close: 60, hold: 30, open: 90 }, slow: { close: 90, hold: 70, open: 140 } });
const BLINKS = { ready: BLINK.normal, thinking: BLINK.normal, retry: BLINK.normal, waiting: BLINK.slow, working: null, success: null, error: null };
const DOUBLE_GAP = 110;
// Unequal, deterministic intervals avoid a metronomic blink. Every third lively blink is a double blink.
// After ambientUntil only sparse rest blinks remain; after restUntil nothing is scheduled.
const BLINK_STARTS = (() => {
  const live = [4200, 5700, 3900, 6100, 5100], rest = [12_500, 15_000, 11_000, 17_000], out = [];
  for (let start = 0, i = 0; ; i++) {
    start += start < MOTION.ambientUntil ? live[i % live.length] : rest[i % rest.length];
    if (start >= MOTION.restUntil) break;
    out.push({ start, double: start < MOTION.ambientUntil && i % 3 === 2 });
  }
  return out;
})();
function blinkShape(t, { close, hold, open }) {
  return t < close ? ease(t / close) : t < close + hold ? 1 : t < close + hold + open ? 1 - ease((t - close - hold) / open) : 0;
}
function blinkPhase(age, profile) {
  if (!profile) return { amount: 0, next: null };
  const span = profile.close + profile.hold + profile.open;
  for (const { start, double } of BLINK_STARTS) {
    if (age < start) return { amount: 0, next: start - age };
    const end = start + span + (double ? DOUBLE_GAP + span : 0);
    if (age < end) {
      const t = age - start;
      const amount = t < span ? blinkShape(t, profile) : t < span + DOUBLE_GAP ? 0 : blinkShape(t - span - DOUBLE_GAP, profile);
      return { amount, next: MOTION.frame };
    }
  }
  return { amount: 0, next: null };
}

// A glance is a quick saccade, a hold and a slower return. Tables are gaze offsets per state.
const GLANCE_STARTS = [2600, 7900, 12_400, 18_100, 24_000];
const GLANCES = {
  ready: [[0.7, -0.15], [-0.6, 0.2], [0.45, 0.45], [-0.5, -0.3], [0.35, 0.55]],
  thinking: [[-0.9, 0.1], [0.6, 0.2], [-0.7, -0.1], [0.8, 0.15], [-0.5, 0.3]],
  retry: [[-0.6, 0.25], [0.5, -0.2], [-0.4, 0.5], [0.6, 0.1], [-0.5, -0.3]],
  waiting: [[0.5, 0.5], [-0.6, 0.3], [0.3, -0.4], [-0.4, 0.55], [0.55, 0.2]],
  working: null, success: null, error: null,
};
function glancePhase(age, table) {
  if (!table) return { x: 0, y: 0, next: null };
  const { glanceIn: into, glanceHold: hold, glanceOut: out } = MOTION;
  for (let i = 0; i < GLANCE_STARTS.length; i++) {
    const start = GLANCE_STARTS[i];
    if (age < start) return { x: 0, y: 0, next: start - age };
    const t = age - start;
    if (t < into + hold + out) {
      const amount = t < into ? ease(t / into) : t < into + hold ? 1 : 1 - ease((t - into - hold) / out);
      const next = t < into || t >= into + hold ? MOTION.frame : into + hold - t;
      const [x, y] = table[i % table.length];
      return { x: x * amount, y: y * amount, next };
    }
  }
  return { x: 0, y: 0, next: null };
}
// An idle antenna twitch, like an ear flick. Only states that are not already busy.
const TWITCH_STARTS = [9_600, 21_300];
const TWITCH = 420;
const TWITCHES = new Set(['ready', 'thinking', 'waiting']);
function twitchPhase(age, allowed) {
  if (!allowed) return { amount: 0, next: null };
  for (const start of TWITCH_STARTS) {
    if (age < start) return { amount: 0, next: start - age };
    const t = age - start;
    if (t < TWITCH) return { amount: Math.sin(2 * Math.PI * t / TWITCH) * hump(t / TWITCH), next: MOTION.frame };
  }
  return { amount: 0, next: null };
}
/** Damped antenna sway after a state change. Exactly zero once settled. */
function antennaSway(age) {
  if (age >= MOTION.antenna) return 0;
  return Math.sin(2 * Math.PI * age / 460) * Math.exp(-age / 240) * (1 - ease(age / MOTION.antenna));
}
/** Breathing fades in over 600 ms, continues from the level at the last change, and fades out before ambientUntil. */
function breathEnvelope(age, levelAtChange) {
  return lerp(levelAtChange, 1, ease(age / 600)) * (1 - ease((age - (MOTION.ambientUntil - 2000)) / 2000));
}

function assertState(state) {
  if (!STATES.includes(state)) throw new RangeError(`Unknown Pip state: ${String(state)}`);
}
function assertTime(at) {
  if (!Number.isFinite(at)) throw new TypeError('Pip time must be finite milliseconds.');
}
function assertSize(size) {
  if (!(size in SIZES)) throw new RangeError(`Unknown Pip size: ${size}`);
}

/** Fixed-size geometry means movements never shift surrounding lesson text. */
export function createPip({ state = 'ready', at = 0 } = {}) {
  assertState(state); assertTime(at);
  const epoch = at;
  let current = state;
  let from = { ...POSES[state] };
  let changedAt = at;
  let duration = 0;
  let lastEvent;
  let sway = 0;           // Antenna follow-through direction after a change: 0, +1 or -1.
  let breathLevel = 0;    // Breathing envelope at the last change, so it never jumps.
  let shownAmbient = true; // Options of the most recent visible pose, used to retarget from what was drawn.

  function layered(time, ambient, withBreath) {
    const age = Math.max(0, time - changedAt);
    const target = POSES[current];
    const easing = LIVELY.has(current) ? lively : ease;
    const p = {};
    for (const k of KEYS) {
      const d = STAGGER[k] ?? 0;
      const t = duration ? (age - d) / (duration - d) : 1;
      p[k] = t <= 0 ? from[k] : t >= 1 ? target[k] : lerp(from[k], target[k], easing(t));
    }
    // Reactions have smooth zero-valued endpoints. No endless bouncing.
    if (current === 'success') {
      if (age < MOTION.celebration) {
        const u = age / MOTION.celebration;
        p.lift += hump(u ** 0.75) * 0.042; // Quick hop, soft landing.
        p.spark += hump(u);
      }
      if (age < 260) { const w = hump(age / 260) * 0.22; p.left += w; p.right += w; } // A beat of surprise before the smile.
    }
    if (current === 'retry') {
      if (age < MOTION.retry) { const u = age / MOTION.retry; p.tilt += Math.sin(2 * Math.PI * u) * hump(u) * 0.025; }
      if (age < 240) { const s = hump(age / 240) * 0.3; p.left -= s; p.right -= s; } // A brief "hm?" squint.
    }
    if (current === 'working') {
      // The signal grows in after 150 ms; the eyes scan slowly, like reading.
      const fade = ease((age - 150) / 240);
      p.signal += fade * (0.55 + 0.45 * Math.sin(age * Math.PI * 2 / 1600));
      p.gazeX += fade * 0.6 * Math.sin(age * Math.PI * 2 / 2400);
    }
    if (sway) p.antenna += sway * 0.03 * antennaSway(age);
    if (ambient) {
      const b = blinkPhase(age, BLINKS[current]).amount;
      p.left *= 1 - b * 0.94;
      p.right *= 1 - b * 0.94;
      if (age < MOTION.ambientUntil) {
        const g = glancePhase(age, GLANCES[current]);
        p.gazeX += g.x; p.gazeY += g.y;
        p.antenna += 0.022 * twitchPhase(age, TWITCHES.has(current)).amount;
      }
      if (withBreath) p.lift += 0.010 * breathEnvelope(age, breathLevel) * Math.sin((time - epoch) * Math.PI * 2 / MOTION.breath);
    }
    return p;
  }

  /** `ambient` gates blinks, glances and twitches. `breathing` additionally gates the continuous sub-cell
   *  breath, which costs a redraw every breathTick; a host on a slow link can keep the rest. */
  function pose(time, { motion = true, ambient = true, breathing = true } = {}) {
    assertTime(time);
    if (!motion) return { ...POSES[current], state: current };
    shownAmbient = ambient;
    return { ...layered(time, ambient, breathing), state: current };
  }

  return {
    get state() { return current; },
    /** Same-state updates do NOT restart a reaction. Use a new eventId to celebrate a new pass. */
    setState(next, { at: time, eventId, immediate = false } = {}) {
      assertState(next); assertTime(time);
      if (time < changedAt) throw new RangeError('setState times must not go backwards.');
      if (next === current && (eventId === undefined || eventId === lastEvent)) return false;
      const age = Math.max(0, time - changedAt);
      // Retarget from the currently visible geometry, even halfway through a blink, glance or sway.
      // Breathing is keyed to absolute time and stays continuous on its own.
      from = layered(time, shownAmbient, false);
      breathLevel = breathEnvelope(age, breathLevel);
      sway = immediate ? 0 : next === 'retry' || next === 'error' ? -1 : 1;
      current = next;
      changedAt = time;
      lastEvent = eventId;
      duration = immediate ? 0 : MOTION.transition;
      if (immediate) from = { ...POSES[next] };
      return true;
    },
    pose,
    frame(time, options = {}) { return renderPip(pose(time, options), options); },
    /** Delay until useful next work, or null. Caller owns a SINGLE timer. Pass the size you draw. */
    nextFrameIn(time, { motion = true, ambient = true, breathing = true, size = 'standard' } = {}) {
      assertTime(time); assertSize(size);
      if (!motion) return null;
      const age = Math.max(0, time - changedAt);
      if (age < duration || (sway && age < MOTION.antenna) || (current === 'success' && age < MOTION.celebration) || (current === 'retry' && age < MOTION.retry)) return MOTION.frame;
      if (current === 'working') return age < MOTION.slowAfter ? MOTION.activeTick : MOTION.slowTick;
      if (!ambient) return null;
      const waits = [blinkPhase(age, BLINKS[current]).next];
      if (age < MOTION.ambientUntil) {
        waits.push(glancePhase(age, GLANCES[current]).next, twitchPhase(age, TWITCHES.has(current)).next);
        // Breathing is sub-cell motion: only the raster sizes can show it.
        if (breathing && size !== 'glyph' && size !== 'compact') waits.push(MOTION.breathTick);
      }
      const due = waits.filter(w => w !== null);
      return due.length ? Math.min(...due) : null;
    },
  };
}

export function restPose(state = 'ready') { assertState(state); return { ...POSES[state], state }; }

export function detectCapabilities({ stream = process.stdout, env = process.env, argv = [] } = {}) {
  const tty = Boolean(stream.isTTY);
  const plain = env.LEARN_PLAIN === '1' || argv.includes('--plain') || env.TERM === 'dumb';
  const calm = plain || env.LEARN_CALM === '1' || argv.includes('--calm') || env.PIP_REDUCED_MOTION === '1';
  const noColor = Object.hasOwn(env, 'NO_COLOR');
  let depth = 1;
  if (tty && !plain && !noColor) {
    try { depth = stream.getColorDepth?.(env) ?? 4; } catch { depth = 4; }
  }
  const unicode = !plain && tty && env.TERM !== 'linux';
  return { tty, depth, unicode, motion: tty && unicode && !calm && !noColor && depth > 1 };
}

function rgb(hex) {
  if (!/^#[\da-f]{6}$/i.test(hex)) throw new TypeError('Pip colors must be #RRGGBB.');
  return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
}
function blend(a, b, t) { return a.map((v, i) => Math.round(lerp(v, b[i], clamp(t)))); }
const distanceToSegment = (x, y, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay;
  const t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1));
  return Math.hypot(x - ax - t * vx, y - ay - t * vy);
};
function path(points, thickness, color, opacity = 1) { return { kind: 'path', points, thickness, color, opacity }; }
function curve(ax, ay, bx, by, cx, cy, thickness, color, opacity = 1, segments = 16) {
  const pts = Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments, u = 1 - t;
    return [u * u * ax + 2 * u * t * bx + t * t * cx, u * u * ay + 2 * u * t * by + t * t * cy];
  });
  return path(pts, thickness, color, opacity);
}
/** Each shape gets a padded bounding box so most pixels skip most shapes. */
function bounded(shape, aa) {
  const pad = (shape.thickness ?? 0) / 2 + 2 * aa;
  if (shape.kind === 'box') { shape.x0 = shape.cx - shape.hw - pad; shape.x1 = shape.cx + shape.hw + pad; shape.y0 = shape.cy - shape.hh - pad; shape.y1 = shape.cy + shape.hh + pad; }
  else if (shape.kind === 'ellipse') { shape.x0 = shape.cx - shape.rx - pad; shape.x1 = shape.cx + shape.rx + pad; shape.y0 = shape.cy - shape.ry - pad; shape.y1 = shape.cy + shape.ry + pad; }
  else {
    const xs = shape.points.map(q => q[0]), ys = shape.points.map(q => q[1]);
    shape.x0 = Math.min(...xs) - pad; shape.x1 = Math.max(...xs) + pad; shape.y0 = Math.min(...ys) - pad; shape.y1 = Math.max(...ys) + pad;
  }
  return shape;
}

/** Raster is 1 pixel per column, 2 pixels per row. Uses no terminal graphics protocol. */
export function rasterizePip(pose, { columns = 48, rows = 24, palette = PALETTE } = {}) {
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 12 || columns > 100 || rows < 6 || rows > 50) throw new RangeError('Raster size: 12..100 columns, 6..50 rows.');
  const colors = { ...PALETTE, ...palette };
  const bg = rgb(colors.background), gold = rgb(colors.eyes), purple = rgb(colors.outline), white = rgb(colors.mouth);
  const w = columns, h = rows * 2;
  // Square logical space. At a typical 1:2 terminal cell aspect, half-cells are square.
  const scale = Math.min(w, h), ox = (w - scale) / 2, oy = (h - scale) / 2;
  const p = { ...base, ...pose };
  const thickness = Math.max(0.026, 1.10 / scale);
  const aa = 0.50 / scale; // Coverage smoothing at the half-cell boundary.
  const shapes = [];
  // Rounded rectangular head: analytic signed-distance outline.
  shapes.push({ kind: 'box', cx: 0.5, cy: 0.625, hw: 0.385, hh: 0.24, radius: 0.065, thickness, color: purple, opacity: 1 });
  // The antenna bends from its base, so a sway reads as follow-through rather than a slide.
  const tipX = 0.5 + p.antenna;
  shapes.push(curve(0.5, 0.385, 0.5 + p.antenna * 0.35, 0.30, tipX, 0.225, thickness, gold, 1, 8));
  shapes.push({ kind: 'ellipse', cx: tipX, cy: 0.175, rx: 0.045, ry: 0.045, color: gold, opacity: 1 });
  const ey = 0.59 + p.gazeY * 0.025;
  for (const [cx, openness] of [[0.35, p.left], [0.65, p.right]]) {
    const x = cx + p.gazeX * 0.03;
    const normal = 1 - p.happy;
    const open = Math.max(0, openness);
    // Lids squash the eye a little wider as they close; wide eyes stretch taller.
    const rx = 0.055 * (1 + 0.18 * Math.max(0, 1 - open));
    const ry = Math.max(0.008, 0.055 * open);
    if (normal > 0.001) shapes.push({ kind: 'ellipse', cx: x, cy: ey, rx, ry, color: gold, opacity: normal });
    if (p.happy > 0.001) shapes.push(curve(x - 0.052, ey + 0.018, x, ey - 0.065, x + 0.052, ey + 0.018, thickness * 1.1, gold, p.happy));
  }
  // A quadratic curve morphs the mouth continuously instead of swapping glyphs.
  shapes.push(curve(0.445, 0.665 - p.skew * 0.025, 0.5, 0.665 + p.smile * 0.095, 0.555, 0.665 + p.skew * 0.025, thickness * 0.85, white));
  if (p.brow > 0.001) shapes.push(curve(0.608, 0.48, 0.655, 0.44, 0.70, 0.48, thickness * 0.78, gold, p.brow));
  if (p.signal > 0.001) {
    shapes.push(curve(tipX - 0.10, 0.12, tipX - 0.14, 0.175, tipX - 0.10, 0.23, thickness * 0.75, gold, p.signal, 8));
    shapes.push(curve(tipX + 0.10, 0.12, tipX + 0.14, 0.175, tipX + 0.10, 0.23, thickness * 0.75, gold, p.signal, 8));
  }
  if (p.spark > 0.001) {
    for (const [x, y] of [[0.12, 0.28], [0.88, 0.31]]) {
      const r = 0.024 + p.spark * 0.013;
      shapes.push(path([[x - r, y], [x + r, y]], thickness * 0.75, gold, p.spark));
      shapes.push(path([[x, y - r], [x, y + r]], thickness * 0.75, gold, p.spark));
    }
  }
  for (const s of shapes) bounded(s, aa);
  const ca = Math.cos(p.tilt), sa = Math.sin(p.tilt);
  const pixels = new Uint8Array(w * h * 3);
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    let x = (px + 0.5 - ox) / scale - 0.5;
    let y = (py + 0.5 - oy) / scale - 0.615 + p.lift;
    [x, y] = [x * ca + y * sa + 0.5, -x * sa + y * ca + 0.615];
    let color = bg;
    for (const s of shapes) {
      if (x < s.x0 || x > s.x1 || y < s.y0 || y > s.y1) continue;
      let d;
      if (s.kind === 'box') {
        const qx = Math.abs(x - s.cx) - s.hw + s.radius;
        const qy = Math.abs(y - s.cy) - s.hh + s.radius;
        const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - s.radius;
        d = Math.abs(sd) - s.thickness / 2;
      } else if (s.kind === 'ellipse') {
        // Gradient-normalised distance keeps a nearly closed eye a crisp line rather than a smudge.
        const dx = (x - s.cx) / s.rx, dy = (y - s.cy) / s.ry;
        const k = Math.hypot(dx, dy), g = Math.hypot(dx / s.rx, dy / s.ry);
        d = g > 1e-9 ? k * (k - 1) / g : -Math.min(s.rx, s.ry);
      } else {
        d = Infinity;
        for (let i = 1; i < s.points.length; i++) {
          const a = s.points[i - 1], b = s.points[i];
          d = Math.min(d, distanceToSegment(x, y, a[0], a[1], b[0], b[1]));
        }
        d -= s.thickness / 2;
      }
      const coverage = clamp(0.5 - d / (2 * aa)) * s.opacity;
      if (coverage > 0) color = blend(color, s.color, coverage);
    }
    pixels.set(color, (py * w + px) * 3);
  }
  return { width: w, height: h, pixels };
}

const ANSI16 = [[0,0,0],[128,0,0],[0,128,0],[128,128,0],[0,0,128],[128,0,128],[0,128,128],[192,192,192],[128,128,128],[255,0,0],[0,255,0],[255,255,0],[0,0,255],[255,0,255],[0,255,255],[255,255,255]];
function closest(color, candidates) {
  let best = 0, distance = Infinity;
  candidates.forEach((p, i) => { const d = p.reduce((n, v, c) => n + (v-color[c]) ** 2, 0); if (d < distance) { best = i; distance = d; } });
  return best;
}
const XTERM = Array.from({ length: 240 }, (_, i) => {
  if (i >= 216) return [8 + (i-216) * 10, 8 + (i-216) * 10, 8 + (i-216) * 10];
  const levels = [0,95,135,175,215,255];
  return [levels[Math.floor(i/36)], levels[Math.floor(i/6)%6], levels[i%6]];
});
function colorCode(color, depth, background = false) {
  if (depth >= 24) return `${background ? 48 : 38};2;${color.join(';')}`;
  if (depth >= 8) return `${background ? 48 : 38};5;${16 + closest(color, XTERM)}`;
  const n = closest(color, ANSI16);
  return String((n < 8 ? 30 : 90) + (n % 8) + (background ? 10 : 0));
}
const ESC = '\x1b[';
function paint(text, hex, depth) { return depth > 1 ? `${ESC}${colorCode(rgb(hex), depth)}m${text}${ESC}39m` : text; }

function glyphFrame(pose, { compact = false, unicode = true, depth = 24, palette = PALETTE } = {}) {
  const colors = { ...PALETTE, ...palette };
  const p = { ...base, ...pose };
  // Discrete steps: open, half, shut, happy, and a glance left, right or up. Geometric Shapes only.
  const eye = (open) => {
    if (p.happy > 0.5) return '^';
    if (!unicode) return open < 0.25 ? '-' : 'o';
    if (open < 0.2) return '─';
    if (open < 0.7) return '◒';
    const ax = Math.abs(p.gazeX), ay = Math.abs(p.gazeY);
    if (ax >= 0.45 && ax >= ay) return p.gazeX > 0 ? '◑' : '◐';
    if (p.gazeY <= -0.45) return '◓';
    return '●';
  };
  const shell = s => paint(s, colors.outline, depth);
  const eyes = s => paint(s, colors.eyes, depth);
  const mouth = paint(unicode ? p.smile < 0.25 ? '─' : '‿' : p.smile < 0.25 ? '-' : '_', colors.mouth, depth);
  const l = eyes(eye(p.left)), r = eyes(eye(p.right));
  // One row cannot put an antenna above a head. The compact form is a face only.
  if (compact) return [` ${shell('[')}${l}${mouth}${r}${shell(']')} `];
  const tip = unicode ? '●' : 'o';
  // The antenna row carries the activity signal and the success sparks.
  const top = p.signal > 0.5 ? `   (${tip})   ` : p.spark > 0.5 ? ` +  ${tip}  + ` : `    ${tip}    `;
  if (!unicode) return [eyes(top), shell('+---+---+'), `${shell('|')}  ${l}${mouth}${r}  ${shell('|')}`, shell('+-------+')];
  return [eyes(top), `${shell('╭───')}${eyes('┴')}${shell('───╮')}`, `${shell('│')}  ${l}${mouth}${r}  ${shell('│')}`, shell('╰───────╯')];
}

/** Return independently styled rows. Never includes cursor-control sequences. */
export function renderPip(poseOrState = 'ready', { size = 'standard', depth = 24, unicode = true, palette = PALETTE } = {}) {
  assertSize(size);
  const pose = typeof poseOrState === 'string' ? restPose(poseOrState) : poseOrState;
  if (!pose || KEYS.some(k => pose[k] !== undefined && !Number.isFinite(pose[k]))) throw new TypeError('Invalid Pip pose.');
  if (size === 'compact') return glyphFrame(pose, { compact: true, unicode, depth, palette });
  if (size === 'glyph') return glyphFrame(pose, { unicode, depth, palette });
  const [columns, rows] = SIZES[size];
  if (!unicode || depth < 8) {
    const simple = glyphFrame(pose, { unicode, depth, palette });
    const top = Math.floor((rows-simple.length)/2), left = Math.floor((columns-9)/2);
    return Array.from({ length: rows }, (_, i) => i < top || i >= top+4 ? ' '.repeat(columns) : ' '.repeat(left) + simple[i-top] + ' '.repeat(columns-left-9));
  }
  const raster = rasterizePip(pose, { columns, rows, palette });
  const out = [];
  // Two colors per cell: foreground is its upper half, background its lower half.
  // Consecutive cells with the same pair share SGR. Each line is self-contained.
  const cache = new Map();
  const code = (a, bg) => { const k = `${bg}:${a}`; if (!cache.has(k)) cache.set(k, colorCode(a, depth, bg)); return cache.get(k); };
  for (let row = 0; row < rows; row++) {
    let line = '', prior = '';
    for (let col = 0; col < columns; col++) {
      const i = ((row*2)*columns + col)*3;
      const j = i + columns*3;
      const top = Array.from(raster.pixels.subarray(i, i+3));
      const bottom = Array.from(raster.pixels.subarray(j, j+3));
      const pair = `${code(top, false)};${code(bottom, true)}`;
      if (pair !== prior) { line += `${ESC}${pair}m`; prior = pair; }
      line += '▀';
    }
    out.push(`${line}${ESC}39;49m`);
  }
  return out;
}

/** Only for Pip's known one-cell glyphs. Do not use as a general Unicode width utility. */
export const pipVisibleWidth = line => [...line.replace(/\x1b\[[0-9;]*m/g, '')].length;
