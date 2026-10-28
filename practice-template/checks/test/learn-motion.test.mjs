// The learn app's motion: the gate and the calm switch, the frame clock, the
// in-memory stamps, the pure timing module, the one-shots frame by frame
// (design 2.3 and 2.4), and the screen writer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pip, pipFace } from '../../learn/lib/art.mjs';
import { capabilities } from '../../learn/lib/caps.mjs';
import { READS } from '../../learn/lib/content.mjs';
import { C } from '../../learn/lib/copy.mjs';
import { beatOf, DEFER_MS, IDLE_MS, isDone, reduce, stepOf, tierOf, watching } from '../../learn/lib/flow.mjs';
import { ambientAllowed, ambientOpened, BOOT_FROM, bootChange, faceMoments, greetFace, greetFrameIn, nextChange, oneShot, phases, pipGates, REST, SHOTS, shotStarts, TIMING } from '../../learn/lib/motion.mjs';
import { createPip, restPose } from '../../learn/lib/pip/pip.mjs';
import { bootFrame, pipSlot, pipTarget, render } from '../../learn/lib/render.mjs';
import { FORMAT, saveState, snapshot, storePath } from '../../learn/lib/store.mjs';
import { openScreen } from '../../learn/lib/screen.mjs';
import { graphemes, isEmoji, strip, width } from '../../learn/lib/text.mjs';
import { theme } from '../../learn/lib/theme.mjs';
import { repo, withRepo } from './helpers.mjs';
import { allScreens, b1Item, course, driver, finishedBefore, gitLists, lessonScreens, mapTo, onReading, playUntil, root } from './learn-drive.mjs';
import { fakeClock, fakeOut, screenModel } from './learn-term.mjs';

// A terminal that can show everything: a TTY with 256 colors.
const tty = (depth = 8) => ({ isTTY: true, getColorDepth: () => depth });
const ENV = { TERM: 'xterm-256color' };

test('motion is on in a full terminal, and off under NO_COLOR, LEARN_PLAIN, LEARN_CALM, --calm, --plain, TERM=dumb, no TTY or no Unicode', () => {
  const on = capabilities(tty(), ENV, 'linux', []);
  assert.equal(on.motion, true);
  assert.equal(on.calm, false);
  const off = {
    NO_COLOR: capabilities(tty(), { ...ENV, NO_COLOR: '1' }, 'linux', []),
    LEARN_PLAIN: capabilities(tty(), { ...ENV, LEARN_PLAIN: '1' }, 'linux', []),
    LEARN_CALM: capabilities(tty(), { ...ENV, LEARN_CALM: '1' }, 'linux', []),
    '--calm': capabilities(tty(), ENV, 'linux', ['--calm']),
    '--plain': capabilities(tty(), ENV, 'linux', ['--plain']),
    'TERM=dumb': capabilities(tty(), { TERM: 'dumb' }, 'linux', []),
    'no TTY': capabilities({ isTTY: false }, ENV, 'linux', []),
    'no Unicode': capabilities(tty(), { TERM: 'linux' }, 'linux', []),
  };
  for (const [why, caps] of Object.entries(off)) assert.equal(caps.motion, false, why);
  assert.equal(capabilities(tty(4), ENV, 'linux', []).motion, true, '16 colors keeps motion');
  assert.equal(off.LEARN_CALM.calm, true);
  assert.equal(off['--calm'].calm, true);
  // --plain is LEARN_PLAIN: ASCII with no color.
  assert.equal(off['--plain'].unicode, false);
  assert.equal(off['--plain'].depth, 1);
  // Calm changes nothing else.
  assert.deepEqual({ ...off['--calm'], motion: true, calm: false }, on);
});

// The app as a learner starts it, with no terminal: the plain list, or a
// usage error.
const app = (args) => {
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  return spawnSync(process.execPath, [join(root, 'learn', 'app.mjs'), ...args], { input: '', encoding: 'utf8', env });
};

test('--calm and --plain are known flags; anything else, --lesson too until it is built, prints one usage line and exits 2', () => {
  for (const flag of ['--calm', '--plain']) {
    const r = app([flag]);
    assert.equal(r.status, 0, `${flag}: ${r.stderr}`);
    assert.equal(r.stderr, '', flag);
    assert.match(r.stdout, /Install, sign in and look around/, `${flag} still prints the path`);
  }
  for (const args of [['--nope'], ['calm'], ['--lesson', 'b-1'], ['--calm', '-x']]) {
    const r = app(args);
    assert.equal(r.status, 2, args.join(' '));
    assert.equal(r.stdout, '', `${args.join(' ')}: nothing on stdout`);
    assert.equal(r.stderr.trimEnd().split('\n').length, 1, `${args.join(' ')}: one line, got ${r.stderr}`);
    assert.match(r.stderr, /^Usage: npm run learn /);
    assert.match(r.stderr, /--calm\b.*--plain\b/);
  }
});

// Each level-up and the complete screen of a lesson, played on the path from
// its start by a learner who finished every lesson before it.
function celebrations(id) {
  // A lesson that runs in a new copy (a-capstone) plays there once its folder is saved.
  const copy = course.find((l) => l.id === id)?.newCopy ? { folders: { [id]: '/home/sam/claude-capstone' } } : {};
  const d = driver({ course, saved: { format: 1, welcomed: true, lessons: finishedBefore(id), ...copy } });
  const out = [];
  playUntil(d, (s) => {
    if (s.lesson === id && ['levelup', 'complete'].includes(s.view) && out.at(-1)?.[1] !== s) out.push([`${id} ${s.view === 'levelup' ? `level up ${s.levelTo}` : 'complete'}`, s]);
    return s.lesson === id && s.view === 'complete';
  });
  return out;
}
// Every screen of lesson 1, and every step screen, level-up and complete
// screen of each lesson in the app.
const lessons = course.filter((l) => l.content);
const still = [...allScreens(), ...lessons.flatMap((l) => [...lessonScreens(l.id), ...celebrations(l.id)])];
// And with the waiting loops running (159), to keep it quick on a sample:
// every second card that says "Checking", its check or git child started
// as "Checking" began; every sixth watched screen, after a file change 30 s
// on.
const running = still.filter(([, s]) => s.view === 'step' && s.beat?.status === 'opening' && beatOf(s).verify.kind !== 'file').filter((_, n) => n % 2 === 0).map(([label, s]) => [`${label}, its child running`, reduce(s, { type: 'run-start', now: s.fx.check }).state]);
const changed = still.filter(([, s]) => watching(s)).filter((_, n) => n % 6 === 0).map(([label, s]) => [`${label}, a file changed`, reduce(s, { type: 'activity', now: s.now + 30_000 }).state]);
const screens = [...still, ...running, ...changed];
const SIZES = [[60, 20], [80, 24]];
const MOTION = { full: { tty: true, depth: 8, unicode: true, links: true, win32: false }, sixteen: { tty: true, depth: 4, unicode: true, links: false, win32: false } };

test('rest equals calm: with motion caps, the rest frame is the motion-off frame, byte for byte', () => {
  assert.deepEqual(REST, { at: Infinity });
  for (const [name, caps] of Object.entries(MOTION)) {
    const moving = theme({ ...caps, motion: true, calm: false });
    const calm = theme({ ...caps, motion: false, calm: true });
    for (const [cols, rows] of SIZES) {
      for (const [label, state] of screens) {
        const size = { cols, rows };
        assert.deepEqual(render(state, size, moving, REST), render(state, size, calm), `${label} at ${cols}x${rows} (${name})`);
      }
    }
  }
  // The detailed Pip (170): with motion off, main's controller gives the
  // rest pose of the screen's state, even just as a level-up or complete
  // screen arrives, when its reaction would play; that frame is the calm
  // one, motion caps or calm, on every screen and boot frame with room (in
  // truecolor only, 174).
  let rasters = 0;
  let reacting = 0;
  const moving = theme({ ...MOTION.full, depth: 24, motion: true, calm: false });
  const calm = theme({ ...MOTION.full, depth: 24, motion: false, calm: true });
  for (const [cols, rows] of [...SIZES, [120, 40]]) {
    const size = { cols, rows };
    for (const [label, state] of [['boot', null], ...screens]) {
      const slot = pipSlot(state, size, moving);
      if (!slot) continue;
      rasters += 1;
      // As main sets it: working from git's question, then this screen.
      const target = pipTarget(state, state ? state.fx.view : 0);
      const pip = createPip({ state: 'working', at: (state?.fx.view ?? 0) - 1_000 });
      const { state: next, since, ...event } = target;
      pip.setState(next, { at: since ?? 0, ...event });
      const at = (state?.fx.view ?? 0) + 200;
      const gates = (motion) => pipGates(state, at, { motion, truecolor: true, remote: false });
      const still = pip.pose(at, gates(false));
      assert.deepEqual(still, restPose(next), `${label} at ${cols}x${rows}: the rest pose`);
      if (JSON.stringify(pip.pose(at, gates(true))) !== JSON.stringify(still)) reacting += 1;
      const draw = (t, pose) => (state ? render(state, size, t, REST, { size: slot, pose }) : bootFrame(0, size, t, REST, { size: slot, pose }));
      assert.deepEqual(draw(moving, still), draw(calm, restPose(next)), `${label} at ${cols}x${rows}, with the raster`);
    }
  }
  assert.ok(rasters > 0);
  // With motion on, those same moments move: the check above is not idle.
  assert.ok(reacting > 0);
});

test('with motion off (calm, NO_COLOR, LEARN_PLAIN, no Unicode, TERM=dumb), a frame at any time is the rest frame', () => {
  const modes = {
    calm: capabilities(tty(), { ...ENV, LEARN_CALM: '1' }, 'linux', []),
    NO_COLOR: capabilities(tty(), { ...ENV, NO_COLOR: '1' }, 'linux', []),
    LEARN_PLAIN: capabilities(tty(), { ...ENV, LEARN_PLAIN: '1' }, 'linux', []),
    'no Unicode': capabilities(tty(), { TERM: 'linux' }, 'linux', []),
    'TERM=dumb': capabilities(tty(), { TERM: 'dumb' }, 'linux', []),
  };
  for (const [mode, caps] of Object.entries(modes)) {
    const t = theme(caps);
    // Calm on every screen at every one-shot's frames; the other modes, to
    // keep it quick, on every fourth screen at each one-shot's start and
    // halfway. And later.
    for (const [label, state] of screens.filter((_, n) => mode === 'calm' || n % 4 === 0)) {
      const size = { cols: 80, rows: 24 };
      const rest = render(state, size, t, REST);
      const halves = Object.entries(shotStarts(state)).filter(([, start]) => start !== undefined).flatMap(([part, start]) => [start, start + TIMING[part] / 2]);
      for (const at of [...(mode === 'calm' ? frameTimes(state) : halves), state.now + 5_000]) assert.deepEqual(render(state, size, t, { at }), rest, `${label} (${mode}) at ${at}`);
    }
  }
});

// The times a screen's frames can change: each one-shot that plays on it,
// at every one of its frames from its start (design 4.3); a running child's
// first ticks, its seconds and its slower ticks; and a blink as ambient loops
// may first draw, at each of its moments, and on a card that watches the
// first two looks to the side, at theirs (189). Where loops follow the one-shots,
// each one-shot's end too, so the frames sampled are the frames drawn. The
// rest frame the rest-equals-calm test covers.
const timesOf = new Map();
function frameTimes(s) {
  if (timesOf.has(s)) return timesOf.get(s);
  const times = new Set();
  const loops = [];
  if (phases(s, s.fx.run + 160, ON).spinner !== null) loops.push(...[160, 240, 3_000, 10_000, 10_240, 149_990].map((ms) => s.fx.run + ms));
  const open = gatesOpen(s);
  if (open !== null && phases(s, open, ON).blink) loops.push(...faceMoments(SHOTS.blink.face, TIMING.blink).map((ms) => open + ms));
  for (const [part, from] of [['peekRight', TIMING.peekFrom], ['peekLeft', TIMING.peekFrom + TIMING.peekEvery]]) {
    if (open !== null && phases(s, open + from, ON).peek) loops.push(...faceMoments(SHOTS[part].face, TIMING.peek).map((ms) => open + from + ms));
  }
  for (const [part, start] of Object.entries(shotStarts(s))) {
    if (start === undefined) continue;
    for (let ms = 0; ms < TIMING[part]; ms += SHOTS[part].every) times.add(start + ms);
    if (loops.length) times.add(start + TIMING[part]);
  }
  for (const at of loops) times.add(at);
  timesOf.set(s, [...times].sort((a, b) => a - b));
  return timesOf.get(s);
}
// When ambient loops may first draw on a screen, within 30 s, or null.
function gatesOpen(s) {
  let [lo, hi] = [s.now, s.now + 30_000];
  if (!ambientAllowed(s, hi)) return null;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ambientAllowed(s, mid)) hi = mid;
    else lo = mid;
  }
  return ambientAllowed(s, lo) ? lo : hi;
}

const MOVING = theme({ ...MOTION.full, motion: true, calm: false });
// A screen's frames at those times with full motion caps, and its rest
// frame, drawn once for every test that reads them.
const drawn = new Map();
function sampled(state, cols, rows) {
  if (!drawn.has(state)) drawn.set(state, {});
  const bySize = drawn.get(state);
  const times = frameTimes(state);
  bySize[cols] ??= { times, frames: times.map((at) => render(state, { cols, rows }, MOVING, { at })), rest: render(state, { cols, rows }, MOVING, REST) };
  return bySize[cols];
}

test('every frame fits: exactly the window, no line too wide, one emoji at most, no U+FE0F', () => {
  const sizes = [...SIZES, [120, 40]];
  for (const [name, caps] of Object.entries(MOTION)) {
    const t = theme({ ...caps, motion: true, calm: false });
    screens.forEach(([label, state], n) => {
      // 120x40 for every seventh screen: a sample.
      for (const [cols, rows] of sizes.filter(([c]) => c < 120 || n % 7 === 0)) {
        // A line checked once, in any frame, needs no second look.
        const seen = new Set();
        const times = frameTimes(state);
        const frames = name === 'full' ? sampled(state, cols, rows).frames : times.map((at) => render(state, { cols, rows }, t, { at }));
        for (const [k, at] of times.entries()) {
          const lines = frames[k];
          const where = `${label} at ${cols}x${rows} (${name}), +${at - state.fx.view} ms from the view`;
          assert.equal(lines.length, rows, where);
          lines.forEach((line, i) => {
            if (seen.has(line)) return;
            seen.add(line);
            assert.ok(width(line) <= cols - 1, `${where}, line ${i + 1} is ${width(line)} wide: ${strip(line)}`);
            assert.ok(graphemes(strip(line)).filter(isEmoji).length <= 1, `${where}, line ${i + 1}: ${strip(line)}`);
            assert.doesNotMatch(line, /\uFE0F/, `${where}, line ${i + 1}`);
          });
        }
      }
    });
  }
});

// A row as cells: a wide glyph takes its cell and the one after it.
const cells = (line) => graphemes(strip(line)).flatMap((g) => (width(g) === 2 ? [g, ''] : [g]));
const isWord = (g) => /[\p{L}\p{N}]/u.test(g ?? '');
// The letters and digits of a frame that are not where the rest frame has
// them, as "row:col", both ways. A slow check's seconds, at the end of the
// checking label's row, are the one exception.
const SECONDS = /^(.*Checking.*… \S) {2}\d+ s$/u;
function movedWords(frame, rest) {
  const out = [];
  frame.forEach((full, r) => {
    const line = strip(full).replace(SECONDS, '$1');
    if (line === strip(rest[r])) return;
    const a = cells(line);
    const b = cells(rest[r]);
    for (let c = 0; c < Math.max(a.length, b.length); c++) {
      if ((isWord(a[c]) || isWord(b[c])) && a[c] !== b[c]) out.push(`${r + 1}:${c + 1} ${a[c] ?? ' '} for ${b[c] ?? ' '}`);
    }
  });
  return out;
}

test('words never move: every frame\'s letters and digits are the rest frame\'s, in place', () => {
  for (const [cols, rows] of SIZES) {
    for (const [label, state] of screens) {
      const { times, frames, rest } = sampled(state, cols, rows);
      for (const [k, at] of times.entries()) {
        const moved = movedWords(frames[k], rest);
        assert.deepEqual(moved, [], `${label} at ${cols}x${rows}, +${at - state.fx.view} ms from the view`);
      }
    }
  }
});

const beatOfKind = (s) => beatOf(s).kind;
const beatOfVerify = (s) => beatOf(s).verify.kind;

// One event at a known time: the stamp it leaves is that time.
const at = (d, ev) => {
  const effects = d.send({ wait: 7, ...ev });
  return { now: d.now, effects };
};

test('stamps: a view change and a beat opening are stamped from the event\'s own now', () => {
  const d = driver();
  const enter = at(d, { type: 'key', name: 'enter' });
  assert.equal(d.state.view, 'intro');
  assert.equal(d.state.fx.view, enter.now);
  const start = at(d, { type: 'key', name: 'enter' });
  assert.equal(d.state.view, 'step');
  assert.equal(d.state.fx.view, start.now);
  assert.equal(d.state.fx.open, start.now);
  // The next beat opens on the same view: a new beat, no new view.
  const next = at(d, { type: 'key', name: 'space' });
  assert.equal(d.state.pos.step, 1);
  assert.equal(d.state.fx.open, next.now);
  assert.equal(d.state.fx.view, start.now);
});

test('stamps: every key and paste is stamped as it arrives, a held letter too', () => {
  const d = driver();
  d.key('enter');
  d.key('enter');
  const h = at(d, { type: 'key', name: 'b', ch: 'b' });
  assert.equal(d.state.fx.key, h.now, 'stamped before the wrong-window hold');
  at(d, { type: 'flush', wait: DEFER_MS + 50 });
  assert.equal(d.state.fx.key, h.now, 'the hold acting later is not a new key');
  const paste = at(d, { type: 'paste', text: 'claude --version' });
  assert.equal(d.state.fx.key, paste.now);
  const tick = at(d, { type: 'tick' });
  assert.notEqual(d.state.fx.key, tick.now);
});

test('stamps: new text on the same card, a pass and a step\'s last pass', () => {
  const d = driver();
  d.key('enter');
  d.key('enter');
  d.key('space');
  // W2: one beat with a question. "It went wrong" is feedback: new text.
  const stuck = at(d, { type: 'key', name: '2', ch: '2' });
  assert.equal(d.state.beat.feedback.kind, 'stuck');
  assert.equal(d.state.fx.text, stuck.now);
  assert.equal(d.state.fx.pass, undefined);
  const right = at(d, { type: 'key', name: '1', ch: '1' });
  assert.equal(d.state.fx.text, right.now);
  assert.equal(d.state.fx.pass, right.now);
  assert.equal(d.state.fx.passLast, right.now, 'W2 has one beat: its pass ends the step');
  // W3 opens on a check: the status becomes opening.
  const open = at(d, { type: 'key', name: 'enter' });
  assert.equal(d.state.beat.status, 'opening');
  assert.equal(d.state.fx.check, open.now);
  assert.equal(d.state.fx.open, open.now);
  at(d, { type: 'check', lesson: 'b-1', items: [b1Item(null)] });
  const fail = at(d, { type: 'check', lesson: 'b-1', items: [b1Item('')] });
  assert.equal(d.state.beat.status, 'fail');
  assert.equal(d.state.fx.text, fail.now, 'a "Not yet" line');
  at(d, { type: 'key', name: 'h', ch: 'h' });
  const rung = at(d, { type: 'flush', wait: DEFER_MS + 50 });
  assert.equal(d.state.beat.rung, 0);
  assert.equal(d.state.fx.text, rung.now, 'a rung, when the held h acts');
  const done = at(d, { type: 'check', lesson: 'b-1', items: [b1Item('2.1.285 (Claude Code)\n')], read: Buffer.from('2.1.285 (Claude Code)\n') });
  assert.equal(d.state.beat.status, 'done');
  assert.equal(d.state.fx.pass, done.now);
  assert.equal(d.state.fx.passLast, done.now);
});

test('stamps: a guess and a shown answer are no pass, but a step they end is done all the same', () => {
  const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W4', beat: 0 } } } });
  d.key('enter');
  at(d, { type: 'key', name: '2', ch: '2' });
  assert.equal(d.state.beat.status, 'done');
  assert.equal(d.state.fx.pass, undefined, 'a predict guess');
  assert.equal(d.state.fx.passLast, undefined, 'W4 goes on after its guess');
  const w5 = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W5', beat: 0 } } } });
  w5.key('enter');
  at(w5, { type: 'key', name: '1', ch: '1' });
  const shown = at(w5, { type: 'key', name: 's', ch: 's' });
  const reveal = at(w5, { type: 'flush', wait: DEFER_MS + 50 });
  assert.equal(w5.state.beat.feedback.kind, 'revealed');
  assert.equal(w5.state.fx.pass, undefined, 'a shown answer');
  assert.ok(w5.state.fx.text > shown.now, 'the reveal is new text');
  assert.equal(w5.state.fx.passLast, reveal.now, 'W5 has one beat: the shown answer ends the step');
  // b-2 W1 ends on a guess: every guess ends the step, and the step cheers.
  for (const pick of ['1', '2']) {
    const g = driver({ course, saved: { format: 1, welcomed: true, lessons: { 'b-2': { step: 'W1', beat: 1, warm: [] } } } });
    g.key('enter');
    assert.equal(beatOfKind(g.state), 'predict');
    const guess = at(g, { type: 'key', name: pick, ch: pick });
    assert.equal(g.state.beat.status, 'done', pick);
    assert.equal(g.state.fx.pass, undefined, pick);
    assert.equal(g.state.fx.passLast, guess.now, pick);
    const p = phases(g.state, guess.now + 180, { motion: true });
    assert.deepEqual([p.cheer, p.stepDone, p.hop], [0.5, 180 / 560, 1], pick);
  }
  const p = phases(w5.state, reveal.now + 180, { motion: true });
  assert.deepEqual([p.cheer, p.stepDone, p.hop], [0.5, 180 / 560, 1], 'the same cheer after a shown answer');
});

test('stamps: a look at what the screen watches, and whether it changed; activity only while something is watched', () => {
  const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W3', beat: 0 } } } });
  d.key('enter');
  const first = at(d, { type: 'check', lesson: 'b-1', items: [b1Item(null)] });
  assert.equal(d.state.fx.look, first.now);
  assert.equal(d.state.fx.changed, false, 'a first look has nothing to differ from');
  const same = at(d, { type: 'check', lesson: 'b-1', items: [b1Item(null)] });
  assert.equal(d.state.fx.look, same.now);
  assert.equal(d.state.fx.changed, false);
  const other = at(d, { type: 'check', lesson: 'b-1', items: [b1Item('')] });
  assert.equal(d.state.fx.look, other.now);
  assert.equal(d.state.fx.changed, true);
  at(d, { type: 'check', lesson: 'b-2', items: [] });
  assert.equal(d.state.fx.look, other.now, 'another lesson\'s result is not a look');
  const act = at(d, { type: 'activity' });
  assert.equal(d.state.fx.activity, act.now);
  // The look that passes ends the watch, and it differs from the last.
  const pass = at(d, { type: 'check', lesson: 'b-1', items: [b1Item('2.1.285 (Claude Code)\n')], read: Buffer.from('2.1.285 (Claude Code)\n') });
  assert.equal(d.state.beat.status, 'done');
  assert.equal(d.state.fx.look, pass.now);
  assert.equal(d.state.fx.changed, true, 'not yet, then done');
  assert.equal(d.state.fx.seen, undefined, 'nothing is watched now');

  const git = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'Y4', beat: 0 } } } });
  git.key('enter');
  at(git, { type: 'git', paths: ['notes.md'] });
  assert.equal(git.state.fx.changed, false);
  const clean = at(git, { type: 'git', paths: [] });
  assert.equal(git.state.fx.look, clean.now);
  assert.equal(git.state.fx.changed, true);
  // A new thing to watch: its first result has nothing to differ from.
  git.key('space');
  at(git, { type: 'git', paths: [] });
  git.key('enter');
  assert.equal(git.state.fx.check, git.state.fx.open, 'the Check opens on its check');
  at(git, { type: 'check', lesson: 'b-1', items: [b1Item(null)] });
  assert.equal(git.state.fx.changed, false, 'a check after a git look');

  const still = driver();
  still.key('enter');
  still.key('enter');
  at(still, { type: 'activity' });
  assert.equal(still.state.fx.activity, undefined, 'W1 watches nothing');
  at(still, { type: 'check', lesson: 'b-1', items: [b1Item(null)] });
  assert.equal(still.state.fx.look, undefined, 'a result for a screen that watches nothing');
});

test('stamps: run-start records the real child start and asks for nothing', () => {
  const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W3', beat: 0 } } } });
  d.key('enter');
  const before = d.state;
  const run = at(d, { type: 'run-start' });
  assert.deepEqual(run.effects, []);
  assert.equal(d.state.fx.run, run.now);
  assert.deepEqual({ ...d.state, fx: null, now: null }, { ...before, fx: null, now: null }, 'nothing else changes');
});

test('stamps are never saved: learn.json after a run with stamps keeps its keys and FORMAT 1', () => {
  const d = driver({ course });
  playUntil(d, (s) => s.progress['b-2'].done.length >= 2);
  at(d, { type: 'run-start' });
  at(d, { type: 'activity' });
  assert.ok(Object.keys(d.state.fx).length > 3, 'the run left stamps');
  const data = snapshot(d.state);
  assert.doesNotMatch(JSON.stringify(data), /"fx"|"seen"|"passLast"/);
  // Every key of a saved file, nested keys too, as paths.
  const keys = (v, at = '') => (v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v).flatMap(([k, x]) => [`${at}${k}`, ...keys(x, `${at}${k}.`)]) : []);
  const saved = (state) => withRepo(() => repo(), (dir) => {
    mkdirSync(join(dir, '.practice'));
    saveState(dir, snapshot(state));
    return JSON.parse(readFileSync(storePath(dir), 'utf8'));
  });
  // The same place with no stamps at all: what the file held before motion.
  const before = saved({ ...d.state, fx: undefined });
  const after = saved(d.state);
  assert.deepEqual(keys(after), keys(before));
  assert.deepEqual(after, before);
  assert.equal(FORMAT, 1);
  assert.equal(after.format, 1);
});

test('the timing table is design 4.3\'s, and no one-shot lasts over 1.2 s but Pip\'s greeting, 5 s, and its look around on the complete screen, 2.4 s (176)', () => {
  const ms = {
    grid: 40, tick: 80, slowTick: 240, slowAfter: 10_000,
    entrance: 160, notYet: 360, hop: 240, cheer: 360, stepDone: 560, levelUp: 800, complete: 1_200, welcome: 480, itemPass: 160, greet: 5_000, lookAround: 2_400,
    spinnerFrom: 150, elapsedFrom: 3_000, sweep: 400, glance: 1_200, blink: 160, blinkEvery: 6_000,
    peek: 800, peekFrom: 9_000, peekEvery: 18_000,
    perWord: 400, graceMin: 3_000, graceMax: 20_000, keyQuiet: 4_000,
    pipFade: 320, pipBreathIn: 800, mood: 80,
  };
  assert.deepEqual(TIMING, ms);
  for (const k of ['entrance', 'notYet', 'hop', 'cheer', 'stepDone', 'levelUp', 'complete', 'welcome', 'itemPass', 'sweep', 'glance']) assert.ok(TIMING[k] <= 1_200, k);
});

test('a one-shot runs 0 to 1 over its time, and a later key ends it, but not the key that started it', () => {
  const s = { fx: {} };
  assert.equal(oneShot(s, 1_000, 1_000, 160), 0);
  assert.equal(oneShot(s, 1_080, 1_000, 160), 0.5);
  assert.equal(oneShot(s, 1_160, 1_000, 160), 1);
  assert.equal(oneShot(s, 5_000, 1_000, 160), 1);
  assert.equal(oneShot(s, Infinity, 1_000, 160), 1, 'the rest frame');
  assert.equal(oneShot(s, 1_080, undefined, 160), 1, 'nothing started');
  assert.equal(oneShot({ fx: { key: 1_000 } }, 1_080, 1_000, 160), 0.5, 'the key that started it');
  assert.equal(oneShot({ fx: { key: 900 } }, 1_080, 1_000, 160), 0.5, 'a key before it');
  assert.equal(oneShot({ fx: { key: 1_040 } }, 1_080, 1_000, 160), 1, 'a key after it');
});

// A beat of lesson 1 opened from a saved place, by an enter at a known time.
const opened = (step, beat = 0) => {
  const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step, beat } } } });
  const { now } = at(d, { type: 'key', name: 'enter' });
  return { d, t: now };
};

test('ambient loops wait for the reading grace and the quiet after a key, and stop at idle and under an overlay', () => {
  const { d, t } = opened('W1');
  const s = d.state;
  assert.equal(ambientAllowed(s, t + TIMING.keyQuiet - 1), false, 'within 4 s of the enter');
  assert.equal(ambientAllowed(s, t + TIMING.graceMin - 1), false, 'the grace is at least 3 s');
  assert.equal(ambientAllowed(s, t + TIMING.graceMax), true, 'the grace is at most 20 s');
  assert.equal(ambientAllowed(s, t + IDLE_MS), false, 'idle');
  d.key('?');
  assert.equal(ambientAllowed(d.state, t + TIMING.graceMax), false, 'an overlay');
});

test('ambientOpened: the moment the ambient gates open, at the reading grace\'s end, then at the end of the quiet after a later key', () => {
  const d = driver();
  assert.equal(d.state.view, 'welcome');
  assert.equal(ambientOpened(d.state), gatesOpen(d.state), 'the grace\'s end');
  const { now } = at(d, { type: 'key', name: 'down', wait: TIMING.graceMax + 1_000 });
  assert.equal(d.state.view, 'welcome');
  assert.equal(ambientOpened(d.state), now + TIMING.keyQuiet);
  assert.equal(ambientOpened(d.state), gatesOpen(d.state), 'the quiet\'s end');
});

test('a file change ends the reading grace; a look does not', () => {
  const { d, t } = opened('W3');
  // W3's card holds far more than 12 words, so its grace outlasts the key quiet.
  at(d, { type: 'check', lesson: 'b-1', items: [b1Item(null)], wait: TIMING.keyQuiet });
  const later = t + TIMING.keyQuiet + 500;
  assert.equal(ambientAllowed(d.state, later), false, 'still reading');
  at(d, { type: 'activity', wait: 1 });
  assert.equal(ambientAllowed(d.state, later), true);
});

test('no ambient loop beside a question, a typed answer or the hint box', () => {
  const late = (s) => s.now + TIMING.graceMax + TIMING.keyQuiet;
  const q = opened('W2');
  assert.equal(ambientAllowed(q.d.state, late(q.d.state)), false, 'a question');
  q.d.key('1');
  assert.equal(ambientAllowed(q.d.state, late(q.d.state)), true, 'answered');
  const typed = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'C', beat: 1 } } } });
  typed.key('enter');
  assert.equal(typed.state.pos.beat, 1);
  assert.equal(ambientAllowed(typed.state, late(typed.state)), false, 'a typed answer');
  const hint = opened('W3');
  hint.d.send({ type: 'check', lesson: 'b-1', items: [b1Item(null)] });
  hint.d.send({ type: 'check', lesson: 'b-1', items: [b1Item('')] });
  assert.equal(ambientAllowed(hint.d.state, late(hint.d.state)), true, '"Not yet", no hint box');
  hint.d.key('h');
  assert.equal(hint.d.state.beat.rung, 0);
  assert.equal(ambientAllowed(hint.d.state, late(hint.d.state)), false, 'the hint box');
});

test('the reading grace is 400 ms a word of the newest text, at least 3 s and at most 20 s', () => {
  // A "Not yet" line from the check, with no key: its words size the grace.
  const notYet = (hint) => {
    const { d } = opened('W3');
    at(d, { type: 'check', lesson: 'b-1', items: [b1Item(null)], wait: 30_000 });
    const item = { ...b1Item(null), hint };
    const t = at(d, { type: 'check', lesson: 'b-1', items: [item], wait: 30_000 }).now;
    return { s: d.state, t };
  };
  const two = notYet('Not there.');
  assert.equal(two.s.fx.text, two.t);
  assert.equal(ambientAllowed(two.s, two.t + 2_999), false, '2 words still wait 3 s');
  assert.equal(ambientAllowed(two.s, two.t + 3_000), true);
  const ten = notYet('one two three four five six seven eight nine ten');
  assert.equal(ambientAllowed(ten.s, ten.t + 3_999), false, '10 words wait 4 s');
  assert.equal(ambientAllowed(ten.s, ten.t + 4_000), true);
  const long = notYet('word '.repeat(80).trim());
  assert.equal(ambientAllowed(long.s, long.t + 19_999), false);
  assert.equal(ambientAllowed(long.s, long.t + 20_000), true, '80 words wait 20 s, not 32');
  // Y2's "Yes, it asked again" answers with its 14-word because line.
  const y2 = opened('Y2');
  const pick = at(y2.d, { type: 'key', name: '1', ch: '1' });
  assert.equal(y2.d.state.beat.feedback.kind, 'option');
  assert.equal(ambientAllowed(y2.d.state, pick.now + 5_599), false);
  assert.equal(ambientAllowed(y2.d.state, pick.now + 5_600), true);
});

test('the welcome and the check-only card size their grace by their own words', () => {
  const d = driver();
  assert.equal(d.state.view, 'welcome');
  const t = d.state.fx.view;
  assert.equal(ambientAllowed(d.state, t + TIMING.graceMin), false, 'the welcome holds far more than 8 words');
  assert.equal(ambientAllowed(d.state, t + TIMING.graceMax), true);
  const map = driver();
  map.key('enter');
  map.key('m');
  map.key('down');
  const only = at(map, { type: 'key', name: 'enter' }).now;
  assert.equal(map.state.view, 'checkonly');
  assert.equal(ambientAllowed(map.state, only + TIMING.keyQuiet), false, 'its sentence and items take longer than the key quiet');
  assert.equal(ambientAllowed(map.state, only + TIMING.graceMax), true);
});

test('screens with no ambient part never allow one, and ask for no frame once their one-shots end', () => {
  const d = driver();
  d.key('enter');
  assert.equal(d.state.view, 'intro');
  const views = { intro: d.state };
  d.key('m');
  views.map = d.state;
  const up = driver();
  playUntil(up, (s) => s.view === 'levelup');
  views.levelup = up.state;
  playUntil(up, (s) => s.view === 'complete');
  views.complete = up.state;
  for (const [view, s] of Object.entries(views)) {
    assert.equal(s.view, view);
    const from = Math.max(s.fx.view, s.fx.key ?? -Infinity);
    // The complete screen's one-shots end with Pip's look around (176).
    const ends = view === 'complete' ? TIMING.lookAround : TIMING.complete;
    for (const ms of [ends, TIMING.graceMax + TIMING.keyQuiet]) {
      assert.equal(ambientAllowed(s, from + ms), false, `${view} at +${ms} ms`);
      assert.equal(nextChange(s, from + ms, { motion: true }), null, `${view} at +${ms} ms`);
    }
  }
});

const ON = { motion: true };
const OFF = { motion: false, calm: true };
const RESTING = { entrance: 1, notYet: 1, hop: 1, cheer: 1, stepDone: 1, levelUp: 1, complete: 1, welcome: 1, itemPass: 1, greet: 1, lookAround: 1, sweep: 1, glance: 1, spinner: null, elapsed: null, checking: true, ambient: false, look: null, blink: false, peek: false, ms: {} };

test('phases: the rest phases with motion off, at rest and under an overlay', () => {
  const { d, t } = opened('W3');
  for (const ms of [0, 80, 400, 30_000]) assert.deepEqual(phases(d.state, t + ms, OFF), RESTING, `+${ms} ms, motion off`);
  assert.deepEqual(phases(d.state, Infinity, ON), RESTING, 'the rest frame');
  d.send({ type: 'key', name: '?', wait: 7 });
  assert.deepEqual(phases(d.state, d.now + 40, ON), RESTING, 'an overlay freezes everything');
});

// A one-shot's place in it is the clock's own difference, unrounded: the
// fraction times the one-shot's length is not exact (1720 of 5000 ms gives
// 1719.9999999999998).
test('phases: each one-shot still playing has its ms since it started, exactly, and a blink its ms into the blink', () => {
  const s = driver().state;
  const start = shotStarts(s).greet;
  for (const ms of [0, 40, 1_720, 1_720.25, TIMING.greet - 0.5]) assert.equal(phases(s, start + ms, ON).ms.greet, ms, `+${ms} ms`);
  assert.equal(phases(s, start + TIMING.greet, ON).ms.greet, undefined, 'over');
  const pressed = reduce(s, { type: 'key', name: 'up', now: start + 1_000 }).state;
  assert.equal(phases(pressed, start + 1_720, ON).ms.greet, undefined, 'a key ended it');
  assert.deepEqual(phases(s, start + 40, { motion: false }).ms, {}, 'motion off');
  // The welcome's blink as its gates open: its ms into the blink while it
  // is on, and none after.
  const open = ambientOpened(s);
  assert.equal(phases(s, open + 80.5, ON).ms.blink, 80.5);
  assert.equal(phases(s, open + TIMING.blink, ON).ms.blink, undefined);
});

test('phases: a card enters over 160 ms, and a key after it ends the entrance', () => {
  const { d, t } = opened('W3');
  assert.equal(phases(d.state, t, ON).entrance, 0, 'the key that opened it does not end it');
  assert.equal(phases(d.state, t + 80, ON).entrance, 0.5);
  assert.equal(phases(d.state, t + 160, ON).entrance, 1);
  at(d, { type: 'key', name: 'x', ch: 'x', wait: 40 });
  assert.equal(phases(d.state, t + 80, ON).entrance, 1);
  // The check-only card enters too.
  const map = driver();
  map.key('enter');
  map.key('m');
  map.key('down');
  const only = at(map, { type: 'key', name: 'enter' }).now;
  assert.equal(map.state.view, 'checkonly');
  assert.equal(phases(map.state, only + 80, ON).entrance, 0.5);
});

test('phases: "Not yet" over 360 ms; a pass that ends its step cheers, any other pass hops', () => {
  const { d } = opened('W3');
  at(d, { type: 'check', lesson: 'b-1', items: [b1Item(null)] });
  const fail = at(d, { type: 'check', lesson: 'b-1', items: [b1Item('')] });
  assert.equal(phases(d.state, fail.now + 180, ON).notYet, 0.5);
  // A rung is new text too, but it plays no "Not yet".
  at(d, { type: 'key', name: 'h', ch: 'h' });
  const rung = at(d, { type: 'flush', wait: DEFER_MS + 50 }).now;
  assert.equal(d.state.fx.text, rung);
  assert.equal(phases(d.state, rung + 180, ON).notYet, 1);
  const pass = at(d, { type: 'check', lesson: 'b-1', items: [b1Item('2.1.285 (Claude Code)\n')], read: Buffer.from('2.1.285 (Claude Code)\n') });
  const done = phases(d.state, pass.now + 180, ON);
  assert.equal(done.cheer, 0.5);
  assert.equal(done.stepDone, 180 / 560);
  assert.equal(done.hop, 1);
  // The Check's first beat: its check passes, and two beats follow.
  const c = opened('C');
  const already = at(c.d, { type: 'check', lesson: 'b-1', items: [b1Item('2.1.285 (Claude Code)\n')] });
  assert.equal(c.d.state.beat.status, 'already');
  const hop = phases(c.d.state, already.now + 120, ON);
  assert.equal(hop.hop, 0.5);
  assert.equal(hop.cheer, 1);
});

test('phases: the welcome, a level-up and a lesson complete play from the view stamp', () => {
  const d = driver();
  assert.equal(phases(d.state, d.now + 240, ON).welcome, 0.5, 'the first screen, from the start');
  playUntil(d, (s) => s.view === 'levelup');
  assert.equal(phases(d.state, d.state.fx.view + 400, ON).levelUp, 0.5);
  playUntil(d, (s) => s.view === 'complete');
  assert.equal(phases(d.state, d.state.fx.view + 600, ON).complete, 0.5);
});

test('phases: the spinner turns from the first 40 ms boundary once the child has run 150 ms while opening, slower after 10 s, with seconds from 3 s', () => {
  const { d, t } = opened('W3');
  assert.equal(phases(d.state, t + 1_000, ON).spinner, null, 'no child yet');
  const run = at(d, { type: 'run-start', wait: 500 }).now;
  const p = (ms) => phases(d.state, run + ms, ON);
  assert.equal(p(159).spinner, null, '150 ms is off the 40 ms grid: 160 is the first frame');
  assert.equal(p(160).spinner, 0);
  assert.equal(p(239).spinner, 0);
  assert.equal(p(240).spinner, 1);
  assert.equal(p(10_000).spinner, 123);
  assert.equal(p(10_240).spinner, 124);
  assert.equal(p(2_999).elapsed, null);
  assert.equal(p(3_000).elapsed, 3);
  assert.equal(p(4_500).elapsed, 4);
  at(d, { type: 'check', lesson: 'b-1', items: [b1Item(null)], wait: 200 });
  assert.equal(d.state.beat.status, 'waiting');
  assert.equal(p(400).spinner, null, 'the result landed');
  // A child from before the beat opened (the first look, on the resume
  // screen) says nothing about it.
  const early = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W3', beat: 0 } } } });
  at(early, { type: 'run-start' });
  const open = at(early, { type: 'key', name: 'enter' }).now;
  assert.equal(early.state.beat.status, 'opening');
  assert.equal(phases(early.state, open + 1_000, ON).spinner, null);
});

test('phases: ambient follows ambientAllowed, and only with motion', () => {
  const { d, t } = opened('W1');
  assert.equal(phases(d.state, t + TIMING.graceMax, ON).ambient, true);
  assert.equal(phases(d.state, t + 1_000, ON).ambient, false);
  assert.equal(phases(d.state, t + TIMING.graceMax, OFF).ambient, false);
});

test('nextChange: null under calm, with an overlay, at idle unless a child runs, and when nothing moves and no deadline waits', () => {
  const { d, t } = opened('W3');
  const run = at(d, { type: 'run-start', wait: 500 }).now;
  for (const ms of [0, 10, 700, 20_000]) assert.equal(nextChange(d.state, t + ms, OFF), null, `calm, +${ms} ms`);
  // Idle stops every one-shot and ambient loop, but not a child still
  // running: its spinner and seconds go on (at most 150 s).
  // The child has run 119.5 s: past 10 s it turns every 240 ms from 10 s,
  // so next at 119.68 s.
  const idleAt = t + IDLE_MS;
  assert.equal(idleAt - run, 119_500);
  const p = phases(d.state, idleAt, ON);
  assert.notEqual(p.spinner, null);
  assert.deepEqual(p, { ...RESTING, spinner: p.spinner, elapsed: 119 });
  assert.equal(nextChange(d.state, idleAt, ON), 180, 'idle, with a child still running');
  d.send({ type: 'tick', wait: IDLE_MS });
  assert.equal(d.state.beat.idle, true);
  at(d, { type: 'check', lesson: 'b-1', items: [b1Item(null)], wait: 1 });
  assert.equal(nextChange(d.state, d.now, ON), null, 'idle, the child done');
  assert.deepEqual(phases(d.state, d.now, ON), { ...RESTING, checking: false }, 'and what idle draws is the rest frame');
  const q = opened('W2');
  assert.equal(nextChange(q.d.state, q.t + 200, ON), null, 'a question: the entrance is over, and no loop may start');
  const w1 = opened('W1');
  assert.equal(nextChange(w1.d.state, w1.t + IDLE_MS, ON), null, 'idle');
  w1.d.send({ type: 'key', name: '?', wait: 7 });
  assert.equal(nextChange(w1.d.state, w1.d.now + 10, ON), null, 'an overlay');
});

test('nextChange: the next 40 ms frame of a one-shot, the spinner\'s start and ticks, and the seconds', () => {
  const { d, t } = opened('W3');
  assert.equal(nextChange(d.state, t, ON), 40, 'the entrance');
  assert.equal(nextChange(d.state, t + 10, ON), 30);
  const run = at(d, { type: 'run-start', wait: 500 }).now;
  const n = (ms) => nextChange(d.state, run + ms, ON);
  assert.equal(n(100), 60, 'the spinner starts at 160 ms, the first 40 ms boundary from 150');
  assert.equal(n(160), 80);
  assert.equal(n(190), 50);
  assert.equal(n(2_990), 10, 'the seconds appear at 3 s');
  assert.equal(n(3_000), 40, 'and the next tick is at 3040 ms');
  assert.equal(n(9_995), 5, 'the seconds turn 10');
  assert.equal(n(10_000), 240, 'after 10 s the spinner turns every 240 ms');
  assert.equal(n(10_010), 230);
});

// Where the detailed Pip is drawn (main passes `raster`), the 9x4 Pip is
// not, so its face moments ask for no frame: the raster's own frames come
// from the package and the greeting (181).
test('nextChange: with the detailed Pip drawn, the 9x4 Pip\'s face moments ask for no frame: the welcome\'s blinks and greeting, the complete screen\'s look around', () => {
  const RASTER = { ...ON, raster: true };
  const welcome = driver().state;
  const q = ambientOpened(welcome);
  assert.equal(nextChange(welcome, q + 10, ON), 30, 'the 9x4 Pip\'s blink');
  assert.equal(nextChange(welcome, q + 170, ON), 5_830, 'its next blink');
  for (const ms of [10, 170, 6_010]) assert.equal(nextChange(welcome, q + ms, RASTER), null, `the gates open, +${ms} ms`);
  assert.equal(nextChange(welcome, q - 1_000, RASTER), 1_000, 'the gates\' opening is still a deadline');
  const start = welcome.fx.view;
  assert.equal(nextChange(welcome, start + 600, ON), 40, 'the 9x4 Pip\'s greeting');
  assert.equal(nextChange(welcome, start + 600, RASTER), q - start - 600, 'the greeting\'s 9x4 face asks for none');
  assert.equal(nextChange(welcome, start + 10, RASTER), 70, 'the welcome\'s own one-shot still does');
  const up = driver();
  playUntil(up, (s) => s.view === 'complete');
  const complete = up.state;
  const done = complete.fx.view + TIMING.complete;
  assert.notEqual(nextChange(complete, done + 10, ON), null, 'the 9x4 Pip\'s look around');
  assert.equal(nextChange(complete, done + 10, RASTER), null, 'none with the detailed Pip');
  assert.equal(nextChange(complete, complete.fx.view + 10, RASTER), 30, 'the complete screen\'s own one-shot');
});

test('nextChange: the moment ambient loops may start is a deadline', () => {
  const { d, t } = opened('W1');
  const wait = nextChange(d.state, t + 200, ON);
  assert.ok(wait >= TIMING.keyQuiet - 200 && wait <= TIMING.graceMax - 200, String(wait));
  assert.equal(ambientAllowed(d.state, t + 200 + wait - 1), false);
  assert.equal(ambientAllowed(d.state, t + 200 + wait), true);
});

// ---- the one-shots, frame by frame (design 2.3 and 2.4) ----------------------
// The frame `ms` after `start`, as plain text with its trailing blanks gone.
const frameAt = (s, start, ms, [cols, rows] = [80, 24]) => render(s, { cols, rows }, MOVING, { at: start + ms }).map((l) => strip(l).trimEnd());
const restOf = (s, [cols, rows] = [80, 24]) => render(s, { cols, rows }, MOVING, REST).map((l) => strip(l).trimEnd());
// Rows `from` to `to`, numbered from 1 as the mockups number them.
const rowsOf = (lines, from, to = from) => lines.slice(from - 1, to);
// A frame without its 5th row, where a card's top border holds Pip's face.
const notPip = (lines) => lines.filter((_, i) => i !== 4);

test('the welcome: Pip wakes, the fuse runs along the path, one pulse crosses the arrow, then it rests', () => {
  const d = driver();
  const s = d.state;
  const start = s.fx.view;
  const f = (ms) => frameAt(s, start, ms);
  const rest = restOf(s);
  const path = (lit) => `  B1 ${['B2', 'B3', 'B4', 'B5', '🏆'].map((b, i) => `${i < lit ? '━━' : '──'} ${b}`).join(' ')}   each stop a little harder`;
  const eyes = (e) => `   │  ${e}  │   I'm Pip. I watch your practice copy and light up`;
  const arrow = (a) => `  │  one step at a time,     │  ${a}   │  and run Claude Code      │`;
  assert.deepEqual([...rowsOf(f(0), 2), ...rowsOf(f(0), 7), ...rowsOf(f(0), 13)], [path(1), eyes('─‿─'), arrow('──▸')], '+0 ms');
  assert.deepEqual(rowsOf(f(80), 7), [eyes('◒‿◒')], '+80 ms');
  assert.deepEqual([...rowsOf(f(160), 2), ...rowsOf(f(160), 7)], [path(3), eyes('●‿●')], '+160 ms: the fuse reaches B4, Pip is awake');
  assert.deepEqual([...rowsOf(f(320), 2), ...rowsOf(f(320), 13)], [path(5), arrow('━─▸')], '+320 ms: the fuse reaches the cup');
  assert.deepEqual(rowsOf(f(400), 13), [arrow('─━▸')], '+400 ms');
  assert.deepEqual([...rowsOf(rest, 2), ...rowsOf(rest, 7), ...rowsOf(rest, 13)], [path(0), eyes('●‿●'), arrow('──▸')]);
  // Pip is awake from 160 ms until its greeting looks left at 640 ms; at
  // 480 ms everything else rests, and at 5 s Pip too (176).
  for (let ms = 160; ms < 640; ms += 40) assert.deepEqual(rowsOf(f(ms), 7), rowsOf(rest, 7), `+${ms} ms`);
  for (const ms of [480, 5_000]) assert.deepEqual(f(ms), rest, `+${ms} ms`);
  // At 60x20 the windows sit closer, with a one-cell arrow: the pulse
  // crosses it too, and the fuse and the wake-up run.
  const small = (ms) => frameAt(s, start, ms, [60, 20]);
  assert.match(small(0)[1], /^ {2}B1 ━━ B2 ── B3/);
  assert.match(small(0)[6], /│ {2}─‿─ {2}│/);
  assert.match(small(320)[11], /│ ━▸ │/);
  assert.match(restOf(s, [60, 20])[11], /│ ─▸ │/);
});

const screen = (label) => screens.find(([l]) => l === label)[1];

// The 9x4 Pip's greeting (176), as ticket 176 lays it out: from each
// moment, the antenna row and the face. On the welcome it wakes; on resume
// it starts awake, since the boot frame woke it. Then it looks left, passes
// the centre, looks right and up, smiles with happy eyes while the antenna
// row sparks every other 320 ms, blinks once through half-lids (181), and
// ends on ●‿●. A passing face shows for one 40 ms frame.
const SPARKS = '+  ●  +';
const HELLO = [
  [640, '●', '◐‿◐'], [1_000, '●', '●‿●'], [1_040, '●', '◑‿◑'], [1_440, '●', '◓‿◓'],
  [1_840, SPARKS, '^‿^'], [2_160, '●', '^‿^'], [2_480, SPARKS, '^‿^'], [2_800, '●', '^‿^'], [3_120, SPARKS, '^‿^'], [3_440, '●', '^‿^'],
  [3_760, '●', '●‿●'], [4_240, '●', '◒‿◒'], [4_280, '●', '─‿─'], [4_600, '●', '◒‿◒'], [4_640, '●', '●‿●'],
];
const PASSING = [1_000, 4_240, 4_600];
const GREETING = {
  welcome: [[0, '●', '─‿─'], [80, '●', '◒‿◒'], [160, '●', '●‿●'], ...HELLO],
  resume: [[0, '●', '●‿●'], ...HELLO],
};
// The 9x4 Pip's antenna row and face in a frame: the 9 cells over and
// under its head's top, where the rest frame has it.
const pipCells = (lines, rest) => {
  const head = rest.findIndex((l) => l.includes('╭───┴───╮'));
  const col = [...rest[head]].indexOf('╭');
  const cellsAt = (row) => [...lines[row]].slice(col, col + 9).join('').trim();
  return [cellsAt(head - 1), cellsAt(head + 1).replace(/^│\s*|\s*│$/g, '')];
};

test('the greeting: the 9x4 Pip wakes on the welcome and starts awake on resume, looks left, right and up, smiles with happy eyes while its antenna sparks in turn, blinks once, and ends on ●‿● at 5 s', () => {
  for (const label of ['welcome', 'resume']) {
    const s = screen(label);
    for (const [cols, rows] of [[60, 20], [80, 24], [120, 40]]) {
      const f = (ms) => frameAt(s, s.fx.view, ms, [cols, rows]);
      const rest = restOf(s, [cols, rows]);
      const where = `${label} at ${cols}x${rows}`;
      assert.deepEqual(pipCells(rest, rest), ['●', '●‿●'], `${where}: rest`);
      for (let ms = 0; ms < 5_000; ms += 40) {
        const [, antenna, face] = GREETING[label].findLast(([from]) => from <= ms);
        assert.deepEqual(pipCells(f(ms), rest), [antenna, face], `${where}, +${ms} ms`);
      }
      assert.deepEqual(f(5_000), rest, `${where}, +5000 ms: rest`);
    }
  }
  // Each pose holds long enough to read, the welcome's wake-up's two and
  // the passing faces aside, which hold one frame.
  for (const poses of [GREETING.welcome.slice(2), GREETING.resume]) {
    poses.forEach(([from], k, rest) => {
      const held = (rest[k + 1]?.[0] ?? 5_000) - from;
      if (PASSING.includes(from)) assert.equal(held, TIMING.grid, `the passing face at +${from} ms`);
      else assert.ok(held >= 250, `the pose from +${from} ms`);
    });
  }
});

// The complete screen's 9x4 Pip (176): its cheer, then, once the rest of
// the screen is still, a happy look left and right between ^‿^, ending
// on ^‿^, each look through the centre ●‿● for one frame either side
// (182).
const LOOK_AROUND = [[0, SPARKS, '^‿^'], [480, '●', '^‿^'], [1_160, '●', '●‿●'], [1_200, '●', '◐‿◐'], [1_560, '●', '●‿●'], [1_600, '●', '^‿^'], [1_960, '●', '●‿●'], [2_000, '●', '◑‿◑'], [2_360, '●', '●‿●']];

test('the complete screen: after its cheer, the 9x4 Pip looks left and right between happy eyes, through the centre, and rests on ^‿^ by 2.4 s', () => {
  for (const label of ['complete', 'b-capstone complete']) {
    const s = screen(label);
    for (const [cols, rows] of [[60, 20], [80, 24], [120, 40]]) {
      const f = (ms) => frameAt(s, s.fx.view, ms, [cols, rows]);
      const rest = restOf(s, [cols, rows]);
      const where = `${label} at ${cols}x${rows}`;
      assert.deepEqual(pipCells(rest, rest), ['●', '^‿^'], `${where}: rest`);
      for (let ms = 0; ms < 2_400; ms += 40) {
        const [, antenna, face] = LOOK_AROUND.findLast(([from]) => from <= ms);
        assert.deepEqual(pipCells(f(ms), rest), [antenna, face], `${where}, +${ms} ms`);
      }
      assert.deepEqual(f(2_400), rest, `${where}, +2400 ms: rest`);
    }
  }
  // Each pose holds long enough to read; the centre is one frame between.
  LOOK_AROUND.slice(1).forEach(([from, , face], k, rest) => assert.ok((rest[k + 1]?.[0] ?? 2_400) - from >= (face === '●‿●' ? TIMING.grid : 250), `the pose from +${from} ms`));
});

// Every face track (181): its keyframes on the 40 ms grid from the shot's
// start, in order, and two with different frames exactly one grid step
// apart, so a frame drawn on the grid shows a keyframe exactly.
const TRACKS = {
  ...Object.fromEntries(Object.entries(SHOTS).filter(([, shot]) => shot.face).map(([part, shot]) => [part, shot.face])),
  'greet wake': SHOTS.greet.wake, 'greet welcome': greetFace('welcome'), 'greet resume': greetFace('resume'),
};

test('every face track has its keyframes on the 40 ms grid, in order, and a change of frame takes exactly one grid step', () => {
  assert.deepEqual(Object.keys(TRACKS).sort(), ['blink', 'cheer', 'entrance', 'glance', 'greet', 'greet resume', 'greet wake', 'greet welcome', 'hop', 'levelUp', 'lookAround', 'notYet', 'peekLeft', 'peekRight']);
  for (const [part, face] of Object.entries(TRACKS)) {
    assert.ok(face.length > 0, part);
    face.forEach(([ms, frame], k) => {
      assert.equal(ms % TIMING.grid, 0, `${part}: the keyframe at ${ms} ms`);
      if (!k) return;
      const [was, before] = face[k - 1];
      assert.ok(ms > was, `${part}: ${ms} ms after ${was} ms`);
      if (frame !== before) assert.equal(ms - was, TIMING.grid, `${part}: ${before} to ${frame} from ${was} ms`);
    });
  }
});

// The one-shots that move only Pip's face, and the blink, each over every
// mood it plays over: the 9x4 Pip's greeting, look around and blink, and
// the card face's glance (never over checking), hop, cheer and blink.
const CARD_MOODS = ['rest', 'checking', 'worried', 'done', 'broken'];
const FACE_SHOTS = [
  ['the greeting on the welcome', greetFace('welcome'), TIMING.greet, ['happy'], pip],
  ['the greeting on resume', greetFace('resume'), TIMING.greet, ['happy'], pip],
  ['the look around', SHOTS.lookAround.face, TIMING.lookAround, ['party'], pip],
  ['the welcome\'s blink', SHOTS.blink.face, TIMING.blink, ['happy'], pip],
  ['a glance', SHOTS.glance.face, TIMING.glance, CARD_MOODS.filter((m) => m !== 'checking'), pipFace],
  ['a hop', SHOTS.hop.face, TIMING.hop, CARD_MOODS, pipFace],
  ['a cheer', SHOTS.cheer.face, TIMING.cheer, CARD_MOODS, pipFace],
  ['a card\'s blink', SHOTS.blink.face, TIMING.blink, CARD_MOODS, pipFace],
  // A look to the side plays only on a card that watches, never while a
  // child runs, so never over checking or done (189).
  ['a look toward the other window', SHOTS.peekRight.face, TIMING.peek, ['rest', 'worried', 'broken'], pipFace],
  ['a look away from it', SHOTS.peekLeft.face, TIMING.peek, ['rest', 'worried', 'broken'], pipFace],
];

test('a face-only one-shot changes the face on the 40 ms grid exactly at its moments, over every mood it plays over: no frame it asks for is the one before, and no change waits for another frame', () => {
  for (const [label, face, end, moods, draw] of FACE_SHOTS) {
    const moments = faceMoments(face, end);
    assert.ok(moments.length > 0, label);
    for (const mood of moods) {
      const at = (ms) => String(ms < 0 || ms >= end ? draw(MOVING, mood) : draw(MOVING, mood, face, ms));
      const changes = [];
      for (let ms = 0; ms <= end; ms += TIMING.grid) if (at(ms) !== at(ms - TIMING.grid)) changes.push(ms);
      assert.deepEqual(changes, moments, `${label} over ${mood}`);
    }
  }
});

// A frame with the 9x4 Pip's cells blanked, where the rest frame has them:
// its 4 rows of 9 cells.
const withoutPip = (lines, rest) => {
  const head = rest.findIndex((l) => l.includes('╭───┴───╮'));
  const col = cells(rest[head]).indexOf('╭');
  return lines.map((l, r) => (r < head - 1 || r > head + 2 ? l : cells(l).map((c, k) => (k >= col && k < col + 9 ? ' ' : c)).join('').trimEnd()));
};

test('words never move in Pip\'s greeting and look around: from the moment the rest of the screen is still, only the 9x4 Pip\'s cells differ from the rest frame, at 60x20, 80x24 and 120x40', () => {
  // The welcome's own one-shot ends at 480 ms; the complete screen's at 1.2 s.
  for (const [label, from, to] of [['welcome', 480, 5_000], ['resume', 0, 5_000], ['complete', 1_200, 2_400]]) {
    const s = screen(label);
    for (const [cols, rows] of [[60, 20], [80, 24], [120, 40]]) {
      const rest = restOf(s, [cols, rows]);
      let moved = 0;
      for (let ms = from; ms < to; ms += 40) {
        const f = frameAt(s, s.fx.view, ms, [cols, rows]);
        if (f.join('\n') !== rest.join('\n')) moved += 1;
        assert.deepEqual(withoutPip(f, rest), withoutPip(rest, rest), `${label} at ${cols}x${rows}, +${ms} ms`);
      }
      assert.ok(moved > 0, `${label} at ${cols}x${rows}: Pip moves`);
    }
  }
});

test('the greeting plays once per arrival: a toast neither starts it again nor stops it, an overlay shows Pip at rest, and the key that closes it leaves the rest frame', () => {
  const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'Y3', beat: 0, done: ['W1'] } } } });
  assert.equal(d.state.view, 'resume');
  const start = d.state.fx.view;
  // A save that fails, 2 s in: its toast comes up, and the greeting goes on
  // from the same arrival, then ends at 5 s.
  d.send({ type: 'notice', kind: 'save', message: 'EACCES: permission denied', wait: 2_000 });
  const toast = d.state;
  assert.ok(toast.toast);
  assert.equal(toast.fx.view, start);
  const rest = restOf(toast);
  assert.deepEqual(pipCells(frameAt(toast, start, 2_000), rest), [SPARKS, '^‿^'], '+2000 ms, the toast up');
  assert.deepEqual(pipCells(frameAt(toast, start, 4_280), rest), ['●', '─‿─'], '+4280 ms, the toast up');
  for (const ms of [5_000, 7_000]) assert.deepEqual(frameAt(toast, start, ms), rest, `+${ms} ms, the toast up`);
  // ? at 2.5 s: the overlay's frame is its rest frame; ? again closes it,
  // and the greeting is over.
  d.send({ type: 'key', name: '?', wait: 500 });
  assert.equal(d.state.overlay, 'help');
  assert.deepEqual(frameAt(d.state, start, 2_600), restOf(d.state), 'under the overlay');
  d.send({ type: 'key', name: '?', wait: 500 });
  assert.equal(d.state.overlay, null);
  assert.equal(d.state.fx.view, start);
  for (const ms of [3_040, 3_120, 4_240, 5_000]) assert.deepEqual(frameAt(d.state, start, ms), restOf(d.state), `+${ms} ms, the overlay closed`);
});

// Pip greets once per opening of the app (176): back from the map, resume
// is a new arrival (its fx.view stamp), but Pip has greeted already this
// run, so neither Pip moves and main asks for no frame. Nothing of it is
// saved: the next opening greets again.
test('back from the map, resume arrives again but Pip does not greet again: it rests, and no frame waits for a greeting', () => {
  const saved = { format: 1, welcomed: true, lessons: { 'b-1': { step: 'Y3', beat: 0, done: ['W1'] } } };
  const d = driver({ saved });
  assert.equal(d.state.view, 'resume');
  const first = d.state.fx.view;
  assert.ok(greetFrameIn(d.state, first, ON) !== null, 'the opening greets');
  d.key('m');
  assert.equal(d.state.view, 'map');
  d.key('m');
  assert.equal(d.state.view, 'resume');
  const back = d.state.fx.view;
  assert.ok(back > first && d.state.fx.key < back, `arrived at ${back}, the key at ${d.state.fx.key}`);
  const rest = restOf(d.state);
  for (let ms = 0; ms <= TIMING.greet; ms += 40) assert.deepEqual(frameAt(d.state, back, ms), rest, `+${ms} ms after the return`);
  assert.equal(greetFrameIn(d.state, back, ON), null, 'the detailed Pip asks for no greeting frame');
  assert.equal(nextChange(d.state, back, ON), null, 'nothing else moves on resume');
  // In memory only: the save holds no stamp, so a new opening greets again.
  assert.doesNotMatch(JSON.stringify(snapshot(d.state)), /greet/);
  const again = driver({ saved });
  assert.ok(greetFrameIn(again.state, again.state.fx.view, ON) !== null, 'the next opening greets again');
});

test('with motion off (calm, NO_COLOR, LEARN_PLAIN, no Unicode, TERM=dumb), the greeting and the look around show the rest frame at each of their poses, the detailed Pip too, where with motion they move', () => {
  const modes = {
    calm: capabilities(tty(), { ...ENV, LEARN_CALM: '1' }, 'linux', []),
    NO_COLOR: capabilities(tty(), { ...ENV, NO_COLOR: '1' }, 'linux', []),
    LEARN_PLAIN: capabilities(tty(), { ...ENV, LEARN_PLAIN: '1' }, 'linux', []),
    'no Unicode': capabilities(tty(), { TERM: 'linux' }, 'linux', []),
    'TERM=dumb': capabilities(tty(), { TERM: 'dumb' }, 'linux', []),
  };
  const times = { welcome: GREETING.welcome.map(([ms]) => ms), resume: GREETING.resume.map(([ms]) => ms), complete: LOOK_AROUND.map(([ms]) => ms) };
  // The poses that differ from the rest pose.
  const posed = {
    welcome: GREETING.welcome.filter(([, a, face]) => a !== '●' || face !== '●‿●').map(([ms]) => ms),
    resume: GREETING.resume.filter(([, a, face]) => a !== '●' || face !== '●‿●').map(([ms]) => ms),
    complete: LOOK_AROUND.filter(([, a, face]) => a !== '●' || face !== '^‿^').map(([ms]) => ms),
  };
  for (const [mode, caps] of Object.entries(modes)) {
    const t = theme(caps);
    for (const [label, ms] of Object.entries(times)) {
      const s = screen(label);
      for (const [cols, rows] of [[60, 20], [80, 24], [120, 40]]) {
        const rest = render(s, { cols, rows }, t, REST);
        for (const at of ms) assert.deepEqual(render(s, { cols, rows }, t, { at: s.fx.view + at }), rest, `${label} (${mode}) at ${cols}x${rows}, +${at} ms`);
        // With motion, the same poses move Pip: the rest above is motion off.
        const moving = (at) => render(s, { cols, rows }, MOVING, { at: s.fx.view + at }).join('\n') !== render(s, { cols, rows }, MOVING, REST).join('\n');
        for (const at of posed[label]) assert.ok(moving(at), `${label} at ${cols}x${rows}, +${at} ms: Pip moves with motion on`);
      }
    }
  }
  // Calm in truecolor, with room for the detailed Pip: its greeting adds
  // nothing to the pose main hands over.
  const calm = theme({ ...MOTION.full, depth: 24, motion: false, calm: true });
  for (const label of ['welcome', 'resume']) {
    const s = screen(label);
    const size = { cols: 120, rows: 40 };
    const pip = { size: pipSlot(s, size, calm), pose: restPose('ready') };
    assert.equal(pip.size, 'standard', label);
    const moving = theme({ ...MOTION.full, depth: 24, motion: true, calm: false });
    for (const at of [160, 925, 1_750, 2_750]) {
      assert.deepEqual(render(s, size, calm, { at: s.fx.view + at }, pip), render(s, size, calm, REST, pip), `${label}, calm, +${at} ms`);
      assert.notDeepEqual(render(s, size, moving, { at: s.fx.view + at }, pip), render(s, size, moving, REST, pip), `${label}, with motion, +${at} ms`);
    }
  }
});

test('a card enters: its words whole at once, the top rule grows from the pill, Pip lands with its eyes shut, the stop pops', () => {
  const s = screen('W5');
  const f = (ms) => frameAt(s, s.fx.open, ms);
  const trail = (stop) => `  ●━━●━━●━━●━━${stop}──○──○   ◇──◇──◇   ☆──☆                            step 5 of 12`;
  const pill = '  ╭─  💬 in Claude Code  ';
  assert.deepEqual([...rowsOf(f(0), 2), ...rowsOf(f(0), 5)], [trail('○'), `${pill}${'─'.repeat(18)}`], '+0 ms');
  assert.deepEqual(rowsOf(f(40), 5), [`${pill}${'─'.repeat(35)}`], '+40 ms');
  assert.deepEqual([...rowsOf(f(80), 2), ...rowsOf(f(80), 5)], [trail('◉'), `${pill}${'─'.repeat(44)} [─‿─] ──`], '+80 ms');
  assert.deepEqual([...rowsOf(f(120), 2), ...rowsOf(f(120), 5)], [trail('◉'), `${pill}${'─'.repeat(44)} [◒‿◒] ──`], '+120 ms: its eyes open through half-lids');
  assert.deepEqual([...rowsOf(f(160), 2), ...rowsOf(f(160), 5)], [trail('●'), `${pill}${'─'.repeat(44)} [●‿●] ──`], '+160 ms: rest');
  // Every row but the trail and the border is the rest frame's from +0 ms,
  // and on a card with a question nothing moves again.
  const rest = restOf(s);
  for (const ms of [0, 40, 80, 120]) assert.deepEqual(f(ms).filter((_, i) => i !== 1 && i !== 4), rest.filter((_, i) => i !== 1 && i !== 4), `+${ms} ms`);
  for (const ms of [160, 5_000, 30_000]) assert.deepEqual(f(ms), rest, `+${ms} ms`);
  // After enter on a done step, the next card's stop pops the same way.
  const next = screen('W4 predict');
  const stop = (ms) => frameAt(next, next.fx.open, ms)[1].slice(0, 15);
  assert.deepEqual([0, 80, 160].map(stop), ['  ●━━●━━●━━○──○', '  ●━━●━━●━━◉──○', '  ●━━●━━●━━●──○']);
  // A card that opens checking: Pip lands with the same shut eyes and smile,
  // then rests; it wears its checking face once its child has run 150 ms.
  const checking = screen('W3 opening');
  assert.equal(checking.beat.status, 'opening');
  const face = (s, ms) => frameAt(s, checking.fx.open, ms)[4].slice(-9, -2);
  assert.deepEqual([80, 120, 160].map((ms) => face(checking, ms)), [' [─‿─] ', ' [◒‿◒] ', ' [●‿●] '], 'no child yet');
  const running = reduce(checking, { type: 'run-start', now: checking.fx.open }).state;
  assert.deepEqual([80, 120, 160].map((ms) => face(running, ms)), [' [─‿─] ', ' [◒‿◒] ', ' [◒─◒] '], 'its child started as it opened');
});

test('a new "Not yet": the line whole at once, its mark pops, Pip wears its worried face, nods with both eyes open, and wears it again', () => {
  const s = screen('W3 not yet');
  const f = (ms) => frameAt(s, s.fx.text, ms);
  const top = (face) => `  ╭─  💻 in your other terminal  ──────────────────────────────────── ${face} ──`;
  const line = (mark) => `  │  ${mark} Not yet: .practice/version.txt is empty.`;
  const at = (ms) => [f(ms)[4], f(ms).find((l) => l.includes('Not yet'))];
  assert.deepEqual(at(0), [top('[●‿◒]'), line('△')], '+0 ms');
  assert.deepEqual(at(80), [top('[●‿◒]'), line('▲')], '+80 ms');
  assert.deepEqual(at(160), [top('[●‿●]'), line('▲')], '+160 ms: a nod');
  assert.deepEqual(at(360), [top('[●‿◒]'), line('▲')], '+360 ms: worried again');
  // The check's result differs from the last, so a sweep crosses the pulse
  // line (row 23) in 400 ms. Nothing else moves, and from 400 ms nothing
  // moves at all.
  const rest = restOf(s);
  for (let ms = 0; ms < 400; ms += 40) {
    const others = (lines) => lines.filter((l, i) => i !== 4 && i !== 22 && !l.includes('Not yet'));
    assert.deepEqual(others(f(ms)), others(rest), `+${ms} ms`);
  }
  assert.equal(f(0)[22], `  ${'━'.repeat(8)}${'─'.repeat(68)}`);
  assert.deepEqual(f(360).filter((_, i) => i !== 22), rest.filter((_, i) => i !== 22));
  assert.deepEqual(f(400), rest);
  // The git beat's "Not yet" line pops the same way.
  const git = screen('Y4 not yet');
  const mark = (ms) => frameAt(git, git.fx.text, ms).find((l) => l.includes('Not yet')).slice(0, 7);
  assert.deepEqual([0, 80].map(mark), ['  │  △ ', '  │  ▲ ']);
});

// Pip's 7 cells on a card's top border, at each 40 ms from `start` to 1.2 s.
const faces = (s, start) => Array.from({ length: 31 }, (_, k) => frameAt(s, start, 40 * k)[4].slice(-9, -2));

test('a hop for 240 ms on a right answer or a beat\'s "Done.", the same for each; a guess gets none', () => {
  const hop = [...Array(6).fill('+[●‿●]+'), ...Array(25).fill(' [●‿●] ')];
  const done = screen('C check');
  assert.equal(done.beat.status, 'already');
  // Its card then has nothing to answer or watch: once the gates open, Pip
  // blinks there (159), so the hop's rest is checked up to then.
  const open = gateOpens(done) - done.fx.pass;
  assert.ok(open > 240, String(open));
  const upTo = Math.floor(open / 40);
  assert.deepEqual(faces(done, done.fx.pass).slice(0, upTo), hop.slice(0, upTo), 'the Check\'s "Done."');
  // The Check's typed answer, right: the same hop.
  const typed = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'C', beat: 1 } } } });
  typed.key('enter');
  for (const c of beatOf(typed.state).accept[0]) typed.key(c === ' ' ? 'space' : c, c);
  typed.send({ type: 'key', name: 'enter', wait: 7 });
  assert.equal(typed.state.beat.feedback.kind, 'right');
  assert.deepEqual(faces(typed.state, typed.state.fx.pass), hop, 'a right answer');
  // A guess picked: no hop, whatever the guess.
  for (const pick of ['1', '2']) {
    const g = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W4', beat: 0 } } } });
    g.key('enter');
    g.send({ type: 'key', name: pick, ch: pick, wait: 7 });
    assert.equal(g.state.beat.status, 'done');
    assert.deepEqual(faces(g.state, g.now), Array(31).fill(' [●‿●] '), `guess ${pick}`);
  }
});

test('a step done: the stop pops and its link fills, the rule grows, Pip cheers, each command gets its tick, the check mark draws, then the sparks', () => {
  const s = screen('W3 done');
  const f = (ms) => frameAt(s, s.fx.passLast, ms);
  const rest = restOf(s);
  const trail = (part) => `  ●━━●━━${part}○──○──○──○   ◇──◇──◇   ☆──☆                            step 3 of 12`;
  const rule = (n) => `  ${'━'.repeat(n)}${'─'.repeat(76 - n)}`;
  const top = (face) => `  ╭─  💻 in your other terminal   ✔ DONE  ───────────────────────────${face}──`;
  const chips = (k) => rowsOf(f(k), 13, 15).map((l, i) => (l.endsWith('✔') ? i : null)).filter((i) => i !== null);
  const art = (ms) => rowsOf(f(ms), 17, 19).map((l) => l.slice(5, 26).trimEnd());
  // The words beside the art, from +0 ms.
  const words = (ms) => rowsOf(f(ms), 17, 19).map((l) => l.slice(26));
  assert.deepEqual(words(0), ['Step 3 done!', '.practice/version.txt holds 2.1.285 (Claude Code)', '🔥 3 steps this session']);

  assert.deepEqual([...rowsOf(f(0), 2, 3), ...rowsOf(f(0), 5)], [trail('✦──'), rule(13), top('+[^‿^]+')], '+0 ms');
  assert.deepEqual(chips(0), [1], '+0 ms: mkdir keeps its live tick');
  assert.deepEqual(art(0), ['', '', ''], '+0 ms: the art is blank');
  assert.deepEqual(rowsOf(f(120), 2, 3), [trail('●━─'), rule(16)], '+120 ms');
  assert.deepEqual(chips(120), [0, 1], '+120 ms: cd gets its tick');
  assert.deepEqual(rowsOf(f(240), 2, 3), [trail('●━━'), rule(19)], '+240 ms: rest');
  assert.deepEqual(chips(240), [0, 1, 2], '+240 ms: and then the version');
  assert.deepEqual(art(320), ['', ' ▀█▄', ''], '+320 ms: the first stroke');
  assert.deepEqual(f(320)[4], top('+[^‿^]+'));
  assert.deepEqual(f(360)[4], top(' [^‿^] '), '+360 ms: Pip rests');
  assert.deepEqual(art(400), ['', ' ▀█▄    ▄█▀', '   ▀█▄█▀'], '+400 ms');
  assert.deepEqual(art(480), ['           ▄█▀', ' ▀█▄    ▄█▀', '   ▀█▄█▀'], '+480 ms');
  assert.deepEqual(art(560), ['✦          ▄█▀   ·', ' ▀█▄    ▄█▀    ✦', '·  ▀█▄█▀     ·'], '+560 ms: the sparks, the still art');
  assert.deepEqual(f(560), rest, 'no afterglow: the rest frame keeps the burst and Pip\'s done face');
  // At 60x20 the same cells change: the rule grows from 9 cells to 14.
  const small = (ms) => frameAt(s, s.fx.passLast, ms, [60, 20])[2];
  assert.deepEqual([small(0), small(240)], [`  ${'━'.repeat(9)}${'─'.repeat(47)}`, `  ${'━'.repeat(14)}${'─'.repeat(42)}`]);
  // A step done before that passes again (back with b) cheers all the same,
  // but row 3 already counts it, so the rule never shrinks and regrows.
  const d = driver();
  playUntil(d, (x) => x.view === 'step' && stepOf(x).id === 'W4');
  d.key('b');
  d.send({ type: 'check', lesson: 'b-1', items: [b1Item('2.1.285 (Claude Code)\n')], read: Buffer.from('2.1.285 (Claude Code)\n'), wait: 50 });
  const again = d.state;
  assert.equal(stepOf(again).id, 'W3');
  assert.ok(isDone(again.beat) && again.progress['b-1'].done.includes('W3'));
  const g = (ms) => frameAt(again, again.fx.passLast, ms);
  assert.equal(g(0)[4].slice(-9, -2), '+[^‿^]+', 'it cheers');
  for (let ms = 0; ms <= 560; ms += 40) assert.equal(g(ms)[2], restOf(again)[2], `+${ms} ms: row 3`);
});

test('a level-up: Pip opens its eyes as the banner wipes in, then the arrow fills and the new star lands; the words are there from +0 ms', () => {
  const s = screen('level up hinted');
  const f = (ms) => frameAt(s, s.fx.view, ms);
  const rest = restOf(s);
  assert.deepEqual(rowsOf(f(0), 6, 8), ['   ╭───┴───╮    ▌', '   │  ─‿─  │    ▌', '   ╰───────╯    ▌'], '+0 ms');
  assert.deepEqual([160, 200].map((ms) => rowsOf(f(ms), 7)[0].slice(0, 12)), ['   │  ─‿─  │', '   │  ◒‿◒  │'], '+200 ms: its eyes open through half-lids');
  assert.deepEqual(rowsOf(f(240), 6, 8), ['   ╭───┴───╮    █   █▀▀ █ █ █▀▀▌', '   │  ●‿●  │    █   █▀▀ █ █ █▀▀▌', '   ╰───────╯    █▄▄ █▄▄ ▀▄▀ █▄▄▌'], '+240 ms');
  assert.deepEqual(rowsOf(f(480), 6, 8), rowsOf(rest, 6, 8), '+480 ms: the focus face, the whole banner');
  assert.deepEqual(rowsOf(rest, 5, 7), ['       ●', '   ╭───┴───╮    █   █▀▀ █ █ █▀▀ █     █ █ █▀█', '   │  ◒─◒  │    █   █▀▀ █ █ █▀▀ █     █ █ █▀▀']);
  const arrow = (ms) => f(ms)[9];
  assert.equal(arrow(0), '    GUIDED ★☆☆    ────────     HINTED ★ ☆');
  assert.equal(arrow(480), '    GUIDED ★☆☆    ────────     HINTED ★ ☆');
  assert.equal(arrow(640), '    GUIDED ★☆☆    ━━━━━━──     HINTED ★ ☆');
  assert.equal(arrow(720), '    GUIDED ★☆☆    ━━━━━━━━▸    HINTED ★✦☆');
  assert.equal(rest[9], '    GUIDED ★☆☆    ━━━━━━━━▸    HINTED ★★☆');
  assert.deepEqual(f(800), rest, '+800 ms: rest');
  for (let ms = 0; ms < 800; ms += 40) assert.deepEqual(rowsOf(f(ms), 11, 24), rowsOf(rest, 11, 24), `+${ms} ms: the words and keys`);
  // To CHALLENGE, the third star is the new one.
  const c = screen('level up challenge');
  assert.match(frameAt(c, c.fx.view, 0)[9], /HINTED ★★☆ +─{8} +CHALLENGE ★★$/);
  assert.match(frameAt(c, c.fx.view, 720)[9], /CHALLENGE ★★✦$/);
});

test("the complete screen's light runs every lesson's whole trail, from its first stop to its last, before it rests", () => {
  // The trail, less the count and the work folder before it, where a lesson
  // runs outside the practice copy (a-5's new copy).
  const stops = (line) => [...line.replace(/\s+(?:in \S+ · )?\d+ of \d+$/, '')].filter((c) => !'━─ '.includes(c));
  for (const { id } of lessons) {
    const s = screens.find(([l]) => l === `${id} complete`)[1];
    const at = (ms) => stops(frameAt(s, s.fx.view, ms)[1]);
    const n = at(0).length;
    const first = SHOTS.complete.light;
    const last = TIMING.complete - TIMING.grid;
    assert.equal(at(first).indexOf('◉'), 0, `${id}: the first stop at +${first} ms`);
    assert.equal(at(last).indexOf('◉'), n - 1, `${id}: the last of ${n} stops at +${last} ms`);
    for (let ms = first; ms < last; ms += TIMING.grid) {
      assert.ok(at(ms + TIMING.grid).indexOf('◉') >= at(ms).indexOf('◉'), `${id}: the light never runs back at +${ms} ms`);
    }
    assert.ok(!at(TIMING.complete).includes('◉'), `${id}: no light at rest`);
  }
});

test('a lesson complete: confetti falls into its row, Pip cheers with sparks, COMPLETE stamps in, the ticks appear from blank with the payoff last, a light runs the trail', () => {
  const s = screen('complete');
  const f = (ms) => frameAt(s, s.fx.view, ms);
  const rest = restOf(s);
  const even = '  ✦           ◆           ✧           ✦           ◆           ✧           ✦';
  const odd = '        ·           •           ■           ·           •           ■';
  assert.deepEqual(rowsOf(f(0), 5, 6), [even, odd], '+0 ms');
  assert.deepEqual(rowsOf(f(400), 5, 6), [odd, even], '+400 ms');
  assert.deepEqual(rowsOf(rest, 5, 6), ['  ✦     ·     ◆     •     ✧     ■     ✦     ·     ◆     •     ✧     ■     ✦', ''], 'rest');
  // The cheer is as wide as Pip: its sparks on the antenna's row, in line.
  assert.deepEqual(rowsOf(f(0), 7, 10), ['    +  ●  +', '   ╭───┴───╮', '   │  ^‿^  │', '   ╰───────╯'], '+0 ms: sparks');
  assert.deepEqual(rowsOf(f(240), 7, 10), ['    +  ●  +', '   ╭───┴───╮    █▀▀ █▀█ █▀▄▀█ █▀█', '   │  ^‿^  │    █   █ █ █ ▀ █ █▀▀', '   ╰───────╯    █▄▄ █▄█ █   █ █'], '+240 ms: half the word');
  assert.deepEqual(rowsOf(f(480), 7, 10), rowsOf(rest, 7, 10), '+480 ms: no sparks, the happy face, the whole banner');
  assert.deepEqual(rowsOf(rest, 7, 9), ['       ●', '   ╭───┴───╮    █▀▀ █▀█ █▀▄▀█ █▀█ █   █▀▀ ▀█▀ █▀▀', '   │  ^‿^  │    █   █ █ █ ▀ █ █▀▀ █   █▀▀  █  █▀▀']);
  // "You practised:": the marks start blank, then appear in turn, and the
  // payoff's 🏁 lands last.
  const can = ['install Claude Code', 'sign in', 'start it in a repository', 'tell which version, model and account a session is using'];
  const marks = (ms) => rowsOf(f(ms), 13, 16).map((l, i) => l.slice(0, l.indexOf(can[i])).trim());
  assert.deepEqual(rowsOf(f(0), 13, 16).map((l) => l.trim()), can, 'every word from +0 ms');
  assert.deepEqual(marks(480), ['', '', '', '']);
  assert.deepEqual(marks(560), ['✔', '', '', '']);
  assert.deepEqual(marks(720), ['✔', '✔', '✔', '']);
  assert.deepEqual(marks(800), ['✔', '✔', '✔', '🏁']);
  assert.deepEqual(rowsOf(f(0), 12), rowsOf(rest, 12));
  assert.deepEqual(rowsOf(f(0), 18), rowsOf(rest, 18));
  // One light runs along the finished trail, then everything rests.
  const end = '   ◆━━◆   ★━━★                                12 of 12';
  assert.equal(f(880)[1], `  ●━━◉━━●━━●━━●━━●━━●━━●${end}`, '+880 ms');
  assert.equal(f(1_040)[1], `  ●━━●━━●━━●━━●━━●━━●━━◉${end}`, '+1040 ms: the light runs the whole trail by +1160 ms');
  assert.equal(rest[1], `  ●━━●━━●━━●━━●━━●━━●━━●${end}`);
  // At 1.2 s all but Pip rests; Pip's look around ends at 2.4 s (176).
  assert.deepEqual([...f(1_200).slice(0, 8), ...f(1_200).slice(9)], [...rest.slice(0, 8), ...rest.slice(9)], '+1200 ms: rest but Pip\'s face');
  assert.deepEqual(f(2_400), rest, '+2400 ms: rest');
  // At 60x20 the confetti appears glyph by glyph in its own row.
  const row5 = (ms) => frameAt(s, s.fx.view, ms, [60, 20])[4];
  assert.deepEqual([0, 400, 800, 1_200].map(row5), [
    '  ✦     ·',
    '  ✦     ·     ◆     •     ✧',
    '  ✦     ·     ◆     •     ✧     ■     ✦     ·',
    '  ✦     ·     ◆     •     ✧     ■     ✦     ·     ◆     •',
  ]);
  assert.equal(frameAt(s, s.fx.view, 0, [60, 20])[5], '');
  // Where the payoff is not the last line, its 🏁 still lands last: the
  // capstone's is the first, so the ticks run from the second line down,
  // each on the 40 ms grid, and the first line's mark comes last.
  const cap = screens.find(([l]) => l === 'b-capstone complete')[1];
  const { can: capCan, payoff } = lessons.find((l) => l.id === 'b-capstone').content.intro;
  assert.equal(capCan.indexOf(payoff), 0);
  const capMarks = (ms) => {
    const lines = frameAt(cap, cap.fx.view, ms);
    const from = lines.findIndex((l) => l.includes(C.lessonDone('Capstone'))) + 1;
    return lines.slice(from, from + capCan.length).map((l, i) => l.slice(0, l.indexOf(capCan[i])).trim());
  };
  assert.deepEqual([520, 560, 600, 640, 680, 720, 760, 800].map(capMarks), [
    ['', '', '', '', ''],
    ['', '✔', '', '', ''],
    ['', '✔', '', '', ''],
    ['', '✔', '✔', '', ''],
    ['', '✔', '✔', '✔', ''],
    ['', '✔', '✔', '✔', ''],
    ['', '✔', '✔', '✔', '✔'],
    ['🏁', '✔', '✔', '✔', '✔'],
  ]);
  // Five ticks over 240 ms would land 60 ms apart: each waits for the next
  // frame on the grid instead, so none lands between frames.
  assert.deepEqual([620, 740].map(capMarks), [capMarks(600), capMarks(720)]);
});

// ---- the waiting loops (design 2.3 and 2.4) ----------------------------------
// W3 opened at a known time, its check child started `after` ms later, once
// the card's entrance is over.
function checkingW3(after = 200) {
  const { d, t } = opened('W3');
  const run = at(d, { type: 'run-start', wait: after }).now;
  return { d, t, run };
}
const top = (face) => `  ╭─  💻 in your other terminal  ──────────────────────────────────── ${face} ──`;
const statusRow = (lines) => lines.find((l) => l.includes('Checking'));

test('the spinner: from 150 ms of a running child, the cell after the checking label turns every 80 ms, and Pip wears and holds its checking face', () => {
  const { d, run } = checkingW3();
  const s = d.state;
  const f = (ms) => frameAt(s, run, ms);
  const label = '  │  Checking .practice/version.txt…';
  // 150 ms is off the 40 ms grid: the first frame that moves is at 160.
  for (const ms of [0, 80, 140, 150, 159]) {
    assert.deepEqual([f(ms)[4], statusRow(f(ms))], [top('[●‿●]'), label], `+${ms} ms: the label is state; nothing moves yet`);
  }
  assert.deepEqual([f(160)[4], statusRow(f(160))], [top('[◒─◒]'), `${label} ⠋`], '+160 ms');
  assert.deepEqual(f(239), f(160), 'one frame until +240 ms');
  assert.equal(statusRow(f(240)), `${label} ⠙`, '+240 ms');
  assert.equal(statusRow(f(320)), `${label} ⠹`, '+320 ms');
  // The ten frames of spec 3.5, then round again; Pip holds still.
  assert.deepEqual(Array.from({ length: 11 }, (_, k) => statusRow(f(160 + 80 * k)).at(-1)).join(''), '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⠋');
  for (let ms = 160; ms < 1_200; ms += 40) assert.equal(f(ms)[4], top('[◒─◒]'), `+${ms} ms`);
  // The rest frame, as calm draws it: the label and the checking face.
  assert.deepEqual([restOf(s)[4], statusRow(restOf(s))], [top('[◒─◒]'), label]);
  // Every frame it asks for, its ticks, its seconds and its slower ticks,
  // lands on the 40 ms grid from the child's start.
  const due = [];
  for (let ms = 0; ms < 12_000; ms += nextChange(s, run + ms, ON)) due.push(ms);
  assert.deepEqual(due.filter((ms) => ms % TIMING.grid), [], 'off the grid');
  assert.deepEqual(due.slice(1, 5), [160, 240, 320, 400]);
  assert.deepEqual(due.filter((ms) => ms > 2_900 && ms < 3_100), [2_960, 3_000, 3_040], 'the seconds, between two ticks');
  assert.deepEqual(due.filter((ms) => ms >= 9_920 && ms < 10_500), [9_920, 10_000, 10_240, 10_480]);
});

// The card face's mood changes (181). Mid one-shot it passes from the face
// it showed as the mood changed, over TIMING.mood: each value moves
// linearly, so a cell's glyph changes only where its ends differ, and never
// goes back. Where no one-shot plays, or the change starts one (a "Not
// yet", a hop, a cheer), the new face shows at once, as design 2.3's frames
// do; and nothing moves beside a question.
test('the card face passes from the face it showed only where its mood changes mid one-shot, and each cell changes once at most', () => {
  const FROM = [[undefined, 0], [SHOTS.glance.face, 100], [SHOTS.blink.face, 80], [SHOTS.blink.face, 20], [SHOTS.hop.face, 100], [SHOTS.notYet.face, 200]];
  for (const was of CARD_MOODS) {
    for (const [face, ms] of FROM) {
      const from = { mood: was, face, ms };
      for (const mood of CARD_MOODS.filter((m) => m !== was)) {
        const label = `${was} ${face?.at(-1)?.[1] ?? 'face'} +${ms} to ${mood}`;
        const steps = Array.from({ length: TIMING.mood + 1 }, (_, k) => [...strip(pipFace(MOVING, mood, undefined, undefined, { from, u: k / TIMING.mood }))]);
        assert.deepEqual(steps[0], [...strip(pipFace(MOVING, was, face, ms))], `${label}: it starts from the face it showed`);
        assert.deepEqual(steps.at(-1), [...strip(pipFace(MOVING, mood))], `${label}: it ends on the new one`);
        for (let c = 0; c < steps[0].length; c++) {
          const seen = steps.map((cells) => cells[c]).filter((g, k, all) => k === 0 || g !== all[k - 1]);
          if (steps[0][c] === steps.at(-1)[c]) assert.deepEqual(seen, [steps[0][c]], `${label}: cell ${c} holds`);
          else assert.equal(new Set(seen).size, seen.length, `${label}: cell ${c} never goes back (${seen.join(' ')})`);
        }
      }
    }
  }
  // W3 checking, a file change while its child runs, and a result that
  // leaves the beat waiting after the spinner turned: the face showed
  // checking, and the glance the file change started plays on. It passes
  // from the checking face, through the centre, to the glance, and asks
  // for a frame only where its face changes.
  const { d, run } = checkingW3();
  at(d, { type: 'activity', wait: 250 });
  const changed = at(d, { type: 'check', lesson: 'b-1', items: [b1Item(null)], wait: 50 }).now;
  const s = d.state;
  assert.equal(s.beat.status, 'waiting');
  assert.ok(changed - run >= 160, 'the spinner had turned');
  const face = (ms) => frameAt(s, changed, ms)[4].slice(-9, -2);
  assert.deepEqual([0, 40, 80, 1_000].map(face), [' [◒─◒] ', ' [●‿●] ', ' [◑‿◑] ', ' [◑‿◑] ']);
  assert.equal(phases(s, changed + 40, ON).ms.mood, 40);
  assert.equal(phases(s, changed + TIMING.mood, ON).ms.mood, undefined, 'over by +80 ms');
  for (const ms of [0, 40]) assert.ok(nextChange(s, changed + ms, ON) <= 40, `+${ms} ms: a frame as its face changes`);
  // A key ends it, as it ends every one-shot; the rest frame, as calm
  // draws it, is the new mood's face at once.
  const keyed = reduce(s, { type: 'key', name: 'up', now: changed + 20 }).state;
  assert.equal(phases(keyed, changed + 40, ON).ms.mood, undefined, 'a key ends it');
  assert.equal(restOf(s)[4].slice(-9, -2), ' [●‿●] ');
  // No one-shot as the mood changes: the same result with no file change
  // shows the rest face at once.
  const quiet = checkingW3();
  at(quiet.d, { type: 'check', lesson: 'b-1', items: [b1Item(null)], wait: 300 });
  const after = quiet.d.state;
  assert.equal(after.fx.mood.was, 'checking');
  assert.deepEqual([0, 40, 80].map((ms) => frameAt(after, after.now, ms)[4].slice(-9, -2)), Array(3).fill(' [●‿●] '));
  assert.equal(phases(after, after.now, ON).ms.mood, undefined);
  // A change that starts a one-shot: the cheer of a result that ends the
  // step shows the done face at once, over a glance or none.
  for (const glanced of [false, true]) {
    const { d: c } = checkingW3();
    if (glanced) at(c, { type: 'activity', wait: 250 });
    const done = at(c, { type: 'check', lesson: 'b-1', items: [b1Item('2.1.285 (Claude Code)\n')], read: Buffer.from('2.1.285 (Claude Code)\n'), wait: 50 }).now;
    assert.ok(isDone(c.state.beat), c.state.beat.status);
    assert.deepEqual([0, 40, 80].map((ms) => frameAt(c.state, done, ms)[4].slice(-9, -2)), Array(3).fill('+[^‿^]+'), `glanced: ${glanced}`);
    assert.equal(phases(c.state, done, ON).ms.mood, undefined, `glanced: ${glanced}`);
  }
});

// The card face's 7 cells on `s` from `start` + `from` ms to + `to` ms,
// each millisecond, with the frames nextChange asks from `from`: every
// cell changes once at most and never goes back, and the face each step of
// the 40 ms grid from `from` shows is on a frame it asked for.
function passesOnce(s, start, from, to, label) {
  const face = (ms) => frameAt(s, start, ms)[4].slice(-9, -2);
  const asked = [from];
  for (let ms = from, n; ms < to && (n = nextChange(s, start + ms, ON)) !== null; ) asked.push((ms += n));
  for (let ms = from; ms <= to; ms += TIMING.grid) assert.equal(face(ms), face(asked.findLast((f) => f <= ms)), `${label}: +${ms} ms shows on a frame it asked`);
  const faces = Array.from({ length: to - from + 1 }, (_, k) => [...face(from + k)]);
  for (let c = 0; c < faces[0].length; c++) {
    const seen = faces.map((cells) => cells[c]).filter((g, k, all) => k === 0 || g !== all[k - 1]);
    assert.equal(new Set(seen).size, seen.length, `${label}: cell ${c} never goes back (${seen.join(' ')})`);
  }
  return face;
}

// A glance that starts while the face passes, from a file change, passes
// on from the face the passage showed then (181): it never jumps.
test('a glance that starts while the card face passes passes on from the face it showed then, and each cell changes once at most', () => {
  // The face passes from checking to the glance under it (the test above),
  // and a file change 20 ms in starts a new glance: from the face it showed
  // at +20 ms, it passes on into the new glance, whole 80 ms on.
  const { d: e } = checkingW3();
  at(e, { type: 'activity', wait: 250 });
  const changed = at(e, { type: 'check', lesson: 'b-1', items: [b1Item(null)], wait: 50 }).now;
  const passing = e.state;
  at(e, { type: 'activity', wait: 20 });
  const again = e.state;
  assert.equal(again.fx.activity, changed + 20);
  const was = frameAt(passing, changed, 20)[4].slice(-9, -2);
  assert.equal(was, ' [◒‿◒] ', '+20 ms: the face passing');
  const on = passesOnce(again, changed, 20, 300, 'on into the new glance');
  assert.equal(on(20), was, '+20 ms: the face it showed as the new glance started');
  assert.equal(on(20 + TIMING.mood), ' [◑‿◑] ', '+100 ms: the new glance');
  assert.equal(phases(again, changed + 60, ON).ms.mood, 40, 'its passage counts from the new glance');
  assert.equal(phases(again, changed + 20 + TIMING.mood, ON).ms.mood, undefined, 'over by +100 ms');
  // Its cells from the first passage to the second never go back.
  const cells = [...Array.from({ length: 20 }, (_, ms) => frameAt(passing, changed, ms)[4].slice(-9, -2)), ...Array.from({ length: 81 }, (_, k) => on(20 + k))];
  for (let c = 0; c < cells[0].length; c++) {
    const seen = cells.map((f) => f[c]).filter((g, k, all) => k === 0 || g !== all[k - 1]);
    assert.equal(new Set(seen).size, seen.length, `cell ${c} never goes back (${seen.join(' ')})`);
  }
});

// A save's burst: several file changes inside one passage each start the
// glance again, and the face still passes on from the face it showed.
test('file changes in a burst while the card face passes pass on from the face it showed, and each cell changes once at most', () => {
  for (const gaps of [[20, 2], [10, 20], [20, 2, 2, 2]]) {
    const { d: e } = checkingW3();
    at(e, { type: 'activity', wait: 250 });
    const changed = at(e, { type: 'check', lesson: 'b-1', items: [b1Item(null)], wait: 50 }).now;
    const label = `changes ${gaps.join(', ')} ms apart`;
    // The state each change makes, from the ms it lands.
    const pieces = [[0, e.state]];
    for (const wait of gaps) pieces.push([at(e, { type: 'activity', wait }).now - changed, e.state]);
    const shown = (ms) => frameAt(pieces.findLast(([from]) => from <= ms)[1], changed, ms)[4].slice(-9, -2);
    for (const [from, s] of pieces.slice(1)) assert.equal(frameAt(s, changed, from)[4].slice(-9, -2), frameAt(pieces[pieces.findIndex(([f]) => f === from) - 1][1], changed, from)[4].slice(-9, -2), `${label}: +${from} ms shows the face it showed`);
    const [last, after] = pieces.at(-1);
    const on = passesOnce(after, changed, last, 300, label);
    assert.equal(on(last + TIMING.mood), ' [◑‿◑] ', `${label}: the new glance, whole 80 ms after the last`);
    const faces = Array.from({ length: 301 }, (_, ms) => [...shown(ms)]);
    for (let c = 0; c < faces[0].length; c++) {
      const seen = faces.map((cells) => cells[c]).filter((g, k, all) => k === 0 || g !== all[k - 1]);
      assert.equal(new Set(seen).size, seen.length, `${label}: cell ${c} never goes back (${seen.join(' ')})`);
    }
  }
});

test('nothing passes beside a question or a typed answer: a wrong pick and a typed wrong answer show the worried face at once and ask for no frame', () => {
  const pick = driver();
  pick.key('enter');
  pick.key('enter');
  pick.key('space');
  const picked = at(pick, { type: 'key', name: '2', ch: '2' }).now;
  const typed = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'C', beat: 1 } } } });
  typed.key('enter');
  for (const c of 'zz') typed.key(c, c);
  const answered = at(typed, { type: 'key', name: 'enter' }).now;
  for (const [label, s, from, kind] of [['a wrong pick', pick.state, picked, 'stuck'], ['a typed wrong answer', typed.state, answered, 'wrong']]) {
    assert.equal(s.beat.feedback.kind, kind, label);
    assert.deepEqual([s.fx.mood.at, s.fx.mood.was], [from, 'rest'], `${label}: the mood changed`);
    for (const ms of [0, 20, 40, 80, 120]) {
      assert.equal(frameAt(s, from, ms)[4].slice(-9, -2), ' [●‿◒] ', `${label}, +${ms} ms`);
      assert.equal(phases(s, from + ms, ON).ms.mood, undefined, `${label}, +${ms} ms`);
      assert.equal(nextChange(s, from + ms, ON), null, `${label}, +${ms} ms`);
    }
  }
});

// The pulse line (the rule above the key bar) with a `━` segment of `n`
// cells `from` cells in, in a W-cell rule.
const pulse = (from, n, W = 76) => `  ${'─'.repeat(from)}${'━'.repeat(n)}${'─'.repeat(W - from - n)}`;
const PLAIN = pulse(0, 0);

test('the bounce: a 10-cell segment on the pulse line, on the spinner\'s clock, 4 cells a tick, back and forth, slower after 10 s', () => {
  const { d, run } = checkingW3();
  const s = d.state;
  const line = (ms, size) => frameAt(s, run, ms, size).at(-2);
  assert.equal(line(140), PLAIN, '+140 ms: nothing moves yet');
  assert.deepEqual([160, 480, 960, 1_440].map((ms) => line(ms)), [pulse(0, 10), pulse(16, 10), pulse(40, 10), pulse(64, 10)], 'design 2.3');
  // 64 is as far as 4-cell steps go in 76 cells: it turns there, and is back
  // at the left 16 ticks later.
  assert.deepEqual([1_520, 1_600, 2_720, 2_800].map((ms) => line(ms)), [pulse(60, 10), pulse(56, 10), pulse(0, 10), pulse(4, 10)]);
  // Spinner and bounce change together, on one 80 ms tick.
  for (let ms = 160; ms < 2_000; ms += 40) {
    const same = (ms - 160) % 80 >= 40;
    if (same) assert.deepEqual(frameAt(s, run, ms), frameAt(s, run, ms - 40), `+${ms} ms`);
  }
  // After 10 s, one frame every 240 ms.
  const slow = frameAt(s, run, 10_000);
  for (const ms of [10_040, 10_120, 10_200]) assert.deepEqual(frameAt(s, run, ms), slow, `+${ms} ms`);
  assert.notDeepEqual(frameAt(s, run, 10_240), slow);
  // At 60x20 the pulse line is row 19, 56 cells: the segment turns at 44.
  const small = (ms) => line(ms, [60, 20]);
  assert.deepEqual([160, 480, 1_040, 1_120].map(small), [pulse(0, 10, 56), pulse(16, 10, 56), pulse(44, 10, 56), pulse(40, 10, 56)]);
  // The result lands: the pulse line is a plain rule at once.
  at(d, { type: 'check', lesson: 'b-1', items: [b1Item(null)], wait: 1_000 });
  assert.equal(frameAt(d.state, run, 1_040).at(-2), PLAIN);
});

test('only a run that set "Checking" spins: a beat opening or r, inside the key quiet and the reading grace; never a poll, a file read or an overlay', () => {
  const { d } = opened('W3');
  at(d, { type: 'check', lesson: 'b-1', items: [b1Item(null)], wait: 200 });
  // A poll's child: the card is waiting, so the row and the pulse line stay.
  const poll = at(d, { type: 'run-start', wait: 2_000 }).now;
  const still = restOf(d.state);
  for (const ms of [150, 400, 3_000]) assert.deepEqual(frameAt(d.state, poll, ms), still, `a poll, +${ms} ms`);
  assert.equal(phases(d.state, poll + 400, ON).spinner, null);
  // r: its child starts 7 ms later, and spins 150 ms after that, though the
  // key quiet and the grace hold every ambient loop.
  const r = at(d, { type: 'key', name: 'r', ch: 'r', wait: 100 }).now;
  at(d, { type: 'flush', wait: DEFER_MS + 50 });
  const run = at(d, { type: 'run-start', wait: 7 }).now;
  assert.equal(ambientAllowed(d.state, run + 150), false, 'inside the quiet');
  const f = frameAt(d.state, run, 160);
  assert.match(statusRow(f), /… ⠋$/);
  assert.equal(f.at(-2), pulse(0, 10));
  assert.ok(run + 160 - r < TIMING.keyQuiet);
  // An overlay freezes them, and asks for no frame.
  const why = reduce(d.state, { type: 'key', name: 'w', ch: 'w', now: run + 200 }).state;
  const overlay = reduce(why, { type: 'flush', now: run + 200 + DEFER_MS + 50 }).state;
  assert.equal(overlay.overlay, 'why');
  assert.deepEqual(frameAt(overlay, run, 1_000), restOf(overlay));
  assert.equal(nextChange(overlay, run + 1_000, ON), null);
  // A file read starts no child: a run-start while it opens is another's.
  const file = driver({ course, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore('b-5'), 'b-5': { step: 'W2', beat: 1, warm: [] } } } });
  const open = at(file, { type: 'key', name: 'enter' }).now;
  assert.equal(beatOf(file.state).verify.kind, 'file');
  assert.equal(file.state.beat.status, 'opening');
  const other = reduce(file.state, { type: 'run-start', now: open }).state;
  assert.equal(phases(other, open + 1_000, ON).spinner, null);
  assert.equal(frameAt(other, open, 1_000).at(-2), PLAIN);
});

// W3 watched, with its looks every 2 s (the poll) until ambient loops may
// draw: the look after that is the marker's first.
function watchedW3() {
  const { d, t } = opened('W3');
  const look = (wait = 2_000, item = b1Item(null)) => at(d, { type: 'check', lesson: 'b-1', items: [item], wait }).now;
  let last = look(200);
  const before = [];
  while (!ambientAllowed(d.state, d.now + 2_000)) {
    before.push(d.state);
    last = look();
  }
  return { d, t, look, before, last };
}

test('the look marker: after the reading grace, one notch on the pulse line for each real look, 12 across the rule, nothing between looks', () => {
  const { d, t, look, before } = watchedW3();
  // The card's words hold the marker back for more than the key quiet.
  assert.ok(before.at(-1).now - t > TIMING.keyQuiet, String(before.length));
  for (const s of before) assert.equal(frameAt(s, s.now, 0).at(-2), PLAIN, 'during the grace');
  const notches = [];
  const small = [];
  for (let k = 0; k < 13; k++) {
    const now = look();
    notches.push(frameAt(d.state, now, 0).at(-2));
    small.push(frameAt(d.state, now, 0, [60, 20]).at(-2));
    // One frame per real result: the marker holds until the next. Only Pip
    // lives between (189), on the card's top border.
    for (const ms of [40, 1_000, 1_960]) assert.deepEqual(notPip(frameAt(d.state, now, ms)), notPip(frameAt(d.state, now, 0)), `look ${k + 1}, +${ms} ms`);
  }
  assert.deepEqual(notches.slice(0, 3), [pulse(0, 3), pulse(7, 3), pulse(13, 3)], 'design 2.3, looks 1 to 3');
  assert.deepEqual(small.slice(0, 3), [pulse(0, 3, 56), pulse(5, 3, 56), pulse(10, 3, 56)], 'design 2.4, row 19');
  assert.equal(notches[11], pulse(73, 3), 'the twelfth notch ends at the rule\'s end');
  assert.equal(notches[12], pulse(0, 3), 'and the thirteenth is back at the left');
  // A result for something the screen does not watch is no look.
  at(d, { type: 'check', lesson: 'b-2', items: [], wait: 1_000 });
  assert.equal(frameAt(d.state, d.now, 0).at(-2), pulse(0, 3));
  // The rest frame, calm's, has a plain rule.
  assert.equal(restOf(d.state).at(-2), PLAIN);
});

test('the look marker hides for 4 s after a key, stops at idle as "Stuck?" appears, and never shows with an overlay or the hint box', () => {
  const { d, look } = watchedW3();
  look();
  look();
  assert.equal(frameAt(d.state, d.now, 0).at(-2), pulse(7, 3));
  // A key: hidden at once, and through the looks of the next 4 s; the first
  // look after them starts it at the left again.
  const key = at(d, { type: 'key', name: 'down', wait: 500 }).now;
  assert.equal(frameAt(d.state, key, 0).at(-2), PLAIN, 'the key');
  look();
  assert.equal(frameAt(d.state, d.now, 0).at(-2), PLAIN, 'a look 2 s after it');
  look(2_000);
  assert.equal(d.now - key, TIMING.keyQuiet);
  assert.equal(frameAt(d.state, d.now, 0).at(-2), pulse(0, 3), 'the first look 4 s after it');
  look();
  assert.equal(frameAt(d.state, d.now, 0).at(-2), pulse(7, 3));
  // Idle: 120 s with no key and no file activity. The marker stops, the
  // "Stuck?" offer appears and Pip wears its worried face.
  const quiet = d.state;
  const idleAt = d.state.lastActivity + IDLE_MS;
  assert.equal(frameAt(quiet, idleAt, -1).at(-2), pulse(7, 3));
  assert.equal(frameAt(quiet, idleAt, 0).at(-2), PLAIN);
  // No frame timer waits for it: the marker moves only on a look, and the
  // app's 1 s tick, which brings the "Stuck?" line, draws its stop. Between
  // looks a frame waits only for Pip's next blink or look to the side (189),
  // and none for one at idle.
  const wait = nextChange(quiet, quiet.now + 10, ON);
  assert.deepEqual(notPip(frameAt(quiet, quiet.now + 10, wait)), notPip(frameAt(quiet, quiet.now + 10, 0)), 'between looks');
  assert.notEqual(frameAt(quiet, quiet.now + 10, wait)[4], frameAt(quiet, quiet.now + 10, wait - 1)[4], 'Pip\'s next moment');
  const last = nextChange(quiet, idleAt - 10, ON);
  assert.ok(last === null || last < 10, `just before idle: ${last}`);
  d.send({ type: 'tick', wait: idleAt - d.now });
  look(100);
  assert.equal(d.state.beat.idle, true);
  assert.equal(frameAt(d.state, d.now, 0).at(-2), PLAIN, 'a look at idle moves nothing');
  // Y4 at idle, where a hint is there to offer, after a look at git.
  const y4 = screen('Y4 idle');
  const looked = reduce(y4, { type: 'git', paths: ['notes.md'], now: y4.now + 2_000 }).state;
  assert.equal(looked.fx.look, y4.now + 2_000);
  const stuck = frameAt(looked, looked.now, 0);
  assert.equal(stuck.at(-2), PLAIN);
  assert.ok(stuck.some((l) => l.includes(C.stuckOffer)));
  assert.match(stuck[4], / \[●‿◒\] ──$/);
  // With an overlay: its own rest frame.
  const { d: o, look: oLook } = watchedW3();
  oLook();
  o.key('w');
  assert.equal(o.state.overlay, 'why');
  oLook();
  assert.deepEqual(frameAt(o.state, o.now + 5_000, 0), restOf(o.state));
});

// The stamps that hold the look marker back or start it again, as motion.mjs
// reads them: the reading grace (view, open, text, cut short by activity),
// the key quiet, and a sweep (activity, changedAt).
const MARKER_STAMPS = ['view', 'open', 'text', 'key', 'activity', 'changedAt'];

test('the marker counts its looks from the newest stamp that holds it back, and keeps them as long as any hold can last', () => {
  // A hold lasts at most the longest grace: the key quiet is shorter.
  assert.ok(TIMING.keyQuiet <= TIMING.graceMax);
  let newestText = 0;
  for (const [label, s] of screens) {
    const fx = s.fx;
    // The first screen, before any event, has nothing to count from.
    if (!fx.looks) continue;
    assert.equal(fx.looks.from, Math.max(...MARKER_STAMPS.map((k) => fx[k] ?? -Infinity)), label);
    if (fx.text !== undefined && fx.text === fx.looks.from) newestText += 1;
  }
  assert.ok(newestText > 10, `screens whose newest hold is new text: ${newestText}`);
});

test('in the fail state the marker steps on each re-check after the "Not yet" line\'s grace; with the hint box open the pulse line stays a plain rule', () => {
  const { d, look } = watchedW3();
  const fail = look(2_000, b1Item(''));
  assert.equal(d.state.beat.status, 'fail');
  assert.equal(d.state.fx.text, fail, 'a new "Not yet" line');
  // The check's FAIL message is long: its grace outlasts the key quiet.
  while (!ambientAllowed(d.state, d.now + 2_000)) {
    look(2_000, b1Item(''));
    assert.equal(frameAt(d.state, d.now, 0).at(-2), PLAIN, `+${d.now - fail} ms`);
  }
  const rows = [];
  for (let k = 0; k < 3; k++) {
    const now = look(2_000, b1Item(''));
    rows.push(frameAt(d.state, now, 0).at(-2));
  }
  assert.equal(d.state.fx.text, fail, 'the same "Not yet" each time');
  assert.ok(d.now - 4_000 - fail > TIMING.keyQuiet + 2_000);
  assert.deepEqual(rows, [pulse(0, 3), pulse(7, 3), pulse(13, 3)]);
  // h opens the hint box: the rule is plain, on every look after it too.
  d.send({ type: 'key', name: 'h', ch: 'h', wait: 100 });
  d.send({ type: 'flush', wait: DEFER_MS + 50 });
  assert.equal(d.state.beat.rung, 0);
  for (let k = 0; k < 12; k++) {
    look(2_000, b1Item(''));
    assert.equal(frameAt(d.state, d.now, 0).at(-2), PLAIN, `look ${k + 1} with the hint box`);
  }
});

test('the change sweep: a file change, or a look that differs, sends one 8-cell segment across the pulse line in 400 ms; then the marker starts again at the left', () => {
  const { d, look } = watchedW3();
  look();
  look();
  assert.equal(frameAt(d.state, d.now, 0).at(-2), pulse(7, 3));
  const before = d.state;
  const act = at(d, { type: 'activity', wait: 500 }).now;
  const line = (s, ms) => frameAt(s, act, ms).at(-2);
  // The watcher's look at the file, right after the change, lands mid-sweep.
  const withLook = (() => { look(50); return d.state; })();
  assert.deepEqual([0, 160, 320].map((ms) => line(withLook, ms)), [pulse(0, 8), pulse(27, 8), pulse(54, 8)], 'design 2.3');
  for (let ms = 0; ms < 400; ms += 80) assert.equal(line(withLook, ms + 40), line(withLook, ms), `80 ms frames, +${ms + 40} ms`);
  assert.equal(line(withLook, 400), pulse(0, 3), '+400 ms: the marker restarts at the left');
  assert.equal(nextChange(withLook, act + 10, ON), 70, 'the sweep\'s next frame');
  // With no look in it, the rule is plain after the sweep until the next one.
  const noLook = reduce(before, { type: 'activity', now: act }).state;
  assert.equal(line(noLook, 400), PLAIN);
  // A key ends the sweep, as it ends any one-shot.
  const keyed = reduce(withLook, { type: 'key', name: 'down', now: act + 100 }).state;
  assert.equal(line(keyed, 160), PLAIN);
  // A look whose result differs from the last sweeps too, from its own time.
  const y4 = screen('Y4 live dirty');
  const moved = reduce(y4, { type: 'git', paths: ['notes.md', 'a.txt'], now: y4.now + 2_000 }).state;
  assert.equal(moved.fx.changed, true);
  assert.deepEqual([0, 160, 320].map((ms) => frameAt(moved, y4.now + 2_000, ms).at(-2)), [pulse(0, 8), pulse(27, 8), pulse(54, 8)]);
  const same = reduce(y4, { type: 'git', paths: ['notes.md'], now: y4.now + 2_000 }).state;
  assert.equal(same.fx.changed, false);
  assert.equal(frameAt(same, y4.now + 2_000, 0).at(-2), frameAt(same, y4.now + 2_000, 200).at(-2), 'a look the same as the last: no sweep');
  // The rest frame has none.
  assert.equal(restOf(withLook).at(-2), PLAIN);
});

test('no sweep with the hint box open, under an overlay, at idle, or on the look that ends the watch', () => {
  const hinted = screen('W3 hint 1');
  assert.equal(hinted.beat.rung, 0);
  const act = reduce(hinted, { type: 'activity', now: hinted.now + 30_000 }).state;
  for (const ms of [0, 160, 320, 400]) assert.equal(frameAt(act, act.now, ms).at(-2), PLAIN, `the hint box, +${ms} ms`);
  const why = screen('W3 why');
  const under = reduce(why, { type: 'activity', now: why.now + 1_000 }).state;
  assert.deepEqual(frameAt(under, under.now, 160), restOf(under), 'an overlay');
  // Idle stills every one-shot, a sweep too: only a running child moves.
  const y4 = screen('Y4 idle');
  const moved = reduce(y4, { type: 'git', paths: ['notes.md', 'b.txt'], now: y4.now + 2_000 }).state;
  assert.equal(moved.fx.changedAt, y4.now + 2_000);
  for (const ms of [0, 160]) assert.equal(frameAt(moved, moved.now, ms).at(-2), PLAIN, `idle, +${ms} ms`);
  const done = screen('W3 done');
  assert.equal(done.fx.changed, true, 'not yet, then done');
  for (const ms of [0, 160, 320]) assert.equal(frameAt(done, done.fx.look, ms).at(-2), PLAIN, `done, +${ms} ms`);
});

test('Pip\'s glance: on a file change Pip looks toward the other window for 1.2 s, then back; never on a beat that watches nothing, nor while it checks', () => {
  const { d } = watchedW3();
  const act = at(d, { type: 'activity', wait: 500 }).now;
  const face = (s, ms, from = act) => frameAt(s, from, ms)[4];
  assert.deepEqual([0, 600, 1_160].map((ms) => face(d.state, ms)), Array(3).fill(top('[◑‿◑]')), 'design 2.3');
  assert.equal(face(d.state, 1_200), top('[●‿●]'), '+1200 ms: back at the learner');
  assert.equal(nextChange(d.state, act + 600, ON) <= 600, true, 'its end is a frame');
  // Over a worried face too: it looks away, then wears it again.
  const failing = screen('W3 not yet');
  const away = reduce(failing, { type: 'activity', now: failing.now + 5_000 }).state;
  assert.deepEqual([0, 1_200].map((ms) => face(away, ms, away.now)), [top('[◑‿◑]'), top('[●‿◒]')]);
  // W1 watches nothing: a file change stamps nothing, and Pip stays.
  const w1 = opened('W1');
  const still = at(w1.d, { type: 'activity', wait: 500 }).now;
  assert.equal(w1.d.state.fx.activity, undefined);
  for (const ms of [0, 600]) assert.match(frameAt(w1.d.state, still, ms)[4], / \[●‿●\] ──$/, `W1, +${ms} ms`);
  // A child running: Pip holds its checking face.
  const { d: c, run } = checkingW3();
  const busy = reduce(c.state, { type: 'activity', now: run + 500 }).state;
  assert.equal(face(busy, 100, run + 500), top('[◒─◒]'));
  // A key ends it, as it ends any one-shot.
  const keyed = reduce(d.state, { type: 'key', name: 'down', now: act + 300 }).state;
  assert.equal(face(keyed, 400), top('[●‿●]'));
  // The file change brings a new "Not yet" 60 ms later: Pip wears its
  // worried face, nods, and keeps it (design 2.3); the glance does not come
  // back.
  const waiting = screen('W3 waiting');
  const edit = reduce(waiting, { type: 'activity', now: waiting.now + 5_000 }).state;
  const notYet = reduce(edit, { type: 'check', lesson: 'b-1', items: [b1Item('hello')], now: edit.now + 60 }).state;
  assert.equal(notYet.beat.status, 'fail');
  const worried = Array.from({ length: 31 }, (_, k) => 40 * k).filter((ms) => ms >= 60 + TIMING.notYet).map((ms) => face(notYet, ms, edit.now));
  assert.deepEqual(worried, Array(worried.length).fill(top('[●‿◒]')), 'worried from the nod\'s end');
});

test('no glance once the watch ends: a file change, then a look that passes the beat, hops or cheers and never looks away', () => {
  // W3's only beat: the step is done, Pip cheers, then wears its done face.
  const waiting = screen('W3 waiting');
  const edit = reduce(waiting, { type: 'activity', now: waiting.now + 5_000 }).state;
  const passed = reduce(edit, { type: 'check', lesson: 'b-1', items: [b1Item('2.1.285 (Claude Code)\n')], read: Buffer.from('2.1.285 (Claude Code)\n'), now: edit.now + 50 }).state;
  // The Check's first beat, a check before its typed answer: a hop.
  const c = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'C', beat: 0 } } } });
  c.key('enter');
  assert.ok(watching(c.state), 'the Check watches its check');
  const cEdit = reduce(c.state, { type: 'activity', now: c.now + 5_000 }).state;
  const hopped = reduce(cEdit, { type: 'check', lesson: 'b-1', items: [b1Item('2.1.285 (Claude Code)\n')], now: cEdit.now + 50 }).state;
  for (const [what, s, from, last] of [['the step\'s last beat', passed, edit.now, true], ['a beat before the last', hopped, cEdit.now, false]]) {
    assert.ok(isDone(s.beat), what);
    assert.equal(watching(s), null, what);
    assert.equal(s.fx.activity, from, what);
    assert.equal(s.pos.beat === stepOf(s).beats.length - 1, last, what);
    for (let ms = 50; ms <= 1_240; ms += 40) assert.doesNotMatch(frameAt(s, from, ms)[4], /◑‿◑/, `${what}, +${ms} ms`);
  }
});

// When ambient loops may first draw on a screen: the reading grace and the
// key quiet both over.
const gateOpens = (s) => {
  let ms = s.now;
  while (!ambientAllowed(s, ms)) ms += 10;
  return ms;
};

// A blink passes through half-lids each way (181): ◒ on its first frame,
// ─ from 40 ms, ◒ at 120 ms and open at 160 ms. Off the grid its eyes are
// part way, as the package's glyphs draw them: still ─ at 90 ms.
test('Pip\'s blink: 160 ms every 6 s once the gates open, through half-lids each way, on the welcome and on a card with nothing to answer, watched or not, until idle', () => {
  const s = screen('W4 sign in');
  assert.equal(beatOfVerify(s), 'self');
  const q = gateOpens(s);
  const face = (ms) => frameAt(s, q, ms)[4].slice(-9, -2).trim();
  assert.deepEqual([-10, 0, 40, 90, 120, 160, 5_990, 6_000, 6_040, 6_120, 6_160].map(face), ['[●‿●]', '[◒‿◒]', '[─‿─]', '[─‿─]', '[◒‿◒]', '[●‿●]', '[●‿●]', '[◒‿◒]', '[─‿─]', '[◒‿◒]', '[●‿●]']);
  assert.equal(nextChange(s, q + 10, ON), 30, 'the eyes shut');
  assert.equal(nextChange(s, q + 50, ON), 70, 'the eyes half open');
  assert.equal(nextChange(s, q + 130, ON), 30, 'the eyes open');
  assert.equal(nextChange(s, q + 160, ON), 5_840, 'the next blink');
  // Nothing else on the card moves.
  assert.deepEqual(frameAt(s, q, 0).filter((_, i) => i !== 4), restOf(s).filter((_, i) => i !== 4));
  // Until 120 s with no key: then no blink, and no frame is asked for.
  const idleAt = s.lastActivity + IDLE_MS;
  const later = Math.ceil((idleAt - q) / 6_000) * 6_000;
  assert.equal(face(later), '[●‿●]', 'idle');
  assert.equal(nextChange(s, q + later, ON), null);
  // The welcome's big Pip blinks the same way.
  const w = screen('welcome');
  const wq = gateOpens(w);
  assert.match(frameAt(w, wq, 0)[6], /│ {2}◒‿◒ {2}│/);
  assert.match(frameAt(w, wq, 40)[6], /│ {2}─‿─ {2}│/);
  assert.match(frameAt(w, wq, 120)[6], /│ {2}◒‿◒ {2}│/);
  assert.match(frameAt(w, wq, 160)[6], /│ {2}●‿● {2}│/);
  // Not where the card has a question or Pip wears its done face; and never
  // in the rest frame. A card that watches blinks too (189), below.
  for (const label of ['W5', 'W3 done']) {
    const x = screen(label);
    const xq = gatesOpen(x) ?? x.now + 30_000;
    for (const ms of [0, 80, 6_000, 6_080]) assert.equal(frameAt(x, xq, ms)[4], restOf(x)[4], `${label}, +${ms} ms`);
  }
  assert.equal(restOf(s)[4].slice(-9, -2), ' [●‿●] ');
});

// Pip's life on a card that watches (189): the card's top border, wherever
// the size puts it, Pip's face at its end, and the frame without that row.
const borderRow = (lines) => lines.findIndex((l) => l.includes('╭─'));
const cardFaceOf = (lines) => lines[borderRow(lines)].match(/(\S+) ──$/)?.[1];
const withoutBorder = (lines) => lines.filter((_, i) => i !== borderRow(lines));
const WATCHED = ['W3 waiting', 'W3 not yet', 'Y4 live dirty', 'W7 git dirty'];

// From the moment the gates open: a blink every 6 s through half-lids; a
// look toward the other window at 9 s, away from it at 27 s, toward it again
// at 45 s, each 800 ms, back to the face Pip rests in.
const LIFE = [[0, '[◒‿◒]'], [40, '[─‿─]'], [120, '[◒‿◒]'], [160, null], [6_000, '[◒‿◒]'], [6_160, null],
  [9_000, '[◑‿◑]'], [9_760, '[◑‿◑]'], [9_800, null], [12_000, '[◒‿◒]'], [12_160, null],
  [27_000, '[◐‿◐]'], [27_760, '[◐‿◐]'], [27_800, null], [45_000, '[◑‿◑]'], [45_800, null]];

test('a card that watches: Pip blinks every 6 s and looks to one side and back every 18 s from 9 s, toward the other window and away in turn, never with a blink, at 60x20, 80x24 and 120x40; nothing else moves', () => {
  for (const label of WATCHED) {
    const s = screen(label);
    assert.ok(watching(s) && !isDone(s.beat), label);
    const q = ambientOpened(s);
    assert.deepEqual([ambientAllowed(s, q - 1), ambientAllowed(s, q)], [false, true], `${label}: the gates open`);
    for (const size of [[60, 20], [80, 24], [120, 40]]) {
      const where = `${label} at ${size.join('x')}`;
      const own = cardFaceOf(restOf(s, size));
      const f = (ms) => frameAt(s, q, ms, size);
      // The frame before the gates open shows Pip as at rest, with the
      // look marker where the screen has it.
      const still = f(-40);
      assert.equal(cardFaceOf(still), own, `${where}, before the gates open`);
      for (const [ms, face] of LIFE) {
        const frame = f(ms);
        assert.equal(cardFaceOf(frame), face ?? own, `${where}, +${ms} ms`);
        // Words, the pulse line and everything but Pip hold still.
        assert.deepEqual(withoutBorder(frame), withoutBorder(still), `${where}, +${ms} ms`);
      }
    }
    // Never a blink and a look at once, and a look at most once in 15 s.
    const looks = [];
    for (let ms = 0; ms < 60_000; ms += TIMING.grid) {
      const p = phases(s, q + ms, ON);
      assert.ok(!(p.blink && p.peek), `${label}, +${ms} ms`);
      if (p.peek && !phases(s, q + ms - TIMING.grid, ON).peek) looks.push(ms);
    }
    assert.deepEqual(looks, [9_000, 27_000, 45_000], label);
  }
});

test('a card that watches: the frame timer asks for exactly the 40 ms grid steps where Pip\'s face changes, and none between', () => {
  // A file and git, at rest and worried.
  for (const label of ['W3 waiting', 'Y4 live dirty']) {
    const s = screen(label);
    const q = ambientOpened(s);
    const face = (at) => cardFaceOf(frameAt(s, at, 0));
    const changes = [];
    for (let ms = TIMING.grid; ms < 40_000; ms += TIMING.grid) if (face(q + ms) !== face(q + ms - TIMING.grid)) changes.push(ms);
    const asked = [];
    for (let at = q; ;) {
      const wait = nextChange(s, at, ON);
      if (wait === null || at + wait >= q + 40_000) break;
      at += wait;
      asked.push(at - q);
    }
    assert.deepEqual(asked, changes, label);
    // In 40 s: the first blink's last 3 frames (its first is the frame
    // that opens the gates), 6 more blinks of 4 frames, and 2 looks of 2.
    assert.equal(asked.length, 3 + 6 * 4 + 2 * 2, label);
  }
});

test('Pip\'s life on a card that watches keeps every gate: the reading grace, a key\'s 4 s quiet, the hint box, an overlay, idle at 120 s, and a running check', () => {
  const lives = (x, at) => {
    const p = phases(x, at, ON);
    return p.blink || p.peek;
  };
  const s = screen('W3 waiting');
  const q = ambientOpened(s);
  // The reading grace: nothing until the gates open.
  for (let at = s.now; at < q; at += TIMING.grid) assert.equal(lives(s, at), false, `+${at - s.now} ms, reading`);
  // A key 500 ms before the first look: none for 4 s, then the cycle again
  // from the quiet's end, its first blink at once.
  const key = q + 8_500;
  const keyed = reduce(s, { type: 'key', name: 'down', now: key }).state;
  assert.equal(ambientOpened(keyed), key + TIMING.keyQuiet);
  for (let at = key; at < key + TIMING.keyQuiet; at += TIMING.grid) assert.equal(lives(keyed, at), false, `+${at - key} ms after the key`);
  assert.equal(phases(keyed, key + TIMING.keyQuiet, ON).blink, true);
  assert.equal(phases(keyed, key + TIMING.keyQuiet + TIMING.peekFrom, ON).peek, true);
  assert.deepEqual(notPip(frameAt(keyed, key, 600)), notPip(frameAt(keyed, key, 0)), 'the look it would have made');
  assert.equal(frameAt(keyed, key, 600)[4], frameAt(keyed, key, 0)[4]);
  // The hint box, and an overlay: still, and no frame waits for Pip.
  const hinted = screen('W3 hint 1');
  assert.ok(watching(hinted) && hinted.beat.rung === 0);
  const { d: o } = watchedW3();
  o.key('w');
  assert.equal(o.state.overlay, 'why');
  const overlaid = o.state;
  for (const [what, x] of [['the hint box', hinted], ['an overlay', overlaid]]) {
    const from = ambientOpened(x) + 1_000;
    for (let at = from; at < from + 40_000; at += TIMING.grid) assert.equal(lives(x, at), false, `${what}, +${at - from} ms`);
    assert.equal(nextChange(x, from, ON), null, what);
  }
  // Idle, 120 s with no key and no file activity: Pip stops, and no frame
  // timer waits for a blink or a look at idle; the app's 1 s tick draws it.
  const idleAt = s.lastActivity + IDLE_MS;
  for (let at = idleAt; at < idleAt + 40_000; at += TIMING.grid) assert.equal(lives(s, at), false, `idle, +${at - idleAt} ms`);
  assert.equal(nextChange(s, idleAt, ON), null, 'idle');
  for (let at = idleAt - 20_000; at < idleAt; at += 120) {
    const wait = nextChange(s, at, ON);
    assert.ok(wait === null || at + wait < idleAt, `${idleAt - at} ms before idle, a frame in ${wait} ms`);
  }
  // A check running past the key's quiet and the reading grace: the
  // checking face and the spinner own the card; Pip neither blinks nor looks.
  const { d, run } = checkingW3();
  const busy = d.state;
  assert.ok(ambientAllowed(busy, run + 25_000), 'the gates are open');
  for (let at = run + 25_000; at < run + 65_000; at += TIMING.grid) assert.equal(lives(busy, at), false, `checking, +${at - run} ms`);
  for (const ms of [25_000, 34_000, 34_400, 37_000]) assert.equal(cardFaceOf(frameAt(busy, run, ms)), '[◒─◒]', `checking, +${ms} ms`);
  for (const ms of [25_000, 34_000]) assert.ok(nextChange(busy, run + ms, ON) <= TIMING.slowTick, 'only the spinner\'s ticks');
});

test('a file change on a card that watches: its glance and the sweep take over from Pip\'s look to the side, which never moves the pulse line', () => {
  const s = screen('W3 waiting');
  const q = ambientOpened(s);
  const line = (x, at) => frameAt(x, at, 0).at(-2);
  // A look to the side moves Pip alone: the pulse line holds.
  for (const ms of [9_000, 9_400, 27_000, 27_400]) assert.equal(line(s, q + ms), line(s, q + 8_000), `+${ms} ms`);
  assert.equal(cardFaceOf(frameAt(s, q, 27_200)), '[◐‿◐]');
  // A file change 200 ms into the look away: Pip looks toward the other
  // window at once, for 1.2 s, as one sweep crosses the pulse line.
  const act = q + 27_200;
  const changed = reduce(s, { type: 'activity', now: act }).state;
  assert.deepEqual([0, 160, 320].map((ms) => line(changed, act + ms)), [pulse(0, 8), pulse(27, 8), pulse(54, 8)], 'the sweep');
  for (const ms of [0, 40, 400, 600, 1_160]) assert.equal(cardFaceOf(frameAt(changed, act, ms)), '[◑‿◑]', `the glance, +${ms} ms`);
  // A look to the side that the file change's glance holds: the glance
  // shows, and the sweep's segment is the file change's alone.
  const during = reduce(s, { type: 'activity', now: q + 8_900 }).state;
  for (const ms of [100, 500]) assert.equal(cardFaceOf(frameAt(during, q + 8_900, ms)), '[◑‿◑]');
  assert.equal(line(during, q + 8_900 + TIMING.sweep), line(during, q + 8_900 + 1_000), 'after the sweep, the line holds');
});

// Pip's blinks and looks to the side as they start, between `from` and
// `to`: [ms from `q`, part]. Pip's life is a function of time alone, so a
// scan on the 40 ms grid from `q` finds each on its first frame.
const lifeStarts = (x, q, from, to) => {
  const out = [];
  let was;
  for (let ms = from; ms < to; ms += TIMING.grid) {
    const p = phases(x, q + ms, ON);
    const part = ['blink', 'peekRight', 'peekLeft'].find((k) => p.ms[k] !== undefined);
    if (part && part !== was) out.push([ms, part]);
    was = part;
  }
  return out;
};

test('a file change never moves Pip\'s blinks or looks to the side: each stays on the cycle from the moment the gates opened, so looks start at least 15 s apart, toward the other window and away in turn', () => {
  for (const label of WATCHED) {
    const s = screen(label);
    const q = ambientOpened(s);
    for (let off = 0; off <= 36_000; off += 400) {
      const changed = reduce(s, { type: 'activity', now: q + off }).state;
      const where = `${label}, a file change at +${off} ms`;
      // Before the change Pip lived on the card as it was; from it, on the
      // card with the change seen.
      const starts = [...lifeStarts(s, q, 0, off), ...lifeStarts(changed, q, off, off + 40_000)];
      const looks = starts.filter(([, part]) => part !== 'blink');
      for (const [ms, part] of starts) {
        if (part === 'blink') assert.equal(ms % TIMING.blinkEvery, 0, `${where}: a blink at +${ms} ms`);
        else {
          const n = (ms - TIMING.peekFrom) / TIMING.peekEvery;
          assert.ok(Number.isInteger(n) && part === (n % 2 ? 'peekLeft' : 'peekRight'), `${where}: ${part} at +${ms} ms`);
        }
      }
      looks.slice(1).forEach(([ms], k) => assert.ok(ms - looks[k][0] >= 15_000, `${where}: looks at +${looks[k][0]} and +${ms} ms`));
    }
  }
});

// The card face's eyes, as a class: Pip's own face, half-lids, shut, or
// looking toward the other window or away from it.
const eyesOf = (face, own) => (face === own ? 'own' : { '◒': 'half', '─': 'shut', '◑': 'right', '◐': 'left' }[[...face][1]] ?? face);
// The changes of face Pip makes through another: a blink passes half-lids,
// and every look passes Pip's own face, the centre.
const STEPS = new Set(['own>half', 'half>own', 'half>shut', 'shut>half', 'own>right', 'right>own', 'own>left', 'left>own']);

test('after a file change\'s glance Pip never jumps: its eyes pass the centre before a look to either side, and half-lids before a blink, wherever the change lands in a blink or a look, at 80x24', () => {
  for (const label of ['W3 waiting', 'Y4 live dirty']) {
    const s = screen(label);
    const q = ambientOpened(s);
    const own = cardFaceOf(restOf(s));
    // File changes on each 40 ms step from 1.4 s before a blink, the look
    // toward the other window and the look away until each is over.
    for (const [life, length] of [[24_000, TIMING.blink], [TIMING.peekFrom, TIMING.peek], [TIMING.peekFrom + TIMING.peekEvery, TIMING.peek]]) {
      for (let off = life - 1_400; off <= life + length; off += TIMING.grid) {
        const act = q + off;
        const changed = reduce(s, { type: 'activity', now: act }).state;
        // The change's own frame turns Pip toward the other window at once.
        assert.equal(cardFaceOf(frameAt(changed, act, 0)), '[◑‿◑]', `${label}, a change at +${off} ms`);
        let was = '[◑‿◑]';
        for (let ms = TIMING.grid; ms <= TIMING.glance + 1_200; ms += TIMING.grid) {
          const face = cardFaceOf(frameAt(changed, act, ms));
          const step = `${eyesOf(was, own)}>${eyesOf(face, own)}`;
          assert.ok(face === was || STEPS.has(step), `${label}, a change at +${off} ms: ${was} to ${face} at +${ms} ms`);
          was = face;
        }
      }
    }
  }
});

test('a file change on a card that watches: while its glance shows, the frame timer asks for no blink or look it covers, only the frames that change', () => {
  // Just before a blink, before and during a look toward the other window,
  // and just before the look away.
  for (const [label, offs] of [['W3 waiting', [5_880, 8_880, 9_480, 17_480, 26_480]], ['Y4 live dirty', [5_880, 8_880, 9_480]], ['W7 git dirty', [8_880, 9_480]]]) {
    const s = screen(label);
    const q = ambientOpened(s);
    for (const off of offs) {
      const act = q + off;
      const x = reduce(s, { type: 'activity', now: act }).state;
      const frame = (ms) => frameAt(x, act, ms).join('\n');
      const changes = [];
      for (let ms = TIMING.grid; ms < 3_000; ms += TIMING.grid) if (frame(ms) !== frame(ms - TIMING.grid)) changes.push(ms);
      const asked = [];
      for (let at = act; ;) {
        const wait = nextChange(x, at, ON);
        if (wait === null || at + wait >= act + 3_000) break;
        at += wait;
        asked.push(at - act);
      }
      assert.deepEqual(asked, changes, `${label}, a file change at +${off} ms`);
    }
  }
});

// The check-only card, its lesson's folder watched: the map, then a lesson
// with no steps in the app; a-7 has an item that runs only on r.
function checkOnlyCard(id = 'a-7') {
  const d = driver();
  d.key('enter');
  d.key('m');
  mapTo(d, id);
  at(d, { type: 'key', name: 'enter' });
  assert.deepEqual([d.state.view, d.state.lesson], ['checkonly', id]);
  return d;
}

test('the check-only card, which watches its lesson\'s check while the learner follows the lesson page: Pip blinks and looks to the side as on a step card that watches, at 60x20, 80x24 and 120x40, and holds still while r\'s run goes', () => {
  const d = checkOnlyCard();
  const s = d.state;
  assert.ok(watching(s)?.check, 'it watches its lesson\'s check');
  const q = ambientOpened(s);
  for (const size of [[60, 20], [80, 24], [120, 40]]) {
    const where = `${size.join('x')}`;
    const own = cardFaceOf(restOf(s, size));
    const still = frameAt(s, q, -40, size);
    assert.equal(cardFaceOf(still), own, `${where}, before the gates open`);
    for (const [ms, face] of LIFE) {
      const frame = frameAt(s, q, ms, size);
      assert.equal(cardFaceOf(frame), face ?? own, `${where}, +${ms} ms`);
      assert.deepEqual(withoutBorder(frame), withoutBorder(still), `${where}, +${ms} ms`);
    }
  }
  // r runs the check: the checking face and the spinner own the card, and
  // no frame waits for a blink or a look.
  d.send({ type: 'tick', wait: q + 30_000 - d.now });
  d.key('r');
  assert.ok(d.state.checkOnlyRun, 'r runs the check');
  const run = at(d, { type: 'run-start' }).now;
  const busy = d.state;
  for (let t = run + TIMING.keyQuiet; t < run + 40_000; t += TIMING.grid) {
    const p = phases(busy, t, ON);
    assert.ok(!p.blink && !p.peek, `r's run, +${t - run} ms`);
  }
  for (const ms of [5_000, 14_000]) assert.ok(nextChange(busy, run + ms, ON) <= TIMING.slowTick, 'only the spinner\'s ticks');
});

test('no ambient loop on any screen beside a question, its options, a typed answer, the hint box or an overlay, however long it waits', () => {
  const reading = still.filter(([, s]) => s.overlay || (s.view === 'step' && s.beat && !isDone(s.beat) && (Boolean(beatOf(s).ask) || s.beat.rung >= 0 || s.beat.confirm)));
  assert.ok(reading.length > 100, String(reading.length));
  for (const [label, s] of reading) {
    // A file change too, where the screen watches something.
    const changedToo = watching(s) ? reduce(s, { type: 'activity', now: s.now + 1 }).state : s;
    for (const x of [s, changedToo]) {
      for (const ms of [5_000, 21_000, 25_000, 60_000]) {
        const p = phases(x, x.now + ms, ON);
        assert.deepEqual([p.ambient, p.look, p.blink, p.peek], [false, null, false, false], `${label}, +${ms} ms`);
        if (ms === 25_000) assert.equal(frameAt(x, x.now, ms).at(-2), restOf(x).at(-2), `${label}, +${ms} ms`);
      }
    }
  }
});

test('Pip tells the truth: the checking face only while the card says "Checking", and a glance only where a file change was seen or, on a card that watches, as its look to the side', () => {
  let checking = 0;
  for (const [cols, rows] of SIZES) {
    for (const [label, s] of screens) {
      const { times, frames, rest } = sampled(s, cols, rows);
      [...frames, rest].forEach((f, k) => {
        const where = `${label} at ${cols}x${rows}, ${times[k] ?? 'rest'}`;
        const pip = strip(f[4] ?? '');
        if (pip.includes('[◒─◒]')) {
          checking += 1;
          assert.equal(s.beat?.status, 'opening', where);
        }
        // On a card that watches, Pip also looks that way now and then
        // (189), as its look to the side.
        if (pip.includes('[◑‿◑]')) assert.ok(watching(s) && (s.fx.activity !== undefined || phases(s, times[k], ON).peek), where);
      });
    }
  }
  assert.ok(checking > 100, String(checking));
});

test('elapsed seconds: on a slow check, from 3 s of the real child start, in 1 s steps, only while opening', () => {
  const label = '  │  Checking .practice/version.txt…';
  // r on a waiting card, with its run queued behind another for 1 s: the
  // seconds count from when r's own child started.
  const { d } = opened('W3');
  at(d, { type: 'check', lesson: 'b-1', items: [b1Item(null)], wait: 200 });
  at(d, { type: 'key', name: 'r', ch: 'r', wait: 5_000 });
  at(d, { type: 'flush', wait: DEFER_MS + 50 });
  assert.equal(d.state.beat.status, 'opening');
  const run = at(d, { type: 'run-start', wait: 1_000 }).now;
  const f = (ms) => statusRow(frameAt(d.state, run, ms));
  assert.match(f(2_990), /…\s\S$/u, 'under 3 s: no seconds');
  assert.equal(f(3_000), `${label} ⠴  3 s`, '+3 s');
  assert.match(f(3_990), /… \S {2}3 s$/u, 'whole seconds');
  assert.match(f(4_000), /… \S {2}4 s$/u);
  assert.equal(f(10_000), `${label} ⠸  10 s`, '+10 s');
  assert.match(f(150_000), /… \S {2}150 s$/u, 'the child\'s limit');
  // The result lands: the row is the result at once, with no seconds.
  at(d, { type: 'check', lesson: 'b-1', items: [b1Item(null)], asked: d.state.beat.asked, wait: 4_000 });
  assert.notEqual(d.state.beat.status, 'opening');
  assert.equal(statusRow(frameAt(d.state, run, 4_040)), undefined);
  // At 60x20 the longest label, with the spinner and its seconds, fits, and
  // so does the rest of the frame: every "Checking" card, not the sample
  // the frame tests above draw.
  const at60 = (s, ms) => render(s, { cols: 60, rows: 20 }, MOVING, { at: s.fx.run + ms }).map(strip);
  // A beat that reads a file runs no child, so it counts no seconds.
  const spinning = still.filter(([, x]) => x.view === 'step' && x.beat?.status === 'opening' && !READS.has(beatOfVerify(x)));
  assert.ok(spinning.length > 20, String(spinning.length));
  for (const [label, s] of spinning) {
    const moving = reduce(s, { type: 'run-start', now: s.now + 200 }).state;
    const frame = at60(moving, 150_000);
    assert.equal(frame.length, 20, label);
    for (const line of frame) assert.ok(width(line) <= 59, `${label}: ${line}`);
    assert.match(frame.find((l) => l.includes('Checking')), /… \S {2}150 s$/u, label);
  }
});

test('one-shots end: 1.2 s after the last one starts (Pip\'s greeting 5 s, its look around 2.4 s), no frame is asked for unless a loop may then draw', () => {
  for (const [label, s] of screens) {
    const starts = Object.entries(shotStarts(s)).filter(([, x]) => x !== undefined);
    if (!starts.length) continue;
    const at = Math.max(...starts.map(([part, start]) => start + Math.max(TIMING[part], 1_200)));
    const p = phases(s, at, ON);
    for (const part of Object.keys(shotStarts(s))) assert.equal(p[part], 1, `${label}: ${part}`);
    const wait = nextChange(s, at, ON);
    if (wait === null) continue;
    const then = phases(s, at + wait, ON);
    assert.ok(then.ambient || then.spinner !== null, `${label}: a frame in ${wait} ms, and no loop then`);
  }
});

// The rows that changed from one frame to the next, as runs of rows: a run
// is one moving part, so a step done's trail and rule (rows 2 and 3) are its
// header, one part, as design 2.3 counts them. A run would hide two parts
// that touch, so `cuts` holds the rows where a part starts right under
// another: on the complete screen, Pip's top row, under the confetti.
const movingParts = (a, b, cuts) => a.reduce((n, line, i) => (line !== b[i] && (i === 0 || cuts.has(i) || a[i - 1] === b[i - 1]) ? n + 1 : n), 0);
const partCuts = (s, rest) => new Set(s.view === 'complete' ? [rest.findIndex((l) => /^ +●$/.test(strip(l).trimEnd()))].filter((i) => i > 0) : []);

test('little at once: at most one loop, and at most three moving parts from one frame to the next', () => {
  for (const [cols, rows] of SIZES) {
    for (const [label, s] of screens) {
      const drawnFrames = sampled(s, cols, rows);
      const { times } = drawnFrames;
      if (!times.length) continue;
      const frames = [...drawnFrames.frames, drawnFrames.rest];
      const cuts = partCuts(s, drawnFrames.rest);
      if (s.view === 'complete' && cols === 80) assert.equal(cuts.size, 1, `${label}: Pip's top row`);
      frames.slice(1).forEach((f, k) => {
        const where = `${label} at ${cols}x${rows}, +${(times[k + 1] ?? Infinity) - s.fx.view} ms from the view`;
        // The spinner and the bounce are one loop, on one clock: one moving
        // part. A beat that opens on a check starts its child as the card
        // enters, so at +160 ms the entrance ends (the trail's stop and Pip)
        // as the spinner and the bounce start.
        const status = f.findIndex((l) => l.includes('Checking'));
        const loop = status >= 0 && f[status] !== frames[k][status] && f.at(-2) !== frames[k].at(-2) ? 1 : 0;
        const n = movingParts(frames[k], f, cuts) - loop;
        assert.ok(n <= 3, `${where}: ${n} parts move\n${f.map((l, i) => (l !== frames[k][i] ? `${i + 1}: ${strip(frames[k][i])}\n${i + 1}: ${strip(l)}` : '')).filter(Boolean).join('\n')}`);
      });
      for (const at of times) {
        const p = phases(s, at, ON);
        assert.ok([p.spinner !== null, p.ambient].filter(Boolean).length <= 1, `${label}: two loops at ${at}`);
      }
    }
  }
});

// A key at `at`, and a held letter's flush after it.
const reduceKey = (s, at, name, ch) => {
  const next = reduce(s, { type: 'key', name, ch, now: at }).state;
  return ch ? reduce(next, { type: 'flush', now: at + DEFER_MS + 50 }).state : next;
};

test('a key ends every one-shot but the one it started, and still does its job', () => {
  // Up, 40 ms into a one-shot: the next frame, and the one at `ms` where it
  // would have moved, are the rest frame of what the key left.
  const after = (s, start, ms = 80) => {
    const sent = reduceKey(s, start + 40, 'up');
    for (const at of new Set([80, ms])) assert.deepEqual(frameAt(sent, start, at), restOf(sent), `${s.view}: the frame +${at} ms, after the key`);
    return sent;
  };
  // Resume's Pip starts awake, its rest face: it first moves when it looks left.
  for (const [label, from, ms = 0] of [['welcome', 'view'], ['resume', 'view', faceMoments(greetFace('resume'), TIMING.greet)[0]], ['W5', 'open'], ['W3 not yet', 'text'], ['W3 done', 'passLast'], ['C check', 'pass'], ['level up hinted', 'view'], ['complete', 'view']]) {
    const s = screen(label);
    assert.notDeepEqual(frameAt(s, s.fx[from], ms), restOf(s), `${label} plays at +${ms} ms`);
    after(s, s.fx[from], ms);
  }
  // Up on a question moves the cursor, and ends the entrance.
  const q = screen('W5');
  assert.equal(after(q, q.fx.open).cursor, 3);
  // The key that started a one-shot does not end it: enter opens a card, a
  // right pick hops or cheers.
  const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W2', beat: 0 } } } });
  d.send({ type: 'key', name: 'enter', wait: 7 });
  assert.notDeepEqual(frameAt(d.state, d.now, 40), restOf(d.state), 'the entrance enter started');
  d.send({ type: 'key', name: '1', ch: '1', wait: 400 });
  assert.equal(d.state.beat.feedback.kind, 'right');
  assert.equal(frameAt(d.state, d.now, 40)[4].slice(-9, -2), '+[^‿^]+', 'the cheer the right pick started');
  // enter and g work while the level-up plays (133).
  const up = screen('level up hinted');
  assert.equal(reduceKey(up, up.fx.view + 100, 'enter').view, 'step');
  assert.ok(reduceKey(up, up.fx.view + 100, 'g', 'g').progress['b-1'].moreHelpAt);
});

// Pip's face and the burst's art, every 40 ms for 1.2 s from `start`.
function cheerOf(s, start) {
  return Array.from({ length: 31 }, (_, k) => {
    const f = frameAt(s, start, 40 * k);
    const at = f.findIndex((l) => / done!$/.test(l));
    return [f[4].slice(-9, -2), ...f.slice(at, at + 3).map((l) => l.slice(5, 26))];
  });
}
// Lesson 1 from a saved place, at W3, which passes after `before(d)`.
function passW3(before = () => {}, saved = {}) {
  const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W3', beat: 0, ...saved } } } });
  d.key('enter');
  d.send({ type: 'check', lesson: 'b-1', items: [b1Item(null)] });
  before(d);
  d.send({ type: 'check', lesson: 'b-1', items: [b1Item('2.1.285 (Claude Code)\n')], read: Buffer.from('2.1.285 (Claude Code)\n') });
  assert.equal(d.state.beat.status, 'done');
  return d.state;
}

test('Pip tells the truth: the same cheer with and without hints, the bottom rung, an ease or less help; the same face for every guess', () => {
  const plain = passW3();
  const cheer = cheerOf(plain, plain.fx.passLast);
  assert.equal(cheer[0][0], '+[^‿^]+');
  const hints = passW3((d) => {
    d.send({ type: 'check', lesson: 'b-1', items: [b1Item('')] });
    d.key('h');
    d.key('h');
  });
  assert.deepEqual(cheerOf(hints, hints.fx.passLast), cheer, 'with hints');
  const bottom = passW3((d) => {
    d.send({ type: 'check', lesson: 'b-1', items: [b1Item('')] });
    for (let i = 0; i < 8 && !d.state.beat.confirm; i++) d.key('h');
    d.key('y');
  });
  assert.ok(bottom.progress['b-1'].bottomAt !== null);
  assert.deepEqual(cheerOf(bottom, bottom.fx.passLast), cheer, 'the bottom rung');
  const less = passW3(() => {}, { lessHelp: true });
  assert.equal(less.progress['b-1'].lessHelp, true);
  assert.notEqual(tierOf(less), tierOf(plain));
  assert.deepEqual(cheerOf(less, less.fx.passLast), cheer, 'less help');
  // Y1, eased by the bottom rung at W3, against Y1 as it stands: its check
  // already passes when it opens.
  const easy = screen('Y1 already');
  assert.equal(tierOf(easy), 'guided');
  const y1 = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'Y1', beat: 0 } } } });
  y1.key('enter');
  y1.send({ type: 'check', lesson: 'b-1', items: [b1Item('2.1.285 (Claude Code)\n')] });
  const hard = y1.state;
  assert.notEqual(tierOf(hard), 'guided');
  assert.equal(hard.beat.status, 'already');
  assert.deepEqual(cheerOf(easy, easy.fx.passLast), cheerOf(hard, hard.fx.passLast), 'an ease');
  assert.deepEqual(cheerOf(hard, hard.fx.passLast).map((x) => x[0]), cheer.map((x) => x[0]), 'Y1 cheers as W3 does');
  // b-2 W1 ends on a guess: every guess cheers the same.
  const guess = (pick) => {
    const g = driver({ course, saved: { format: 1, welcomed: true, lessons: { 'b-2': { step: 'W1', beat: 1, warm: [] } } } });
    g.key('enter');
    g.send({ type: 'key', name: pick, ch: pick, wait: 400 });
    return faces(g.state, g.now);
  };
  assert.deepEqual(guess('2'), guess('1'));
  assert.deepEqual(guess('1'), cheer.map((x) => x[0]));
});

test('render, motion, art and flow read no clock and pick nothing at random', () => {
  for (const f of ['render.mjs', 'motion.mjs', 'art.mjs', 'flow.mjs', 'pip/pip.mjs']) {
    // Pip's package says in a comment that it uses no Math.random(): its
    // code, without the comments, is what is read.
    const raw = readFileSync(join(root, 'learn', 'lib', f), 'utf8');
    const src = f === 'pip/pip.mjs' ? raw.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '') : raw;
    for (const bad of [/Math\.random/, /Date\.now/, /performance\.now/, /new Date\b/]) assert.doesNotMatch(src, bad, `${f}: ${bad}`);
  }
});

// The screen writer (design 4.5), on an output stream and a clock the test
// holds. A frame is 24 rows of plain text here.
const page = (mark = '', at = -1) => Array.from({ length: 24 }, (_, i) => `row ${i + 1}${i === at ? mark : ''}`);
// `offs` counts the calls to onMotionOff.
const writer = (motion) => {
  const out = fakeOut();
  const clock = fakeClock();
  const w = { out, clock, offs: 0, bytes: () => out.writes.join('') };
  w.screen = openScreen(out, { motion, clock: clock.now, onMotionOff: () => { w.offs += 1; } });
  out.writes.length = 0;
  return w;
};

test('screen writer: an identical frame writes nothing, with motion on or off', () => {
  for (const motion of [true, false]) {
    const { out, screen } = writer(motion);
    screen.draw(page());
    assert.equal(out.writes.length, 1, 'the first frame');
    screen.draw(page());
    screen.draw(page());
    assert.equal(out.writes.length, 1, `motion ${motion}: the same frame again writes nothing`);
  }
});

test('screen writer: a still screen still gets one full frame every 10 s, so stray output is repaired', async () => {
  for (const motion of [true, false]) {
    const { out, clock, screen, bytes } = writer(motion);
    screen.draw(page());
    out.writes.length = 0;
    await clock.advance(9_999);
    screen.draw(page());
    assert.equal(out.writes.length, 0, 'before 10 s, nothing');
    await clock.advance(1);
    screen.draw(page());
    assert.equal(out.writes.length, 1, `motion ${motion}: at 10 s, a frame`);
    assert.ok(bytes().includes('\x1b[H'), 'a full frame, from home');
    const model = screenModel(80, 24);
    model.feed(bytes());
    assert.deepEqual(model.lines(), page());
    out.writes.length = 0;
    await clock.advance(5_000);
    screen.draw(page());
    assert.equal(out.writes.length, 0, 'the 10 s count starts again from that frame');
  }
});

// A frame for a deadline (main's `repair: false`) is for motion: one that
// changes no row repairs nothing either, so the refresh waits for the next
// frame, which an event draws within a second (181).
test('screen writer: a deadline\'s frame that changes no row writes nothing, even with the 10 s refresh due; the next frame repairs the screen', async () => {
  for (const motion of [true, false]) {
    const { out, clock, screen, bytes } = writer(motion);
    screen.draw(page());
    out.writes.length = 0;
    await clock.advance(10_000);
    assert.equal(screen.draw(page(), { repair: false }), false, `motion ${motion}: no write`);
    assert.equal(out.writes.length, 0);
    screen.draw(page());
    assert.equal(out.writes.length, 1, `motion ${motion}: the next frame refreshes`);
    assert.ok(bytes().includes('\x1b[H'), 'a full frame, from home');
    out.writes.length = 0;
    await clock.advance(10_000);
    screen.draw(page(' changed', 6), { repair: false });
    assert.ok(bytes().includes('\x1b[H'), `motion ${motion}: a deadline's frame that changes a row is full once the refresh is due`);
  }
});

// The rows a write moves the cursor to, 1-based, and whether it starts from home.
const rowsWritten = (bytes) => [...bytes.matchAll(/\x1b\[(\d+);1H/g)].map((m) => Number(m[1]));
const fromHome = (bytes) => bytes.includes('\x1b[H');

test('screen writer: with motion on, a one-row change writes that row alone, in one synchronized write', () => {
  const { out, screen, bytes } = writer(true);
  const model = screenModel(80, 24);
  screen.draw(page());
  model.feed(bytes());
  out.writes.length = 0;
  screen.draw(page(' changed', 6));
  assert.equal(out.writes.length, 1);
  const w = bytes();
  assert.deepEqual(rowsWritten(w), [7]);
  assert.equal(fromHome(w), false, 'no full frame');
  assert.ok(w.startsWith('\x1b[?2026h') && w.endsWith('\x1b[?2026l'), 'inside synchronized output');
  model.feed(w);
  assert.deepEqual(model.lines(), page(' changed', 6), 'the terminal shows the new frame');
});

test('screen writer: with motion off, a one-row change is a full frame, as today', () => {
  const { out, screen, bytes } = writer(false);
  screen.draw(page());
  out.writes.length = 0;
  screen.draw(page(' changed', 6));
  assert.equal(fromHome(bytes()), true);
  assert.deepEqual(rowsWritten(bytes()), []);
});

test('screen writer: when more than half the rows changed, a full frame goes out', () => {
  const { out, screen, bytes } = writer(true);
  const model = screenModel(80, 24);
  screen.draw(page());
  model.feed(bytes());
  const half = page().map((l, i) => (i < 12 ? `${l} x` : l));
  out.writes.length = 0;
  screen.draw(half);
  assert.equal(rowsWritten(bytes()).length, 12, 'half the rows: a row-diff');
  model.feed(bytes());
  const more = half.map((l, i) => (i < 13 ? `${l} y` : l));
  out.writes.length = 0;
  screen.draw(more);
  assert.equal(fromHome(bytes()), true, '13 of 24: a full frame');
  model.feed(bytes());
  assert.deepEqual(model.lines(), more);
});

test('screen writer: after clear(), the next frame is a full one, even the same frame', () => {
  for (const motion of [true, false]) {
    const { out, screen, bytes } = writer(motion);
    const model = screenModel(80, 24);
    screen.draw(page());
    model.feed(bytes());
    out.writes.length = 0;
    screen.clear();
    assert.equal(out.writes.length, 0, 'clear() itself writes nothing');
    screen.draw(page());
    assert.equal(fromHome(out.writes.at(-1) ?? ''), true, `motion ${motion}: the same frame, whole`);
    assert.ok(bytes().startsWith('\x1b[?2026h\x1b[2J\x1b[H'), 'and it clears the screen first, inside the synchronized write');
    model.feed(bytes());
    assert.deepEqual(model.lines(), page());
    out.writes.length = 0;
    screen.draw(page(' changed', 3));
    assert.doesNotMatch(bytes(), /\x1b\[2J/, 'the frame after it clears nothing');
    out.writes.length = 0;
    screen.clear();
    screen.draw(page(' changed', 6));
    assert.equal(fromHome(out.writes.at(-1) ?? ''), true, `motion ${motion}: a one-row change after clear(), whole`);
  }
});

test('screen writer: while a write is pending, only the newest frame is kept, and it goes out on drain', () => {
  for (const motion of [true, false]) {
    const { out, clock, screen, bytes } = writer(motion);
    const model = screenModel(80, 24);
    out.full = true;
    screen.draw(page());
    assert.equal(out.writes.length, 1, 'the write that came back false');
    assert.equal(screen.wroteAt, clock.now(), 'wroteAt: when the last write began');
    screen.draw(page(' a', 3));
    screen.draw(page(' b', 3));
    screen.draw(page(' c', 5));
    assert.equal(out.writes.length, 1, `motion ${motion}: nothing more while it is pending`);
    clock.spend(30);
    out.drain();
    assert.equal(out.writes.length, 2, 'one frame on drain');
    assert.equal(screen.wroteAt, clock.now(), 'the drain write is the last write now');
    model.feed(bytes());
    assert.deepEqual(model.lines(), page(' c', 5), 'the newest');
    out.drain();
    assert.equal(out.writes.length, 2, 'a second drain writes nothing');
  }
});

// A writer whose writes take `cost(n)` ms on the fake clock, n counting from 1.
const slowWriter = (cost) => {
  const w = writer(true);
  const write = w.out.write;
  let n = 0;
  w.out.write = (chunk) => {
    n += 1;
    w.clock.spend(cost(n));
    return write(chunk);
  };
  return w;
};

test('screen writer: when 3 of the last 10 motion frames took over 12 ms, motion stops for the sitting', () => {
  // Frame n is page(n): each a one-row change from the one before.
  const frames = (screen, from, to) => { for (let n = from; n <= to; n++) screen.draw(page(` ${n}`, n % 24)); };
  const two = slowWriter((n) => (n === 1 || n === 5 ? 13 : 12));
  frames(two.screen, 1, 20);
  assert.equal(two.screen.motion, true, 'two slow frames, and 12 ms is not over 12');
  const apart = slowWriter((n) => ([1, 5, 12].includes(n) ? 13 : 1));
  frames(apart.screen, 1, 20);
  assert.equal(apart.screen.motion, true, 'frames 1 and 12 are 11 apart: never 3 in 10');
  const three = slowWriter((n) => ([2, 6, 11].includes(n) ? 20 : 1));
  frames(three.screen, 1, 10);
  assert.equal(three.screen.motion, true, 'two so far');
  assert.equal(three.offs, 0);
  frames(three.screen, 11, 11);
  assert.equal(three.screen.motion, false, 'frames 2, 6 and 11 are in the last 10');
  assert.equal(three.offs, 1, 'onMotionOff, so the rest frame can go up');
  three.out.writes.length = 0;
  frames(three.screen, 12, 12);
  assert.equal(fromHome(three.bytes()), true, 'after that, every frame is full');
  frames(three.screen, 13, 40);
  assert.equal(three.screen.motion, false, 'for the sitting');
  assert.equal(three.offs, 1, 'and only once');
});

test('screen writer: a drain over 100 ms twice in 10 s stops motion; one false write does not', async () => {
  // A frame whose write comes back false, then a drain `ms` later.
  const backlog = async (w, n, ms) => {
    w.out.full = true;
    w.screen.draw(page(` ${n}`, n));
    await w.clock.advance(ms);
    w.out.drain();
  };
  const once = writer(true);
  await backlog(once, 1, 400);
  assert.equal(once.screen.motion, true, 'one slow drain is a sample, not a trend');
  await once.clock.advance(4_000);
  await backlog(once, 2, 90);
  assert.equal(once.screen.motion, true, 'a drain of 90 ms is not slow');
  await once.clock.advance(6_000);
  await backlog(once, 3, 150);
  assert.equal(once.screen.motion, true, 'the slow drains are over 10 s apart');
  await once.clock.advance(3_000);
  assert.equal(once.offs, 0);
  await backlog(once, 4, 101);
  assert.equal(once.screen.motion, false, 'two slow drains within 10 s');
  assert.equal(once.offs, 1, 'onMotionOff, so the rest frame can go up');
  once.out.writes.length = 0;
  once.screen.draw(page(' 5', 5));
  assert.equal(fromHome(once.bytes()), true, 'after that, every frame is full');
});

test('your card appears whole in the frame after c and holds still: over a running check, nothing moves and no frame is asked for', () => {
  const { d, run } = checkingW3();
  assert.notDeepEqual(frameAt(d.state, run, 160), restOf(d.state), 'the check spins behind it');
  const held = reduce(d.state, { type: 'key', name: 'c', ch: 'c', now: run + 200 }).state;
  const card = reduce(held, { type: 'flush', now: run + 200 + DEFER_MS + 50 }).state;
  assert.equal(card.overlay, 'card');
  const rest = restOf(card);
  assert.ok(rest.includes(`  ${C.cardTitle}`), rest.join('\n'));
  for (const ms of [0, 40, 160, 1_000, 6_000]) assert.deepEqual(frameAt(card, run, ms), rest, `+${ms} ms`);
  assert.equal(nextChange(card, run + 300, ON), null);
  // A press of the arrows draws the next place whole, still.
  const down = reduce(card, { type: 'key', name: 'down', now: run + 2_000 }).state;
  for (const ms of [0, 40, 160]) assert.deepEqual(frameAt(down, run + 2_000, ms), restOf(down), `down, +${ms} ms`);
});

test('recall, then compare: the entries are whole in the first frame after space, and nothing moves while they show', () => {
  const d = driver({ course, saved: { format: 1, welcomed: true, lessons: finishedBefore('b-4') } });
  playUntil(d, (s) => s.view === 'next' && s.lesson === 'b-4');
  const at = d.now;
  const shown = reduce(d.state, { type: 'key', name: 'space', ch: ' ', now: at }).state;
  assert.equal(shown.overlay, 'compare');
  const rest = restOf(shown);
  // Every command and its quote, whole, with no row revealed after another.
  for (const show of ['/context', '/compact', '/rewind', '/clear', '/resume', 'claude --continue']) assert.ok(rest.some((l) => l.trimStart().startsWith(show) && /^\s+"/.test(l.trimStart().slice(show.length))), `${show}\n${rest.join('\n')}`);
  for (const size of [[60, 20], [80, 24]]) {
    for (const ms of [0, 40, 160, 1_000, 6_000]) assert.deepEqual(frameAt(shown, at, ms, size), restOf(shown, size), `${size.join('x')}, +${ms} ms`);
  }
  assert.equal(nextChange(shown, at + 1, ON), null);
});

// The boot frame (162): git's first answers at start take over 150 ms. Pip
// sits where the welcome has it, beside the app's line; `since` is when the
// app asked git.
const SINCE = 1_000_000;
const bootAt = (ms, [cols, rows] = [80, 24], t = MOVING) => bootFrame(SINCE, { cols, rows }, t, ms === null ? REST : { at: SINCE + ms }).map((l) => strip(l).trimEnd());
const BOOT_ROW = (eyes) => `   │  ${eyes}  │   Asking git about this folder…`;

test('the boot frame at rest, as calm draws it: Pip awake beside "Asking git about this folder…", no spinner', () => {
  const rule = `  ${'─'.repeat(76)}`;
  assert.deepEqual(bootAt(null), [
    '   LEARN   Claude Code practice', '', rule, '',
    '       ●', '   ╭───┴───╮', BOOT_ROW('●‿●'), '   ╰───────╯',
    ...Array(14).fill(''), rule, '',
  ]);
  for (const [cols, rows] of SIZES) {
    const size = { cols, rows };
    for (const [name, caps] of Object.entries(MOTION)) {
      const calm = theme({ ...caps, motion: false, calm: true });
      assert.deepEqual(bootFrame(SINCE, size, theme({ ...caps, motion: true, calm: false }), REST), bootFrame(SINCE, size, calm), `rest is calm, ${name} at ${cols}x${rows}`);
      for (const ms of [160, 240, 320, 3_000, 12_000]) assert.deepEqual(bootFrame(SINCE, size, calm, { at: SINCE + ms }), bootFrame(SINCE, size, calm, REST), `${name} at ${cols}x${rows}, +${ms} ms`);
    }
    // Every mode without motion shows the words still, with no spinner.
    for (const [mode, env] of Object.entries({ NO_COLOR: { ...ENV, NO_COLOR: '1' }, LEARN_PLAIN: { ...ENV, LEARN_PLAIN: '1' }, 'no Unicode': { TERM: 'linux' }, 'TERM=dumb': { TERM: 'dumb' } })) {
      const t = theme(capabilities(tty(), env, 'linux', []));
      const rest = bootFrame(SINCE, size, t, REST);
      assert.match(strip(rest[6]), /Asking git about this folder(…|\.\.\.)$/, `${mode} at ${cols}x${rows}`);
      for (const ms of [160, 240, 3_000]) assert.deepEqual(bootFrame(SINCE, size, t, { at: SINCE + ms }), rest, `${mode} at ${cols}x${rows}, +${ms} ms`);
    }
  }
});

test('the boot frame with motion: it opens on the spinner\'s first tick with Pip\'s eyes shut, Pip wakes as on the welcome, and the spinner and bounce run until git answers', () => {
  // 150 ms is off the 40 ms grid: the frame goes up at 160, as a check's spinner does.
  assert.equal(BOOT_FROM, 160);
  const f = (ms) => bootAt(ms);
  assert.deepEqual([f(160)[6], f(160).at(-2)], [`${BOOT_ROW('─‿─')} ⠋`, pulse(0, 10)], '+160 ms: eyes shut, the spinner and the bounce start');
  assert.deepEqual(f(200), f(160), 'one frame on the grid until +240 ms');
  // To the last moment before +240 ms the spinner and the bounce hold, and
  // every row but Pip's. Its eyes open from shut at +200 ms to the half-lid
  // at +240 ms, interpolated between (181), so between those steps they are
  // already the half-lid's glyph, which no 40 ms frame shows before +240.
  assert.deepEqual(f(239).filter((_, i) => i !== 6), f(160).filter((_, i) => i !== 6), '+239 ms: every other row as at +160');
  assert.equal(f(239)[6], `${BOOT_ROW('◒‿◒')} ⠋`, '+239 ms: the spinner holds');
  assert.deepEqual([f(240)[6], f(240).at(-2)], [`${BOOT_ROW('◒‿◒')} ⠙`, pulse(4, 10)], '+240 ms: waking');
  assert.deepEqual([f(320)[6], f(320).at(-2)], [`${BOOT_ROW('●‿●')} ⠹`, pulse(8, 10)], '+320 ms: awake');
  for (let ms = 320; ms < 3_000; ms += 40) assert.match(f(ms)[6], /^ {3}│ {2}●‿● {2}│/, `+${ms} ms: Pip stays awake`);
  // From 3 s the seconds git has run, as on a slow check; slower after 10 s.
  assert.equal(f(3_000)[6], `${BOOT_ROW('●‿●')} ⠴  3 s`);
  assert.equal(f(12_000)[6].replace(/ \S {2}\d+ s$/, ''), BOOT_ROW('●‿●'));
  assert.match(f(12_000)[6], / {2}12 s$/);
  // Only rows 7 and 23 ever move.
  const rest = bootAt(null);
  for (const ms of [160, 240, 320, 3_000, 12_000]) assert.deepEqual(f(ms).flatMap((l, i) => (l === rest[i] ? [] : [i + 1])).filter((r) => r !== 7 && r !== 23), [], `+${ms} ms`);
  // The frames it asks for land on the 40 ms grid from git's start.
  const due = [];
  for (let ms = BOOT_FROM; ms < 12_000; ms += bootChange(SINCE, SINCE + ms, ON)) due.push(ms);
  assert.deepEqual(due.filter((ms) => ms % TIMING.grid), [], 'off the grid');
  assert.deepEqual(due.slice(0, 4), [160, 240, 320, 400]);
  assert.deepEqual(due.filter((ms) => ms > 2_900 && ms < 3_100), [2_960, 3_000, 3_040], 'the seconds, between two ticks');
  assert.deepEqual(due.filter((ms) => ms >= 9_920 && ms < 10_500), [9_920, 10_000, 10_240, 10_480]);
  assert.equal(bootChange(SINCE, SINCE + 200, OFF), null, 'none with motion off');
  // At 60x20 the same, in the same rows, on a 56-cell rule.
  const small = bootAt(240, [60, 20]);
  assert.equal(small[6], `${BOOT_ROW('◒‿◒')} ⠙`);
  assert.equal(small.at(-2), pulse(4, 10, 56));
});

test('the boot frame fits in every mode: exactly the window, no line too wide, one emoji at most, its words in place in every frame, at most three moving parts', () => {
  const themes = {
    ...Object.fromEntries(Object.entries(MOTION).map(([name, caps]) => [name, theme({ ...caps, motion: true, calm: false })])),
    ASCII: theme(capabilities(tty(), { ...ENV, LEARN_PLAIN: '1' }, 'linux', [])),
  };
  const times = [160, 200, 240, 280, 320, 400, 3_000, 3_040, 10_000, 10_240, 29_990];
  for (const [name, t] of Object.entries(themes)) {
    for (const [cols, rows] of [...SIZES, [120, 40]]) {
      const size = { cols, rows };
      const rest = bootFrame(SINCE, size, t, REST);
      const frames = times.map((ms) => bootFrame(SINCE, size, t, { at: SINCE + ms }));
      [rest, ...frames].forEach((lines, k) => {
        const where = `${name} at ${cols}x${rows}, ${k ? `+${times[k - 1]} ms` : 'rest'}`;
        assert.equal(lines.length, rows, where);
        lines.forEach((line, i) => {
          assert.ok(width(line) <= cols - 1, `${where}, line ${i + 1}: ${strip(line)}`);
          assert.ok(graphemes(strip(line)).filter(isEmoji).length <= 1, `${where}, line ${i + 1}`);
        });
        // The seconds git has run are the one exception, as on a slow check.
        assert.deepEqual(movedWords(lines.map((l) => strip(l).replace(/(… \S) {2}\d+ s$/u, '$1')), rest), [], where);
      });
      frames.slice(1).forEach((f, k) => {
        // The spinner and the bounce are one loop: one moving part.
        const n = movingParts(frames[k], f, new Set()) - (f.at(-2) !== frames[k].at(-2) ? 1 : 0);
        assert.ok(n <= 3, `${name} at ${cols}x${rows}, +${times[k + 1]} ms: ${n} parts move`);
      });
    }
  }
  // Pip's rows are the welcome's at every size, so the welcome takes its place.
  const pipRows = (lines) => lines.flatMap((l, i) => (/│ {2}●‿● {2}│/.test(strip(l)) ? [i] : []));
  for (const [cols, rows] of [...SIZES, [120, 40]]) assert.deepEqual(pipRows(bootFrame(SINCE, { cols, rows }, MOVING)), pipRows(render(driver().state, { cols, rows }, MOVING)), `${cols}x${rows}`);
  assert.match(strip(bootFrame(SINCE, { cols: 60, rows: 20 }, themes.ASCII, REST)[6]), /^ {3}\| {2}o_o {2}\| {3}Asking git about this folder\.\.\.$/);
});

test('phases: a git child for a beat on part of the tree turns the spinner, as a whole-tree git child does', () => {
  for (const verify of ['git-clean secrets/', 'git-changed src/', 'git-only .claude/', 'git-staged']) {
    const d = onReading(verify);
    assert.equal(d.state.beat.status, 'opening', verify);
    const run = at(d, { type: 'run-start', wait: 500 }).now;
    assert.equal(phases(d.state, run + 160, ON).spinner, 0, verify);
    at(d, { ...gitLists(['README.md']), wait: 200 });
    assert.equal(phases(d.state, run + 400, ON).spinner, null, `${verify}: the result landed`);
  }
});

test('a look at part of the tree: a newly staged path is a change, and a whole-tree result the beat does not read is no look', () => {
  const d = onReading('git-staged');
  at(d, gitLists(['src/a.js']));
  at(d, gitLists(['src/a.js']));
  assert.equal(d.state.fx.changed, false);
  at(d, gitLists(['src/a.js'], ['src/a.js']));
  assert.equal(d.state.fx.changed, true, 'the same paths, one now staged');
  const scoped = onReading('git-changed src/');
  at(scoped, gitLists(['README.md']));
  const seen = scoped.state.fx.look;
  at(scoped, { type: 'git', paths: ['src/'] });
  assert.equal(scoped.state.fx.look, seen, 'git listed the folder whole: the beat read nothing');
});
