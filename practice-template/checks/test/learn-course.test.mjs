// Every lesson of the guide in the app (ticket 83): the 23 lessons on PATH in
// course order, the ones with no lesson file shown through their check, and
// a check-only lesson that can be completed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLesson, PATH, SLOW } from '../../learn/lib/content.mjs';
import { C } from '../../learn/lib/copy.mjs';
import { reduce, stepOf, watching } from '../../learn/lib/flow.mjs';
import { main } from '../../learn/lib/main.mjs';
import { itemsMax, render } from '../../learn/lib/render.mjs';
import { sanitize, snapshot } from '../../learn/lib/store.mjs';
import { graphemes, isEmoji, strip, width } from '../../learn/lib/text.mjs';
import { theme } from '../../learn/lib/theme.mjs';
import { lessons } from '../lessons/index.mjs';
import { course, liveCourse, driver, FACTS, finishedBefore, lessonScreens, mapTo, playUntil, root } from './learn-drive.mjs';

const FULL = theme({ tty: true, depth: 8, unicode: true, links: true, win32: false });
const ASCII = theme({ tty: true, depth: 1, unicode: false, links: false, win32: true });
const SIZES = [[60, 20], [80, 24]];
// The course with no lesson file at all, so every lesson shows its check.
const noFiles = liveCourse.map((l) => ({ ...l, content: null }));
// The course with every Advanced lesson shown through its check, as before
// its lesson files: the tests that use it are about check-only lessons,
// a-5's and a-capstone's new copy among them.
const advancedCheckOnly = course.map((l) => (l.level === 'advanced' ? { ...l, content: null } : l));
// A lesson's check-only view, opened from the map.
const checkOnly = (id, lessons = noFiles, saved = {}) => {
  const d = driver({ course: lessons, saved: { format: 1, welcomed: true, lessons: saved } });
  if (d.state.view !== 'map') d.key('m');
  mapTo(d, id);
  d.key('enter');
  assert.deepEqual([d.state.view, d.state.lesson], ['checkonly', id]);
  return d;
};
// A result for every item of a lesson: `pass(i)` says which pass, and the
// slow ones a poll leaves out come back unrun.
const result = (id, pass = () => false, { slow = true } = {}) => ({ type: 'check', lesson: id,
  items: lessons[id].items.map((it, index) => (slow && (SLOW[id] ?? []).includes(index) ? { index, text: it.text, pass: false, slow: true, hint: '' }
    : { index, text: it.text, pass: pass(index), hint: pass(index) ? '' : `${it.text} is not there yet: do the step, then look again.` })) });
// An arrow as main sends it: with how far the card scrolls in that window.
const arrow = (d, name, [cols, rows], t = FULL) => d.send({ type: 'key', name, wait: 10, itemsMax: itemsMax(d.state, { cols, rows }, t) });
const lines = (s, [cols, rows], t = FULL) => render(s, { cols, rows }, t).map((l) => strip(l).trimEnd());
// The card's rows, without its rail, as one line of text.
const cardText = (ls) => ls.filter((l) => /^\s*[│|] /.test(l)).map((l) => l.replace(/^\s*[│|] +/, '')).join(' ').replace(/\s+/g, ' ');
const flat = (text) => text.replaceAll('`', '').replace(/\s+/g, ' ');

// The guide's pages and the time each page's header line gives.
const PAGES = [
  ['b-1', 'beginner', '01-install-and-look-around', 'about 20 minutes'],
  ['b-2', 'beginner', '02-permission-modes-and-plan-mode', 'about 25 minutes'],
  ['b-3', 'beginner', '03-first-change', 'about 20 minutes'],
  ['b-4', 'beginner', '04-keep-a-session-on-track', 'about 25 minutes'],
  ['b-5', 'beginner', '05-project-memory', 'about 20 minutes'],
  ['b-capstone', 'beginner', 'capstone', '30 to 60 minutes'],
  ['i-1', 'intermediate', '01-first-skill', 'about 20 minutes'],
  ['i-2', 'intermediate', '02-organize-memory', 'about 20 minutes'],
  ['i-3', 'intermediate', '03-model-and-effort', 'about 20 minutes'],
  ['i-4', 'intermediate', '04-permissions-and-sandbox', 'about 20 minutes'],
  ['i-5', 'intermediate', '05-hooks', 'about 20 minutes'],
  ['i-6', 'intermediate', '06-subagents', 'about 25 minutes'],
  ['i-7', 'intermediate', '07-mcp', 'about 25 minutes'],
  ['i-8', 'intermediate', '08-plugins', 'about 25 minutes'],
  ['i-capstone', 'intermediate', 'capstone', '30 to 60 minutes'],
  ['a-1', 'advanced', '01-parallel-sessions', 'about 20 minutes'],
  ['a-2', 'advanced', '02-orchestration-patterns', 'about 20 minutes'],
  ['a-3', 'advanced', '03-dynamic-workflows', 'about 20 minutes, plus run time'],
  ['a-4', 'advanced', '04-headless', 'about 20 minutes'],
  ['a-5', 'advanced', '05-github-actions', 'about 20 minutes, plus run time'],
  ['a-6', 'advanced', '06-share-your-setup', 'about 20 minutes'],
  ['a-7', 'advanced', '07-bounded-runs', 'about 20 minutes, plus run time'],
  ['a-capstone', 'advanced', 'capstone', '60 to 90 minutes, plus run time'],
];

test('PATH lists all 23 lessons in course order, each with its page, its level and the minutes its page\'s header line gives', () => {
  assert.deepEqual(PATH.map(({ id, level, page, minutes }) => ({ id, level, page, minutes })),
    PAGES.map(([id, level, page, minutes]) => ({ id, level, page: `docs/${level}/${page}.md`, minutes })));
  assert.deepEqual(PATH.map((p) => p.id), Object.keys(lessons), 'every lesson with a check, in the checks\' order');
});

// Measured on the solutions branch, each item alone: the items that start a
// process (stub runs, hooks, npm test).
test('SLOW holds every item that starts a process, so a poll or a file event never runs one', () => {
  assert.deepEqual(SLOW, {
    'b-1': [0], 'b-2': [2, 3], 'b-3': [0, 1, 2, 4], 'b-4': [3], 'b-capstone': [2, 3, 4],
    'i-5': [2], 'i-7': [2], 'i-capstone': [1, 9, 11],
    'a-4': [1, 2, 3], 'a-7': [0, 1, 2, 3, 4], 'a-capstone': [4, 5, 6, 11],
  });
});

test('plain output runs no slow item: it names how many slower ones npm run check also runs', () => {
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const r = spawnSync(process.execPath, [join(root, 'learn', 'app.mjs')], { input: '', encoding: 'utf8', env });
  assert.equal(r.status, 0, r.stderr);
  const line = (label) => r.stdout.split('\n').find((l) => l.startsWith(`${label} `)) ?? '';
  for (const [label, id, n] of [['I5', 'i-5', 1], ['I7', 'i-7', 1], ['IC', 'i-capstone', 3], ['A4', 'a-4', 3], ['A7', 'a-7', 5]]) {
    assert.match(line(label), new RegExp(`\\(npm run check -- ${id} also runs ${n} slower one${n === 1 ? '' : 's'}\\)`), r.stdout);
  }
});

test('the check-only view of every lesson fits at 60x20 and 80x24, and the arrows bring every item into view, whole', () => {
  for (const id of PATH.map((p) => p.id)) {
    const d = checkOnly(id);
    const states = [['opened', () => {}], ['failing', () => d.send(result(id))],
      ['a broken check', () => d.send({ type: 'check-error', lesson: id, message: 'it took too long' })],
      ['a toast', () => d.send({ type: 'notice', kind: 'save', message: 'EACCES', wait: 10 })],
      ['every item passing', () => d.send(result(id, () => true, { slow: false }))]];
    for (const [name, make] of states) {
      make();
      for (const size of SIZES) {
        for (const t of [FULL, ASCII]) {
          const seen = new Set();
          for (let k = 0; k <= lessons[id].items.length; k++) {
            const raw = render(d.state, { cols: size[0], rows: size[1] }, t);
            const ls = raw.map((l) => strip(l).trimEnd());
            const where = `${id} ${name} at ${size.join('x')}${t.unicode ? '' : ' (ASCII)'}, ${k} down\n${ls.join('\n')}`;
            assert.equal(raw.length, size[1], where);
            for (const l of raw) {
              assert.ok(width(l) <= size[0] - 1, where);
              assert.ok(graphemes(strip(l)).filter(isEmoji).length <= 1, where);
            }
            assert.ok(!ls.some((l) => l.trim() === t.glyph.ellipsis || l.endsWith('…') || /[│|] +(…|\.\.\.)$/.test(l)), `${where}: a row is cut`);
            const text = cardText(ls);
            lessons[id].items.forEach((it, i) => text.includes(flat(it.text)) && seen.add(i));
            arrow(d, 'down', size, t);
          }
          assert.equal(seen.size, lessons[id].items.length, `${id} ${name} at ${size.join('x')}: items seen ${[...seen]}`);
          for (let k = 0; k <= lessons[id].items.length; k++) arrow(d, 'up', size, t);
          assert.equal(d.state.itemsAt, 0, `${id} ${name} at ${size.join('x')}: up goes back to the first item`);
        }
      }
    }
  }
});

// Every Beginner lesson finished, the way a learner leaves them.
const beginnerDone = () => finishedBefore('i-1');
// Every lesson before Advanced complete: Beginner and Intermediate.
const throughIntermediate = () => ({ ...finishedBefore('a-1'), ...Object.fromEntries(PATH.filter((p) => p.level === 'intermediate').map((p) => [p.id, { complete: true }])) });
const mapRow = (ls, label) => ls.find((l) => new RegExp(`^\\s*[❯ ] [✔○] +${label} `).test(l)) ?? '';

test('a check-only lesson is complete once a full check passes, slow items included: saved, counted, and the map\'s next marker moves on', () => {
  const d = checkOnly('a-4', advancedCheckOnly, throughIntermediate());
  const all = () => true;
  // A poll leaves the slow items out: everything it ran passes, but that is no full check.
  d.send(result('a-4', all));
  assert.equal(d.state.progress['a-4'].complete, false, 'a poll without the slow items');
  const out = d.key('r');
  assert.deepEqual(out.find((e) => e.type === 'check'), { type: 'check', lesson: 'a-4', items: null, slow: true, asked: 1, dir: FACTS.root });
  // r's run with a failing item: still not complete.
  d.send(result('a-4', (i) => i !== 0, { slow: false }));
  assert.equal(d.state.progress['a-4'].complete, false, 'an item fails');
  const effects = d.send(result('a-4', all, { slow: false }));
  assert.equal(d.state.progress['a-4'].complete, true);
  assert.ok(effects.some((e) => e.type === 'save'), 'saved');
  // The card says so, as a step's card does once its check passes.
  for (const size of SIZES) assert.match(lines(d.state, size).find((l) => l.includes('╭')), /╭─ .* ✔ DONE /, size.join('x'));
  assert.equal(snapshot(d.state).lessons['a-4'].complete, true, 'in learn.json');
  assert.equal(sanitize(JSON.parse(JSON.stringify(snapshot(d.state)))).lessons['a-4'].complete, true, 'and read back');
  // A later failing poll takes nothing back.
  d.send(result('a-4'));
  assert.equal(d.state.progress['a-4'].complete, true);
  // The level's n of m on the map and the welcome.
  d.key('m');
  assert.match(lines(d.state, [80, 24])[0], /Advanced path +1 of 8 done$/);
  assert.match(mapRow(lines(d.state, [80, 24]), 'A4'), /done/);
  const w = driver({ course: advancedCheckOnly, saved: { format: 1, welcomed: false, lessons: { ...throughIntermediate(), 'a-1': { complete: true } } } });
  assert.match(lines(w.state, [80, 24])[0], /Advanced path · 1 of 8 done$/);
});

test('a check-only lesson with no slow item is complete on any result where every item passes, and the next marker moves to the lesson after it', () => {
  const d = checkOnly('a-1', advancedCheckOnly, throughIntermediate());
  assert.match(mapRow(lines((d.key('m'), d.state), [80, 24]), 'A1'), /next/);
  d.key('m');
  assert.equal(d.state.view, 'checkonly');
  d.send(result('a-1', () => true));
  assert.equal(d.state.progress['a-1'].complete, true);
  d.key('m');
  const ls = lines(d.state, [80, 24]);
  assert.match(mapRow(ls, 'A1'), /done/, ls.join('\n'));
  assert.match(mapRow(ls, 'A2'), /next/, ls.join('\n'));
  // The app opens on the next lesson's map row after a restart.
  const again = driver({ course: advancedCheckOnly, saved: snapshot(d.state) });
  assert.deepEqual([again.state.view, again.state.course[again.state.mapCursor].id], ['map', 'a-2']);
});

// The tier marks a mix bar draws, in Unicode.
const TIER_MARKS = /[●◆★]/;

test('a lesson with no lesson file shows no tier bar on the map, and a page with no bar has no legend or footer about them', () => {
  const d = checkOnly('a-1', advancedCheckOnly, throughIntermediate());
  d.key('m');
  for (const size of SIZES) {
    const ls = lines(d.state, size);
    const rows = ['A1', 'A2', 'A3'].map((label) => mapRow(ls, label));
    for (const row of rows) assert.doesNotMatch(row, TIER_MARKS, `${size.join('x')}\n${ls.join('\n')}`);
    // With no bar on the page, nothing explains bars or the help they show.
    assert.ok(!ls.some((l) => l.includes(C.help) || l.includes(C.tierHelp.guided)), `${size.join('x')}\n${ls.join('\n')}`);
    assert.ok(!ls.join(' ').includes(C.mapFooter.slice(0, 20)), `${size.join('x')}\n${ls.join('\n')}`);
  }
  const b = driver({ course, saved: { format: 1, welcomed: true, lessons: { 'b-1': { complete: true } } } });
  b.key('m');
  const beginner = lines(b.state, [80, 24]);
  assert.match(mapRow(beginner, 'B2'), TIER_MARKS, 'a lesson with its file keeps its bar');
  assert.ok(beginner.some((l) => l.includes(C.help)) && beginner.join(' ').includes(C.mapFooter), beginner.join('\n'));
  // b-2 with no lesson file: no bar.
  const none = driver({ course: course.map((l) => (l.id === 'b-1' ? l : { ...l, content: null })), saved: { format: 1, welcomed: true, lessons: { 'b-1': { complete: true } } } });
  if (none.state.view !== 'map') none.key('m');
  assert.doesNotMatch(mapRow(lines(none.state, [80, 24]), 'B2'), TIER_MARKS);
});

// The Beginner capstone names i-1 as next. Help fades within a level, and
// i-1 opens its level with more help than the capstone gives (ticket 85), so
// the next screen shows neither i-1's bar nor "a notch harder", with i-1's
// lesson file or without one.
test('next may name the next level\'s first lesson: the next screen offers it, with no tier bar or "a notch harder", and enter opens it, or its check where it has no lesson file', () => {
  assert.equal(parseLesson(readFileSync(join(root, 'learn', 'lessons', 'b-capstone.md'), 'utf8'), 'b-capstone.md').next, 'i-1');
  const noI1 = course.map((l) => (l.id === 'i-1' ? { ...l, content: null } : l));
  for (const [lessons, opens] of [[course, 'intro'], [noI1, 'checkonly']]) {
    const d = driver({ course: lessons, saved: { format: 1, welcomed: true, lessons: finishedBefore('b-capstone') } });
    playUntil(d, (s) => s.view === 'next' && s.lesson === 'b-capstone');
    for (const size of SIZES) {
      const ls = lines(d.state, size);
      const where = `${opens}: ${size.join('x')}\n${ls.join('\n')}`;
      assert.match(ls.at(-1), /enter +start I1/, where);
      const up = ls.findIndex((l) => l.includes(C.nextUp));
      assert.ok(up > 0 && ls[up].includes('I1'), where);
      assert.ok(!ls.some((l) => l.includes(C.notchHarder.slice(0, 15))), where);
      assert.doesNotMatch(ls.slice(up).join('\n'), TIER_MARKS, where);
    }
    d.key('enter');
    assert.deepEqual([d.state.view, d.state.lesson], [opens, 'i-1']);
  }
});

test('a-5 and a-capstone run in a new copy of the template: PATH says so, and in the practice copy their view says so and runs no check', async () => {
  assert.deepEqual(PATH.filter((p) => p.newCopy).map((p) => p.id), ['a-5', 'a-capstone']);
  for (const id of ['a-5', 'a-capstone']) {
    const d = checkOnly(id, advancedCheckOnly);
    assert.ok(!d.effects.some((e) => e.type === 'check' && e.lesson === id), `${id}: a check ran`);
    assert.equal(watching(d.state), null, `${id}: the polls and the watcher ask for nothing`);
    assert.ok(!d.key('r').some((e) => e.type === 'check'), `${id}: r runs nothing`);
    for (const size of SIZES) {
      const ls = lines(d.state, size);
      const where = `${id} at ${size.join('x')}\n${ls.join('\n')}`;
      assert.ok(cardText(ls).includes(flat(C.newCopy.join(' '))), where);
      assert.ok(!cardText(ls).includes(flat(C.checkOnly.join(' '))), where);
      assert.doesNotMatch(ls.at(-1), /check now/, where);
    }
  }
  // Plain output runs no check for them, and says why.
  const asked = [];
  let out = '';
  await main({ stdin: { isTTY: false }, stdout: { isTTY: false, write: (x) => { out += x; } }, root, runCheck: async (dir, id) => (asked.push(id), { items: [] }) });
  assert.deepEqual(asked, PATH.map((p) => p.id).filter((id) => !['a-5', 'a-capstone'].includes(id)));
  for (const label of ['A5', 'AC']) assert.ok(out.split('\n').find((l) => l.startsWith(`${label} `)).endsWith(C.newCopyPlain), out);
});

test('a learner who starts at Intermediate or Advanced reaches its first lesson from the map in two keys', () => {
  // i-1 and a-1 open on their intros.
  for (const [keys, id, view] of [[['right', 'enter'], 'i-1', 'intro'], [['left', 'enter'], 'a-1', 'intro']]) {
    // A new learner: the app opens on the first lesson with a lesson file.
    const d = driver({ course });
    d.key('enter');
    assert.deepEqual([d.state.view, d.state.lesson], ['intro', 'b-1']);
    d.key('m');
    for (const k of keys) d.key(k);
    assert.deepEqual([d.state.view, d.state.lesson], [view, id], keys.join(' '));
  }
  // Every Beginner lesson done: the app opens on the next level's first
  // lesson, on its intro since it has a lesson file.
  const done = driver({ course, saved: { format: 1, welcomed: true, lessons: beginnerDone() } });
  assert.deepEqual([done.state.view, done.state.lesson], ['intro', 'i-1']);
  // Every lesson before Advanced done: the app opens on a-1's intro, as it
  // does on i-1's; with Advanced shown through its checks, on the map at a-1,
  // where enter shows its check.
  const advanced = driver({ course, saved: { format: 1, welcomed: true, lessons: throughIntermediate() } });
  assert.deepEqual([advanced.state.view, advanced.state.lesson], ['intro', 'a-1']);
  const checkOnlyA1 = driver({ course: advancedCheckOnly, saved: { format: 1, welcomed: true, lessons: throughIntermediate() } });
  assert.deepEqual([checkOnlyA1.state.view, checkOnlyA1.state.course[checkOnlyA1.state.mapCursor].id], ['map', 'a-1']);
  checkOnlyA1.key('enter');
  assert.deepEqual([checkOnlyA1.state.view, checkOnlyA1.state.lesson], ['checkonly', 'a-1']);
});

const MOVING = theme({ tty: true, depth: 8, unicode: true, links: true, win32: false, motion: true });

test('the check-only card has Pip on its top border, at rest, in every lesson, and once done beside the DONE pill where the border has room', () => {
  for (const id of PATH.map((p) => p.id)) {
    const d = checkOnly(id);
    for (const size of SIZES) {
      const top = lines(d.state, size).find((l) => l.includes('╭'));
      assert.match(top, /\[●‿●\] ──$/, `${id} at ${size.join('x')}: ${top}`);
    }
    // Done: the pill takes border room. Pip steps off only where fewer than
    // its face's cells and a rule are left, which is ASCII at 60 columns.
    const done = checkOnly(id, noFiles, { [id]: { complete: true } });
    for (const size of SIZES) {
      for (const t of [FULL, ASCII]) {
        const top = lines(done.state, size, t).find((l) => /^\s*(╭|\+-)/.test(l));
        const where = `${id} done at ${size.join('x')}${t.unicode ? '' : ' (ASCII)'}: ${top}`;
        assert.match(top, /DONE/, where);
        if (t.unicode) assert.match(top, /\[●‿●\] ──$/, where);
        else if (size[0] === 80) assert.match(top, /\[o_o\] --$/, where);
        else assert.match(top, /DONE {2}-+$/, where);
      }
    }
  }
});

test('an item\'s mark pops ○ ◉ ✔ as a poll finds it passing; nothing else on the card moves, and the rest frame is the calm one', () => {
  const d = checkOnly('a-1', advancedCheckOnly, throughIntermediate());
  d.send(result('a-1', (i) => i === 0));
  // Long after the card opened: its entrance and reading grace are over.
  d.send({ type: 'tick', wait: 30_000 });
  const poll = d.send(result('a-1', (i) => i <= 1)) && d.now;
  const frame = (ms) => render(d.state, { cols: 80, rows: 24 }, MOVING, { at: poll + ms }).map(strip);
  const rest = render(d.state, { cols: 80, rows: 24 }, MOVING).map(strip);
  assert.deepEqual(rest, render(d.state, { cols: 80, rows: 24 }, FULL).map(strip), 'the rest frame is the calm frame');
  const row = (ls, text) => ls.find((l) => l.includes(text)) ?? '';
  const [first, second, third] = lessons['a-1'].items.map((it) => flat(it.text).slice(0, 30));
  const markOf = (ls, text) => row(ls, text).match(/[│|] +(\S)/)?.[1];
  assert.deepEqual([0, 40, 80, 120, 160, 200].map((ms) => markOf(frame(ms), second)), ['○', '○', '◉', '◉', '✔', '✔']);
  for (const ms of [0, 40, 80, 120, 160]) {
    const ls = frame(ms);
    assert.equal(markOf(ls, first), '✔', `+${ms} ms: an item that passed before stays still`);
    assert.equal(markOf(ls, third), '▲', `+${ms} ms`);
    // Only the mark's cell and the pulse line differ from the rest frame.
    ls.forEach((l, i) => {
      if (i === ls.length - 2) return;
      const r = rest[i];
      if (l.includes(second)) assert.equal(l.replace(/[○◉✔]/, '*'), r.replace('✔', '*'), `+${ms} ms row ${i}`);
      else assert.equal(l, r, `+${ms} ms row ${i}`);
    });
  }
  // The first look pops nothing: the app saw no item fail before it.
  const fresh = checkOnly('a-1', advancedCheckOnly, throughIntermediate());
  fresh.send({ type: 'tick', wait: 30_000 });
  fresh.send(result('a-1', () => true));
  assert.equal(markOf(render(fresh.state, { cols: 80, rows: 24 }, MOVING, { at: fresh.now }).map(strip), first), '✔');
});

// The rows of a frame with each item's mark as *, and without the pulse line.
const masked = (ls, t) => {
  const mark = new RegExp(`^(\\s*[│|] +)(${[t.glyph.dotOff, t.glyph.check, t.glyph.warnMark].map((g) => g.replace(/[[\]]/g, '\\$&')).join('|')}) `);
  return ls.filter((_, i) => i !== ls.length - 2).map((l) => l.replace(mark, '$1* '));
};

test('a poll changes no row of the check-only card: only marks move, and once r has run the slow items, a poll keeps what r found', () => {
  for (const id of ['i-5', 'i-capstone', 'a-4', 'a-7']) {
    for (const size of SIZES) {
      for (const t of [FULL, ASCII]) {
        const at = `${id} at ${size.join('x')}${t.unicode ? '' : ' (ASCII)'}`;
        const d = checkOnly(id);
        const opened = lines(d.state, size, t);
        // The slow items wait for r from the start, so the line about them is already there.
        assert.ok(cardText(opened).includes(flat(C.slowWait).slice(0, 30)), `${at}\n${opened.join('\n')}`);
        // A poll that leaves the slow items out, with every item it ran passing.
        d.send(result(id, () => true));
        const polled = lines(d.state, size, t);
        assert.deepEqual(masked(polled, t), masked(opened, t), `${at}: the first poll moved more than marks\n${polled.join('\n')}`);
        assert.ok(!polled.some((l) => new RegExp(`^\\s*[│|] +${t.glyph.warnMark.replace(/[[\]]/g, '\\$&')} `).test(l)), at);
        // Pip worries only where the card shows a failing mark: none here.
        if (t.unicode) assert.match(polled.find((l) => l.includes('╭')), /\[●‿●\] ──$/, `${at}: an unrun slow item is no failure`);
        // r's run passes every item; then a poll leaves the slow ones out again.
        d.send(result(id, () => true, { slow: false }));
        const ran = lines(d.state, size, t);
        assert.ok(!cardText(ran).includes(flat(C.slowWait).slice(0, 30)), `${at}: r ran them\n${ran.join('\n')}`);
        d.send({ type: 'tick', wait: 2_000 });
        d.send(result(id, () => true));
        const after = lines(d.state, size, t);
        assert.deepEqual(after.filter((_, i) => i !== after.length - 2), ran.filter((_, i) => i !== ran.length - 2), `${at}: a poll after r changed a row\n${after.join('\n')}`);
        assert.ok(SLOW[id].every((i) => d.state.checks[id].items[i].pass), `${at}: the slow items keep r's result`);
      }
    }
  }
});

// Calm draws the rest frame.
const CALM = theme({ tty: true, depth: 8, unicode: true, links: true, win32: false, motion: false, calm: true });
// The lessons with a slow item that the app runs here, each with its lesson
// file or check-only.
const slowHere = Object.keys(SLOW).filter((id) => !course.find((l) => l.id === id).newCopy);

// A slow run's checking row, `label` at its start, as design 2.3 draws it:
// the spinner from +160 ms, the seconds from +3 s, one frame every 240 ms
// after +10 s. `frame(ms, size)` draws the screen `ms` after the child started.
function slowRow(at, frame, label) {
  const row = (ms) => frame(ms).find((l) => l.includes('Checking'));
  assert.ok(row(140).endsWith(label), `${at}: nothing moves before 150 ms: ${row(140)}`);
  assert.ok(row(160).endsWith(`${label} ⠋`), `${at}: ${row(160)}`);
  assert.notEqual(frame(160).at(-2), frame(140).at(-2), `${at}: the bounce`);
  assert.match(row(2_990), /… \S$/u, `${at}: no seconds under 3 s`);
  assert.ok(row(3_000).endsWith(`${label} ⠴  3 s`), `${at}: ${row(3_000)}`);
  assert.ok(row(10_000).endsWith(`${label} ⠸  10 s`), `${at}: ${row(10_000)}`);
  for (const ms of [10_040, 10_120, 10_200]) assert.deepEqual(frame(ms), frame(10_000), `${at}: one frame every 240 ms after 10 s, +${ms} ms`);
  assert.notDeepEqual(frame(10_240), frame(10_000), at);
  for (const [cols, rows] of SIZES) {
    const late = frame(150_000, [cols, rows]);
    assert.equal(late.length, rows, at);
    for (const l of late) assert.ok(width(l) <= cols - 1, `${at} at ${cols}x${rows}: ${l}`);
    assert.match(late.find((l) => l.includes('Checking')), / {2}150 s$/, `${at} at ${cols}x${rows}`);
  }
}

test('r on the check-only card says its run is going until its own result lands: the spinner and bounce, slower after 10 s, and the seconds from 3 s', () => {
  const ids = slowHere.filter((id) => !advancedCheckOnly.find((l) => l.id === id).content);
  assert.deepEqual(ids, ['a-4', 'a-7']);
  for (const id of ids) {
    const d = checkOnly(id);
    d.send(result(id));
    const asked = d.key('r').find((e) => e.type === 'check')?.asked;
    assert.ok(asked > 0, `${id}: r's run carries r's number`);
    // The label is state, so calm shows it at once, with Pip's checking face.
    const calm = lines(d.state, [80, 24], CALM);
    assert.ok(calm.some((l) => l.endsWith(C.checking())), `${id}\n${calm.join('\n')}`);
    assert.match(calm.find((l) => l.includes('╭')), /\[◒─◒\] ──$/, id);
    for (const size of SIZES) {
      const ascii = lines(d.state, size, ASCII);
      assert.equal(ascii.length, size[1], id);
      for (const l of ascii) assert.ok(width(l) <= size[0] - 1, `${id} in ASCII: ${l}`);
    }
    // r's child starts, then its first item.
    d.send({ type: 'run-start', wait: 7 });
    const run = d.now;
    d.send({ type: 'running', lesson: id, items: null, n: 1, m: lessons[id].items.length, asked, wait: 5 });
    const frame = (ms, [cols, rows] = [80, 24], t = MOVING) => render(d.state, { cols, rows }, t, { at: run + ms }).map((l) => strip(l).trimEnd());
    slowRow(id, frame, C.checkingItem(1, lessons[id].items.length));
    // Calm draws no spinner and no seconds, at any time.
    assert.deepEqual(frame(5_000, [80, 24], CALM), lines(d.state, [80, 24], CALM), id);
    // A poll's result lands first: r's run is still going.
    d.send(result(id, () => true, { slow: true }));
    assert.ok(frame(d.now - run + 40).some((l) => l.includes('Checking')), `${id}: a poll ended r's run`);
    // r's own result: the row and the spinner go at once.
    d.send({ ...result(id, () => true, { slow: false }), asked });
    const after = frame(d.now - run + 40);
    assert.ok(!after.some((l) => l.includes('Checking') || /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/u.test(l)), `${id}\n${after.join('\n')}`);
  }
});

test('r on a check-only card with no slow item changes no row: its run takes a moment, and only its result shows', () => {
  const ids = course.filter((l) => !l.newCopy && !SLOW[l.id]).map((l) => l.id);
  assert.ok(ids.length >= 10, ids.join(' '));
  for (const id of ids) {
    for (const size of SIZES) {
      const d = checkOnly(id);
      d.send(result(id, () => true));
      const before = lines(d.state, size);
      assert.deepEqual(d.key('r').find((e) => e.type === 'check'), { type: 'check', lesson: id, items: null, slow: true, dir: FACTS.root }, id);
      assert.equal(d.state.checkOnlyRun, null, id);
      assert.deepEqual(lines(d.state, size), before, `${id} at ${size.join('x')}`);
    }
  }
});

test('r\'s run on the check-only card goes on through a trip to the map and back, and is not another lesson\'s', () => {
  const d = checkOnly('a-7');
  d.send(result('a-7'));
  const asked = d.key('r').find((e) => e.type === 'check').asked;
  d.send({ type: 'run-start', wait: 7 });
  d.key('m');
  mapTo(d, 'a-7');
  d.key('enter');
  d.send({ type: 'running', lesson: 'a-7', items: null, n: 2, m: lessons['a-7'].items.length, asked, wait: 5 });
  const back = lines(d.state, [80, 24]);
  assert.ok(back.some((l) => l.endsWith(C.checkingItem(2, lessons['a-7'].items.length))), back.join('\n'));
  assert.ok(!cardText(back).includes(flat(C.slowWait).slice(0, 30)), 'no "press r" while r\'s run goes');
  // Another lesson's card, and back: r's run is not theirs.
  d.key('m');
  mapTo(d, 'i-5');
  d.key('enter');
  assert.ok(!lines(d.state, [80, 24]).some((l) => l.includes('Checking')), 'i-5');
  d.key('m');
  mapTo(d, 'a-7');
  d.key('enter');
  assert.equal(d.state.checkOnlyRun, null);
  assert.ok(!lines(d.state, [80, 24]).some((l) => l.includes('Checking')), 'a-7 again');
});

test('on a step card, r\'s run of a slow item spins as any check does: the seconds from 3 s, slower after 10 s', () => {
  const ids = slowHere.filter((id) => liveCourse.find((l) => l.id === id).content);
  assert.deepEqual(ids, ['b-1', 'b-2', 'b-3', 'b-4', 'b-capstone', 'i-5', 'i-7', 'i-capstone', 'a-4', 'a-7']);
  for (const id of ids) {
    const l = liveCourse.find((x) => x.id === id);
    // The cards r put "Checking" over, for a beat whose check has a slow item.
    const cards = lessonScreens(id, liveCourse).filter(([label, x]) => label.endsWith(' checking') && watching(x)?.check
      && (watching(x).check.items ?? l.items.map((_, i) => i)).some((i) => SLOW[id].includes(i)));
    assert.ok(cards.length >= 1, id);
    for (const [label, x] of cards) {
      const moving = reduce(x, { type: 'run-start', now: x.now + 7 }).state;
      const frame = (ms, [cols, rows] = [80, 24]) => render(moving, { cols, rows }, MOVING, { at: moving.fx.run + ms }).map((r) => strip(r).trimEnd());
      const row = frame(140).find((r) => r.includes('Checking'));
      slowRow(label, frame, row.slice(row.indexOf('Checking')));
    }
  }
});

test('the arrows move the check-only card only where it scrolls: pressed while every item fits, a later error and toast still show item 1 first', () => {
  const size = [60, 20];
  const d = checkOnly('i-2');
  const first = flat(lessons['i-2'].items[0].text);
  assert.doesNotMatch(lines(d.state, size).at(-1), /scroll/, 'every item fits');
  for (let i = 0; i < 5; i++) arrow(d, 'down', size);
  assert.equal(d.state.itemsAt, 0, 'nothing to scroll: the arrows move nothing');
  d.send({ type: 'check-error', lesson: 'i-2', message: 'it took too long' });
  d.send({ type: 'notice', kind: 'save', message: 'EACCES: permission denied, open /home/sam/claude-code-practice/.practice/learn.json', wait: 10 });
  const ls = lines(d.state, size);
  assert.match(ls.at(-1), /scroll/, `the card scrolls now\n${ls.join('\n')}`);
  assert.ok(cardText(ls).includes(first), `item 1 shows first\n${ls.join('\n')}`);
});

test('the check-only card scrolls no further than the window that ends on the last item, and up moves it at once', () => {
  for (const size of SIZES) {
    for (const t of [FULL, ASCII]) {
      const at = `i-capstone at ${size.join('x')}${t.unicode ? '' : ' (ASCII)'}`;
      const d = checkOnly('i-capstone');
      const shown = () => lines(d.state, size, t).join('\n').match(/Items? (\d+)(?: to (\d+))? of (\d+)/);
      const opened = shown();
      assert.ok(opened, at);
      const per = Number(opened[2] ?? opened[1]) - Number(opened[1]) + 1;
      for (let i = 0; i < 20; i++) arrow(d, 'down', size, t);
      const end = shown();
      assert.equal(Number(end[2] ?? end[1]), 14, `${at}: the last item shows\n${lines(d.state, size, t).join('\n')}`);
      assert.ok(Number(end[2] ?? end[1]) - Number(end[1]) + 1 >= per, `${at}: the last window holds as many items as the first\n${lines(d.state, size, t).join('\n')}`);
      arrow(d, 'up', size, t);
      assert.equal(Number(shown()[1]), Number(end[1]) - 1, `${at}: up moved the card at once`);
      // Scrolled further than this window allows, as in a smaller one before
      // a resize: the card still shows the last full window.
      for (let i = 0; i < 20; i++) d.send({ type: 'key', name: 'down', wait: 10 });
      assert.deepEqual(shown().slice(1), end.slice(1), `${at}\n${lines(d.state, size, t).join('\n')}`);
    }
  }
});

const done = (ids) => Object.fromEntries(ids.map((id) => [id, { complete: true }]));
// Every lesson before a-5 complete.
const throughA4 = () => ({ ...beginnerDone(), ...done(['i-1', 'i-2', 'i-3', 'i-4', 'i-5', 'i-6', 'i-7', 'i-8', 'i-capstone', 'a-1', 'a-2', 'a-3', 'a-4']) });
// The map screen fits in full and in ASCII at both sizes.
const mapFits = (s, at) => {
  for (const size of SIZES) {
    for (const t of [FULL, ASCII]) {
      const raw = render(s, { cols: size[0], rows: size[1] }, t);
      const where = `${at} at ${size.join('x')}${t.unicode ? '' : ' (ASCII)'}\n${raw.map(strip).join('\n')}`;
      assert.equal(raw.length, size[1], where);
      for (const l of raw) {
        assert.ok(width(l) <= size[0] - 1, where);
        assert.ok(graphemes(strip(l)).filter(isEmoji).length <= 1, where);
      }
    }
  }
};

test('until a-5\'s and a-capstone\'s new copy folder is saved, the next lesson passes over them: the map marks a-6, and left, right and a restart land there', () => {
  // The Advanced level's own folder, or a-capstone's new copy, is not a-5's.
  const ADVANCED = '/home/sam/advanced-work';
  for (const folders of [{}, { advanced: ADVANCED }, { advanced: ADVANCED, 'a-capstone': '/home/sam/ci-review' }]) {
    const at = `saved: ${Object.keys(folders).join(', ') || 'no folder'}`;
    const d = driver({ course: advancedCheckOnly, saved: { format: 1, welcomed: true, lessons: throughA4(), folders } });
    assert.deepEqual([d.state.view, d.state.course[d.state.mapCursor].id], ['map', 'a-6'], `${at}: the app opens on the map at a-6`);
    const ls = lines(d.state, [80, 24]);
    assert.match(mapRow(ls, 'A6'), /next/, `${at}\n${ls.join('\n')}`);
    assert.doesNotMatch(mapRow(ls, 'A5'), /next/, `${at}\n${ls.join('\n')}`);
    d.key('right');
    d.key('left');
    assert.equal(d.state.course[d.state.mapCursor].id, 'a-6', `${at}: back on Advanced, at a-6`);
    if (folders['a-capstone']) continue;
    // Only they are left: the app opens on the map at a-5, which no marker names.
    const rest = driver({ course: advancedCheckOnly, saved: { format: 1, welcomed: true, lessons: { ...throughA4(), ...done(['a-6', 'a-7']) }, folders } });
    assert.deepEqual([rest.state.view, rest.state.course[rest.state.mapCursor].id], ['map', 'a-5'], at);
    assert.ok(!lines(rest.state, [80, 24]).some((l) => / next/.test(l)), `${at}\n${lines(rest.state, [80, 24]).join('\n')}`);
  }
});

// Ticket 172: since 86 a-5 and a-capstone run their check in the new copy
// the learner gives, so once its folder is saved each is a lesson to finish.
test('once a-5 or a-capstone has its new copy saved, it is the next lesson where it is the first unfinished one: the map marks it, and left, right and a restart land there', () => {
  const cases = [
    { id: 'a-5', label: 'A5', after: 'A6', lessons: throughA4(), folders: { 'a-5': '/home/sam/claude-actions-practice' } },
    { id: 'a-capstone', label: 'AC', after: null, lessons: { ...throughA4(), ...done(['a-6', 'a-7']) }, folders: { 'a-capstone': '/home/sam/ci-review' } },
  ];
  for (const { id, label, after, lessons, folders } of cases) {
    const d = driver({ course: advancedCheckOnly, saved: { format: 1, welcomed: true, lessons, folders } });
    assert.deepEqual([d.state.view, d.state.course[d.state.mapCursor].id], ['map', id], `the app opens on the map at ${id}`);
    for (const size of SIZES) {
      const ls = lines(d.state, size);
      assert.match(mapRow(ls, label), /next/, ls.join('\n'));
      if (after) assert.doesNotMatch(mapRow(ls, after), /next/, ls.join('\n'));
    }
    mapFits(d.state, id);
    d.key('right');
    d.key('left');
    assert.equal(d.state.course[d.state.mapCursor].id, id, `back on Advanced, at ${id}`);
  }
});

test('a-5\'s new copy given in the session makes it the next lesson at once, and after a restart', () => {
  const A5COPY = '/home/sam/claude-actions-practice';
  const d = driver({ course: advancedCheckOnly, saved: { format: 1, welcomed: true, lessons: throughA4() } });
  mapTo(d, 'a-5');
  d.key('enter');
  assert.deepEqual([d.state.view, d.state.lesson], ['checkonly', 'a-5']);
  d.key('f');
  for (const c of A5COPY) d.send({ type: 'key', name: c.toLowerCase(), ch: c, wait: 40 });
  d.send({ type: 'key', name: 'enter', wait: 40 });
  const ask = d.effects.filter((e) => e.type === 'folder').at(-1);
  d.send({ type: 'probed', key: ask.key, asked: ask.asked, path: ask.text, missing: false, git: true, practice: true });
  assert.deepEqual(d.state.folders, { 'a-5': A5COPY });
  d.key('m');
  for (const size of SIZES) {
    const ls = lines(d.state, size);
    assert.match(mapRow(ls, 'A5'), /next/, ls.join('\n'));
    assert.doesNotMatch(mapRow(ls, 'A6'), /next/, ls.join('\n'));
  }
  mapFits(d.state, 'a-5 given in the session');
  mapTo(d, 'i-1');
  d.key('right');
  assert.equal(d.state.course[d.state.mapCursor].id, 'a-5', 'right onto Advanced lands at a-5');
  const again = driver({ course: advancedCheckOnly, saved: snapshot(d.state) });
  assert.deepEqual([again.state.view, again.state.course[again.state.mapCursor].id], ['map', 'a-5'], 'a restart opens at a-5');
});

// Ticket 168: a URL wrapped by the card's width broke inside a word, under
// the card's rail, so a copy of it from a terminal with no links gave a
// broken address. The card names the page instead, as a link where links
// work, and p spells out the address.
test('the check-only card names the lesson page as link text and points to p for its address, with no URL on the card', () => {
  for (const { id } of PATH) {
    const d = checkOnly(id);
    const url = course.find((l) => l.id === id).url;
    for (const size of [...SIZES, [60, 21], [100, 30]]) {
      for (const t of [FULL, ASCII]) {
        const raw = render(d.state, { cols: size[0], rows: size[1] }, t);
        const ls = raw.map((l) => strip(l).trimEnd());
        const where = `${id} at ${size.join('x')}${t.unicode ? '' : ' (ASCII)'}\n${ls.join('\n')}`;
        assert.ok(!ls.some((l) => /https?:|github\.com/.test(l)), `a URL on the card: ${where}`);
        const named = ls.findIndex((l) => /[│|] {2}\S/.test(l) && l.includes(C.pageTitle));
        // The row gives way only where the items scroll (the bar offers the
        // arrows) or the card has no row to give it: none left blank under
        // the card, above the blank over the key bar's rule, and no blank
        // between its blocks, which give way to it.
        if (named < 0) {
          const top = ls.findIndex((l) => /^\s*(╭|\+-)/.test(l));
          const bottom = ls.findLastIndex((l) => /^\s*(╰|\+-)/.test(l));
          const free = size[1] - 3 - bottom - 1 + ls.slice(top + 2, bottom).filter((l) => /^\s*[│|]$/.test(l)).length;
          assert.ok(ls.at(-1).includes(C.k.scroll) || free === 0, `no page row: ${where}`);
          continue;
        }
        assert.ok(ls[named].endsWith(C.pageTitle + C.pageLink), where);
        if (t.caps.links) assert.ok(raw[named].includes(`\x1b]8;;${url}\x07`) && strip(raw[named]).includes(C.pageTitle), where);
        else assert.ok(!raw[named].includes('\x1b]8;;'), where);
      }
    }
    // Where every item fits with room to spare, the page row shows: in the
    // frame's box (191), 40 rows in a taller window, every lesson's items
    // but a-capstone's 14, which scroll there as at 100x40.
    const roomy = lines(d.state, [100, 50]);
    if (id === 'a-capstone') assert.ok(roomy.findLast(Boolean).includes(C.k.scroll), id);
    else assert.ok(roomy.some((l) => l.includes(C.pageTitle + C.pageLink)), id);
  }
  // The ticket's example: i-1 at 80x24 showed its URL on two rows.
  assert.ok(lines(checkOnly('i-1').state, [80, 24]).some((l) => l.endsWith(`│  ${C.pageTitle}${C.pageLink}`)));
});

// A URL as p shows it: its rows, from the one that starts it, each only
// spaces and a piece of the URL, which join to the whole address.
const urlRows = (ls, url, where) => {
  const from = (at) => {
    const rows = [];
    while (rows.join('').length < url.length && at + rows.length < ls.length) rows.push(ls[at + rows.length].trim());
    return rows;
  };
  const at = ls.findIndex((l, i) => l.trim().startsWith('https://') && from(i).join('') === url);
  assert.ok(at >= 0, `${url} not shown whole: ${where}`);
  const rows = from(at);
  rows.forEach((r, i) => assert.match(ls[at + i], /^ *\S+$/, `a row holds more than spaces and the URL: "${ls[at + i]}"\n${where}`));
  return rows;
};

test('p spells out each URL whole: a long one breaks only after a /, ? or &, on rows with nothing but the address', () => {
  const shown = [];
  for (const { id } of PATH) {
    const d = checkOnly(id);
    d.key('p');
    assert.equal(d.state.overlay, 'page', id);
    const l = course.find((x) => x.id === id);
    shown.push([id, d.state, [l.url, l.stuck]]);
  }
  // A query longer than a row, which no lesson's link has yet: it breaks
  // after its & as well.
  const query = 'https://github.com/o/r/issues/new?template=lesson-feedback.yml&lesson=i-1&title=the-check-says-the-skill-is-not-committed&labels=lesson';
  const long = checkOnly('i-1', noFiles.map((l) => (l.id === 'i-1' ? { ...l, stuck: query } : l)));
  long.key('p');
  shown.push(['a long query', long.state, [query]]);
  // The Beginner lessons: on a step, at its part's anchor, and on the next
  // screen, with the Go further line's address.
  for (const l of course.filter((x) => x.content)) {
    const read = l.content.intro.read?.match(/\]\(([^)\s]+)\)/)?.[1];
    for (const [name, stop] of [['step', (s) => s.view === 'step' && s.lesson === l.id && stepOf(s).part !== 'Warm-up'],
      ['next', (s) => s.view === 'next' && s.lesson === l.id]]) {
      const d = driver({ course, saved: { format: 1, welcomed: true, lessons: finishedBefore(l.id), ...(l.newCopy ? { folders: { [l.id]: '/home/sam/claude-capstone' } } : {}) } });
      playUntil(d, stop);
      d.key('p');
      assert.equal(d.state.overlay, 'page', `${l.id} ${name}`);
      // The page's address at the step's anchor, as its link names it.
      const page = render(d.state, { cols: 100, rows: 40 }, FULL).join('').match(new RegExp(`\x1b\\]8;;(${l.url.replace(/[.?]/g, '\\$&')}[^\x07]*)\x07`))[1];
      if (name === 'step') assert.match(page, /#[a-z-]+$/, l.id);
      const urls = [page, l.content.stuck];
      shown.push([`${l.id} ${name}`, d.state, read && name === 'next' ? [...urls, read] : urls]);
    }
  }
  let broken = 0;
  for (const [label, state, urls] of shown) {
    for (const size of SIZES) {
      for (const t of [FULL, ASCII]) {
        const ls = lines(state, size, t);
        const where = `${label} at ${size.join('x')}${t.unicode ? '' : ' (ASCII)'}\n${ls.join('\n')}`;
        for (const url of urls) {
          const rows = urlRows(ls, url, where);
          rows.slice(0, -1).forEach((r) => assert.match(r, /[/?&]$/, `"${r}" breaks inside a word: ${where}`));
          if (rows.length > 1) broken++;
        }
      }
    }
  }
  assert.ok(broken > 0, 'no URL was long enough to break');
  // The long query's rows at 60 columns: one ends at its ?, one at an &.
  const rows = urlRows(lines(long.state, [60, 20], ASCII), query, 'a long query');
  assert.ok(rows.some((r) => r.endsWith('?')) && rows.some((r) => r.endsWith('&')), rows.join('\n'));
});

// Ticket 168: at 60x20 i-capstone showed item 1 of 11 over unused rows. An
// item's rows, read from a window tall enough for every item: a mark row
// and the rows under it, indented past the mark.
const MARK = /^\s*[│|] {2}(○|✔|▲|◉|o|\[x\]|!|@) /;
// An item's rows depend on the width alone. A window no taller than the
// frame's box (191) can scroll a long list: each window from item k shows
// item k first, and the last window shows the rest.
const itemHeights = (state, cols, t) => {
  const heightsFrom = (k) => {
    const ls = lines({ ...state, itemsAt: k }, [cols, 200], t);
    const marks = ls.flatMap((l, i) => (MARK.test(l) ? [i] : []));
    return marks.map((i) => {
      let n = 1;
      while (/^\s*[│|] {4}\S/.test(ls[i + n])) n++;
      return n;
    });
  };
  const max = itemsMax(state, { cols, rows: 200 }, t);
  return [...Array.from({ length: max }, (_, k) => heightsFrom(k)[0]), ...heightsFrom(max)];
};

test('the check-only card\'s item window fills its room: no window leaves rows unused that the next whole item would fill', () => {
  let filled = 0;
  for (const { id } of PATH) {
    const d = checkOnly(id);
    for (const size of SIZES) {
      for (const t of [FULL, ASCII]) {
        const heights = itemHeights(d.state, size[0], t);
        assert.equal(heights.length, lessons[id].items.length, id);
        const max = itemsMax(d.state, { cols: size[0], rows: size[1] }, t);
        for (let k = 0; k <= max; k++) {
          const ls = lines(d.state, size, t);
          const where = `${id} at ${size.join('x')}${t.unicode ? '' : ' (ASCII)'}, ${k} down\n${ls.join('\n')}`;
          const shown = ls.filter((l) => MARK.test(l)).length;
          const next = Math.min(d.state.itemsAt, max) + shown;
          if (next < heights.length) {
            // The rows the window could have: those left blank under the
            // card, above the blank over the key bar's rule, and the card's
            // blank rows between its blocks, which give way to an item. The
            // card's first row and the blank under the header stay.
            const top = ls.findIndex((l) => /^\s*(╭|\+-)/.test(l));
            const bottom = ls.findLastIndex((l) => /^\s*(╰|\+-)/.test(l));
            const under = size[1] - 3 - bottom - 1;
            const between = ls.slice(top + 2, bottom).filter((l) => /^\s*[│|]$/.test(l)).length;
            assert.ok(under + between < heights[next], `item ${next + 1} (${heights[next]} rows) fits in ${under} + ${between}: ${where}`);
            if (under + between > 0) filled++;
          }
          arrow(d, 'down', size, t);
        }
        for (let k = 0; k <= max; k++) arrow(d, 'up', size, t);
      }
    }
  }
  assert.ok(filled > 0, 'no window had rows to spare');
});

test('a passed Check step counts the run that passed it: a later poll that leaves the slow items out changes no count (r27)', () => {
  // Lessons with slow items whose Check step opens on the whole check.
  const ids = course.filter((l) => l.content && SLOW[l.id] && l.content.steps.find((st) => st.id === 'C')?.beats[0].verify.all).map((l) => l.id);
  assert.ok(ids.length >= 8, ids.join(' '));
  for (const id of ids) {
    const d = driver({ course, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore(id), [id]: { step: 'C', beat: 0, warm: [] } } } });
    d.key('enter');
    const asked = d.key('r').find((e) => e.type === 'check')?.asked;
    assert.ok(asked, id);
    const m = lessons[id].items.length;
    const passes = C.checkPasses(m, m)[0];
    d.send({ ...result(id, () => true, { slow: false }), asked });
    assert.ok(['done', 'already'].includes(d.state.beat.status), `${id}: ${d.state.beat.status}`);
    assert.ok(cardText(lines(d.state, [120, 40])).includes(passes), `${id}: ${cardText(lines(d.state, [120, 40]))}`);
    // The watcher's next poll runs only the fast items.
    d.send(result(id, () => true, { slow: true }));
    assert.ok(cardText(lines(d.state, [120, 40])).includes(passes), `${id} after a poll: ${cardText(lines(d.state, [120, 40]))}`);
  }
});
