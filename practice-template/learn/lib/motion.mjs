// When the screen moves: one-shot progress, the gates for ambient loops, and
// the time until the next frame. Pure: it reads no clock and picks nothing at
// random. The time comes in as `at`, the stamps as `s.fx` (flow.mjs).
import { C } from './copy.mjs';
import { faceCells, facePose } from './face.mjs';
import { beatOf, cardMood, checkOnlyWords, childSince, GRACE_MAX_MS, hidesRuns, IDLE_MS, isDone, isLastBeat, lessonOf, longWait, stepOf, watching, whileRunsOpen } from './flow.mjs';

// The frame at rest: what every screen draws when nothing moves.
export const REST = { at: Infinity };

// Every timing of the motion layer, in milliseconds (design 4.3). Frames land
// on the 40 ms grid; loops tick every 80 ms, and every 240 ms after 10 s.
// The moments inside each one-shot are its SHOTS entry, below.
export const TIMING = {
  grid: 40, tick: 80, slowTick: 240, slowAfter: 10_000,
  // One-shots: none lasts over 1.2 s but Pip's greeting on the welcome and
  // resume, and its look around on the complete screen once the rest is
  // still (176).
  entrance: 160, notYet: 360, hop: 240, cheer: 360, stepDone: 560, levelUp: 800, complete: 1_200, welcome: 480, itemPass: 160, greet: 5_000, lookAround: 2_400,
  // A check or git child: the spinner from 150 ms, its seconds from 3 s.
  spinnerFrom: 150, elapsedFrom: 3_000,
  // A file change: the sweep and Pip's glance. Pip's blink, every 6 s.
  sweep: 400, glance: 1_200, blink: 160, blinkEvery: 6_000,
  // On a card that watches, Pip's look to one side and back (189): 800 ms,
  // the first 9 s after the gates open, then one every 18 s, so at most one
  // every 15 s and each 3 s from the nearest blink.
  peek: 800, peekFrom: 9_000, peekEvery: 18_000,
  // The reading grace: 400 ms a word of the newest text, 3 s to 20 s; and
  // the quiet after a key.
  perWord: 400, graceMin: 3_000, graceMax: GRACE_MAX_MS, keyQuiet: 4_000,
  // Where the detailed Pip's pose jumps, it eases from the pose it showed
  // (181): over `pipFade` for a key that ends its greeting or shuts its
  // ambient gate, over `pipBreathIn` as the gate opens and it breathes.
  // Where the card face's mood changes mid one-shot, it passes from the
  // face it showed to the new one over `mood`.
  pipFade: 320, pipBreathIn: 800, mood: 80,
};

// The look marker's notches across the pulse line.
export const NOTCHES = 12;

// A face track from its steps, [ms, frame] each, frame an art.mjs FRAME
// name or null for the mood's own face: each frame holds until one grid
// step before the next, so a frame drawn on the 40 ms grid shows one
// exactly, and Pip passes from one to the next between (181).
const track = (...steps) => steps.flatMap(([ms, frame], k) => {
  const next = steps[k + 1]?.[0];
  return next === undefined || next - TIMING.grid <= ms ? [[ms, frame]] : [[ms, frame], [next - TIMING.grid, frame]];
});

// The moments inside each one-shot (design 2.3 and 4.3), under the same names
// as its TIMING entry, which it rests at: `every`, how often its frame may
// change, where the tests sample it, and the moments it changes at, in ms
// from its start. `face`: the 9x4 Pip's or the card face's keyframes,
// [ms, frame], interpolated between and drawn through the package's glyphs;
// a one-shot that moves only Pip's face asks for frames at its moments.
export const SHOTS = {
  // The top rule grows from the pill, a third a frame, until Pip lands at
  // `land`, its eyes shut, and opens them through half-lids; the trail's
  // new stop is hollow until then, then a ring.
  entrance: { every: 40, land: 80, face: track([80, 'shut'], [120, 'waking'], [160, null]) },
  // The line's mark is hollow until `pop`; Pip opens both eyes at the
  // learner from 160 ms to the end, then wears its worried face again.
  notYet: { every: 80, pop: 80, face: track([0, null], [160, 'awake'], [360, null]) },
  hop: { every: 240, face: track([0, 'sparks']) },
  cheer: { every: 360, face: track([0, 'sparks']) },
  // The stop is a spark until `pop`, when its link half fills; by `fill`
  // the link and the progress rule are whole. Each command without a tick
  // gets one, a `tick` apart. From `strokes` the check mark draws a stroke
  // every `stroke`, then the sparks.
  stepDone: { every: 40, pop: 120, fill: 240, tick: 120, strokes: 320, stroke: 80 },
  // Pip's eyes are shut, then open through half-lids by 240 ms, and the
  // banner wipes in until `whole`, when Pip wears its focus face. Then the
  // arrow fills a third every `fill` and its head and the new star land at
  // `head`.
  levelUp: { every: 40, whole: 480, fill: 80, head: 720, face: track([0, 'shut'], [200, 'waking'], [240, 'awake'], [480, null]) },
  // The confetti changes every `fall`: from 24 rows it falls across its row
  // and the blank under it, below 24 it appears `first` glyphs, then `more`
  // at a time. Pip cheers with sparks, and COMPLETE stamps in, until `whole`.
  // The ticks appear in turn from `ticks` to `ticksBy`, each on the 40 ms
  // grid, so with five the gaps are 80 and 40 ms in turn. From `light` one
  // light runs the whole trail by the last frame before the end.
  complete: { every: 40, fall: 400, first: 2, more: 3, whole: 480, ticks: 560, ticksBy: 800, light: 840 },
  // The fuse lights more of the path every `fuse`, a link at a time on
  // Beginner's five, and reaches the cup at `cup`; from `pulse` one pulse
  // crosses the arrow, a cell every `cell`. Pip wakes in its greeting.
  welcome: { every: 80, fuse: 80, cup: 320, pulse: 320, cell: 80 },
  // Pip's greeting on the welcome and resume (176). On the welcome the 9x4
  // Pip wakes, `wake` (the boot frame's wake-up too); on resume it starts
  // awake. Then, `face`, it looks left, passes the centre, looks right and
  // up; from 1840 ms its eyes are happy and its antenna row sparks every
  // other 320 ms; it blinks through half-lids, and is awake to the end
  // (greetFace). It plays once per opening of the app (flow.mjs stamps
  // fx.greet).
  // The detailed Pip's, `raster`, a frame every `every`: its eyes are wide
  // and its antenna flicks once until `wide`; then its eyes ease happy by
  // `glad`, and its antenna waves, a swing every `swing`, whole by `waved`.
  // It hops at each of `hops`, for `hop`, with a spark. Its eyes ease open
  // from `open` to `look`, look left then right until `up`, up until
  // `again`, and ease happy again by the second hop. From `back` all of it
  // eases back to the pose, which it reaches at the end.
  greet: {
    every: 40,
    wake: track([0, 'shut'], [80, 'waking'], [160, null]),
    face: track([0, null], [640, 'lookLeft'], [1_000, null], [1_040, 'glance'], [1_440, 'lookUp'],
      [1_840, 'cheer'], [2_160, 'glad'], [2_480, 'cheer'], [2_800, 'glad'], [3_120, 'cheer'], [3_440, 'glad'], [3_760, null],
      [4_240, 'waking'], [4_280, 'shut'], [4_600, 'waking'], [4_640, null]),
    raster: { every: 40, wide: 300, glad: 700, waved: 800, swing: 1_100, hops: [700, 3_300], hop: 450, open: 1_200, look: 1_500, up: 2_500, again: 3_000, back: 4_500 },
  },
  // On the complete screen, after the cheer and once the rest is still,
  // Pip looks left, back and right, with its happy eyes between and at the
  // end (176), each look through the centre, its eyes open, for one frame
  // either side (182), as the greeting's look passes through it.
  lookAround: {
    every: 40,
    face: track([0, null], [1_160, 'awake'], [1_200, 'lookLeft'], [1_560, 'awake'], [1_600, null],
      [1_960, 'awake'], [2_000, 'glance'], [2_360, 'awake'], [2_400, null]),
  },
  // On the check-only card, the mark of an item that starts passing is
  // hollow until `pop`, then a ring, then the check mark.
  itemPass: { every: 80, pop: 80 },
  // One segment crosses the pulse line, a fifth of the way each frame.
  sweep: { every: 80 },
  // Pip looks toward the other window, then back: one change each way.
  glance: { every: 1_200, face: track([0, 'glance']) },
  // Pip's blink, an ambient loop's (TIMING.blink): through half-lids, shut,
  // and open again through them.
  blink: { every: 40, face: track([0, 'waking'], [40, 'shut'], [120, 'waking'], [160, null]) },
  // On a card that watches, Pip's ambient look (TIMING.peek, 189): toward
  // the other window, the next time away from it, and back to the face it
  // rests in, which is the centre; one change each way, its eyes open. It
  // is a look the app did not make, so the pulse line shows nothing for it.
  peekRight: { every: 40, face: track([0, 'glance'], [TIMING.peek, null]) },
  peekLeft: { every: 40, face: track([0, 'lookLeft'], [TIMING.peek, null]) },
};

// The moments a face track changes the face, in ms from its start: its
// first named frame, each change of frame, and `end` where it does not end
// on the mood's own face. Between them a frame on the grid shows the same
// face (181).
export function faceMoments(face, end) {
  const out = face.filter(([, frame], k) => frame !== (k ? face[k - 1][1] : null)).map(([ms]) => ms);
  return face.at(-1)[1] === null ? out : [...out, end];
}

// The 9x4 Pip's greeting track on `view`: on the welcome it wakes first.
const GREET_FACE = {
  welcome: [...SHOTS.greet.wake, ...SHOTS.greet.face.filter(([ms]) => ms > SHOTS.greet.wake.at(-1)[0])],
  resume: SHOTS.greet.face,
};
export const greetFace = (view) => GREET_FACE[view] ?? GREET_FACE.resume;

// One-shot progress 0..1; 1 once a later key arrived.
export function oneShot(s, at, start, ms) {
  if (start === undefined || s.fx?.key > start) return 1;
  return Math.min(1, Math.max(0, (at - start) / ms));
}

const NEVER = -Infinity;
const words = (text) => (text.match(/\S+/g) ?? []).length;

// The screens with an ambient part: Pip's blink on the welcome and on a card
// with nothing to answer; the look marker while a card watches, and there
// Pip's blink and look to the side too, the check-only card's included (189).
const AMBIENT = ['welcome', 'step', 'checkonly'];

// An overlay, or idle: no one-shot and no ambient loop moves. Only an
// overlay stops the spinner, its seconds and the bounce: they show a child
// that is still running (for at most 150 s an item).
// A long wait (ticket 103) is never idle: the marker keeps stepping, one
// frame for each look the app really takes.
const idle = (s, at) => !longWait(s) && Boolean(s.beat?.idle || at - s.lastActivity >= IDLE_MS);
export const frozen = (s, at) => Boolean(s.overlay) || idle(s, at);

// The words of the newest text: on a step card a "Not yet" line or feedback
// that came after the card opened, else the card itself; on the welcome and
// the check-only card, their own words. A rung needs no count: the hint box
// holds ambient loops anyway.
function newestWords(s) {
  if (s.view === 'welcome') {
    return words([C.hi(s.facts.name), C.pip1, C.pip2, C.twoWindows, C.thisWindow, ...C.thisWindowLines, C.otherWindow, ...C.otherWindowLines, C.openSecond, C.comeBack].join(' '));
  }
  if (s.view === 'checkonly') return words([...checkOnlyWords(s, lessonOf(s)), ...lessonOf(s).items].join(' '));
  const st = s.beat;
  if (s.view !== 'step' || !st) return 0;
  const fx = s.fx;
  if (fx.text > Math.max(fx.open ?? NEVER, fx.view ?? NEVER)) {
    if (st.status === 'fail') return words(st.fail.hint ?? st.fail.paths.join(' '));
    return words(st.feedback?.because ?? '');
  }
  const beat = beatOf(s);
  // A code block counts the lines the card shows: its window, the Windows
  // line in its place, or nothing where it waits behind h.
  const shown = (l) => (l.key !== 'code' ? l.text : hidesRuns(s) ? '' : (s.facts.win32 && l.win) || l.lines.slice(l.from - 1, l.to).join(' '));
  return words([stepOf(s).title, ...beat.lines.map(shown), beat.ask ?? '', ...beat.options.map((o) => o.text)].join(' '));
}

// Reading that needs an answer: a question with its options, a typed
// answer, the y/n before the exact command, the hint box, or a long wait's
// box with its question open (ticket 150).
const answering = (s) => s.view === 'step' && Boolean(s.beat) && !isDone(s.beat) && (Boolean(beatOf(s).ask) || s.beat.rung >= 0 || s.beat.confirm || whileRunsOpen(s));

// Whether ambient loops (look marker, blink, Pip's look to the side) may
// draw: not during the reading grace (400 ms a word of the newest text, 3 s
// to 20 s, ended by an activity stamp), not within 4 s of a key, not at
// idle, not with an overlay, not beside a question, options, a typed answer
// or the hint box. The spinner and bounce never ask it: they follow the
// running child, and stop for an overlay.
export function ambientAllowed(s, at) {
  if (!AMBIENT.includes(s.view) || frozen(s, at)) return false;
  return at >= quietFrom(s) && !answering(s);
}

// The detailed Pip's three gates for its controller at `at` (s null on the
// boot frame), the same for its pose and its next frame in one draw. No
// motion with the screen's motion off (calm, NO_COLOR, plain, TERM=dumb, a
// tripped write budget), with an overlay or at idle; its ambient life
// (blinks, glances, twitches) only where ambientAllowed says; breathing, a
// redraw every 120 ms, only on a local truecolor terminal.
export function pipGates(s, at, { motion, truecolor, remote }) {
  const moving = motion && !(s && frozen(s, at));
  const ambient = moving && Boolean(s) && ambientAllowed(s, at);
  return { motion: moving, ambient, breathing: ambient && truecolor && !remote };
}

// Where the look marker stands: from the left, one notch on for each look
// that landed once it may show, round again after the last; null before the
// first. flow.mjs counts the looks since the newest stamp that holds it back
// or starts it again (a sweep's among them), with the times of those the
// gates can still hold back: a look before the gates opened moves nothing.
function lookNotch(s) {
  const looks = s.fx.looks;
  if (!looks || !watching(s)) return null;
  const from = quietFrom(s);
  const n = looks.n - looks.early.filter((x) => x < from).length;
  return n > 0 ? (n - 1) % NOTCHES : null;
}

// Where Pip blinks: the welcome, the check-only card, and a step card that
// is not its step's done (Pip wears its done face there). Since 189 a card
// that watches blinks too, as Pip watches the learner work; a step card
// watches only while its beat is not done, and the check-only card while
// its lesson has a folder, where the learner follows the lesson page in
// the other window. ambientAllowed keeps it from a card with something to
// answer, and childAt from r's run.
function blinks(s) {
  if (s.view === 'welcome' || s.view === 'checkonly') return true;
  if (s.view !== 'step' || !s.beat) return false;
  return !(isDone(s.beat) && isLastBeat(s));
}
// Where Pip also looks to the side now and then (189): a step card whose
// beat watches a file, the check or git, and the check-only card that
// watches its lesson's check.
const peeks = (s) => ['step', 'checkonly'].includes(s.view) && Boolean(watching(s));

// When the reading grace and the quiet after the last key are both over.
// flow.mjs counts the marker's looks from the newest stamp this reads, and
// keeps 20 s of them: the key quiet is shorter than the longest grace.
function quietFrom(s) {
  const fx = s.fx;
  const grace = fx.activity > newestStamp(fx) ? NEVER : graceEnd(s);
  return Math.max(grace, (fx.key ?? NEVER) + TIMING.keyQuiet);
}
const newestStamp = (fx) => Math.max(fx.view ?? NEVER, fx.open ?? NEVER, fx.text ?? NEVER);
// Where the reading grace of the newest text ends, with no file change.
const graceEnd = (s) => newestStamp(s.fx) + Math.min(TIMING.graceMax, Math.max(TIMING.graceMin, newestWords(s) * TIMING.perWord));

// Where Pip's ambient life counts from (189): the moment the gates opened on
// this card, which a later file change never moves. quietFrom drops the
// reading grace once a file changes, so its moment jumps back to the end of
// the key quiet, seconds before the change; counted from there, the blinks
// and looks would shift mid-card, and a look could follow the last one 8 s
// later. The life counts instead from the grace's end, or from the
// first file change since the newest words where that ended it sooner
// (flow.mjs stamps it), and from the key quiet's end where that is later.
function lifeFrom(s) {
  const fx = s.fx;
  const cut = fx.activityFirst > newestStamp(fx) ? fx.activityFirst : Infinity;
  return Math.max(Math.min(graceEnd(s), cut), (fx.key ?? NEVER) + TIMING.keyQuiet);
}

// When a screen's ambient gates last opened, or will: the end of the
// reading grace or of the quiet after a key. (A file change that ends idle
// opens them too, at no new moment of these.)
export const ambientOpened = (s) => quietFrom(s);

// Pip's ambient life, from lifeFrom (189): a blink for the first 160 ms of
// every 6 s, the first as the gates open; and on a card that watches, a
// look to the side, the first at 9 s, toward the other window, then every
// 18 s, away from it and toward it in turn. Each: its part (by `n`, its
// count from the first), how long it lasts, its first start and how often
// it comes after, and where it plays. Its moments are a function of time
// alone.
const LIVES = [
  { part: () => 'blink', ms: TIMING.blink, from: 0, every: TIMING.blinkEvery, on: blinks },
  { part: (n) => (n % 2 ? 'peekLeft' : 'peekRight'), ms: TIMING.peek, from: TIMING.peekFrom, every: TIMING.peekEvery, on: peeks },
];

// The start of the file change's glance (shotStarts') that shows at `at` or
// showed last before it, or undefined.
function glanceBy(s, at) {
  const latest = shotStarts(s).glance;
  return latest <= at ? latest : shotStarts(s, at).glance;
}

// Whether a blink or look from `start`, `ms` long, meets the glance from `g`
// or starts the moment it ends: that glance covers it, so it is skipped
// whole. Played on after the glance, Pip's eyes would jump from the glance
// straight to the other side or to shut lids; skipped, they rest at the
// centre at least one frame before the next blink or look starts (189).
const covered = (g, start, ms) => g !== undefined && g < start + ms && start <= g + TIMING.glance;

// Pip's ambient life on the card or the welcome at `at`, its gates apart:
// a blink, or on a card that watches a look to the side, with how far
// into it; null between, and for one a glance covers. The two never meet:
// a look starts 3 s after a blink and is over 2.2 s before the next.
function lifeAt(s, at) {
  const from = lifeFrom(s);
  if (!Number.isFinite(from) || at < from) return null;
  for (const life of LIVES) {
    if (!life.on(s) || at - from < life.from) continue;
    const n = Math.floor((at - from - life.from) / life.every);
    const start = from + life.from + n * life.every;
    if (at - start < life.ms) return covered(glanceBy(s, at), start, life.ms) ? null : { part: life.part(n), ms: at - start };
  }
  return null;
}

// Milliseconds from `at` until Pip's ambient life next changes its face:
// the next moment of the blink or look that plays, or the start of the
// next one. One a glance covers asks for no frame: the glance's face shows
// over it (189).
function lifeIn(s, at) {
  const from = lifeFrom(s);
  if (!Number.isFinite(from)) return null;
  const g = glanceBy(s, at);
  const next = [];
  for (const life of LIVES) {
    if (!life.on(s)) continue;
    // Later ones than the one `at` is in, past any the glance covers.
    for (let n = Math.max(0, Math.floor((at - from - life.from) / life.every)); ; n++) {
      const start = from + life.from + n * life.every;
      if (covered(g, start, life.ms)) continue;
      const moment = faceMoments(SHOTS[life.part(n)].face, life.ms).map((ms) => start + ms).find((t) => t > at);
      if (moment !== undefined) {
        next.push(moment - at);
        break;
      }
    }
  }
  return next.length ? Math.min(...next) : null;
}

// Whether a check or git child runs at `m` (childSince's): its spinner and
// the checking face own that time, so Pip's blink and look wait (189).
const childAt = (s, m) => {
  const since = childSince(s);
  return since !== undefined && m >= since;
};


// What every moving part draws at rest, and while frozen: each one-shot at
// its end (1), no spinner, no seconds, no ambient loop: no look marker
// (`look`, its notch), no blink and no look to the side (`peek`), so
// nothing in `ms`. `checking`: Pip wears its checking face whenever the
// card says "Checking"; with motion, only once the spinner turns.
export const REST_PHASES = Object.freeze({ entrance: 1, notYet: 1, hop: 1, cheer: 1, stepDone: 1, levelUp: 1, complete: 1, welcome: 1, itemPass: 1, greet: 1, lookAround: 1, sweep: 1, glance: 1, spinner: null, elapsed: null, checking: true, ambient: false, look: null, blink: false, peek: false, ms: Object.freeze({}) });

// A check or git child's spinner (its start, flow.mjs's childSince): its
// first tick is the first 40 ms boundary from its start once it has run
// 150 ms, then one every 80 ms.
const FIRST_TICK = Math.ceil(TIMING.spinnerFrom / TIMING.grid) * TIMING.grid;

// The card face's mood as it shows at `at` (cardMood's `mood`, with its
// child's start `since`): checking only once the spinner turns.
const moodShown = (mood, since, at) => (mood !== 'checking' || (since !== undefined && at - since >= FIRST_TICK) ? mood : 'rest');
// When the face the card shows last changed mood, at or before `at`, on
// this card (181), and the mood it showed before: flow.mjs stamps each
// change of its mood, and the face changes there if it showed another mood
// before; checking shows from its spinner's first tick, after rest.
// Undefined where it never did.
function moodChanged(s, at) {
  const mood = cardMood(s);
  if (!mood) return undefined;
  const entered = Math.max(s.fx.view ?? NEVER, s.fx.open ?? NEVER);
  const stamp = s.fx.mood;
  const since = childSince(s);
  const turned = mood === 'checking' && since !== undefined ? since + FIRST_TICK : NEVER;
  const was = stamp && moodShown(stamp.was, stamp.since, stamp.at);
  const changed = stamp?.at > entered && stamp.at <= at && was !== moodShown(mood, since, stamp.at) ? stamp.at : NEVER;
  if (turned > entered && turned <= at && turned >= changed) return { at: turned, was: 'rest' };
  return changed === NEVER ? undefined : { at: changed, was };
}

// The card face with phases `ph`, over the mood `shown` it rests in (169):
// the one-shot that sets it, its track and how far into it (`part`, `face`,
// `ms`), or none. Sparks for a hop or a cheer; away while the card enters
// (null), then landing with its eyes shut; on a new "Not yet", a nod; on a
// file change, a glance, unless a check runs; and its ambient life, a
// blink or, on a card that watches, a look to the side, which a file
// change's glance takes over from. Checking, with motion: its checking
// face once a child has run 150 ms, and it holds still.
function faceWith(shown, ph) {
  const mood = shown === 'checking' && !ph.checking ? 'rest' : shown;
  const playing = (part) => ph.ms[part] !== undefined;
  const shot = (part) => ({ mood, part, face: SHOTS[part].face, ms: ph.ms[part] });
  if (playing('hop')) return shot('hop');
  if (playing('cheer')) return shot('cheer');
  if (playing('notYet')) return shot('notYet');
  if ((ph.ms.entrance ?? Infinity) < SHOTS.entrance.land) return null;
  if (playing('entrance')) return shot('entrance');
  if (playing('glance') && mood !== 'checking') return shot('glance');
  const life = ['blink', 'peekRight', 'peekLeft'].find(playing);
  return life ? shot(life) : { mood };
}

// The card face as it showed at `m`, over the mood it showed then (`was`):
// the one-shots that started before `m` and still played, the glance from
// the file change before `m`, and a blink or a look to the side.
function faceThen(s, m, was) {
  const ms = {};
  if (!idle(s, m)) {
    for (const [part, start] of Object.entries(shotStarts(s, m))) if (start < m && oneShot(s, m, start, TIMING[part]) < 1) ms[part] = m - start;
    const life = !childAt(s, m) && ambientAllowed(s, m) ? lifeAt(s, m) : null;
    if (life && life.ms > 0) ms[life.part] = life.ms;
  }
  return faceWith(was, { ms, checking: true });
}

// The card face's one-shots that turn Pip back to the card: each shows at
// once where it starts, as design 2.3's frames do.
const TURNS_BACK = ['notYet', 'hop', 'cheer'];

// Where the card face's mood changed mid one-shot (181), with
// `face` the face it shows at `at`: the moment and the face it showed then,
// which it passes from over TIMING.mood, or undefined. Only where a
// one-shot that started before the change played as it changed or plays
// now. None where the change starts one (its face shows at once, as design
// 2.3's frames do) or where none plays (the new face shows at once). A
// glance or a blink that starts as it passes passes on, from the face the
// passage showed then, over TIMING.mood from its start; a "Not yet", hop
// or cheer shows at once. None at idle, nor beside a question, its
// options, a typed answer, the y/n before the exact command or the hint
// box, where nothing moves; and a key ends it, as it ends every one-shot.
function moodPassage(s, at, face) {
  if (!face || idle(s, at) || answering(s)) return undefined;
  const changed = moodChanged(s, at);
  if (!changed) return undefined;
  const started = face.part === undefined ? undefined : at - face.ms;
  if (started > changed.at) {
    if (TURNS_BACK.includes(face.part) || oneShot(s, at, started, TIMING.mood) >= 1) return undefined;
    const shown = faceThen(s, started, moodShown(cardMood(s), childSince(s), started));
    const passed = moodPassage(s, started, shown);
    return passed && { at: started, from: { ...shown, passing: { from: passed.from, u: (started - passed.at) / TIMING.mood } } };
  }
  if (oneShot(s, at, changed.at, TIMING.mood) >= 1) return undefined;
  const from = faceThen(s, changed.at, changed.was);
  if (!from || started === changed.at || (from.part === undefined && started === undefined)) return undefined;
  return { at: changed.at, from };
}

// The card face at `at`, with phases `ph` (phases(s, at, caps)): faceWith's
// over the card's mood, and where it passes from the face it showed as its
// mood changed (phases' `ms.mood`), `passing`: that face, and how far from
// it.
export function cardFace(s, at, ph) {
  const face = faceWith(cardMood(s), ph);
  if (ph.ms.mood === undefined) return face;
  return { ...face, passing: { from: moodPassage(s, at, face).from, u: ph.ms.mood / TIMING.mood } };
}

// When the latest sweep started: the watcher saw a file change, or a look's
// result differed from the last. Only while the screen watches something,
// and not beside the hint box.
function sweepFrom(s) {
  if (!watching(s) || answering(s)) return undefined;
  const start = Math.max(s.fx.activity ?? NEVER, s.fx.changedAt ?? NEVER);
  return start === NEVER ? undefined : start;
}

// When each one-shot on this screen started, or undefined where it does not
// play. Each lasts its own TIMING entry. With `before`, the glance from the
// last file change before then, where newer ones started it again.
export function shotStarts(s, before = Infinity) {
  const fx = s.fx;
  const glanced = [...(fx.activityWas ?? []), fx.activity].findLast((t) => t < before);
  const on = (views, start) => (views.includes(s.view) ? start : undefined);
  const entered = Math.max(fx.view ?? NEVER, fx.open ?? NEVER);
  const st = s.view === 'step' ? s.beat : null;
  const opened = fx.open ?? NEVER;
  // The step's last beat done on this card cheers; any other pass hops.
  const last = isDone(st) && fx.passLast > opened;
  return {
    entrance: on(['step', 'checkonly'], entered === NEVER ? undefined : entered),
    // A rung is new text too, but no "Not yet".
    notYet: st?.status === 'fail' && st.rung < 0 ? fx.text : undefined,
    hop: isDone(st) && !last && fx.pass > opened ? fx.pass : undefined,
    cheer: last ? fx.passLast : undefined,
    stepDone: last ? fx.passLast : undefined,
    levelUp: on(['levelup'], fx.view),
    complete: on(['complete'], fx.view),
    welcome: on(['welcome'], fx.view),
    // Pip's greeting, once per opening: on the arrival flow.mjs stamped
    // for it, not on a later return to the welcome or resume.
    greet: fx.greet === fx.view ? on(['welcome', 'resume'], fx.greet) : undefined,
    lookAround: on(['complete'], fx.view),
    itemPass: on(['checkonly'], fx.itemPass),
    sweep: sweepFrom(s),
    // A file change: Pip glances toward the other window, until a newer
    // "Not yet", hop or cheer turns Pip back to the card.
    glance: watching(s) && !answering(s) && glanced > Math.max(fx.text ?? NEVER, fx.pass ?? NEVER, fx.passLast ?? NEVER) ? glanced : undefined,
  };
}

// When the detailed Pip's greeting started, while it plays at `at` (176);
// undefined where it does not play, is over or a key ended it, with motion
// off, an overlay or at idle.
export function greetStart(s, at, caps) {
  if (!caps?.motion || frozen(s, at)) return undefined;
  const start = shotStarts(s).greet;
  return oneShot(s, at, start, TIMING.greet) < 1 ? start : undefined;
}

// Milliseconds until the detailed Pip's greeting next moves: its next frame
// or its end; null where it does not play. main adds it to the one timer
// where it draws the detailed Pip.
export function greetFrameIn(s, at, caps) {
  const start = greetStart(s, at, caps);
  return start === undefined ? null : shotFrameIn(s, at, 'greet', start, SHOTS.greet.raster.every);
}

// Where the detailed Pip's pose jumps on the frame at `at`, after the last
// frame with it showed `shown` ({ gates, greet, view }): the moment, and
// the ms it eases over from the pose shown then (181), or null. A key that
// shuts its ambient gate or ends its greeting eases it out; the gate's
// opening eases its breathing in. None across a screen change, with motion
// off on either frame, with an overlay, or beside resume's y/n, where
// nothing moves (main stops an ease from its x still running as the letter
// acts).
export function pipJump(s, at, shown, gates) {
  if (!s || !shown || !shown.gates.motion || !gates.motion || shown.view !== s.fx.view || s.overlay || s.confirmRestart) return null;
  const key = s.fx.key;
  const cut = shown.greet !== undefined && greetStart(s, at, gates) === undefined && key > shown.greet && key < shown.greet + TIMING.greet;
  if ((shown.gates.ambient && !gates.ambient) || cut) return { at: key, ms: TIMING.pipFade };
  if (!shown.gates.ambient && gates.ambient) return { at: ambientOpened(s), ms: TIMING.pipBreathIn };
  return null;
}

// The spinner's frame and the seconds, for a child that has run `ran` ms:
// null for each until it shows.
function spun(ran) {
  const spinner = ran < FIRST_TICK ? null
    : Math.floor((Math.min(ran, TIMING.slowAfter) - FIRST_TICK) / TIMING.tick) + Math.floor(Math.max(0, ran - TIMING.slowAfter) / TIMING.slowTick);
  return { spinner, elapsed: spinner !== null && ran >= TIMING.elapsedFrom ? Math.floor(ran / 1_000) : null };
}

// Milliseconds until that child's spinner next turns, and until its seconds next change.
function spinsIn(ran) {
  let tick = ran < FIRST_TICK ? FIRST_TICK : FIRST_TICK + TIMING.tick * (Math.floor((ran - FIRST_TICK) / TIMING.tick) + 1);
  // Past 10 s the 80 ms ticks stop moving it: every 240 ms does.
  if (tick > TIMING.slowAfter) tick = TIMING.slowAfter + TIMING.slowTick * (Math.floor(Math.max(0, ran - TIMING.slowAfter) / TIMING.slowTick) + 1);
  const second = ran < TIMING.elapsedFrom ? TIMING.elapsedFrom : 1_000 * (Math.floor(ran / 1_000) + 1);
  return [tick - ran, second - ran];
}

// The boot frame (162): git's first questions at start, asked at `since`.
// It goes up on the spinner's first tick, once they have run 150 ms, with
// Pip's eyes shut, and Pip wakes as on the welcome: `ms.wake`, how far into
// SHOTS.greet.wake. Without motion it is the rest frame: Pip awake, no
// spinner.
export const BOOT_FROM = FIRST_TICK;
export function bootPhases(since, at, caps) {
  if (!caps?.motion || at === Infinity) return REST_PHASES;
  return { ...REST_PHASES, ...spun(at - since), ms: { wake: at - since - BOOT_FROM } };
}
// Milliseconds until the boot frame next differs, or null without motion.
export function bootChange(since, at, caps) {
  if (!caps?.motion) return null;
  const woke = at - since - BOOT_FROM;
  return Math.min(...spinsIn(at - since), ...faceMoments(SHOTS.greet.wake, Infinity).filter((ms) => ms > woke).map((ms) => ms - woke));
}

// What each moving part draws at `at`; the rest phases when motion is off.
// `ms`: how far into each one-shot still playing `at` is, into a blink
// while one is on, and into the card face's passage where its mood changed
// mid one-shot (`mood`), in the clock's own milliseconds, unrounded.
export function phases(s, at, caps) {
  if (!caps?.motion || at === Infinity || s.overlay) return REST_PHASES;
  const since = childSince(s);
  const { spinner, elapsed } = spun(since === undefined ? NEVER : at - since);
  const still = idle(s, at);
  const starts = Object.entries(shotStarts(s));
  const shots = Object.fromEntries(starts.map(([part, start]) => [part, still ? 1 : oneShot(s, at, start, TIMING[part])]));
  const ms = Object.fromEntries(starts.filter(([part]) => shots[part] < 1).map(([part, start]) => [part, Math.max(0, at - start)]));
  // While a child runs, its bounce holds the pulse line: no ambient loop.
  const ambient = !still && spinner === null && ambientAllowed(s, at);
  // A blink as the gates open, then every 6 s; on a card that watches, a
  // look to the side between (189). None while a child runs, before its
  // spinner turns too.
  const life = ambient && !childAt(s, at) ? lifeAt(s, at) : null;
  if (life) ms[life.part] = life.ms;
  // The card face passing from the face it showed as its mood changed.
  const passage = moodPassage(s, at, faceWith(cardMood(s), { ms, checking: spinner !== null }));
  if (passage) ms.mood = at - passage.at;
  return {
    ...shots,
    spinner,
    elapsed,
    checking: spinner !== null,
    ambient,
    look: ambient && shots.sweep === 1 ? lookNotch(s) : null,
    blink: life?.part === 'blink',
    peek: Boolean(life) && life.part !== 'blink',
    ms,
  };
}

// A one-shot still playing from `start`: milliseconds until its next frame,
// every `every` from its start (on the 40 ms grid), or its end; null once
// it is over or a key ended it.
function shotFrameIn(s, at, part, start, every) {
  if (oneShot(s, at, start, TIMING[part]) >= 1) return null;
  return Math.min(every - ((at - start) % every), start + TIMING[part] - at);
}

// Milliseconds from `e` into `face` until its next moment, or null.
const nextMoment = (face, end, e) => {
  const next = faceMoments(face, end).find((ms) => ms > e);
  return next === undefined ? null : next - e;
};

// The one-shots that move only Pip's face, each with its track on `s`.
const FACE_ONLY = { greet: (s) => greetFace(s.view), lookAround: () => SHOTS.lookAround.face, glance: () => SHOTS.glance.face, hop: () => SHOTS.hop.face, cheer: () => SHOTS.cheer.face };

// One of them still playing from `start`: milliseconds until its face next
// changes; null once it will not, it is over or a key ended it.
function faceFrameIn(s, at, part, start) {
  if (oneShot(s, at, start, TIMING[part]) >= 1) return null;
  return nextMoment(FACE_ONLY[part](s), TIMING[part], at - start);
}

// Milliseconds until the screen next differs, or null. Null under calm,
// with an overlay, at idle unless a child runs, and when nothing moves and
// no deadline waits. With `caps.raster` the detailed Pip is drawn in the
// 9x4 Pip's place, so the 9x4 Pip's face moments (its greeting, its look
// around, its blinks) ask for nothing: main asks for the raster's (181).
export function nextChange(s, at, caps) {
  if (!caps?.motion || s.overlay) return null;
  const still = idle(s, at);
  const times = [];
  // A one-shot still playing: its next frame, or its end; one that moves
  // only Pip's face, the next moment its face changes.
  if (!still) {
    for (const [part, start] of Object.entries(shotStarts(s))) {
      if (FACE_ONLY[part] && caps.raster) continue;
      const next = FACE_ONLY[part] ? faceFrameIn(s, at, part, start) : shotFrameIn(s, at, part, start, SHOTS[part].every);
      if (next !== null) times.push(next);
    }
  }
  const since = childSince(s);
  if (since !== undefined) times.push(...spinsIn(at - since));
  // The card face passing from the face it showed as its mood changed: the
  // next grid step of its passage where its cells change. A mood changes on
  // an event's frame, or as the spinner turns.
  const ph = moodChanged(s, at) ? phases(s, at, caps) : REST_PHASES;
  if (ph.ms.mood !== undefined) {
    const from = at - ph.ms.mood;
    const cells = (when, p) => {
      const face = cardFace(s, when, p);
      return face && faceCells(facePose(face.mood, face.face, face.ms, face.passing));
    };
    const now = cells(at, ph);
    const steps = Array.from({ length: TIMING.mood / TIMING.grid }, (_, k) => from + (k + 1) * TIMING.grid);
    const step = steps.find((t) => t > at && cells(t, phases(s, t, caps)) !== now);
    if (step !== undefined) times.push(step - at);
  }
  // The moment ambient loops may start, on a screen that has one: the grace
  // and the key quiet both over. Once they run, each blink's moments, and
  // on a card that watches each look to the side's (189), none while a
  // child runs, none for one a glance covers, and none at idle. The look
  // marker moves only on a look, and the app's 1 s tick draws the first
  // idle frame, where it stops.
  const quiet = quietFrom(s);
  if (!still && AMBIENT.includes(s.view) && !answering(s) && quiet > at) times.push(quiet - at);
  const life = !still && !caps.raster && ambientAllowed(s, at) && !childAt(s, at) ? lifeIn(s, at) : null;
  if (life !== null && (longWait(s) || at + life < s.lastActivity + IDLE_MS)) times.push(life);
  return times.length ? Math.min(...times) : null;
}
