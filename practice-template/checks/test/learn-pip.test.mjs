// The detailed Pip (170): the package's half-cell raster on the big-Pip
// screens where the window has rows to spare, the 9x4 glyph Pip elsewhere.
// Where it goes (pipSlot), how the screen holds it, its cells, and the state
// Pip shows for what the app saw.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capabilities } from '../../learn/lib/caps.mjs';
import { C } from '../../learn/lib/copy.mjs';
import { PIP_INK, pipGreeting, pipRaster, pipShown } from '../../learn/lib/art.mjs';
import { createPip, PALETTE, rasterizePip, restPose } from '../../learn/lib/pip/pip.mjs';
import { IDLE_MS, reduce } from '../../learn/lib/flow.mjs';
import { ambientOpened, greetStart, pipGates, pipJump, REST, SHOTS, TIMING } from '../../learn/lib/motion.mjs';
import { pipHost } from '../../learn/lib/main.mjs';
import { bootFrame, pipSlot, pipTarget, render } from '../../learn/lib/render.mjs';
import { strip, width } from '../../learn/lib/text.mjs';
import { theme } from '../../learn/lib/theme.mjs';
import { allScreens, course, driver, finishedBefore, playUntil } from './learn-drive.mjs';

const CAPS = {
  full: { tty: true, depth: 8, unicode: true, links: true, win32: false },
  truecolor: { tty: true, depth: 24, unicode: true, links: true, win32: false },
  sixteen: { tty: true, depth: 4, unicode: true, links: false, win32: false },
  noColor: { tty: true, depth: 1, unicode: true, links: false, win32: false },
  ascii: { tty: true, depth: 1, unicode: false, links: false, win32: true },
};
const screens = allScreens();
const screen = (label) => screens.find(([l]) => l === label)[1];
const size = (cols, rows) => ({ cols, rows });
const SIZES = [[60, 20], [80, 24], [100, 30], [120, 40], [200, 50]];
// The detailed Pip as main hands it to render: pipSlot's size, and a pose.
const handed = (s, at, t, pose, ahead = null) => {
  const slot = pipSlot(s, at, t, ahead);
  return slot && { size: slot, pose };
};

// One truecolor predicate (181): the theme's, which pipSlot and main's
// gates both read.
test('theme.truecolor: 24-bit color only, at every other depth not', () => {
  for (const [label, caps] of Object.entries(CAPS)) assert.equal(theme(caps).truecolor, caps.depth >= 24, label);
});

// The mapping study's room per screen (build/pipmap/layout.md): standard
// (32x16) needs 12 spare rows. Small (20x10) and hero are not used: small's
// eyes turn to bars (174). Each screen is measured at its busiest: with a
// toast, and on resume with the y/n to start over.
test('pipSlot: standard or nothing, only on boot, welcome, resume, level-up and complete where it fits, and only in truecolor', () => {
  const t = theme(CAPS.truecolor);
  const boot = null;
  const welcome = driver().state;
  const broken = driver({ facts: { gitError: 'spawn git ENOENT' } }).state;
  const expected = [
    // Boot: 9 spare rows at 60x20, 13 at 80x24, 28 at 120x40.
    [boot, 60, 20, null], [boot, 80, 24, 'standard'], [boot, 120, 40, 'standard'], [boot, 200, 50, 'standard'],
    // The welcome: none spare at 60x20, 2 at 80x24, 7 at 100x30 less a
    // toast's row; with a git error 4 at 100x30 and 14 at 120x40.
    [welcome, 60, 20, null], [welcome, 80, 24, null], [welcome, 100, 30, null], [broken, 100, 30, null], [broken, 120, 40, 'standard'],
    // Resume, with the y/n and a toast: 6 spare at 60x20 less the toast's
    // two rows; 11 at 80x24 less one.
    [screen('resume'), 60, 20, null], [screen('resume'), 80, 24, null], [screen('resume'), 120, 40, 'standard'],
    // Level-up: none spare at 60x20, 6 at 80x24 less a toast's row, 11 at 100x30.
    [screen('level up hinted'), 60, 20, null], [screen('level up hinted'), 80, 24, null], [screen('level up hinted'), 100, 30, null], [screen('level up challenge'), 120, 40, 'standard'],
    // Complete: 2 or 3 spare at 80x24, 8 at 100x30, 18 at 120x40.
    [screen('complete'), 80, 24, null], [screen('complete'), 100, 30, null], [screen('complete'), 120, 40, 'standard'],
  ];
  for (const [s, cols, rows, slot] of expected) assert.equal(pipSlot(s, size(cols, rows), t), slot, `${s?.view ?? 'boot'}${s?.facts.gitError ? ' (git error)' : ''} at ${cols}x${rows}`);
  // Never small, at any size.
  for (const [cols, rows] of [...SIZES, [90, 30], [140, 45]]) {
    for (const [label, s] of [['boot', null], ...screens]) assert.ok([null, 'standard'].includes(pipSlot(s, size(cols, rows), t)), `${label} at ${cols}x${rows}`);
  }
  // Pip keeps its size while a screen is up: a stray key's toast, or the
  // y/n to start over, leaves it as it was.
  const stray = { kind: 'stray', until: Infinity };
  for (const [cols, rows] of SIZES) {
    for (const [label, s] of [['welcome', welcome], ['resume', screen('resume')], ['level up hinted', screen('level up hinted')], ['complete', screen('complete')]]) {
      const plain = pipSlot(s, size(cols, rows), t);
      assert.equal(pipSlot({ ...s, toast: stray }, size(cols, rows), t), plain, `${label} at ${cols}x${rows}, a toast`);
      if (s.view === 'resume') assert.equal(pipSlot(screen('resume confirm'), size(cols, rows), t), plain, `${label} at ${cols}x${rows}, the y/n`);
    }
  }
  // The boot frame's Pip is no bigger than the next screen's: none where the
  // next screen has none.
  for (const [cols, rows] of SIZES) {
    const at = size(cols, rows);
    for (const next of [welcome, screen('resume'), screen('intro')]) {
      const own = pipSlot(null, at, t);
      const cap = pipSlot(next, at, t);
      assert.equal(pipSlot(null, at, t, next), cap && own, `boot before ${next.view} at ${cols}x${rows}`);
    }
  }
  // No big Pip, no raster: every other screen, and every overlay.
  for (const [label, s] of screens) {
    if (!['welcome', 'resume', 'levelup', 'complete'].includes(s.view) || s.overlay) assert.equal(pipSlot(s, size(200, 50), t), null, label);
  }
  // Only with Unicode and truecolor: at 256 colors the package's soft edges
  // round to fringes.
  for (const caps of ['full', 'sixteen', 'noColor', 'ascii']) assert.equal(pipSlot(null, size(200, 50), theme(CAPS[caps])), null, caps);
  // Below the smallest window, the app draws no screen.
  assert.equal(pipSlot(null, size(59, 50), t), null);
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
// The package's standard size, from its README: 32x16.
const RASTER = { standard: { cols: 32, tall: 16 } };
const toast = { kind: 'save', message: 'EACCES: permission denied, open .practice/learn.json' };
const BIG = [
  ...screens.filter(([, s]) => ['welcome', 'resume', 'levelup', 'complete'].includes(s.view) && !s.overlay),
  ...course.filter((l) => l.content).flatMap((l) => celebrations(l.id)),
  ['welcome, git error', driver({ facts: { gitError: 'spawn git ENOENT' } }).state],
  ['welcome, a toast', { ...driver().state, toast }],
  ['complete, a toast', { ...screen('complete'), toast }],
];
const flat = (lines) => strip(lines.join('')).replace(/[^A-Za-z0-9]/g, '');
const blank = (l) => strip(l).trim() === '';

// The glyph screen `g` and the raster screen `r` of one state: the rows
// above Pip are the same, the words beside Pip are the same, and below Pip
// every row is the same, in order, with only the padding rows over the key
// bar fewer, by the rows the raster adds.
function keepsEveryRow(g, r, tall, where) {
  const show = `${where}\n${g.map(strip).join('\n')}\n----\n${r.map(strip).join('\n')}`;
  const start = g.findIndex((l) => strip(l).includes('╭───┴───╮')) - 1;
  assert.ok(start >= 0, `no Pip in the glyph screen: ${show}`);
  assert.deepEqual(r.slice(0, start), g.slice(0, start), `the rows above Pip: ${show}`);
  let gEnd = start + 4;
  while (gEnd < g.length && !blank(g[gEnd])) gEnd += 1;
  let rEnd = start + tall;
  while (rEnd < r.length && !blank(r[rEnd])) rEnd += 1;
  assert.equal(flat(r.slice(start, rEnd)), flat(g.slice(start, gEnd)), `the words beside Pip: ${show}`);
  const extra = (rEnd - start) - (gEnd - start);
  let i = g.length - 1;
  let j = r.length - 1;
  while (j >= rEnd && g[i] === r[j]) [i, j] = [i - 1, j - 1];
  let skipped = 0;
  while (skipped < extra && i >= gEnd && g[i] === '') [i, skipped] = [i - 1, skipped + 1];
  while (j >= rEnd && g[i] === r[j]) [i, j] = [i - 1, j - 1];
  assert.deepEqual([i, j, skipped], [gEnd - 1, rEnd - 1, extra], `the rows below Pip: ${show}`);
}

test('the raster takes only rows the screen pads with: every row the 9x4 Pip\'s screen shows is still there, at every size', () => {
  const t = theme(CAPS.truecolor);
  const drawn = new Set();
  for (const [cols, rows] of SIZES) {
    const at = size(cols, rows);
    const cases = [['boot', null, (pose) => bootFrame(0, at, t, undefined, pose && handed(null, at, t, pose)), 'working'], ...BIG.map(([label, s]) => [label, s, (pose) => render(s, at, t, undefined, pose && handed(s, at, t, pose)), s.view === 'complete' ? 'success' : 'ready'])];
    for (const [label, s, draw, state] of cases) {
      const slot = pipSlot(s, at, t);
      const where = `${label} at ${cols}x${rows} (${slot})`;
      const g = draw(null);
      const r = draw(restPose(state));
      assert.equal(r.length, rows, where);
      r.forEach((l, k) => assert.ok(width(l) <= cols - 1, `${where}, line ${k + 1} is ${width(l)} wide`));
      if (!slot) {
        assert.deepEqual(r, g, `${where}: no slot, the 9x4 Pip`);
        continue;
      }
      drawn.add(`${s?.view ?? 'boot'} ${slot}`);
      keepsEveryRow(g, r, RASTER[slot].tall, where);
    }
  }
  // Every big-Pip screen drew standard somewhere.
  for (const view of ['boot', 'welcome', 'resume', 'levelup', 'complete']) assert.ok(drawn.has(`${view} standard`), view);
});

// The screens that had small Pip before 174 (its eyes bars, its arcs
// smeared) draw the 9x4 Pip, in truecolor too.
test('in truecolor, a screen with no room for standard Pip draws the 9x4 Pip', () => {
  const t = theme(CAPS.truecolor);
  const cases = [
    ['boot at 60x20', (pip) => bootFrame(0, size(60, 20), t, undefined, pip), handed(null, size(60, 20), t, restPose('working'))],
    ...[['welcome', 100, 30], ['resume', 80, 24], ['level up hinted', 100, 30], ['complete', 100, 30]].map(([label, cols, rows]) => {
      const s = label === 'welcome' ? driver().state : screen(label);
      return [`${label} at ${cols}x${rows}`, (pip) => render(s, size(cols, rows), t, undefined, pip), handed(s, size(cols, rows), t, restPose('ready'))];
    }),
  ];
  for (const [where, draw, pip] of cases) {
    const lines = draw(pip);
    assert.deepEqual(lines, draw(null), where);
    assert.ok(lines.some((l) => strip(l).includes('╭───┴───╮')), `${where}\n${lines.map(strip).join('\n')}`);
  }
});

// At 256 colors the package's soft edges round to fringes (174): main hands
// render no raster, so every big-Pip screen is, byte for byte, the screen
// render draws with no pip argument, the 9x4 Pip's path from before 170.
// This pins that no raster reaches a 256-color screen; the 9x4 Pip's own
// cells and colors are pinned in learn-render.test.mjs.
test('at 256 colors every big-Pip screen draws the 9x4 Pip, byte for byte, at every size', () => {
  const t = theme(CAPS.full);
  for (const [cols, rows] of SIZES) {
    const at = size(cols, rows);
    for (const next of [null, driver().state, screen('resume')]) {
      assert.deepEqual(bootFrame(0, at, t, undefined, handed(null, at, t, restPose('working'), next)), bootFrame(0, at, t), `boot${next ? ` before ${next.view}` : ''} at ${cols}x${rows}`);
    }
    for (const [label, s] of BIG) {
      assert.deepEqual(render(s, at, t, undefined, handed(s, at, t, restPose('ready'))), render(s, at, t), `${label} at ${cols}x${rows}`);
    }
  }
});

// A line's cells, each with the colors it is drawn in: its SGR foreground
// and background parameters, null for the terminal's own.
function cellsOf(line) {
  const cells = [];
  let fg = null;
  let bg = null;
  for (const part of line.split(/(\x1b\[[0-9;]*m)/)) {
    const m = part.match(/^\x1b\[([0-9;]*)m$/);
    if (!m) {
      for (const ch of part) cells.push({ ch, fg, bg });
      continue;
    }
    const p = m[1].split(';');
    for (let k = 0; k < p.length; k++) {
      if (p[k] === '0' || p[k] === '') [fg, bg] = [null, null];
      else if (p[k] === '39') fg = null;
      else if (p[k] === '49') bg = null;
      else if (p[k] === '38' || p[k] === '48') {
        const n = p[k + 1] === '5' ? 3 : 5;
        const code = p.slice(k, k + n).join(';');
        if (p[k] === '38') fg = code;
        else bg = code;
        k += n - 1;
      } else if (/^(3[0-7]|9[0-7])$/.test(p[k])) fg = p[k];
    }
  }
  return cells;
}
// Pip's eyes are #F2CC60 (the package's README).
const EYES = '38;2;242;204;96';
// The dimmest a drawn pixel of Pip's may be: the darkest of its own
// colors, by the sum of its three channels.
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const DARKEST = Math.min(...[PALETTE.outline, PALETTE.eyes, PALETTE.mouth].map((hex) => rgbOf(hex).reduce((a, b) => a + b)));
// pipRaster's lines as rows of half-cell pixels: each its drawn color, or
// null for the terminal's background.
const halvesOf = (lines) => lines.flatMap((line) => {
  const rgb = (code) => code.split(';').slice(2).map(Number);
  const halves = cellsOf(line).map((c) => (c.ch === '▀' ? [rgb(c.fg), c.bg && rgb(c.bg)] : c.ch === '▄' ? [null, rgb(c.fg)] : [null, null]));
  return [halves.map(([over]) => over), halves.map(([, under]) => under)];
});
// The raster row Pip's eyes are on: the one with the most inked cells in
// the eyes' yellow (the antenna's tip is yellow too, but smaller).
const eyesRow = (lines, from, tall) => {
  const yellow = lines.slice(from, from + tall).map((l) => cellsOf(l).filter((c) => c.ch !== ' ' && (c.fg === EYES || c.bg === EYES.replace('38', '48'))).length);
  return from + yellow.indexOf(Math.max(...yellow));
};

// Where things sit does not depend on the pose: each screen here draws Pip
// awake, in its ready pose, to find its eyes.
test('beside the raster, text starts on the row of Pip\'s eyes, and the banner sits around it where it fits, else the plain word on it', () => {
  const t = theme(CAPS.truecolor);
  const awake = restPose('ready');
  // The raster's first row is the 9x4 Pip's, on the screen without it.
  const pipTop = (lines) => lines.findIndex((l) => strip(l).includes('╭───┴───╮')) - 1;
  const check = (label, draw, slot, beside) => {
    const top = pipTop(draw(null));
    const lines = draw({ size: slot, pose: awake });
    const face = eyesRow(lines, top, RASTER[slot].tall);
    const plain = lines.map(strip);
    const where = `${label} (${slot})\n${plain.join('\n')}`;
    assert.ok(face > top + 1, where);
    // Only Pip's rows: the complete screen's header says COMPLETE too.
    beside(plain.map((l, k) => (k >= top && k < top + RASTER[slot].tall ? l : '')), face, where);
  };
  const startsAt = (text) => (plain, face, where) => assert.equal(plain.findIndex((l) => l.includes(text)), face, where);
  for (const [cols, rows] of [[60, 20], [80, 24], [120, 40], [200, 50]]) {
    const at = size(cols, rows);
    if (pipSlot(null, at, t)) check(`boot at ${cols}x${rows}`, (pip) => bootFrame(0, at, t, undefined, pip), pipSlot(null, at, t), startsAt(C.askingGit));
    const resume = screen('resume');
    if (pipSlot(resume, at, t)) check(`resume at ${cols}x${rows}`, (pip) => render(resume, at, t, undefined, pip), pipSlot(resume, at, t), startsAt(C.welcomeBack));
  }
  // The welcome's greeting, three to five rows, fits under standard Pip's face row.
  for (const [cols, rows] of [[120, 40], [200, 50], [60, 50]]) {
    const s = driver().state;
    check(`welcome at ${cols}x${rows}`, (pip) => render(s, size(cols, rows), t, undefined, pip), pipSlot(s, size(cols, rows), t), startsAt(C.hi('Sam').split(' ').slice(0, 2).join(' ')));
  }
  // The banners, in block letters, on the three rows around the face; at
  // 60 columns beside standard Pip they do not fit, and the word is on it.
  const banner = (word) => (plain, face, where) => {
    const rowsOf = plain.flatMap((l, k) => (l.includes('█') ? [k] : []));
    assert.deepEqual(rowsOf, [face - 1, face, face + 1], where);
    assert.ok(!plain.some((l) => l.includes(word)), where);
  };
  const word = (text) => (plain, face, where) => assert.equal(plain.findIndex((l) => l.includes(text)), face, where);
  for (const [label, text] of [['level up hinted', C.levelUp], ['complete', C.complete]]) {
    const s = screen(label);
    for (const [cols, rows, has] of [[120, 40, banner], [200, 50, banner], [60, 50, word]]) {
      const at = size(cols, rows);
      assert.equal(pipSlot(s, at, t), 'standard', `${label} at ${cols}x${rows}`);
      check(`${label} at ${cols}x${rows}`, (pip) => render(s, at, t, undefined, pip), 'standard', has(text));
    }
  }
});

// The package paints every pixel it leaves empty in its backdrop, #1E1E1E
// (README), and softens each edge toward it. Here Pip has no backdrop: the
// terminal's own background shows where Pip covers under a quarter of a
// pixel (PIP_INK), and every other pixel is drawn in the shapes' own
// colors, unmixed with any backdrop.
test('the raster\'s cells: Pip\'s pixels two to a cell where it covers a quarter of one or more, in the shapes\' own colors unmixed with any backdrop, the terminal\'s own background elsewhere, in 24-bit color', () => {
  const cases = [
    ['boot at 80x24', 'working', (t, pip) => bootFrame(0, size(80, 24), t, undefined, pip)],
    ['complete at 120x40', 'success', (t, pip) => render(screen('complete'), size(120, 40), t, undefined, pip)],
  ];
  const slot = 'standard';
  const { cols, tall } = RASTER[slot];
  for (const [where, state, draw] of cases) {
    // Over black and over white: how much of each pixel is Pip, 0 to 1,
    // and over black, its color times that.
    const over = (background) => rasterizePip(restPose(state), { columns: cols, rows: tall, palette: { background } }).pixels;
    const [dark, light] = [over('#000000'), over('#FFFFFF')];
    const at3 = (row, col, under) => ((row * 2 + under) * cols + col) * 3;
    const cover = (row, col, under) => 1 - [0, 1, 2].reduce((n, k) => n + light[at3(row, col, under) + k] - dark[at3(row, col, under) + k], 0) / 765;
    const ink = (row, col, under) => cover(row, col, under) >= PIP_INK;
    const whole = (row, col, under) => cover(row, col, under) === 1;
    // Pip's own color at a pixel, its backdrop taken out.
    const straight = (row, col, under) => [0, 1, 2].map((k) => Math.round(dark[at3(row, col, under) + k] / cover(row, col, under)));
    let soft = 0;
    const t = theme(CAPS.truecolor);
    const lines = draw(t, { size: slot, pose: restPose(state) });
    // The raster's top left is the 9x4 Pip's, on the screen without it.
    const glyph = draw(t, null).map(strip);
    const top = glyph.findIndex((l) => l.includes('╭───┴───╮')) - 1;
    const left = glyph[top + 1].indexOf('╭');
    let spaces = 0;
    for (let r = 0; r < tall; r++) {
      const cells = cellsOf(lines[top + r]).slice(left, left + cols);
      assert.equal(cells.length, cols, `${where}, row ${r}`);
      cells.forEach((c, k) => {
        const at = `${where}, row ${r} cell ${k}: ${JSON.stringify(c)}`;
        for (const code of [c.fg, c.bg].filter(Boolean)) assert.match(code, /^[34]8;2;/, at);
        // A space keeps the terminal's background; an ink half alone is
        // over the terminal's background; two are both colors.
        if (!ink(r, k, 0) && !ink(r, k, 1)) {
          assert.deepEqual([c.ch, c.bg], [' ', null], at);
          spaces += 1;
        } else if (!ink(r, k, 1)) assert.deepEqual([c.ch, c.bg], ['▀', null], at);
        else if (!ink(r, k, 0)) assert.deepEqual([c.ch, c.bg], ['▄', null], at);
        else assert.equal(c.ch, '▀', at);
        // Every pixel drawn, soft edge or whole, is Pip's own color there,
        // as bright as the darkest of its colors or brighter.
        const drawn = [[0, c.ch === '▀' ? c.fg : null], [1, c.ch === '▄' ? c.fg : c.ch === '▀' ? c.bg : null]].filter(([, code]) => code);
        for (const [u, code] of drawn) {
          const rgb = code.split(';').slice(2).map(Number);
          const want = straight(r, k, u);
          assert.ok(rgb.every((v, n) => Math.abs(v - want[n]) <= 2), `${at}, ${u ? 'under' : 'over'}: ${rgb} for ${want}`);
          assert.ok(rgb[0] + rgb[1] + rgb[2] >= DARKEST, `${at}, ${u ? 'under' : 'over'}: ${rgb}`);
          if (!whole(r, k, u)) soft += 1;
        }
      });
      // The row is exactly the raster's width: nothing after it but text, three cells on.
      const rest = cellsOf(lines[top + r]).slice(left + cols);
      assert.ok(rest.slice(0, 3).every((c) => c.ch === ' ' && c.bg === null), `${where}, row ${r}: ${strip(lines[top + r])}`);
    }
    // Nothing of the raster above or before it.
    assert.ok(lines.slice(0, top).every((l) => !/[▀▄]/.test(l)), where);
    // No backdrop anywhere: not a rectangle, not a cell.
    const all = lines.join('\n');
    assert.doesNotMatch(all, /[34]8;2;30;30;30m/, where);
    assert.ok(spaces > 0, where);
    // Pip's eyes, #F2CC60, where they are open: working narrows them.
    if (state !== 'working') assert.ok(lines.slice(top, top + tall).some((l) => l.includes('8;2;242;204;96')), where);
    assert.ok(soft > 0, `${where}: some soft edges are drawn at full color`);
  }
});

// Why a quarter (PIP_INK): Pip at rest, in each of the package's states and
// with its eyes shut, inks about its own area, where any less inks the
// outline's soft inner column too, and its mouth keeps its area to the
// pixel, where a half thins it.
test('the raster\'s ink threshold: Pip at rest inks within 15% of its own area, and its mouth its own to the pixel', () => {
  const { cols, tall } = RASTER.standard;
  const palette = { background: '#000000', outline: '#FF0000', eyes: '#FFFF00', mouth: '#FF00FF' };
  const poses = [...['ready', 'working', 'success', 'retry', 'error'].map((state) => [state, restPose(state)]), ['shut', { ...restPose('ready'), left: 0, right: 0 }]];
  for (const [label, pose] of poses) {
    const px = rasterizePip(pose, { columns: cols, rows: tall, palette }).pixels;
    let [area, inked, mouth, mouthInked] = [0, 0, 0, 0];
    for (let at = 0; at < px.length; at += 3) {
      area += px[at] / 255;
      mouth += px[at + 2] / 255;
      if (px[at] / 255 < PIP_INK) continue;
      inked += 1;
      if (px[at + 2] > px[at] / 2) mouthInked += 1;
    }
    assert.ok(inked >= area && inked <= 1.15 * area, `${label}: ${inked} pixels inked for an area of ${area.toFixed(1)}`);
    assert.ok(mouthInked >= Math.round(mouth), `${label}: the mouth's ${mouthInked} pixels for an area of ${mouth.toFixed(1)}`);
  }
});

// Breathing moves Pip's edges by fractions of a pixel: a pixel that comes
// and goes with it is Pip's own color, never a dark speck on a light
// terminal.
test('breathing: every pixel that comes and goes is drawn in Pip\'s own colors, none dark', () => {
  const pip = createPip({ state: 'ready', at: 0 });
  const gates = { motion: true, ambient: true, breathing: true };
  let [prev, flips] = [null, 0];
  for (let ms = 13_500; ms <= 17_500; ms += 120) {
    const now = halvesOf(pipRaster(pip.pose(ms, gates), 'standard'));
    if (prev) {
      now.forEach((row, y) => row.forEach((px, x) => {
        if (!px === !prev[y][x]) return;
        flips += 1;
        const rgb = px ?? prev[y][x];
        assert.ok(rgb[0] + rgb[1] + rgb[2] >= DARKEST, `+${ms} ms, pixel ${x},${y}: ${rgb}`);
      }));
    }
    prev = now;
  }
  assert.ok(flips > 0, 'breathing moves some pixels');
});

// A blink's held frames: eyes shut or nearly, at every breath's lift and
// every look up or down, still show each eye.
test('a blink never loses Pip\'s eyes: shut, each eye keeps two gold pixels or more, at every lift and look up or down', () => {
  const gold = ([, g, b]) => g - b > 50;
  for (const open of [0, 0.06]) {
    for (let i = 0; i <= 48; i++) {
      for (let j = 0; j <= 28; j++) {
        const [lift, gazeY] = [-0.012 + i * 0.0005, -0.7 + j * 0.05];
        const grid = halvesOf(pipRaster({ ...restPose('ready'), left: open, right: open, lift, gazeY }, 'standard'));
        // Its eyes' pixel rows, 14 to 24 (EYES_AT), left of centre and right.
        const eye = (x0, x1) => grid.slice(14, 25).reduce((n, row) => n + row.slice(x0, x1 + 1).filter((px) => px && gold(px)).length, 0);
        const where = `openness ${open}, lift ${lift.toFixed(4)}, gazeY ${gazeY.toFixed(2)}`;
        assert.ok(eye(6, 15) >= 2, `${where}: the left eye`);
        assert.ok(eye(16, 25) >= 2, `${where}: the right eye`);
      }
    }
  }
});

// What Pip shows is what the app saw (the ticket's map): git still
// answering at boot is working; the welcome, resume and level-up ready; the
// complete screen success. The app has no AI, so never thinking; nothing
// waits on the learner that the other states don't say, so never waiting.
test('pipTarget: Pip\'s state for each big-Pip screen, a new reaction only for a new level-up or complete screen, and none for one already over', () => {
  assert.deepEqual(pipTarget(null, 5_000), { state: 'working' });
  for (const label of ['welcome', 'resume', 'resume confirm']) {
    const s = screen(label);
    // A change of state is timed from the screen's arrival.
    assert.deepEqual(pipTarget(s, s.now + 40), { state: 'ready', since: s.fx.view }, label);
  }
  const d = driver({ course, saved: { format: 1, welcomed: true, lessons: finishedBefore('b-2') } });
  const seen = [];
  playUntil(d, (s) => {
    if (s.lesson === 'b-2' && ['levelup', 'complete'].includes(s.view) && seen.at(-1)?.view !== s.view + s.levelTo) seen.push({ view: s.view + s.levelTo, s });
    return s.lesson === 'b-2' && s.view === 'complete';
  });
  const [hinted, challenge, complete] = seen.map((x) => x.s);
  assert.deepEqual([hinted.levelTo, challenge.levelTo, complete.view], ['hinted', 'challenge', 'complete']);
  for (const [s, state] of [[hinted, 'ready'], [challenge, 'ready'], [complete, 'success']]) {
    const now = pipTarget(s, s.fx.view + 40);
    assert.equal(now.state, state);
    assert.equal(now.since, s.fx.view);
    assert.equal(now.immediate, false, `${s.view}: it just arrived`);
    assert.equal(typeof now.eventId, 'string');
    // The same arrival at every draw, not the draw's time.
    assert.equal(pipTarget(s, s.fx.view + 400).eventId, now.eventId);
    // Over (the level-up's 0.8 s, the complete screen's 1.2 s): no replay.
    assert.deepEqual(pipTarget(s, s.fx.view + 5_000), { ...now, immediate: true });
  }
  assert.notEqual(hinted.fx.view, challenge.fx.view);
  assert.notEqual(pipTarget(hinted, hinted.fx.view).eventId, pipTarget(challenge, challenge.fx.view).eventId, 'each level-up is a new one');
  // With the package's controller, as main uses it: drawn as the screen
  // arrives, Pip hops with sparks; first drawn once the screen's moment is
  // over (after a resize, say), it shows success still.
  const drawnAt = (at) => {
    const pip = createPip({ at: complete.now - 10_000 });
    const { state, since, ...event } = pipTarget(complete, at);
    pip.setState(state, { at: since, ...event });
    return pip.pose(at + 400, { ambient: false });
  };
  assert.ok(drawnAt(complete.fx.view).spark > 0.5, 'a hop with sparks');
  assert.deepEqual(drawnAt(complete.fx.view + 5_000), restPose('success'));
});

// The gates main hands Pip's controller in each draw (ticket 170): its
// ambient life only where the app's own ambient loops may draw.
test('pipGates: no motion with motion off, an overlay or idle; ambient life only where ambientAllowed says, never beside resume\'s y/n, on level-up or on complete; breathing only on a local truecolor terminal', () => {
  const on = { motion: true, truecolor: true, remote: false };
  const welcome = driver().state;
  const late = welcome.now + TIMING.graceMax;
  assert.deepEqual(pipGates(welcome, late, on), { motion: true, ambient: true, breathing: true });
  assert.deepEqual(pipGates(welcome, welcome.now + TIMING.graceMin, on), { motion: true, ambient: false, breathing: false }, 'still reading');
  assert.deepEqual(pipGates(welcome, late, { ...on, truecolor: false }), { motion: true, ambient: true, breathing: false }, '256 colors');
  assert.deepEqual(pipGates(welcome, late, { ...on, remote: true }), { motion: true, ambient: true, breathing: false }, 'remote');
  assert.deepEqual(pipGates(welcome, late, { ...on, motion: false }), { motion: false, ambient: false, breathing: false }, 'motion off');
  assert.deepEqual(pipGates({ ...welcome, overlay: 'help' }, late, on), { motion: false, ambient: false, breathing: false }, 'an overlay');
  // Idle alone stops it: frozen().
  assert.equal(pipGates(welcome, welcome.lastActivity + IDLE_MS, on).motion, false, 'idle');
  assert.equal(pipGates(welcome, welcome.lastActivity + IDLE_MS - 1, on).motion, true);
  // The boot frame: git running, no learner yet.
  assert.deepEqual(pipGates(null, 5_000, on), { motion: true, ambient: false, breathing: false });
  // Screens with no ambient loop of the app's: reactions and changes only.
  for (const label of ['resume', 'resume confirm', 'level up hinted', 'complete']) {
    const s = screen(label);
    for (const ms of [0, 5_000, TIMING.graceMax, 60_000]) assert.deepEqual(pipGates(s, s.now + ms, on), { motion: true, ambient: false, breathing: false }, `${label} at +${ms} ms`);
  }
});

// Breathing redraws the raster every 120 ms: only on a local truecolor
// terminal. Over SSH or in a Codespace the terminal is remote.
test('caps.remote: over SSH (SSH_CONNECTION or SSH_TTY) or in a Codespace, and nothing else changes', () => {
  const tty = { isTTY: true, getColorDepth: () => 24 };
  const env = { TERM: 'xterm-256color', COLORTERM: 'truecolor' };
  const local = capabilities(tty, env, 'linux', []);
  assert.equal(local.remote, false);
  for (const ssh of [{ SSH_CONNECTION: '10.0.0.2 52144 10.0.0.1 22' }, { SSH_TTY: '/dev/pts/3' }]) {
    const remote = capabilities(tty, { ...env, ...ssh }, 'linux', []);
    assert.deepEqual(remote, { ...local, remote: true }, Object.keys(ssh)[0]);
  }
  assert.deepEqual(capabilities(tty, { ...env, CODESPACES: 'true' }, 'linux', []), { ...local, remote: true, codespace: true }, 'a Codespace');
});

// ---- the greeting (176) -----------------------------------------------------
// Pip's raster on a screen as a grid of its 32x32 half-cell pixels, each
// weighed by `weigh` of its drawn color, 0 for the terminal's background.
// The glyph screen's Pip gives the raster's top left.
function pixelsOf(lines, glyph, weigh) {
  const top = glyph.findIndex((l) => strip(l).includes('╭───┴───╮')) - 1;
  const left = strip(glyph[top + 1]).indexOf('╭');
  const rgb = (code) => (code ? code.split(';').slice(2).map(Number) : null);
  const grid = [];
  for (let r = 0; r < RASTER.standard.tall; r++) {
    const halves = cellsOf(lines[top + r]).slice(left, left + RASTER.standard.cols).map((c) => (c.ch === '▀' ? [rgb(c.fg), rgb(c.bg)] : c.ch === '▄' ? [null, rgb(c.fg)] : [null, null]));
    grid.push(halves.map(([over]) => (over ? weigh(over) : 0)), halves.map(([, under]) => (under ? weigh(under) : 0)));
  }
  return grid;
}
// Pip's gold (its eyes, antenna and sparks, #F2CC60) is greener than it is
// blue; its outline (#CE87F5) bluer than green.
const GOLD = ([, g, b]) => Math.max(0, g - b);
const PURPLE = ([, g, b]) => Math.max(0, b - g);
// The weight of a region of pixels (rows y0 to y1, columns x0 to x1, both
// ends in), and where it centres.
function weight(grid, [y0, y1], [x0, x1]) {
  let [n, sx, sy] = [0, 0, 0];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) [n, sx, sy] = [n + grid[y][x], sx + grid[y][x] * x, sy + grid[y][x] * y];
  return { n, x: n ? sx / n : null, y: n ? sy / n : null };
}
// In the package's standard raster: its eyes in pixel rows 14 to 24, its
// antenna's tip above row 9, its sparks at its two sides.
const EYES_AT = [[14, 24], [6, 25]];
const TIP_AT = [[0, 8], [8, 23]];
const SPARKS_AT = [[[6, 13], [0, 6]], [[6, 13], [25, 31]]];

// The greeting's moments, from SHOTS: halfway through each part.
const GREET = SHOTS.greet.raster;
const mid = (from, to) => Math.round((from + to) / 2);
const GREET_AT = {
  flick: Math.round(GREET.wide / 4), wide: mid(0, GREET.wide), glad: [mid(GREET.glad, GREET.open), mid(GREET.hops[1], GREET.back)],
  hops: GREET.hops.map((from) => from + GREET.hop / 2), between: [mid(GREET.look, GREET.up), mid(GREET.up, GREET.again)],
  left: GREET.look + (GREET.up - GREET.look) / 4, right: GREET.look + (3 * (GREET.up - GREET.look)) / 4, up: mid(GREET.up, GREET.again),
};
// A screen's rows from the 9x4 Pip's antenna row down, as many as the
// raster's: the rows the detailed Pip is drawn on.
const rasterRows = (lines, glyph) => lines.slice(glyph.findIndex((l) => strip(l).includes('╭───┴───╮')) - 1).slice(0, RASTER.standard.tall);

test('the detailed Pip greets on the welcome and resume: eyes wide and an antenna flick, then happy eyes, an antenna that waves, two hops with a spark, a look left, right and up between them, all of it gone by exactly 5 s', () => {
  const t = theme({ ...CAPS.truecolor, motion: true });
  for (const [label, s] of [['welcome', driver().state], ['resume', screen('resume')]]) {
    const at = size(120, 40);
    assert.equal(pipSlot(s, at, t), 'standard', label);
    const pip = { size: 'standard', pose: restPose('ready') };
    const glyph = render(s, at, t);
    const frame = (ms) => render(s, at, t, ms === null ? REST : { at: s.fx.view + ms }, pip);
    const gold = (ms) => pixelsOf(frame(ms), glyph, GOLD);
    const rest = frame(null);
    const still = pixelsOf(rest, glyph, GOLD);
    const eyes = (grid) => weight(grid, ...EYES_AT);
    const tip = (grid) => weight(grid, ...TIP_AT);
    const sparks = (grid) => SPARKS_AT.reduce((n, at) => n + weight(grid, ...at).n, 0);
    const pipRows = (lines) => rasterRows(lines, glyph);
    // Zero at both ends: Pip's rows are its rest rows at +0 ms and from +5 s.
    for (const ms of [0, TIMING.greet, TIMING.greet + 1_000]) assert.deepEqual(pipRows(frame(ms)), pipRows(rest), `${label}, +${ms} ms`);
    assert.notDeepEqual(pipRows(frame(TIMING.greet - 80)), pipRows(rest), `${label}: still easing back 80 ms before the end`);
    assert.equal(sparks(still), 0, `${label}: no sparks at rest`);
    // At first the eyes widen, and the antenna flicks.
    assert.ok(eyes(gold(GREET_AT.wide)).n > eyes(still).n * 1.05, `${label}: wide eyes at +${GREET_AT.wide} ms`);
    assert.ok(Math.abs(tip(gold(GREET_AT.flick)).x - tip(still).x) > 0.3, `${label}: the antenna flicks at +${GREET_AT.flick} ms`);
    // Happy arcs: less gold than open eyes, before and after the looks.
    for (const ms of GREET_AT.glad) assert.ok(eyes(gold(ms)).n < eyes(still).n * 0.8, `${label}: happy eyes at +${ms} ms`);
    // Two hops, each with a spark, and none between them: Pip's outline
    // rises a pixel. Its top edge, the first row with any of it: drawn in
    // its own color, a thin edge is one row or two by where it falls, so
    // the outline's centre is no measure of a one-pixel rise.
    const outline = (ms) => pixelsOf(ms === null ? rest : frame(ms), glyph, PURPLE).findIndex((row) => row.some((n) => n > 0));
    for (const ms of GREET_AT.hops) {
      assert.ok(sparks(gold(ms)) > 0, `${label}: a spark at +${ms} ms`);
      assert.equal(outline(null) - outline(ms), 1, `${label}: a hop at +${ms} ms`);
    }
    for (const ms of GREET_AT.between) assert.equal(sparks(gold(ms)), 0, `${label}: no spark at +${ms} ms`);
    // Between the hops the eyes, open again, look left, right and up.
    assert.ok(eyes(gold(GREET_AT.left)).x < eyes(still).x - 0.5, `${label}: a look left at +${GREET_AT.left} ms`);
    assert.ok(eyes(gold(GREET_AT.right)).x > eyes(still).x + 0.5, `${label}: a look right at +${GREET_AT.right} ms`);
    assert.ok(eyes(gold(GREET_AT.up)).y < eyes(still).y - 0.4, `${label}: a look up at +${GREET_AT.up} ms`);
    // The antenna waves like a hand: from the flick's end until it eases
    // back, its tip swings to each side of where it rests, a few slow times.
    const side = [];
    for (let ms = GREET.wide; ms <= GREET.back; ms += GREET.every) {
      const dx = tip(gold(ms)).x - tip(still).x;
      if (Math.abs(dx) > 0.8 && Math.sign(dx) !== side.at(-1)) side.push(Math.sign(dx));
    }
    assert.ok(side.length >= 4 && side.length <= 10, `${label}: the antenna swings ${side.length} times`);
  }
});

// One curve for every ease of the detailed Pip (181): the greeting's eases
// in and out are the controller's quintic, the one its crossfades use, so
// the greeting's end and a key's ease out move alike.
test('the greeting eases on the same curve as Pip\'s crossfades', () => {
  const pose = restPose('ready');
  for (const u of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    const fade = { at: 0, ms: 1, from: { ...pose, happy: 1 } };
    const crossfade = pipShown({ pose, fade }, undefined, u).happy;
    const easedBack = pipGreeting(pose, GREET.back + u * (TIMING.greet - GREET.back)).happy;
    assert.ok(Math.abs(easedBack - crossfade) < 1e-12, `${u} of the way back: happy ${easedBack}, the crossfade's ${crossfade}`);
  }
});

// Any key ends the greeting at once (the app's one-shot rule), and the
// detailed Pip eases out of it (181): from the pose the greeting showed as
// the key came, which main hands as `fade`, to its rest rows by 320 ms on.
test('a key ends the detailed Pip\'s greeting: Pip eases from the greeting\'s pose at the key, a new pose each 40 ms frame, to its rest rows from 320 ms after it', () => {
  const t = theme({ ...CAPS.truecolor, motion: true });
  for (const [label, s] of [['welcome', driver().state], ['resume', screen('resume')]]) {
    const at = size(120, 40);
    const pose = restPose('ready');
    const glyph = render(s, at, t);
    const start = s.fx.view;
    const pressed = start + 1_000;
    // Up, which neither screen acts on.
    const sent = reduce(s, { type: 'key', name: 'up', now: pressed }).state;
    assert.equal(sent.view, s.view, label);
    const fade = { at: pressed, ms: TIMING.pipFade, from: pipShown({ pose }, pressed - start, pressed) };
    const pip = { size: 'standard', pose, fade };
    const rows = (ms) => rasterRows(render(sent, at, t, { at: pressed + ms }, pip), glyph);
    const rest = rasterRows(render(sent, at, t, REST, pip), glyph);
    const greeting = (ms) => rasterRows(render(s, at, t, { at: pressed + ms }, { size: 'standard', pose }), glyph);
    assert.notDeepEqual(greeting(40), rest, `${label}: it plays without the key`);
    assert.deepEqual(rows(0), greeting(0), `${label}: at the key, the greeting's own frame`);
    for (let ms = SHOTS.greet.raster.every; ms < TIMING.pipFade; ms += SHOTS.greet.raster.every) {
      assert.notDeepEqual(rows(ms), rows(ms - 40), `${label}: +${ms} ms after the key, a new pose`);
      assert.notDeepEqual(rows(ms), rest, `${label}: +${ms} ms after the key, not yet at rest`);
    }
    for (const ms of [TIMING.pipFade, TIMING.pipFade + 40, GREET_AT.left - 1_000, GREET_AT.hops[1] - 1_000]) {
      assert.deepEqual(rows(ms), rest, `${label}: +${ms} ms after the key`);
    }
  }
});

// The moments the detailed Pip's pose would jump (181), and none other.
test('pipJump: a key that shuts the ambient gate or ends the greeting eases Pip out over 320 ms, the gate opening eases its breathing in over 800 ms; none across an arrival, with motion off, at idle, under an overlay or beside resume\'s y/n', () => {
  const on = { motion: true, truecolor: true, remote: false };
  const gates = (s, at) => pipGates(s, at, on);
  const seen = (s, at) => ({ gates: gates(s, at), greet: greetStart(s, at, gates(s, at)), view: s.fx.view });
  const jump = (s, at, before, then) => pipJump(s, at, seen(before, then), gates(s, at));
  const key = (s, at, name = 'down') => reduce(s, { type: 'key', name, now: at }).state;
  const welcome = driver().state;
  const start = welcome.fx.view;
  const opened = ambientOpened(welcome);
  // The reading grace ends: breathing eases in from that moment.
  assert.deepEqual(jump(welcome, opened + 7, welcome, opened - 33), { at: opened, ms: TIMING.pipBreathIn });
  assert.equal(jump(welcome, opened + 47, welcome, opened + 7), null, 'the gate open on both frames');
  assert.equal(jump(welcome, opened - 40, welcome, opened - 80), null, 'shut on both');
  // A key shuts it again: Pip eases out from the key.
  const pressed = opened + 1_000;
  assert.deepEqual(jump(key(welcome, pressed), pressed + 3, welcome, pressed - 20), { at: pressed, ms: TIMING.pipFade });
  // A key in the greeting ends it: Pip eases out of it from the key. Its
  // own end is no jump: it eases back by itself.
  const early = key(welcome, start + 1_000);
  assert.deepEqual(jump(early, start + 1_010, welcome, start + 960), { at: start + 1_000, ms: TIMING.pipFade });
  assert.equal(jump(welcome, start + TIMING.greet + 20, welcome, start + TIMING.greet - 20), null, 'the greeting\'s end');
  // On resume too, but its x, beside the y/n, ends the greeting at once.
  const resume = screen('resume');
  const up = key(resume, resume.fx.view + 1_000, 'up');
  assert.deepEqual(jump(up, resume.fx.view + 1_010, resume, resume.fx.view + 960), { at: resume.fx.view + 1_000, ms: TIMING.pipFade });
  const confirm = screen('resume confirm');
  assert.ok(confirm.confirmRestart && confirm.fx.key > confirm.fx.greet && confirm.fx.key < confirm.fx.greet + TIMING.greet, 'x in the greeting');
  const past = confirm.now + 10;
  assert.equal(pipJump(confirm, past, seen(resume, confirm.fx.key - 20), gates(confirm, past)), null, 'beside the y/n');
  assert.deepEqual(pipJump({ ...confirm, confirmRestart: false }, past, seen(resume, confirm.fx.key - 20), gates(confirm, past)), { at: confirm.fx.key, ms: TIMING.pipFade }, 'the same key with no y/n');
  // None for another arrival, or with motion off on either frame: an
  // overlay, idle, the screen's motion off.
  const keyed = key(welcome, pressed);
  assert.equal(pipJump({ ...keyed, fx: { ...keyed.fx, view: pressed } }, pressed + 3, seen(welcome, pressed - 20), gates(keyed, pressed + 3)), null, 'another arrival');
  assert.equal(pipJump(keyed, pressed + 3, seen(welcome, pressed - 20), pipGates(keyed, pressed + 3, { ...on, motion: false })), null, 'motion off');
  assert.equal(pipJump(keyed, pressed + 3, { ...seen(welcome, pressed - 20), gates: pipGates(welcome, pressed - 20, { ...on, motion: false }) }, gates(keyed, pressed + 3)), null, 'motion off on the frame before');
  const help = { ...keyed, overlay: 'help' };
  assert.equal(pipJump(help, pressed + 3, seen(welcome, pressed - 20), gates(help, pressed + 3)), null, 'an overlay');
  const idle = welcome.lastActivity + IDLE_MS;
  assert.equal(jump(welcome, idle, welcome, idle - 40), null, 'idle');
  assert.equal(pipJump(welcome, opened + 7, null, gates(welcome, opened + 7)), null, 'no frame with Pip before');
  assert.equal(pipJump(null, 5_000, seen(welcome, opened), gates(null, 5_000)), null, 'the boot frame');
});

// main's own draw of the detailed Pip (its pipHost), as render shows it:
// the host's pose, eased from where it jumped, with the greeting over it.
// `epoch`: how long before the welcome arrived Pip was made, which sets
// its breathing's phase.
const ON_TRUECOLOR = { motion: true, truecolor: true, remote: false };
function drawsOf(epoch = 0) {
  let host = null;
  return (s, at) => {
    host ??= pipHost(s.fx.view - epoch, 'ready');
    const gates = pipGates(s, at, ON_TRUECOLOR);
    const pose = host.pose(s, at, gates);
    const greet = greetStart(s, at, gates);
    return pipShown({ pose, fade: host.fade }, greet === undefined ? Infinity : at - greet, at);
  };
}
const POSE_KEYS = Object.keys(restPose('ready')).filter((k) => k !== 'state');
const stepOf = (a, b, keys = POSE_KEYS) => Math.max(...keys.map((k) => Math.abs(a[k] - b[k])));
// Each property's largest step between frames `every` ms apart from `from`
// to `to`, with state `stateAt(t)` on each, by property; `most` keeps the
// larger of each with the steps already in it.
function largest(draw, stateAt, from, to, every = 40, most = Object.fromEntries(POSE_KEYS.map((k) => [k, 0]))) {
  let prev = null;
  for (let t = from; t <= to; t += every) {
    const pose = draw(stateAt(t), t);
    if (prev) for (const k of POSE_KEYS) most[k] = Math.max(most[k], Math.abs(prev[k] - pose[k]));
    prev = pose;
  }
  return most;
}
// Where the motion's own step for a property is near nothing, a frame may
// step it this much: a hundredth of the range of its eyes' openness.
const NEAR_STILL = 0.01;
// Each property whose step goes past the motion's own for it.
const beyond = (steps, own) => POSE_KEYS.filter((k) => steps[k] > Math.max(own[k], NEAR_STILL)).map((k) => `${k} ${steps[k].toFixed(4)}, its own ${own[k].toFixed(4)}`);

test('the detailed Pip changes continuously: where a key ends its greeting or shuts its ambient gate mid-blink or mid-glance, and where the gate opens and it breathes, no property steps further in a 40 ms frame than the motion\'s own frames step it', () => {
  const welcome = driver().state;
  const start = welcome.fx.view;
  const opened = ambientOpened(welcome);
  const key = (at) => reduce(welcome, { type: 'key', name: 'down', now: at }).state;
  // A key at each moment of the greeting, 7 ms after a frame of it.
  const greeting = largest(drawsOf(), () => welcome, start, start + TIMING.greet);
  let cut;
  let raw = 0;
  for (let ms = 40; ms < TIMING.greet; ms += 40) {
    const pressed = start + ms + 7;
    const keyed = key(pressed);
    cut = largest(drawsOf(), (t) => (t < pressed ? welcome : keyed), start + ms, pressed + TIMING.pipFade + 80, 40, cut);
    raw = Math.max(raw, stepOf(drawsOf()(welcome, pressed), restPose('ready')));
  }
  assert.ok(raw > 0.9, `cut at once, Pip's greeting would jump ${raw}`);
  assert.deepEqual(beyond(cut, greeting), [], 'a key ends the greeting');
  // A key at every moment of a blink and of a glance, the package's from
  // 4.2 s and 2.6 s after the gate opens, 7 ms apart.
  for (const [label, from, to] of [['a blink', 4_180, 4_420], ['a glance', 2_580, 4_100]]) {
    const own = largest(drawsOf(), () => welcome, opened, opened + to + 400);
    let ended;
    let cutAt = 0;
    for (let ms = from; ms < to; ms += 7) {
      const pressed = opened + ms;
      const keyed = key(pressed);
      const last = opened + Math.floor(ms / 40) * 40;
      ended = largest(drawsOf(), (t) => (t < pressed ? welcome : keyed), opened, pressed + TIMING.pipFade + 80, 40, ended);
      const draw = drawsOf();
      for (let t = opened; t <= last; t += 40) draw(welcome, t);
      cutAt = Math.max(cutAt, stepOf(draw(welcome, pressed), restPose('ready')));
    }
    assert.ok(cutAt > 0.5, `${label}: shut at once, Pip would jump ${cutAt}`);
    assert.deepEqual(beyond(ended, own), [], label);
  }
  // The gate opens: breathing eases in, each 40 ms frame stepping each
  // property no further than breathing's own 120 ms frame does, at every
  // phase of its breath.
  const breath = largest(drawsOf(), () => welcome, opened + 1_000, opened + 20_000, 120);
  for (let epoch = 0; epoch < 4_000; epoch += 330) {
    const eased = largest(drawsOf(epoch), () => welcome, opened - 200, opened + TIMING.pipBreathIn + 200, 40);
    assert.deepEqual(beyond(eased, breath), [], `breathing ${epoch} ms into its cycle`);
  }
});

// pipJump starts no ease across a screen change, and one already running
// stops there too: the new screen's Pip is its own from its first frame.
test('main\'s pipHost: an ease still running when the screen changes stops there, and none carries onto the new screen', () => {
  const welcome = driver().state;
  const opened = ambientOpened(welcome);
  const host = pipHost(welcome.fx.view, 'ready');
  const draw = (s, at) => host.pose(s, at, pipGates(s, at, ON_TRUECOLOR));
  for (let at = opened; at <= opened + 1_000; at += 40) draw(welcome, at);
  const pressed = opened + 1_007;
  const keyed = reduce(welcome, { type: 'key', name: 'down', now: pressed }).state;
  draw(keyed, pressed + 33);
  assert.ok(host.fade, 'the key eases Pip out');
  const arrived = { ...keyed, fx: { ...keyed.fx, view: pressed + 60 } };
  const pose = draw(arrived, pressed + 73);
  assert.equal(host.fade, null, 'the ease stops at the new screen');
  assert.deepEqual(pipShown({ pose, fade: host.fade }, Infinity, pressed + 73), pose);
});

// Nothing moves beside resume's y/n: an ease from a key still running as
// the y/n comes up stops there, and Pip shows its own pose at once.
test('main\'s pipHost: an ease still running as resume\'s y/n comes up stops there', () => {
  const resume = screen('resume');
  const start = resume.fx.view;
  const host = pipHost(start, 'ready');
  const draw = (s, at) => host.pose(s, at, pipGates(s, at, ON_TRUECOLOR));
  for (let at = start; at <= start + 1_000; at += 40) draw(resume, at);
  const pressed = start + 1_007;
  const up = reduce(resume, { type: 'key', name: 'up', now: pressed }).state;
  draw(up, pressed + 33);
  assert.ok(host.fade, 'the key eases Pip out');
  const asked = { ...up, confirmRestart: true };
  const at = pressed + 73;
  assert.ok(at < host.fade.at + host.fade.ms, 'the ease still running');
  const pose = draw(asked, at);
  assert.equal(host.fade, null, 'the ease stops beside the y/n');
  assert.deepEqual(pipShown({ pose, fade: host.fade }, Infinity, at), pose);
});

// Pip's next frame (main's pipHost.frameIn) is on the 40 ms grid from its
// last change: the first step at or after its own next moment, never one
// before it that shows nothing new; and a frame drawn late, or between
// steps, does not push its next tick a step on.
test('main\'s pipHost: Pip\'s next frame is the first step of its grid at or after its own next moment, and a late frame keeps its ticks on the grid', () => {
  const host = pipHost(0, 'ready');
  const pip = createPip({ state: 'ready', at: 0 });
  const still = { motion: true, ambient: true, breathing: false, size: 'standard' };
  // Its glance holds until 3910 ms, between the steps at 3880 and 3920.
  assert.equal(pip.nextFrameIn(3_840, still), 70);
  assert.deepEqual(pip.pose(3_880, still), pip.pose(3_870, still), 'the step before the moment shows nothing new');
  for (const at of [3_841, 3_870, 3_879, 3_880, 3_900]) assert.equal(at + host.frameIn(at, still), 3_920, `from ${at} ms`);
  // Breathing ticks every 120 ms from the step, however late the frame.
  const breathing = { ...still, breathing: true };
  for (const at of [1_200, 1_201, 1_215, 1_239]) assert.equal(at + host.frameIn(at, breathing), 1_320, `breathing, from ${at} ms`);
  assert.equal(host.frameIn(1_000, { ...still, motion: false }), null, 'none with motion off');
  // A frame drawn just after a moment of its own, between two steps: its
  // blink's eyes hold shut from 4260 ms, so the step at 4280 shows nothing
  // new, and its next frame is the first step at or after its own next
  // moment. From any frame, with or without breathing, ready or waiting,
  // no next frame shows the pose of the frame before it.
  assert.deepEqual(pip.pose(4_280, still), pip.pose(4_261, still));
  assert.equal(pip.nextFrameIn(4_261, still), 40);
  for (const at of [4_261, 4_270, 4_279]) assert.equal(at + host.frameIn(at, still), 4_320, `from ${at} ms`);
  for (const [state, options] of [['ready', still], ['ready', breathing], ['waiting', still]]) {
    const own = pipHost(0, state);
    const shown = createPip({ state, at: 0 });
    for (let at = 0; at < 12_000; at += 1) {
      const next = at + own.frameIn(at, options);
      if (next < at + shown.nextFrameIn(at, options)) assert.notDeepEqual(shown.pose(next, options), shown.pose(at, options), `${state}, breathing ${options.breathing}: from ${at} ms to ${next} ms`);
    }
  }
});

test('words never move in the detailed Pip\'s greeting: every 40 ms frame fits the window, and from the moment the rest of the screen is still only the raster\'s cells differ from the rest frame', () => {
  const t = theme({ ...CAPS.truecolor, motion: true });
  for (const [label, s, from] of [['welcome', driver().state, 480], ['resume', screen('resume'), 0]]) {
    for (const [cols, rows] of [[120, 40], [140, 45]]) {
      const at = size(cols, rows);
      assert.equal(pipSlot(s, at, t), 'standard', `${label} at ${cols}x${rows}`);
      const pip = { size: 'standard', pose: restPose('ready') };
      const glyph = render(s, at, t).map(strip);
      const top = glyph.findIndex((l) => l.includes('╭───┴───╮')) - 1;
      const left = glyph[top + 1].indexOf('╭');
      // A frame's cells as text, with the raster's 32x16 blanked.
      const words = (lines) => lines.map((l, r) => {
        const cells = [...strip(l)];
        return (r < top || r >= top + RASTER.standard.tall ? cells : cells.map((c, k) => (k >= left && k < left + RASTER.standard.cols ? ' ' : c))).join('').trimEnd();
      });
      const rest = render(s, at, t, REST, pip);
      let moved = 0;
      for (let ms = 0; ms < TIMING.greet; ms += GREET.every) {
        const f = render(s, at, t, { at: s.fx.view + ms }, pip);
        const where = `${label} at ${cols}x${rows}, +${ms} ms`;
        assert.equal(f.length, rows, where);
        f.forEach((l, k) => assert.ok(width(l) <= cols - 1, `${where}, line ${k + 1}`));
        if (ms < from) continue;
        if (f.join('\n') !== rest.join('\n')) moved += 1;
        assert.deepEqual(words(f), words(rest), where);
      }
      assert.ok(moved > 100, `${label} at ${cols}x${rows}: Pip moves in ${moved} frames`);
    }
  }
});
