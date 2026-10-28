// Draws a state as exactly `rows` lines, none wider than `cols - 1`. Four
// regions: the header (where am I), the body (what to do now, with how it's
// going at the bottom of the card), and the key bar pinned to the bottom of
// the frame's box, which a taller window centers (191).
import { banner, bannerWidth, burst, confetti, pip, PIP_FACE, PIP_RASTER, pipFace, pipRaster, pipShown } from './art.mjs';
import { C } from './copy.mjs';
import { bootPhases, cardFace, greetFace, NOTCHES, oneShot, phases, REST, SHOTS, TIMING } from './motion.mjs';
import {
  answerKey, asksFolder, asksHere, asStarted, authoredTier, backOffered, beatOf, cardOf, checkOnlyWords, contentOf, copyable, doneBefore, folderHere, folderKey, folderOf, folderOptions, folderProblem, hintAvailable, hintStatus, introOptions, isDone, isLastBeat as lastShown, lessonNumber, lessonOf, levelFolder, levelKey, levelLessons, levelOf, levelsOf, missingNeeds, moreHelpGives, nextLessonOf, offered, pickWarmups, pinOf, recallOf, repoNeed, rungsOf, stepNote, stepOf, stepsOf, tearDownLeft, tierOf, tiersOf, toFinish, tryFirst, unmet, whileRunsOf,
} from './flow.mjs';
import { cut, graphemes, inline, pad, plainText, strip, width, wrapRuns } from './text.mjs';
import { tierLabel, tierPill, TIER_STYLE } from './theme.mjs';
import { mix, ruleTiers, scaleMix, TIERS } from './tiers.mjs';
import { COMMANDS_URL, GIT, indexLevel, indexUrl, OWN_PARTS, READS, SLOW } from './content.mjs';
import { cleanListed, needsChange } from './status.mjs';

export const MIN = { cols: 60, rows: 20 };
// The frame's box (191): at most 80 columns wide (frameOf) and BOX_ROWS
// tall, centered both ways, so in a tall window the key bar stays under the
// content it belongs to. The tallest screen at 80 columns is 40 rows (i-5's
// W2.0 with its first hint and a toast, in ASCII, for a learner who skipped
// the lessons before it; 38 for one who did them, 2026-10-18), so no screen
// gives way in the box that did not in the window before, and a window up to
// 40 rows tall draws as it always did. Below 80 columns a few of i-5's W2
// screens are taller (up to 45 rows at 60 columns): in a tall window they
// give up blank rows only, the blank over the card and its spacers. Below
// the minimum the window is the box: the small screen fills it.
export const BOX_ROWS = 40;
const boxOf = ({ cols, rows }) => ({ cols, rows: cols < MIN.cols || rows < MIN.rows ? rows : Math.min(rows, BOX_ROWS) });
// The box's lines in a window `rows` tall: equal blank rows above and below,
// the odd one below.
function centered(out, rows) {
  const above = Math.floor((rows - out.length) / 2);
  return [...Array(above).fill(''), ...out, ...Array(rows - out.length - above).fill('')];
}
// Each body row says how it gives way when the body is taller than its room
// (spec 3.1, the drop order). A plain string is teaching: it is cut last.
// A blank line the layout may drop. Inside a card it keeps the card's rail;
// spacers in one group drop together.
const spacer = (text = '', group) => ({ spacer: true, text, group });
const SPACER = spacer();
// Rows that never drop: the question and its options (with a safety
// choice's line and a typed answer's input row), feedback, the hint box, the
// eased line, a Windows note, the capstone's handover line, a card's top and
// bottom borders, the welcome's git error and the resume screen's restart
// question.
// A row that is already an object, such as a code block's in the hint
// box, keeps its own place in the drop order.
const kept = (rows) => rows.map((text) => (typeof text === 'string' ? { keep: true, text } : text));
// Optional rows: the level's first warm-up explainer, the intro's Why line
// and a GUIDED card's, the next screen's recall and Go further lines and
// the ? overlay's calm line, each with its blank, teaching the learner can
// also reach another way, such as behind a key, repeats with no compact
// form, a done beat's satisfied "Done when" line, and the capstone's
// invitation to ask. The rows of one call are one sentence: they drop whole.
const optional = (rows) => {
  const whole = {};
  return rows.map((text) => ({ optional: true, text, whole }));
};
// A block that gives way whole, below 24 rows only: a repeat compacts to
// `alt`, decoration leaves `alt` behind.
const repeat = (rows, alt) => ({ block: 'repeat', rows, alt });
const decor = (rows, alt = []) => ({ block: 'decor', rows, alt });
// Kept notes that give way to `alt`, kept too, after optional teaching and
// before any teaching row is cut, at any size: the intro's notes before the
// learner starts, whose short form hands them to a key, and the next
// screen's Next up, whose `alt` is empty.
const notes = (rows, alt) => ({ block: 'notes', rows, alt });

// A lesson's title on one row, its code spans as plain text: a-4's is
// "Script Claude Code with `claude -p`".
export const titleOf = (l) => plainText(l.title);

// B1 to B5, then BC for the Beginner capstone; I1 and IC, A1 and AC alike.
export const lessonLabel = (id) => id.replace(/^([a-z])-(\d+|capstone)$/, (_, l, n) => `${l.toUpperCase()}${n === 'capstone' ? 'C' : n}`);
// A lesson's level by its guide name: 'Beginner' for b-2.
const levelName = (s, id = s.lesson) => C.levels[levelOf(s, id)];

// A folder's own name, the last part of its path.
const baseName = (path) => path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path;
// A name cut to `n` columns at most.
const shortName = (t, name, n) => cut(name, Math.max(4, n), t.unicode ? '…' : '.');
// Where the lesson's level is practised in another folder than the copy
// (ticket 86), the folder a line that sends the learner to another terminal
// means: the work folder, or the copy for a lesson pinned to it, for a
// Worked example step that runs there (ticket 183) and for a beat whose
// command names <your repo>, which runs from the copy. Null where
// everything happens in the copy, as in Beginner. The name is cut to `n`.
function placeOf(s, t, beat = null, n = 24) {
  const dir = folderHere(s);
  if (!dir) return null;
  const root = s.facts.root;
  const levelDir = levelKey(s) ? levelFolder(s, levelKey(s)) : root;
  const fromCopy = Boolean(beat) && [...beat.lines, ...beat.bottom].some((l) => l.text.includes('<your repo>'));
  if (dir !== root && !fromCopy) return C.inFolder(shortName(t, baseName(dir), n));
  return dir !== root || levelDir !== root ? C.inCopy : null;
}

// The page a warm-up recalls: its lesson's, or a level's index page (ticket
// 178), which has no lesson of its own, so its stuck link is this lesson's.
function recalledPage(s, step) {
  const level = indexLevel(step.from);
  return level ? { url: indexUrl(level), stuck: lessonOf(s).stuck } : lessonOf(s, step.from);
}

// The app's words around a quote: a level index warm-up's name the index.
const INDEX_WORDS = { ...C, ...C.fromIndex };
function wordsOf(s) {
  const step = s.view === 'step' && s.beat ? stepOf(s) : null;
  return step?.part === 'Warm-up' && indexLevel(step.from) ? INDEX_WORDS : C;
}

// The lesson page a quote's relative links point into: set for each frame.
let pageUrl = '';

// `clock.at` is the time the frame shows; the rest frame by default. `pip`
// is the detailed Pip from main: its `size`, pipSlot's for this screen, and
// its `pose` from main's controller. Without it, the 9x4 Pip.
export function render(s, size, t, clock = REST, pip = null) {
  const step = s.view === 'step' && s.beat ? stepOf(s) : null;
  pageUrl = (step?.part === 'Warm-up' ? recalledPage(s, step) : lessonOf(s))?.url ?? '';
  return centered(screenOf(s, boxOf(size), t, clock, pip).out, size.rows);
}

// The screen's lines, and its spare rows: the blank rows it pads with, or
// less than 0 when its body is taller than its room and something gives way.
function screenOf(s, size, t, clock, raster) {
  const { cols, rows } = size;
  if (cols < MIN.cols || rows < MIN.rows) return { out: small(cols, rows), spare: -1 };
  const { f, view } = viewOf(s, size, t, clock, raster);
  const { ctx, W, M, top } = f;
  const room = () => ctx.roomUnder(view.head.length);
  const overlay = s.overlay ? OVERLAYS[s.overlay](ctx) : null;
  const body = overlay?.body ?? view.body;
  const keys = overlay?.keys ?? view.keys;
  const spare = room() - 1 - heightOf(body);
  // The blank under the header is the body's first spacer, so it goes last.
  const more = t.fg('muted', t.glyph.ellipsis);
  let lines = fit([SPACER, ...body], room(), rows < 24, more);
  // When the kept rows alone overflow, a toast gives up the blank under it,
  // then goes: it is a passing note, and kept rows never drop.
  if (lines.length > room() && f.toast.length) {
    f.gap = [];
    lines = fit([SPACER, ...body], room(), rows < 24, more);
    if (lines.length > room()) {
      [f.toast, f.gap] = [[], ['']];
      lines = fit([SPACER, ...body], room(), rows < 24, more);
    }
  }
  // No screen has kept rows taller than its room without a toast; if one
  // ever does, its last rows give way rather than the key bar.
  if (lines.length > room()) lines = [...lines.slice(0, room() - 1), more];
  const out = [...top, ...view.head, ...lines];
  while (out.length < rows - 2 - f.gap.length - f.toast.length) out.push('');
  out.push(...f.toast, ...f.gap, pulseLine(ctx), keybar(t, keys, W, s.held?.name));
  return { out: out.map(placed(t, M, cols)), spare };
}

// A body's rows, each block's counted whole.
const heightOf = (body) => body.reduce((n, r) => n + (r?.block ? r.rows.length : 1), 0);

// The frame and its view, with the rows an overlay has under the view's
// header and its blank (ctx.room): what screenOf draws, and what cardMax
// measures.
function viewOf(s, size, t, clock, raster) {
  const f = frameCtx(s, size, t, clock, raster);
  const view = VIEWS[s.view](f.ctx);
  f.ctx.room = f.ctx.roomUnder(view.head.length) - 1;
  return { f, view };
}

// The big Pip's screens, each with the mood its 9x4 Pip rests in.
const BIG_PIP = { welcome: 'happy', resume: 'happy', levelup: 'focus', complete: 'party' };

// The detailed Pip's state for what the screen shows the app saw, from its
// 9x4 Pip's mood: the welcome's and resume's happy and the level-up's focus
// are ready, the complete screen's party success. At boot, git still
// answering is working. (Nothing in the app thinks, and nothing waits on
// the learner that these don't say: never thinking or waiting.)
const PIP_STATE = { happy: 'ready', focus: 'ready', party: 'success' };
// The screens whose arrival is a new event, with their one-shot.
const ARRIVAL = { levelup: 'levelUp', complete: 'complete' };

// What main's controller is set to for this screen at `at`: its `state`,
// timed from the screen's arrival (`since`, its fx stamp). A new level-up
// or complete screen is a new reaction, its `eventId` that arrival; one
// whose moment is over when Pip is first drawn on it is `immediate`, so it
// never plays late or again.
export function pipTarget(s, at) {
  if (!s) return { state: 'working' };
  const target = { state: PIP_STATE[BIG_PIP[s.view]], since: s.fx.view };
  const shot = ARRIVAL[s.view];
  if (!shot) return target;
  return { ...target, eventId: `${s.view}:${s.fx.view}`, immediate: oneShot(s, at, s.fx.view, TIMING[shot]) >= 1 };
}

// A toast that can come up on any screen, to measure a screen with one.
const STRAY = { kind: 'stray', until: Infinity };

// Where the detailed Pip goes on this screen (`s`, or null for the boot
// frame): `standard` where its extra rows fit in the rows the screen pads
// with, so no row it shows gives way, else null for the 9x4 Pip. Small
// (its eyes turn to bars) and hero are not used (174). Only on the big
// Pip's screens, with no overlay, with Unicode and truecolor: at 256 colors
// the package's soft edges round to fringes. Pip keeps its size while the
// screen is up: the room is measured with a toast (its own, and a stray
// key's) and, on resume, the y/n to start over, whether they are up or
// not. The boot frame has it only where `ahead` does, where given: the
// screen it hands over to, so Pip does not change as git answers. main
// draws with what this gives, and asks for Pip's frames only where it
// gives a raster.
export function pipSlot(s, windowSize, t, ahead = null) {
  // Measured in the frame's box, as the screen is drawn (191).
  const size = boxOf(windowSize);
  if (!t.unicode || !t.truecolor || size.cols < MIN.cols || size.rows < MIN.rows) return null;
  // A raster with no pose: enough to measure the rows it takes.
  const blank = { size: 'standard' };
  if (!s) {
    if (ahead && !pipSlot(ahead, size, t)) return null;
    return bootOf(0, size, t, REST, blank).spare >= 0 ? 'standard' : null;
  }
  if (s.overlay || !BIG_PIP[s.view]) return null;
  const busiest = [STRAY, s.toast].filter(Boolean).map((toast) => ({ ...s, toast, confirmRestart: s.confirmRestart || s.view === 'resume' }));
  return busiest.every((x) => screenOf(x, size, t, REST, blank).spare >= 0) ? 'standard' : null;
}

// A frame's width, margin and top, its toast and the blank above the pulse
// line, and the context its views draw with. `roomUnder(head)` is the rows
// a view's body has under `head` header rows, the blank under them
// included: it reads the toast and the blank as render leaves them.
function frameCtx(s, size, t, clock, raster = null) {
  const { cols, rows } = size;
  const { W, M, top } = frameOf(size);
  const f = { W, M, top, gap: [''], toast: s.toast ? para(t, `${t.lead(TOASTS[s.toast.kind].emoji)}${TOASTS[s.toast.kind].text(s.toast, s, t)}`, W, TOASTS[s.toast.kind].color) : [] };
  const roomUnder = (head) => rows - top.length - head - 2 - f.gap.length - f.toast.length;
  f.ctx = { s, t, W, inner: W - 3, cols, rows, clock, ph: phases(s, clock.at, t.caps), roomUnder, raster };
  return f;
}

// How far the check-only card's items can scroll in this window: the first
// item of the window that ends on the last item, 0 where every item fits
// or no check-only card is up. main sends it with each key, so the arrows
// move only what the card shows.
export function itemsMax(s, size, t) {
  if (s.view !== 'checkonly' || s.overlay || size.cols < MIN.cols || size.rows < MIN.rows) return 0;
  return VIEWS.checkonly(frameCtx(s, boxOf(size), t, REST).ctx).itemsMax;
}

// How far your card (the c overlay), or the comparison (173), can scroll in
// this window: the first place of the window that ends on the Commands by
// level link, 0 where it fits, null where neither is up. main sends it with
// each key, as itemsMax.
export function cardMax(s, size, t) {
  if (s.overlay !== 'card' && s.overlay !== 'compare') return null;
  if (size.cols < MIN.cols || size.rows < MIN.rows) return 0;
  return OVERLAYS[s.overlay](viewOf(s, boxOf(size), t, REST).f.ctx).max;
}

// Every frame's card width, its left margin, and the blank above it on a
// tall window.
function frameOf({ cols, rows }) {
  const W = Math.min(cols - 4, 80);
  return { W, M: Math.floor((cols - W) / 2), top: rows >= 28 ? [''] : [] };
}
const appTitle = (t) => `${t.pill('LEARN', 'accentBg')}  ${t.bold(t.fg('white', C.appName))}`;

// A frame's line in the window: the margin, ASCII where there is no
// Unicode, and cut to `cols - 1`.
const placed = (t, M, cols) => (l) => (l ? cut(' '.repeat(M) + (t.unicode ? l : ascii(l)), cols - 1, t.unicode ? '…' : '.') : '');

// The boot frame (162): before any state, while git answers the first
// questions at start, asked at `since`, if that takes over 150 ms. Pip sits
// where the welcome has it (its three head rows, then the blank), at every
// size, beside the app's line: the 9x4 Pip, or with `pip` (as render takes
// it) the detailed one, no bigger than the next screen's (pipSlot). No key
// works yet, so the key bar is blank.
export function bootFrame(since, size, t, clock = REST, pip = null) {
  return centered(bootOf(since, boxOf(size), t, clock, pip).out, size.rows);
}
function bootOf(since, size, t, clock, raster) {
  const { cols, rows } = size;
  if (cols < MIN.cols || rows < MIN.rows) return { out: small(cols, rows), spare: -1 };
  const { W, M, top } = frameOf(size);
  const ctx = { t, W, clock, ph: bootPhases(since, clock.at, t.caps), raster };
  const out = [...top, appTitle(t), '', rule(t, W), '',
    ...withPip(ctx, bigPip(ctx, BIG_PIP.welcome, SHOTS.greet.wake, into(ctx, 'wake')), [() => spinning(ctx, [t.fg('text', C.askingGit)])]).rows];
  const spare = rows - 2 - out.length;
  while (out.length < rows - 2) out.push('');
  out.push(pulseLine(ctx), '');
  return { out: out.map(placed(t, M, cols)), spare };
}

// The body in `room` rows. What gives way, in order: below 24 rows repeats
// compact; spacers drop one at a time from the bottom; below 24 rows
// decoration gives way, from the top; optional teaching drops from the
// bottom, a sentence at a time; notes take their short form; then a code
// block's lines are cut, farthest from the line the beat explains first,
// then teaching rows from the bottom, each run of cut rows under one `…`.
// Kept rows stay, so the list can still be taller than `room`.
export function fit(body, room, short, more) {
  let list = body;
  const size = (l = list) => l.reduce((n, r) => n + (r?.block ? r.rows.length : 1), 0);
  if (short && size() > room) list = list.flatMap((r) => (r?.block === 'repeat' ? r.alt : [r]));
  const gone = new Set();
  const live = () => list.filter((_, k) => !gone.has(k));
  while (size(live()) > room) {
    const i = list.findLastIndex((r, k) => r?.spacer && !gone.has(k));
    if (i < 0) break;
    const { group } = list[i];
    list.forEach((r, k) => {
      if (k === i || (group && r?.spacer && r.group === group)) gone.add(k);
    });
    // A group can free more rows than were needed: the single spacers it
    // passed over come back, from the top, while they fit.
    if (group) {
      for (const k of [...gone].sort((a, b) => a - b)) if (!list[k].group && size(live()) < room) gone.delete(k);
    }
  }
  list = live();
  while (short && size() > room) {
    const i = list.findIndex((r) => r?.block === 'decor');
    if (i < 0) break;
    list = [...list.slice(0, i), ...list[i].alt, ...list.slice(i + 1)];
  }
  const notesAt = list.find((r) => r?.block === 'notes');
  list = list.flatMap((r) => (r?.block ? r.rows : [r]));
  const dropped = new Set();
  while (list.length > room) {
    const i = list.findLastIndex((r) => r?.optional);
    if (i < 0) break;
    const { whole } = list[i];
    for (const [k, r] of list.entries()) if (k === i || (whole && r?.whole === whole)) dropped.add(r);
    list = list.filter((r) => !dropped.has(r));
  }
  // A sentence can free more rows than were needed: fit again without it,
  // so the spacers and decoration that gave way first come back while they fit.
  if (dropped.size && list.length < room) return fit(body.filter((r) => !dropped.has(r)), room, short, more);
  // Notes still too tall take their short form, and the body fits again, so
  // what gave way before them comes back while it fits.
  if (notesAt && list.length > room) return fit(body.flatMap((r) => (r === notesAt ? notesAt.alt : [r])), room, short, more);
  if (list.length > room) {
    const rows = list.flatMap((r, i) => (typeof r === 'string' || !(r.keep || r.optional || r.spacer) ? [i] : []));
    // The last in this order is cut first: a code block's rows go before
    // any other teaching, by their distance from the line the beat explains.
    const code = rows.filter((i) => list[i].far !== undefined).sort((a, b) => list[a].far - list[b].far);
    const teaching = [...rows.filter((i) => list[i].far === undefined), ...code];
    // Inside a card the `…` keeps the card's rail. A lone row stays: a `…`
    // in its place would hide it and free nothing.
    // A code block's row gives its own mark, which points to the page, and
    // the rows of one of its lines drop together.
    const mark = (r) => (r.rail ? `${r.rail}  ${r.more ?? more}` : r.more ?? more);
    let cut = list;
    for (let n = 1; n <= teaching.length && cut.length > room; n++) {
      const drop = new Set(teaching.slice(-n));
      for (const i of drop) if (list[i].whole) list.forEach((r, k) => r?.whole === list[i].whole && drop.add(k));
      cut = list.flatMap((r, i) => (!drop.has(i) ? [r] : drop.has(i - 1) ? [] : drop.has(i + 1) ? [mark(r)] : [r]));
    }
    list = cut;
  }
  return list.map((r) => (typeof r === 'string' ? r : r.text));
}

const TOASTS = {
  // The beat on screen decides the place, as on its card: a command that
  // names <your repo> runs from the copy.
  stray: { emoji: 'wave', color: 'accent', text: (x, s, t) => {
    const place = placeOf(s, t, s.view === 'step' && s.beat ? beatOf(s) : null);
    return place ? C.strayIn(place) : C.stray;
  } },
  hintsLater: { emoji: 'hint', color: 'accent', text: (x) => C.hintsLater(x.try) },
  pickFirst: { emoji: 'guess', color: 'accent', text: () => C.pickFirst },
  copied: { emoji: 'terminal', color: 'accent', text: (x) => C.copied(x.lines) },
  save: { emoji: 'broken', color: 'warn', text: (x) => C.saveFailed(x.message) },
};

// ASCII mode: the few symbols in the app's own words and in quotes, spelled
// out; anything else outside ASCII becomes '?'.
const ASCII = { '·': '|', '…': '...', '↑': '^', '↓': 'v', '←': '<-', '→': '->', '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '›': '>' };
const ascii = (line) => line.replace(/[^\x00-\x7f]/g, (ch) => ASCII[ch] ?? '?');

function small(cols, rows) {
  const out = Array.from({ length: rows }, () => '');
  const lines = wrapRuns([{ text: C.small }], Math.max(1, cols - 2)).map((l) => l.map((r) => r.text).join(''));
  lines.slice(0, rows).forEach((l, i) => {
    out[Math.max(0, Math.floor((rows - lines.length) / 2)) + i] = cut(` ${l}`, cols - 1);
  });
  return out.slice(0, rows);
}

// ---- pieces ------------------------------------------------------------------
// The rule above the key bar, the pulse line. While a check or git child
// runs, the bounce: a 10-cell segment 4 cells a tick, back and forth, on the
// spinner's clock, turning where the next step would leave the rule. Else
// a sweep when something changed, or the look marker, where ambient loops
// may draw.
function pulseLine(ctx) {
  const { t, W, ph } = ctx;
  const segment = (from, n) => `${rule(t, from)}${t.fg('key', t.glyph.bold.repeat(n))}${rule(t, W - from - n)}`;
  if (ph.spinner !== null) {
    const span = 4 * Math.floor((W - 10) / 4);
    const x = (4 * ph.spinner) % (2 * span);
    return segment(x <= span ? x : 2 * span - x, 10);
  }
  // A sweep: 8 cells across the rule, a fifth of the way a frame.
  const e = into(ctx, 'sweep');
  if (e < Infinity) return segment(Math.round(((W - 8) * Math.floor(e / SHOTS.sweep.every)) / 5), 8);
  // The look marker: 3 cells, a notch on for each real look.
  if (ph.look !== null) return segment(Math.round((ph.look * (W - 3)) / (NOTCHES - 1)), 3);
  return rule(t, W);
}

// How far into a one-shot this frame is, in ms, unrounded, or Infinity once
// it rests (and in every frame without motion).
const into = (ctx, part) => ctx.ph.ms[part] ?? Infinity;
const spread = (left, right, w) => left + ' '.repeat(Math.max(1, w - width(left) - width(right))) + right;
const rule = (t, W) => t.fg('faint', t.glyph.rule.repeat(W));
// `n` of `total` as heavy green cells over the plain rule, `w` wide.
const fill = (t, n, total, w) => {
  const filled = Math.round((n / total) * w);
  return `${t.fg('ok', t.glyph.bold.repeat(filled))}${rule(t, w - filled)}`;
};

// Inline Markdown in the given color, wrapped to `w` columns, after a
// `label` in its own color when there is one.
function para(t, text, w, color = 'text', { quote = false, label } = {}) {
  const runs = [...(label ? [{ text: `${label.text} `, color: label.color }] : []), ...inline(quote ? `"${text}"` : text)];
  return wrapRuns(runs, w).map((line) => line.map((r) => {
    let s = t.fg(r.code ? 'code' : r.color ?? color, r.text);
    if (r.bold) s = t.bold(s);
    if (r.url) s = t.link(s, absolute(r.url));
    return s;
  }).join(''));
}

// A link in a lesson's words, such as `#watch-out` or `05-project-memory.md`,
// resolved against its page.
function absolute(url) {
  if (/^[a-z][a-z+.-]*:/i.test(url) || !pageUrl) return url;
  try {
    return new URL(url, pageUrl).href;
  } catch {
    return url;
  }
}

// The keys that fit in `w` columns: a low key (c card) gives way first, then
// a key's long label to its short one (none, for the map's arrows), then the
// optional keys go from the right; q, and a key that `stays`, always stay.
// The `held` letter, waiting DEFER_MS to act, draws pressed: inverse.
function keybar(t, keys, w = Infinity, held = null) {
  const draw = (list, short) => list.map((k) => {
    const label = short && k.short != null ? k.short : k.label;
    const pressed = k.key === held;
    if (k.main) return `${t.pill(k.key, k.bg ?? 'okBg', k.fg ?? 'white', { pressed })} ${t.bold(t.fg('white', label))}`;
    const letter = t.fg('key', t.bold(k.key));
    return `${pressed ? t.inverse(letter) : letter}${label ? ` ${t.fg('muted', label)}` : ''}`;
  }).join('    ');
  let list = keys.filter(Boolean);
  if (width(draw(list, false)) <= w) return draw(list, false);
  const high = list.filter((k) => !k.low);
  if (width(draw(high, false)) <= w) return draw(high, false);
  // The low keys are gone before any label shortens.
  list = high;
  while (width(draw(list, true)) > w) {
    const drop = list.findLastIndex((k) => !k.main && !k.stays && k.key !== 'q' && k.key !== 'ctrl+c');
    if (drop < 0) break;
    list = list.filter((_, i) => i !== drop);
  }
  return draw(list, true);
}
const key = (k, label) => ({ key: k, label });
const mainKey = (k, label, bg, fg, short) => ({ key: k, label, main: true, bg, fg, short });

// The practice copy's folder in a command, quoted when the shell needs it.
export function quotePath(path, win32) {
  if (/^[\w@%+=:,./~\\-]+$/.test(path)) return path;
  return win32 ? `"${path}"` : `'${path.replace(/'/g, "'\\''")}'`;
}
// The work folder fills <your repo> (ticket 86), where the lesson has one.
const withRoot = (text, root, win32, dir) => {
  const out = text.replace('<your practice copy>', quotePath(root, win32));
  return dir ? out.replace('<your repo>', quotePath(dir, win32)) : out;
};

// A command on a dark block, one line per `w - 4` columns of the command,
// so a long path is never cut.
function chip(t, cmd, where, w) {
  // A browser has no prompt (ticket 103): what it shows is an address. A
  // command that starts Claude Code is typed at the shell, so it keeps the
  // shell's prompt on a Claude Code beat. A slash command is typed in Claude
  // Code on any beat, an editor beat's too (r27 E8); a path such as /tmp/x
  // is not one, since a command's name ends at a space or the line's end.
  const prompt = (['claude', 'claude-2'].includes(where) && !/^claude(\s|$)/.test(cmd)) || /^\/[a-z][a-z-]*(?:\s|$)/.test(cmd) ? '›' : where === 'browser' ? ' ' : t.caps.win32 ? '>' : '$';
  const room = Math.max(10, w - 4);
  // Lines break at spaces, so a prompt keeps its words whole; only a word
  // longer than the line, such as a long path, is split.
  const parts = [];
  let part = '';
  for (const word of cmd.split(/(?<= )/)) {
    if (part && width(part + word.trimEnd()) > room) {
      parts.push(part.trimEnd());
      part = '';
    }
    for (const g of graphemes(word)) {
      if (width(part + g) > room && g !== ' ') {
        parts.push(part);
        part = '';
      }
      part += g;
    }
  }
  if (part.trimEnd() || !parts.length) parts.push(part.trimEnd());
  return parts.map((part, i) => {
    const text = ` ${t.fg('prompt', i ? ' ' : prompt)} ${t.fg('code', part)}`;
    const padded = text + ' '.repeat(Math.max(1, w - width(text)));
    return t.depth > 1 ? t.bg('codeBg', padded) : padded;
  });
}

// A beat's code block, the lines it shows, each after its number, in `w`
// columns. The line the beat explains has the pointer and never drops; the
// others give way farthest from it first (`far`), the line after it before
// the line before it, and the first row of a run that goes points to the
// page. A line wider than its room breaks at a space, its next rows at its
// indent under the wrap mark; a word wider than a whole row is cut, never
// broken across rows, and a row under the block says where the rest is.
function codeRows(t, code, w, words = C) {
  const digits = String(code.to).length;
  const room = Math.max(10, w - digits - 5);
  const dots = t.glyph.ellipsis;
  const more = t.fg('muted', `${dots} ${words.codeMore}`);
  let wide = false;
  const rows = code.lines.slice(code.from - 1, code.to).flatMap((line, k) => {
    const n = code.from + k;
    const indent = line.match(/^ */)[0];
    const parts = [];
    let part = '';
    for (const word of line.split(/(?<= )/)) {
      if (part.trim() && width(part + word.trimEnd()) > room) {
        parts.push(part.trimEnd());
        part = width(indent) < room / 2 ? indent : '';
      }
      part += word;
    }
    parts.push(part.trimEnd());
    // A line's rows give way together.
    const whole = {};
    const far = 2 * Math.abs(n - code.point) + (n > code.point ? 1 : 0);
    return parts.map((p, j) => {
      wide ||= width(p) > room;
      const mark = j === 0 && n === code.point ? t.fg('accent', t.glyph.right) : ' ';
      const num = t.fg('faint', (j === 0 ? String(n) : t.glyph.wrap).padStart(digits));
      // The cut leaves room for the dots, which are three columns in ASCII.
      const text = ` ${t.fg('code', strip(width(p) <= room ? p : cut(p, room - width(dots) + 1, dots)))}`;
      const padded = text + ' '.repeat(Math.max(1, room + 2 - width(text)));
      const row = `${mark} ${num} ${t.depth > 1 ? t.bg('codeBg', padded) : padded}`;
      return n === code.point ? { keep: true, text: row } : { text: row, whole, more, far };
    });
  });
  if (wide) rows.push(...para(t, words.codeWide(dots), w, 'muted').map((text) => ({ text, more, far: Infinity })));
  return rows;
}
// A row after `prefix`, a code row's page mark too.
const prefixed = (prefix, r) => (typeof r === 'string' ? `${prefix}${r}` : { ...r, text: `${prefix}${r.text}`, ...(r.more ? { more: `${prefix}${r.more}` } : {}) });

// The steps a lesson will play and their tiers. Before a lesson starts, the
// warm-ups it would pick stand in for the ones it picks on enter, and the
// tiers are the ones the play will start with.
function planned(state) {
  const s = state.view === 'intro' ? asStarted(state) : state;
  const content = contentOf(s);
  if (s.view !== 'intro' || !content.warmup.length) return { steps: stepsOf(s), tiers: tiersOf(s) };
  const own = tiersOf(s).filter((_, i) => stepsOf(s)[i].part !== 'Warm-up');
  const warm = pickWarmups(s).map((id) => content.warmup.find((w) => w.id === id));
  return { steps: [...warm, ...content.steps], tiers: [...warm.map(() => 'challenge'), ...own] };
}

// The step on screen has its last beat done: it is passed before enter adds
// it to `done`.
const passedNow = (s) => s.view === 'step' && isDone(s.beat) && lastShown(s);

// The step on screen is passed and was not done before: a first pass, which
// counts toward the session and grows the progress rule.
const firstPass = (s) => passedNow(s) && !s.progress[s.lesson].done.includes(stepOf(s).id);

// The steps in `done`, and the step on screen once it is passed.
function passed(s) {
  const done = new Set(s.progress[s.lesson].done);
  if (passedNow(s)) done.add(stepOf(s).id);
  return done;
}

// One mark per step, joined within a tier and spaced between tiers. When the
// row has no room for that, the marks close up.
function trail(ctx, room) {
  const { s, t } = ctx;
  const { steps, tiers } = planned(s);
  const done = passed(s);
  const current = s.view === 'step' || s.view === 'levelup' ? s.pos.step : -1;
  const now = passedNow(s);
  const entering = into(ctx, 'entrance');
  const passing = into(ctx, 'stepDone');
  // On a lesson complete, one light runs along the finished trail: on its
  // first stop at the first frame from `light`, on its last at the last
  // frame before the screen rests, whatever the trail's length.
  const run = into(ctx, 'complete');
  const frames = (TIMING.complete - SHOTS.complete.light) / TIMING.grid - 1;
  const light = run < SHOTS.complete.light ? -1 : Math.round((Math.floor((run - SHOTS.complete.light) / TIMING.grid) * (steps.length - 1)) / frames);
  const draw = (join, gap) => {
    let out = '';
    steps.forEach((step, i) => {
      const style = TIER_STYLE[tiers[i]];
      // The step on screen is drawn done, and its link fills, only once it
      // is passed: on a revisit or a replay it keeps the "current" glyph.
      const isPassed = i === current ? now : done.has(step.id);
      if (i === light) out += t.bold(t.fg('gold', t.glyph.ring));
      // As its step passes, the stop is a spark for a moment.
      else if (isPassed && i === current && passing < SHOTS.stepDone.pop) out += t.bold(t.fg('gold', t.glyph.spark));
      else if (isPassed) out += t.fg('ok', t.glyph[style.on]);
      // As the card enters, its stop pops: hollow, then a ring.
      else if (i === current && entering < SHOTS.entrance.land) out += t.fg(style.tint, t.glyph[style.off]);
      else if (i === current && entering < Infinity) out += t.bold(t.fg('accent', t.glyph.ring));
      else if (i === current) out += t.bold(t.fg('accent', t.glyph[style.on]));
      else out += t.fg(style.tint, t.glyph[style.off]);
      if (i + 1 < steps.length) {
        if (tiers[i + 1] !== tiers[i]) out += gap;
        // A passing stop's link fills from it: half, then whole.
        else if (isPassed && i === current && passing < SHOTS.stepDone.fill) {
          const half = passing < SHOTS.stepDone.pop ? 0 : Math.ceil(join / 2);
          out += `${t.fg('ok', t.glyph.bold.repeat(half))}${t.fg('faint', t.glyph.rule.repeat(join - half))}`;
        } else if (isPassed && (i === current || done.has(steps[i + 1].id) || i + 1 === current)) out += t.fg('ok', t.glyph.bold.repeat(join));
        else out += t.fg('faint', t.glyph.rule.repeat(join));
      }
    });
    return out;
  };
  const full = draw(2, '   ');
  return width(full) <= room ? full : draw(0, ' ');
}

// Row 3 on a lesson screen: the share of its steps passed, as a heavy rule
// over the plain one. As a step passes for the first time, it grows.
function progressRule(ctx) {
  const { s, t, W } = ctx;
  const { steps } = planned(s);
  const done = passed(s);
  const n = steps.filter((x) => done.has(x.id)).length;
  const e = into(ctx, 'stepDone');
  const growing = e < SHOTS.stepDone.fill && firstPass(s);
  return fill(t, growing ? n - 1 + e / SHOTS.stepDone.fill : n, steps.length, W);
}

function lessonHead(ctx, right, rightText) {
  const { s, t, W } = ctx;
  const l = lessonOf(s);
  // A work folder that isn't the copy is named beside the right-hand text,
  // in the room the trail leaves closed up (ticket 86). A step that runs in
  // the copy while its lesson's folder is another, a Worked example's
  // (ticket 183), says so.
  const dir = folderHere(s);
  const sep = rightText ? ' · ' : '';
  const room = W - 1 - (l.content ? width(trail(ctx, 0)) + 1 : 0) - width(rightText) - width(sep);
  if (dir && dir !== s.facts.root) {
    rightText = `${C.inFolder(shortName(t, baseName(dir), room - width(C.inFolder(''))))}${sep}${rightText}`;
  } else if (dir && folderOf(s) !== s.facts.root) {
    // Where the room won't hold those words whole, as with i-4's twelve
    // steps at 60 columns, the copy's folder by name, cut as a work folder's.
    const place = width(C.inCopy) <= room ? C.inCopy : C.inFolder(shortName(t, baseName(dir), room - width(C.inFolder(''))));
    rightText = `${place}${sep}${rightText}`;
  }
  // The check's short title, as on the map, cut to the room the pill leaves;
  // the content file keeps the page's heading.
  const label = t.pill(lessonLabel(l.id), 'accentBg');
  const title = cut(titleOf(l), Math.max(8, W - width(label) - 2 - width(right) - 1), t.unicode ? '…' : '.');
  return [
    spread(`${label}  ${t.bold(t.fg('white', title))}`, right, W),
    spread(l.content ? trail(ctx, W - width(rightText) - 1) : '', t.fg('muted', rightText), W),
    l.content ? progressRule(ctx) : rule(t, W),
  ];
}

// A card's where pill: its emoji, its words and its place, if any, and the
// place alone, for a top row too narrow for all three. `brief` is shorter
// words for the same window, for a top row too narrow for the long ones.
const whereOf = (t, emoji, words, place, brief = null) => ({
  where: `${t.lead(emoji)}${words}${place ? `, ${place}` : ''}`,
  short: place ? `${t.lead(emoji)}${place}` : null,
  brief: brief && !place ? `${t.lead(emoji)}${brief}` : null,
});

// Pip, at the end of a card's top border, needs the face and the two rule
// cells after it, and leaves at least one rule cell before it.
const PIP_ROOM = PIP_FACE + 3;

// `short` is `where` with the place alone, as the top row's fallback.
function card(ctx, { tint, where, short = null, brief = null, done, rows }) {
  const { s, t, W } = ctx;
  const rail = t.fg(tint, t.glyph.rail);
  // Pip's face in this frame (motion.mjs's cardFace), over the mood the
  // card shows the app saw.
  const face = cardFace(s, ctx.clock.at, ctx.ph);
  // The top row keeps its place whole (ticket 183): where the row is wider
  // than the card, the DONE pill goes first, then the words before the
  // place. A where label with brief words, such as the shell's (r27 E11),
  // uses them where the long ones would leave Pip no room, or not fit.
  const leftOf = (w, d) => `${t.fg(tint, `${t.glyph.tl}${t.glyph.rule}`)} ${t.pill(w, 'chipBg')}${d ? ` ${t.pill(`${t.glyph.check} ${C.done}`, 'okBg')}` : ''} `;
  const roomy = (x) => width(x) + (face ? PIP_ROOM : 0) <= W;
  const tries = [[where, done], ...(brief ? [[brief, done]] : []), [where, false], ...(brief ? [[brief, false]] : []), ...(short ? [[short, done], [short, false]] : [])].map(([w, d]) => leftOf(w, d));
  const left = brief && !roomy(tries[0]) && roomy(tries[1]) ? tries[1] : tries.find((x) => width(x) <= W) ?? tries.at(-1);
  const fill = Math.max(0, W - width(left));
  // As the card enters, the top rule grows from the pill a third a frame.
  const grown = Math.round((fill * (1 + Math.floor(into(ctx, 'entrance') / SHOTS.entrance.every))) / 3);
  const top = !face ? left + t.fg(tint, t.glyph.rule.repeat(grown))
    : fill >= PIP_ROOM
      ? `${left}${t.fg(tint, t.glyph.rule.repeat(fill - PIP_FACE - 2))}${pipFace(t, face.mood, face.face, face.ms, face.passing)}${t.fg(tint, t.glyph.rule.repeat(2))}`
      : left + t.fg(tint, t.glyph.rule.repeat(fill));
  // Each row carries the rail, so a `…` cut inside the card keeps it.
  // A blank row that is part of a sentence, such as the Why line's, is the
  // rail alone too.
  const row = (r) => (r === '' || r?.spacer ? spacer(rail, r?.group) : typeof r === 'string' ? { text: `${rail}  ${r}`, rail }
    : r.block ? { ...r, rows: r.rows.map(row), alt: r.alt.map(row) }
    : r.text === '' ? { ...r, text: rail, blank: true } : { ...r, text: `${rail}  ${r.text}`, rail });
  // A spacer next to another, where a line between them shows nothing, is
  // one; a sentence's blank row above a spacer leaves the blank to it.
  const body = [spacer(rail), ...rows.map(row)].filter((r, i, all) => !((r.spacer || r.blank) && all[i + 1]?.spacer));
  return [...kept([top]), ...body, ...kept([t.fg(tint, `${t.glyph.bl}${t.glyph.rule.repeat(W - 1)}`)])];
}

const lead = (t, name, s) => `${t.lead(name)}${s}`;
// A `can` line's mark, three columns in; on the payoff's line 🏁 takes its
// place, ending where the mark ends (an ASCII `[win]` wider than the mark
// starts at the margin and ends past it).
const canMark = (t, payoff, mark) => {
  const m = payoff ? t.emoji('payoff') : mark;
  return `${' '.repeat(Math.max(0, 3 + width(mark) - width(m)))}${m}`;
};
// Lines after a prefix, the rest indented under the first.
const hang = (prefix, rows) => rows.map((x, i) => `${i ? ' '.repeat(width(prefix)) : prefix}${x}`);
// A command on a card, on as many rows as `w` needs: broken at its spaces,
// or anywhere in a word wider than a row, and never cut.
const commandRows = (t, command, w) => wrapRuns([{ text: command }], w).map((line) => t.fg('code', line.map((r) => r.text).join('')));
// A `can` line wrapped to `w` after its mark, the rest under its first word;
// `blank`, with no mark yet.
const canLine = (t, text, payoff, mark, w, blank = false) => {
  const prefix = `${canMark(t, payoff, mark)} `;
  return hang(blank ? ' '.repeat(width(prefix)) : prefix, para(t, text, w));
};
// Text after a lead, wrapped to the room the lead leaves and indented under it.
const led = (t, name, text, w, color, opts) => hang(t.lead(name), para(t, text, w - width(t.lead(name)), color, opts));
// A Why line: the lead in `color`, the quote wrapped under its first word,
// and a blank row, as one optional sentence.
const whyLine = (t, text, w, color) => {
  const why = `${C.whyLead} `;
  return optional([...hang(t.fg(color, why), para(t, text, w - width(why), 'text', { quote: true })), '']);
};
// The lesson's Go further line: 📖, its label, then the quote, wrapped under
// the label.
const goFurther = (t, read, w) => led(t, 'read', read, w, 'text', { quote: true, label: { text: C.goFurther, color: 'muted' } });
// An address spelled out in `w` columns, a link where links work. A copy
// from a terminal with no links should give it whole, so it breaks only
// after a /, ? or &, never inside a word, and its rows hold nothing else:
// no rail, no indent. A piece wider than a row (no lesson's) breaks where
// the row ends.
const urlRows = (t, url, w) => {
  const rows = [''];
  for (let piece of url.split(/(?<=[/?&])/)) {
    if (rows.at(-1) && width(rows.at(-1) + piece) > w) rows.push('');
    while (width(rows.at(-1) + piece) > w) {
      const room = w - width(rows.at(-1));
      rows[rows.length - 1] += piece.slice(0, room);
      rows.push('');
      piece = piece.slice(room);
    }
    rows[rows.length - 1] += piece;
  }
  return rows.map((x) => t.link(t.fg('key', x), url));
};
// One sentence written as rows: those rows where each fits in `w`, or else
// the sentence wrapped whole.
const sentence = (t, parts, w, color) => (parts.every((x) => width(x) <= w) ? parts : [parts.join(' ')]).flatMap((x) => para(t, x, w, color));
const hintBox = (t, lines) => lines.map((l) => prefixed(`${t.fg('warn', t.glyph.bar)} `, l));

// A folder path in `w` columns: whole where it fits, else its start and its
// end with `…` between, so the folder's own name always shows.
function shortPath(t, path, w) {
  if (width(path) <= w) return path;
  const g = graphemes(path);
  const dots = t.unicode ? '…' : '...';
  const end = Math.ceil((w - width(dots)) * 0.6);
  return `${g.slice(0, w - width(dots) - end).join('')}${dots}${g.slice(-end).join('')}`;
}
// A level's work folder on one row: "Work folder:", then this practice copy
// or the folder's path. `after` follows it, such as the key that changes it.
function folderLine(ctx, path = folderOf(ctx.s), after = '') {
  const { s, t, W } = ctx;
  const lead = `${C.workFolder} `;
  const room = W - width(lead) - width(after);
  const where = path === s.facts.root ? t.fg('text', C.thisCopy) : t.fg('code', shortPath(t, path, room));
  return `${t.fg('muted', lead)}${where}${after}`;
}

// A warning in `w` columns, as kept rows: the warn mark, then the text
// wrapped under its first word.
function warnNote(t, text, w, color = 'warn', opts) {
  const mark = `${t.fg('warn', t.glyph.warnMark)} `;
  return kept(hang(mark, para(t, text, w - width(mark), color, opts)));
}

// What main found wrong with the lesson's work folder, where it isn't the
// copy, as kept rows: before the first step, the learner knows (ticket 86).
// Nothing until main has looked.
function folderNotes(ctx, w = ctx.W) {
  const { s, t } = ctx;
  const problem = folderProblem(s);
  if (!problem) return [];
  const found = s.probes[folderOf(s)];
  const text = { missing: () => C.folderGone(shortPath(t, folderOf(s), w - 30)), gitBroken: () => C.folderGitBroken(found.gitBroken), notGit: () => C.notGit, noPractice: () => C.noPractice }[problem]();
  return warnNote(t, text, w);
}

// What the intro says before the learner starts, in `w` columns, each note
// its kept rows: what main found wrong with the work folder (ticket 86);
// in the level's work folder, where it is not the practice copy, the page's
// line for the learner's repository (ticket 179); then what the lesson needs (ticket
// 89): on native Windows the page's note, as a beat shows it; the commands
// main found on no PATH folder, in one sentence with the You need line that
// names each; and each prerequisite that failed, with what isn't there.
function noteRows(ctx, w) {
  const { s, t } = ctx;
  const win = contentOf(s).intro['win-note'];
  const repo = repoNeed(s);
  const missing = missingNeeds(s);
  const quotes = missing.map((n) => `"${n.quote}"`).join(' ');
  const quoted = (text) => kept(para(t, text, w, 'text', { quote: true }));
  return [asksFolder(s) ? [] : folderNotes(ctx, w),
    repo ? kept(para(t, repo, w, 'text', { quote: true, label: { text: C.youNeed, color: 'muted' } })) : [],
    win && t.caps.win32 ? quoted(win) : [],
    missing.length ? warnNote(t, quotes, w, 'text', { label: { text: C.notOnPath(...missing.flatMap((n) => n.names)), color: 'warn' } }) : [],
    ...unmet(s).map((r) => warnNote(t, r.probe ? C.folderLacks(r.hint) : (r.path ? C.buildsOnFile : C.buildsOnCheck)(lessonLabel(r.lesson), r.hint), w))].filter((n) => n.length);
}

// ---- views -------------------------------------------------------------------
// The welcome's path hint and the map's footer say the same thing: each
// lesson starts with less help than the one before. Help fades within a
// level, and a later level's first lesson may start with more help than the
// capstone before it, so both show only on the course's first level, and
// only where a lesson file climbs. Intermediate has no copy of its own: with
// all nine lesson files, i-4, i-7 and i-8 give more help than the lesson two
// before them, so "each stop a little harder" would not hold there.
const lessHelpOn = (s, lessons) => lessons[0] === s.course[0] && lessons.some((l) => l.content);

const VIEWS = {
  welcome(ctx) {
    const { s, t, W } = ctx;
    // The current level's path: its lessons, then one cup for its capstone.
    const lessons = levelLessons(s, levelOf(s));
    const done = lessons.filter((l) => s.progress[l.id].complete).length;
    const heat = ['guided', 'guided', 'hinted', 'heat4', 'challenge'];
    const ids = lessons.filter((l) => !l.id.endsWith('capstone'));
    const cap = lessons.find((l) => l.id.endsWith('capstone'));
    // Once on entry: Pip greets the learner, and a fuse lights the path's
    // links in turn, reaching the cup at `cup` however many lessons the
    // level has.
    const e = into(ctx, 'welcome');
    const at = SHOTS.welcome;
    const frames = at.cup / at.fuse;
    const lit = e === Infinity ? 0 : 1 + Math.floor((Math.min(frames, Math.floor(e / at.fuse)) * (ids.length - 1)) / frames);
    const link = (i) => (i < lit ? ` ${t.bold(t.fg('gold', t.glyph.bold.repeat(2)))} ` : t.fg('faint', ` ${t.glyph.rule.repeat(2)} `));
    // The heat runs cool to hot across the level, however long.
    const path = `${ids.map((l, i) => `${t.fg(heat[Math.floor((i * heat.length) / ids.length)], t.bold(lessonLabel(l.id)))}${link(i)}`).join('')}${t.emoji('cup') || lessonLabel(cap.id)}`;
    const hint = lessHelpOn(s, lessons) ? t.fg('muted', `   ${C.pathHint}`) : '';
    const body = [
      withPip(ctx, bigPip(ctx, BIG_PIP.welcome, ...greeting(ctx)), [
        (w) => led(t, 'wave', C.hi(s.facts.name), w, 'white').map((x) => t.bold(x)),
        (w) => sentence(t, [C.pip1, C.pip2], w, 'text'),
      ]),
      SPACER,
      t.bold(t.fg('white', C.twoWindows)),
      ...windows(ctx),
      SPACER,
      t.bold(t.fg('white', C.openSecond)),
      ...chip(t, `cd ${quotePath(s.facts.root, t.caps.win32)}`, 'terminal', Math.min(W, width(s.facts.root) + 10)),
      t.fg('muted', C.comeBack),
    ];
    if (s.facts.gitError) body.push(SPACER, ...kept(led(t, 'broken', C.gitBroken(s.facts.gitError), W, 'bad')));
    // The app's name gives way where it and the level's count don't both
    // fit uncut, as with Intermediate's at 60 columns.
    const count = t.fg('muted', C.pathLabel(levelName(s), done, lessons.length));
    const title = width(appTitle(t)) + 1 + width(count) <= ctx.cols - 1 - frameOf(ctx).M ? appTitle(t) : t.pill('LEARN', 'accentBg');
    return {
      head: [spread(title, count, W),
        // The hint is left off when it doesn't fit: the map's footer says the same.
        `${path}${width(path + hint) <= W ? hint : ''}`, rule(t, W)],
      body,
      keys: [mainKey('enter', C.k.itsOpen), key('q', C.k.quit)],
    };
  },

  resume(ctx) {
    const { s, t } = ctx;
    const steps = stepsOf(s);
    const p = s.progress[s.lesson];
    const index = Math.max(0, steps.findIndex((x) => x.id === p.step));
    const mark = `${t.fg('warn', t.glyph.warnMark)} `;
    return {
      head: lessonHead(ctx, '', C.stepOf(index + 1, steps.length)),
      body: [
        withPip(ctx, bigPip(ctx, BIG_PIP.resume, ...greeting(ctx)), [
          () => [lead(t, 'wave', t.bold(t.fg('white', C.welcomeBack)))],
          (w) => para(t, C.youreOn(lessonLabel(s.lesson), index + 1, steps.length, steps[index].title), w, 'text'),
          ...(tearDownLeft(s) ? [(w) => para(t, C.tearDownLeft, w, 'muted')] : []),
        ]),
        ...(s.confirmRestart ? [SPACER, ...kept(hang(mark, para(t, C.restartAsk, ctx.W - width(mark), 'white').map((x) => t.bold(x))))] : []),
      ],
      keys: s.confirmRestart
        ? [mainKey('y', C.k.yesStartOver, 'warn', 'black'), key('n', C.k.keep)]
        : [mainKey('enter', C.k.continue), key('x', C.k.startOver), key('m', C.k.map), key('q', C.k.quit)],
    };
  },

  intro(ctx) {
    const { s, t, W } = ctx;
    const content = contentOf(s);
    const asking = asksFolder(s);
    // The warm-up the play will ask, if any: one on a missed skill (194).
    const warmups = pickWarmups(s).length;
    // The climb is the lesson's own steps: warm-ups are recall, not new help.
    const steps = stepsOf(s);
    const m = mix(tiersOf(asStarted(s)).filter((_, i) => steps[i].part !== 'Warm-up'));
    const label = s.lesson.endsWith('capstone') ? C.startCapstone : C.startLesson(lessonNumber(s));
    const option = (i, text) => (s.cursor === i
      ? `${t.fg('key', t.bold(t.glyph.pointer))} ${t.inverse(t.fg('key', t.bold(` ${text} `)))}`
      : `  ${t.fg('text', ` ${text}`)}`);
    // Where the level is practised (ticket 86): the question, until it has
    // an answer, in place of the start options; then the answer, on the
    // intro that asked. Both are kept rows, so the Why line gives way first.
    // The notes before the start (86's folder note, 179's repository line,
    // 89's needs) are kept too, under the answer. Where they don't fit once
    // the Why line is gone, they give way to one row that hands them to n,
    // so no teaching row is cut.
    const shown = noteRows(ctx, W).flat();
    const before = shown.length ? [notes(shown, warnNote(t, C.notesShort, W))] : [];
    const menu = asking
      ? [...before, ...kept([t.bold(t.fg('white', folderKey(s) === levelOf(s) ? C.folderAsk(levelName(s)) : C.newCopyAsk))]),
        ...kept(folderOptions(s).map((o, i) => option(i, o === 'copy' ? C.folderCopy : folderKey(s) === levelOf(s) ? C.folderOther : C.folderNewCopy)))]
      : [...(asksHere(s) ? kept([folderLine(ctx)]) : []), ...before,
        ...kept(introOptions(s).map((o, i) => option(i, o === 'start' ? label : o === 'less' ? C.lessHelp : C.openFirst(lessonLabel(offered(s))))))];
    // Why the lesson matters, in the page's words, with its blank: an
    // optional row, so below 24 rows the staircase compacts first.
    return {
      head: lessonHead(ctx, t.fg('muted', content.intro.minutes ?? ''), C.steps(content.steps.length + warmups)),
      body: [
        ...(content.intro.why ? whyLine(t, content.intro.why, W, 'muted') : []),
        lead(t, 'goal', t.bold(t.fg('white', C.youllBeAble))),
        ...content.intro.can.flatMap((c) => canLine(t, c, c === content.intro.payoff, t.fg('faint', t.glyph.dotOff), W - 6)),
        SPACER,
        t.bold(t.fg('white', C.helpShrinks)),
        SPACER,
        ...staircase(ctx, m, false),
        ...(warmups ? [t.fg('muted', C.warmups(warmups))] : []),
        SPACER,
        ...menu,
      ],
      keys: [key(t.glyph.up, C.k.choose), key('enter', asking ? C.k.answer : C.k.start), key('m', C.k.map), !asking && folderKey(s) ? { ...key('f', C.k.folder), low: true } : null, key('q', C.k.quit)],
    };
  },

  step: stepView,

  levelup(ctx) {
    const { s, t, W } = ctx;
    const tiers = tiersOf(s);
    const rest = tiers.slice(s.pos.step);
    const counts = (k) => rest.filter((x) => x === k).length;
    const toChallenge = s.levelTo === 'challenge';
    // Pip opens its eyes as the banner wipes in, then the arrow fills and
    // the new star lands.
    const e = into(ctx, 'levelUp');
    const at = SHOTS.levelUp;
    const art = bigPip(ctx, BIG_PIP.levelup, at.face, e);
    const word = banner(t, C.levelUp, e < at.whole ? { cells: Math.round((bannerWidth(C.levelUp) * e) / at.whole) } : {});
    const plain = t.bold(t.fg('accent', C.levelUp));
    // Pip and the banner, or the word beside Pip's face: decoration,
    // leaving the word.
    const top = decor(bannered(ctx, art, C.levelUp, word, plain), [` ${plain}`]);
    const lines = toChallenge ? C.toChallenge : C.toHinted;
    const tint = TIER_STYLE[s.levelTo].tint;
    // The arrow's 8 cells fill a third at a time, rounded up.
    const thirds = e < at.whole ? 0 : Math.floor((e - at.whole) / at.fill);
    const filled = Math.min(8, Math.ceil((8 * thirds) / 3));
    const arrow = e < at.head
      ? `${t.fg(tint, t.glyph.bold.repeat(filled))}${t.fg('faint', t.glyph.rule.repeat(8 - filled))} `
      : t.fg(tint, `${t.glyph.bold.repeat(8)}${t.glyph.right}`);
    return {
      head: lessonHead(ctx, tierPill(t, s.levelTo), C.stepOf(s.pos.step + 1, tiers.length)),
      body: [
        top,
        SPACER,
        ` ${tierPill(t, s.levelFrom)}   ${arrow}   ${tierPill(t, s.levelTo, e < Infinity ? { from: s.levelFrom, glyph: e < at.head ? ' ' : t.glyph.spark } : undefined)}`,
        SPACER,
        ...para(t, lines[0], W - 1, 'white').map((x) => ` ${t.bold(x)}`),
        ...para(t, lines[1], W - 1, 'text').map((x) => ` ${x}`),
        SPACER,
        ...led(t, 'level', C.nextCounts(toChallenge ? 0 : counts('hinted'), counts('challenge')), W - 1, tint).map((x) => ` ${t.bold(x)}`),
      ],
      keys: [mainKey('enter', toChallenge ? C.k.bringIt : C.k.letsGo, TIER_STYLE[s.levelTo].bg, TIER_STYLE[s.levelTo].fgOnBg), moreHelpGives(s) ? key('g', C.k.moreHelp) : null, key('q', C.k.quit)],
    };
  },

  complete(ctx) {
    const { s, t, W } = ctx;
    const content = contentOf(s);
    const total = stepsOf(s).length;
    const e = into(ctx, 'complete');
    const at = SHOTS.complete;
    const cheer = e < at.whole;
    const art = bigPip(ctx, BIG_PIP.complete, cheer ? 'cheer' : SHOTS.lookAround.face, into(ctx, 'lookAround'));
    const word = banner(t, C.complete, cheer ? { letters: Math.floor((C.complete.length * e) / at.whole) } : {});
    const label = s.lesson.endsWith('capstone') ? 'Capstone' : `Lesson ${lessonNumber(s)}`;
    // The confetti falls into its row: from 24 rows across it and the blank
    // under it, turn about; below 24 rows, where that blank can give way,
    // glyph by glyph.
    const k = Math.floor(e / at.fall);
    let confettiRows = [confetti(t, W)];
    let under = SPACER;
    if (e < Infinity && ctx.rows < 24) confettiRows = [confetti(t, W, { shown: at.first + at.more * k })];
    else if (e < Infinity) {
      confettiRows = [confetti(t, W, { turn: k, row: 0 })];
      under = spacer(confetti(t, W, { turn: k, row: 1 }));
    }
    // The ticks appear in turn from blank, the payoff's mark last.
    const order = [...content.intro.can.filter((c) => c !== content.intro.payoff), ...content.intro.can.filter((c) => c === content.intro.payoff)];
    // Each lands on the 40 ms grid, where a frame is drawn.
    const lands = (c) => at.ticks + (order.length > 1 ? TIMING.grid * Math.round((at.ticksBy - at.ticks) * order.indexOf(c) / (order.length - 1) / TIMING.grid) : 0);
    return {
      head: lessonHead(ctx, t.pill(`${C.complete} ${t.glyph.check}`, 'okBg'), `${total} of ${total}`),
      body: [
        decor(confettiRows),
        under,
        decor(bannered(ctx, art, C.complete, word, t.bold(t.fg('ok', C.complete))), [` ${t.bold(t.fg('ok', C.complete))}`]),
        SPACER,
        lead(t, 'party', t.bold(t.fg('white', C.lessonDone(label)))),
        ...content.intro.can.flatMap((c) => canLine(t, c, c === content.intro.payoff, t.fg('ok', t.glyph.check), W - 8, e < lands(c))),
        ...(content.badge ? [SPACER, lead(t, 'badge', t.bold(t.fg('gold', C.badge(content.badge))))] : []),
      ],
      keys: [mainKey('enter', C.k.whatsNext), key('q', C.k.quit)],
    };
  },

  next(ctx) {
    const { s, t, W } = ctx;
    const content = contentOf(s);
    const results = s.checks[s.lesson]?.items;
    const total = stepsOf(s).length;
    // Only the questions in steps this learner finished: the app saw those.
    const answered = stepsOf(s).filter((st) => s.progress[s.lesson].done.includes(st.id)).flatMap((st) => st.beats)
      .filter((b) => b.ask && b.kind !== 'predict').length;
    const nextLesson = nextLessonOf(s);
    const body = [];
    if (results) body.push(lead(t, 'verified', t.fg('ok', C.checkedSummary(results.filter((r) => r.pass).length, results.length))));
    if (s.lesson.endsWith('capstone')) {
      const indent = ' '.repeat(width(t.lead('verified')));
      // The capstone's handover: plain text, shown only when no exact command
      // was shown in this play. A short window never drops it.
      if (s.progress[s.lesson].bottomAt === null) body.push(...kept([`${indent}${t.fg('text', C.handover)}`]));
      // Each level's capstone invites questions, under the handover line: an
      // optional sentence, so a long toast cuts no teaching line.
      const place = placeOf(s, t);
      body.push(...optional(hang(indent, para(t, place ? C.invitationAt(place) : C.invitation, W - width(indent), 'muted'))));
    }
    // The count repeats what the learner did, so it goes before a teaching line.
    body.push(...optional([lead(t, 'claude', t.fg('text', C.answeredSummary(answered)))]), SPACER, t.bold(t.fg('white', C.yourClimb)), SPACER,
      // The climb as it was played: an eased step counts at its easier tier.
      ...staircase(ctx, mix(tiersOf(s).filter((_, i) => stepsOf(s)[i].part !== 'Warm-up')), true));
    // Recall, then compare: the lesson's card entries from memory first. An
    // optional sentence, so a long toast cuts no teaching line: where it
    // drops, c still shows the same entries. Go further, under it, gives way
    // first.
    if (recallOf(s).length) body.push(...optional(['', ...para(t, C.recallAsk(lessonLabel(s.lesson)), W, 'text')]));
    // A source to read next, one optional sentence: p shows it too. A
    // capstone has none.
    if (content.intro.read) body.push(...optional(['', ...goFurther(t, content.intro.read, W)]));
    if (nextLesson) {
      const up = `${t.fg('accent', t.glyph.right)} ${t.fg('muted', C.nextUp)}  ${t.pill(lessonLabel(nextLesson.id), 'accentBg')}  `;
      const mixed = `   ${mixBar(ctx, nextLesson, BAR)}  `;
      const upRows = hang(up, para(t, nextLesson.title, W - width(up), 'white').map((x) => t.bold(x)));
      // Its climb, where it has a lesson file to climb, beside "A notch
      // harder" when it plans a larger share of steps with less help than
      // this lesson (ticket 186). Help fades within a level: the first lesson
      // of the next may start with more help, so neither shows there.
      if (nextLesson.content && levelOf(s, nextLesson.id) === levelOf(s)) {
        upRows.push(...(lessHelpShare(s, nextLesson.id) > lessHelpShare(s, s.lesson) ? hang(mixed, para(t, C.notchHarder, W - width(mixed), 'muted')) : [mixed.trimEnd()]));
      }
      // After the optional rows and before any teaching row is cut, Next up
      // gives way whole: the key bar's enter still names the lesson.
      body.push(SPACER, notes(upRows, []));
    }
    body.push(SPACER, ...para(t, C.savedBreak, W, 'muted'));
    return {
      head: lessonHead(ctx, t.pill(`${C.complete} ${t.glyph.check}`, 'okBg'), `${total} of ${total}`),
      body,
      keys: [nextKey(s), key('p', C.k.page), key('m', C.k.map), cardKey(s), key('q', C.k.quit)],
    };
  },

  // One level a page: the level of the lesson under the cursor.
  map(ctx) {
    const { s, t, W } = ctx;
    const cursor = s.course[s.mapCursor];
    const lessons = levelLessons(s, levelOf(s, cursor.id));
    const done = lessons.filter((l) => s.progress[l.id].complete).length;
    const total = lessons.length;
    const pct = Math.round((done / total) * 100);
    const barW = W - 6;
    const head = [spread(`${t.lead('map')}${t.pill(C.map, 'accentBg')}  ${t.bold(t.fg('white', C.levelPath(levelName(s, cursor.id))))}`, t.fg('muted', C.ofDone(done, total)), W),
      `${fill(t, done, total, barW)} ${t.fg('ok', `${pct}%`)}`, rule(t, W)];
    const next = s.course.find((l) => toFinish(s, l));
    // The legend's items run on under "Help:" when one row can't hold them.
    // It and the footer explain the tier bars: a page with none has neither.
    const bars = lessons.some((l) => l.content);
    const footer = lessHelpOn(s, lessons);
    // A later level's work folder, and the key that changes it (ticket 86).
    const level = levelKey(s, cursor.id);
    const folder = level ? [folderLine(ctx, levelFolder(s, level), `   ${t.fg('muted', C.folderChange)}`), SPACER] : [];
    const legend = [];
    for (const item of TIERS.map((k) => `${t.fg(TIER_STYLE[k].tint, t.glyph[TIER_STYLE[k].on])} ${t.fg('text', C.tierHelp[k])}`)) {
      const last = legend.at(-1);
      if (last !== undefined && width(`${last}   ${item}`) <= W - 7) legend[legend.length - 1] = `${last}   ${item}`;
      else legend.push(item);
    }
    // The titles give way to the marks, which are wider in ASCII, and to the
    // bars and their gap, on a page that has them.
    // A lesson with its Tear down still to do says so, in a wider column.
    const stateW = lessons.some((l) => tearDownLeft(s, l.id)) ? Math.max(5, width(C.mapTearDown)) : 5;
    const titleW = Math.min(Math.max(...lessons.map((l) => width(titleOf(l)))), W - 30 - (stateW - 5) + (bars ? 0 : BAR + 2) - width(t.glyph.check) - Math.max(width(t.emoji('cup')), width(t.emoji('badge'))));
    // Where the level's rows don't fit even closed up, with the footer gone,
    // the list scrolls: the rows that fit, the cursor's as near their middle
    // as the ends allow.
    const fits = Math.max(1, ctx.roomUnder(head.length) - (bars ? legend.length : 0) - (folder.length ? 1 : 0));
    const at = lessons.indexOf(cursor);
    const from = lessons.length <= fits ? 0 : Math.max(0, Math.min(lessons.length - fits, at - Math.floor(fits / 2)));
    const rows = lessons.slice(from, from + fits).flatMap((l, i) => {
      const p = s.progress[l.id];
      const sel = l === cursor;
      const mark = `${sel ? t.fg('key', t.bold(t.glyph.pointer)) : ' '} ${p.complete ? t.fg('ok', t.glyph.check) : t.fg('faint', t.glyph.dotOff)}`;
      const pillBg = sel ? 'accentBg' : p.complete ? 'okBg' : 'dimBg';
      const name = sel ? t.bold(t.fg('key', titleOf(l))) : t.fg(p.complete ? 'text' : 'muted', titleOf(l));
      const state = p.complete ? t.fg('ok', C.mapDone) : tearDownLeft(s, l.id) ? t.fg('warn', C.mapTearDown) : l === next ? t.fg('accent', t.bold(C.mapNext)) : '';
      const medal = l.id.endsWith('capstone') ? t.emoji('cup') : p.complete && l.content?.badge ? t.emoji('badge') : '';
      const fitTitle = pad(cut(name, titleW + 1, t.unicode ? '…' : '.'), titleW + 1);
      const line = `${mark} ${t.pill(pad(lessonLabel(l.id), 3), pillBg, sel || p.complete ? 'white' : 'dimText')} ${fitTitle} ${bars ? `${mixBar(ctx, l, BAR)}  ` : ''}${pad(state, stateW)}${medal ? ` ${medal}` : ''}`;
      return i ? [spacer('', 'lessons'), line] : [line];
    });
    return {
      head,
      // The footer says what the welcome's hint says, on the same level: it
      // gives way before a row.
      body: [...folder, ...(bars ? [...legend.map((x, i) => `${i ? ' '.repeat(width(C.help) + 2) : `${t.fg('muted', C.help)}  `}${x}`), SPACER, ...rows, ...(footer ? [SPACER, ...optional(para(t, C.mapFooter, W, 'muted'))] : [])] : rows)],
      // Where the bar is short, as in ASCII at 60x20, "choose" gives way so
      // the arrows that switch level stay: the pointer shows what up and
      // down do.
      keys: [{ ...key(t.glyph.up, C.k.choose), short: '' }, levelsOf(s).length > 1 ? key(t.glyph.sides, C.k.level) : null, key('enter', C.k.open), folder.length ? { ...key('f', C.k.folder), low: true } : null, key('m', C.k.back), key('q', C.k.quit)],
    };
  },

  // The lesson's check, item by item. Where the items don't all fit, the
  // page's row gives way (p shows the address) and the items scroll: whole
  // items from s.itemsAt down, one a press of the arrows, with a line that
  // says which are shown, and never past the window that ends on the last
  // item. An item too tall for that room takes the card's other rows; the
  // items never drop, a toast does. Which rows the card has comes from the
  // lesson and what r and errors said, so a poll changes only marks.
  checkonly(ctx) {
    const { s, t, inner } = ctx;
    const l = lessonOf(s);
    const results = s.checks[l.id];
    const head = lessonHead(ctx, '', l.minutes);
    // A slow item a run left out shows as not checked yet. The mark of an
    // item that starts passing pops: hollow, a ring, then the check mark.
    const popping = into(ctx, 'itemPass');
    const passMark = (index) => (!s.fx.itemsPassed?.includes(index) || popping === Infinity ? t.glyph.check
      : popping < SHOTS.itemPass.pop ? t.glyph.dotOff : t.glyph.ring);
    const blocks = l.items.map((text, index) => {
      const r = results?.items?.find((x) => x.index === index);
      const mark = !r || r.slow ? t.fg('faint', t.glyph.dotOff) : r.pass ? t.fg('ok', passMark(index)) : t.fg('warn', t.glyph.warnMark);
      return kept(para(t, text, inner - 4).map((x, i) => `${i ? ' ' : mark} ${x}`));
    });
    const intro = [...sentence(t, checkOnlyWords(s, l), inner, 'text'), SPACER];
    // The page by name, a link where links work: p spells out its address.
    const page = [`${t.link(t.fg('key', C.pageTitle), l.url)}${t.fg('muted', C.pageLink)}`, SPACER];
    // What the runs said beyond the marks: kept, like a step's status line.
    // A slow item stays unchecked until r runs it; once r has, a poll keeps
    // its result (flow), so the line goes for good.
    // While r's run of the slow items goes, the card says so in their place.
    // A lesson that runs in a new copy runs nothing until it has its folder.
    const unchecked = Boolean(folderOf(s)) && l.slow.some((i) => !results?.items?.some((x) => x.index === i && !x.slow));
    const going = s.checkOnlyRun?.lesson === l.id ? s.checkOnlyRun : null;
    const notes = [];
    if (going) notes.push(SPACER, ...kept(spinning(ctx, para(t, checkingLabel(going.running), inner, 'key'))));
    else {
      if (unchecked) notes.push(SPACER, ...kept(para(t, `${t.lead('watch')}${C.slowWait}`, inner, 'muted')));
      if (results?.error) notes.push(SPACER, ...kept(para(t, `${t.lead('broken')}${C.broken(results.error)}`, inner, 'bad')));
    }
    const folder = folderNotes(ctx, inner);
    if (folder.length) notes.push(SPACER, ...folder);
    // The card's text rows: the body's room less the blank above the card,
    // its two borders and its first blank. The blanks between its blocks
    // give way to the page's row and to an item, so the window leaves no
    // row unused that the next item would fill.
    const room = ctx.roomUnder(head.length) - 4;
    // The blanks that give way under `lead`: its own and the notes'. Fit
    // drops spacers from the bottom, and card() merges none of these, as
    // no two of them meet.
    const givingWay = (lead) => [...lead, ...notes].filter((r) => r === SPACER).length;
    const rows = blocks.flat().length;
    const fits = (lead) => lead.length + rows + notes.length <= room + givingWay(lead);
    let shown = blocks;
    let above = fits([...intro, ...page]) ? [...intro, ...page] : intro;
    let more = [];
    let last = 0;
    if (!fits(above)) {
      const avail = room + givingWay(intro) - intro.length - notes.length - 1;
      // The window from item `from`: the items that fit, the sentence above
      // them, and whether the line shows. One item taller than that room:
      // the line, then the sentence, give way, and the next items take what
      // they leave.
      const windowAt = (from) => {
        const tall = blocks[from].length;
        if (tall <= avail) return { k: placesTo(blocks, from, avail), lead: intro, line: true };
        const lead = tall > avail + 1 ? [] : intro;
        return { k: placesTo(blocks, from, room + givingWay(lead) - lead.length - notes.length), lead, line: false };
      };
      last = blocks.length - 1;
      while (last > 0 && windowAt(last - 1).k === blocks.length) last--;
      const from = Math.min(s.itemsAt, last);
      const { k, lead, line } = windowAt(from);
      shown = blocks.slice(from, k);
      above = lead;
      if (line) more = [t.fg('muted', k - from === 1 ? C.itemOf(from + 1, blocks.length) : C.itemsShown(from + 1, k, blocks.length))];
    }
    const place = placeOf(s, t, null, 16);
    return {
      head,
      body: card(ctx, { tint: 'muted', ...whereOf(t, 'terminal', place ? C.terminalInFolder : C.where.terminal, place), done: s.progress[l.id].complete, rows: [...above, ...shown.flat(), ...more, ...notes] }),
      // A lesson that runs in a new copy with none given yet: f is the way on.
      keys: [folderOf(s) ? null : mainKey('f', C.k.giveFolder), shown.length < blocks.length ? key(t.glyph.up, C.k.scroll) : null, folderOf(s) ? key('r', C.k.checkNow) : null, key('p', C.k.page), key('m', C.k.map), folderOf(s) && folderKey(s) ? { ...key('f', C.k.folder), low: true } : null, key('q', C.k.quit)],
      itemsMax: last,
    };
  },
};

function windows(ctx) {
  const { t, W } = ctx;
  const box = (title, lines, inner, color) => {
    const top = `${t.fg(color, `${t.glyph.tl}${t.glyph.rule}`)} ${t.bold(t.fg('white', title))} ${t.fg(color, `${t.glyph.rule.repeat(Math.max(0, inner - width(title) - 3))}${t.glyph.tr}`)}`;
    return [top, ...lines.map((l) => `${t.fg(color, t.glyph.rail)}${pad(l, inner)}${t.fg(color, t.glyph.rail)}`), t.fg(color, `${t.glyph.bl}${t.glyph.rule.repeat(inner)}${t.glyph.br}`)];
  };
  // Side by side, closer together below 66 columns.
  const wide = W >= 66;
  const left = box(C.thisWindow, [`  ${t.fg('code', 'npm run learn')}`, ...C.thisWindowLines.map((l) => `  ${t.fg('text', l)}`)], wide ? 26 : 22, 'accent');
  const right = box(C.otherWindow, C.otherWindowLines.map((l) => `  ${t.fg('text', l)}`), wide ? 27 : 26, 'key');
  // On entry one pulse crosses the arrow toward the other window, a cell at a time.
  const n = wide ? 2 : 1;
  const e = into(ctx, 'welcome');
  const k = e < SHOTS.welcome.pulse ? -1 : Math.floor((e - SHOTS.welcome.pulse) / SHOTS.welcome.cell);
  const [before, after] = wide ? ['  ', '   '] : [' ', ' '];
  const arrow = k >= 0 && k < n
    ? `${before}${t.fg('faint', t.glyph.rule.repeat(k))}${t.fg('key', t.glyph.bold)}${t.fg('faint', `${t.glyph.rule.repeat(n - k - 1)}${t.glyph.right}`)}${after}`
    : t.fg('faint', `${before}${t.glyph.rule.repeat(n)}${t.glyph.right}${after}`);
  return left.map((l, i) => `${l}${i === 2 ? arrow : ' '.repeat(width(arrow))}${right[i]}`);
}

// The 9x4 Pip's face track on the welcome and resume, and how far into it:
// its greeting while that plays (176; it wakes on the welcome, and on
// resume the boot frame woke it, so it starts awake), else its blink, else
// none (awake, as at rest).
function greeting(ctx) {
  if (into(ctx, 'greet') < Infinity) return [greetFace(ctx.s.view), into(ctx, 'greet')];
  return into(ctx, 'blink') < Infinity ? [SHOTS.blink.face, into(ctx, 'blink')] : [];
}

// The big Pip: the detailed raster where the screen has room for it
// (ctx.raster, from pipSlot), with its greeting over main's pose while that
// plays, eased from where its pose jumped while main's `fade` runs, else
// the 9x4 Pip in `mood`, `ms` into the track `face`. Its rows, how wide
// they are, and the row its face is on.
function bigPip(ctx, mood, face, ms) {
  const { t, raster } = ctx;
  if (!raster) return { rows: pip(t, mood, face, ms), width: 9, face: 2 };
  return { rows: pipRaster(raster.pose && pipShown(raster, into(ctx, 'greet'), ctx.clock.at), raster.size), width: PIP_RASTER[raster.size].cols, face: PIP_RASTER[raster.size].face };
}

// Pip with text beside it, from Pip's face row (on the 9x4 Pip its third,
// under the antenna and the head's top), or as low as Pip's rows still hold
// the text, or from its first when the text needs them all. Decoration:
// below 24 rows Pip can give way, leaving the text. Each part wraps to the
// width it is given.
function withPip(ctx, art, parts) {
  const text = (w) => parts.flatMap((part) => part(w));
  const beside = text(ctx.W - art.width - 4);
  const from = Math.max(0, Math.min(art.face, art.rows.length - beside.length));
  const rows = Array.from({ length: Math.max(art.rows.length, from + beside.length) }, (_, i) => {
    const x = beside[i - from];
    return x === undefined ? ` ${art.rows[i] ?? ''}` : ` ${art.rows[i] ?? ' '.repeat(art.width)}   ${x}`;
  });
  return decor(rows, text(ctx.W - 1).map((x) => ` ${x}`));
}

// The level-up's and the complete screen's Pip: `name`'s banner, its
// three rows as `word` draws them now, beside it around its face row where
// the whole banner fits, else the plain word on its face row.
function bannered(ctx, art, name, word, plain) {
  const fits = ctx.t.unicode && ctx.W >= art.width + 5 + bannerWidth(name);
  const lines = fits ? word : [plain];
  const from = fits ? art.face - 1 : art.face;
  return art.rows.map((r, i) => (lines[i - from] === undefined ? ` ${r}` : ` ${r}    ${lines[i - from]}`));
}

// One row per tier, climbing. A repeat: below 24 rows it compacts to one
// row, the mix bar and the pills of the easiest and hardest tiers present.
function staircase(ctx, m, done) {
  const { t } = ctx;
  const [g, h, c] = m;
  const glyphs = (tier, n) => t.fg(done ? 'ok' : TIER_STYLE[tier].tint, t.glyph[TIER_STYLE[tier].on].repeat(n));
  const row = (indent, tier, n) => `${' '.repeat(indent)}${glyphs(tier, n)}   ${tierPill(t, tier)}   ${t.fg('muted', C.tierHelp[tier])}`;
  const out = [];
  if (c) out.push(row(g + h + 4, 'challenge', c));
  if (h) out.push(row(g + 2, 'hinted', h));
  if (g) out.push(row(0, 'guided', g));
  const present = TIERS.filter((_, i) => m[i]);
  const ends = [...new Set([present[0], present.at(-1)])].map((tier) => tierPill(t, tier)).join(` ${t.fg('muted', t.glyph.right)} `);
  return [repeat(out, [`${bar(t, m, done)}   ${ends}`])];
}

// A mix as one row of tier marks, in the tiers' tints or, once done, green.
const bar = (t, m, done) => TIERS.map((k, i) => t.fg(done ? 'ok' : TIER_STYLE[k].tint, t.glyph[TIER_STYLE[k].on].repeat(m[i]))).join('');

// The cells of a lesson's climb on the map and the next screen.
const BAR = 12;

// A lesson's climb as `cells` tier marks, from its content: a lesson with
// no lesson file has none, so it draws blank cells.
function mixBar(ctx, lesson, cells) {
  const { s, t } = ctx;
  if (!lesson.content) return ' '.repeat(cells);
  const idx = s.course.findIndex((l) => l.id === lesson.id);
  return bar(t, scaleMix(mix(ruleTiers(s.course.map((l) => l.content), idx)), cells));
}

// The share of a lesson's planned steps above GUIDED.
function lessHelpShare(s, id) {
  const m = mix(ruleTiers(s.course.map((l) => l.content), s.course.findIndex((l) => l.id === id)));
  return (m[1] + m[2]) / (m[0] + m[1] + m[2]);
}

// ---- the step card -----------------------------------------------------------
// The level's first warm-up: the first step a lesson plays, on a warm-up,
// when no other lesson of its level played one. Since 194 a lesson plays a
// warm-up only on a missed skill, so the level's first lesson with a pool
// may play none and the learner meets their first warm-up later: the play
// decides, not the content. Each lesson's saved `warm`, which it already
// kept, says what it played, so the save gains nothing.
const firstWarmupOfLevel = (s) => s.pos.step === 0
  && !levelLessons(s, levelOf(s)).some((l) => l.id !== s.lesson && s.progress[l.id]?.warm.length);

function stepView(ctx) {
  const { s, t, inner } = ctx;
  const content = contentOf(s);
  const step = stepOf(s);
  const beat = beatOf(s);
  const st = s.beat;
  const tier = tierOf(s);
  const authored = authoredTier(s);
  const style = TIER_STYLE[tier];
  const done = ['done', 'already'].includes(st.status);
  const isLastBeat = lastShown(s);
  const hideRuns = tier !== 'guided' && authored === 'guided';
  const inlineBottom = tier === 'guided' && authored !== 'guided';
  const words = wordsOf(s);
  const rows = [t.bold(t.fg('white', beat.kind === 'type' && step.part === 'Check' ? C.lastQuestion : step.title))];
  if (step.part === 'Warm-up') {
    // A warm-up from another level names that level; one from a level's
    // index page names the index.
    const index = indexLevel(step.from);
    const other = levelOf(s, step.from) !== levelOf(s);
    rows.push(t.fg('muted', index ? C.warmupIndex(C.levels[index]) : C.warmup(lessonNumber(s, step.from), other ? levelName(s, step.from) : null)));
    if (firstWarmupOfLevel(s)) rows.push(...optional(para(t, words.warmupWhy, inner, 'muted')));
  }
  // At GUIDED the beat's reason, in the page's words, sits under the title;
  // a learner who knows the idea has it behind w.
  if (tier === 'guided' && ['do', 'ask'].includes(beat.kind) && beat.why.length) rows.push(...whyLine(t, beat.why[0], inner, 'accent'));
  const quoted = (text, color = 'muted') => para(t, text, inner, color, { quote: true });
  // As the step passes, each command still without a tick gets one, in turn.
  const passing = into(ctx, 'stepDone');
  let fresh = 0;
  // A satisfied "Done when": hidden where the evidence line replaces it, and
  // otherwise optional, since the card already says the step is done.
  const doneWhen = (lines) => (!done ? lines : showsEvidence(s, beat, isLastBeat) ? [] : optional(lines));

  if (beat.kind === 'self') rows.push(...led(t, 'self', beat.self, inner, 'white'));
  if (beat.kind === 'predict') {
    for (const l of beat.lines) if (l.key === 'note') rows.push(...quoted(l.text, 'text'));
  } else {
    beat.lines.forEach((l, i) => {
      const prevRun = beat.lines[i - 1]?.key === 'run';
      const nextRun = beat.lines[i + 1]?.key === 'run';
      if (l.key === 'run') {
        if (hideRuns) return;
        if (!prevRun && i > 0) rows.push(SPACER);
        const cmd = (t.caps.win32 && l.win) || withRoot(l.text, s.facts.root, t.caps.win32, folderOf(s));
        const cw = chipWidth(ctx, beat);
        const long = cw + 22 <= inner;
        const live = l.tick === 'practice-dir' && s.facts.practiceDir;
        // No tick on a beat that was done when it opened: the app never saw
        // the learner run its command.
        const checked = st.status === 'done' && looksAtFile(beat);
        // A live tick stays and takes no turn; each other command takes the next.
        const turn = checked && !live ? ++fresh : 0;
        const ticked = checked && (live || passing >= SHOTS.stepDone.tick * turn);
        const tick = live && !done ? `  ${t.fg('ok', long ? `${t.glyph.check} .practice/ exists` : t.glyph.check)}` : ticked ? `  ${t.fg('ok', t.glyph.check)}` : '';
        const lines = chip(t, cmd, beat.where, cw);
        rows.push(lines[0] + tick, ...lines.slice(1));
        if (!nextRun && i < beat.lines.length - 1) rows.push(SPACER);
      } else if (l.key === 'code') {
        if (hideRuns) return;
        if (i > 0) rows.push(SPACER);
        rows.push(...(t.caps.win32 && l.win ? chip(t, l.win, beat.where, chipWidth(ctx, beat)) : codeRows(t, l, inner, words)));
        if (i < beat.lines.length - 1) rows.push(SPACER);
      } else if (l.key === 'goal') {
        rows.push(...(tier === 'challenge' ? led(t, 'goal', l.text, inner, 'white') : para(t, l.text, inner, 'white')));
      } else if (l.doneWhen) rows.push(...doneWhen(para(t, l.text, inner, 'text')));
      else if (l.key === 'say' || l.key === 'do') rows.push(...para(t, l.text, inner, 'text'));
      else if (l.key === 'note') rows.push(...quoted(l.text, 'text'));
      else if (l.key === 'rule') rows.push(...led(t, 'safety', l.text, inner, 'text', { quote: true }));
      else if (l.key === 'after') {
        const aw = width(t.glyph.arrow) + 1;
        rows.push(...para(t, l.text, inner - aw, 'text').map((x, i) => `${i ? ' '.repeat(aw - 1) : t.fg('accent', t.glyph.arrow)} ${x}`));
      }
      else if (l.key === 'expect') {
        if (looksAtFile(beat)) rows.push(...doneWhen(para(t, `${C.doneWhen}${l.text}`, inner, 'muted')));
        else rows.push(...quoted(l.text));
      }
    });
    if (inlineBottom) {
      for (const b of beat.bottom) {
        const text = (t.caps.win32 && b.win) || b.text;
        // A lead-in, the page's words that frame the command, goes above it.
        if (b.leadIn) rows.push(...para(t, b.leadIn, inner, 'text'));
        rows.push(...(text.includes('`') ? para(t, text, inner, 'text') : chip(t, text, beat.where, chipWidth(ctx, beat))));
      }
    }
    const firstBeat = step.beats.findIndex((b) => b.kind !== 'predict');
    // "Done before" only when the app saw the learner do it.
    const before = doneBefore(s);
    if (tier === 'challenge' && OWN_PARTS.has(step.part) && s.pos.beat === firstBeat) rows.push(SPACER, ...para(t, before ? `${C.noCommands} ${C.doneEachPart}` : C.noCommands, inner, 'muted'));
    else if (before && stepNote(s) && s.pos.beat === firstBeat && !done) rows.push(SPACER, ...para(t, hintAvailable(s) ? C.doneBefore.hinted : C.doneBefore.challenge, inner, 'muted'));
    // An optional step says when to skip it, and how, until it is done (102).
    if (step.optional && !done) rows.push(...kept(para(t, C.optional(step.optional), inner, 'muted')));
    // A long wait says so, in the page's words or as the app's own (103).
    if (beat.wait && !done) rows.push(...kept(beat.wait.text ? quoted(beat.wait.text) : para(t, C.waitLong, inner, 'muted')));
    // Recall while it runs (150): a still box, never scored, that gives way
    // whole before any teaching row and goes when the result lands.
    const box = whileRunsOf(s);
    if (box) rows.push(...optional(['', ...whileRunsBox(ctx, box)]));
    if (hideRuns && beat.lines.some((l) => ['run', 'code'].includes(l.key)) && !done) rows.push(...para(t, C.pressH, inner, 'muted'));
  }
  // A Windows note never drops: without it the step breaks there.
  if (beat.winNote && t.caps.win32) rows.push(...kept(quoted(beat.winNote, 'text')));

  // The question, if this beat asks one.
  if (beat.kind === 'type') {
    rows.push(...kept(para(t, beat.ask, inner, 'white').map((x) => t.bold(x))), ...para(t, C.typeIt, inner, 'muted'), SPACER,
      ...kept([`  ${t.fg('muted', '›')} ${t.fg('code', st.status === 'done' && st.revealed ? '' : st.typed)}${st.status === 'done' ? '' : t.inverse(' ')}`]));
    if (st.status !== 'done') rows.push(SPACER, ...para(t, C.emptyShows, inner, 'muted'));
  } else if (beat.ask) {
    // The guess it recalls: a predict beat's pick, not a choice's, now that
    // ask picks are saved too (ticket 104).
    const guessed = stepsOf(s).find((x) => x.id === beat.recall)?.beats ?? [];
    const recall = beat.recall ? Object.entries(s.progress[s.lesson].answers).find(([k]) => k.startsWith(`${beat.recall}.`) && guessed[Number(k.slice(k.lastIndexOf('.') + 1))]?.kind === 'predict') : null;
    rows.push(SPACER);
    if (recall) rows.push(t.fg('muted', C.youGuessed(plainText(recall[1]))));
    // A safety choice says so on its own line; the question wraps under its lead.
    if (beat.kind === 'predict' && beat.safety) rows.push(...kept([`${t.lead('safety')}${t.fg('warn', C.safetyChoice)}`]));
    const prefix = t.lead('guess');
    rows.push(...kept(hang(prefix, para(t, beat.ask, inner - width(prefix), 'white').map((x) => t.bold(x)))));
    rows.push(SPACER, ...kept(options(ctx, beat)));
    if (beat.kind === 'predict' && !st.answer) rows.push(SPACER, ...para(t, C.anyAnswer, inner, 'muted'));
  }

  // Feedback, the hint box, the eased line and the same-answer note: none
  // of them drops.
  const withFooter = (note) => {
    const footer = footerRows(ctx, { beat, content, isLastBeat, note });
    return footer.length ? [...rows, SPACER, ...kept(footer)] : rows;
  };

  const whereKey = beat.kind === 'do' ? beat.where : beat.kind;
  const whereEmoji = { terminal: 'terminal', claude: 'claude', 'claude-2': 'claude', shell: 'terminal', editor: 'editor', browser: 'browser', predict: 'guess', ask: 'guess', type: 'goal', self: 'self' }[whereKey];
  // A terminal or Claude Code names its folder where that isn't the copy.
  const place = ['terminal', 'claude', 'claude-2', 'shell'].includes(whereKey) ? placeOf(s, t, beat, 16) : null;
  // A lesson that numbers its terminals labels them as its page does (103).
  const numbered = content.terminals?.[whereKey];
  const where = numbered ? C.terminalN(numbered) : place && ['terminal', 'shell'].includes(whereKey) ? C.terminalInFolder : C.where[whereKey];
  const tint = done ? 'ok' : style.tint;
  const head = lessonHead(ctx, tierPill(t, tier), C.stepOf(s.pos.step + 1, stepsOf(s).length));
  // The shell's words without "beside Claude Code", where they don't fit.
  const brief = !numbered && whereKey === 'shell' ? C.terminalInFolder : null;
  const cardWith = (note) => card(ctx, { tint, ...whereOf(t, whereEmoji, where, place, brief), done: done && (looksAtFile(beat) || GIT.has(beat.verify.kind) || needsChange(beat.verify)), rows: withFooter(note) });
  let body = cardWith(null);
  // The same-answer note (ticket 192) takes the rows the screen pads with,
  // and the row of a "Press h" line the key bar repeats, and no more: the
  // first form that leaves the card no taller than its room, or than it
  // was, so nothing above the note gives way or moves.
  const notes = sameNotes(ctx);
  if (notes.length) {
    const most = Math.max(ctx.roomUnder(head.length) - 1, heightOf(body));
    const tries = notes.flatMap((r) => [{ rows: r, press: true }, { rows: r, press: false }]);
    body = tries.map(cardWith).find((b) => heightOf(b) <= most) ?? cardWith(tries.at(-1));
  }
  return { head, body, keys: stepKeys(ctx, { beat, step, content, done, isLastBeat }) };
}

// Chips in a beat share one width: room for the longest command, up to the
// card's width. A live tick beside a chip shortens to a mark when it won't fit.
// `shown` adds the commands a hint rung draws in place of the beat's own: a
// ladder's bottom lines (ticket 184).
const chipWidth = (ctx, beat, shown = []) => {
  const longest = Math.max(...beat.lines.filter((l) => l.key === 'run').map((l) => Math.max(width(withRoot(l.text, ctx.s.facts.root, ctx.t.caps.win32, folderOf(ctx.s))), width(l.win ?? ''))), ...beat.lines.filter((l) => l.key === 'code').map((l) => width(l.win ?? '')), ...beat.bottom.map((b) => Math.max(width(b.text), width(b.win ?? ''))), ...shown.filter((b) => b.key !== 'code' && !b.text.includes('`')).map((b) => Math.max(width(withRoot(b.text, ctx.s.facts.root, ctx.t.caps.win32, folderOf(ctx.s))), width(b.win ?? ''))), 10);
  // Room for the tick a done command gets beside its chip.
  return Math.min(ctx.inner - 2 - width(ctx.t.glyph.check), Math.max(longest + 4, 30));
};

function options(ctx, beat) {
  const { s, t, inner } = ctx;
  const st = s.beat;
  return beat.options.map((o, i) => {
    const chosen = st.answer?.index === i;
    const wrong = st.wrongs.includes(i);
    const right = st.answer && o.kind === 'right' && (st.revealed || chosen || (beat.kind === 'predict' && !beat.revealAt));
    const cursor = !st.answer && s.cursor === i;
    const mark = right ? t.fg('ok', t.glyph.check) : wrong ? t.fg('warn', t.glyph.warnMark) : cursor ? t.fg('key', t.bold(t.glyph.pointer)) : chosen ? t.fg('key', t.glyph.pointer) : ' ';
    const num = cursor ? t.inverse(t.fg('key', t.bold(` ${i + 1} `))) : t.fg('muted', ` ${i + 1} `);
    const color = right ? 'ok' : wrong || o.kind === 'other' ? 'muted' : cursor ? 'key' : 'text';
    const tag = wrong && st.wrongs.at(-1) === i && !st.answer ? `  ${t.fg('warn', `${t.unicode ? '←' : '<-'} not this one`)}` : '';
    // The option wraps short of the tag beside its first line.
    const text = para(t, o.text, inner - 10 - width(tag), color);
    return text.map((x, k) => (k ? `       ${x}` : ` ${mark} ${num}  ${cursor ? t.bold(x) : x}${tag}`));
  }).flat();
}

// A long wait's warm-up (ticket 150), behind a muted bar: its question and
// numbered options, then, once picked, the right one ticked, a wrong pick
// marked, and the page's words for it. Nothing in it moves.
function whileRunsBox(ctx, { beat, answer }) {
  const { t, inner } = ctx;
  const w = inner - 2;
  // Every mark takes the widest one's columns, so the numbers line up.
  const markW = Math.max(width(t.glyph.check), width(t.glyph.warnMark));
  const rows = [`${t.bold(t.fg('white', C.whileItRuns))}  ${t.fg('muted', C.whileNotScored)}`, ...para(t, beat.ask, w, 'white')];
  beat.options.forEach((o, i) => {
    const right = answer !== null && o.kind === 'right';
    const wrong = answer === i && !right;
    const glyph = right ? t.glyph.check : wrong ? t.glyph.warnMark : '';
    const mark = `${' '.repeat(markW - width(glyph))}${t.fg(right ? 'ok' : 'warn', glyph)}`;
    const indent = ' '.repeat(markW + 6);
    const text = para(t, o.text, w - width(indent), right ? 'ok' : wrong ? 'muted' : 'text');
    rows.push(...text.map((x, k) => (k ? `${indent}${x}` : ` ${mark} ${t.fg('muted', `${i + 1}`)}   ${x}`)));
  });
  const picked = answer === null ? null : beat.options[answer];
  const words = picked && (picked.kind !== 'right' && picked.because ? picked.because : beat.reveal);
  if (answer === null) rows.push(...para(t, C.whilePress, w, 'muted'));
  else if (words) rows.push(...para(t, words, w, 'text', { quote: true }));
  return rows.map((l) => prefixed(`${t.fg('muted', t.glyph.bar)} `, l));
}

// A run's checking label: how far the child has got where it runs several
// items, or what it checks.
const checkingLabel = (running, what) => (running?.m > 1 ? C.checkingItem(running.n, running.m) : C.checking(what));

// The checking label, with the spinner in the cell after it once a child has
// run 150 ms, and from 3 s the seconds it has run (every label leaves room
// for both).
function spinning(ctx, lines) {
  const { t, ph } = ctx;
  if (ph.spinner === null) return lines;
  const spin = t.fg('key', t.glyph.spinner[ph.spinner % t.glyph.spinner.length]);
  const secs = ph.elapsed === null ? '' : `  ${t.fg('muted', C.seconds(ph.elapsed))}`;
  return [...lines.slice(0, -1), `${lines.at(-1)} ${spin}${secs}`];
}

function footerRows(ctx, { beat, content, isLastBeat, note = null }) {
  const { s, t, inner } = ctx;
  const st = s.beat;
  const words = wordsOf(s);
  const rows = [];
  const quoted = (text, color = 'text') => para(t, text, inner - 2, color, { quote: true });
  const stepNumber = (id) => stepsOf(s).findIndex((x) => x.id === id) + 1;
  // The paths a git-clean beat names, where it names some.
  const scope = beat.verify.paths?.join(', ');
  // A new "Not yet" line's mark pops from hollow.
  const warnMark = into(ctx, 'notYet') < SHOTS.notYet.pop ? t.glyph.warnPop : t.glyph.warnMark;
  // Room for text beside the burst.
  const room = inner - (t.unicode ? 21 : 7);
  // What the file holds, in `max` columns: on two lines when one is too long.
  // A glob's file is the one it matched.
  const shownPath = st.found ?? beat.evidence;
  const holds = (max) => (width(`${shownPath} holds ${st.evidence}`) <= max ? [`${t.fg('code', shownPath)}${t.fg('text', ' holds ')}${t.fg('code', st.evidence)}`]
    : [t.fg('code', cut(shownPath, max, t.unicode ? '…' : '.')), `${t.fg('text', 'holds ')}${t.fg('code', cut(st.evidence, max - 6, t.unicode ? '…' : '.'))}`]);
  const celebrate = (lines) => {
    const count = s.session + (firstPass(s) ? 1 : 0);
    // The check mark draws in strokes, then the sparks.
    const e = into(ctx, 'stepDone');
    const { strokes, stroke } = SHOTS.stepDone;
    const frame = e < strokes ? 0 : Math.min(4, 1 + Math.floor((e - strokes) / stroke));
    rows.push(...burst(t, [t.bold(t.fg('ok', C.stepDone(s.pos.step + 1))), ...lines, lead(t, 'fire', t.bold(t.fg('challenge', C.session(count))))], frame));
  };

  // What the beat watches, as its waiting line names it, or how far a run
  // of several items has got.
  if (st.status === 'opening') rows.push(...spinning(ctx, para(t, checkingLabel(st.running, beat.watching ?? beat.evidence), inner, 'key')));
  else if (st.status === 'broken') rows.push(...para(t, `${t.lead('broken')}${C.broken(st.error)}`, inner, 'bad'));
  else if (st.status === 'already') {
    if (st.codespace) rows.push(...para(t, `${t.lead('verified')}"${beat.codespace}"`, inner, 'ok'));
    // No check ran: git status passed a beat that needs it to list
    // something, or the app read the file itself. What it saw, as a pass
    // shows it: what changed, or what the file holds.
    else if (needsChange(beat.verify) || READS.has(beat.verify.kind)) {
      rows.push(...para(t, `${t.lead('verified')}${C.alreadyDone}`, inner, 'ok'),
        ...(!st.evidence ? [] : READS.has(beat.verify.kind) ? holds(inner) : para(t, st.evidence, inner, 'text')));
    }
    else rows.push(...para(t, `${t.lead('verified')}${beat.verify.all ? C.alreadyCheck : C.already}`, inner, 'ok'));
  }
  if (beat.verify.all && ['done', 'already'].includes(st.status) && (st.passed ?? s.checks[s.lesson]?.items)) {
    const items = st.passed ?? s.checks[s.lesson].items;
    // In a work folder that isn't the copy, the command names it with
    // --dir, and runs from the copy, as the pages say. A new copy of the
    // template holds the checks itself: its page runs them there, without
    // --dir (r27 E15).
    const newCopy = pinOf(lessonOf(s)) === 'new copy';
    const dir = !newCopy && folderHere(s) !== s.facts.root ? folderHere(s) : null;
    const cmd = `npm run check -- ${s.lesson}${dir ? ` --dir ${quotePath(dir, t.caps.win32)}` : ''}`;
    const mark = `${t.fg('ok', t.glyph.check)} `;
    const passes = wrapRuns([{ text: cmd, color: 'code' }, { text: ` ${C.checkPasses(items.filter((x) => x.pass).length, items.length)[0]}`, color: 'ok' }], inner - width(mark));
    rows.push(...hang(mark, passes.map((line) => line.map((r) => t.fg(r.color ?? 'ok', r.text)).join(''))),
      ...para(t, C.runItToo(newCopy ? C.inNewCopy : dir ? C.inCopy : content.terminals?.[beat.where] ? C.terminalN(content.terminals[beat.where]) : C.where[beat.where] ?? C.where.terminal), inner, 'muted'));
  } else if (st.status === 'done' && looksAtFile(beat)) {
    // What the file holds, beside the burst.
    const ev = showsEvidence(s, beat, isLastBeat) ? holds(room) : [];
    if (isLastBeat) celebrate(ev.length ? ev : para(t, C.beatDone, room, 'text'));
    else rows.push(lead(t, 'verified', t.fg('ok', C.beatDone)));
  } else if (st.status === 'done' && beat.verify.kind === 'git-clean') {
    const clean = scope ? C.cleanUnder(scope) : folderHere(s) !== s.facts.root ? C.cleanRepo : C.cleanCopy;
    if (isLastBeat) celebrate(para(t, clean, room, 'text'));
    else rows.push(...(scope ? para(t, `${t.lead('verified')}${clean}`, inner, 'ok') : [lead(t, 'verified', t.fg('ok', clean))]));
  } else if (st.status === 'done' && needsChange(beat.verify)) {
    // What changed, or is staged, beside the burst.
    if (isLastBeat) celebrate(para(t, st.evidence ?? C.beatDone, room, 'text'));
    else rows.push(lead(t, 'verified', t.fg('ok', C.beatDone)));
  } else if (st.status === 'done') {
    const f = st.feedback;
    if (beat.kind === 'predict') {
      if (beat.revealAt) rows.push(t.fg('ok', C.findOutAt(stepNumber(beat.revealAt))));
      else {
        rows.push(t.fg('ok', st.answer.kind === 'right' ? `${t.glyph.check} ${C.guessRight}` : C.nowYouKnow));
        if (beat.reveal) rows.push(...quoted(beat.reveal));
      }
    } else if (f?.kind === 'right') {
      rows.push(t.bold(t.fg('ok', `${t.glyph.check} ${C.right}`)));
      if (beat.reveal) rows.push(...quoted(beat.reveal));
    } else if (f?.kind === 'revealed') {
      rows.push(t.fg('ok', words.theAnswer));
      if (beat.reveal) rows.push(...quoted(beat.reveal));
      else rows.push(t.fg('text', C.theAnswerIs(st.answer.index + 1)));
    } else if (f) {
      rows.push(t.fg('ok', f.kind === 'other' ? C.otherFine : `${t.glyph.check} ${C.answered}`));
      if (f.because) rows.push(...quoted(f.because));
      if (beat.reveal) rows.push(...quoted(beat.reveal));
      if (f.kind === 'other' && !f.because) rows.push(...para(t, words.stillStuck, inner, 'muted'));
    }
  } else if (st.status === 'waiting' && (st.slowWait || waitsForR(s, beat))) {
    rows.push(...para(t, `${t.lead('watch')}${C.slowWait}`, inner, 'muted'));
  } else if (st.status === 'waiting' && (looksAtFile(beat) || needsChange(beat.verify))) {
    // A stale push means everything is pushed already (r27 E16).
    const line = st.stale && beat.verify.kind === 'probe' && beat.verify.name === 'pushed' ? C.stalePush : st.stale ? C.staleWatch : C.watching;
    const [a, what, b] = line(beat.watching ?? beat.evidence ?? (needsChange(beat.verify) ? 'git status' : 'your files'));
    rows.push(...para(t, `${t.lead('watch')}${a}\`${what}\`${b}`, inner, 'muted'));
  } else if (beat.verify.kind === 'git-clean' && (st.status === 'waiting' || st.status === 'fail')) {
    const paths = gitListed(s, beat);
    if (st.status === 'fail' || paths.length) {
      const listed = st.fail?.paths ?? paths;
      // A scope of one file that is the one change names it once (r27 E13).
      const what = scope && listed.length === 1 && listed[0] === scope ? C.fileUncommitted(scope)
        : `${scope ? C.changedUnder(listed.length, scope) : C.gitDirty(listed.length)} ${listed.slice(0, 3).join(', ')}`;
      rows.push(...para(t, `${st.status === 'fail' ? `${C.notYet} ` : ''}${what}`, inner - 2, 'warn').map((x, i) => (i ? `  ${x}` : `${t.fg('warn', st.status === 'fail' ? warnMark : t.glyph.warnMark)} ${x}`)));
      if (st.status === 'fail') rows.push(`  ${t.fg('muted', C.gitFailAfter)}`);
    } else if (scope) rows.push(...para(t, `${t.lead('watch')}${C.watchingGit}\`git status\`: ${t.glyph.check} ${C.gitCleanUnder(scope)}`, inner, 'muted'));
    else rows.push(lead(t, 'watch', `${t.fg('muted', C.watchingGit)}${t.fg('code', 'git status')}${t.fg('muted', ':')} ${t.fg('ok', `${t.glyph.check} ${C.gitClean}`)}`));
  } else if (st.status === 'fail' && st.fail?.hint) {
    // A beat that reads its file itself, or git status, has a not-yet line
    // in the app's own words, whole; a check's FAIL message is cut to what
    // is wrong.
    const notYet = para(t, `${C.notYet} ${READS.has(beat.verify.kind) || needsChange(beat.verify) ? st.fail.hint : diagnosis(st.fail.hint)}`, inner - 2, 'text').map((x, i) => (i ? `  ${x}` : `${t.fg('warn', t.bold(warnMark))} ${x}`));
    // "The check says:" repeats the message whole, so below 24 rows the
    // line folds to its mark, as a repeat does, before the card loses its
    // title or Goal (ticket 198).
    const says = st.rung >= 0 && rungsOf(s)[st.rung]?.kind === 'check';
    if (says) rows.push(repeat(kept(notYet), kept([`${t.fg('warn', t.bold(warnMark))} ${t.fg('text', C.notYetShort)}`])));
    else rows.push(...notYet);
  }

  // Feedback on a pick that wasn't right, before the answer.
  if (st.status !== 'done' && st.feedback) {
    const f = st.feedback;
    if (f.kind === 'wrong') {
      const box = [];
      if (f.because) {
        box.push(...para(t, `**${C.notQuite}** ${words.trueOfElse}`, inner - 2, 'text'), ...quoted(f.because));
        if (f.point) box.push(`${t.lead('hint')}${t.fg('text', C.lookFor)} ${para(t, f.point, inner - 14, 'warn', { quote: true })[0]}`);
      } else if (f.hint) box.push(`${t.bold(t.fg('warn', C.notQuite))}`, ...quoted(f.hint));
      else box.push(...para(t, `**${C.notQuite}** ${beat.kind === 'type' ? C.lookAgainTyped : C.lookAgain}`, inner - 2, 'text'));
      rows.push(...hintBox(t, box));
    } else if (f.kind === 'stuck') rows.push(...hintBox(t, [...para(t, words.fixFirst, inner - 2, 'warn'), ...quoted(f.because), ...para(t, C.fixThenPick, inner - 2, 'muted')]));
  }

  // The hint box: one rung at a time, the y/n before the exact command.
  if (!['done', 'already'].includes(st.status)) {
    if (st.confirm) rows.push(...hintBox(t, [`${t.lead('hint')}${t.fg('warn', C.showExact)}`]));
    else if (st.rung >= 0) {
      const rungs = rungsOf(s);
      const r = rungs[st.rung] ?? { kind: 'quote', text: '' };
      const box = [];
      const hw = inner - 2 - Math.max(3, width(t.lead('hint')));
      if (r.kind === 'ask') box.push(...para(t, r.text, hw, 'warn'));
      else if (r.kind === 'check') box.push(t.fg('muted', C.checkSays), ...para(t, r.text, hw, 'text'));
      else if (r.kind === 'quote') box.push(...para(t, r.text, hw, 'warn', { quote: true }));
      else box.push(...r.lines.flatMap((b) => {
        if (b.key === 'code' && !(t.caps.win32 && b.win)) return codeRows(t, b, hw, words);
        const text = (t.caps.win32 && b.win) || withRoot(b.text, s.facts.root, t.caps.win32, folderOf(s));
        const lead = b.leadIn ? para(t, b.leadIn, hw, 'text') : [];
        return [...lead, ...(text.includes('`') ? para(t, text, hw, 'text') : chip(t, text, beat.where, Math.min(chipWidth(ctx, beat, r.lines), hw)))];
      }));
      const more = st.rung < rungs.length - 1;
      // The last rung offers the earlier step a back line names, with its
      // why (ticket 192). It stays when the same-answer note comes, so the
      // offer never jumps below the note.
      const back = !more && backOffered(s);
      if (back) box.push(...backRows(ctx, back, hw));
      const pad3 = ' '.repeat(Math.max(3, width(t.lead('hint'))));
      const lines = box.map((x, i) => prefixed(i ? pad3 : `${t.lead('hint')}${' '.repeat(Math.max(0, 3 - width(t.lead('hint'))))}`, x));
      // A note that needs its row takes the place of this line: the key
      // bar still names h.
      if (more && note?.press !== false) lines.push(`   ${t.fg('muted', C.pressHAgain)}`);
      rows.push(...hintBox(t, lines));
    } else if (hintStatus(st) === 'fail' && hintAvailable(s)) rows.push(...(note?.press === false ? [] : para(t, C.pressH, inner - 2, 'muted').map((x) => `  ${x}`)));
    else if (st.idle && hintAvailable(s)) rows.push(t.fg('warn', C.stuckOffer));
  }
  // An eased step whose first beat was already done says so on that beat.
  if (st.eased && st.status !== 'done' && s.pos.beat === 0) rows.push(...para(t, C.eased, inner, 'muted'));
  // The same answer after a redo (ticket 192), in the form stepView chose:
  // last, so no line above it moves as it comes.
  if (note) rows.push(...note.rows);
  return rows;
}

// e's offer: the step it goes back to, by its number and title, then the
// back line's why.
function backRows(ctx, back, w) {
  const { t } = ctx;
  return [...para(t, C.goBack(back.at + 1, back.title), w, 'text'), ...para(t, back.text, w, 'muted', { quote: back.quoted })];
}

// The same-answer note's forms, longest first (ticket 192), or none where
// it doesn't show. stepView takes the first that fits in the rows the screen
// has free, so the note's coming moves no line already on screen. Its offer
// is e's only where e works: never on the y/n, and not twice where the last
// rung already offers it with its why, where the note can give way whole.
// A short form leaves the why to that rung, one h away.
function sameNotes(ctx) {
  const { s, t, inner } = ctx;
  const st = s.beat;
  if (!st.same || hintStatus(st) !== 'fail') return [];
  const full = para(t, C.sameAnswer, inner, 'warn');
  const short = para(t, C.sameShort, inner, 'warn');
  const back = backOffered(s);
  if (st.confirm || (back && st.rung === rungsOf(s).length - 1)) return [[SPACER, ...full], full, short, ...(back ? [[]] : [])];
  if (!back) {
    const stuck = para(t, wordsOf(s).stillStuck, inner, 'muted');
    return [[SPACER, ...full, ...stuck], [...full, ...stuck], full, short];
  }
  const n = back.at + 1;
  const offer = backRows(ctx, back, inner);
  const to = para(t, C.goBackTo(n, back.title), inner, 'text');
  return [[SPACER, ...full, ...offer], [...full, ...offer], [...short, ...offer], [...full, ...to], [...short, ...to],
    para(t, C.sameBack(n, back.title), inner, 'warn'), para(t, C.sameBack(n), inner, 'warn')];
}

// What git status lists that a git-clean beat counts.
const gitListed = (s, beat) => cleanListed(beat.verify, s.git?.paths ?? []);

// A beat whose check is about a file: a check item, or the file read here.
const looksAtFile = (beat) => beat.verify.kind === 'check' || READS.has(beat.verify.kind);
// A check beat with a slow item can't turn green on its own: it waits for r
// from the start, so its card says so before any run (r27 E9).
const waitsForR = (s, beat) => beat.verify.kind === 'check' && (SLOW[s.lesson] ?? []).some((i) => beat.verify.all || beat.verify.items?.includes(i));
// Whether the footer draws the evidence line, what the file holds: a done
// beat's beside the burst, and a reading beat's already done (173).
const showsEvidence = (s, beat, isLastBeat) => looksAtFile(beat) && Boolean(beat.evidence && s.beat.evidence)
  && (s.beat.status === 'done' ? isLastBeat && !(beat.verify.all && s.checks[s.lesson]?.items)
    : s.beat.status === 'already' && !s.beat.codespace && READS.has(beat.verify.kind));

// The first clause of a check's FAIL message: what is wrong, before how to fix it.
export function diagnosis(hint) {
  let code = false;
  for (let i = 0; i < hint.length; i++) {
    if (hint[i] === '`') code = !code;
    if (code) continue;
    if (hint.startsWith('. ', i)) return hint.slice(0, i + 1);
    // A colon that introduces a short list of names, such as the files a check
    // found, belongs to what is wrong: keep the list.
    if (hint.startsWith(': ', i)) {
      const rest = hint.slice(i + 2);
      const end = rest.search(/\.(\s|$)/);
      const list = end === -1 ? rest : rest.slice(0, end);
      if (/^[^\s`]+(, [^\s`]+)*$/.test(list)) return hint.slice(0, i + 2 + list.length + 1);
      return hint.slice(0, i);
    }
  }
  return hint;
}

function stepKeys(ctx, { beat, step, content, done, isLastBeat }) {
  const { s, t } = ctx;
  const st = s.beat;
  const tier = tierOf(s);
  const style = TIER_STYLE[tier];
  const card = cardKey(s);
  // k sits after ? more, so a narrow bar gives it up first.
  const copy = copyable(s) ? key('k', C.k.copy) : null;
  if (st.confirm) return [mainKey('y', C.k.yes, 'warn', 'black'), key('n', C.k.no)];
  if (done) {
    const next = isLastBeat ? stepsOf(s)[s.pos.step + 1] : null;
    const label = next ? C.k.nextTo(next.title) : C.k.next;
    return [mainKey('enter', label, undefined, undefined, C.k.next), key('b', C.k.back), beat.why.length ? key('w', C.k.why) : null, copy, key('m', C.k.map), card, key('q', C.k.quit)];
  }
  if (beat.kind === 'type') return [key('enter', C.k.answer), key('esc', C.k.clear), key('ctrl+c', C.k.quit)];
  const hint = hintAvailable(s) ? key('h', st.rung >= 0 ? C.k.moreHelp : hintStatus(st) === 'fail' ? C.k.help : C.k.hint) : null;
  const why = beat.why.length ? key('w', C.k.why) : null;
  // e comes in before q, so the keys already on the bar keep their places,
  // and it stays when a narrow bar drops keys: the note names it (192).
  const earlier = backOffered(s) ? { ...key('e', C.k.earlier), short: C.k.earlierShort, stays: true } : null;
  // x skips an optional step (102); the card names it, so a narrow bar may drop it.
  const skip = step.optional ? key('x', C.k.skip) : null;
  if (beat.ask && !st.answer) {
    return [key(t.glyph.up, C.k.choose), key('enter', C.k.answer), st.wrongs.length && beat.kind !== 'predict' ? key('s', C.k.showAnswer) : null, hint, why, copy, earlier, skip, key('q', C.k.quit)];
  }
  const v = beat.verify.kind;
  if (v === 'self' || v === 'none' || beat.kind === 'self' || (v === 'git-clean' && beat.doneLabel)) {
    // Enter only where there is nothing to confirm: a done-label waits for space.
    const k = v === 'none' && !beat.doneLabel ? 'enter' : 'space';
    // A done-label git beat at CHALLENGE: r is the try that opens h, so offer it.
    const r = !hint && tier === 'challenge' && tryFirst(s) === 'r' && !st.unlocked && rungsOf(s).length ? key('r', C.k.checkNow) : null;
    return [mainKey(k, beat.doneLabel ?? C.k.next, style.bg, style.fgOnBg), hint ?? r, why, copy, key('m', C.k.map), card, earlier, skip, key('q', C.k.quit)];
  }
  const r = hintStatus(st) === 'fail' ? key('r', C.k.checkAgain) : key('r', C.k.checkNow);
  return [hint, r, why, key('m', C.k.map), hint ? null : key('?', C.k.more), copy, card, earlier, skip, key('q', C.k.quit)];
}
// The next screen's enter: the next lesson, or the map after the last.
const nextKey = (s) => {
  const next = nextLessonOf(s);
  return next ? mainKey('enter', C.k.startN(lessonLabel(next.id))) : mainKey('enter', C.k.map);
};
// `c card`, once the card has an entry. It is low: a bar too narrow for it
// gives it up before the main key's long label, and it sits before q, so
// a short bar drops it first too.
const cardKey = (s) => (cardOf(s).length ? { ...key('c', C.k.card), low: true } : null);

// ---- overlays ----------------------------------------------------------------
// Whole places (each a run of rows) from place `from` on, as many as `avail`
// rows hold: the first always, then each next one while it fits. `first` is
// the rows the first takes on screen. Returns the index after the last
// shown. The card overlay and the check-only card scroll by it.
function placesTo(places, from, avail, first = places[from].length) {
  let k = from + 1;
  let used = first;
  while (k < places.length && used + places[k].length <= avail) used += places[k++].length;
  return k;
}

// The card's layout: a title, its intro and `units`, the entries' rows,
// then the guide's Commands by level page. Where it is taller than its
// room, it shows whole places from s.cardAt down, one a press of the
// arrows: each entry is a place, and the link is the last, so the last
// place always shows it, a toast or not. `scroll` is the arrows' key, or null.
// Your card's (167) and the comparison's (173) link breaks only after a /,
// ? or &, and the card scrolls no further than the window that ends on the
// link, `max`.
function cardPlaces(ctx, units, title, intro) {
  const { s, t, inner, room } = ctx;
  const head = [t.bold(t.fg('white', title)), ...para(t, intro, inner, 'muted'), ''];
  const url = urlRows(t, COMMANDS_URL, inner);
  // Under an entry, the link keeps a blank above it.
  const places = [...units, [...(units.length ? [''] : []), t.fg('text', C.cardLink), ...url]];
  const avail = room - head.length;
  // The first place shown never opens on a blank: the link's goes there.
  const opening = (from) => (places[from][0] === '' ? places[from].slice(1) : [...places[from]]);
  const fits = places.flat().length <= avail;
  let max = places.length - 1;
  if (fits) max = 0;
  else while (max > 0 && placesTo(places, max - 1, avail, opening(max - 1).length) === places.length) max--;
  const from = fits ? 0 : Math.min(s.cardAt, max);
  const shown = opening(from);
  const k = placesTo(places, from, avail, shown.length);
  shown.push(...places.slice(from + 1, k).flat());
  return { body: [...head, ...shown], scroll: from > 0 || k < places.length ? key(t.glyph.up, C.k.scroll) : null, max };
}

// The fewest columns the comparison gives what a command does beside it.
const COMPARE_MIN = 24;

const OVERLAYS = {
  // The intro's notes before the start, whole, for where the intro has room
  // for only the row that points here. Where they are taller than the
  // room, whole notes from s.cardAt down, one a press of the arrows.
  notes(ctx) {
    const { s, t, inner, room } = ctx;
    const head = [t.bold(t.fg('white', C.notesTitle)), ''];
    const places = noteRows(ctx, inner).map((n) => n.map((r) => r.text));
    const avail = room - head.length;
    const from = places.flat().length <= avail ? 0 : Math.min(s.cardAt, places.length - 1);
    const k = places.length ? placesTo(places, from, avail) : 0;
    return {
      body: [...head, ...places.slice(from, k).flat()],
      keys: [from > 0 || k < places.length ? key(t.glyph.up, C.k.scroll) : null, key('n', C.k.close), key('q', C.k.close)],
    };
  },
  // The path prompt (ticket 86): what it asks for, the path as typed, its
  // last rows where it is long, so the end the next key goes to shows, and
  // a folder main found missing, or that main is looking.
  folder(ctx) {
    const { s, t, inner } = ctx;
    const a = s.folderAsk;
    // A level's folder, or a lesson's new copy.
    const level = C.levels[a.key];
    const room = inner - 4;
    const rows = [];
    let row = '';
    for (const g of graphemes(a.typed)) {
      if (width(row + g) > room) {
        rows.push(row);
        row = '';
      }
      row += g;
    }
    rows.push(row);
    const shown = rows.slice(-3);
    const input = shown.map((r, i) => `  ${t.fg('muted', i ? ' ' : rows.length > shown.length ? t.glyph.ellipsis : '›')} ${t.fg('code', r)}${i === shown.length - 1 && !a.asked ? t.inverse(' ') : ''}`);
    const note = a.asked ? para(t, C.checking(), inner, 'key') : a.missing ? para(t, `${t.glyph.warnMark} ${C.noFolder(shortPath(t, a.missing, inner - 16))}`, inner, 'warn')
      : a.isCopy ? para(t, `${t.glyph.warnMark} ${C.newCopyIsCopy}`, inner, 'warn') : [];
    return {
      body: [...kept([t.bold(t.fg('white', level ? C.folderPrompt(level) : C.folderPromptNew))]),
        ...para(t, level ? `${C.folderHow} ${C.folderEmpty}` : C.folderHow, inner, 'muted'), SPACER, ...kept(input),
        ...(note.length ? [SPACER, ...kept(note)] : [])],
      keys: a.asked ? [key('esc', C.k.cancel)] : [key('enter', C.k.useIt), key('esc', C.k.cancel), key('ctrl+c', C.k.quit)],
    };
  },
  why(ctx) {
    const { s, t, inner } = ctx;
    return {
      body: [t.bold(t.fg('white', wordsOf(s).why)), SPACER, ...beatOf(s).why.flatMap((w) => para(t, w, inner, 'text', { quote: true }))],
      keys: [key('w', C.k.close), key('q', C.k.close)],
    };
  },
  help(ctx) {
    const { t, inner, rows, room } = ctx;
    // A key padded as drawn: ASCII spells some arrows wider.
    const row = ([k, label]) => `  ${t.fg('key', t.bold(pad(t.unicode ? k : ascii(k), 10)))}${t.fg('text', label)}`;
    // The calm line drops before any key or blank does: it shows only on
    // one row, from 24 rows, where the keys and their blanks leave room.
    const calm = rows >= 24 && width(C.calm) <= inner;
    const list = [...C.keyHelp];
    // ← → on the map, under the arrows' row, where the course has more than
    // one level.
    if (levelsOf(ctx.s).length > 1) list.splice(list.findIndex(([k]) => k.startsWith('↑')) + 1, 0, C.levelKey);
    const keys = list.map(row);
    // c's row, under p's, shows only where every key, blank and the calm
    // line leave it room, so it never costs a blank: 60x20 gives it up.
    if (room >= 3 + keys.length + (calm ? 2 : 0) && width(row(C.cardKey)) <= inner) keys.splice(list.findIndex(([k]) => k === 'p') + 1, 0, row(C.cardKey));
    return {
      body: [t.bold(t.fg('white', C.keysTitle)), SPACER, ...keys, ...(calm ? optional(['', ...para(t, C.calm, inner, 'muted')]) : [])],
      keys: [key('?', C.k.close), key('q', C.k.close)],
    };
  },
  // Your card: the entries from cardOf, each its lesson, the page's command
  // and what it does.
  card(ctx) {
    const { s, t, inner } = ctx;
    // What it does hangs under the command, past the lesson's pill.
    const units = cardOf(s).map((e) => {
      const label = `${t.pill(pad(lessonLabel(e.lesson), 3), 'dimBg', 'dimText')}  `;
      return [...hang(label, commandRows(t, e.show, inner - width(label))), ...hang(' '.repeat(width(label)), para(t, e.does, inner - width(label), 'text', { quote: true }))];
    });
    const { body, scroll, max } = cardPlaces(ctx, units, C.cardTitle, units.length ? C.cardIntro : C.cardEmpty);
    return { body, keys: [scroll, key('c', C.k.close), key('q', C.k.close)], max };
  },
  // Recall, then compare: the lesson's own entries, whole as soon as space
  // asks. One lesson needs no pill, so what it does sits beside the command,
  // or under it, as on the card, where a long command would leave it less
  // than COMPARE_MIN columns. Enter goes on as from the next screen; space
  // goes back to it.
  compare(ctx) {
    const { s, t, inner } = ctx;
    const entries = recallOf(s);
    const col = Math.max(0, ...entries.map((e) => width(e.show))) + 3;
    const units = entries.map((e) => (inner - col >= COMPARE_MIN
      ? hang(t.fg('code', pad(e.show, col)), para(t, e.does, inner - col, 'text', { quote: true }))
      : [...commandRows(t, e.show, inner), ...hang('   ', para(t, e.does, inner - 3, 'text', { quote: true }))]));
    const { body, scroll, max } = cardPlaces(ctx, units, C.compareTitle(lessonLabel(s.lesson)), C.compareIntro);
    return { body, keys: [nextKey(s), scroll, key('space', C.k.close), key('q', C.k.close)], max };
  },
  page(ctx) {
    const { s, t, W, inner } = ctx;
    const step = s.view === 'step' ? stepOf(s) : null;
    // A warm-up recalls an earlier lesson or a level index: its page is that one.
    const l = step?.part === 'Warm-up' ? recalledPage(s, step) : lessonOf(s);
    const anchor = step && step.part !== 'Warm-up' ? `#${step.part.toLowerCase().replace(/ /g, '-')}` : '';
    const url = `${l.url}${anchor}`;
    const stuck = l.content?.stuck ?? l.stuck;
    // Go further with its address spelled out, for a terminal with no links.
    // The parser holds a read line to one link. The addresses take the
    // frame's whole width, from its margin.
    const read = l.content?.intro.read;
    return {
      body: [t.bold(t.fg('white', wordsOf(s).pageTitle)), ...urlRows(t, url, W), SPACER,
        t.fg('text', C.stuckLink), ...urlRows(t, stuck, W),
        ...(read ? [SPACER, ...goFurther(t, read, inner), ...urlRows(t, absolute(inline(read).find((r) => r.url).url), W)] : [])],
      keys: [key('p', C.k.close), key('q', C.k.close)],
    };
  },
};
