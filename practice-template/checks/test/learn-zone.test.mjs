// Scripted learners played through the real Beginner lessons with the
// reducer: whatever they do, the help each step gets stays where the design
// puts it, and the screen claims only the help it gives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { C } from '../../learn/lib/copy.mjs';
import { hintAvailable, IDLE_MS, stepOf, stepsOf, tierOf, tiersOf } from '../../learn/lib/flow.mjs';
import { render } from '../../learn/lib/render.mjs';
import { strip } from '../../learn/lib/text.mjs';
import { theme } from '../../learn/lib/theme.mjs';
import { ruleTiers, TIERS } from '../../learn/lib/tiers.mjs';
import { course, driver, failCheck, NEW_COPY, playUntil } from './learn-drive.mjs';

const contents = course.map((l) => l.content);
const rank = (t) => TIERS.indexOf(t);
// The course plan for the steps of a lesson as they are played: a warm-up
// is always CHALLENGE, every other step gets what `ruleTiers` gives it with
// no third argument.
function plan(s) {
  const idx = course.findIndex((l) => l.id === s.lesson);
  return [...s.progress[s.lesson].warm.map(() => 'challenge'), ...ruleTiers(contents, idx)];
}
const where = (s) => `${s.lesson} ${stepOf(s).id}`;
const onStep = (s) => s.view === 'step' || s.view === 'levelup';

// The "more help" line, read off the card as drawn at rest (render has no
// clock) at 80x24, where the line is never dropped.
const FULL = theme({ tty: true, depth: 8, unicode: true, links: false, win32: false });
const flat = (text) => text.replace(/[^A-Za-z0-9]/g, '');
const showsMoreHelp = (s) => flat(render(s, { cols: 80, rows: 24 }, FULL).map(strip).join('')).includes(flat(C.eased));

// The driver, with `look(state)` after every event the learner causes.
const watched = (d, look) => ({
  get state() { return d.state; },
  send: (ev) => { const r = d.send(ev); look(d.state); return r; },
  key: (name, ch) => { const r = d.key(name, ch); look(d.state); return r; },
});

// Plays on as playUntil's learner, one action at a time, calling `atBeat(d)`
// once as each beat opens, until `stop(state)` holds.
function play(d, stop, atBeat) {
  const seen = new Set();
  for (let n = 0; !stop(d.state); n++) {
    if (n > 20_000) throw new Error(`play: stuck at ${d.state.view} ${d.state.lesson} ${stepOf(d.state)?.id}`);
    const s = d.state;
    const at = s.view === 'step' && `${where(s)}.${s.pos.beat}`;
    if (at && !seen.has(at)) {
      seen.add(at);
      atBeat(d);
      if (stop(d.state)) return;
    }
    playUntil(d, (x) => x !== s);
  }
}
// Climbs to the exact command on the beat on screen, where it has one: at
// CHALLENGE, hints open after a try or two quiet minutes.
function exactCommand(d) {
  if (['done', 'already'].includes(d.state.beat.status)) return false;
  failCheck(d);
  if (!hintAvailable(d.state)) d.send({ type: 'tick', wait: IDLE_MS + 1_000 });
  for (let i = 0; i < 8 && hintAvailable(d.state) && !d.state.beat.confirm; i++) d.key('h');
  if (!d.state.beat.confirm) return false;
  d.key('y');
  return true;
}

// The learners. Each starts afresh and calls `look` after every event.
// The end of the last lesson with a lesson file, or the map, where a play
// that has no next lesson to open goes: a lesson with no lesson file before
// it ends the play there.
const last = course.filter((l) => l.content).at(-1).id;
const finale = (s) => (s.lesson === last && s.view === 'complete') || s.view === 'map';
// A learner who plays every lesson in order: one that runs in a new copy
// (a-5) has its folder, as the learner gives it at its intro.
const inOrderDriver = () => driver({ course, saved: { format: 1, folders: Object.fromEntries(course.filter((l) => l.newCopy).map((l) => [l.id, NEW_COPY])) } });
// Every lesson in order, needing no help.
function inOrder(look) {
  playUntil(watched(inOrderDriver(), look), finale);
}
// Every lesson in order, climbing to the exact command on every beat of a
// step that isn't GUIDED. Returns the steps where it was shown.
function exactEverywhere(look) {
  const taken = [];
  play(watched(inOrderDriver(), look), finale, (d) => {
    if (tierOf(d.state) !== 'guided' && exactCommand(d)) taken.push(where(d.state));
  });
  return taken;
}
// A lesson opened from the map with nothing done, played to its end.
// `first(d)` plays the first warm-up, where given; it plays only on a skill
// in `missed`, the skills missed before (194).
function fromMap(id, look, first, missed = []) {
  const d = watched(driver({ course, saved: { format: 1, welcomed: true, missed, lessons: {} } }), look);
  d.key('m');
  while (course[d.state.mapCursor].id !== id) d.key('down');
  d.key('enter');
  assert.deepEqual([d.state.view, d.state.lesson], ['intro', id]);
  d.key('enter');
  first?.(d);
  playUntil(d, (s) => s.lesson === id && s.view === 'complete');
}
const b4FromMap = (look) => fromMap('b-4', look);
// b-2 from the map, R1 (start) answered right the first time.
const b2Recalled = (look) => fromMap('b-2', look, (d) => {
  assert.deepEqual([stepOf(d.state).id, stepOf(d.state).skill], ['R1', 'start']);
}, ['start']);
// b-3 from the map, R1 (plan-mode) typed wrong twice: the ease waits past
// W1, GUIDED on a first meeting, for Y1.
const b3Missed = (look) => fromMap('b-3', look, (d) => {
  assert.deepEqual([stepOf(d.state).id, stepOf(d.state).skill], ['R1', 'plan-mode']);
  for (const word of ['tab', 'tab']) {
    for (const c of word) d.key(c, c);
    d.key('enter');
  }
  assert.deepEqual(d.state.eased, ['plan-mode']);
}, ['plan-mode']);

test('in order, with no hints: every tier equals the course plan', () => {
  const met = new Set();
  inOrder((s) => {
    if (!onStep(s)) return;
    assert.deepEqual(tiersOf(s), plan(s), where(s));
    met.add(where(s));
  });
  const played = course.slice(0, course.findIndex((l) => l.id === last) + 1);
  for (const l of played.filter((x) => x.content)) for (const step of l.content.steps) assert.ok(met.has(`${l.id} ${step.id}`), `${l.id} ${step.id} was met`);
});

test('in order, taking the exact command on every non-guided step: no step ever gets less help than the plan', () => {
  let easier = 0;
  const taken = exactEverywhere((s) => {
    if (!onStep(s)) return;
    const tiers = tiersOf(s);
    plan(s).forEach((t, i) => {
      assert.ok(rank(tiers[i]) <= rank(t), `${s.lesson} ${stepsOf(s)[i].id} at ${where(s)}: ${tiers[i]}, the plan says ${t}`);
      if (rank(tiers[i]) < rank(t)) easier += 1;
    });
  });
  assert.ok(taken.length > 20, `the exact command was shown ${taken.length} times`);
  assert.ok(easier > 0, 'some step got more help than the plan');
});

test('b-4 opened from the map with nothing done: each step gets a first meeting\'s tier, and the Check is CHALLENGE', () => {
  // A first meeting: a worked example is GUIDED, a turn HINTED, the last turn
  // the app checks CHALLENGE. No step is done, and b-4's warm-ups recall no
  // skill b-4 uses, so no b-4 skill was met.
  const first = { W1: 'guided', W2: 'guided', W3: 'guided', W4: 'guided', W5: 'guided', W6: 'guided', W7: 'guided', Y1: 'hinted', Y2: 'hinted', Y3: 'hinted', Y4: 'hinted', Y5: 'challenge', C: 'challenge' };
  const idx = course.findIndex((l) => l.id === 'b-4');
  assert.deepEqual(contents[idx].steps.map((x) => x.id), Object.keys(first));
  assert.deepEqual(ruleTiers(contents, idx, () => false), Object.values(first), 'what ruleTiers gives a first meeting');
  const met = new Set();
  b4FromMap((s) => {
    if (!onStep(s)) return;
    assert.equal(s.lesson, 'b-4');
    const tiers = tiersOf(s);
    stepsOf(s).forEach((step, i) => assert.equal(tiers[i], step.part === 'Warm-up' ? 'challenge' : first[step.id], `${step.id} at ${where(s)}`));
    met.add(stepOf(s).id);
  });
  for (const id of Object.keys(first)) assert.ok(met.has(id), `${id} was met`);
});

test('opened from the map with nothing done: a warm-up right the first time puts its skill on the plan, one missed waits past a GUIDED step', () => {
  // b-2: R1 recalls start, so W1 gets the plan; every other step a first meeting.
  const b2 = course.findIndex((l) => l.id === 'b-2');
  const recalled = ruleTiers(contents, b2, (k, skill) => skill === 'start');
  assert.deepEqual([recalled[0], ruleTiers(contents, b2)[0], ruleTiers(contents, b2, () => false)[0]], ['hinted', 'hinted', 'guided'], 'W1 (start)');
  const met = new Set();
  b2Recalled((s) => {
    if (!onStep(s) || stepOf(s).part === 'Warm-up') return;
    assert.deepEqual(tiersOf(s).slice(s.progress[s.lesson].warm.length), recalled, where(s));
    met.add(stepOf(s).id);
  });
  assert.ok(met.has('W1'));
  // b-3: plan-mode was missed, so W1 stays GUIDED with no line, and Y1, HINTED
  // on a first meeting, takes the ease. The line opens a step's first beat.
  const seen = { W1: new Set(), Y1: new Set() };
  b3Missed((s) => {
    if (s.view === 'step' && s.pos.beat === 0 && seen[stepOf(s).id]) seen[stepOf(s).id].add(`${tierOf(s)} ${showsMoreHelp(s) ? 'with' : 'without'} the line`);
  });
  assert.deepEqual(Object.fromEntries(Object.entries(seen).map(([id, x]) => [id, [...x]])), { W1: ['guided without the line'], Y1: ['guided with the line'] });
});

test('throughout every run: a card with the "more help" line gives one tier more help than it would without the ease', () => {
  const shown = new Set();
  const look = (s) => {
    if (s.view !== 'step' || !showsMoreHelp(s)) return;
    const p = s.progress[s.lesson];
    const { [stepOf(s).id]: _, ...others } = p.easedSteps;
    const without = tiersOf({ ...s, progress: { ...s.progress, [s.lesson]: { ...p, easedSteps: others } } })[s.pos.step];
    assert.equal(rank(tierOf(s)), rank(without) - 1, `${where(s)}: ${tierOf(s)} with the ease, ${without} without`);
    shown.add(where(s));
  };
  inOrder(look);
  b4FromMap(look);
  b2Recalled(look);
  assert.equal(shown.size, 0, `a learner who needed no help saw the line on ${[...shown].join(', ')}`);
  b3Missed(look);
  assert.ok(shown.has('b-3 Y1'), 'the missed warm-up\'s ease landed on Y1');
  exactEverywhere(look);
  assert.ok(shown.size > 5, `the line showed on ${[...shown].join(', ')}`);
});
