// The work folder (ticket 86): each later level practises in a folder the
// learner picks, the practice copy by default, while progress stays in the
// copy. Some lessons pin theirs: i-capstone to the copy, and a-5 and the
// Advanced capstone to the new copy each asks for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, delimiter, dirname, join, relative } from 'node:path';
import { PassThrough } from 'node:stream';
import { loadCourse, parseLesson, PATH } from '../../learn/lib/content.mjs';
import { C } from '../../learn/lib/copy.mjs';
import { main } from '../../learn/lib/main.mjs';
import { render } from '../../learn/lib/render.mjs';
import { strip, width } from '../../learn/lib/text.mjs';
import { theme } from '../../learn/lib/theme.mjs';
import { FORMAT, loadState, sanitize, saveState, snapshot, storePath } from '../../learn/lib/store.mjs';
import { beatOf, folderHere, introAsks, lessonOf, stepOf, stepsOf, watching } from '../../learn/lib/flow.mjs';
import { probeFolder } from '../../learn/lib/verify.mjs';
import { commit, exportHead, repo, withRepo, write } from './helpers.mjs';
import { course, DEMO_I1, driver, FACTS, finished, finishedBefore, gitLists, lessonScreens, mapTo, playUntil, root, threeLevels } from './learn-drive.mjs';
import { fakeOut } from './learn-term.mjs';

const MINE = '/home/sam/code/my-app';

test('saved state: the work folders are an optional key, kept per level and per pinned lesson, as absolute paths only', () => {
  const folders = { intermediate: MINE, advanced: '/home/sam/code/other', 'a-5': '/home/sam/claude-actions-practice', 'a-capstone': '/home/sam/ci-review' };
  assert.deepEqual(sanitize({ folders }).folders, folders);
  // Nothing else: Beginner practises in the copy, other lessons use their level's.
  const kept = sanitize({ folders: { ...folders, beginner: MINE, 'i-1': MINE, 'b-1': MINE, reason: 'my app', '../x': MINE } }).folders;
  assert.deepEqual(kept, folders);
  for (const bad of ['code/my-app', './my-app', '', 3, null, true, ['/x'], { path: '/x' }, `/x\n/y`, `/x\0`, `/${'a'.repeat(1024)}`]) {
    assert.equal(sanitize({ folders: { intermediate: bad } }).folders, undefined, JSON.stringify(bad));
  }
  assert.equal(sanitize({ folders: { intermediate: `/${'a'.repeat(1023)}` } }).folders.intermediate.length, 1024, 'a path of 1024 characters is kept');
  // A file with no folder saves none: the key is left out, not written empty.
  assert.equal('folders' in sanitize({ welcomed: true, lessons: {} }), false);
  assert.equal('folders' in sanitize({ folders: 'nope' }), false);
});

test('saved state: FORMAT stays 1, and a learn.json today\'s app wrote loads with its progress intact', () => {
  assert.equal(FORMAT, 1);
  withRepo(() => repo(), (dir) => {
    mkdirSync(join(dir, '.practice'));
    // Written by the app before the work folder: no `folders` key.
    const today = {
      format: 1, welcomed: true, eased: ['status'], missed: ['exit'],
      lessons: {
        'b-1': { step: null, beat: 0, done: ['W1', 'W2', 'W3'], answers: { 'W4.0': 'Yes' }, levels: ['hinted'], lessHelp: false, moreHelpAt: null, easedSteps: { Y1: true }, complete: true, warm: [], recalled: [], stamps: {}, bottomAt: 'W3' },
        'b-2': { step: 'W2', beat: 1, done: ['R1', 'W1'], answers: {}, levels: [], lessHelp: true, moreHelpAt: 'W2', easedSteps: {}, complete: false, warm: ['R1', 'R2'], recalled: ['R1'], stamps: { 'Y1.0': '1:2:abc' }, bottomAt: null },
      },
    };
    writeFileSync(storePath(dir), `${JSON.stringify(today, null, 1)}\n`);
    assert.deepEqual(loadState(dir), today);
    // With folders, the same progress, and the folders round trip.
    const withFolders = sanitize({ ...today, folders: { intermediate: MINE } });
    assert.equal(saveState(dir, withFolders), true);
    assert.deepEqual(loadState(dir), { ...today, folders: { intermediate: MINE } });
  });
});

// ---- the reducer ---------------------------------------------------------------
const COPY = FACTS.root;
// The course with DEMO_I1 as i-1, and i-5, i-capstone, a-1, a-5 and
// a-capstone shown through their checks: every lesson has a file, and these
// tests need a check-only lesson that practises in the level's folder, one
// pinned to the copy, one in the Advanced folder and the two that run in a
// new copy.
const CHECK_ONLY = new Set(['i-5', 'i-capstone', 'a-1', 'a-5', 'a-capstone']);
const withI1 = () => threeLevels({ 'i-1': DEMO_I1 }).map((l) => (CHECK_ONLY.has(l.id) ? { ...l, content: null } : l));
// A learner past Beginner, on i-1's intro, with these folders saved.
const atI1 = (folders, course = withI1()) => driver({ course, saved: { format: 1, welcomed: true, lessons: finishedBefore('i-1', course), ...(folders ? { folders } : {}) } });
const lastOf = (effects, type) => effects.filter((e) => e.type === type).at(-1);
// Plays i-1 on to W1, its first check beat, as a learner who needs no help.
const toW1 = (d) => playUntil(d, (s) => s.view === 'step' && stepOf(s).id === 'W1');

test('the default work folder is the practice copy: every check, file and git effect names it', () => {
  const b = driver({ course: threeLevels() });
  playUntil(b, (s) => s.view === 'step' && beatOf(s).verify.kind === 'check');
  assert.equal(lastOf(b.effects, 'check').dir, COPY);
  playUntil(b, (s) => s.view === 'step' && beatOf(s).verify.kind === 'git-clean');
  assert.equal(lastOf(b.effects, 'git').dir, COPY);
  const d = atI1(null);
  toW1(d);
  assert.equal(lastOf(d.effects, 'check').dir, COPY);
  assert.equal(watching(d.state).dir, COPY);
});

test('a saved work folder is where its level\'s checks run; Beginner stays in the copy whatever is saved', () => {
  const folders = { intermediate: MINE, advanced: '/home/sam/code/other' };
  const d = atI1(folders);
  toW1(d);
  assert.equal(lastOf(d.effects, 'check').dir, MINE);
  assert.equal(watching(d.state).dir, MINE);
  d.key('r');
  assert.equal(lastOf(d.effects, 'check').dir, MINE, "r's run too");
  // Beginner: a lesson there runs in the copy.
  const b = driver({ course: withI1(), saved: { format: 1, welcomed: true, lessons: {}, folders } });
  playUntil(b, (s) => s.view === 'step' && beatOf(s).verify.kind === 'check');
  assert.equal(lastOf(b.effects, 'check').dir, COPY);
  // A check-only lesson of each later level: its own level's folder.
  for (const [id, dir] of [['i-5', MINE], ['a-1', '/home/sam/code/other']]) {
    const c = driver({ course: withI1(), saved: { format: 1, welcomed: true, lessons: {}, folders } });
    c.key('m');
    mapTo(c, id);
    c.key('enter');
    assert.equal(c.state.view, 'checkonly');
    assert.equal(lastOf(c.effects, 'check').dir, dir, id);
    assert.equal(watching(c.state).dir, dir, id);
  }
});

test('a result from another folder than the lesson\'s decides nothing', () => {
  const d = atI1({ intermediate: MINE });
  toW1(d);
  const items = [{ index: 0, text: 'x', pass: true, hint: '' }];
  d.send({ type: 'check', lesson: 'i-1', items, dir: COPY });
  assert.equal(d.state.beat.status, 'opening', 'a result from the copy is not about this folder');
  d.send({ type: 'check', lesson: 'i-1', items, dir: MINE });
  assert.equal(d.state.beat.status, 'already');
});

test('a beat that reads a file (json, match, no-match) reads it in the work folder: on opening, on r, and only a result from there decides', () => {
  const path = '.claude/skills/tdd/SKILL.md';
  for (const verify of [`json ${path}`, `match ${path} ^name: tdd$`, `no-match ${path} TODO`]) {
    const d = atI1({ intermediate: MINE }, threeLevels({ 'i-1': DEMO_I1.replace('- verify: check 0\n', `- verify: ${verify}\n`) }));
    toW1(d);
    assert.equal(d.state.beat.status, 'opening', verify);
    assert.deepEqual(lastOf(d.effects, 'file'), { type: 'file', path, dir: MINE }, verify);
    assert.deepEqual(watching(d.state), { file: path, dir: MINE }, verify);
    d.key('r');
    assert.deepEqual(lastOf(d.effects, 'file'), { type: 'file', path, asked: d.state.asks, dir: MINE }, `${verify}: r's read too`);
    const read = Buffer.from(verify.startsWith('json') ? '{"name": "tdd"}' : 'name: tdd\n');
    d.send({ type: 'file', path, read, stamp: 'a', asked: d.state.beat.asked, dir: COPY });
    assert.equal(d.state.beat.status, 'opening', `${verify}: a read of the copy is not about this folder`);
    d.send({ type: 'file', path, read, stamp: 'a', asked: d.state.beat.asked, dir: MINE });
    assert.ok(['done', 'already'].includes(d.state.beat.status), `${verify}: ${d.state.beat.status}`);
  }
});

// ---- the question at a level's first intro ------------------------------------
const FULL = theme({ tty: true, depth: 8, unicode: true, links: true, win32: false });
const ASCII = theme({ tty: true, depth: 1, unicode: false, links: false, win32: true });
const screen = (state, [cols, rows] = [80, 24], t = FULL) => render(state, { cols, rows }, t).map((l) => strip(l).trimEnd());
const has = (lines, text) => lines.some((l) => l.includes(text));
const shows = (d, text, size) => has(screen(d.state, size), text);
// A screen's words as one line, for a sentence that wraps.
const flat = (lines) => lines.map((l) => l.trim().replace(/^[│|]\s*/, '')).join(' ').replace(/\s+/g, ' ');
// Types `text` one key at a time, as a person does.
const typeIn = (d, text) => {
  for (const c of text) d.send({ type: 'key', name: c === ' ' ? 'space' : c.toLowerCase(), ch: c, wait: 40 });
};
// The prompt's ask goes out as an effect; main answers with what it found.
const answer = (d, found) => {
  const ask = lastOf(d.effects, 'folder');
  d.send({ type: 'probed', key: ask.key, asked: ask.asked, path: ask.text, missing: false, git: true, practice: true, ...found });
};

test('Intermediate\'s first intro asks where to practise: this practice copy, or another folder; Beginner\'s first intro asks nothing', () => {
  const d = atI1(null);
  assert.equal(d.state.view, 'intro');
  for (const size of [[60, 20], [80, 24]]) {
    const lines = screen(d.state, size);
    const where = `${size}\n${lines.join('\n')}`;
    assert.ok(has(lines, C.folderAsk(C.levels.intermediate)), where);
    assert.ok(has(lines, C.folderCopy) && has(lines, C.folderOther), where);
    assert.ok(!has(lines, C.startLesson(1)), `the start options wait for the answer\n${where}`);
  }
  // enter answers the question: the bar says so, not "choose" twice.
  for (const size of SIZES) assert.match(screen(d.state, size).at(-1), /choose {4}enter answer {4}m map/);
  const b = driver({ course: withI1(), saved: { format: 1, welcomed: true, lessons: {} } });
  assert.deepEqual([b.state.view, b.state.lesson], ['intro', 'b-1']);
  assert.ok(!shows(b, C.folderCopy) && shows(b, C.startLesson(1)));
  // An answer saved, or given with --dir, is an answer: the start options show.
  assert.ok(shows(atI1({ intermediate: MINE }), C.startLesson(1)));
});

test('"this practice copy" saves the copy as the level\'s work folder and nothing else, then the intro offers the start', () => {
  const d = atI1(null);
  d.key('enter');
  assert.equal(d.state.folders.intermediate, COPY);
  assert.deepEqual(snapshot(d.state).folders, { intermediate: COPY });
  assert.ok(d.effects.some((e) => e.type === 'save'));
  assert.equal(d.state.view, 'intro');
  assert.ok(shows(d, C.startLesson(1)), screen(d.state).join('\n'));
  assert.ok(shows(d, `${C.workFolder} ${C.thisCopy}`), screen(d.state).join('\n'));
  d.key('enter');
  assert.equal(d.state.view, 'step', 'enter now starts the lesson');
});

test('"another folder" opens the path prompt: a typed path goes to main to look at, and the folder it finds is saved and used', () => {
  const d = atI1(null);
  d.key('down');
  d.key('enter');
  assert.equal(d.state.overlay, 'folder');
  assert.ok(shows(d, C.folderPrompt(C.levels.intermediate)), screen(d.state).join('\n'));
  typeIn(d, '~/code/my-app');
  assert.ok(shows(d, '~/code/my-app'), screen(d.state).join('\n'));
  d.send({ type: 'key', name: 'enter', wait: 40 });
  assert.deepEqual(lastOf(d.effects, 'folder'), { type: 'folder', key: 'intermediate', text: '~/code/my-app', asked: d.state.folderAsk.asked });
  assert.ok(shows(d, C.checking()), 'it says it is looking');
  answer(d, { path: MINE });
  assert.equal(d.state.overlay, null);
  assert.equal(d.state.folders.intermediate, MINE);
  assert.deepEqual(snapshot(d.state).folders, { intermediate: MINE }, 'only the folder is saved: no reason, no goal');
  assert.ok(shows(d, `${C.workFolder} ${MINE}`), screen(d.state).join('\n'));
  assert.ok(has(screen(d.state), `❯  ${C.startLesson(1)}`), 'the cursor is back on the start');
  // f on the intro changes it again; Esc keeps it.
  d.key('f');
  assert.equal(d.state.folderAsk?.key, 'intermediate');
  d.send({ type: 'key', name: 'escape', wait: 40 });
  assert.equal(d.state.folders.intermediate, MINE);
  toW1(d);
  assert.equal(lastOf(d.effects, 'check').dir, MINE);
});

test('the level\'s first intro the learner opens asks, whichever lesson it is; the intro that took the answer shows it', () => {
  const i3 = DEMO_I1.replace('lesson: i-1', 'lesson: i-3').replace('next: i-2', 'next: i-4');
  const course = threeLevels({ 'i-1': DEMO_I1, 'i-3': i3 });
  const d = atI1(null, course);
  d.key('m');
  mapTo(d, 'i-3');
  d.key('enter');
  assert.deepEqual([d.state.view, d.state.lesson], ['intro', 'i-3']);
  assert.ok(shows(d, C.folderAsk(C.levels.intermediate)), screen(d.state).join('\n'));
  d.key('enter');
  assert.equal(d.state.folders.intermediate, COPY);
  assert.ok(shows(d, `${C.workFolder} ${C.thisCopy}`) && shows(d, C.startLesson(3)), screen(d.state).join('\n'));
  fitsAll(d.state, 'i-3 answered');
  // i-1, the level's first lesson, shows the answer; it no longer asks.
  d.key('m');
  mapTo(d, 'i-1');
  d.key('enter');
  assert.ok(shows(d, `${C.workFolder} ${C.thisCopy}`) && shows(d, C.startLesson(1)), screen(d.state).join('\n'));
  // A later lesson's intro, once the level has its answer, neither asks nor shows it.
  const later = atI1({ intermediate: COPY }, course);
  later.key('m');
  mapTo(later, 'i-3');
  later.key('enter');
  assert.ok(!shows(later, C.folderAsk(C.levels.intermediate)) && !shows(later, C.workFolder), screen(later.state).join('\n'));
});

test('the path prompt keeps a pasted path whole, up to 1024 characters, while a typed answer still takes 40', () => {
  const d = atI1(null);
  d.key('down');
  d.key('enter');
  const long = `/home/sam/${'a-very-long-folder-name/'.repeat(60)}`.slice(0, 1100);
  d.send({ type: 'paste', text: `${long}\n`, wait: 40 });
  assert.equal(d.state.folderAsk.typed, long.slice(0, 1024));
  assert.equal(d.state.toast, null, 'a paste into the prompt is no stray command');
  for (const size of [[60, 20], [80, 24]]) {
    for (const t of [FULL, ASCII]) {
      const raw = render(d.state, { cols: size[0], rows: size[1] }, t);
      assert.equal(raw.length, size[1]);
      assert.ok(raw.every((l) => width(l) <= size[0] - 1));
      // The end of the path, where the next key goes, is on screen.
      assert.ok(has(raw.map(strip), 'folder-name/a-very-long'), raw.map(strip).join('\n'));
    }
  }
  d.send({ type: 'key', name: 'backspace', wait: 40 });
  assert.equal(d.state.folderAsk.typed.length, 1023);
  // Not there: the note about it fits too, whole rows only.
  d.send({ type: 'key', name: 'enter', wait: 40 });
  answer(d, { missing: true, git: false, practice: false });
  for (const t of [FULL, ASCII]) {
    for (const [cols, rows] of SIZES) {
      const lines = render(d.state, { cols, rows }, t).map(strip);
      assert.ok(lines.some((l) => l.includes('No folder at /home/sam/')), lines.join('\n'));
      assert.ok(!lines.some((l) => l.trim() === t.glyph.ellipsis), lines.join('\n'));
    }
  }
  fitsAll(d.state, 'a long path that is not there');
  // A pasted line in a typed answer is still cut at 40 (flow's limit).
  const b = driver();
  playUntil(b, (s) => s.view === 'step' && beatOf(s).kind === 'type');
  b.send({ type: 'paste', text: 'x'.repeat(60), wait: 40 });
  assert.equal(b.state.beat.typed.length, 40);
});

test('a missing folder keeps the prompt open and says so; Esc leaves it, and a late answer for it changes nothing', () => {
  const d = atI1(null);
  d.key('down');
  d.key('enter');
  typeIn(d, '/nope');
  d.send({ type: 'key', name: 'enter', wait: 40 });
  answer(d, { path: '/nope', missing: true, git: false, practice: false });
  assert.equal(d.state.overlay, 'folder');
  assert.equal(d.state.folders.intermediate, undefined);
  assert.ok(shows(d, C.noFolder('/nope')), screen(d.state).join('\n'));
  // Typing again clears the note.
  d.send({ type: 'key', name: 'backspace', wait: 40 });
  assert.ok(!shows(d, C.noFolder('/nope')));
  typeIn(d, 'e');
  d.send({ type: 'key', name: 'enter', wait: 40 });
  d.send({ type: 'key', name: 'escape', wait: 40 });
  assert.equal(d.state.overlay, null);
  answer(d, { path: '/nope' });
  assert.equal(d.state.folders.intermediate, undefined, 'the answer came after Esc');
  assert.ok(shows(d, C.folderAsk(C.levels.intermediate)), 'the question is still open');
});

// ---- where the learner is sent ---------------------------------------------------
const SIZES = [[60, 20], [80, 24]];
// Every screen at both sizes and in every mode: exactly the window.
const fitsAll = (state, label) => {
  for (const t of [FULL, ASCII]) {
    for (const [cols, rows] of SIZES) {
      const raw = render(state, { cols, rows }, t);
      const where = `${label} at ${cols}x${rows}\n${raw.map(strip).join('\n')}`;
      assert.equal(raw.length, rows, where);
      assert.ok(raw.every((l) => width(l) <= cols - 1), where);
    }
  }
};
// The rows of the header: above the first rule.
const headOf = (lines) => lines.slice(0, lines.findIndex((l) => /^\s*[─━-]{20}/.test(l)));

test('when the work folder isn\'t the copy, the header names it on every lesson screen of its level, and nowhere else', () => {
  const d = atI1({ intermediate: MINE });
  const seen = [];
  const look = (label) => {
    for (const size of SIZES) {
      const lines = screen(d.state, size);
      assert.ok(has(headOf(lines), C.inFolder('my-app')), `${label} at ${size}\n${lines.join('\n')}`);
    }
    fitsAll(d.state, label);
    seen.push(label);
  };
  look('intro');
  toW1(d);
  look('W1');
  playUntil(d, (s) => s.view === 'step' && stepOf(s).id === 'C');
  look('C');
  // Beginner, and a level whose folder is the copy, name none.
  const b = driver({ course: withI1(), saved: { format: 1, welcomed: true, lessons: {}, folders: { intermediate: MINE } } });
  assert.ok(!has(screen(b.state), C.inFolder('my-app')));
  assert.ok(!has(screen(atI1({ intermediate: COPY }).state), C.inFolder('claude-code-practice')));
  // A check-only lesson of the level names it too.
  const c = atI1({ intermediate: MINE });
  c.key('m');
  mapTo(c, 'i-5');
  c.key('enter');
  for (const size of SIZES) assert.ok(has(headOf(screen(c.state, size)), C.inFolder('my-app')), screen(c.state, size).join('\n'));
  fitsAll(c.state, 'i-5 check-only');
});

test('every line that sends the learner to another terminal says which folder: the card\'s place, the check-only card\'s and the stray-command note', () => {
  const d = atI1({ intermediate: MINE });
  playUntil(d, (s) => s.view === 'step' && stepOf(s).id === 'W2');
  // Each terminal names its folder; W1 happens in an editor.
  for (const size of SIZES) assert.ok(has(screen(d.state, size), 'in a terminal, in my-app'), screen(d.state, size).join('\n'));
  d.send({ type: 'paste', text: 'git commit -m x', wait: 40 });
  assert.ok(has(screen(d.state), C.strayIn(C.inFolder('my-app')).slice(0, 40)), screen(d.state).join('\n'));
  playUntil(d, (s) => s.view === 'step' && stepOf(s).id === 'C');
  assert.ok(has(screen(d.state), 'in a terminal, in my-app'), screen(d.state).join('\n'));
  // The Check passes: the command shown names the folder, run from the copy.
  const items = lessonOf(d.state).items.map((text, index) => ({ index, text, pass: true, hint: '' }));
  d.send({ type: 'check', lesson: 'i-1', items, dir: MINE });
  const lines = screen(d.state, [80, 24]);
  assert.ok(has(lines, `npm run check -- i-1 --dir ${MINE}`), lines.join('\n'));
  assert.ok(flat(lines).includes('Run it in your practice copy too: you will see the same result.'), lines.join('\n'));
  fitsAll(d.state, 'C done');
  // In the copy, the lines are as they were.
  const copy = atI1({ intermediate: COPY });
  playUntil(copy, (s) => s.view === 'step' && stepOf(s).id === 'C');
  assert.ok(!has(screen(copy.state), `${C.where.terminal},`));
  // A check-only card: its place is the work folder, or the copy for i-capstone, pinned there.
  const c = atI1({ intermediate: MINE });
  c.key('m');
  mapTo(c, 'i-5');
  c.key('enter');
  assert.ok(has(screen(c.state), 'in a terminal, in my-app'), screen(c.state).join('\n'));
  c.key('m');
  mapTo(c, 'i-capstone');
  c.key('enter');
  assert.equal(c.state.lesson, 'i-capstone');
  assert.equal(lastOf(c.effects, 'check').dir, COPY, 'i-capstone checks in the copy');
  assert.ok(has(screen(c.state), 'in a terminal, in your practice copy'), screen(c.state).join('\n'));
  assert.ok(!has(headOf(screen(c.state)), C.inFolder('my-app')));
});

test('the Intermediate capstone, pinned to the copy, invites questions in the copy while the level practises elsewhere', () => {
  const text = readFileSync(join(root, 'learn', 'lessons', 'b-capstone.md'), 'utf8').replace('lesson: b-capstone', 'lesson: i-capstone');
  const course = threeLevels({ 'i-1': DEMO_I1, 'i-capstone': text });
  for (const [folders, invite] of [[{ intermediate: MINE }, C.invitationAt(C.inCopy)], [{}, C.invitation]]) {
    const d = driver({ course, saved: { format: 1, welcomed: true, lessons: finishedBefore('i-capstone', course), folders } });
    playUntil(d, (s) => s.view === 'next');
    assert.equal(d.state.lesson, 'i-capstone');
    for (const size of SIZES) assert.ok(flat(screen(d.state, size)).includes(invite), screen(d.state, size).join('\n'));
    fitsAll(d.state, 'i-capstone next');
  }
});

test('a run line\'s <your repo> shows the work folder, the way <your practice copy> shows the copy', () => {
  const text = DEMO_I1.replace('- goal: "Run the check."', '- goal: "Run the check."\n- run: "npm run check -- i-1 --dir <your repo>"');
  const course = threeLevels({ 'i-1': text });
  for (const [dir, shown] of [[MINE, MINE], ['/home/sam/my code', "'/home/sam/my code'"], [COPY, COPY]]) {
    const d = atI1({ intermediate: dir }, course);
    playUntil(d, (s) => s.view === 'step' && stepOf(s).id === 'C');
    const lines = screen(d.state, [80, 24]);
    assert.ok(has(lines, `npm run check -- i-1 --dir ${shown}`), lines.join('\n'));
    assert.ok(!has(lines, '<your repo>'));
    fitsAll(d.state, dir);
  }
  // That line is run from the copy: the card's place says so, and so does
  // the note for a command typed here.
  const d = atI1({ intermediate: MINE }, course);
  playUntil(d, (s) => s.view === 'step' && stepOf(s).id === 'C');
  assert.ok(has(screen(d.state), 'in a terminal, in your practice copy'), screen(d.state).join('\n'));
  d.send({ type: 'paste', text: 'npm run check -- i-1', wait: 40 });
  assert.ok(flat(screen(d.state)).includes(C.strayIn(C.inCopy)), screen(d.state).join('\n'));
  assert.ok(!flat(screen(d.state)).includes(C.strayIn(C.inFolder('my-app'))), screen(d.state).join('\n'));
});

// ---- the map ---------------------------------------------------------------------
// The map, at the page of `id`'s level, from a learner past Beginner.
const mapAt = (id, folders) => {
  const d = atI1(folders);
  d.key('m');
  mapTo(d, id);
  return d;
};

test('the map shows each later level\'s work folder, and f there changes it; Beginner\'s page has none', () => {
  const d = mapAt('i-1');
  for (const size of SIZES) assert.ok(has(screen(d.state, size), `${C.workFolder} ${C.thisCopy}`), screen(d.state, size).join('\n'));
  d.key('f');
  assert.equal(d.state.overlay, 'folder');
  assert.equal(d.state.folderAsk.key, 'intermediate');
  typeIn(d, MINE);
  d.send({ type: 'key', name: 'enter', wait: 40 });
  answer(d, {});
  assert.equal(d.state.view, 'map');
  assert.deepEqual(d.state.folders, { intermediate: MINE });
  assert.ok(has(screen(d.state), `${C.workFolder} ${MINE}`), screen(d.state).join('\n'));
  // Advanced has its own, the copy until it is changed.
  d.key('right');
  assert.ok(has(screen(d.state), `${C.workFolder} ${C.thisCopy}`), screen(d.state).join('\n'));
  d.key('f');
  assert.equal(d.state.folderAsk.key, 'advanced');
  // An empty line is this practice copy.
  d.send({ type: 'key', name: 'enter', wait: 40 });
  assert.deepEqual(d.state.folders, { intermediate: MINE, advanced: COPY });
  // Beginner: no folder row, and f does nothing.
  d.key('right');
  assert.ok(!has(screen(d.state), C.workFolder));
  d.key('f');
  assert.equal(d.state.overlay, null);
  for (const id of ['b-1', 'i-1', 'a-1']) fitsAll(mapAt(id, { intermediate: `/home/sam/${'deep/'.repeat(40)}my-app` }).state, `map at ${id}`);
});

test('f is on the map\'s bar where it fits and in ?, and the bar still fits at 60x20', () => {
  const d = mapAt('i-1');
  assert.match(screen(d.state, [80, 24]).at(-1), /f folder/);
  for (const t of [FULL, ASCII]) {
    for (const size of SIZES) {
      const bar = screen(d.state, size, t).at(-1);
      assert.match(bar, /(←→|<- ->) level {4}enter open {4}(f folder {4})?m back {4}q quit$/, `${size}: ${bar}`);
    }
  }
  assert.doesNotMatch(screen(mapAt('b-1').state, [80, 24]).at(-1), /f folder/);
  d.key('?');
  for (const t of [FULL, ASCII]) {
    for (const size of SIZES) {
      const lines = screen(d.state, size, t);
      // On the level row: ← → and f share it, so it costs no row.
      assert.ok(lines.some((l) => /^\s*(← →|<- ->) {2}f /.test(l) && l.endsWith(C.levelKey[1])), `${size}\n${lines.join('\n')}`);
      // Every key stays at 60x20.
      for (const [, label] of C.keyHelp) assert.ok(has(lines, label), `${label} at ${size}\n${lines.join('\n')}`);
      assert.ok(!lines.some((l) => l.trim() === t.glyph.ellipsis), lines.join('\n'));
    }
  }
  // A course of Beginner alone has no f.
  const b = driver({ course: threeLevels().filter((l) => l.level === 'beginner'), saved: { format: 1, welcomed: true, lessons: {} } });
  b.key('?');
  assert.ok(!has(screen(b.state), C.levelKey[1]));
});

test('f on a check-only card changes its level\'s folder; i-capstone, pinned to the copy, has no f', () => {
  const d = mapAt('i-5');
  d.key('enter');
  assert.match(screen(d.state, [80, 24]).at(-1), /f folder/);
  d.key('f');
  assert.equal(d.state.folderAsk.key, 'intermediate');
  typeIn(d, MINE);
  d.send({ type: 'key', name: 'enter', wait: 40 });
  answer(d, {});
  assert.equal(d.state.view, 'checkonly');
  assert.equal(lastOf(d.effects, 'check').dir, MINE, 'the card checks the new folder at once');
  d.key('m');
  mapTo(d, 'i-capstone');
  d.key('enter');
  assert.doesNotMatch(screen(d.state, [80, 24]).at(-1), /f folder/);
  d.key('f');
  assert.equal(d.state.overlay, null);
});

// ---- the intro's rows (ticket 142's row test, measured again) -------------------
// i-1 with b-4's intro: a Why line, four can lines and a payoff, so the
// level's first intro is as full as a Beginner one, plus `extra` can lines.
const B4_INTRO = readFileSync(join(root, 'checks/test/fixtures/reducer-course', 'b-4.md'), 'utf8').match(/## intro\n([\s\S]*?)\n## /)[1];
const fullI1 = (extra = 0) => DEMO_I1.replace(/## intro\n[\s\S]*?\n## warm-up/, `## intro\n${B4_INTRO}${Array.from({ length: extra }, (_, k) => `- can: "practise skill ${k + 1}"\n`).join('')}\n## warm-up`);
const MODES = [FULL, theme({ tty: true, depth: 4, unicode: true, links: false, win32: false }), theme({ tty: true, depth: 1, unicode: true, links: false, win32: false }), ASCII];
const widthCut = (t, cols) => (l) => width(l) === cols - 1 && (t.unicode ? l.endsWith('…') : /\S\.$/.test(l));

test('the level\'s first intro fits its folder rows at 60x20 and 80x24 in every mode: no teaching line cut, and the Why line gives way first', () => {
  const long = `/home/sam/${'deep/'.repeat(40)}my-app`;
  const states = (extra) => {
    const course = threeLevels({ 'i-1': fullI1(extra) });
    const asking = atI1(null, course);
    const answered = atI1({ intermediate: long }, course);
    const noted = atI1({ intermediate: MINE }, course);
    noted.send({ type: 'probed', path: MINE, missing: false, git: true, practice: false });
    // A folder with a long name of its own: the note names none, so it costs no row.
    const longName = `/home/sam/${'claude-code-practice-mine-'.repeat(3)}`;
    const notedLong = atI1({ intermediate: longName }, course);
    notedLong.send({ type: 'probed', path: longName, missing: false, git: false, practice: false });
    return [['asking', asking.state, [C.folderAsk('Intermediate'), C.folderCopy, C.folderOther]], ['answered', answered.state, [C.workFolder, C.startLesson(1)]], ['noted', noted.state, [`${C.workFolder} ${MINE}`, C.noPractice, C.startLesson(1)]],
      ['noted, a long name', notedLong.state, [C.workFolder, C.notGit, C.startLesson(1)]]];
  };
  const can = lessonOf(atI1(null, threeLevels({ 'i-1': fullI1() })).state).content.intro.can;
  const why = lessonOf(atI1(null, threeLevels({ 'i-1': fullI1() })).state).content.intro.why;
  let dropped = 0;
  // b-4 has four can lines; no lesson file has more than five.
  for (let extra = 0; extra <= 1; extra++) {
    for (const [label, state, rows] of states(extra)) {
      for (const t of MODES) {
        for (const [cols, size] of SIZES) {
          const lines = render(state, { cols, rows: size }, t).map(strip);
          const where = `${label} with ${extra} more can lines at ${cols}x${size}\n${lines.join('\n')}`;
          assert.ok(!lines.some((l) => l.trim() === t.glyph.ellipsis), `${where}: a row is dropped`);
          assert.ok(!lines.some(widthCut(t, cols)), `${where}: a line is cut`);
          const text = flat(lines);
          for (const c of [...can, ...Array.from({ length: extra }, (_, k) => `practise skill ${k + 1}`)]) assert.ok(text.includes(c.replace(/`/g, '')), `${where}: "${c}" is not whole`);
          for (const r of rows) assert.ok(text.includes(r), `${where}: "${r}" is not whole`);
          // The Why line is whole, or gone with nothing else gone.
          const whyShown = text.includes(`${C.whyLead} "${why.slice(0, 20)}`);
          if (whyShown) assert.ok(text.includes(why.replace(/`/g, '')), `${where}: the Why line is cut`);
          else dropped += 1;
        }
      }
    }
  }
  assert.ok(dropped > 0, 'the Why line never had to give way');
});

// ---- pinned folders --------------------------------------------------------------
const ACTIONS = '/home/sam/claude-actions-practice';
const checkOnlyAt = (id, folders) => {
  const d = atI1(folders);
  d.key('m');
  mapTo(d, id);
  d.key('enter');
  assert.deepEqual([d.state.view, d.state.lesson], ['checkonly', id]);
  return d;
};

test('a-5\'s check-only view asks for its new copy and runs no check until it has one; then its check runs there, for a-5 only', () => {
  const d = checkOnlyAt('a-5');
  assert.equal(lastOf(d.effects, 'check'), undefined);
  for (const size of SIZES) {
    const lines = screen(d.state, size);
    assert.ok(flat(lines).includes(flat(C.newCopy)), `${size}\n${lines.join('\n')}`);
    assert.match(lines.at(-1), /f +give its folder/, lines.at(-1));
  }
  d.key('f');
  assert.equal(d.state.folderAsk.key, 'a-5');
  assert.ok(shows(d, C.folderPromptNew), screen(d.state).join('\n'));
  // An empty line is no answer here: the copy is not where a-5 runs.
  d.send({ type: 'key', name: 'enter', wait: 40 });
  assert.equal(d.state.overlay, 'folder');
  assert.equal(d.state.folders['a-5'], undefined);
  // Nor is the copy given as a path, relative or in full: a new copy is another folder.
  for (const text of ['.', COPY]) {
    typeIn(d, text);
    d.send({ type: 'key', name: 'enter', wait: 40 });
    answer(d, { path: COPY });
    assert.equal(d.state.overlay, 'folder', text);
    assert.equal(d.state.folders['a-5'], undefined, text);
    assert.equal(lastOf(d.effects, 'check'), undefined, text);
    assert.ok(flat(screen(d.state)).includes(C.newCopyIsCopy), screen(d.state).join('\n'));
    fitsAll(d.state, `a-5 given ${text}`);
    for (let i = 0; i < text.length; i++) d.send({ type: 'key', name: 'backspace', wait: 40 });
    assert.ok(!flat(screen(d.state)).includes(C.newCopyIsCopy), 'typing again clears the note');
  }
  typeIn(d, ACTIONS);
  d.send({ type: 'key', name: 'enter', wait: 40 });
  answer(d, {});
  assert.deepEqual(d.state.folders, { 'a-5': ACTIONS });
  assert.deepEqual(snapshot(d.state).folders, { 'a-5': ACTIONS });
  assert.deepEqual(lastOf(d.effects, 'check'), { type: 'check', lesson: 'a-5', items: null, dir: ACTIONS });
  assert.equal(watching(d.state).dir, ACTIONS);
  for (const size of SIZES) {
    const lines = screen(d.state, size);
    assert.ok(flat(lines).includes(flat(C.newCopyAt)), `${size}\n${lines.join('\n')}`);
    assert.ok(has(headOf(lines), C.inFolder('claude-actions-practice').slice(0, 12)), lines.join('\n'));
    assert.match(lines.at(-1), /r check now/);
  }
  fitsAll(d.state, 'a-5 with its new copy');
  // Its folder is a-5's alone: the Advanced capstone still asks, and a-1 runs in the copy.
  d.key('m');
  mapTo(d, 'a-capstone');
  d.key('enter');
  assert.ok(flat(screen(d.state)).includes(flat(C.newCopy)));
  assert.ok(!flat(screen(d.state)).includes(C.slowWait), 'nothing runs yet, so no item waits for r');
  assert.equal(watching(d.state), null);
  // Given its new copy, the capstone's slow items wait for r there, as any lesson's do.
  const cap = checkOnlyAt('a-capstone', { 'a-capstone': '/home/sam/ci-review' });
  assert.ok(flat(screen(cap.state)).includes(C.slowWait), screen(cap.state).join('\n'));
  fitsAll(cap.state, 'a-capstone with its new copy');
  d.key('m');
  mapTo(d, 'a-1');
  d.key('enter');
  assert.equal(lastOf(d.effects, 'check').dir, COPY);
});

test('a lesson file can pin its folder in its front matter: copy, or new copy; anything else is an error', () => {
  const pinned = (value) => parseLesson(DEMO_I1.replace('next: i-2', `next: i-2\nfolder: ${value}`), 'i-1.md');
  assert.equal(pinned('copy').folder, 'copy');
  assert.equal(pinned('new copy').folder, 'new copy');
  assert.equal(parseLesson(DEMO_I1, 'i-1.md').folder, undefined);
  assert.throws(() => pinned('mine'), /i-1\.md: .*folder/);
  // i-1 pinned to the copy: its check runs there, whatever Intermediate's folder is.
  const course = threeLevels({ 'i-1': DEMO_I1.replace('next: i-2', 'next: i-2\nfolder: copy') });
  const d = atI1({ intermediate: MINE }, course);
  toW1(d);
  assert.equal(lastOf(d.effects, 'check').dir, COPY);
});

test('a lesson file of a-5 asks for its new copy at its intro, with that answer alone', () => {
  const text = DEMO_I1.replace('lesson: i-1', 'lesson: a-5').replace('next: i-2', 'next: a-6');
  const course = threeLevels({ 'i-1': DEMO_I1, 'a-5': text });
  const d = driver({ course, saved: { format: 1, welcomed: true, lessons: finishedBefore('a-5', course) } });
  d.key('m');
  mapTo(d, 'a-5');
  d.key('enter');
  assert.deepEqual([d.state.view, d.state.lesson], ['intro', 'a-5']);
  for (const size of SIZES) {
    const lines = screen(d.state, size);
    assert.ok(has(lines, C.newCopyAsk) && has(lines, C.folderNewCopy), lines.join('\n'));
    assert.ok(!has(lines, C.folderCopy), lines.join('\n'));
  }
  d.key('enter');
  assert.equal(d.state.folderAsk.key, 'a-5');
  typeIn(d, ACTIONS);
  d.send({ type: 'key', name: 'enter', wait: 40 });
  answer(d, {});
  assert.ok(shows(d, `${C.workFolder} ${ACTIONS}`) && shows(d, C.startLesson(5)), screen(d.state).join('\n'));
});

test('switching folders: what the old folder\'s check found goes, a run still out for it decides nothing, and the next look is in the new one', () => {
  const OTHER = '/home/sam/code/other-app';
  const d = mapAt('i-5', { intermediate: MINE });
  d.key('enter');
  assert.equal(lastOf(d.effects, 'check').dir, MINE);
  const items = lessonOf(d.state).items.map((text, index) => ({ index, text, pass: true, hint: '' }));
  d.key('f');
  typeIn(d, OTHER);
  d.send({ type: 'key', name: 'enter', wait: 40 });
  // MINE's run lands while the prompt waits: it is still the folder.
  d.send({ type: 'check', lesson: 'i-5', items: items.map((it) => ({ ...it, pass: false, hint: 'no' })), dir: MINE });
  assert.ok(d.state.checks['i-5']);
  answer(d, { path: OTHER });
  assert.equal(d.state.checks['i-5'], undefined, 'the old folder\'s marks go');
  assert.equal(lastOf(d.effects, 'check').dir, OTHER);
  // A run of MINE that was still out lands now: it would complete the lesson there.
  d.send({ type: 'check', lesson: 'i-5', items, dir: MINE });
  assert.equal(d.state.progress['i-5'].complete, false);
  assert.equal(d.state.checks['i-5'], undefined);
  d.send({ type: 'check', lesson: 'i-5', items, dir: OTHER });
  assert.equal(d.state.progress['i-5'].complete, true);
  assert.ok(has(headOf(screen(d.state)), C.inFolder('other-app')));
});

test('switching folders: a fresh step compares its file with how it is in the new folder, not the old one', () => {
  const EVIDENCE = '.claude/skills/tdd/SKILL.md';
  const course = threeLevels({ 'i-1': DEMO_I1.replace('- verify: check 0\n', `- verify: check 0 fresh\n- evidence: ${EVIDENCE}\n`) });
  const OTHER = '/home/sam/code/other-app';
  const d = atI1({ intermediate: MINE }, course);
  toW1(d);
  const items = [{ index: 0, text: 'x', pass: true, hint: '' }];
  d.send({ type: 'check', lesson: 'i-1', items, path: EVIDENCE, stamp: 'mine-1', dir: MINE });
  assert.equal(d.state.beat.status, 'waiting', 'the file in MINE has not changed yet');
  d.key('m');
  d.key('f');
  typeIn(d, OTHER);
  d.send({ type: 'key', name: 'enter', wait: 40 });
  answer(d, { path: OTHER });
  assert.deepEqual(d.state.progress['i-1'].stamps, {}, 'the old folder\'s file states go');
  d.key('m');
  assert.equal(lastOf(d.effects, 'check').dir, OTHER);
  // OTHER's file as it is now is the start: unchanged, the step waits.
  d.send({ type: 'check', lesson: 'i-1', items, path: EVIDENCE, stamp: 'other-1', dir: OTHER });
  assert.deepEqual([stepOf(d.state).id, d.state.beat.status], ['W1', 'waiting']);
  d.send({ type: 'check', lesson: 'i-1', items, path: EVIDENCE, stamp: 'other-1', dir: OTHER });
  assert.equal(d.state.beat.status, 'waiting');
  // Changed there: done.
  d.send({ type: 'check', lesson: 'i-1', items, path: EVIDENCE, stamp: 'other-2', dir: OTHER });
  assert.ok(['done', 'already'].includes(d.state.beat.status), d.state.beat.status);
  // Picking the same folder again keeps what the app knows of it.
  const same = atI1({ intermediate: MINE }, course);
  toW1(same);
  same.send({ type: 'check', lesson: 'i-1', items, path: EVIDENCE, stamp: 'mine-1', dir: MINE });
  same.key('m');
  same.key('f');
  typeIn(same, MINE);
  same.send({ type: 'key', name: 'enter', wait: 40 });
  answer(same, { path: MINE });
  assert.deepEqual(same.state.progress['i-1'].stamps, { 'W1.0': 'mine-1' });
});

// ---- notes before the first step -----------------------------------------------
const PROBLEMS = [
  ['not a git repository', { missing: false, git: false, practice: false }, () => C.notGit],
  ['no git-ignored .practice/', { missing: false, git: true, practice: false }, () => C.noPractice],
  ['gone', { missing: true, git: false, practice: false }, () => C.folderGone(MINE)],
  // git could not say: the note says why, not that the folder is no repository.
  ['git not installed', { missing: false, git: false, gitBroken: 'git is not installed', practice: false }, () => C.folderGitBroken('git is not installed')],
];

test('a work folder that isn\'t a git repository, has no git-ignored .practice/, or is gone gets a note before the first step', () => {
  for (const [label, found, note] of PROBLEMS) {
    // The intro that asked, the intro of a later lesson, and a check-only card.
    const i1 = atI1({ intermediate: MINE });
    const i2 = driver({ course: threeLevels({ 'i-1': DEMO_I1, 'i-2': DEMO_I1.replace('lesson: i-1', 'lesson: i-2') }), saved: { format: 1, welcomed: true, lessons: { ...finishedBefore('i-1', withI1()), 'i-1': { complete: true } }, folders: { intermediate: MINE } } });
    const i3 = atI1({ intermediate: MINE });
    i3.key('m');
    mapTo(i3, 'i-3');
    i3.key('enter');
    for (const [where, d] of [['i-1 intro', i1], ['i-2 intro', i2], ['i-3 check-only', i3]]) {
      assert.ok(!flat(screen(d.state)).includes(note()), `${where}: no note before main has looked`);
      d.send({ type: 'probed', path: MINE, ...found, wait: 40 });
      for (const t of [FULL, ASCII]) {
        for (const size of SIZES) {
          const lines = screen(d.state, size, t);
          assert.ok(flat(lines).includes(note()), `${label}, ${where} at ${size}\n${lines.join('\n')}`);
          assert.ok(!lines.some((l) => l.trim() === t.glyph.ellipsis), `${label}, ${where} at ${size}: a row dropped\n${lines.join('\n')}`);
        }
      }
      fitsAll(d.state, `${label}, ${where}`);
    }
  }
  assert.ok(!flat(screen((() => {
    const d = atI1({ intermediate: MINE });
    d.send({ type: 'probed', path: MINE, missing: false, git: false, gitBroken: 'git is not installed', practice: false });
    return d.state;
  })())).includes(C.notGit), 'git not installed is not "not a git repository"');
  // A folder that is all three, and the copy, get none; a look that finds
  // it set right takes the note away.
  const ok = atI1({ intermediate: MINE });
  ok.send({ type: 'probed', path: MINE, missing: false, git: true, practice: false });
  assert.ok(flat(screen(ok.state)).includes(C.noPractice));
  ok.send({ type: 'probed', path: MINE, missing: false, git: true, practice: true });
  const copy = atI1({ intermediate: COPY });
  for (const d of [ok, copy]) for (const [, , note] of PROBLEMS) assert.ok(!flat(screen(d.state)).includes(note()), screen(d.state).join('\n'));
});

// ---- main --------------------------------------------------------------------
// main() on a fake terminal, in a copy of the template with DEMO_I1 as its
// i-1 (or `i1`) and Beginner finished, its learn.json saving `folders` and
// any `saved` lessons. The check child is a stand-in that records the folder
// it was asked to check.
const CALM = { ...process.env, CODESPACES: '', LEARN_CALM: '1', NO_COLOR: '', LEARN_PLAIN: '', TERM: 'xterm-256color' };
function inCopy({ folders, argv = [], env = {}, i1 = DEMO_I1, saved = {}, platform = 'linux', checks = () => ({ items: [] }) } = {}) {
  const copy = exportHead(root);
  rmSync(join(copy, '.practice'), { recursive: true, force: true });
  writeFileSync(join(copy, 'learn', 'lessons', 'i-1.md'), i1);
  mkdirSync(join(copy, '.practice'));
  const lessons = { ...Object.fromEntries(course.filter((l) => l.level === 'beginner').map((l) => [l.id, { ...finished(l), step: null }])), ...saved };
  writeFileSync(storePath(copy), JSON.stringify({ format: 1, welcomed: true, lessons, ...(folders ? { folders: folders(copy) } : {}) }));
  const stdin = new PassThrough();
  Object.assign(stdin, { isTTY: true, setRawMode() {} });
  const stdout = fakeOut({ columns: 90, rows: 30 });
  stdout.getColorDepth = () => 8;
  const frame = () => strip(stdout.writes.join('').split('\x1b[H').at(-1) ?? '');
  const ran = [];
  const watched = [];
  const closedDirs = [];
  // Each watched folder's change handler, as the real watcher calls it.
  const onChanges = {};
  let exited = null;
  const stderr = { text: '', write(x) { this.text += x; } };
  const done = main({ argv, stdin, stdout, stderr, env: { ...CALM, ...env }, platform, root: copy, exit: (code) => { exited = code; },
    runCheck: (dir, lesson, items) => {
      ran.push({ dir, lesson, items });
      return Promise.resolve(checks(dir, lesson, items));
    },
    watch: (dir, onChange) => {
      watched.push(dir);
      onChanges[dir] = onChange;
      return { close() { closedDirs.push(dir); }, onChange };
    } });
  const close = () => {
    if (exited === null) stdin.write('\x03');
    rmSync(copy, { recursive: true, force: true });
  };
  return { copy, stdin, stdout, frame, ran, watched, closedDirs, onChanges, stderr, done, exited: () => exited, type: (x) => stdin.write(x), close };
}
const until = async (fn, ms = 8_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 30));
  }
  return false;
};

test('main: the check and the watcher run in the work folder, and learn.json stays in the copy', async () => {
  const mine = repo();
  const app = inCopy({ folders: () => ({ intermediate: mine }) });
  try {
    assert.ok(await until(() => app.frame().includes("You'll be able to")), app.frame());
    assert.ok(await until(() => app.ran.some((r) => r.lesson === 'i-1')), JSON.stringify(app.ran));
    assert.deepEqual(app.ran.filter((r) => r.lesson === 'i-1').map((r) => r.dir), [mine], 'the first look at i-1 is in the work folder');
    assert.ok(app.watched.includes(mine), `watched ${app.watched}`);
    // To Beginner on the map: its lessons are in the copy, so the work folder's watcher closes.
    app.type('m');
    assert.ok(await until(() => app.frame().includes('Intermediate path')), app.frame());
    app.type('\x1b[D');
    await until(() => false, 60);
    app.type('\r');
    assert.ok(await until(() => app.closedDirs.includes(mine)), `${app.closedDirs}\n${app.frame()}`);
    assert.ok(!app.closedDirs.includes(app.copy), 'the copy stays watched');
    app.type('q');
    assert.ok(await until(() => app.exited() === 0));
    assert.ok(existsSync(storePath(app.copy)), 'learn.json is in the copy');
    assert.ok(!existsSync(join(mine, '.practice', 'learn.json')), 'and not in the work folder');
  } finally {
    app.close();
    rmSync(mine, { recursive: true, force: true });
  }
});

test('main: a json beat reads its file in the work folder, with no process, and shows the key\'s value', async () => {
  const mine = repo();
  mkdirSync(join(mine, '.practice'));
  const i1 = DEMO_I1.replace('- verify: check 0\n- watching: .claude/skills/tdd/SKILL.md\n', '- verify: json .practice/i-1.json name\n');
  const app = inCopy({ folders: () => ({ intermediate: mine }), i1, saved: { 'i-1': { step: 'W1', beat: 0, warm: ['R1', 'R2'], done: ['R1', 'R2'] } } });
  const words = () => app.frame().replace(/\s+/g, ' ');
  try {
    assert.ok(await until(() => words().includes('Welcome back')), app.frame());
    app.type('\r');
    assert.ok(await until(() => words().includes('Watching .practice/i-1.json')), app.frame());
    // The copy holds the file too, with another name: only the work folder's counts.
    writeFileSync(join(app.copy, '.practice', 'i-1.json'), '{"name": "copy"}');
    writeFileSync(join(mine, '.practice', 'i-1.json'), '{"name": "tdd"}');
    assert.ok(await until(() => {
      app.onChanges[mine]();
      return words().includes('holds name = tdd');
    }), app.frame());
    // The only check run is the lesson's whole check, which the resume screen asks for.
    assert.ok(app.ran.every((r) => r.items === null), `a check child ran for the beat: ${JSON.stringify(app.ran)}`);
  } finally {
    app.close();
    rmSync(mine, { recursive: true, force: true });
  }
});

test('main: a git-only beat asks git status in the work folder, which lists each untracked file', async () => {
  const mine = repo({ 'README.md': 'r\n' });
  commit(mine, 'start');
  mkdirSync(join(mine, '.practice'));
  const i1 = DEMO_I1.replace('- verify: check 0\n- watching: .claude/skills/tdd/SKILL.md\n', '- verify: git-only .claude/\n');
  const app = inCopy({ folders: () => ({ intermediate: mine }), i1, saved: { 'i-1': { step: 'W1', beat: 0, warm: ['R1', 'R2'], done: ['R1', 'R2'] } } });
  const words = () => app.frame().replace(/\s+/g, ' ');
  try {
    assert.ok(await until(() => words().includes('Welcome back')), app.frame());
    app.type('\r');
    assert.ok(await until(() => words().includes('Watching git status')), app.frame());
    // A change in the copy says nothing about the work folder.
    write(app.copy, { 'notes.md': 'n\n' });
    write(mine, { '.claude/skills/tdd/SKILL.md': '---\nname: tdd\n---\n' });
    // git status alone would list the new folder as .claude/.
    assert.ok(await until(() => {
      app.onChanges[mine]();
      return words().includes('Changed: .claude/skills/tdd/SKILL.md');
    }), app.frame());
  } finally {
    app.close();
    rmSync(mine, { recursive: true, force: true });
  }
});

test('main: a note about the work folder goes once the learner sets the folder right', async () => {
  // A repository whose git doesn't ignore .practice/ yet (r27 a-5: a folder
  // it ignores is fine before .practice/ exists).
  const mine = repo();
  writeFileSync(join(mine, '.git', 'info', 'exclude'), '');
  const app = inCopy({ folders: () => ({ intermediate: mine }) });
  const noted = () => app.frame().replace(/\s+/g, ' ').includes("Git doesn't ignore .practice/");
  try {
    assert.ok(await until(noted), app.frame());
    writeFileSync(join(mine, '.git', 'info', 'exclude'), '.practice/\n');
    assert.ok(await until(() => {
      app.onChanges[mine]();
      return !noted();
    }), app.frame());
    assert.ok(app.frame().includes(C.startLesson(1)), app.frame());
  } finally {
    app.close();
    rmSync(mine, { recursive: true, force: true });
  }
});

test('probeFolder says why git could not look, apart from a folder that is no repository', async () => {
  const mine = repo();
  const PATH = process.env.PATH;
  try {
    // repo() ignores .practice/, so it counts before the folder exists (r27 a-5).
    assert.deepEqual(await probeFolder(mine), { path: mine, missing: false, git: true, gitBroken: null, practice: true });
    mkdirSync(join(mine, '.practice'));
    assert.equal((await probeFolder(mine)).practice, true);
    rmSync(join(mine, '.git'), { recursive: true, force: true });
    assert.deepEqual(await probeFolder(mine), { path: mine, missing: false, git: false, gitBroken: null, practice: false });
    process.env.PATH = join(mine, 'no-bin');
    assert.deepEqual(await probeFolder(mine), { path: mine, missing: false, git: false, gitBroken: 'git is not installed', practice: false });
  } finally {
    process.env.PATH = PATH;
    rmSync(mine, { recursive: true, force: true });
  }
  assert.equal((await probeFolder(join(mine, 'gone'))).missing, true);
});

// r27 a-5: a new copy made from the template ignores .practice/ in its
// .gitignore, but the folder isn't there until a step makes it.
test('probeFolder: a folder whose git ignores .practice/ is fine before .practice/ exists; one git doesn\'t ignore it in, or a .practice file, is not', async () => {
  const mine = mkdtempSync(join(tmpdir(), 'learn-probe-'));
  const git = (...args) => execFileSync('git', args, { cwd: mine });
  try {
    git('init', '-q');
    git('config', 'core.excludesFile', '/dev/null');
    assert.equal((await probeFolder(mine)).practice, false, 'nothing ignores it');
    writeFileSync(join(mine, '.gitignore'), '.practice/\nnode_modules/\n');
    assert.deepEqual(await probeFolder(mine), { path: mine, missing: false, git: true, gitBroken: null, practice: true });
    mkdirSync(join(mine, '.practice'));
    assert.equal((await probeFolder(mine)).practice, true, 'and once it exists');
    rmSync(join(mine, '.practice'), { recursive: true });
    writeFileSync(join(mine, '.practice'), 'a file');
    assert.equal((await probeFolder(mine)).practice, false, 'a file named .practice holds no saved files');
    rmSync(join(mine, '.practice'));
    writeFileSync(join(mine, '.gitignore'), 'node_modules/\n');
    mkdirSync(join(mine, '.practice'));
    assert.equal((await probeFolder(mine)).practice, false, 'there, but git would list what it holds');
  } finally {
    rmSync(mine, { recursive: true, force: true });
  }
});

// main() with no terminal: it prints every lesson's check as plain text.
async function plain(argv, { folders, beginnerDone = true, done = (l) => beginnerDone && l.level === 'beginner' } = {}) {
  const copy = exportHead(root);
  rmSync(join(copy, '.practice'), { recursive: true, force: true });
  mkdirSync(join(copy, '.practice'));
  const lessons = Object.fromEntries(course.filter(done).map((l) => [l.id, l.content ? { ...finished(l), step: null } : { complete: true }]));
  writeFileSync(storePath(copy), JSON.stringify({ format: 1, welcomed: true, lessons, ...(folders ? { folders: folders(copy) } : {}) }));
  const ran = [];
  const out = { isTTY: false, text: '', write(x) { this.text += x; } };
  const err = { text: '', write(x) { this.text += x; } };
  try {
    const code = await main({ argv: typeof argv === 'function' ? argv(copy) : argv, stdin: { isTTY: false }, stdout: out, stderr: err, root: copy,
      runCheck: (dir, lesson) => {
        ran.push({ dir, lesson });
        return Promise.resolve({ items: [] });
      } });
    return { code, out: out.text, err: err.text, ran, copy };
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
}
const dirOf = (ran, id) => ran.find((r) => r.lesson === id)?.dir;

test('--dir answers the folder question ahead of time for the level the app opens on: plain output checks that level there, and says so', async () => {
  const mine = repo();
  try {
    // Beginner done: the app opens on Intermediate.
    const r = await plain(['--dir', mine]);
    assert.equal(r.code, 0, r.err);
    for (const id of ['i-1', 'i-2', 'i-8']) assert.equal(dirOf(r.ran, id), mine, id);
    assert.equal(dirOf(r.ran, 'i-capstone'), r.copy, 'i-capstone runs in the copy only');
    for (const id of ['b-1', 'a-1']) assert.equal(dirOf(r.ran, id), r.copy, id);
    for (const id of ['a-5', 'a-capstone']) assert.equal(dirOf(r.ran, id), undefined, `${id} has no new copy yet`);
    const i1 = r.out.split('\n').find((l) => l.startsWith('I1 '));
    assert.ok(i1.endsWith(C.plainIn(mine)), i1);
    assert.ok(!r.out.split('\n').find((l) => l.startsWith('B1 ')).includes(C.plainIn(r.copy)), 'the copy goes unnamed');
    // A path relative to the copy, as npm run check takes one.
    const rel = await plain((copy) => [`--dir=${relative(copy, mine)}`]);
    assert.equal(rel.code, 0, rel.err);
    assert.equal(dirOf(rel.ran, 'i-1'), mine);
  } finally {
    rmSync(mine, { recursive: true, force: true });
  }
});

test('--dir: saved folders are used without it; a missing folder, a missing value or Beginner is a usage error', async () => {
  const mine = repo();
  const actions = repo();
  try {
    const saved = await plain([], { folders: () => ({ intermediate: mine, 'a-5': actions }) });
    assert.equal(saved.code, 0, saved.err);
    assert.equal(dirOf(saved.ran, 'i-1'), mine);
    assert.equal(dirOf(saved.ran, 'a-5'), actions, 'a-5 checks in the new copy it was given');
    assert.equal(dirOf(saved.ran, 'a-capstone'), undefined);
    const missing = await plain(['--dir', join(mine, 'nope')]);
    assert.equal(missing.code, 2);
    assert.ok(missing.err.includes(C.noFolder(join(mine, 'nope'))), missing.err);
    assert.equal(missing.ran.length, 0);
    const bare = await plain(['--dir']);
    assert.equal(bare.code, 2);
    assert.ok(bare.err.includes(C.usage), bare.err);
    // Opening on i-capstone, pinned to the copy: --dir is Intermediate's.
    const cap = await plain(['--dir', mine], { done: (l) => l.level === 'beginner' || (l.level === 'intermediate' && l.id !== 'i-capstone') });
    assert.equal(cap.code, 0, cap.err);
    assert.equal(dirOf(cap.ran, 'i-1'), mine);
    assert.equal(dirOf(cap.ran, 'i-capstone'), cap.copy);
    const beginner = await plain(['--dir', mine], { beginnerDone: false });
    assert.equal(beginner.code, 2);
    assert.ok(beginner.err.includes(C.dirBeginner), beginner.err);
    // Opening on a-5, with all else done: its new copy can't be this practice copy.
    const newCopyLeft = (l) => !['a-5', 'a-capstone'].includes(l.id);
    const copyAsNew = await plain(['--dir', '.'], { done: newCopyLeft });
    assert.equal(copyAsNew.code, 2);
    assert.ok(copyAsNew.err.includes(C.newCopyIsCopy), copyAsNew.err);
    assert.equal(copyAsNew.ran.length, 0);
    const a5 = await plain(['--dir', actions], { done: newCopyLeft });
    assert.equal(a5.code, 0, a5.err);
    assert.equal(dirOf(a5.ran, 'a-5'), actions);
    assert.equal(dirOf(a5.ran, 'a-capstone'), undefined);
  } finally {
    for (const d of [mine, actions]) rmSync(d, { recursive: true, force: true });
  }
});

// Ticket 172: a-5's saved new copy makes it the next lesson once a-1 to a-4
// are done, but --dir still answers for the Advanced level there, as before.
test('--dir with a-5\'s new copy saved and a-1 to a-4 done sets the Advanced folder, and a-5 keeps its new copy', async () => {
  const mine = repo();
  const actions = repo();
  try {
    const done = (l) => ['beginner', 'intermediate'].includes(l.level) || ['a-1', 'a-2', 'a-3', 'a-4'].includes(l.id);
    const folders = () => ({ 'a-5': actions });
    const r = await plain(['--dir', mine], { done, folders });
    assert.equal(r.code, 0, r.err);
    for (const id of ['a-1', 'a-6', 'a-7']) assert.equal(dirOf(r.ran, id), mine, id);
    assert.equal(dirOf(r.ran, 'a-5'), actions, 'a-5 keeps the new copy it was given');
    assert.equal(dirOf(r.ran, 'a-capstone'), undefined);
    // The practice copy is a level's folder, not a new copy: no usage error.
    const copy = await plain(['--dir', '.'], { done, folders });
    assert.equal(copy.code, 0, copy.err);
    assert.equal(dirOf(copy.ran, 'a-1'), copy.copy);
    assert.equal(dirOf(copy.ran, 'a-5'), actions);
  } finally {
    for (const d of [mine, actions]) rmSync(d, { recursive: true, force: true });
  }
});

// Ticket 173: opening on a-5 or a-capstone with its new copy saved, --dir
// never replaces that copy: it sets the Advanced level's folder instead.
test('--dir opening on a-5 or a-capstone with its new copy saved sets the Advanced folder, and the new copy stays', async () => {
  const mine = repo();
  const actions = repo();
  try {
    for (const [id, left] of [['a-5', ['a-5', 'a-capstone']], ['a-capstone', ['a-capstone']]]) {
      const done = (l) => !left.includes(l.id);
      const folders = () => ({ [id]: actions });
      const r = await plain(['--dir', mine], { done, folders });
      assert.equal(r.code, 0, `${id}: ${r.err}`);
      assert.equal(dirOf(r.ran, id), actions, `${id} keeps the new copy it was given`);
      for (const other of ['a-1', 'a-6', 'a-7']) assert.equal(dirOf(r.ran, other), mine, `${id}: ${other}`);
      // The practice copy is the level's folder, not a new copy: no usage error.
      const copy = await plain(['--dir', '.'], { done, folders });
      assert.equal(copy.code, 0, `${id}: ${copy.err}`);
      assert.equal(dirOf(copy.ran, 'a-1'), copy.copy, id);
      assert.equal(dirOf(copy.ran, id), actions, id);
    }
    // With a-5 and a-capstone left and only a-capstone's copy saved, --dir
    // works out its lesson as if none were saved (172): a-5, whose copy it
    // sets. The a-capstone copy stays.
    const left = (l) => !['a-5', 'a-capstone'].includes(l.id);
    const r = await plain(['--dir', mine], { done: left, folders: () => ({ 'a-capstone': actions }) });
    assert.equal(r.code, 0, r.err);
    assert.equal(dirOf(r.ran, 'a-5'), mine);
    assert.equal(dirOf(r.ran, 'a-capstone'), actions);
    for (const other of ['a-1', 'a-6', 'a-7']) assert.equal(dirOf(r.ran, other), r.copy, other);
  } finally {
    for (const d of [mine, actions]) rmSync(d, { recursive: true, force: true });
  }
});

test('main: a path typed in the prompt is read relative to the copy, or from ~, looked at, and saved whole in learn.json', async () => {
  const mine = repo();
  const ways = [(copy) => relative(copy, mine), () => `~/${basename(mine)}`, () => `"${mine}"`];
  try {
    for (const way of ways) {
      const app = inCopy({ env: { HOME: dirname(mine) } });
      try {
        assert.ok(await until(() => app.frame().includes(C.folderAsk('Intermediate'))), app.frame());
        app.type('2');
        await until(() => false, 60);
        app.type('\r');
        assert.ok(await until(() => app.frame().includes(C.folderPrompt('Intermediate'))), app.frame());
        app.type(way(app.copy));
        await until(() => false, 60);
        app.type('\r');
        assert.ok(await until(() => app.frame().includes(`${C.workFolder} ${mine}`)), `${way(app.copy)}\n${app.frame()}`);
        app.type('q');
        assert.ok(await until(() => app.exited() === 0));
        assert.deepEqual(loadState(app.copy).folders, { intermediate: mine });
      } finally {
        app.close();
      }
    }
  } finally {
    rmSync(mine, { recursive: true, force: true });
  }
});

test('main: --dir on a terminal answers the intro\'s question and is saved, as an answer typed there is', async () => {
  const mine = repo();
  const app = inCopy({ argv: ['--dir', mine] });
  try {
    assert.ok(await until(() => app.frame().includes(`${C.workFolder} ${mine}`)), app.frame());
    assert.ok(!app.frame().includes(C.folderAsk('Intermediate')));
    assert.deepEqual(loadState(app.copy).folders, { intermediate: mine });
  } finally {
    app.close();
    rmSync(mine, { recursive: true, force: true });
  }
});

test('main: the goodbye says where to run the app again: the practice copy, named, when the lesson\'s work folder is another', async () => {
  const mine = repo();
  // Step 1 of i-1's 3: nothing missed, so no warm-up opens it (194).
  for (const [folders, words] of [[() => ({ intermediate: mine }), (copy) => C.savedAtCopy('I1', 1, 3, copy)], [() => ({}), () => C.savedAt('I1', 1, 3)]]) {
    const app = inCopy({ folders });
    try {
      assert.ok(await until(() => app.frame().includes(C.startLesson(1)) || app.frame().includes(C.folderCopy)), app.frame());
      // The question, where it is asked: this practice copy.
      if (app.frame().includes(C.folderCopy)) {
        app.type('\r');
        assert.ok(await until(() => app.frame().includes(C.startLesson(1))), app.frame());
      }
      app.type('\r');
      assert.ok(await until(() => app.frame().includes('step 1 of 3')), app.frame());
      app.type('q');
      assert.ok(await until(() => app.exited() === 0));
      assert.equal(app.stdout.writes.at(-1), `${words(app.copy)}\n`);
    } finally {
      app.close();
    }
  }
  rmSync(mine, { recursive: true, force: true });
});

// ---- what a lesson needs (ticket 89) ------------------------------------------
const NEED_JQ = '`jq`, which the hook scripts use, and `python3`, which `format-after-edit.sh` uses.';
const NEED_SANDBOX = 'On Linux and WSL 2, the sandbox needs `bubblewrap` and `socat`';
const needsI1 = DEMO_I1.replace('next: i-2\n---', 'next: i-2\nneeds: [jq python3, bwrap socat on linux]\n---')
  .replace('- can: "do it"\n', `- can: "do it"\n- need: "${NEED_JQ}"\n- need: "${NEED_SANDBOX}"\n`);

test('main: the intro finds the commands it needs by reading the PATH folders, starting none of them, and PATHEXT on Windows', async () => {
  const bin = mkdtempSync(join(tmpdir(), 'learn-bin-'));
  const ran = join(bin, 'ran');
  // jq and socat run would leave a mark; python3 is there but can't run;
  // bwrap is not there at all. A second folder on the PATH holds socat.
  const other = join(bin, 'more');
  mkdirSync(other);
  writeFileSync(join(bin, 'jq'), `#!/bin/sh\ntouch '${ran}'\n`, { mode: 0o755 });
  writeFileSync(join(bin, 'python3'), '#!/bin/sh\n', { mode: 0o644 });
  writeFileSync(join(other, 'socat'), `#!/bin/sh\ntouch '${ran}'\n`, { mode: 0o755 });
  const app = inCopy({ folders: (copy) => ({ intermediate: copy }), i1: needsI1, env: { PATH: `${bin}${delimiter}${join(bin, 'none')}${delimiter}${other}` } });
  const words = () => app.frame().replace(/\s+/g, ' ');
  try {
    // python3 can't run, and Linux asks about the sandbox's commands too.
    assert.ok(await until(() => words().includes(C.notOnPath('python3', 'bwrap'))), app.frame());
    assert.ok(!existsSync(ran), 'a command was started to find it');
  } finally {
    app.close();
  }
  // On Windows a command is a file with one of PATHEXT's extensions, and
  // the sandbox's commands are never asked about.
  writeFileSync(join(bin, 'python3.EXE'), '');
  const win = inCopy({ folders: (copy) => ({ intermediate: copy }), i1: needsI1, platform: 'win32', env: { PATH: `${bin};${other}`, PATHEXT: '.COM;.EXE' } });
  const winWords = () => win.frame().replace(/\s+/g, ' ');
  try {
    assert.ok(await until(() => winWords().includes(C.notOnPath('jq'))), win.frame());
    assert.ok(!winWords().includes(C.notOnPath('jq', 'python3')) && !winWords().includes('bwrap'), win.frame());
  } finally {
    win.close();
    rmSync(bin, { recursive: true, force: true });
  }
});

test('main: a prerequisite check item runs through the check child in the work folder, and a prerequisite file is read there with no process', async () => {
  const mine = repo();
  mkdirSync(join(mine, '.practice'));
  const skill = '.claude/skills/five-whys/SKILL.md';
  const i1 = DEMO_I1.replace('next: i-2\n---', `next: i-2\nrequires: [b-5 check 0, b-4 file ${skill}]\n---`);
  let passing = false;
  const checks = (dir, lesson, items) => (lesson === 'b-5' ? { items: [{ index: 0, text: 'b-5 item', pass: passing, hint: 'not yet' }] } : { items: [] });
  const app = inCopy({ folders: () => ({ intermediate: mine }), i1, checks });
  // The frame's words, its rows' line ends taken out, for a sentence that wraps.
  const words = () => app.frame().replace(/\x1b\[K/g, '').replace(/\s+/g, ' ');
  try {
    assert.ok(await until(() => words().includes(C.buildsOnCheck('B5', 'a committed CLAUDE.md has a rule that every new JavaScript file in src/ starts with a given line')) && words().includes(C.buildsOnFile('B4', C.noFile(skill)))), app.frame());
    assert.deepEqual(app.ran.filter((r) => r.lesson !== 'i-1'), [{ dir: mine, lesson: 'b-5', items: [0] }], 'one check child, for the check item, in the work folder');
    // B5 and B4 are practised in the copy, so doing them again there would
    // not set the work folder right: neither is offered.
    assert.ok(!words().includes(C.openFirst('B5')) && !words().includes(C.openFirst('B4')), app.frame());
    // Set right in the work folder (the copy says nothing), the intro sees it when it opens again.
    write(app.copy, { [skill]: '---\nname: five-whys\n---\n' });
    write(mine, { [skill]: '---\nname: five-whys\n---\n' });
    passing = true;
    app.type('m');
    assert.ok(await until(() => app.frame().includes('Intermediate path')), app.frame());
    app.type('m');
    assert.ok(await until(() => !words().includes('builds on') && words().includes(C.startLesson(1))), app.frame());
    assert.deepEqual(app.ran.filter((r) => r.lesson !== 'i-1').map((r) => r.dir), [mine, mine]);
  } finally {
    app.close();
    rmSync(mine, { recursive: true, force: true });
  }
});

test('main: the prerequisites\' check items run one ask at a time; a later ask waits in line, in place of one already waiting', async () => {
  const mine = repo();
  mkdirSync(join(mine, '.practice'));
  const i1 = DEMO_I1.replace('next: i-2\n---', 'next: i-2\nrequires: [b-5 check 0]\n---');
  // Each b-5 run waits until the test answers it.
  const waiting = [];
  const checks = (dir, lesson) => (lesson === 'b-5' ? new Promise((answer) => waiting.push(answer)) : { items: [] });
  const app = inCopy({ folders: () => ({ intermediate: mine }), i1, checks });
  const words = () => app.frame().replace(/\x1b\[K/g, '').replace(/\s+/g, ' ');
  const b5 = () => app.ran.filter((r) => r.lesson === 'b-5').length;
  const reopen = async () => {
    app.type('m');
    assert.ok(await until(() => app.frame().includes('Intermediate path')), app.frame());
    app.type('m');
    assert.ok(await until(() => app.frame().includes(C.startLesson(1))), app.frame());
  };
  try {
    assert.ok(await until(() => b5() === 1), JSON.stringify(app.ran));
    // Two more looks while the first runs: no second child starts.
    await reopen();
    await reopen();
    await until(() => false, 100);
    assert.equal(b5(), 1, 'a second check child ran beside the first');
    // The first answers: it fails. Then the last ask runs, once, and passes.
    waiting[0]({ items: [{ index: 0, pass: false, hint: 'not yet' }] });
    assert.ok(await until(() => words().includes('builds on') && b5() === 2), app.frame());
    waiting[1]({ items: [{ index: 0, pass: true }] });
    assert.ok(await until(() => !words().includes('builds on')), app.frame());
    await until(() => false, 100);
    assert.equal(b5(), 2, 'the ask that was waiting in line ran too');
  } finally {
    app.close();
    rmSync(mine, { recursive: true, force: true });
  }
});

// ---- a Worked example in the practice copy (ticket 183) ------------------------
// A made-up i-1 whose page runs its Worked example "In your practice copy:"
// and its Your turn in the learner's repository, as i-4's does: W and Y
// steps that read the same file, a check, git status, a run line for each
// folder, a fresh stamp one step takes for another, and a prerequisite.
const SETTINGS = '.claude/settings.json';
const WORKED = `---
lesson: i-1
title: "Demo"
stamp: "Verified against Claude Code v2.1.308 (stable) on 2026-10-25"
next: i-2
worked: copy
requires: [b-5 check 0]
---

## intro
- minutes: "about 20 minutes"
- can: "do it"
- need-repo: "One of your own repositories with a test command, for Your turn; or use the template copy for both."

## steps

### W1 | Worked example step 1 of 3 | Save the rules
- tier: guided
- skill: edit-settings
- where: editor
- beat: do
- verify: json ${SETTINGS} permissions.deny.0 fresh
- do: "Save the team's rules as \`${SETTINGS}\`."

### W2 | Worked example step 2 of 3 | Check the copy
- tier: guided
- skill: run-check
- where: shell
- beat: do
- verify: check 0
- run: "cd <your practice copy>"

### W3 | Worked example step 3 of 3 | See the change
- tier: guided
- skill: see-change
- where: shell
- beat: do
- verify: git-changed .claude/
- run: "git status"

### Y1 | Your turn step 1 of 3 | Your rules
- tier: hinted
- skill: edit-settings
- where: editor
- beat: do
- verify: json ${SETTINGS} permissions.allow.0 fresh since W1
- goal: "Save this partial file as \`${SETTINGS}\`."
- beat: do
- verify: no-match ${SETTINGS} TODO
- goal: "Replace each \`TODO\` with a rule."
- hint: "Allow only the one command that runs your tests"

### Y2 | Your turn step 2 of 3 | Check your repository
- tier: challenge
- skill: run-check
- where: shell
- beat: do
- verify: check 0
- goal: "Commit it"

### Y3 | Your turn step 3 of 3 | A clean tree
- tier: challenge
- skill: see-change
- where: shell
- beat: do
- verify: git-clean
- goal: "Commit everything."

### C | Check | Check
- tier: challenge
- skill: check
- where: shell
- beat: do
- verify: check all
- run: "npm run check -- i-1 --dir <your repo>"
`;
const worked = () => threeLevels({ 'i-1': WORKED });
// A learner past Beginner, on i-1's intro (or where `lessons` puts them),
// with these folders saved.
const atWorked = (folders, lessons = {}) => {
  const c = worked();
  return driver({ course: c, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore('i-1', c), ...lessons }, ...(folders ? { folders } : {}) } });
};
// The settings file as the learner saves it: it passes every beat that reads it.
const RULES = Buffer.from('{"permissions": {"allow": ["Bash(npm test)"], "deny": ["Read(./.env)"]}}');
// Passes the beat on screen with results from `dir`, then goes on: a fresh
// file changes after its first read.
function passHere(d, dir) {
  const v = beatOf(d.state).verify;
  const lesson = lessonOf(d.state);
  if (v.kind === 'check') {
    const items = (v.all ? lesson.items.map((_, i) => i) : v.items).map((index) => ({ index, text: lesson.items[index], pass: true, hint: '' }));
    d.send({ type: 'check', lesson: 'i-1', items, dir });
  } else if (v.path && v.kind.startsWith('git-')) d.send(gitLists([`${v.path}settings.json`], [], { dir }));
  else if (v.kind === 'git-clean') d.send({ type: 'git', paths: [], dir });
  else {
    d.send({ type: 'file', path: v.path, read: RULES, stamp: 'first', dir });
    if (v.fresh) d.send({ type: 'file', path: v.path, read: RULES, stamp: 'changed', dir });
  }
  assert.ok(['done', 'already'].includes(d.state.beat.status), `${stepOf(d.state).id}: ${d.state.beat.status}`);
  d.key('enter');
  if (d.state.view === 'levelup') d.key('enter');
}
// The folder the effect that opened the beat on screen names: its check,
// file read or git status.
const askedIn = (d) => {
  const v = beatOf(d.state).verify;
  return lastOf(d.effects, v.kind === 'check' ? 'check' : v.kind.startsWith('git-') ? 'git' : 'file').dir;
};

test('worked: copy, the key for a Worked example in the practice copy, parses; it is refused beside folder: copy or new copy, and on a lesson its PATH entry pins', () => {
  assert.equal(parseLesson(WORKED, 'i-1.md').worked, 'copy');
  assert.equal(parseLesson(DEMO_I1, 'i-1.md').worked, undefined);
  assert.throws(() => parseLesson(WORKED.replace('worked: copy', 'worked: mine'), 'i-1.md'), /i-1\.md: worked is copy, not mine/);
  for (const folder of ['copy', 'new copy']) {
    assert.throws(() => parseLesson(WORKED.replace('worked: copy', `worked: copy\nfolder: ${folder}`), 'i-1.md'), new RegExp(`i-1\\.md: worked: copy with folder: ${folder}, which already places every step`));
  }
  // i-capstone is pinned to the copy, and a-5 to a new copy, on PATH.
  const dir = mkdtempSync(join(tmpdir(), 'learn-worked-'));
  try {
    mkdirSync(join(dir, 'learn', 'lessons'), { recursive: true });
    for (const [id, words] of [['i-capstone', 'the practice copy'], ['a-5', 'its new copy']]) {
      writeFileSync(join(dir, 'learn', 'lessons', `${id}.md`), WORKED.replace('lesson: i-1', `lesson: ${id}`).replace('requires: [b-5 check 0]\n', ''));
      assert.throws(() => loadCourse(dir, PATH.filter((p) => p.id === id)), new RegExp(`learn/lessons/${id}\\.md: worked: copy, but ${id} runs every step in ${words}`));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('worked: copy reads each Worked example step in the practice copy, every verify kind, and Your turn, the Check and the prerequisites in the work folder', () => {
  const d = atWorked({ intermediate: MINE });
  assert.equal(introAsks(d.state).find((e) => e.type === 'prereqs').dir, MINE, 'the prerequisites are looked at in the work folder');
  d.key('enter');
  assert.equal(stepOf(d.state).id, 'W1');
  // The fresh stamps: W1's in the copy, and Y1's, taken as W1 opens, in the work folder.
  assert.deepEqual(d.effects.filter((e) => e.type === 'stamp').map((e) => [e.key, e.dir]), [['W1.0', COPY], ['Y1.0', MINE]]);
  // A stamp from the other folder is not about its file.
  d.send({ type: 'stamp', key: 'W1.0', stamp: 'mine', dir: MINE });
  d.send({ type: 'stamp', key: 'Y1.0', stamp: 'copy', dir: COPY });
  assert.deepEqual(d.state.progress['i-1'].stamps, {});
  d.send({ type: 'stamp', key: 'W1.0', stamp: 'first', dir: COPY });
  d.send({ type: 'stamp', key: 'Y1.0', stamp: 'first', dir: MINE });
  assert.deepEqual(d.state.progress['i-1'].stamps, { 'W1.0': 'first', 'Y1.0': 'first' });
  // W1 reads its file in the copy: on opening, on r, and only a read from there decides.
  assert.deepEqual(lastOf(d.effects, 'file'), { type: 'file', path: SETTINGS, dir: COPY });
  assert.deepEqual(watching(d.state), { file: SETTINGS, dir: COPY });
  assert.equal(folderHere(d.state), COPY);
  d.key('r');
  assert.equal(lastOf(d.effects, 'file').dir, COPY, "r's read too");
  d.send({ type: 'file', path: SETTINGS, read: RULES, stamp: 'changed', asked: d.state.beat.asked, dir: MINE });
  assert.equal(d.state.beat.status, 'opening', 'a read of the work folder is not about this step');
  // Unchanged in the copy since its stamp there, it waits; changed, it passes.
  d.send({ type: 'file', path: SETTINGS, read: RULES, stamp: 'first', asked: d.state.beat.asked, dir: COPY });
  assert.equal(d.state.beat.status, 'waiting');
  d.send({ type: 'file', path: SETTINGS, read: RULES, stamp: 'changed', dir: COPY });
  assert.equal(d.state.beat.status, 'done');
  d.key('enter');
  // W2's check, in the copy; a result from the work folder decides nothing.
  assert.equal(stepOf(d.state).id, 'W2');
  assert.equal(askedIn(d), COPY);
  d.key('r');
  assert.equal(lastOf(d.effects, 'check').dir, COPY, "r's run too");
  const items = [{ index: 0, text: lessonOf(d.state).items[0], pass: true, hint: '' }];
  d.send({ type: 'check', lesson: 'i-1', items, asked: d.state.beat.asked, dir: MINE });
  assert.equal(d.state.beat.status, 'opening');
  passHere(d, COPY);
  // W3's git status, in the copy.
  assert.equal(stepOf(d.state).id, 'W3');
  assert.deepEqual(lastOf(d.effects, 'git'), { type: 'git', dir: COPY, files: true });
  d.send(gitLists([`.claude/${'settings.json'}`], [], { dir: MINE }));
  assert.equal(d.state.beat.status, 'opening');
  passHere(d, COPY);
  // Your turn: every verify in the work folder.
  for (const [id, beat] of [['Y1', 0], ['Y1', 1], ['Y2', 0], ['Y3', 0], ['C', 0]]) {
    assert.deepEqual([stepOf(d.state).id, d.state.pos.beat], [id, beat]);
    assert.equal(askedIn(d), MINE, `${id}.${beat}`);
    assert.equal(watching(d.state).dir, MINE, `${id}.${beat}`);
    if (id === 'C') break;
    passHere(d, MINE);
  }
  // Y1's fresh beat compared the work folder's file with its stamp from there.
  assert.equal(d.state.progress['i-1'].stamps['Y1.0'], 'first');
});

test('worked: copy keeps each step in its own folder through back and forward, a resume, a restart and a replay', () => {
  const d = atWorked({ intermediate: MINE }, { 'i-1': { step: 'Y1', beat: 0, done: ['W1', 'W2', 'W3'], levels: ['hinted'] } });
  assert.equal(d.state.view, 'resume');
  assert.equal(folderHere(d.state), MINE);
  d.key('enter');
  assert.equal(askedIn(d), MINE);
  // b to W3, its last beat: git status in the copy; on again, the work folder.
  d.key('b');
  assert.equal(stepOf(d.state).id, 'W3');
  assert.equal(askedIn(d), COPY);
  assert.equal(watching(d.state).dir, COPY);
  passHere(d, COPY);
  assert.equal(stepOf(d.state).id, 'Y1');
  assert.equal(askedIn(d), MINE);
  // A resume on a Worked example step: the copy.
  for (const [step, dir] of [['W1', COPY], ['W2', COPY], ['Y2', MINE], ['C', MINE]]) {
    const r = atWorked({ intermediate: MINE }, { 'i-1': { step, beat: 0, levels: ['hinted', 'challenge'] } });
    assert.equal(folderHere(r.state), dir, `resume at ${step}`);
    r.key('enter');
    assert.equal(askedIn(r), dir, `resumed at ${step}`);
  }
  // A restart from the resume screen starts over in the copy.
  const x = atWorked({ intermediate: MINE }, { 'i-1': { step: 'Y2', beat: 0, levels: ['hinted', 'challenge'], stamps: { 'W1.0': 'old', 'Y1.0': 'old' } } });
  x.key('x');
  x.key('y');
  assert.equal(x.state.view, 'intro');
  assert.equal(lastOf(x.effects, 'prereqs').dir, MINE);
  x.key('enter');
  assert.deepEqual([stepOf(x.state).id, askedIn(x)], ['W1', COPY]);
  assert.deepEqual(x.effects.filter((e) => e.type === 'stamp').map((e) => [e.key, e.dir]), [['W1.0', COPY], ['Y1.0', MINE]]);
  // A finished lesson played again: the same.
  const again = atWorked({ intermediate: MINE }, { 'i-1': { complete: true, done: ['W1', 'W2', 'W3', 'Y1', 'Y2', 'Y3', 'C'] } });
  // The app opens on the lesson after it, i-2.
  assert.deepEqual([again.state.view, again.state.lesson], ['intro', 'i-2']);
  again.key('m');
  mapTo(again, 'i-1');
  again.key('enter');
  assert.equal(again.state.view, 'intro');
  again.key('enter');
  assert.deepEqual([stepOf(again.state).id, askedIn(again)], ['W1', COPY]);
});

test('r27 E15: a lesson in a new copy shows the page\'s check command, without --dir, and says to run it in the new copy; a level folder keeps --dir', () => {
  const passAll = (d, id, dir) => d.send({ type: 'check', lesson: id, items: lessonOf(d.state).items.map((text, index) => ({ index, text, pass: true, hint: '' })), dir });
  const a5 = driver({ course, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore('a-5'), 'a-5': { step: 'C', beat: 0, warm: [], levels: ['challenge'] } }, folders: { 'a-5': ACTIONS } } });
  a5.key('enter');
  assert.deepEqual([a5.state.lesson, stepOf(a5.state).id, folderHere(a5.state)], ['a-5', 'C', ACTIONS]);
  passAll(a5, 'a-5', ACTIONS);
  const n = lessonOf(a5.state).items.length;
  for (const size of SIZES) {
    const text = flat(screen(a5.state, size));
    assert.ok(text.includes(`npm run check -- a-5 ${C.checkPasses(n, n)[0]}`), `${size}: ${text}`);
    assert.ok(!text.includes('--dir'), `${size}: ${text}`);
    assert.ok(text.includes(C.runItToo(C.inNewCopy)), `${size}: ${text}`);
  }
  // The learner's own repository has no checks/: its card keeps --dir and the copy.
  const mine = atWorked({ intermediate: MINE }, { 'i-1': { step: 'C', beat: 0, done: ['W1', 'W2', 'W3', 'Y1', 'Y2', 'Y3'], levels: ['hinted', 'challenge'] } });
  mine.key('enter');
  assert.equal(stepOf(mine.state).id, 'C');
  passAll(mine, 'i-1', MINE);
  const text = flat(screen(mine.state, [80, 24]));
  assert.ok(text.includes(`npm run check -- i-1 --dir ${MINE}`), text);
  assert.ok(text.includes(C.runItToo(C.inCopy)), text);
});

test('r27 E10: a clean tree is named for where it is: the learner\'s repository in a work folder, the practice copy in the copy', () => {
  assert.equal(C.cleanRepo, 'Your repository is clean: nothing to commit.');
  for (const [folders, dir, says, not] of [[{ intermediate: MINE }, MINE, C.cleanRepo, C.cleanCopy], [{ intermediate: COPY }, COPY, C.cleanCopy, C.cleanRepo]]) {
    const d = atWorked(folders, { 'i-1': { step: 'Y3', beat: 0, done: ['W1', 'W2', 'W3', 'Y1', 'Y2'], levels: ['hinted', 'challenge'] } });
    d.key('enter');
    assert.deepEqual([stepOf(d.state).id, beatOf(d.state).verify.kind, askedIn(d)], ['Y3', 'git-clean', dir]);
    d.send({ type: 'git', paths: ['src/a.js'], dir });
    d.send({ type: 'git', paths: [], dir });
    assert.equal(d.state.beat.status, 'done');
    // The burst beside it may wrap the line: its words up to the colon.
    const head = (line) => line.slice(0, line.indexOf(':') + 1);
    for (const size of SIZES) {
      const text = flat(screen(d.state, size));
      assert.ok(text.includes(head(says)), `${dir} at ${size}: ${text}`);
      assert.ok(!text.includes(head(not)), `${dir} at ${size}: ${text}`);
    }
  }
});

test('worked: copy where the work folder is the practice copy itself, or not chosen yet, runs every step in the copy, as before', () => {
  for (const folders of [{ intermediate: COPY }, null]) {
    const d = atWorked(folders);
    if (!folders) d.key('enter');
    assert.equal(introAsks(d.state).find((e) => e.type === 'prereqs').dir, COPY);
    d.key('enter');
    const dirs = [];
    for (let i = 0; i < 8 && stepOf(d.state).id !== 'C'; i++) {
      dirs.push(askedIn(d), watching(d.state).dir);
      for (const size of SIZES) {
        const head = headOf(screen(d.state, size));
        assert.ok(!has(head, C.inCopy) && !has(head, C.inFolder('')), `${JSON.stringify(folders)} ${stepOf(d.state).id}\n${head.join('\n')}`);
      }
      passHere(d, COPY);
    }
    assert.deepEqual([...new Set(dirs)], [COPY]);
    assert.equal(askedIn(d), COPY);
  }
});

test('switching folders keeps what a Worked example step in the copy compares its file with, and drops the old work folder\'s', () => {
  const OTHER = '/home/sam/code/other-app';
  const d = atWorked({ intermediate: MINE });
  d.key('enter');
  d.send({ type: 'stamp', key: 'W1.0', stamp: 'copy-1', dir: COPY });
  d.send({ type: 'stamp', key: 'Y1.0', stamp: 'mine-1', dir: MINE });
  d.key('m');
  d.key('f');
  typeIn(d, OTHER);
  d.send({ type: 'key', name: 'enter', wait: 40 });
  answer(d, { path: OTHER });
  assert.deepEqual(d.state.progress['i-1'].stamps, { 'W1.0': 'copy-1' });
  d.key('m');
  assert.deepEqual([stepOf(d.state).id, lastOf(d.effects, 'file').dir], ['W1', COPY]);
  // The file in the copy, unchanged since its stamp: W1 still waits for the change.
  d.send({ type: 'file', path: SETTINGS, read: RULES, stamp: 'copy-1', dir: COPY });
  assert.equal(d.state.beat.status, 'waiting');
});

test('the header says where each step happens: in your practice copy on a Worked example step, the work folder\'s name elsewhere, and each card\'s place and run line agree', () => {
  const d = atWorked({ intermediate: MINE });
  const head = (label, want, not) => {
    for (const size of SIZES) {
      const h = headOf(screen(d.state, size));
      assert.ok(has(h, want) && !has(h, not), `${label} at ${size}\n${h.join('\n')}`);
    }
    fitsAll(d.state, label);
  };
  head('intro', C.inFolder('my-app'), C.inCopy);
  d.key('enter');
  head('W1', C.inCopy, C.inFolder('my-app'));
  passHere(d, COPY);
  head('W2', C.inCopy, C.inFolder('my-app'));
  // W2's card and run line name the same practice folder.
  for (const size of SIZES) assert.ok(has(screen(d.state, size), 'in a terminal, in your practice copy'), screen(d.state, size).join('\n'));
  assert.ok(has(screen(d.state), `cd ${COPY}`), screen(d.state).join('\n'));
  d.send({ type: 'paste', text: 'git status', wait: 40 });
  assert.ok(flat(screen(d.state)).includes(C.strayIn(C.inCopy)), screen(d.state).join('\n'));
  passHere(d, COPY);
  passHere(d, COPY);
  head('Y1', C.inFolder('my-app'), C.inCopy);
  passHere(d, MINE);
  passHere(d, MINE);
  head('Y2', C.inFolder('my-app'), C.inCopy);
  for (const size of SIZES) assert.ok(has(screen(d.state, size), 'in a terminal, in my-app'), screen(d.state, size).join('\n'));
  passHere(d, MINE);
  passHere(d, MINE);
  // The Check: its run line fills <your repo> with the work folder, from the copy.
  head('C', C.inFolder('my-app'), C.inCopy);
  assert.ok(has(screen(d.state, [80, 24]), `npm run check -- i-1 --dir ${MINE}`), screen(d.state, [80, 24]).join('\n'));
  assert.ok(has(screen(d.state), 'in a terminal, in your practice copy'), screen(d.state).join('\n'));
  // The resume screen of a Worked example step says the copy.
  const r = atWorked({ intermediate: MINE }, { 'i-1': { step: 'W3', beat: 0, levels: [] } });
  for (const size of SIZES) assert.ok(has(headOf(screen(r.state, size)), C.inCopy), screen(r.state, size).join('\n'));
  fitsAll(r.state, 'resume at W3');
});

test('a check all on a Worked example step names no --dir: it runs in the copy itself', () => {
  const text = WORKED.replace('- verify: check 0\n- run: "cd <your practice copy>"', '- verify: check all\n- run: "cd <your practice copy>"');
  const c = threeLevels({ 'i-1': text });
  const d = driver({ course: c, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore('i-1', c), 'i-1': { step: 'W2', beat: 0 } }, folders: { intermediate: MINE } } });
  d.key('enter');
  assert.equal(lastOf(d.effects, 'check').dir, COPY);
  const items = lessonOf(d.state).items.map((t, index) => ({ index, text: t, pass: true, hint: '' }));
  d.send({ type: 'check', lesson: 'i-1', items, dir: COPY });
  const lines = screen(d.state, [80, 24]);
  assert.ok(has(lines, 'npm run check -- i-1 passes') && !has(lines, '--dir'), lines.join('\n'));
  fitsAll(d.state, 'W2 check all done');
});

test('every screen of a lesson whose Worked example runs in the copy fits at 60x20 and 80x24 with its place whole, and cuts no line', () => {
  for (const folders of [{ intermediate: MINE }, { intermediate: `/home/sam/${'deep/'.repeat(30)}a-repository-with-a-long-name` }, { intermediate: COPY }]) {
    const all = lessonScreens('i-1', worked(), { folders });
    assert.ok(all.length > 20, `${all.length} screens`);
    for (const [label, state] of all) {
      fitsAll(state, label);
      for (const t of [FULL, ASCII]) {
        for (const size of SIZES) {
          const lines = screen(state, size, t);
          const where = `${label} at ${size}\n${lines.join('\n')}`;
          // The header's two rows above its rule, in either mode.
          const head = lines.slice(0, 2);
          const w = stepOf(state)?.part === 'Worked example';
          if (folders.intermediate !== COPY && state.view === 'step') assert.ok(w ? has(head, C.inCopy) : has(head, C.inFolder('')) && !has(head, C.inCopy), where);
          if (folders.intermediate === COPY) assert.ok(!has(head, C.inCopy) && !has(head, C.inFolder('')), where);
          // At 60 columns too: a card's top row drops its DONE pill, then
          // its terminal's words, before its place is cut.
          assert.ok(!lines.some((l) => l.endsWith(t.unicode ? '…' : '.') && width(l) >= size[0] - 2 && (t.unicode || /\S\.$/.test(l))), `a cut line: ${where}`);
        }
      }
    }
  }
});

test('a Worked example as long as i-4\'s names the copy in the header of every W step, at 60 columns by its folder\'s name', () => {
  // Six W steps, editor ones among them, five Y steps and the Check, their
  // tiers taking turns as i-4's do, by skills Beginner taught none, one or
  // several times: at 60 columns the closed trail leaves less room than
  // C.inCopy takes.
  const step = (id, part, n, of, where, tier, skill) => `### ${id} | ${part} step ${n} of ${of} | Step ${id}
- tier: ${tier}
- skill: ${skill}
- where: ${where}
- beat: do
- verify: json ${SETTINGS} permissions.deny.0
- ${where === 'editor' ? 'do' : 'run'}: "${where === 'editor' ? `Save \`${SETTINGS}\`.` : 'git status'}"
`;
  const ws = ['new-a', 'set-aside', 'check', 'new-b', 'resume', 'commit'].map((k, i) => step(`W${i + 1}`, 'Worked example', i + 1, 6, i % 2 ? 'editor' : 'shell', 'guided', k));
  const ys = ['new-a', 'check', 'new-b', 'snapshot', 'new-c'].map((k, i) => step(`Y${i + 1}`, 'Your turn', i + 1, 5, i % 2 ? 'editor' : 'shell', 'hinted', k));
  const long = WORKED.replace(/### W1[\s\S]*(?=### C \|)/, [...ws, ...ys].join('\n') + '\n');
  const all = lessonScreens('i-1', threeLevels({ 'i-1': long }), { folders: { intermediate: MINE } });
  // The copy's folder by name, cut to fit: its first letters at least.
  const byName = C.inFolder(basename(COPY).slice(0, 4));
  let short = 0;
  for (const [label, state] of all) {
    if (state.view !== 'step' || stepOf(state).part !== 'Worked example') continue;
    assert.equal(stepsOf(state).length, 12, label);
    fitsAll(state, label);
    for (const t of [FULL, ASCII]) {
      for (const size of SIZES) {
        const lines = screen(state, size, t);
        const head = lines.slice(0, 2);
        const where = `${label} at ${size}\n${lines.join('\n')}`;
        assert.ok(has(head, C.inCopy) || has(head, byName), where);
        assert.ok(!has(head, C.inFolder('my-app')), where);
        if (size[0] === 60 && !has(head, C.inCopy)) short++;
      }
    }
  }
  assert.ok(short > 0, 'the fixture is long enough that C.inCopy does not fit at 60 columns');
});

test('main: a Worked example step in the copy reads its file there and watches the copy alone; Your turn watches the work folder again, and b leaves it', async () => {
  const mine = repo();
  mkdirSync(join(mine, '.practice'));
  const FILE = '.practice/i-1.json';
  const i1 = `---
lesson: i-1
title: "Demo"
stamp: "Verified against Claude Code v2.1.308 (stable) on 2026-10-25"
next: i-2
worked: copy
---

## intro
- minutes: "about 20 minutes"
- can: "do it"

## steps

### W1 | Worked example step 1 of 1 | Save it
- tier: guided
- skill: save
- where: editor
- beat: do
- verify: json ${FILE} name
- do: "Save it."

### Y1 | Your turn step 1 of 1 | Save yours
- tier: hinted
- skill: save
- where: editor
- beat: do
- verify: json ${FILE} name
- goal: "Save yours."

### C | Check | Check
- tier: challenge
- skill: check
- where: shell
- beat: do
- verify: check all
- goal: "Run the check."
`;
  const app = inCopy({ folders: () => ({ intermediate: mine }), i1, saved: { 'i-1': { step: 'W1', beat: 0 } } });
  const words = () => app.frame().replace(/\s+/g, ' ');
  try {
    assert.ok(await until(() => words().includes('Welcome back')), app.frame());
    app.type('\r');
    assert.ok(await until(() => words().includes(`Watching ${FILE}`)), app.frame());
    assert.ok(words().includes(C.inCopy), app.frame());
    assert.ok(!app.watched.includes(mine), `the work folder is not watched on a step in the copy: ${app.watched}`);
    writeFileSync(join(app.copy, '.practice', 'i-1.json'), '{"name": "copy"}');
    writeFileSync(join(mine, '.practice', 'i-1.json'), '{"name": "tdd"}');
    assert.ok(await until(() => {
      app.onChanges[app.copy]();
      return words().includes('holds name = copy');
    }), app.frame());
    // On to Y1, past its level-up: the work folder is watched, and its file read.
    app.type('\r');
    assert.ok(await until(() => words().includes(C.k.bringIt)), app.frame());
    app.type('\r');
    assert.ok(await until(() => app.watched.includes(mine)), `${app.watched}\n${app.frame()}`);
    assert.ok(await until(() => {
      app.onChanges[mine]();
      return words().includes('holds name = tdd');
    }), app.frame());
    // b: back in the copy, the work folder's watcher closes.
    app.type('b');
    assert.ok(await until(() => app.closedDirs.includes(mine)), `${app.closedDirs}\n${app.frame()}`);
    assert.ok(!app.closedDirs.includes(app.copy), 'the copy stays watched');
  } finally {
    app.close();
    rmSync(mine, { recursive: true, force: true });
  }
});
