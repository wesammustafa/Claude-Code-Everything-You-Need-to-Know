// The learn app's edges: keys, the check child, git, the watcher, the saved
// state, the plain fallback, full runs on a fake terminal with the frames and
// timers they leave, and the promise that it reads the practice copy and
// changes nothing but its own file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { capabilities } from '../../learn/lib/caps.mjs';
import { PATH, SLOW } from '../../learn/lib/content.mjs';
import { DEFER_MS, IDLE_MS } from '../../learn/lib/flow.mjs';
import { keyParser } from '../../learn/lib/keys.mjs';
import { main } from '../../learn/lib/main.mjs';
import { faceMoments, greetFace, REST, SHOTS, TIMING } from '../../learn/lib/motion.mjs';
import { MOTION, restPose } from '../../learn/lib/pip/pip.mjs';
import { pipSlot, render } from '../../learn/lib/render.mjs';
import { ENTER, LEAVE } from '../../learn/lib/screen.mjs';
import { loadState, sanitize, saveState, storePath } from '../../learn/lib/store.mjs';
import { strip, width } from '../../learn/lib/text.mjs';
import { bytesOf, childEnv, gitStatus, ITEM_LIMIT, matchOf, owing, probeFolder, runCheck, singleFlight, stampOf } from '../../learn/lib/verify.mjs';
import { grewFrom } from '../../learn/lib/holds.mjs';
import { judgeGit, listedUnder } from '../../learn/lib/status.mjs';
import { watchDirs } from '../../learn/lib/watch.mjs';
import { theme } from '../../learn/lib/theme.mjs';
import { STUB_RUNS } from '../lessons/a-4.mjs';
import { NPM_TEST_LIMIT } from '../lessons/b-3.mjs';
import { lessons } from '../lessons/index.mjs';
import { statusPaths } from '../paths.mjs';
import { TIME_LIMIT } from '../stub-claude.mjs';
import { check, commit, exportHead, repo, withRepo, write } from './helpers.mjs';
import { b1Item, course, driver, finished, finishedBefore, root } from './learn-drive.mjs';
import { fakeClock, fakeOut, screenModel, turn } from './learn-term.mjs';

// Every lesson on the course, in its order.
const EVERY = PATH.map((p) => p.id);
const RUN_CHECK = join(root, 'learn', 'run-check.mjs');
const child = (args, extraEnv = {}) => {
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const r = spawnSync(process.execPath, [RUN_CHECK, ...args], { encoding: 'utf8', env: { ...env, ...extraEnv } });
  return { code: r.status, out: r.stdout.trim() ? JSON.parse(r.stdout.trim()) : null };
};

test('keys: arrows, enter, Ctrl+C, a lone Escape, and a paste as one event', () => {
  const parse = keyParser();
  assert.deepEqual(parse('\x1b[A\x1bOB\r'), [{ type: 'key', name: 'up', ch: undefined }, { type: 'key', name: 'down', ch: undefined }, { type: 'key', name: 'enter', ch: undefined }]);
  assert.deepEqual(parse('\x03'), [{ type: 'key', name: 'ctrl-c', ch: undefined }]);
  assert.deepEqual(parse('\x1b'), [], 'a lone Escape waits: it may start a sequence');
  assert.deepEqual(parse.flush(), [{ type: 'key', name: 'escape' }]);
  // An arrow split across two reads is still an arrow, not the letter B.
  assert.deepEqual(parse('\x1b['), []);
  assert.deepEqual(parse('B'), [{ type: 'key', name: 'down', ch: undefined }]);
  assert.deepEqual(parse('Q'), [{ type: 'key', name: 'q', ch: 'Q' }]);
  assert.deepEqual(parse('\x1b[200~claude --vers'), []);
  assert.deepEqual(parse('ion\r\x1b[201~'), [{ type: 'paste', text: 'claude --version\r' }]);
  assert.deepEqual(parse('git status'), [{ type: 'paste', text: 'git status' }], 'typed fast with no paste markers');
  assert.deepEqual(parse('\x1b[Z'), [], 'an unused sequence is skipped whole');
  // A paste whose end marker arrives split across reads still ends.
  assert.deepEqual(parse('\x1b[200~ls -la\x1b[20'), []);
  assert.deepEqual(parse('1~q'), [{ type: 'paste', text: 'ls -la' }, { type: 'key', name: 'q', ch: 'q' }]);
  // Ctrl+C works even inside a paste that never ends.
  assert.deepEqual(parse('\x1b[200~endless'), []);
  assert.deepEqual(parse('more\x03'), [{ type: 'key', name: 'ctrl-c' }]);
  // Typed or pasted with no markers and ending in Enter: one paste, not keys.
  assert.deepEqual(parse('bash\r'), [{ type: 'paste', text: 'bash' }]);
});

test('the check child gives the live version and note checks their own words', () => {
  withRepo(() => repo(), (dir) => {
    const none = child(['b-1', dir], { PATH: dir });
    assert.equal(none.code, 0);
    assert.equal(none.out.items.length, 2);
    assert.equal(none.out.items[0].pass, false);
    assert.match(none.out.items[0].hint, /couldn't find `claude`/);
    assert.equal(none.out.items[1].hint, lessons['b-1'].items[1].check({ dir, read: () => null, exists: () => false }));
    // An obsolete saved version cannot make the live installation pass.
    write(dir, { '.practice/version.txt': '2.1.285 (Claude Code)' });
    assert.equal(child(['b-1', dir, '0'], { PATH: dir }).out.items[0].pass, false);
    write(dir, { 'practice/b-1/onboarding.md': 'linkcheck exits 1 when it finds broken links.' });
    assert.equal(child(['b-1', dir, '1']).out.items[0].pass, true);
    assert.equal(child(['b-9', dir]).code, 2);
    assert.equal(child(['b-1', dir, '7']).code, 2);
  });
});

test('for every lesson the child and npm run check agree, item by item', () => {
  const dir = exportHead(root);
  const work = join(dir, 'project');
  try {
    for (const id of EVERY) {
      const ran = child([id, work]).out.items;
      const { out } = check([id, '--dir', work]);
      const lines = out.split('\n');
      for (const r of ran) {
        const at = lines.findIndex((l) => l.trim() === `${r.pass ? 'PASS' : 'FAIL'}  ${r.text}`);
        assert.ok(at > 0, `${id}: npm run check doesn't print ${r.pass ? 'PASS' : 'FAIL'} for ${r.text}`);
        if (!r.pass) assert.equal(lines[at + 1].trim(), r.hint.trim(), `${id}: ${r.text}`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a stamp stampOf takes on disk reads back in grewFrom: the bytes a file held, when it only grew since', () => {
  withRepo(() => repo({ 'log.txt': 'loaded: CLAUDE.md\n' }), (dir) => {
    const stamp = stampOf(dir, 'log.txt');
    assert.equal(grewFrom(stamp, Buffer.from('loaded: CLAUDE.md\nsession started\n')), 18);
    assert.equal(grewFrom(stamp, Buffer.from('loaded: CLAUDE.md\n')), 18, 'the same bytes: nothing added');
    assert.equal(grewFrom(stamp, Buffer.from('loaded: AGENTS.md\nsession started\n')), 0, 'rewritten');
    assert.equal(grewFrom(stampOf(dir, 'gone.txt'), Buffer.from('x\n')), 0, 'no file then');
  });
});

test('the check child writes {"running": n} to stderr before each item it runs, and stdout stays one line of JSON', () => {
  withRepo(() => repo(), (dir) => {
    const { NODE_TEST_CONTEXT, ...env } = process.env;
    const run = (args) => spawnSync(process.execPath, [RUN_CHECK, ...args], { encoding: 'utf8', env });
    const two = run(['b-3', dir, '0', '2']);
    assert.equal(two.status, 0);
    assert.equal(two.stderr, '{"running":1}\n{"running":2}\n', 'the first and the second of the items asked for');
    assert.equal(two.stdout.split('\n').filter(Boolean).length, 1);
    assert.deepEqual(JSON.parse(two.stdout).items.map((i) => i.index), [0, 2]);
    assert.equal(run(['b-1', dir]).stderr, '{"running":1}\n{"running":2}\n', 'every item when none is named');
    const bad = run(['b-9', dir]);
    assert.equal(bad.status, 2);
    assert.equal(bad.stderr, '', 'no item runs, so none is reported');
    assert.equal(bad.stdout.split('\n').filter(Boolean).length, 1);
  });
});

test('runCheck passes on each report as item n of the m items the child runs, before its result', async () => {
  const dir = repo();
  try {
    const seen = [];
    const r = await runCheck(dir, 'b-3', [3, 5], { onRunning: (n, m) => seen.push([n, m]) });
    assert.deepEqual(seen, [[1, 2], [2, 2]]);
    assert.deepEqual(r.items.map((i) => i.index), [3, 5]);
    // The four process-running items are left out, so the child runs the two fast items.
    seen.length = 0;
    await runCheck(dir, 'b-3', null, { onRunning: (n, m) => seen.push([n, m]) });
    assert.deepEqual(seen, [[1, 2], [2, 2]]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the check child\'s time limit runs from the start of each item, so slow items add up in one run without ending it', async () => {
  // b-capstone's two slow items, each 2 s here, the tool then npm test, and
  // together past the limit: each well under it.
  const nap = (ms) => `setTimeout(() => { console.error('docs missing'); process.exit(2); }, ${ms});\n`;
  const dir = repo({ 'src/cli.js': nap(2_000), 'package.json': JSON.stringify({ scripts: { test: 'node -e "setTimeout(() => {}, 2000)"' } }) });
  try {
    const r = await runCheck(dir, 'b-capstone', [3, 4], { slow: true, limit: 4_000 });
    assert.deepEqual(r.items?.map((i) => [i.index, i.pass]), [[3, true], [4, true]], JSON.stringify(r));
    // One item that runs past it still ends the run.
    write(dir, { 'src/cli.js': nap(6_000) });
    assert.deepEqual(await runCheck(dir, 'b-capstone', [3], { slow: true, limit: 2_000 }), { error: 'it took too long' });
    // The slowest items' own limits: npm test's, and a-4's script run in
    // each of its scenarios. Each fits, whatever runs before it.
    assert.ok(ITEM_LIMIT > NPM_TEST_LIMIT && ITEM_LIMIT > STUB_RUNS * TIME_LIMIT, String(ITEM_LIMIT));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// What starts a process other than git, in `files` ([path, source] pairs):
// a function or constant declared at the top of a file whose own source
// starts one, or calls one that does, by name. A top-level declaration runs
// to the next one. Names are not told apart by file: a name one file
// declares to start a process counts in every file, which can only find too
// much, and the test below then fails. A function handed to another as an
// argument is beyond a scan like this.
const STARTS = /(?<![.\w$])(?:spawn|spawnSync|exec|execSync|execFile|execFileSync|fork)\(\s*(?!['"]git['"])/;
const CALLS = /(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
function processStarters(files) {
  const decls = files.flatMap(([, text]) => {
    const out = [];
    for (const line of text.split('\n')) {
      const m = line.match(/^(?:export )?(?:async )?(?:function\*?\s+([\w$]+)|(?:const|let)\s+([\w$]+)\s*=)/);
      if (m) out.push({ name: m[1] ?? m[2], src: '' });
      if (out.length) out.at(-1).src += `${line}\n`;
    }
    return out;
  });
  const starters = new Set();
  const starts = (src) => STARTS.test(src) || [...src.matchAll(CALLS)].some(([, name]) => starters.has(name));
  for (let grew = true; grew;) {
    grew = false;
    for (const d of decls) {
      if (!starters.has(d.name) && starts(d.src)) {
        starters.add(d.name);
        grew = true;
      }
    }
  }
  return { starts, starters };
}

// Every module under checks/ that a check can load: all but the tests.
function checkSources(dir = join(root, 'checks')) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'test' ? [] : checkSources(path);
    return e.name.endsWith('.mjs') ? [[path, readFileSync(path, 'utf8')]] : [];
  });
}

test('the scan for items that start a process follows helpers that call helpers, and leaves git out', () => {
  const { starts, starters } = processStarters([
    ['one.mjs', "import { spawnSync } from 'node:child_process';\nexport function runIt(dir) {\n  return spawnSync('bash', ['x'], { cwd: dir });\n}\nconst status = (dir) => execFileSync('git', ['status'], { cwd: dir });\n"],
    ['two.mjs', "import { runIt } from './one.mjs';\nexport const twice = (dir) => [runIt(dir), runIt(dir)];\n"],
    ['three.mjs', "import { twice } from './two.mjs';\nconst cache = new Map();\nexport function scenario(repo) {\n  return cache.get(repo) ?? twice(repo.dir);\n}\n"],
  ]);
  assert.deepEqual([...starters].sort(), ['runIt', 'scenario', 'twice']);
  assert.equal(starts('check(repo) { return scenario(repo).ok; }'), true, 'two helpers away');
  assert.equal(starts('check(repo) { return status(repo.dir) === ""; }'), false, 'git only');
  assert.equal(starts('check(repo) { return repo.scenario(); }'), false, 'a method of the same name is not the helper');
});

test('SLOW holds exactly the items that start a process, through a helper in checks/ too', () => {
  // Read from the code, so it holds where the reference solutions are absent.
  const files = checkSources();
  // The scan sees only calls by name: child_process comes in by named
  // imports alone, never a namespace, an alias or require.
  for (const [path, text] of files) {
    for (const m of text.matchAll(/import\s+([^;]*?)\s+from\s+['"](?:node:)?child_process['"]/g)) assert.match(m[1], /^\{\s*\w+(?:\s*,\s*\w+)*\s*,?\s*\}$/, path);
    assert.doesNotMatch(text, /\brequire\s*\(|\bimport\s*\(/, path);
  }
  const { starts, starters } = processStarters(files);
  // What a check is handed, a repository, starts only git: a call through
  // its methods would not show here.
  assert.ok(!starters.has('openRepo'), 'openRepo starts a process other than git');
  const found = Object.fromEntries(EVERY.map((id) => [id, lessons[id].items.flatMap((it, i) => (starts(it.check.toString()) ? [i] : []))]).filter(([, is]) => is.length));
  // runCommitted runs i-5's hook, runStubbed a-4's script, and testsPass is b-3's npm test.
  assert.deepEqual([found['i-5'], found['a-4'], found['b-3']], [[2], [1, 2, 3], [0, 1, 2, 4]]);
  assert.deepEqual(found, SLOW);
});

test('what r asked for goes with the next run of its lesson, and not with another lesson\'s', async () => {
  const runs = [];
  let release;
  const ask = owing(async (flags, lesson) => {
    runs.push([lesson, flags.slow, flags.asked]);
    await new Promise((r) => { release = r; });
  });
  const settle = () => new Promise((r) => setTimeout(r, 5));
  // A poll runs; r waits behind it, and a later poll of its lesson takes
  // its place: r's slow items and number stay.
  ask({}, 'i-5', null);
  ask({ slow: true, asked: 3 }, 'i-5', null);
  ask({}, 'i-5', null);
  release();
  await settle();
  // r waits again, and another lesson's run takes its place: that run is
  // not r's.
  ask({ slow: true, asked: 4 }, 'i-5', null);
  ask({}, 'b-3', [0]);
  release();
  await settle();
  release();
  await settle();
  assert.deepEqual(runs, [['i-5', false, 0], ['i-5', true, 3], ['b-3', false, 0]]);
});

test('children never take git\'s index lock or print color, and run one at a time', async () => {
  const env = childEnv({ NODE_TEST_CONTEXT: 'child', PATH: '/bin' });
  assert.equal(env.GIT_OPTIONAL_LOCKS, '0');
  assert.equal(env.NO_COLOR, '1');
  assert.equal(env.NODE_TEST_CONTEXT, undefined);
  let runs = 0;
  let release;
  const gate = new Promise((r) => { release = r; });
  const go = singleFlight(async () => {
    runs += 1;
    await gate;
  });
  go();
  go();
  go();
  go();
  release();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(runs, 2, 'a run, then exactly one more');
  const r = await runCheck(root, 'b-3', null);
  assert.equal(r.items.find((i) => i.index === 1).slow, true, 'the test run is left for r');
});

test('git status: a whole-tree look lists a new folder whole, a look at part of the tree lists each file, and the staged paths come from the index column', async () => {
  const dir = repo({ 'src/a.js': 'a\n', 'src/b.js': 'b\n', 'README.md': 'r\n' });
  try {
    commit(dir);
    const git = (...args) => execFileSync('git', args, { cwd: dir });
    write(dir, { 'src/a.js': 'a2\n', 'src/b.js': 'b2\n', 'README.md': 'r2\n', '.claude/skills/five-whys/SKILL.md': 's\n', 'notes.md': 'n\n', '.practice/learn.json': '{}' });
    // Staged, staged then changed again, renamed and staged; changed only.
    git('add', 'src/a.js', 'README.md');
    write(dir, { 'README.md': 'r3\n' });
    git('mv', 'src/b.js', 'src/c.js');
    const whole = await gitStatus(dir);
    assert.deepEqual([...whole.paths].sort(), ['.claude/', 'README.md', 'notes.md', 'src/a.js', 'src/c.js'].sort());
    assert.deepEqual(whole.paths, statusPaths(execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' })), 'the paths are the ones npm run check reads');
    // A rename lists both its names; it is staged by its new one.
    const each = await gitStatus(dir, { files: true });
    assert.deepEqual(each.paths.sort(), ['.claude/skills/five-whys/SKILL.md', 'README.md', 'notes.md', 'src/a.js', 'src/b.js', 'src/c.js'].sort());
    assert.deepEqual(each.staged.sort(), ['README.md', 'src/a.js', 'src/c.js']);
    // The work tree changed and nothing added: nothing staged.
    git('reset', '-q');
    assert.deepEqual((await gitStatus(dir, { files: true })).staged, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('git status on part of the tree: a work folder inside a repository sees only its own paths, named from there, and a file moved out of a folder is a change there', async () => {
  const top = repo({ 'proj/secrets/old.txt': 'o\n', 'proj/README.md': 'r\n' });
  try {
    commit(top, 'start');
    const git = (...args) => execFileSync('git', args, { cwd: top });
    write(top, { 'proj/secrets/key.txt': 'k\n', 'proj/src/a.js': 'a\n', 'other/o.txt': 'o\n' });
    git('mv', 'proj/secrets/old.txt', 'proj/old.txt');
    const proj = join(top, 'proj');
    assert.equal((await probeFolder(proj)).git, true, 'a folder inside a repository is a work folder');
    const r = await gitStatus(proj, { files: true });
    assert.deepEqual([...r.paths].sort(), ['old.txt', 'secrets/key.txt', 'secrets/old.txt', 'src/a.js']);
    assert.deepEqual(r.staged, ['old.txt']);
    assert.deepEqual(listedUnder(r.paths, ['secrets/']).sort(), ['secrets/key.txt', 'secrets/old.txt'], 'git-clean secrets/ is not done');
    assert.equal(judgeGit({ kind: 'git-changed', path: 'src/' }, r).pass, true);
    // Staged and committed, only the move is left; it is still under secrets/.
    commit(top, 'more', ['proj/secrets', 'proj/src', 'other']);
    git('mv', 'proj/secrets/key.txt', 'proj/key.txt');
    const moved = await gitStatus(proj, { files: true });
    assert.deepEqual([...moved.paths].sort(), ['key.txt', 'secrets/key.txt']);
    assert.equal(judgeGit({ kind: 'git-changed', path: 'secrets/' }, moved).pass, true);
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test('the watcher arms a .practice folder made after it started', async () => {
  // Events only speed things up: they can lag or never come (WSL on
  // /mnt/c, network folders), so main.mjs also polls. What must hold is that
  // a change re-arms the watcher on the new folder.
  const dir = repo();
  const w = watchDirs(dir, () => {}, { debounceMs: 20 });
  try {
    assert.ok(!w.dirs().some((d) => d.endsWith('.practice')));
    mkdirSync(join(dir, '.practice'));
    w.arm();
    assert.ok(w.dirs().some((d) => d.endsWith('.practice')), 'the new folder is watched');
  } finally {
    w.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the watcher watches .claude/ and the folders right in it, when they exist, and arms ones made later', async () => {
  const dir = repo({ '.claude/skills/five-whys/SKILL.md': 's\n', '.claude/settings.json': '{}\n' });
  const w = watchDirs(dir, () => {}, { debounceMs: 20 });
  const rel = () => w.dirs().map((d) => d.slice(dir.length + 1)).filter(Boolean).sort();
  try {
    assert.deepEqual(rel(), ['.claude', '.claude/skills', '.git'], 'a folder deeper in, and a file, are not watched');
    mkdirSync(join(dir, '.claude', 'agents'));
    w.arm();
    assert.deepEqual(rel(), ['.claude', '.claude/agents', '.claude/skills', '.git']);
  } finally {
    w.close();
    rmSync(dir, { recursive: true, force: true });
  }
  // A .claude/ made after the watcher started.
  const later = repo();
  const v = watchDirs(later, () => {}, { debounceMs: 20 });
  try {
    assert.ok(!v.dirs().some((d) => d.endsWith('.claude')));
    mkdirSync(join(later, '.claude', 'skills'), { recursive: true });
    v.arm();
    assert.ok(v.dirs().some((d) => d.endsWith('.claude')) && v.dirs().some((d) => d.endsWith(join('.claude', 'skills'))), `${v.dirs()}`);
  } finally {
    v.close();
    rmSync(later, { recursive: true, force: true });
  }
});

test('saved state: round trip, nothing written before .practice/ exists, junk ignored', () => {
  withRepo(() => repo(), (dir) => {
    const data = sanitize({ welcomed: true, eased: ['status'], lessons: { 'b-1': { step: 'W3', beat: 0, done: ['W1'], answers: { 'W4.0': 'x' } } } });
    assert.equal(saveState(dir, data), false);
    assert.equal(existsSync(join(dir, '.practice')), false, 'the app never creates .practice/');
    mkdirSync(join(dir, '.practice'));
    assert.equal(saveState(dir, data), true);
    assert.deepEqual(loadState(dir), data);
    assert.deepEqual(readdirSync(join(dir, '.practice')), ['learn.json'], 'no temp file left');
    writeFileSync(storePath(dir), '{nope');
    assert.equal(loadState(dir), null);
    writeFileSync(storePath(dir), JSON.stringify({ format: 99 }));
    assert.equal(loadState(dir), null, 'a newer format starts fresh');
    const clean = sanitize({ welcomed: 'yes', lessons: { 'b-1': { step: 3, done: [1, 'W1'], evil: true }, '../x': {} }, extra: 1 });
    assert.deepEqual(Object.keys(clean.lessons), ['b-1']);
    assert.equal(clean.welcomed, false);
    assert.equal(clean.lessons['b-1'].step, null);
    assert.deepEqual(clean.lessons['b-1'].done, ['W1']);
    assert.equal(clean.lessons['b-1'].evil, undefined);
  });
});

test('saved state: recalled keeps only warm-up ids, and an old file loads with none', () => {
  const data = sanitize({ lessons: { 'b-3': { recalled: ['R1', 'W1', 'R', 3, 'R12', '../R2', null] } } });
  assert.deepEqual(data.lessons['b-3'].recalled, ['R1', 'R12']);
  assert.deepEqual(sanitize({ lessons: { 'b-3': { recalled: 'R1' } } }).lessons['b-3'].recalled, []);
  withRepo(() => repo(), (dir) => {
    mkdirSync(join(dir, '.practice'));
    // Written before `recalled` existed.
    writeFileSync(storePath(dir), JSON.stringify({ format: 1, welcomed: true, lessons: { 'b-3': { step: 'R1', beat: 0, warm: ['R1', 'R2'], done: [] } } }));
    assert.deepEqual(loadState(dir).lessons['b-3'].recalled, []);
    const saved = sanitize({ lessons: { 'b-3': { warm: ['R1', 'R2'], recalled: ['R1'] } } });
    assert.equal(saveState(dir, saved), true);
    assert.deepEqual(loadState(dir).lessons['b-3'].recalled, ['R1'], 'it survives a save and a load');
  });
});

test('saved state: moreHelpAt keeps a step id, an old keepGuided maps to the saved step, anything else drops', () => {
  const one = (p) => sanitize({ lessons: { 'b-1': p } }).lessons['b-1'];
  assert.equal(one({ keepGuided: true, step: 'Y1' }).moreHelpAt, 'Y1');
  assert.equal(one({ keepGuided: true, step: 'Y1' }).keepGuided, undefined, 'keepGuided is not saved again');
  assert.equal(one({ moreHelpAt: 'Y3', step: 'Y4' }).moreHelpAt, 'Y3');
  assert.equal(one({ moreHelpAt: 'C' }).moreHelpAt, 'C');
  for (const bad of [true, 3, 'y1', '../Y1', 'Y1 ', '', null]) assert.equal(one({ moreHelpAt: bad }).moreHelpAt, null, String(bad));
  assert.equal(one({ keepGuided: true }).moreHelpAt, null, 'no saved step, nothing to map to');
  assert.equal(one({ keepGuided: true, step: '../x' }).moreHelpAt, null);
  assert.equal(one({ keepGuided: 'yes', step: 'Y1' }).moreHelpAt, null);
  assert.equal(one({ keepGuided: false, step: 'Y1' }).moreHelpAt, null);
  assert.equal(one({}).moreHelpAt, null);
});

test('without a terminal it prints the path as plain text and exits 0', () => {
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const r = spawnSync(process.execPath, [join(root, 'learn', 'app.mjs')], { input: '', encoding: 'utf8', env });
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /\x1b/);
  // A title's code spans print as plain text: a-4's "with `claude -p`".
  for (const id of EVERY) assert.ok(r.stdout.includes(lessons[id].title.replaceAll('`', '')), id);
});

// The full runs keep calm full frames whatever CI's environment holds, so
// lastFrame() can split on a bare CSI H.
const CALM_ENV = { ...process.env, CODESPACES: '', LEARN_CALM: '1', NO_COLOR: '', LEARN_PLAIN: '', TERM: 'xterm-256color' };

// A terminal the test can type into and read from. Its stdout keeps every
// write in `writes`, replays it into a 90x30 screen model (or `cols` by
// `rows`), and can be made to back up (fakeOut's `full` and `drain()`). It
// reports `depth` colors.
function fakeTerminal({ depth = 8, cols = 90, rows = 30 } = {}) {
  const stdin = new PassThrough();
  Object.assign(stdin, { isTTY: true, isRaw: false });
  stdin.setRawMode = (on) => Object.assign(stdin, { isRaw: on });
  const model = screenModel(cols, rows);
  const stdout = fakeOut({ columns: cols, rows });
  const write = stdout.write;
  stdout.write = (chunk) => {
    model.feed(String(chunk));
    return write(chunk);
  };
  stdout.getColorDepth = () => depth;
  const lastFrame = () => strip(stdout.writes.join('').split('\x1b[H').at(-1) ?? '');
  // What the terminal shows, whatever kind of frames drew it.
  const shows = () => model.lines().join('\n');
  return { stdin, stdout, model, lastFrame, shows, writes: stdout.writes, type: (s) => stdin.write(s) };
}
const until = async (fn, ms = 8_000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
};

// These terminal mechanics tests deliberately use stable synthetic lessons.
// Live reworked content has its own complete reducer/render walk.
function reducerRepo() {
  const dir = exportHead(root);
  for (const id of ['b-1', 'b-2', 'b-3', 'b-4', 'b-5', 'b-capstone']) {
    write(dir, { [`learn/lessons/${id}.md`]: readFileSync(join(root, 'checks/test/fixtures/reducer-course', `${id}.md`), 'utf8').replaceAll('- verify: check 0', id === 'b-1' ? '- verify: check 1' : '- verify: check 0') });
  }
  return dir;
}

async function reducerCheck(dir, id, items, opts) {
  if (id !== 'b-1') return runCheck(dir, id, items, opts);
  const path = join(dir, '.practice/version.txt');
  const item = b1Item(existsSync(path) ? readFileSync(path, 'utf8') : null);
  return { items: [{ index: 0, text: 'synthetic prerequisite', pass: true, hint: '' }, { ...item, index: 1 }] };
}

test('a full run on a fake terminal: writing version.txt turns step 3 done, and only learn.json is added', async () => {
  const dir = reducerRepo();
  // The solutions branch commits its .practice/ files; start from none.
  rmSync(join(dir, '.practice'), { recursive: true, force: true });
  const outside = () => statusPaths(execFileSync('git', ['status', '--porcelain', '--ignored', '--untracked-files=all'], { cwd: dir, encoding: 'utf8' }));
  const before = outside();
  const term = fakeTerminal();
  let exited = null;
  main({ argv: [], stdin: term.stdin, stdout: term.stdout, env: CALM_ENV, platform: 'linux', root: dir, runCheck: reducerCheck, exit: (code) => { exited = code; } });
  try {
    assert.ok(await until(() => term.lastFrame().includes("Let's learn Claude Code")), term.lastFrame());
    term.type('\r');
    assert.ok(await until(() => term.lastFrame().includes("You'll be able to")));
    term.type('\r');
    assert.ok(await until(() => term.lastFrame().includes('step 1 of 12')));
    term.type(' ');
    assert.ok(await until(() => term.lastFrame().includes('step 2 of 12')));
    term.type('1');
    term.type('\r');
    assert.ok(await until(() => term.lastFrame().includes('Watching .practice/version.txt')), term.lastFrame());
    mkdirSync(join(dir, '.practice'));
    writeFileSync(join(dir, '.practice', 'version.txt'), '2.1.285 (Claude Code)\n');
    assert.ok(await until(() => term.lastFrame().includes('Step 3 done!')), term.lastFrame());
    assert.match(term.lastFrame(), /DONE/);
    term.type('q');
    assert.ok(await until(() => exited === 0));
    assert.ok(existsSync(join(dir, '.practice', 'learn.json')));
    assert.deepEqual(outside(), before, 'the app changed something outside .practice/');
    assert.deepEqual(readdirSync(join(dir, '.practice')).sort(), ['learn.json', 'version.txt']);
  } finally {
    if (exited === null) term.type('\x03');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('main sends each key with how far the check-only card scrolls in the window, so up moves the card at once after down went past the end', async () => {
  const dir = reducerRepo();
  // a-capstone shown through its check: a card taller than the window.
  rmSync(join(dir, 'learn/lessons/a-capstone.md'));
  const term = fakeTerminal();
  let exited = null;
  main({ argv: [], stdin: term.stdin, stdout: term.stdout, env: CALM_ENV, platform: 'linux', root: dir, runCheck: reducerCheck, exit: (code) => { exited = code; } });
  const shown = () => term.lastFrame().match(/Items (\d+) to (\d+) of 17/);
  try {
    assert.ok(await until(() => term.lastFrame().includes("Let's learn Claude Code")), term.lastFrame());
    term.type('\r');
    assert.ok(await until(() => term.lastFrame().includes("You'll be able to")));
    term.type('m');
    assert.ok(await until(() => term.lastFrame().includes('Beginner path')), term.lastFrame());
    // Right to Advanced, up round to its capstone, and open it.
    term.type('\x1b[C');
    term.type('\x1b[C');
    term.type('\x1b[A');
    term.type('\r');
    assert.ok(await until(() => shown()?.[1] === '1'), term.lastFrame());
    for (let i = 0; i < 20; i++) term.type('\x1b[B');
    assert.ok(await until(() => shown()?.[2] === '17'), term.lastFrame());
    const end = Number(shown()[1]);
    term.type('\x1b[A');
    assert.ok(await until(() => Number(shown()?.[1]) === end - 1), term.lastFrame());
    term.type('q');
    assert.ok(await until(() => exited === 0));
  } finally {
    if (exited === null) term.type('\x03');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('main sends each key with how far your card scrolls in the window, so up leaves the Commands by level link at once after down went past the end', async () => {
  const dir = reducerRepo();
  rmSync(join(dir, '.practice'), { recursive: true, force: true });
  mkdirSync(join(dir, '.practice'));
  // Every Beginner lesson finished: a card taller than 60x20.
  const capstone = course.find((l) => l.id === 'b-capstone');
  writeFileSync(storePath(dir), JSON.stringify({ format: 1, welcomed: true, lessons: { ...finishedBefore('b-capstone'), 'b-capstone': finished(capstone) } }));
  const term = fakeTerminal({ cols: 60, rows: 20 });
  let exited = null;
  main({ argv: [], stdin: term.stdin, stdout: term.stdout, env: CALM_ENV, platform: 'linux', root: dir, runCheck: reducerCheck, exit: (code) => { exited = code; } });
  const lines = () => term.model.lines().map((l) => l.trim());
  const linked = () => lines().join('').includes('https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/blob/main/docs/reference/commands.md');
  try {
    assert.ok(await until(() => term.lastFrame().trim() !== ''), term.shows());
    term.type('c');
    assert.ok(await until(() => lines().includes('Your card')), term.shows());
    assert.ok(!linked(), `the card opens above its link at 60x20\n${term.shows()}`);
    for (let i = 0; i < 40; i++) term.type('\x1b[B');
    assert.ok(await until(() => linked()), term.shows());
    term.type('\x1b[A');
    assert.ok(await until(() => !linked()), `one up leaves the link\n${term.shows()}`);
    assert.ok(lines().includes('Your card'), term.shows());
    term.type('c');
    assert.ok(await until(() => !lines().includes('Your card')), term.shows());
    term.type('q');
    assert.ok(await until(() => exited === 0));
  } finally {
    if (exited === null) term.type('\x03');
    rmSync(dir, { recursive: true, force: true });
  }
});

// With motion, whatever CI's environment holds.
const MOTION_ENV = { ...CALM_ENV, LEARN_CALM: '' };

// main() on a fake terminal and a fake clock: every timer main sets waits for
// the test to move the clock. The check and git children are real, and so is
// the watcher unless `watch` replaces it. Each write's time is in `times`;
// with `writeMs` set, every write takes that long on the clock. `askGit`
// replaces git's first answers at start: [git's error or null, a first name].
// `signals` stands in for the process's signals, and `runCheck` for the
// check child. `saved` is the state file the app finds at start, and
// `depth`, `cols` and `rows` the terminal's colors and size. The clock reads
// `from` at start. `slots` counts the times main measures Pip's slot. With
// `lateMs` set, every timeout main sets fires that late, as a busy event
// loop's can, or with `lates`, each in turn as late as the next of those;
// with `earlyMs`, a wait of 1 ms or more fires that early, as Node's can
// against performance.now(). With `stopped`, no timeout fires at all, and
// with `ticks: false` the app's 1 s tick and its poll never run.
function clockedRun(env, { watch, askGit, signals, runCheck, saved, depth, cols, rows, from, ticks = true } = {}) {
  const dir = reducerRepo();
  rmSync(join(dir, '.practice'), { recursive: true, force: true });
  if (saved) {
    mkdirSync(join(dir, '.practice'));
    writeFileSync(storePath(dir), JSON.stringify(saved));
  }
  const term = fakeTerminal({ depth, cols, rows });
  const clock = fakeClock(from);
  const app = { dir, term, clock, exited: null, times: [], writeMs: 0, lateMs: 0, lates: null, earlyMs: 0, stopped: false, slots: 0 };
  let fired = 0;
  const lateness = () => (app.lates ? app.lates[fired++ % app.lates.length] : app.lateMs);
  // The wall clock steps by `ms`, as a wall clock can, and the monotonic one
  // (perf) does not. Step it only between clock.advance calls: settle and
  // until read Date.now.
  const realNow = Date.now;
  let wallBy = 0;
  app.wall = (ms) => {
    wallBy += ms;
    Date.now = () => realNow() + wallBy;
  };
  const write = term.stdout.write;
  term.stdout.write = (chunk) => {
    app.times.push(clock.now());
    clock.spend(app.writeMs);
    return write(chunk);
  };
  // When each frame from write `from` on went out.
  app.frameTimes = (from = 0) => app.times.slice(from).filter((_, i) => term.writes[from + i].startsWith('\x1b[?2026h'));
  main({ argv: [], stdin: term.stdin, stdout: term.stdout, env, platform: 'linux', root: dir, perf: clock.now, timers: { ...clock, ...(ticks ? {} : { setInterval: () => 0 }), setTimeout: (fn, ms) => (app.stopped ? 0 : clock.setTimeout(() => { clock.spend(lateness()); fn(); }, ms >= 1 ? ms - app.earlyMs : ms)) }, pipSlot: (...a) => ((app.slots += 1), pipSlot(...a)), watch, askGit, signals, runCheck: runCheck ?? reducerCheck, exit: (code) => { app.exited = code; } });
  // Until fn() holds, moving the clock 40 ms at a time while the children run.
  app.settle = async (fn, ms = 8_000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (fn()) return true;
      await clock.advance(40);
      await new Promise((r) => setTimeout(r, 10));
    }
    return false;
  };
  // The frame timers waiting: main's only timeouts in these runs (no letter
  // is waiting for its 300 ms, no Escape for its 50 ms).
  app.frameTimers = () => clock.pending().filter((x) => x.every === null);
  // Type, then let the clock run until the screen shows `text`.
  app.press = async (keys, text) => {
    term.type(keys);
    assert.ok(await app.settle(() => term.shows().includes(text)), `after ${JSON.stringify(keys)}, no ${text}:\n${term.shows()}`);
  };
  // From the welcome to step 3, which waits for .practice/version.txt.
  app.toWaiting = async () => {
    await app.press('\r', "You'll be able to");
    await app.press('\r', 'step 1 of 12');
    await app.press(' ', 'step 2 of 12');
    await app.press('1', 'step 2 of 12');
    await app.press('\r', 'Watching .practice/version.txt');
  };
  app.close = () => {
    Date.now = realNow;
    if (app.exited === null) term.type('\x03');
    rmSync(dir, { recursive: true, force: true });
  };
  return app;
}
// Git's first answers at start, given when the test says.
const slowGit = () => {
  const git = { asked: 0 };
  git.ask = () => {
    git.asked += 1;
    return new Promise((resolve) => { git.answer = resolve; });
  };
  return git;
};
const ENTERS = (writes) => writes.join('').split('\x1b[?1049h').length - 1;

// The 9x4 Pip's boot: a 16-color terminal, which has no detailed Pip, or a
// truecolor one at 90x30, where the welcome after it has none (174).
test('boot: when git takes over 150 ms at start, the screen opens with Pip waking, "Asking git about this folder…" and the spinner, until the welcome replaces it', async () => {
  for (const depth of [4, 24]) {
    const git = slowGit();
    const app = clockedRun(MOTION_ENV, { askGit: git.ask, depth });
    const { term, clock } = app;
    try {
      assert.equal(git.asked, 1);
      await clock.advance(159);
      assert.deepEqual(term.writes, [], 'nothing is drawn, and the screen is not opened, before git has run 160 ms');
      await clock.advance(1);
      assert.equal(ENTERS(term.writes), 1);
      assert.match(term.shows(), /│ {2}─‿─ {2}│ {3}Asking git about this folder… ⠋/, '+160 ms: Pip\'s eyes shut, the spinner starts');
      await clock.advance(80);
      assert.match(term.shows(), /│ {2}◒‿◒ {2}│ {3}Asking git about this folder… ⠙/, '+240 ms: waking');
      await clock.advance(80);
      assert.match(term.shows(), /│ {2}●‿● {2}│ {3}Asking git about this folder… ⠹/, '+320 ms: awake');
      git.answer([null, 'Sam']);
      await turn();
      await clock.advance(40);
      assert.match(term.shows(), /Hi Sam! Let's learn Claude Code/);
      assert.doesNotMatch(term.shows(), /Asking git/);
      assert.equal(ENTERS(term.writes), 1, 'the same screen goes on');
      // The boot's frame timer is gone with it: the welcome draws alone.
      const n = term.writes.length;
      await clock.advance(2_000);
      assert.ok(term.writes.slice(n).every((w) => !w.includes('Asking git')));
    } finally {
      app.close();
    }
  }
});

test('boot: when git answers within 150 ms, nothing extra is drawn: the first frame is the welcome', async () => {
  const git = slowGit();
  const app = clockedRun(MOTION_ENV, { askGit: git.ask });
  const { term, clock } = app;
  try {
    await clock.advance(140);
    git.answer([null, 'Sam']);
    await turn();
    assert.equal(ENTERS(term.writes), 1);
    const frames = term.writes.filter((w) => w.startsWith('\x1b[?2026h'));
    assert.match(strip(frames[0]), /Hi Sam! Let's learn Claude Code/, 'the first frame');
    await clock.advance(2_000);
    assert.ok(term.writes.every((w) => !w.includes('Asking git')), 'no boot frame, then or later');
  } finally {
    app.close();
  }
});

test('boot: with motion off, the boot frame shows its words still, with Pip awake and no spinner, and asks for no other frame', async () => {
  const git = slowGit();
  const app = clockedRun(CALM_ENV, { askGit: git.ask, depth: 4 });
  const { term, clock } = app;
  try {
    await clock.advance(160);
    assert.match(term.shows(), /│ {2}●‿● {2}│ {3}Asking git about this folder…\n/);
    const n = term.writes.length;
    assert.deepEqual(app.frameTimers(), []);
    await clock.advance(5_000);
    assert.equal(term.writes.length, n, 'nothing moves while git works');
    git.answer([null, 'Sam']);
    await turn();
    assert.match(term.shows(), /Hi Sam! Let's learn Claude Code/);
  } finally {
    app.close();
  }
});

test('boot: keys typed while git answers are not echoed and are dropped, so an Enter does not skip the welcome; q does not quit', async () => {
  const git = slowGit();
  const app = clockedRun(CALM_ENV, { askGit: git.ask });
  const { term, clock } = app;
  try {
    assert.equal(term.stdin.isRaw, true, 'raw before any frame: the terminal echoes nothing');
    await clock.advance(100);
    term.type('\r');
    await clock.advance(60);
    assert.match(term.shows(), /Asking git about this folder…/);
    term.type('q\r');
    await turn();
    assert.equal(app.exited, null);
    git.answer([null, 'Sam']);
    await turn();
    await clock.advance(1_000);
    assert.equal(term.stdin.isRaw, true);
    assert.match(term.shows(), /Hi Sam! Let's learn Claude Code/, 'the welcome stays up');
    await app.press('\r', "You'll be able to");
  } finally {
    app.close();
  }
});

test('boot: Ctrl+C during the boot frame leaves the screen once and exits 0, and git\'s answer then draws nothing', async () => {
  const git = slowGit();
  const app = clockedRun(MOTION_ENV, { askGit: git.ask });
  const { term, clock } = app;
  try {
    await clock.advance(200);
    assert.match(term.shows(), /Asking git about this folder…/);
    term.type('\x03');
    await turn();
    assert.equal(app.exited, 0);
    assert.equal(term.stdin.isRaw, false);
    const all = term.writes.join('');
    assert.equal(all.split(LEAVE).length, 2, 'left once');
    assert.ok(all.endsWith(`${LEAVE}\n`), 'no goodbye line: nothing was saved');
    const n = term.writes.length;
    git.answer([null, 'Sam']);
    await turn();
    await clock.advance(1_000);
    assert.equal(term.writes.length, n, 'no welcome, no frame');
    assert.deepEqual(clock.pending(), [], 'no timer left');
  } finally {
    app.close();
  }
});

test('boot: a signal before any screen writes only a newline and exits 0; one during the boot frame leaves the screen', async () => {
  for (const [ms, shown] of [[100, false], [200, true]]) {
    const git = slowGit();
    const signals = new EventEmitter();
    const app = clockedRun(CALM_ENV, { askGit: git.ask, signals });
    const { term, clock } = app;
    try {
      await clock.advance(ms);
      signals.emit('SIGINT');
      assert.equal(app.exited, 0);
      assert.deepEqual(term.writes.join('').split(ENTER).length - 1, shown ? 1 : 0);
      assert.equal(term.writes.join(''), shown ? `${term.writes.join('').split(LEAVE)[0]}${LEAVE}\n` : '\n');
      git.answer([null, 'Sam']);
      await turn();
      await clock.advance(1_000);
      assert.doesNotMatch(term.writes.join(''), /Hi Sam/);
    } finally {
      app.close();
    }
  }
});

test('boot: a resize during the boot frame clears the screen and draws it again at the new size, with motion off too', async () => {
  const git = slowGit();
  const app = clockedRun(CALM_ENV, { askGit: git.ask });
  const { term, clock } = app;
  try {
    Object.assign(term.stdout, { columns: 70, rows: 22 });
    term.stdout.emit('resize');
    await turn();
    assert.deepEqual(term.writes, [], 'no screen yet: nothing to wipe');
    await clock.advance(160);
    for (const [cols, rows] of [[60, 20], [80, 24]]) {
      await clock.advance(1_000);
      const n = term.writes.length;
      Object.assign(term.stdout, { columns: cols, rows });
      term.stdout.emit('resize');
      await turn();
      assert.equal(term.writes.length - n, 1, `${cols}x${rows}: one write`);
      assert.ok(term.writes.at(-1).startsWith('\x1b[?2026h\x1b[2J\x1b[H'), 'cleared and drawn whole');
      const shown = term.model.lines();
      assert.ok(shown.slice(0, rows).every((l) => width(l) <= cols - 1), shown.join('\n'));
      assert.deepEqual(shown.slice(rows), Array(30 - rows).fill(''), 'nothing left below the frame');
      assert.match(shown.join('\n'), /Asking git about this folder…/);
    }
    git.answer([null, 'Sam']);
    await turn();
    await clock.advance(40);
    assert.match(term.shows(), /Hi Sam! Let's learn Claude Code/);
  } finally {
    app.close();
  }
});

test('draws: one frame for the events of one turn, a key within one frame, and never two frames under 40 ms apart', async () => {
  const app = clockedRun(MOTION_ENV);
  const { term, clock } = app;
  try {
    assert.ok(await app.settle(() => term.shows().includes("Let's learn Claude Code")), term.shows());
    // Past Pip's greeting (176): no frame waits when the keys come.
    await clock.advance(TIMING.greet + 1_000);
    let n = term.writes.length;
    term.type('\r\r');
    await turn();
    assert.equal(term.writes.length - n, 1, 'two keys in one read, the intro and then step 1: one frame');
    assert.match(term.shows(), /step 1 of 12/);
    n = term.writes.length;
    term.type(' ');
    await turn();
    assert.equal(term.writes.length - n, 0, 'the frame before went out 0 ms ago');
    await clock.advance(39);
    assert.equal(term.writes.length - n, 0, '39 ms after it');
    await clock.advance(1);
    assert.ok(term.writes.length - n >= 1, '40 ms after it');
    assert.match(term.shows(), /step 2 of 12/);
  } finally {
    app.close();
  }
});

// Every gap between frames, in ms.
const gaps = (times) => times.slice(1).map((t, i) => t - times[i]);

test('draws: a frame that goes out on drain counts for the 40 ms floor', async () => {
  const app = clockedRun(CALM_ENV);
  const { term, clock } = app;
  try {
    assert.ok(await until(() => term.shows().includes("Let's learn Claude Code")), term.shows());
    await clock.advance(1_000);
    const from = term.writes.length;
    term.stdout.full = true;
    term.type('\r');
    await turn();
    assert.equal(term.writes.length - from, 1, 'the intro, and its write comes back false');
    await clock.advance(45);
    term.type('\r');
    await turn();
    assert.equal(term.writes.length - from, 1, 'step 1 is kept for the drain');
    await clock.advance(10);
    term.stdout.drain();
    assert.equal(term.writes.length - from, 2, 'step 1 goes out on the drain');
    term.type(' ');
    await turn();
    assert.equal(term.writes.length - from, 2, 'the drain wrote 0 ms ago');
    await clock.advance(200);
    assert.match(term.shows(), /step 2 of 12/);
    const times = app.frameTimes(from);
    assert.ok(gaps(times).every((g) => g >= 40), `frames at ${times.map((t) => t - times[0])} ms`);
  } finally {
    app.close();
  }
});

test('draws: a watcher burst and the dispatch it queues from a microtask make one frame', async () => {
  let changed = null;
  const watch = (_root, onChange) => {
    changed = onChange;
    return { close() {} };
  };
  const app = clockedRun(CALM_ENV, { watch });
  const { dir, term, clock } = app;
  try {
    assert.ok(await until(() => term.shows().includes("Let's learn Claude Code")), term.shows());
    await app.toWaiting();
    await clock.advance(1_000);
    // Any check the polls started is over.
    await new Promise((r) => setTimeout(r, 500));
    mkdirSync(join(dir, '.practice'));
    writeFileSync(join(dir, '.practice', 'version.txt'), '2.1.285 (Claude Code)\n');
    const n = term.writes.length;
    // The new folder, the activity, and the check it asks for again, whose
    // start is dispatched from a microtask, the way a file read is.
    changed();
    await turn();
    assert.equal(term.writes.length - n, 1, 'one frame');
    assert.deepEqual(app.frameTimers(), [], 'and no second one waiting for the floor');
    assert.match(term.shows(), /mkdir -p \.practice +✔/, 'it shows the new folder');
    assert.ok(await app.settle(() => term.shows().includes('Step 3 done!')), term.shows());
  } finally {
    app.close();
  }
});

test('a watcher change in the app\'s first 400 ms counts: on a clock that starts at 0, as performance.now() does, a .practice/ made 100 ms in is seen, and step 3 ticks it', async () => {
  let changed = null;
  const watch = (_root, onChange) => {
    changed = onChange;
    return { close() {} };
  };
  const app = clockedRun(CALM_ENV, { watch, askGit: async () => [null, 'Sam'], from: 0 });
  const { dir, term, clock } = app;
  try {
    assert.ok(await until(() => term.shows().includes("Let's learn Claude Code")), term.shows());
    await clock.advance(100 - clock.now());
    mkdirSync(join(dir, '.practice'));
    changed();
    await app.toWaiting();
    assert.match(term.shows(), /mkdir -p \.practice +✔/, 'the new folder was seen');
  } finally {
    app.close();
  }
});

test('r: the card says what it checks until r\'s own result lands, even when polls ask again while r\'s run waits', async () => {
  let changed = null;
  const watch = (_root, onChange) => {
    changed = onChange;
    return { close() {} };
  };
  const fake = heldCheck();
  const app = clockedRun(CALM_ENV, { watch, runCheck: fake.run });
  const { term, clock } = app;
  try {
    assert.ok(await until(() => term.shows().includes("Let's learn Claude Code")), term.shows());
    await app.toWaiting();
    await clock.advance(1_000);
    await new Promise((r) => setTimeout(r, 500));
    // A poll's run starts; r's run waits behind it, and a second poll asks
    // again before r's run starts.
    fake.held = true;
    changed();
    assert.ok(await app.settle(() => fake.runs.length === 1), 'the poll is held');
    term.type('r');
    await clock.advance(DEFER_MS + 30);
    assert.match(term.shows(), /Checking \.practice\/version\.txt…/);
    changed();
    fake.runs[0].end();
    assert.ok(await app.settle(() => fake.runs.length === 2), 'r starts after the poll');
    assert.match(term.shows(), /Checking \.practice\/version\.txt…/, 'the old poll result cannot finish r');
    assert.equal(fake.runs[1].slow, true, 'the queued request retains r\'s slow flag');
    fake.held = false;
    fake.runs[1].end();
    assert.ok(await app.settle(() => term.shows().includes('Not yet')), `r's result never ended the wait:\n${term.shows()}`);
    assert.doesNotMatch(term.shows(), /Checking/);
  } finally {
    app.close();
  }
});

// A check child the test answers: it holds a run while `held` is set, so the
// test can send the run's reports, then its result.
const heldCheck = () => {
  const fake = { held: false, runs: [] };
  const missing = (lesson, items) => ({ items: (items ?? lessons[lesson].items.map((_, i) => i)).map((index) => ({ index, text: lessons[lesson].items[index].text, pass: false, hint: 'not there yet' })) });
  fake.run = (_root, lesson, items, opts) => {
    if (!fake.held) return Promise.resolve(missing(lesson, items));
    return new Promise((resolve) => fake.runs.push({ lesson, ...opts, end: () => resolve(missing(lesson, items)) }));
  };
  return fake;
};
const FRAMES = (writes) => writes.filter((w) => w.startsWith('\x1b[?2026h'));

// Plain mode draws ASCII, so its ellipsis is three dots.
for (const [mode, env, dots] of [['calm', CALM_ENV, '…'], ['plain', { ...CALM_ENV, LEARN_CALM: '', LEARN_PLAIN: '1' }, '...']]) {
  test(`check item progress, ${mode}: each report from r's run rewrites the checking row once, as "Checking item n of m…"`, async () => {
    const fake = heldCheck();
    const app = clockedRun(env, { runCheck: fake.run });
    const { term, clock } = app;
    try {
      assert.ok(await until(() => term.shows().includes("Let's learn Claude Code")), term.shows());
      await app.toWaiting();
      fake.held = true;
      await app.press('r', 'Checking .practice/version.txt');
      const [run] = fake.runs;
      assert.equal(run.slow, true, 'r\'s own run');
      for (const n of [1, 2]) {
        const from = term.writes.length;
        run.onRunning(n, 2);
        assert.ok(await app.settle(() => term.shows().includes(`Checking item ${n} of 2${dots}`)), term.shows());
        await clock.advance(3_000);
        await new Promise((r) => setTimeout(r, 20));
        const frames = FRAMES(term.writes.slice(from));
        assert.equal(frames.length, 1, `report ${n}: one frame, then nothing for 3 s`);
        assert.ok(strip(frames[0]).includes(`Checking item ${n} of 2${dots}`), `report ${n}: that frame has the row`);
        assert.deepEqual(app.frameTimers(), [], 'no frame timer');
      }
      run.end();
      assert.ok(await app.settle(() => !term.shows().includes('Checking')), term.shows());
    } finally {
      app.close();
    }
  });
}

test('check item progress: a beat\'s opening run reports through main() as well, as the run of the items it was asked for', async () => {
  const fake = heldCheck();
  const app = clockedRun(CALM_ENV, { runCheck: fake.run });
  const { term } = app;
  try {
    assert.ok(await until(() => term.shows().includes("Let's learn Claude Code")), term.shows());
    await app.press('\r', "You'll be able to");
    await app.press('\r', 'step 1 of 12');
    await app.press(' ', 'step 2 of 12');
    await app.press('1', 'step 2 of 12');
    fake.held = true;
    await app.press('\r', 'Checking .practice/version.txt');
    assert.ok(await app.settle(() => fake.runs.length > 0));
    const [run] = fake.runs;
    assert.equal(run.slow, false, 'the opening run, not r\'s');
    // Step 3 checks one item; this fake child says it runs two, so the
    // count shows.
    run.onRunning(1, 2);
    assert.ok(await app.settle(() => term.shows().includes('Checking item 1 of 2…')), term.shows());
    run.end();
    assert.ok(await app.settle(() => term.shows().includes('Watching .practice/version.txt')), term.shows());
  } finally {
    app.close();
  }
});

test('resize: one full frame that clears the screen, at the new size', async () => {
  const app = clockedRun(CALM_ENV);
  const { term, clock } = app;
  try {
    assert.ok(await until(() => term.shows().includes("Let's learn Claude Code")), term.shows());
    await clock.advance(1_000);
    for (const [cols, rows] of [[60, 20], [60, 20], [80, 24]]) {
      const n = term.writes.length;
      Object.assign(term.stdout, { columns: cols, rows });
      term.stdout.emit('resize');
      await turn();
      assert.equal(term.writes.length - n, 1, `${cols}x${rows}: one write, even at the same size`);
      const w = term.writes.at(-1);
      assert.ok(w.startsWith('\x1b[?2026h\x1b[2J\x1b[H'), 'cleared and drawn whole, in one synchronized write');
      assert.equal(w.split('\x1b[2J').length, 2, 'cleared once');
      const shown = term.model.lines();
      assert.ok(shown.slice(0, rows).every((l) => width(l) <= cols - 1), shown.join('\n'));
      assert.deepEqual(shown.slice(rows), Array(30 - rows).fill(''), 'nothing left below the frame');
      assert.match(shown.join('\n'), /Let's learn Claude Code/);
      await clock.advance(1_000);
    }
    term.type('\r');
    await turn();
    assert.doesNotMatch(term.writes.at(-1), /\x1b\[2J/, 'the next frame clears nothing');
  } finally {
    app.close();
  }
});

// The frame's box (191): 40 rows at most, centered in a taller window, so
// at 120x60 it is rows 11 to 50 (1-based), its key bar on row 50.
test('a tall window: the box is drawn centered, a resize redraws it centered, and the 40 ms frames rewrite only changed rows inside it, the blank rows around it only in a full frame', async () => {
  const app = clockedRun(MOTION_ENV, { cols: 120, rows: 60, watch: () => ({ close() {} }) });
  const { term, clock } = app;
  const boxed = (where, header = /LEARN/) => {
    const shown = term.model.lines();
    assert.deepEqual([...shown.slice(0, 10), ...shown.slice(50)].filter(Boolean), [], `${where}: blank around the box\n${shown.join('\n')}`);
    assert.match(shown[11], header, `${where}: the header on the box's second row\n${shown.join('\n')}`);
    assert.match(shown[49], /q quit/, `${where}: the key bar on the box's last row\n${shown.join('\n')}`);
  };
  try {
    assert.ok(await until(() => term.shows().includes("Let's learn Claude Code")), term.shows());
    boxed('the welcome');
    for (const [cols, rows] of [[80, 24], [120, 60]]) {
      await clock.advance(1_000);
      const n = term.writes.length;
      Object.assign(term.stdout, { columns: cols, rows });
      term.stdout.emit('resize');
      // With motion, the redraw waits for the 40 ms floor.
      await clock.advance(TIMING.grid);
      const wiped = term.writes.slice(n).filter((w) => w.includes('\x1b[2J'));
      assert.equal(wiped.length, 1, `${cols}x${rows}: one frame clears the screen`);
      assert.ok(wiped[0].startsWith('\x1b[?2026h\x1b[2J\x1b[H'), `${cols}x${rows}: cleared and drawn whole`);
      if (rows === 24) assert.match(term.model.lines()[23], /q quit/, 'at 80x24 the key bar is the last row, as before');
    }
    boxed('resized back');
    await app.toWaiting();
    boxed('step 3', /B1/);
    // Step 3 watching its file, from 25 s after it opened (as the 189 test
    // above) for 12 s: looks, Pip's blinks and the 10 s repair frame.
    const run = async (ms) => {
      for (let k = 0; k < ms / 200; k++) {
        await clock.advance(200);
        await new Promise((r) => setTimeout(r, 1));
      }
    };
    await run(25_000);
    const from = term.writes.length;
    await run(12_000);
    const frames = term.writes.slice(from).filter((w) => w.startsWith('\x1b[?2026h'));
    const full = frames.filter((w) => w.includes('\x1b[H'));
    const rowFrames = frames.filter((w) => !w.includes('\x1b[H'));
    assert.ok(full.length >= 1 && rowFrames.length >= 3, `${full.length} full frames, ${rowFrames.length} row frames`);
    for (const w of full) assert.equal(w.split('\r\n').length, 60, 'a full frame writes every row, the blank ones around the box included');
    const rows = rowFrames.flatMap((w) => [...w.matchAll(/\x1b\[(\d+);1H/g)].map((m) => Number(m[1])));
    assert.ok(rows.length && rows.every((r) => r >= 11 && r <= 50), `rows rewritten: ${[...new Set(rows)]}`);
    assert.ok(rowFrames.every((w) => w.match(/\x1b\[\d+;1H/g).length <= 2), 'each 40 ms frame rewrites a row or two');
    boxed('after the frames', /B1/);
  } finally {
    app.close();
  }
});

test('draws: when slow writes stop motion, the rest frame is asked for at once', async () => {
  const app = clockedRun(MOTION_ENV);
  const { term, clock } = app;
  try {
    assert.ok(await until(() => term.shows().includes("Let's learn Claude Code")), term.shows());
    // Past Pip's greeting (176): no frame waits when the keys come.
    await clock.advance(TIMING.greet + 1_000);
    app.writeMs = 13;
    const n = term.writes.length;
    for (const [i, key] of ['\r', '\r', ' '].entries()) {
      if (i) await clock.advance(40);
      term.type(key);
      await turn();
      assert.equal(term.writes.length - n, i + 1, `slow frame ${i + 1}`);
    }
    // The third slow frame turned motion off; nothing moves under calm, so
    // only the rest frame waits.
    const rest = app.frameTimers();
    assert.equal(rest.length, 1, 'the rest frame');
    assert.ok(rest[0].ms <= 40, String(rest[0].ms));
    await clock.advance(40);
    assert.deepEqual(app.frameTimers(), [], 'and after it, none');
  } finally {
    app.close();
  }
});

test('no leaking timers: a frame timer only while something will change; none in calm, with an overlay, at idle, after one-shots end, or after q', async () => {
  const app = clockedRun(MOTION_ENV);
  const { term, clock } = app;
  try {
    assert.ok(await until(() => term.shows().includes("Let's learn Claude Code")), term.shows());
    const first = app.frameTimers();
    assert.equal(first.length, 1, 'the welcome plays: one frame timer');
    // The welcome's frames change every 80 ms: the timer is due at the next.
    assert.ok(first[0].ms > 0 && first[0].ms <= SHOTS.welcome.every, `due at the welcome's next frame, not in ${first[0].ms} ms`);
    term.type('?');
    await clock.advance(400);
    assert.match(term.shows(), /Keys/, 'the ? overlay');
    assert.deepEqual(app.frameTimers(), [], 'an overlay');
    await clock.advance(1_000);
    assert.deepEqual(app.frameTimers(), [], 'an overlay, a second later');
    await app.press('?', "Let's learn Claude Code");
    await app.toWaiting();
    assert.equal(app.frameTimers().length, 1, 'the card enters: one frame timer');
    await clock.advance(200);
    const grace = app.frameTimers();
    assert.equal(grace.length, 1, 'the entrance is over, and the reading grace still runs: its end is a deadline');
    assert.ok(grace[0].ms > 1_000, `on its own timer, not the next 1 s tick (${grace[0].ms} ms)`);
    // W3 watches its file: from here its look marker moves only when a poll's
    // result lands, so no frame timer waits for it, before a look or after
    // one. One waits for Pip's next blink or look to the side (189).
    const pipNext = (why) => {
      const timers = app.frameTimers();
      assert.equal(timers.length, 1, why);
      assert.ok(timers[0].ms > 0 && timers[0].ms <= TIMING.blinkEvery, `${why}: in ${timers[0].ms} ms`);
    };
    await clock.advance(21_000);
    pipNext('the entrance and the reading grace are over');
    const pulse = () => term.shows().split('\n').at(-2) ?? '';
    assert.ok(await app.settle(() => pulse().includes('━━━')), `the marker:\n${term.shows()}`);
    pipNext('the marker shows, and waits for the next look');
    await clock.advance(IDLE_MS);
    assert.deepEqual(app.frameTimers(), [], 'idle');
    await afterQ(app);
  } finally {
    app.close();
  }
});

test('a still card blinks on one frame timer once the gates open, and has none at idle', async () => {
  const app = clockedRun(MOTION_ENV);
  const { term, clock } = app;
  try {
    assert.ok(await until(() => term.shows().includes("Let's learn Claude Code")), term.shows());
    await app.press('\r', "You'll be able to");
    await app.press('\r', 'step 1 of 12');
    assert.doesNotMatch(term.shows(), /Watching/, 'step 1 watches nothing');
    await clock.advance(21_000);
    const blink = app.frameTimers();
    assert.equal(blink.length, 1, 'the next blink, or its end');
    assert.ok(blink[0].ms > 0 && blink[0].ms <= 6_000, String(blink[0].ms));
    // Its frames come and go, one timer at a time.
    await clock.advance(6_000);
    assert.equal(app.frameTimers().length, 1);
    await clock.advance(IDLE_MS);
    assert.deepEqual(app.frameTimers(), [], 'idle');
    await afterQ(app);
  } finally {
    app.close();
  }
});

// What Pip's life on a card that watches costs on the wire (189, design
// 4.7): step 3, which watches .practice/version.txt, from 25 s after it
// opened, each 5 s for 40 s, at 80x24 and 120x40, and at 120x60, where
// the frame's 40-row box (191) adds only the blank rows around it to the
// full frames. Its file is read every 2 s and the marker steps on each
// look; between, Pip blinks every 6 s and looks to one side every 18 s, a
// one-row frame where its face changes. The ceiling is about 1.3 times the
// most measured, as for the detailed Pip (181); the 10 s repair frame is
// in it.
const WATCHED_CEILING = 11_000;
test('a card that watches: Pip\'s blinks and looks to the side add only one-row frames where its face changes, and the bytes per 5 s stay under a ceiling', async () => {
  for (const [cols, rows] of [[80, 24], [120, 40], [120, 60]]) {
    const app = clockedRun(MOTION_ENV, { cols, rows, watch: () => ({ close() {} }) });
    const { term, clock } = app;
    const inWindow = (from, to) => term.writes.filter((_, i) => app.times[i] >= from && app.times[i] < to);
    try {
      assert.ok(await until(() => term.shows().includes("Let's learn Claude Code")), term.shows());
      await app.toWaiting();
      const opened = clock.now();
      // The clock in steps, with a moment for each file read to land.
      const run = async (ms, step = 200) => {
        for (let k = 0; k < ms / step; k++) {
          await clock.advance(step);
          await new Promise((r) => setTimeout(r, 1));
        }
      };
      await run(25_000);
      const top = () => term.shows().split('\n').find((l) => l.includes('╭─')) ?? '';
      const faces = new Set();
      const windows = [];
      for (let k = 0; k < 8; k++) {
        const from = opened + 25_000 + k * 5_000;
        for (let n = 0; n < 5_000 / TIMING.grid; n++) {
          await run(TIMING.grid, TIMING.grid);
          faces.add(top().match(/(\S+) ──$/)?.[1]);
        }
        const writes = inWindow(from, from + 5_000);
        windows.push({ bytes: writes.reduce((n, w) => n + Buffer.byteLength(w), 0), frames: writes.length });
      }
      const where = `${cols}x${rows}: ${JSON.stringify(windows)}`;
      // Pip lives: shut eyes and a look each way showed in the 40 s.
      for (const face of ['[─‿─]', '[◑‿◑]', '[◐‿◐]']) assert.ok(faces.has(face), `${where}: no ${face} in ${[...faces]}`);
      // At most 3 looks at the file, a blink's 4 frames and a look's 2 in
      // any 5 s, and the 10 s repair frame.
      for (const w of windows) assert.ok(w.bytes > 0 && w.bytes <= WATCHED_CEILING && w.frames <= 10, where);
    } finally {
      app.close();
    }
  }
});

// q while a frame timer runs (after a key, the end of the 4 s key quiet is
// one): the app quits, and no timer of any kind is left.
async function afterQ(app) {
  const { term, clock } = app;
  term.type('\x1b[A');
  await turn();
  assert.equal(app.frameTimers().length, 1, 'a frame timer runs when q comes');
  term.type('q');
  await clock.advance(400);
  assert.equal(app.exited, 0);
  assert.deepEqual(clock.pending(), [], 'after q, no timer of any kind');
}

test('calm: no frame timer, and nothing is written for 3 s on a waiting card', async () => {
  const app = clockedRun(CALM_ENV);
  const { term, clock } = app;
  try {
    assert.ok(await until(() => term.shows().includes("Let's learn Claude Code")), term.shows());
    assert.deepEqual(app.frameTimers(), [], 'the welcome, still');
    await app.toWaiting();
    await clock.advance(40);
    assert.deepEqual(app.frameTimers(), [], 'the card, still');
    const n = term.writes.length;
    await clock.advance(3_000);
    assert.equal(term.writes.length, n, 'nothing written');
  } finally {
    app.close();
  }
});

// The detailed Pip (170) on the resume screen, which moves nothing of its
// own: a frame timer there is Pip's. At 90x30 it has room for the raster,
// in truecolor only (174).
const RESUME = { format: 1, welcomed: true, lessons: { 'b-1': { step: 'Y3', beat: 0, done: ['W1'] } } };
const RASTER = /[▀▄]/;
const toResume = async (app) => assert.ok(await app.settle(() => app.term.shows().includes('Welcome back')), app.term.shows());

test('the detailed Pip on main\'s one timer: a raster screen asks for Pip\'s frames while it turns, an overlay stops them, resume gives it no ambient life (its y/n neither), and a 16- or 256-color terminal\'s 9x4 Pip adds none once its greeting is over', async () => {
  const app = clockedRun(MOTION_ENV, { saved: RESUME, depth: 24 });
  const { term, clock } = app;
  try {
    await toResume(app);
    assert.match(term.shows(), RASTER);
    // Pip turns from working (git, at start) to ready: frames every 40 ms.
    const turning = app.frameTimers();
    assert.equal(turning.length, 1, 'one frame timer');
    assert.ok(turning[0].ms > 0 && turning[0].ms <= 40, String(turning[0].ms));
    // An overlay mid-turn: no Pip, no frames.
    term.type('?');
    await clock.advance(400);
    assert.match(term.shows(), /Keys/, 'the ? overlay');
    assert.doesNotMatch(term.shows(), RASTER, 'no Pip under an overlay');
    assert.deepEqual(app.frameTimers(), [], 'an overlay');
    await app.press('?', 'Welcome back');
    // Resume has no ambient loop of the app's, so Pip has no blinks or
    // glances there, its reading grace over or not.
    await clock.advance(5_000);
    assert.deepEqual(app.frameTimers(), [], 'resume, settled');
    await app.press('x', 'Start this lesson over?');
    assert.match(term.shows(), RASTER);
    await clock.advance(10_000);
    assert.deepEqual(app.frameTimers(), [], 'beside the y/n');
    term.type('n');
    await clock.advance(400);
    assert.doesNotMatch(term.shows(), /Start this lesson over\?/);
    // Idle, and the app's 1 s tick has drawn the frame where it stops.
    await clock.advance(IDLE_MS + 1_000);
    assert.deepEqual(app.frameTimers(), [], 'idle');
    assert.match(term.shows(), RASTER, 'Pip still there, at rest');
  } finally {
    app.close();
  }
  // The first look's result comes at once here. The 9x4 Pip greets for
  // 5 s from the screen's arrival (176), then holds still.
  for (const depth of [4, 8]) {
    const glyph = clockedRun(MOTION_ENV, { saved: RESUME, depth, runCheck: async () => ({ items: [] }) });
    try {
      await toResume(glyph);
      assert.doesNotMatch(glyph.term.shows(), RASTER, `depth ${depth}`);
      await glyph.clock.advance(glyph.frameTimes()[0] + TIMING.greet - glyph.clock.now());
      assert.deepEqual(glyph.frameTimers(), [], `depth ${depth}: the 9x4 Pip, still`);
      await glyph.clock.advance(5_000);
      assert.deepEqual(glyph.frameTimers(), [], `depth ${depth}: and later`);
    } finally {
      glyph.close();
    }
  }
});

// Pip's greeting (176) on resume, which moves nothing else: from the
// screen's arrival, the detailed Pip's frames come every 40 ms until 5 s
// after it arrived, and the 9x4 Pip's exactly at the moments its face
// changes (181), each a new frame, the last before the 5 s; then none. Git
// and the first look answer at once.
test('the greeting on main\'s one timer: the detailed Pip asks for a frame every 40 ms until 5 s after the screen arrived, the 9x4 Pip only at the moments its face changes, each a new frame; then none; a resize, during it or after, plays nothing again', async () => {
  const moments = faceMoments(greetFace('resume'), TIMING.greet);
  for (const depth of [24, 8]) {
    const app = clockedRun(MOTION_ENV, { saved: RESUME, depth, askGit: quickGit, runCheck: async () => ({ items: [] }) });
    const { term, clock } = app;
    try {
      await toResume(app);
      assert.equal(RASTER.test(term.shows()), depth === 24, `depth ${depth}`);
      const arrived = app.frameTimes()[0];
      const ends = arrived + (depth === 24 ? TIMING.greet : moments.at(-1));
      const fired = [];
      let resized = false;
      while (clock.now() < ends) {
        const timers = app.frameTimers();
        assert.equal(timers.length, 1, `depth ${depth}: one frame timer at +${clock.now() - arrived} ms`);
        assert.ok(timers[0].ms > 0 && (depth === 8 || timers[0].ms <= TIMING.grid), `depth ${depth}: next frame in ${timers[0].ms} ms at +${clock.now() - arrived} ms`);
        // At 2 s a resize, between two frames: it draws its own, and the
        // timer waits for the same next frame.
        if (!resized && clock.now() + timers[0].ms > arrived + 2_000) {
          await clock.advance(arrived + 2_000 - clock.now());
          term.stdout.emit('resize');
          resized = true;
          await turn();
          continue;
        }
        const shown = term.shows();
        await clock.advance(timers[0].ms);
        fired.push(clock.now() - arrived);
        if (depth === 8) assert.notEqual(term.shows(), shown, `depth 8: a new frame at +${clock.now() - arrived} ms`);
      }
      if (depth === 8) assert.deepEqual(fired, moments, 'depth 8: a frame at each moment Pip\'s face changes, and no other');
      assert.equal(clock.now(), ends, `depth ${depth}: a frame at the greeting's ${depth === 24 ? 'end' : 'last change'}`);
      assert.deepEqual(app.frameTimers(), [], `depth ${depth}: none after it`);
      const still = term.shows();
      term.stdout.emit('resize');
      await clock.advance(40);
      assert.equal(term.shows(), still, `depth ${depth}: a resize draws the rest frame again`);
      assert.deepEqual(app.frameTimers(), [], `depth ${depth}: and asks for no frame`);
    } finally {
      app.close();
    }
  }
});

// Any key ends the greeting at once: main asks for no more of its frames.
// The detailed Pip eases out of it (181): one frame timer, 40 ms at most,
// until 320 ms after the key, then none, and its rows are the ones it rests
// on once the 5 s are over. The 9x4 Pip has no ease: none from the key's
// frame. Resume's x shows its y/n only once the letter acts, after the ease.
test('a key ends the greeting on main\'s one timer: the detailed Pip eases to rest on 40 ms frames for 320 ms, the 9x4 Pip from the frame the key draws; then no frame timer waits, and Pip is at rest, beside resume\'s y/n too', async () => {
  for (const [depth, keys] of [[24, '\x1b[A'], [8, '\x1b[A'], [24, 'x']]) {
    // No watcher: the real one reports the app's own save at whatever time
    // the fake clock reads when it lands, a frame this test does not ask.
    const app = clockedRun(MOTION_ENV, { saved: RESUME, depth, askGit: quickGit, runCheck: async () => ({ items: [] }), watch: () => ({ close() {} }) });
    const { term, clock } = app;
    const why = `depth ${depth}, ${JSON.stringify(keys)}`;
    try {
      await toResume(app);
      const arrived = app.frameTimes()[0];
      await clock.advance(arrived + 1_000 - clock.now());
      assert.equal(app.frameTimers().length, 1, `${why}: the greeting plays`);
      // Up, which resume does not act on; or x, which asks to start over.
      term.type(keys);
      await turn();
      const pressed = clock.now();
      if (keys === 'x') {
        assert.ok(await app.settle(() => term.shows().includes('Start this lesson over?')), term.shows());
      } else if (depth === 24) {
        const eased = pipRows(term);
        while (clock.now() < pressed + TIMING.pipFade) {
          const timers = app.frameTimers();
          assert.equal(timers.length, 1, `${why}: one frame timer at +${clock.now() - pressed} ms`);
          assert.ok(timers[0].ms > 0 && timers[0].ms <= TIMING.grid, `${why}: next frame in ${timers[0].ms} ms at +${clock.now() - pressed} ms`);
          await clock.advance(timers[0].ms);
        }
        assert.equal(clock.now(), pressed + TIMING.pipFade, `${why}: a frame as the ease ends`);
        assert.notEqual(pipRows(term), eased, `${why}: Pip eased`);
      } else {
        await clock.advance(40);
      }
      assert.deepEqual(app.frameTimers(), [], `${why}: no frame after the key's${depth === 24 ? ' ease' : ''}`);
      const after = term.shows();
      await clock.advance(arrived + TIMING.greet + 1_000 - clock.now());
      assert.deepEqual(app.frameTimers(), [], `${why}: nor later`);
      assert.equal(term.shows(), after, `${why}: the frame after it is the rest frame`);
    } finally {
      app.close();
    }
  }
});

// The welcome is the one big-Pip screen with ambient life (the app's own
// blink is there): at 120x40 it has room for the raster, and its reading
// grace ends 20 s after it appears.
const WELCOME = /Let's learn Claude Code/;
const toWelcome = async (app) => assert.ok(await app.settle(() => WELCOME.test(app.term.shows())), app.term.shows());

test('the detailed Pip breathes only on a local terminal: frames every 120 ms there; over SSH and in a Codespace it waits for its next blink or glance; q, Ctrl+C or SIGTERM leaves no timer', async () => {
  const cases = [['local', MOTION_ENV, true, 'q'], ['over SSH', { ...MOTION_ENV, SSH_TTY: '/dev/pts/3' }, false, '\x03'], ['in a Codespace', { ...MOTION_ENV, CODESPACES: 'true' }, false, 'SIGTERM']];
  for (const [why, env, breathes, quit] of cases) {
    const signals = new EventEmitter();
    const app = clockedRun(env, { depth: 24, signals, cols: 120, rows: 40 });
    try {
      await toWelcome(app);
      assert.match(app.term.shows(), RASTER, why);
      await app.clock.advance(TIMING.graceMax + 500);
      // Its next frame, sampled over two seconds of its lively 30 s.
      const waits = [];
      for (let k = 0; k < 8; k++) {
        const [next, ...more] = app.frameTimers();
        assert.equal(more.length, 0, why);
        waits.push(next?.ms ?? Infinity);
        await app.clock.advance(250);
      }
      assert.ok(breathes ? waits.every((ms) => ms <= 120) : waits.some((ms) => ms > 120), `${why}: ${waits.join(', ')} ms`);
      // With no breathing, the gate's opening has nothing to ease: 500 ms
      // after it, the timer waits for the glance.
      if (!breathes) assert.ok(waits[0] > 120, `${why}: ${waits[0]} ms 500 ms after the gate opened`);
      if (quit === 'SIGTERM') signals.emit(quit);
      else app.term.type(quit);
      await app.clock.advance(400);
      assert.equal(app.exited, 0, why);
      assert.deepEqual(app.clock.pending(), [], `${why}: no timer of any kind`);
      assert.ok(app.term.writes.join('').includes(LEAVE), `${why}: the screen is left`);
    } finally {
      app.close();
    }
  }
});

test('calm: the detailed Pip is drawn at rest, in its ready pose, as render draws it; no frame timer, nothing written', async () => {
  const app = clockedRun(CALM_ENV, { saved: RESUME, depth: 24 });
  const { term, clock } = app;
  try {
    await toResume(app);
    assert.match(term.shows(), RASTER);
    // The first look's result, a frame later.
    await clock.advance(1_000);
    assert.deepEqual(app.frameTimers(), []);
    const n = term.writes.length;
    await clock.advance(5_000);
    assert.equal(term.writes.length, n, 'nothing written');
    const t = theme(capabilities(term.stdout, CALM_ENV, 'linux', []));
    const resume = driver({ saved: RESUME }).state;
    const size = { cols: 90, rows: 30 };
    const rest = render(resume, size, t, REST, { size: pipSlot(resume, size, t), pose: restPose('ready') }).map((l) => strip(l).trimEnd());
    const pipRows = (lines) => lines.filter((l) => RASTER.test(l));
    assert.deepEqual(pipRows(term.model.lines()), pipRows(rest));
  } finally {
    app.close();
  }
});

test('boot, with room: the detailed Pip works beside "Asking git about this folder…" on the spinner\'s timer, at the size the next screen has it; calm, it is still', async () => {
  // Resume has room for standard Pip at 90x30.
  const cases = [[MOTION_ENV, true, RESUME, 'Welcome back'], [CALM_ENV, false, RESUME, 'Welcome back']];
  for (const [env, moves, saved, next] of cases) {
    const git = slowGit();
    const app = clockedRun(env, { askGit: git.ask, saved, depth: 24 });
    const { term, clock } = app;
    // The margin and Pip's lead space, then its cells, then 3.
    const beside = /^ {6}[ ▀▄]{32} {3}\S/;
    try {
      await clock.advance(400);
      const lines = term.model.lines();
      const at = lines.findIndex((l) => l.includes('Asking git about this folder…'));
      assert.match(lines[at], beside, lines.join('\n'));
      assert.ok(lines.slice(at - 9, at + 7).every((l) => RASTER.test(l) || l.trim() === ''), lines.join('\n'));
      const timers = app.frameTimers();
      if (moves) assert.ok(timers.length === 1 && timers[0].ms <= 80, JSON.stringify(timers));
      else assert.deepEqual(timers, []);
      git.answer([null, 'Sam']);
      await turn();
      await clock.advance(40);
      const after = term.model.lines();
      assert.match(after.find((l) => l.includes(next)) ?? '', beside, after.join('\n'));
    } finally {
      app.close();
    }
  }
});

test('a wall clock that steps back or forward changes no frame: the boot frame, the welcome, its greeting, its reading grace and its breathing are the same, and keys still act', async () => {
  // The same sitting twice: the second one's wall clock steps back a minute
  // while git answers, and forward two hours once the reading grace is over.
  const sitting = async (steps) => {
    const git = slowGit();
    const app = clockedRun(MOTION_ENV, { askGit: git.ask, cols: 120, rows: 40, depth: 24, watch: () => ({ close() {} }) });
    const { term, clock } = app;
    try {
      await clock.advance(400);
      assert.match(term.shows(), /Asking git/);
      assert.match(term.shows(), RASTER, 'the boot frame\'s Pip, working');
      if (steps) app.wall(-60_000);
      git.answer([null, 'Sam']);
      await turn();
      await toWelcome(app);
      await clock.advance(TIMING.graceMax + 1_000);
      if (steps) app.wall(2 * 3_600_000);
      await clock.advance(8_000);
      const writes = term.writes.map((w) => w.replaceAll(app.dir, '<copy>'));
      await app.press('\r', "You'll be able to");
      return writes;
    } finally {
      app.close();
    }
  };
  const still = await sitting(false);
  const stepped = await sitting(true);
  assert.ok(still.length > 200, `${still.length} writes`);
  assert.deepEqual(stepped, still);
});

// Pip's rows on the screen.
const pipRows = (term) => term.model.lines().filter((l) => RASTER.test(l)).join('\n');
// Moves the clock 40 ms at a time, for at most `ms`, until Pip's rows are
// not `rows`.
const untilPipMoves = async (app, rows, ms) => {
  for (let waited = 0; waited < ms; waited += 40) {
    if (pipRows(app.term) !== rows) return true;
    await app.clock.advance(40);
  }
  return false;
};

test('the wall clock is not the app\'s: one that steps back over two minutes while git answers leaves the welcome\'s Pip coming alive after its reading grace, its gates and its own time on the app\'s clock', async () => {
  const git = slowGit();
  const app = clockedRun(MOTION_ENV, { askGit: git.ask, cols: 120, rows: 40, depth: 24 });
  const { term, clock } = app;
  try {
    await clock.advance(400);
    assert.match(term.shows(), RASTER, 'the boot frame\'s Pip, working');
    app.wall(-(IDLE_MS + 10_000));
    git.answer([null, 'Sam']);
    await turn();
    await toWelcome(app);
    // Turned to ready, and still while the learner reads.
    await clock.advance(5_000);
    const still = pipRows(term);
    await clock.advance(TIMING.graceMax - 5_000 + 200);
    assert.ok(await untilPipMoves(app, still, 8_000), 'Pip blinks or glances');
  } finally {
    app.close();
  }
});

test('a resize while Pip blinks or glances leaves no fragment of the raster: the screen is the new frame alone', async () => {
  const app = clockedRun(MOTION_ENV, { cols: 140, rows: 45, depth: 24 });
  const { term, clock } = app;
  try {
    await toWelcome(app);
    // At rest while the learner reads; then, its reading grace over, caught
    // mid-move.
    await clock.advance(5_000);
    const still = pipRows(term);
    await clock.advance(TIMING.graceMax - 5_000 + 200);
    assert.ok(await untilPipMoves(app, still, 8_000), 'Pip blinks or glances');
    for (const [cols, rows] of [[130, 42], [120, 40], [140, 45]]) {
      const n = term.writes.length;
      Object.assign(term.stdout, { columns: cols, rows });
      term.stdout.emit('resize');
      await clock.advance(40);
      const from = term.writes.findIndex((w, k) => k >= n && w.includes('\x1b[2J'));
      assert.ok(from >= n, `${cols}x${rows}: the screen is cleared`);
      const alone = screenModel(140, 45);
      for (const w of term.writes.slice(from)) alone.feed(w);
      assert.deepEqual(term.model.lines(), alone.lines(), `${cols}x${rows}`);
      assert.match(term.shows(), RASTER, `${cols}x${rows}: Pip, whole`);
      await clock.advance(80);
    }
  } finally {
    app.close();
  }
});

// The welcome's words fill its reading grace, so its ambient gate opens 20 s
// after it appears (175). Git answers at once, so the welcome is the first
// frame.
const quickGit = async () => [null, 'Sam'];
const graceEnds = (app) => app.frameTimes()[0] + TIMING.graceMax;
// From `from`, the first moment, sampled every 250 ms up to `to`, when
// Pip's next frame is over 120 ms away: its breathing has stopped.
const breathingStops = async (app, from, to) => {
  await app.clock.advance(from - app.clock.now());
  for (; app.clock.now() < to; await app.clock.advance(250)) {
    const [next, ...more] = app.frameTimers();
    assert.equal(more.length, 0, 'one frame timer');
    if (!next || next.ms > 120) return app.clock.now();
  }
  return null;
};

// What the detailed Pip costs on the wire and in work (design 4.7): the
// welcome at 120x40 in truecolor, the 5 s of its greeting and each 5 s of
// its 30 s of breathing, under ceilings about 1.3 times what was measured
// (ticket 181). Its slot is measured once per state and size, not per frame.
const CEILING = { greet: 140_000, breathing: 60_000 };
test('the detailed Pip\'s bytes per 5 s stay under their ceilings while it greets and while it breathes, and its slot is measured once per state, not per frame', async () => {
  const app = clockedRun(MOTION_ENV, { askGit: quickGit, depth: 24, cols: 120, rows: 40, watch: () => ({ close() {} }) });
  const { term, clock } = app;
  const bytes = (from, to) => term.writes.reduce((n, w, i) => n + (app.times[i] >= from && app.times[i] < to ? Buffer.byteLength(w) : 0), 0);
  const frames = (from, to) => app.frameTimes().filter((at) => at >= from && at < to).length;
  try {
    await toWelcome(app);
    const arrived = app.frameTimes()[0];
    const opens = graceEnds(app);
    await clock.advance(arrived + TIMING.greet - clock.now());
    const greet = bytes(arrived, arrived + TIMING.greet);
    assert.ok(greet > 0 && greet <= CEILING.greet, `the greeting: ${greet} bytes`);
    await clock.advance(opens - clock.now());
    for (let k = 0; k < 6; k++) {
      const from = opens + k * 5_000;
      const slots = app.slots;
      await clock.advance(5_000);
      const b = bytes(from, from + 5_000);
      assert.ok(b > 0 && b <= CEILING.breathing, `breathing, ${k * 5} to ${k * 5 + 5} s: ${b} bytes`);
      // The app's 1 s tick is a new state each second.
      assert.ok(app.slots - slots <= 6 && frames(from, from + 5_000) >= 40, `breathing, ${k * 5} s: ${app.slots - slots} slots for ${frames(from, from + 5_000)} frames`);
    }
  } finally {
    app.close();
  }
});

// Render and write time and a late timer do not stretch Pip's frames: each
// next frame counts from the frame's own time, so with every write taking
// 8 ms and every timer firing 3 ms late, the frame timer still lands on the
// 40 ms grid from the moment Pip's gate opened, at most a breath (120 ms)
// after the last.
test('with every write taking 8 ms and every timer 3 ms late, each frame timer while the detailed Pip breathes lands on the 40 ms grid from its gate\'s opening, at most 120 ms after the last', async () => {
  const app = clockedRun(MOTION_ENV, { askGit: quickGit, depth: 24, cols: 120, rows: 40, watch: () => ({ close() {} }) });
  const { clock } = app;
  try {
    await toWelcome(app);
    const opens = graceEnds(app);
    app.writeMs = 8;
    app.lateMs = 3;
    await clock.advance(opens - clock.now());
    const off = [];
    const long = [];
    let n = 0;
    let last = opens;
    while (clock.now() < opens + 29_000) {
      const [next, ...more] = app.frameTimers();
      assert.equal(more.length, 0, 'one frame timer');
      if (!next) break;
      n += 1;
      const due = clock.now() + next.ms - opens;
      if (due % TIMING.grid !== 0) off.push(due);
      if (due - last > 120) long.push(`${last} to ${due}`);
      last = due;
      await clock.advance(next.ms);
    }
    assert.ok(n > 200, `${n} frame timers`);
    assert.deepEqual(off, []);
    assert.deepEqual(long, []);
  } finally {
    app.close();
  }
});

// A timer can fire a little before its deadline, and the frame it draws is
// for the deadline: a frame an event draws in between, at the clock's time,
// is for no earlier time than that one. So Pip, whose lively window started
// again at that frame's time as its ambient gate opened, never runs back.
test('with every timer 0.5 ms early, a key in the half millisecond before the welcome\'s ambient gate opens draws a frame, and Pip does not run back', async () => {
  const app = clockedRun({ ...MOTION_ENV, SSH_TTY: '/dev/pts/3' }, { askGit: quickGit, depth: 24, cols: 120, rows: 40, watch: () => ({ close() {} }) });
  const { term, clock } = app;
  try {
    await toWelcome(app);
    const opens = graceEnds(app);
    app.earlyMs = 0.5;
    await clock.advance(opens - 0.25 - clock.now());
    const n = term.writes.length;
    term.type('\x1b[B');
    await turn();
    await clock.advance(400);
    assert.ok(term.writes.length > n, 'the key\'s frame');
    assert.match(term.shows(), RASTER);
  } finally {
    app.close();
  }
});

// The floor counts from the screen's last write, so a frame cannot always
// go out on its step: with every timer 1 ms late and each render 0 to 4 ms
// long, a frame whose render is quicker than the last one's waits for the
// floor, a millisecond late too, and the next counts from it. No write can
// come back toward its step but by skipping one, so once the floor would
// hold a frame past halfway to the next step it skips to that step: the
// greeting's frames never creep off its 40 ms grid from the screen's
// arrival, none further than that half step, the timer's lateness and a
// render, and nine in ten of them still go out.
test('with every timer 1 ms late and renders of 0 to 4 ms, the detailed Pip\'s greeting frames go out 40 ms apart or more and never creep off the 40 ms grid: each within half a step, the lateness and a render of its own, nine in ten of them drawn', async () => {
  const renders = [0, 3, 1, 4, 0, 2, 4, 1, 3, 0, 2];
  const greeting = async (late, costs) => {
    const app = clockedRun(MOTION_ENV, { askGit: quickGit, depth: 24, cols: 120, rows: 40, watch: () => ({ close() {} }) });
    const { term, clock } = app;
    let k = 0;
    Object.defineProperty(term.stdout, 'columns', { get: () => (clock.spend(costs[k++ % costs.length]), 120) });
    try {
      app.lateMs = late;
      await toWelcome(app);
      const arrived = app.frameTimes()[0];
      await clock.advance(arrived + TIMING.greet - clock.now());
      return app.frameTimes().filter((at) => at < arrived + TIMING.greet).map((at) => at - arrived);
    } finally {
      app.close();
    }
  };
  const onTime = await greeting(0, [0]);
  const late = await greeting(1, renders);
  assert.ok(onTime.length > 100, `${onTime.length} frames on time`);
  assert.deepEqual(late.slice(1).filter((at, i) => at - late[i] < TIMING.grid), [], 'writes under 40 ms after the last');
  assert.deepEqual(late.filter((at) => at % TIMING.grid > TIMING.grid / 2 + 1 + Math.max(...renders)), [], 'writes off their step');
  assert.ok(late.length >= 0.9 * onTime.length, `${late.length} frames, ${onTime.length} on time`);
});

// The colors and glyphs each row of the screen shows after each frame, from
// the frames the app wrote: full ones and ones with only the rows that
// changed.
function shownAfter(writes) {
  let rows = [];
  return writes.filter((w) => w.startsWith('\x1b[?2026h')).map((w) => {
    if (w.includes('\x1b[H')) rows = w.slice(w.indexOf('\x1b[H') + 3, w.lastIndexOf('\x1b[J')).split('\r\n');
    else for (const [, row, line] of w.matchAll(/\x1b\[(\d+);1H(.*?)\x1b\[0m\x1b\[K/g)) rows[row - 1] = `${line}\x1b[0m\x1b[K`;
    return rows.join('\n');
  });
}
// The welcome's greeting at 120x40 in truecolor, with no 1 s tick, as
// `run(app, arrived)` drives it: the times the frames went out, from the
// screen's arrival, and what the screen showed after each, the copy's
// folder named the same in every sitting.
async function greetingFrames(run, setup = () => {}) {
  const app = clockedRun(MOTION_ENV, { askGit: quickGit, depth: 24, cols: 120, rows: 40, watch: () => ({ close() {} }), ticks: false });
  const { term, clock } = app;
  try {
    setup(app);
    await toWelcome(app);
    const arrived = app.frameTimes()[0];
    const from = term.writes.length;
    await run(app, arrived);
    await clock.advance(arrived + TIMING.greet - clock.now());
    const times = app.frameTimes(from).map((at) => at - arrived);
    return { times, shown: shownAfter(term.writes).slice(-times.length || Infinity).map((rows) => rows.replaceAll(app.dir, '<copy>')) };
  } finally {
    app.close();
  }
}
// The same sitting with no frame timer: a frame only where the test asks
// one, on a resize at each of `times` from the arrival, so each is drawn
// for the time it goes out. Down, which the welcome does not act on, at
// `keyAt`.
const DOWN = '\x1b[B';
const drawnAt = (times, keyAt = Infinity) => greetingFrames(async (app, arrived) => {
  for (const ms of [...times, Infinity]) {
    if (keyAt <= ms && keyAt < Infinity) {
      await app.clock.advance(arrived + keyAt - app.clock.now());
      app.term.type(DOWN);
      await turn();
      keyAt = Infinity;
    }
    if (ms === Infinity) break;
    await app.clock.advance(arrived + ms - app.clock.now());
    app.term.stdout.emit('resize');
    await turn();
  }
}, (app) => { app.stopped = true; });

// Timers that fire unevenly late, 0 and 15 ms in turn: the floor still
// counts from the last write, so no two frames go out under 40 ms apart,
// and the frames after a late one never creep off the grid: none further
// than half a step and the lateness from its step. A frame waiting for the
// floor waits as late, so fewer go out, three in five or more. A frame the
// floor holds is drawn for the moment it goes out: each shows what a frame
// drawn then, and only then, shows.
test('with timers 0 and 15 ms late in turn, the detailed Pip\'s greeting frames go out 40 ms apart or more, never creep off the 40 ms grid, and each shows Pip as at the moment it goes out', async () => {
  const late = await greetingFrames(async () => {}, (app) => { app.lates = [0, 15]; });
  const onTime = await greetingFrames(async () => {});
  assert.deepEqual(late.times.slice(1).filter((at, i) => at - late.times[i] < TIMING.grid), [], 'writes under 40 ms after the last');
  assert.deepEqual(late.times.filter((at) => at % TIMING.grid > TIMING.grid / 2 + 15), [], 'writes off their step');
  assert.ok(late.times.length >= 0.6 * onTime.times.length, `${late.times.length} frames, ${onTime.times.length} on time`);
  const drawn = await drawnAt(late.times);
  assert.deepEqual(drawn.times, late.times);
  late.times.forEach((ms, i) => assert.equal(late.shown[i], drawn.shown[i], `the frame at +${ms} ms`));
});

// A frame timer that fires 2 s late, as the drain of a write the terminal
// held goes out: the deadline it was for is far behind the floor, which
// skips it to the first step past half of the floor in one timer, not one
// timer a step that draws nothing.
test('a frame timer 2 s late as a held write drains: the floor skips its deadline in one timer, and the frames after go out 40 ms apart', async () => {
  let zero = null;
  const run = await greetingFrames(async (app, arrived) => {
    const { clock, term } = app;
    await clock.advance(arrived + 1_000 - clock.now());
    term.stdout.full = true;
    await clock.advance(120);
    const spend = clock.spend;
    clock.spend = (ms) => {
      spend(ms);
      if (ms !== 2_000) return;
      app.lateMs = 0;
      term.stdout.full = false;
      term.stdout.drain();
    };
    const set = clock.setTimeout;
    zero = 0;
    clock.setTimeout = (fn, ms) => {
      if (ms === 0) zero += 1;
      return set(fn, ms);
    };
    app.lateMs = 2_000;
    await clock.advance(200);
    assert.equal(app.lateMs, 0, 'the late timer fired');
  });
  assert.equal(zero, 0, 'timers with no wait');
  assert.deepEqual(run.times.slice(1).filter((at, i) => at - run.times[i] < TIMING.grid), [], 'writes under 40 ms after the last');
  assert.ok(run.times.some((ms) => ms > 3_200), 'the greeting goes on');
});

// A key between two of the greeting's frames ends it, and Pip eases out of
// it (181) on the frames the greeting had on screen: the key's own frame
// waits for the floor, at the next step, and each of the ease's after it
// is on the same 40 ms grid from the arrival, drawn for the moment it goes
// out.
test('a key 10 to 39 ms after a greeting frame: the detailed Pip eases out on the greeting\'s own 40 ms grid, each frame drawn for the moment it goes out', async () => {
  for (const after of [10, 17, 39]) {
    const keyed = await greetingFrames(async (app, arrived) => {
      await app.clock.advance(arrived + 1_000 + after - app.clock.now());
      app.term.type(DOWN);
      await turn();
    });
    const eased = keyed.times.filter((ms) => ms > 1_000);
    assert.ok(eased.length >= TIMING.pipFade / TIMING.grid, `+${after} ms: ${eased.join(', ')}`);
    assert.deepEqual(eased.filter((ms) => ms % TIMING.grid !== 0), [], `+${after} ms: frames off the greeting's grid`);
    const drawn = await drawnAt(keyed.times, 1_000 + after);
    assert.deepEqual(drawn.times, keyed.times);
    keyed.times.forEach((ms, i) => assert.equal(keyed.shown[i], drawn.shown[i], `+${after} ms: the frame at +${ms} ms`));
  }
});

// The detailed Pip's frames are its own: the 9x4 Pip it replaces asks for
// none (181). Past Pip's lively window only its sparse rest blinks move it,
// so every frame drawn then, but the 1 s tick's, writes: none is drawn for
// the 9x4 Pip's blink every 6 s, which the screen does not show.
test('past its 30 s of life the welcome\'s detailed Pip draws a frame only to write it, or on the 1 s tick: none for the 9x4 Pip\'s blinks', async () => {
  const app = clockedRun(MOTION_ENV, { askGit: quickGit, depth: 24, cols: 120, rows: 40, watch: () => ({ close() {} }) });
  const { term, clock } = app;
  // Each draw reads the window's width once.
  const draws = [];
  Object.defineProperty(term.stdout, 'columns', { get: () => (draws.push(clock.now()), 120) });
  try {
    await toWelcome(app);
    const opens = graceEnds(app);
    const [from, to] = [opens + 31_000, opens + 61_000];
    await clock.advance(to - clock.now());
    const ticks = (at) => (at - app.frameTimes()[0]) % 1_000 === 0;
    const drawn = draws.filter((at) => at >= from && at < to && !ticks(at));
    assert.ok(drawn.length >= 8, `the rest blinks' frames: ${drawn.length}`);
    assert.deepEqual(drawn.filter((at) => !app.times.includes(at)).map((at) => at - opens), [], 'frames that wrote nothing');
    assert.match(term.shows(), RASTER);
  } finally {
    app.close();
  }
});

test('the welcome\'s detailed Pip asks for no frame while the learner reads, then breathes for 30 s from the moment its reading grace ends, and glances about 2.6 s and blinks about 4.2 s after it', async () => {
  const app = clockedRun(MOTION_ENV, { askGit: quickGit, depth: 24, cols: 120, rows: 40 });
  const { term, clock } = app;
  try {
    await toWelcome(app);
    const opens = graceEnds(app);
    // As the welcome arrives Pip turns to ready, and its antenna sways: the
    // package's frames, every 40 ms for its 900 ms; and it greets for 5 s
    // (176). From then until the grace ends, the one frame timer waits for
    // that moment, and Pip holds still (the screen's own full refresh every
    // 10 s draws it the same).
    const settled = app.frameTimes()[0] + Math.max(MOTION.antenna + MOTION.frame, TIMING.greet);
    await clock.advance(Math.max(0, settled - clock.now()));
    const still = pipRows(term);
    for (; clock.now() < opens; await clock.advance(Math.min(1_000, opens - clock.now()))) {
      assert.deepEqual(app.frameTimers().map((x) => x.ms), [opens - clock.now()], `${clock.now() - opens} ms from the grace's end`);
      assert.equal(pipRows(term), still, `Pip still, ${clock.now() - opens} ms from the grace's end`);
    }
    const n = term.writes.length;
    const stops = await breathingStops(app, opens, opens + 35_000);
    assert.ok(stops !== null && stops - opens >= 29_000 && stops - opens <= 31_000, `breathing stops ${stops === null ? 'never' : `${stops - opens} ms`} after the grace ends`);
    // Breathing draws every 120 ms; a glance or a blink every 40 ms. The
    // frames that start three such quick frames in a row, from a second
    // after the opening (the app's own blink at the opening is over by then;
    // the screen's own draws come one at a time).
    const frames = app.frameTimes(n).map((at) => at - opens);
    const quick = frames.filter((at, k) => at >= 1_000 && at <= 5_000 && frames[k + 2] - at <= 2 * MOTION.frame);
    assert.ok(quick[0] >= 2_600 && quick[0] <= 2_680, `the glance, 40 ms frames from ${quick[0]} ms after the grace ends`);
    assert.ok(quick.some((at) => at >= 4_200 && at < 4_400), `a blink after 4.2 s: ${quick.join(', ')}`);
  } finally {
    app.close();
  }
});

// Over SSH Pip does not breathe, so its rows change only for a glance, a
// blink or a twitch.
test('the welcome\'s detailed Pip holds its pose as its reading grace ends, then glances about 2.6 s and blinks about 4.2 s after that moment', async () => {
  const app = clockedRun({ ...MOTION_ENV, SSH_TTY: '/dev/pts/3' }, { askGit: quickGit, depth: 24, cols: 120, rows: 40 });
  const { term, clock } = app;
  try {
    await toWelcome(app);
    const opens = graceEnds(app);
    await clock.advance(opens - 1_000 - clock.now());
    const still = pipRows(term);
    // Pip's rows, 40 ms at a time, from a second before the opening.
    const moved = [];
    for (; clock.now() < opens + 5_000; await clock.advance(40)) {
      if (pipRows(term) !== still) moved.push(clock.now() - opens);
    }
    assert.ok(moved.length, 'Pip moves');
    // The glance: Pip's eyes leave the still pose within 80 ms of 2.6 s.
    assert.ok(moved[0] >= 2_600 && moved[0] <= 2_680, `first move ${moved[0]} ms after the grace ends`);
    // Back by 4.2 s, then shut for the blink.
    assert.ok(moved.some((ms) => ms > 4_200 && ms < 4_400), `a blink after 4.2 s: ${moved.join(', ')}`);
    assert.ok(moved.at(-1) < 4_400, `still again after the blink: ${moved.at(-1)}`);
  } finally {
    app.close();
  }
});

// A key a second after the grace ends: without a fresh 30 s at the gate's
// opening again, breathing would stop about 25 s after it.
test('a key on the welcome shuts Pip\'s ambient gate for its quiet, easing Pip out for 320 ms and then with no frame asked, and its 30 s start again once, as the gate opens again, even with the window too small for Pip until after that', async () => {
  for (const small of [false, true]) {
    const app = clockedRun(MOTION_ENV, { askGit: quickGit, depth: 24, cols: 120, rows: 40 });
    const { term, clock } = app;
    const resize = async (cols, rows) => {
      Object.assign(term.stdout, { columns: cols, rows });
      term.stdout.emit('resize');
      await clock.advance(40);
    };
    try {
      await toWelcome(app);
      await clock.advance(graceEnds(app) + 1_000 - clock.now());
      // At 80x24 the welcome has no room for the detailed Pip.
      if (small) {
        await resize(80, 24);
        assert.doesNotMatch(term.shows(), RASTER, 'no detailed Pip at 80x24');
      }
      // Down does nothing on the welcome but stamp a key. The detailed Pip
      // eases out of its ambient pose, on frames 40 ms apart for 320 ms.
      const n = term.writes.length;
      term.type('\x1b[B');
      const pressed = clock.now();
      const opens = pressed + TIMING.keyQuiet;
      if (!small) {
        await turn();
        const asked = [];
        while (clock.now() < pressed + TIMING.pipFade) {
          const [next, ...more] = app.frameTimers();
          assert.ok(next && !more.length, `one frame timer ${clock.now() - pressed} ms after the key`);
          asked.push(clock.now() + next.ms - pressed);
          await clock.advance(next.ms);
        }
        const eased = app.frameTimes(n).map((at) => at - pressed);
        const grid = Array.from({ length: TIMING.pipFade / TIMING.grid }, (_, k) => (k + 1) * TIMING.grid);
        assert.deepEqual(asked, grid, 'a frame asked each 40 ms of the ease');
        // Each writes, but the last may draw what the one before it drew:
        // by then the ease is within a hair of its end.
        const steps = eased.filter((ms) => ms >= TIMING.grid);
        assert.deepEqual(steps, grid.slice(0, Math.max(steps.length, grid.length - 1)), `frames ${eased.join(', ')} ms after the key`);
        assert.ok(eased.length <= grid.length + 1, `the key's own frame, then the ease's: ${eased.join(', ')}`);
      }
      await clock.advance(pressed + 500 - clock.now());
      for (; clock.now() < opens; await clock.advance(1_000)) {
        if (!small) assert.deepEqual(app.frameTimers().map((x) => x.ms), [opens - clock.now()], `${clock.now() - opens} ms from the gate's opening`);
      }
      if (small) {
        await clock.advance(2_000);
        await resize(120, 40);
        assert.match(term.shows(), RASTER, 'the detailed Pip at 120x40 again');
      }
      const stops = await breathingStops(app, opens + 3_000, opens + 35_000);
      assert.ok(stops !== null && stops - opens >= 29_000 && stops - opens <= 31_000, `${small ? 'resized: ' : ''}breathing stops ${stops === null ? 'never' : `${stops - opens} ms`} after the gate opens again`);
    } finally {
      app.close();
    }
  }
});

test('a motion run on a fake terminal: step 3 done, a key gives the rest frame, a still intro writes nothing, and nothing after q', async () => {
  const app = clockedRun(MOTION_ENV);
  const { dir, term, clock } = app;
  try {
    assert.ok(await until(() => term.shows().includes("Let's learn Claude Code")), term.shows());
    await app.press('\r', "You'll be able to");
    await clock.advance(40);
    let n = term.writes.length;
    await clock.advance(1_500);
    assert.equal(term.writes.length, n, 'the intro writes nothing for 1.5 s');
    await app.press('\r', 'step 1 of 12');
    await app.press(' ', 'step 2 of 12');
    await app.press('1', 'step 2 of 12');
    await app.press('\r', 'Watching .practice/version.txt');
    mkdirSync(join(dir, '.practice'));
    writeFileSync(join(dir, '.practice', 'version.txt'), '2.1.285 (Claude Code)\n');
    assert.ok(await app.settle(() => term.shows().includes('Step 3 done!')), term.shows());
    assert.match(term.shows(), /DONE/);
    assert.ok(term.writes.some((w) => /\x1b\[\d+;1H/.test(w)), 'some frames rewrote only their changed rows');
    // A key while the step-done burst plays (158): the next frame is the rest
    // frame. The key comes a frame after the pass, as a person's would: a
    // key in the same millisecond as the pass is taken for the one that
    // started it.
    await clock.advance(40);
    const playing = term.shows();
    assert.doesNotMatch(playing, /✦ {10}▄█▀/, 'the burst has not drawn its sparks yet');
    term.type('\x1b[A');
    await clock.advance(40);
    const next = term.shows();
    assert.match(next, /✦ {10}▄█▀ {3}· {3}Step 3 done!/, 'the rest frame: the burst whole');
    await clock.advance(2_000);
    assert.equal(term.shows(), next, 'the frame after the key is the one the screen rests on');
    await afterQ(app);
    n = term.writes.length;
    await clock.advance(15_000);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(term.writes.length, n, 'nothing is written after q');
  } finally {
    app.close();
  }
});

test('a save that fails shows a note and the app keeps going', async () => {
  const dir = reducerRepo();
  rmSync(join(dir, '.practice'), { recursive: true, force: true });
  // A file where the folder should be: every save fails.
  writeFileSync(join(dir, '.practice'), 'not a folder');
  const term = fakeTerminal();
  let exited = null;
  main({ argv: [], stdin: term.stdin, stdout: term.stdout, env: CALM_ENV, platform: 'linux', root: dir, runCheck: reducerCheck, exit: (code) => { exited = code; } });
  try {
    assert.ok(await until(() => term.lastFrame().includes("Let's learn Claude Code")));
    term.type('\r');
    assert.ok(await until(() => term.lastFrame().includes("Couldn't save your place")), term.lastFrame());
    term.type('\r');
    assert.ok(await until(() => term.lastFrame().includes('step 1 of 12')), 'the lesson goes on');
    assert.equal(exited, null);
    term.type('\x03');
    assert.ok(await until(() => exited === 0));
  } finally {
    if (exited === null) term.type('\x03');
    rmSync(dir, { recursive: true, force: true });
  }
});

test('read-only: the app starts only the check and git\'s read-only commands, and writes only its own file', () => {
  const files = readdirSync(join(root, 'learn'), { recursive: true }).filter((f) => f.endsWith('.mjs')).map((f) => f.split('\\').join('/'));
  for (const f of files) {
    const src = readFileSync(join(root, 'learn', f), 'utf8');
    assert.doesNotMatch(src, /from 'node:(http|https|net|tls|dgram)'|\bfetch\(/, `${f} uses the network`);
    assert.doesNotMatch(src, /\b(spawn|spawnSync|exec|execSync|execFileSync|fork)\(/, `${f} starts a process another way`);
    // git only reads: status, whether a folder is a repository, a name, and
    // whether a work folder's .practice/ is ignored (ticket 86).
    for (const m of src.matchAll(/execFile\(([^,]+),\s*(\[[^\]]*)/g)) {
      const [, cmd, args] = m;
      const ok = (cmd.trim() === 'process.execPath' && args.includes('RUN_CHECK')) || (cmd.trim() === "'git'" && /^\['(status|rev-parse|config|check-ignore)'/.test(args.trim()));
      assert.ok(ok, `${f} runs ${cmd} ${args}`);
    }
    if (f !== 'lib/store.mjs') assert.doesNotMatch(src, /\b(writeFileSync|appendFileSync|renameSync|rmSync|unlinkSync|mkdirSync|writeFile|copyFileSync)\b/, `${f} writes a file`);
    if (f !== 'lib/screen.mjs') assert.doesNotMatch(src, /\bwriteSync\b/, `${f} writes with writeSync`);
  }
});

// Two check outputs are the same, or the first lines where they differ.
function sameOutput(a, b, what) {
  if (a === b) return;
  const x = a.split('\n');
  const y = b.split('\n');
  const i = x.findIndex((line, k) => line !== y[k]);
  const near = (lines) => lines.slice(Math.max(0, i - 2), i + 4).join('\n');
  assert.fail(`${what}: the outputs differ at line ${i + 1} of ${x.length} and ${y.length}.\nWith:\n${near(x)}\nWithout:\n${near(y)}`);
}

test('adding learn/ and its state file changes no check result', () => {
  const withApp = exportHead(root);
  const without = exportHead(root, 'learn');
  try {
    const a = check(['all', '--dir', withApp]).out.replaceAll(withApp, '<dir>');
    const b = check(['all', '--dir', without]).out.replaceAll(without, '<dir>');
    sameOutput(a, b, 'with learn/');
    mkdirSync(join(withApp, '.practice'), { recursive: true });
    saveState(withApp, sanitize({ welcomed: true, lessons: { 'b-1': { step: 'W3' } } }));
    sameOutput(check(['all', '--dir', withApp]).out.replaceAll(withApp, '<dir>'), b, 'with its state file');
  } finally {
    for (const d of [withApp, without]) rmSync(d, { recursive: true, force: true });
  }
});

test('package.json: one new script, no dependencies', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.learn, 'node learn/app.mjs');
  assert.equal(pkg.scripts.check, 'node checks/run.mjs');
  assert.equal(pkg.scripts.test, 'node --test "test/**/*.test.js"');
  assert.equal(pkg.scripts['test:checks'], 'node --test "checks/test/*.test.mjs"');
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
  assert.equal(pkg.engines.node, '>=22');
  const src = readdirSync(join(root, 'learn'), { recursive: true }).filter((f) => f.endsWith('.mjs')).map((f) => readFileSync(join(root, 'learn', f), 'utf8')).join('\n');
  assert.doesNotMatch(src, /import\.meta\.main|styleText|from '(?!node:|\.)/, 'needs a newer Node or a package');
});

// Pip comes from the owner's pip-terminal package (1.0.0): its src/pip.mjs as
// it ships, with its MIT license and nothing else of the package. The
// recorded hashes are the package's files (a Windows checkout's CRLF read as
// LF); edit Pip in the package, not here.
test("Pip's artwork is the pip-terminal package's pip.mjs, unedited, beside its license", () => {
  const dir = join(root, 'learn', 'lib', 'pip');
  const sha = (f) => createHash('sha256').update(readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n')).digest('hex');
  assert.deepEqual(readdirSync(dir).sort(), ['LICENSE', 'pip.mjs']);
  assert.equal(sha('pip.mjs'), '25e2f3132c2fda60608351441eb565924b9c28ab5080271682aaa9c472561f0f');
  assert.equal(sha('LICENSE'), 'd46d50acb422b8ac0c16a2d78e50515b1e007e61a6c0d0cf22dbb904bcabf5ea');
});

test('a glob path reads the newest file it matches, by its path, and none is no file (106)', () => {
  withRepo(() => repo({ '.claude/workflows/old.js': 'export const a = 1;\n', '.claude/workflows/notes.md': 'x\n' }), (dir) => {
    const glob = '.claude/workflows/*.js';
    assert.equal(matchOf(dir, glob), '.claude/workflows/old.js');
    writeFileSync(join(dir, '.claude/workflows/review.js'), 'export const b = 2;\n');
    utimesSync(join(dir, '.claude/workflows/old.js'), 1000, 1000);
    assert.equal(matchOf(dir, glob), '.claude/workflows/review.js', 'the newest match');
    assert.equal(bytesOf(dir, glob).toString(), 'export const b = 2;\n');
    assert.equal(stampOf(dir, glob), stampOf(dir, '.claude/workflows/review.js'));
    assert.equal(matchOf(dir, '.claude/workflows/*.ts'), null);
    assert.equal(matchOf(dir, '.claude/none/*.js'), null, 'no folder');
    assert.equal(stampOf(dir, '.claude/none/*.js'), '', 'no match stamps as no file');
    assert.equal(bytesOf(dir, '.claude/none/*.js'), null);
    assert.equal(matchOf(dir, '.claude/workflows/notes.md'), '.claude/workflows/notes.md', 'a plain path is itself');
  });
});
