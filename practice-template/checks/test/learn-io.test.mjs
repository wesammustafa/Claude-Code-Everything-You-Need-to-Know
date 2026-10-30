// What stays of the learn app's edges once the Terminal app is gone
// (ticket 210): the check child and `npm run check` agree item by item, the
// SLOW scan of the items that start a process, and the promise that learn/
// and its state file change no check result and add no dependency. The rest
// moved to quest/host/test and quest/engine/test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PATH, SLOW } from '../../../quest/engine/src/course.ts';
import { sanitize, saveState } from '../../../quest/host/src/store.ts';
import { lessons } from '../lessons/index.mjs';
import { check, exportHead } from './helpers.mjs';

// The practice template.
const root = fileURLToPath(new URL('../../', import.meta.url));
// Every lesson on the course, in its order.
const EVERY = PATH.map((p) => p.id);
const RUN_CHECK = join(root, '../quest/host/src/run-check.ts');
const child = (args, extraEnv = {}) => {
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const r = spawnSync(process.execPath, [RUN_CHECK, ...args], { encoding: 'utf8', env: { ...env, ...extraEnv } });
  return { code: r.status, out: r.stdout.trim() ? JSON.parse(r.stdout.trim()) : null };
};

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
  // Since ticket 210, learn/ holds only lessons/, so this scan reads nothing
  // and the `learn` script dangles; both have a subject again once 216 and
  // 225 put the bundled server at learn/app.mjs.
  const src = readdirSync(join(root, 'learn'), { recursive: true }).filter((f) => f.endsWith('.mjs')).map((f) => readFileSync(join(root, 'learn', f), 'utf8')).join('\n');
  assert.doesNotMatch(src, /import\.meta\.main|styleText|from '(?!node:|\.)/, 'needs a newer Node or a package');
});
