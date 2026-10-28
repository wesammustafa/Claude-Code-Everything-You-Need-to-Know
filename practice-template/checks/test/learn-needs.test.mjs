// What a lesson needs before it starts (ticket 89): the commands its page's
// You need lists, the work an earlier lesson leaves behind, and, on native
// Windows, the page's note. The intro shows what is missing, so the learner
// finds out before spending usage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCourse, parseLesson, PATH } from '../../learn/lib/content.mjs';
import { C } from '../../learn/lib/copy.mjs';
import { introAsks, pinOf } from '../../learn/lib/flow.mjs';
import { render } from '../../learn/lib/render.mjs';
import { snapshot } from '../../learn/lib/store.mjs';
import { strip, width } from '../../learn/lib/text.mjs';
import { theme } from '../../learn/lib/theme.mjs';
import { course, DEMO_I1, driver, finishedBefore, root, threeLevels } from './learn-drive.mjs';

// The guide's own You need lines, as the lessons that need them quote them.
const NEED_JQ = '`jq`, which the hook scripts use, and `python3`, which `format-after-edit.sh` uses.';
const NEED_SANDBOX = 'On Linux and WSL 2, the sandbox needs `bubblewrap` and `socat`';

// DEMO_I1 with `front` lines added to its front matter and `intro` lines to
// its intro.
const withNeeds = ({ front = [], intro = [] } = {}) => DEMO_I1
  .replace('next: i-2\n---', `next: i-2\n${front.map((l) => `${l}\n`).join('')}---`)
  .replace('- can: "do it"\n', `- can: "do it"\n${intro.map((l) => `${l}\n`).join('')}`);
const parse = (opts) => parseLesson(withNeeds(opts), 'i-1.md');

test('front matter names the commands the page needs: each needs item is the commands one need line quotes, "on linux" for Linux only', () => {
  const l = parse({ front: ['needs: [jq python3, bwrap socat on linux]'], intro: [`- need: "${NEED_JQ}"`, `- need: "${NEED_SANDBOX}"`] });
  assert.deepEqual(l.needs, [
    { commands: ['jq', 'python3'], linux: false, quote: NEED_JQ },
    { commands: ['bwrap', 'socat'], linux: true, quote: NEED_SANDBOX },
  ]);
  assert.deepEqual(parse().needs, [], 'a lesson that names none needs none');
});

test('a needs item the app can\'t read, or one with no need line to quote, is an error naming the file', () => {
  const bad = [
    // The front matter's needs line, the sixth, is the one named; with no
    // needs line, the need line is.
    [{ front: ['needs: [jq]'] }, /i-1\.md:6: needs has 1 item and the intro 0 need lines/],
    [{ intro: [`- need: "${NEED_JQ}"`] }, /i-1\.md:\d+: needs has 0 items and the intro 1 need line/],
    [{ front: ['needs: [jq, python3]'], intro: [`- need: "${NEED_JQ}"`] }, /i-1\.md:6: needs has 2 items and the intro 1 need line/],
    [{ front: ['needs: [jq;rm]'], intro: [`- need: "${NEED_JQ}"`] }, /i-1\.md:6: needs item "jq;rm" is command names/],
    [{ front: ['needs: [../bin/jq]'], intro: [`- need: "${NEED_JQ}"`] }, /needs item "\.\.\/bin\/jq"/],
    [{ front: ['needs: [bwrap on mac]'], intro: [`- need: "${NEED_SANDBOX}"`] }, /needs item "bwrap on mac"/],
    [{ front: ['needs: [on linux]'], intro: [`- need: "${NEED_SANDBOX}"`] }, /needs item "on linux"/],
    [{ front: ['needs: [jq]'], intro: ['- need: jq is needed'] }, /need must be a quote of the lesson/],
  ];
  for (const [opts, error] of bad) assert.throws(() => parse(opts), error, JSON.stringify(opts));
  // A block list reads as the inline one does.
  assert.deepEqual(parse({ front: ['needs:', '  - jq'], intro: [`- need: "${NEED_JQ}"`] }).needs, [{ commands: ['jq'], linux: false, quote: NEED_JQ }]);
});

// ---- the intro ---------------------------------------------------------------
const MINE = '/home/sam/code/my-app';
const FULL = theme({ tty: true, depth: 8, unicode: true, links: true, win32: false });
const SIZES = [[60, 20], [80, 24]];
const screen = (state, [cols, rows] = [80, 24], t = FULL) => render(state, { cols, rows }, t).map((l) => strip(l).trimEnd());
// A screen's words as one line, for a sentence that wraps; code spans lose
// their backticks on screen.
const flat = (lines) => lines.map((l) => l.trim()).join(' ').replace(/\s+/g, ' ');
// A quote's words as the app draws them: code spans and a link's text plain.
const words = (text) => text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/`/g, '');
// At i-1's intro, Beginner finished and Intermediate's folder answered, with
// `opts` in its lesson file; `facts` as main found them.
const atIntro = (opts, facts = {}, folders = { intermediate: MINE }) => {
  const course = threeLevels({ 'i-1': withNeeds(opts) });
  return driver({ course, facts, saved: { format: 1, welcomed: true, lessons: finishedBefore('i-1', course), folders } });
};
const NEEDS = { front: ['needs: [jq python3, bwrap socat on linux]'], intro: [`- need: "${NEED_JQ}"`, `- need: "${NEED_SANDBOX}"`] };

test('the intro asks main to look up the commands its page needs, the Linux-only ones on Linux alone; each missing one shows its You need line', () => {
  const mac = atIntro(NEEDS);
  assert.equal(mac.state.view, 'intro');
  assert.deepEqual(introAsks(mac.state), [{ type: 'commands', names: ['jq', 'python3'] }]);
  const linux = atIntro(NEEDS, { linux: true });
  assert.deepEqual(introAsks(linux.state), [{ type: 'commands', names: ['jq', 'python3', 'bwrap', 'socat'] }]);
  // Opened from the map, the intro asks again: a command installed meanwhile counts.
  linux.key('m');
  linux.key('enter');
  assert.equal(linux.state.view, 'intro');
  assert.deepEqual(linux.effects.filter((e) => e.type === 'commands').at(-1), { type: 'commands', names: ['jq', 'python3', 'bwrap', 'socat'] });
  // Before main answers, nothing is said.
  for (const size of SIZES) assert.ok(!flat(screen(linux.state, size)).includes(words(NEED_JQ)), screen(linux.state, size).join('\n'));
  linux.send({ type: 'commands', found: { jq: true, python3: false, bwrap: true, socat: true } });
  for (const size of SIZES) {
    const text = flat(screen(linux.state, size));
    assert.ok(text.includes(`${C.notOnPath('python3')} "${words(NEED_JQ)}"`), `${size}\n${screen(linux.state, size).join('\n')}`);
    assert.ok(!text.includes(words(NEED_SANDBOX)), 'what is found says nothing');
    assert.ok(text.includes(C.startLesson(1)), 'the learner can still start');
  }
  linux.send({ type: 'commands', found: { python3: true, socat: false } });
  const text = flat(screen(linux.state));
  assert.ok(!text.includes(words(NEED_JQ)) && text.includes(`${C.notOnPath('socat')} "${NEED_SANDBOX.replace(/`/g, '')}"`), text);
  // Two lines missing: one sentence names every command, then each line.
  linux.send({ type: 'commands', found: { jq: false } });
  assert.ok(flat(screen(linux.state)).includes(`${C.notOnPath('jq', 'socat')} "${words(NEED_JQ)}" "${words(NEED_SANDBOX)}"`), screen(linux.state).join('\n'));
  // On macOS a Linux-only command is never asked about, so never shown.
  mac.send({ type: 'commands', found: { jq: false, python3: false, bwrap: false } });
  const onMac = flat(screen(mac.state));
  assert.ok(onMac.includes(`${C.notOnPath('jq', 'python3')} "${words(NEED_JQ)}"`) && !onMac.includes(words(NEED_SANDBOX)), onMac);
  // A lesson that needs nothing asks nothing.
  assert.deepEqual(introAsks(atIntro().state), []);
});

// The guide's NOTE, on Intermediate lesson 1's page.
const WINDOWS = 'From this level on, the lessons are written for macOS, Linux and WSL 2.';
const ASCII_WIN = theme({ tty: true, depth: 1, unicode: false, links: false, win32: true });
const WIN = theme({ tty: true, depth: 8, unicode: true, links: true, win32: true });

test('on native Windows the intro shows the page\'s note, and the learner can still start', () => {
  assert.equal(parse({ intro: [`- win-note: "${WINDOWS}"`] }).intro['win-note'], WINDOWS);
  assert.throws(() => parse({ intro: [`- win-note: ${WINDOWS}`] }), /win-note must be a quote of the lesson/);
  assert.throws(() => parse({ intro: [`- win-note: "${WINDOWS}"`, `- win-note: "${WINDOWS}"`] }), /a second win-note line/);
  const d = atIntro({ intro: [`- win-note: "${WINDOWS}"`] }, { win32: true });
  for (const t of [WIN, ASCII_WIN]) {
    for (const size of SIZES) {
      const text = flat(screen(d.state, size, t));
      assert.ok(text.includes(`"${WINDOWS}"`), `${size}\n${screen(d.state, size, t).join('\n')}`);
      assert.ok(text.includes(C.startLesson(1)), 'the start option stays');
    }
  }
  // Elsewhere it says nothing.
  for (const size of SIZES) assert.ok(!flat(screen(d.state, size)).includes(WINDOWS));
  d.key('enter');
  assert.equal(d.state.view, 'step');
});

// ---- what the page asks of your repository (ticket 179) ------------------------
// Intermediate lesson 1's You need line, which names no command.
const NEED_REPO = 'One of your own repositories with a test command and no uncommitted changes';

test('an intro may quote the page\'s You need line for the learner\'s repository, once', () => {
  assert.equal(parse({ intro: [`- need-repo: "${NEED_REPO}"`] }).intro['need-repo'], NEED_REPO);
  assert.equal(parse().intro['need-repo'], undefined);
  assert.throws(() => parse({ intro: [`- need-repo: ${NEED_REPO}`] }), /need-repo must be a quote of the lesson/);
  assert.throws(() => parse({ intro: [`- need-repo: "${NEED_REPO}"`, `- need-repo: "${NEED_REPO}"`] }), /a second need-repo line/);
});

test('the intro shows the repository line only where the level\'s work folder is set and is not the practice copy; n shows it too', () => {
  const repo = { intro: [`- need-repo: "${NEED_REPO}"`] };
  const mine = atIntro(repo);
  for (const size of SIZES) {
    const text = flat(screen(mine.state, size));
    assert.ok(text.includes(`${C.youNeed} "${NEED_REPO}"`), `the line says it is a need: ${size}\n${screen(mine.state, size).join('\n')}`);
    assert.ok(text.includes(C.startLesson(1)), 'the learner can still start');
  }
  mine.key('n');
  assert.equal(mine.state.overlay, 'notes');
  assert.ok(flat(screen(mine.state)).includes(`${C.youNeed} "${NEED_REPO}"`), screen(mine.state).join('\n'));
  mine.key('n');
  // In the practice copy, and while the folder question waits, it says nothing.
  const copy = atIntro(repo, {}, { intermediate: COPY });
  const asking = atIntro(repo, {}, null);
  assert.ok(flat(screen(asking.state)).includes(C.folderAsk('Intermediate')));
  for (const d of [copy, asking]) {
    for (const size of SIZES) assert.ok(!flat(screen(d.state, size)).includes(NEED_REPO), `${size}\n${screen(d.state, size).join('\n')}`);
  }
  copy.key('n');
  assert.equal(copy.state.overlay, null, 'with nothing to say, n does nothing');
  // Answered with this practice copy, still nothing.
  asking.key('enter');
  assert.ok(flat(screen(asking.state)).includes(C.workFolder));
  assert.ok(!flat(screen(asking.state)).includes(NEED_REPO), screen(asking.state).join('\n'));
  mine.key('enter');
  assert.equal(mine.state.view, 'step');
});

// At `id`'s intro, every lesson before it finished, with `opts` in its
// lesson file and `folders` saved.
const atLesson = (id, opts, folders) => {
  const course = threeLevels({ [id]: withNeeds(opts).replace('lesson: i-1', `lesson: ${id}`) });
  const d = driver({ course, saved: { format: 1, welcomed: true, lessons: finishedBefore(id, course), folders } });
  assert.deepEqual([d.state.view, d.state.lesson], ['intro', id]);
  return d;
};

test('the repository line shows on a later intro in the level\'s work folder, and never where the lesson runs elsewhere', () => {
  const repo = { intro: [`- need-repo: "${NEED_REPO}"`] };
  // A later intro, with no answer row: the line still shows.
  const later = atLesson('i-2', repo, { intermediate: MINE });
  for (const size of SIZES) {
    const text = flat(screen(later.state, size));
    assert.ok(text.includes(`"${NEED_REPO}"`) && !text.includes(C.workFolder), `${size}\n${screen(later.state, size).join('\n')}`);
  }
  // The capstone pinned to the copy, a lesson in a new copy of the
  // template, and Beginner, which has no work folder: nothing, and n does
  // nothing.
  const elsewhere = [
    ['i-capstone', { intermediate: MINE }],
    ['a-5', { intermediate: MINE, advanced: MINE, 'a-5': '/home/sam/new-copy' }],
    ['b-4', {}],
  ];
  for (const [id, folders] of elsewhere) {
    const d = atLesson(id, repo, folders);
    for (const size of SIZES) assert.ok(!flat(screen(d.state, size)).includes(NEED_REPO), `${id} at ${size}\n${screen(d.state, size).join('\n')}`);
    d.key('n');
    assert.equal(d.state.overlay, null, `${id}: with nothing to say, n does nothing`);
  }
});

// ---- prerequisites -------------------------------------------------------------
const SKILL = '.claude/skills/five-whys/SKILL.md';

test('front matter names a prerequisite: an earlier lesson\'s check item, or a file an earlier lesson leaves', () => {
  const l = parseLesson(withNeeds({ front: [`requires: [b-5 check 0, b-4 file ${SKILL}]`] }).replace('lesson: i-1', 'lesson: i-3'), 'i-3.md');
  assert.deepEqual(l.requires, [{ lesson: 'b-5', item: 0 }, { lesson: 'b-4', path: SKILL }]);
  assert.deepEqual(parse().requires, []);
  // Each error names the front matter's requires line, the sixth.
  const bad = [
    ['requires: [b-5]', /i-1\.md:6: requires item "b-5" is <lesson> check <item>, <lesson> file <path> or probe todos <n>/],
    ['requires: [probe todos x]', /requires item "probe todos x": probe todos takes a count/],
    ['requires: [probe pushed]', /requires item "probe pushed" is <lesson> check/],
    ['requires: [b-5 check]', /requires item "b-5 check"/],
    ['requires: [b-5 check x]', /requires item "b-5 check x"/],
    ['requires: [b-5 check 9]', /i-1\.md:6: requires item "b-5 check 9": b-5 has no check item 9/],
    ['requires: [z-9 check 0]', /z-9 is no lesson before i-1/],
    ['requires: [i-1 check 0]', /i-1 is no lesson before i-1/],
    ['requires: [i-2 check 0]', /i-2 is no lesson before i-1/],
    ['requires: [b-5 file ../secret.txt]', /names a file from the work folder, like/],
    ['requires: [b-5 file /etc/passwd]', /names a file from the work folder, like/],
    ['requires: [b-5 file a\\b.txt]', /names a file from the work folder, like/],
    // A folder is no file: reading it finds no line.
    ['requires: [b-4 file .claude/skills/]', /names a file from the work folder, like .* not \.claude\/skills\//],
    // A check item that starts another process runs only on r.
    ['requires: [b-3 check 1]', /b-3's check item 1 starts another process/],
    ['requires: [b-5 check 0, b-5 check 0]', /requires item "b-5 check 0" is named twice/],
  ];
  for (const [line, error] of bad) assert.throws(() => parse({ front: [line] }), error, line);
  // A lesson off the path has nothing before it.
  assert.throws(() => parseLesson(withNeeds({ front: ['requires: [a-7 check 0]'] }).replace('lesson: i-1', 'lesson: zz-9'), 'zz-9.md'), /zz-9\.md:6: requires: zz-9 is no lesson on the path/);
});

test('a course that puts a prerequisite\'s lesson after the lesson that needs it does not load', () => {
  const dir = mkdtempSync(join(tmpdir(), 'learn-requires-'));
  try {
    mkdirSync(join(dir, 'learn', 'lessons'), { recursive: true });
    writeFileSync(join(dir, 'learn', 'lessons', 'i-1.md'), withNeeds({ front: ['requires: [b-5 check 0]'] }));
    const at = (id) => PATH.find((p) => p.id === id);
    assert.equal(loadCourse(dir, [at('b-5'), at('i-1')])[1].content.requires.length, 1);
    assert.throws(() => loadCourse(dir, [at('i-1'), at('b-5')]), /learn\/lessons\/i-1\.md: requires b-5, no lesson before i-1 here/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const COPY = '/home/sam/claude-code-practice';
const REQUIRES = { front: [`requires: [b-5 check 0, b-4 file ${SKILL}]`] };
const ASKED = [{ lesson: 'b-5', item: 0 }, { lesson: 'b-4', path: SKILL }];
const B5_ITEM = 'a committed CLAUDE.md holds the rule saved in `.practice/b-5-rule.txt`';
const lastOf = (effects, type) => effects.filter((e) => e.type === type).at(-1);

test('the intro looks for its prerequisites in the work folder; one that fails says so, and is offered where that lesson is practised in the same folder', () => {
  const d = atIntro(REQUIRES, {}, { intermediate: COPY });
  assert.deepEqual(introAsks(d.state), [{ type: 'prereqs', lesson: 'i-1', dir: COPY, requires: ASKED }]);
  // Until main answers, the intro says nothing and offers the two starts.
  for (const size of SIZES) assert.ok(!flat(screen(d.state, size)).includes('builds on'), screen(d.state, size).join('\n'));
  // A result from another folder says nothing about this one.
  d.send({ type: 'prereq', lesson: 'i-1', dir: MINE, at: 0, pass: false });
  assert.ok(!flat(screen(d.state)).includes('builds on'));
  d.send({ type: 'prereq', lesson: 'i-1', dir: COPY, at: 0, pass: false });
  d.send({ type: 'prereq', lesson: 'i-1', dir: COPY, at: 1, read: null });
  for (const size of SIZES) {
    const lines = screen(d.state, size);
    const text = flat(lines);
    const where = `${size}\n${lines.join('\n')}`;
    // Each says what isn't there, or at 60x20, with no room for both, the
    // row that hands them to n does; the offer says whose work it is.
    if (size[1] < 24 && text.includes(C.notesShort)) assert.ok(!text.includes('builds on'), where);
    else {
      assert.ok(text.includes(C.buildsOnCheck('B5', words(B5_ITEM))), where);
      assert.ok(text.includes(C.buildsOnFile('B4', C.noFile(SKILL))), where);
    }
    assert.ok(text.includes(C.startLesson(1)) && text.includes(C.openFirst('B5')), where);
  }
  // The offer is the third option: down twice, or 3, then enter opens B5.
  d.key('down');
  d.key('down');
  d.key('enter');
  assert.deepEqual([d.state.view, d.state.lesson], ['intro', 'b-5']);
  // Back at i-1 the intro looks again; what passes now says nothing.
  const again = atIntro(REQUIRES, {}, { intermediate: COPY });
  again.send({ type: 'prereq', lesson: 'i-1', dir: COPY, at: 0, pass: true });
  again.send({ type: 'prereq', lesson: 'i-1', dir: COPY, at: 1, read: Buffer.from('---\nname: five-whys\n---\n') });
  const text = flat(screen(again.state));
  assert.ok(!text.includes('builds on') && !text.includes(C.openFirst('B5')), text);
  // An item the check could not decide (an error) says nothing.
  again.send({ type: 'prereq', lesson: 'i-1', dir: COPY, at: 0, pass: null });
  assert.ok(!flat(screen(again.state)).includes('builds on'));
  // 3 then enter goes too, and with nothing to offer 3 does nothing.
  const three = atIntro(REQUIRES, {}, { intermediate: COPY });
  three.send({ type: 'prereq', lesson: 'i-1', dir: COPY, at: 1, read: Buffer.from('') });
  three.key('3');
  three.key('enter');
  assert.deepEqual([three.state.view, three.state.lesson], ['intro', 'b-4']);
  again.key('3');
  assert.equal(again.state.cursor, 0);
});

test('a prerequisite that fails in the learner\'s own repository says so, but offers no lesson practised in another folder', () => {
  // Intermediate practises in my-app; Beginner in the practice copy, so
  // doing B5 again there would not change what my-app holds.
  const d = atIntro(REQUIRES);
  assert.deepEqual(introAsks(d.state), [{ type: 'prereqs', lesson: 'i-1', dir: MINE, requires: ASKED }]);
  d.send({ type: 'prereq', lesson: 'i-1', dir: MINE, at: 0, pass: false });
  for (const size of SIZES) {
    const text = flat(screen(d.state, size));
    assert.ok(text.includes(C.buildsOnCheck('B5', words(B5_ITEM))), `${size}\n${screen(d.state, size).join('\n')}`);
    assert.ok(!text.includes(C.openFirst('B5')), text);
  }
  d.key('3');
  assert.equal(d.state.cursor, 0, 'there is no third option');
  d.key('down');
  d.key('down');
  assert.equal(d.state.cursor, 0);
});

test('while the folder question waits for an answer the prerequisites wait too; the answer asks for them in that folder', () => {
  const d = atIntro(REQUIRES, {}, null);
  assert.deepEqual(introAsks(d.state), []);
  d.key('enter');
  assert.deepEqual(lastOf(d.effects, 'prereqs'), { type: 'prereqs', lesson: 'i-1', dir: COPY, requires: ASKED, asked: 1 });
});

test('each ask for the prerequisites has its number: an answer to an older ask that lands after a newer one says nothing', () => {
  const d = atIntro(REQUIRES, {}, { intermediate: COPY });
  // main's first look at startup has no number; each intro opened after has the next.
  d.key('m');
  d.key('enter');
  assert.equal(lastOf(d.effects, 'prereqs').asked, 1);
  d.key('m');
  d.key('enter');
  assert.equal(lastOf(d.effects, 'prereqs').asked, 2);
  // The newer ask's answer: it passes. The older one's, landing late, says nothing.
  d.send({ type: 'prereq', lesson: 'i-1', dir: COPY, at: 0, pass: true, asked: 2 });
  d.send({ type: 'prereq', lesson: 'i-1', dir: COPY, at: 0, pass: false, asked: 1 });
  assert.ok(!flat(screen(d.state)).includes('builds on'), screen(d.state).join('\n'));
  // In order, each answer counts.
  d.send({ type: 'prereq', lesson: 'i-1', dir: COPY, at: 1, read: Buffer.from('x\n'), asked: 1 });
  d.send({ type: 'prereq', lesson: 'i-1', dir: COPY, at: 1, read: null, asked: 2 });
  assert.ok(flat(screen(d.state)).includes(C.buildsOnFile('B4', C.noFile(SKILL))), screen(d.state).join('\n'));
});

test('an offer that goes once its prerequisite passes leaves the cursor on the start option', () => {
  const d = atIntro(REQUIRES, {}, { intermediate: COPY });
  d.send({ type: 'prereq', lesson: 'i-1', dir: COPY, at: 0, pass: false });
  d.key('3');
  assert.equal(d.state.cursor, 2);
  d.send({ type: 'prereq', lesson: 'i-1', dir: COPY, at: 0, pass: true });
  assert.ok(screen(d.state).some((l) => l.includes(`❯  ${C.startLesson(1)}`)), screen(d.state).join('\n'));
});

// ---- the row plan ----------------------------------------------------------------
// b-4's intro, the longest Beginner one: a Why line, four can lines and a payoff.
const B4_INTRO = readFileSync(join(root, 'checks/test/fixtures/reducer-course', 'b-4.md'), 'utf8').match(/## intro\n([\s\S]*?)\n## /)[1];
const NEED_SHORT = '`jq`, for the load log in the Worked example.';
// Advanced lesson 7's You need line, the longest that names commands.
const NEED_LONG = 'bash and `jq`, on macOS, Linux or WSL 2. On Linux and WSL 2, the sandbox needs `bubblewrap` and `socat`';
const MODES = [FULL, theme({ tty: true, depth: 4, unicode: true, links: false, win32: true }), theme({ tty: true, depth: 1, unicode: true, links: false, win32: false }), ASCII_WIN];
const widthCut = (t, cols) => (l) => width(l) === cols - 1 && (t.unicode ? l.endsWith('…') : /\S\.$/.test(l));
// A full intro for `id` with `front` and `intro` lines, and `extra` more can
// lines; with `why: false`, without its Why line.
const fullIntro = (id, { front = [], intro = [] }, extra = 0, why = true) => withNeeds({ front }).replace('lesson: i-1', `lesson: ${id}`)
  .replace(/## intro\n[\s\S]*?\n## warm-up/, `## intro\n${why ? B4_INTRO : B4_INTRO.replace(/- why: .*\n/, '')}${[...Array.from({ length: extra }, (_, k) => `- can: "practise skill ${k + 1}"`), ...intro].map((l) => `${l}\n`).join('')}\n## warm-up`);
const WHY = B4_INTRO.match(/- why: "(.*)"/)[1];
const NOT_GIT = { missing: false, git: false, gitBroken: null, practice: false };

// At `id`'s intro, with every command missing and every prerequisite
// failing: its level's folder question waiting (`asking`), answered there
// with this practice copy (`answered`), or my-app saved before (`saved`),
// where `probe` is what main found there.
function crowded(id, opts, { extra = 0, mode = 'saved', probe = null, why = true } = {}) {
  const course = threeLevels({ [id]: fullIntro(id, opts, extra, why) });
  // Every lesson before it finished, but its level's: its folder question
  // is the level's first.
  const lessons = Object.fromEntries(course.slice(0, course.findIndex((l) => l.id === id)).map((l) => [l.id, { complete: true }]));
  const level = course.find((l) => l.id === id).level;
  const d = driver({ course, facts: { linux: true, win32: true }, saved: { format: 1, welcomed: true, lessons, ...(mode === 'saved' ? { folders: { [level]: MINE } } : {}) } });
  assert.equal(d.state.lesson, id);
  if (mode === 'answered') d.key('enter');
  const dir = mode === 'saved' ? MINE : COPY;
  if (probe) d.send({ type: 'probed', path: dir, ...probe });
  const { content } = d.state.course.find((l) => l.id === id);
  d.send({ type: 'commands', found: Object.fromEntries(content.needs.flatMap((n) => n.commands).map((c) => [c, false])) });
  content.requires.forEach((r, at) => d.send({ type: 'prereq', lesson: id, dir, at, ...(r.path ? { read: null } : { pass: false }) }));
  return d;
}

// Every note the intro has for `state`, whole, as the n overlay shows it at 80x24.
function notesOf(d, t) {
  d.key('n');
  if (d.state.overlay !== 'notes') return '';
  const text = flat(render(d.state, { cols: 100, rows: 40 }, t).map(strip));
  d.key('n');
  assert.equal(d.state.overlay, null);
  return text;
}

// An intro at 60x20 and 80x24 in every mode: no teaching line cut, every can
// line whole, `rows` whole; the notes whole, or the one row that hands them
// to n. Where that row shows, the notes would not fit without the Why line
// either (`twin` is the same intro with none): the Why line gives way first.
function fits(label, d, rows, twin = null) {
  const state = d.state;
  const can = [...state.course.find((l) => l.id === state.lesson).content.intro.can];
  let dropped = 0;
  let short = 0;
  for (const t of MODES) {
    for (const [cols, size] of SIZES) {
      const lines = render(state, { cols, rows: size }, t).map(strip);
      const where = `${label} at ${cols}x${size}\n${lines.join('\n')}`;
      assert.ok(!lines.some((l) => l.trim() === t.glyph.ellipsis), `${where}: a row is dropped`);
      assert.ok(!lines.some(widthCut(t, cols)), `${where}: a line is cut`);
      const text = flat(lines);
      for (const c of can) assert.ok(text.includes(words(c)), `${where}: "${c}" is not whole`);
      for (const r of rows) assert.ok(text.includes(r), `${where}: "${r}" is not whole`);
      if (text.includes(`${C.whyLead} "${WHY.slice(0, 20)}`)) assert.ok(text.includes(words(WHY)), `${where}: the Why line is cut`);
      else dropped += 1;
      if (text.includes(C.notesShort)) {
        short += 1;
        if (twin) assert.ok(flat(render(twin.state, { cols, rows: size }, t).map(strip)).includes(C.notesShort), `${where}: the notes gave way before the Why line`);
      }
    }
  }
  return { dropped, short };
}

test('the intro\'s notes share its row plan with the Why line and the folder question: no teaching line is cut, the Why line gives way first, and notes with no room left take one row that hands them to n', () => {
  const sandbox = { front: ['needs: [jq, bwrap socat on linux]', 'requires: [b-5 check 0]'], intro: [`- need: "${NEED_SHORT}"`, `- need: "${NEED_SANDBOX}"`] };
  const windows = { intro: [`- win-note: "${WINDOWS}"`] };
  const first = { front: ['needs: [jq]', 'requires: [b-5 check 0]'], intro: [`- need: "${NEED_SHORT}"`] };
  // The longest real You need lines, the Windows note, a prerequisite and
  // a work folder that isn't a git repository, all on one intro.
  const everything = { front: ['needs: [jq python3, bash jq bwrap socat]', `requires: [b-5 check 0, i-1 file ${SKILL}]`], intro: [`- need: "${NEED_JQ}"`, `- need: "${NEED_LONG}"`, `- win-note: "${WINDOWS}"`, `- need-repo: "${NEED_REPO}"`] };
  const cases = [
    // A level's first intro: the folder question, then its answer.
    ...[0, 1].flatMap((extra) => [
      [`first, asking, the Windows note, ${extra} more can lines`, 'i-1', windows, { extra, mode: 'asking' }, [C.folderAsk('Intermediate'), C.folderOther]],
      [`first, answered, the Windows note, ${extra} more can lines`, 'i-1', windows, { extra, mode: 'answered' }, [C.workFolder, C.startLesson(1)]],
      [`first, asking, a command missing, ${extra} more can lines`, 'i-2', first, { extra, mode: 'asking' }, [C.folderAsk('Intermediate'), C.folderOther]],
    ]),
    ['first, answered, a command and a prerequisite missing', 'i-2', first, { mode: 'answered' }, [C.workFolder, C.openFirst('B5')]],
    ['saved, a prerequisite missing in my-app', 'i-2', { front: ['requires: [b-5 check 0]'] }, {}, [C.buildsOnCheck('B5', words(B5_ITEM))]],
    ['saved, not a git repository, the Windows note and a command missing', 'i-1', { ...first, intro: [...first.intro, ...windows.intro] }, { probe: NOT_GIT }, [C.startLesson(1)]],
    // In the copy B5 is offered, as its lesson is practised there; in
    // my-app only I1 is.
    ['first, answered, everything', 'i-3', everything, { mode: 'answered' }, [C.workFolder, C.openFirst('B5')]],
    ['saved, everything in my-app', 'i-3', everything, { probe: NOT_GIT, extra: 1 }, [C.openFirst('I1')]],
    // The level's first intro in my-app: the answer row, the folder's note
    // and the repository line together.
    ['saved, everything on the level\'s first intro', 'i-1', { ...everything, front: [everything.front[0], 'requires: [b-5 check 0]'] }, { probe: NOT_GIT, extra: 1 }, [C.workFolder, C.startLesson(1)]],
    ['later, two needs', 'a-7', sandbox, {}, []],
  ];
  let dropped = 0;
  let short = 0;
  for (const [label, id, opts, how, rows] of cases) {
    const d = crowded(id, opts, how);
    const r = fits(label, d, rows, crowded(id, opts, { ...how, why: false }));
    dropped += r.dropped;
    short += r.short;
    // Whatever the intro shows, n shows every note whole.
    const all = notesOf(d, WIN);
    const { content } = d.state.course.find((l) => l.id === id);
    for (const n of content.needs.filter((x) => !x.linux)) assert.ok(all.includes(words(n.quote)), `${label}: n shows "${n.quote}"\n${all}`);
    if (content.intro['win-note']) assert.ok(all.includes(`"${WINDOWS}"`), `${label}: n shows the Windows note`);
    if (how.probe) assert.ok(all.includes(C.notGit), `${label}: n shows the folder's note`);
    // The repository line, in my-app alone.
    if (content.intro['need-repo']) assert.equal(all.includes(`"${NEED_REPO}"`), (how.mode ?? 'saved') === 'saved', `${label}: n shows the repository line in my-app alone\n${all}`);
  }
  assert.ok(dropped > 0, 'the Why line never had to give way');
  assert.ok(short > 0, 'the notes never had to give way');
});

test('a failed prerequisite outlasts the Why line: below 24 rows the Why line goes and the prerequisite stays whole', () => {
  const opts = { front: ['requires: [b-5 check 0]'] };
  const d = crowded('i-2', opts);
  for (const rows of [20, 22]) {
    const text = flat(render(d.state, { cols: 60, rows }, FULL).map(strip));
    assert.ok(text.includes(C.buildsOnCheck('B5', words(B5_ITEM))), `60x${rows}\n${text}`);
    assert.ok(!text.includes(C.notesShort), `60x${rows}: the one note fits whole`);
  }
  assert.ok(!flat(render(d.state, { cols: 60, rows: 20 }, FULL).map(strip)).includes(words(WHY)), 'at 60x20 the Why line gave way');
});

test('n opens the intro\'s notes whole, a note at a time where they are taller than the room, and n closes them', () => {
  const everything = { front: ['needs: [jq python3, bash jq bwrap socat]', `requires: [b-5 check 0, i-1 file ${SKILL}]`], intro: [`- need: "${NEED_JQ}"`, `- need: "${NEED_LONG}"`, `- win-note: "${WINDOWS}"`, `- need-repo: "${NEED_REPO}"`] };
  const d = crowded('i-3', everything, { probe: NOT_GIT });
  d.key('n');
  assert.equal(d.state.overlay, 'notes');
  const seen = new Set();
  for (let k = 0; k < 6; k++) {
    const lines = render(d.state, { cols: 60, rows: 20 }, WIN).map(strip);
    assert.ok(!lines.some((l) => l.trim() === '…'), lines.join('\n'));
    assert.ok(lines.some((l) => l.includes(C.notesTitle)), lines.join('\n'));
    seen.add(flat(lines));
    d.key('down');
  }
  const all = [...seen].join(' ');
  for (const text of [C.notGit, `"${NEED_REPO}"`, `"${WINDOWS}"`, words(NEED_JQ), words(NEED_LONG), C.buildsOnCheck('B5', words(B5_ITEM)), C.buildsOnFile('I1', C.noFile(SKILL))]) {
    assert.ok(all.includes(text), `the notes never show "${text}"`);
  }
  d.key('n');
  assert.equal(d.state.overlay, null);
  // With nothing to say, n does nothing.
  const quiet = atIntro();
  quiet.key('n');
  assert.equal(quiet.state.overlay, null);
});

// Each intro in learn/lessons as the learner may meet it: every command it
// needs missing, every prerequisite failing, on native Windows, and, in a
// later level, as its level's first intro, asking and then answered there,
// and in a saved work folder that isn't a git repository. A lesson pinned to
// the copy (i-capstone) asks nothing, so enter starts it: it has no answered
// intro. A lesson that runs in a new copy (a-5) asks for that folder's path,
// which a prompt takes, so it has none either; its folder is saved under its
// own id.
test('every lesson file\'s intro fits at 60x20 and 80x24 with everything it needs missing: no teaching line cut', () => {
  const states = course.filter((l) => l.content).flatMap((l) => {
    // Every lesson before it finished, and no work folder saved yet.
    const lessons = Object.fromEntries(course.slice(0, course.indexOf(l)).map((x) => [x.id, { complete: true }]));
    // A lesson pinned to a new copy (a-capstone) has no default to accept
    // with enter: its folder is typed, then saved under its own id.
    const modes = l.level === 'beginner' ? ['beginner'] : ['copy', 'new copy'].includes(pinOf(l)) ? ['asking', 'saved'] : ['asking', 'answered', 'saved'];
    const key = pinOf(l) === 'new copy' ? l.id : l.level;
    return modes.map((mode) => {
      const d = driver({ course, facts: { linux: true, win32: true }, saved: { format: 1, welcomed: true, lessons, ...(mode === 'saved' ? { folders: { [key]: MINE } } : {}) } });
      assert.deepEqual([d.state.view, d.state.lesson], ['intro', l.id]);
      if (mode === 'answered') d.key('enter');
      const dir = mode === 'saved' ? MINE : COPY;
      if (mode === 'saved') d.send({ type: 'probed', path: dir, ...NOT_GIT });
      d.send({ type: 'commands', found: Object.fromEntries(l.content.needs.flatMap((n) => n.commands).map((c) => [c, false])) });
      l.content.requires.forEach((r, at) => d.send({ type: 'prereq', lesson: l.id, dir, at, ...(r.path ? { read: null } : { pass: false }) }));
      return [`${l.id} ${mode}`, d];
    });
  });
  assert.ok(states.length >= 6);
  for (const [label, d] of states) {
    const { content } = d.state.course.find((l) => l.id === d.state.lesson);
    fits(label, d, []);
    // Each note shows whole on the intro, or behind n.
    // The repository line shows in my-app alone.
    const repo = content.intro['need-repo'] && label.endsWith('saved') ? [content.intro['need-repo']] : [];
    const notes = [...content.needs.map((n) => n.quote), ...(content.intro['win-note'] ? [content.intro['win-note']] : []), ...repo];
    for (const t of MODES) {
      // The Windows note draws where the terminal is native Windows's, as a
      // beat's does.
      const shown = notes.filter((n) => n !== content.intro['win-note'] || t.caps.win32);
      for (const [cols, size] of SIZES) {
        const text = flat(render(d.state, { cols, rows: size }, t).map(strip));
        if (text.includes(C.notesShort)) continue;
        for (const n of shown) assert.ok(text.includes(words(n)), `${label} at ${cols}x${size}: "${n}" is not whole\n${text}`);
      }
    }
    const all = notesOf(d, WIN);
    for (const n of notes) assert.ok(all.includes(words(n)), `${label}: n shows "${n}"`);
  }
});

test('what main finds, on the PATH and in the work folder, is never saved', () => {
  const d = atIntro({ ...REQUIRES, front: [...REQUIRES.front, 'needs: [jq]'], intro: [`- need: "${NEED_JQ}"`] }, {}, { intermediate: COPY });
  const before = JSON.stringify(snapshot(d.state));
  d.send({ type: 'commands', found: { jq: false } });
  d.send({ type: 'prereq', lesson: 'i-1', dir: COPY, at: 0, pass: false });
  d.send({ type: 'prereq', lesson: 'i-1', dir: COPY, at: 1, read: null });
  assert.ok(flat(screen(d.state)).includes(C.openFirst('B5')));
  assert.equal(JSON.stringify(snapshot(d.state)), before);
});

test('a prerequisite can be the work folder\'s own: probe todos <n>, run as a probe, says what the folder lacks and offers no lesson (105)', () => {
  const opts = { front: ['requires: [probe todos 2]'] };
  assert.deepEqual(parse(opts).requires, [{ probe: 'todos', args: ['2'] }]);
  const d = atIntro(opts, {}, { intermediate: COPY });
  assert.deepEqual(introAsks(d.state), [{ type: 'prereqs', lesson: 'i-1', dir: COPY, requires: [{ probe: 'todos', args: ['2'] }] }]);
  const hint = 'git grep finds TODO or FIXME in 1 top-level folder (src/) here; this needs 2.';
  d.send({ type: 'prereq', lesson: 'i-1', dir: COPY, at: 0, pass: false, hint });
  for (const size of SIZES) {
    const text = flat(screen(d.state, size));
    if (!text.includes(C.notesShort)) assert.ok(text.includes(C.folderLacks(hint)), `${size}\n${text}`);
    assert.ok(!text.includes(C.openFirst('B5')), text);
    for (const l of screen(d.state, size)) assert.ok(width(l) <= size[0] - 1, l);
  }
  d.send({ type: 'prereq', lesson: 'i-1', dir: COPY, at: 0, pass: true, hint: '' });
  assert.ok(!flat(screen(d.state)).includes(C.folderLacks('')));
});
