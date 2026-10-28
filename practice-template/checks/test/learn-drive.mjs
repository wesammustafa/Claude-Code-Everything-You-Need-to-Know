// Shared by the learn app's tests: lesson 1 driven through the reducer, with
// the check's real FAIL messages, so tests can look at every screen.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCourse, parseLesson, READS } from '../../learn/lib/content.mjs';
import { beatOf, DEFER_MS, easeLands, hintAvailable, IDLE_MS, initialState, lessonOf, reduce, rungsOf, stepOf, tierOf } from '../../learn/lib/flow.mjs';
import { versionSaved } from './fixtures/saved-version.mjs';
import { openRepo } from '../repo.mjs';
import { repo, withRepo, write } from './helpers.mjs';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// Stable synthetic course for reducer/render unit tests. Production content
// is tested independently through liveCourse, the content/ladders tests and
// the rework integration walk. Keeping these fixtures avoids coupling tests
// of generic UI behavior to editorial step numbering.
export const liveCourse = loadCourse(root);
export const course = liveCourse.map((l) => {
  if (l.level !== 'beginner') return l;
  const content = parseLesson(readFileSync(join(root, 'checks/test/fixtures/reducer-course', `${l.id}.md`), 'utf8'), `fixture/${l.id}.md`);
  const slow = l.id === 'b-3' ? [1] : l.id === 'b-capstone' ? [3, 4] : [];
  return { ...l, items: content.ladder.map(r => r.item), slow, content };
});
// The course with b-4's /exit warm-up (R2) holding no hint of its own, so a
// wrong answer it doesn't list gets the app's own line (ticket 187).
export const bareExit = course.map((l) => (l.id === 'b-4' ? { ...l, content: parseLesson(readFileSync(join(root, 'checks/test/fixtures/reducer-course/b-4.md'), 'utf8').replace('- hint: "End the session with `/exit`."\n', ''), 'fixture/b-4.md') } : l));
// The folder a learner gives for a lesson that runs in a new copy of the
// template.
export const NEW_COPY = '/home/sam/claude-actions-practice';
export const FACTS = { root: '/home/sam/claude-code-practice', name: 'Sam', gitError: null, practiceDir: true, codespace: false, win32: false };

// The b-1 item's real result for a version.txt holding `text` (null: no file).
export function b1Item(text) {
  return withRepo(() => repo(), (dir) => {
    if (text !== null) write(dir, { '.practice/version.txt': text });
    const outcome = versionSaved.check(openRepo(dir));
    return { index: 0, text: versionSaved.text, pass: outcome === true, hint: outcome === true ? '' : outcome.replace(dir, FACTS.root) };
  });
}

// The course with lesson 1 as the only lesson in the app, whatever else
// learn/lessons holds, so a test of lesson 1 alone stays put.
export const b1Only = course.map((l) => (l.id === 'b-1' ? l : { ...l, content: null }));
// That course, with made-up content files for some lessons, { id: text }.
export const courseWith = (texts) => b1Only.map((l) => (texts[l.id] ? { ...l, content: parseLesson(texts[l.id], `${l.id}.md`) } : l));

// The course of all three levels, with made-up content files for some
// lessons, { id: text }, in place of their own. A lesson with no lesson file
// yet (i-5 on, today) is check-only unless `texts` gives it content.
export const threeLevels = (texts = {}) => course.map((l) => (texts[l.id] ? { ...l, content: parseLesson(texts[l.id], `${l.id}.md`) } : l));

// A made-up lesson 2 with what lesson 1 doesn't have: three warm-ups, a
// third terminal, and a step that redoes an earlier one.
export const DEMO_B2 = `---
lesson: b-2
title: "Demo"
stamp: "Verified against Claude Code v2.1.285 (stable) on 2026-10-05"
next: b-3
---

## intro
- minutes: "about 20 minutes"
- can: "do it"

## warm-up

### R1 | Warm-up | Status
- tier: challenge
- skill: status
- from: b-1
- beat: ask
- ask: Which command shows the account?
- right: "\`/status\`"
- wrong: "\`/usage\`"
- because: "Usage is something else."

### R2 | Warm-up | Version
- tier: challenge
- skill: save-version
- from: b-1
- beat: type
- ask: Which command prints the version?
- accept: claude --version
- reveal: "\`claude --version\`"

### R3 | Warm-up | Exit
- tier: challenge
- skill: exit
- from: b-1
- beat: ask
- ask: How do you end a session?
- right: "\`/exit\`"
- wrong: "\`/clear\`"
- because: "Clear is something else."

## steps

### W1 | Worked example step 1 of 1 | Save the list
- tier: guided
- skill: snapshot
- where: shell
- beat: do
- verify: check 0
- watching: .practice/b-2-before.txt
- evidence: .practice/b-2-before.txt
- run: "git status --porcelain > .practice/b-2-before.txt"

### Y1 | Your turn step 1 of 1 | Save it again
- tier: challenge
- skill: snapshot
- where: shell
- beat: do
- verify: check 0 fresh
- watching: .practice/b-2-before.txt
- evidence: .practice/b-2-before.txt
- goal: "Save it again."

### C | Check | Check
- tier: challenge
- skill: check
- where: terminal
- beat: do
- verify: check all
- goal: "Run the check."
`;

// DEMO_B2 with its Worked example's run line replaced by `lines`, such as
// a code block (ticket 90).
export const withCode = (lines) => DEMO_B2.replace('- run: "git status --porcelain > .practice/b-2-before.txt"\n', lines.map((l) => `${l}\n`).join(''));

// A made-up i-1, the first lesson of a new level, with its tiers as the
// course rule gives them: warm-ups from Beginner (R1 a skill it reuses, R2 an
// older lesson's), a new skill at GUIDED, and commit, which Beginner asked
// three times, at CHALLENGE in a Worked example.
export const DEMO_I1 = `---
lesson: i-1
title: "Demo"
stamp: "Verified against Claude Code v2.1.308 (stable) on 2026-10-25"
next: i-2
---

## intro
- minutes: "about 20 minutes"
- can: "do it"

## warm-up

### R1 | Warm-up | Commit
- tier: challenge
- skill: commit
- from: b-5
- beat: ask
- ask: Which command records the change?
- right: "\`git commit\`"
- wrong: "\`git stash\`"
- because: "Stash is something else."

### R2 | Warm-up | Compact
- tier: challenge
- skill: compact
- from: b-4
- beat: ask
- ask: Which command summarizes the conversation?
- right: "\`/compact\`"
- wrong: "\`/clear\`"
- because: "Clear is something else."

## steps

### W1 | Worked example step 1 of 2 | Write the skill
- tier: guided
- skill: skill-file
- where: editor
- beat: do
- verify: check 0
- watching: .claude/skills/tdd/SKILL.md
- do: "Write the skill."

### W2 | Worked example step 2 of 2 | Commit it
- tier: challenge
- skill: commit
- where: shell
- beat: do
- verify: check 2
- watching: .practice/i-1-commit.txt
- goal: "Commit it."

### C | Check | Check
- tier: challenge
- skill: check
- where: terminal
- beat: do
- verify: check all
- goal: "Run the check."
`;

// DEMO_I1 with R2 from the Intermediate level index, as the guide's quote
// check allows (ticket 178): a page with no lesson file and no PATH entry.
export const DEMO_I1_INDEX = DEMO_I1.replace(/### R2 \| Warm-up \| Compact\n[^#]*/, `### R2 | Warm-up | When to use what
- tier: challenge
- skill: when-to-use
- from: intermediate-index
- beat: ask
- ask: Which one runs on every matching event?
- right: "A hook"
- wrong: "A skill"
- because: "A skill is [something else](01-first-skill.md)."

`);

// A lesson finished on the path: complete, with every one of its own steps
// done. Help fades only for what the learner did, so a seed without `done`
// is a learner who skipped the lesson.
export const finished = (l) => ({ complete: true, done: l.content.steps.map((x) => x.id) });
// The last lesson a learner reaches by playing the lessons in order from
// `from` (the first lesson by default): the one before the next lesson with
// no lesson file, whose check-only view the next screen doesn't open. A
// later lesson with a file is reached from the map, not in order.
export const lastInOrder = (lessons = course, from = lessons[0].id) => {
  const start = lessons.findIndex((l) => l.id === from);
  const gap = lessons.findIndex((l, i) => i > start && !l.content);
  return lessons[(gap < 0 ? lessons.length : gap) - 1].id;
};
// Every lesson in the app before `id`, finished.
export const finishedBefore = (id, lessons = course) => Object.fromEntries(lessons.slice(0, lessons.findIndex((l) => l.id === id)).filter((l) => l.content).map((l) => [l.id, finished(l)]));

// DEMO_B2 with its Your turn step verified by reading a file: `verify` is the
// value of its verify line. The learner is on that step.
const reading = (verify) => DEMO_B2.replace('- verify: check 0 fresh\n- watching: .practice/b-2-before.txt\n- evidence: .practice/b-2-before.txt', `- verify: ${verify}`);
export function onReading(verify, extra = {}) {
  const d = driver({ course: courseWith({ 'b-2': reading(verify) }), saved: { format: 1, welcomed: true, lessons: { 'b-1': finished(course.find((l) => l.id === 'b-1')), 'b-2': { warm: ['R1', 'R2', 'R3'], done: ['R1', 'R2', 'R3', 'W1'], step: 'Y1', beat: 0, ...extra } } } });
  for (let i = 0; i < 3 && d.state.view !== 'step'; i++) d.key('enter');
  if (stepOf(d.state)?.id !== 'Y1') throw new Error(`onReading: on ${d.state.view}, not Y1`);
  return d;
}
// A file's bytes, as main reads them.
export const bytes = (text) => Buffer.from(text);
// r, then the file as it is now (null: no file): the beat's state after.
export function tryNow(d, path, text, stamp = 'x') {
  d.key('r');
  d.send({ type: 'file', path, read: text === null ? null : bytes(text), stamp, asked: d.state.beat.asked });
  return d.state.beat;
}

// What git status lists, as main reads it for a beat on part of the tree
// (ticket 88): every untracked file on its own line (`files`), and the paths
// whose index column says staged.
export const gitLists = (paths, staged = [], extra = {}) => ({ type: 'git', files: true, paths, staged, ...extra });

// Lesson 1 alone by default; lessonScreens passes the whole course.
export function driver({ saved = null, facts = {}, course: lessons = b1Only } = {}) {
  let now = 1_000;
  let state = initialState({ course: lessons, saved, facts: { ...FACTS, ...facts }, now });
  const effects = [];
  const send = (ev) => {
    now += ev.wait ?? 3_000;
    const r = reduce(state, { now, ...ev });
    state = r.state;
    effects.push(...r.effects);
    return r.effects;
  };
  // A key press as a person makes it: then a pause, so a held letter acts.
  const press = (name, ch, wait) => {
    const out = send({ type: 'key', name, ch: ch ?? (name.length === 1 ? name : name === 'space' ? ' ' : undefined), wait });
    return [...out, ...send({ type: 'flush', wait: DEFER_MS + 50 })];
  };
  const key = (name, ch) => press(name, ch);
  return { send, key, press, effects, get state() { return state; }, get now() { return now; } };
}

// On the map, moves the cursor to lesson `id`: left or right to its level,
// then down its rows.
export function mapTo(d, id) {
  const levels = [...new Set(d.state.course.map((l) => l.level))];
  const target = d.state.course.find((l) => l.id === id);
  for (let i = 0; i < 60 && d.state.course[d.state.mapCursor].id !== id; i++) {
    const here = levels.indexOf(d.state.course[d.state.mapCursor].level);
    const there = levels.indexOf(target.level);
    d.key(here === there ? 'down' : here < there ? 'right' : 'left');
  }
  if (d.state.course[d.state.mapCursor].id !== id) throw new Error(`mapTo: the map's cursor never reached ${id}`);
}

// A line that a lesson's match regex matches, built from the regex itself:
// its first branch of every group, one of every class or wildcard, a
// quantified part once. Enough for the plain regexes lesson files hold
// (app words, no lookaround or backreference); a test fails loudly where one
// is beyond it.
export function lineFor(regex) {
  // A literal fixture for the description's minimum-length predicate. It is
  // input for screen traversal; the scoped test verifies the real boundary.
  if (regex === '^description:(?!.*\\bTODO\\b)\\s*(?:\\S+\\s+){7}\\S') return 'description: Reports untested functions when a review needs coverage gaps.';
  const ESCAPES = { s: ' ', S: 'x', w: 'x', W: '-', d: '1', D: 'x', b: '' };
  let i = 0;
  const branch = () => {
    let out = '';
    while (i < regex.length && regex[i] !== '|' && regex[i] !== ')') {
      const c = regex[i++];
      let part;
      if (c === '^' || c === '$') part = '';
      else if (c === '\\') {
        part = ESCAPES[regex[i]] ?? regex[i];
        i++;
      }
      else if (c === '.') part = 'x';
      else if (c === '[') {
        const end = regex.indexOf(']', i + 1);
        const set = regex.slice(i, end);
        i = end + 1;
        part = set[0] === '\\' ? (ESCAPES[set[1]] ?? set[1]) : set[0];
      } else if (c === '(') {
        if (regex.startsWith('?:', i)) i += 2;
        part = branch();
        while (regex[i] === '|') {
          i++;
          branch();
        }
        i++;
      } else part = c;
      const q = regex[i];
      if (q === '*' || q === '?') {
        i++;
        part = '';
      } else if (q === '+') i++;
      if (regex[i] === '?') i++;
      out += part;
    }
    return out;
  };
  const line = branch();
  if (!new RegExp(regex).test(line)) throw new Error(`lineFor: no line made for /${regex}/ (made "${line}")`);
  return line;
}

// A JSON file that holds the key path a json beat reads, with its value
// (text, as the beat compares it) or any value: an array at each index part.
export function jsonFor(key, value) {
  if (!key) return '{}';
  const parts = key.split('.');
  const make = (k) => {
    if (k === parts.length) return value ?? 'x';
    const inner = make(k + 1);
    if (!/^\d+$/.test(parts[k])) return { [parts[k]]: inner };
    return [...Array.from({ length: Number(parts[k]) }, () => 'x'), inner];
  };
  return JSON.stringify(make(0));
}

// What a file holds once the step's work is done, for a beat that reads it.
const readsRight = (v) => (v.kind === 'json' ? jsonFor(v.key, v.value) : v.kind === 'match' ? `${lineFor(v.regex)}\n` : v.kind === 'no-match' ? 'a line\n' : 'src/config.js');

// Plays on as a learner who needs no help, until `stop(state)` holds: the
// right pick, the answer typed, every check failing once then passing, a
// file that reads wrong once then right, a clean tree or the change git
// status should list, enter past every level-up and lesson end.
// A count across plays, so each new commit or probe state differs from every
// one before it, even where a play takes one action at a time.
let moves = 0;
export function playUntil(d, stop) {
  for (let i = 0; i < 2_000 && !stop(d.state); i++) {
    const s = d.state;
    // A lesson that runs in a new copy (a-5) asks for its folder: the
    // learner gives one, and main finds a git repository there.
    if (s.overlay === 'folder') {
      const a = s.folderAsk;
      if (a.asked) d.send({ type: 'probed', key: a.key, asked: a.asked, path: NEW_COPY, missing: false, git: true, practice: true });
      else {
        d.send({ type: 'paste', text: NEW_COPY });
        d.key('enter');
      }
      continue;
    }
    if (s.view !== 'step') {
      d.key('enter');
      continue;
    }
    const beat = beatOf(s);
    const v = beat.verify;
    if (['done', 'already'].includes(s.beat.status)) d.key('enter');
    else if (beat.kind === 'type') {
      for (const c of beat.accept[0]) d.key(c === ' ' ? 'space' : c.toLowerCase(), c);
      d.key('enter');
    } else if (beat.ask && beat.options.length) d.key(String(beat.options.findIndex((o) => beat.kind === 'predict' || ['right', 'option', 'other'].includes(o.kind)) + 1));
    else if (v.kind === 'check') {
      const l = lessonOf(s);
      const items = (v.all ? l.items.map((_, k) => k) : v.items).map((index) => ({ index, text: l.items[index], pass: false, hint: `${l.items[index]} is not there yet.` }));
      d.send({ type: 'check', lesson: s.lesson, items, path: beat.evidence ?? null, stamp: 'a' });
      d.send({ type: 'check', lesson: s.lesson, items: items.map((it) => ({ ...it, pass: true, hint: '' })), path: beat.evidence ?? null, stamp: 'b' });
    } else if (v.kind === 'file') {
      d.send({ type: 'file', path: v.path, read: null, stamp: 'a' });
      d.send({ type: 'file', path: v.path, read: Buffer.from('src/config.js'), stamp: 'b' });
    } else if (v.kind === 'json') {
      d.send({ type: 'file', path: v.path, read: Buffer.from('{'), stamp: 'a' });
      d.send({ type: 'file', path: v.path, read: Buffer.from(jsonFor(v.key, v.value)), stamp: 'b' });
    } else if (v.kind === 'match') {
      d.send({ type: 'file', path: v.path, read: null, stamp: 'a' });
      d.send({ type: 'file', path: v.path, read: Buffer.from(`${lineFor(v.regex)}\n`), stamp: 'b' });
    } else if (v.kind === 'no-match') {
      d.send({ type: 'file', path: v.path, read: Buffer.from(`${lineFor(v.regex)}\n`), stamp: 'a' });
      d.send({ type: 'file', path: v.path, read: Buffer.from('a line\n'), stamp: 'b' });
    } else if (v.kind === 'git-clean') {
      if (beat.doneLabel) d.key('space');
      d.send(v.paths ? gitLists([]) : { type: 'git', paths: [] });
    } else if (v.kind === 'git-staged') d.send(gitLists(['a.txt'], ['a.txt']));
    else if (['git-changed', 'git-only'].includes(v.kind)) d.send(gitLists([`${v.path.replace(/\/+$/, '')}/new.txt`]));
    // Ticket 105: a new commit; the same paths as the stamp, or none where
    // there is no stamp; a probe that fails once, then passes on new work.
    else if (v.kind === 'head-moved') d.send({ type: 'git', paths: [], head: `new-${++moves}` });
    else if (v.kind === 'git-unchanged') d.send({ type: 'git', paths: [] });
    else if (v.kind === 'probe') {
      d.send({ type: 'probe', name: v.name, args: v.args, pass: false, hint: 'Not yet.', state: `a${++moves}` });
      d.send({ type: 'probe', name: v.name, args: v.args, pass: true, hint: '', evidence: 'Found.', state: `b${moves}` });
    } else d.key('space');
  }
  if (!stop(d.state)) throw new Error(`playUntil: stuck at ${d.state.view} ${d.state.lesson} ${stepOf(d.state)?.id}`);
}

// A check beat on screen FAILs, and FAILs again on r: the second result is
// r's own run's.
export function failCheck(d) {
  const v = beatOf(d.state).verify;
  if (v.kind !== 'check') return;
  const l = lessonOf(d.state);
  const items = (v.all ? l.items.map((_, k) => k) : v.items).map((index) => ({ index, text: l.items[index], pass: false, hint: `${l.items[index]} is not there yet.` }));
  d.send({ type: 'check', lesson: d.state.lesson, items });
  d.key('r');
  d.send({ type: 'check', lesson: d.state.lesson, items, asked: d.state.beat.asked });
}

// Climbs the hints on the beat on screen to the exact command and says y.
// A check beat fails first, so its ladder's rungs are there too.
export function bottomRung(d) {
  failCheck(d);
  for (let i = 0; i < 8 && !d.state.beat.confirm; i++) d.key('h');
  d.key('y');
}

// Every screen of lesson 1, in order, as [label, state] pairs.
export function allScreens() {
  const d = driver();
  const out = [];
  const snap = (label) => out.push([label, d.state]);
  const missing = b1Item(null);
  const empty = b1Item('');
  const passed = b1Item('2.1.285 (Claude Code)\n');
  snap('welcome');
  d.key('enter'); snap('intro');
  d.key('enter'); snap('W1');
  d.key('space'); snap('W2');
  d.key('2'); snap('W2 stuck');
  d.key('1'); snap('W2 right');
  d.key('enter'); snap('W3 opening');
  d.send({ type: 'check', lesson: 'b-1', items: [missing] }); snap('W3 waiting');
  d.send({ type: 'check', lesson: 'b-1', items: [empty] }); snap('W3 not yet');
  d.key('h'); snap('W3 hint 1');
  d.key('h'); snap('W3 hint 2');
  d.key('h'); snap('W3 hint 3');
  d.key('h'); snap('W3 confirm');
  d.key('y'); snap('W3 bottom');
  d.key('w'); snap('W3 why');
  d.key('w');
  d.send({ type: 'check', lesson: 'b-1', items: [passed], read: Buffer.from('2.1.285 (Claude Code)\n') }); snap('W3 done');
  d.key('enter'); snap('W4 predict');
  d.key('2'); snap('W4 guessed');
  d.key('enter'); snap('W4 sign in');
  d.key('space'); snap('W4 trust');
  d.key('space'); snap('W5');
  d.key('w'); snap('W5 why');
  d.key('w');
  d.key('1'); snap('W5 wrong');
  d.key('s'); snap('W5 revealed');
  d.key('enter'); snap('W6');
  // W6's first beat waits for the learner's word, its done-label: space.
  d.key('space'); snap('W6 ask');
  d.key('2'); snap('W6 decoy');
  d.key('1'); snap('W6 right');
  d.key('enter'); snap('W7 predict');
  d.key('2'); snap('W7 guessed');
  d.key('enter'); snap('W7 exit');
  d.key('space'); snap('W7 git opening');
  d.send({ type: 'git', paths: ['src/notes.md', 'test/new.test.js', 'a.txt', 'b.txt'] }); snap('W7 git dirty');
  d.send({ type: 'git', paths: [] }); snap('W7 git clean');
  // The bottom rung at W3 eased save-version: Y1 comes back GUIDED, so the
  // level-up waits for Y2.
  d.key('enter'); snap('Y1 eased');
  d.send({ type: 'check', lesson: 'b-1', items: [passed], read: Buffer.from('2.1.285 (Claude Code)\n') }); snap('Y1 already');
  d.key('enter'); snap('level up hinted');
  d.key('enter'); snap('Y2');
  d.key('1'); snap('Y2 option');
  d.key('enter'); snap('Y3');
  d.key('h'); snap('Y3 hint');
  d.key('space'); snap('level up challenge');
  d.key('enter'); snap('Y4 opening');
  d.send({ type: 'git', paths: ['notes.md'] }); snap('Y4 live dirty');
  d.send({ type: 'tick', wait: 121_000 }); snap('Y4 idle');
  d.send({ type: 'git', paths: [] }); snap('Y4 live clean');
  d.send({ type: 'paste', text: 'claude --version' }); snap('Y4 stray');
  d.key('space'); d.send({ type: 'git', paths: ['notes.md'] }); snap('Y4 not yet');
  d.send({ type: 'git', paths: [] }); snap('Y4 done');
  d.key('enter'); d.send({ type: 'check', lesson: 'b-1', items: [passed] }); snap('C check');
  d.key('enter'); for (const c of '/usage') d.key(c, c); snap('C typing');
  d.key('enter'); snap('C wrong');
  d.key('enter'); snap('C revealed');
  d.key('enter'); snap('C self');
  d.key('space'); snap('complete');
  d.key('enter'); snap('next');
  d.key('space'); snap('compare');
  d.key('space');
  d.key('m'); snap('map');
  d.key('?'); snap('help');
  d.key('?'); d.key('down'); d.key('enter'); snap('check-only');
  d.send({ type: 'check', lesson: 'b-2', items: [{ index: 0, text: 'x', pass: true, hint: '' }, { index: 1, text: 'y', pass: false, hint: 'no' }] }); snap('check-only results');
  d.key('p'); snap('page');
  d.key('p'); d.key('c'); snap('card');
  const r = driver({ saved: { format: 1, welcomed: true, eased: [], lessons: { 'b-1': { step: 'Y3', beat: 0, done: ['W1'] } } } });
  out.push(['resume', r.state]);
  r.key('x');
  out.push(['resume confirm', r.state]);
  r.key('n');
  r.send({ type: 'check-error', lesson: 'b-1', message: 'boom' });
  r.key('enter'); out.push(['Y3 resumed', r.state]);
  const b = driver({ saved: { format: 1, welcomed: true, lessons: { 'b-1': { step: 'W3', beat: 0 } } } });
  b.key('enter'); b.send({ type: 'check-error', lesson: 'b-1', message: 'it took too long' });
  out.push(['W3 broken', b.state]);
  b.key('c'); out.push(['card empty', b.state]);
  return out;
}

// Screens of every step and beat of a lesson: each opened from a saved place,
// then waiting, failing, done, with a hint open, as its beat allows. The
// learner finished every lesson before it, or, with `skipped`, none, and
// saved `folders`, the work folders, when given.
export function lessonScreens(id, lessons = course, { skipped = false, folders = null } = {}) {
  const l = lessons.find((x) => x.id === id);
  const out = [];
  const warm = l.content.warmup.slice(0, 2).map((w) => w.id);
  const steps = [...warm.map((w) => l.content.warmup.find((x) => x.id === w)), ...l.content.steps];
  const complete = skipped ? {} : finishedBefore(id, lessons);
  steps.forEach((step) => step.beats.forEach((beat, b) => {
    const d = driver({ course: lessons, saved: { format: 1, welcomed: true, lessons: { ...complete, [id]: { step: step.id, beat: b, warm, levels: ['hinted', 'challenge'] } }, ...(folders ? { folders } : {}) } });
    d.key('enter');
    const at = `${id} ${step.id}.${b}`;
    out.push([`${at} open`, d.state]);
    const v = beat.verify;
    if (v.kind === 'check') {
      const items = (v.all ? l.items.map((_, i) => i) : v.items).map((index) => ({ index, text: l.items[index], pass: false, hint: `${l.items[index]} is not there yet: do the step, then look again.` }));
      d.send({ type: 'check', lesson: id, items, path: beat.evidence ?? null, stamp: 'a' });
      out.push([`${at} waiting`, d.state]);
      d.key('r');
      out.push([`${at} checking`, d.state]);
      // r's run of several items reports its last one.
      if (items.length > 1) {
        d.send({ type: 'running', lesson: id, items: v.all ? null : v.items, n: items.length, m: items.length, asked: d.state.beat.asked, wait: 40 });
        out.push([`${at} checking item ${items.length} of ${items.length}`, d.state]);
      }
      d.send({ type: 'check', lesson: id, items, path: beat.evidence ?? null, stamp: 'b', asked: d.state.beat.asked });
      out.push([`${at} fail`, d.state]);
      for (let i = 0; i < 6; i++) {
        d.send({ type: 'key', name: 'h', ch: 'h', wait: 3_000 });
        d.send({ type: 'flush', wait: 400 });
        out.push([`${at} hint ${i + 1}`, d.state]);
        if (d.state.beat?.confirm) {
          d.key('y');
          out.push([`${at} bottom`, d.state]);
          break;
        }
      }
      // r with the last hint open: "Checking" over the "Not yet" keeps it.
      if (d.state.beat.rung >= 0) {
        d.key('r');
        out.push([`${at} checking, hint open`, d.state]);
        d.send({ type: 'check', lesson: id, items, path: beat.evidence ?? null, stamp: 'b', asked: d.state.beat.asked });
      }
      d.send({ type: 'check', lesson: id, items: items.map((it) => ({ ...it, pass: true, hint: '' })), read: Buffer.from('a line of evidence'), path: beat.evidence ?? null, stamp: 'c' });
      out.push([`${at} done`, d.state]);
    } else if (READS.has(v.kind)) {
      // A file kind: not there yet, then as the step's work leaves it.
      d.send({ type: 'file', path: v.path, read: v.kind === 'no-match' ? Buffer.from(`${lineFor(v.regex)}\n`) : null, stamp: '' });
      out.push([`${at} waiting`, d.state]);
      climb(d, at, out);
      d.send({ type: 'file', path: v.path, read: Buffer.from(readsRight(v)), stamp: 'x' });
      out.push([`${at} done`, d.state]);
    } else if (v.kind === 'git-clean') {
      const lists = (paths) => (v.paths ? gitLists(paths.map((p) => `${v.paths[0].replace(/\/+$/, '')}/${p}`)) : { type: 'git', paths });
      d.send(lists(['src/config.js', 'test/config.test.js']));
      out.push([`${at} dirty`, d.state]);
      climb(d, at, out);
      d.send(lists([]));
      out.push([`${at} clean`, d.state]);
    } else if (v.kind === 'probe') {
      const answer = (pass, state, extra = {}) => ({ type: 'probe', name: v.name, args: v.args, pass, state, hint: pass ? '' : 'git worktree list shows 1 worktree under .claude/worktrees/ (docs-pass); this step needs 2.', evidence: pass ? 'Worktrees under .claude/worktrees/: docs-pass, test-pass' : null, ...extra });
      d.send(answer(false, 'a'));
      out.push([`${at} waiting`, d.state]);
      d.key('r');
      d.send(answer(false, 'a', { asked: d.state.beat.asked }));
      out.push([`${at} fail`, d.state]);
      climb(d, at, out);
      d.send(answer(true, 'b'));
      out.push([`${at} done`, d.state]);
    } else if (v.kind === 'head-moved' || v.kind === 'git-unchanged') {
      const head = v.kind === 'head-moved' ? { head: '0123456789abcdef' } : {};
      d.send({ type: 'git', paths: ['src/config.js'], ...head });
      out.push([`${at} waiting`, d.state]);
      d.key('r');
      d.send({ type: 'git', paths: ['src/config.js', 'test/config.test.js'], ...head, asked: d.state.beat.asked });
      out.push([`${at} fail`, d.state]);
      climb(d, at, out);
      d.send({ type: 'git', paths: v.kind === 'head-moved' ? [] : ['src/config.js'], ...(v.kind === 'head-moved' ? { head: 'fedcba9876543210' } : {}) });
      out.push([`${at} done`, d.state]);
    } else if (v.kind.startsWith('git-')) {
      d.send(gitLists(['README.md']));
      out.push([`${at} waiting`, d.state]);
      d.key('r');
      d.send(gitLists(['README.md'], [], { asked: d.state.beat.asked }));
      out.push([`${at} fail`, d.state]);
      climb(d, at, out);
      d.send(v.path ? gitLists([`${v.path.replace(/\/+$/, '')}/config.js`]) : gitLists(['src/config.js'], ['src/config.js']));
      out.push([`${at} done`, d.state]);
    } else if (beat.ask && beat.kind !== 'type') {
      const wrong = beat.options.findIndex((o) => o.kind === 'wrong' || o.kind === 'decoy');
      if (wrong >= 0) {
        d.key(String(wrong + 1));
        out.push([`${at} wrong`, d.state]);
      }
      d.key(String(beat.options.findIndex((o) => o.kind === 'right' || o.kind === 'option') + 1));
      out.push([`${at} answered`, d.state]);
    } else if (beat.kind === 'type') {
      d.key('enter');
      out.push([`${at} revealed`, d.state]);
    } else climb(d, at, out);
  }));
  return out;
}
// Each step's opening screen when an ease lands on it: a bottom rung or a
// missed warm-up on its skill brings the step back one tier easier, with
// "A little more help" on its first beat (flow's easeLands). An ease lands
// only where the step opens above GUIDED, so a step that opens GUIDED is
// opened with "less help" on, the one way an ease reaches it. The learner
// finished every lesson before it, or, with `skipped`, none.
export function easedOpenings(id, lessons = course, { skipped = false } = {}) {
  const l = lessons.find((x) => x.id === id);
  const complete = skipped ? {} : finishedBefore(id, lessons);
  const open = (step, extra) => {
    const d = driver({ course: lessons, saved: { format: 1, welcomed: true, lessons: { ...complete, [id]: { step: step.id, beat: 0, warm: [], levels: ['hinted', 'challenge'], ...extra } } } });
    d.key('enter');
    if (stepOf(d.state)?.id !== step.id) throw new Error(`easedOpenings: ${id} ${step.id} opened ${d.state.view} ${stepOf(d.state)?.id}`);
    return d;
  };
  return l.content.steps.flatMap((step) => {
    const lessHelp = tierOf(open(step, {}).state) === 'guided';
    const plain = open(step, { lessHelp });
    if (!easeLands(plain.state, plain.state.pos.step)) return [];
    const d = open(step, { lessHelp, easedSteps: { [step.id]: true } });
    if (!d.state.beat.eased) throw new Error(`easedOpenings: ${id} ${step.id} is not eased`);
    return [[`${id} ${step.id}.0 eased open`, d.state]];
  });
}
const rungsAt = (d) => d.state.view === 'step' && d.state.beat && !['done', 'already'].includes(d.state.beat.status);
// Every rung behind h, the bottom line too. Where a CHALLENGE beat keeps its
// hints for a try that can't come here, two quiet minutes open them.
function climb(d, at, out) {
  if (!rungsAt(d) || !rungsOf(d.state).length) return;
  if (!hintAvailable(d.state)) d.send({ type: 'tick', wait: IDLE_MS + 1_000 });
  for (let i = 0; i < 6 && hintAvailable(d.state) && !d.state.beat?.confirm; i++) {
    d.send({ type: 'key', name: 'h', ch: 'h', wait: 3_000 });
    d.send({ type: 'flush', wait: 400 });
    out.push([`${at} hint ${i + 1}`, d.state]);
  }
  if (d.state.beat?.confirm) {
    d.key('y');
    out.push([`${at} bottom`, d.state]);
  }
}
