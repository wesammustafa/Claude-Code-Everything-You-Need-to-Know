// Code from the page (ticket 90): a beat's fenced block on the card, with
// its line breaks, the line the beat explains marked, and no word broken
// across rows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capabilities, osc52 } from '../../learn/lib/caps.mjs';
import { C } from '../../learn/lib/copy.mjs';
import { lessonOf, rungsOf, stepOf, tierOf } from '../../learn/lib/flow.mjs';
import { ambientAllowed, TIMING } from '../../learn/lib/motion.mjs';
import { render } from '../../learn/lib/render.mjs';
import { graphemes, isEmoji, strip, width } from '../../learn/lib/text.mjs';
import { theme } from '../../learn/lib/theme.mjs';
import { course, courseWith, DEMO_B2, driver, finished, withCode } from './learn-drive.mjs';

const SIZES = [[60, 20], [80, 24]];
const CAPS = {
  full: { tty: true, depth: 8, unicode: true, links: true, win32: false },
  ascii: { tty: true, depth: 1, unicode: false, links: false, win32: false },
};
const fenced = (lines, info = 'bash') => [`\`\`\`${info}`, ...lines, '```'];

// The hooks page's Worked example step 1: a loop whose curl URL is wider
// than any card.
const URL = '"https://raw.githubusercontent.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/main/examples/intermediate/05-hooks/dot-claude/hooks/$f.sh"';
const LOOP = ['mkdir -p .claude/hooks', 'for f in protect-files format-after-edit; do', `  curl -fsSL ${URL} -o ".claude/hooks/$f.sh"`, 'done', 'chmod +x .claude/hooks/*.sh'];

// On the made-up lesson 2's Worked example, whose beat holds `lines`, in a
// terminal that takes OSC 52 unless `facts` says otherwise. `progress` adds
// to lesson 2's saved progress, such as lessHelp.
function atCode(lines, facts = {}, progress = {}) {
  const d = driver({ course: courseWith({ 'b-2': withCode(lines) }), facts: { clipboard: true, ...facts }, saved: { format: 1, welcomed: true, lessons: { 'b-1': finished(course.find((l) => l.id === 'b-1')), 'b-2': { warm: ['R1', 'R2', 'R3'], done: ['R1', 'R2', 'R3'], step: 'W1', beat: 0, ...progress } } } });
  for (let i = 0; i < 3 && d.state.view !== 'step'; i++) d.key('enter');
  if (stepOf(d.state)?.id !== 'W1') throw new Error(`atCode: on ${d.state.view}, not W1`);
  return d;
}

// A card row without the card's rail.
const inCard = (row) => row.replace(/^\s*[│|]  /, '');

// Every screen is exactly the window: `rows` lines, none wider than
// cols - 1, one emoji at most on a line.
function fits(lines, cols, rows, where) {
  assert.equal(lines.length, rows, where);
  lines.forEach((line, i) => {
    assert.ok(width(line) <= cols - 1, `${where}, line ${i + 1} is ${width(line)} wide: ${strip(line)}`);
    assert.ok(graphemes(strip(line)).filter(isEmoji).length <= 1, `${where}, line ${i + 1}`);
  });
}

test('the card shows the block with its line breaks, the line the beat explains marked, and never breaks a word across rows', () => {
  const d = atCode(['- code: point 3', ...fenced(LOOP)]);
  for (const [name, caps] of Object.entries(CAPS)) {
    const t = theme(caps);
    const pointer = caps.unicode ? '▸' : '>';
    for (const [cols, rows] of SIZES) {
      const where = `${cols}x${rows} (${name})`;
      const lines = render(d.state, { cols, rows }, t);
      fits(lines, cols, rows, where);
      const screen = lines.map((l) => strip(l));
      // Each short line is a row of its own, in the page's order.
      const at = ['mkdir -p .claude/hooks', 'for f in protect-files format-after-edit; do', 'curl -fsSL', 'done', 'chmod +x .claude/hooks/*.sh']
        .map((text) => screen.findIndex((r) => r.includes(text)));
      assert.ok(at.every((n, k) => n > 0 && (k === 0 || n > at[k - 1])), `${where}\n${screen.join('\n')}`);
      assert.ok(screen.findIndex((r) => r.includes(' done')) === at[3] && !screen[at[3]].includes('chmod'), `${where}: done is a row of its own`);
      // The curl line keeps its indent, two columns in from the loop's.
      const indentOf = (row, text) => row.indexOf(text);
      assert.equal(indentOf(screen[at[2]], 'curl') - indentOf(screen[at[1]], 'for f'), 2, where);
      // The pointer marks line 3 and no other.
      assert.ok(inCard(screen[at[2]]).startsWith(pointer), `${where}: ${screen[at[2]]}`);
      for (const k of [0, 1, 3, 4]) assert.ok(!inCard(screen[at[k]]).startsWith(pointer), `${where}: ${screen[at[k]]}`);
      // Every word the card has room for is whole on one row; the URL, wider
      // than any row, is cut at the row's end with dots that can't pass for
      // code, and none of its tail shows.
      for (const word of LOOP.join(' ').split(/\s+/).filter((w) => w && w !== URL)) {
        assert.ok(screen.some((r) => r.includes(word)), `${where}: ${word} is not whole on a row\n${screen.join('\n')}`);
      }
      const dots = caps.unicode ? '…' : '...';
      const head = screen.findIndex((r) => r.includes(URL.slice(0, 30)));
      assert.ok(head > 0 && screen[head].trimEnd().endsWith(dots), `${where}: the URL's head\n${screen.join('\n')}`);
      assert.ok(!screen.some((r) => r.includes('hooks/$f.sh"') && !r.includes('-o')), `${where}: the URL's tail shows\n${screen.join('\n')}`);
      // Line 3's next rows carry the wrap mark where a number would be, so
      // they read as one line; a new line's first row never does.
      const wrap = caps.unicode ? '↳' : '+';
      const numbered = screen.slice(at[0], at[4] + 1).map(inCard);
      assert.deepEqual(numbered.map((r) => r.match(/^. +(\d+|↳|\+) /)?.[1]), ['1', '2', '3', ...Array(numbered.length - 5).fill(wrap), '4', '5'], `${where}\n${numbered.join('\n')}`);
      // A row under the block says where the cut line is whole.
      const flat = screen.map((r) => inCard(r).trim()).join(' ').replace(/\s+/g, ' ');
      assert.ok(flat.includes(C.codeWide(dots)), `${where}\n${screen.join('\n')}`);
    }
  }
});

// The hooks page's Your turn skeleton: 17 lines.
const SKELETON = ['#!/bin/bash', 'INPUT=$(cat)', 'FILE_PATH=$(echo "$INPUT" | jq -r \'.tool_input.file_path // empty\')', 'FILE_PATH="${FILE_PATH//\\\\//}"', 'NAME=$(basename "$FILE_PATH")', '', 'case "/$FILE_PATH" in', '  */package-lock.json | */.git/*)',
  '    echo "Blocked: $FILE_PATH is protected" >&2', '    exit 2', '    ;;', 'esac', '', '# TODO: block a file named .env, or .env. followed by anything except example', '# TODO: block any file inside a secrets/ folder', '', 'exit 0'];

test('a beat on part of a longer block shows only its window, each line under its number in the block', () => {
  const d = atCode(['- code: lines 9-16 point 10', ...fenced(SKELETON)]);
  for (const [name, caps] of Object.entries(CAPS)) {
    const t = theme(caps);
    const where = `80x24 (${name})`;
    const lines = render(d.state, { cols: 80, rows: 24 }, t);
    fits(lines, 80, 24, where);
    const card = lines.map((l) => inCard(strip(l)));
    const row = (n) => card.find((r) => new RegExp(`^.\\s+${n}  `).test(r));
    assert.match(row(9), /echo "Blocked: \$FILE_PATH is protected" >&2/, where);
    assert.match(row(10), /^[▸>]\s+10      exit 2/, `${where}: the pointer on line 10\n${card.join('\n')}`);
    assert.match(row(15), /# TODO: block any file inside a secrets\/ folder/, where);
    assert.match(row(16), /^\s+16\s*$/, `${where}: the blank line 16 is a row`);
    for (const n of [1, 8, 17]) assert.equal(row(n), undefined, `${where}: line ${n} shows`);
    assert.ok(!card.some((r) => r.includes('#!/bin/bash') || r.includes('exit 0')), where);
  }
});

test('a block too tall for the window shows its first lines whole, then points to the page', () => {
  const d = atCode(['- code: lines 9-16 point 10', ...fenced(SKELETON)]);
  for (const [name, caps] of Object.entries(CAPS)) {
    const t = theme(caps);
    const where = `60x20 (${name})`;
    const lines = render(d.state, { cols: 60, rows: 20 }, t);
    fits(lines, 60, 20, where);
    const card = lines.map((l) => inCard(strip(l)));
    const text = card.join('\n');
    assert.match(text, /9\s+echo "Blocked: \$FILE_PATH is protected"\s*\n\s+(↳|\+)\s+>&2/, where);
    assert.match(text, /10\s+exit 2/, where);
    // The page pointer stands where the lines that don't fit would be.
    const more = card.findIndex((r) => r.includes(C.codeMore));
    assert.ok(more > card.findIndex((r) => /10\s+exit 2/.test(r)), `${where}\n${text}`);
    assert.ok(!card.some((r) => /^(…|\.\.\.)\s*$/.test(r)), `${where}: a bare ellipsis\n${text}`);
    // A line shows whole or not at all: no line's first row without the rest.
    assert.ok(!text.includes('# TODO: block a file named .env, or .env.') || text.includes('followed by anything except example'), `${where}\n${text}`);
    assert.ok(!text.includes('# TODO: block any file inside a secrets/') || text.includes('secrets/ folder'), `${where}\n${text}`);
  }
});

test('a win line under a block replaces it on native Windows, as it replaces a run line', () => {
  const block = ['mkdir -p .practice', 'git status --porcelain > .practice/b-2-before.txt'];
  const WIN_LINE = 'New-Item -ItemType Directory -Force .practice';
  const lines = ['- code: point 1', ...fenced(block), `- win: "${WIN_LINE}"`];
  assert.throws(() => atCode(['- code: point 1', ...fenced(block), '- note: "x"', `- win: "${WIN_LINE}"`]), /a win line with no run, code or bottom line above it/);
  for (const win32 of [false, true]) {
    const d = atCode(lines, { win32 });
    for (const [name, caps] of Object.entries(CAPS)) {
      const t = theme({ ...caps, win32 });
      for (const [cols, rows] of SIZES) {
        const where = `${cols}x${rows} (${name}, ${win32 ? 'Windows' : 'not Windows'})`;
        const out = render(d.state, { cols, rows }, t);
        fits(out, cols, rows, where);
        const text = out.map((l) => strip(l)).join('\n');
        // A command wraps at a space on a narrow card, as a run line does.
        const flat = out.map((l) => inCard(strip(l)).trim()).join(' ').replace(/\s+/g, ' ');
        assert.equal(flat.includes(WIN_LINE), win32, `${where}\n${text}`);
        assert.equal(text.includes('mkdir -p .practice'), !win32, `${where}\n${text}`);
        assert.equal(text.includes('git status --porcelain'), !win32, where);
      }
    }
  }
});

// The key bar's last row, without color.
const keyBar = (out) => strip(out.at(-1));

test('k copies the block: it asks the terminal to copy the whole block, says what it did, and is on the key bar only where a block is', () => {
  const d = atCode(['- code: lines 1-5 point 3', ...fenced([...LOOP, 'ls -l .claude/hooks'])]);
  for (const [name, caps] of Object.entries(CAPS)) {
    for (const [cols, rows] of SIZES) assert.match(keyBar(render(d.state, { cols, rows }, theme(caps))), new RegExp(`\\bk ${C.k.copy}\\b`), `${cols}x${rows} (${name})`);
  }
  // The whole block, not only the lines this beat shows.
  assert.deepEqual(d.key('k').filter((e) => e.type === 'copy'), [{ type: 'copy', text: [...LOOP, 'ls -l .claude/hooks'].join('\n') }]);
  for (const [name, caps] of Object.entries(CAPS)) {
    for (const [cols, rows] of SIZES) {
      const out = render(d.state, { cols, rows }, theme(caps));
      fits(out, cols, rows, `${cols}x${rows} (${name})`);
      const flat = out.map((l) => strip(l).trim()).join(' ').replace(/\s+/g, ' ');
      assert.ok(flat.includes(C.copied(6)), `${cols}x${rows} (${name})\n${out.map(strip).join('\n')}`);
    }
  }
  assert.equal(d.state.beat.status === 'done', false, 'copying is no step done');
  // On native Windows, a win line stands in for the block: k copies it.
  const WIN_LINE = 'New-Item -ItemType Directory -Force .practice';
  const win = atCode(['- code: point 1', ...fenced(['mkdir -p .practice']), `- win: "${WIN_LINE}"`], { win32: true });
  assert.deepEqual(win.key('k').filter((e) => e.type === 'copy'), [{ type: 'copy', text: WIN_LINE }]);
  // A beat with no block: no k, and k does nothing.
  const plain = atCode(['- run: "git status --porcelain > .practice/b-2-before.txt"']);
  assert.doesNotMatch(keyBar(render(plain.state, { cols: 80, rows: 24 }, theme(CAPS.full))), /\bk copy\b/);
  assert.deepEqual(plain.key('k').filter((e) => e.type === 'copy'), []);
});

test('a beat whose point is the last line of its window keeps that line and the note under the block at 60x20; the lines farthest from it give way', () => {
  const d = atCode(['- code: lines 9-16 point 16', ...fenced(SKELETON), '- note: "Run the check."']);
  for (const [name, caps] of Object.entries(CAPS)) {
    const t = theme(caps);
    const pointer = caps.unicode ? '▸' : '>';
    for (const [cols, rows] of SIZES) {
      const where = `${cols}x${rows} (${name})`;
      const lines = render(d.state, { cols, rows }, t);
      fits(lines, cols, rows, where);
      const card = lines.map((l) => inCard(strip(l)));
      const text = card.join('\n');
      const point = card.findIndex((r) => r.startsWith(`${pointer} 16`));
      assert.ok(point > 0, `${where}: no pointer on line 16\n${text}`);
      assert.ok(card.some((r) => r.includes('"Run the check."')), `${where}: the note\n${text}`);
      // What gave way is the top of the window, under one page pointer above
      // the lines that stay.
      const shown = card.map((r) => r.match(/^. +(\d+) /)?.[1]).filter(Boolean).map(Number);
      assert.deepEqual(shown, shown.length ? Array.from({ length: shown.length }, (_, k) => 17 - shown.length + k) : [], `${where}\n${text}`);
      if (shown[0] > 9) assert.ok(card.findIndex((r) => r.includes(C.codeMore)) < card.findIndex((r) => /^. +\d+ /.test(r)), `${where}\n${text}`);
    }
  }
  // After k, the toast takes rows: the pointer still shows.
  d.key('k');
  for (const [name, caps] of Object.entries(CAPS)) {
    const lines = render(d.state, { cols: 60, rows: 20 }, theme(caps));
    fits(lines, 60, 20, `60x20 after k (${name})`);
    assert.ok(lines.some((l) => inCard(strip(l)).startsWith(`${caps.unicode ? '▸' : '>'} 16`)), `60x20 after k (${name})\n${lines.map(strip).join('\n')}`);
  }
});

test('with less help, a GUIDED step\'s block leaves the card for the bottom rung, as its run lines do, and k copies it only there', () => {
  const d = atCode(['- code: lines 9-16 point 12', ...fenced(SKELETON)], {}, { lessHelp: true });
  assert.equal(tierOf(d.state), 'hinted');
  for (const [name, caps] of Object.entries(CAPS)) {
    for (const [cols, rows] of SIZES) {
      const where = `${cols}x${rows} (${name})`;
      const out = render(d.state, { cols, rows }, theme(caps));
      fits(out, cols, rows, where);
      const text = out.map(strip).join('\n');
      assert.ok(!text.includes('esac') && text.includes(C.pressH), `${where}\n${text}`);
      assert.doesNotMatch(keyBar(out), /\bk copy\b/, where);
    }
  }
  assert.deepEqual(d.key('k').filter((e) => e.type === 'copy'), []);
  assert.equal(rungsOf(d.state).at(-1).kind, 'bottom');
  for (let i = 0; i < 4 && !d.state.beat.confirm; i++) d.key('h');
  d.key('y');
  assert.equal(d.state.progress['b-2'].bottomAt, 'W1', 'the exact code was shown');
  for (const [name, caps] of Object.entries(CAPS)) {
    const pointer = caps.unicode ? '▸' : '>';
    for (const [cols, rows] of SIZES) {
      const where = `${cols}x${rows} (${name}), the bottom rung`;
      const out = render(d.state, { cols, rows }, theme(caps));
      fits(out, cols, rows, where);
      const text = out.map(strip).join('\n');
      assert.match(text, new RegExp(`\\${pointer} 12  esac`), `${where}\n${text}`);
      assert.match(keyBar(out), /\bk copy\b/, where);
    }
  }
  assert.deepEqual(d.key('k').filter((e) => e.type === 'copy'), [{ type: 'copy', text: SKELETON.join('\n') }]);
});

// Lesson 2's Worked example as an ask beat with `lines` above its question.
const W1 = DEMO_B2.slice(DEMO_B2.indexOf('### W1'), DEMO_B2.indexOf('### Y1'));
const asking = (lines) => DEMO_B2.replace(W1, ['### W1 | Worked example step 1 of 1 | Read the loop', '- tier: guided', '- skill: snapshot', '- beat: ask', ...lines,
  '- ask: Which file does the loop fetch?', '- right: "`protect-files.sh`"', '- wrong: "`hooks.json`"', '- because: "No such file."', '', ''].join('\n'));

test('k is on the bar wherever it copies: a done beat, a question not yet answered, and never where the terminal takes no OSC 52', () => {
  const block = ['- code: lines 1-5 point 3', ...fenced(LOOP)];
  const d = atCode(block);
  const items = [{ index: 0, text: lessonOf(d.state).items[0], pass: false, hint: 'Not there yet.' }];
  d.send({ type: 'check', lesson: 'b-2', items, path: '.practice/b-2-before.txt', stamp: 'a' });
  d.send({ type: 'check', lesson: 'b-2', items: items.map((it) => ({ ...it, pass: true, hint: '' })), path: '.practice/b-2-before.txt', stamp: 'b' });
  assert.ok(['done', 'already'].includes(d.state.beat.status), d.state.beat.status);
  for (const [name, caps] of Object.entries(CAPS)) {
    assert.match(keyBar(render(d.state, { cols: 80, rows: 24 }, theme(caps))), /\bk copy\b/, `done (${name})`);
  }
  assert.equal(d.key('k').filter((e) => e.type === 'copy').length, 1);
  const ask = driver({ course: courseWith({ 'b-2': asking(block) }), facts: { clipboard: true }, saved: { format: 1, welcomed: true, lessons: { 'b-1': finished(course.find((l) => l.id === 'b-1')), 'b-2': { warm: ['R1', 'R2', 'R3'], done: ['R1', 'R2', 'R3'], step: 'W1', beat: 0 } } } });
  for (let i = 0; i < 3 && ask.state.view !== 'step'; i++) ask.key('enter');
  assert.match(keyBar(render(ask.state, { cols: 80, rows: 24 }, theme(CAPS.full))), /\bk copy\b/, 'an ask beat');
  assert.equal(ask.key('k').filter((e) => e.type === 'copy').length, 1);
  // A terminal that takes no OSC 52: no k, and k does nothing.
  const off = atCode(block, { clipboard: false });
  assert.doesNotMatch(keyBar(render(off.state, { cols: 80, rows: 24 }, theme(CAPS.full))), /\bk copy\b/);
  assert.deepEqual(off.key('k').filter((e) => e.type === 'copy'), []);
  assert.equal(off.state.toast, null);
});

test('at 60 columns the key bar keeps ? more: k gives way first', () => {
  const d = atCode(['- why: "Because it is."', '- code: point 1', ...fenced(['ls'])]);
  for (const [name, caps] of Object.entries(CAPS)) {
    assert.match(keyBar(render(d.state, { cols: 60, rows: 20 }, theme(caps))), /\? more/, `60x20 (${name})`);
    assert.match(keyBar(render(d.state, { cols: 80, rows: 24 }, theme(caps))), /\? more {4}k copy/, `80x24 (${name})`);
  }
});

test('OSC 52 goes only to terminals that put it on the clipboard, as base64 of the whole block', () => {
  assert.equal(osc52('ls\necho "é"'), `\x1b]52;c;${Buffer.from('ls\necho "é"').toString('base64')}\x07`);
  const tty = { isTTY: true, getColorDepth: () => 8 };
  const on = (env) => capabilities(tty, { TERM: 'xterm-256color', ...env }, 'linux', []).clipboard;
  for (const env of [{ KITTY_WINDOW_ID: '1' }, { TERM_PROGRAM: 'WezTerm' }, { TERM_PROGRAM: 'ghostty' }, { ALACRITTY_WINDOW_ID: '1' }, { WT_SESSION: 'x' }]) assert.equal(on(env), true, JSON.stringify(env));
  for (const env of [{}, { TERM_PROGRAM: 'Apple_Terminal' }, { TERM_PROGRAM: 'iTerm.app' }, { TERM_PROGRAM: 'vscode' }, { KITTY_WINDOW_ID: '1', TMUX: '/tmp/tmux' }, { KITTY_WINDOW_ID: '1', STY: '1.pts' },
    { KITTY_WINDOW_ID: '1', LEARN_PLAIN: '1' }, { KITTY_WINDOW_ID: '1', TERM: 'dumb' }]) assert.equal(on(env), false, JSON.stringify(env));
  assert.equal(capabilities(tty, { KITTY_WINDOW_ID: '1' }, 'linux', ['--plain']).clipboard, false);
  assert.equal(capabilities({ isTTY: false }, { KITTY_WINDOW_ID: '1' }, 'linux', []).clipboard, false);
});

test('the reading grace counts the lines a beat shows, not the whole block', () => {
  const d = atCode(['- code: lines 1-2 point 1', ...fenced(SKELETON)]);
  const fx = d.state.fx;
  const at = Math.max(fx.key + TIMING.keyQuiet, Math.max(fx.view ?? 0, fx.open ?? 0, fx.text ?? 0) + TIMING.graceMin) + 100;
  assert.ok(at - d.state.now < TIMING.graceMax, 'the whole block would hold the grace past this');
  assert.equal(ambientAllowed({ ...d.state, lastActivity: at }, at), true);
});
