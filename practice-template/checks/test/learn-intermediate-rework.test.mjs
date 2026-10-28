// Intermediate screens at every authored beat, in the practice copy and in an
// own repository. Real check failures at check beats are covered for every
// lesson by learn-check-says.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveCourse, driver, finishedBefore, lessonScreens } from './learn-drive.mjs';
import { render } from '../../learn/lib/render.mjs';
import { strip, width } from '../../learn/lib/text.mjs';
import { theme } from '../../learn/lib/theme.mjs';

const intermediate = liveCourse.filter(l => l.level === 'intermediate' && l.content).map(l => l.id);

test('i-1 names each terminal by its folder when the repository is outside the practice copy', () => {
  const lesson = liveCourse.find(l => l.id === 'i-1');
  const t = theme({ tty: true, depth: 1, unicode: true, links: false, win32: false });
  const screen = d => render(d.state, { cols: 80, rows: 24 }, t).map(strip).join('\n').replace(/\s+/g, ' ');
  const at = step => {
    const d = driver({ course: liveCourse, saved: { format: 1, welcomed: true,
      folders: { intermediate: '/work/project' },
      lessons: { ...finishedBefore('i-1', liveCourse), 'i-1': { step, beat: 0, warm: [], levels: ['hinted', 'challenge'] } },
    } });
    d.key('enter');
    return d;
  };
  const commit = at('Y3');
  assert.ok(screen(commit).includes('in a terminal, in project'), screen(commit));
  const check = at('C');
  assert.ok(screen(check).includes('in a terminal, in your practice copy'), screen(check));
  check.send({ type: 'check', lesson: 'i-1', items: lesson.items.map((text, index) => ({ index, text, pass: true, hint: '' })) });
  assert.ok(screen(check).includes('Run it in your practice copy too: you will see the same result.'), screen(check));
  assert.ok(!screen(check).includes('your other terminal'), screen(check));
  check.send({ type: 'paste', text: 'npm run check -- i-1' });
  assert.ok(screen(check).includes('Type it in a terminal, in your practice copy, not here.'), screen(check));
});

for (const id of intermediate) test(`${id}: every beat fits in both terminal sizes in the practice copy and an own repository`, () => {
  for (const folders of [null, { intermediate: '/work/project' }]) {
    const screens = lessonScreens(id, liveCourse, { folders });
    const lesson = liveCourse.find(l => l.id === id);
    for (const step of lesson.content.steps) for (let index = 0; index < step.beats.length; index++) {
      assert.ok(screens.some(([label]) => label.startsWith(`${id} ${step.id}.${index} `)), `missing ${step.id}.${index}`);
    }
    for (const unicode of [true, false]) {
      const t = theme({ tty: true, depth: 1, unicode, links: false, win32: !unicode });
      for (const [cols, rows] of [[60, 20], [80, 24]]) for (const [label, state] of screens) {
        const lines = render(state, { cols, rows }, t).map(strip);
        const diagnostic = `${label} ${cols}x${rows}\n${lines.join('\n')}`;
        assert.equal(lines.length, rows, diagnostic);
        assert.ok(lines.every(line => width(line) < cols), diagnostic);
        assert.ok(lines.every(line => line.trim() !== t.glyph.ellipsis && !(line.endsWith('…') && width(line) === cols - 1)), `teaching text cut: ${diagnostic}`);
        // An opening screen, and every screen at 80x24, cuts no row inside
        // the card either; at 60x20 the other cuts are learn-render's known ones.
        if (rows >= 24 || /^\S+ \S+\.\d+ open$/.test(label)) assert.ok(!lines.some(line => line.trim() === `${t.glyph.rail}  ${t.glyph.ellipsis}`), `the card cuts a row: ${diagnostic}`);
      }
    }
  }
});
