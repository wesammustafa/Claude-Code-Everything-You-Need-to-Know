// The learn app's screens: every screen of lesson 1, at every size and in
// every color mode, fits the terminal exactly and draws only what that mode
// can show.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLesson, WORK_LEVELS } from '../../learn/lib/content.mjs';
import { C, TERMS } from '../../learn/lib/copy.mjs';
import { beatOf, cardOf, DEFER_MS, hintAvailable, IDLE_MS, lessonOf, levelOf, nextLessonOf, rungsOf, stepNote, stepOf, tierOf } from '../../learn/lib/flow.mjs';
import { ambientOpened, TIMING } from '../../learn/lib/motion.mjs';
import { bootFrame, BOX_ROWS, cardMax, itemsMax, pipSlot, render } from '../../learn/lib/render.mjs';
import { snapshot } from '../../learn/lib/store.mjs';
import { graphemes, isEmoji, strip, width } from '../../learn/lib/text.mjs';
import { COLORS, theme, TIER_STYLE } from '../../learn/lib/theme.mjs';
import { mix, ruleTiers } from '../../learn/lib/tiers.mjs';
import { allScreens, bareExit, bottomRung, course as allCourse, courseWith, DEMO_I1_INDEX, driver, FACTS, failCheck, finished, finishedBefore, gitLists, lastInOrder, lessonScreens, mapTo, onReading, playUntil, root, tryNow } from './learn-drive.mjs';

const SIZES = [[60, 20], [80, 24], [100, 30], [120, 40], [200, 50]];
const CAPS = {
  full: { tty: true, depth: 8, unicode: true, links: true, win32: false },
  sixteen: { tty: true, depth: 4, unicode: true, links: false, win32: false },
  noColor: { tty: true, depth: 1, unicode: true, links: false, win32: false },
  ascii: { tty: true, depth: 1, unicode: false, links: false, win32: true },
};
const screens = allScreens();

test('lesson 1 reaches every screen the app has', () => {
  const labels = screens.map(([label]) => label);
  for (const view of ['welcome', 'intro', 'complete', 'next', 'compare', 'map', 'help', 'check-only', 'page', 'resume']) assert.ok(labels.includes(view), view);
  assert.equal(screens.find(([l]) => l === 'compare')[1].overlay, 'compare');
  assert.equal(screens.find(([l]) => l === 'complete')[1].view, 'complete');
  assert.equal(screens.find(([l]) => l === 'W3 done')[1].beat.status, 'done');
});

test('every screen is exactly the window: no line too wide, one emoji at most', () => {
  for (const [capName, caps] of Object.entries(CAPS)) {
    const t = theme(caps);
    for (const [cols, rows] of SIZES) {
      for (const [label, state] of screens) {
        const lines = render(state, { cols, rows }, t);
        const where = `${label} at ${cols}x${rows} (${capName})`;
        assert.equal(lines.length, rows, `${where}: ${lines.length} lines`);
        lines.forEach((line, i) => {
          assert.ok(width(line) <= cols - 1, `${where}, line ${i + 1} is ${width(line)} wide: ${strip(line)}`);
          const emoji = graphemes(strip(line)).filter(isEmoji);
          assert.ok(emoji.length <= 1, `${where}, line ${i + 1} has ${emoji.length} emoji`);
          assert.doesNotMatch(line, /️/, `${where}, line ${i + 1} has U+FE0F`);
        });
      }
    }
  }
});

test('nothing on a screen is cut at 80x24 or larger', () => {
  const t = theme(CAPS.full);
  for (const [cols, rows] of SIZES.slice(1)) {
    for (const [label, state] of screens) {
      const lines = render(state, { cols, rows }, t).map(strip);
      // `cut` fills a line to the last column and ends it with an ellipsis.
      assert.ok(!lines.some((l) => l.endsWith('…') && width(l) === cols - 1), `${label} at ${cols}x${rows} cuts a line`);
      assert.ok(!lines.some((l) => l.trim() === '…'), `${label} at ${cols}x${rows} drops lines`);
    }
  }
});

// The frame's box (191): at most 80 columns by BOX_ROWS, centered both
// ways. Each size with the box's first row and the key bar's, 0-based.
const BOXED = [[60, 20, 0, 19], [80, 24, 0, 23], [120, 40, 0, 39], [120, 60, 10, 49], [120, 61, 10, 49], [200, 60, 10, 49]];
const isRule = (l) => /^ *(─+|-+)$/.test(l);
test('the frame is a box at most 80 columns by 40 rows, centered both ways: the key bar its last row, under the content, with equal blank rows above and below in a taller window, the odd one below', () => {
  assert.equal(BOX_ROWS, 40);
  for (const capName of ['full', 'ascii']) {
    const t = theme(CAPS[capName]);
    for (const [cols, rows, top, bar] of BOXED) {
      // Below and above: equal, or one more below.
      assert.ok([0, 1].includes(rows - 1 - bar - top), `${cols}x${rows}`);
      for (const [label, base] of screens) {
        for (const state of [base, { ...base, toast: { kind: 'stray' } }]) {
          const where = `${label}${state.toast ? ' with a toast' : ''} at ${cols}x${rows} (${capName})`;
          const lines = render(state, { cols, rows }, t);
          assert.equal(lines.length, rows, where);
          // The box draws as a window its height does, so a screen that
          // sizes itself to its room gets the box's, and nothing stretches.
          assert.deepEqual(lines.slice(top, bar + 1), render(state, { cols, rows: bar - top + 1 }, t), `${where}: the box`);
          assert.deepEqual([...lines.slice(0, top), ...lines.slice(bar + 1)].filter(Boolean), [], `${where}: the rows around the box are blank`);
          const plain = lines.map(strip);
          assert.ok(plain[bar].trim() && isRule(plain[bar - 1]), `${where}: the key bar and its rule end the box\n${plain.join('\n')}`);
          if (state.toast && rows > BOX_ROWS) assert.match(plain.slice(bar - 4, bar - 1).join('\n'), /looks like a command/, `${where}: the toast sits over the rule`);
        }
      }
    }
  }
  // Across: the 80-column box with equal margins, its header on the box's
  // second row (the first is the blank of a box 28 rows or taller).
  const wide = render(driver().state, { cols: 200, rows: 60 }, theme(CAPS.full)).map(strip);
  assert.equal(wide[48], `${' '.repeat(60)}${'─'.repeat(80)}`);
  assert.equal(wide[10], '');
  assert.match(wide[11], /^ {60} ?LEARN/);
  // Below the minimum the window is the box: the one screen, its words
  // centered in the whole window, as before.
  for (const [cols, rows] of [[59, 60], [50, 19], [120, 19]]) {
    for (const lines of [render(driver().state, { cols, rows }, theme(CAPS.full)), bootFrame(0, { cols, rows }, theme(CAPS.full))]) {
      const words = lines.filter(Boolean);
      assert.equal(lines.length, rows, `${cols}x${rows}`);
      assert.match(words.join(' '), /at least 60 by\s+20/, `${cols}x${rows}`);
      assert.equal(lines.findIndex(Boolean), Math.floor((rows - words.length) / 2), `${cols}x${rows}`);
    }
  }
});

test('the boot frame and the welcome land in the same box: the app\'s line and Pip on the same rows in a tall window, the 9x4 Pip and the detailed one', () => {
  for (const depth of [8, 24]) {
    const t = theme({ ...CAPS.full, depth });
    for (const [cols, rows] of [[80, 24], [120, 40], [120, 60], [200, 61]]) {
      const size = { cols, rows };
      const welcome = driver().state;
      const slot = pipSlot(null, size, t, welcome);
      const raster = slot && { size: slot };
      const boot = bootFrame(0, size, t, undefined, raster).map(strip);
      const shown = render(welcome, size, t, undefined, slot && { size: pipSlot(welcome, size, t) }).map(strip);
      const where = `${cols}x${rows} at depth ${depth}\n${boot.join('\n')}\n${shown.join('\n')}`;
      const title = (ls) => ls.findIndex((l) => l.includes('LEARN'));
      assert.equal(title(boot), title(shown), where);
      if (rows > BOX_ROWS) assert.equal(title(boot), Math.floor((rows - BOX_ROWS) / 2) + 1, where);
      // Pip's rows: the 9x4 Pip's antenna and box, or the raster's cells.
      const pip = (ls) => ls.flatMap((l, i) => (/[▀▄]|╭───┴───╮|●‿●|─‿─/.test(l) ? [i] : []));
      assert.equal(pip(boot)[0], pip(shown)[0], where);
      assert.equal(boot.length, rows, where);
      assert.equal(boot.findLastIndex(isRule), shown.findLastIndex(isRule), `${where}: the rule`);
    }
  }
});

test('each color mode draws only what it can show', () => {
  const codes = (line) => [...line.matchAll(/\x1b\[([0-9;]*)m/g)].map((m) => m[1]);
  for (const [label, state] of screens) {
    const none = render(state, { cols: 100, rows: 30 }, theme(CAPS.noColor)).join('\n');
    for (const c of codes(none)) for (const p of c.split(';')) assert.ok(['0', '1', '22', '7', '27', ''].includes(p), `${label} without color uses SGR ${c}`);
    const sixteen = render(state, { cols: 100, rows: 30 }, theme(CAPS.sixteen)).join('\n');
    assert.doesNotMatch(sixteen, /38;5|48;5/, `${label} in 16 colors uses a 256-color code`);
    const truecolor = render(state, { cols: 100, rows: 30 }, theme({ ...CAPS.full, depth: 24 })).join('\n');
    assert.doesNotMatch(truecolor, /38;2|48;2/, `${label} on a truecolor terminal uses a truecolor code`);
    const ascii = render(state, { cols: 100, rows: 30 }, theme(CAPS.ascii)).map(strip).join('\n');
    assert.doesNotMatch(ascii, /[^\x00-\x7f]/, `${label} in ASCII mode draws ${ascii.match(/[^\x00-\x7f]/)?.[0]}`);
  }
});

test('a guided step draws as the approved mockup', () => {
  const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W3', beat: 0, done: ['W1', 'W2'] } } } });
  d.key('enter');
  d.send({ type: 'check', lesson: 'b-1', items: [{ index: 0, text: 'x', pass: false, hint: 'No `.practice/version.txt` yet: run it' }] });
  const lines = render(d.state, { cols: 84, rows: 26 }, theme(CAPS.noColor)).map((l) => strip(l).trimEnd());
  const golden = readFileSync(join(root, 'checks', 'test', 'fixtures', 'learn', 'w3-waiting.txt'), 'utf8').replace(/\r\n/g, '\n').trimEnd().split('\n');
  assert.deepEqual(lines.join('\n').trimEnd().split('\n'), golden);
});

test('review fixes: paths are quoted and measured, toasts show everywhere, no hint crash', async () => {
  const { quotePath } = await import('../../learn/lib/render.mjs');
  assert.equal(quotePath('/home/sam/claude-code-practice', false), '/home/sam/claude-code-practice');
  assert.equal(quotePath('/Users/Jane Doe/practice', false), "'/Users/Jane Doe/practice'");
  assert.equal(quotePath("/tmp/it's", false), "'/tmp/it'\\''s'");
  assert.equal(quotePath('C:\\Users\\Jane Doe\\practice', true), '"C:\\Users\\Jane Doe\\practice"');
  assert.equal(width('練習'), 4);
  const t = theme(CAPS.full);
  // A long folder name in CJK still fits the window.
  const wide = driver({ facts: { root: `/home/${'練習'.repeat(30)}` } });
  for (const [cols, rows] of SIZES) for (const l of render(wide.state, { cols, rows }, t)) assert.ok(width(l) <= cols - 1);
  // The wrong-window note shows on the welcome screen too.
  wide.send({ type: 'paste', text: 'claude' });
  assert.match(render(wide.state, { cols: 100, rows: 30 }, t).map(strip).join('\n'), /Type it in your other terminal/);
  // "Less help": the exact command uses the real folder, not the placeholder.
  const less = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { lessHelp: true, step: 'W3' } } } });
  less.key('enter');
  less.send({ type: 'check', lesson: 'b-1', items: [{ index: 0, text: 'x', pass: false, hint: 'a' }] });
  while (!less.state.beat.confirm) less.send({ type: 'key', name: 'h', ch: 'h', wait: 2_100 }), less.send({ type: 'flush', wait: 400 });
  less.key('y');
  const shown = render(less.state, { cols: 100, rows: 30 }, t).map(strip).join('\n');
  assert.doesNotMatch(shown, /<your practice copy>/);
  assert.match(shown, /cd \/home\/sam\/claude-code-practice/);
  // The welcome screen states no command of its own.
  const welcome = render(driver().state, { cols: 100, rows: 30 }, t).map(strip).join('\n');
  assert.doesNotMatch(welcome, /\$ claude\b/);
});

test('every label on a colored block reaches 4.5:1 contrast, and marks on a dark background 3:1', () => {
  // xterm's 256-color values and WCAG's relative luminance.
  const rgb = (n) => {
    if (n >= 232) return Array(3).fill(8 + (n - 232) * 10);
    const c = (v) => (v ? 55 + v * 40 : 0);
    return [c(Math.floor((n - 16) / 36)), c(Math.floor((n - 16) / 6) % 6), c((n - 16) % 6)];
  };
  const lum = (n) => rgb(n).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => {
    const [hi, lo] = [lum(COLORS[a][0]), lum(COLORS[b][0])].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const pills = [['accentBg', 'white'], ['chipBg', 'white'], ['okBg', 'white'], ['warn', 'black'], ['dimBg', 'dimText'],
    ['codeBg', 'code'], ['codeBg', 'prompt'],
    ...Object.values(TIER_STYLE).map((x) => [x.bg, x.fgOnBg])];
  for (const [bg, fg] of pills) assert.ok(ratio(bg, fg) >= 4.5, `${fg} on ${bg}: ${ratio(bg, fg).toFixed(2)}:1`);
  // A dark terminal background, like the screenshots': xterm's 233.
  COLORS.darkBg = [233, 30];
  // Pip is in its own three: its outline, its eyes and its mouth.
  for (const token of ['faint', 'muted', 'text', 'code', 'key', 'ok', 'warn', 'guided', 'hinted', 'challenge', 'accent', 'gold', 'pipOutline', 'pipEyes', 'pipMouth']) {
    assert.ok(ratio(token, 'darkBg') >= 3, `${token} on a dark background: ${ratio(token, 'darkBg').toFixed(2)}:1`);
  }
  delete COLORS.darkBg;
});

test('lessons after the first: page links, Windows bottom lines, slow checks and a harder step', async () => {
  const { courseWith, DEMO_B2 } = await import('./learn-drive.mjs');
  const text = DEMO_B2.replace('- goal: "Save it again."', '- goal: "Save it again."\n- note: "See [Watch out](#watch-out) and [lesson 5](05-project-memory.md#worked-example)."\n- bottom: "printf x > a.txt"\n- win: "Set-Content a.txt x"');
  const course = courseWith({ 'b-2': text });
  const d = driver({ course, saved: { format: 1, welcomed: true, lessons: { 'b-1': finished(allCourse.find((l) => l.id === 'b-1')), 'b-2': { warm: ['R1', 'R2'], step: 'Y1', beat: 0, levels: ['challenge'] } } } });
  d.key('enter');
  const draw = (caps) => render(d.state, { cols: 100, rows: 40 }, theme({ ...CAPS.full, ...caps })).join('\n');
  const links = [...draw({ links: true }).matchAll(/\x1b\]8;;([^\x07]*)\x07/g)].map((m) => m[1]).filter(Boolean);
  const page = 'https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/blob/main/docs/beginner/';
  assert.ok(links.includes(`${page}02-permission-modes-and-plan-mode.md#watch-out`), links.join(' '));
  assert.ok(links.includes(`${page}05-project-memory.md#worked-example`), links.join(' '));
  // The bottom rung, on Windows, shows the Windows line.
  d.send({ type: 'check', lesson: 'b-2', items: [{ index: 0, text: 'x', pass: false, hint: 'No file yet.' }], path: '.practice/b-2-before.txt', stamp: '' });
  d.key('r');
  d.send({ type: 'check', lesson: 'b-2', items: [{ index: 0, text: 'x', pass: false, hint: 'No file yet.' }], path: '.practice/b-2-before.txt', stamp: '' });
  for (let i = 0; i < 4 && !d.state.beat.confirm; i++) d.send({ type: 'key', name: 'h', ch: 'h', wait: 3_000 }), d.send({ type: 'flush', wait: 400 });
  d.key('y');
  assert.match(strip(draw({ win32: true, unicode: true })), /Set-Content a\.txt x/);
  assert.doesNotMatch(strip(draw({ win32: true, unicode: true })), /printf x > a\.txt/);
  assert.match(strip(draw({})), /printf x > a\.txt/);
  // A slow item says to press r.
  const slow = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'C', beat: 0, levels: ['hinted', 'challenge'] } } } });
  slow.key('enter');
  slow.send({ type: 'check', lesson: 'b-1', items: [{ index: 0, text: 'x', pass: false, slow: true, hint: '' }] });
  assert.match(strip(render(slow.state, { cols: 100, rows: 40 }, theme(CAPS.full)).join('\n')), /takes a while, so it runs only when you ask: press r/);
});


// Every lesson after the first, on the path and with every lesson before it
// skipped, so the steps that drop to GUIDED show their bottom lines too.
for (const skipped of [false, true]) test(`every lesson in the app${skipped ? ', with nothing done before it' : ''}: every beat fits the window, and nothing is cut at 80x24 or larger`, async () => {
  const { lessonScreens, course } = await import('./learn-drive.mjs');
  const ids = course.filter((l) => l.content && l.id !== 'b-1').map((l) => l.id);
  // Only letters and digits, so the box's edges, a wrap and ASCII stand-ins
  // don't count as a cut.
  const flat = (text) => text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[^A-Za-z0-9]/g, '');
  const cut = [];
  for (const id of ids) {
    const all = lessonScreens(id, course, { skipped });
    assert.ok(all.length > 10, `${id}: ${all.length} screens`);
    for (const [capName, caps] of Object.entries(CAPS)) {
      const t = theme(caps);
      for (const [cols, rows] of SIZES) {
        for (const [label, state] of all) {
          const lines = render(state, { cols, rows }, t);
          const where = `${label} at ${cols}x${rows} (${capName})`;
          assert.equal(lines.length, rows, where);
          for (const line of lines) assert.ok(width(line) <= cols - 1, `${where}: ${strip(line)}`);
          // The first quote behind h shows whole, even in a small window.
          const rung = /hint 1$/.test(label) && rungsOf(state)[state.beat.rung];
          if (rung?.kind === 'quote' && cols <= 80 && !flat(lines.map(strip).join('')).includes(flat(rung.text))) cut.push(where);
          if (cols >= 80 && (capName === 'full' || capName === 'ascii')) {
            const plain = lines.map(strip);
            const end = t.unicode ? '…' : '.';
            assert.ok(!plain.some((l) => l.endsWith(end) && width(l) === cols - 1 && (t.unicode || /\S\.$/.test(l))), `${where} cuts a line:\n${plain.filter((l) => width(l) === cols - 1).join('\n')}`);
          }
        }
      }
    }
  }
  assert.deepEqual(cut, [], 'a first rung is cut');
});

test('real-run fixes: prompts wrap at spaces, a short list stays in "not yet", a safety guess wraps cleanly', async () => {
  const { diagnosis } = await import('../../learn/lib/render.mjs');
  // The first clause of a FAIL message, with a list of names kept.
  assert.equal(diagnosis("These new files don't start with `// linkcheck source.`: src/stats.js. Check that the rule is committed."), "These new files don't start with `// linkcheck source.`: src/stats.js.");
  assert.equal(diagnosis('Changed but not in the plan: src/a.js, test/b.js. Compare the plan.'), 'Changed but not in the plan: src/a.js, test/b.js.');
  assert.equal(diagnosis('No `.practice/version.txt` yet: run `claude --version > .practice/version.txt` in /x, the folder.'), 'No `.practice/version.txt` yet');
  // A long prompt keeps its words whole.
  const { courseWith, DEMO_B2 } = await import('./learn-drive.mjs');
  const prompt = 'Add src/external.js with a function countExternal(markdown) that returns how many of the links findLinks finds are external, according to isExternal.';
  const text = DEMO_B2.replace('- run: "git status --porcelain > .practice/b-2-before.txt"', `- run: "${prompt}"`);
  const d = driver({ course: courseWith({ 'b-2': text }), saved: { format: 1, welcomed: true, lessons: { 'b-1': finished(allCourse.find((l) => l.id === 'b-1')), 'b-2': { warm: [], step: 'W1', beat: 0 } } } });
  d.key('enter');
  for (const cols of [60, 80]) {
    const plain = render(d.state, { cols, rows: 30 }, theme(CAPS.full)).map(strip).join('\n');
    for (const word of prompt.split(' ')) assert.ok(plain.includes(word), `${cols} cols: "${word}" is split`);
  }
});

test('real-run fixes: a done git step ticks no command, and "Still stuck?" only where nothing explains', () => {
  const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W7', beat: 2, levels: [] } } } });
  d.key('enter');
  d.send({ type: 'git', paths: [] });
  const plain = render(d.state, { cols: 80, rows: 30 }, theme(CAPS.full)).map(strip).join('\n');
  assert.match(plain, /\$ git status\s+\n/, 'no tick beside git status');
});

test('h at CHALLENGE: the toast names the try and fits; the level-up says to try first', async () => {
  const { C } = await import('../../learn/lib/copy.mjs');
  assert.equal(C.hintsLater('r'), 'Try it first: press r to check, then h works.');
  assert.equal(C.hintsLater('pick'), 'Try it first: pick an answer, then h works.');
  assert.deepEqual(C.toChallenge, ['From memory now: just the goal.', 'Try it first, then press h if you need a hint.']);
  const t = theme(CAPS.full);
  const flat = (lines) => lines.map((l) => strip(l).trim()).join(' ').replace(/\s+/g, ' ');
  const level = screens.find(([l]) => l === 'level up challenge')[1];
  for (const via of ['r', 'pick']) {
    const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'Y4', beat: 0, levels: ['hinted', 'challenge'] } } } });
    d.key('enter');
    d.key('h');
    const state = { ...d.state, toast: { ...d.state.toast, try: via } };
    for (const [cols, rows] of [[60, 20], [80, 24]]) {
      const lines = render(state, { cols, rows }, t);
      assert.equal(lines.length, rows);
      for (const l of lines) assert.ok(width(l) <= cols - 1, `${cols}x${rows}: ${strip(l)}`);
      assert.ok(flat(lines).includes(C.hintsLater(via)), `the whole toast shows at ${cols}x${rows}`);
      assert.ok(flat(render(level, { cols, rows }, t)).includes(C.toChallenge[1]), `the level-up line shows at ${cols}x${rows}`);
    }
  }
});

test('both level-ups show "g more help" in the key bar, at 60x20 and 80x24', () => {
  const t = theme(CAPS.full);
  const bars = { 'level up hinted': "enter let's go g more help q quit", 'level up challenge': 'enter bring it on g more help q quit' };
  for (const [label, bar] of Object.entries(bars)) {
    const state = screens.find(([l]) => l === label)[1];
    for (const [cols, rows] of [[60, 20], [80, 24]]) {
      const lines = render(state, { cols, rows }, t);
      assert.equal(strip(lines.at(-1)).trim().replace(/\s+/g, ' '), bar, `${label} at ${cols}x${rows}`);
      assert.ok(!lines.some((l) => strip(l).includes('keep it guided')));
    }
  }
});

test('the Check\'s level-up shows no "g more help": g has nothing to give there', () => {
  const t = theme(CAPS.full);
  const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W7', beat: 2, done: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'] } } } });
  d.key('enter');
  d.send({ type: 'git', paths: [] });
  d.key('enter');
  d.key('g');
  playUntil(d, (s) => s.view === 'levelup');
  assert.equal(stepOf(d.state).id, 'C');
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    const lines = render(d.state, { cols, rows }, t);
    assert.equal(lines.length, rows);
    assert.equal(strip(lines.at(-1)).trim().replace(/\s+/g, ' '), 'enter bring it on q quit', `${cols}x${rows}`);
  }
});

test('h at CHALLENGE: nothing sits in front of h during the 2 second lock', () => {
  const t = theme(CAPS.full);
  const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-capstone': { step: 'T5', beat: 0, warm: [] } } }, course: allCourse });
  d.key('enter');
  d.key('h');
  assert.equal(d.state.beat.rung, 0);
  assert.ok(d.now < d.state.beat.lockUntil, 'still inside the lock');
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    const inLock = render(d.state, { cols, rows }, t);
    // The same screen once the lock is over: no countdown, fill or faint key.
    assert.deepEqual(render({ ...d.state, now: d.state.beat.lockUntil + 1 }, { cols, rows }, t), inLock);
  }
  const before = render(d.state, { cols: 80, rows: 24 }, t);
  d.send({ type: 'key', name: 'h', ch: 'h', wait: 100 });
  d.send({ type: 'flush', wait: 400 });
  assert.ok(d.now < d.state.beat.lockUntil);
  assert.equal(d.state.beat.rung, 0, 'h inside the lock opens nothing');
  assert.deepEqual(render(d.state, { cols: 80, rows: 24 }, t), before);
});

test('h at CHALLENGE: a done-label git beat offers r, the try the toast names', () => {
  const t = theme(CAPS.full);
  const d = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'Y4', beat: 0, levels: ['hinted', 'challenge'] } } } });
  d.key('enter');
  d.send({ type: 'git', paths: ['notes.md'] });
  d.key('h');
  const bar = (state, cols, rows) => strip(render(state, { cols, rows }, t).at(-1));
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    assert.match(bar(d.state, cols, rows), /space .* r check now .*q quit/, `${cols}x${rows}`);
  }
  d.key('r');
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    const b = bar(d.state, cols, rows);
    assert.match(b, /h hint/, `${cols}x${rows}: h replaces r once tried`);
    assert.doesNotMatch(b, / r /);
  }
});

// The end of the last lesson a play in order from lesson `from` reaches: a
// play stops there.
const atTheEnd = (from) => (s) => s.lesson === lastInOrder(allCourse, from) && s.view === 'complete';
// The folder of each lesson that runs in a new copy of the template (a-5,
// a-capstone), as the learner gives it at its intro: a play that goes on to
// the last lesson needs them, since the path passes over such a lesson until
// its folder is saved.
const NEW_COPY = '/home/sam/claude-capstone';
const newCopies = () => Object.fromEntries(allCourse.filter((l) => l.newCopy).map((l) => [l.id, NEW_COPY]));
// The save of a play of lesson `id` from its start: its new copy's folder,
// where it runs in one.
const ownCopy = (id) => (allCourse.find((l) => l.id === id)?.newCopy ? { folders: { [id]: NEW_COPY } } : {});

// Every step a real bottom rung eases, in a real play from that rung on, with
// and without less help: the "more help" line wraps whole, even where a 60x20
// card is taller than the window (b-2 Y3 under less help, a Check card after a
// FAIL, most steps with a hint box open): the row budget never drops it.
// Renders the eased step on screen at 60x20 and 80x24 in every colour mode;
// `whole` collects the places where the line shows whole at 60x20.
function easedLineWhole(d, where, whole) {
  const flat = (text) => text.replace(/[^A-Za-z0-9]/g, '');
  for (const [capName, caps] of Object.entries(CAPS)) {
    for (const [cols, rows] of [[60, 20], [80, 24]]) {
      const lines = render(d.state, { cols, rows }, theme(caps)).map(strip);
      const at = `${where} at ${cols}x${rows} (${capName})`;
      const dropped = lines.some((l) => ['…', '...'].includes(l.trim()));
      assert.ok(!dropped || cols === 60, `${at} drops lines`);
      assert.ok(flat(lines.join('')).includes(flat(C.eased)), `${at}: ${lines.join('\n')}`);
      assert.ok(!lines.some((l) => /(…|\.\.\.)$/.test(l) && width(l) === cols - 1), `${at} cuts a line`);
      if (cols === 60) whole.add(where);
    }
  }
}

test('an eased step: the "more help" line wraps whole, even at 60x20', () => {
  assert.match(C.eased, /you needed help with it last time\.$/);
  const whole = new Set();
  const check = (d, where) => easedLineWhole(d, where, whole);
  const landed = new Set();
  for (const lesson of allCourse) {
    if (!lesson.content) continue;
    const before = finishedBefore(lesson.id);
    for (const step of lesson.content.steps) {
      step.beats.forEach((_, beat) => {
        for (const lessHelp of [false, true]) {
          const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { ...before, [lesson.id]: { step: step.id, beat, warm: [], lessHelp } }, folders: newCopies() } });
          d.key('enter');
          bottomRung(d);
          if (!d.state.eased.length) continue;
          playUntil(d, (s) => s.beat?.eased || atTheEnd(lesson.id)(s));
          if (d.state.view !== 'step') continue;
          const where = `${d.state.lesson} ${stepOf(d.state).id}${lessHelp ? ' (less help)' : ''}`;
          if (landed.has(where)) continue;
          landed.add(where);
          check(d, where);
          failCheck(d);
          check(d, `${where} after a FAIL`);
          d.send({ type: 'tick', wait: IDLE_MS + 1_000 });
          check(d, `${where} after two quiet minutes`);
          if (!hintAvailable(d.state)) continue;
          d.key('h');
          d.send({ type: 'tick', wait: 3_000 });
          d.key('h');
          check(d, `${where} with a hint open`);
        }
      });
    }
  }
  // At 60x20 the line is whole on every one of these, the cases cut before
  // the row budget too: a hint box open on a tall card, and a Check after a FAIL.
  for (const where of ['b-1 Y1', 'b-2 C', 'b-3 Y2', 'b-4 Y3', 'b-5 Y1', 'b-5 W5 (less help)', 'b-capstone T6',
    'b-1 Y1 with a hint open', 'b-2 C after a FAIL', 'b-3 C after a FAIL']) assert.ok(whole.has(where), where);
});

// Every warm-up missed (shown with s, or an empty answer), in a real play from
// there: where its ease lands, the line is whole as the step opens.
test('a missed warm-up: the "more help" line wraps whole where its ease lands', () => {
  const whole = new Set();
  for (const lesson of allCourse) {
    if (!lesson.content) continue;
    const before = finishedBefore(lesson.id);
    for (const w of lesson.content.warmup) {
      const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { ...before, [lesson.id]: { step: w.id, beat: 0, warm: [w.id] } }, folders: newCopies() } });
      d.key('enter');
      d.key(beatOf(d.state).kind === 'type' ? 'enter' : 's');
      assert.equal(d.state.beat.revealed, true, `${lesson.id} ${w.id}`);
      assert.ok(d.state.eased.includes(w.skill), `${lesson.id} ${w.id} eases ${w.skill}`);
      playUntil(d, (s) => s.beat?.eased || atTheEnd(lesson.id)(s));
      if (d.state.view !== 'step') continue;
      easedLineWhole(d, `${d.state.lesson} ${stepOf(d.state).id} from ${lesson.id} ${w.id}`, whole);
    }
  }
  // In b-2, b-3 and b-5 the ease lands on the same lesson's W1, whole at 60x20.
  for (const where of ['b-2 W1 from b-2 R1', 'b-3 W1 from b-3 R1', 'b-5 W1 from b-5 R1']) assert.ok(whole.has(where), where);
});

// Fading counts only what this learner did.
const lessonById = (id) => allCourse.find((l) => l.id === id);
const plainAt = (d, cols, rows) => render(d.state, { cols, rows }, theme(CAPS.full)).map(strip).join('\n');

test('fading counts only what this learner did: a skipped skill opens GUIDED with its exact command on the card', () => {
  // The seeded b-5 run: b-1 to b-4 complete, with no step done.
  const skipped = Object.fromEntries(['b-1', 'b-2', 'b-3', 'b-4'].map((id) => [id, { complete: true, done: [] }]));
  const cmd = 'git rev-parse HEAD > .practice/b-5-commit.txt';
  const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { ...skipped, 'b-5': { step: 'W7', beat: 1, warm: [] } } } });
  d.key('enter');
  assert.equal(tierOf(d.state), 'guided');
  for (const [cols, rows] of [[60, 20], [80, 24]]) assert.ok(plainAt(d, cols, rows).includes(cmd), `${cols}x${rows}`);
  // On the path W7 is HINTED: the command waits behind h.
  const path = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore('b-5'), 'b-5': { step: 'W7', beat: 1, warm: [] } } } });
  path.key('enter');
  assert.equal(tierOf(path.state), 'hinted');
  assert.ok(!plainAt(path, 80, 24).includes(cmd));
});

test('fading counts only what this learner did: "done each part before" only after a finished step on every part', async () => {
  const { courseWith, DEMO_B2 } = await import('./learn-drive.mjs');
  assert.equal(C.noCommands, 'No commands this time.');
  assert.equal(C.doneEachPart, "You've done each part before.");
  const flat = (text) => text.replace(/\s+/g, ' ');
  const t2 = lessonById('b-capstone').content.steps.find((x) => x.id === 'T2');
  const beat = t2.beats.findIndex((b) => b.kind !== 'predict');
  const open = (lessons) => {
    const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { ...lessons, 'b-capstone': { step: 'T2', beat, warm: [] } } } });
    d.key('enter');
    assert.equal(tierOf(d.state), 'challenge', 'the capstone never drops to GUIDED');
    return d;
  };
  const none = open({});
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    const text = flat(plainAt(none, cols, rows));
    assert.ok(text.includes(C.noCommands), `${cols}x${rows}`);
    assert.ok(!text.includes(C.doneEachPart), `${cols}x${rows}: no history, so no "done before"`);
  }
  // A capstone step draws on every lesson before it: a finished step on its
  // own skill alone is not each part.
  const some = open({ 'b-2': { complete: true, done: ['W2'] } });
  assert.equal(lessonById('b-2').content.steps.find((x) => x.id === 'W2').skill, t2.skill);
  for (const [cols, rows] of [[60, 20], [80, 24]]) assert.ok(!flat(plainAt(some, cols, rows)).includes(C.doneEachPart), `${cols}x${rows}`);
  const did = open(finishedBefore('b-capstone'));
  for (const [cols, rows] of [[60, 20], [80, 24]]) assert.ok(plainAt(did, cols, rows).includes(`${C.noCommands} ${C.doneEachPart}`), `${cols}x${rows}`);
  // T1 saves the version (b-1), but also commits a CLAUDE.md (b-5): a learner
  // who did only b-1 hasn't done each part.
  const b1 = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { 'b-1': finished(lessonById('b-1')), 'b-capstone': { step: 'T1', beat: 0, warm: [] } } } });
  b1.key('enter');
  assert.equal(stepOf(b1.state).skill, 'save-version');
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    const text = flat(plainAt(b1, cols, rows));
    assert.ok(text.includes(C.noCommands) && !text.includes(C.doneEachPart), `${cols}x${rows}`);
  }
  // A harder step's line, too: a skill put on the plan by a warm-up, with no
  // step finished on it, gets no "You've done this before".
  const text = DEMO_B2.replace(/## steps[\s\S]*$/, ['## steps', '',
    '### W1 | Worked example step 1 of 3 | New', '- tier: guided', '- skill: brand-new', '- where: claude', '- beat: do', '- verify: self', '- goal: "Do it."', '',
    '### W2 | Worked example step 2 of 3 | Old', '- tier: hinted', '- skill: status', '- where: claude', '- beat: do', '- verify: self', '- goal: "Do it."', '',
    '### W3 | Worked example step 3 of 3 | New again', '- tier: guided', '- skill: other-new', '- where: claude', '- beat: do', '- verify: self', '- goal: "Do it."', '',
    '### C | Check | Check', '- tier: challenge', '- skill: check', '- where: terminal', '- beat: do', '- verify: self', '- goal: "Do it."', ''].join('\n'));
  const saw = courseWith({ 'b-2': text });
  const atW2 = (b1, recalled) => {
    const d = driver({ course: saw, saved: { format: 1, welcomed: true, lessons: { 'b-1': b1, 'b-2': { warm: [], recalled, step: 'W2', beat: 0 } } } });
    d.key('enter');
    assert.equal(stepNote(d.state), 'hinted');
    return flat(plainAt(d, 80, 24));
  };
  assert.match(atW2(finished(lessonById('b-1')), []), /You've done this before/);
  assert.doesNotMatch(atW2({ complete: true, done: [] }, ['R1']), /You've done this before/, 'R1 (status) was recalled, but no status step was finished');
});

test('fading counts only what this learner did: a replay\'s intro shows the help the play starts with', () => {
  // b-1 done, b-2 skipped, b-3 finished with R1 and R2 recalled: the enter
  // clears the recalls, so the intro already leaves them out.
  const b3 = lessonById('b-3');
  const replay = (recalled) => {
    const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { 'b-1': finished(lessonById('b-1')), 'b-3': { ...finished(b3), recalled } } } });
    if (d.state.view !== 'map') d.key('m');
    while (d.state.mapCursor !== allCourse.indexOf(b3)) d.key('down');
    d.key('enter');
    assert.equal(d.state.view, 'intro');
    return d;
  };
  const old = replay(['R1', 'R2']);
  const clean = replay([]);
  for (const [cols, rows] of [[60, 20], [80, 24]]) assert.equal(plainAt(old, cols, rows), plainAt(clean, cols, rows), `${cols}x${rows}`);
  // And the play then starts at the tiers the intro drew.
  old.key('enter');
  clean.key('enter');
  assert.equal(tierOf(old.state), tierOf(clean.state));
  assert.equal(old.state.progress['b-3'].warm.join(), clean.state.progress['b-3'].warm.join());
});

// Words that claim only what the app saw.
test('the next screen counts the questions in the steps this learner finished', () => {
  const b4 = lessonById('b-4');
  const questions = (steps) => steps.flatMap((st) => st.beats).filter((b) => b.ask && b.kind !== 'predict').length;
  const count = (d, cols, rows) => plainAt(d, cols, rows).match(/(\d+) questions? answered/)?.[1];
  // A full play: every question in the play, its warm-up too (exit was
  // missed before, so R2 plays: 194).
  const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, missed: ['exit'], lessons: finishedBefore('b-4') } });
  playUntil(d, (s) => s.view === 'next' && s.lesson === 'b-4');
  const p = d.state.progress['b-4'];
  const played = [...p.warm.map((id) => b4.content.warmup.find((w) => w.id === id)), ...b4.content.steps];
  assert.ok(played.every((st) => p.done.includes(st.id)));
  assert.equal(p.warm.length, 1);
  assert.equal(questions(played), 8, 'every question beat in the play');
  for (const [cols, rows] of [[60, 20], [80, 24]]) assert.equal(count(d, cols, rows), '8', `${cols}x${rows}`);
  // The same play marked complete with no step done: the app saw no answer.
  const at = (done) => ({ state: { ...d.state, progress: { ...d.state.progress, 'b-4': { ...p, done } } } });
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    assert.ok(!plainAt(at([]), cols, rows).includes('8 questions answered'), `${cols}x${rows}`);
    assert.equal(count(at([]), cols, rows), '0', `${cols}x${rows}`);
  }
  // Part of it: only the steps done count.
  const some = played.slice(0, 5);
  assert.ok(questions(some) > 0 && questions(some) < 8);
  assert.equal(count(at(some.map((x) => x.id)), 80, 24), String(questions(some)));
});

// The capstone handover line (Q11): it reports the unaided result, and only
// when that play showed no exact command.
const HANDOVER = 'You did every task without the exact command.';
const playedTo = (id, saved = finishedBefore(id)) => {
  const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: saved } });
  // A lesson finished already: the app opens on a later one, or on the map.
  if (d.state.view !== 'map' && d.state.lesson !== id) d.key('m');
  if (d.state.view === 'map') mapTo(d, id);
  playUntil(d, (s) => s.view === 'next' && s.lesson === id);
  return d;
};
// A capstone play resumed after its exact command showed at T2.
const helpedCapstone = () => playedTo('b-capstone', { ...finishedBefore('b-capstone'), 'b-capstone': { step: 'T6', beat: 0, warm: [], done: ['T1', 'T2', 'T3', 'T4', 'T5'], bottomAt: 'T2' } });

test('the capstone\'s next screen says "You did every task without the exact command." under the check summary', () => {
  const d = playedTo('b-capstone');
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    const lines = plainAt(d, cols, rows).split('\n');
    const at = lines.findIndex((l) => l.includes("The lesson's check passes: 7 of 7 items"));
    assert.ok(at > 0, `${cols}x${rows}: no check summary`);
    assert.equal(lines[at + 1].trim(), HANDOVER, `${cols}x${rows}`);
  }
});

test('the capstone handover line hides after a bottom rung anywhere in the capstone, a break included', () => {
  const cap = lessonById('b-capstone');
  const before = finishedBefore('b-capstone');
  const hidden = new Set();
  for (const step of cap.content.steps) {
    step.beats.forEach((_, beat) => {
      const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { ...before, 'b-capstone': { step: step.id, beat, warm: [] } } } });
      d.key('enter');
      // Where h waits for a try that can't come here, two quiet minutes open it.
      if (!hintAvailable(d.state)) d.send({ type: 'tick', wait: IDLE_MS + 1_000 });
      bottomRung(d);
      if (d.state.progress['b-capstone'].bottomAt !== step.id) return;
      playUntil(d, (s) => s.view === 'next' && s.lesson === 'b-capstone');
      for (const [cols, rows] of [[60, 20], [80, 24]]) assert.ok(!plainAt(d, cols, rows).includes(HANDOVER), `${step.id}.${beat} at ${cols}x${rows}`);
      hidden.add(step.id);
    });
  }
  // The capstone's exact commands on a first FAIL: T4's and T6's bottom
  // lines, and the tests item's on T5's check.
  assert.deepEqual([...hidden], ['T4', 'T5', 'T6']);
  // The Check reaches the tests item's bottom line when only that item fails.
  const c = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { ...before, 'b-capstone': { step: 'C', beat: 0, warm: [], done: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'] } } } });
  c.key('enter');
  const items = cap.items.map((text, index) => ({ index, text, pass: text !== 'the tests pass', hint: text === 'the tests pass' ? '`npm test` fails. Run it, read the first failure, and ask Claude to fix the code, not the test.' : '' }));
  c.send({ type: 'check', lesson: 'b-capstone', items });
  c.key('r');
  c.send({ type: 'check', lesson: 'b-capstone', items, asked: c.state.beat.asked });
  for (let i = 0; i < 8 && !c.state.beat.confirm; i++) c.key('h');
  c.key('y');
  assert.equal(c.state.progress['b-capstone'].bottomAt, 'C');
  playUntil(c, (s) => s.view === 'next' && s.lesson === 'b-capstone');
  for (const [cols, rows] of [[60, 20], [80, 24]]) assert.ok(!plainAt(c, cols, rows).includes(HANDOVER), `C at ${cols}x${rows}`);
  // A bottom rung saved before a break still counts for this play.
  const resumed = helpedCapstone();
  assert.ok(!plainAt(resumed, 80, 24).includes(HANDOVER));
  // The intro's enter starts a new play: a replay with no exact command shows it.
  const replay = playedTo('b-capstone', { ...before, 'b-capstone': { ...finished(cap), bottomAt: 'T2' } });
  assert.ok(plainAt(replay, 80, 24).includes(HANDOVER));
});

test('the capstone handover line never shows on b-1 to b-5, even with no exact command shown', () => {
  assert.ok(plainAt(playedTo('b-capstone'), 80, 24).includes(HANDOVER));
  for (const id of ['b-1', 'b-2', 'b-3', 'b-4', 'b-5']) {
    const d = playedTo(id);
    assert.equal(d.state.progress[id].bottomAt, null, id);
    for (const [cols, rows] of [[60, 20], [80, 24]]) assert.ok(!plainAt(d, cols, rows).includes(HANDOVER), `${id} at ${cols}x${rows}`);
  }
});

// The line can't see a hint, so a hint never holds the command that saves a
// file for the check: that command is the beat's bottom rung, and the y/n
// before it sets bottomAt.
test('no capstone hint holds a command that saves a file for the check', () => {
  const { steps, ladder } = lessonById('b-capstone').content;
  const hints = [...steps.flatMap((step) => step.beats.flatMap((b) => b.hints)), ...ladder.flatMap((l) => l.hints)];
  const saves = hints.filter((h) => [...h.matchAll(/`([^`]+)`/g)].some(([, code]) => /\s>\s*\.practice\//.test(code)));
  assert.deepEqual(saves, []);
  assert.ok(steps.some((step) => step.beats.some((b) => b.bottom.some((x) => x.text === 'git rev-parse HEAD > .practice/capstone-commit.txt'))));
});

test('the capstone handover line is a plain row: no art of its own, whole in every mode and size, a toast included', () => {
  const shown = playedTo('b-capstone').state;
  const toasted = { ...shown, toast: { kind: 'save', message: 'EACCES: permission denied, open /home/sam/claude-code-practice/.practice/learn.json' } };
  for (const [capName, caps] of Object.entries(CAPS)) {
    const t = theme(caps);
    for (const [cols, rows] of SIZES) {
      for (const [label, state] of [['next', shown], ['next with a toast', toasted]]) {
        const lines = render(state, { cols, rows }, t);
        const where = `${label} at ${cols}x${rows} (${capName})`;
        assert.equal(lines.length, rows, where);
        for (const line of lines) assert.ok(width(line) <= cols - 1, `${where}: ${strip(line)}`);
        const row = lines.map(strip).find((l) => l.includes(HANDOVER));
        assert.ok(row, `${where}: no handover line`);
        assert.equal(row.trim(), HANDOVER, `${where}: ${row}`);
      }
    }
  }
});

// A celebration depends on the event, never on the help: the capstone with
// the exact command on T4's check celebrates as the play without it.
test('the capstone celebrates the same with or without the exact command: step done, complete and next', () => {
  const play = (bottom) => {
    const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: finishedBefore('b-capstone') } });
    const seen = {};
    while (!(d.state.view === 'next' && d.state.lesson === 'b-capstone')) {
      const s = d.state;
      if (bottom && s.view === 'step' && stepOf(s).id === 'T4' && s.pos.beat === 2 && !s.progress['b-capstone'].bottomAt) bottomRung(d);
      const done = d.state.view === 'step' && ['done', 'already'].includes(d.state.beat.status);
      if (done || d.state.view === 'complete') {
        const where = done ? `${stepOf(d.state).id}.${d.state.pos.beat}` : 'complete';
        seen[where] = [[60, 20], [80, 24]].map(([cols, rows]) => plainAt(d, cols, rows)).join('\n');
      }
      playUntil(d, (x) => x !== s);
    }
    seen.next = [[60, 20], [80, 24]].map(([cols, rows]) => plainAt(d, cols, rows)).join('\n');
    return [d.state.progress['b-capstone'].bottomAt, seen];
  };
  const [none, plain] = play(false);
  const [used, helped] = play(true);
  assert.equal(none, null);
  assert.equal(used, 'T4');
  for (const where of ['T1.4', 'T2.2', 'T3.2', 'T4.2', 'T5.2', 'T6.2', 'complete']) assert.ok(plain[where], `no ${where} done screen`);
  assert.deepEqual(Object.keys(helped), Object.keys(plain));
  for (const where of Object.keys(plain).filter((k) => k !== 'next')) assert.equal(helped[where], plain[where], where);
  // The next screen differs only by the handover line (and the blank row
  // that fills in below).
  const lines = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean);
  assert.ok(lines(plain.next).includes(HANDOVER));
  assert.ok(!lines(helped.next).includes(HANDOVER));
  assert.deepEqual(lines(plain.next).filter((l) => l !== HANDOVER), lines(helped.next));
});

// The invitation at the capstone (153, D9 (b)): one fact-free line on each
// level's capstone next screen, under the handover line.
const INVITE = 'Questions about anything in this level? Ask in your other terminal, then compare the answer with the lesson pages.';
// The rows from `at` on that read as the invitation, wrapped, or null.
const inviteFrom = (lines, at) => {
  for (let k = at, text = ''; k < lines.length && text.length < INVITE.length; k++) {
    text = `${text} ${lines[k].trim()}`.trim();
    if (text === INVITE) return { from: at, to: k };
  }
  return null;
};

test('the capstone\'s next screen invites questions under the handover line, whole, at 60x20 and 80x24', () => {
  const d = playedTo('b-capstone');
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    const lines = plainAt(d, cols, rows).split('\n');
    const at = lines.findIndex((l) => l.trim() === HANDOVER);
    assert.ok(at > 0, `${cols}x${rows}: no handover line`);
    assert.ok(inviteFrom(lines, at + 1), `${cols}x${rows}: no invitation under the handover line\n${lines.join('\n')}`);
  }
  // Below 24 rows a body over its room compacts every repeat first (142), as
  // on the capstone intro: at 60x20 the one-tier climb loses its tier words,
  // which frees no row. 80x24 keeps them.
  const climb = (cols, rows) => plainAt(d, cols, rows).split('\n').filter((l) => l.includes('CHALLENGE')).map((l) => l.trim());
  assert.deepEqual(climb(60, 20), ['★★★★★★★    CHALLENGE ★★★']);
  assert.deepEqual(climb(80, 24), ['★★★★★★★    CHALLENGE ★★★    just the goal']);
});

test('the invitation shows after an exact command too, under the check summary in the handover line\'s place', () => {
  const d = helpedCapstone();
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    const lines = plainAt(d, cols, rows).split('\n');
    assert.ok(!lines.some((l) => l.includes(HANDOVER)), `${cols}x${rows}`);
    const at = lines.findIndex((l) => l.includes("The lesson's check passes: 7 of 7 items"));
    assert.ok(at > 0, `${cols}x${rows}: no check summary`);
    assert.ok(inviteFrom(lines, at + 1), `${cols}x${rows}: no invitation under the check summary\n${lines.join('\n')}`);
    // Indented as the handover line is: under the summary's words.
    assert.equal(lines[at + 1].search(/\S/), width(lines[at].slice(0, lines[at].indexOf('The lesson'))), `${cols}x${rows}`);
  }
});

test('the invitation shows on the capstone\'s next screen only: no other screen of any lesson, and no overlay over it', async () => {
  const t = theme(CAPS.full);
  const over = ['p', 'c', 'space', '?', 'm'].map((k) => {
    const d = playedTo('b-capstone');
    d.key(k);
    return [`b-capstone next, then ${k}`, d.state];
  });
  assert.deepEqual(over.map(([, s]) => s.overlay ?? s.view), ['page', 'card', 'compare', 'help', 'map']);
  const all = [...await everyScreen(), ...endScreens(), ...over];
  const shows = all.filter(([, state]) => flatText(render(state, { cols: 100, rows: 40 }, t).map(strip).join('')).includes(flatText(INVITE)));
  assert.deepEqual(shows.map(([label]) => label), ['b-capstone next', 'i-capstone next']);
});

test('each level\'s capstone gets the invitation: an Intermediate capstone\'s next screen shows it, and its lessons\' do not', () => {
  // The Beginner plays, renamed into a later level: a capstone with a lesson
  // after it, which i-capstone has none of until a-1 has a lesson file.
  const as = (state, id, next) => ({
    ...state,
    lesson: id,
    course: state.course.map((l) => (l.id === state.lesson ? { ...l, id, content: { ...l.content, next } } : l)),
    progress: { ...state.progress, [id]: state.progress[state.lesson] },
    checks: { ...state.checks, [id]: state.checks[state.lesson] },
  });
  const cap = as(playedTo('b-capstone').state, 'i-capstone');
  // A capstone before the last level's has a lesson after it: its Next up
  // rows take room too. b-1 stands in for the next level's first lesson.
  const onward = as(playedTo('b-capstone').state, 'i-capstone', 'b-1');
  const lesson = as(playedTo('b-5').state, 'i-5', 'b-capstone');
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    for (const [label, state] of [['last', cap], ['with a next lesson', onward]]) {
      const lines = render(state, { cols, rows }, theme(CAPS.full)).map(strip);
      const where = `${label} at ${cols}x${rows}\n${lines.join('\n')}`;
      assert.equal(lines.length, rows, where);
      assert.equal(lines.some((l) => l.includes(C.nextUp)), label !== 'last', where);
      const at = lines.findIndex((l) => l.trim() === HANDOVER);
      assert.ok(at > 0, `no handover line: ${where}`);
      assert.ok(inviteFrom(lines, at + 1), `no invitation: ${where}`);
      assert.ok(!lines.some((l) => l.trim() === '…'), `a teaching line is cut: ${where}`);
    }
    const other = render(lesson, { cols, rows }, theme(CAPS.full)).map(strip);
    assert.ok(!flatText(other.join('')).includes(flatText(INVITE).slice(0, 30)), `i-5 at ${cols}x${rows}\n${other.join('\n')}`);
  }
});

test('the invitation gives way whole before any teaching line is cut, and never before the handover line', () => {
  const shown = playedTo('b-capstone').state;
  const hidden = helpedCapstone().state;
  let dropped = 0;
  let renders = 0;
  for (const [capName, caps] of Object.entries(CAPS)) {
    const t = theme(caps);
    for (const [cols, rows] of SHORT) {
      // Up to an 8-row toast at 60 columns: there BC's Next up row (its next
      // is i-1) gives way too, and no teaching line is cut.
      for (let n = 0; n <= 8; n++) {
        const toast = n ? { kind: 'save', message: `EACCES: permission denied, open ${'/home/sam/claude-code-practice'.repeat(n)}/.practice/learn.json` } : null;
        for (const [label, state] of [['handover', shown], ['no handover', hidden]]) {
          const lines = render({ ...state, toast }, { cols, rows }, t).map(strip);
          const where = `${label}, toast ${n}, at ${cols}x${rows} (${capName})\n${lines.join('\n')}`;
          assert.equal(lines.length, rows, where);
          assert.ok(!lines.some((l) => l.trim() === '…' || l.trim() === '.'), `a teaching line is cut: ${where}`);
          const text = flatText(lines.join(''));
          for (const word of [C.checkedSummary(7, 7), C.yourClimb, C.savedBreak]) assert.ok(text.includes(flatText(word)), `"${word}": ${where}`);
          if (label === 'handover') assert.ok(lines.some((l) => l.trim() === HANDOVER), `no handover line: ${where}`);
          const at = lines.findIndex((l) => l.trim().startsWith(INVITE.slice(0, 20)));
          renders++;
          // With room, it shows whole.
          if (!toast) assert.ok(at >= 0, `no invitation with no toast: ${where}`);
          if (at < 0) dropped++;
          else assert.ok(inviteFrom(lines, at), `the invitation is cut: ${where}`);
          // The order today: the recall prompt goes first, then the
          // question count, then the invitation.
          const count = lines.some((l) => / answered$/.test(l.trim()));
          const recall = text.includes(flatText(C.recallAsk('BC')));
          if (count) assert.ok(at >= 0, `the invitation goes before the count: ${where}`);
          if (recall) assert.ok(count, `the count goes before the recall prompt: ${where}`);
        }
      }
    }
  }
  // A long enough toast takes it at 60x20, and only then.
  assert.ok(dropped > 0 && dropped < renders, `${dropped} of ${renders}`);
});

// The row budget (142): what gives way when a screen is taller than its window.
const SHORT = [[60, 20], [80, 24]];

test('a done beat hides its satisfied "Done when" line: W3 done at 60x20 is the 2.4 mockup', () => {
  const state = screens.find(([l]) => l === 'W3 done')[1];
  const lines = render(state, { cols: 60, rows: 20 }, theme(CAPS.full)).map((l) => strip(l).trimEnd());
  // energy-and-teaching.md 2.4, less Pip on the card's top border (a motion
  // ticket). The mockup was drawn when every spacer dropped at once; one at a
  // time from the bottom keeps the card's first spacer in its spare row.
  const mockup = [
    '   B1   Install, sign in and look around       GUIDED ★☆☆',
    '  ●━━●━━●━━○──○──○──○   ◇──◇──◇   ☆──☆        step 3 of 12',
    '  ━━━━━━━━━━━━━━──────────────────────────────────────────',
    '',
    null,
    '  │',
    '  │  Save the version',
    '  │  Go to your practice copy and save that output for the',
    '  │  check:',
    '  │   $ cd /home/sam/claude-code-practice               ✔',
    '  │   $ mkdir -p .practice                              ✔',
    '  │   $ claude --version > .practice/version.txt        ✔',
    '  │  ✦          ▄█▀   ·   Step 3 done!',
    '  │   ▀█▄    ▄█▀    ✦     .practice/version.txt',
    '  │  ·  ▀█▄█▀     ·       holds 2.1.285 (Claude Code)',
    '  │                       🔥 3 steps this session',
    '  ╰───────────────────────────────────────────────────────',
    '',
    null,
    '   enter  next    b back    w why    m map    q quit',
  ];
  mockup.forEach((row, i) => {
    // The pulse row is motion's.
    if (row === null) return;
    assert.equal(lines[i], row, `row ${i + 1}`);
  });
  assert.ok(!lines.some((l) => l.includes(C.doneWhen)));
});

test('every step-done screen keeps its 🔥 line and its bottom border at 60x20 and 80x24', async () => {
  const { lessonScreens, course } = await import('./learn-drive.mjs');
  const done = [...screens, ...course.filter((l) => l.content && l.id !== 'b-1').flatMap((l) => lessonScreens(l.id, course))]
    .filter(([, s]) => s.view === 'step' && s.beat.status === 'done' && s.pos.beat === stepOf(s).beats.length - 1 && ['check', 'file', 'git-clean'].includes(beatOf(s).verify.kind));
  assert.ok(done.length > 20, `${done.length} step-done screens`);
  for (const [capName, caps] of Object.entries(CAPS)) {
    const t = theme(caps);
    for (const [cols, rows] of SHORT) {
      for (const [label, state] of done) {
        const lines = render(state, { cols, rows }, t).map(strip);
        const where = `${label} at ${cols}x${rows} (${capName})`;
        const fire = lines.findIndex((l) => l.includes(`${t.lead('fire')}${C.session(state.session + 1)}`) || l.includes(`${t.lead('fire')}${C.session(state.session)}`));
        assert.ok(fire > 0, `${where}: no session line\n${lines.join('\n')}`);
        assert.equal(lines[fire + 1].trim()[0], t.glyph.bl, `${where}: the bottom border follows the session line\n${lines.join('\n')}`);
        // The evidence line replaces it; with no evidence line it is optional.
        const beat = beatOf(state);
        if (beat.evidence && state.beat.evidence && !beat.verify.all) assert.ok(!lines.some((l) => l.includes(C.doneWhen)), `${where} shows "Done when"`);
      }
    }
  }
});

// lessonScreens for every lesson, played through and then skipped, keeping
// the labels `keep` passes.
const lessonWalks = async (keep = () => true) => {
  const { lessonScreens, course } = await import('./learn-drive.mjs');
  return [false, true].flatMap((skipped) => course.filter((l) => l.content).flatMap((l) => lessonScreens(l.id, course, { skipped })
    .filter(([label]) => keep(label)).map(([label, s]) => [`${label}${skipped ? ' (skipped)' : ''}`, s])));
};
// Every screen of every lesson, as lessonScreens and lesson 1's walk reach
// them. Lesson 1's walk stands in for its lessonScreens, apart from its Check:
// the walk passes it first time, and lessonScreens also fails it.
const everyScreen = async () => [...screens, ...await lessonWalks((label) => !label.startsWith('b-1 ') || label.startsWith('b-1 C.'))];
const flatText = (text) => text.replace(/[^A-Za-z0-9]/g, '');
// The rows of the while-it-runs box (ticket 150): it draws the hint box's
// bar, but it is optional, giving way whole where the room runs out, and it
// grades nothing. Its barred rows run up to a hint the card shows below it.
// Indexes into `lines`.
const whileBoxRows = (lines, t) => {
  const rows = new Set();
  const bar = `${t.glyph.rail}  ${t.glyph.bar}`;
  const hint = (l) => l.includes(t.unicode ? '💡' : 'Hint:') || l.includes(t.unicode ? '▲' : '!');
  const at = lines.findIndex((l) => l.includes(`${t.glyph.bar} ${C.whileItRuns}`));
  for (let i = at; at >= 0 && i < lines.length && lines[i].includes(bar) && (i === at || !hint(lines[i])); i++) rows.add(i);
  return rows;
};

test('in a tall window nothing is cut and nothing stretches: the tallest screen at 80 columns fits the box, and the map, the check-only card, your card, the comparison and Pip\'s slot measure the box', async () => {
  const all = await everyScreen();
  for (const capName of ['full', 'ascii']) {
    const t = theme(CAPS[capName]);
    for (const [label, base] of all) {
      for (const state of [base, { ...base, toast: { kind: 'stray' } }]) {
        const where = `${label}${state.toast ? ' with a toast' : ''} (${capName})`;
        const lines = render(state, { cols: 120, rows: 60 }, t).map(strip);
        assert.ok(!lines.some((l) => l.trim() === t.glyph.ellipsis), `${where} drops lines at 120x60\n${lines.join('\n')}`);
        // The row over the gap above the rule is still padding: no screen in
        // a 120-column window needs every row of the box (the tallest without
        // a toast, i-5's W2.0 with its first hint for a learner who skipped
        // the lessons before it, takes 37, 2026-10-18).
        if (!state.toast) assert.equal(lines[49 - 3], '', `${where}: the box has no row to spare\n${lines.join('\n')}`);
      }
    }
    const tc = theme({ ...CAPS[capName], depth: 24 });
    for (const [label, state] of screens) {
      const at = (rows) => ({ cols: 120, rows });
      for (const rows of [60, 200]) {
        assert.equal(itemsMax(state, at(rows), t), itemsMax(state, at(40), t), `${label} at 120x${rows}: the check-only card's scroll`);
        assert.equal(cardMax(state, at(rows), t), cardMax(state, at(40), t), `${label} at 120x${rows}: your card's or the comparison's scroll`);
        assert.equal(pipSlot(state, at(rows), tc), pipSlot(state, at(40), tc), `${label} at 120x${rows}: Pip's slot`);
      }
    }
  }
});

// Below 80 columns a few of i-5's W2 screens are taller than the box (up to
// 45 rows at 60 columns for a learner who skipped the lessons before it,
// with a toast, 2026-10-18), so in a tall window they give up blank rows
// only: the blank over the card and its spacers, never a teaching line, the
// toast or a kept row (spec 9.1, design 4.5). The 120x60 window, whose
// 80-column box fits every screen, says what each screen shows whole.
// The rework's i-5 W2 shows its code block in two windows of four lines, so
// no lesson screen is that tall now: a made-up i-5 shows the whole block on
// the first beat, as the screen this measures.
const tallScreens = async () => {
  const { lessonScreens, threeLevels } = await import('./learn-drive.mjs');
  const window = '- code: lines 1-4 point 3\n';
  const file = readFileSync(join(root, 'learn', 'lessons', 'i-5.md'), 'utf8');
  assert.ok(file.includes(window), 'i-5 W2 still shows its hooks block in windows');
  const lessons = threeLevels({ 'i-5': file.replace(window, '- code: point 3\n') });
  return lessonScreens('i-5', lessons, { skipped: true }).filter(([label]) => label.startsWith('i-5 W2.')).map(([label, s]) => [`${label} (made-up, skipped)`, s]);
};

test('below 80 columns a tall window gives up only blank rows: a screen taller than the box keeps its teaching, its toast and its kept rows', async () => {
  const all = [...await everyScreen(), ...await tallScreens()].filter(([, s]) => s.view === 'step' && !s.overlay);
  // A wrong pick's "not this one" tag sits inside its option where the
  // option wraps, which differs by width: the words are read without it.
  const read = (ls) => flatText(ls.map((l) => l.replace(/ +(←|<-) not this one/, '')).join(''));
  for (const capName of ['full', 'ascii']) {
    const t = theme(CAPS[capName]);
    const box = `${t.glyph.rail}  ${t.glyph.bar}`;
    const spacers = (ls) => ls.filter((l) => l.trim() === t.glyph.rail).length;
    let gaveWay = 0;
    // Each with a toast: it takes the box's rows, so a screen is at its
    // tallest with one, and the toast must stay too.
    for (const [label, base] of all) {
      const state = { ...base, toast: { kind: 'stray' } };
      const whole = render(state, { cols: 120, rows: 60 }, t).map(strip);
      const beat = beatOf(state);
      const shown = read(whole);
      const words = [beat.ask, ...(beat.options ?? []).map((o) => o.text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')),
        C.whyLead, C.doneWhen, C.stray.split('.')[0], C.notYet, C.stepDone(state.pos.step + 1), C.right, C.notQuite, C.eased].filter(Boolean)
        .map(flatText).filter((word) => shown.includes(word));
      // The narrowest window, and one near 80 columns.
      for (const cols of [60, 70]) {
        const where = `${label} with a toast at ${cols}x60 (${capName})`;
        const lines = render(state, { cols, rows: 60 }, t).map(strip);
        const show = `\n${lines.join('\n')}`;
        const text = read(lines);
        assert.ok(!lines.some((l) => l.trim() === t.glyph.ellipsis), `${where}: a teaching row is cut${show}`);
        for (const word of words) assert.ok(text.includes(word), `${where}: "${word}" is gone${show}`);
        assert.equal(lines.some((l) => l.includes(box)), whole.some((l) => l.includes(box)), `${where}: the hint box${show}`);
        assert.equal(lines.filter((l) => l.trim().startsWith(t.glyph.bl)).length, whole.filter((l) => l.trim().startsWith(t.glyph.bl)).length, `${where}: the card's bottom border${show}`);
        if (spacers(lines) < spacers(whole)) gaveWay++;
      }
    }
    // Some do give way, so this measures what the spec says.
    assert.ok(gaveWay > 0, `no screen below 80 columns gives up a card spacer (${capName})`);
  }
});

test('rows that never drop: the question and its options, feedback, the hint box, the eased line and the key bar', async () => {
  const all = await everyScreen();
  for (const [capName, caps] of Object.entries(CAPS)) {
    if (capName === 'sixteen') continue;
    const t = theme(caps);
    const box = `${t.glyph.rail}  ${t.glyph.bar}`;
    for (const [cols, rows] of SHORT) {
      for (const [label, state] of all) {
        if (state.view !== 'step' || state.overlay) continue;
        const where = `${label} at ${cols}x${rows} (${capName})`;
        const tall = render(state, { cols, rows: 80 }, t).map(strip);
        const lines = render(state, { cols, rows }, t).map(strip);
        const text = flatText(lines.join(''));
        const show = `\n${lines.join('\n')}`;
        // The hint box and feedback on a wrong pick, row by row.
        const whileBox = whileBoxRows(tall, t);
        for (const row of tall.filter((l, i) => l.includes(box) && !whileBox.has(i))) assert.ok(lines.includes(row), `${where}: "${row.trim()}" is gone${show}`);
        // The question, each option and the feedback, wherever a tall window
        // shows them whole (a "not this one" tag can sit inside an option).
        const beat = beatOf(state);
        const whole = flatText(tall.join(''));
        const words = [beat.ask, ...(beat.options ?? []).map((o) => o.text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')),
          C.notYet, C.stepDone(state.pos.step + 1), C.right, C.notQuite, C.eased].filter(Boolean);
        for (const word of words) if (whole.includes(flatText(word))) assert.ok(text.includes(flatText(word)), `${where}: "${word}" is gone${show}`);
        assert.equal(lines.filter((l) => l.trim().startsWith(t.glyph.bl)).length, tall.filter((l) => l.trim().startsWith(t.glyph.bl)).length, `${where}: the card's bottom border is gone${show}`);
        // The tall window's key bar is its box's last row, over the blank rows that center the box (191).
        assert.equal(lines.at(-1), tall.findLast(Boolean), `${where}: the key bar`);
      }
    }
  }
});

test('spacers drop one at a time from the bottom, and the map\'s lesson rows stay evenly spaced', () => {
  const map = screens.find(([l]) => l === 'map')[1];
  const t = theme(CAPS.full);
  const gaps = (cols, rows) => {
    const lines = render(map, { cols, rows }, t).map(strip);
    const at = lines.map((l, i) => (/^\s*[❯ ] [✔○] /.test(l) ? i : -1)).filter((i) => i >= 0);
    assert.equal(at.length, 6, `${cols}x${rows}: the Beginner page: ${lines.join('\n')}`);
    return { lines, gaps: new Set(at.slice(1).map((i, k) => i - at[k])) };
  };
  // 80x24 has room for every spacer; at 60x20 the footer's spacer goes, then
  // the lesson rows' spacers go together.
  assert.deepEqual([...gaps(80, 24).gaps], [2]);
  const small = gaps(60, 20);
  assert.deepEqual([...small.gaps], [1]);
  const text = flatText(small.lines.join(''));
  for (const word of [C.mapFooter, ...Object.values(C.tierHelp)]) assert.ok(text.includes(flatText(word)), `"${word}" at 60x20`);
});

// Each lesson's intro, complete and next screens, played on the path.
// After a later level's first lesson, the learner has answered its folder
// question there: the practice copy. `top` adds to the save, such as the
// skills missed before, which pick a warm-up (194).
// A lesson that runs in a new copy of the template (a-5, a-capstone) has
// that copy's folder saved too, as the learner gives it at its intro.
const foldersBefore = (l) => {
  const folders = {
    ...(WORK_LEVELS.includes(l.level) && allCourse.find((x) => x.level === l.level) !== l ? { [l.level]: FACTS.root } : {}),
    ...(l.newCopy ? { [l.id]: NEW_COPY } : {}),
  };
  return Object.keys(folders).length ? { folders } : {};
};
const endScreens = (top = {}) => allCourse.filter((l) => l.content).flatMap((l) => {
  const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: finishedBefore(l.id), ...foldersBefore(l), ...top } });
  assert.equal(d.state.view, 'intro', l.id);
  const intro = d.state;
  playUntil(d, (s) => s.view === 'complete' && s.lesson === l.id);
  const complete = d.state;
  d.key('enter');
  return [[`${l.id} intro`, intro], [`${l.id} complete`, complete], [`${l.id} next`, d.state]];
});

test('a repeat compacts below 24 rows only: the climb staircase becomes one row, and 80x24 keeps it', () => {
  const t = theme(CAPS.full);
  const stairs = (lines) => Object.values(C.tierHelp).filter((x) => lines.some((l) => l.includes(x)));
  const intro = screens.find(([l]) => l === 'intro')[1];
  const next = screens.find(([l]) => l === 'next')[1];
  // b-1's intro plans 7 GUIDED, 3 HINTED and 2 CHALLENGE steps; the walk's
  // next screen climbed 8, 2 and 2 (the staircases at 80x24 say so).
  for (const [state, bar] of [[intro, '●●●●●●●◆◆◆★★'], [next, '●●●●●●●●◆◆★★']]) {
    const tall = render(state, { cols: 80, rows: 24 }, t).map(strip);
    assert.equal(stairs(tall).length, 3, tall.join('\n'));
    const small = render(state, { cols: 60, rows: 20 }, t).map(strip);
    assert.deepEqual(stairs(small), [], small.join('\n'));
    const row = small.find((l) => l.includes(bar));
    assert.ok(row, small.join('\n'));
    assert.match(row, /GUIDED ★☆☆ .*CHALLENGE ★★★/);
  }
  // At 80x24 every intro and next screen keeps its staircase.
  for (const [label, state] of endScreens().filter(([l]) => !l.endsWith('complete'))) {
    const lines = render(state, { cols: 80, rows: 24 }, t).map(strip);
    assert.ok(stairs(lines).length >= 1 && !lines.some((l) => l.trim() === '…'), `${label}: ${lines.join('\n')}`);
  }
});

// Intros short enough that 60x20 keeps the staircase whole, each with its
// reason.
const STAIRS_WHOLE_AT_60X20 = {
  'a-capstone intro': 'one can line and one tier (every step CHALLENGE): the staircase is one row, and it fits',
};

test('every intro opens with its Why line, in the page\'s words, at 60x20 and 80x24: at 60x20 the staircase compacts first', () => {
  const stairs = (lines) => Object.values(C.tierHelp).filter((x) => lines.some((l) => l.includes(x)));
  for (const [label, state] of endScreens().filter(([l]) => l.endsWith('intro'))) {
    const { why } = lessonById(state.lesson).content.intro;
    for (const [capName, caps] of Object.entries(CAPS)) {
      const t = theme(caps);
      for (const [cols, rows] of SHORT) {
        const lines = render(state, { cols, rows }, t).map(strip);
        const where = `${label} at ${cols}x${rows} (${capName})\n${lines.join('\n')}`;
        // The header's three rows, its blank, then the Why line. At 60x20 a
        // taller intro may give up that blank: the folder question on a
        // level's first, or i-4's three can lines, take it.
        const at = lines[3].trim() ? 3 : 4;
        assert.ok(at === 4 || cols === 60, where);
        assert.ok(lines[at].trimStart().startsWith(`${C.whyLead} "`), where);
        assert.ok(flatText(lines.slice(at, at + 2).join('')).startsWith(flatText(`Why ${why}`)), where);
        // At 80x24 the staircase keeps its rows; at 60x20 it is one row.
        const tiers = stairs(render(state, { cols: 120, rows: 40 }, t).map(strip)).length;
        assert.equal(stairs(lines).length, cols === 80 || STAIRS_WHOLE_AT_60X20[label] ? tiers : 0, where);
      }
    }
  }
});

// The b-4 intro as energy-and-teaching 3.1 draws it: at 80x24 one spacer
// gives way; at 60x20 the staircase compacts, then the bottom spacers drop.
// The compact row is spec 3.1's (142): the pills of the easiest and hardest
// tiers, where the mockup spelled out all three tier words.
const B4_INTRO = {
  '80x24': `
   B4   Keep a session on track                               about 20 minutes
  ☆──☆   ○──○   ◇   ○──○──○   ◇──◇──◇──◇   ☆──☆                       14 steps
  ────────────────────────────────────────────────────────────────────────────

  Why: "a long, wandering conversation leaves Claude less room for the work
       that matters now"

  🎯 You'll be able to
     ○ keep a session on track
     ○ see how full its context is, clear or compact it
    🏁 rewind a change
     ○ resume an earlier conversation

  The help shrinks each time a skill comes back:

                ★★★    CHALLENGE ★★★    just the goal
         ◆◆◆◆◆    HINTED ★★☆    the goal, hints if you ask
  ●●●●●    GUIDED ★☆☆    every command shown
  1 warm-up first
  ❯  Start lesson 4
     I've used Claude Code before: give me less help

  ────────────────────────────────────────────────────────────────────────────
  ↑↓ choose    enter start    m map    q quit`,
  '60x20': `
   B4   Keep a session on track           about 20 minutes
  ☆──☆   ○──○   ◇   ○──○──○   ◇──◇──◇──◇   ☆──☆   14 steps
  ────────────────────────────────────────────────────────

  Why: "a long, wandering conversation leaves Claude less
       room for the work that matters now"

  🎯 You'll be able to
     ○ keep a session on track
     ○ see how full its context is, clear or compact it
    🏁 rewind a change
     ○ resume an earlier conversation
  The help shrinks each time a skill comes back:
  ●●●●●◆◆◆◆◆★★★    GUIDED ★☆☆  ▸  CHALLENGE ★★★
  1 warm-up first
  ❯  Start lesson 4
     I've used Claude Code before: give me less help

  ────────────────────────────────────────────────────────
  ↑↓ choose    enter start    m map    q quit`,
};

test('the b-4 intro, with its Why line and payoff, is the design\'s at 80x24 and 60x20', () => {
  // With exit missed before, so b-4 plays its one warm-up, R2 (194).
  const intro = endScreens({ missed: ['exit'] }).find(([l]) => l === 'b-4 intro')[1];
  for (const [cols, rows] of SHORT) {
    const lines = render(intro, { cols, rows }, theme(CAPS.full)).map((l) => strip(l).trimEnd());
    assert.deepEqual(lines, B4_INTRO[`${cols}x${rows}`].slice(1).split('\n'), lines.join('\n'));
  }
});

// The same screen as if its lesson file named no payoff.
const noPayoff = (s) => ({ ...s, course: s.course.map((l) => (l.id === s.lesson ? { ...l, content: { ...l.content, intro: { ...l.content.intro, payoff: undefined } } } : l)) });

test('the payoff draws with 🏁 ([win] in ASCII) in place of the intro\'s ○ and the complete screen\'s ✔, and costs no row', () => {
  for (const [label, state] of endScreens().filter(([l]) => !l.endsWith('next'))) {
    const { payoff } = lessonById(state.lesson).content.intro;
    for (const [capName, caps] of Object.entries(CAPS)) {
      const t = theme(caps);
      const plain = state.view === 'intro' ? t.glyph.dotOff : t.glyph.check;
      const flag = t.unicode ? '🏁' : '[win]';
      for (const [cols, rows] of SHORT) {
        const lines = render(state, { cols, rows }, t).map(strip);
        const before = render(noPayoff(state), { cols, rows }, t).map(strip);
        const where = `${label} at ${cols}x${rows} (${capName})\n${lines.join('\n')}`;
        const changed = lines.flatMap((l, i) => (l !== before[i] ? [i] : []));
        const [i, ...wraps] = changed;
        assert.ok(i !== undefined, where);
        // In ASCII the wider [win] also moves its line's wrapped rows, the
        // same words, to stay under its first word; in Unicode one row changes.
        assert.ok(!(t.unicode && wraps.length), where);
        wraps.forEach((j, k) => assert.ok(j === i + k + 1 && lines[j].trim() === before[j].trim(), where));
        assert.ok(payoff.startsWith(before[i].trim().replace(`${plain} `, '')), where);
        assert.equal(lines[i].trim(), before[i].trim().replace(plain, flag), where);
        // In Unicode the line's words start where the other lines' do.
        if (t.unicode) assert.equal(width(lines[i].slice(0, lines[i].indexOf(flag) + flag.length)), width(before[i].slice(0, before[i].indexOf(plain) + plain.length)), where);
      }
    }
  }
});

test('the 🏁 line is the same with or without hints, eases, the bottom rung or less help', () => {
  const t = theme(CAPS.full);
  const flagRow = (state, cols, rows) => render(state, { cols, rows }, t).map(strip).find((l) => l.includes('🏁'));
  const start = (saved = {}) => driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: finishedBefore('b-4'), ...saved } });
  const atCheck = (s) => s.view === 'step' && !['done', 'already'].includes(s.beat.status) && beatOf(s).verify.kind === 'check';
  const done = (s) => s.view === 'complete' && s.lesson === 'b-4';
  const plays = {};
  // No help: the intro as it opens, then straight through.
  const plain = start();
  plays['intro'] = plain.state;
  playUntil(plain, done);
  plays['complete'] = plain.state;
  // The intro with "less help" chosen, then that play's end.
  const less = start();
  less.key('down');
  plays['intro, less help chosen'] = less.state;
  less.key('enter');
  playUntil(less, done);
  plays['complete after less help'] = less.state;
  // A check that fails twice, then the hints behind h: one, or up to the
  // bottom rung and its y. Then the work is done.
  const helpAt = (d, toBottom) => {
    const beat = beatOf(d.state);
    const items = beat.verify.items.map((index) => ({ index, text: lessonOf(d.state).items[index], pass: false, hint: 'not there yet' }));
    const check = (stamp, pass = false, asked = 0) => d.send({ type: 'check', lesson: 'b-4', items: items.map((it) => ({ ...it, pass, hint: pass ? '' : it.hint })), path: beat.evidence, stamp, asked });
    check('a');
    d.key('r');
    check('b', false, d.state.beat.asked);
    for (let i = 0; i < 6 && !d.state.beat.confirm; i++) {
      d.key('h');
      if (!toBottom) break;
    }
    const rung = d.state.beat.rung;
    if (toBottom) d.key('y');
    check('c', true);
    return rung;
  };
  // A hint at the first check, the bottom rung (an ease) at the next.
  const helped = start();
  playUntil(helped, atCheck);
  assert.equal(helpAt(helped, false), 0, 'the first hint was open');
  playUntil(helped, atCheck);
  helpAt(helped, true);
  assert.ok(helped.state.eased.length > 0, 'the bottom rung eased a skill');
  playUntil(helped, done);
  plays['complete after hints and the bottom rung'] = helped.state;
  // The intro for a learner with that ease saved.
  plays['intro with an ease saved'] = start({ eased: helped.state.eased }).state;
  for (const [cols, rows] of SHORT) {
    const want = { intro: '🏁 rewind a change', complete: '🏁 rewind a change' };
    for (const [label, state] of Object.entries(plays)) {
      const row = flagRow(state, cols, rows);
      assert.equal(row?.trim(), want[state.view], `${label} at ${cols}x${rows}`);
      assert.equal(row, flagRow(state.view === 'intro' ? plays.intro : plays.complete, cols, rows), `${label} at ${cols}x${rows}`);
    }
  }
});

test('🏁 has one job: it marks the payoff on the intro and complete screens, once, and nowhere else', async () => {
  const all = [...await everyScreen(), ...endScreens()];
  for (const capName of ['full', 'ascii']) {
    const t = theme(CAPS[capName]);
    const flag = t.unicode ? '🏁' : '[win]';
    for (const [label, state] of all) {
      for (const [cols, rows] of SHORT) {
        const lines = render(state, { cols, rows }, t).map(strip);
        const n = lines.filter((l) => l.includes(flag)).length;
        const marks = ['intro', 'complete'].includes(state.view) && lessonById(state.lesson).content.intro.payoff;
        assert.equal(n, marks ? 1 : 0, `${label} at ${cols}x${rows} (${capName})\n${lines.join('\n')}`);
      }
    }
  }
});

test('a wrapped can line goes on under its own first word, flagged or not, in Unicode and ASCII', () => {
  let wrapped = 0;
  for (const [label, state] of endScreens().filter(([l]) => !l.endsWith('next'))) {
    const { can } = lessonById(state.lesson).content.intro;
    for (const [capName, caps] of Object.entries(CAPS)) {
      const t = theme(caps);
      const marks = [t.unicode ? '🏁' : '[win]', state.view === 'intro' ? t.glyph.dotOff : t.glyph.check].map((m) => `${m} `);
      for (const [cols, rows] of SHORT) {
        const lines = render(state, { cols, rows }, t).map(strip);
        const where = `${label} at ${cols}x${rows} (${capName})\n${lines.join('\n')}`;
        const markOf = (l) => marks.find((m) => l.trimStart().startsWith(m));
        const words = (l, m) => (m ? l.trimStart().slice(m.length) : l).trim();
        let i = lines.findIndex((l) => markOf(l) && can[0].startsWith(words(l, markOf(l))));
        assert.ok(i > 0, where);
        let col = null;
        let seen = '';
        for (; seen.length < flatText(can.join('')).length; i++) {
          const l = lines[i];
          const m = markOf(l);
          if (m) col = width(l.slice(0, l.indexOf(m) + m.length));
          else {
            assert.equal(width(l) - width(l.trimStart()), col, where);
            wrapped++;
          }
          seen += flatText(words(l, m));
        }
        assert.equal(seen, flatText(can.join('')), where);
      }
    }
  }
  // b-1's payoff wraps at 60 columns on both screens, so the rule was seen.
  assert.ok(wrapped > 0);
});

test('the Why line is an optional row: below 24 rows it drops whole, after the staircase compacts and before a can line is cut', () => {
  const intro = endScreens().find(([l]) => l === 'b-4 intro')[1];
  // The b-4 intro with `n` more can lines, so its body outgrows 60x20.
  const longer = (n) => {
    const extra = Array.from({ length: n }, (_, k) => `practise skill ${k + 1}`);
    return { state: { ...intro, course: intro.course.map((l) => (l.id === 'b-4' ? { ...l, content: { ...l.content, intro: { ...l.content.intro, can: [...l.content.intro.can, ...extra] } } } : l)) }, extra };
  };
  const t = theme(CAPS.full);
  const { why } = lessonById('b-4').content.intro;
  let dropped = null;
  for (let n = 0; n <= 6 && dropped === null; n++) {
    const { state, extra } = longer(n);
    const lines = render(state, { cols: 60, rows: 20 }, t).map(strip);
    const where = `b-4 intro with ${n} more can lines\n${lines.join('\n')}`;
    const whyRows = lines.filter((l) => l.trimStart().startsWith(`${C.whyLead} "`) || flatText(why).endsWith(flatText(l)) && flatText(l).length > 8);
    // The staircase is the one-row mix bar whenever the Why line shows.
    assert.ok(!Object.values(C.tierHelp).some((x) => lines.some((l) => l.includes(x))), where);
    // Both of the Why line's rows, or neither.
    assert.ok([0, 2].includes(whyRows.length), where);
    // Every can line is whole: no teaching row was cut first.
    for (const c of extra) assert.ok(lines.some((l) => l.trim() === `○ ${c}`), where);
    if (!whyRows.length) dropped = { n, lines, where };
  }
  assert.ok(dropped, 'six more can lines never pushed the Why line out');
  assert.ok(dropped.n > 0, dropped.where);
  // Its blank went with it: the goal line follows the header's blank.
  assert.ok(dropped.lines[4].includes(C.youllBeAble), dropped.where);
});

// A line `cut` shortened: it fills the row to the last column and ends in an
// ellipsis ('.' in ASCII mode).
const widthCut = (t, cols) => (l) => width(l) === cols - 1 && (t.unicode ? l.endsWith('…') : /\S\.$/.test(l));

test('at 60x20 and 80x24 no teaching line is cut on the intro, complete, next and level-up screens: long lines wrap', () => {
  const levelups = [...screens, ...allCourse.filter((l) => l.content).flatMap((l) => {
    const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: finishedBefore(l.id), ...ownCopy(l.id) } });
    const out = [];
    const end = (s) => s.view === 'next' && s.lesson === l.id;
    while (!end(d.state)) {
      if (d.state.view === 'levelup') {
        out.push([`${l.id} level up ${d.state.levelTo}`, d.state]);
        d.key('enter');
      } else playUntil(d, (s) => s.view === 'levelup' || end(s));
    }
    return out;
  })].filter(([, s]) => s.view === 'levelup');
  assert.ok(levelups.length >= 6, `${levelups.length} level-ups`);
  for (const [capName, caps] of Object.entries(CAPS)) {
    const t = theme(caps);
    for (const [cols, rows] of SHORT) {
      for (const [label, state] of [...endScreens(), ...levelups]) {
        const lines = render(state, { cols, rows }, t).map(strip);
        const where = `${label} at ${cols}x${rows} (${capName})`;
        const show = `\n${lines.join('\n')}`;
        assert.ok(!lines.some((l) => l.trim() === t.glyph.ellipsis), `${where} drops lines${show}`);
        assert.ok(!lines.some(widthCut(t, cols)), `${where} cuts a line${show}`);
        const text = flatText(lines.join(''));
        const content = lessonById(state.lesson).content;
        // "A notch harder" shows only before a lesson with a lesson file in
        // the same level (ticket 85) that plans a larger share of steps
        // above GUIDED (ticket 186).
        const next = nextLessonOf(state);
        const notch = next?.content && levelOf(state, next.id) === levelOf(state) && lessHelp(next.id) > lessHelp(state.lesson);
        const words = state.view === 'levelup' ? (state.levelTo === 'challenge' ? C.toChallenge : C.toHinted)
          : state.view === 'next' ? [C.notchHarder, C.savedBreak].filter((w) => w !== C.notchHarder || notch) : content.intro.can;
        for (const word of words) assert.ok(text.includes(flatText(word)), `${where}: "${word}" is not whole${show}`);
      }
    }
  }
});

// A lesson's planned share of steps above GUIDED.
const lessHelp = (id) => {
  const m = mix(ruleTiers(allCourse.map((l) => l.content), allCourse.findIndex((l) => l.id === id)));
  return (m[1] + m[2]) / (m[0] + m[1] + m[2]);
};

// i-2 plans 8 of 11 steps above GUIDED, i-3 6 of 9 and i-4 7 of 10.
test('"A notch harder" shows only when the next lesson plans a larger share of steps above GUIDED: not i-2 to i-3, but i-3 to i-4 (ticket 186)', () => {
  assert.ok(lessHelp('i-3') < lessHelp('i-2') && lessHelp('i-4') > lessHelp('i-3'));
  const t = theme(CAPS.full);
  for (const [id, notch] of [['i-2', false], ['i-3', true]]) {
    const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: finishedBefore(id), ...foldersBefore(lessonById(id)) } });
    playUntil(d, (s) => s.view === 'next' && s.lesson === id);
    for (const [cols, rows] of SHORT) {
      const lines = render(d.state, { cols, rows }, t).map(strip);
      const where = `${id} next at ${cols}x${rows}\n${lines.join('\n')}`;
      const up = lines.findIndex((l) => l.includes(C.nextUp));
      assert.ok(up > 0, where);
      assert.equal(flatText(lines.join('')).includes(flatText(C.notchHarder)), notch, where);
      // The next lesson's climb still shows within the level.
      assert.ok(lines.slice(up).some((l) => /[●◆★]{3}/.test(l)), where);
    }
  }
});

test('the welcome fits at 60x20 and 80x24: nothing cut, Pip and both windows on screen', () => {
  const words = [C.hi('Sam'), C.pip1, C.pip2, C.twoWindows, C.thisWindow, ...C.thisWindowLines, C.otherWindow, ...C.otherWindowLines, C.openSecond, 'cd /home/sam/claude-code-practice', C.comeBack];
  for (const [capName, caps] of Object.entries(CAPS)) {
    const t = theme(caps);
    for (const [cols, rows] of SHORT) {
      const lines = render(driver().state, { cols, rows }, t).map(strip);
      const where = `welcome at ${cols}x${rows} (${capName})`;
      const show = `\n${lines.join('\n')}`;
      assert.ok(!lines.some((l) => l.trim() === t.glyph.ellipsis), `${where} drops lines${show}`);
      assert.ok(!lines.some(widthCut(t, cols)), `${where} cuts a line${show}`);
      // Words read past ASCII Pip, which sits beside them.
      const text = flatText(lines.map((l) => l.replace(/^\s*(o {4}|[|+](-{3}\+-{3}|-{7}|  o_o  )[|+])/, '')).join(''));
      for (const word of words) assert.ok(text.includes(flatText(word)), `${where}: "${word}" is not whole${show}`);
      // Pip's face, and the two windows side by side.
      assert.ok(lines.some((l) => l.includes(t.unicode ? '│  ●‿●  │' : '|  o_o  |')), `${where}: no Pip${show}`);
      assert.ok(lines.some((l) => l.includes(C.thisWindow) && l.includes(C.otherWindow)), `${where}: the windows are not side by side${show}`);
    }
  }
  // A git error never drops.
  const broken = render(driver({ facts: { gitError: 'spawn git ENOENT' } }).state, { cols: 60, rows: 20 }, theme(CAPS.full)).map(strip);
  assert.ok(flatText(broken.join('')).includes(flatText(C.gitBroken('spawn git ENOENT'))), broken.join('\n'));
});

// Pip's antenna is its first row: text beside it starts on Pip's face row,
// or as low as Pip's four rows still hold it, and beside the antenna only
// when it needs all four, so Pip's block keeps its rows.
test('the text beside the big Pip starts on its face row where Pip\'s four rows hold it; longer text keeps today\'s rows', () => {
  const t = theme(CAPS.full);
  const at = (lines, text) => lines.map(strip).find((l) => l.includes(text));
  const face = '│  ●‿●  │';
  // One row: the boot's line. Two: the resume at 80 columns.
  assert.match(at(bootFrame(0, { cols: 80, rows: 24 }, t), C.askingGit), new RegExp(`^ {3}${face} {3}${C.askingGit}$`));
  const resume = screens.find(([l]) => l === 'resume')[1];
  assert.ok(at(render(resume, { cols: 80, rows: 24 }, t), C.welcomeBack).includes(`${face}   👋 ${C.welcomeBack}`));
  // Longer text starts higher rather than add a row: three rows (the
  // welcome at 80 columns) beside the head's top, four (at 60 columns)
  // beside the antenna, as today's rule placed them. This pins that
  // trade, not the face row, until the owner chooses between the two.
  const welcome = (cols) => render(driver().state, { cols, rows: 24 }, t).map(strip);
  const hi = (lines) => lines.findIndex((l) => l.includes(`👋 ${C.hi('Sam').split(' ').slice(0, 2).join(' ')}`));
  const pipTop = (lines) => lines.findIndex((l) => /^ {3} {4}● {4}/.test(l));
  assert.equal(hi(welcome(80)) - pipTop(welcome(80)), 1, welcome(80).join('\n'));
  assert.match(welcome(80)[pipTop(welcome(80))], /^ {3} {4}● {4}$/);
  assert.equal(hi(welcome(60)) - pipTop(welcome(60)), 0, welcome(60).join('\n'));
});

test('the word beside the big Pip, where no banner is drawn, sits on its face row: LEVEL UP and COMPLETE in ASCII', () => {
  const t = theme(CAPS.ascii);
  for (const [label, face, word] of [['level up hinted', 'o-o', C.levelUp], ['complete', '^_^', C.complete]]) {
    const s = screens.find(([l]) => l === label)[1];
    for (const [cols, rows] of SHORT) {
      const lines = render(s, { cols, rows }, t).map((l) => strip(l).trimEnd());
      assert.ok(lines.includes(`   |  ${face}  |    ${word}`), `${label} at ${cols}x${rows}\n${lines.join('\n')}`);
    }
  }
});

test('decoration gives way below 24 rows only, after the spacers: the confetti, then Pip and the banner', () => {
  const t = theme(CAPS.full);
  const complete = screens.find(([l]) => l === 'complete')[1];
  // A three-row toast at 60x20.
  const toast = { kind: 'save', message: 'EACCES: permission denied, open .practice/learn.json for writing' };
  const confetti = (lines) => lines.some((l) => l.trim().startsWith('✦     ·'));
  const face = (lines) => lines.some((l) => l.includes('│  ^‿^  │'));
  const at = (state, cols, rows) => render(state, { cols, rows }, t).map(strip);
  // With room, everything shows; a toast at 60x20 takes the spacers, then the confetti.
  assert.ok(confetti(at(complete, 60, 20)) && face(at(complete, 60, 20)));
  const small = at({ ...complete, toast }, 60, 20);
  assert.ok(!confetti(small) && face(small), small.join('\n'));
  assert.ok(!small.slice(3, -3).some((l) => l.trim() === ''), `no spacer is left: ${small.join('\n')}`);
  const typical = at({ ...complete, toast }, 80, 24);
  assert.ok(confetti(typical) && face(typical), typical.join('\n'));
  // The welcome with a git error: Pip gives way at 60x20, and stays at 80x24.
  const broken = driver({ facts: { gitError: 'spawn git ENOENT' } }).state;
  assert.ok(!at(broken, 60, 20).some((l) => l.includes('│  ●‿●  │')), at(broken, 60, 20).join('\n'));
  assert.ok(at(broken, 80, 24).some((l) => l.includes('│  ●‿●  │')));
  for (const word of [C.hi('Sam'), C.pip1, C.pip2]) assert.ok(flatText(at(broken, 60, 20).join('')).includes(flatText(word)), word);
});

test('an optional row drops before any teaching line is cut: the next screen\'s question count', () => {
  const t = theme(CAPS.full);
  const next = screens.find(([l]) => l === 'next')[1];
  // A save error long enough to leave the body eight rows at 60x20. The
  // next lesson, b-2 here, has no lesson file: no climb row under its name.
  const toast = { kind: 'save', message: `EACCES: permission denied, open ${'/home/sam/claude-code-practice'.repeat(8)}/.practice/learn.json` };
  const lines = render({ ...next, toast }, { cols: 60, rows: 20 }, t).map(strip);
  const show = `\n${lines.join('\n')}`;
  assert.ok(!lines.some((l) => l.includes(C.answeredSummary(5))), `the count shows${show}`);
  assert.ok(!lines.some((l) => l.trim() === '…'), `a teaching line is cut${show}`);
  const text = flatText(lines.join(''));
  for (const word of [C.checkedSummary(1, 1), C.yourClimb, C.nextUp, 'Permission modes and plan mode', C.savedBreak]) assert.ok(text.includes(flatText(word)), `"${word}"${show}`);
  // With room, it shows.
  assert.ok(render(next, { cols: 60, rows: 20 }, t).map(strip).some((l) => l.includes(C.answeredSummary(5))));
});

test('lines that a narrow window cut by width now wrap: no screen cuts a line at 60x20 or 80x24, ASCII included', async () => {
  const all = await everyScreen();
  for (const capName of ['full', 'ascii']) {
    const t = theme(CAPS[capName]);
    for (const [cols, rows] of SHORT) {
      for (const [label, state] of all) {
        const lines = render(state, { cols, rows }, t).map(strip);
        assert.ok(!lines.some(widthCut(t, cols)), `${label} at ${cols}x${rows} (${capName}) cuts a line:\n${lines.filter(widthCut(t, cols)).join('\n')}`);
      }
    }
  }
});

test('a done beat keeps its "Done when" where no evidence line replaces it, and a hidden line leaves no double spacer', async () => {
  const { lessonScreens, course } = await import('./learn-drive.mjs');
  const t = theme(CAPS.full);
  const cap = new Map(lessonScreens('b-capstone', course));
  const b5 = new Map(lessonScreens('b-5', course));
  // Capstone T1.1 is beat 1 of 5 and has no evidence key: it shows only "Done."
  const first = render(cap.get('b-capstone T1.1 done'), { cols: 80, rows: 24 }, t).map(strip);
  assert.ok(first.some((l) => l.includes(`${C.doneWhen}git show HEAD:CLAUDE.md shows it.`)), first.join('\n'));
  // At 60x20 it is optional, so it may drop; the card keeps its border.
  const small = render(cap.get('b-capstone T1.1 done'), { cols: 60, rows: 20 }, t).map(strip);
  assert.ok(small.some((l) => l.trim().startsWith(t.glyph.bl)) && !small.some((l) => /^\s*│  …$/.test(l)), small.join('\n'));
  // b-5 W4's "Done when" is a say line; its evidence line replaces it, and
  // the rail shows one spacer where the line was.
  for (const label of ['b-5 W4.0 done', 'b-5 Y3.0 done']) {
    const lines = render(b5.get(label), { cols: 80, rows: 40 }, t).map(strip);
    assert.ok(!lines.some((l) => l.includes(C.doneWhen)), `${label}: ${lines.join('\n')}`);
    assert.ok(lines.some((l) => l.includes(' holds ')), `${label}: no evidence line`);
    assert.ok(!lines.some((l, i) => l.trim() === t.glyph.rail && lines[i + 1]?.trim() === t.glyph.rail), `${label}: two spacers in a row\n${lines.join('\n')}`);
  }
  // Waiting, the say line shows.
  assert.ok(render(b5.get('b-5 W4.0 waiting'), { cols: 80, rows: 40 }, t).map(strip).some((l) => l.includes(C.doneWhen)));
});

test('no card on any screen draws two spacers in a row', async () => {
  const t = theme(CAPS.full);
  for (const [label, state] of await everyScreen()) {
    const lines = render(state, { cols: 80, rows: 60 }, t).map(strip);
    assert.ok(!lines.some((l, i) => l.trim() === t.glyph.rail && lines[i + 1]?.trim() === t.glyph.rail), `${label}: ${lines.join('\n')}`);
  }
});

// A card's bottom border: its corner, then rule to the end. (In ASCII the
// top border starts with the same two characters.)
const cardBottom = (t) => (l) => l.trim().length > 2 && l.trim() === `${t.glyph.bl}${t.glyph.rule.repeat(l.trim().length - 1)}`;

// The toasts a step card can show, as the reducer sets them.
const TOAST_KINDS = [{ kind: 'stray' }, { kind: 'hintsLater', try: 'r' }, { kind: 'pickFirst' }];

test('kept rows never drop for a toast: the toast gives up its blank row, then goes', async () => {
  const all = await everyScreen();
  for (const capName of ['full', 'ascii']) {
    const t = theme(CAPS[capName]);
    const box = `${t.glyph.rail}  ${t.glyph.bar}`;
    for (const toast of TOAST_KINDS) {
      for (const [label, base] of all) {
        if (base.view !== 'step' || base.overlay) continue;
        const state = { ...base, toast };
        const where = `${label} with a ${toast.kind} toast at 60x20 (${capName})`;
        const tall = render(state, { cols: 60, rows: 80 }, t).map(strip);
        const lines = render(state, { cols: 60, rows: 20 }, t).map(strip);
        const show = `\n${lines.join('\n')}`;
        assert.equal(lines.length, 20, where);
        const whileBox = whileBoxRows(tall, t);
        for (const row of tall.filter((l, i) => l.includes(box) && !whileBox.has(i))) assert.ok(lines.includes(row), `${where}: "${row.trim()}" is gone${show}`);
        assert.equal(lines.filter(cardBottom(t)).length, 1, `${where}: the card's bottom border is gone${show}`);
        // The tall window's key bar is its box's last row, over the blank rows that center the box (191).
        assert.equal(lines.at(-1), tall.findLast(Boolean), `${where}: the key bar`);
      }
    }
  }
  // W2 stuck keeps its feedback whole and the toast too, which gives up its
  // blank row; W5 wrong has no room for the toast, so it goes.
  const t = theme(CAPS.full);
  const at = (label) => render({ ...screens.find(([l]) => l === label)[1], toast: { kind: 'stray' } }, { cols: 60, rows: 20 }, t).map(strip);
  const stuck = at('W2 stuck');
  assert.ok(flatText(stuck.join('')).includes(flatText(C.fixThenPick)) && stuck.some((l) => l.includes('looks like a command')), stuck.join('\n'));
  // The toast's last row sits on the rule: its blank row went.
  assert.ok(stuck.at(-3).includes('not here.'), stuck.join('\n'));
  const wrong = at('W5 wrong');
  assert.ok(!wrong.some((l) => l.includes('looks like a command')) && wrong.some((l) => l.includes(C.notQuite)), wrong.join('\n'));
});

test('a `…` cut inside a card keeps the rail: every row between the card\'s borders starts with it', async () => {
  const all = await everyScreen();
  for (const capName of ['full', 'ascii']) {
    const t = theme(CAPS[capName]);
    for (const toast of [null, { kind: 'stray' }]) {
      for (const [label, base] of all) {
        if (!['step', 'checkonly'].includes(base.view) || base.overlay) continue;
        const lines = render(toast ? { ...base, toast } : base, { cols: 60, rows: 20 }, t).map(strip);
        const bottom = lines.findIndex(cardBottom(t));
        const top = lines.findIndex((l) => l.trim().startsWith(`${t.glyph.tl}${t.glyph.rule}`));
        assert.ok(top > 0 && bottom > top, `${label} (${capName}): ${lines.join('\n')}`);
        for (const l of lines.slice(top + 1, bottom)) assert.equal(l.trim()[0], t.glyph.rail, `${label}${toast ? ' with a toast' : ''} (${capName}): "${l}"\n${lines.join('\n')}`);
      }
    }
  }
});

// 190: the screens above feed placeholder hints, so a long real FAIL message
// slips past them. Each of b-2's real messages, at its "The check says:" rung
// on every beat that checks its item, keeps at 60x20 the card's title and
// Goal, every hint-box row and the bottom border; only a command row folds.
test('b-2\'s real FAIL messages at "The check says:" keep the card\'s title, Goal, hint box and border at 60x20 (190)', async () => {
  const { lessons } = await import('../lessons/index.mjs');
  const { openRepo } = await import('../repo.mjs');
  const { commit, repo, withRepo, write } = await import('./helpers.mjs');
  const { scenarios } = await import('./ladders/b-2.mjs');
  const t = theme(CAPS.full);
  const box = `${t.glyph.rail}  ${t.glyph.bar}`;
  const l = allCourse.find((x) => x.id === 'b-2');
  let seen = 0;
  // This stable UI scenario has the original two snapshot items. The live
  // rework test covers the new CLI behavior items against liveCourse.
  for (const sc of scenarios.filter((sc) => sc.item < l.items.length)) {
    const hint = withRepo(() => repo(), (dir) => {
      if (sc.files) write(dir, sc.files);
      if (sc.setup) sc.setup(dir, { write, commit });
      return lessons['b-2'].items[sc.item].check(openRepo(dir));
    });
    for (const step of l.content.steps) step.beats.forEach((beat, b) => {
      const v = beat.verify;
      if (v.kind !== 'check' || !(v.all || v.items.includes(sc.item))) return;
      const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore('b-2'), 'b-2': { step: step.id, beat: b, warm: [], levels: ['hinted', 'challenge'] } } } });
      d.key('enter');
      const items = (v.all ? l.items.map((_, i) => i) : v.items).map((index) => ({ index, text: l.items[index], pass: index !== sc.item, hint: index === sc.item ? hint : '' }));
      d.send({ type: 'check', lesson: 'b-2', items, path: beat.evidence ?? null, stamp: 'a' });
      d.key('r');
      d.send({ type: 'check', lesson: 'b-2', items, path: beat.evidence ?? null, stamp: 'b', asked: d.state.beat.asked });
      for (let i = 0; i < 4 && rungsOf(d.state)[d.state.beat.rung]?.kind !== 'check'; i++) {
        d.send({ type: 'key', name: 'h', ch: 'h', wait: 3_000 });
        d.send({ type: 'flush', wait: 400 });
      }
      const where = `b-2 ${step.id}.${b}, ${sc.name}`;
      assert.equal(rungsOf(d.state)[d.state.beat.rung]?.kind, 'check', where);
      seen++;
      const tall = render(d.state, { cols: 60, rows: 80 }, t).map(strip);
      const lines = render(d.state, { cols: 60, rows: 20 }, t).map(strip);
      const show = `\n${lines.join('\n')}`;
      const text = flatText(lines.join(''));
      const goal = beat.lines.find((x) => x.key === 'goal');
      for (const word of [step.title, goal?.text].filter(Boolean)) assert.ok(text.includes(flatText(word)), `${where}: "${word}" is gone${show}`);
      for (const row of tall.filter((x) => x.includes(box))) assert.ok(lines.includes(row), `${where}: "${row.trim()}" is gone${show}`);
      assert.ok(lines.some(cardBottom(t)), `${where}: the card's bottom border is gone${show}`);
    });
  }
  assert.ok(seen >= 15, `${seen} screens`);
});

// The step screens a 60x20 window still cuts: a row that holds only `…`,
// bare or inside a card's rail, where teaching rows gave way. The screens are
// lessonScreens over every lesson's real step file (liveCourse, not the
// reducer fixtures), each beat opened from the step before it (the lessons
// before finished) and from the map (none finished, so a step can open more
// guided: the "(skipped)" labels), each step's first beat opened eased, one
// tier easier with "A little more help" (easedOpenings: the "eased open"
// labels), plus lesson 1's walk through the app's screens on the stable
// fixture (the labels without a lesson id).
// teach-merged 1.5 scopes "no teaching line is cut" to the intro, complete
// and next screens; this list keeps the step screens' cuts from growing
// unseen, and gives each beat's the reason it is cut. A beat's opening
// screen from the step before or from the map is never on it: the learner
// meets every line they need to act (ticket 27's verify pass). An eased
// opening is, only where it was cut so before the r27 fixes. `both` lists the
// screens cut in Unicode and ASCII, `full` and `ascii` the ones cut in only
// one. Most are hint screens: lessonScreens fails a check beat with a long
// stand-in message ("<item> is not there yet: do the step, then look
// again."), and learn-check-says.test.mjs measures the real ones.
const CUT_AT_60X20 = {
  // Lesson 1's walk, on the stable fixture.
  W3: { why: 'the check\'s real FAIL message for an empty version.txt fills the hint box, so the goal and command give way (in ASCII, from hint 1)', both: ['hint 2', 'hint 3'], ascii: ['hint 1', 'bottom'] },
  W5: { why: 'a wrong pick\'s feedback and the options are kept rows, so the card\'s lines above them give way', both: ['wrong'] },
  // Beginner.
  'b-1 W2.0': { why: 'the FAIL row, the PATH hint and the back offer to step 1: the goal\'s second row and the command give way', both: ['hint 2', 'hint 3', 'hint 4', 'hint 5', 'hint 6', 'hint 2 (skipped)', 'hint 3 (skipped)', 'hint 4 (skipped)', 'hint 5 (skipped)', 'hint 6 (skipped)'] },
  'b-1 Y3.0': { why: 'a CHALLENGE check beat: the check\'s message, then its hints, under the goal and the git diff note: the note, and from hint 2 the goal, give way', both: ['hint 1', 'hint 2', 'hint 3', 'hint 4', 'hint 5', 'hint 6', 'checking, hint open', 'hint 1 (skipped)', 'hint 2 (skipped)', 'hint 3 (skipped)', 'hint 4 (skipped)', 'hint 5 (skipped)', 'hint 6 (skipped)', 'checking, hint open (skipped)'] },
  'b-2 W1.2': { why: 'the four mode notes and the hint box: the Accept edits note gives way', both: ['hint 1', 'hint 1 (skipped)'] },
  'b-2 Y4.0': { why: 'the bottom rung\'s command in the hint box: the goal\'s last rows give way (in ASCII, also while r checks)', both: ['bottom', 'bottom (skipped)'], ascii: ['checking, hint open', 'checking, hint open (skipped)'] },
  'b-3 W2.0': { why: 'opened from the map at GUIDED, the plan prompt shows on the card and is also the bottom rung: under the hint box its last rows give way', both: ['hint 1 (skipped)', 'bottom (skipped)'] },
  'b-3 W3.0': { why: 'opened from the map at GUIDED, the /btw question shows on the card under the overlay and steering notes: under the hint box it gives way', both: ['hint 1 (skipped)'] },
  'b-3 Y3.0': { why: 'hints 3 and on are long: the Done when line gives way', both: ['hint 3', 'hint 4', 'hint 5', 'hint 6', 'hint 3 (skipped)', 'hint 4 (skipped)', 'hint 5 (skipped)', 'hint 6 (skipped)'] },
  'b-4 W5.0': { why: 'opened from the map at GUIDED, the refactor prompt shows on the card and again as the bottom rung: its card rows give way (in ASCII, also under the hint that names the approach)', both: ['bottom (skipped)'], ascii: ['hint 1 (skipped)'] },
  'b-4 W5.1': { why: 'the FAIL row, the bottom rung\'s command and the back offer to step 5: the card\'s last lines give way, and opened from the map, the commit prompt on the card too', both: ['bottom', 'hint 1 (skipped)', 'hint 2 (skipped)', 'bottom (skipped)', 'checking, hint open (skipped)'] },
  'b-4 Y5.0': { why: 'the bottom rung\'s command in the hint box: the goal\'s last row and "No commands this time" give way', both: ['bottom', 'bottom (skipped)'] },
  'b-5 R1.0': { why: 'a warm-up\'s wrong pick: the feedback and the options are kept rows, so the title, the "Warm-up from" line and the explainer give way', both: ['wrong', 'wrong (skipped)'] },
  'b-5 R2.0': { why: 'a warm-up\'s wrong pick: the feedback and the options are kept rows, so the title and the "Warm-up from" line give way', both: ['wrong', 'wrong (skipped)'] },
  'b-5 W2.4': { why: 'the three-row goal, four instruction files with who gets each, a line each, and the long hook hint: the last files\' lines give way', both: ['hint 1', 'hint 1 (skipped)'] },
  'b-5 W3.0': { why: 'the bottom rung\'s two commit commands in the hint box: the goal gives way, and opened from the map, the commands on the card too', both: ['bottom', 'bottom (skipped)', 'checking, hint open (skipped)'] },
  'b-capstone T1.0': { why: 'the FAIL row and the hint ladder under the bug report note: the note\'s last rows, and on hint 3 the goal, give way', both: ['hint 1', 'hint 2', 'hint 3', 'hint 4', 'bottom', 'checking, hint open', 'hint 1 (skipped)', 'hint 2 (skipped)', 'hint 3 (skipped)', 'hint 4 (skipped)', 'bottom (skipped)', 'checking, hint open (skipped)'] },
  'b-capstone T5.0': { why: 'the FAIL row, the You need hint\'s commands (hint 2) and the back offer to step 4: from that rung the goal\'s last rows give way (in ASCII, also while r checks)', both: ['hint 3', 'hint 4', 'hint 5', 'hint 6', 'hint 3 (skipped)', 'hint 4 (skipped)', 'hint 5 (skipped)', 'hint 6 (skipped)'], ascii: ['checking, hint open', 'checking, hint open (skipped)'] },
  'b-capstone T8.0': { why: 'the hint ladder and the back offer: from hint 2 the goal gives way (in ASCII, from hint 1 the save note\'s last row)', both: ['hint 2', 'hint 3', 'hint 4', 'hint 5', 'hint 6', 'hint 2 (skipped)', 'hint 3 (skipped)', 'hint 4 (skipped)', 'hint 5 (skipped)', 'hint 6 (skipped)'], ascii: ['hint 1', 'hint 1 (skipped)'] },
  // Intermediate. "Eased" screens open a step one tier easier, with the
  // "A little more help" line (easedOpenings); these were cut so at 574beed.
  'i-1 W1.0': { why: 'eased to GUIDED, the long curl command shows on the card above the "A little more help" line: its last rows give way', both: ['eased open', 'eased open (skipped)'] },
  'i-2 W3.0': { why: 'eased to GUIDED, the hook block and the "A little more help" line: a code line and the note under it give way', both: ['eased open', 'eased open (skipped)'] },
  'i-2 Y3.0': { why: 'eased to GUIDED, the bottom lines show on the card above the "A little more help" line: the two commands give way', both: ['eased open', 'eased open (skipped)'] },
  'i-3 Y4.0': { why: 'the commit check\'s FAIL row and its three-row command under h: the goal\'s second row gives way', both: ['bottom', 'bottom (skipped)'] },
  'i-4 Y1.0': { why: 'a question\'s feedback and options are kept rows: the scenario note gives way after the pick', both: ['wrong', 'answered', 'wrong (skipped)', 'answered (skipped)'] },
  'i-4 Y4.0': { why: 'hints 3 and on are long: the card\'s last lines give way', both: ['hint 3', 'hint 4', 'hint 5', 'hint 6', 'hint 3 (skipped)', 'hint 4 (skipped)', 'hint 5 (skipped)', 'hint 6 (skipped)'] },
  'i-5 W1.0': { why: 'the hooks download block and the hint box: code lines and the Done when line give way', both: ['hint 1', 'hint 1 (skipped)'] },
  'i-5 W2.0': { why: 'the hooks block and the hint box: code lines give way', both: ['hint 1', 'hint 1 (skipped)'] },
  'i-5 Y4.0': { why: 'hints 5 and 6 are long: the card\'s last lines give way', both: ['hint 5', 'hint 6'] },
  'i-6 W1.0': { why: 'opened from the map at GUIDED, the long curl URL shows on the card and again as the bottom rung (Quest Q2)', both: ['bottom (skipped)'] },
  'i-6 W4.0': { why: 'eased to GUIDED, the three notes (the SHA, the report-only flag, the prompt suggestion) and the "A little more help" line: the last note gives way', both: ['eased open', 'eased open (skipped)'] },
  'i-6 Y1.0': { why: 'the teammate note, the decision, the code block and the hint box: the goal\'s second row gives way', both: ['hint 1', 'hint 1 (skipped)'] },
  'i-6 Y3.0': { why: 'the hook\'s code block and the hint box, or eased to GUIDED the "A little more help" line: its last line and the note give way', both: ['hint 1', 'hint 1 (skipped)', 'eased open', 'eased open (skipped)'] },
  'i-7 Y3.0': { why: 'the long check item\'s FAIL row and the hint ladder: the card\'s last lines give way (in ASCII, from hint 1)', both: ['hint 2', 'hint 3', 'bottom'], ascii: ['hint 1'] },
  'i-8 W1.0': { why: 'opened from the map at GUIDED, the install commands show on the card: under the hint box their last rows give way', both: ['hint 1 (skipped)'] },
  'i-8 Y5.0': { why: 'the save line, the --json note and the check\'s FAIL message under h: the note\'s last row gives way', both: ['hint 1', 'bottom', 'hint 1 (skipped)', 'bottom (skipped)'] },
  // Advanced.
  'a-1 W1.0': { why: 'opened from the map at GUIDED, the commit command shows on the card: under the hint box it gives way (in ASCII, from hint 1)', both: ['hint 2 (skipped)'], ascii: ['hint 1 (skipped)', 'hint 3 (skipped)'] },
  'a-2 W2.0': { why: 'the chart\'s four questions as notes under the feedback: the notes give way after the pick', both: ['wrong', 'answered', 'wrong (skipped)', 'answered (skipped)'] },
  'a-2 Y2.1': { why: 'the two notes under the long check message: the notes give way', both: ['hint 1', 'hint 2', 'hint 1 (skipped)', 'hint 2 (skipped)'] },
  'a-3 W1.0': { why: 'opened from the map at GUIDED, the pattern command shows on the card: under the hint box it gives way; eased from the map, the practice migration\'s note keeps its target, import.meta.dirname, which the learner needs to judge the diff, and the command\'s last rows give way; in ASCII the bottom rung\'s lead-in takes two rows and the note\'s last rows give way, the command whole', both: ['hint 1 (skipped)', 'hint 2 (skipped)', 'bottom (skipped)', 'eased open (skipped)'], ascii: ['bottom'] },
  'a-3 W2.0': { why: 'eased to GUIDED, the /goal command, its two notes and the "A little more help" line: the second note\'s last rows give way (pre-existing at 574beed)', both: ['eased open', 'eased open (skipped)'] },
  'a-3 W4.1': { why: 'opened from the map at GUIDED, the text bottom line shows on the card: under the hint box it gives way', both: ['hint 1 (skipped)', 'hint 2 (skipped)', 'bottom (skipped)'] },
  'a-3 Y3.1': { why: 'the bottom line adds "Press h again": the Done when line gives way', both: ['hint 2', 'hint 2 (skipped)'] },
  'a-3 Y5.2': { why: 'in ASCII, the long check item and the back line: the title and the say line give way', ascii: ['hint 2', 'hint 3', 'hint 4', 'hint 5', 'hint 6', 'hint 2 (skipped)', 'hint 3 (skipped)', 'hint 4 (skipped)', 'hint 5 (skipped)', 'hint 6 (skipped)'] },
  'a-4 W1.0': { why: 'the claude -p code block under its hint, or eased to HINTED the "A little more help" line: the goal and code lines give way (the hint screen hides the title too; both pre-existing at 574beed)', both: ['hint 1', 'hint 1 (skipped)', 'eased open', 'eased open (skipped)'] },
  'a-4 W3.0': { why: 'eased to GUIDED, the "A little more help" line: the quoted outcome under the run line gives way (pre-existing at 574beed)', both: ['eased open', 'eased open (skipped)'] },
  'a-5 Y3.0': { why: 'in ASCII, the run-record note (TRIAGE-4 a-5 #11) above the two bottom commands: its last row gives way', ascii: ['bottom'] },
  'a-5 Y4.0': { why: 'the "Don\'t tear down first" note (TRIAGE-4 a-5 #11) under the long check item: its last row gives way to the hint box (played through; opened from the map it fits)', both: ['hint 1'] },
  'a-5 W1.0': { why: 'the subscription-token line under the goal and the code window (TRIAGE-3 a-5 #3): once the watching line or the "A little more help" line joins, its last rows give way; the opening screen shows it whole', both: ['waiting', 'waiting (skipped)', 'eased open', 'eased open (skipped)'] },
  'a-5 Y1.0': { why: 'the checkout-and-Node.js criterion as a note under the long goal (27, pattern M): under the hint box, or eased with the "A little more help" line, its last rows give way; the opening screen shows it whole', both: ['hint 1', 'hint 1 (skipped)', 'eased open', 'eased open (skipped)'] },
  'a-6 Y4.0': { why: 'in ASCII, the .gitignore criterion as a note under the hint box: its last row gives way', ascii: ['hint 1', 'hint 1 (skipped)'] },
  'a-6 W4.0': { why: 'opened from the map at GUIDED, the commit command shows on the card and again as the bottom rung', both: ['bottom (skipped)'] },
  'a-7 W3.0': { why: 'a-7\'s long check item and hint ladder: the goal and the eased line give way, and opened from the map, the commands on the card too', both: ['hint 1', 'fail (skipped)', 'hint 1 (skipped)', 'hint 2 (skipped)', 'hint 3 (skipped)', 'hint 4 (skipped)', 'bottom (skipped)'] },
  'a-7 W4.1': { why: 'opened from the map at GUIDED, the long runner command shows on the card and again as the bottom rung', both: ['hint 1 (skipped)', 'bottom (skipped)'] },
  'a-7 C.0': { why: 'a-7\'s long check items under the hint ladder: the run line and the note give way', both: ['hint 1', 'hint 1 (skipped)'] },
  'a-capstone T1.2': { why: 'the two notes (TRIAGE-4 a-capstone #3) under the long check item: their last rows give way to the hint box and the bottom command', both: ['hint 1', 'hint 2', 'bottom', 'hint 1 (skipped)', 'hint 2 (skipped)', 'bottom (skipped)'] },
  'a-capstone T4.0': { why: 'in ASCII, under the hint box: the note\'s last row and "No commands this time" give way', ascii: ['hint 1', 'hint 1 (skipped)'] },
};

// A row that holds only `…` (`...` in ASCII), bare or inside a card's rail:
// where `fit` cut teaching rows.
const cutRow = (t) => (l) => l.trim() === t.glyph.ellipsis || l.trim() === `${t.glyph.rail}  ${t.glyph.ellipsis}`;
// lessonScreens over every lesson's real step file, played through and then
// opened from the map, labelled as lessonWalks labels them; then each step's
// opening screen eased (easedOpenings), both ways.
const liveWalks = async () => {
  const { easedOpenings, lessonScreens, liveCourse } = await import('./learn-drive.mjs');
  const walks = (screensOf) => [false, true].flatMap((skipped) => liveCourse.filter((l) => l.content).flatMap((l) => screensOf(l.id, liveCourse, { skipped })
    .map(([label, s]) => [`${label}${skipped ? ' (skipped)' : ''}`, s])));
  return [...walks(lessonScreens), ...walks(easedOpenings)];
};

test('the step screens a 60x20 window cuts on the real step files are the known ones, each with its reason; no opening screen is cut, and 80x24 cuts none', async () => {
  const all = [...screens, ...await liveWalks()];
  const lessons = new Set(allCourse.filter((l) => l.content).map((l) => l.id));
  assert.ok([...lessons].every((id) => all.some(([label]) => label.startsWith(`${id} `))), 'every lesson with a step file');
  for (const [beat, c] of Object.entries(CUT_AT_60X20)) {
    assert.ok(c.why?.length > 10, `${beat}: say why it is cut`);
    const listed = [...(c.both ?? []), ...(c.full ?? []), ...(c.ascii ?? [])];
    assert.ok(listed.length, `${beat}: no screen`);
    // A screen cut in both character sets is listed once, under `both`.
    assert.equal(new Set(listed).size, listed.length, `${beat}: a screen listed twice`);
    for (const screen of listed) assert.doesNotMatch(screen, /^open( \(skipped\))?$/, `${beat}: an opening screen is never a known cut`);
  }
  for (const capName of ['full', 'ascii']) {
    const t = theme(CAPS[capName]);
    const cut = (cols, rows) => all.filter(([, s]) => render(s, { cols, rows }, t).map(strip).some(cutRow(t))).map(([l]) => l);
    const known = Object.entries(CUT_AT_60X20).flatMap(([beat, c]) => [...(c.both ?? []), ...(c[capName] ?? [])].map((screen) => `${beat} ${screen}`));
    const now = cut(60, 20);
    assert.deepEqual(now.filter((l) => /^\S+ \S+\.\d+ open( \(skipped\))?$/.test(l)), [], `${capName}: an opening screen is cut at 60x20`);
    assert.deepEqual(now.filter((l) => !known.includes(l)), [], `${capName}: cut at 60x20, and not a known cut`);
    assert.deepEqual(known.filter((l) => !now.includes(l)), [], `${capName}: a known cut that 60x20 no longer cuts`);
    assert.deepEqual(cut(80, 24), [], capName);
  }
});

test('fit: each run of cut rows gets its own `…`, a lone row is never swapped for one, and kept rows stay', async () => {
  const { fit } = await import('../../learn/lib/render.mjs');
  const keep = (text) => ({ keep: true, text });
  const body = ['a1', 'a2', 'a3', keep('Q'), keep('o1'), 'b1', 'b2', keep('F'), 'c1'];
  // Two rows over: a lone c1 would free nothing, so b1 and b2 go under one
  // `…`; then a2 and a3 go under a second.
  assert.deepEqual(fit(body, 8, false, '…'), ['a1', 'a2', 'a3', 'Q', 'o1', '…', 'F', 'c1']);
  assert.deepEqual(fit(body, 7, false, '…'), ['a1', '…', 'Q', 'o1', '…', 'F', 'c1']);
  // Kept rows alone are taller than the room: they stay, and the caller
  // makes room.
  assert.deepEqual(fit([keep('Q'), 'x', 'y', keep('F')], 2, false, '…'), ['Q', '…', 'F']);
  // Inside a card the `…` carries the rail.
  assert.deepEqual(fit([{ text: '| a', rail: '|' }, { text: '| b', rail: '|' }, keep('| F')], 2, false, '…'), ['|  …', '| F']);
});

test('the map keeps a spacer above its footer at 60x20 once the lesson rows close up', () => {
  const lines = render(screens.find(([l]) => l === 'map')[1], { cols: 60, rows: 20 }, theme(CAPS.full)).map(strip);
  const last = lines.findIndex((l) => l.includes('Beginner capstone'));
  assert.equal(lines[last + 1], '', lines.join('\n'));
  assert.ok(lines[last + 2].includes('Each lesson reuses'), lines.join('\n'));
});

// Rows `cut` may shorten by design: a lesson title in the header and on the
// map (one-row labels; spec 3.1) and the evidence line (the file's own text).
test('no line is cut by width anywhere in a row at 60x20 or 80x24, apart from the one-row labels', async () => {
  const all = await everyScreen();
  const t = theme(CAPS.full);
  for (const [cols, rows] of SHORT) {
    for (const [label, state] of all) {
      const lines = render(state, { cols, rows }, t).map(strip);
      const head = state.view === 'map' ? -1 : (rows >= 28 ? 1 : 0);
      lines.forEach((l, i) => {
        if (!l.includes('…') || i === head || l.trim() === '…' || /^\s*│  …$/.test(l) || (state.beat?.status === 'opening' && /│  Checking\b.*…$/.test(l) && width(l) < cols - 1)) return;
        if (state.view === 'map' && /^\s*[❯ ] [✔○] /.test(l)) return;
        // A code block's window marks the lines it leaves out (ticket 90).
        if (l.trim().endsWith(`… ${C.codeMore}`)) return;
        // A code line with a word wider than any row is cut at the row's end,
        // and a row under the block says the page has the rest (ticket 90).
        const sent = flatText(lines.join(' '));
        if (/^\s*│ +\S? +(\d+|↳) /.test(l) && (sent.includes(flatText(C.codeWide('…'))) || sent.includes(flatText(C.codeMore)))) return;
        if (l.includes(C.codeWide('…').slice(0, C.codeWide('…').indexOf('…') + 1))) return;
        if (/ holds |^\s*│ .*\S…$/.test(l) && state.beat?.status === 'done') return;
        assert.fail(`${label} at ${cols}x${rows}, row ${i + 1}: ${l}\n${lines.join('\n')}`);
      });
    }
  }
});

// The level's first warm-up says once why warm-ups exist: the first one the
// learner plays in the level, in whichever lesson that is (194: one
// warm-up, on a missed skill, so b-2 may play none).
const WARMUP_WHY = "A warm-up brings back an earlier lesson from memory. A wrong answer is fine: the lesson's words follow.";
const firstWarmup = (id, saved = {}, lessons = allCourse) => {
  const d = driver({ course: lessons, saved: { format: 1, welcomed: true, lessons: finishedBefore(id, lessons), ...saved } });
  assert.equal(d.state.view, 'intro', id);
  d.key('enter');
  // A later level's first intro asks where to practise first (ticket 86).
  if (d.state.view === 'intro') d.key('enter');
  return d;
};
// The save's lessons up to `id`, with each of `played` (lesson ids whose
// pool has an R1) saved as having played it, so `id`'s warm-up isn't the
// level's first.
const playedWarmups = (id, played, lessons = allCourse) => {
  const before = finishedBefore(id, lessons);
  for (const at of played) before[at] = { ...before[at], warm: ['R1'] };
  return before;
};
// The same state with b-3 saved as having played a warm-up, as for a
// learner back in b-2: b-2's then plays as it would with no explainer.
const withoutWhy = (state) => ({ ...state, progress: { ...state.progress, 'b-3': { ...state.progress['b-3'], warm: ['R1'] } } });
const explains = (d, cols = 80, rows = 24) => flatText(plainAt(d, cols, rows)).includes(flatText(WARMUP_WHY));

// Ticket 187: on a typing beat s is a letter of the answer, so a wrong
// answer the lesson didn't list names the empty line instead; an ask beat
// keeps its s.
test('a wrong typed answer says enter on an empty line shows the answer, not s', () => {
  for (const [id, skill, lessons] of [['b-4', 'exit', bareExit]]) {
    const d = firstWarmup(id, { missed: [skill] }, lessons);
    assert.equal(beatOf(d.state).kind, 'type', id);
    for (const c of 'nope') d.key(c, c);
    d.key('enter');
    const text = flatText(plainAt(d, 80, 24));
    assert.ok(text.includes(flatText(C.lookAgainTyped)), `${id}\n${plainAt(d, 80, 24)}`);
    assert.ok(!text.includes(flatText(C.lookAgain)), id);
  }
  // i-3 R1, an ask beat, with the same bare wrong answer keeps s.
  const ask = firstWarmup('i-3', { missed: ['run-skill'] });
  assert.equal(beatOf(ask.state).kind, 'ask');
  ask.state.beat.feedback = { kind: 'wrong' };
  assert.ok(flatText(plainAt(ask, 80, 24)).includes(flatText(C.lookAgain)), plainAt(ask, 80, 24));
});

test('the level\'s first warm-up says why warm-ups exist, under "Warm-up from lesson N", and no other warm-up does', () => {
  const d = firstWarmup('b-2', { missed: ['start'] });
  assert.equal(stepOf(d.state).id, 'R1');
  const lines = plainAt(d, 80, 24).split('\n');
  const from = lines.findIndex((l) => l.includes(C.warmup(1)));
  assert.ok(from > 0, lines.join('\n'));
  assert.match(lines[from + 1], /│  A warm-up brings back an earlier lesson from memory\. A wrong answer is$/);
  assert.match(lines[from + 2], /│  fine: the lesson's words follow\.$/);
  // b-3 to b-5's warm-ups, after b-2 played one, say nothing more (each R1,
  // missed before).
  for (const id of ['b-3', 'b-4', 'b-5']) {
    const later = firstWarmup(id, { missed: ['plan-mode', 'review-diff', 'start'], lessons: playedWarmups(id, ['b-2']) });
    assert.equal(stepOf(later.state).part, 'Warm-up', id);
    assert.ok(!explains(later), `${id}\n${plainAt(later, 80, 24)}`);
  }
});

test('the explainer goes on the first warm-up the learner plays: b-3\'s, when b-2 played none', () => {
  // All of b-1 right, so nothing missed: b-2 opens on its worked example and
  // saves no warm-up.
  const b2 = firstWarmup('b-2');
  assert.equal(stepOf(b2.state).part, 'Worked example');
  assert.deepEqual(b2.state.progress['b-2'].warm, []);
  assert.ok(!explains(b2), plainAt(b2, 80, 24));
  // A skill missed in b-2: b-3's warm-up is the learner's first, and says why.
  const b3 = firstWarmup('b-3', { missed: ['plan-mode'], lessons: { ...finishedBefore('b-3'), 'b-2': { ...finishedBefore('b-3')['b-2'], warm: b2.state.progress['b-2'].warm } } });
  assert.equal(stepOf(b3.state).part, 'Warm-up');
  assert.ok(plainAt(b3, 80, 24).includes(C.warmup(2)), plainAt(b3, 80, 24));
  assert.ok(explains(b3), plainAt(b3, 80, 24));
  // A lesson played later in the level counts too: b-3 after b-4 played one.
  const after = firstWarmup('b-3', { missed: ['plan-mode'], lessons: { ...finishedBefore('b-3'), 'b-4': { warm: ['R1'] } } });
  assert.equal(stepOf(after.state).part, 'Warm-up');
  assert.ok(!explains(after), plainAt(after, 80, 24));
});

test('the explainer goes on the warm-up b-2 plays: whichever missed skill picks it', () => {
  // R2 recalls status; a learner who missed it gets R2 (tickets 132, 194).
  const d = firstWarmup('b-2', { missed: ['status'] });
  assert.equal(stepOf(d.state).id, 'R2');
  assert.ok(explains(d), plainAt(d, 80, 24));
  playUntil(d, (s) => stepOf(s)?.id !== 'R2');
  assert.equal(stepOf(d.state).part, 'Worked example');
  assert.ok(!explains(d), plainAt(d, 80, 24));
});

test('the explainer is optional: at 60x20 it drops whole, before any teaching line is cut, in full and ascii', () => {
  const seen = { shown: [], dropped: [] };
  for (const missed of [['start'], ['status'], ['exit']]) {
    for (const answer of [[], ['1'], ['1', 's'], ['2'], ['3']]) {
      const d = firstWarmup('b-2', { missed });
      for (const k of answer) d.key(k);
      const at = `${stepOf(d.state).id} after ${answer.join(' ') || 'nothing'}`;
      for (const capName of ['full', 'ascii']) {
        const t = theme(CAPS[capName]);
        for (const [cols, rows] of SHORT) {
          const out = render(d.state, { cols, rows }, t);
          assert.equal(out.length, rows, `${at} at ${cols}x${rows}`);
          for (const line of out) assert.ok(width(line) <= cols - 1, `${at} at ${cols}x${rows}: ${strip(line)}`);
        }
        const lines = render(d.state, { cols: 60, rows: 20 }, t).map(strip);
        const text = flatText(lines.join(''));
        const whole = text.includes(flatText(WARMUP_WHY));
        assert.equal(text.includes(flatText('A warm-up brings back')), whole, `${at} (${capName}) shows part of it\n${lines.join('\n')}`);
        // A screen too tall even without it (R3's longest reason) is cut
        // only once the explainer is gone.
        const cut = lines.some((l) => [t.glyph.ellipsis, `${t.glyph.rail}  ${t.glyph.ellipsis}`].includes(l.trim()));
        assert.ok(!(cut && whole), `${at} (${capName}) cuts a line and keeps the explainer\n${lines.join('\n')}`);
        // Once it drops, what gave way before it comes back: the screen is
        // the one with no explainer at all.
        if (!whole) assert.deepEqual(lines, render(withoutWhy(d.state), { cols: 60, rows: 20 }, t).map(strip), `${at} (${capName})`);
        assert.ok(explains(d), `${at}: 80x24 keeps it`);
        seen[whole ? 'shown' : 'dropped'].push(at);
      }
    }
  }
  assert.ok(seen.shown.includes('R1 after nothing') && seen.dropped.includes('R2 after 2'), JSON.stringify(seen));
});

test('the explainer comes from the content, the warm-up\'s place and the saved warm-ups, and adds nothing to learn.json', () => {
  // Answered, saved, and back on R1 from that save: it shows again, since
  // the save holds no word of it. Resumed on R2, the second warm-up of a
  // save from before 194, it doesn't.
  const d = firstWarmup('b-2', { missed: ['start'] });
  d.key('2');
  assert.equal(d.state.beat.status, 'done');
  const saved = snapshot(d.state);
  // The save has the keys it had before the explainer.
  assert.deepEqual(Object.keys(saved), ['format', 'welcomed', 'eased', 'missed', 'lessons']);
  for (const p of Object.values(saved.lessons)) {
    assert.deepEqual(Object.keys(p), ['step', 'beat', 'done', 'answers', 'levels', 'lessHelp', 'moreHelpAt', 'easedSteps', 'complete', 'warm', 'recalled', 'stamps', 'bottomAt']);
  }
  // The same play after b-3 saved a warm-up says nothing, and saves the same
  // apart from b-3's list.
  const quiet = firstWarmup('b-2', { missed: ['start'], lessons: playedWarmups('b-2', ['b-3']) });
  assert.ok(!explains(quiet));
  quiet.key('2');
  const { 'b-3': b3Saved, ...quietLessons } = snapshot(quiet.state).lessons;
  assert.deepEqual(b3Saved.warm, ['R1']);
  const { 'b-3': _, ...savedLessons } = saved.lessons;
  assert.deepEqual({ ...snapshot(quiet.state), lessons: quietLessons }, { ...saved, lessons: savedLessons });
  for (const [step, shows] of [['R1', true], ['R2', false]]) {
    const back = driver({ course: allCourse, saved: { ...saved, lessons: { ...saved.lessons, 'b-2': { ...saved.lessons['b-2'], step, beat: 0, warm: ['R1', 'R2'] } } } });
    back.key('enter');
    assert.equal(stepOf(back.state).id, step);
    assert.equal(explains(back), shows, `${step}\n${plainAt(back, 80, 24)}`);
  }
  // With no warm-ups in b-2, b-3 is the level's first lesson that has them.
  const lessons = allCourse.map((l) => (l.id === 'b-2' ? { ...l, content: { ...l.content, warmup: [] } } : l));
  const b3 = driver({ course: lessons, saved: { format: 1, welcomed: true, missed: ['plan-mode'], lessons: finishedBefore('b-3', lessons) } });
  b3.key('enter');
  assert.equal(stepOf(b3.state).part, 'Warm-up');
  assert.ok(explains(b3), plainAt(b3, 80, 24));
});

test('each level has its own first warm-up: a later level\'s first warm-up says why too', () => {
  // A made-up Intermediate lesson after the Beginner path: b-2's content
  // under the id i-1, so its warm-ups recall Beginner lessons.
  const b2 = allCourse.find((l) => l.id === 'b-2');
  const as = (lessons, id) => lessons.map((l) => (l.id === id ? { ...b2, id, level: 'intermediate', content: { ...b2.content, lesson: id } } : l));
  const lessons = as(allCourse, 'i-1');
  // Beginner lessons that played warm-ups don't count for Intermediate.
  const i1 = firstWarmup('i-1', { missed: ['start'], lessons: playedWarmups('i-1', ['b-2', 'b-3'], lessons) }, lessons);
  assert.equal(i1.state.lesson, 'i-1');
  assert.equal(stepOf(i1.state).part, 'Warm-up');
  assert.ok(explains(i1), plainAt(i1, 80, 24));
  const b2First = firstWarmup('b-2', { missed: ['start'] }, lessons);
  assert.ok(explains(b2First), plainAt(b2First, 80, 24));
  // A second Intermediate lesson's warm-up, after i-1 played one, says
  // nothing more; after i-1 played none, it is the level's first.
  const i2 = as(lessons, 'i-2');
  const second = firstWarmup('i-2', { missed: ['start'], lessons: playedWarmups('i-2', ['i-1'], i2) }, i2);
  assert.equal(stepOf(second.state).part, 'Warm-up');
  assert.ok(!explains(second), plainAt(second, 80, 24));
  const first = firstWarmup('i-2', { missed: ['start'] }, i2);
  assert.equal(stepOf(first.state).part, 'Warm-up');
  assert.ok(explains(first), plainAt(first, 80, 24));
});

// Ticket 178: a warm-up from a level index names the index, and so do the
// app's words around its quotes; its relative links point into the index
// page, and p gives the index's address. The Beginner index sits in another
// folder than i-1's page, so a link resolved against i-1's page fails.
const LESSON_WORDS = ['The lesson says', "lesson's words", 'lesson page', 'an earlier lesson'].map(flatText);
test('a level index warm-up\'s words: each takes the place of the lesson words of its name, and names no lesson', () => {
  for (const [k, v] of Object.entries(C.fromIndex)) {
    assert.equal(typeof v, typeof C[k], k);
    const said = typeof v === 'function' ? v('...') : v;
    assert.ok(said.includes(TERMS.levelIndex) && !/lesson/.test(said), `${k}: ${said}`);
  }
});

for (const [level, name] of [['intermediate', 'Intermediate'], ['beginner', 'Beginner']]) {
  test(`a level index warm-up (${level}): the index's words, links and page, at 60x20 and 80x24`, () => {
    const text = DEMO_I1_INDEX.replace('- from: intermediate-index', `- from: ${level}-index`)
      .replace('- right: "A hook"', '- why: "A hook runs every time."\n- right: "A hook"');
    const lessons = allCourse.map((l) => (l.id === 'i-1' ? { ...l, content: parseLesson(text, 'i-1.md') } : l));
    // A missed skill comes first, so R2 is the level's first warm-up.
    const d = firstWarmup('i-1', { missed: ['when-to-use'] }, lessons);
    assert.equal(stepOf(d.state).id, 'R2');
    const docs = 'https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/blob/main/docs';
    const at = (cols, rows) => {
      for (const caps of [CAPS.full, CAPS.ascii]) fits(d.state, [cols, rows], theme(caps), `${cols}x${rows} ${caps.unicode ? 'unicode' : 'ascii'}`);
      const screen = plainAt(d, cols, rows);
      assert.deepEqual(LESSON_WORDS.filter((w) => flatText(screen).includes(w)), [], screen);
      return flatText(screen);
    };
    for (const [cols, rows] of SHORT) {
      const screen = at(cols, rows);
      assert.ok(screen.includes(flatText(`Warm-up from the ${name} level index`)), screen);
      assert.ok(screen.includes(flatText(C.fromIndex.warmupWhy)), screen);
    }
    // w gives the beat's why in the index's words.
    d.key('w');
    assert.equal(d.state.overlay, 'why');
    for (const [cols, rows] of SHORT) assert.ok(at(cols, rows).includes(flatText(C.fromIndex.why)), plainAt(d, cols, rows));
    d.key('w');
    // A wrong pick shows its because, whose link is relative to the index page.
    d.key(String(beatOf(d.state).options.findIndex((o) => o.kind === 'wrong') + 1));
    for (const [cols, rows] of SHORT) assert.ok(at(cols, rows).includes(flatText(C.fromIndex.trueOfElse)), plainAt(d, cols, rows));
    const links = [...render(d.state, { cols: 80, rows: 24 }, theme(CAPS.full)).join('').matchAll(/\x1b\]8;;([^\x07]*)\x07/g)].map((m) => m[1]).filter(Boolean);
    assert.ok(links.includes(`${docs}/${level}/01-first-skill.md`), links.join(' '));
    d.key('p');
    assert.equal(d.state.overlay, 'page');
    for (const [cols, rows] of SHORT) {
      const screen = plainAt(d, cols, rows).split('\n').map((x) => x.trim()).join('');
      at(cols, rows);
      assert.ok(screen.includes(C.fromIndex.pageTitle), screen);
      assert.ok(screen.includes(`${docs}/${level}/README.md`), screen);
      assert.ok(screen.includes('lesson-feedback.yml&lesson=i-1'), screen);
    }
    d.key('p');
    // s shows the answer in the index's words.
    d.key('s');
    for (const [cols, rows] of SHORT) assert.ok(at(cols, rows).includes(flatText(C.fromIndex.theAnswer)), plainAt(d, cols, rows));
    // The play goes on to i-1's own steps.
    playUntil(d, (s) => stepOf(s)?.id === 'W1');
  });
}

// A missed Windows note leaves a broken file (ticket 165), so on Windows the
// note stays whole on every state of its step, at both short sizes, in ASCII
// and in Windows Terminal.
test('a Windows note is never cut: on Windows at 60x20 and 80x24 the whole note is on every screen of its step', async () => {
  const { course } = await import('./learn-drive.mjs');
  // A beat's notes: an intro's own (i-1's) shows on the intro.
  const notes = course.filter((l) => l.content).flatMap((l) => readFileSync(join(root, ...(l.level === 'beginner' ? ['checks/test/fixtures/reducer-course'] : ['learn', 'lessons']), `${l.id}.md`), 'utf8').replace(/^## intro\n[\s\S]*?\n(?=## )/m, '').split('\n')
    .flatMap((line) => line.match(/^- win-note: "(.*)"$/)?.slice(1) ?? []));
  assert.equal(notes.length, 3, notes.join('\n'));
  const all = (await lessonWalks()).filter(([, s]) => s.view === 'step' && s.beat && beatOf(s).winNote);
  const toast = { kind: 'save', message: 'EACCES: permission denied, open learn.json' };
  const states = {};
  const seen = new Set();
  // Screens, at a size, where either Windows theme shows this.
  const split = new Set();
  const noToast = new Set();
  for (const [label, state] of all) {
    const [, beatAt, name] = label.match(/^(\S+ \S+) (.+?)(?: \(skipped\))?$/);
    (states[beatAt] ??= new Set()).add(name);
    const note = beatOf(state).winNote;
    seen.add(note);
    for (const [capName, caps] of [['ascii', CAPS.ascii], ['terminal', { ...CAPS.full, win32: true }]]) {
      const t = theme(caps);
      for (const [cols, rows] of SHORT) {
        const at = `${label} at ${cols}x${rows}`;
        const lines = render(state, { cols, rows }, t).map(strip);
        assert.ok(flatText(lines.join('')).includes(flatText(note)), `${at} (${capName}) loses the Windows note\n${lines.join('\n')}`);
        // flatText reads past a word broken across two lines, so each word
        // of the note is also looked for whole on one line.
        if (note.replace(/[`*]/g, '').split(' ').some((word) => !lines.some((l) => l.includes(word)))) split.add(at);
        if (!render({ ...state, toast }, { cols, rows }, t).some((l) => strip(l).includes('EACCES'))) noToast.add(at);
      }
    }
  }
  assert.deepEqual([...seen].sort(), [...notes].sort());
  // Every state the walks reach: a check beat's every rung, and a self beat's
  // open card and any rung behind h.
  assert.deepEqual(Object.fromEntries(Object.entries(states).map(([at, names]) => [at, [...names]])), {
    'b-1 C.0': ['open', 'waiting', 'checking', 'fail', 'hint 1', 'hint 2', 'hint 3', 'bottom', 'checking, hint open', 'done'],
    'b-2 W2.1': ['open'],
    'b-capstone T1.2': ['open', 'hint 1'],
  });
  // A code span wider than the line breaks at a space where that costs no
  // row (wrapRuns, r27 E14), so at 60x20 the capstone's Set-Content command
  // keeps every word whole, where it used to split its path.
  assert.deepEqual([...split], []);
  // The kept note leaves a toast no room on b-1's Check at 60x20, so the toast
  // goes (spec 3.1: a toast gives way to kept rows).
  assert.deepEqual([...noToast], ['b-1 C.0 hint 2 at 60x20', 'b-1 C.0 hint 2 (skipped) at 60x20']);
});

// The Why line on GUIDED cards (ticket 145): on a do or ask beat at
// effective GUIDED, the beat's first `why` quote under the step title.
const openAt = (id, step, beat, extra = {}, before = finishedBefore(id)) => {
  const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { ...before, [id]: { step, beat, warm: [], ...extra } } } });
  d.key('enter');
  return d;
};
// The Why line's rows: its lead's row, and those under it up to the card's
// next blank row.
const whyRows = (lines) => {
  const i = lines.findIndex((l) => l.includes(`${C.whyLead} "`));
  if (i < 0) return [];
  const end = lines.findIndex((l, k) => k > i && /^\s*[│|]$/.test(l.trimEnd()));
  return lines.slice(i, end < 0 ? i + 1 : end);
};

test('a GUIDED card shows its Why line under the title: b-4 W3 is the design\'s at 80x24', () => {
  const d = openAt('b-4', 'W3', 0);
  assert.equal(tierOf(d.state), 'guided');
  const lines = render(d.state, { cols: 80, rows: 24 }, theme(CAPS.full)).map((l) => strip(l).trimEnd());
  // energy-and-teaching.md 3.1, less Pip on the card's top border (a motion ticket).
  const mockup = [
    '   B4   Keep a session on track                                    GUIDED ★☆☆',
    null,
    '  ────────────────────────────────────────────────────────────────────────────',
    '',
    null,
    '  │',
    '  │  Compact',
    '  │  Why: "Compact when you want to keep going on the same task; clear when',
    '  │       you start a different one."',
    '  │',
    '  │  Compact, telling Claude what to keep:',
    '  │',
    '  │   › /compact keep what we learned about check-links.js',
    '  ╰───────────────────────────────────────────────────────────────────────────',
  ];
  mockup.forEach((row, i) => {
    if (row !== null) assert.equal(lines[i], row, `row ${i + 1}\n${lines.join('\n')}`);
  });
  // The beat waits for the learner's word, its done-label, so space gives it
  // (ticket 27's verify pass: enter only goes on where nothing needs confirming).
  assert.equal(lines[23], '   space  it compacted    w why    m map    c card    q quit');
});

// A made-up lesson 2 whose one GUIDED step has `why` lines on a predict, a
// do, an ask, a type and a self beat.
const WHY_B2 = `---
lesson: b-2
title: "Demo"
stamp: "Verified against Claude Code v2.1.292 (stable) on 2026-10-15"
next: b-3
---

## intro
- minutes: "about 20 minutes"
- can: "do it"

## steps

### W1 | Worked example step 1 of 1 | Try the mode
- tier: guided
- skill: plan-mode
- where: claude
- beat: predict
- ask: Guess: which mode comes first?
- option: Manual
- right: Plan
- reveal: "Plan comes first."
- why: "A predict reason."
- beat: do
- verify: self
- done-label: done
- do: "Press the key."
- why: "A do reason."
- why: "A second do reason."
- beat: ask
- ask: Which mode is on?
- right: "Plan"
- wrong: "Manual"
- because: "Manual is another."
- why: "An ask reason."
- beat: type
- ask: Which key switches the mode?
- accept: Shift+Tab
- reveal: "Shift+Tab switches it."
- why: "A type reason."
- beat: self
- done-label: yes, I can
- self: "Say when you would pick Plan."
- why: "A self reason."
`;

test('the Why line shows on do and ask beats at GUIDED, never on a predict, type or self beat, which keep it behind w', async () => {
  const { courseWith } = await import('./learn-drive.mjs');
  const lessons = courseWith({ 'b-2': WHY_B2 });
  const at = (beat) => {
    const d = driver({ course: lessons, saved: { format: 1, welcomed: true, lessons: { 'b-2': { step: 'W1', beat, warm: [] } } } });
    d.key('enter');
    assert.equal(tierOf(d.state), 'guided');
    return d;
  };
  const [predict, doBeat, ask, type, self] = [0, 1, 2, 3, 4].map((beat) => render(at(beat).state, { cols: 80, rows: 24 }, theme(CAPS.full)).map(strip));
  for (const [beat, lines] of [[3, type], [0, predict], [4, self]]) {
    assert.equal(beatOf(at(beat).state).kind, ['predict', 'do', 'ask', 'type', 'self'][beat]);
    assert.deepEqual(whyRows(lines), [], lines.join('\n'));
  }
  // On a type beat w is a letter of the answer.
  for (const [beat, reason] of [[0, /A predict reason\./], [4, /A self reason\./]]) {
    const behind = at(beat);
    behind.key('w');
    assert.equal(behind.state.overlay, 'why');
    assert.match(plainAt(behind, 80, 24), reason);
  }
  // The beat's first `why` line only: the rest stay behind w.
  assert.deepEqual(whyRows(doBeat).map((l) => l.trim()), ['│  Why: "A do reason."']);
  assert.deepEqual(whyRows(ask).map((l) => l.trim()), ['│  Why: "An ask reason."']);
  // One blank row under it, before the question too.
  for (const lines of [doBeat, ask]) assert.ok(!lines.some((l, i) => l.trim() === '│' && lines[i + 1]?.trim() === '│'), lines.join('\n'));
});

// Effective GUIDED is the trigger: what the learner gets, not what the plan says.
const atBeat = (id, step, beat) => (s) => s.view === 'step' && s.lesson === id && stepOf(s).id === step && s.pos.beat === beat;
const B3_W1_WHY = '"Asking for a change and accepting whatever comes back is how sessions go wrong."';
const whyText = (d, cols = 80, rows = 24) => flatText(whyRows(render(d.state, { cols, rows }, theme(CAPS.full)).map(strip)).join(''));

test('the Why line follows the effective tier: less help lifts GUIDED to HINTED and hides it, an ease lowers a step to GUIDED and shows it', () => {
  // b-4 W3, GUIDED on the plan; "less help" lifts it to HINTED.
  const lifted = openAt('b-4', 'W3', 0, { lessHelp: true });
  assert.equal(tierOf(lifted.state), 'hinted');
  const lines = render(lifted.state, { cols: 80, rows: 24 }, theme(CAPS.full)).map(strip);
  assert.deepEqual(whyRows(lines), []);
  assert.match(lines.at(-1), /w why/);
  // b-3 W1 is HINTED on the path: its third beat keeps its why behind w.
  const plain = openAt('b-3', 'R1', 0, { warm: ['R1'] });
  playUntil(plain, atBeat('b-3', 'W1', 2));
  assert.equal(tierOf(plain.state), 'hinted');
  assert.equal(whyText(plain), '');
  // R1 (plan-mode) missed eases W1 to GUIDED: the reason is on the card.
  const eased = openAt('b-3', 'R1', 0, { warm: ['R1'] });
  eased.key('enter');
  assert.deepEqual(eased.state.eased, ['plan-mode']);
  playUntil(eased, atBeat('b-3', 'W1', 2));
  assert.equal(tierOf(eased.state), 'guided');
  assert.equal(whyText(eased), flatText(`${C.whyLead} ${B3_W1_WHY}`));
});

// 132's M4 case: a skill this learner never did opens at a first meeting's
// GUIDED. R1 (plan-mode, missed before, so it plays: 194) is typed wrong
// twice, so no recall puts plan-mode on the plan (a right recall would:
// learn-zone.test.mjs).
test('b-3 opened from the map with nothing done shows W1 (plan-mode) at GUIDED with its Why line', () => {
  const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, missed: ['plan-mode'], lessons: {} } });
  if (d.state.view !== 'map') d.key('m');
  while (allCourse[d.state.mapCursor].id !== 'b-3') d.key('down');
  d.key('enter');
  assert.deepEqual([d.state.view, d.state.lesson], ['intro', 'b-3']);
  d.key('enter');
  assert.deepEqual([stepOf(d.state).id, stepOf(d.state).skill], ['R1', 'plan-mode']);
  for (const word of ['tab', 'tab']) {
    for (const c of word) d.key(c, c);
    d.key('enter');
  }
  playUntil(d, atBeat('b-3', 'W1', 2));
  assert.equal(stepOf(d.state).skill, 'plan-mode');
  assert.equal(tierOf(d.state), 'guided');
  for (const [cols, rows] of SHORT) assert.equal(whyText(d, cols, rows), flatText(`${C.whyLead} ${B3_W1_WHY}`), `${cols}x${rows}`);
});

// The GUIDED cards whose Why line gives way, in full or ASCII (the last two
// at 60x20 in ASCII only). At 60x20 teach-merged 1.6 measured one, b-1 W3
// waiting; a hint box, feedback or the y/n before the exact command leaves
// others no room. This list keeps the count from growing unseen, as
// CUT_AT_60X20 does for cuts.
const WHY_DROPS = {
  '60x20': [
    'W3 waiting', 'W3 not yet', 'W3 hint 1', 'W3 hint 2', 'W3 hint 3', 'W3 confirm', 'W3 bottom', 'W3 done', 'W5 wrong', 'W5 revealed', 'W3 broken',
    'b-2 W5.0 open', 'b-3 W5.0 open', 'b-3 W6.3 hint 1', 'b-5 W4.0 hint 1', 'b-5 W4.0 hint 2', 'b-5 W4.0 bottom', 'b-5 W4.0 checking, hint open',
    // Intermediate's Worked examples: a code block, a two-row command or a
    // hint box takes the room.
    'i-1 W4.2 open', 'i-1 W4.2 hint 1', 'i-2 W2.0 open', 'i-2 W2.0 waiting', 'i-2 W2.0 done', 'i-2 W3.0 open', 'i-2 W3.0 waiting', 'i-2 W3.0 done',
    'i-2 W5.0 waiting', 'i-3 W4.0 done', 'i-4 W2.0 open', 'i-4 W2.0 waiting', 'i-4 W2.0 done', 'i-4 W4.0 hint 1', 'i-4 W4.0 done', 'i-4 W5.0 hint 1',
    'i-6 W3.0 open', 'i-6 W3.0 hint 1', 'i-6 W4.0 open', 'i-8 W2.1 hint 1', 'i-8 W2.1 hint 2', 'i-8 W3.0 hint 1', 'i-8 W3.1 open',
    // Advanced: a-1's two merge commands with the merge-commit note, and a-2's chart questions.
    'a-1 W5.0 open', 'a-1 W5.0 waiting', 'a-1 W5.0 fail', 'a-1 W5.0 done', 'a-2 W2.0 open', 'a-2 W2.0 wrong', 'a-2 W2.0 answered',
    // a-3's `/goal` condition and a-4's `claude -p` commands: each is one
    // long line of the page.
    'a-3 W2.0 open', 'a-4 W2.1 open', 'a-4 W2.1 waiting', 'a-4 W2.1 done', 'a-4 W3.0 open',
    // a-6's settings block with the line that says where it goes.
    'a-6 W3.0 open', 'a-6 W3.0 waiting', 'a-6 W3.0 done',
    'b-2 W5.0 open (skipped)', 'b-3 W2.0 open (skipped)', 'b-3 W2.0 hint 1 (skipped)', 'b-3 W2.0 bottom (skipped)', 'b-3 W5.0 open (skipped)',
    'b-3 W6.3 hint 1 (skipped)', 'b-5 W4.0 hint 1 (skipped)', 'b-5 W4.0 hint 2 (skipped)', 'b-5 W4.0 bottom (skipped)',
    'b-5 W4.0 checking, hint open (skipped)', 'i-1 W4.2 open (skipped)', 'i-1 W4.2 hint 1 (skipped)',
    'i-2 W2.0 open (skipped)', 'i-2 W2.0 waiting (skipped)', 'i-2 W2.0 done (skipped)', 'i-2 W3.0 open (skipped)', 'i-2 W3.0 waiting (skipped)',
    'i-2 W3.0 done (skipped)', 'i-2 W5.0 waiting (skipped)', 'i-3 W4.0 done (skipped)', 'i-4 W2.0 open (skipped)', 'i-4 W2.0 waiting (skipped)',
    'i-4 W2.0 done (skipped)', 'i-4 W4.0 hint 1 (skipped)', 'i-4 W4.0 done (skipped)', 'i-4 W5.0 hint 1 (skipped)', 'i-5 W2.0 open (skipped)',
    'i-5 W2.0 waiting (skipped)', 'i-5 W2.0 hint 1 (skipped)', 'i-5 W2.0 done (skipped)', 'i-6 W3.0 open (skipped)', 'i-6 W3.0 hint 1 (skipped)', 'i-6 W4.0 open (skipped)',
    'i-8 W1.0 hint 1 (skipped)', 'i-8 W1.0 hint 2 (skipped)', 'i-8 W1.0 bottom (skipped)', 'i-8 W2.1 hint 1 (skipped)', 'i-8 W2.1 hint 2 (skipped)',
    'i-8 W3.0 hint 1 (skipped)', 'i-8 W3.1 open (skipped)',
    'a-1 W5.0 open (skipped)', 'a-1 W5.0 waiting (skipped)', 'a-1 W5.0 fail (skipped)', 'a-1 W5.0 done (skipped)',
    'a-2 W2.0 open (skipped)', 'a-2 W2.0 wrong (skipped)', 'a-2 W2.0 answered (skipped)',
    'a-3 W2.0 open (skipped)', 'a-4 W2.1 open (skipped)', 'a-4 W2.1 waiting (skipped)', 'a-4 W2.1 done (skipped)', 'a-4 W3.0 open (skipped)',
    'a-6 W3.0 open (skipped)', 'a-6 W3.0 waiting (skipped)', 'a-6 W3.0 done (skipped)', 'W3 opening',
    'i-5 W3.0 hint 1', 'b-3 W1.2 bottom (skipped)', 'i-5 W3.0 hint 1 (skipped)'],
  '80x24': ['W3 hint 2'],
};
// Below 80 columns the key bar keeps its main keys first (spec 3.1), so `w`
// gives way only where the whole bar is wider than the window: a wrong
// answer's bar with "s show answer", as on W5's.
const NO_W_KEY = ['W5 wrong at 60x20 (full)', 'a-2 W2.0 wrong at 60x20 (full)', 'a-2 W2.0 wrong (skipped) at 60x20 (full)',
  'W5 wrong at 60x20 (ascii)', 'a-2 W2.0 wrong at 60x20 (ascii)', 'a-2 W2.0 wrong (skipped) at 60x20 (ascii)'];

test('the Why line is an optional row: it drops whole before any teaching line is cut, and w why stays in the key bar', async () => {
  const all = (await everyScreen()).filter(([, s]) => s.view === 'step' && !s.overlay && tierOf(s) === 'guided' && ['do', 'ask'].includes(beatOf(s).kind) && beatOf(s).why.length);
  const dropped = { '60x20': new Set(), '80x24': new Set() };
  const noKey = [];
  for (const [capName, caps] of [['full', CAPS.full], ['ascii', CAPS.ascii]]) {
    const t = theme(caps);
    const marker = (l) => l.trim() === t.glyph.ellipsis || l.trim() === `${t.glyph.rail}  ${t.glyph.ellipsis}`;
    for (const [cols, rows] of SHORT) {
      for (const [label, state] of all) {
        const where = `${label} at ${cols}x${rows} (${capName})`;
        const lines = render(state, { cols, rows }, t).map(strip);
        const whole = flatText(whyRows(render(state, { cols, rows: 80 }, t).map(strip)).join(''));
        const shown = flatText(whyRows(lines).join(''));
        assert.ok(whole.startsWith(flatText(C.whyLead)), `${where}: a tall window shows the Why line`);
        assert.ok(shown === whole || shown === '', `${where}: the Why line is cut\n${lines.join('\n')}`);
        if (shown) assert.ok(!lines.some(marker), `${where}: a teaching line is cut while the Why line shows\n${lines.join('\n')}`);
        else dropped[`${cols}x${rows}`].add(label);
        // The key bar offers w on every beat with a why, a question before
        // its answer included; the y/n before the exact command has keys of
        // its own.
        if (state.beat.confirm) continue;
        assert.match(strip(render(state, { cols: 120, rows: 40 }, t).at(-1)), /\bw why\b/, `${label} at 120x40 (${capName}): the key bar`);
        if (!/\bw why\b/.test(lines.at(-1))) noKey.push(where);
      }
    }
  }
  assert.ok(all.some(([l]) => l === 'W3 waiting'));
  for (const size of Object.keys(WHY_DROPS)) assert.deepEqual([...dropped[size]], WHY_DROPS[size], size);
  assert.deepEqual(noKey, NO_W_KEY);
});

// A row's text in each color token it is drawn in, as { token: text }. Two
// tokens with one color read as the first (dimText as text).
const colored = (line) => {
  const codes = {};
  for (const [k, [i]] of Object.entries(COLORS)) codes[`38;5;${i}`] ??= k;
  const out = {};
  for (const m of line.matchAll(/\x1b\[(38;5;\d+)m([^\x1b]*)/g)) if (codes[m[1]]) out[codes[m[1]]] = (out[codes[m[1]]] ?? '') + m[2];
  return out;
};

test('the Why line\'s lead is in accent and its quote in text, and a step\'s note and Windows note lines are in text, as a predict beat\'s are', () => {
  const t = theme(CAPS.full);
  const why = render(openAt('b-4', 'W3', 0).state, { cols: 80, rows: 24 }, t).find((l) => strip(l).includes(`${C.whyLead} "`));
  const parts = colored(why);
  assert.equal(parts.accent, `${C.whyLead} `);
  assert.equal(parts.text, '"Compact when you want to keep going on the same task; clear when');
  // b-1 W4's sign-in beat: a do beat with two note lines.
  const lines = render(openAt('b-1', 'W4', 1).state, { cols: 80, rows: 24 }, t);
  for (const note of ['"The first time, Claude Code asks you to sign in."', '"With an API key or a cloud provider, follow the ']) {
    const row = lines.find((l) => strip(l).includes(note));
    assert.ok(row, note);
    assert.ok(colored(row).text?.startsWith(note), `${note}: ${JSON.stringify(colored(row))}`);
    assert.equal(colored(row).muted, undefined, note);
  }
  // b-2 W2's do beat on Windows: its win-note, which never drops.
  const win = theme({ ...CAPS.full, win32: true });
  const winNote = '"If Shift+Tab does nothing, press Alt+M instead"';
  const row = render(openAt('b-2', 'W2', 1).state, { cols: 80, rows: 24 }, win).find((l) => strip(l).includes(winNote));
  assert.ok(row, winNote);
  assert.ok(colored(row).text?.startsWith('"If '), JSON.stringify(colored(row)));
  assert.equal(colored(row).muted, undefined);
});

// Go further (146). The b-4 next screen as energy-and-teaching 3.1 draws it,
// at 80x24. Three rows are not this ticket's and are the app's as it draws
// them: the trail, whose done steps are filled where the mockup drew them
// hollow, the progress rule under it (157), full where the mockup drew a
// plain rule, and B5's mix bar, which is B5's plan. Recall, then compare
// (152) adds its row under the climb, which stays, and the blank above the
// saved line gives way.
const B4_NEXT = `
   B4   Keep a session on track                                    COMPLETE ✔
  ★━━★   ●━━●   ◆   ●━━●━━●   ◆━━◆━━◆━━◆   ★━━★                       14 of 14
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✅ The lesson's check passes: 2 of 2 items
  💬 8 questions answered

  Your climb

                ★★★    CHALLENGE ★★★    just the goal
         ◆◆◆◆◆    HINTED ★★☆    the goal, hints if you ask
  ●●●●●    GUIDED ★☆☆    every command shown

  Say to yourself what B4 taught you, then press space.

  📖 Go further: "Explore the context window: an interactive view of what
     fills a session."

  ▸ Next up   B5   Project memory with CLAUDE.md
     ●●●◆◆◆◆◆◆★★★  A notch harder: it starts with less help.
  Your progress is saved, so a break is fine. Come back with npm run learn.

  ────────────────────────────────────────────────────────────────────────────
   enter  start B5    p page    m map    c card    q quit`;
// A read line's words as the screen shows them: its link's text, then the rest.
const readWords = (read) => flatText(read.replace(/\[([^\]]+)\]\([^)]+\)/, '$1'));

test('the next screen ends the lesson with 📖 Go further and the page\'s line: b-4 is the design\'s at 80x24', () => {
  const next = endScreens({ missed: ['exit'] }).find(([l]) => l === 'b-4 next')[1];
  const lines = render(next, { cols: 80, rows: 24 }, theme(CAPS.full)).map((l) => strip(l).trimEnd());
  assert.deepEqual(lines, B4_NEXT.slice(1).split('\n'), lines.join('\n'));
});

// Where the recall row (152) takes Go further's room, and why. Go further
// is optional: p shows it whole there too.
const NOTCH = 'its Next up title wraps to two rows, "A notch harder" to two, and its Go further line would take three';
const NOTCH_ONE = '"A notch harder" wraps to two rows, and its Go further line would take three';
const GO_FURTHER_GIVES = {
  'b-2 next at 60x20': 'its Next up title wraps to two rows and its Go further line to three, so no spacer is left for the recall row',
  'i-1 next at 60x20': NOTCH,
  'i-3 next at 60x20': NOTCH,
  'i-4 next at 60x20': NOTCH_ONE,
  'i-7 next at 60x20': NOTCH_ONE,
  'a-1 next at 60x20': NOTCH_ONE,
  'a-2 next at 60x20': NOTCH_ONE,
};

test('every next screen but a capstone\'s shows its Go further line whole at 60x20 and 80x24, in every mode', () => {
  const gave = new Set();
  for (const [label, state] of endScreens().filter(([l]) => l.endsWith('next'))) {
    const { read } = lessonById(state.lesson).content.intro;
    for (const [capName, caps] of Object.entries(CAPS)) {
      const t = theme(caps);
      const flag = `${t.unicode ? '📖' : '[read]'} ${C.goFurther} "`;
      for (const [cols, rows] of SHORT) {
        const lines = render(state, { cols, rows }, t).map(strip);
        const where = `${label} at ${cols}x${rows} (${capName})\n${lines.join('\n')}`;
        const at = lines.findIndex((l) => l.trimStart().startsWith(flag));
        if (`${label} at ${cols}x${rows}` in GO_FURTHER_GIVES) {
          assert.equal(at, -1, where);
          assert.ok(lines.some((l) => l.trim() === C.recallAsk(label.replace(/^([a-z])-(\d+) next$/, (_, a, n) => `${a.toUpperCase()}${n}`))), where);
          gave.add(`${label} at ${cols}x${rows}`);
          continue;
        }
        if (state.lesson.endsWith('capstone')) {
          assert.equal(read, undefined);
          assert.equal(at, -1, where);
          assert.ok(!flatText(lines.join('')).includes(flatText(C.goFurther)), where);
          continue;
        }
        assert.ok(at > 0, where);
        // The quote ends on the row whose last mark closes it; it reads whole.
        const end = lines.findIndex((l, i) => i >= at && l.trimEnd().endsWith('"'));
        const said = [lines[at].trimStart().slice(flag.length - `${C.goFurther} "`.length), ...lines.slice(at + 1, end + 1)];
        assert.equal(flatText(said.join('')), flatText(C.goFurther) + readWords(read), where);
        // Wrapped rows go on under the label, after the lead.
        const col = width(lines[at]) - width(lines[at].trimStart()) + width(t.unicode ? '📖 ' : '[read] ');
        for (const l of lines.slice(at + 1, end + 1)) assert.equal(width(l) - width(l.trimStart()), col, where);
      }
    }
  }
  assert.deepEqual([...gave], Object.keys(GO_FURTHER_GIVES));
  // b-4 at 60x20: the two rows the design's mockup draws. The blank above
  // them is the sentence's own, so it stays while the spacers below give
  // way: 142's climb takes two rows where the mockup's took one, and that
  // row is the mockup's blank above Next up.
  const b4 = endScreens().find(([l]) => l === 'b-4 next')[1];
  const lines = render(b4, { cols: 60, rows: 20 }, theme(CAPS.full)).map((l) => strip(l).trimEnd());
  const at = lines.findIndex((l) => l.includes('📖'));
  assert.deepEqual(lines.slice(at - 1, at + 3), ['', '  📖 Go further: "Explore the context window: an', '     interactive view of what fills a session."', '  ▸ Next up   B5   Project memory with CLAUDE.md'], lines.join('\n'));
});

test('the Go further label is in muted and its quote in text', () => {
  const t = theme(CAPS.full);
  const next = endScreens().find(([l]) => l === 'b-4 next')[1];
  const row = render(next, { cols: 80, rows: 24 }, t).find((l) => strip(l).includes(`${C.goFurther} "`));
  const parts = colored(row);
  assert.equal(parts.muted?.replace(/ /g, ''), C.goFurther.replace(/ /g, ''), JSON.stringify(parts));
  assert.ok(parts.text?.trimStart().startsWith('"Explore the context window:'), JSON.stringify(parts));
});

test('the Go further line is an optional row: it drops whole with its blank, before any teaching line is cut', () => {
  const t = theme(CAPS.full);
  const next = endScreens().find(([l]) => l === 'b-4 next')[1];
  const { read } = lessonById('b-4').content.intro;
  let dropped = null;
  // Longer and longer save errors leave the body less and less room.
  for (let n = 0; n <= 8 && !dropped; n++) {
    const toast = { kind: 'save', message: `EACCES: permission denied, open ${'/home/sam/claude-code-practice'.repeat(n)}/.practice/learn.json` };
    const lines = render({ ...next, toast }, { cols: 60, rows: 20 }, t).map(strip);
    const where = `a ${n}-fold save error\n${lines.join('\n')}`;
    const rows = lines.filter((l) => l.includes('📖') || l.trimEnd().endsWith('fills a session."'));
    assert.ok([0, 2].includes(rows.length), where);
    assert.ok(!lines.some((l) => l.trim() === '…'), `a teaching line is cut: ${where}`);
    const text = flatText(lines.join(''));
    for (const word of [C.checkedSummary(2, 2), C.yourClimb, C.nextUp, 'Project memory with CLAUDE.md', C.notchHarder, C.savedBreak]) assert.ok(text.includes(flatText(word)), `"${word}": ${where}`);
    if (!rows.length) dropped = { lines, where };
  }
  assert.ok(dropped, 'no save error pushed the Go further line out');
  // Its blank went with it: the body shows no two blank rows in a row.
  const body = dropped.lines.slice(4, dropped.lines.findLastIndex((l) => l.trim()) - 2);
  assert.ok(!body.some((l, i) => !l.trim() && !body[i + 1]?.trim()), dropped.where);
  assert.ok(!flatText(dropped.lines.join('')).includes(readWords(read)), dropped.where);
});

// The page overlay, opened with p from the screen `stop` finds in a play of
// lesson `id` on the path, with `top` added to the save.
const pageOn = (id, stop, top = {}) => {
  const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: finishedBefore(id), ...ownCopy(id), ...top } });
  playUntil(d, stop);
  d.key('p');
  assert.equal(d.state.overlay, 'page', id);
  return d;
};
const URLS = {
  'b-1': 'https://code.claude.com/docs/en/how-claude-code-works',
  'b-2': 'https://code.claude.com/docs/en/permission-modes#analyze-before-you-edit-with-plan-mode',
  'b-3': 'https://code.claude.com/docs/en/common-workflows',
  'b-4': 'https://code.claude.com/docs/en/context-window',
  'b-5': 'https://code.claude.com/docs/en/best-practices#write-an-effective-claude-md',
  'i-1': 'https://code.claude.com/docs/en/skills',
  'i-2': 'https://code.claude.com/docs/en/claude-directory',
  'i-3': 'https://code.claude.com/docs/en/model-config',
  'i-4': 'https://www.anthropic.com/engineering/claude-code-sandboxing',
  'i-5': 'https://code.claude.com/docs/en/hooks',
  'i-6': 'https://code.claude.com/docs/en/sub-agents',
  'i-7': 'https://code.claude.com/docs/en/mcp-quickstart',
  'i-8': 'https://code.claude.com/docs/en/plugins/code-intelligence',
  'a-1': 'https://code.claude.com/docs/en/worktrees#isolate-subagents-with-worktrees',
  'a-2': 'https://code.claude.com/docs/en/agents',
  'a-3': 'https://code.claude.com/docs/en/goal#compare-ways-to-keep-a-session-running',
  'a-4': 'https://code.claude.com/docs/en/agent-sdk/overview',
  'a-5': 'https://code.claude.com/docs/en/code-review',
  'a-6': 'https://code.claude.com/docs/en/settings-example#a-teams-shared-settings',
  'a-7': 'https://code.claude.com/docs/en/sandbox-environments',
};

test('p on the next screen shows the Go further line and its full URL, so a terminal with no links still has the address', () => {
  for (const l of allCourse.filter((x) => x.content)) {
    const d = pageOn(l.id, (s) => s.view === 'next' && s.lesson === l.id);
    const { read } = l.content.intro;
    for (const [capName, caps] of Object.entries(CAPS)) {
      const t = theme(caps);
      for (const [cols, rows] of SHORT) {
        const raw = render(d.state, { cols, rows }, t);
        const lines = raw.map(strip);
        const where = `${l.id} page at ${cols}x${rows} (${capName})\n${lines.join('\n')}`;
        assert.ok(!lines.some((x) => x.trim() === t.glyph.ellipsis || widthCut(t, cols)(x)), `cut: ${where}`);
        const text = lines.map((x) => x.trim()).join('');
        if (!URLS[l.id]) {
          assert.equal(read, undefined);
          assert.ok(!text.includes(C.goFurther), where);
          continue;
        }
        assert.ok(lines.some((x) => x.trimStart().startsWith(`${t.unicode ? '📖' : '[read]'} ${C.goFurther} "`)), where);
        assert.ok(flatText(text).includes(flatText(C.goFurther) + readWords(read)), where);
        // The full URL, its wrapped rows joined, and a link where links work.
        assert.ok(text.includes(URLS[l.id]), where);
        if (caps.links) assert.ok(raw.some((x) => x.includes(`\x1b]8;;${URLS[l.id]}\x07`)), where);
      }
    }
  }
});

test('p gives up its blank rows from the bottom: the one above Go further goes before the one above the Stuck link', () => {
  for (const l of allCourse.filter((x) => x.content?.intro.read)) {
    const d = pageOn(l.id, (s) => s.view === 'next' && s.lesson === l.id);
    for (const [capName, caps] of Object.entries(CAPS)) {
      const t = theme(caps);
      for (const [cols, rows] of SHORT) {
        const lines = render(d.state, { cols, rows }, t).map((x) => strip(x).trim());
        const where = `${l.id} page at ${cols}x${rows} (${capName})\n${lines.join('\n')}`;
        const blankAbove = (i) => i > 0 && lines[i - 1] === '';
        const stuck = blankAbove(lines.indexOf(C.stuckLink));
        const further = blankAbove(lines.findIndex((x) => x.startsWith(`${t.unicode ? '📖' : '[read]'} ${C.goFurther}`)));
        assert.ok(stuck || !further, where);
        if (rows >= 24) assert.ok(stuck && further, where);
      }
    }
  }
});

test('the next screen\'s key bar offers p page, at 60x20 and 80x24', () => {
  for (const [label, state] of endScreens().filter(([l]) => l.endsWith('next'))) {
    for (const [cols, rows] of SHORT) {
      const bar = render(state, { cols, rows }, theme(CAPS.full)).map(strip).at(-1);
      assert.match(bar, /\bp page\b/, `${label} at ${cols}x${rows}: ${bar}`);
    }
  }
});

test('p on a step shows its page\'s Go further line: a warm-up\'s is the lesson it comes from', () => {
  const t = theme(CAPS.full);
  const text = (d) => render(d.state, { cols: 80, rows: 24 }, t).map((l) => strip(l).trim()).join('');
  // b-3's first step of its own.
  const own = pageOn('b-3', (s) => s.view === 'step' && s.lesson === 'b-3' && stepOf(s).part !== 'Warm-up');
  assert.ok(text(own).includes(URLS['b-3']), text(own));
  // b-2's warm-up, from b-1, played where start was missed (194).
  const warm = pageOn('b-2', (s) => s.view === 'step' && s.lesson === 'b-2' && stepOf(s).part === 'Warm-up', { missed: ['start'] });
  const from = stepOf(warm.state).from;
  assert.equal(from, 'b-1');
  assert.ok(text(warm).includes(URLS[from]) && !text(warm).includes(URLS['b-2']), text(warm));
  // The capstone's steps have none.
  const cap = pageOn('b-capstone', (s) => s.view === 'step' && s.lesson === 'b-capstone' && stepOf(s).part !== 'Warm-up');
  assert.ok(!text(cap).includes(C.goFurther), text(cap));
});

test('📖 has one job: Go further, once, on the next screen and behind p, and nowhere else', async () => {
  const all = [...await everyScreen(), ...endScreens()];
  const pages = allCourse.filter((l) => l.content).map((l) => [`${l.id} next page`, pageOn(l.id, (s) => s.view === 'next' && s.lesson === l.id).state]);
  let seen = 0;
  for (const capName of ['full', 'ascii']) {
    const t = theme(CAPS[capName]);
    const flag = t.unicode ? '📖' : '[read]';
    for (const [label, state] of [...all, ...pages]) {
      // The state's own course: a screen may play a course with fewer lesson files.
      const byId = (id) => state.course.find((x) => x.id === id);
      const step = state.view === 'step' && state.beat ? stepOf(state) : null;
      const pageOf = byId(step?.part === 'Warm-up' ? step.from : state.lesson);
      const goes = state.overlay === 'page' ? pageOf.content?.intro.read : !state.overlay && state.view === 'next' && byId(state.lesson).content.intro.read;
      for (const [cols, rows] of SHORT) {
        const lines = render(state, { cols, rows }, t).map(strip);
        const n = lines.filter((x) => x.includes(flag)).length;
        const gives = !state.overlay && `${label} at ${cols}x${rows}` in GO_FURTHER_GIVES;
        assert.equal(n, goes && !gives ? 1 : 0, `${label} at ${cols}x${rows} (${capName})\n${lines.join('\n')}`);
        if (n) assert.ok(lines.find((x) => x.includes(flag)).trimStart().startsWith(`${flag} ${C.goFurther}`));
        seen += n;
      }
    }
  }
  assert.ok(seen > 0);
});

test('the ? overlay says how to start with a still screen at 80x24, under a blank, and gives that row up first at 60x20, where every key stays', () => {
  const t = theme(CAPS.full);
  const help = screens.find(([l]) => l === 'help')[1];
  const CALM = 'Prefer a still screen? Quit, then start with npm run learn -- --calm.';
  const big = render(help, { cols: 80, rows: 24 }, t).map(strip);
  const i = big.findIndex((l) => l.trim() === CALM);
  assert.ok(i > 0, big.join('\n'));
  assert.equal(big[i - 1].trim(), '', 'a blank above it');
  assert.ok(big.findIndex((l) => l.trim().startsWith('q ')) < i, 'under the keys');
  const small = render(help, { cols: 60, rows: 20 }, t).map(strip);
  assert.ok(!small.some((l) => /still screen|--calm/.test(l)), small.join('\n'));
  for (const [k, label] of C.keyHelp) assert.ok(small.some((l) => l.includes(k) && l.includes(label)), `${k} ${label} at 60x20`);
  // In between, it shows whole on one row with every blank kept, or not at
  // all: it never splits the command, and no blank gives way for it.
  for (const [cols, rows] of [[60, 21], [61, 21], [70, 21], [80, 21], [80, 23], [72, 24], [76, 24], [100, 30]]) {
    const lines = render(help, { cols, rows }, t).map(strip);
    const at = `${cols}x${rows}`;
    const calm = lines.filter((l) => /still screen|--calm/.test(l));
    assert.ok(calm.length === 0 || (calm.length === 1 && calm[0].trim() === CALM), `${at}\n${lines.join('\n')}`);
    const title = lines.findIndex((l) => l.trim() === C.keysTitle);
    assert.equal(lines[title + 1].trim(), '', `${at}: the blank under the title`);
    assert.equal(lines[title - 1].trim(), '', `${at}: the blank above it`);
    if (cols >= 76 && rows >= 24) assert.equal(calm.length, 1, `${at}: room for it`);
  }
});

// Truthful waits: what the card says while r's run goes.
const checkingRows = (d, cols, rows) => plainAt(d, cols, rows).split('\n').filter((l) => l.includes('Checking'));

test('the checking label names what is checked: "Checking <watched path>…", and "Checking…" where the beat watches no path', () => {
  const cases = [
    // A check beat, a file beat with no watching line, a git beat, and the Check, which watches every item.
    ['b-1', 'W3', 0, { type: 'check', lesson: 'b-1', items: [{ index: 0, text: 'x', pass: false, hint: 'no file' }] }, 'Checking .practice/version.txt…'],
    ['b-2', 'W6', 2, { type: 'file', path: '.practice/b-2-plan.txt', read: null, stamp: 'a' }, 'Checking .practice/b-2-plan.txt…'],
    ['b-1', 'W7', 2, { type: 'git', paths: ['notes.md'] }, 'Checking git status…'],
    ['b-1', 'C', 0, { type: 'check', lesson: 'b-1', items: [{ index: 0, text: 'x', pass: false, hint: 'no file' }] }, 'Checking…'],
  ];
  for (const [id, step, beat, result, label] of cases) {
    const d = openAt(id, step, beat);
    d.send(result);
    d.key('r');
    assert.equal(d.state.beat.status, 'opening', `${id} ${step}.${beat}`);
    for (const [cols, rows] of SHORT) assert.deepEqual(checkingRows(d, cols, rows).map((l) => l.replace(/^[\s│]+/, '').trimEnd()), [label], `${id} ${step}.${beat} at ${cols}x${rows}`);
  }
});

// Check item progress (163): the check child reports each item as it starts it.
test('a run of several items says how far it has got, "Checking item n of m…", once a report for the current ask arrives', () => {
  const labels = (d) => SHORT.map(([cols, rows]) => checkingRows(d, cols, rows).map((l) => l.replace(/^[\s│]+/, '').trimEnd()));
  const both = (...label) => SHORT.map(() => label);
  const report = (d, lesson, items, n, m, asked = 0) => d.send({ type: 'running', lesson, items, n, m, asked, wait: 40 });
  // b-2's Check: its opening run checks both items, neither slow.
  const d = openAt('b-2', 'C', 0);
  assert.deepEqual(labels(d), both('Checking…'), 'no report yet');
  const saved = snapshot(d.state);
  report(d, 'b-2', null, 1, 2);
  assert.deepEqual(labels(d), both('Checking item 1 of 2…'), 'the opening run reports its first item');
  assert.deepEqual(snapshot(d.state), saved, 'a report saves nothing');
  report(d, 'b-1', null, 2, 2);
  report(d, 'b-2', [1], 2, 2);
  assert.deepEqual(labels(d), both('Checking item 1 of 2…'), 'another lesson\'s run, or a run of other items, is not this one');
  const missing = [0, 1].map((index) => ({ index, text: 'x', pass: false, hint: 'not yet' }));
  d.send({ type: 'check', lesson: 'b-2', items: missing });
  assert.deepEqual(labels(d), both(), 'the result ends it');
  d.key('r');
  assert.deepEqual(labels(d), both('Checking…'), 'r asks again: no report for its run yet');
  report(d, 'b-2', null, 2, 2);
  assert.deepEqual(labels(d), both('Checking…'), 'a poll\'s run, still going ahead of r\'s, reports nothing on the card');
  report(d, 'b-2', null, 2, 2, d.state.beat.asked);
  assert.deepEqual(labels(d), both('Checking item 2 of 2…'), 'r\'s own run');
  // Back a beat while the Check's run goes: that run's reports are not about
  // the beat before, which checks item 1 alone.
  const back = openAt('b-2', 'C', 0);
  back.key('b');
  assert.deepEqual(beatOf(back.state).verify.items, [1]);
  assert.equal(back.state.beat.status, 'opening');
  report(back, 'b-2', null, 2, 2);
  assert.deepEqual(labels(back), both('Checking .practice/b-2-after.txt…'));
  // The capstone's test run, two slow items, which only r runs.
  const t = openAt('b-capstone', 'T4', 2);
  const placeholders = [3, 4].map((index) => ({ index, text: 'x', pass: false, slow: true, hint: '' }));
  t.send({ type: 'check', lesson: 'b-capstone', items: placeholders });
  t.key('r');
  assert.deepEqual(labels(t), both('Checking npm test…'));
  report(t, 'b-capstone', [3, 4], 1, 2, t.state.beat.asked);
  assert.deepEqual(labels(t), both('Checking item 1 of 2…'));
  // r's result lands on the map: back on the card, the map's re-run has
  // reported nothing yet, so the count from r's run is gone.
  t.key('m');
  t.send({ type: 'check', lesson: 'b-capstone', items: placeholders.map((i) => ({ ...i, slow: false, hint: 'npm test failed.' })), asked: t.state.beat.asked });
  t.key('m');
  assert.deepEqual(labels(t), both('Checking npm test…'), 'a map round trip shows no count from a run that has ended');
  // So does a run that breaks.
  t.key('r');
  report(t, 'b-capstone', [3, 4], 2, 2, t.state.beat.asked);
  t.key('m');
  t.send({ type: 'check-error', lesson: 'b-capstone', message: 'it took too long', asked: t.state.beat.asked });
  t.key('m');
  assert.deepEqual(labels(t), both('Checking npm test…'));
  // A run of one item has nothing to count: the label keeps what it checks.
  const w = openAt('b-1', 'W3', 0);
  report(w, 'b-1', [0], 1, 1);
  assert.deepEqual(labels(w), both('Checking .practice/version.txt…'));
});

test('r over a "Not yet" with a hint open: "Checking" takes the "Not yet" row, and the hint box and the key bar stay, at 60x20 and 80x24', () => {
  const d = openAt('b-1', 'W3', 0);
  failCheck(d);
  d.key('h');
  d.key('h');
  assert.equal(d.state.beat.rung, 1);
  const box = (lines) => lines.slice(lines.findIndex((l) => l.includes('💡')), lines.findIndex((l) => l.includes(C.pressHAgain)) + 1);
  const failing = SHORT.map(([cols, rows]) => plainAt(d, cols, rows).split('\n'));
  d.key('r');
  assert.equal(d.state.beat.status, 'opening');
  for (const [i, [cols, rows]] of SHORT.entries()) {
    const before = failing[i];
    const after = plainAt(d, cols, rows).split('\n');
    assert.ok(before.some((l) => l.includes('Not yet')) && !after.some((l) => l.includes('Not yet')), `${cols}x${rows}`);
    assert.equal(checkingRows(d, cols, rows).length, 1, `${cols}x${rows}`);
    assert.ok(box(before).length > 1, `${cols}x${rows}: the second rung is open`);
    assert.deepEqual(box(after), box(before), `${cols}x${rows}: the same hint box`);
    assert.equal(after.at(-1), before.at(-1), `${cols}x${rows}: the same key bar`);
    assert.match(after.at(-1), /h more help .*r check again/, `${cols}x${rows}`);
  }
});

// A letter waits DEFER_MS before it acts: while it is held, the key bar shows it pressed.
const SGR = '(?:\\x1b\\[[0-9;]*m)*';
const inverseKey = (k) => new RegExp(`\\x1b\\[7m${SGR} ?${k} ?${SGR}\\x1b\\[27m`);
const bar = (s, t) => render(s, { cols: 80, rows: 24 }, t).at(-1);
const hold = (d, name) => d.send({ type: 'key', name, ch: name, wait: 100 });

test('a held letter that the key bar shows draws inverse there, in every mode and inside the hint lock, with no countdown', () => {
  const d = openAt('b-1', 'W3', 0);
  failCheck(d);
  d.key('h');
  assert.equal(d.state.beat.rung, 0);
  const before = d.state;
  hold(d, 'h');
  assert.ok(d.now < d.state.beat.lockUntil, 'inside the 2 s lock');
  assert.equal(d.state.held?.name, 'h');
  for (const [capName, caps] of Object.entries(CAPS)) {
    const t = theme(caps);
    assert.doesNotMatch(bar(before, t), /\x1b\[7m/, `${capName}: nothing pressed`);
    assert.match(bar(d.state, t), inverseKey('h'), `${capName}: h pressed`);
    assert.equal(strip(bar(d.state, t)), strip(bar(before, t)), `${capName}: the same words, no countdown`);
  }
  d.send({ type: 'flush', wait: DEFER_MS });
  assert.equal(d.state.beat.rung, 0, 'inside the lock nothing opens');
  assert.doesNotMatch(bar(d.state, theme(CAPS.full)), /\x1b\[7m/, 'and the key is up again');
  // A key the bar does not show acts after the hold with no sign, as before.
  const p = openAt('b-1', 'W3', 0);
  p.send({ type: 'check', lesson: 'b-1', items: [{ index: 0, text: 'x', pass: false, hint: 'no file' }] });
  const waiting = p.state;
  hold(p, 'b');
  assert.equal(p.state.held?.name, 'b');
  assert.equal(bar(p.state, theme(CAPS.full)), bar(waiting, theme(CAPS.full)));
});

test('a held main letter: y on the y/n prompt draws its pill inverse in color, and in NO_COLOR, where the pill is inverse already, without it', () => {
  const d = openAt('b-1', 'W3', 0);
  failCheck(d);
  for (let i = 0; i < 8 && !d.state.beat.confirm; i++) d.key('h');
  assert.equal(d.state.beat.confirm, true);
  const before = d.state;
  hold(d, 'y');
  for (const name of ['full', 'sixteen']) {
    const t = theme(CAPS[name]);
    assert.doesNotMatch(bar(before, t), /\x1b\[7m/, `${name}: a colored pill`);
    assert.match(bar(d.state, t), inverseKey('y'), `${name}: y pressed`);
  }
  for (const name of ['noColor', 'ascii']) {
    const t = theme(CAPS[name]);
    assert.match(bar(before, t), inverseKey('y'), `${name}: the pill is inverse video`);
    assert.doesNotMatch(bar(d.state, t), inverseKey('y'), `${name}: held, y draws without inverse`);
    assert.match(strip(bar(d.state, t)), /^\s* y  /, `${name}: still a pill's width`);
    assert.equal(strip(bar(d.state, t)), strip(bar(before, t)));
  }
});

// Pip on the card's top border: a still face for what the app saw (design 2.2).
const FACES = { rest: ' [●‿●] ', checking: ' [◒─◒] ', worried: ' [●‿◒] ', done: ' [^‿^] ', broken: ' [●─●] ' };
const ASCII_FACES = { rest: ' [o_o] ', checking: ' [o-o] ', worried: ' [o_o] ', done: ' [^_^] ', broken: ' [o_o] ' };
const facesOf = (t) => (t.unicode ? FACES : ASCII_FACES);
// The face at the end of the card's top border; null on a card without
// Pip, undefined on a screen with no card.
const cardTop = (lines) => lines.map((l) => strip(l).trimEnd()).find((l) => /^\s*(╭─|\+-) {2}/.test(l));
function pipOn(lines, t) {
  const top = cardTop(lines);
  if (top === undefined) return undefined;
  const end = t.glyph.rule.repeat(2);
  return Object.values(facesOf(t)).find((f) => top.endsWith(`${f}${end}`)) ?? null;
}
const PIP_B1 = {
  W1: 'rest', W2: 'rest', 'W2 stuck': 'worried', 'W2 right': 'done',
  'W3 opening': 'checking', 'W3 waiting': 'rest', 'W3 not yet': 'worried', 'W3 hint 1': 'worried', 'W3 hint 2': 'worried',
  'W3 hint 3': 'worried', 'W3 confirm': 'worried', 'W3 bottom': 'worried', 'W3 done': 'done', 'W3 broken': 'broken',
  'W4 predict': 'rest', 'W4 guessed': 'rest', 'W4 sign in': 'rest', 'W4 trust': 'rest',
  W5: 'rest', 'W5 wrong': 'worried', 'W5 revealed': 'done',
  W6: 'rest', 'W6 ask': 'rest', 'W6 decoy': 'worried', 'W6 right': 'done',
  'W7 predict': 'rest', 'W7 guessed': 'rest', 'W7 exit': 'rest', 'W7 git opening': 'checking', 'W7 git dirty': 'worried', 'W7 git clean': 'done',
  'Y1 eased': 'checking', 'Y1 already': 'done', Y2: 'rest', 'Y2 option': 'done', Y3: 'rest', 'Y3 hint': 'worried', 'Y3 resumed': 'rest',
  'Y4 opening': 'checking', 'Y4 live dirty': 'worried', 'Y4 idle': 'worried', 'Y4 live clean': 'worried', 'Y4 stray': 'worried', 'Y4 not yet': 'worried', 'Y4 done': 'done',
  'C check': 'rest', 'C typing': 'rest', 'C wrong': 'worried', 'C revealed': 'rest', 'C self': 'rest',
  'check-only': 'rest', 'check-only results': 'worried',
};
// Calm draws the rest frame byte for byte, Pip included: learn-motion's
// "rest equals calm" test pins that, so calm is not a mode here.
const STILL_MODES = { full: CAPS.full, noColor: CAPS.noColor, plain: CAPS.ascii };

test('Pip\'s rest face on every b-1 card says what the app saw, the same still face in NO_COLOR and plain (ASCII)', () => {
  for (const [mode, caps] of Object.entries(STILL_MODES)) {
    const t = theme(caps);
    for (const [label, state] of screens) {
      const lines = render(state, { cols: 80, rows: 24 }, t);
      const want = PIP_B1[label];
      if (want) assert.equal(pipOn(lines, t), facesOf(t)[want], `${label} (${mode})\n${lines.map(strip).join('\n')}`);
      else assert.equal(pipOn(lines, t), undefined, `${label} (${mode}) has no card`);
    }
  }
});

test('Pip shows only where the top border leaves 10 cells of rule: an ASCII done card at 60x20 leaves 6, so its border is today\'s', () => {
  const t = theme(CAPS.ascii);
  const done = screens.find(([l]) => l === 'W3 done')[1];
  const at = (cols) => render(done, { cols, rows: 20 }, t);
  assert.equal(cardTop(at(60)), '  +-  [TERMINAL] in your other terminal   [x] DONE  ------');
  assert.equal(pipOn(at(60), t), null);
  // Each column more gives the rule one more cell: 9 at 63, 10 at 64.
  assert.equal(pipOn(at(63), t), null);
  assert.equal(pipOn(at(64), t), ASCII_FACES.done);
  assert.match(cardTop(at(64)), /DONE {2}- \[\^_\^\] --$/);
  // The face takes rule cells: the border keeps the card's width.
  for (const cols of [60, 63, 64]) assert.equal(width(cardTop(at(cols))), cols - 2);
});

const cards = (all) => all.filter(([, s]) => ['step', 'checkonly'].includes(s.view) && !s.overlay);

// A row's cells with the foreground code each is drawn in ('' for none).
const inks = (line) => {
  let fg = '';
  const out = [];
  for (const part of line.split(/(\x1b\[[0-9;]*m)/)) {
    const m = part.match(/^\x1b\[([0-9;]*)m$/);
    if (!m) out.push(...graphemes(part).map((g) => [g, fg]));
    else if (/^(38;5;\d+|3[0-7]|9[0-7])$/.test(m[1])) fg = m[1];
    else if (['39', '0', ''].includes(m[1])) fg = '';
  }
  return out;
};

test('Pip\'s face is in Pip\'s own colors: the outline purple, the eyes yellow, the mouth white, in 256 and in 16 colors, and in 256 on a truecolor terminal', () => {
  const s = screens.find(([l]) => l === 'W3 waiting')[1];
  const truecolor = { ...CAPS.full, depth: 24 };
  for (const [caps, [outline, eyes, mouth]] of [[CAPS.full, ['38;5;177', '38;5;221', '38;5;255']], [CAPS.sixteen, ['95', '93', '97']], [truecolor, ['38;5;177', '38;5;221', '38;5;255']]]) {
    const t = theme(caps);
    const top = render(s, { cols: 80, rows: 24 }, t).find((l) => strip(l).trimEnd().endsWith(`${FACES.rest}──`));
    assert.doesNotMatch(top, /[34]8;2;/, `depth ${caps.depth}: the card face in truecolor`);
    assert.deepEqual(inks(top).slice(-9, -2).filter(([g]) => g !== ' '), [['[', outline], ['●', eyes], ['‿', mouth], ['●', eyes], [']', outline]]);
    // The big Pip: the antenna and its foot in the eyes' yellow.
    const lines = render(driver().state, { cols: 80, rows: 24 }, t);
    const at = lines.findIndex((l) => strip(l).includes('╭───┴───╮'));
    assert.doesNotMatch(lines.join('\n'), /[34]8;2;/, `depth ${caps.depth}: the welcome in truecolor`);
    const big = lines.slice(at - 1, at + 3).map((l) => inks(l).slice(3, 12).filter(([g]) => g !== ' '));
    assert.deepEqual(big, [
      [['●', eyes]],
      [...[...'╭───'].map((g) => [g, outline]), ['┴', eyes], ...[...'───╮'].map((g) => [g, outline])],
      [['│', outline], ['●', eyes], ['‿', mouth], ['●', eyes], ['│', outline]],
      [...'╰───────╯'].map((g) => [g, outline]),
    ]);
    // Sparks in the eyes' yellow too: the card's hop and the big Pip's cheer.
    const moving = theme({ ...caps, motion: true, calm: false });
    const hop = screens.find(([l]) => l === 'C check')[1];
    const hopTop = render(hop, { cols: 80, rows: 24 }, moving, { at: hop.fx.pass })[4];
    assert.doesNotMatch(hopTop, /[34]8;2;/, `depth ${caps.depth}: the hop in truecolor`);
    assert.deepEqual(inks(hopTop).slice(-9, -2).filter(([g]) => g === '+'), [['+', eyes], ['+', eyes]]);
    const complete = screens.find(([l]) => l === 'complete')[1];
    const cheering = render(complete, { cols: 80, rows: 24 }, moving, { at: complete.fx.view });
    assert.doesNotMatch(cheering.join('\n'), /[34]8;2;/, `depth ${caps.depth}: the cheer in truecolor`);
    const cheer = cheering.find((l) => strip(l).trim() === '+  ●  +');
    assert.deepEqual(inks(cheer).filter(([g]) => g !== ' '), [['+', eyes], ['●', eyes], ['+', eyes]]);
  }
});

// Pip's life on a card that watches (189), as the top border draws it: a
// blink's shut eyes, and its look toward the other window and away, each
// in one-cell glyphs and Pip's own colors, the border its own width.
test('on a card that watches, Pip\'s blink and its looks to each side are drawn on the top border in Pip\'s own colors and one-cell glyphs, the border\'s width kept, at 60x20, 80x24 and 120x40', () => {
  const s = screens.find(([l]) => l === 'W3 waiting')[1];
  const q = ambientOpened(s);
  const t = theme({ ...CAPS.full, motion: true, calm: false });
  const [outline, eyes, mouth] = ['38;5;177', '38;5;221', '38;5;255'];
  for (const [cols, rows] of [[60, 20], [80, 24], [120, 40]]) {
    const rest = cardTop(render(s, { cols, rows }, t));
    for (const [ms, eye] of [[40, '─'], [TIMING.peekFrom, '◑'], [TIMING.peekFrom + TIMING.peekEvery, '◐']]) {
      const lines = render(s, { cols, rows }, t, { at: q + ms });
      const top = lines.find((l) => strip(l).trimEnd() === cardTop(lines));
      const where = `${cols}x${rows}, +${ms} ms`;
      assert.equal(width(cardTop(lines)), width(rest), where);
      assert.equal(cardTop(lines).slice(0, -9), rest.slice(0, -9), `${where}: only the face changes`);
      const face = inks(top).slice(-9, -2).filter(([g]) => g !== ' ');
      assert.deepEqual(face, [['[', outline], [eye, eyes], ['‿', mouth], [eye, eyes], [']', outline]], where);
      for (const [g] of face) assert.ok(width(g) === 1 && !isEmoji(g), `${where}: ${g}`);
    }
  }
});

test('Pip is on every step and check-only card of every lesson at 60x20 and 80x24, in one-cell glyphs that are not emoji, and no overlay shows it', async () => {
  const all = [...screens, ...await lessonWalks()];
  const t = theme(CAPS.full);
  let seen = 0;
  for (const [label, s] of all) {
    for (const [cols, rows] of SHORT) {
      const lines = render(s, { cols, rows }, t);
      const face = pipOn(lines, t);
      if (s.overlay || !['step', 'checkonly'].includes(s.view)) {
        assert.ok(!lines.some((l) => Object.values(FACES).some((f) => strip(l).includes(f.trim()))), `${label} at ${cols}x${rows} shows Pip`);
        continue;
      }
      assert.ok(face, `${label} at ${cols}x${rows}: no Pip\n${cardTop(lines)}`);
      // The face's cells, read off the border itself.
      const cells = graphemes(cardTop(lines)).slice(-9, -2);
      assert.equal(cells.join(''), face);
      for (const g of cells) assert.ok(width(g) === 1 && !isEmoji(g), `${label}: ${g} is ${width(g)} cells${isEmoji(g) ? ', an emoji' : ''}`);
      seen++;
    }
  }
  assert.ok(seen > 1_000, `${seen} cards`);
});

test('Pip tells the truth: the checking face only while the status is opening, on every card of every lesson', async () => {
  const all = cards([...screens, ...await lessonWalks()]);
  for (const caps of [CAPS.full, CAPS.ascii]) {
    const t = theme(caps);
    for (const [label, s] of all) {
      const face = pipOn(render(s, { cols: 80, rows: 24 }, t), t);
      assert.equal(face === facesOf(t).checking, s.beat?.status === 'opening', `${label}: ${face} while ${s.beat?.status}`);
    }
  }
});

test('Pip tells the truth: the done face only on the step\'s last beat done or already done, as the cheer; a beat before it rests, as the hop', async () => {
  const all = cards([...screens, ...await lessonWalks()]);
  const t = theme(CAPS.full);
  let mid = 0;
  for (const [label, s] of all) {
    const face = pipOn(render(s, { cols: 80, rows: 24 }, t), t);
    const done = ['done', 'already'].includes(s.beat?.status);
    const last = s.view === 'step' && s.pos.beat === stepOf(s).beats.length - 1;
    assert.equal(face === FACES.done, done && last, `${label}: ${face} while ${s.beat?.status}`);
    if (done && !last) {
      assert.equal(face, FACES.rest, `${label}: ${face} on a beat before the step's last`);
      if (s.beat.status === 'already') mid++;
    }
  }
  assert.ok(mid > 0, 'no beat before a step\'s last opens already done');
});

// What draws the worried face also draws a row that says so: a row led by a
// `▲` mark ("Not yet", the git line, a check-only item), the hint box's bar
// or the "Stuck?" offer. A `▲` beside a pick is an option's mark, not a row's.
test('Pip tells the truth: the worried face only where the card shows a ▲ row, a hint box or "Stuck?", and always there unless it is checking or broken', async () => {
  const all = cards([...screens, ...await lessonWalks()]);
  const t = theme(CAPS.full);
  let seen = 0;
  for (const [label, s] of all) {
    for (const [cols, rows] of SHORT) {
      const lines = render(s, { cols, rows }, t).map(strip);
      const face = pipOn(lines, t);
      // The while-it-runs box (ticket 150) draws the bar too, for a question
      // that grades nothing: it is no hint box.
      const box = whileBoxRows(lines, t);
      const shows = lines.some((l, i) => !box.has(i) && /^\s*│ {2}(▲ |▌ |Stuck\?)/.test(l));
      const why = `${label} at ${cols}x${rows}: ${face}\n${lines.join('\n')}`;
      if (face === FACES.worried) {
        assert.ok(shows, why);
        seen++;
      // "Checking" and a check that could not run say more than a hint
      // left open below them.
      } else if (shows) assert.ok([FACES.checking, FACES.broken].includes(face), why);
    }
  }
  assert.ok(seen > 1_000, `${seen} worried cards`);
});

test('Pip tells the truth: the same face for every predict answer', () => {
  let seen = 0;
  for (const l of allCourse.filter((x) => x.content)) {
    for (const step of [...l.content.warmup, ...l.content.steps]) {
      step.beats.forEach((beat, b) => {
        if (beat.kind !== 'predict') return;
        for (const [cols, rows] of SHORT) {
          const faces = new Set(beat.options.map((_, i) => {
            const d = openAt(l.id, step.id, b, step.part === 'Warm-up' ? { warm: [step.id] } : {});
            d.key(String(i + 1));
            assert.equal(d.state.beat.answer?.index, i, `${l.id} ${step.id}.${b} picks ${i + 1}`);
            const face = pipOn(render(d.state, { cols, rows }, theme(CAPS.full)), theme(CAPS.full));
            assert.ok(face, `${l.id} ${step.id}.${b} at ${cols}x${rows}, pick ${i + 1}: no Pip`);
            return face;
          }));
          assert.equal(faces.size, 1, `${l.id} ${step.id}.${b} at ${cols}x${rows}: ${[...faces].join(' | ')}`);
          seen++;
        }
      });
    }
  }
  assert.ok(seen > 0);
});

// The progress rule and a passed stop (157, D5 (a)): energy-and-teaching
// 2.3's "Step done" rest frame, rows 2 and 3.
test('a passed step\'s stop is green before enter and its link fills: W3 done at 80x24 is the step-done mockup', () => {
  const state = screens.find(([l]) => l === 'W3 done')[1];
  const lines = render(state, { cols: 80, rows: 24 }, theme(CAPS.full));
  assert.equal(strip(lines[1]).trimEnd(), '  ●━━●━━●━━○──○──○──○   ◇──◇──◇   ☆──☆                            step 3 of 12');
  assert.equal(strip(lines[2]).trimEnd(), `  ${'━'.repeat(19)}${'─'.repeat(57)}`);
  // The three passed stops and the links after them are green; no stop
  // keeps the accent "current" glyph.
  assert.equal(colored(lines[1]).ok, '●━━●━━●━━');
  assert.equal(colored(lines[1]).accent, undefined);
});

test('row 3 counts the steps passed on lesson screens, in ASCII too; the welcome keeps its plain rule and the map its own bar', () => {
  const at = (label, cols, rows, caps) => render(screens.find(([l]) => l === label)[1], { cols, rows }, theme(caps)).map((l) => strip(l).trimEnd());
  // energy-and-teaching 2.5, ASCII at 60x20, watching: 2 of 12 steps done.
  const ascii = at('W3 waiting', 60, 20, CAPS.ascii);
  assert.equal(ascii[1], '  #==#==#--o--o--o--o   +--+--+   .--.        step 3 of 12');
  assert.equal(ascii[2], `  ${'='.repeat(9)}${'-'.repeat(47)}`);
  // 2.4 at 60x20, watching, in Unicode.
  assert.equal(at('W3 waiting', 60, 20, CAPS.full)[2], `  ${'━'.repeat(9)}${'─'.repeat(47)}`);
  // A lesson not started has nothing passed; a finished one is full.
  assert.equal(at('intro', 80, 24, CAPS.full)[2], `  ${'─'.repeat(76)}`);
  assert.equal(at('complete', 80, 24, CAPS.full)[2], `  ${'━'.repeat(76)}`);
  // The welcome's rule is plain, and the map keeps its bar on row 2 over a
  // plain rule, whatever the lesson's progress.
  assert.equal(at('welcome', 80, 24, CAPS.full)[2], `  ${'─'.repeat(76)}`);
  const map = at('map', 80, 24, CAPS.full);
  assert.match(map[1], /^  ━*─+ \d+%$/);
  assert.equal(map[2], `  ${'─'.repeat(76)}`);
});

test('a stop is passed only once its step\'s last beat is done, by any route: a done earlier beat keeps the accent and row 3 still', () => {
  const at = (label) => render(screens.find(([l]) => l === label)[1], { cols: 80, rows: 24 }, theme(CAPS.full));
  // W4's predict beat is done, but it is beat 1 of 3: 3 of 12 passed.
  const guessed = at('W4 guessed');
  assert.equal(colored(guessed[1]).ok, '●━━●━━●━━');
  assert.equal(colored(guessed[1]).accent, '●');
  assert.equal(strip(guessed[2]).trimEnd(), `  ${'━'.repeat(19)}${'─'.repeat(57)}`);
  // Y1 already done counts, as a done one does: 8 of 12.
  const already = at('Y1 already');
  assert.equal(colored(already[1]).ok, '●━━●━━●━━●━━●━━●━━●━━●');
  assert.equal(colored(already[1]).accent, undefined);
  assert.equal(strip(already[2]).trimEnd(), `  ${'━'.repeat(51)}${'─'.repeat(25)}`);
});

test('a step done before keeps the accent "current" glyph until it passes again: back with b, and on a replay', () => {
  const t = theme(CAPS.full);
  const row2 = (d) => render(d.state, { cols: 80, rows: 24 }, t)[1];
  // Back from W4 to W3: W3 is the current stop and its link to W4 is faint.
  const d = driver();
  playUntil(d, (s) => s.view === 'step' && stepOf(s).id === 'W4');
  d.key('b');
  assert.equal(stepOf(d.state).id, 'W3');
  assert.match(strip(row2(d)), /^  ●━━●━━●──○──○──○──○ /);
  assert.equal(colored(row2(d)).ok, '●━━●━━');
  assert.equal(colored(row2(d)).accent, '●');
  // A replay of a finished lesson: every step is in done, and the one on
  // screen is current until its last beat is done.
  const r = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': finished(lessonById('b-1')) } } });
  if (r.state.view !== 'map') r.key('m');
  while (r.state.mapCursor !== 0) r.key('up');
  r.key('enter');
  r.key('enter');
  assert.equal(stepOf(r.state).id, 'W1');
  assert.match(strip(row2(r)), /^  ●──●━━●━━/);
  assert.equal(colored(row2(r)).accent, '●');
  playUntil(r, (s) => s.view === 'step' && stepOf(s).id === 'W2' && s.beat.status === 'done');
  assert.match(strip(row2(r)), /^  ●━━●━━●━━●━━●━━●━━●   ◆━━◆━━◆   ★━━★ /);
  assert.equal(colored(row2(r)).accent, undefined);
});

// b-2 plays one warm-up where start was missed before, and none where
// nothing was (194); a save from before 194 resumes with its two.
test('row 3 counts the warm-ups on the plan as steps, with the trail closed up at 60x20', () => {
  const at = (top) => {
    const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: finishedBefore('b-2'), ...top } });
    if (d.state.view === 'map') d.key('enter');
    assert.equal(d.state.view, 'intro');
    return d;
  };
  const rows = (d) => render(d.state, { cols: 60, rows: 20 }, theme(CAPS.full)).map((l) => strip(l).trimEnd());
  const d = at({ missed: ['start'] });
  assert.match(rows(d)[1], /^  ☆   ◇   ○(──○){6}   ◇(──◇){3}   ☆──☆ 15 steps$/);
  assert.ok(rows(d).includes(`  ${C.warmups(1)}`), rows(d).join('\n'));
  assert.equal(rows(d)[2], `  ${'─'.repeat(56)}`);
  d.key('enter');
  playUntil(d, (s) => s.view === 'step' && s.beat.status === 'done');
  assert.equal(stepOf(d.state).id, 'R1');
  // 1 of 15 over 56 cells.
  assert.equal(rows(d)[2], `  ${'━'.repeat(4)}${'─'.repeat(52)}`);
  d.key('enter');
  assert.equal(stepOf(d.state).id, 'W1');
  // Nothing missed: the lesson's own 14 steps, and no warm-up line.
  const none = at({});
  assert.match(rows(none)[1], / 14 steps$/);
  assert.ok(!rows(none).some((l) => /warm-up/.test(l)), rows(none).join('\n'));
  // Two warm-ups from an older save: 16 steps, closed up.
  const old = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore('b-2'), 'b-2': { step: 'R2', beat: 0, warm: ['R1', 'R2'], done: ['R1'] } } } });
  old.key('enter');
  assert.equal(stepOf(old.state).id, 'R2');
  assert.match(rows(old)[1], /^  ★★ ◇ ○{7} ◇{4} ☆☆ +step 2 of 16$/, rows(old).join('\n'));
  // 1 of 16 over 56 cells.
  assert.equal(rows(old)[2], `  ${'━'.repeat(4)}${'─'.repeat(52)}`);
});

// Your card (the c overlay): the commands from steps the learner finished,
// in the page's words (design D8 (a)).
const cardText = (d, cols = 80, rows = 24) => render(d.state, { cols, rows }, theme(CAPS.full)).map((l) => strip(l).trim());

test('c opens your card: an entry shows only after a finished step on its skill, read from the saved done, and nothing new is saved', () => {
  // Nothing finished yet: the card is empty.
  const d = driver({ saved: { format: 1, welcomed: true, lessons: {} } });
  d.key('enter');
  assert.equal(stepOf(d.state).id, 'W1');
  d.key('c');
  assert.equal(d.state.overlay, 'card');
  const empty = cardText(d);
  assert.ok(empty.includes(C.cardTitle), empty.join('\n'));
  assert.ok(!empty.some((l) => /claude --version|\/status|\/exit/.test(l)), empty.join('\n'));
  d.key('c');
  assert.equal(d.state.overlay, null, 'c closes it');
  // From the saved done: W1 to W5 finished (install, save-version, start, status).
  const saved = { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W6', beat: 0, done: ['W1', 'W2', 'W3', 'W4', 'W5'] } } };
  const r = driver({ saved });
  r.key('enter');
  assert.equal(stepOf(r.state).id, 'W6');
  const before = snapshot(r.state);
  r.key('c');
  const lines = cardText(r);
  const where = lines.join('\n');
  for (const [show, does] of [['claude --version', 'A working installation prints a version number followed by (Claude Code)'], ['claude', 'Start a session'],
    ['/status', 'The /status command shows the version, model and account together']]) {
    assert.ok(lines.some((l) => new RegExp(`^B1\\s+${show.replace(/[/-]/g, '\\$&')}$`).test(l)), `${show}\n${where}`);
    assert.ok(flatText(where).includes(flatText(`"${does}"`)), `${does}\n${where}`);
  }
  assert.ok(!lines.some((l) => /\/exit|End the session/.test(l)), `W7 is not finished: ${where}`);
  // Opening the card saves nothing new: the same snapshot, with the store's keys only.
  assert.deepEqual(snapshot(r.state), before);
  assert.deepEqual(Object.keys(snapshot(r.state).lessons['b-1']).sort(),
    ['answers', 'beat', 'bottomAt', 'complete', 'done', 'easedSteps', 'lessHelp', 'levels', 'moreHelpAt', 'recalled', 'stamps', 'step', 'warm']);
  // Finishing W7 on screen puts /exit on the card.
  r.key('c');
  playUntil(r, (s) => s.view === 'step' && stepOf(s).id === 'Y1');
  r.key('c');
  assert.ok(cardText(r).some((l) => /^B1\s+\/exit$/.test(l)), cardText(r).join('\n'));
});

const COMMANDS_BY_LEVEL = 'https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/blob/main/docs/reference/commands.md';
// The Commands by level link under its line, in trimmed rows: spelled out
// whole, on more than one row, each broken only after a /, ? or &.
const assertLinkBreaks = (lines, where) => {
  const from = lines.indexOf(C.cardLink);
  const url = lines.slice(from + 1, lines.findIndex((l, i) => i > from && l.endsWith('commands.md')) + 1);
  assert.equal(url.join(''), COMMANDS_BY_LEVEL, where);
  assert.ok(url.length > 1, where);
  for (const row of url.slice(0, -1)) assert.match(row, /[/?&]$/, where);
};
// Every entry the lesson files put on the card, in course order.
const CARD_SHOWS = ['claude --version', 'claude', '/status', '/exit', 'Shift+Tab', 'Ctrl+O', '/diff', 'git diff',
  '/context', '/compact', '/rewind', '/clear', '/resume', 'claude --continue', '/init', '/context all', 'git add -N <file>'];
const shownOn = (lines) => CARD_SHOWS.filter((show) => lines.some((l) => l.endsWith(`  ${show}`) && /^(B\d|BC)\s/.test(l)));

test('your card scrolls with the arrows where it is taller than the window, and ends with the guide\'s Commands by level link', () => {
  const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore('b-capstone'), 'b-capstone': finished(lessonById('b-capstone')) } } });
  d.key('c');
  assert.equal(d.state.overlay, 'card');
  for (const [cols, rows] of SHORT) {
    const at = `${cols}x${rows}`;
    while (d.state.cardAt) d.key('up');
    const first = cardText(d, cols, rows);
    assert.deepEqual(shownOn(first).slice(0, 2), CARD_SHOWS.slice(0, 2), `${at}\n${first.join('\n')}`);
    assert.ok(!first.join('').includes(COMMANDS_BY_LEVEL), `${at}: the link waits at the end\n${first.join('\n')}`);
    assert.match(first.at(-1), /↑↓ scroll/, at);
    // Down, one press at a time, shows every entry in turn, then the link last.
    const seen = new Set();
    let lines = first;
    for (let i = 0; i < 40 && !lines.join('').includes(COMMANDS_BY_LEVEL); i++) {
      shownOn(lines).forEach((x) => seen.add(x));
      const top = shownOn(lines)[0];
      d.key('down');
      lines = cardText(d, cols, rows);
      assert.notEqual(shownOn(lines)[0] ?? null, top, `${at}: down moved nothing\n${lines.join('\n')}`);
    }
    shownOn(lines).forEach((x) => seen.add(x));
    assert.deepEqual([...seen].sort(), [...CARD_SHOWS].sort(), at);
    const body = lines.slice(0, -2).filter(Boolean);
    const link = body.indexOf(C.cardLink);
    assert.ok(link > 0 && body.slice(link + 1).join('') === COMMANDS_BY_LEVEL, `${at}: the link ends the card\n${lines.join('\n')}`);
    // Up goes back to the first entry.
    for (let i = 0; i < 40 && d.state.cardAt; i++) d.key('up');
    assert.deepEqual(cardText(d, cols, rows), first, at);
  }
});

test('? lists c for your card where it has room, a row 60x20 gives up first; the key bar shows c card once the card has an entry', () => {
  const t = theme(CAPS.full);
  const help = screens.find(([l]) => l === 'help')[1];
  const cRow = (lines) => lines.some((l) => /^c\s+your card\b/.test(l.trim()));
  assert.ok(cRow(render(help, { cols: 80, rows: 24 }, t).map(strip)), 'at 80x24');
  assert.ok(!cRow(render(help, { cols: 60, rows: 20 }, t).map(strip)), 'not at 60x20');
  const keyBar = (s, cols, rows) => strip(render(s, { cols, rows }, t).at(-1));
  // No entry yet: no c on the bar.
  const empty = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W1', beat: 0 } } } });
  empty.key('enter');
  assert.doesNotMatch(keyBar(empty.state, 80, 24), /\bc card\b/);
  // W1 and W2 finished: install's entry is on the card, and W3's bar says so.
  playUntil(empty, (s) => s.view === 'step' && stepOf(s).id === 'W3');
  assert.match(keyBar(empty.state, 80, 24), /\bc card\b/, keyBar(empty.state, 80, 24));
  for (const [label, state] of endScreens().filter(([l]) => l.endsWith('next'))) {
    for (const [cols, rows] of SHORT) assert.match(keyBar(state, cols, rows), /\bc card\b/, `${label} at ${cols}x${rows}`);
  }
});

test('c card gives way before anything else on the bar: with it taken out, every bar is the one a card with no entries draws', async () => {
  const noCard = (state) => ({ ...state, course: state.course.map((l) => (l.content ? { ...l, content: { ...l.content, card: [] } } : l)) });
  // The card's own bar is the card's, and the comparison's is its own.
  const all = [...await everyScreen(), ...endScreens()].filter(([, state]) => !['card', 'compare'].includes(state.overlay));
  let shown = 0;
  for (const caps of [CAPS.full, CAPS.ascii]) {
    const t = theme(caps);
    for (const [cols, rows] of SHORT) {
      for (const [label, state] of all) {
        const bar = strip(render(state, { cols, rows }, t).at(-1));
        const bare = strip(render(noCard(state), { cols, rows }, t).at(-1));
        if (bar.includes('    c card')) shown++;
        assert.equal(bar.replace('    c card', ''), bare, `${label} at ${cols}x${rows}`);
      }
    }
  }
  assert.ok(shown > 0, 'some bar shows c card');
  // The approved Step done bar at 80x24 (design 2.3) keeps the next step's title.
  const done = screens.find(([l]) => l === 'W3 done')[1];
  assert.ok(cardOf(done).length, 'W3 done has a card entry');
  assert.equal(strip(render(done, { cols: 80, rows: 24 }, theme(CAPS.full)).at(-1)).trim(), 'enter  next: Start, sign in, trust    b back    w why    m map    q quit');
});

test('a card entry shows only after one of its own lesson\'s steps: the capstone\'s waits for the capstone, though b-3 teaches its skill too', () => {
  const lessons = { ...finishedBefore('b-capstone') };
  const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons } });
  assert.ok(lessons['b-3'].done.length && allCourse.find((l) => l.id === 'b-3').content.steps.some((x) => x.skill === 'review-diff'));
  assert.ok(!cardOf(d.state).some((e) => e.lesson === 'b-capstone'), cardOf(d.state).map((e) => e.show).join(', '));
  const cap = allCourse.find((l) => l.id === 'b-capstone').content;
  const step = cap.steps.find((x) => x.skill === 'review-diff');
  const after = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { ...lessons, 'b-capstone': { step: step.id, beat: 0, done: [step.id] } } } });
  assert.deepEqual(cardOf(after.state).filter((e) => e.lesson === 'b-capstone').map((e) => e.show), ['git add -N <file>']);
  // b-1's entries wait for b-1's own steps, though b-2 also has a start step.
  const skipped = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { 'b-2': { step: 'W2', beat: 0, done: ['W1'] } } } });
  assert.equal(allCourse.find((l) => l.id === 'b-2').content.steps.find((x) => x.id === 'W1').skill, 'start');
  assert.deepEqual(cardOf(skipped.state).filter((e) => e.lesson === 'b-1'), []);
});

test('your card\'s last place is the Commands by level link, so a toast at 60x20 leaves the card ending with it', () => {
  const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore('b-capstone'), 'b-capstone': finished(lessonById('b-capstone')) } } });
  d.key('c');
  for (let i = 0; i < 40; i++) d.key('down');
  assert.equal(d.state.cardAt, cardOf(d.state).length, 'down stops at the link');
  const toast = { kind: 'save', message: 'EACCES: permission denied, open /home/sam/claude-code-practice/.practice/learn.json' };
  for (const [cols, rows] of SHORT) {
    for (const s of [d.state, { ...d.state, toast }]) {
      const lines = render(s, { cols, rows }, theme(CAPS.full)).map((l) => strip(l).trim());
      const where = `${cols}x${rows}${s.toast ? ' with a toast' : ''}\n${lines.join('\n')}`;
      const link = lines.indexOf(C.cardLink);
      assert.ok(link > 0, where);
      const url = [];
      for (let i = link + 1; url.join('').length < COMMANDS_BY_LEVEL.length && i < lines.length; i++) url.push(lines[i]);
      assert.equal(url.join(''), COMMANDS_BY_LEVEL, where);
      if (s.toast) assert.ok(lines.some((l) => l.includes("Couldn't save your place")), `the toast stays: ${where}`);
    }
  }
});

// An arrow on the card as main sends it: with how far the card scrolls in
// that window (167).
const cardArrow = (d, name, [cols, rows], t = theme(CAPS.full)) => d.send({ type: 'key', name, wait: 10, cardMax: cardMax(d.state, { cols, rows }, t) });

test('your card scrolls no further than the window that ends on the Commands by level link, and up moves it at once', () => {
  for (const caps of [CAPS.full, CAPS.ascii]) {
    const t = theme(caps);
    for (const size of SHORT) {
      const at = `${size.join('x')}${t.unicode ? '' : ' (ASCII)'}`;
      const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore('b-capstone'), 'b-capstone': finished(lessonById('b-capstone')) } } });
      d.key('c');
      // Each frame is exactly the window, no line too wide.
      const shown = () => {
        const frame = render(d.state, { cols: size[0], rows: size[1] }, t).map(strip);
        assert.equal(frame.length, size[1], at);
        for (const l of frame) assert.ok(width(l) <= size[0] - 1, `${at}: ${l}`);
        return frame.map((l) => l.trim());
      };
      const linked = (lines) => lines.join('').includes(COMMANDS_BY_LEVEL);
      for (let i = 0; i < 40; i++) cardArrow(d, 'down', size, t);
      const end = shown();
      assert.ok(linked(end), `${at}: the link shows whole\n${end.join('\n')}`);
      // One up from there leaves the link: no window further down ends on it
      // with more of the card above it.
      cardArrow(d, 'up', size, t);
      const up = shown();
      assert.ok(!linked(up), `${at}: up moved the card at once\n${up.join('\n')}`);
      assert.notDeepEqual(shownOn(up), shownOn(end), at);
      // Scrolled further than this window allows, as in a smaller one before
      // a resize: the card still shows the window that ends on the link.
      for (let i = 0; i < 40; i++) d.send({ type: 'key', name: 'down', wait: 10 });
      assert.deepEqual(shown(), end, at);
    }
  }
});

test('your card spells the Commands by level link out whole, breaking it only after a /, ? or &, never inside a word', () => {
  const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore('b-capstone'), 'b-capstone': finished(lessonById('b-capstone')) } } });
  d.key('c');
  for (const caps of [CAPS.full, CAPS.ascii]) {
    const t = theme(caps);
    for (const size of SHORT) {
      while (d.state.cardAt) d.key('up');
      for (let i = 0; i < 40; i++) cardArrow(d, 'down', size, t);
      const lines = render(d.state, { cols: size[0], rows: size[1] }, t).map((l) => strip(l).trim());
      assertLinkBreaks(lines, `${size.join('x')}${t.unicode ? '' : ' (ASCII)'}\n${lines.join('\n')}`);
    }
  }
});

test('the arrows move your card only where it scrolls: while it fits, they move nothing', () => {
  // The empty card, and one entry: claude --version.
  const cards = [{ format: 1, welcomed: true, lessons: {} },
    { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W3', beat: 0, done: ['W1', 'W2'] } } }];
  for (const saved of cards) {
    for (const caps of [CAPS.full, CAPS.ascii]) {
      const t = theme(caps);
      for (const size of SHORT) {
        const d = driver({ saved });
        d.key('enter');
        d.key('c');
        const card = () => render(d.state, { cols: size[0], rows: size[1] }, t).map((l) => strip(l).trim());
        const before = card();
        const at = `${size.join('x')}${t.unicode ? '' : ' (ASCII)'}, ${Object.keys(saved.lessons).length ? 'B1' : 'empty'}\n${before.join('\n')}`;
        assert.ok(before.join('').includes(COMMANDS_BY_LEVEL), at);
        assert.equal(before.some((l) => /^B1\s+claude --version$/.test(l)), Object.keys(saved.lessons).length > 0, at);
        assert.doesNotMatch(before.at(-1), /scroll/, `the card fits: ${at}`);
        for (let i = 0; i < 5; i++) cardArrow(d, 'down', size, t);
        assert.equal(d.state.cardAt, 0, `nothing to scroll: the arrows move nothing: ${at}`);
        assert.deepEqual(card(), before, at);
      }
    }
  }
});

// Recall, then compare (152, design D8 (a)): the next screen asks for the
// lesson's card entries from memory; space shows them whole.
const RECALL = { 'b-1': 'B1', 'b-2': 'B2', 'b-3': 'B3', 'b-4': 'B4', 'b-5': 'B5', 'b-capstone': 'BC', 'i-1': 'I1', 'i-2': 'I2', 'i-3': 'I3', 'i-4': 'I4',
  'i-5': 'I5', 'i-6': 'I6', 'i-7': 'I7', 'i-8': 'I8', 'i-capstone': 'IC', 'a-1': 'A1', 'a-2': 'A2', 'a-3': 'A3', 'a-4': 'A4', 'a-5': 'A5', 'a-6': 'A6', 'a-7': 'A7', 'a-capstone': 'AC' };
const B4_CARD = [['/context', 'Shows how full the context window is, as a colored grid'], ['/compact', 'Summarizes the conversation so far, to free space'],
  ['/rewind', 'Goes back to an earlier prompt, restoring the code, the conversation or both'], ['/clear', 'Starts a new conversation with empty context'],
  ['/resume', 'Picks up an earlier conversation'], ['claude --continue', 'reopen the most recent conversation in this folder']];

// The rows from `at` that spell `show`, broken at its spaces or, in a word
// wider than a row, inside it, or 0.
const showRows = (lines, at, show) => {
  let said = lines[at];
  for (let n = 1; at + n <= lines.length && show.startsWith(said); n++) {
    if (said === show) return n;
    const next = lines[at + n] ?? '';
    said = show.startsWith(`${said} ${next}`) ? `${said} ${next}` : `${said}${next}`;
  }
  return 0;
};
// What the comparison on screen says each command does: the rows from its
// command, beside it, to the closing quote, or from the row under it where
// a command leaves its quote no room beside it (a long command on rows of
// its own). Undefined where it is not shown.
const compared = (lines, show) => {
  const k = lines.findIndex((l) => l.startsWith(`${show}   `) && l.slice(show.length).trimStart().startsWith('"'));
  if (k < 0) {
    const u = lines.findIndex((_, j) => showRows(lines, j, show) && lines[j + showRows(lines, j, show)]?.startsWith('"'));
    if (u < 0) return undefined;
    const from = u + showRows(lines, u, show);
    const end = lines.findIndex((l, j) => j >= from && l.endsWith('"'));
    return end < 0 ? undefined : lines.slice(from, end + 1).join(' ');
  }
  const end = lines.findIndex((l, j) => j >= k && l.endsWith('"'));
  return [lines[k].slice(show.length).trimStart(), ...lines.slice(k + 1, end + 1)].join(' ');
};

test('the next screen asks the learner to recall what the lesson put on the card, and shows none of it until space', () => {
  for (const [label, state] of endScreens().filter(([l]) => l.endsWith('next'))) {
    const ask = `Say to yourself what ${RECALL[state.lesson]} taught you, then press space.`;
    for (const [cols, rows] of SHORT) {
      const lines = render(state, { cols, rows }, theme(CAPS.full)).map((l) => strip(l).trim());
      const where = `${label} at ${cols}x${rows}\n${lines.join('\n')}`;
      assert.ok(lines.includes(ask), where);
      for (const e of lessonById(state.lesson).content.card) assert.ok(!flatText(lines.join('')).includes(flatText(`"${e.does}"`)), `${e.show} shows before space: ${where}`);
    }
  }
});

test('space shows the lesson\'s card entries whole, only this lesson\'s, and enter still says where it goes', () => {
  const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: finishedBefore('b-4') } });
  playUntil(d, (s) => s.view === 'next' && s.lesson === 'b-4');
  const bar = strip(render(d.state, { cols: 80, rows: 24 }, theme(CAPS.full)).at(-1)).trim();
  d.key('space');
  const lines = cardText(d);
  const where = lines.join('\n');
  for (const [show, does] of B4_CARD) assert.equal(compared(lines, show), `"${does}"`, `${show}\n${where}`);
  // Earlier lessons' entries are on the card, not in this comparison.
  for (const show of ['claude --version', 'Shift+Tab', 'Ctrl+O', '/diff']) assert.ok(!lines.some((l) => l.includes(show)), `${show}\n${where}`);
  // Nothing is judged: no mark on any entry, and nothing to answer, only to go on or back.
  assert.ok(!lines.slice(3, -2).some((l) => /[✔✗▲]/.test(l)), where);
  assert.equal(lines.at(-1), 'enter  start B5    space close    q close', where);
  assert.ok(bar.startsWith('enter  start B5'), bar);
});

test('the comparison fits at 60x20 and 80x24: where it is taller than the window, the arrows show each entry whole, then the link', () => {
  const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: finishedBefore('b-4') } });
  playUntil(d, (s) => s.view === 'next' && s.lesson === 'b-4');
  d.key('space');
  const shows = B4_CARD.map(([show]) => show);
  const toast = { kind: 'save', message: 'EACCES: permission denied, open /home/sam/claude-code-practice/.practice/learn.json' };
  for (const [cols, rows] of SHORT) {
    const at = `${cols}x${rows}`;
    const seen = new Set();
    for (let i = 0; i < 20; i++) {
      for (const s of [d.state, { ...d.state, toast }]) {
        const lines = render(s, { cols, rows }, theme(CAPS.full)).map(strip);
        assert.equal(lines.length, rows, at);
        for (const l of lines) assert.ok(width(l) <= cols - 1, `${at}: ${l}`);
      }
      const lines = cardText({ state: d.state }, cols, rows);
      const where = `${at}\n${lines.join('\n')}`;
      // Each entry on screen is whole: its command, then what it does to the closing quote.
      for (const [show, does] of B4_CARD) {
        const said = compared(lines, show);
        if (said === undefined) continue;
        assert.equal(said, `"${does}"`, where);
        seen.add(show);
      }
      if (lines.join('').includes(COMMANDS_BY_LEVEL)) break;
      d.key('down');
    }
    assert.deepEqual([...seen], shows, at);
    // Down stops at the link, the last place.
    for (let i = 0; i < 10; i++) d.key('down');
    assert.equal(d.state.cardAt, shows.length, at);
    while (d.state.cardAt) d.key('up');
  }
  // It fits whole at 80x24: every entry and the link at once, with no arrows.
  const tall = cardText(d);
  assert.ok(tall.join('').includes(COMMANDS_BY_LEVEL) && B4_CARD.every(([show, does]) => compared(tall, show) === `"${does}"`), tall.join('\n'));
  assert.doesNotMatch(tall.at(-1), /scroll/);
});

// The comparison as the arrows show it, from its first place to the link:
// each place's lines, in order, at one size, each frame exactly the window.
const comparePlaces = (d, cols, rows) => {
  while (d.state.cardAt) d.key('up');
  const out = [];
  for (let i = 0; i < 20; i++) {
    const frame = render(d.state, { cols, rows }, theme(CAPS.full)).map(strip);
    assert.equal(frame.length, rows, `${cols}x${rows}`);
    for (const l of frame) assert.ok(width(l) <= cols - 1, `${cols}x${rows}: ${l}`);
    const lines = frame.map((l) => l.trim());
    out.push(lines);
    if (lines.join('').includes(COMMANDS_BY_LEVEL)) break;
    d.key('down');
  }
  return out;
};

test('every lesson\'s comparison fits at 60x20 and 80x24, and shows each of its entries whole, beside its command or under it', () => {
  for (const id of Object.keys(RECALL)) {
    const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: finishedBefore(id), ...ownCopy(id) } });
    playUntil(d, (s) => s.view === 'next' && s.lesson === id);
    d.key('space');
    assert.equal(d.state.overlay, 'compare', id);
    const card = lessonById(id).content.card;
    assert.ok(card.length, id);
    for (const [cols, rows] of SHORT) {
      const seen = new Set();
      for (const lines of comparePlaces(d, cols, rows)) {
        const where = `${id} at ${cols}x${rows}\n${lines.join('\n')}`;
        for (const { show, does } of card) {
          const said = compared(lines, show);
          if (said === undefined) continue;
          // Its quote whole, with inline code drawn in its color.
          assert.ok(said.startsWith('"') && said.endsWith('"') && flatText(said) === flatText(does), `${show}: ${where}`);
          seen.add(show);
        }
      }
      assert.deepEqual([...seen], card.map((e) => e.show), `${id} at ${cols}x${rows}`);
    }
  }
});

test('a command too long to leave its quote room beside it puts the quote under it, whole', () => {
  // 51 columns: at 80x24 it would leave its quote 19 beside it.
  const long = '/a-command-long-enough-to-crowd-its-quote-out-of-it';
  const lessons = allCourse.map((l) => (l.id === 'b-4' ? { ...l, content: { ...l.content, card: l.content.card.map((e, k) => (k ? e : { ...e, show: long })) } } : l));
  const d = driver({ course: lessons, saved: { format: 1, welcomed: true, lessons: finishedBefore('b-4') } });
  playUntil(d, (s) => s.view === 'next' && s.lesson === 'b-4');
  d.key('space');
  const [first, ...rest] = lessons.find((l) => l.id === 'b-4').content.card;
  for (const [cols, rows] of SHORT) {
    const places = comparePlaces(d, cols, rows);
    const lines = places[0];
    const where = `${cols}x${rows}\n${lines.join('\n')}`;
    const k = lines.indexOf(long);
    assert.ok(k > 0, where);
    const end = lines.findIndex((l, j) => j > k && l.endsWith('"'));
    assert.equal(lines.slice(k + 1, end + 1).join(' '), `"${first.does}"`, where);
    assert.ok(lines[k + 1].startsWith('"'), where);
    // The rest are under it the same way, each whole.
    for (const { show } of rest) assert.ok(places.flat().includes(show), `${show}: ${where}`);
  }
});

test('a command wider than a row breaks at its spaces, on the card and in the comparison, and is never cut', () => {
  // 75 columns, as i-3's card has one: wider than a 60-column frame's card.
  const long = "git show HEAD:.claude/skills/changelog/SKILL.md | grep -E '^(model|effort):'";
  const lessons = allCourse.map((l) => (l.id === 'b-4' ? { ...l, content: { ...l.content, card: l.content.card.map((e, k) => (k ? e : { ...e, show: long })) } } : l));
  const d = driver({ course: lessons, saved: { format: 1, welcomed: true, lessons: finishedBefore('b-4') } });
  playUntil(d, (s) => s.view === 'next' && s.lesson === 'b-4');
  for (const [view, open] of [['compare', 'space'], ['card', 'c']]) {
    d.key(open);
    assert.equal(d.state.overlay, view);
    for (const cols of [60, 80]) {
      const lines = render(d.state, { cols, rows: 60 }, theme(CAPS.full)).map((l) => strip(l).trim());
      const where = `${view} at ${cols} columns\n${lines.join('\n')}`;
      assert.ok(!lines.some((l) => l.endsWith('…')), `a row is cut: ${where}`);
      assert.ok(lines.join(' ').includes(long), where);
    }
    d.key(open);
  }
});

test('the comparison, as your card (173): it spells the Commands by level link out whole, breaking it only after a /, ? or &, and scrolls no further than the window that ends on it', () => {
  let scrolled = 0;
  for (const id of Object.keys(RECALL)) {
    for (const caps of [CAPS.full, CAPS.ascii]) {
      const t = theme(caps);
      for (const size of SHORT) {
        const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: finishedBefore(id), ...ownCopy(id) } });
        playUntil(d, (s) => s.view === 'next' && s.lesson === id);
        d.key('space');
        const at = `${id} at ${size.join('x')}${t.unicode ? '' : ' (ASCII)'}`;
        const shown = () => {
          const frame = render(d.state, { cols: size[0], rows: size[1] }, t).map(strip);
          assert.equal(frame.length, size[1], at);
          for (const l of frame) assert.ok(width(l) <= size[0] - 1, `${at}: ${l}`);
          return frame.map((l) => l.trim());
        };
        const linked = (lines) => lines.join('').includes(COMMANDS_BY_LEVEL);
        const fitsWhole = linked(shown());
        for (let i = 0; i < 40; i++) cardArrow(d, 'down', size, t);
        const end = shown();
        const where = `${at}\n${end.join('\n')}`;
        assert.ok(linked(end), where);
        assertLinkBreaks(end, where);
        if (fitsWhole) {
          assert.equal(d.state.cardAt, 0, `${at}: it fits, so the arrows move nothing`);
          continue;
        }
        // One up from there leaves the link at once.
        scrolled++;
        cardArrow(d, 'up', size, t);
        assert.ok(!linked(shown()), `${at}: up moved the comparison at once\n${shown().join('\n')}`);
      }
    }
  }
  assert.ok(scrolled > 0, 'no comparison scrolls at 60x20 or 80x24');
});

test('a next screen whose lesson put nothing on the card asks for no recall', () => {
  const lessons = allCourse.map((l) => (l.id === 'b-4' ? { ...l, content: { ...l.content, card: [] } } : l));
  const d = driver({ course: lessons, saved: { format: 1, welcomed: true, lessons: finishedBefore('b-4', lessons) } });
  playUntil(d, (s) => s.view === 'next' && s.lesson === 'b-4');
  for (const [cols, rows] of SHORT) {
    const lines = cardText(d, cols, rows);
    assert.ok(!lines.includes(C.recallAsk('B4')), `${cols}x${rows}\n${lines.join('\n')}`);
  }
});

// ---- beats that read what a file holds (ticket 87) ---------------------------
// A screen's words as one line, borders out, for a sentence that wraps.
const prose = (state, [cols, rows], t) => render(state, { cols, rows }, t).map((l) => strip(l).trim().replace(/^[│|]\s*/, '').replace(/\s*[│|]$/, '')).join(' ').replace(/\s+/g, ' ');

test('a reading beat\'s not-yet line is shown whole, and its pass shows what the file holds, at 60x20 and 80x24', () => {
  const path = '.claude/skills/tdd/SKILL.md';
  for (const caps of [CAPS.full, CAPS.ascii]) {
    const t = theme(caps);
    for (const size of [[60, 20], [80, 24]]) {
      const where = `${size.join('x')} ${caps.unicode ? 'unicode' : 'ascii'}`;
      const no = onReading(`no-match ${path} \\bTODO\\b`);
      tryNow(no, path, '---\nname: tdd\n---\n\n- TODO: write the steps\n');
      assert.ok(prose(no.state, size, t).includes(`Not yet: ${path} still has: - TODO: write the steps`), `${where}: ${prose(no.state, size, t)}`);
      // A parse error's not-yet line is long, and the screen still fits.
      const broken = onReading('json .claude/settings.json permissions.deny');
      tryNow(broken, '.claude/settings.json', '{"permissions": {"deny": ["Read(./.env)"] }, "hooks": [}');
      const lines = render(broken.state, { cols: size[0], rows: size[1] }, t);
      assert.equal(lines.length, size[1], where);
      for (const line of lines) assert.ok(width(line) <= size[0] - 1, `${where}: ${strip(line)}`);
      assert.ok(prose(broken.state, size, t).includes('Not yet: .claude/settings.json does not parse as JSON yet ('), `${where}: ${prose(broken.state, size, t)}`);
      // A parse error that quotes a line break, and a value that holds one,
      // still draw exactly the window: the frame, joined, splits into rows.
      const multi = onReading('json .claude/settings.json permissions.deny');
      tryNow(multi, '.claude/settings.json', 'deny:\n{\n  "permissions": {}\n}\n');
      const value = onReading('json .practice/i-2-hook.json prompt');
      tryNow(value, '.practice/i-2-hook.json', null);
      tryNow(value, '.practice/i-2-hook.json', '{"prompt": "line one\\nline two\\nthree"}');
      assert.equal(value.state.beat.status, 'done', where);
      for (const d of [multi, value]) {
        const frame = render(d.state, { cols: size[0], rows: size[1] }, t).join('\n').split('\n');
        assert.equal(frame.length, size[1], `${where}: ${frame.map(strip).join(' / ')}`);
        for (const line of frame) assert.doesNotMatch(strip(line), /[\r\t\x07]/, where);
      }
      const json = onReading('json .claude/settings.json permissions.deny');
      tryNow(json, '.claude/settings.json', null);
      tryNow(json, '.claude/settings.json', '{"permissions": {"deny": ["Read(./.env)"]}}');
      assert.equal(json.state.beat.status, 'done');
      // Beside the burst, on one line or, where that is too long, two: the
      // key and its value (r27 E12), cut at 60x20 where the burst leaves
      // too little room for the value.
      const words = prose(json.state, size, t);
      const full = 'holds permissions.deny = ["Read(./.env)"]';
      assert.ok(words.includes(`.claude/settings.json ${full}`) || (words.includes('.claude/settings.json') && (words.includes(full) || (size[0] === 60 && words.includes('holds permissions.deny = ')))), `${where}: ${words}`);
    }
  }
});

test('a reading beat already passed when its step opens says "Already done, so this step counts." with what the file holds: no check ran, at 60x20 and 80x24', () => {
  const skill = '.claude/skills/tdd/SKILL.md';
  const settings = '.claude/settings.json';
  for (const caps of [CAPS.full, CAPS.ascii]) {
    const t = theme(caps);
    for (const size of [[60, 20], [80, 24]]) {
      const where = `${size.join('x')} ${caps.unicode ? 'unicode' : 'ascii'}`;
      for (const [verify, path, text, shows] of [
        ['file .practice/b-2-plan.txt', '.practice/b-2-plan.txt', 'Plan the change\n', ['.practice/b-2-plan.txt', 'holds Plan the change']],
        [`json ${settings} permissions.deny`, settings, '{"permissions": {"deny": ["Read(./.env)"]}}', [settings, 'holds permissions.deny = ["Read(./.env)"]']],
        [`match ${skill} ^name:`, skill, '---\nname: tdd\n---\n', [skill, 'holds name: tdd']],
        [`no-match ${skill} \\bTODO\\b`, skill, '---\nname: tdd\n---\n', []],
      ]) {
        const already = onReading(verify);
        already.send({ type: 'file', path, read: Buffer.from(text), stamp: 'x' });
        assert.equal(already.state.beat.status, 'already', `${where} ${verify}`);
        fits(already.state, size, t, `${where} ${verify}`);
        const said = prose(already.state, size, t);
        assert.ok(said.includes('Already done, so this step counts.'), `${where} ${verify}: ${said}`);
        for (const words of shows) assert.ok(said.includes(words), `${where} ${verify}: ${said}`);
        assert.ok(!said.includes('check already passes'), `${where} ${verify}: ${said}`);
      }
      // Its satisfied "Done when" gives way to what the file holds, as on a pass.
      const doneWhen = onReading('file .practice/b-2-plan.txt\n- say: Done when `.practice/b-2-plan.txt` holds your plan.');
      doneWhen.send({ type: 'file', path: '.practice/b-2-plan.txt', read: Buffer.from('Plan the change\n'), stamp: 'x' });
      assert.equal(doneWhen.state.beat.status, 'already', where);
      fits(doneWhen.state, size, t, where);
      const holds = prose(doneWhen.state, size, t);
      assert.ok(holds.includes('holds Plan the change'), `${where}: ${holds}`);
      assert.ok(!holds.includes('holds your plan'), `${where}: ${holds}`);
      // A check did run for a check beat: its line stays.
      const check = onReading('check 0');
      check.send({ type: 'check', lesson: 'b-2', items: [{ index: 0, text: 'saved', pass: true, hint: '' }] });
      assert.equal(check.state.beat.status, 'already', where);
      assert.ok(prose(check.state, size, t).includes('Already done: the check already passes, so this step counts.'), `${where}: ${prose(check.state, size, t)}`);
    }
  }
});

// ---- git status for part of the tree (ticket 88) -----------------------------
// Every size the render tests hold a screen to: exactly `rows` lines, none
// wider than cols - 1.
const fits = (state, [cols, rows], t, where) => {
  const lines = render(state, { cols, rows }, t);
  assert.equal(lines.length, rows, where);
  for (const line of lines) assert.ok(width(line) <= cols - 1, `${where}: ${strip(line)}`);
};

test('git-clean with paths: its lines name the paths, and list only what is under them, at 60x20 and 80x24', () => {
  for (const caps of [CAPS.full, CAPS.ascii]) {
    const t = theme(caps);
    for (const size of [[60, 20], [80, 24]]) {
      const where = `${size.join('x')} ${caps.unicode ? 'unicode' : 'ascii'}`;
      const d = onReading('git-clean secrets/');
      d.send(gitLists(['README.md', 'secrets/key.txt']));
      fits(d.state, size, t, where);
      assert.ok(prose(d.state, size, t).includes('Not yet: 1 file changed under secrets/: secrets/key.txt'), `${where}: ${prose(d.state, size, t)}`);
      assert.ok(!prose(d.state, size, t).includes('README.md'), where);
      d.send(gitLists(['README.md']));
      assert.equal(d.state.beat.status, 'done');
      fits(d.state, size, t, where);
      // Beside the burst, on one line or two.
      const words = prose(d.state, size, t);
      assert.ok(words.includes('git status lists nothing under secrets/.') || (words.includes('git status lists nothing under') && words.includes('secrets/.')), `${where}: ${words}`);
      // With a done-label, the live line before the learner says it ended.
      const live = onReading('git-clean secrets/\n- done-label: the session has ended');
      live.send(gitLists(['README.md']));
      assert.ok(prose(live.state, size, t).includes('Watching git status:') && prose(live.state, size, t).includes('no changes under secrets/ so far'), `${where}: ${prose(live.state, size, t)}`);
      live.send(gitLists(['README.md', 'secrets/a.txt', 'secrets/b.txt']));
      assert.ok(prose(live.state, size, t).includes('2 files changed under secrets/: secrets/a.txt, secrets/b.txt'), `${where}: ${prose(live.state, size, t)}`);
      fits(live.state, size, t, where);
    }
  }
});

test('git-changed: it watches git status, its not-yet line is shown whole, and its pass, or a change already there, shows what changed, at 60x20 and 80x24', () => {
  for (const caps of [CAPS.full, CAPS.ascii]) {
    const t = theme(caps);
    for (const size of [[60, 20], [80, 24]]) {
      const where = `${size.join('x')} ${caps.unicode ? 'unicode' : 'ascii'}`;
      const d = onReading('git-changed src/');
      d.send(gitLists(['README.md']));
      fits(d.state, size, t, where);
      assert.ok(prose(d.state, size, t).includes("Watching git status. I'll turn green the moment it's right."), `${where}: ${prose(d.state, size, t)}`);
      d.key('r');
      d.send(gitLists(['README.md'], [], { asked: d.state.beat.asked }));
      fits(d.state, size, t, where);
      assert.ok(prose(d.state, size, t).includes('Not yet: git status lists no change under src/ yet.'), `${where}: ${prose(d.state, size, t)}`);
      d.send(gitLists(['src/config.js']));
      fits(d.state, size, t, where);
      const words = prose(d.state, size, t);
      assert.ok(words.includes('Changed: src/config.js') || (words.includes('Changed:') && words.includes('src/config.js')), `${where}: ${words}`);
      assert.match(words, /DONE/, where);
      // Already changed when the step opens: git status passed it, not a
      // check, and the card says what it lists.
      for (const [verify, lists, shows] of [['git-changed src/', gitLists(['src/a.js']), 'Changed: src/a.js'], ['git-staged', gitLists(['src/a.js'], ['src/a.js']), 'Staged: src/a.js']]) {
        const already = onReading(verify);
        already.send(lists);
        assert.equal(already.state.beat.status, 'already', verify);
        fits(already.state, size, t, `${where} ${verify}`);
        const said = prose(already.state, size, t);
        assert.ok(said.includes('Already done, so this step counts.') && said.includes(shows), `${where}: ${said}`);
        assert.ok(!said.includes('check already passes'), `${where}: ${said}`);
      }
    }
  }
});

test('git-only and git-staged: a long not-yet line is shown whole, and the pass shows the paths, at 60x20 and 80x24', () => {
  const long = '.claude/skills/five-whys/references/a-very-long-file-name-for-the-examples.md';
  for (const caps of [CAPS.full, CAPS.ascii]) {
    const t = theme(caps);
    for (const size of [[60, 20], [80, 24]]) {
      const where = `${size.join('x')} ${caps.unicode ? 'unicode' : 'ascii'}`;
      const only = onReading('git-only .claude/');
      only.send(gitLists([]));
      only.send(gitLists([long, 'README.md', 'src/index.js', 'docs/notes.md', 'package.json']));
      fits(only.state, size, t, where);
      assert.ok(prose(only.state, size, t).includes('Not yet: 4 files changed outside .claude/: README.md, src/index.js, docs/notes.md'), `${where}: ${prose(only.state, size, t)}`);
      only.send(gitLists([long]));
      fits(only.state, size, t, where);
      // Beside the burst, a long path wraps where it must.
      const words = prose(only.state, size, t);
      assert.ok(words.includes('Changed:') && words.includes('.claude/skills/five-whys/') && words.includes('examples.md'), `${where}: ${words}`);
      const staged = onReading('git-staged');
      staged.send(gitLists(['src/config.js']));
      staged.key('r');
      staged.send(gitLists(['src/config.js'], [], { asked: staged.state.beat.asked }));
      fits(staged.state, size, t, where);
      assert.ok(prose(staged.state, size, t).includes('Not yet: git status lists nothing staged yet.'), `${where}: ${prose(staged.state, size, t)}`);
      staged.send(gitLists(['src/config.js'], ['src/config.js']));
      fits(staged.state, size, t, where);
      assert.ok(prose(staged.state, size, t).includes('Staged: src/config.js'), `${where}: ${prose(staged.state, size, t)}`);
    }
  }
});

test('lessonScreens walks a beat of each git kind to its not-yet and done screens, and each fits', () => {
  const t = theme(CAPS.full);
  for (const verify of ['git-clean secrets/', 'git-changed src/', 'git-only .claude/', 'git-staged']) {
    const lessons = allCourse.map((l) => (l.id === 'b-2' ? { ...l, content: onReading(verify).state.course.find((x) => x.id === 'b-2').content } : l));
    const screens = lessonScreens('b-2', lessons).filter(([label]) => label.startsWith('b-2 Y1.0'));
    const end = screens.at(-1)[1];
    assert.equal(end.beat.status, 'done', `${verify}: ${screens.map(([label]) => label)}`);
    assert.ok(screens.some(([, s]) => s.beat.status === 'fail'), verify);
    for (const [label, s] of screens) for (const size of [[60, 20], [80, 24]]) fits(s, size, t, `${verify} ${label}`);
  }
});

// A ladder's bottom rung is drawn in a chip as wide as its own commands
// (ticket 184): b-1's W3 with its run lines taken out, so the beat's own
// commands no longer size the chip, and a long bottom in its ladder block.
test('a ladder bottom that stands in for a beat\'s commands gets a chip as wide as it, on one row at 80x24 and 60x20', () => {
  const long = 'jq .sandbox .claude/settings.local.json';
  const text = readFileSync(join(root, 'checks/test/fixtures/reducer-course', 'b-1.md'), 'utf8')
    .replace(/- run: "cd <your practice copy>"\n- run: "mkdir -p \.practice"\n- win: "[^"]*"\n- tick: practice-dir\n- run: "claude --version > \.practice\/version\.txt"\n/, '')
    .replace(/- bottom: "mkdir -p \.practice"\n- win: "[^"]*"\n- bottom: "claude --version > \.practice\/version\.txt"/, `- bottom: "${long}"`);
  assert.ok(!/^- run: "claude --version > /m.test(text) && text.includes(long), 'the fixture took out the run lines and put in the long bottom');
  const lessons = courseWith({ 'b-1': text });
  const d = driver({ course: lessons, saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W3', beat: 0, warm: [] } } } });
  d.key('enter');
  assert.equal(stepOf(d.state).id, 'W3');
  bottomRung(d);
  assert.equal(rungsOf(d.state)[d.state.beat.rung].kind, 'bottom');
  const at80 = render(d.state, { cols: 80, rows: 24 }, theme(CAPS.full)).map(strip);
  assert.ok(at80.some((l) => l.includes(long)), `the command is on one row at 80x24:\n${at80.join('\n')}`);
  const at60 = render(d.state, { cols: 60, rows: 20 }, theme(CAPS.full)).map(strip);
  assert.ok(at60.some((l) => l.includes(long)), `the command is on one row at 60x20:\n${at60.join('\n')}`);
});

// 192: the same-answer note on b-2's after snapshot, with the real FAIL
// message 190 wrote, with no hint open, on each rung of the hint ladder and
// on its y/n. The note takes only the rows the screen pads with, and the
// row of a "Press h" line the key bar repeats: at 60x20 and 80x24 no row
// above it moves and nothing more is cut, every look shows the same words,
// the offer is e's only where e works, and the last rung keeps its own.
test('the same-answer note: no row above it moves, nothing cut, the same words in every look, e offered only where it works (192)', async () => {
  const { lessons } = await import('../lessons/index.mjs');
  const { openRepo } = await import('../repo.mjs');
  const { repo, withRepo, write } = await import('./helpers.mjs');
  const item = lessons['b-2'].items[1];
  const hint = withRepo(() => repo(), (dir) => {
    write(dir, { '.practice/b-2-plan.txt': 'src/config.js\n', '.practice/b-2-after.txt': '' });
    return item.check(openRepo(dir));
  });
  assert.match(hint, /lists no changed file yet/);
  const path = '.practice/b-2-after.txt';
  const says = (d, h, stamp) => d.send({ type: 'check', lesson: 'b-2', items: [{ index: 1, text: item.text, pass: false, hint: h }], path, stamp });
  // On the after snapshot with the FAIL on screen, h pressed `presses` times
  // (then y, where `yes`): the note comes with the next identical FAIL.
  const onAfter = (presses, yes = false) => {
    const d = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore('b-2'), 'b-2': { step: 'W7', beat: 4, warm: ['R1', 'R2'], done: [], stamps: { 'W7.4': 'S' } } } } });
    d.key('enter');
    says(d, 'After Claude finishes the edits, run it.', '');
    says(d, hint, 'a');
    for (let i = 0; i < presses; i++) {
      d.send({ type: 'key', name: 'h', ch: 'h', wait: 3_000 });
      d.send({ type: 'flush', wait: 400 });
    }
    if (yes) d.key('y');
    return d;
  };
  const cases = [];
  for (let presses = 0; presses < 8; presses++) {
    const d = onAfter(presses);
    if (!d.state.beat.confirm) {
      cases.push([d.state.beat.rung < 0 ? 'no hint' : `rung ${d.state.beat.rung + 1}`, () => onAfter(presses)]);
      continue;
    }
    cases.push(['the y/n', () => onAfter(presses)], ['the last rung', () => onAfter(presses, true)]);
    break;
  }
  assert.ok(cases.length >= 5, cases.map(([l]) => l).join(', '));
  const offer = flatText(C.goBack(4, 'Switch to plan mode'));
  const why = flatText('The edits this step saves come from the plan you make there.');
  const cutRows = (lines, cols) => lines.filter((l) => /^([│|]\s+)?(…|\.\.\.)$/.test(l.trim()) || (l.endsWith('…') && width(l) === cols - 1)).length;
  for (const [label, make] of cases) {
    const d = make();
    const last = label === 'the last rung';
    if (last) assert.equal(d.state.beat.rung, rungsOf(d.state).length - 1);
    const sizes = [[60, 20], [80, 24]];
    const before = Object.entries(CAPS).flatMap(([capName, caps]) => sizes.map(([cols, rows]) => [capName, cols, rows, render(d.state, { cols, rows }, theme(caps)).map(strip)]));
    says(d, hint, 'b');
    assert.equal(d.state.beat.same, true, label);
    const noteWords = {};
    for (const [capName, cols, rows, was] of before) {
      const t = theme(CAPS[capName]);
      const now = render(d.state, { cols, rows }, t).map(strip);
      const where = `${label} at ${cols}x${rows} (${capName})\nbefore:\n${was.join('\n')}\nafter:\n${now.join('\n')}`;
      assert.equal(now.length, rows, where);
      for (const l of now) assert.ok(width(l) <= cols - 1, `a line is too wide: ${where}`);
      // Every row above the note, and above the "Press h" line it may take
      // the place of, stays where it was.
      const bottom = was.findIndex(cardBottom(t));
      const press = was.findIndex((l) => l.includes(C.pressH) || l.includes(C.pressHAgain));
      const end = press >= 0 ? press : bottom;
      assert.ok(end > 0 && bottom > 0, where);
      assert.deepEqual(now.slice(0, end), was.slice(0, end), `a row above the note moved: ${where}`);
      assert.equal(cutRows(now, cols), cutRows(was, cols), `the note cut a line: ${where}`);
      const nowBottom = now.findIndex(cardBottom(t));
      assert.ok(nowBottom >= end, `the card's bottom border is gone: ${where}`);
      // The note's words, after the "Press h" line where it stays.
      let note = flatText(now.slice(end, nowBottom).join(''));
      for (const p of [C.pressH, C.pressHAgain].map(flatText)) if (note.startsWith(p)) note = note.slice(p.length);
      noteWords[`${cols}x${rows}`] ??= note;
      assert.equal(note, noteWords[`${cols}x${rows}`], `the note's words differ in ${capName}: ${where}`);
      const text = flatText(now.join(''));
      const keys = now.at(-1);
      if (label === 'the y/n') {
        // On the y/n e does nothing, so nothing offers it.
        assert.ok(!text.includes('Presse'), `the y/n offers e: ${where}`);
        assert.doesNotMatch(keys, /\be earlier/, where);
      } else {
        assert.ok(text.includes('Presse'), `nothing offers e: ${where}`);
        assert.match(keys, /\be earlier\b/, `the key bar doesn't name e: ${where}`);
      }
      if (last) {
        // The last rung keeps its offer, with the why, where it was.
        assert.equal(text.split(offer).length, 2, `the offer shows once: ${where}`);
        assert.ok(text.includes(why), `the why is gone: ${where}`);
      } else assert.match(note, /^(Youredidthisstep|Sameansweragain)/, `the note is not on screen: ${where}`);
      // Where the window has the room, the note is whole, with the why.
      if (cols === 80 && label === 'no hint') {
        for (const w of [C.sameAnswer, C.goBack(4, 'Switch to plan mode'), 'The edits this step saves come from the plan you make there.']) assert.ok(note.includes(flatText(w)), `"${w}" is not whole: ${where}`);
      }
      // The keys already on the bar keep their places: e comes in before q.
      if (cols === 80) assert.ok(keys.startsWith(was.at(-1).replace(/\s+q quit$/, '')), `the key bar moved: ${where}`);
    }
  }
});

// A bottom line's lead-in (ticket 188): the page's words that frame its
// command, drawn above the command on the bottom rung and inline.
test('a bottom line\'s lead-in shows above its command, on the bottom rung and inline, at 60x20 and 80x24', () => {
  const file = readFileSync(join(root, 'learn', 'lessons', 'i-1.md'), 'utf8');
  const tdd = parseLesson(file, 'i-1.md').steps.find((x) => x.id === 'Y4').beats[0].bottom[0];
  assert.equal(tdd.leadIn, 'For example, in the practice copy:');
  // The parser names the form.
  const lead = '- lead-in: "For example, in the practice copy:"';
  assert.throws(() => parseLesson(file.replace(lead, '').replace('- hint: "Keep auto mode."', `$&\n${lead}`), 'i-1.md'), /a lead-in line with no bottom line above it/);
  assert.throws(() => parseLesson(file.replace(lead, `${lead}\n${lead}`), 'i-1.md'), /a second lead-in line on one bottom line/);
  assert.throws(() => parseLesson(file.replace(lead, '- lead-in: For example, in the practice copy:'), 'i-1.md'), /lead-in must be a quote of the lesson/);
  // Its place, rows above the first row of the command it frames.
  const above = (lines, where) => {
    const text = lines.map(strip);
    const at = text.findIndex((l) => l.includes('For example, in the practice copy:'));
    const cmd = text.findIndex((l) => l.includes('/tdd a slugify'));
    assert.ok(at >= 0 && cmd > at, `${where}\n${text.join('\n')}`);
  };
  const bottom = driver({ course: allCourse, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore('i-1'), 'i-1': { warm: ['R1', 'R2', 'R3'], step: 'Y4', beat: 0, levels: ['challenge'] } } } });
  bottom.key('enter');
  for (let i = 0; i < 8 && !bottom.state.beat.confirm; i++) bottom.key('h');
  bottom.key('y');
  assert.equal(rungsOf(bottom.state)[bottom.state.beat.rung].kind, 'bottom');
  // Inline: a HINTED step eased to GUIDED shows its bottom lines on the card.
  const course = courseWith({ 'i-1': file.replace('- bottom: "mkdir -p .claude/skills/tdd"', `$&\n${lead}`) });
  const inline = driver({ course, saved: { format: 1, welcomed: true, lessons: { ...finishedBefore('i-1'), 'i-1': { warm: ['R1', 'R2', 'R3'], step: 'Y1', beat: 0, levels: ['challenge'], easedSteps: { Y1: true } } } } });
  inline.key('enter');
  assert.equal(tierOf(inline.state), 'guided');
  for (const [cols, rows] of [[60, 20], [80, 24]]) {
    for (const [name, caps] of Object.entries(CAPS)) {
      const t = theme(caps);
      const where = `${cols}x${rows} (${name})`;
      const lines = render(bottom.state, { cols, rows }, t);
      assert.equal(lines.length, rows, where);
      for (const line of lines) assert.ok(width(line) <= cols - 1, `${where}: ${strip(line)}`);
      above(lines, `bottom rung at ${where}`);
      const card = render(inline.state, { cols, rows }, t).map(strip);
      const at = card.findIndex((l) => l.includes('For example, in the practice copy:'));
      const cmd = card.findIndex((l) => l.includes('mkdir -p .claude/skills/tdd'));
      assert.ok(at >= 0 && cmd > at, `inline at ${where}\n${card.join('\n')}`);
    }
  }
});
