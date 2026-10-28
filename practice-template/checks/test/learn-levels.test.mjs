// The app's screens for a course of three levels (ticket 82), on the course
// of all three: labels unique in the course, lesson numbers within a level,
// the map one level at a time, and the welcome at the current level.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PATH } from '../../learn/lib/content.mjs';
import { C } from '../../learn/lib/copy.mjs';
import { stepOf, tierOf } from '../../learn/lib/flow.mjs';
import { plainProgress } from '../../learn/lib/plain.mjs';
import { render } from '../../learn/lib/render.mjs';
import { graphemes, isEmoji, strip, width } from '../../learn/lib/text.mjs';
import { theme } from '../../learn/lib/theme.mjs';
import { DEMO_B2, DEMO_I1, driver, finishedBefore, playUntil, root, threeLevels } from './learn-drive.mjs';

const FULL = theme({ tty: true, depth: 8, unicode: true, links: true, win32: false });
const ASCII = theme({ tty: true, depth: 1, unicode: false, links: false, win32: true });
const MODES = { full: FULL, sixteen: theme({ tty: true, depth: 4, unicode: true, links: false, win32: false }), noColor: theme({ tty: true, depth: 1, unicode: true, links: false, win32: false }), ascii: ASCII };
const screen = (state, [cols, rows] = [80, 24], t = FULL) => render(state, { cols, rows }, t).map((l) => strip(l).trimEnd());
// The course with the Advanced lessons check-only, as they were before their
// lesson files: the tests of a check-only Advanced lesson's screens use it.
const advancedCheckOnly = () => threeLevels().map((l) => (l.level === 'advanced' ? { ...l, content: null } : l));
// Every lesson before `id` complete.
const doneBefore = (course, id) => Object.fromEntries(course.slice(0, course.findIndex((l) => l.id === id)).map((l) => [l.id, { complete: true }]));

test('every PATH entry carries its level, the folder of its page, and the level names are the guide\'s', () => {
  for (const p of PATH) assert.equal(p.level, p.page.split('/')[1], p.id);
  assert.deepEqual(C.levels, { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' });
  assert.deepEqual(PATH.map((p) => C.levels[p.level]), [...Array(6).fill('Beginner'), ...Array(9).fill('Intermediate'), ...Array(8).fill('Advanced')]);
});

const LABELS = ['B1', 'B2', 'B3', 'B4', 'B5', 'BC', 'I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8', 'IC', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'AC'];

test('every lesson has a label unique in the course, and plain output shows each one', () => {
  const out = plainProgress(threeLevels(), {}, null).split('\n');
  const labels = out.filter((l) => /^\S/.test(l) && l !== C.plainIntro).map((l) => l.split(' ')[0]);
  assert.deepEqual(labels, LABELS);
});


test('titles show no literal backticks: a-4\'s in the header, on the map and in plain output', () => {
  const course = advancedCheckOnly();
  const plain = plainProgress(course, {}, null).split('\n');
  assert.ok(plain.includes('A4   Script Claude Code with claude -p: 0 of 0 check items pass'), plain.join('\n'));
  // Every lesson before a-4 done: the map opens at a-4, and enter opens its check.
  const d = driver({ course, saved: { format: 1, welcomed: true, lessons: doneBefore(course, 'a-4') } });
  assert.equal(d.state.view, 'map');
  for (const t of [FULL, ASCII]) {
    const row = screen(d.state, [80, 24], t).find((l) => / A4 /.test(l));
    assert.match(row ?? '', /A4 {1,3}Script Claude Code with claude -p/, screen(d.state, [80, 24], t).join('\n'));
    assert.ok(!row.includes('`'), row);
  }
  d.key('enter');
  assert.equal(d.state.view, 'checkonly');
  for (const t of [FULL, ASCII]) {
    const head = screen(d.state, [80, 24], t)[0];
    assert.match(head, /A4 {1,3}Script Claude Code with claude -p/, head);
    assert.ok(!head.includes('`'), head);
  }
});

// A made-up i-2: the demo lesson 2, whose warm-ups recall b-1.
const I2 = DEMO_B2.replace('lesson: b-2', 'lesson: i-2').replace('next: b-3', 'next: i-3');
const has = (lines, text) => lines.some((l) => l.includes(text));

test('lesson numbers count within a level: i-2 is lesson 2, and its warm-ups from b-1 name Beginner', () => {
  const course = threeLevels({ 'i-2': I2 });
  // status missed before, so R1 (from b-1) plays (194).
  const d = driver({ course, saved: { format: 1, welcomed: true, missed: ['status'], lessons: doneBefore(course, 'i-2') } });
  assert.equal(d.state.view, 'intro');
  assert.equal(d.state.lesson, 'i-2');
  // The level's first intro in the app asks where to practise (ticket 86): this practice copy.
  d.key('enter');
  for (const size of [[60, 20], [80, 24]]) assert.ok(has(screen(d.state, size), 'Start lesson 2'), screen(d.state, size).join('\n'));
  d.key('enter');
  assert.equal(stepOf(d.state).part, 'Warm-up');
  assert.ok(has(screen(d.state), 'Warm-up from Beginner lesson 1'), screen(d.state).join('\n'));
  playUntil(d, (s) => s.view === 'complete');
  assert.ok(has(screen(d.state), 'Lesson 2 done! You practised:'), screen(d.state).join('\n'));
  d.key('enter');
  assert.ok(has(screen(d.state), 'start I3'), screen(d.state).join('\n'));
});

test('a warm-up from its own level names no level: b-2\'s from b-1 says "Warm-up from lesson 1"', () => {
  const course = threeLevels();
  const d = driver({ course, saved: { format: 1, welcomed: true, missed: ['start'], lessons: doneBefore(course, 'b-2') } });
  d.key('enter');
  assert.equal(stepOf(d.state).part, 'Warm-up');
  assert.ok(has(screen(d.state), 'Warm-up from lesson 1'), screen(d.state).join('\n'));
});

// The map's lesson rows, by their label pills, and the one the cursor is on.
const pills = (lines) => lines.flatMap((l) => l.match(/^\s*[❯ ] [✔○] +([A-Z][1-9C])\s/)?.[1] ?? []);
const cursorOn = (lines) => lines.map((l) => l.match(/^\s*❯ [✔○] +([A-Z][1-9C])\s/)?.[1]).find(Boolean);
const mapAt = (id, course = threeLevels()) => {
  const d = driver({ course, saved: { format: 1, welcomed: true, lessons: doneBefore(course, id) } });
  // A lesson in the app opens on its intro: m shows its map.
  if (d.state.view !== 'map') d.key('m');
  assert.equal(d.state.view, 'map');
  return d;
};

test('the map shows one level, with its name and its n of m done', () => {
  const lines = screen(mapAt('i-1').state);
  assert.match(lines[0], /MAP +Intermediate path +0 of 9 done$/, lines.join('\n'));
  assert.deepEqual(pills(lines), LABELS.slice(6, 15), lines.join('\n'));
  assert.equal(cursorOn(lines), 'I1');
});

test('left and right switch level, round from the last to the first, to its next lesson; up and down stay in the level', () => {
  const d = mapAt('i-3');
  const at = () => {
    const lines = screen(d.state);
    return [lines[0].match(/(\w+) path/)[1], lines[0].match(/(\d+ of \d+) done$/)[1], cursorOn(lines), pills(lines).length];
  };
  assert.deepEqual(at(), ['Intermediate', '2 of 9', 'I3', 9]);
  d.key('left');
  assert.deepEqual(at(), ['Beginner', '6 of 6', 'B1', 6], 'a level all done: its first lesson');
  d.key('left');
  assert.deepEqual(at(), ['Advanced', '0 of 8', 'A1', 8], 'left from Beginner goes round to Advanced');
  d.key('right');
  assert.deepEqual(at(), ['Beginner', '6 of 6', 'B1', 6]);
  d.key('up');
  assert.deepEqual(at(), ['Beginner', '6 of 6', 'BC', 6], 'up from the first row wraps to the level\'s last');
  d.key('right');
  assert.deepEqual(at(), ['Intermediate', '2 of 9', 'I3', 9]);
  d.key('right');
  assert.deepEqual(at(), ['Advanced', '0 of 8', 'A1', 8]);
  d.key('right');
  assert.deepEqual(at(), ['Beginner', '6 of 6', 'B1', 6], 'right from Advanced goes round to Beginner');
  d.key('left');
  d.key('up');
  assert.deepEqual(at(), ['Advanced', '0 of 8', 'AC', 8]);
  d.key('down');
  assert.deepEqual(at(), ['Advanced', '0 of 8', 'A1', 8], 'down from the last row wraps to the level\'s first');
  // Enter opens the lesson the cursor is on.
  d.key('up');
  d.key('enter');
  assert.equal(d.state.lesson, 'a-capstone');
  // m from a lesson opens its own level's page.
  d.key('m');
  assert.deepEqual(at(), ['Advanced', '0 of 8', 'AC', 8]);
});

test('the map\'s key bar offers the arrows that switch level, and ? lists them, only with more than one level', () => {
  const three = mapAt('i-1');
  for (const size of [[60, 20], [80, 24]]) assert.match(screen(three.state, size).at(-1), /←→ level/, size.join('x'));
  // Where the bar is short, as in ASCII at 60x20, "choose" gives way: the level key, enter and m stay.
  assert.equal(screen(three.state, [60, 20], ASCII).at(-1), '  up/down    <- -> level    enter open    m back    q quit');
  // f, the level's work folder (ticket 86), is a low key: it shows where the bar has room.
  assert.equal(screen(three.state, [80, 24], ASCII).at(-1), '  up/down choose    <- -> level    enter open    f folder    m back    q quit');
  for (const t of Object.values(MODES)) for (const size of [[60, 20], [80, 24]]) assert.match(screen(three.state, size, t).at(-1), /(←→|<- ->) level/, size.join('x'));
  three.key('?');
  for (const size of [[60, 20], [80, 24]]) assert.ok(has(screen(three.state, size), C.levelKey[1]), screen(three.state, size).join('\n'));
  // Its words start where every key's do, in ASCII too.
  for (const t of [FULL, ASCII]) {
    const lines = screen(three.state, [80, 24], t);
    const col = (text) => lines.find((l) => l.endsWith(text)).indexOf(text);
    assert.equal(col(C.levelKey[1]), col(C.keyHelp.find(([k]) => k === 'h')[1]), lines.join('\n'));
  }
  // c's row, where it shows, sits right under p's, after the level row too.
  for (const rows of [24, 30]) {
    const lines = screen(three.state, [80, rows]);
    const at = (text) => lines.findIndex((l) => l.endsWith(text));
    assert.ok(at(C.cardKey[1]) > 0, lines.join('\n'));
    assert.equal(at(C.cardKey[1]), at(C.keyHelp.find(([k]) => k === 'p')[1]) + 1, lines.join('\n'));
  }
  const beginner = driver({ course: threeLevels().filter((l) => l.level === 'beginner'), saved: { format: 1, welcomed: true, lessons: {} } });
  beginner.key('enter');
  beginner.key('m');
  assert.equal(beginner.state.view, 'map');
  assert.doesNotMatch(screen(beginner.state).at(-1), /level/);
  beginner.key('?');
  assert.ok(!has(screen(beginner.state), C.levelKey[1]));
});

const MOVING = theme({ tty: true, depth: 8, unicode: true, links: true, win32: false, motion: true });
const welcomeAt = (id, course = threeLevels()) => driver({ course, saved: { format: 1, welcomed: false, lessons: doneBefore(course, id) } });

test('the welcome names the current level and draws only its path line, with one cup for its capstone', () => {
  const d = welcomeAt('i-1');
  assert.equal(d.state.view, 'welcome');
  const lines = screen(d.state);
  assert.match(lines[0], /Intermediate path · 0 of 9 done$/, lines.join('\n'));
  assert.equal(lines[1], '  I1 ── I2 ── I3 ── I4 ── I5 ── I6 ── I7 ── I8 ── 🏆');
  assert.equal(lines.join('\n').split('🏆').length, 2, 'one cup');
  const a = screen(welcomeAt('a-1').state);
  assert.match(a[0], /Advanced path · 0 of 8 done$/);
  assert.equal(a[1], '  A1 ── A2 ── A3 ── A4 ── A5 ── A6 ── A7 ── 🏆');
  assert.match(screen(d.state, [80, 24], ASCII)[1], /^ {2}I1 -- I2 .* I8 -- \[cup\]$/);
});

// Ticket 172: a new copy's saved folder makes a-5 or a-capstone the next
// lesson, and changes no count: a count is of completed lessons alone. The
// counts were already so before 172; this keeps them so.
test('a saved new copy changes neither the welcome\'s nor the map\'s n of m count: they count a completed a-5 or a-capstone, and only that', () => {
  const course = advancedCheckOnly();
  const folders = { 'a-5': '/home/sam/claude-actions-practice', 'a-capstone': '/home/sam/ci-review' };
  const cases = [
    ['a-5 given, not done', doneBefore(course, 'a-5'), '4 of 8 done'],
    ['a-5 and a-capstone done', { ...doneBefore(course, 'a-5'), 'a-5': { complete: true }, 'a-capstone': { complete: true } }, '6 of 8 done'],
  ];
  for (const [label, lessons, count] of cases) {
    for (const given of [{}, folders]) {
      const at = `${label}, ${Object.keys(given).length ? 'folders saved' : 'no folder saved'}`;
      const welcome = driver({ course, saved: { format: 1, welcomed: false, lessons, folders: given } });
      assert.equal(welcome.state.view, 'welcome', at);
      for (const size of [[60, 20], [80, 24]]) {
        const ls = screen(welcome.state, size);
        assert.ok(ls[0].endsWith(`Advanced path · ${count}`), `${at}\n${ls.join('\n')}`);
      }
      const map = driver({ course, saved: { format: 1, welcomed: true, lessons, folders: given } });
      assert.equal(map.state.view, 'map', at);
      for (const size of [[60, 20], [80, 24]]) {
        const ls = screen(map.state, size);
        assert.ok(ls[0].endsWith(count) && ls[0].includes('Advanced'), `${at}\n${ls.join('\n')}`);
      }
    }
  }
});

// Beginner's five links light one a frame; a longer level lights up to two a
// frame, so every level's fuse reaches its cup when Beginner's does.
test('the welcome\'s fuse runs along the current level\'s path line, at most two links a frame, and reaches its cup at +320 ms, as Beginner\'s does', () => {
  for (const [id, links] of [['b-1', 5], ['i-1', 8], ['a-1', 7]]) {
    const s = welcomeAt(id).state;
    const lit = (ms) => (render(s, { cols: 80, rows: 24 }, MOVING, { at: s.fx.view + ms }).map(strip)[1].match(/━━/g) ?? []).length;
    const run = [0, 80, 160, 240, 320, 400].map(lit);
    assert.equal(run[0], 1, `${id}: the first link at +0 ms`);
    assert.equal(run[4], links, `${id}: the cup at +320 ms, ${run}`);
    assert.equal(run[5], links, id);
    for (let k = 1; k < run.length; k++) assert.ok(run[k] >= run[k - 1] && run[k] - run[k - 1] <= 2, `${id}: ${run}`);
    assert.equal(lit(Infinity), 0, `${id} at rest`);
  }
});

test('the map\'s list scrolls with the cursor where its level doesn\'t fit: the cursor\'s row is always drawn, and no row is cut', () => {
  const d = mapAt('i-1');
  // A long toast takes rows from the list at 60x20.
  d.send({ type: 'notice', kind: 'save', message: 'EACCES: permission denied, open /home/sam/claude-code-practice/.practice/learn.json', wait: 10 });
  const level = LABELS.slice(6, 15);
  const seen = new Set();
  for (let k = 0; k < level.length; k++) {
    for (const size of [[60, 20], [80, 24]]) {
      const lines = screen(d.state, size);
      const where = `${level[k]} at ${size.join('x')}\n${lines.join('\n')}`;
      assert.ok(has(lines, C.saveFailed('EACCES').slice(0, 20)), where);
      assert.equal(cursorOn(lines), level[k], where);
      assert.ok(!lines.some((l) => l.trim() === '…'), where);
      // The rows drawn are a run of the level's lessons, in order.
      const shown = pills(lines);
      const from = level.indexOf(shown[0]);
      assert.deepEqual(shown, level.slice(from, from + shown.length), where);
      if (size[0] === 80) assert.equal(shown.length, level.length, where);
      else shown.forEach((x) => seen.add(x));
    }
    d.send({ type: 'key', name: 'down', wait: 10 });
  }
  assert.equal(seen.size, level.length, 'every row is drawn at some cursor place at 60x20');
});

test('with three levels the welcome and every map page fit at 60x20 and 80x24, in every mode, with nothing cut', () => {
  const pages = [['b-1', LABELS.slice(0, 6)], ['i-1', LABELS.slice(6, 15)], ['a-1', LABELS.slice(15)]];
  for (const [mode, t] of Object.entries(MODES)) {
    for (const [cols, rows] of [[60, 20], [80, 24]]) {
      for (const [id, labels] of pages) {
        const level = C.levels[threeLevels().find((l) => l.id === id).level];
        for (const [name, state] of [['welcome', welcomeAt(id).state], ['map', mapAt(id).state]]) {
          const raw = render(state, { cols, rows }, t);
          const lines = raw.map((l) => strip(l).trimEnd());
          const where = `${level} ${name} at ${cols}x${rows} (${mode})\n${lines.join('\n')}`;
          assert.equal(raw.length, rows, where);
          raw.forEach((l) => {
            assert.ok(width(l) <= cols - 1, where);
            assert.ok(graphemes(strip(l)).filter(isEmoji).length <= 1, where);
          });
          assert.ok(!lines.some((l) => l.trim() === t.glyph.ellipsis), `${where}: a row is dropped`);
          // A row the window's edge cut ends in its ellipsis. A map title
          // that gives way to the marks may end a row with no bar after it.
          assert.ok(!raw.some((l) => width(l) >= cols - 1 && strip(l).trimEnd().endsWith('…')), `${where}: a row is cut`);
          if (name === 'welcome') {
            // The level's count whole, at every width up to the app name's return.
            const done = C.pathLabel(level, 0, labels.length);
            assert.ok(lines[0].endsWith(t.unicode ? done : done.replace('·', '|')), where);
            for (let w = cols + 1; cols === 60 && w <= 64; w++) {
              const head = strip(render(state, { cols: w, rows }, t)[0]).trimEnd();
              assert.ok(head.endsWith(t.unicode ? done : done.replace('·', '|')), `${where}\nat ${w} columns: ${head}`);
            }
          } else assert.ok(lines[0].includes(`${level} path`), where);
          if (name === 'map') {
            if (t.unicode) assert.deepEqual(pills(lines), labels, where);
            assert.ok(has(lines, C.ofDone(0, labels.length)), where);
          } else {
            // The path line whole: every lesson's label, then the cup.
            const path = labels.slice(0, -1).join(t.unicode ? ' ── ' : ' -- ');
            assert.ok(lines[1].startsWith(`  ${path}${t.unicode ? ' ── 🏆' : ' -- [cup]'}`), where);
          }
        }
      }
    }
  }
});

// The Beginner capstone, with i-1 as its next lesson.
const CAPSTONE_TO_I1 = readFileSync(join(root, 'learn', 'lessons', 'b-capstone.md'), 'utf8').replace(/^---\n/, '---\nnext: i-1\n');

// Help fades within a level (ticket 85): a level's first lesson may start
// with more help than the capstone before it.
test('the next screen from b-capstone to i-1 names i-1 and says nothing of a notch harder, nor draws its bar, though i-1 has a lesson file', () => {
  const course = threeLevels({ 'b-capstone': CAPSTONE_TO_I1, 'i-1': DEMO_I1 });
  const d = driver({ course, saved: { format: 1, welcomed: true, lessons: finishedBefore('b-capstone', course) } });
  playUntil(d, (s) => s.view === 'next' && s.lesson === 'b-capstone');
  for (const size of [[60, 20], [80, 24]]) {
    const lines = screen(d.state, size);
    const where = `${size.join('x')}\n${lines.join('\n')}`;
    const up = lines.findIndex((l) => l.includes(C.nextUp));
    assert.ok(up > 0 && lines[up].includes('I1'), where);
    assert.ok(!has(lines, C.notchHarder.slice(0, 15)), where);
    // The bar is drawn beside "A notch harder", so it goes with it.
    assert.ok(!lines.slice(up).some((l) => /[●◆★]{3}/.test(l)), where);
  }
  d.key('enter');
  assert.deepEqual([d.state.view, d.state.lesson], ['intro', 'i-1']);
});

test('the Intermediate map page with i-1\'s lesson file keeps its tier bars and legend, and leaves out the footer that each lesson starts with less help', () => {
  const d = mapAt('i-1', threeLevels({ 'i-1': DEMO_I1 }));
  for (const size of [[60, 20], [80, 24]]) {
    const lines = screen(d.state, size);
    const where = `${size.join('x')}\n${lines.join('\n')}`;
    assert.match(lines.find((l) => / I1 /.test(l)) ?? '', /[●◆★]/, where);
    assert.ok(has(lines, C.help), where);
    assert.ok(!has(lines, C.mapFooter.slice(0, 20)), where);
  }
});

test('the welcome\'s path hint shows where the map\'s footer does: on Beginner, not on a later level, with a lesson file or without', () => {
  // Intermediate's path line would leave room for the hint from 100
  // columns.
  const wide = [100, 24];
  const withI1 = threeLevels({ 'i-1': DEMO_I1 });
  assert.equal(screen(welcomeAt('i-1', withI1).state, wide)[1].trim(), 'I1 ── I2 ── I3 ── I4 ── I5 ── I6 ── I7 ── I8 ── 🏆');
  for (const id of ['i-1', 'a-1']) assert.ok(!screen(welcomeAt(id).state, wide)[1].includes(C.pathHint), id);
  assert.ok(screen(welcomeAt('b-1').state)[1].endsWith(`🏆   ${C.pathHint}`));
  // The map agrees: its footer shows on Beginner's page and not on
  // Intermediate's.
  assert.ok(screen(mapAt('b-1', withI1).state, wide).join(' ').includes(C.mapFooter));
  assert.ok(!screen(mapAt('i-1', withI1).state, wide).join(' ').includes(C.mapFooter.slice(0, 20)));
});

test('skill counts carry across levels: after Beginner, i-1 opens GUIDED on its new skill and commit comes back at CHALLENGE', () => {
  const course = threeLevels({ 'i-1': DEMO_I1 });
  const d = driver({ course, saved: { format: 1, welcomed: true, lessons: finishedBefore('i-1', course) } });
  assert.deepEqual([d.state.view, d.state.lesson], ['intro', 'i-1']);
  playUntil(d, (s) => s.view === 'step' && stepOf(s).part !== 'Warm-up');
  assert.deepEqual([stepOf(d.state).id, tierOf(d.state)], ['W1', 'guided']);
  playUntil(d, (s) => s.view === 'step' && stepOf(s).id === 'W2');
  assert.equal(tierOf(d.state), 'challenge');
});
