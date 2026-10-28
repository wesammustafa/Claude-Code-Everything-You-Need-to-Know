// Real repository failures at every lesson beat that displays them (198).
// Generic reducer fixtures cannot catch overflow caused by a check's
// diagnostic, so each ladder scenario's real FAIL text is driven to the
// "The check says:" rung of each beat that checks its item.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync } from 'node:fs';
import { join } from 'node:path';
import { liveCourse, driver, finishedBefore } from './learn-drive.mjs';
import { render } from '../../learn/lib/render.mjs';
import { strip, width } from '../../learn/lib/text.mjs';
import { theme } from '../../learn/lib/theme.mjs';
import { rungsOf, stepOf } from '../../learn/lib/flow.mjs';
import { lessons } from '../lessons/index.mjs';
import { openRepo } from '../repo.mjs';
import { commit, repo, withRepo, write } from './helpers.mjs';

const flat = text => text.replace(/[`*]/g, '').replace(/\s+/g, '');

const failure = (id, sc) => withRepo(() => repo(), dir => {
  if (sc.files) write(dir, sc.files);
  if (sc.setup) sc.setup(dir, { write, commit });
  if (sc.command) { write(dir, { 'bin/claude': sc.command }); chmodSync(join(dir, 'bin/claude'), 0o755); }
  const previous = process.env.PATH;
  try {
    if (sc.path) process.env.PATH = join(dir, sc.path);
    return lessons[id].items[sc.item].check(openRepo(dir));
  } finally { if (previous === undefined) delete process.env.PATH; else process.env.PATH = previous; }
});

for (const lesson of liveCourse.filter(l => l.content)) {
  test(`real ${lesson.id} failures fit at every check beat in both terminal sizes and character sets`, async t => {
    const { scenarios } = await import(`./ladders/${lesson.id}.mjs`);
    const checkBeats = lesson.content.steps.flatMap(step => step.beats.flatMap((beat, index) =>
      beat.verify.kind === 'check' ? [{ step, beat, index }] : []));
    assert.ok(checkBeats.length, 'the lesson must have check beats');
    const covered = new Set();

    for (const { step, beat, index } of checkBeats) {
      const targets = beat.verify.all ? lesson.items.map((_, i) => i) : beat.verify.items;
      const candidates = scenarios.filter(sc => targets.includes(sc.item));
      assert.ok(candidates.length, `${step.id}.${index}: no real failure scenarios`);
      for (const sc of candidates) {
        covered.add(sc);
        await t.test(`${step.id}.${index}: ${sc.name}`, () => {
          const hint = failure(lesson.id, sc);
          assert.equal(typeof hint, 'string', 'the scenario must produce a real failure');
          const d = driver({ course: liveCourse, saved: {
            format: 1, welcomed: true, folders: { [lesson.level]: '/work/project', [lesson.id]: '/work/copy' },
            lessons: { ...finishedBefore(lesson.id, liveCourse), [lesson.id]: {
              step: step.id, beat: index, warm: [], levels: ['hinted', 'challenge'],
            } },
          } });
          d.key('enter');
          assert.equal(stepOf(d.state).id, step.id, 'resume must reach the actual check step');
          assert.equal(d.state.pos.beat, index, 'resume must reach the actual check beat');
          const items = targets.map(i => ({ index: i, text: lesson.items[i], pass: i !== sc.item, hint: i === sc.item ? hint : '' }));
          const result = { type: 'check', lesson: lesson.id, items, path: beat.evidence ?? null, stamp: 'a' };
          d.send(result);
          d.key('r');
          d.send({ ...result, asked: d.state.beat.asked });
          for (let n = 0; n < 8 && rungsOf(d.state)[d.state.beat.rung]?.kind !== 'check'; n++) d.key('h');
          assert.equal(rungsOf(d.state)[d.state.beat.rung]?.kind, 'check', 'the real failure rung must open');

          for (const unicode of [true, false]) {
            const themeForScreen = theme({ tty: true, depth: 1, unicode, links: false, win32: !unicode });
            for (const [cols, rows] of [[60, 20], [80, 24]]) {
              const lines = render(d.state, { cols, rows }, themeForScreen).map(strip);
              const screen = flat(lines.map(line => line.replace(/^\s*[│|]\s*(?:[▌|]\s*)?/, '')).join(''));
              const label = `${cols}x${rows} ${unicode ? 'Unicode' : 'ASCII'}`;
              const diagnostic = `${label}\n${lines.join('\n')}`;
              assert.equal(lines.length, rows, diagnostic);
              assert.ok(lines.every(line => width(line) < cols), `line too wide: ${diagnostic}`);
              assert.ok(screen.includes(flat(step.title)), `title gone: ${diagnostic}`);
              for (const line of beat.lines.filter(line => ['goal', 'do', 'say'].includes(line.key))) {
                assert.ok(screen.includes(flat(line.text)), `instruction gone: ${diagnostic}`);
              }
              assert.ok(screen.includes(flat('The check says:')), `hint box gone: ${diagnostic}`);
              const hintBox = screen.slice(screen.indexOf(flat('The check says:')));
              assert.ok(hintBox.includes(flat(hint)), `check message cut: ${diagnostic}`);
              // The hint box's own corner is ╰…╯; the card's bottom rule has no right corner.
              const { bl, rule, br } = themeForScreen.glyph;
              assert.ok(lines.some(line => { const l = line.trim(); return l.startsWith(bl + rule + rule) && !l.endsWith(br) && [...l.slice(1)].every(c => c === rule); }), `bottom border gone: ${diagnostic}`);
            }
          }
        });
      }
    }
    assert.equal(covered.size, scenarios.length, 'every real failure scenario reaches a check beat');
  });
}
