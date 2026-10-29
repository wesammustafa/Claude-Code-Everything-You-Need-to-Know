// The lesson engine on its own (ticket 207): Learner actions in, effects
// out, with no terminal module in reach and none of the terminal's state.
// The script here plays lessons by actions as playUntil plays them by keys:
// the seed of ticket 208's driver.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import * as engine from '../../learn/lib/engine.mjs';
import { WORK_LEVELS } from '../../learn/lib/content.mjs';
import { allScreens, b1Only, course, courseWith, FACTS, finished, finishedBefore, gitLists, jsonFor, lineFor, liveCourse, NEW_COPY, root, withCode, driver } from './learn-drive.mjs';

const { ACTION_TYPES, EFFECT_TYPES, ENGINE_FIELDS, asksFolder, backOffered, beatOf, folderKey, folderOptions, hintAvailable, lessonOf, stepOf, whileRunsOf } = engine;
const ENGINE = join(root, 'learn/lib/engine.mjs');
const LIB = join(root, 'learn/lib');

// The fields the translator owns, which no engine state holds.
const REMOVED = ['view', 'overlay', 'cursor', 'mapCursor', 'cardAt', 'itemsAt', 'toast', 'held', 'swallowUntil', 'confirmRestart', 'fx', 'mapReturn', 'checkOnlyRun'];
const REMOVED_INSIDE = ['typed', 'lockUntil'];

// ---- an engine-only driver -----------------------------------------------------
// Every state, effect and input type any script below met.
const seen = { states: [], effects: [], inputs: new Set() };

function engineDriver({ saved = null, facts = {}, lessons = course } = {}) {
  let now = 1_000;
  let state = engine.initialState({ course: lessons, saved, facts: { ...FACTS, ...facts }, now });
  seen.states.push(state);
  const send = (input) => {
    now += 3_000;
    const r = engine.reduce(state, { now, ...input });
    assert.deepEqual(r.events, [], 'no moments yet (ticket 212)');
    state = r.state;
    seen.states.push(state);
    seen.effects.push(...r.effects);
    seen.inputs.add(input.type);
    return r.effects;
  };
  return { send, get state() { return state; } };
}

// The result a check beat's run gives: every item failing, or passing.
function checkItems(s, pass) {
  const v = beatOf(s).verify;
  const l = lessonOf(s);
  return (v.all ? l.items.map((_, k) => k) : v.items).map((index) => ({ index, text: l.items[index], pass, hint: pass ? '' : `${l.items[index]} is not there yet.` }));
}

// The first time a play meets each of these, it struggles: a check fails,
// r runs it, the hints climb to the y/n, which says n and then y; a wrong
// pick, then the answer shown; a wrong answer typed, then the right one;
// the first step-down goes back, the next takes more help; one step goes
// back a beat.
const struggles = () => new Set(['check', 'pick', 'type', 'stepDown.back', 'stepDown.moreHelp', 'step.back']);

function climbHints(d) {
  for (let i = 0; i < 10 && hintAvailable(d.state) && !d.state.beat.confirm; i++) d.send({ type: 'hint.next' });
  if (!d.state.beat.confirm) return;
  d.send({ type: 'hint.takeExact', take: false });
  assert.equal(d.state.beat.confirm, false);
  d.send({ type: 'hint.next' });
  assert.equal(d.state.beat.confirm, true, 'h opens the y/n again');
  d.send({ type: 'hint.takeExact', take: true });
  assert.equal(d.state.progress[d.state.lesson].bottomAt, stepOf(d.state).id);
}

// Plays on by actions, as playUntil plays by keys, until `stop(state)`.
let moves = 0;
function playActions(d, stop, todo = new Set()) {
  for (let i = 0; i < 3_000 && !stop(d.state); i++) {
    const s = d.state;
    if (s.phase === 'overview') {
      if (asksFolder(s)) {
        const key = folderKey(s);
        if (WORK_LEVELS.includes(key) && folderOptions(s)[0] === 'copy') d.send({ type: 'folder.choose', key, to: 'practice-copy' });
        else if (s.folderAsk?.asked) d.send({ type: 'probed', key, asked: s.folderAsk.asked, path: NEW_COPY, missing: false, git: true, practice: true });
        else d.send({ type: 'folder.choose', key, to: { path: NEW_COPY } });
      } else d.send({ type: 'lesson.start', help: 'planned' });
      continue;
    }
    if (s.phase === 'step-down') {
      const type = todo.delete('stepDown.back') ? 'stepDown.back' : todo.delete('stepDown.moreHelp') ? 'stepDown.moreHelp' : 'stepDown.accept';
      d.send({ type });
      continue;
    }
    if (s.phase === 'complete') {
      d.send({ type: 'lesson.next' });
      continue;
    }
    if (!s.beat) {
      d.send({ type: 'lesson.open', lesson: s.lesson });
      continue;
    }
    const beat = beatOf(s);
    const v = beat.verify;
    if (engine.isDone(s.beat)) {
      if ((s.pos.beat > 0 || s.pos.step > 0) && todo.delete('step.back')) d.send({ type: 'step.back' });
      else d.send({ type: 'step.continue' });
    } else if (beat.kind === 'type') {
      if (todo.delete('type')) d.send({ type: 'answer.type', text: 'not it' });
      else d.send({ type: 'answer.type', text: beat.accept[0] });
    } else if (beat.ask && beat.options.length) {
      const wrong = beat.options.findIndex((o) => o.kind === 'wrong');
      if (beat.kind !== 'predict' && wrong >= 0 && beat.options.some((o) => o.kind === 'right') && todo.delete('pick')) {
        d.send({ type: 'answer.pick', option: wrong });
        if (!engine.isDone(d.state.beat)) d.send({ type: 'answer.reveal' });
        assert.equal(d.state.beat.answer.kind, 'revealed');
      } else d.send({ type: 'answer.pick', option: beat.options.findIndex((o) => beat.kind === 'predict' || ['right', 'option', 'other'].includes(o.kind)) });
    } else if (v.kind === 'check') {
      const path = beat.evidence ?? null;
      d.send({ type: 'check', lesson: s.lesson, items: checkItems(s, false), path, stamp: 'a' });
      if (todo.delete('check')) {
        d.send({ type: 'check.run' });
        d.send({ type: 'check', lesson: s.lesson, items: checkItems(s, false), path, stamp: 'a', asked: d.state.beat.asked });
        climbHints(d);
      }
      d.send({ type: 'check', lesson: s.lesson, items: checkItems(s, true), path, stamp: 'b' });
    } else if (['file', 'json', 'match', 'no-match'].includes(v.kind)) {
      const right = v.kind === 'json' ? jsonFor(v.key, v.value) : v.kind === 'match' ? `${lineFor(v.regex)}\n` : v.kind === 'no-match' ? 'a line\n' : 'src/config.js';
      const wrong = v.kind === 'json' ? '{' : v.kind === 'no-match' ? `${lineFor(v.regex)}\n` : null;
      d.send({ type: 'file', path: v.path, read: wrong === null ? null : Buffer.from(wrong), stamp: 'a' });
      d.send({ type: 'file', path: v.path, read: Buffer.from(right), stamp: 'b' });
    } else if (v.kind === 'git-clean') {
      if (beat.doneLabel) d.send({ type: 'session.ended' });
      d.send(v.paths ? gitLists([]) : { type: 'git', paths: [] });
    } else if (v.kind === 'git-staged') d.send(gitLists(['a.txt'], ['a.txt']));
    else if (['git-changed', 'git-only'].includes(v.kind)) d.send(gitLists([`${v.path.replace(/\/+$/, '')}/new.txt`]));
    else if (v.kind === 'head-moved') d.send({ type: 'git', paths: [], head: `new-${++moves}` });
    else if (v.kind === 'git-unchanged') d.send({ type: 'git', paths: [] });
    else if (v.kind === 'probe') {
      d.send({ type: 'probe', name: v.name, args: v.args, pass: false, hint: 'Not yet.', state: `a${++moves}` });
      d.send({ type: 'probe', name: v.name, args: v.args, pass: true, hint: '', evidence: 'Found.', state: `b${moves}` });
    } else d.send({ type: 'step.markDone' });
  }
  if (!stop(d.state)) throw new Error(`playActions: stuck at ${d.state.phase} ${d.state.lesson} ${d.state.beat ? stepOf(d.state)?.id : ''}`);
}

// ---- the script ------------------------------------------------------------------
function script() {
  // A first sitting: the welcome, lesson 1 with less help, struggling once
  // at each kind of beat, on to lesson 2.
  const d = engineDriver();
  assert.equal(d.state.welcomed, false);
  d.send({ type: 'welcome.finish' });
  assert.deepEqual([d.state.welcomed, d.state.phase, d.state.lesson], [true, 'overview', 'b-1']);
  d.send({ type: 'lesson.start', help: 'less' });
  assert.equal(d.state.progress['b-1'].lessHelp, true);
  const todo = struggles();
  playActions(d, (s) => s.phase === 'complete', todo);
  assert.deepEqual([...todo], [], 'the play struggled once at each');
  assert.equal(d.state.progress['b-1'].complete, true);
  d.send({ type: 'lesson.next' });
  assert.deepEqual([d.state.lesson, d.state.phase], ['b-2', 'overview']);
  d.send({ type: 'lesson.start', help: 'planned' });
  assert.equal(d.state.progress['b-2'].lessHelp, false);
  // Restart: the lesson's place goes, and its overview shows.
  d.send({ type: 'lesson.restart', lesson: 'b-1' });
  assert.deepEqual([d.state.lesson, d.state.phase, d.state.progress['b-1'].complete], ['b-1', 'overview', false]);

  // The level's work folder: a folder that isn't there, then one that is;
  // an answer dropped before main looked says nothing when it lands.
  const f = engineDriver({ saved: { format: 1, welcomed: true, lessons: finishedBefore('i-1') } });
  f.send({ type: 'lesson.open', lesson: 'i-1' });
  assert.ok(asksFolder(f.state));
  let out = f.send({ type: 'folder.choose', key: 'intermediate', to: { path: '/home/sam/gone' } });
  assert.deepEqual(out.filter((e) => e.type === 'folder'), [{ type: 'folder', key: 'intermediate', text: '/home/sam/gone', asked: f.state.asks }]);
  f.send({ type: 'probed', key: 'intermediate', asked: f.state.folderAsk.asked, path: '/home/sam/gone', missing: true });
  assert.deepEqual([f.state.folderAsk.missing, f.state.folderAsk.asked], ['/home/sam/gone', 0]);
  // Editing the answer clears the note about the last one.
  f.send({ type: 'folder.ask', key: 'intermediate' });
  assert.deepEqual(f.state.folderAsk, { key: 'intermediate', missing: null, isCopy: false, asked: 0 });
  f.send({ type: 'folder.choose', key: 'intermediate', to: { path: '/home/sam/work' } });
  f.send({ type: 'probed', key: 'intermediate', asked: f.state.folderAsk.asked, path: '/home/sam/work', missing: false, git: true, practice: true });
  assert.deepEqual([f.state.folders.intermediate, f.state.folderAsk, asksFolder(f.state)], ['/home/sam/work', null, false]);
  f.send({ type: 'folder.choose', key: 'intermediate', to: { path: '/home/sam/other' } });
  const asked = f.state.folderAsk.asked;
  f.send({ type: 'folder.cancel' });
  out = f.send({ type: 'probed', key: 'intermediate', asked, path: '/home/sam/other', missing: false, git: true, practice: true });
  assert.deepEqual([f.state.folders.intermediate, f.state.folderAsk, out], ['/home/sam/work', null, []], 'a late answer to a dropped ask sets nothing');
  f.send({ type: 'folder.choose', key: 'intermediate', to: 'practice-copy' });
  assert.equal(f.state.folders.intermediate, FACTS.root);
  // On through i-1 to its back line: the last rung offers the step it names.
  playActions(f, (s) => s.phase === 'playing' && Boolean(s.beat) && stepOf(s).id === 'Y3' && s.pos.beat === 1);
  if (engine.watching(f.state)) f.send({ type: 'check.run' });
  for (let i = 0; i < 10 && hintAvailable(f.state) && !f.state.beat.confirm; i++) f.send({ type: 'hint.next' });
  if (f.state.beat.confirm) f.send({ type: 'hint.takeExact', take: true });
  const back = backOffered(f.state);
  assert.ok(back, 'Y3 offers its back line');
  f.send({ type: 'step.revisit' });
  assert.equal(f.state.pos.step, back.at);

  // A lesson with no lesson file: its check runs as it opens, and r's run
  // carries its number where the lesson has a slow item.
  const c = engineDriver({ lessons: b1Only, saved: { format: 1, welcomed: true, lessons: { 'b-1': finished(b1Only[0]) } } });
  out = c.send({ type: 'lesson.open', lesson: 'b-2' });
  assert.deepEqual([c.state.phase, out.map((e) => e.type)], ['overview', ['check']]);
  out = c.send({ type: 'check.run' });
  assert.deepEqual(out, [{ type: 'check', lesson: 'b-2', items: null, slow: true, dir: FACTS.root }]);
  c.send({ type: 'lesson.open', lesson: 'b-3' });
  out = c.send({ type: 'check.run' });
  assert.deepEqual(out, [{ type: 'check', lesson: 'b-3', items: null, slow: true, asked: c.state.asks, dir: FACTS.root }]);

  // An optional step: skipped, it is not done.
  const optional = course.map((l) => (l.id === 'b-1' ? { ...l, content: { ...l.content, steps: l.content.steps.map((x) => (x.id === 'W2' ? { ...x, optional: 'Skip it.' } : x)) } } : l));
  const o = engineDriver({ lessons: optional, saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W2', beat: 0, done: ['W1'] } } } });
  o.send({ type: 'lesson.open', lesson: 'b-1' });
  o.send({ type: 'step.skip' });
  assert.equal(stepOf(o.state).id, 'W3');
  assert.ok(!o.state.progress['b-1'].done.includes('W2'));

  // A long wait's question: answered once.
  const w = engineDriver({ saved: { format: 1, welcomed: true, lessons: { ...finishedBefore('a-2'), 'a-2': { step: 'W3', beat: 1, done: ['W1', 'W2'], warm: [] } } } });
  w.send({ type: 'lesson.open', lesson: 'a-2' });
  const box = whileRunsOf(w.state);
  assert.ok(box, 'a-2 W3 offers a question while it runs');
  w.send({ type: 'waitQuestion.answer', option: 0 });
  assert.equal(whileRunsOf(w.state).answer, 0);
  assert.deepEqual(w.state.whileShown, [`a-2.${box.step.id}`]);
}
script();

// ---- the tests ---------------------------------------------------------------------
// Every relative module engine.mjs reaches, as absolute paths: through an
// import, a re-export, a bare import or a dynamic import().
const RELATIVE = /^(?:import|export)\s[^;]*?from\s+['"](\.{1,2}\/[^'"]+)['"]|^import\s+['"](\.{1,2}\/[^'"]+)['"]|\bimport\(\s*['"](\.{1,2}\/[^'"]+)['"]/gms;
const relativeOf = (text) => [...text.matchAll(RELATIVE)].map((m) => m[1] ?? m[2] ?? m[3]);
function reached(file, out = new Set()) {
  if (out.has(file)) return out;
  out.add(file);
  for (const to of relativeOf(readFileSync(file, 'utf8'))) reached(resolve(dirname(file), to), out);
  return out;
}

test('the import walk sees every way a module reaches another', () => {
  const text = "import { a } from './a.mjs';\nimport * as b from \"../b.mjs\";\nexport { c } from './c.mjs';\nexport * from './d.mjs';\nimport './e.mjs';\nconst f = await import('./f.mjs');\nexport const g = 1;\n";
  assert.deepEqual(relativeOf(text), ['./a.mjs', '../b.mjs', './c.mjs', './d.mjs', './e.mjs', './f.mjs']);
});

test('the engine imports no terminal module, reaches the engine package\'s text module, and reads no clock and picks nothing at random', () => {
  const files = reached(ENGINE);
  const terminal = ['render', 'motion', 'screen', 'theme', 'art', 'face', 'keys', 'caps', 'plain', 'text', 'main', 'flow', 'verify', 'watch', 'store'].map((n) => join(LIB, `${n}.mjs`));
  for (const file of files) {
    assert.ok(!terminal.includes(file), `engine.mjs reaches ${relative(root, file)}`);
    assert.ok(!relative(LIB, file).startsWith('pip/'), `engine.mjs reaches ${relative(root, file)}`);
    assert.notEqual(file, join(root, 'learn/app.mjs'));
  }
  assert.ok(files.has(resolve(root, '../quest/engine/src/text.mjs')), 'holds.mjs reads text through quest/engine');
  assert.doesNotMatch(readFileSync(ENGINE, 'utf8'), /Date\.now|performance\.now|new Date|Math\.random/);
});

test('the engine\'s state holds none of the terminal\'s fields: from every save, and after every input of the script', () => {
  const saves = [null, { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W3', beat: 0 } } }, { format: 1, welcomed: true, lessons: Object.fromEntries(course.filter((l) => l.content).map((l) => [l.id, finished(l)])) }, { format: 1, welcomed: false, lessons: { 'b-1': { step: 'W2', beat: 0 } } }];
  const states = [...seen.states];
  for (const lessons of [course, liveCourse]) for (const saved of saves) states.push(engine.initialState({ course: lessons, saved, facts: FACTS, now: 0 }));
  assert.ok(states.length > 100, `${states.length} states`);
  for (const s of states) {
    for (const k of Object.keys(s)) assert.ok(ENGINE_FIELDS.includes(k), `the engine's state holds ${k}`);
    for (const k of REMOVED) assert.ok(!(k in s), k);
    for (const inner of [s.beat, s.folderAsk]) for (const k of REMOVED_INSIDE) assert.ok(!(k in (inner ?? {})), k);
  }
  // Read, written or set as a key.
  const fields = [...REMOVED, ...REMOVED_INSIDE].join('|');
  const source = readFileSync(ENGINE, 'utf8');
  assert.doesNotMatch(source, new RegExp(`\\.(${fields})\\b`));
  assert.doesNotMatch(source, new RegExp(`[{,]\\s*['"]?(${fields})['"]?\\s*[:,}]`));
});

test('the engine asks for only its nine effects, and the script sends every action', () => {
  assert.deepEqual(EFFECT_TYPES, ['save', 'check', 'file', 'git', 'probe', 'stamp', 'folder', 'prereqs', 'commands']);
  for (const e of seen.effects) assert.ok(EFFECT_TYPES.includes(e.type), e.type);
  assert.deepEqual(ACTION_TYPES.filter((t) => !seen.inputs.has(t)), [], 'every action is played');
  // Every type the engine's source names is one of its effects, or `stale`,
  // the input a result about another folder becomes: the terminal's
  // effects are pushed nowhere in the engine.
  const named = new Set([...readFileSync(ENGINE, 'utf8').matchAll(/\btype:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]));
  assert.deepEqual([...named].filter((t) => !EFFECT_TYPES.includes(t) && t !== 'stale'), []);
  // ... and the translator still asks for a copy on k.
  const lines = ['- code: point 1', '```bash', 'ls', '```'];
  const k = driver({ course: courseWith({ 'b-2': withCode(lines) }), facts: { clipboard: true }, saved: { format: 1, welcomed: true, lessons: { 'b-1': finished(course.find((l) => l.id === 'b-1')), 'b-2': { warm: ['R1', 'R2', 'R3'], done: ['R1', 'R2', 'R3'], step: 'W1', beat: 0 } } } });
  k.key('enter');
  assert.deepEqual(k.key('k').filter((e) => e.type === 'copy'), [{ type: 'copy', text: 'ls' }]);
});

test('the translator keeps the engine away exactly on the welcome and the map', () => {
  for (const [label, s] of allScreens()) assert.equal(s.away, ['welcome', 'map'].includes(s.view), label);
});

test('an action whose guard fails changes nothing: on a fresh overview, nothing of a step acts', () => {
  const s = engine.initialState({ course, saved: null, facts: FACTS, now: 0 });
  for (const type of ['step.continue', 'step.back', 'step.skip', 'step.revisit', 'answer.pick', 'answer.reveal', 'answer.type', 'step.markDone', 'session.ended', 'check.run', 'hint.next', 'hint.takeExact', 'waitQuestion.answer', 'stepDown.accept', 'stepDown.moreHelp', 'stepDown.back', 'lesson.next']) {
    const r = engine.reduce(s, { type, option: 0, text: 'x', take: true });
    assert.deepEqual([r.state, r.effects], [s, []], type);
  }
  assert.deepEqual(engine.reduce(s, { type: 'lesson.open', lesson: 'nope' }).state, s);
  for (const key of ['b-1', 'beginner', 'nope']) {
    for (const input of [{ type: 'folder.choose', key, to: 'practice-copy' }, { type: 'folder.choose', key, to: { path: '/home/sam/work' } }, { type: 'folder.ask', key }]) {
      const r = engine.reduce(s, input);
      assert.deepEqual([r.state, r.effects], [s, []], `${input.type} ${key}`);
    }
  }
});

// The state after `inputs`, from a save.
function stateAt(saved, inputs) {
  let s = engine.initialState({ course, saved: { format: 1, welcomed: true, ...saved }, facts: FACTS, now: 0 });
  for (const input of inputs) s = engine.reduce(s, input).state;
  return s;
}

test('an overview with its folder question open starts nothing: no check runs before the answer', () => {
  for (const id of ['i-1', 'a-5']) {
    const s = stateAt({ lessons: finishedBefore(id) }, [{ type: 'lesson.open', lesson: id }]);
    assert.ok(asksFolder(s), id);
    for (const help of ['planned', 'less']) {
      const r = engine.reduce(s, { type: 'lesson.start', help });
      assert.deepEqual([r.state, r.effects], [s, []], `${id} ${help}`);
    }
  }
});

test('a typed-answer beat takes no pick and shows no answer: its options are its known wrong answers', () => {
  const s = stateAt({ lessons: { 'b-1': { step: 'C', beat: 1 } } }, [{ type: 'lesson.open', lesson: 'b-1' }]);
  assert.deepEqual([beatOf(s).kind, beatOf(s).options.length > 0], ['type', true]);
  for (const input of [{ type: 'answer.pick', option: 0 }, { type: 'answer.reveal' }]) {
    const r = engine.reduce(s, input);
    assert.deepEqual([r.state, r.effects], [s, []], input.type);
  }
});
