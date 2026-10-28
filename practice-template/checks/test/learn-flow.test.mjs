// The learn app's decisions, through its pure reducer: when a step is done,
// what a wrong answer gets, how hints open, how help fades and comes back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerKey, asStarted, backOffered, beatOf, beatShown, cardMood, DEFER_MS, HINT_LOCK_MS, hintAvailable, IDLE_MS, isLastBeat, longWait, moreHelpGives, normalize, pickWarmups, rungsOf, stepNote, stepOf, tearDownLeft, tierOf, tiersOf, watching, whileRunsOf, whileRunsOpen } from '../../learn/lib/flow.mjs';
import { GIT, OWN_PARTS, parseLesson, READS } from '../../learn/lib/content.mjs';
import { snapshot } from '../../learn/lib/store.mjs';
import { judge, stampFor } from '../../learn/lib/holds.mjs';
import { mix, ruleTiers } from '../../learn/lib/tiers.mjs';
import { render } from '../../learn/lib/render.mjs';
import { nextChange, phases, pipGates } from '../../learn/lib/motion.mjs';
import { theme } from '../../learn/lib/theme.mjs';
import { inline, strip, width, wrapRuns } from '../../learn/lib/text.mjs';
import { C } from '../../learn/lib/copy.mjs';
import { statusStamp } from '../../learn/lib/status.mjs';
import { plainProgress } from '../../learn/lib/plain.mjs';
import { b1Item, b1Only, bottomRung, course, courseWith, DEMO_B2, DEMO_I1, DEMO_I1_INDEX, bareExit, driver, FACTS, finished, finishedBefore, gitLists, mapTo, onReading, playUntil, tryNow } from './learn-drive.mjs';

const at = (step, extra = {}) => {
  const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step, beat: 0, ...extra } } }, ...extra.driver });
  d.key('enter');
  return d;
};
// Lesson 1 finished on the path, every step of it done.
const b1Done = finished(course.find((l) => l.id === 'b-1'));
const missing = b1Item(null);
const empty = b1Item('');
const passed = b1Item('2.1.285 (Claude Code)\n');

test('a check step waits, says "not yet" only when something changed, and turns done on a pass', () => {
  const d = at('W3');
  assert.equal(d.state.beat.status, 'opening');
  assert.deepEqual(d.effects.at(-2), { type: 'check', lesson: 'b-1', items: [0], evidence: '.practice/version.txt', dir: FACTS.root });
  d.send({ type: 'check', lesson: 'b-1', items: [missing] });
  assert.equal(d.state.beat.status, 'waiting');
  d.key('enter');
  assert.equal(stepOf(d.state).id, 'W3', 'enter does nothing until the step is done');
  d.send({ type: 'check', lesson: 'b-1', items: [missing] });
  assert.equal(d.state.beat.status, 'waiting', 'the same FAIL as on opening is not "not yet"');
  d.key('r');
  assert.equal(d.state.beat.status, 'opening', 'r shows its run');
  d.send({ type: 'check', lesson: 'b-1', items: [missing], asked: d.state.beat.asked });
  assert.equal(d.state.beat.status, 'fail', 'r asks, so the answer is shown');
  d.send({ type: 'check', lesson: 'b-1', items: [empty] });
  assert.equal(d.state.beat.fail.hint, empty.hint);
  d.send({ type: 'check', lesson: 'b-1', items: [passed], read: Buffer.from('2.1.285 (Claude Code)\n') });
  assert.equal(d.state.beat.status, 'done');
  assert.equal(d.state.beat.evidence, '2.1.285 (Claude Code)');
  assert.equal(watching(d.state), null, 'a done step watches nothing');
  d.key('enter');
  assert.equal(stepOf(d.state).id, 'W4');
});

test('a check that already passes when the step opens counts at once', () => {
  const d = at('Y1', { levels: ['hinted'] });
  d.send({ type: 'check', lesson: 'b-1', items: [passed] });
  assert.equal(d.state.beat.status, 'already');
  const broken = at('W3');
  broken.send({ type: 'check-error', lesson: 'b-1', message: 'it took too long' });
  assert.equal(broken.state.beat.status, 'broken');
});

test('questions: a wrong pick explains, a second reveals; s reveals; a guess is never wrong', () => {
  const d = at('W5');
  d.key('1');
  assert.equal(d.state.beat.status, 'waiting');
  assert.equal(d.state.beat.feedback.kind, 'wrong');
  assert.match(d.state.beat.feedback.because, /header above the prompt/);
  assert.match(d.state.beat.feedback.point, /Login method/);
  d.key('3');
  assert.equal(d.state.beat.status, 'done');
  assert.equal(d.state.beat.revealed, true);
  const s = at('W5');
  s.key('s');
  assert.equal(s.state.beat.revealed, true);
  const other = at('W5');
  other.key('4');
  assert.equal(other.state.beat.status, 'done', '"I saw something different" is never called wrong');
  const stuck = at('W2');
  stuck.key('2');
  assert.equal(stuck.state.beat.status, 'waiting', 'the PATH fix keeps the step open');
  assert.equal(stuck.state.beat.feedback.kind, 'stuck');
  const guess = at('W4');
  guess.key('2');
  assert.equal(guess.state.beat.status, 'done');
  assert.equal(guess.state.progress['b-1'].answers['W4.0'], '**Yes, I trust this folder**');
});

test('a guess revealed later is recalled at its step', () => {
  const d = at('W7');
  d.key('1');
  assert.equal(d.state.beat.status, 'done');
  const y2 = at('Y2', { answers: { 'W7.0': 'Yes, it will ask again' }, levels: ['hinted'] });
  assert.equal(stepOf(y2.state).id, 'Y2');
  assert.equal(y2.state.progress['b-1'].answers['W7.0'], 'Yes, it will ask again');
});

test('typed answers ignore case, spaces and a leading slash; empty enter shows the answer', () => {
  assert.equal(normalize('  /Status '), 'status');
  const d = at('C', { levels: ['hinted', 'challenge'] });
  d.send({ type: 'check', lesson: 'b-1', items: [passed] });
  d.key('enter');
  for (const c of 'STATUS') d.key(c.toLowerCase(), c);
  d.key('enter');
  assert.equal(d.state.beat.status, 'done');
  assert.equal(d.state.beat.feedback.kind, 'right');
  const w = at('C', { levels: ['hinted', 'challenge'] });
  w.send({ type: 'check', lesson: 'b-1', items: [passed] });
  w.key('enter');
  for (const c of '/usage') w.key(c, c);
  w.key('enter');
  assert.match(w.state.beat.feedback.because, /session cost/);
  w.key('enter');
  assert.equal(w.state.beat.revealed, true);
  // q is typed, not quit, while answering.
  const q = at('C', { levels: ['hinted', 'challenge'] });
  q.send({ type: 'check', lesson: 'b-1', items: [passed] });
  q.key('enter');
  const before = q.effects.length;
  q.key('q', 'q');
  assert.equal(q.state.beat.typed, 'q');
  assert.ok(!q.effects.slice(before).some((e) => e.type === 'quit'));
});

test('hints: one rung per press, a 2 second lock, y/n before the exact command, and the skill eases', () => {
  const d = at('W3');
  d.send({ type: 'check', lesson: 'b-1', items: [missing] });
  d.send({ type: 'check', lesson: 'b-1', items: [empty] });
  assert.ok(hintAvailable(d.state));
  const rungs = rungsOf(d.state);
  assert.equal(rungs[0].kind, 'ask');
  assert.match(rungs[0].text, /on its own\?$/, 'the empty-file FAIL gets its own first question');
  assert.equal(rungs.at(-1).kind, 'bottom');
  d.key('h');
  assert.equal(d.state.beat.rung, 0);
  d.send({ type: 'key', name: 'h', wait: 500 });
  assert.equal(d.state.beat.rung, 0, 'h is ignored for 2 seconds after a rung');
  d.send({ type: 'key', name: 'h', wait: 2_100 });
  assert.equal(d.state.beat.rung, 1);
  while (!d.state.beat.confirm) d.send({ type: 'key', name: 'h', wait: 2_100 });
  assert.equal(d.state.beat.rung, rungs.length - 2);
  d.key('n');
  assert.equal(d.state.beat.confirm, false);
  d.send({ type: 'key', name: 'h', wait: 2_100 });
  d.key('y');
  assert.equal(d.state.beat.rung, rungs.length - 1);
  assert.deepEqual(d.state.eased, ['save-version']);
  // Y1 asks for the same skill: it comes back GUIDED, once.
  d.send({ type: 'check', lesson: 'b-1', items: [passed] });
  // W6's first beat has a done-label, so space gives the learner's word there.
  for (const k of ['enter', '1', 'enter', 'space', 'space', '2', 'enter', 'space', '1', 'enter', '2', 'enter', 'space']) d.key(k);
  d.send({ type: 'git', paths: [] });
  d.key('enter');
  assert.equal(stepOf(d.state).id, 'Y1');
  assert.equal(tierOf(d.state), 'guided');
  assert.deepEqual(d.state.eased, []);
});

test('hint gates: CHALLENGE opens hints only after a "not yet" or two quiet minutes', () => {
  const d = at('Y4', { levels: ['hinted', 'challenge'] });
  assert.equal(tierOf(d.state), 'challenge');
  d.send({ type: 'git', paths: [] });
  assert.equal(hintAvailable(d.state), false);
  d.send({ type: 'tick', wait: 121_000 });
  assert.equal(d.state.beat.idle, true);
  assert.equal(hintAvailable(d.state), true);
  const f = at('Y4', { levels: ['hinted', 'challenge'] });
  f.key('space');
  f.send({ type: 'git', paths: ['notes.md'] });
  assert.equal(f.state.beat.status, 'fail');
  assert.equal(hintAvailable(f.state), true);
  f.send({ type: 'git', paths: [] });
  assert.equal(f.state.beat.status, 'done');
});

test('a git step with a done-label decides only after the learner says the session ended', () => {
  const d = at('Y4', { levels: ['hinted', 'challenge'] });
  d.send({ type: 'git', paths: [] });
  assert.equal(d.state.beat.status, 'waiting');
  d.key('space');
  // git runs in the lesson's folder, as every other look does.
  assert.deepEqual(d.effects.at(-1), { type: 'git', dir: FACTS.root });
  d.send({ type: 'git', paths: [] });
  assert.equal(d.state.beat.status, 'done');
  const w7 = at('W7', { beat: 2 });
  assert.equal(stepOf(w7.state).id, 'W7');
  w7.send({ type: 'git', paths: [] });
  assert.equal(w7.state.beat.status, 'done', 'without a done-label the clean tree is enough');
});

test('difficulty: the level-up shows once per tier, "less help" hides the commands, g gives more help', () => {
  const d = at('W7', { beat: 2, done: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'] });
  d.send({ type: 'git', paths: [] });
  d.key('enter');
  assert.equal(d.state.view, 'levelup');
  assert.equal(d.state.levelTo, 'hinted');
  d.key('enter');
  assert.equal(d.state.view, 'step');
  assert.ok(d.state.progress['b-1'].levels.includes('hinted'));
  d.key('b');
  d.key('enter');
  d.send({ type: 'git', paths: [] });
  d.key('enter');
  assert.equal(d.state.view, 'step', 'not twice');

  const less = driver({ saved: { format: 1, welcomed: true } });
  less.key('down');
  less.key('enter');
  assert.equal(less.state.progress['b-1'].lessHelp, true);
  assert.deepEqual(tiersOf(less.state).slice(0, 7), Array(7).fill('hinted'));
  less.key('space');
  less.key('1');
  less.key('enter');
  assert.equal(stepOf(less.state).id, 'W3');
  assert.deepEqual(rungsOf(less.state).at(-1).lines.map((l) => l.text), ['cd <your practice copy>', 'mkdir -p .practice', 'claude --version > .practice/version.txt']);
  // The safety guess stays.
  less.send({ type: 'check', lesson: 'b-1', items: [passed] });
  less.key('enter');
  assert.equal(stepOf(less.state).beats[less.state.pos.beat].kind, 'predict');

  const g = at('W7', { beat: 2 });
  g.send({ type: 'git', paths: [] });
  g.key('enter');
  g.key('g');
  assert.equal(g.state.progress['b-1'].moreHelpAt, 'Y1');
  assert.equal(tierOf(g.state), 'guided');
});

test('a Codespace is credited for the install steps', () => {
  const d = driver({ saved: { format: 1, welcomed: true }, facts: { codespace: true } });
  d.key('enter');
  assert.equal(d.state.beat.status, 'already');
  d.key('enter');
  assert.equal(d.state.beat.status, 'already');
});

test('resume: the saved step opens; unknown steps and lessons are ignored', () => {
  const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'Y3', beat: 0, done: ['W1', 'ZZ'] } } } });
  assert.equal(d.state.view, 'resume');
  assert.deepEqual(d.state.progress['b-1'].done, ['W1']);
  d.key('enter');
  assert.equal(stepOf(d.state).id, 'Y3');
  const gone = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W9' } } } });
  assert.equal(gone.state.view, 'intro');
  const start = driver();
  assert.equal(start.state.view, 'welcome');
});

test('the wrong-window guard: a paste or fast typing shows a toast and does nothing else', () => {
  const d = at('W5');
  const before = d.state.pos;
  d.send({ type: 'paste', text: 'curl -fsSL https://claude.ai/install.sh | bash' });
  assert.equal(d.state.toast.kind, 'stray');
  assert.deepEqual(d.state.pos, before);
  const t = at('W5');
  for (const c of 'clab') t.send({ type: 'key', name: c, ch: c, wait: 100 });
  assert.equal(t.state.toast.kind, 'stray');
  assert.deepEqual(t.state.pos, before, 'the b in a typed command does not go back');
  t.send({ type: 'key', name: 'space', ch: ' ', wait: 100 });
  assert.equal(t.state.beat.answer, null);
});

test('map and check-only mode: a lesson without a content file watches its check', () => {
  const d = driver({ course: b1Only, saved: { format: 1, welcomed: true } });
  d.key('m');
  assert.equal(d.state.view, 'map');
  d.key('down');
  d.key('enter');
  assert.equal(d.state.view, 'checkonly');
  assert.equal(d.state.lesson, 'b-2');
  assert.deepEqual(watching(d.state), { check: { lesson: 'b-2', items: null }, dir: FACTS.root });
  d.key('r');
  assert.deepEqual(d.effects.at(-1), { type: 'check', lesson: 'b-2', items: null, slow: true, dir: FACTS.root });
});

test('review fixes: CHALLENGE hints open after the idle offer', () => {
  const d = at('Y4', { levels: ['hinted', 'challenge'] });
  d.send({ type: 'git', paths: [] });
  d.send({ type: 'tick', wait: 121_000 });
  d.key('h');
  assert.equal(d.state.beat.rung, 0, 'h after the "Stuck?" offer opens the first hint');
});

test('review fixes: an error while a hint is open closes it', () => {
  const d = at('W3');
  d.send({ type: 'check', lesson: 'b-1', items: [missing] });
  d.send({ type: 'check', lesson: 'b-1', items: [empty] });
  d.key('h');
  d.send({ type: 'check-error', lesson: 'b-1', message: 'it took too long' });
  assert.equal(d.state.beat.status, 'broken');
  assert.equal(d.state.beat.rung, -1);
  d.send({ type: 'check', lesson: 'b-1', items: [empty] });
  assert.equal(d.state.beat.status, 'fail', 'a good result clears "broken"');
});

test('review fixes: a saved place past the end of a step opens its first beat', () => {
  const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W5', beat: 3 } } } });
  assert.equal(d.state.progress['b-1'].beat, 0);
  d.key('enter');
  assert.equal(stepOf(d.state).id, 'W5');
  assert.equal(d.state.pos.beat, 0);
});

test('review fixes: a finished lesson stays finished', () => {
  const done = { format: 1, welcomed: true, lessons: { 'b-1': { complete: true, done: ['W1', 'W2'] } } };
  const d = driver({ course: b1Only, saved: done });
  assert.equal(d.state.view, 'map', 'with every lesson in the app done, the app opens on the map');
  assert.equal(d.state.lesson, 'b-2');
  // Playing it again from the map keeps the badge and the ticks.
  d.key('up');
  d.key('enter');
  assert.equal(d.state.view, 'intro');
  d.key('enter');
  assert.equal(d.state.progress['b-1'].complete, true);
  assert.deepEqual(d.state.progress['b-1'].done, ['W1', 'W2']);
});

test('review fixes: a command typed into the app window does nothing', () => {
  const typed = (d, text) => {
    for (const ch of text) d.send({ type: 'key', name: ch === ' ' ? 'space' : ch, ch, wait: 120 });
    d.send({ type: 'flush', wait: 900 });
  };
  const w5 = at('W5');
  typed(w5, '/status');
  assert.equal(w5.state.beat.revealed, false, 'the s in /status does not show the answer');
  assert.equal(w5.state.toast.kind, 'stray');
  const w1 = at('W1');
  typed(w1, 'cd x');
  assert.equal(stepOf(w1.state).id, 'W1', 'the space in "cd x" does not finish the step');
  const lv = at('W7', { beat: 2 });
  lv.send({ type: 'git', paths: [] });
  lv.key('enter');
  assert.equal(lv.state.view, 'levelup');
  typed(lv, 'git status');
  assert.equal(lv.state.progress['b-1'].moreHelpAt, null, 'the g in git does not ask for more help');
  // A single letter still works, a moment later.
  const one = at('W5');
  one.press('s');
  assert.equal(one.state.beat.revealed, true);
});

test('review fixes: starting over asks first', () => {
  const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'Y3', done: ['W1'] } } } });
  d.key('r');
  assert.equal(d.state.view, 'resume', 'r no longer starts over');
  d.key('x');
  assert.equal(d.state.confirmRestart, true);
  d.key('n');
  assert.deepEqual(d.state.progress['b-1'].done, ['W1']);
  d.key('x');
  d.key('y');
  assert.deepEqual(d.state.progress['b-1'].done, []);
  assert.equal(d.state.view, 'intro');
});

test('review fixes: the y/n prompt closes when the step passes', () => {
  const d = at('W3');
  d.send({ type: 'check', lesson: 'b-1', items: [missing] });
  d.send({ type: 'check', lesson: 'b-1', items: [empty] });
  while (!d.state.beat.confirm) d.send({ type: 'key', name: 'h', ch: 'h', wait: 2_100 }), d.send({ type: 'flush', wait: 400 });
  d.send({ type: 'check', lesson: 'b-1', items: [passed] });
  assert.equal(d.state.beat.confirm, false);
  d.key('enter');
  assert.equal(stepOf(d.state).id, 'W4');
  assert.deepEqual(d.state.eased, [], 'nothing eased: the exact command was never shown');
});

test('review fixes: the status follows the check, with no stale "not yet"', () => {
  const d = at('W3');
  const wrong = b1Item('hello\n');
  d.send({ type: 'check', lesson: 'b-1', items: [missing] });
  d.send({ type: 'check', lesson: 'b-1', items: [empty] });
  d.send({ type: 'check', lesson: 'b-1', items: [missing] });
  assert.equal(d.state.beat.fail.hint, missing.hint, 'back to the first message: the screen says so');
  d.send({ type: 'check', lesson: 'b-1', items: [wrong] });
  assert.equal(d.state.beat.fail.hint, wrong.hint);
  // An error while opening: the first good answer is still the baseline.
  const e = at('W3');
  e.send({ type: 'check-error', lesson: 'b-1', message: 'boom' });
  e.send({ type: 'check', lesson: 'b-1', items: [missing] });
  assert.equal(e.state.beat.status, 'waiting');
});

test('review fixes: a result that misses an item decides nothing, and a slow item waits for r', () => {
  const d = at('W3');
  d.send({ type: 'check', lesson: 'b-1', items: [] });
  assert.equal(d.state.beat.status, 'opening');
  d.send({ type: 'check', lesson: 'b-1', items: [{ ...passed, slow: true, pass: false }] });
  assert.equal(d.state.beat.status, 'waiting', 'not "Checking" for ever');
  assert.equal(d.state.beat.slowWait, true, 'the card says to press r');
  d.key('r');
  assert.equal(d.effects.at(-1).slow, true, 'r runs slow items too');
});

// Lessons after the first: warm-ups, a third terminal, and fresh checks.
const demo = courseWith({ 'b-2': DEMO_B2 });
const onB2 = (b2 = {}, top = {}) => driver({ course: demo, saved: { format: 1, welcomed: true, ...top, lessons: { 'b-1': b1Done, 'b-2': b2 } } });
const item = (pass, hint = '') => ({ index: 0, text: 'x', pass, hint });

test('the grammar: warm-ups in their own section, a fresh check names its file, three places to type', () => {
  const l = parseLesson(DEMO_B2, 'demo');
  assert.deepEqual(l.warmup.map((w) => [w.id, w.part, w.from]), [['R1', 'Warm-up', 'b-1'], ['R2', 'Warm-up', 'b-1'], ['R3', 'Warm-up', 'b-1']]);
  assert.deepEqual(l.steps.map((s) => s.id), ['W1', 'Y1', 'C']);
  assert.deepEqual(l.steps[1].beats[0].verify, { kind: 'check', items: [0], fresh: true, since: null });
  const since = parseLesson(DEMO_B2.replace('- verify: check 0 fresh', '- verify: check 0 fresh since W1'), 'demo');
  assert.equal(since.steps[1].beats[0].verify.since, 'W1');
  const file = parseLesson(DEMO_B2.replace('- verify: check 0 fresh\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt', '- verify: file .practice/b-2-plan.txt fresh'), 'demo');
  assert.deepEqual(file.steps[1].beats[0].verify, { kind: 'file', path: '.practice/b-2-plan.txt', fresh: true, since: null });
  assert.equal(file.steps[1].beats[0].evidence, '.practice/b-2-plan.txt');
  assert.throws(() => parseLesson(DEMO_B2.replace('- verify: check 0 fresh', '- verify: self fresh'), 'demo'), /only a check, a file or a probe can be fresh/);
  assert.equal(l.steps[0].beats[0].where, 'shell');
  assert.throws(() => parseLesson(DEMO_B2.replace('### R1 | Warm-up |', '### W9 | Worked example step 1 of 1 |'), 'demo'), /step heading in the warm-up section/);
  assert.throws(() => parseLesson(DEMO_B2.replace('### C | Check | Check', '### C | Warm-up | Check'), 'demo'), /warm-up heading in the steps section/);
  assert.throws(() => parseLesson(DEMO_B2.replace('- evidence: .practice/b-2-before.txt\n- goal', '- goal'), 'demo'), /a fresh check needs an evidence file/);
  assert.throws(() => parseLesson(DEMO_B2.replace('- where: shell', '- where: moon'), 'demo'), /unknown where moon/);
  // The app can't see a browser: W1's check there is refused (ticket 103).
  assert.throws(() => parseLesson(DEMO_B2.replace('- where: shell', '- where: browser'), 'demo'), /a browser beat verifies with self/);
  assert.throws(() => parseLesson(DEMO_B2.replace('- skill: snapshot\n- where: shell', '- skill: snapshot\n- from: b-1\n- where: shell'), 'demo'), /only a warm-up names the lesson it comes from/);
  // A "Done when" in the app's words is a check's or a file's expectation.
  const said = parseLesson(DEMO_B2.replace('- goal: "Save it again."', '- goal: "Save it again."\n- say: Done when the file lists it.\n- say: Then press r.'), 'demo');
  assert.deepEqual(said.steps[1].beats[0].lines.filter((x) => x.key === 'say').map((x) => x.doneWhen ?? false), [true, false]);
  assert.throws(() => parseLesson(DEMO_B2.replace('- verify: check all', '- verify: none\n- say: Done when it runs.'), 'demo'), /a "Done when" say line needs a check beat or a beat that reads a file/);
  // A path git status is asked about is named as git names it, from the
  // work folder: ./, / and .. would match nothing it lists.
  const scoped = parseLesson(DEMO_B2.replace('- verify: check all', '- verify: git-clean secrets/ .claude/settings.local.json'), 'demo');
  assert.deepEqual(scoped.steps.flatMap((x) => x.beats).find((x) => x.verify.kind === 'git-clean').verify.paths, ['secrets/', '.claude/settings.local.json']);
  for (const verify of ['git-clean ./secrets/', 'git-clean secrets/ /src', 'git-changed .', 'git-only ../other/', 'git-changed src//a.js', 'git-only src\\a.js']) {
    assert.throws(() => parseLesson(DEMO_B2.replace('- verify: check all', `- verify: ${verify}`), 'demo'), /a git path is named from the work folder/, verify);
  }
});

// Ticket 178: a warm-up may quote a level's index page, as the guide's quote
// check allows: from beginner-index, intermediate-index or advanced-index.
test('the grammar: a warm-up may come from a level index, and only a warm-up', () => {
  assert.deepEqual(parseLesson(DEMO_I1_INDEX, 'demo').warmup.map((w) => w.from), ['b-5', 'intermediate-index']);
  for (const id of ['beginner-index', 'advanced-index']) {
    assert.equal(parseLesson(DEMO_I1_INDEX.replace('- from: intermediate-index', `- from: ${id}`), 'demo').warmup[1].from, id);
  }
  // Any other index is an error that names the three.
  for (const id of ['reference-index', 'Intermediate-index', 'i-index']) {
    const text = DEMO_I1_INDEX.replace('- from: intermediate-index', `- from: ${id}`);
    const at = text.split('\n').indexOf(`- from: ${id}`) + 1;
    assert.throws(() => parseLesson(text, 'demo'), new RegExp(`^Error: demo:${at}: from ${id}: a level index is beginner-index, intermediate-index or advanced-index$`), id);
  }
  assert.throws(() => parseLesson(DEMO_I1.replace('- skill: skill-file\n', '- skill: skill-file\n- from: intermediate-index\n'), 'demo'), /only a warm-up names the lesson it comes from/);
});

test('the grammar: an intro holds one quoted why and one quoted payoff', () => {
  const intro = (lines) => DEMO_B2.replace('- can: "do it"', `- can: "do it"\n${lines}`);
  const l = parseLesson(intro('- why: "It matters."\n- payoff: "do it"'), 'demo');
  assert.equal(l.intro.why, 'It matters.');
  assert.equal(l.intro.payoff, 'do it');
  assert.deepEqual(l.intro.can, ['do it']);
  assert.throws(() => parseLesson(intro('- why: It matters.'), 'demo'), /demo:\d+: why must be a quote of the lesson/);
  assert.throws(() => parseLesson(intro('- payoff: do it'), 'demo'), /demo:\d+: payoff must be a quote of the lesson/);
  assert.throws(() => parseLesson(intro('- why: "It matters."\n- why: "So does this."'), 'demo'), /demo:\d+: a second why line in the intro/);
  assert.throws(() => parseLesson(intro('- payoff: "do it"\n- payoff: "do it"'), 'demo'), /demo:\d+: a second payoff line in the intro/);
  // The payoff is one of the can lines, or the screen would flag nothing.
  const typo = intro('- payoff: "do it now"');
  const at = typo.split('\n').indexOf('- payoff: "do it now"') + 1;
  assert.throws(() => parseLesson(typo, 'demo'), new RegExp(`^Error: demo:${at}: the payoff "do it now" is not one of the intro's can lines$`));
});

test('the grammar: an intro holds one quoted read line with one link, at most', () => {
  const intro = (lines) => DEMO_B2.replace('- can: "do it"', `- can: "do it"\n${lines}`);
  const line = '[Read this](https://example.com/page): what it covers.';
  assert.equal(parseLesson(intro(`- read: "${line}"`), 'demo').intro.read, line);
  assert.equal(parseLesson(DEMO_B2, 'demo').intro.read, undefined);
  assert.throws(() => parseLesson(intro(`- read: ${line}`), 'demo'), /demo:\d+: read must be a quote of the lesson/);
  assert.throws(() => parseLesson(intro(`- read: "${line}"\n- read: "${line}"`), 'demo'), /demo:\d+: a second read line in the intro/);
  // The p overlay spells out its one link's address.
  for (const bad of ['Read this next: what it covers.', `${line} [And this](https://example.com/other).`]) {
    assert.throws(() => parseLesson(intro(`- read: "${bad}"`), 'demo'), /^Error: demo:\d+: a read line links one page to read, with a Markdown link$/, bad);
  }
});

test('the grammar: a card section holds entries of a skill, a quoted command and a quoted description', () => {
  const card = (lines) => `${DEMO_B2}\n## card\n${lines}\n`;
  const entry = '- skill: snapshot\n- show: "git status --porcelain"\n- does: "Save what git sees"';
  assert.deepEqual(parseLesson(card(`${entry}\n- skill: check\n- show: "npm run check"\n- does: "Run the check."`), 'demo').card, [
    { skill: 'snapshot', show: 'git status --porcelain', does: 'Save what git sees' },
    { skill: 'check', show: 'npm run check', does: 'Run the check.' },
  ]);
  assert.deepEqual(parseLesson(DEMO_B2, 'demo').card, []);
  assert.throws(() => parseLesson(card(entry.replace('"git status --porcelain"', 'git status --porcelain')), 'demo'), /demo:\d+: show must be a quote of the lesson/);
  assert.throws(() => parseLesson(card(entry.replace('"Save what git sees"', 'Save what git sees')), 'demo'), /demo:\d+: does must be a quote of the lesson/);
  assert.throws(() => parseLesson(card(entry.replace('- skill: snapshot', '- skill: "snapshot"')), 'demo'), /demo:\d+: skill holds the app's own words: no quotes/);
  assert.throws(() => parseLesson(card(entry.replace('- show:', '- run:')), 'demo'), /demo:\d+: unknown card key run/);
  assert.throws(() => parseLesson(card(entry.replace('- skill: snapshot\n', '')), 'demo'), /demo:\d+: a card line before its skill line/);
  assert.throws(() => parseLesson(card(`${entry}\n- does: "Save it again."`), 'demo'), /demo:\d+: a second does line in a card entry/);
  // An entry shows after a finished step on its skill: one this lesson has, and both quotes.
  assert.throws(() => parseLesson(card(entry.replace('- skill: snapshot', '- skill: status')), 'demo'), /demo:\d+: the card entry's skill status is no step of this lesson/);
  assert.throws(() => parseLesson(card(entry.replace(/\n- does: .*/, '')), 'demo'), /demo:\d+: a card entry needs a show and a does line/);
});

// Ticket 194 (the lesson value rework's rule 4): one warm-up, on a skill the
// learner missed, or none.
test('warm-ups: one opens the lesson, on a missed skill, always CHALLENGE, and no part of the climb', () => {
  const d = onB2({}, { missed: ['exit'] });
  assert.equal(d.state.view, 'intro');
  assert.equal(d.state.lesson, 'b-2');
  d.key('enter');
  assert.deepEqual(d.state.progress['b-2'].warm, ['R3'], 'the missed skill alone');
  assert.equal(stepOf(d.state).id, 'R3');
  assert.deepEqual(tiersOf(d.state), ['challenge', 'guided', 'challenge', 'challenge']);
  d.key('1');
  assert.equal(d.state.beat.status, 'done');
  assert.ok(!d.state.missed.includes('exit'), 'recalled at once: the mark clears');
  d.key('enter');
  assert.equal(stepOf(d.state).id, 'W1', 'one warm-up, then the lesson');
  assert.equal(d.state.view, 'step', 'from a warm-up back to GUIDED is no level-up');
  // A wrong pick keeps the mark for a later warm-up.
  const w = onB2({}, { missed: ['status'] });
  w.key('enter');
  assert.equal(stepOf(w.state).id, 'R1');
  w.key('2');
  assert.ok(w.state.missed.includes('status'), 'a wrong pick marks the skill for a later warm-up');
  // Two skills missed: still one warm-up, the first in the file's order.
  const two = onB2({}, { missed: ['exit', 'status'] });
  two.key('enter');
  assert.deepEqual(two.state.progress['b-2'].warm, ['R1']);
  // Nothing missed: no warm-up, and the lesson opens on its own first step.
  const none = onB2();
  none.key('enter');
  assert.deepEqual(none.state.progress['b-2'].warm, []);
  assert.equal(stepOf(none.state).id, 'W1');
  assert.deepEqual(tiersOf(none.state), ['guided', 'challenge', 'challenge']);
  // Resuming inside the warm-ups keeps the ones the play started with, two
  // in a save from before ticket 194.
  const r = onB2({ step: 'R1', beat: 0, warm: ['R3', 'R1'] });
  r.key('enter');
  assert.equal(stepOf(r.state).id, 'R1');
  assert.equal(r.state.pos.step, 1);
  // A typed warm-up answered wrong marks its skill too.
  const t = onB2({ step: 'R2', beat: 0, warm: ['R2', 'R1'] });
  t.key('enter');
  for (const c of 'claude') t.key(c, c);
  t.key('enter');
  assert.ok(t.state.missed.includes('save-version'));
});

test('a fresh check waits for new work, not for what an earlier step left behind', () => {
  const d = onB2({ step: 'Y1', beat: 0, warm: ['R1', 'R2'], levels: ['challenge'] });
  d.key('enter');
  assert.equal(stepOf(d.state).id, 'Y1');
  const path = '.practice/b-2-before.txt';
  d.send({ type: 'check', lesson: 'b-2', items: [item(true)], path, stamp: 'A' });
  assert.equal(d.state.beat.status, 'waiting', 'it passes, but the file is the one W1 made');
  assert.equal(d.state.beat.stale, true);
  assert.equal(d.state.progress['b-2'].stamps['Y1.0'], 'A');
  d.send({ type: 'check', lesson: 'b-2', items: [item(true)], path, stamp: 'A' });
  assert.equal(d.state.beat.status, 'waiting');
  d.send({ type: 'check', lesson: 'b-2', items: [item(true)], path: '.practice/other.txt', stamp: 'B' });
  assert.equal(d.state.beat.status, 'waiting', 'a result about another file decides nothing');
  d.send({ type: 'check', lesson: 'b-2', items: [item(false, 'lists 1 changed file: src/a.js')], path, stamp: 'C' });
  assert.equal(d.state.beat.status, 'fail', 'new work that fails says "not yet"');
  d.send({ type: 'check', lesson: 'b-2', items: [item(true)], path, stamp: 'D' });
  assert.equal(d.state.beat.status, 'done');
  // Back after a break, with the work done meanwhile: it counts.
  const r = onB2({ step: 'Y1', beat: 0, warm: ['R1', 'R2'], levels: ['challenge'], stamps: { 'Y1.0': 'A' } });
  r.key('enter');
  r.send({ type: 'check', lesson: 'b-2', items: [item(true)], path, stamp: 'B' });
  assert.equal(r.state.beat.status, 'already');
  // Playing the lesson again from its start forgets the old files.
  const again = onB2({ ...finished(demo.find((l) => l.id === 'b-2')), warm: ['R1', 'R2'], stamps: { 'Y1.0': 'A' } });
  assert.equal(again.state.view, 'map');
  again.key('up');
  again.key('enter');
  assert.equal(again.state.view, 'intro');
  again.key('enter');
  assert.deepEqual(again.state.progress['b-2'].stamps, {});
});

test('review fixes: closing the map the app opened on opens its lesson', () => {
  // Every lesson in the app is done, so the app opens on the map, at the next
  // lesson, which has no content file yet.
  const d = driver({ course: b1Only, saved: { format: 1, welcomed: true, lessons: { 'b-1': b1Done } } });
  assert.equal(d.state.view, 'map');
  d.key('m');
  assert.equal(d.state.view, 'checkonly');
  assert.equal(d.state.lesson, 'b-2');
});

test('a file check is done once its file holds a line, and a fresh one once it changed', () => {
  const text = DEMO_B2.replace('- verify: check 0 fresh\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt', '- verify: file .practice/b-2-plan.txt fresh');
  const d = driver({ course: courseWith({ 'b-2': text }), saved: { format: 1, welcomed: true, lessons: { 'b-1': b1Done, 'b-2': { warm: ['R1', 'R2'], done: ['R1', 'R2'], step: 'W1', beat: 0 } } } });
  d.key('enter');
  d.send({ type: 'check', lesson: 'b-2', items: [{ index: 0, text: 'x', pass: true, hint: '' }] });
  assert.equal(d.state.beat.status, 'already');
  const out = d.key('enter');
  // Opening Y1 asks for its file's state now, before the learner touches it.
  assert.deepEqual(out.find((e) => e.type === 'stamp'), { type: 'stamp', key: 'Y1.0', path: '.practice/b-2-plan.txt', dir: FACTS.root });
  assert.equal(d.state.view, 'levelup');
  assert.ok(d.key('enter').some((e) => e.type === 'file' && e.path === '.practice/b-2-plan.txt'));
  d.send({ type: 'stamp', key: 'Y1.0', stamp: 'A' });
  d.send({ type: 'file', path: '.practice/b-2-plan.txt', read: Buffer.from('src/config.js'), stamp: 'A' });
  assert.equal(d.state.beat.status, 'waiting', 'the file W1 left behind');
  d.send({ type: 'file', path: '.practice/other.txt', read: Buffer.from('x'), stamp: 'B' });
  assert.equal(d.state.beat.status, 'waiting', 'another file decides nothing');
  d.send({ type: 'file', path: '.practice/b-2-plan.txt', read: null, stamp: 'B' });
  d.key('r');
  d.send({ type: 'file', path: '.practice/b-2-plan.txt', read: null, stamp: 'B', asked: d.state.beat.asked });
  assert.equal(d.state.beat.status, 'fail');
  assert.equal(d.state.beat.fail.hint, '.practice/b-2-plan.txt is not there yet.', 'a missing file is not there, not empty (r27 E1)');
  d.send({ type: 'file', path: '.practice/b-2-plan.txt', read: Buffer.from('src/config.js\nsrc/cli.js\n'), stamp: 'C' });
  assert.equal(d.state.beat.status, 'done');
  assert.equal(d.state.beat.evidence, 'src/config.js and 1 more line', 'a list shows how long it is');
});

test('fresh since: the file is compared with how it was when an earlier step opened', () => {
  const text = DEMO_B2.replace('- verify: check 0 fresh', '- verify: check 0 fresh since W1');
  const d = driver({ course: courseWith({ 'b-2': text }), saved: { format: 1, welcomed: true, lessons: { 'b-1': b1Done, 'b-2': { warm: ['R1'], step: 'R1', beat: 0 } } } });
  d.key('enter');
  d.key('1');
  const out = d.key('enter');
  assert.equal(stepOf(d.state).id, 'W1');
  assert.deepEqual(out.find((e) => e.type === 'stamp'), { type: 'stamp', key: 'Y1.0', path: '.practice/b-2-before.txt', dir: FACTS.root });
});

// A lesson whose help goes up and down: new skills are GUIDED, `status`
// (from lesson 1) is HINTED.
const SAW = DEMO_B2.replace(/## steps[\s\S]*$/, `## steps

### W1 | Worked example step 1 of 3 | New
- tier: guided
- skill: brand-new
- where: claude
- beat: do
- verify: self
- goal: "Do it."

### W2 | Worked example step 2 of 3 | Old
- tier: hinted
- skill: status
- where: claude
- beat: do
- verify: self
- goal: "Do it."

### W3 | Worked example step 3 of 3 | New again
- tier: guided
- skill: other-new
- where: claude
- beat: do
- verify: self
- goal: "Do it."

### Y1 | Your turn step 1 of 1 | Yours
- tier: hinted
- skill: brand-new
- where: claude
- beat: do
- verify: self
- goal: "Do it."

### C | Check | Check
- tier: challenge
- skill: check
- where: terminal
- beat: do
- verify: self
- goal: "Do it."
`);

test('a level-up shows only when the help stays lower; a single harder step gets a line instead', () => {
  const d = driver({ course: courseWith({ 'b-2': SAW }), saved: { format: 1, welcomed: true, lessons: { 'b-1': b1Done, 'b-2': { warm: [], step: 'W1', beat: 0 } } } });
  d.key('enter');
  assert.deepEqual(tiersOf(d.state), ['guided', 'hinted', 'guided', 'hinted', 'challenge']);
  d.key('space');
  assert.equal(stepOf(d.state).id, 'W2');
  assert.equal(d.state.view, 'step', 'W3 gets more help again: no level-up');
  assert.equal(stepNote(d.state), 'hinted');
  d.key('space');
  assert.equal(stepNote(d.state), null);
  d.key('b');
  assert.equal(stepNote(d.state), 'hinted', 'going back keeps the line');
  d.key('space');
  d.key('space');
  assert.equal(d.state.view, 'levelup', 'from Y1 on the help stays lower');
  assert.equal(d.state.levelTo, 'hinted');
});

test('review fixes: a slow item clears an old "not yet", and r shows the run', () => {
  const d = at('C', { levels: ['hinted', 'challenge'] });
  const slowItem = { index: 0, text: 'x', pass: false, slow: true, hint: '' };
  d.send({ type: 'check', lesson: 'b-1', items: [empty] });
  d.key('r');
  d.send({ type: 'check', lesson: 'b-1', items: [missing], asked: d.state.beat.asked });
  assert.equal(d.state.beat.status, 'fail');
  d.send({ type: 'check', lesson: 'b-1', items: [slowItem] });
  assert.equal(d.state.beat.status, 'waiting');
  assert.equal(d.state.beat.fail, null, 'the old message goes');
  assert.equal(d.state.beat.slowWait, true);
  d.key('r');
  assert.equal(d.state.beat.status, 'opening', 'r shows that the slow part runs');
  d.send({ type: 'check-error', lesson: 'b-1', message: 'it took too long', asked: d.state.beat.asked });
  assert.equal(d.state.beat.status, 'broken');
  d.send({ type: 'check', lesson: 'b-1', items: [slowItem] });
  assert.equal(d.state.beat.status, 'waiting');
  assert.equal(d.state.beat.error, null);
});

test('review fixes: a warm-up leaves an ease for the lesson\'s own step, and a missed mark is saved', () => {
  const text = DEMO_B2.replace('### W1 | Worked example step 1 of 1 | Save the list\n- tier: guided\n- skill: snapshot', '### W1 | Worked example step 1 of 1 | Save the list\n- tier: hinted\n- skill: status');
  const d = driver({ course: courseWith({ 'b-2': text }), saved: { format: 1, welcomed: true, eased: ['status'], missed: ['status'], lessons: { 'b-1': b1Done } } });
  d.key('enter');
  assert.equal(stepOf(d.state).id, 'R1');
  assert.equal(d.state.beat.eased, false, 'no "more help" line on a warm-up');
  assert.deepEqual(d.state.eased, ['status']);
  const out = d.key('2');
  assert.ok(d.state.missed.includes('status'));
  assert.ok(out.some((e) => e.type === 'save'), 'the mark is saved at once');
  d.key('1');
  d.key('enter');
  assert.equal(stepOf(d.state).id, 'W1');
  assert.equal(tierOf(d.state), 'guided', 'W1 comes back one tier easier');
  // Back to a warm-up just missed, answered right: the mark stays for later.
  const r = driver({ course: courseWith({ 'b-2': text }), saved: { format: 1, welcomed: true, lessons: { 'b-1': b1Done, 'b-2': { warm: ['R1', 'R3'], step: 'R1', beat: 0 } } } });
  r.key('enter');
  r.key('2');
  r.key('1');
  r.key('enter');
  assert.equal(stepOf(r.state).id, 'R3');
  r.key('b');
  assert.equal(stepOf(r.state).id, 'R1');
  r.key('1');
  assert.ok(r.state.missed.includes('status'));
});

test('review fixes: a recall question marks the skill it recalls, and an unreadable file decides nothing', () => {
  const text = DEMO_B2.replace('- accept: claude --version', '- skill: save-version\n- accept: claude --version').replace('- skill: save-version\n- from: b-1', '- skill: check\n- from: b-1');
  const d = driver({ course: courseWith({ 'b-2': text }), saved: { format: 1, welcomed: true, lessons: { 'b-1': b1Done, 'b-2': { warm: ['R2'], step: 'R2', beat: 0 } } } });
  d.key('enter');
  for (const c of 'claude') d.key(c, c);
  d.key('enter');
  assert.ok(d.state.missed.includes('save-version'), 'the beat\'s skill, not the step\'s');
  assert.ok(!d.state.missed.includes('check'));
  const y = onB2({ step: 'Y1', beat: 0, warm: ['R1', 'R2'], levels: ['challenge'] });
  y.key('enter');
  y.send({ type: 'check', lesson: 'b-2', items: [item(true)], path: '.practice/b-2-before.txt', stamp: null });
  assert.deepEqual(y.state.progress['b-2'].stamps, {}, 'no stamp from a file that could not be read');
  assert.equal(y.state.beat.status, 'opening');
  y.send({ type: 'stamp', key: 'Y1.0', stamp: null });
  assert.deepEqual(y.state.progress['b-2'].stamps, {});
});

test('review fixes: a FAIL about a slow item keeps its hints when a poll leaves that item out', () => {
  const d = at('C', { levels: ['hinted', 'challenge'] });
  // The 2-second poll runs the check without slow items: they come back as placeholders.
  const placeholder = { index: 0, text: passed.text, pass: false, slow: true, hint: '' };
  const slowFail = { ...passed, pass: false, hint: 'The tool exited with code 0, not 2.' };
  d.send({ type: 'check', lesson: 'b-1', items: [placeholder] });
  assert.equal(d.state.beat.slowWait, true);
  d.key('r');
  d.send({ type: 'check', lesson: 'b-1', items: [slowFail], asked: d.state.beat.asked });
  assert.equal(d.state.beat.status, 'fail');
  d.key('h');
  assert.equal(d.state.beat.rung, 0);
  d.send({ type: 'check', lesson: 'b-1', items: [placeholder] });
  assert.equal(d.state.beat.status, 'fail', 'the poll knows nothing new about the slow item');
  assert.equal(d.state.beat.rung, 0, 'the hint on screen stays');
  assert.ok(hintAvailable(d.state));
  d.key('r');
  assert.equal(d.state.beat.status, 'opening', 'r runs the slow item again');
  d.send({ type: 'check', lesson: 'b-1', items: [passed], asked: d.state.beat.asked });
  assert.equal(d.state.beat.status, 'done');
});

test('review fixes: a bottom rung eases its skill from the next step on, not the rest of its own step', () => {
  const text = DEMO_B2.replace('- where: shell\n- beat: do\n- verify: check 0\n', '- where: shell\n- beat: do\n- verify: self\n- goal: "Open a terminal."\n- bottom: "git status"\n- beat: do\n- verify: check 0\n');
  const d = driver({ course: courseWith({ 'b-2': text }), saved: { format: 1, welcomed: true, lessons: { 'b-1': b1Done, 'b-2': { warm: [], step: 'W1', beat: 0 } } } });
  d.key('enter');
  d.key('h');
  assert.equal(d.state.beat.confirm, true);
  d.key('y');
  assert.deepEqual(d.state.eased, ['snapshot']);
  d.key('space');
  assert.deepEqual([stepOf(d.state).id, d.state.pos.beat], ['W1', 1]);
  assert.equal(d.state.progress['b-2'].easedSteps.W1, undefined, 'the rest of W1 is not eased');
  assert.deepEqual(d.state.eased, ['snapshot'], 'the ease waits for the next step');
  d.send({ type: 'check', lesson: 'b-2', items: [item(true)] });
  d.key('enter');
  assert.equal(stepOf(d.state).id, 'Y1');
  assert.equal(d.state.progress['b-2'].easedSteps.Y1, true);
  assert.deepEqual(d.state.eased, []);
});

test('review fixes: a stuck option may say what the learner saw in the app\'s own words', () => {
  const l = parseLesson(DEMO_B2.replace('- wrong: "`/usage`"\n- because: "Usage is something else."', '- stuck: a plan with no test\n- because: "Usage is something else."'), 'demo');
  assert.deepEqual(l.warmup[0].beats[0].options[1], { kind: 'stuck', text: 'a plan with no test', quoted: false, because: 'Usage is something else.' });
});

test('real-run fixes: a question starts with nothing picked, and h says when hints open', () => {
  const d = at('W5');
  assert.equal(d.state.cursor, -1);
  d.key('enter');
  assert.equal(d.state.beat.status, 'waiting', 'a stray enter answers nothing');
  assert.equal(d.state.toast?.kind, 'pickFirst');
  d.key('down');
  assert.equal(d.state.cursor, 0);
  d.key('enter');
  assert.equal(d.state.beat.feedback.kind, 'wrong', 'enter picks what the arrows chose');
  const c = at('Y4', { levels: ['hinted', 'challenge'] });
  c.key('h');
  assert.equal(c.state.toast?.kind, 'hintsLater');
  assert.equal(c.state.beat.rung, -1);
});

// A saved place in the whole course, opened.
const open = (id, step, extra = {}, lessons = course) => {
  const d = driver({ course: lessons, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore(id, lessons), [id]: { step, beat: 0, warm: [], ...extra } } } });
  d.key('enter');
  return d;
};

test('h at CHALLENGE: a beat nothing checks opens the first hint at once', () => {
  for (const [id, step] of [['b-capstone', 'T5'], ['b-4', 'Y5']]) {
    const d = open(id, step);
    assert.equal(tierOf(d.state), 'challenge', `${id} ${step}`);
    assert.equal(beatOf(d.state).verify.kind, 'self');
    d.key('h');
    assert.equal(d.state.beat.rung, 0, `${id} ${step}.0 opens rung 0 with no tick`);
    assert.equal(d.state.toast, null);
  }
});

test('h at CHALLENGE: every beat waits for a try only where a try can show', () => {
  for (const l of course.filter((x) => x.content)) {
    for (const step of l.content.steps) {
      step.beats.forEach((beat, b) => {
        const d = driver({ course, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore(l.id), [l.id]: { step: step.id, beat: b, warm: [] } } } });
        d.key('enter');
        const where = `${l.id} ${step.id}.${b}`;
        if (tierOf(d.state) !== 'challenge' || beat.kind === 'type' || !rungsOf(d.state).length || ['done', 'already'].includes(d.state.beat.status)) return;
        // What the app looks at: a check, git status, a file it reads or a
        // git probe (ticket 105).
        const watched = ['check', 'probe'].includes(beat.verify.kind) || GIT.has(beat.verify.kind) || READS.has(beat.verify.kind);
        const scored = Boolean(beat.ask) && beat.kind !== 'predict' && beat.options.some((o) => ['wrong', 'decoy'].includes(o.kind));
        d.key('h');
        if (watched || scored) {
          assert.equal(d.state.toast?.kind, 'hintsLater', where);
          assert.equal(d.state.toast.try, watched ? 'r' : 'pick', where);
          assert.equal(d.state.beat.rung, -1, where);
        } else assert.ok(d.state.beat.rung === 0 || d.state.beat.confirm, `${where} opens at once`);
      });
    }
  }
});

test('h at CHALLENGE: on a done-label git beat, r is the try', () => {
  const d = at('Y4', { levels: ['hinted', 'challenge'] });
  assert.equal(tierOf(d.state), 'challenge');
  d.send({ type: 'git', paths: ['notes.md'] });
  d.key('h');
  assert.deepEqual([d.state.toast?.kind, d.state.toast?.try], ['hintsLater', 'r']);
  assert.equal(d.state.beat.rung, -1, 'nothing opens before a try');
  d.key('r');
  d.send({ type: 'git', paths: ['notes.md'], asked: d.state.beat.asked });
  assert.equal(d.state.beat.status, 'waiting', 'the tree still decides nothing until the session ends');
  d.key('h');
  assert.equal(d.state.beat.rung, 0);
});

test('h at CHALLENGE: on a stale fresh beat, r is the try', () => {
  const path = '.practice/b-5-rule.txt';
  const d = open('b-5', 'Y2', { stamps: { 'Y2.0': 'a' } });
  assert.equal(tierOf(d.state), 'challenge');
  d.send({ type: 'file', path, read: Buffer.from('// linkcheck source.'), stamp: 'a' });
  assert.equal(d.state.beat.status, 'waiting');
  d.key('h');
  assert.equal(d.state.beat.rung, -1);
  d.key('r');
  assert.deepEqual(d.effects.at(-1), { type: 'file', path, asked: d.state.asks, dir: FACTS.root });
  d.send({ type: 'file', path, read: Buffer.from('// linkcheck source.'), stamp: 'a', asked: d.state.beat.asked });
  assert.equal(d.state.beat.status, 'waiting', 'an unchanged file is still not done');
  d.key('h');
  assert.equal(d.state.beat.rung, 0);
});

const DEMO_ASK = DEMO_B2.replace(/## warm-up[\s\S]*$/, `## steps

### C | Check | Check
- tier: challenge
- skill: check
- where: claude
- beat: predict
- ask: Guess: which one?
- right: "One"
- option: "Two"
- hint: "A hint for the guess."
- beat: ask
- ask: Which one?
- right: "One"
- wrong: "Two"
- because: "Two is something else."
- wrong: "Three"
- because: "Three is something else."
- hint: "A hint for the question."
`);

test('h at CHALLENGE: on a question the first wrong pick is the try, and a guess gates nothing', () => {
  const demo = courseWith({ 'b-2': DEMO_ASK });
  const guess = open('b-2', 'C', {}, demo);
  assert.equal(tierOf(guess.state), 'challenge');
  assert.equal(beatOf(guess.state).kind, 'predict');
  guess.key('h');
  assert.equal(guess.state.beat.rung, 0, 'a guess has nothing to try first');
  const d = open('b-2', 'C', {}, demo);
  d.key('1');
  assert.equal(d.state.beat.status, 'done');
  assert.equal(d.state.beat.unlocked, false, 'a guess unlocks nothing');
  d.key('enter');
  assert.equal(beatOf(d.state).kind, 'ask');
  d.key('h');
  assert.deepEqual([d.state.toast?.kind, d.state.toast?.try], ['hintsLater', 'pick']);
  assert.equal(d.state.beat.rung, -1);
  d.key('2');
  assert.equal(d.state.beat.feedback.kind, 'wrong');
  assert.equal(d.state.beat.unlocked, true);
  d.key('h');
  assert.equal(d.state.beat.rung, 0);
});

// A question nothing can fail (no wrong or decoy option), and a stuck option
// on one that can.
const DEMO_SELF_REPORT = DEMO_B2.replace(/## warm-up[\s\S]*$/, `## steps

### C | Check | Check
- tier: challenge
- skill: check
- where: claude
- beat: do
- do: "Run it."
- ask: Did it work?
- right: "It worked"
- stuck: I got an error
- because: "That's the fix."
- hint: "A hint for the run."
- beat: ask
- ask: Which one?
- right: "One"
- stuck: Something odd
- because: "That's the odd one."
- wrong: "Three"
- because: "Three is something else."
- hint: "A hint for the question."
`);

test('h at CHALLENGE: a question with no wrong answer opens at once, and a stuck pick is a try', () => {
  const demo = courseWith({ 'b-2': DEMO_SELF_REPORT });
  const d = open('b-2', 'C', {}, demo);
  assert.equal(tierOf(d.state), 'challenge');
  d.key('h');
  assert.equal(d.state.toast, null, 'right or stuck: no pick can fail, so nothing waits');
  assert.equal(d.state.beat.rung, 0);
  d.key('1');
  d.key('enter');
  assert.equal(beatOf(d.state).kind, 'ask');
  d.key('h');
  assert.deepEqual([d.state.toast?.kind, d.state.toast?.try], ['hintsLater', 'pick']);
  d.key('2');
  assert.equal(d.state.beat.feedback.kind, 'stuck');
  assert.equal(d.state.beat.unlocked, true, 'saying it went wrong is a try');
  d.key('h');
  assert.equal(d.state.beat.rung, 0);
});

// A Beginner lesson opened at a saved step, with every lesson before it done.
const midway = (id, step, { eased = [], missed = [], beat = 0, ...extra } = {}) => {
  const lessons = { ...finishedBefore(id), [id]: { step, beat, warm: [], ...extra } };
  const d = driver({ course, saved: { format: 1, welcomed: true, eased, missed, lessons } });
  d.key('enter');
  return d;
};
const at5 = (id) => (s) => ['step', 'levelup'].includes(s.view) && s.lesson === 'b-5' && stepOf(s)?.id === id;

test('an ease lands only where it changes the help: a GUIDED step keeps it waiting for the next one', () => {
  const d = midway('b-5', 'W4');
  bottomRung(d);
  assert.deepEqual(d.state.eased, ['memory']);
  playUntil(d, at5('W5'));
  assert.equal(tierOf(d.state), 'guided');
  assert.equal(d.state.beat.eased, false, 'no "more help" line on a step that is GUIDED anyway');
  assert.deepEqual(d.state.progress['b-5'].easedSteps, {});
  assert.deepEqual(d.state.eased, ['memory'], 'the ease waits');
  playUntil(d, at5('Y1'));
  assert.equal(d.state.view, 'step');
  assert.equal(tierOf(d.state), 'guided', 'Y1, HINTED on the plan, opens GUIDED');
  assert.equal(d.state.beat.eased, true);
  assert.deepEqual(d.state.eased, []);
});

test('an ease lands only where it changes the help: the level-up forecast agrees with where it lands', () => {
  const d = midway('b-5', 'W4');
  bottomRung(d);
  playUntil(d, at5('W6'));
  assert.equal(d.state.view, 'step', 'no level-up at W6: Y1 will get more help');
  assert.equal(stepNote(d.state), 'hinted');
  // From here to the end, a level-up shows only where no later step gets more
  // help, and a step's own line only where one does.
  const rank = (t) => ['guided', 'hinted', 'challenge'].indexOf(t);
  const seen = new Map();
  playUntil(d, (s) => {
    if (s.view === 'step' && !seen.has(stepOf(s).id)) seen.set(stepOf(s).id, { tier: tierOf(s), note: stepNote(s), up: null });
    if (s.view === 'levelup' && !seen.has(stepOf(s).id)) seen.set(stepOf(s).id, { tier: s.levelTo, note: null, up: s.levelTo });
    return s.view === 'complete';
  });
  const played = [...seen.values()];
  assert.ok(played.some((x) => x.up), 'a level-up shows later on');
  played.forEach((x, i) => {
    const later = played.slice(i + 1);
    if (x.up) assert.ok(later.every((y) => rank(y.tier) >= rank(x.up)), `level-up at ${[...seen.keys()][i]}`);
    if (x.note) assert.ok(later.some((y) => rank(y.tier) < rank(x.tier)), `line at ${[...seen.keys()][i]}`);
  });
  // The step whose bottom rung set an ease gets none of it, in the forecast
  // too: back from the Check, Y6 is where the help stays lower.
  const c = midway('b-5', 'C', { levels: ['hinted', 'challenge'] });
  bottomRung(c);
  assert.deepEqual(c.state.eased, ['check']);
  c.key('b');
  assert.equal(stepOf(c.state).id, 'Y6');
  assert.equal(tiersOf(c.state).at(-1), 'challenge');
  assert.equal(stepNote(c.state), null, 'no line: the Check will not come back easier');
});

test('an ease lands only where it changes the help: hints short of the exact command neither add nor clear one', () => {
  const d = midway('b-5', 'W4', { eased: ['memory'] });
  const l = course.find((x) => x.id === 'b-5');
  const items = [{ index: 0, text: l.items[0], pass: false, hint: `${l.items[0]} is not there yet.` }];
  d.send({ type: 'check', lesson: 'b-5', items });
  d.key('r');
  d.send({ type: 'check', lesson: 'b-5', items, asked: d.state.beat.asked });
  d.key('h');
  d.key('h');
  assert.equal(d.state.beat.rung, 1);
  assert.equal(d.state.beat.confirm, false);
  assert.deepEqual(d.state.eased, ['memory'], 'still waiting');
  assert.deepEqual(d.state.progress['b-5'].easedSteps, {});
  const y = midway('b-5', 'Y1');
  y.key('h');
  assert.equal(y.state.beat.rung, 0);
  assert.deepEqual(y.state.eased, [], 'nothing added');
});

test('an ease lands only where it changes the help: playing a lesson again starts from the plan', () => {
  const done = Object.fromEntries(course.filter((l) => l.content).map((l) => [l.id, finished(l)]));
  const d = driver({ course, saved: { format: 1, welcomed: true, lessons: { ...done, 'b-5': { ...done['b-5'], warm: ['R1', 'R2'], easedSteps: { Y1: true } } } } });
  assert.equal(d.state.view, 'map');
  mapTo(d, 'b-5');
  d.key('enter');
  assert.equal(d.state.view, 'intro');
  assert.deepEqual(d.state.progress['b-5'].easedSteps, { Y1: true });
  d.key('enter');
  assert.deepEqual(d.state.progress['b-5'].easedSteps, {});
});

// The capstone's warm-ups recall b-4 and b-5 skills its steps never use (D12).
// Its rewind warm-up plays where rewind was missed before (194).
test('an ease lands only where it changes the help: one no later Beginner step uses stays saved (Q12)', () => {
  const toWarmup = () => {
    const d = midway('b-4', 'Y4', { beat: 1, missed: ['rewind'] });
    bottomRung(d);
    assert.deepEqual(d.state.eased, ['rewind']);
    playUntil(d, (s) => s.lesson === 'b-capstone' && s.view === 'step' && stepOf(s).skill === 'rewind');
    assert.equal(d.state.progress['b-5'].complete, true);
    assert.equal(stepOf(d.state).part, 'Warm-up');
    assert.deepEqual(d.state.eased, ['rewind']);
    return d;
  };
  // Missed at the capstone's warm-up: no step there uses it, so it stays.
  const d = toWarmup();
  for (let i = 0; i < 2; i++) {
    for (const c of '/resume') d.key(c, c);
    d.key('enter');
  }
  assert.equal(d.state.beat.answer.kind, 'revealed');
  playUntil(d, (s) => s.lesson === 'b-capstone' && s.view === 'complete');
  assert.deepEqual(d.state.progress['b-capstone'].easedSteps, {});
  assert.deepEqual(d.state.eased, ['rewind']);
  assert.deepEqual(snapshot(d.state).eased, ['rewind']);
  // Recalled there at once: the waiting ease is cancelled.
  const r = toWarmup();
  playUntil(r, (s) => s.lesson === 'b-capstone' && s.view === 'complete');
  assert.deepEqual(r.state.eased, []);
});

test('an ease lands only where it changes the help: in a lesson played again, every step is done, so it waits', () => {
  const done = Object.fromEntries(course.filter((l) => l.content).map((l) => [l.id, finished(l)]));
  const b5 = course.find((l) => l.id === 'b-5').content.steps.map((x) => x.id);
  const d = driver({ course, saved: { format: 1, welcomed: true, lessons: { ...done, 'b-5': { complete: true, done: b5 } } } });
  mapTo(d, 'b-5');
  d.key('enter');
  d.key('enter');
  playUntil(d, at5('W4'));
  bottomRung(d);
  assert.deepEqual(d.state.eased, ['memory']);
  playUntil(d, at5('Y1'));
  assert.equal(tierOf(d.state), 'hinted', 'Y1 opens on the plan');
  assert.equal(d.state.beat.eased, false);
  assert.deepEqual(d.state.progress['b-5'].easedSteps, {});
  assert.deepEqual(d.state.eased, ['memory'], 'the ease waits for a step not yet done');
});

// A Beginner lesson at its intro, with every lesson before it done; enter
// starts it with the warm-up on the first skill in `top.missed` its pool
// recalls, or with none (194).
const fresh = (id, top = {}) => {
  const d = driver({ course, saved: { format: 1, welcomed: true, ...top, lessons: finishedBefore(id) } });
  assert.equal(d.state.view, 'intro');
  assert.equal(d.state.lesson, id);
  d.key('enter');
  return d;
};
const atStep = (id) => (s) => s.view === 'step' && stepOf(s)?.id === id;
const optionOf = (d, kind) => String(beatOf(d.state).options.findIndex((o) => o.kind === kind) + 1);
const typeIn = (d, text) => {
  for (const c of text) d.key(c === ' ' ? 'space' : c, c);
  return d.key('enter');
};

test('warm-ups set the help: b-3 R1 typed wrong twice opens W1 GUIDED, with the line', () => {
  const d = fresh('b-3', { missed: ['plan-mode'] });
  assert.equal(stepOf(d.state).id, 'R1');
  assert.equal(stepOf(d.state).skill, 'plan-mode');
  typeIn(d, 'tab');
  typeIn(d, 'tab');
  assert.equal(d.state.beat.revealed, true);
  assert.deepEqual(d.state.eased, ['plan-mode']);
  assert.ok(d.state.missed.includes('plan-mode'), 'the warm-up mark stays too');
  playUntil(d, atStep('W1'));
  assert.equal(tierOf(d.state), 'guided', 'W1, HINTED on the plan, opens GUIDED');
  assert.equal(d.state.beat.eased, true, 'with the "more help" line');
  assert.deepEqual(d.state.progress['b-3'].easedSteps, { W1: true });
  assert.deepEqual(d.state.eased, []);
  // Without the miss, W1 is HINTED.
  const right = fresh('b-3', { missed: ['plan-mode'] });
  playUntil(right, atStep('W1'));
  assert.equal(tierOf(right.state), 'hinted');
  assert.equal(right.state.beat.eased, false);
});

// Ticket 187: a typing beat takes s as a letter of the answer; an empty
// line is what shows it there.
test('a typed warm-up: s types into the answer, and enter on an empty line shows it', () => {
  for (const [id, skill, lessons] of [['b-4', 'exit', bareExit]]) {
    const d = driver({ course: lessons, saved: { format: 1, welcomed: true, missed: [skill], lessons: finishedBefore(id, lessons) } });
    d.key('enter');
    if (d.state.view === 'intro') d.key('enter');
    assert.equal(beatOf(d.state).kind, 'type', id);
    assert.deepEqual(beatOf(d.state).hints, [], id);
    typeIn(d, 'nope');
    assert.deepEqual(d.state.beat.feedback, { kind: 'wrong', hint: undefined }, id);
    d.key('s', 's');
    assert.equal(d.state.beat.typed, 's', );
    assert.equal(d.state.beat.revealed, false, id);
    d.key('backspace');
    d.key('enter');
    assert.equal(d.state.beat.revealed, true, );
  }
});

test('warm-ups set the help: b-2 R1 (start) shown with s opens W1 GUIDED, with the line', () => {
  const d = fresh('b-2', { missed: ['start'] });
  assert.equal(stepOf(d.state).id, 'R1');
  assert.equal(stepOf(d.state).skill, 'start');
  d.key('s');
  assert.equal(d.state.beat.revealed, true);
  assert.deepEqual(d.state.eased, ['start']);
  playUntil(d, atStep('W1'));
  assert.equal(stepOf(d.state).skill, 'start');
  assert.equal(tierOf(d.state), 'guided');
  assert.equal(d.state.beat.eased, true);
  assert.deepEqual(d.state.eased, []);
});

test('warm-ups set the help: a warm-up answered right the first time cancels a waiting ease', () => {
  const d = fresh('b-2', { eased: ['start'], missed: ['start'] });
  assert.equal(stepOf(d.state).id, 'R1');
  const out = d.key(optionOf(d, 'right'));
  assert.equal(d.state.beat.status, 'done');
  assert.deepEqual(d.state.eased, []);
  assert.deepEqual(d.state.missed, []);
  assert.ok(out.some((e) => e.type === 'save'));
  assert.deepEqual(snapshot(d.state).eased, []);
  playUntil(d, atStep('W1'));
  assert.equal(tierOf(d.state), 'hinted', 'W1 opens on the plan');
  assert.equal(d.state.beat.eased, false, 'with no line');
  assert.deepEqual(d.state.progress['b-2'].easedSteps, {});
});

test('warm-ups set the help: answered wrong and then right, the ease stays', () => {
  const d = fresh('b-2', { missed: ['start'] });
  d.key(optionOf(d, 'wrong'));
  assert.equal(d.state.beat.status, 'waiting');
  d.key(optionOf(d, 'right'));
  assert.equal(d.state.beat.status, 'done');
  assert.deepEqual(d.state.eased, ['start']);
  playUntil(d, atStep('W1'));
  assert.equal(tierOf(d.state), 'guided');
  assert.equal(d.state.beat.eased, true);
  // A typed warm-up too: b-5 R2 (context) wrong, then right.
  const t = fresh('b-5', { missed: ['context'] });
  assert.ok(atStep('R2')(t.state));
  typeIn(t, '/compact');
  assert.equal(t.state.beat.status, 'waiting');
  typeIn(t, '/context');
  assert.equal(t.state.beat.status, 'done');
  assert.deepEqual(t.state.eased, ['context']);
});

test('warm-ups set the help: every kind of miss adds the ease, an empty answer too', () => {
  // A wrong pick.
  const pickWrong = fresh('b-5', { missed: ['start'] });
  pickWrong.key(optionOf(pickWrong, 'wrong'));
  assert.deepEqual(pickWrong.state.eased, ['start']);
  // An empty answer shows it.
  const empty = fresh('b-5', { missed: ['context'] });
  assert.ok(atStep('R2')(empty.state));
  empty.key('enter');
  assert.equal(empty.state.beat.revealed, true);
  assert.deepEqual(empty.state.eased, ['context']);
  // One miss, one skill: a second wrong pick doesn't add it twice.
  const twice = fresh('b-3', { missed: ['status'] });
  assert.ok(atStep('R2')(twice.state));
  typeIn(twice, 'q');
  typeIn(twice, 'q');
  assert.deepEqual(twice.state.eased, ['status']);
});

// The warm-up closure test (MISSABLE in learn-content.test.mjs) counts the
// questions in this test and the next as ones that can mark a skill missed.
test('s on a question with no wrong option still marks its skill for a warm-up, and on a guess it does nothing', () => {
  const d = at('W2');
  assert.deepEqual(beatOf(d.state).options.map((o) => o.kind), ['right', 'stuck', 'other']);
  d.key('s');
  assert.equal(d.state.beat.answer.kind, 'revealed');
  assert.deepEqual(d.state.missed, ['install']);
  const guess = at('W4');
  assert.equal(beatOf(guess.state).kind, 'predict');
  guess.key('s');
  assert.equal(guess.state.beat.answer, null);
  assert.deepEqual(guess.state.missed, []);
});

test('a decoy pick on a question with no right option still marks its skill for a warm-up, and s there does nothing', () => {
  // b-1 W6's answers question, its right option made a plain option.
  const noRight = b1Only.map((l) => {
    if (l.id !== 'b-1') return l;
    const content = structuredClone(l.content);
    content.steps.find((x) => x.id === 'W6').beats[1].options[0].kind = 'option';
    return { ...l, content };
  });
  const open = () => {
    const d = driver({ course: noRight, saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W6', beat: 1 } } } });
    d.key('enter');
    assert.deepEqual(beatOf(d.state).options.map((o) => o.kind), ['option', 'decoy', 'decoy', 'other']);
    return d;
  };
  const shown = open();
  shown.key('s');
  assert.equal(shown.state.beat.answer, null);
  assert.deepEqual(shown.state.missed, []);
  const d = open();
  d.key('2');
  assert.equal(d.state.beat.feedback.kind, 'wrong');
  assert.deepEqual(d.state.missed, ['ask']);
});

test('warm-ups set the help: misses inside a lesson only mark a warm-up, and a guess touches nothing', () => {
  const d = at('W5');
  d.key('1');
  assert.equal(d.state.beat.feedback.kind, 'wrong');
  assert.ok(d.state.missed.includes('status'));
  assert.deepEqual(d.state.eased, [], 'a lesson\'s own question eases nothing');
  d.key('s');
  assert.deepEqual(d.state.eased, []);
  const guess = at('W4');
  guess.key('1');
  assert.equal(guess.state.beat.status, 'done');
  assert.deepEqual(guess.state.missed, []);
  assert.deepEqual(guess.state.eased, []);
  // In a lesson with warm-ups, a step's own wrong pick eases nothing either.
  const w = fresh('b-2');
  playUntil(w, atStep('W1'));
  assert.equal(beatOf(w.state).kind, 'do');
  playUntil(w, (s) => s.view === 'step' && beatOf(s).ask && beatOf(s).kind !== 'predict' && beatOf(s).options.some((o) => o.kind === 'wrong'));
  w.key(optionOf(w, 'wrong'));
  assert.ok(w.state.missed.length > 0);
  assert.deepEqual(w.state.eased, []);
});

test('warm-ups set the help: the ease is saved at once', () => {
  const d = fresh('b-3', { missed: ['plan-mode'] });
  const out = d.key('x', 'x');
  assert.ok(!out.some((e) => e.type === 'save'), 'typing alone saves nothing');
  const miss = typeIn(d, '');
  assert.equal(d.state.beat.typedWrong, 1);
  assert.ok(miss.some((e) => e.type === 'save'), 'the miss saves');
  assert.deepEqual(snapshot(d.state).eased, ['plan-mode']);
});

// The same play after a quit: the save, opened again at its resume screen.
const reopen = (d) => {
  const r = driver({ course, saved: snapshot(d.state) });
  assert.equal(r.state.view, 'resume');
  r.key('enter');
  return r;
};
const backTo = (d, id) => {
  for (let i = 0; i < 20 && !atStep(id)(d.state); i++) d.key('b');
  assert.ok(atStep(id)(d.state));
};

test('warm-ups set the help: a missed warm-up asked again after a quit keeps its ease', () => {
  const d = fresh('b-2', { missed: ['start'] });
  d.key('s');
  assert.deepEqual(d.state.eased, ['start']);
  const r = reopen(d);
  assert.equal(stepOf(r.state).id, 'R1', 'the warm-up is asked again');
  r.key(optionOf(r, 'right'));
  assert.deepEqual(r.state.eased, ['start'], 'its answer was just shown');
  assert.ok(r.state.missed.includes('start'));
  playUntil(r, atStep('W1'));
  assert.equal(tierOf(r.state), 'guided');
  assert.equal(r.state.beat.eased, true);
  // Quit before answering: the answer after the quit is the first one.
  const q = fresh('b-2', { missed: ['start'] });
  const rq = reopen(q);
  rq.key(optionOf(rq, 'right'));
  assert.deepEqual(rq.state.missed, []);
  assert.deepEqual(rq.state.eased, []);
});

test('warm-ups set the help: going back to a warm-up asks nothing new of the help', () => {
  // Right at once, then the bottom rung on W1: a right pick on the way back
  // keeps that ease.
  const d = fresh('b-2', { missed: ['start'] });
  d.key(optionOf(d, 'right'));
  playUntil(d, atStep('W1'));
  bottomRung(d);
  assert.deepEqual(d.state.eased, ['start']);
  backTo(d, 'R1');
  d.key(optionOf(d, 'right'));
  assert.deepEqual(d.state.eased, ['start']);
  // Shown, its ease spent on W1: shown again on the way back, no second ease.
  const s = fresh('b-2', { missed: ['start'] });
  s.key('s');
  playUntil(s, atStep('W1'));
  assert.equal(s.state.beat.eased, true);
  assert.deepEqual(s.state.eased, []);
  backTo(s, 'R1');
  s.key('s');
  assert.deepEqual(s.state.eased, []);
  assert.deepEqual(snapshot(s.state).eased, []);
  // The same after a quit, on a lesson's first play.
  const q = fresh('b-2', { missed: ['start'] });
  q.key(optionOf(q, 'right'));
  playUntil(q, atStep('W1'));
  const r = reopen(q);
  backTo(r, 'R1');
  r.key('s');
  assert.deepEqual(r.state.eased, []);
  // A lesson played again asks its warm-up afresh: shown, its skill stays
  // missed, so the replay asks it again.
  const again = fresh('b-2', { missed: ['start'] });
  again.key('s');
  playUntil(again, (st) => st.view === 'complete');
  assert.deepEqual(again.state.eased, []);
  again.key('m');
  again.key('enter');
  assert.equal(again.state.view, 'intro');
  again.key('enter');
  assert.equal(stepOf(again.state).id, 'R1');
  again.key('s');
  assert.deepEqual(again.state.eased, ['start']);
});

// A Beginner lesson opened from the map, at its intro, with `lessons` saved.
const fromMap = (id, lessons = {}, top = {}) => {
  const d = driver({ course, saved: { format: 1, welcomed: true, ...top, lessons } });
  if (d.state.view !== 'map') d.key('m');
  const to = course.findIndex((l) => l.id === id);
  while (d.state.mapCursor !== to) d.key('down');
  d.key('enter');
  assert.deepEqual([d.state.view, d.state.lesson], ['intro', id]);
  return d;
};
const lessonOfId = (id) => course.find((l) => l.id === id);
// The learner's tiers for a lesson's own steps, warm-ups aside.
const ownTiers = (s, id) => tiersOf(s, id).filter((_, i) => i >= s.progress[id].warm.length);

test('fading counts only what this learner did: b-4 opened from the map with nothing done', () => {
  const steps = lessonOfId('b-4').content.steps;
  const d = fromMap('b-4');
  const tiers = ownTiers(d.state, 'b-4');
  assert.equal(steps[0].skill, 'start');
  assert.equal(steps[0].tier, 'challenge', 'W1 is CHALLENGE on the course plan');
  assert.equal(tiers[0], 'guided', 'W1 opens GUIDED for a learner who never finished a start step');
  assert.equal(tiers.at(-1), 'challenge', 'the Check stays CHALLENGE');
  d.key('enter');
  playUntil(d, atStep('W1'));
  assert.equal(tierOf(d.state), 'guided');
  // On the path, W1 keeps the plan.
  const path = fromMap('b-4', finishedBefore('b-4'));
  assert.equal(ownTiers(path.state, 'b-4')[0], 'challenge');
});

test('b-5 opens at CHALLENGE on starting Claude Code, and /init comes in a GUIDED step (Q10)', () => {
  const d = fromMap('b-5', finishedBefore('b-5'));
  const tiers = ownTiers(d.state, 'b-5');
  assert.deepEqual(tiers.slice(0, 2), ['challenge', 'guided']);
  assert.deepEqual(['guided', 'hinted', 'challenge'].map((t) => tiers.filter((x) => x === t).length), [4, 6, 4]);
  d.key('enter');
  playUntil(d, atStep('W1'));
  assert.equal(stepOf(d.state).skill, 'start');
  assert.equal(tierOf(d.state), 'challenge');
  playUntil(d, atStep('W2'));
  assert.equal(stepOf(d.state).skill, 'memory');
  assert.equal(tierOf(d.state), 'guided');
  assert.ok(stepOf(d.state).beats.some((b) => b.lines.some((l) => l.key === 'run' && l.text === '/init')));
});

// Pins what a b-5 save from before the split does today, until the owner
// chooses (ticket 135): every old id is still a step, so nothing starts over.
test('b-5 saved before the W1 split: each saved step id now names the step after it', () => {
  const old = (p) => driver({ course, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore('b-5'), 'b-5': { warm: [], ...p } } } });
  // Old W6 (Check the new file), beat 1, with old W1 to W5 done.
  const d = old({ step: 'W6', beat: 1, done: ['W1', 'W2', 'W3', 'W4', 'W5'], easedSteps: { W5: true } });
  assert.equal(d.state.view, 'resume');
  assert.deepEqual(d.state.progress['b-5'].done, ['W1', 'W2', 'W3', 'W4', 'W5']);
  assert.deepEqual(d.state.progress['b-5'].easedSteps, { W5: true });
  d.key('enter');
  assert.deepEqual([stepOf(d.state).title, d.state.pos.beat], ['Ask for a new file', 1]);
  // Old W1 after /init: its beat is past the new W1, which opens on the clean-copy check.
  const w1 = old({ step: 'W1', beat: 3 });
  w1.key('enter');
  assert.deepEqual([stepOf(w1.state).id, w1.state.pos.beat, beatOf(w1.state).verify.kind], ['W1', 0, 'git-clean']);
});

test('fading counts only what this learner did: a lesson marked complete with nothing done counts for nothing', () => {
  // The seeded b-5 run: b-1 to b-4 complete, with no step done.
  const skipped = Object.fromEntries(['b-1', 'b-2', 'b-3', 'b-4'].map((id) => [id, { complete: true, done: [] }]));
  const d = fromMap('b-5', skipped);
  d.key('enter');
  playUntil(d, atStep('W7'));
  assert.equal(stepOf(d.state).skill, 'commit');
  assert.equal(stepOf(d.state).tier, 'hinted');
  assert.equal(tierOf(d.state), 'guided', 'W7, HINTED on the plan, opens GUIDED');
});

test('fading counts only what this learner did: on the path every Beginner lesson keeps the course plan', () => {
  // The plan of the course played: its Beginner lessons are the reducer
  // fixtures, which may ask a skill fewer times than the shipped files that
  // the authored tiers count (a-4 W1's ask: the fixtures ask it in b-1 only).
  const contents = course.map((x) => x.content);
  for (const l of course.filter((x) => x.content)) {
    const plan = ruleTiers(contents, course.indexOf(l));
    const d = driver({ course, saved: { format: 1, welcomed: true, lessons: finishedBefore(l.id) } });
    assert.deepEqual(ownTiers(d.state, l.id), plan, l.id);
    // With nothing done, every lesson after the first gives more help somewhere,
    // and a capstone none.
    const none = driver({ course, saved: { format: 1, welcomed: true } });
    const rank = (t) => ['guided', 'hinted', 'challenge'].indexOf(t);
    const skipped = ownTiers(none.state, l.id);
    const authored = plan;
    skipped.forEach((t, i) => assert.ok(rank(t) <= rank(authored[i]), `${l.id} ${l.content.steps[i].id}`));
    if (l.id === 'b-1' || l.id.endsWith('capstone')) assert.deepEqual(skipped, authored, l.id);
    else assert.notDeepEqual(skipped, authored, l.id);
  }
});

// Ticket 194: a warm-up spends a question only on a skill the learner
// missed, so an unmet skill or the file order alone asks nothing.
test('fading counts only what this learner did: a warm-up asks a missed skill, the first in the file, and none when nothing was missed', () => {
  // b-4's pool: R1 review-diff (b-3), R2 exit (b-1), R3 approve-edits (b-2),
  // R4 run-tests (b-3).
  assert.deepEqual(lessonOfId('b-4').content.warmup.map((w) => w.skill), ['review-diff', 'exit', 'approve-edits', 'run-tests']);
  const b12 = { 'b-1': finished(lessonOfId('b-1')), 'b-2': finished(lessonOfId('b-2')) };
  const d = fromMap('b-4', b12);
  assert.deepEqual(pickWarmups(d.state, 'b-4'), [], 'b-3 skipped: its unmet skills ask nothing');
  d.key('enter');
  assert.deepEqual(d.state.progress['b-4'].warm, []);
  assert.equal(stepOf(d.state).part, 'Worked example');
  const m = fromMap('b-4', b12, { missed: ['approve-edits'] });
  assert.deepEqual(pickWarmups(m.state, 'b-4'), ['R3'], 'the missed skill alone');
  m.key('enter');
  assert.deepEqual(m.state.progress['b-4'].warm, ['R3']);
  assert.equal(stepOf(m.state).id, 'R3');
  // Two missed: the first in the file's order, not the first missed.
  assert.deepEqual(pickWarmups(fromMap('b-4', b12, { missed: ['run-tests', 'exit'] }).state, 'b-4'), ['R2']);
  // A missed skill the pool doesn't recall asks nothing either.
  assert.deepEqual(pickWarmups(fromMap('b-4', b12, { missed: ['plan-mode'] }).state, 'b-4'), []);
  // A learner who skipped everything, with nothing missed, starts on the lesson's own first step.
  const none = fromMap('b-4');
  none.key('enter');
  assert.deepEqual(none.state.progress['b-4'].warm, []);
  assert.deepEqual(none.state.view, 'step');
  assert.equal(stepOf(none.state).id, 'W1');
});

// Ticket 178: a level index warm-up recalls a level, not a skill a step
// practises; like any other, it is asked only where its skill was missed.
// i-1's R1 commit (b-5), R2 when-to-use (index).
test('fading counts only what this learner did: a level index warm-up is asked only where its skill was missed', () => {
  const lessons = course.map((l) => (l.id === 'i-1' ? { ...l, content: parseLesson(DEMO_I1_INDEX, 'i-1.md') } : l));
  const at = (saved) => driver({ course: lessons, saved: { format: 1, welcomed: true, ...saved } }).state;
  const before = finishedBefore('i-1', lessons);
  assert.deepEqual(pickWarmups(at({ lessons: before }), 'i-1'), [], 'every earlier lesson done');
  assert.deepEqual(pickWarmups(at({}), 'i-1'), [], 'nothing done');
  assert.deepEqual(pickWarmups(at({ lessons: before, missed: ['when-to-use'] }), 'i-1'), ['R2'], 'its skill missed');
  assert.deepEqual(pickWarmups(at({ lessons: before, missed: ['when-to-use', 'commit'] }), 'i-1'), ['R1'], 'the file order among the missed');
});

test('fading counts only what this learner did: one warm-up however many skills were missed, and a beat\'s own skill counts', () => {
  // b-3's pool: R1 plan-mode, R2 status, R3 and R4 approve-edits, R5
  // plan-ask, R6 plan-revise.
  const pool = lessonOfId('b-3').content.warmup;
  assert.deepEqual(pool.map((w) => w.skill), ['plan-mode', 'status', 'approve-edits', 'approve-edits', 'plan-ask', 'plan-revise']);
  const m = fromMap('b-3', finishedBefore('b-3'), { missed: ['plan-ask', 'approve-edits', 'status'] });
  assert.deepEqual(pickWarmups(m.state, 'b-3'), ['R2']);
  // A recall beat files under its own skill (R2 here recalls save-version
  // in a step tagged check): a miss on that skill picks it.
  const text = DEMO_B2.replace('- accept: claude --version', '- skill: save-version\n- accept: claude --version').replace('- skill: save-version\n- from: b-1', '- skill: check\n- from: b-1');
  const o = driver({ course: courseWith({ 'b-2': text }), saved: { format: 1, welcomed: true, missed: ['save-version'], lessons: { 'b-1': finished(lessonOfId('b-1')) } } });
  assert.deepEqual(pickWarmups(o.state, 'b-2'), ['R2']);
  const step = driver({ course: courseWith({ 'b-2': text }), saved: { format: 1, welcomed: true, missed: ['check'], lessons: { 'b-1': finished(lessonOfId('b-1')) } } });
  assert.deepEqual(pickWarmups(step.state, 'b-2'), [], 'the step\'s skill is not the one it recalls');
});

test('fading counts only what this learner did: a warm-up right the first time puts its skill back on the plan', () => {
  const b3 = lessonOfId('b-3').content;
  const plan = b3.steps.filter((x) => x.skill === 'plan-mode');
  const planTiers = (s) => ownTiers(s, 'b-3').filter((_, i) => b3.steps[i].skill === 'plan-mode');
  // b-1 done, b-2 skipped, plan-mode missed there: plan-mode is unmet, so
  // W1 opens GUIDED, and the miss asks its warm-up.
  const d = fromMap('b-3', { 'b-1': finished(lessonOfId('b-1')) }, { missed: ['plan-mode'] });
  assert.equal(planTiers(d.state)[0], 'guided');
  assert.notDeepEqual(planTiers(d.state), plan.map((x) => x.tier));
  d.key('enter');
  assert.equal(stepOf(d.state).id, 'R1');
  assert.equal(stepOf(d.state).skill, 'plan-mode');
  const out = typeIn(d, beatOf(d.state).accept[0]);
  assert.equal(d.state.beat.status, 'done');
  assert.deepEqual(d.state.progress['b-3'].recalled, ['R1']);
  assert.ok(out.some((e) => e.type === 'save'));
  assert.deepEqual(planTiers(d.state), plan.map((x) => x.tier), 'every plan-mode step is on the course plan');
  // It survives a resume.
  const r = reopen(d);
  assert.deepEqual(r.state.progress['b-3'].recalled, ['R1']);
  assert.deepEqual(planTiers(r.state), plan.map((x) => x.tier));
  playUntil(r, atStep('W1'));
  assert.equal(tierOf(r.state), plan[0].tier);
  // A replay clears it, and, with the miss cleared, asks no warm-up.
  playUntil(r, (st) => st.view === 'complete');
  assert.deepEqual(r.state.progress['b-3'].recalled, ['R1']);
  r.key('m');
  r.key('enter');
  assert.equal(r.state.view, 'intro');
  r.key('enter');
  assert.deepEqual(r.state.progress['b-3'].recalled, []);
  assert.deepEqual(r.state.progress['b-3'].warm, []);
  assert.equal(planTiers(r.state)[0], 'guided');
});

test('fading counts only what this learner did: a replay asks again the warm-up on a skill still missed', () => {
  // b-1 done, b-2 skipped, b-3 finished with R1 (plan-mode) recalled and
  // plan-mode missed again since. The replay clears the recall, and b-3's
  // own steps don't fade b-3's help, so plan-mode is unmet again, and the
  // miss asks R1.
  const d = fromMap('b-3', { 'b-1': finished(lessonOfId('b-1')), 'b-3': { ...finished(lessonOfId('b-3')), recalled: ['R1'] } }, { missed: ['plan-mode'] });
  assert.equal(ownTiers(d.state, 'b-3')[0], 'hinted', 'before the replay, the recall keeps W1 on the plan');
  const preview = asStarted(d.state);
  const shown = { warm: pickWarmups(preview), tiers: ownTiers(preview, 'b-3') };
  d.key('enter');
  assert.deepEqual(d.state.progress['b-3'].recalled, []);
  assert.deepEqual(d.state.progress['b-3'].warm, ['R1']);
  assert.deepEqual(ownTiers(d.state, 'b-3')[0], 'guided');
  // What the intro shows is what the play starts with.
  assert.deepEqual(shown, { warm: d.state.progress['b-3'].warm, tiers: ownTiers(d.state, 'b-3') });
  // R1 right the first time puts W1 back on the plan.
  typeIn(d, beatOf(d.state).accept[0]);
  assert.equal(ownTiers(d.state, 'b-3')[0], 'hinted');
});

test('fading counts only what this learner did: a warm-up right after a miss, or asked again, adds nothing to recalled', () => {
  const d = fromMap('b-3', { 'b-1': finished(lessonOfId('b-1')) }, { missed: ['plan-mode'] });
  d.key('enter');
  typeIn(d, 'tab');
  typeIn(d, beatOf(d.state).accept[0]);
  assert.equal(d.state.beat.status, 'done');
  assert.deepEqual(d.state.progress['b-3'].recalled, []);
  // Gone back to and answered right: still not the first answer.
  playUntil(d, atStep('W1'));
  backTo(d, 'R1');
  typeIn(d, beatOf(d.state).accept[0]);
  assert.deepEqual(d.state.progress['b-3'].recalled, []);
  // A lesson's own question never joins it.
  const own = at('W5');
  own.key(optionOf(own, 'right'));
  assert.deepEqual(own.state.progress['b-1'].recalled, []);
});

test('fading counts only what this learner did: an old save loads with an empty recalled list, and unknown ids drop', () => {
  const old = driver({ course, saved: { format: 1, welcomed: true, lessons: { 'b-3': { step: 'R1', beat: 0, warm: ['R1', 'R2'] } } } });
  assert.deepEqual(old.state.progress['b-3'].recalled, []);
  assert.deepEqual(old.state.progress['b-4'].recalled, []);
  const gone = driver({ course, saved: { format: 1, welcomed: true, lessons: { 'b-3': { recalled: ['R1', 'R9'] } } } });
  assert.deepEqual(gone.state.progress['b-3'].recalled, ['R1'], 'a warm-up no longer in the file is dropped');
});

// Lesson 1 at its HINTED level-up (Y1), every step before it done.
const toY1 = (eased = []) => {
  const d = driver({ saved: { format: 1, welcomed: true, eased, lessons: { 'b-1': { step: 'W7', beat: 2, done: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'] } } } });
  d.key('enter');
  d.send({ type: 'git', paths: [] });
  d.key('enter');
  return d;
};
const b1Ids = course.find((l) => l.id === 'b-1').content.steps.map((x) => x.id);
const tierAt = (tiers, id) => tiers[b1Ids.indexOf(id)];

test('g is one notch more help: on the HINTED level-up, every later step but the Check, and the climb keeps the rest', () => {
  const d = toY1();
  assert.equal(d.state.view, 'levelup');
  assert.equal(d.state.levelTo, 'hinted');
  const before = tiersOf(d.state);
  assert.equal(tierAt(before, 'Y4'), 'challenge');
  d.key('g');
  assert.equal(d.state.view, 'step');
  assert.equal(d.state.progress['b-1'].moreHelpAt, 'Y1');
  const after = tiersOf(d.state);
  for (const id of ['Y1', 'Y2', 'Y3']) assert.equal(tierAt(after, id), 'guided', id);
  assert.equal(tierAt(after, 'Y4'), 'hinted', 'one notch, not GUIDED');
  assert.equal(tierAt(after, 'C'), 'challenge', 'the Check stays CHALLENGE');
  playUntil(d, (s) => s.view === 'next');
  // "Your climb" draws the lesson as it was played.
  const played = tiersOf(d.state);
  for (const id of ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7']) assert.equal(tierAt(played, id), tierAt(before, id), id);
  assert.deepEqual(mix(played), [10, 1, 1]);
});

test('g is one notch more help: g on the Check\'s level-up after it gives nothing and takes nothing back', () => {
  const d = toY1();
  d.key('g');
  // Y4 is HINTED now, so the Check is where the help goes down to CHALLENGE.
  playUntil(d, (s) => s.view === 'levelup');
  assert.equal(stepOf(d.state).id, 'C');
  assert.equal(d.state.levelTo, 'challenge');
  assert.equal(moreHelpGives(d.state), false, 'the Check stays CHALLENGE, so g has nothing to give');
  d.key('g');
  assert.equal(d.state.view, 'step', 'g there goes on like enter');
  assert.equal(d.state.progress['b-1'].moreHelpAt, 'Y1', 'the first g still counts from Y1');
  assert.equal(tierOf(d.state), 'challenge');
  playUntil(d, (s) => s.view === 'next');
  const played = tiersOf(d.state);
  for (const id of ['Y1', 'Y2', 'Y3']) assert.equal(tierAt(played, id), 'guided', id);
  assert.equal(tierAt(played, 'Y4'), 'hinted');
  assert.deepEqual(mix(played), [10, 1, 1]);
});

test('g is one notch more help: a later level-up never moves it later', () => {
  // A save with g counted from Y1 and no level-up seen yet: Y4 levels up to
  // HINTED, which the g from Y1 gives it already.
  const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'Y3', beat: 0, moreHelpAt: 'Y1', levels: [] } } } });
  d.key('enter');
  playUntil(d, (s) => s.view === 'levelup');
  assert.equal(stepOf(d.state).id, 'Y4');
  assert.equal(moreHelpGives(d.state), false);
  d.key('g');
  assert.equal(d.state.view, 'step');
  assert.equal(d.state.progress['b-1'].moreHelpAt, 'Y1');
  for (const id of ['Y1', 'Y2', 'Y3']) assert.equal(tierAt(tiersOf(d.state), id), 'guided', id);
});

test('g is one notch more help: on the CHALLENGE level-up too, and it stays for the rest of the play', () => {
  const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'Y3', beat: 0, levels: ['hinted'] } } } });
  d.key('enter');
  playUntil(d, (s) => s.view === 'levelup');
  assert.equal(stepOf(d.state).id, 'Y4');
  assert.equal(d.state.levelTo, 'challenge');
  d.key('g');
  assert.equal(d.state.view, 'step');
  assert.equal(d.state.progress['b-1'].moreHelpAt, 'Y4');
  assert.equal(tierOf(d.state), 'hinted');
  assert.ok(d.state.progress['b-1'].levels.includes('challenge'), 'the level-up shows once');
  playUntil(d, (s) => stepOf(s)?.id === 'C');
  assert.equal(d.state.view, 'step', 'no second level-up at the Check');
  assert.equal(tierOf(d.state), 'challenge');
});

test('g is one notch more help: both keys work on the level-up\'s first frame', () => {
  const g = toY1();
  g.send({ type: 'key', name: 'g', ch: 'g', wait: 0 });
  g.send({ type: 'flush', wait: DEFER_MS + 50 });
  assert.equal(g.state.view, 'step');
  assert.equal(g.state.progress['b-1'].moreHelpAt, 'Y1');
  const enter = toY1();
  enter.send({ type: 'key', name: 'enter', wait: 0 });
  assert.equal(enter.state.view, 'step');
  assert.equal(enter.state.progress['b-1'].moreHelpAt, null);
});

test('g is one notch more help: an ease waiting on a step g covers waits for a later step', () => {
  // Y4 (ask) is CHALLENGE on the plan: the waiting ease would make it HINTED,
  // which g does already.
  const d = toY1(['ask']);
  assert.equal(d.state.view, 'levelup');
  d.key('g');
  playUntil(d, (s) => stepOf(s)?.id === 'Y4');
  assert.equal(tierOf(d.state), 'hinted');
  assert.equal(d.state.beat.eased, false, 'no "more help" line: g gave it');
  assert.deepEqual(d.state.progress['b-1'].easedSteps, {});
  assert.deepEqual(d.state.eased, ['ask'], 'the ease waits');
});

test('g is one notch more help: an ease that landed on the level-up step goes back to waiting', () => {
  // b-5: the memory ease makes Y1 GUIDED, so Y2 (snapshot, eased to HINTED)
  // is where the help stays lower.
  const d = midway('b-5', 'W4', { eased: ['snapshot'] });
  bottomRung(d);
  playUntil(d, (s) => s.view === 'levelup');
  assert.equal(stepOf(d.state).id, 'Y2');
  assert.equal(d.state.progress['b-5'].easedSteps.Y2, true);
  d.key('g');
  assert.equal(tierOf(d.state), 'hinted', 'g gives the same help the ease gave');
  assert.equal(d.state.beat.eased, false);
  assert.equal(d.state.progress['b-5'].easedSteps.Y2, undefined);
  assert.deepEqual(d.state.eased, ['snapshot']);
});

test('g is one notch more help: the level-up forecast agrees that a covered step takes no ease', () => {
  // Back at Y1 after g on Y4's level-up, with an ease waiting on Y4's skill.
  const d = driver({ saved: { format: 1, welcomed: true, eased: ['ask'], lessons: { 'b-1': { step: 'Y1', beat: 0, levels: ['hinted', 'challenge'], moreHelpAt: 'Y4' } } } });
  d.key('enter');
  assert.equal(stepOf(d.state).id, 'Y1');
  // Y1 is HINTED after GUIDED W7, and nothing later gets less: Y4 is HINTED
  // with g, and the ease will not land there.
  assert.equal(stepNote(d.state), null);
  playUntil(d, (s) => stepOf(s)?.id === 'Y4');
  assert.equal(tierOf(d.state), 'hinted');
  assert.deepEqual(d.state.eased, ['ask']);
});

test('g is one notch more help: playing the lesson again starts without it', () => {
  const done = { ...finished(course.find((l) => l.id === 'b-1')), moreHelpAt: 'Y1' };
  const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': done } } });
  const to = d.state.course.findIndex((l) => l.id === 'b-1');
  while (d.state.mapCursor !== to) d.key('up');
  d.key('enter');
  assert.equal(d.state.view, 'intro');
  assert.equal(tiersOf(asStarted(d.state))[b1Ids.indexOf('Y1')], 'hinted', 'the intro shows the plan');
  d.key('enter');
  assert.equal(d.state.progress['b-1'].moreHelpAt, null);
  assert.equal(tierAt(tiersOf(d.state), 'Y4'), 'challenge');
  // A step id the lesson no longer has is dropped as the app starts.
  const old = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'Y2', moreHelpAt: 'Y9' } } } });
  assert.equal(old.state.progress['b-1'].moreHelpAt, null);
});

// Truthful waits: r shows the run it asked for, and only that run's result ends it.
const ofType = (effects, type) => effects.filter((e) => e.type === type);

test('r shows the checking state on every checked beat, and its check, file and git effects carry its flag', () => {
  const d = at('W3');
  d.send({ type: 'check', lesson: 'b-1', items: [missing] });
  assert.equal(d.state.beat.status, 'waiting');
  const out = d.key('r');
  assert.equal(d.state.beat.status, 'opening', 'an ordinary check beat, with no slow item');
  assert.deepEqual(ofType(out, 'check'), [{ type: 'check', lesson: 'b-1', items: [0], evidence: '.practice/version.txt', slow: true, asked: d.state.asks, dir: FACTS.root }]);
  d.send({ type: 'check', lesson: 'b-1', items: [missing], asked: d.state.beat.asked });
  assert.equal(d.state.beat.status, 'fail');
  d.key('r');
  assert.equal(d.state.beat.status, 'opening', 'r on a "Not yet" shows the run too');
  const f = midway('b-2', 'W6', { beat: 2 });
  assert.equal(beatOf(f.state).verify.kind, 'file');
  f.send({ type: 'file', path: '.practice/b-2-plan.txt', read: null, stamp: 'a' });
  assert.notEqual(f.state.beat.status, 'opening');
  const fileOut = f.key('r');
  assert.equal(f.state.beat.status, 'opening', 'a file beat');
  assert.deepEqual(ofType(fileOut, 'file'), [{ type: 'file', path: '.practice/b-2-plan.txt', asked: f.state.asks, dir: FACTS.root }]);
  const g = at('W7', { beat: 2 });
  g.send({ type: 'git', paths: ['notes.md'] });
  assert.equal(g.state.beat.status, 'fail');
  const gitOut = g.key('r');
  assert.equal(g.state.beat.status, 'opening', 'a git beat');
  assert.deepEqual(ofType(gitOut, 'git'), [{ type: 'git', asked: g.state.asks, dir: FACTS.root }]);
});

test('opening set by r ends only on r\'s own result: a poll result that lands first neither clears it nor says "press r"', () => {
  // A slow beat: the poll's run comes back with the slow item skipped.
  const d = at('C', { levels: ['hinted', 'challenge'] });
  const placeholder = { index: 0, text: passed.text, pass: false, slow: true, hint: '' };
  const slowFail = { ...passed, pass: false, hint: 'The tool exited with code 0, not 2.' };
  d.send({ type: 'check', lesson: 'b-1', items: [placeholder] });
  assert.equal(d.state.beat.slowWait, true);
  d.key('r');
  d.send({ type: 'check', lesson: 'b-1', items: [placeholder] });
  assert.equal(d.state.beat.status, 'opening', 'the poll ran first, while r\'s run waited');
  assert.equal(d.state.beat.slowWait, false, 'no "press r when you are ready" while r\'s run goes');
  d.send({ type: 'check', lesson: 'b-1', items: [slowFail], asked: d.state.beat.asked });
  assert.equal(d.state.beat.status, 'fail');
  assert.equal(d.state.beat.fail.hint, slowFail.hint);
  // An ordinary check beat.
  const w = at('W3');
  w.send({ type: 'check', lesson: 'b-1', items: [missing] });
  w.key('r');
  w.send({ type: 'check', lesson: 'b-1', items: [empty] });
  assert.equal(w.state.beat.status, 'opening');
  w.send({ type: 'check-error', lesson: 'b-1', message: 'it took too long' });
  assert.equal(w.state.beat.status, 'opening', 'a poll\'s error is not r\'s result either');
  w.send({ type: 'check', lesson: 'b-1', items: [empty], asked: w.state.beat.asked });
  assert.equal(w.state.beat.status, 'fail');
  w.key('r');
  w.send({ type: 'check-error', lesson: 'b-1', message: 'it took too long', asked: w.state.beat.asked });
  assert.equal(w.state.beat.status, 'broken');
  // After r's result, a poll's result counts as before.
  w.send({ type: 'check', lesson: 'b-1', items: [passed], read: Buffer.from('2.1.285 (Claude Code)\n') });
  assert.equal(w.state.beat.status, 'done');
  // A file beat and a git beat.
  const f = midway('b-2', 'W6', { beat: 2 });
  f.send({ type: 'file', path: '.practice/b-2-plan.txt', read: null, stamp: 'a' });
  f.key('r');
  f.send({ type: 'file', path: '.practice/b-2-plan.txt', read: Buffer.from('src/config.js'), stamp: 'b' });
  assert.equal(f.state.beat.status, 'opening');
  f.send({ type: 'file', path: '.practice/b-2-plan.txt', read: Buffer.from('src/config.js'), stamp: 'b', asked: f.state.beat.asked });
  assert.equal(f.state.beat.status, 'done');
  const g = at('W7', { beat: 2 });
  g.send({ type: 'git', paths: ['notes.md'] });
  g.key('r');
  g.send({ type: 'git', paths: [] });
  assert.equal(g.state.beat.status, 'opening');
  g.send({ type: 'git-error', message: 'git is busy' });
  assert.equal(g.state.beat.status, 'opening');
  g.send({ type: 'git', paths: [], asked: g.state.beat.asked });
  assert.equal(g.state.beat.status, 'done');
});

test('r\'s own result that lands while the map is open still ends its wait: back on the card, the next result decides', () => {
  const d = at('W3');
  d.send({ type: 'check', lesson: 'b-1', items: [missing] });
  d.key('r');
  const asked = d.state.beat.asked;
  d.key('m');
  assert.equal(d.state.view, 'map');
  d.send({ type: 'check', lesson: 'b-1', items: [missing], asked });
  const out = d.key('m');
  assert.equal(d.state.view, 'step');
  assert.equal(d.state.beat.status, 'opening', 'the map hid the result, so the card still waits for one');
  assert.deepEqual(ofType(out, 'check'), [{ type: 'check', lesson: 'b-1', items: [0], evidence: '.practice/version.txt', dir: FACTS.root }]);
  d.send({ type: 'check', lesson: 'b-1', items: [passed], read: Buffer.from('2.1.285 (Claude Code)\n') });
  assert.equal(d.state.beat.status, 'done', 'the check the map asked for decides');
});

test('r pressed twice: only the later r\'s result ends "Checking", not the earlier run\'s', () => {
  const d = at('W3');
  d.send({ type: 'check', lesson: 'b-1', items: [missing] });
  d.key('r');
  const first = d.state.beat.asked;
  d.key('r');
  const second = d.state.beat.asked;
  assert.ok(second > first);
  d.send({ type: 'check', lesson: 'b-1', items: [missing], asked: first });
  assert.equal(d.state.beat.status, 'opening', 'the earlier run saw the files before the later r');
  d.send({ type: 'check', lesson: 'b-1', items: [passed], read: Buffer.from('2.1.285 (Claude Code)\n'), asked: second });
  assert.equal(d.state.beat.status, 'done');
});

test('r over a "Not yet" keeps its hints: the open rung, the ladder h climbs and the y/n stay as they were while r\'s run goes', () => {
  const d = at('W3');
  d.send({ type: 'check', lesson: 'b-1', items: [missing] });
  d.key('r');
  d.send({ type: 'check', lesson: 'b-1', items: [missing], asked: d.state.beat.asked });
  assert.equal(d.state.beat.status, 'fail');
  const ladder = rungsOf(d.state);
  assert.deepEqual(ladder.map((r) => r.kind), ['ask', 'check', 'quote', 'bottom']);
  d.key('h');
  assert.equal(d.state.beat.rung, 0);
  d.key('r');
  d.key('r');
  assert.equal(d.state.beat.status, 'opening');
  assert.deepEqual(rungsOf(d.state), ladder, 'the same ladder, after a second r too');
  assert.equal(d.state.beat.rung, 0, 'the open rung stays');
  assert.ok(hintAvailable(d.state));
  d.key('h');
  assert.equal(d.state.beat.rung, 1, 'h climbs the same ladder');
  d.key('h');
  d.key('h');
  assert.equal(d.state.beat.confirm, true, 'the y/n comes where the ladder\'s exact command is');
  assert.equal(d.state.beat.rung, ladder.length - 2);
  d.key('y');
  assert.equal(d.state.beat.rung, ladder.length - 1);
  assert.equal(rungsOf(d.state)[d.state.beat.rung].kind, 'bottom');
  d.send({ type: 'check', lesson: 'b-1', items: [missing], asked: d.state.beat.asked });
  assert.equal(d.state.beat.status, 'fail');
  assert.equal(d.state.beat.rung, ladder.length - 1, 'the same FAIL keeps the exact command open');
});

// Recall, then compare (152, design D8 (a)): the next screen asks for the
// lesson's card entries from memory, and space shows them. Nothing is
// judged or saved, and enter never waits for it.
const onNext = (id) => {
  const d = driver({ course, saved: { format: 1, welcomed: true, lessons: finishedBefore(id) } });
  playUntil(d, (s) => s.view === 'next' && s.lesson === id);
  return d;
};

test('recall, then compare: space on the next screen shows the lesson\'s entries, and enter goes on with or without it', () => {
  const d = onNext('b-4');
  const before = snapshot(d.state);
  assert.deepEqual(d.key('space').filter((e) => e.type === 'save'), [], 'space saves nothing');
  assert.equal(d.state.overlay, 'compare');
  assert.deepEqual(snapshot(d.state), before, 'nothing new is saved');
  // Enter from the comparison goes on to the next lesson, as from the next screen.
  d.key('enter');
  assert.equal(d.state.overlay, null);
  assert.equal(d.state.lesson, 'b-5');
  assert.equal(d.state.view, 'intro');
  // Enter never waits: with no space, it goes on at once.
  const e = onNext('b-4');
  e.key('enter');
  assert.equal(e.state.lesson, 'b-5');
  assert.equal(e.state.view, 'intro');
  // Space again closes the comparison, back on the next screen.
  const f = onNext('b-4');
  f.key('space');
  f.key('space');
  assert.equal(f.state.overlay, null);
  assert.equal(f.state.view, 'next');
  assert.deepEqual(snapshot(f.state), before);
});

// A command typed fast, then enter, as a person types it into the wrong window.
const typed = (d, text) => {
  for (const c of text) d.send({ type: 'key', name: c, ch: c, wait: 60 });
  d.send({ type: 'key', name: 'enter', wait: 60 });
  d.send({ type: 'flush', wait: DEFER_MS + 50 });
};

test('recall, then compare: a command typed into this window does not act, on the next screen or with the comparison open', () => {
  for (const text of ['/resume', '/init', '/help']) {
    const bare = onNext('b-4');
    typed(bare, text);
    assert.equal(bare.state.view, 'next', text);
    assert.equal(bare.state.lesson, 'b-4', text);
    const open = onNext('b-4');
    open.key('space');
    typed(open, text);
    assert.equal(open.state.lesson, 'b-4', `${text}: the comparison's enter went on`);
    assert.equal(open.state.view, 'next', text);
    assert.equal(open.state.toast?.kind, 'stray', text);
    // Once the typing stops, enter goes on.
    open.key('enter');
    assert.equal(open.state.lesson, 'b-5', text);
  }
});

test('recall, then compare: escape goes back, the capstone\'s enter goes on as its next screen does, and a lesson with nothing on the card asks nothing', () => {
  const d = onNext('b-4');
  d.key('space');
  d.key('escape');
  assert.equal(d.state.overlay, null);
  assert.equal(d.state.view, 'next');
  assert.equal(d.state.lesson, 'b-4');
  // From the comparison, enter goes where the next screen's does: the
  // Beginner capstone's to i-1, its next.
  const cap = onNext('b-capstone');
  cap.key('space');
  assert.equal(cap.state.overlay, 'compare');
  cap.key('enter');
  assert.equal(cap.state.overlay, null);
  assert.deepEqual([cap.state.view, cap.state.lesson], ['intro', 'i-1']);
  // After a lesson with no next, it opens the map, as from the next screen.
  const last = course.map((l) => (l.id === 'b-capstone' ? { ...l, content: { ...l.content, next: undefined } } : l));
  const end = driver({ course: last, saved: { format: 1, welcomed: true, lessons: finishedBefore('b-capstone', last) } });
  playUntil(end, (s) => s.view === 'next' && s.lesson === 'b-capstone');
  end.key('space');
  assert.equal(end.state.overlay, 'compare');
  end.key('enter');
  assert.equal(end.state.overlay, null);
  assert.equal(end.state.view, 'map');
  // With no entry of this lesson's on the card, space does nothing.
  const bare = course.map((l) => (l.id === 'b-4' ? { ...l, content: { ...l.content, card: [] } } : l));
  const e = driver({ course: bare, saved: { format: 1, welcomed: true, lessons: finishedBefore('b-4') } });
  playUntil(e, (s) => s.view === 'next' && s.lesson === 'b-4');
  e.key('space');
  assert.equal(e.state.overlay, null);
  assert.equal(e.state.view, 'next');
});

// ---- beats that read what a file holds (ticket 87) ---------------------------
const parseError = (text) => {
  try {
    JSON.parse(text);
  } catch (error) {
    return error.message;
  }
};

test('json: done once the file parses and holds the key; the not-yet line names the parse error or the missing key; the evidence is the key and its value (r27 E12)', () => {
  const path = '.claude/settings.json';
  const d = onReading(`json ${path} permissions.deny`);
  assert.deepEqual(watching(d.state), { file: path, dir: FACTS.root });
  assert.match(tryNow(d, path, null).fail.hint, /\.claude\/settings\.json is not there yet/);
  const broken = '{"permissions": {"deny": [] ';
  const st = tryNow(d, path, broken);
  assert.equal(st.status, 'fail');
  assert.ok(st.fail.hint.includes(parseError(broken)), st.fail.hint);
  assert.match(tryNow(d, path, '{"permissions": {"allow": []}}').fail.hint, /\.claude\/settings\.json has no permissions\.deny yet/);
  const done = tryNow(d, path, '{\n  "permissions": {\n    "deny": ["Read(./.env)"]\n  }\n}\n');
  assert.equal(done.status, 'done');
  assert.equal(done.evidence, 'permissions.deny = ["Read(./.env)"]');
});

test('json with a value: done once the key equals it, as text or as JSON; the not-yet line names the key and what it holds', () => {
  const path = '.practice/a-4-run.json';
  const d = onReading(`json ${path} subtype=success`);
  assert.equal(tryNow(d, path, '{"type": "result", "subtype": "error_max_turns"}').fail.hint, '.practice/a-4-run.json has subtype error_max_turns, not success, yet.');
  const done = tryNow(d, path, '{"type": "result", "subtype": "success"}');
  assert.equal(done.status, 'done');
  assert.equal(done.evidence, 'subtype = success');
  const flag = onReading(`json ${path} is_error=false`);
  assert.equal(tryNow(flag, path, '{"is_error": true}').status, 'fail');
  assert.equal(tryNow(flag, path, '{"is_error": false}').status, 'done');
});

test('json, match and no-match take fresh and fresh since: what an earlier step left passes only once the file changes', () => {
  const path = '.claude/settings.json';
  const text = '{"permissions": {"deny": ["Read(./.env)"]}}';
  for (const verify of [`json ${path} permissions.deny fresh`, `match ${path} deny fresh since W1`, `no-match ${path} allow fresh since W1`]) {
    const d = onReading(verify, { stamps: { 'Y1.0': 'a' } });
    assert.equal(beatOf(d.state).verify.fresh, true, verify);
    const st = tryNow(d, path, text, 'a');
    assert.equal(st.status, 'waiting', `${verify}: the file as the step found it`);
    assert.equal(st.stale, true, verify);
    assert.equal(tryNow(d, path, text, 'b').status, 'done', `${verify}: once it changed`);
  }
  assert.equal(onReading(`match ${path} deny fresh since W1`).state.course.find((l) => l.id === 'b-2').content.steps.find((x) => x.id === 'Y1').beats[0].verify.since, 'W1');
});

// A file holding `text` as main reads it: its bytes and its stamp. The same
// text is the same file, left as it was, unless saved again at `mtime`.
const asRead = (text, mtime = 1000) => ({ read: Buffer.from(text), stamp: stampFor(mtime, Buffer.from(text)) });
const LOG = '.practice/i-2-loaded.txt';

test('fresh match on a log that only grew: a line an earlier attempt left passes nothing until this attempt appends one, and the evidence is that line', () => {
  const old = 'loaded: CLAUDE.md\n';
  // Saved at the step's opening, so a restart mid-step judges the same way.
  const d = onReading(`match ${LOG} ^loaded: fresh`, { stamps: { 'Y1.0': asRead(old).stamp } });
  const look = (text) => {
    d.send({ type: 'file', path: LOG, ...asRead(text) });
    return d.state.beat;
  };
  assert.equal(look(old).status, 'waiting');
  const started = `${old}session started\n`;
  assert.equal(look(started).status, 'waiting', 'the new session wrote its first line');
  const done = look(`${started}loaded: .claude/rules/style.md\n`);
  assert.equal(done.status, 'done');
  assert.equal(done.evidence, 'loaded: .claude/rules/style.md');
});

test('fresh match and no-match on a log that only grew: the not-yet line is about what was added', () => {
  const old = 'loaded: CLAUDE.md\n';
  const started = `${old}session started\n`;
  const d = onReading(`match ${LOG} ^loaded: fresh`, { stamps: { 'Y1.0': asRead(old).stamp } });
  assert.equal(tryNow(d, LOG, started, asRead(started).stamp).fail.hint, '.practice/i-2-loaded.txt has no new line like that yet.');
  const no = onReading(`no-match ${LOG} ^loaded: fresh`, { stamps: { 'Y1.0': asRead(old).stamp } });
  no.send({ type: 'file', path: LOG, ...asRead(old) });
  assert.equal(no.state.beat.status, 'waiting', 'nothing added yet');
  assert.equal(tryNow(no, LOG, started, asRead(started).stamp).status, 'done', 'the line from before is not read');
  const again = onReading(`no-match ${LOG} ^loaded: fresh`, { stamps: { 'Y1.0': asRead(started).stamp } });
  const loaded = `${started}loaded: .claude/rules/style.md\n`;
  assert.equal(tryNow(again, LOG, loaded, asRead(loaded).stamp).fail.hint, '.practice/i-2-loaded.txt still has: loaded: .claude/rules/style.md');
});

test('fresh match on a log that was rewritten: the whole file is read', () => {
  const old = 'loaded: CLAUDE.md\nsession ended\n';
  // Longer than before but not starting with it, and shorter.
  for (const [now, line] of [['loaded: AGENTS.md\nsession ended\nsession started\n', 'loaded: AGENTS.md'], ['loaded: CLAUDE.md\n', 'loaded: CLAUDE.md']]) {
    const d = onReading(`match ${LOG} ^loaded: fresh`, { stamps: { 'Y1.0': asRead(old).stamp } });
    d.send({ type: 'file', path: LOG, ...asRead(old) });
    assert.equal(d.state.beat.status, 'waiting');
    d.send({ type: 'file', path: LOG, ...asRead(now) });
    assert.equal(d.state.beat.status, 'done', JSON.stringify(now));
    assert.equal(d.state.beat.evidence, line);
  }
});

test('fresh since a step on a log that only grew: what was added since that step opened is read', () => {
  const old = 'loaded: CLAUDE.md\n';
  const grown = `${old}loaded: .claude/rules/style.md\n`;
  const onY1 = (fresh) => {
    const text = DEMO_B2.replace('- verify: check 0\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt', `- verify: file ${LOG}`)
      .replace('- verify: check 0 fresh\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt', `- verify: match ${LOG} ^loaded: ${fresh}`);
    const d = driver({ course: courseWith({ 'b-2': text }), saved: { format: 1, welcomed: true, lessons: { 'b-1': b1Done, 'b-2': { warm: ['R1'], step: 'R1', beat: 0 } } } });
    d.key('enter');
    d.key('1');
    d.key('enter');
    assert.equal(stepOf(d.state).id, 'W1');
    // Each step's opening stamps the log as it is then: W1's holds the old line.
    for (const e of d.effects.filter((x) => x.type === 'stamp')) d.send({ type: 'stamp', key: e.key, stamp: asRead(old).stamp });
    // During W1 the log grows.
    d.send({ type: 'file', path: LOG, ...asRead(grown) });
    for (let i = 0; i < 3 && !(d.state.view === 'step' && stepOf(d.state).id === 'Y1'); i++) d.key('enter');
    assert.equal(stepOf(d.state).id, 'Y1');
    for (const e of d.effects.filter((x) => x.type === 'stamp' && !(x.key in d.state.progress['b-2'].stamps))) d.send({ type: 'stamp', key: e.key, stamp: asRead(grown).stamp });
    d.send({ type: 'file', path: LOG, ...asRead(grown) });
    return d;
  };
  const since = onY1('fresh since W1').state.beat;
  assert.equal(since.status, 'already', 'the line came before Y1 opened');
  assert.equal(since.evidence, 'loaded: .claude/rules/style.md');
  const plain = onY1('fresh');
  assert.equal(plain.state.beat.status, 'waiting', 'Y1 opened on the grown log: nothing added since');
  const later = `${grown}session ended\n`;
  assert.equal(tryNow(plain, LOG, later, asRead(later).stamp).fail.hint, '.practice/i-2-loaded.txt has no new line like that yet.');
});

test('fresh match before its stamp lands: the read that sets the stamp is judged as every later one, and a look that turns done differs', () => {
  const old = 'loaded: CLAUDE.md\n';
  // No stamp saved: the first read is the step's opening.
  const d = onReading(`match ${LOG} ^loaded: fresh`);
  d.send({ type: 'file', path: LOG, ...asRead(old) });
  assert.equal(d.state.beat.status, 'waiting');
  assert.equal(d.state.beat.baseline, '.practice/i-2-loaded.txt has no new line like that yet.');
  const started = `${old}session started\n`;
  d.send({ type: 'file', path: LOG, ...asRead(started) });
  assert.equal(d.state.beat.status, 'waiting', 'a line that does not match is no "not yet"');
  assert.equal(d.state.fx.changed, false);
  d.send({ type: 'file', path: LOG, ...asRead(`${started}loaded: .claude/rules/style.md\n`) });
  assert.equal(d.state.beat.status, 'done');
  assert.equal(d.state.beat.evidence, 'loaded: .claude/rules/style.md');
  assert.equal(d.state.fx.changed, true, 'the look reads what the beat reads');
});

test('fresh no-match on a file saved with the same bytes: the line it forbids still counts', () => {
  const path = '.claude/settings.json';
  const kept = 'deny: rm\n';
  const d = onReading(`no-match ${path} ^deny: fresh`, { stamps: { 'Y1.0': asRead(kept).stamp } });
  d.send({ type: 'file', path, ...asRead(kept) });
  assert.equal(d.state.beat.status, 'waiting');
  const touched = tryNow(d, path, kept, asRead(kept, 2000).stamp);
  assert.equal(touched.status, 'fail');
  assert.equal(touched.fail.hint, '.claude/settings.json still has: deny: rm');
});

test('match: done once a line matches, front matter included, and the evidence is that line', () => {
  const path = '.claude/skills/tdd/SKILL.md';
  const d = onReading(`match ${path} ^disable-model-invocation: true$`);
  assert.deepEqual(watching(d.state), { file: path, dir: FACTS.root });
  assert.equal(tryNow(d, path, null).fail.hint, '.claude/skills/tdd/SKILL.md is not there yet.');
  assert.equal(tryNow(d, path, '---\nname: tdd\n---\n\nWrite the test first.\n').fail.hint, '.claude/skills/tdd/SKILL.md has no line like that yet.');
  const done = tryNow(d, path, '---\nname: tdd\r\ndisable-model-invocation: true\r\n---\n\nWrite the test first.\n');
  assert.equal(done.status, 'done');
  assert.equal(done.evidence, 'disable-model-invocation: true');
});

test('no-match: done once the file is there and no line matches; the not-yet line names the line that does', () => {
  const path = '.claude/skills/tdd/SKILL.md';
  const d = onReading(`no-match ${path} \\bTODO\\b`);
  assert.equal(tryNow(d, path, null).fail.hint, '.claude/skills/tdd/SKILL.md is not there yet.', 'a missing file is not done');
  assert.equal(tryNow(d, path, '---\nname: tdd\n---\n\n  - TODO: write the steps\n').fail.hint, '.claude/skills/tdd/SKILL.md still has: - TODO: write the steps');
  assert.equal(tryNow(d, path, '---\nname: tdd\n---\n\nTODOS are words, not a TODO-free line.\n').status, 'fail', 'TODO- still matches \\bTODO\\b');
  assert.equal(tryNow(d, path, '---\nname: tdd\n---\n\nWrite the test first.\n').status, 'done');
});

test('evidence skips a leading front matter block and lines that are only ---, { or [, for a file beat, a check and json', () => {
  const skill = '---\nname: tdd\ndescription: Test first.\n---\n\n# Test-driven development\n';
  const file = onReading('file .claude/agents/reviewer.md');
  tryNow(file, '.claude/agents/reviewer.md', null);
  // It shows the first line that says something, and counts every line.
  assert.equal(tryNow(file, '.claude/agents/reviewer.md', '---\nname: reviewer\n---\nReview the diff.\nThen say what is wrong.\n').evidence, 'Review the diff. and 4 more lines');
  // A check beat: the evidence is its evidence file's, as main read it.
  const check = driver({ course: courseWith({ 'b-2': DEMO_B2 }), saved: { format: 1, welcomed: true, lessons: { 'b-1': b1Done, 'b-2': { warm: ['R1', 'R2', 'R3'], done: ['R1', 'R2', 'R3'], step: 'W1', beat: 0 } } } });
  check.key('enter');
  assert.equal(stepOf(check.state).id, 'W1');
  check.send({ type: 'check', lesson: 'b-2', items: [{ index: 0, text: 'x', pass: true, hint: '' }], read: Buffer.from(skill), path: '.practice/b-2-before.txt' });
  assert.equal(check.state.beat.evidence, '# Test-driven development');
  const json = onReading('json .mcp.json');
  tryNow(json, '.mcp.json', null);
  assert.equal(tryNow(json, '.mcp.json', '{\n  "mcpServers": {}\n}\n').evidence, '"mcpServers": {}');
  const list = onReading('json .practice/list.json');
  tryNow(list, '.practice/list.json', null);
  assert.equal(tryNow(list, '.practice/list.json', '[\n  {\n    "id": 1\n  }\n]\n').evidence, '"id": 1');
  // With no closing line it is no front matter: only the --- line goes.
  const open = onReading('file notes.md');
  tryNow(open, 'notes.md', null);
  assert.equal(tryNow(open, 'notes.md', '---\nname: tdd\n').evidence, 'name: tdd and 1 more line');
});

test('a file beat is done once its file holds any line, front matter or a lone --- included; a file that only opens a block shows that line', () => {
  const path = '.claude/skills/tdd/SKILL.md';
  const d = onReading(`file ${path}`);
  tryNow(d, path, null);
  const st = tryNow(d, path, '---\nname: tdd\ndescription: x\n---\n');
  assert.equal(st.status, 'done');
  assert.equal(st.evidence, 'name: tdd and 3 more lines');
  const lone = onReading('file notes.md');
  tryNow(lone, 'notes.md', null);
  assert.equal(tryNow(lone, 'notes.md', '\n---\n').evidence, '---');
  const blank = onReading('file notes.md');
  assert.equal(tryNow(blank, 'notes.md', ' \n\n').fail.hint, 'notes.md has no line in it yet.');
  // A missing file is not there yet, not a file with no line (r27 E1).
  const gone = onReading('file notes.md');
  assert.equal(tryNow(gone, 'notes.md', null).fail.hint, 'notes.md is not there yet.');
});

test('a json key path follows an array only by its indexes: length is no key of one', () => {
  const path = '.claude/settings.json';
  const d = onReading(`json ${path} permissions.deny.length`);
  assert.equal(tryNow(d, path, '{"permissions": {"deny": []}}').fail.hint, '.claude/settings.json has no permissions.deny.length yet.');
  const first = onReading(`json ${path} permissions.deny.0`);
  assert.equal(tryNow(first, path, '{"permissions": {"deny": []}}').status, 'fail');
  assert.equal(tryNow(first, path, '{"permissions": {"deny": ["Read(./.env)"]}}').evidence, 'permissions.deny.0 = Read(./.env)');
  const map = onReading(`json ${path} env.length`);
  assert.equal(tryNow(map, path, '{"env": {"length": "3"}}').evidence, 'env.length = 3', 'an object may hold a key named length');
});

test('what the screen shows of a file is one row: no line break, tab or escape sequence, and one emoji at most', () => {
  const path = '.claude/settings.json';
  // V8's parse error quotes the file, line breaks and all.
  const broken = onReading(`json ${path} permissions.deny`);
  const hint = tryNow(broken, path, 'deny:\n{\n  "permissions": {}\n}\n').fail.hint;
  assert.match(hint, /^\.claude\/settings\.json does not parse as JSON yet \(/);
  assert.doesNotMatch(hint, /\p{Cc}/u, hint);
  const value = onReading('json .practice/i-2-hook.json prompt');
  assert.equal(tryNow(value, '.practice/i-2-hook.json', '{"prompt": "line one\\nline two\\tthree"}').evidence, 'prompt = line one line two three');
  const match = onReading('match notes.md TODO');
  assert.equal(tryNow(match, 'notes.md', 'a\tTODO \x1b[31mred\x1b[0m\r\n').evidence, 'a TODO red');
  const no = onReading('no-match notes.md TODO');
  assert.equal(tryNow(no, 'notes.md', 'TODO \x1b[2J\x07X 🚀 ship 🎉 it\n').fail.hint, 'notes.md still has: TODO X 🚀 ship * it');
  const file = onReading('file notes.md');
  tryNow(file, 'notes.md', null);
  assert.equal(tryNow(file, 'notes.md', '\x1b]8;;https://example.com\x07link\x1b]8;;\x07 text\n').evidence, 'link text');
});

// A PNG's first bytes: the signature, then its IHDR chunk, 800 by 600.
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000320000002580806000000', 'hex');
test('json, match and no-match on a binary file: not yet, and the line names its kind and size, never its bytes', () => {
  const path = '.practice/i-7-page.png';
  const png = Buffer.concat([PNG, Buffer.from('TODO {}'), Buffer.alloc(3000, 7)]);
  for (const verify of [`json ${path}`, `match ${path} PNG`, `no-match ${path} TODO`]) {
    const d = onReading(verify);
    d.key('r');
    d.send({ type: 'file', path, read: png, stamp: 'b', asked: d.state.beat.asked });
    assert.equal(d.state.beat.status, 'fail', verify);
    assert.equal(d.state.beat.fail.hint, '.practice/i-7-page.png is not a text file yet: it holds a PNG image, 800 x 600.', verify);
    assert.equal(d.state.beat.evidence ?? null, null, verify);
  }
});
test('a binary file\'s evidence is its kind and size, never its bytes: a PNG is an image and its size', () => {
  const path = '.practice/i-7-page.png';
  const d = onReading(`file ${path}`);
  tryNow(d, path, null);
  d.key('r');
  d.send({ type: 'file', path, read: Buffer.concat([PNG, Buffer.alloc(3000, 7)]), stamp: 'b', asked: d.state.beat.asked });
  assert.equal(d.state.beat.status, 'done');
  assert.equal(d.state.beat.evidence, 'a PNG image, 800 x 600');
  const other = onReading('file .practice/blob.bin');
  tryNow(other, '.practice/blob.bin', null);
  other.key('r');
  other.send({ type: 'file', path: '.practice/blob.bin', read: Buffer.concat([Buffer.from('\x00\x01text'), Buffer.alloc(2042, 0)]), stamp: 'b', asked: other.state.beat.asked });
  assert.equal(other.state.beat.evidence, 'binary data, 2 KB');
  // A check's evidence file too.
  const check = driver({ course: courseWith({ 'b-2': DEMO_B2 }), saved: { format: 1, welcomed: true, lessons: { 'b-1': b1Done, 'b-2': { warm: ['R1', 'R2', 'R3'], done: ['R1', 'R2', 'R3'], step: 'W1', beat: 0 } } } });
  check.key('enter');
  check.send({ type: 'check', lesson: 'b-2', items: [{ index: 0, text: 'x', pass: true, hint: '' }], read: Buffer.from('\x00\x00\x00'), path: '.practice/b-2-before.txt' });
  assert.equal(check.state.beat.evidence, 'binary data, 3 bytes');
});

test('a Your turn step that json, match or no-match verifies counts as checked: the last one gets a notch less help, as a check step does', () => {
  assert.equal(tierOf(onReading('check 0').state), 'challenge');
  for (const verify of ['json .mcp.json mcpServers', 'match CLAUDE.md ^@', 'no-match SKILL.md TODO']) {
    assert.equal(tierOf(onReading(verify).state), 'challenge', verify);
  }
});

test('h at CHALLENGE: on a json, match or no-match beat, r is the try', () => {
  for (const verify of ['json .mcp.json mcpServers', 'match CLAUDE.md ^@', 'no-match SKILL.md TODO']) {
    const path = verify.split(' ')[1];
    const d = onReading(`${verify}\n- hint: "Open the file."`);
    assert.equal(tierOf(d.state), 'challenge', verify);
    d.key('h');
    assert.deepEqual([d.state.toast?.kind, d.state.toast?.try], ['hintsLater', 'r'], verify);
    assert.equal(d.state.beat.rung, -1, `${verify}: nothing opens before a try`);
    tryNow(d, path, null);
    d.key('h');
    assert.equal(d.state.beat.rung, 0, verify);
  }
});

test('a "Done when" in the app\'s words may stand on a json, match or no-match beat, as on a file beat', () => {
  for (const verify of ['json .mcp.json mcpServers', 'match CLAUDE.md ^@', 'no-match SKILL.md TODO']) {
    const d = onReading(`${verify}\n- say: Done when the file has it.`);
    assert.deepEqual(beatOf(d.state).lines.filter((x) => x.doneWhen).map((x) => x.text), ['Done when the file has it.'], verify);
  }
});

// ---- git status for part of the tree (ticket 88) -----------------------------
test('git-clean with paths: done once git status lists nothing under them, whatever else it lists', () => {
  const d = onReading('git-clean secrets/ package-lock.json');
  assert.deepEqual(beatOf(d.state).verify, { kind: 'git-clean', paths: ['secrets/', 'package-lock.json'] });
  // It asks git for every untracked file, not just its folder.
  assert.deepEqual(d.effects.filter((e) => e.type === 'git').at(-1), { type: 'git', dir: FACTS.root, files: true });
  d.send(gitLists(['README.md', 'secrets/key.txt', 'package-lock.json']));
  assert.equal(d.state.beat.status, 'fail');
  assert.deepEqual(d.state.beat.fail.paths, ['secrets/key.txt', 'package-lock.json']);
  // A name that only starts like a path is not under it.
  d.send(gitLists(['README.md', 'secrets-old.txt', 'package-lock.json.bak', '.claude/skills/five-whys/SKILL.md']));
  assert.equal(d.state.beat.status, 'done');
  // Without paths, it is the whole tree, as before.
  const whole = onReading('git-clean');
  assert.deepEqual(beatOf(whole.state).verify, { kind: 'git-clean' });
  assert.deepEqual(whole.effects.filter((e) => e.type === 'git').at(-1), { type: 'git', dir: FACTS.root });
  whole.send({ type: 'git', paths: ['README.md'] });
  assert.equal(whole.state.beat.status, 'fail');
});

test('git-clean with paths: a result that lists untracked folders whole decides nothing, nor does a whole-tree beat take one that lists each file', () => {
  const d = onReading('git-clean .claude/settings.local.json');
  // git lists the untracked .claude/ whole: whether the file is in it can't be told.
  d.send({ type: 'git', paths: ['.claude/'] });
  assert.equal(d.state.beat.status, 'opening');
  d.send(gitLists(['.claude/skills/five-whys/SKILL.md']));
  assert.equal(d.state.beat.status, 'done');
  const whole = onReading('git-clean');
  whole.send(gitLists([]));
  assert.equal(whole.state.beat.status, 'opening');
  whole.send({ type: 'git', paths: [] });
  assert.equal(whole.state.beat.status, 'done');
});

test('git-changed: done once git status lists something under the path; the first answer is where the learner starts, with no "not yet"', () => {
  const d = onReading('git-changed src/');
  assert.deepEqual(beatOf(d.state).verify, { kind: 'git-changed', path: 'src/' });
  assert.deepEqual(d.effects.filter((e) => e.type === 'git').at(-1), { type: 'git', dir: FACTS.root, files: true });
  d.send(gitLists(['README.md', 'srcs/a.js']));
  assert.equal(d.state.beat.status, 'waiting');
  d.key('r');
  d.send(gitLists(['README.md'], [], { asked: d.state.beat.asked }));
  assert.equal(d.state.beat.status, 'fail');
  assert.equal(d.state.beat.fail.hint, 'git status lists no change under src/ yet.');
  d.send(gitLists(['README.md', 'src/config.js', 'src/new/']));
  assert.equal(d.state.beat.status, 'done');
  assert.equal(d.state.beat.evidence, 'Changed: src/config.js, src/new/');
  // A change there already when the step opens counts, as a check that already passes does.
  const already = onReading('git-changed src');
  already.send(gitLists(['src/a.js', 'src/b.js', 'src/c.js', 'src/d.js']));
  assert.equal(already.state.beat.status, 'already');
  assert.equal(already.state.beat.evidence, 'Changed: src/a.js, src/b.js, src/c.js and 1 more');
  // A whole-tree result decides nothing.
  const whole = onReading('git-changed src/');
  whole.send({ type: 'git', paths: ['src/'] });
  assert.equal(whole.state.beat.status, 'opening');
});

test('git-only: done once git status lists something, all of it under the path; the not-yet line names what is outside', () => {
  const d = onReading('git-only .claude/');
  assert.deepEqual(beatOf(d.state).verify, { kind: 'git-only', path: '.claude/' });
  d.send(gitLists([]));
  assert.equal(d.state.beat.status, 'waiting');
  d.key('r');
  d.send(gitLists([], [], { asked: d.state.beat.asked }));
  assert.equal(d.state.beat.fail.hint, 'git status lists no change yet.');
  d.send(gitLists(['.claude/skills/five-whys/SKILL.md', 'README.md', '.claudeignore']));
  assert.equal(d.state.beat.status, 'fail');
  assert.equal(d.state.beat.fail.hint, '2 files changed outside .claude/: README.md, .claudeignore');
  d.send(gitLists(['.claude/skills/five-whys/SKILL.md', 'notes.md']));
  assert.equal(d.state.beat.fail.hint, '1 file changed outside .claude/: notes.md');
  d.send(gitLists(['.claude/skills/five-whys/SKILL.md', '.claude/skills/five-whys/notes.md']));
  assert.equal(d.state.beat.status, 'done');
  assert.equal(d.state.beat.evidence, 'Changed: .claude/skills/five-whys/SKILL.md, .claude/skills/five-whys/notes.md');
});

test('git-staged: done once git status says a path is staged; a change not yet added is not', () => {
  const d = onReading('git-staged');
  assert.deepEqual(beatOf(d.state).verify, { kind: 'git-staged' });
  assert.deepEqual(d.effects.filter((e) => e.type === 'git').at(-1), { type: 'git', dir: FACTS.root, files: true });
  d.send(gitLists(['src/config.js']));
  assert.equal(d.state.beat.status, 'waiting');
  d.key('r');
  d.send(gitLists(['src/config.js'], [], { asked: d.state.beat.asked }));
  assert.equal(d.state.beat.fail.hint, 'git status lists nothing staged yet.');
  d.send(gitLists(['src/config.js', 'test/config.test.js'], ['src/config.js']));
  assert.equal(d.state.beat.status, 'done');
  assert.equal(d.state.beat.evidence, 'Staged: src/config.js');
});

test('a Your turn step that git-clean on paths, git-changed, git-only or git-staged verifies counts as checked: the last one gets a notch less help', () => {
  assert.equal(tierOf(onReading('none').state), 'hinted', 'a step nothing checks keeps its tier');
  for (const verify of ['git-clean secrets/', 'git-changed src/', 'git-only .claude/', 'git-staged']) {
    assert.equal(tierOf(onReading(verify).state), 'challenge', verify);
  }
});

test('h at CHALLENGE on a git-changed, git-only or git-staged beat: r is the try; and git that could not run is not the learner\'s work', () => {
  for (const verify of ['git-changed src/', 'git-only .claude/', 'git-staged']) {
    const d = onReading(`${verify}\n- hint: "Look at git status."`);
    d.send(gitLists([]));
    d.key('h');
    assert.deepEqual([d.state.toast?.kind, d.state.toast?.try], ['hintsLater', 'r'], verify);
    d.key('r');
    d.send(gitLists([], [], { asked: d.state.beat.asked }));
    d.key('h');
    assert.equal(d.state.beat.rung, 0, verify);
    const broken = onReading(verify);
    broken.send({ type: 'git-error', message: 'git is not installed', dir: FACTS.root });
    assert.deepEqual([broken.state.beat.status, broken.state.beat.error], ['broken', 'git is not installed'], verify);
  }
});

test('playUntil plays through every git kind', () => {
  for (const verify of ['git-clean secrets/', 'git-changed src/', 'git-only .claude', 'git-staged']) {
    const d = onReading(verify);
    playUntil(d, (s) => stepOf(s)?.id === 'C');
  }
});

// ---- ways out when a check keeps failing for an earlier reason (ticket 192) --
const AFTER = '.practice/b-2-after.txt';
const b2Item = course.find((l) => l.id === 'b-2').items[1];
const afterSays = (hint) => [{ index: 1, text: b2Item, pass: false, hint }];
// b-2 on W7's last beat, the after snapshot, with the steps before it done
// and their fresh stamps saved.
const W7_STAMPS = { 'W6.1': 'S1', 'W6.2': 'S2', 'W7.4': 'S3' };
const onAfter = (extra = {}) => {
  const d = driver({ course, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore('b-2'), 'b-2': { step: 'W7', beat: 4, warm: ['R1', 'R2'], done: ['R1', 'R2', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6'], stamps: { ...W7_STAMPS }, ...extra } } } });
  d.key('enter');
  assert.deepEqual([stepOf(d.state).id, d.state.pos.beat], ['W7', 4]);
  return d;
};
// A result for the after item: its message, and the after file's state.
const says = (d, hint, stamp, extra = {}) => {
  d.send({ type: 'check', lesson: 'b-2', items: afterSays(hint), path: AFTER, stamp, ...extra });
  return d.state.beat;
};
// The first answer, then a FAIL on screen.
const failing = (d) => {
  says(d, 'After Claude finishes the edits, run it.', '');
  assert.equal(says(d, 'It lists no changed file yet.', 'a').status, 'fail');
  return d;
};

test('the same answer after a redo: the note follows the second identical FAIL with the file changed between them (192)', () => {
  const d = failing(onAfter());
  assert.equal(Boolean(d.state.beat.same), false, 'never at the first FAIL');
  assert.equal(Boolean(says(d, 'It lists no changed file yet.', 'a').same), false, 'a poll with the file as it was is no redo');
  d.key('r');
  assert.equal(Boolean(says(d, 'It lists no changed file yet.', 'a', { asked: d.state.beat.asked }).same), false, 'nor is r on the same file');
  assert.equal(says(d, 'It lists no changed file yet.', 'b').same, true, 'saved again, and the check says the same');
  assert.equal(d.state.beat.status, 'fail');
  assert.equal(says(d, 'It lists no changed file yet.', 'c').same, true, 'it stays while the check says the same');
  assert.equal(Boolean(says(d, 'Changed but not in the plan: src/a.js.', 'd').same), false, 'a new message takes it away');
  assert.equal(Boolean(says(d, 'Changed but not in the plan: src/a.js.', 'e').same), false, 'once a beat visit');
  // A new visit of the beat starts over.
  d.key('b');
  d.key('space');
  assert.deepEqual([stepOf(d.state).id, d.state.pos.beat], ['W7', 4]);
  failing(d);
  assert.equal(says(d, 'It lists no changed file yet.', 'b').same, true);
});

test('the same answer after a redo: not when the message changes, nor before a FAIL is on screen, nor with no file state (192)', () => {
  const d = failing(onAfter());
  assert.equal(Boolean(says(d, 'Changed but not in the plan: src/a.js.', 'b').same), false);
  // The first answer repeated with the file changed is still no "not yet",
  // so no note either: the learner never saw it.
  const quiet = onAfter();
  says(quiet, 'It lists no changed file yet.', '');
  assert.equal(says(quiet, 'It lists no changed file yet.', 'a').status, 'waiting');
  assert.equal(Boolean(quiet.state.beat.same), false);
  // A check beat that names no evidence file can't tell a redo from a poll.
  const b1 = at('W3');
  b1.send({ type: 'check', lesson: 'b-1', items: [missing] });
  b1.key('r');
  b1.send({ type: 'check', lesson: 'b-1', items: [missing], asked: b1.state.beat.asked });
  b1.send({ type: 'check', lesson: 'b-1', items: [missing] });
  assert.deepEqual([b1.state.beat.status, Boolean(b1.state.beat.same)], ['fail', false]);
});

test('the same answer after a redo: on a beat that reads its file too, with no back line to offer (192)', () => {
  const path = '.practice/b-2-plan.txt';
  const d = onReading(`match ${path} ^src/`);
  assert.equal(tryNow(d, path, null, '').fail.hint, `${path} is not there yet.`);
  d.send({ type: 'file', path, read: null, stamp: '' });
  assert.equal(Boolean(d.state.beat.same), false, 'still not there: nothing was redone');
  d.send({ type: 'file', path, read: Buffer.from(''), stamp: 'x1' });
  assert.equal(Boolean(d.state.beat.same), false, 'a new message');
  d.send({ type: 'file', path, read: Buffer.from('lib/a.js\n'), stamp: 'x2' });
  assert.equal(d.state.beat.fail.hint, `${path} has no line like that yet.`);
  assert.equal(d.state.beat.same, true);
  assert.equal(backOffered(d.state), null, 'the demo lesson names no step to go back to');
  const before = { ...d.state.pos };
  d.key('e');
  assert.deepEqual(d.state.pos, before, 'e does nothing where nothing is offered');
});

test('the back key: the note offers the step b-2\'s ladder names, and e goes there with every tick kept (192)', () => {
  const d = failing(onAfter());
  assert.equal(backOffered(d.state), null, 'not before the note');
  d.key('e');
  assert.deepEqual([stepOf(d.state).id, d.state.pos.beat], ['W7', 4], 'e does nothing before it is offered');
  says(d, 'It lists no changed file yet.', 'b');
  const back = backOffered(d.state);
  assert.deepEqual([back.step, back.at, back.title, back.quoted], ['W2', 3, 'Switch to plan mode', false]);
  const done = [...d.state.progress['b-2'].done];
  const from = d.effects.length;
  d.key('e');
  assert.equal(d.state.view, 'step');
  assert.deepEqual([stepOf(d.state).id, d.state.pos], ['W2', { step: 3, beat: 0 }]);
  assert.deepEqual(d.state.progress['b-2'].done, done, 'every done tick stays');
  assert.equal(d.state.progress['b-2'].step, 'W2', 'the place is saved there');
  assert.deepEqual(d.state.progress['b-2'].stamps, {}, 'the fresh checks from W2 on lose their stamps');
  const out = d.effects.slice(from);
  assert.ok(out.some((e) => e.type === 'save'));
  assert.ok(out.every((e) => ['later', 'save', 'stamp', 'check', 'file', 'git'].includes(e.type)), 'the app touches no file: every .practice/ file stays');
});

test('the back key: the hint ladder\'s last rung offers it too, and only from the part it names (192)', () => {
  const d = failing(onAfter());
  assert.equal(d.state.beat.rung, -1);
  for (let i = 0; i < 6 && !d.state.beat.confirm; i++) {
    d.key('h');
    if (!d.state.beat.confirm) assert.equal(backOffered(d.state), null, `rung ${d.state.beat.rung} is not the last`);
    d.send({ type: 'tick', wait: HINT_LOCK_MS + 100 });
  }
  assert.equal(backOffered(d.state), null, 'not on the y/n');
  d.key('y');
  assert.equal(d.state.beat.rung, rungsOf(d.state).length - 1);
  assert.equal(backOffered(d.state)?.step, 'W2');
  d.key('e');
  assert.equal(stepOf(d.state).id, 'W2');
  // Your turn redoes the example on its own: the after item's back line
  // names a Worked example step, so Y5 offers none.
  const y5 = driver({ course, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore('b-2'), 'b-2': { step: 'Y5', beat: 3, warm: ['R1', 'R2'], stamps: { 'Y5.3': 'S' } } } } });
  y5.key('enter');
  failing(y5);
  assert.equal(says(y5, 'It lists no changed file yet.', 'b').same, true);
  assert.equal(backOffered(y5.state), null);
});

test('the back key: with the note up, the y/n offers no e and e waits for its answer (192)', () => {
  const d = failing(onAfter());
  says(d, 'It lists no changed file yet.', 'b');
  assert.equal(backOffered(d.state)?.step, 'W2', 'the note offers it');
  for (let i = 0; i < 6 && !d.state.beat.confirm; i++) {
    d.key('h');
    d.send({ type: 'tick', wait: HINT_LOCK_MS + 100 });
  }
  assert.equal(d.state.beat.confirm, true);
  assert.equal(d.state.beat.same, true, 'the note is still up');
  assert.equal(backOffered(d.state), null, 'not on the y/n');
  d.key('e');
  assert.deepEqual([stepOf(d.state).id, d.state.pos.beat, d.state.beat.confirm], ['W7', 4, true], 'e does nothing on the y/n');
  d.key('n');
  assert.equal(backOffered(d.state)?.step, 'W2', 'after n the note offers it again');
  d.key('e');
  assert.equal(stepOf(d.state).id, 'W2');
});

test('the back key: the steps from there on check again as they are met, and a quit mid-way resumes there (192)', () => {
  const d = failing(onAfter());
  says(d, 'It lists no changed file yet.', 'b');
  d.key('e');
  playUntil(d, atStep('W4'));
  const r = reopen(d);
  assert.equal(stepOf(r.state).id, 'W4', 'the quit mid-way resumes where the learner was');
  assert.deepEqual(r.state.progress['b-2'].stamps, {});
  assert.deepEqual(r.state.progress['b-2'].done, ['R1', 'R2', 'W1', 'W2', 'W3', 'W4', 'W5', 'W6']);
  playUntil(r, (s) => s.view === 'step' && stepOf(s).id === 'W6' && s.pos.beat === 1);
  // W6 stamps its snapshot again as it opens, so the one the first pass
  // saved counts for nothing: the check waits for a new save.
  const stamp = r.effects.find((e) => e.type === 'stamp' && e.key === 'W6.1');
  assert.deepEqual(stamp, { type: 'stamp', key: 'W6.1', path: '.practice/b-2-before.txt', dir: FACTS.root });
  r.send({ type: 'stamp', key: 'W6.1', stamp: 'OLD', dir: FACTS.root });
  const pass = [{ index: 0, text: course.find((l) => l.id === 'b-2').items[0], pass: true, hint: '' }];
  r.send({ type: 'check', lesson: 'b-2', items: pass, path: '.practice/b-2-before.txt', stamp: 'OLD' });
  assert.deepEqual([r.state.beat.status, r.state.beat.stale], ['waiting', true], 'the snapshot from before the back waits');
  r.send({ type: 'check', lesson: 'b-2', items: pass, path: '.practice/b-2-before.txt', stamp: 'NEW' });
  assert.equal(r.state.beat.status, 'done', 'a new snapshot passes');
});

// ---- Your turn parts, Tear down steps and optional steps (ticket 102) -------
// DEMO_B2 with its Your turn in two parts, the second optional, and two Tear
// down steps after the Check, the last of which completes the lesson.
const PARTS_B2 = DEMO_B2
  .replace('next: b-3\n', 'next: b-3\nbadge: Tidy\n')
  .replace('### Y1 | Your turn step 1 of 1 | Save it again', '### Y1 | Your turn part 1 of 2 | Save it again')
  .replace('### C | Check | Check', `### Y2 | Your turn part 2 of 2 | Look around
- tier: challenge
- skill: look-around
- where: terminal
- optional: Skip this part in the cheap variant.
- beat: do
- verify: self
- done-label: it's done
- goal: "Look around."

### C | Check | Check`)
  .concat(`
### D1 | Tear down step 1 of 2 | Remove the snapshot
- tier: challenge
- skill: tear-down
- where: shell
- beat: do
- verify: self
- done-label: it's gone
- goal: "Remove the snapshot."

### D2 | Tear down step 2 of 2 | Check once more
- tier: challenge
- skill: tear-down
- where: terminal
- optional: Skip this step if the check already ran.
- beat: do
- verify: self
- done-label: it still passes
- goal: "Run the check once more."
`);
const partsCourse = () => courseWith({ 'b-2': PARTS_B2 });
const b2Saved = (extra = {}) => ({ format: 1, welcomed: true, lessons: { 'b-1': finished(course.find((l) => l.id === 'b-1')), 'b-2': { done: ['W1', 'Y1', 'Y2'], step: 'C', beat: 0, ...extra } } });
const onPartsB2 = (step, extra = {}) => {
  const d = driver({ course: partsCourse(), saved: b2Saved({ step, ...extra }) });
  d.key('enter');
  if (stepOf(d.state)?.id !== step) throw new Error(`onPartsB2: on ${d.state.view} ${stepOf(d.state)?.id}, not ${step}`);
  return d;
};
const screenText = (state, cols = 80, rows = 24, unicode = true) => render(state, { cols, rows }, theme({ tty: true, depth: unicode ? 8 : 1, unicode, links: false, win32: !unicode })).map(strip);
// Every line of the screen fits 60x20 and 80x24, in full color and in ASCII.
const fitsBoth = (state) => {
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    for (const unicode of [true, false]) {
      const lines = screenText(state, cols, rows, unicode);
      assert.equal(lines.length, rows);
      assert.ok(lines.every((l) => width(l) <= cols - 1), `${cols}x${rows}${unicode ? '' : ' ascii'}:\n${lines.join('\n')}`);
    }
  }
};

test('parts and Tear down: the headings parse, a part is own work, and D steps only follow the Check (102)', () => {
  const l = parseLesson(PARTS_B2, 'b-2.md');
  assert.deepEqual(l.steps.map((s) => [s.id, s.part, s.unit, s.n, s.of]), [
    ['W1', 'Worked example', 'step', 1, 1], ['Y1', 'Your turn', 'part', 1, 2], ['Y2', 'Your turn', 'part', 2, 2],
    ['C', 'Check', null, null, null], ['D1', 'Tear down', 'step', 1, 2], ['D2', 'Tear down', 'step', 2, 2],
  ]);
  assert.ok(OWN_PARTS.has(l.steps[1].part), 'a part is own work');
  const bad = (from, to) => assert.throws(() => parseLesson(PARTS_B2.replace(from, to), 'b-2.md'), Error, `${to}`);
  bad('### W1 | Worked example step 1 of 1', '### W1 | Worked example part 1 of 1');
  bad('### D1 | Tear down step 1 of 2', '### D1 | Tear down part 1 of 2');
  bad('### D1 | Tear down step 1 of 2', '### Y3 | Tear down step 1 of 2');
  bad('### Y2 | Your turn part 2 of 2', '### D9 | Your turn part 2 of 2');
  // A Tear down step before the Check, or a step after a Tear down step.
  const early = DEMO_B2.replace('### C | Check | Check', '### D1 | Tear down step 1 of 1 | Early\n- tier: challenge\n- skill: x\n- where: shell\n- beat: do\n- verify: self\n\n### C | Check | Check');
  assert.throws(() => parseLesson(early, 'b-2.md'), /a Tear down step only follows the Check/);
  const after = `${PARTS_B2}\n### Y3 | Your turn part 3 of 3 | Late\n- tier: challenge\n- skill: x\n- where: shell\n- beat: do\n- verify: self\n`;
  assert.throws(() => parseLesson(after, 'b-2.md'), /only Tear down steps follow the Check/);
});

test('parts and Tear down: a D id works wherever a step id does (102)', () => {
  const fresh = parseLesson(PARTS_B2.replace("- done-label: it's gone\n", "- verify: file .practice/gone.txt fresh since D1\n").replace("- beat: do\n- verify: self\n- verify: file", '- beat: do\n- verify: file'), 'b-2.md');
  assert.equal(fresh.steps.find((s) => s.id === 'D1').beats[0].verify.since, 'D1');
  const back = parseLesson(PARTS_B2.replace('- goal: "Run the check once more."', '- goal: "Run the check once more."\n- back: D1 Remove it first.'), 'b-2.md');
  assert.equal(back.steps.find((s) => s.id === 'D2').beats[0].back.step, 'D1');
  const saved = snapshot({ welcomed: true, eased: [], missed: [], progress: { 'b-2': { step: 'D2', bottomAt: 'D1', moreHelpAt: 'D2', done: ['D1'] } } });
  assert.deepEqual([saved.lessons['b-2'].step, saved.lessons['b-2'].bottomAt, saved.lessons['b-2'].moreHelpAt], ['D2', 'D1', 'D2']);
  const d = onPartsB2('D2', { done: ['W1', 'Y1', 'Y2', 'C', 'D1'] });
  assert.equal(stepOf(d.state).id, 'D2', 'a saved D step resumes');
});

test('parts and Tear down: the Check runs check all, and the lesson completes, badge and all, only after its last D step (102)', () => {
  const d = onPartsB2('C');
  assert.deepEqual(d.effects.find((e) => e.type === 'check'), { type: 'check', lesson: 'b-2', items: null, evidence: null, dir: FACTS.root });
  playUntil(d, (s) => s.view === 'step' && stepOf(s).id === 'D1');
  const p = d.state.progress['b-2'];
  assert.ok(p.done.includes('C'));
  assert.equal(p.complete, false, 'the Check passing does not complete the lesson');
  d.key('space');
  assert.equal(stepOf(d.state).id, 'D2');
  assert.equal(d.state.progress['b-2'].complete, false);
  assert.ok(!screenText(d.state).some((l) => l.includes(C.badge('Tidy'))));
  d.key('space');
  assert.equal(d.state.view, 'complete');
  assert.equal(d.state.progress['b-2'].complete, true);
  assert.deepEqual(d.state.progress['b-2'].done.slice(-3), ['C', 'D1', 'D2']);
  assert.ok(screenText(d.state).some((l) => l.includes(C.badge('Tidy'))), 'the badge comes after the last D step');
});

test('parts and Tear down: the map and the resume screen say the tear down is still to do (102)', () => {
  const d = driver({ course: partsCourse(), saved: b2Saved({ step: 'D1', done: ['W1', 'Y1', 'Y2', 'C'] }) });
  assert.equal(d.state.view, 'resume');
  assert.ok(tearDownLeft(d.state, 'b-2'));
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    const resume = screenText(d.state, cols, rows).join('\n');
    assert.ok(resume.replace(/\s+/g, ' ').includes(C.tearDownLeft), `${cols}x${rows} resume:\n${resume}`);
  }
  fitsBoth(d.state);
  d.key('m');
  assert.equal(d.state.view, 'map');
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    const map = screenText(d.state, cols, rows);
    const row = map.find((l) => l.includes(' B2 '));
    assert.ok(row?.includes(C.mapTearDown), `${cols}x${rows} map:\n${map.join('\n')}`);
  }
  fitsBoth(d.state);
  // Before the Check passes, and once the lesson is complete, it says nothing of it.
  assert.equal(tearDownLeft(driver({ course: partsCourse(), saved: b2Saved() }).state, 'b-2'), false);
  assert.equal(tearDownLeft(driver({ course: partsCourse(), saved: b2Saved({ complete: true, step: null }) }).state, 'b-2'), false);
});

test('optional steps: the card says when to skip, x skips, and skipping changes no eased or missed state (102)', () => {
  const l = parseLesson(PARTS_B2, 'b-2.md');
  assert.equal(l.steps.find((s) => s.id === 'Y2').optional, 'Skip this part in the cheap variant.');
  assert.throws(() => parseLesson(PARTS_B2.replace('- optional: Skip this part in the cheap variant.', '- optional: "Skip this part."'), 'b-2.md'), /optional holds the app's own words/);
  // The look-around skill waits to be eased, so Y2 opens eased.
  const d = driver({ course: partsCourse(), saved: { ...b2Saved({ step: 'Y2', done: ['W1', 'Y1'] }), eased: ['look-around'], missed: ['look-around'] } });
  d.key('enter');
  assert.equal(stepOf(d.state).id, 'Y2');
  assert.equal(d.state.progress['b-2'].easedSteps.Y2, true, 'the ease landed on Y2');
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    const card = screenText(d.state, cols, rows).map((l) => l.replace(/^\s*│|│\s*$/g, '')).join(' ').replace(/\s+/g, ' ');
    assert.ok(card.includes(C.optional('Skip this part in the cheap variant.')), `${cols}x${rows}: ${card}`);
  }
  assert.ok(screenText(d.state, 60, 20).join('\n').includes('x skip') || screenText(d.state, 80, 24).join('\n').includes('x skip'), 'the key bar offers x');
  fitsBoth(d.state);
  d.key('x');
  assert.equal(stepOf(d.state).id, 'C', 'x goes on to the next step');
  const p = d.state.progress['b-2'];
  assert.ok(!p.done.includes('Y2'), 'a skipped step is not done');
  assert.equal(p.easedSteps.Y2, undefined, 'the ease it took waits again');
  assert.deepEqual([d.state.eased, d.state.missed], [['look-around'], ['look-around']]);
  // x does nothing on a step that is not optional.
  d.key('x');
  assert.equal(stepOf(d.state).id, 'C');
  // Skipping the last step completes the lesson.
  const last = onPartsB2('D2', { done: ['W1', 'Y1', 'Y2', 'C', 'D1'] });
  last.key('x');
  assert.equal(last.state.view, 'complete');
  assert.equal(last.state.progress['b-2'].complete, true);
  assert.ok(!last.state.progress['b-2'].done.includes('D2'));
});

test('optional steps: ruleTiers never counts an optional step\'s skill (102)', () => {
  const contents = partsCourse().map((x) => x.content);
  const later = parseLesson(PARTS_B2.replace('lesson: b-2', 'lesson: b-3').replace('### W1 | Worked example step 1 of 1 | Save the list\n- tier: guided\n- skill: snapshot', '### W1 | Worked example step 1 of 1 | Save the list\n- tier: guided\n- skill: look-around'), 'b-3.md');
  const at = contents.findIndex((c) => c?.lesson === 'b-2') + 1;
  contents[at] = later;
  assert.equal(ruleTiers(contents, at)[0], 'guided', 'the optional Y2 of b-2 does not count toward look-around');
  const counted = [...contents];
  counted[at - 1] = parseLesson(PARTS_B2.replace('- optional: Skip this part in the cheap variant.\n', ''), 'b-2.md');
  assert.equal(ruleTiers(counted, at)[0], 'hinted', 'a step that is not optional counts');
});

// ---- a second session, the browser and long waits (ticket 103) ---------------
// DEMO_B2 with its terminals numbered as a page numbers them, and a Your
// turn step 2 that opens a run in the browser, then waits on it in the
// second Claude Code session until a local file says it ended.
const WAIT_B2 = DEMO_B2
  .replace('next: b-3\n', 'next: b-3\nterminals: [terminal claude, claude-2, shell]\n')
  .replace('### Y1 | Your turn step 1 of 1 | Save it again', '### Y1 | Your turn step 1 of 2 | Save it again')
  .replace('### C | Check | Check', `### Y2 | Your turn step 2 of 2 | Watch the run
- tier: challenge
- skill: long-run
- beat: do
- where: browser
- verify: none
- do: "Open the run."
- beat: do
- where: claude-2
- verify: file .practice/run.txt
- wait: long
- goal: "Wait for the run to finish."

### C | Check | Check`);
const onWaitB2 = (step, beat = 0, text = WAIT_B2) => {
  const d = driver({ course: courseWith({ 'b-2': text }), saved: { format: 1, welcomed: true, lessons: { 'b-1': finished(course.find((l) => l.id === 'b-1')), 'b-2': { done: ['W1', 'Y1'].slice(0, ['W1', 'Y1', 'Y2'].indexOf(step)), step, beat } } } });
  d.key('enter');
  if (stepOf(d.state)?.id !== step || d.state.pos.beat !== beat) throw new Error(`onWaitB2: on ${d.state.view} ${stepOf(d.state)?.id} beat ${d.state.pos.beat}`);
  return d;
};
const cardTop = (state, cols = 80, rows = 24, unicode = true) => screenText(state, cols, rows, unicode).find((l) => /[╭+]-/.test(l.trim().slice(0, 2)) || l.trim().startsWith('╭'));

test('a second session, the browser and long waits: the grammar (103)', () => {
  const l = parseLesson(WAIT_B2, 'b-2.md');
  assert.deepEqual(l.terminals, { terminal: 1, claude: 1, 'claude-2': 2, shell: 3 });
  const y2 = l.steps.find((s) => s.id === 'Y2');
  assert.deepEqual(y2.beats.map((b) => [b.where, b.verify.kind, b.wait ?? null]), [['browser', 'none', null], ['claude-2', 'file', { text: null }]]);
  assert.equal(parseLesson(DEMO_B2, 'b-2.md').terminals, null, 'without the key, nothing is numbered');
  const quoted = parseLesson(WAIT_B2.replace('- wait: long', '- wait: "The run can take several minutes."'), 'b-2.md');
  assert.deepEqual(quoted.steps.find((s) => s.id === 'Y2').beats[1].wait, { text: 'The run can take several minutes.' });
  const bad = (from, to, re) => assert.throws(() => parseLesson(WAIT_B2.replace(from, to), 'b-2.md'), re);
  bad('- wait: long', '- wait: a few minutes', /wait: long, or the page's words in quotes/);
  bad('- wait: long', '- wait: long\n- wait: long', /a second wait line/);
  bad('terminals: [terminal claude, claude-2, shell]', 'terminals: [terminal claude, claude-2, editor]', /editor is none of terminal, claude, claude-2, shell/);
  bad('terminals: [terminal claude, claude-2, shell]', 'terminals: [terminal claude, claude claude-2, shell]', /terminals names claude twice/);
  bad('terminals: [terminal claude, claude-2, shell]', 'terminals: [terminal claude, claude-2]', /where shell, which terminals doesn't number/);
  // A browser beat: self, or none with a later beat of its step that reads a local file.
  bad('- verify: file .practice/run.txt\n', '- verify: self\n', /a browser beat verifies with self, or with none and a later beat/);
  bad('- where: browser\n- verify: none', '- where: browser\n- verify: check 0', /a browser beat verifies with self/);
  assert.doesNotThrow(() => parseLesson(WAIT_B2.replace('- where: browser\n- verify: none', '- where: browser\n- verify: self'), 'b-2.md'));
  // A later git probe (105) reads only local refs: it may verify for the browser.
  assert.doesNotThrow(() => parseLesson(WAIT_B2.replace('- verify: file .practice/run.txt\n', '- verify: probe pushed\n'), 'b-2.md'));
  // The later beat must show whenever the browser beat does (104): not one
  // a when line may hide, unless the browser beat has the same when.
  const choiceFirst = (browserWhen, laterWhen) => WAIT_B2.replace('- skill: long-run\n- beat: do\n- where: browser', `- skill: long-run\n- beat: ask\n- ask: Which run?\n- option: CI\n- option: Local\n- beat: do${browserWhen}\n- where: browser`)
    .replace('- where: claude-2\n', `- where: claude-2${laterWhen}\n`);
  assert.throws(() => parseLesson(choiceFirst('', '\n- when: Y2.0=CI'), 'b-2.md'), /a browser beat verifies with self, or with none and a later beat/);
  assert.throws(() => parseLesson(choiceFirst('\n- when: Y2.0=Local', '\n- when: Y2.0=CI'), 'b-2.md'), /a browser beat verifies with self, or with none and a later beat/);
  assert.doesNotThrow(() => parseLesson(choiceFirst('\n- when: Y2.0=CI', '\n- when: Y2.0=CI'), 'b-2.md'));
  assert.doesNotThrow(() => parseLesson(choiceFirst('\n- when: Y2.0=CI', ''), 'b-2.md'));
  // Only a do or self beat waits.
  assert.throws(() => parseLesson(DEMO_B2.replace('- because: "Usage is something else."', '- because: "Usage is something else."\n- wait: long'), 'b-2.md'), /a wait line on the ask beat/);
});

test('a second session, the browser and long waits: the card labels its window as the page does (103)', () => {
  const w1 = onWaitB2('W1');
  assert.ok(cardTop(w1.state).includes(C.terminalN(3)), cardTop(w1.state));
  fitsBoth(w1.state);
  const browser = onWaitB2('Y2');
  assert.ok(cardTop(browser.state).includes(`🌐 ${C.where.browser}`), cardTop(browser.state));
  assert.ok(cardTop(browser.state, 60, 20, false).includes(`[BROWSER] ${C.where.browser}`), cardTop(browser.state, 60, 20, false));
  fitsBoth(browser.state);
  const second = onWaitB2('Y2', 1);
  assert.ok(cardTop(second.state).includes(`💬 ${C.terminalN(2)}`), cardTop(second.state));
  fitsBoth(second.state);
  // Without numbers, the second session says what it is.
  const plain = onWaitB2('Y2', 1, WAIT_B2.replace('terminals: [terminal claude, claude-2, shell]\n', ''));
  assert.ok(cardTop(plain.state).includes(C.where['claude-2']), cardTop(plain.state));
  fitsBoth(plain.state);
  // The welcome promises no single other window.
  assert.ok(!/two windows|other terminal\b/.test([C.twoWindows, C.otherWindow, ...C.otherWindowLines].join(' ')));
});

test('a second session, the browser and long waits: a long wait claims nothing the app cannot see (103)', () => {
  const d = onWaitB2('Y2', 1);
  // The app's own look at the file, which finds nothing yet.
  d.send({ type: 'file', path: '.practice/run.txt', read: null, stamp: 'A' });
  assert.equal(d.state.beat.status, 'waiting');
  assert.equal(longWait(d.state), true);
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    const card = screenText(d.state, cols, rows).map((l) => l.replace(/^\s*[│|]|[│|]\s*$/g, '')).join(' ').replace(/\s+/g, ' ');
    assert.ok(card.includes(C.waitLong), `${cols}x${rows}: ${card}`);
  }
  // The box's question answered (150), so rule 3 no longer holds motion.
  d.key('1');
  const quiet = d.state.lastActivity;
  // Ten quiet minutes: no idle offer, no CHALLENGE unlock, no "Stuck?".
  for (let k = 0; k < 10; k++) d.send({ type: 'tick', wait: 60_000 });
  assert.equal(d.state.beat.idle, false);
  assert.equal(d.state.beat.unlocked, false);
  assert.equal(cardMood(d.state), 'rest', 'Pip never wears the checking face for the run');
  const at = quiet + 10 * 60_000;
  const ON = { motion: true };
  assert.equal(phases(d.state, at, ON).spinner, null, 'no spinner: no check child runs');
  assert.equal(pipGates(d.state, at, { motion: true, truecolor: true, remote: false }).motion, true, 'the screen never goes still');
  assert.notEqual(nextChange(d.state, at, ON), null, 'its next frame still comes');
  fitsBoth(d.state);
  // The file the run leaves ends the wait like any other file beat.
  d.send({ type: 'file', path: '.practice/run.txt', read: Buffer.from('ok'), stamp: 'B' });
  assert.equal(d.state.beat.status, 'done');
  assert.equal(longWait(d.state), false);
  // A beat with no wait goes idle as before.
  const w = onWaitB2('Y2', 1, WAIT_B2.replace('- wait: long\n', ''));
  w.send({ type: 'file', path: '.practice/run.txt', read: null, stamp: 'A' });
  w.send({ type: 'tick', wait: IDLE_MS + 1_000 });
  assert.equal(longWait(w.state), false);
  assert.equal(w.state.beat.idle, true);
  assert.equal(pipGates(w.state, w.now, { motion: true, truecolor: true, remote: false }).motion, false);
});

// ---- choices and the beats that depend on them (ticket 104) -----------------
// DEMO_B2 with its Your turn opening on a choice: Y1.1 shows for everyone,
// Y1.2 only for a key and Y1.3 only for a token, the step's last beat.
const CHOICE_B2 = DEMO_B2.replace(`- beat: do
- verify: check 0 fresh
- watching: .practice/b-2-before.txt
- evidence: .practice/b-2-before.txt
- goal: "Save it again."`, `- beat: ask
- ask: Which credential do you use?
- option: An API key
- option: A token
- beat: do
- verify: self
- done-label: it's saved
- goal: "Save it again."
- beat: do
- when: Y1.0=An API key
- verify: self
- done-label: it's set
- goal: "Add the key."
- beat: do
- when: Y1.0=A token
- verify: self
- done-label: it's set
- goal: "Add the token."`);
const onChoice = (extra = {}) => {
  const d = driver({ course: courseWith({ 'b-2': CHOICE_B2 }), saved: { format: 1, welcomed: true, lessons: { 'b-1': finished(course.find((l) => l.id === 'b-1')), 'b-2': { done: ['W1'], step: 'Y1', beat: 0, ...extra } } } });
  d.key('enter');
  if (stepOf(d.state)?.id !== 'Y1') throw new Error(`onChoice: on ${d.state.view} ${stepOf(d.state)?.id}`);
  return d;
};
const where = (d) => (d.state.view === 'step' ? `${stepOf(d.state).id}.${d.state.pos.beat}` : d.state.view);

test('choices: a pick on a choice is saved as a guess is, and never counts as missed (104)', () => {
  const d = onChoice();
  assert.equal(where(d), 'Y1.0');
  assert.equal(answerKey(d.state), 'Y1.0');
  const missed = [...d.state.missed];
  d.key('2');
  assert.equal(d.state.beat.status, 'done');
  assert.equal(d.state.progress['b-2'].answers['Y1.0'], 'A token');
  assert.deepEqual(d.state.missed, missed, 'no pick on a choice is missed');
  assert.ok(d.effects.some((e) => e.type === 'save'));
  assert.deepEqual(snapshot(d.state).lessons['b-2'].answers, { 'Y1.0': 'A token' }, 'the pick is in the saved file');
  fitsBoth(d.state);
  // A right pick on a graded question is saved too.
  const w = driver({ course: courseWith({ 'b-2': DEMO_B2 }), saved: { format: 1, welcomed: true, lessons: { 'b-1': finished(course.find((l) => l.id === 'b-1')), 'b-2': { step: 'R1', beat: 0, warm: ['R1'] } } } });
  w.key('enter');
  assert.equal(where(w), 'R1.0');
  w.key('1');
  assert.equal(w.state.progress['b-2'].answers['R1.0'], '`/status`');
});

test('choices: on and back pass over the beats whose when does not match, and a changed pick re-decides them (104)', () => {
  const d = onChoice();
  d.key('2');
  d.key('enter');
  assert.equal(where(d), 'Y1.1');
  assert.equal(isLastBeat(d.state), false);
  d.key('space');
  assert.equal(where(d), 'Y1.3', 'a token skips the key beat');
  assert.equal(isLastBeat(d.state), true);
  d.key('b');
  assert.equal(where(d), 'Y1.1', 'back skips it too');
  d.key('b');
  assert.equal(where(d), 'Y1.0');
  // The choice opens again: a new pick replaces the saved one.
  d.key('1');
  assert.equal(d.state.progress['b-2'].answers['Y1.0'], 'An API key');
  d.key('enter');
  d.key('space');
  assert.equal(where(d), 'Y1.2', 'a key shows the key beat');
  assert.equal(isLastBeat(d.state), true, 'the token beat after it does not show');
  d.key('space');
  assert.equal(stepOf(d.state).id, 'C', 'the step ends at its last beat that shows');
  if (d.state.view === 'levelup') d.key('enter');
  assert.ok(d.state.progress['b-2'].done.includes('Y1'));
  d.key('b');
  assert.equal(where(d), 'Y1.2', 'back from the next step lands on the last beat that shows');
  // Before any pick, no beat with a when shows.
  const p = { answers: {} };
  const beats = parseLesson(CHOICE_B2, 'b-2.md').steps.find((x) => x.id === 'Y1').beats;
  assert.deepEqual(beats.map((b) => beatShown(p, b)), [true, true, false, false]);
});

test('choices: a saved place on a beat that no longer shows resumes on the one before it (104)', () => {
  const d = onChoice({ beat: 3, answers: { 'Y1.0': 'An API key' } });
  assert.equal(where(d), 'Y1.2');
  const t = onChoice({ beat: 3, answers: { 'Y1.0': 'A token' } });
  assert.equal(where(t), 'Y1.3');
});

test('choices: a pick longer than the 200 characters the store keeps shows its beats before and after a restart (104)', () => {
  const long = `An API key ${'that lives in a secret store '.repeat(8)}`.trim();
  assert.ok(long.length > 200);
  const text = CHOICE_B2.replaceAll('An API key', long);
  const d = driver({ course: courseWith({ 'b-2': text }), saved: { format: 1, welcomed: true, lessons: { 'b-1': finished(course.find((l) => l.id === 'b-1')), 'b-2': { done: ['W1'], step: 'Y1', beat: 0 } } } });
  d.key('enter');
  d.key('1');
  d.key('enter');
  d.key('space');
  assert.equal(where(d), 'Y1.2', 'the key beat shows in this sitting');
  const again = driver({ course: courseWith({ 'b-2': text }), saved: snapshot(d.state) });
  again.key('enter');
  assert.equal(where(again), 'Y1.2', 'and after a restart');
});

test('choices: a recall shows the guess it recalls, not a choice of the same step (104)', () => {
  const recalled = CHOICE_B2.replace('- option: A token\n', '- option: A token\n- beat: predict\n- ask: Guess: does it pass?\n- right: "Yes"\n- option: "No"\n')
    .concat('- beat: ask\n- recall: Y1\n- ask: Did it pass?\n- right: "Yes"\n- wrong: "No"\n- because: "It did."\n');
  const d = driver({ course: courseWith({ 'b-2': recalled }), saved: { format: 1, welcomed: true, lessons: { 'b-1': finished(course.find((l) => l.id === 'b-1')), 'b-2': { done: ['W1', 'Y1'], step: 'C', beat: 1, answers: { 'Y1.0': 'A token', 'Y1.1': 'Yes' } } } } });
  d.key('enter');
  assert.equal(where(d), 'C.1');
  const text = screenText(d.state).join('\n');
  assert.ok(text.includes(C.youGuessed('Yes')), text);
  assert.ok(!text.includes(C.youGuessed('A token')), text);
});

// ---- git probes, head-moved and git-unchanged (ticket 105) ------------------
// DEMO_B2's Y1, step 5 after three warm-ups and W1, verified by `verify`.
const onY1 = (verify, extra = {}) => onReading(verify, extra);
// The same, but entered from W1, so Y1's opening stamps what it compares with.
const intoY1 = (verify) => {
  const d = driver({ course: courseWith({ 'b-2': DEMO_B2.replace('- verify: check 0 fresh\n', `- verify: ${verify}\n`) }), saved: { format: 1, welcomed: true, lessons: { 'b-1': finished(course.find((l) => l.id === 'b-1')), 'b-2': { warm: ['R1', 'R2', 'R3'], done: ['R1', 'R2', 'R3'], step: 'W1', beat: 0 } } } });
  d.key('enter');
  d.send({ type: 'check', lesson: 'b-2', items: [{ index: 0, text: 'x', pass: true, hint: '' }] });
  d.key('enter');
  if (d.state.view === 'levelup') d.key('enter');
  if (stepOf(d.state)?.id !== 'Y1') throw new Error(`intoY1: on ${d.state.view} ${stepOf(d.state)?.id}`);
  return d;
};
const probeResult = (name, args, pass, state, extra = {}) => ({ type: 'probe', name, args, pass, state, hint: pass ? '' : `No ${name} yet.`, evidence: pass ? `${name} found` : null, dir: FACTS.root, ...extra });

test('probes: the verify line names a probe and its arguments; branch-ahead is always fresh; a bad one fails to parse (105)', () => {
  const v = (line) => beatOf(onY1(line).state);
  assert.deepEqual(v('probe worktrees 2').verify, { kind: 'probe', name: 'worktrees', args: ['2'] });
  assert.equal(v('probe worktrees 2').watching, 'git worktree list', 'the card watches what the probe reads');
  assert.equal(v('probe worktrees 2\n- watching: the worktrees').watching, 'the worktrees');
  assert.deepEqual(v('probe branch-ahead docs-pass').verify, { kind: 'probe', name: 'branch-ahead', args: ['docs-pass'], fresh: true, since: null });
  assert.deepEqual(v('probe merged docs-pass test-pass fresh since W1').verify, { kind: 'probe', name: 'merged', args: ['docs-pass', 'test-pass'], fresh: true, since: 'W1' });
  assert.deepEqual(v('probe pushed').verify, { kind: 'probe', name: 'pushed', args: [] });
  assert.deepEqual(v('head-moved since W1').verify, { kind: 'head-moved', since: 'W1' });
  assert.deepEqual(v('git-unchanged').verify, { kind: 'git-unchanged', since: null });
  const bad = (line, error) => assert.throws(() => parseLesson(DEMO_B2.replace('- verify: check 0 fresh\n', `- verify: ${line}\n`), 'b-2.md'), error, line);
  bad('probe nope', /unknown probe nope/);
  bad('probe worktrees', /probe worktrees takes <n>/);
  bad('probe gone ../x', /probe gone takes <path>, not \.\.\/x/);
  bad('probe pushed origin', /probe pushed takes no arguments/);
  bad('head-moved since later', /head-moved since a step id/);
  bad('git-unchanged fresh', /only a check, a file or a probe can be fresh/);
});

test('probes: the beat runs its probe in the work folder, on r too, and passes, fails or breaks as it answers (105)', () => {
  const d = onY1('probe worktrees 2');
  assert.deepEqual(d.effects.filter((e) => e.type === 'probe').at(-1), { type: 'probe', name: 'worktrees', args: ['2'], dir: FACTS.root });
  assert.deepEqual(watching(d.state), { probe: { name: 'worktrees', args: ['2'] }, dir: FACTS.root });
  assert.equal(tierOf(d.state), 'challenge', 'a probe beat counts as checked');
  d.send(probeResult('worktrees', ['2'], false, 'a'));
  assert.equal(d.state.beat.status, 'waiting', 'the first answer is where the learner starts');
  d.key('r');
  assert.deepEqual(d.effects.at(-1), { type: 'probe', asked: d.state.beat.asked, name: 'worktrees', args: ['2'], dir: FACTS.root });
  d.send(probeResult('worktrees', ['2'], false, 'a', { asked: d.state.beat.asked }));
  assert.deepEqual([d.state.beat.status, d.state.beat.fail.hint], ['fail', 'No worktrees yet.']);
  fitsBoth(d.state);
  // Another probe's answer, or one from another folder, decides nothing.
  d.send(probeResult('gone', ['x'], true, 'b'));
  d.send(probeResult('worktrees', ['2'], true, 'b', { dir: '/elsewhere' }));
  assert.equal(d.state.beat.status, 'fail');
  d.send(probeResult('worktrees', ['2'], true, 'b'));
  assert.deepEqual([d.state.beat.status, d.state.beat.evidence], ['done', 'worktrees found']);
  fitsBoth(d.state);
  const broken = onY1('probe pushed');
  broken.send({ type: 'probe-error', message: 'The probe could not run: git is not installed', dir: FACTS.root });
  assert.deepEqual([broken.state.beat.status, broken.state.beat.error], ['broken', 'The probe could not run: git is not installed']);
  playUntil(onY1('probe merged docs-pass'), (s) => stepOf(s)?.id === 'C');
});

test('probes: a fresh probe stamps its state as its step opens, and passes only once that changed (105)', () => {
  const d = intoY1('probe branch-ahead docs-pass');
  assert.deepEqual(d.effects.find((e) => e.type === 'stamp'), { type: 'stamp', key: 'Y1.0', probe: { name: 'branch-ahead', args: ['docs-pass'] }, dir: FACTS.root });
  d.send({ type: 'stamp', key: 'Y1.0', stamp: 'sha-1', dir: FACTS.root });
  d.send(probeResult('branch-ahead', ['docs-pass'], true, 'sha-1'));
  assert.deepEqual([d.state.beat.status, d.state.beat.stale], ['waiting', true], 'the branch is there, but has not moved');
  d.send(probeResult('branch-ahead', ['docs-pass'], true, 'sha-2'));
  assert.equal(d.state.beat.status, 'done');
});

test('head-moved: HEAD another commit than when its step opened, with git status listing nothing (105)', () => {
  const d = intoY1('head-moved');
  assert.deepEqual(d.effects.find((e) => e.type === 'stamp'), { type: 'stamp', key: 'Y1.0', git: 'head', dir: FACTS.root });
  assert.deepEqual(d.effects.filter((e) => e.type === 'git').at(-1), { type: 'git', dir: FACTS.root, head: true });
  d.send({ type: 'stamp', key: 'Y1.0', stamp: 'aaaaaaa1', dir: FACTS.root });
  // A result that doesn't say where HEAD is decides nothing.
  d.send({ type: 'git', paths: [] });
  assert.equal(d.state.beat.status, 'opening');
  d.send({ type: 'git', paths: [], head: 'aaaaaaa1' });
  assert.equal(d.state.beat.status, 'waiting');
  d.key('r');
  d.send({ type: 'git', paths: [], head: 'aaaaaaa1', asked: d.state.beat.asked });
  assert.equal(d.state.beat.fail.hint, C.headSame(5));
  d.send({ type: 'git', paths: ['src/a.js'], head: 'bbbbbbb2' });
  assert.equal(d.state.beat.fail.hint, C.headDirty(1, 'src/a.js', 0));
  fitsBoth(d.state);
  d.send({ type: 'git', paths: [], head: 'bbbbbbb2' });
  assert.deepEqual([d.state.beat.status, d.state.beat.evidence], ['done', C.headMoved('bbbbbbb')]);
  fitsBoth(d.state);
  assert.equal(d.state.progress['b-2'].stamps['Y1.0'], 'aaaaaaa1', 'the stamp is saved');
  playUntil(onY1('head-moved since W1'), (s) => stepOf(s)?.id === 'C');
});

test('git-unchanged: git status lists the same paths as when the step it names opened; that step stamps them (105)', () => {
  const text = DEMO_B2.replace('- verify: check 0 fresh\n', '- verify: git-unchanged since W1\n');
  const atW1 = driver({ course: courseWith({ 'b-2': text }), saved: { format: 1, welcomed: true, lessons: { 'b-1': finished(course.find((l) => l.id === 'b-1')), 'b-2': { warm: ['R1'], step: 'R1', beat: 0 } } } });
  atW1.key('enter');
  atW1.key('1');
  const out = atW1.key('enter');
  assert.equal(stepOf(atW1.state).id, 'W1');
  assert.deepEqual(out.find((e) => e.type === 'stamp'), { type: 'stamp', key: 'Y1.0', git: 'status', dir: FACTS.root });
  const d = onY1('git-unchanged since W1', { stamps: { 'Y1.0': statusStamp(['notes.md']) } });
  assert.deepEqual(watching(d.state), { git: true, dir: FACTS.root }, 'the whole tree, as git status shows it');
  d.send({ type: 'git', paths: ['notes.md', 'src/a.js'] });
  assert.deepEqual([d.state.beat.status, d.state.beat.fail.hint], ['fail', C.changedSince(4, 2, 'notes.md, src/a.js', 0)], 'a change is a not yet at once');
  fitsBoth(d.state);
  d.send({ type: 'git', paths: ['notes.md'] });
  assert.deepEqual([d.state.beat.status, d.state.beat.evidence], ['done', C.unchanged(4)]);
  fitsBoth(d.state);
  assert.equal(statusStamp(['b', 'a', 'a']), statusStamp(['a', 'b']), 'the stamp is the same for the same paths');
  playUntil(onY1('git-unchanged'), (s) => stepOf(s)?.id === 'C');
});

// A file whose name Claude picks: the beat names a glob, and the card shows
// the file it matched (106).
const GLOB_B2 = DEMO_B2.replace('- verify: check 0 fresh\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt', '- verify: file .practice/plans/*.txt fresh');

test('file globs: a file check takes a glob in its last part, and shows the path it matched (106)', () => {
  const beat = parseLesson(GLOB_B2, 'demo').steps[1].beats[0];
  assert.deepEqual(beat.verify, { kind: 'file', path: '.practice/plans/*.txt', fresh: true, since: null });
  assert.equal(beat.evidence, '.practice/plans/*.txt');
  assert.throws(() => parseLesson(GLOB_B2.replace('.practice/plans/*.txt', '.practice/*/plan.txt'), 'demo'), /a glob goes in the file name only/);
  const d = driver({ course: courseWith({ 'b-2': GLOB_B2 }), saved: { format: 1, welcomed: true, lessons: { 'b-1': b1Done, 'b-2': { warm: ['R1', 'R2'], done: ['R1', 'R2', 'W1'], step: 'Y1', beat: 0 } } } });
  assert.ok(d.key('enter').some((e) => e.type === 'file' && e.path === '.practice/plans/*.txt'));
  d.send({ type: 'stamp', key: 'Y1.0', stamp: '' });
  d.key('r');
  d.send({ type: 'file', path: '.practice/plans/*.txt', read: null, stamp: '', found: null, asked: d.state.beat.asked });
  assert.equal(d.state.beat.status, 'fail');
  assert.equal(d.state.beat.fail.hint, C.noMatch('.practice/plans/*.txt'));
  d.send({ type: 'file', path: '.practice/plans/*.txt', read: Buffer.from('src/config.js\n'), stamp: 'C', found: '.practice/plans/review-plan.txt' });
  assert.equal(d.state.beat.status, 'done');
  assert.equal(d.state.beat.found, '.practice/plans/review-plan.txt');
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    const text = screenText(d.state, cols, rows).join('\n');
    assert.ok(text.includes('review-plan.txt'), `${cols}x${rows}: the matched path is the evidence\n${text}`);
    assert.ok(!text.includes('*.txt'), `${cols}x${rows}: not the glob\n${text}`);
  }
  fitsBoth(d.state);
});

test('a lesson done in the app whose check now fails: the map keeps it done, and plain output says a later lesson may have changed it (106)', () => {
  const b1 = course.find((l) => l.id === 'b-1');
  const failing = { items: b1.items.map((text, index) => ({ index, text, pass: index !== 0, hint: '' })) };
  const passing = { items: b1.items.map((text, index) => ({ index, text, pass: true, hint: '' })) };
  const lines = (results, complete) => plainProgress(course, { 'b-1': results }, { lessons: { 'b-1': { complete } } }).split('\n');
  const after = (out) => out[out.findIndex((l) => l.startsWith('B1 ')) + 1];
  assert.equal(after(lines(failing, true)), `     ${C.plainChanged}`);
  assert.notEqual(after(lines(passing, true)), `     ${C.plainChanged}`, 'a passing check needs no word');
  assert.notEqual(after(lines(failing, false)), `     ${C.plainChanged}`, 'nor one not done in the app');
  const d = driver({ course, saved: { format: 1, welcomed: true, lessons: { 'b-1': b1Done } } });
  d.key('m');
  assert.equal(d.state.view, 'map');
  d.send({ type: 'check', lesson: 'b-1', ...failing });
  assert.equal(d.state.progress['b-1'].complete, true, 'a failing check never takes back a finished lesson');
  const row = screenText(d.state).find((l) => / B1 /.test(l));
  assert.ok(row.includes(C.mapDone), row);
});

// ---- recall while a long run works (ticket 150) ------------------------------
// WAIT_B2's long wait, with `extra` saved: the learner's missed skills and
// the lesson's warm-ups, as a play that chose them saved them.
const onWaitWith = ({ missed = [], warm = [] } = {}, text = WAIT_B2) => {
  const d = driver({ course: courseWith({ 'b-2': text }), saved: { format: 1, welcomed: true, missed, lessons: { 'b-1': finished(course.find((l) => l.id === 'b-1')), 'b-2': { done: ['W1', 'Y1'], step: 'Y2', beat: 1, warm } } } });
  d.key('enter');
  if (stepOf(d.state)?.id !== 'Y2' || d.state.pos.beat !== 1) throw new Error(`onWaitWith: on ${d.state.view} ${stepOf(d.state)?.id} beat ${d.state.pos.beat}`);
  return d;
};
const flat = (state, cols, rows, unicode = true) => screenText(state, cols, rows, unicode).map((l) => l.replace(/^\s*[│|]|[│|]\s*$/g, '')).join(' ').replace(/\s+/g, ' ');

test('recall while a long run works: one unshown warm-up, missed skills first, the same every time (150)', () => {
  // Nothing missed and no warm-up shown: the pool's first question with
  // options, R1 (R2 is typed from memory, which the box never asks).
  const d = onWaitWith();
  assert.equal(whileRunsOf(d.state).step.id, 'R1');
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    const card = flat(d.state, cols, rows);
    assert.ok(card.includes(C.whileItRuns), `${cols}x${rows}: ${card}`);
    assert.ok(card.includes('Which command shows the account?'), `${cols}x${rows}: ${card}`);
  }
  fitsBoth(d.state);
  // R1 shown as the lesson's warm-up, and exit and status missed: R3, the
  // unshown one on a missed skill, comes before nothing else.
  const m = onWaitWith({ missed: ['status', 'exit'], warm: ['R1'] });
  assert.equal(whileRunsOf(m.state).step.id, 'R3');
  assert.equal(onWaitWith({ missed: ['status', 'exit'], warm: ['R1'] }).state.beat.whileRuns.id, 'R3', 'the same choice every time');
  // A missed skill wins over the file order.
  assert.equal(whileRunsOf(onWaitWith({ missed: ['exit'] }).state).step.id, 'R3');
  // Every question with options shown: no box.
  const none = onWaitWith({ missed: [], warm: ['R1'] }, WAIT_B2.replace(/### R3[\s\S]*?(?=## steps)/, ''));
  assert.equal(whileRunsOf(none.state), null);
  assert.ok(!flat(none.state, 80, 24).includes(C.whileItRuns));
  // A choice (104) has no right answer to recall: the box passes it by.
  const CHOICE_R1 = WAIT_B2.replace('- right: "`/status`"\n- wrong: "`/usage`"\n- because: "Usage is something else."', '- option: "`/status`"\n- option: "`/usage`"');
  assert.notEqual(CHOICE_R1, WAIT_B2);
  const choice = onWaitWith({}, CHOICE_R1);
  assert.equal(whileRunsOf(choice.state).step.id, 'R3');
  // A beat with no wait never offers one.
  const plain = onWaitB2('Y2', 1, WAIT_B2.replace('- wait: long\n', ''));
  assert.equal(whileRunsOf(plain.state), null);
  assert.ok(!flat(plain.state, 80, 24).includes(C.whileItRuns));
});

test('recall while a long run works: never scored, still, and dropped when the result lands (150)', () => {
  const d = onWaitWith({ missed: ['exit'] });
  d.send({ type: 'file', path: '.practice/run.txt', read: null, stamp: 'A' });
  const before = JSON.stringify([d.state.missed, d.state.eased, d.state.progress['b-2'].recalled, d.state.progress['b-2'].answers, d.state.missedNow]);
  // Rule 3: nothing ambient beside its open question, the look marker too.
  const ON = { motion: true };
  const later = d.now + 60_000;
  d.send({ type: 'tick', wait: 60_000 });
  assert.equal(pipGates(d.state, later, { motion: true, truecolor: true, remote: false }).ambient, false, 'no ambient motion beside the question');
  assert.equal(phases(d.state, later, ON).spinner, null);
  // Its options are drawn the same in every frame: the box is still.
  const frame = (at) => render(d.state, { cols: 80, rows: 24 }, theme({ tty: true, depth: 8, unicode: true, links: false, win32: false }), { at }).map(strip).filter((l) => l.includes('/exit') || l.includes('/clear'));
  assert.deepEqual(frame(later), frame(later + 5_000));
  // A wrong answer: shown, never scored.
  d.key('2');
  assert.equal(d.state.beat.whileRuns.answer, 1);
  assert.equal(d.state.beat.status, 'waiting', 'the beat still waits on the run');
  assert.equal(JSON.stringify([d.state.missed, d.state.eased, d.state.progress['b-2'].recalled, d.state.progress['b-2'].answers, d.state.missedNow]), before, 'missed, eased and recalled are untouched');
  assert.equal(whileRunsOpen(d.state), false);
  assert.ok(flat(d.state, 80, 24).includes(C.whileItRuns), 'the answer stays until the result lands');
  fitsBoth(d.state);
  // With the question answered, the long wait's motion runs again.
  assert.equal(pipGates(d.state, d.now + 30_000, { motion: true, truecolor: true, remote: false }).ambient, true);
  // A right answer is not scored either: a skill it recalls stays missed.
  const r = onWaitWith({ missed: ['exit'] });
  r.key('1');
  assert.deepEqual([r.state.missed, r.state.eased, r.state.progress['b-2'].recalled], [['exit'], [], []]);
  // The result lands with a question still open: it goes quietly, and the
  // green result never waited for it.
  const open = onWaitWith({ missed: ['exit'] });
  assert.equal(whileRunsOpen(open.state), true);
  open.send({ type: 'file', path: '.practice/run.txt', read: null, stamp: 'A' });
  open.send({ type: 'file', path: '.practice/run.txt', read: Buffer.from('ok'), stamp: 'B' });
  assert.equal(open.state.beat.status, 'done');
  assert.equal(whileRunsOpen(open.state), false);
  assert.ok(!flat(open.state, 80, 24).includes(C.whileItRuns));
  assert.equal(open.state.toast, null, 'dropped quietly');
  assert.deepEqual([open.state.missed, open.state.eased], [['exit'], []]);
  fitsBoth(open.state);
  // A digit after the result is no answer.
  open.key('1');
  assert.equal(open.state.beat.whileRuns.answer, null);
});

// ---- r27 engine fixes (findings/r27/TRIAGE.md section 3) ---------------------
// DEMO_B2 with W1 reading a log a session writes, its command a cat of that
// log, as i-2's W4.3 does.
const LOG_B2 = DEMO_B2.replace('- verify: check 0\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt\n- run: "git status --porcelain > .practice/b-2-before.txt"', '- verify: match .practice/log.txt ^include\\s\n- run: "cat .practice/log.txt"');
const onB2At = (text, extra = {}) => {
  const d = driver({ course: courseWith({ 'b-2': text }), saved: { format: 1, welcomed: true, lessons: { 'b-1': b1Done, 'b-2': { warm: ['R1', 'R2', 'R3'], done: ['R1', 'R2', 'R3'], step: 'W1', beat: 0, ...extra } } } });
  d.key('enter');
  if (stepOf(d.state)?.id !== 'W1' || d.state.pos.beat !== 0) throw new Error(`onB2At: on ${d.state.view} ${stepOf(d.state)?.id} beat ${d.state.pos.beat}`);
  return d;
};
// The log as main reads it: null when it isn't there.
const sendLog = (d, text, stamp) => d.send({ type: 'file', path: '.practice/log.txt', read: text === null ? null : Buffer.from(text), stamp });
const catRow = (state) => screenText(state).find((l) => l.includes('$ cat .practice/log.txt'));

test('r27 E2: a matched line too long for its row ends in …, and a hint that quotes it holds no escape', () => {
  const line = '- Use `node:test` and `node:assert/strict`; no other test library, and no snapshot files.';
  assert.ok(line.length > 60);
  const match = onReading('match notes.md node:test');
  const evidence = tryNow(match, 'notes.md', `${line}\n`).evidence;
  assert.equal(evidence, `${line.slice(0, 59)}…`);
  assert.equal(width(evidence), 60);
  const no = onReading('no-match notes.md node:test');
  const hint = tryNow(no, 'notes.md', `${line}\n`).fail.hint;
  assert.equal(hint, `notes.md still has: ${line.slice(0, 59)}…`);
  assert.doesNotMatch(hint, /\x1b/, 'cut\'s reset goes: the row sits inside a sentence');
  const fits = 'x'.repeat(60);
  assert.equal(tryNow(onReading('match notes.md x'), 'notes.md', `${fits}\n`).evidence, fits, 'a row that fits stays whole');
});

test('r27 E3: only space ticks a self beat, so the enter that goes on from a step ticks nothing unread; enter still goes on from a none beat', () => {
  const text = DEMO_B2.replace('- where: shell\n- beat: do\n- verify: check 0\n', '- where: shell\n- beat: do\n- verify: self\n- goal: "Read the log."\n- beat: do\n- verify: none\n- goal: "Look around."\n- beat: do\n- verify: check 0\n');
  const d = onB2At(text);
  assert.equal(beatOf(d.state).verify.kind, 'self');
  d.key('enter');
  assert.deepEqual([stepOf(d.state).id, d.state.pos.beat, d.state.beat.status], ['W1', 0, 'waiting'], 'enter leaves a self beat unticked');
  d.key('space');
  assert.deepEqual([d.state.pos.beat, beatOf(d.state).verify.kind], [1, 'none'], 'space ticks it');
  d.key('enter');
  assert.deepEqual([stepOf(d.state).id, d.state.pos.beat], ['W1', 2], 'enter goes on from a none beat');
});

test('r27 E4: a beat done before it opened shows no tick beside its command; one done while it was open does', () => {
  const already = onB2At(LOG_B2);
  sendLog(already, 'include CLAUDE.md\n', 'A');
  assert.equal(already.state.beat.status, 'already');
  assert.ok(catRow(already.state), screenText(already.state).join('\n'));
  assert.doesNotMatch(catRow(already.state), /✔/, 'the app never saw the learner run cat');
  const done = onB2At(LOG_B2);
  sendLog(done, null, 'A');
  sendLog(done, 'include CLAUDE.md\n', 'B');
  assert.equal(done.state.beat.status, 'done');
  assert.match(catRow(done.state), /✔$/, screenText(done.state).join('\n'));
});

test('r27 E5: an eased step says so on its first beat when that beat was already done as it opened, and not once a beat is done', () => {
  const already = onB2At(LOG_B2, { easedSteps: { W1: true } });
  assert.equal(already.state.beat.eased, true);
  assert.ok(flat(already.state, 80, 24).includes(C.eased), 'while it waits');
  sendLog(already, 'include CLAUDE.md\n', 'A');
  assert.equal(already.state.beat.status, 'already');
  assert.ok(flat(already.state, 80, 24).includes(C.eased), flat(already.state, 80, 24));
  const done = onB2At(LOG_B2, { easedSteps: { W1: true } });
  sendLog(done, null, 'A');
  sendLog(done, 'include CLAUDE.md\n', 'B');
  assert.equal(done.state.beat.status, 'done');
  assert.ok(!flat(done.state, 80, 24).includes(C.eased), flat(done.state, 80, 24));
});

test('r27 E6: a watch that sees an earlier step\'s state says it turns green once that changes, not "make it again"', () => {
  assert.deepEqual(C.staleWatch('git branch'), ['Watching ', 'git branch', ". It's from an earlier step: I'll turn green once it changes."]);
  const d = intoY1('probe branch-ahead docs-pass');
  d.send({ type: 'stamp', key: 'Y1.0', stamp: 'sha-1', dir: FACTS.root });
  d.send(probeResult('branch-ahead', ['docs-pass'], true, 'sha-1'));
  assert.deepEqual([d.state.beat.status, d.state.beat.stale], ['waiting', true]);
  const screen = flat(d.state, 80, 24);
  assert.ok(screen.includes("It's from an earlier step: I'll turn green once it changes."), screen);
  assert.ok(!screen.includes('make it again'), screen);
});

test('r27 E7: on a Claude Code beat, a command that starts Claude Code shows the shell\'s prompt; a prompt for the session keeps ›', () => {
  const text = DEMO_B2.replace('- where: shell\n- beat: do\n- verify: check 0\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt\n- run: "git status --porcelain > .practice/b-2-before.txt"', '- where: claude\n- beat: do\n- verify: self\n- run: "claude --worktree docs-pass"\n- run: "/status"\n- run: "claude"');
  const d = onB2At(text);
  const rows = screenText(d.state).map((l) => l.replace(/^\s*│\s*/, '').trimEnd());
  for (const row of ['$ claude --worktree docs-pass', '› /status', '$ claude']) assert.ok(rows.includes(row), `${row}\n${rows.join('\n')}`);
  assert.ok(!rows.some((l) => /^› claude/.test(l)), rows.join('\n'));
});

test('r27 E8: a slash command shows Claude Code\'s prompt on any beat, an editor beat\'s too; a path that starts with / keeps the shell\'s', () => {
  const text = DEMO_B2.replace('- where: shell\n- beat: do\n- verify: check 0\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt\n- run: "git status --porcelain > .practice/b-2-before.txt"', '- where: editor\n- beat: do\n- verify: self\n- run: "/reload-plugins"\n- run: "/plugin install team-kit"\n- run: "/tmp/x"');
  const d = onB2At(text);
  const rows = screenText(d.state).map((l) => l.replace(/^\s*│\s*/, '').trimEnd());
  for (const row of ['› /reload-plugins', '› /plugin install team-kit', '$ /tmp/x']) assert.ok(rows.includes(row), `${row}\n${rows.join('\n')}`);
});

test('r27 E9: a beat whose check includes a slow item says to press r from the start, never "I\'ll turn green the moment it\'s right"', () => {
  const d = onB2At(DEMO_B2.replace('- where: shell\n- beat: do\n- verify: check 0\n', '- where: shell\n- beat: do\n- verify: check 0 2\n'));
  // b-2's item 2 is slow; item 0, which runs on every poll, fails.
  d.send({ type: 'check', lesson: 'b-2', items: [{ index: 0, text: 'x', pass: false, hint: 'not yet' }, { index: 2, text: 'y', pass: false, slow: true, hint: '' }] });
  assert.deepEqual([d.state.beat.status, d.state.beat.slowWait], ['waiting', false]);
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    const card = flat(d.state, cols, rows);
    assert.ok(card.includes(C.slowWait), `${cols}x${rows}: ${card}`);
    assert.ok(!card.includes("I'll turn green the moment it's right"), `${cols}x${rows}: ${card}`);
  }
  // A beat with no slow item still watches.
  const fast = onB2At(DEMO_B2);
  fast.send({ type: 'check', lesson: 'b-2', items: [{ index: 0, text: 'x', pass: false, hint: 'not yet' }] });
  assert.equal(fast.state.beat.status, 'waiting');
  assert.ok(flat(fast.state, 80, 24).includes("I'll turn green the moment it's right"), flat(fast.state, 80, 24));
  assert.ok(!flat(fast.state, 80, 24).includes(C.slowWait));
});

test('r27 E11: the shell label names no ordinal, so it agrees with a page\'s "the second terminal"', () => {
  assert.equal(C.where.shell, 'in a terminal beside Claude Code');
  const d = onB2At(DEMO_B2);
  assert.ok(cardTop(d.state).includes(`💻 ${C.where.shell}`), cardTop(d.state));
  assert.ok(!screenText(d.state).join('\n').includes('third terminal'));
  fitsBoth(d.state);
  // Done at 60x20, the top row has no room for the long words beside DONE
  // and Pip: it keeps both, with the brief words.
  d.send({ type: 'check', lesson: 'b-2', items: [{ index: 0, text: 'x', pass: true, hint: '' }] });
  assert.equal(d.state.beat.status, 'already');
  for (const unicode of [true, false]) {
    const top = cardTop(d.state, 60, 20, unicode);
    assert.ok(top.includes(`${C.terminalInFolder}`) && top.includes(C.done) && /\[.{3}\] ─*-*$/.test(top.trimEnd()), top);
  }
  assert.ok(cardTop(d.state, 80, 24).includes(C.where.shell), cardTop(d.state, 80, 24));
});

test('r27 E12: a json verify\'s evidence names its key; a matched line drops a trailing comma', () => {
  const settings = Buffer.from('{\n  "sandbox": {"enabled": true},\n  "permissions": {"deny": [\n    "Read(./.env)",\n    "Read(./.env.*)"\n  ]}\n}\n');
  assert.deepEqual(judge({ kind: 'json', path: '.claude/settings.json', key: 'sandbox.enabled', value: 'true' }, settings), { pass: true, evidence: 'sandbox.enabled = true' });
  assert.deepEqual(judge({ kind: 'json', path: '.claude/settings.json', key: 'permissions.deny.0', value: null }, settings), { pass: true, evidence: 'permissions.deny.0 = Read(./.env)' });
  assert.deepEqual(judge({ kind: 'match', path: '.claude/settings.json', regex: 'Read\\(\\./\\.env\\)' }, settings), { pass: true, evidence: '"Read(./.env)"' });
  // A line with no comma at its end keeps what it has.
  assert.deepEqual(judge({ kind: 'match', path: '.claude/settings.json', regex: 'env\\.\\*' }, settings), { pass: true, evidence: '"Read(./.env.*)"' });
});

test('r27 E13: a git-clean scope of one file that is the one change says the file has uncommitted changes, not "1 file changed under" it', () => {
  assert.equal(C.fileUncommitted('.claude/settings.json'), '.claude/settings.json has uncommitted changes.');
  const one = onB2At(DEMO_B2.replace('- where: shell\n- beat: do\n- verify: check 0\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt\n', '- where: shell\n- beat: do\n- verify: git-clean .claude/settings.json\n'));
  one.send(gitLists(['.claude/settings.json', 'src/a.js']));
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    const card = flat(one.state, cols, rows);
    assert.ok(card.includes(C.fileUncommitted('.claude/settings.json')), `${cols}x${rows}: ${card}`);
    assert.ok(!card.includes('changed under'), `${cols}x${rows}: ${card}`);
  }
  fitsBoth(one.state);
  // A folder scope still counts and lists what changed under it.
  const folder = onB2At(DEMO_B2.replace('- where: shell\n- beat: do\n- verify: check 0\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt\n', '- where: shell\n- beat: do\n- verify: git-clean .claude/\n'));
  folder.send(gitLists(['.claude/settings.json']));
  assert.ok(flat(folder.state, 80, 24).includes(`${C.changedUnder(1, '.claude/')} .claude/settings.json`), flat(folder.state, 80, 24));
});

test('r27 E14: a code span wider than the line breaks at a space where one fits, and mid-word where none does or where the space costs a row', () => {
  const cmd = 'claude plugin install claude-code-setup@claude-plugins-official --scope project';
  const words = (lines) => lines.map((l) => l.map((r) => r.text).join(''));
  const lines = words(wrapRuns(inline(`I installed the plugin with \`${cmd}\`, as a teammate does after pulling the settings.`), 72));
  assert.ok(lines.every((l) => width(l) <= 72), lines.join('\n'));
  assert.ok(lines.some((l) => l.endsWith('--scope')) && lines.some((l) => l.startsWith('project,')), lines.join('\n'));
  assert.ok(!lines.some((l) => /pr$/.test(l)), lines.join('\n'));
  // No space in reach: the old split, at the line's width.
  assert.deepEqual(words(wrapRuns([{ text: 'a'.repeat(25), code: true }], 10)), ['a'.repeat(10), 'a'.repeat(10), 'a'.repeat(5)]);
  // A break at the space would cost a row a 60x20 card can't spare: the old split.
  assert.deepEqual(words(wrapRuns([{ text: 'a bcdefghijklmnopqrs', code: true }], 10)), ['a bcdefghi', 'jklmnopqrs']);
  // The i-capstone self-check that showed it, at 100 columns.
  const id = 'i-capstone';
  const steps = course.find((l) => l.id === id).content.steps;
  const step = steps.find((x) => x.beats.some((b) => b.self?.includes('--scope project')));
  const beat = step.beats.findIndex((b) => b.self?.includes('--scope project'));
  const d = driver({ course, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore(id), [id]: { step: step.id, beat, warm: [] } } } });
  d.key('enter');
  assert.deepEqual([stepOf(d.state).id, d.state.pos.beat], [step.id, beat]);
  const screen = screenText(d.state, 100, 30).map((l) => l.replace(/^\s*[│|]\s*/, '').trimEnd());
  assert.ok(!screen.some((l) => /--scope pr$/.test(l)), screen.join('\n'));
  assert.ok(screen.some((l) => /(^|\s)project,/.test(l)), screen.join('\n'));
});

test('r27 a-5: a work folder whose git doesn\'t ignore .practice/ is told how to ignore it, not sent to a lesson that doesn\'t show it', () => {
  assert.ok(!/Beginner lesson 1/.test(C.noPractice), C.noPractice);
  assert.ok(C.noPractice.includes('.git/info/exclude'), C.noPractice);
});

test('r27: the goodbye with no .practice/ yet gives the command, not a Beginner lesson 1 step that no longer makes the folder', () => {
  assert.ok(!/lesson 1/.test(C.savedLater), C.savedLater);
  assert.ok(C.savedLater.includes('mkdir .practice'), C.savedLater);
});

test('r27 E16: a fresh push beat that sees an earlier push says everything is pushed and it waits for the next push', () => {
  assert.deepEqual(C.stalePush('git status'), ['Watching ', 'git status', ": everything here is already pushed, so I'll turn green after your next push."]);
  const d = intoY1('probe pushed fresh');
  d.send({ type: 'stamp', key: 'Y1.0', stamp: 'pushed-1', dir: FACTS.root });
  d.send(probeResult('pushed', [], true, 'pushed-1'));
  assert.deepEqual([d.state.beat.status, d.state.beat.stale], ['waiting', true]);
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    const screen = flat(d.state, cols, rows);
    assert.ok(screen.includes("everything here is already pushed, so I'll turn green after your next push."), screen);
    assert.ok(!screen.includes("It's from an earlier step"), screen);
  }
  // Another stale probe keeps its line.
  const other = intoY1('probe branch-ahead docs-pass');
  other.send({ type: 'stamp', key: 'Y1.0', stamp: 'sha-1', dir: FACTS.root });
  other.send(probeResult('branch-ahead', ['docs-pass'], true, 'sha-1'));
  assert.ok(flat(other.state, 80, 24).includes("It's from an earlier step: I'll turn green once it changes."));
});

// Ticket 27's verify pass (pattern E): a beat with a done-label waits for
// the learner's own word, whatever it verifies. Enter is the key that goes
// on from a step, so a habitual enter after the beat before it must not give
// that word: a git-clean beat would look at the tree before the learner ran
// git status. Only space answers it; enter still goes on from a none beat
// with nothing to confirm.
test('r27 E3, done-labels: only space answers a beat with a done-label, a git-clean beat or a none beat; enter still goes on from a none beat without one', () => {
  const text = DEMO_B2.replace('- where: shell\n- beat: do\n- verify: check 0\n', '- where: shell\n- beat: do\n- verify: self\n- goal: "Read the plan."\n- beat: do\n- verify: git-clean\n- done-label: it says nothing to commit\n- run: "git status"\n- beat: do\n- verify: none\n- done-label: it\'s closed\n- goal: "Close the dialog."\n- beat: do\n- verify: none\n- goal: "Look around."\n- beat: do\n- verify: check 0\n');
  const d = onB2At(text);
  d.key('space');
  assert.deepEqual([d.state.pos.beat, beatOf(d.state).verify.kind, beatOf(d.state).doneLabel], [1, 'git-clean', 'it says nothing to commit']);
  // The git-clean beat: a habitual enter neither ends it nor asks git.
  let n = d.effects.length;
  d.key('enter');
  assert.ok(!d.state.beat.ended, 'enter gives no word on a done-label beat');
  assert.deepEqual(d.effects.slice(n).filter((e) => e.type === 'git'), [], 'enter sends no look at the tree');
  d.send({ type: 'git', paths: [] });
  assert.deepEqual([d.state.pos.beat, d.state.beat.status], [1, 'waiting'], 'a clean tree decides nothing before the learner says so');
  assert.match(screenText(d.state).at(-1), /space\s+it says nothing to commit/, 'the key bar offers space');
  n = d.effects.length;
  d.key('space');
  assert.ok(d.state.beat.ended);
  assert.deepEqual(d.effects.slice(n).filter((e) => e.type === 'git').length, 1, 'space asks git');
  d.send({ type: 'git', paths: [] });
  assert.equal(d.state.beat.status, 'done');
  d.key('enter');
  // A none beat with a done-label: the same, and its key bar says space.
  assert.deepEqual([d.state.pos.beat, beatOf(d.state).verify.kind], [2, 'none']);
  assert.match(screenText(d.state).at(-1), /space\s+it's closed/, 'the key bar offers space');
  d.key('enter');
  assert.deepEqual([d.state.pos.beat, d.state.beat.status], [2, 'waiting'], 'enter leaves a none beat with a done-label unticked');
  d.key('space');
  assert.equal(d.state.pos.beat, 3, 'space ticks it');
  // A none beat with nothing to confirm: enter goes on.
  d.key('enter');
  assert.equal(d.state.pos.beat, 4, 'enter goes on from a none beat without a done-label');
});
