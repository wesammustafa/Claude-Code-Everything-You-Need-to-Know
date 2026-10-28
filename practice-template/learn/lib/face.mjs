// The glyph Pips' poses: the 9x4 Pip's and the card face's, as values the
// package's glyphs are drawn from. Pure, and Unicode only: ASCII Pip is
// still (art.mjs). Both art.mjs, which draws them, and motion.mjs, which
// asks for a frame only where the card face's glyphs change, read them.
import { renderPip, restPose } from './pip/pip.mjs';

// Pip is the pip-terminal package's (pip/pip.mjs, as it ships): its glyph
// art, colored by the theme (art.mjs). Each mood is one of the package's
// states at rest, so Pip shows only what the app saw: the big Pip's happy,
// focus and party, and the card's rest, checking, worried, done and broken.
export const STATE = { happy: 'ready', focus: 'working', party: 'success', rest: 'ready', checking: 'working', worried: 'retry', done: 'success', broken: 'error' };
// Worried keeps the package's asymmetric retry: its right eye half shut.
const MOOD = { worried: { right: 0.6 } };
// A one-shot's frame, over the mood: eyes shut, waking or awake, with a
// smile whatever the mood's mouth (a shut eye over a flat mouth would read
// as one rule); a glance toward the other window, which is the greeting's
// look right too, and its look left or up (176); a cheer's happy eyes and
// sparks, or happy eyes alone; or a hop's sparks alone, its eyes the mood's.
const OPEN = { left: 1, right: 1, happy: 0, smile: 1 };
const FRAME = {
  shut: { ...OPEN, left: 0, right: 0 }, waking: { ...OPEN, left: 0.45, right: 0.45 }, awake: OPEN,
  glance: { ...OPEN, gazeX: 0.7 }, lookLeft: { ...OPEN, gazeX: -0.7 }, lookUp: { ...OPEN, gazeY: -0.7 },
  cheer: { happy: 1, smile: 1.2, spark: 1 }, glad: { happy: 1, smile: 1.2 }, sparks: { spark: 1 },
};
const over = (mood, frame) => ({ ...restPose(STATE[mood]), ...MOOD[mood], ...FRAME[frame] });
// `a` moved `u` of the way to `b`, each number linearly.
const mix = (a, b, u) => Object.fromEntries(Object.entries(b).map(([key, v]) => [key, typeof v === 'number' ? a[key] + (v - a[key]) * u : v]));
// Where `ms` is in a face (a FRAME name, none for the mood's own face, or a
// track of [ms, frame] keyframes, motion.mjs's SHOTS): the keyframes' frames
// either side, and how far from the one to the other.
function trackAt(face, ms) {
  const keys = Array.isArray(face) ? face : [[0, face ?? null]];
  const k = keys.findIndex(([at]) => at > ms);
  const [[from, a], [to, b]] = k > 0 ? [keys[k - 1], keys[k]] : [keys.at(k), keys.at(k)];
  return [a, b, to > from ? (ms - from) / (to - from) : 0];
}

// Pip's pose `ms` into `face`, each frame over the mood and each value
// interpolated linearly between the keyframes either side, so only the
// package's glyphs step (181). `passing`: where the card face's mood
// changed mid one-shot (motion.mjs's cardFace), the face it showed then,
// `from` ({ mood, face, ms }, and its own `passing` where it passed too),
// and how far from it, `u`: each value moves linearly from that face's to
// this one's.
export function facePose(mood, face, ms = 0, passing) {
  const [a, b, u] = trackAt(face, ms);
  const pose = mix(over(mood, a), over(mood, b), u);
  if (!passing) return pose;
  const { from, u: moved } = passing;
  return mix(facePose(from.mood, from.face, from.ms, from.passing), pose, moved);
}

// The card face's 7 cells for `pose`, uncolored: ` [●‿●] `, with a hop's or
// cheer's sparks, which one row has no antenna for, on its sides.
export function faceCells(pose, unicode = true) {
  const [row] = renderPip(pose, { size: 'compact', depth: 1, unicode });
  return pose.spark > 0.5 ? `+${row.slice(1, -1)}+` : row;
}
