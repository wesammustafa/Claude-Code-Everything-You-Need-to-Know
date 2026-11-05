// The check command, run the way a Learner runs it, against a separate git
// repository created in a temporary directory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openRepo } from '../repo.mjs';
import { inPlan, planPaths } from '../paths.mjs';
import { items as b3Items, testsPass } from '../lessons/b-3.mjs';
import { commit, repo as makeRepo, repo as copyRepo, write } from './helpers.mjs';

const runner = join(dirname(fileURLToPath(import.meta.url)), '..', 'run.mjs');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'project');

function repo(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'practice-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

// The runner gets the environment a Learner's shell has. NODE_TEST_CONTEXT,
// set by `node --test`, would make the `npm test` a check runs skip its tests.
function check(args, env = {}) {
  const { GITHUB_ACTIONS, NODE_TEST_CONTEXT, ...rest } = process.env;
  const result = spawnSync(process.execPath, [runner, ...args], { encoding: 'utf8', env: { ...rest, ...env } });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

const correctedNote = '- linkcheck exits with code 1 when it finds a broken link, so it can fail CI.\n';

function versionEnv(dir, output = '2.1.292 (Claude Code)\n', exit = 0) {
  const bin = join(dir, '.bin');
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'version.cjs'), `process.stdout.write(${JSON.stringify(output)}); process.exit(${exit});\n`);
  const command = process.platform === 'win32' ? 'claude.cmd' : 'claude';
  const wrapper = process.platform === 'win32'
    ? `@"${process.execPath}" "%~dp0version.cjs"\r\n`
    : `#!${process.execPath}\nrequire('./version.cjs');\n`;
  writeFileSync(join(bin, command), wrapper);
  chmodSync(join(bin, command), 0o755);
  return { PATH: `${bin}${delimiter}${process.env.PATH ?? ''}` };
}

test('b-1 reads the installed version and the corrected note, without a saved version file', () => {
  const dir = repo({ 'practice/b-1/onboarding.md': correctedNote });
  try {
    const { code, out } = check(['b-1', '--dir', dir], versionEnv(dir));
    assert.equal(code, 0, out);
    assert.match(out, /PASS .*claude --version/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('b-1 refuses another repository without the exercise note', () => {
  const dir = repo();
  try {
    const { code, out } = check(['b-1', '--dir', dir], versionEnv(dir));
    assert.equal(code, 1, out);
    assert.match(out, /Your turn uses the note in your practice copy/);
    assert.match(out, /without `--dir`/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('b-1 does not let a saved version hide a missing executable', () => {
  const dir = repo({ 'practice/b-1/onboarding.md': correctedNote, '.practice/version.txt': '2.1.292 (Claude Code)\n' });
  try {
    const { code, out } = check(['b-1', '--dir', dir], { PATH: '' });
    assert.equal(code, 1, out);
    assert.match(out, /couldn't find `claude`/);
    for (const told of [/npm run learn/, /new terminal window/, /outside any editor/, /fix PATH as Troubleshoot installation describes \(lesson 1's Guide page links it under Check the install\)/]) assert.match(out, told);
    // It names the Guide page's link, not the step itself, which the learner may be on (349).
    assert.doesNotMatch(out, /Worked example step 2/);
    assert.doesNotMatch(out, /\b(Ctrl|Cmd|Shift|Alt|Option)\+/);
    assert.doesNotMatch(out, /\u2014/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('b-1 reads PATH at each run: the same copy fails without claude, then passes once claude is on PATH', () => {
  const dir = repo({ 'practice/b-1/onboarding.md': correctedNote });
  try {
    const before = check(['b-1', '--dir', dir], { PATH: '' });
    assert.equal(before.code, 1, before.out);
    assert.match(before.out, /couldn't find `claude`/);
    const after = check(['b-1', '--dir', dir], versionEnv(dir));
    assert.equal(after.code, 0, after.out);
    assert.match(after.out, /PASS .*claude --version/);
    assert.doesNotMatch(after.out, /couldn't find `claude`/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('b-1 rejects empty, malformed and unsuccessful version output', () => {
  const dir = repo({ 'practice/b-1/onboarding.md': correctedNote });
  try {
    for (const [output, exit] of [['', 0], ['command not found: claude\n', 0], ['2.1.292 (Claude Code)\n', 1]]) {
      const { code, out } = check(['b-1', '--dir', dir], versionEnv(dir, output, exit));
      assert.equal(code, 1, out);
      assert.match(out, /not a line such as/);
      assert.doesNotMatch(out, /npm run learn/);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('b-1 still fails when the note gives broken links a successful exit code', () => {
  const dir = repo({ 'practice/b-1/onboarding.md': '- linkcheck exits with code 0 when it finds broken links.\n' });
  try {
    const { code, out } = check(['b-1', '--dir', dir], versionEnv(dir));
    assert.equal(code, 1, out);
    assert.match(out, /The note still says/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Laid out as a copy is: the template's note in the first commit, under
// project/ (ticket 340).
function copyWithNote() {
  const dir = makeRepo({ 'practice/b-1/onboarding.md': readFileSync(join(root, 'practice/b-1/onboarding.md'), 'utf8') }, { nested: true });
  commit(dirname(dir), 'Start from the practice template');
  return dir;
}

test('b-1 names no claim while the note is as the copy started', () => {
  const dir = copyWithNote();
  try {
    const { code, out } = check(['b-1', '--dir', dir], versionEnv(dir));
    assert.equal(code, 1, out);
    assert.match(out, /hasn't changed yet/);
    assert.doesNotMatch(out, /The note still says/);
    assert.doesNotMatch(out, /\bexit|\bCI\b|linkcheck/);
  } finally { rmSync(dirname(dir), { recursive: true, force: true }); }
});

test('b-1 quotes the wrong claim once the note was edited, committed or not', () => {
  const dir = copyWithNote();
  try {
    const note = join(dir, 'practice/b-1/onboarding.md');
    writeFileSync(note, readFileSync(note, 'utf8').replace('Run the tests', 'Run the unit tests'));
    let { code, out } = check(['b-1', '--dir', dir], versionEnv(dir));
    assert.equal(code, 1, out);
    assert.match(out, /The note still says "linkcheck always exits with code 0/);
    commit(dirname(dir), 'Reword the notes');
    ({ code, out } = check(['b-1', '--dir', dir], versionEnv(dir)));
    assert.equal(code, 1, out);
    assert.match(out, /The note still says "linkcheck always exits with code 0/);
  } finally { rmSync(dirname(dir), { recursive: true, force: true }); }
});

test('b-1 passes a corrected note that the first commit already holds', () => {
  const text = readFileSync(join(root, 'practice/b-1/onboarding.md'), 'utf8')
    .replace("linkcheck always exits with code 0, even when it finds broken links, so it can't fail a CI job on its own.", 'linkcheck exits with code 1 when it finds a broken link, so it fails a CI job.');
  const dir = makeRepo({ 'practice/b-1/onboarding.md': text }, { nested: true });
  commit(dirname(dir), 'Start from a corrected note');
  try {
    const { code, out } = check(['b-1', '--dir', dir], versionEnv(dir));
    assert.equal(code, 0, out);
  } finally { rmSync(dirname(dir), { recursive: true, force: true }); }
});

test('the progress summary never fails and marks saved-state items as checked locally', () => {
  const dir = repo();
  try {
    const { code, out } = check(['all', '--summary', '--dir', dir], { GITHUB_ACTIONS: 'true' });
    assert.equal(code, 0, out);
    assert.match(out, /\| b-2 \|.*\| checked locally \|/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the assertion mode requires every lesson to fail on an unsolved repo', () => {
  const dir = repo();
  try {
    assert.equal(check(['all', '--assert', 'fail', '--dir', dir]).code, 0);
    assert.equal(check(['all', '--assert', 'pass', '--dir', dir]).code, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an unknown lesson id is a usage error that lists the known ones', () => {
  const { code, out } = check(['z-9']);
  assert.equal(code, 2);
  assert.match(out, /b-1/);
});

// Some shells drop the `--` in `npm run check -- b-1 --dir <path>`, so npm
// keeps --dir for itself and passes only the path on.
test('a folder given without --dir is refused, not silently ignored', () => {
  const dir = repo();
  try {
    const { code, out } = check(['b-1', dir]);
    assert.equal(code, 2, out);
    assert.match(out, /unexpected argument/);
    assert.match(out, /node checks\/run\.mjs b-1 --dir/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// A copy's root script is `cd project && node ../checks/run.mjs`, so a
// relative --dir typed at the root reaches run.mjs from project/. npm says
// where it was typed in INIT_CWD.
test('a relative --dir given to npm run check is from the folder it was typed in, and no --dir is the folder the check runs in', () => {
  // The real path: on macOS the temporary folder is a symlink (/var to
  // /private/var), and the check names a folder by the path it resolves.
  const top = realpathSync.native(mkdtempSync(join(tmpdir(), 'practice-')));
  try {
    const project = join(top, 'project');
    const mine = join(top, 'mine');
    mkdirSync(project);
    execFileSync('git', ['init', '-q', mine]);
    write(project, { 'practice/b-1/onboarding.md': correctedNote });
    const run = (args, env) => {
      const { GITHUB_ACTIONS, NODE_TEST_CONTEXT, npm_lifecycle_event, INIT_CWD, ...rest } = process.env;
      const result = spawnSync(process.execPath, [runner, ...args], { cwd: project, encoding: 'utf8', env: { ...rest, ...versionEnv(top), ...env } });
      return { code: result.status, out: `${result.stdout}${result.stderr}` };
    };
    const typed = { npm_lifecycle_event: 'check', INIT_CWD: top };
    // From the copy's root, `--dir mine` is top/mine, and `--dir project` is project/.
    let { code, out } = run(['b-1', '--dir', 'mine'], typed);
    assert.equal(code, 1, out);
    assert.match(out, /Your turn uses the note in your practice copy/);
    ({ code, out } = run(['b-1', '--dir', 'project'], typed));
    assert.equal(code, 0, out);
    // Without --dir, the folder the check runs in, wherever npm was run from.
    ({ code, out } = run(['b-1'], typed));
    assert.equal(code, 0, out);
    // Run by node itself, or by another npm script, a path is from the current folder.
    ({ code, out } = run(['b-1', '--dir', 'mine']));
    assert.equal(code, 2, out);
    assert.ok(out.includes(`no such folder: ${join(project, 'mine')}`), out);
    ({ code, out } = run(['b-1', '--dir', 'mine'], { npm_lifecycle_event: 'test', INIT_CWD: top }));
    assert.equal(code, 2, out);
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test('b-1 reads an onboarding note written by Windows PowerShell as UTF-16', () => {
  const dir = repo({ 'practice/b-1/onboarding.md': '' });
  try {
    const text = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(correctedNote, 'utf16le')]);
    writeFileSync(join(dir, 'practice', 'b-1', 'onboarding.md'), text);
    const { code, out } = check(['b-1', '--dir', dir], versionEnv(dir));
    assert.equal(code, 0, out);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Known solved exercise files, independent of the check implementation.
// The real template CLI runs against them in the positive integration cases.
const solvedConfig = [
  "// Parses linkcheck.json. Every field is optional:",
  "//   files:  files or folders to scan for Markdown links (default [\".\"])",
  "//   ignore: link targets to skip, matched as prefixes (default [])",
  "export const DEFAULTS = { files: ['.'], ignore: [] };",
  "",
  "export function parseConfig(text) {",
  "  if (!text.trim()) {",
  "    throw new Error('linkcheck.json is empty: write a JSON object, such as {}');",
  "  }",
  "  const raw = JSON.parse(text);",
  "  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {",
  "    throw new Error('linkcheck.json must hold a JSON object, such as {}');",
  "  }",
  "  for (const key of Object.keys(raw)) {",
  "    if (!Object.hasOwn(DEFAULTS, key)) throw new Error(`linkcheck.json: unknown key \"${key}\"`);",
  "  }",
  "  const config = { ...DEFAULTS, ...raw };",
  "  for (const key of ['files', 'ignore']) {",
  "    if (!Array.isArray(config[key]) || !config[key].every((v) => typeof v === 'string')) {",
  "      throw new Error(`linkcheck.json: \"${key}\" must be a list of strings`);",
  "    }",
  "  }",
  "  return config;",
  "}"
].join('\n') + '\n';
const solvedLinks = [
  "// Finds inline Markdown links, [text](target), outside code blocks.",
  "// TODO: also find reference-style links, [text][ref], whose target a [ref]: line defines elsewhere on the page.",
  "export function findLinks(markdown) {",
  "  const links = [];",
  "  let inFence = false;",
  "  markdown.split('\\n').forEach((line, i) => {",
  "    if (/^\\s*(```|~~~)/.test(line)) {",
  "      inFence = !inFence;",
  "      return;",
  "    }",
  "    if (inFence) return;",
  "    const prose = line.replace(/`[^`]*`/g, '');",
  "    // The target may sit in angle brackets and may be followed by a title.",
  "    for (const m of prose.matchAll(/(?<!!)\\[([^\\]]*)\\]\\(\\s*(?:<([^>]*)>|([^)\\s]+))(?:\\s+(?:\"[^\"]*\"|'[^']*'))?\\s*\\)/g)) {",
  "      links.push({ text: m[1], target: m[2] ?? m[3], line: i + 1 });",
  "    }",
  "  });",
  "  return links;",
  "}",
  "",
  "export function isExternal(target) {",
  "  return target.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(target);",
  "}"
].join('\n') + '\n';
function templateRepo(files = {}) {
  const dir = repo();
  for (const entry of ['package.json', 'src', 'test', 'samples']) cpSync(join(root, entry), join(dir, entry), { recursive: true });
  writeFileSync(join(dir, '.git', 'info', 'exclude'), '.practice/\n');
  write(dir, files);
  return dir;
}
function planRepo(files) {
  return templateRepo({ 'src/config.js': solvedConfig, ...files });
}

// Neutral paths: the b-2 check reads only these strings, and the lesson's own
// file names here would tell Claude what the check expects.
const planned = {
  '.practice/b-2-before.txt': '',
  '.practice/b-2-plan.txt': 'src/a.js\ntest/a.test.js\n',
  '.practice/b-2-after.txt': ' M src/a.js\n M test/a.test.js\n',
};

test('b-2 passes when nothing changed before approval and only planned files changed after', () => {
  const dir = planRepo(planned);
  try {
    const { code, out } = check(['b-2', '--dir', dir]);
    assert.equal(code, 0, out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('b-2 fails when files had changed before the plan was approved, and says how to start clean', () => {
  const dir = planRepo({ ...planned, '.practice/b-2-before.txt': ' M src/a.js\n' });
  try {
    const { code, out } = check(['b-2', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /before you approved/);
    assert.match(out, /git stash push --include-untracked/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('b-2 fails when a changed file was not in the plan', () => {
  const dir = planRepo({ ...planned, '.practice/b-2-after.txt': ' M src/a.js\n?? test/b.test.js\n' });
  try {
    const { code, out } = check(['b-2', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /test\/b\.test\.js/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// `git status --porcelain` lists a new, untracked folder as `dir/`, not the
// files inside it.
test('b-2 counts a new folder as planned when the plan names a file inside it', () => {
  const dir = planRepo({
    ...planned,
    '.practice/b-2-plan.txt': 'src/a.js\ntest/fixtures/a.json\n',
    '.practice/b-2-after.txt': ' M src/a.js\n?? test/fixtures/\n',
  });
  try {
    const { code, out } = check(['b-2', '--dir', dir]);
    assert.equal(code, 0, out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('b-2 fails for a new folder when the plan names nothing inside it', () => {
  const dir = planRepo({ ...planned, '.practice/b-2-after.txt': ' M src/a.js\n?? notes/\n' });
  try {
    const { code, out } = check(['b-2', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /not in the plan: notes\//);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('b-2 accepts plan paths written with ./, backslashes or backticks, with Windows line endings', () => {
  const dir = planRepo({ ...planned, '.practice/b-2-plan.txt': './src/a.js\r\n`test\\a.test.js`\r\n' });
  try {
    const { code, out } = check(['b-2', '--dir', dir]);
    assert.equal(code, 0, out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('b-2 accepts a plan path written as the full path into the repository', () => {
  const dir = planRepo(planned);
  try {
    writeFileSync(join(dir, '.practice', 'b-2-plan.txt'), `${join(dir, 'src', 'a.js')}\ntest/a.test.js\n`);
    const { code, out } = check(['b-2', '--dir', dir]);
    assert.equal(code, 0, out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// A Practice copy (ticket 298): the git root holds project/, where the
// checks run, so `git status --porcelain` prints `project/src/a.js`. A plan
// written that way counts as well as one written from project/.
test('b-2 accepts plan paths written from the git root above project/, in a Practice copy', () => {
  const top = repo();
  const dir = join(top, 'project');
  mkdirSync(dir);
  for (const entry of ['package.json', 'src', 'test', 'samples']) cpSync(join(root, entry), join(dir, entry), { recursive: true });
  writeFileSync(join(top, '.git', 'info', 'exclude'), '.practice/\n');
  write(dir, {
    'src/config.js': solvedConfig,
    ...planned,
    '.practice/b-2-plan.txt': 'project/src/a.js\nsrc/b.js\n',
    '.practice/b-2-after.txt': ' M project/src/a.js\n M project/src/b.js\n',
  });
  try {
    const { code, out } = check(['b-2', '--dir', dir]);
    assert.equal(code, 0, out);
  } finally {
    rmSync(top, { recursive: true, force: true });
  }
});

test('planPaths drops the folder prefix only from paths that start with it', () => {
  const plan = planPaths('project/src/a.js\nsrc/b.js\n./project/test/c.js\nother/d.js\n', '/x/project', 'project/');
  assert.deepEqual([...plan], ['src/a.js', 'src/b.js', 'test/c.js', 'other/d.js']);
  assert.ok(inPlan(plan, 'src/a.js'));
  assert.deepEqual([...planPaths('project/src/a.js\n', '/x')], ['project/src/a.js']);
});

test('b-2 asks for the after snapshot when it is missing', () => {
  const { '.practice/b-2-after.txt': _, ...unsaved } = planned;
  const dir = planRepo(unsaved);
  try {
    const { code, out } = check(['b-2', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /After Claude finishes the edits, run `git status --porcelain > \.practice\/b-2-after\.txt`\./);
    assert.doesNotMatch(out, /lists no changed file yet/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// 190: the Learner saved the snapshot before approving any edit, so git saw
// nothing. Asking them to run the same command again reads as stuck.
test('b-2 says the after snapshot lists no changed file yet, and what to do first', () => {
  const dir = planRepo({ ...planned, '.practice/b-2-after.txt': '' });
  try {
    const { code, out } = check(['b-2', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /`\.practice\/b-2-after\.txt` lists no changed file yet\./);
    assert.match(out, /Approve the plan you reviewed; if Claude Code asks, read each request/);
    // Step 7's whole rule: read each request, and No where a command does
    // more than the plan needs, never Yes to every request.
    assert.match(out, /read each request: plain Yes, or No if it does more than the plan needs\./);
    assert.match(out, /Once `git status` lists changes, save it again\./);
    assert.doesNotMatch(out, /After Claude finishes the edits/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const PATCH_TEST_TEXT = "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\nimport { isExternal } from '../src/links.js';\ntest('a single slash is a project link', () => assert.equal(isExternal('/docs/setup.md'), false));\n";

// A real template CLI with a solved link parser, committed together with a
// regression test that rejects the patch's single-slash flaw.
function committedRepo({ testScript = 'node --test "test/**/*.test.js"', templateFiles = {}, files = {
  'src/links.js': solvedLinks,
  'test/external.test.js': PATCH_TEST_TEXT,
} } = {}) {
  const dir = templateRepo(templateFiles);
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' }).trim();
  // The fix must change source even when this suite runs from solutions.
  write(dir, { 'src/links.js': solvedLinks.replace("target.startsWith('//') || ", '') });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'claude-code-practice', type: 'module', scripts: { test: testScript } }));
  git('add', '-A');
  git('commit', '-q', '-m', 'Initial template copy');
  write(dir, files);
  git('add', '-A');
  git('commit', '-q', '--allow-empty', '-m', 'Fix protocol-relative links and test the patch');
  return dir;
}

test('b-3 passes for a commit that changes code and a test, with the tests passing and the tree clean', () => {
  for (const templateFiles of [{}, { 'src/links.js': solvedLinks }]) {
    const dir = committedRepo({ templateFiles });
    try {
      const { code, out } = check(['b-3', '--dir', dir]);
      assert.equal(code, 0, out);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

// Ticket 341, the live run's state at Your turn step 5: the Worked example is
// committed, and the teammate's patch is applied, fixed and not committed.
// The last commit changes a test and code, but not the Your turn change.
test('b-3 does not count the Worked example commit as the Your turn commit', () => {
  const dir = copyRepo({}, { nested: true });
  try {
    for (const entry of ['package.json', 'src', 'test', 'practice/b-3']) cpSync(join(root, entry), join(dir, entry), { recursive: true });
    commit(dir, 'Initial template copy');
    const workedExample = solvedLinks.replace("target.startsWith('//') || ", '');
    write(dir, { 'src/links.js': workedExample, 'test/links.test.js': `${readFileSync(join(root, 'test', 'links.test.js'), 'utf8')}// titled links\n` });
    commit(dir, 'Check links that have a quoted title');
    execFileSync('git', ['apply', 'practice/b-3/protocol-relative.patch'], { cwd: dir });
    write(dir, { 'src/links.js': solvedLinks });
    assert.ok(existsSync(join(dir, 'test', 'external.test.js')), 'the patch applied');
    execFileSync('git', ['add', '-N', 'test/external.test.js'], { cwd: dir });
    const result = b3Items[3].check(openRepo(dir));
    assert.equal(typeof result, 'string', 'the Worked example commit passes the commit item');
    assert.match(result, /^Your last commit is still the Worked example's \(src\/links\.js, test\/links\.test\.js\)\./);
    assert.match(result, /Your turn, step 5/);
    commit(dir, 'Skip protocol-relative links, but keep checking root-relative ones');
    assert.equal(b3Items[3].check(openRepo(dir)), true);
    // A later Lesson's commit, such as b-4's to src/, keeps it passing.
    write(dir, { 'src/links.js': `${solvedLinks}// later lesson\n`, 'README.md': 'later\n' });
    commit(dir, 'A later lesson');
    assert.equal(b3Items[3].check(openRepo(dir)), true);
  } finally {
    rmSync(dirname(dir), { recursive: true, force: true });
  }
});

// A Your turn commit that holds the fix and a regression case in
// test/links.test.js, but leaves the patch's new test out, either as
// intent-to-add (Claude named the files it staged) or untracked (`git commit
// -a`), is not the Worked example's.
test('b-3 does not call a Your turn commit that leaves out the patch\'s test the Worked example\'s', () => {
  for (const intentToAdd of [true, false]) {
    const dir = copyRepo({}, { nested: true });
    try {
      for (const entry of ['package.json', 'src', 'test', 'practice/b-3']) cpSync(join(root, entry), join(dir, entry), { recursive: true });
      commit(dir, 'Initial template copy');
      write(dir, { 'src/links.js': solvedLinks.replace("target.startsWith('//') || ", ''), 'test/links.test.js': `${readFileSync(join(root, 'test', 'links.test.js'), 'utf8')}// titled links\n` });
      commit(dir, 'Check links that have a quoted title');
      execFileSync('git', ['apply', 'practice/b-3/protocol-relative.patch'], { cwd: dir });
      if (intentToAdd) execFileSync('git', ['add', '-N', 'test/external.test.js'], { cwd: dir });
      write(dir, { 'src/links.js': solvedLinks, 'test/links.test.js': `${readFileSync(join(dir, 'test', 'links.test.js'), 'utf8')}// root-relative links\n` });
      commit(dir, 'Skip protocol-relative links', ['src/links.js', 'test/links.test.js']);
      const result = b3Items[3].check(openRepo(dir));
      assert.equal(typeof result, 'string', `intent-to-add ${intentToAdd}`);
      assert.doesNotMatch(result, /Worked example/);
      assert.match(result, /^No commit adds the patch's test, `test\/external\.test\.js`, yet; your last commit changes src\/links\.js, test\/links\.test\.js\./);
    } finally {
      rmSync(dirname(dir), { recursive: true, force: true });
    }
  }
});

test('b-3 fails when the last commit leaves out the patch\'s test, and says to commit them together', () => {
  const dir = committedRepo({ files: { 'src/links.js': 'export {}\n' } });
  try {
    const { code, out } = check(['b-3', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /No commit adds the patch's test, `test\/external\.test\.js`, yet; your last commit changes src\/links\.js\./);
    assert.match(out, /Your turn, step 5/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The replay's state: a later Lesson commits on top of the Your turn commit.
test('b-3 still passes after a later commit that leaves the patch\'s test alone', () => {
  for (const later of [{ 'src/links.js': `${solvedLinks}// tidy\n` }, { 'README.md': 'notes\n' }]) {
    const dir = committedRepo();
    try {
      write(dir, later);
      commit(dir, 'A later lesson');
      const { code, out } = check(['b-3', '--dir', dir]);
      assert.equal(code, 0, out);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('b-3 fails when the patch\'s test is in an earlier commit than the fix, and says to combine them', () => {
  const dir = committedRepo({ files: { 'test/external.test.js': PATCH_TEST_TEXT } });
  try {
    write(dir, { 'src/links.js': solvedLinks });
    commit(dir, 'Fix protocol-relative links');
    const { code, out } = check(['b-3', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /The patch's test is in an earlier commit than your fix: the commit that adds `test\/external\.test\.js` leaves out `src\/` \(test\/external\.test\.js\)\./);
    assert.match(out, /combine the two commits into one/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Ticket 341: the fix commit comes first, then the patch's test alone, then
// a later Lesson's change to src/. The test did not come before the fix.
test('b-3 does not say the patch\'s test came before the fix when a later commit changes src/', () => {
  const dir = committedRepo({ files: { 'src/links.js': solvedLinks } });
  try {
    write(dir, { 'test/external.test.js': PATCH_TEST_TEXT });
    commit(dir, 'Test the patch');
    write(dir, { 'src/links.js': `${solvedLinks}// later lesson\n` });
    commit(dir, 'A later lesson');
    const result = b3Items[3].check(openRepo(dir));
    assert.equal(typeof result, 'string');
    assert.doesNotMatch(result, /earlier commit than your fix/);
    assert.match(result, /^The commit that adds the patch's test changes nothing in `src\/` \(test\/external\.test\.js\)/);
    assert.match(result, /If the fix is in the commit before it/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// A later Lesson may edit the patch's test on its own: the commit that adds
// it is still the Your turn commit.
test('b-3 still passes after a later commit that changes only the patch\'s test', () => {
  const dir = committedRepo();
  try {
    write(dir, { 'test/external.test.js': `${PATCH_TEST_TEXT}// tidy\n` });
    commit(dir, 'Tidy the patch test');
    const { code, out } = check(['b-3', '--dir', dir]);
    assert.equal(code, 0, out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('b-3 fails when the commit changes nothing in src/, and says to combine it with the code change', () => {
  const dir = committedRepo({ files: { 'test/external.test.js': '// test\n', 'README.md': 'notes\n' } });
  try {
    const { code, out } = check(['b-3', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /changes nothing in `src\/` \(README\.md, test\/external\.test\.js\)/);
    assert.match(out, /combine/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The Fix commit adds the patch's test, and the merge is the next commit;
// the docs-only case reads the merge's own changes against its first parent.
test('b-3 finds a commit merged from a branch, and reads a merge\'s changes against its first parent', () => {
  for (const [files, expected] of [
    [{ 'src/fix.js': '// fix\n', 'test/external.test.js': '// test\n' }, true],
    [{ 'docs.md': 'notes\n' }, /No commit adds the patch's test/],
    [{ 'test/external.test.js': '// test\n' }, /nothing in `src\/`/],
  ]) {
    const dir = repo({ 'README.md': 'initial\n' });
    const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' }).trim();
    try {
      git('add', '-A'); git('commit', '-qm', 'Initial');
      const main = git('branch', '--show-current');
      git('checkout', '-qb', 'fix');
      write(dir, files);
      git('add', '-A'); git('commit', '-qm', 'Fix');
      git('checkout', '-q', main);
      write(dir, { 'README.md': 'updated on main\n' });
      git('commit', '-qam', 'Update notes');
      git('merge', '--no-ff', 'fix', '-m', 'Merge fix');
      const result = b3Items[3].check(openRepo(dir));
      if (expected === true) assert.equal(result, true);
      else assert.match(result, expected);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test('b-3 fails when the tests fail', () => {
  const dir = committedRepo({ testScript: 'node -e "process.exit(1)"' });
  try {
    const { code, out } = check(['b-3', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /npm test/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the shared test-result item reads saved exit codes when no npm test script exists', () => {
  const dir = committedRepo({ testScript: '' });
  const saved = join(dir, '.practice', 'b-3-tests.txt');
  mkdirSync(dirname(saved), { recursive: true });
  try {
    assert.match(testsPass.check(openRepo(dir)), /\$LASTEXITCODE > \.practice\/b-3-tests\.txt/);
    writeFileSync(saved, 'True\n');
    assert.match(testsPass.check(openRepo(dir)), /not an exit code/);
    writeFileSync(saved, '0\n');
    assert.equal(testsPass.check(openRepo(dir)), true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('b-3 fails when changes are left uncommitted, and says how to set aside new files too', () => {
  const dir = committedRepo();
  try {
    writeFileSync(join(dir, 'src', 'links.js'), 'export const x = 1\n');
    writeFileSync(join(dir, 'notes.txt'), 'scratch\n');
    const { code, out } = check(['b-3', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /uncommitted: src\/links\.js/);
    assert.match(out, /git stash push --include-untracked/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const rewound = {
  '.practice/b-4-before-rewind.txt': ' M src/links.js\n M src/check-links.js\n M test/links.test.js\n',
  '.practice/b-4-after-rewind.txt': ' M src/links.js\n',
};
function rewindRepo(files = rewound) {
  const dir = templateRepo();
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' }).trim();
  git('add', '-A'); git('commit', '-q', '-m', 'Initial template copy');
  const path = join(dir, 'src', 'check-links.js');
  writeFileSync(path, readFileSync(path, 'utf8') + '\n// Refactored while keeping the synchronous export.\n');
  git('add', 'src/check-links.js'); git('commit', '-q', '-m', 'Refactor the link checker');
  write(dir, files);
  return dir;
}

test('b-4 passes when rewind restored the caller and left the command-only file change', () => {
  const dir = rewindRepo();
  try {
    const { code, out } = check(['b-4', '--dir', dir]);
    assert.equal(code, 0, out);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('b-4 fails when the before snapshot omits the script change', () => {
  const dir = rewindRepo({ ...rewound, '.practice/b-4-before-rewind.txt': ' M src/check-links.js\n' });
  try {
    const { code, out } = check(['b-4', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /doesn't list `src\/links\.js`/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('b-4 explains how to recover when the caller remains changed after rewind', () => {
  const dir = rewindRepo({ ...rewound, '.practice/b-4-after-rewind.txt': ' M src/links.js\n M src/check-links.js\n' });
  try {
    const { code, out } = check(['b-4', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /Restore code/);
    assert.match(out, /git restore src test/);
    assert.match(out, /git status --porcelain > \.practice\/b-4-after-rewind\.txt/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('b-4 explains why a command change can be restored for a file edited earlier', () => {
  const dir = rewindRepo({ ...rewound, '.practice/b-4-after-rewind.txt': '' });
  try {
    const { code, out } = check(['b-4', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /Claude had already edited/);
    assert.match(out, /new session/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// A repository whose committed CLAUDE.md holds a rule, followed by a commit a
// new session made, as in lesson b-5.
const memoryMd = '# Project\n\n- Every new JavaScript file in `src/` starts with the line `// Part of linkcheck.`\n- CLI errors go to stderr and start with `linkcheck:`.\n';
function memoryRepo({ claudeMd = memoryMd, commitClaudeMd = true, header = '// Part of linkcheck.', commitChange = true, packageJson = '{"scripts":{"test":"node --test"}}' } = {}) {
  const dir = repo({ 'CLAUDE.md': claudeMd, '.gitignore': 'CLAUDE.local.md\n', 'package.json': packageJson });
  writeFileSync(join(dir, '.git', 'info', 'exclude'), '.practice/\n');
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' }).trim();
  git('add', '.gitignore', 'package.json');
  if (commitClaudeMd) git('add', 'CLAUDE.md');
  git('commit', '-q', '--allow-empty', '-m', 'Add project instructions');
  mkdirSync(join(dir, 'src'), { recursive: true });
  mkdirSync(join(dir, 'test'), { recursive: true });
  writeFileSync(join(dir, 'src', 'stats.js'), `${header}\nexport function countLinks() { return 0; }\n`);
  writeFileSync(join(dir, 'test', 'stats.test.js'), "import { test } from 'node:test';\n");
  if (commitChange) {
    git('add', 'src', 'test');
    git('commit', '-q', '-m', 'Add countLinks');
  }
  return dir;
}

test('b-5 passes when CLAUDE.md is committed with the rule and the new session followed it', () => {
  const dir = memoryRepo();
  try {
    const { code, out } = check(['b-5', '--dir', dir]);
    assert.equal(code, 0, out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('b-5 fails when CLAUDE.md is not committed', () => {
  const dir = memoryRepo({ commitClaudeMd: false });
  try {
    const { code, out } = check(['b-5', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /no committed CLAUDE\.md/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('b-5 explains the header rule when committed memory lacks it', () => {
  const dir = memoryRepo({ claudeMd: '# Project\n' });
  try {
    const { code, out } = check(['b-5', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /has no line like/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('b-5 fails when a new file violates the rule, and asks for a new-session change', () => {
  const dir = memoryRepo({ header: '// stats' });
  try {
    const { code, out } = check(['b-5', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /src\/stats\.js/);
    assert.match(out, /new session/);
    assert.match(out, /different new file/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('b-5 says when the new file is there but not committed yet', () => {
  const dir = memoryRepo({ commitChange: false });
  try {
    const { code, out } = check(['b-5', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /src\/stats\.js/);
    assert.match(out, /not committed/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The line /init wrote into project/CLAUDE.md in a live run (ticket 342):
// `check` is a script in the Starter project's package.json, so only a rule
// for course lines can catch it.
const initCourseLine = "- `npm run check`: runs the course's lesson checks from `../checks/run.mjs`, which lives outside this repo";

test('b-5 fails a committed CLAUDE.md line that only the course uses, quotes it and points back to step 2', () => {
  const dir = memoryRepo({ claudeMd: `${memoryMd}${initCourseLine}\n`, packageJson: readFileSync(join(root, 'package.json'), 'utf8') });
  try {
    const { code, out } = check(['b-5', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.ok(out.includes(initCourseLine), out);
    assert.match(out, /step 2 of the worked example/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('b-5 passes a committed CLAUDE.md whose only command is npm test', () => {
  const dir = memoryRepo({ claudeMd: `${memoryMd}- Run the tests with \`npm test\`.\n`, packageJson: readFileSync(join(root, 'package.json'), 'utf8') });
  try {
    const { code, out } = check(['b-5', '--dir', dir]);
    assert.equal(code, 0, out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('b-5 counts each kind of line the lesson calls a course line, and no linkcheck line', async () => {
  const { items } = await import('../lessons/b-5.mjs');
  const courseItem = items.find((it) => /course/.test(it.text));
  assert.ok(courseItem, 'b-5 has no item for course lines');
  const verdict = (line) => {
    const dir = memoryRepo({ claudeMd: `${memoryMd}${line}\n`, packageJson: readFileSync(join(root, 'package.json'), 'utf8') });
    try {
      return courseItem.check(openRepo(dir));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
  const course = [
    '- Lesson checks live in `../checks/`.',
    '- Run `npm run check -- b-5` after each lesson.',
    '- `npm run learn` walks through the lessons.',
    '- `npm run test:checks` tests the checks.',
    '- The lessons are in `learn/lessons/`.',
    '- The capstone brief is `../capstone/beginner-bug.md`.',
    '- CI is in `.github/workflows/`.',
    '- The dev container is in `.devcontainer/`.',
  ];
  for (const line of course) assert.match(String(verdict(line)), /describes the course/, line);
  const linkcheck = [
    '- Run the tests with `npm test`.',
    '- Check a folder: `npm run linkcheck -- samples`.',
    '- Each link is checked in `src/check-links.js`.',
    '- The config file is `linkcheck.json`.',
    '- Docs: https://code.claude.com/docs/en/learn/x',
    '- See https://github.com/acme/.github/blob/main/README.md',
  ];
  for (const line of linkcheck) assert.equal(verdict(line), true, line);
});

// The reference fix for capstone/beginner-bug.md: each file with its text
// before and after the fix.
const capstoneFix = [
  ['src/check-links.js', '  if (!existsSync(path)) return [];', '  if (!existsSync(path)) throw new Error(`no such file or folder: ${entry}`);'],
  ['src/cli.js', 'const broken = brokenLinks(root, config);', 'let broken;\ntry {\n  broken = brokenLinks(root, config);\n} catch (error) {\n  console.error(`linkcheck: ${error.message}`);\n  process.exit(2);\n}'],
];

// Puts a copied file in the buggy or the fixed state, whichever state it
// arrived in (the solutions branch already holds the fix). If the app no
// longer has either text, the fixture fails loudly instead of testing nothing.
function setFixed(dir, [path, buggy, fixed], fix) {
  const file = join(dir, path);
  const text = readFileSync(file, 'utf8');
  const [from, to] = fix ? [buggy, fixed] : [fixed, buggy];
  if (text.includes(to)) return;
  if (!text.includes(from)) throw new Error(`the capstone fixture no longer matches ${path}`);
  writeFileSync(file, text.replace(from, to));
}

// A copy of this template where the Beginner capstone is done: the solution
// for the bug report, committed, with the snapshots the capstone asks for.
function capstoneRepo({ fix = true, withTest = true, before = '', planned = 'src/check-links.js\nsrc/cli.js\ntest/links.test.js\n' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'practice-cap-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const entry of ['package.json', 'src', 'test', 'samples']) {
    cpSync(join(root, entry), join(dir, entry), { recursive: true });
  }
  for (const change of capstoneFix) setFixed(dir, change, false);
  writeFileSync(join(dir, '.gitignore'), '.practice/\n');
  writeFileSync(join(dir, 'CLAUDE.md'), '# linkcheck\n\n- Run the tests: `npm test`\n');
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' }).trim();
  git('add', '-A');
  git('commit', '-q', '-m', 'start');
  if (fix) {
    for (const change of capstoneFix) setFixed(dir, change, true);
    if (withTest) {
      const t = join(dir, 'test', 'links.test.js');
      writeFileSync(t, readFileSync(t, 'utf8') + "\ntest('a missing folder is an error', () => {\n  assert.throws(() => brokenLinks(samples, { files: ['nowhere'], ignore: [] }), /nowhere/);\n});\n");
    }
  }
  git('add', '-A');
  git('commit', '-q', '--allow-empty', '-m', 'Report a missing folder in linkcheck.json');
  mkdirSync(join(dir, '.practice'), { recursive: true });
  writeFileSync(join(dir, '.practice', 'capstone-before.txt'), before);
  writeFileSync(join(dir, '.practice', 'capstone-plan.txt'), planned);
  writeFileSync(join(dir, '.practice', 'capstone-commit.txt'), `${git('rev-parse', 'HEAD')}\n`);
  return dir;
}

test('the Beginner capstone passes when every observed Exit statement is met', () => {
  const dir = capstoneRepo();
  try {
    const { code, out } = check(['b-capstone', '--dir', dir]);
    assert.equal(code, 0, out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the Beginner capstone fails while the reported bug is still there', () => {
  const dir = capstoneRepo({ fix: false });
  try {
    const { code, out } = check(['b-capstone', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /FAIL .*exit with code 2/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the Beginner capstone accepts a plan file written with backslashes and Windows line endings', () => {
  const dir = capstoneRepo({ planned: 'src\\check-links.js\r\nsrc\\cli.js\r\ntest\\links.test.js\r\n' });
  try {
    const { code, out } = check(['b-capstone', '--dir', dir]);
    assert.equal(code, 0, out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the Beginner capstone fails when files had changed before approval, and says how to start clean', () => {
  const dir = capstoneRepo({ before: ' M src/cli.js\n' });
  try {
    const { code, out } = check(['b-capstone', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /before you approved the plan: src\/cli\.js/);
    assert.match(out, /Commit or stash them/);
    assert.match(out, /plan mode/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the Beginner capstone fails when the commit changes a file the plan did not name, and says what to fix', () => {
  const dir = capstoneRepo({ planned: 'src/check-links.js\nsrc/cli.js\n' });
  try {
    const { code, out } = check(['b-capstone', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /test\/links\.test\.js/);
    assert.match(out, /add them to `\.practice\/capstone-plan\.txt`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the Beginner capstone fails when the test is not in the fix commit, and says to commit them together', () => {
  const dir = capstoneRepo({ withTest: false });
  try {
    const { code, out } = check(['b-capstone', '--dir', dir]);
    assert.equal(code, 1, out);
    assert.match(out, /no test file/);
    assert.match(out, /same commit as the fix/);
    assert.match(out, /git rev-parse HEAD > \.practice\/capstone-commit\.txt/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// JetBrains IDEs create .idea/ when they open a folder; the checks would
// count it as an uncommitted change.
test('the template keeps the .idea/ folder out of git', () => {
  const dir = repo({ '.gitignore': readFileSync(join(root, '.gitignore'), 'utf8'), '.idea/misc.xml': '<project/>\n' });
  try {
    const empty = join(dir, '.git', 'no-global-config');
    writeFileSync(empty, '');
    const env = { ...process.env, GIT_CONFIG_GLOBAL: empty, GIT_CONFIG_NOSYSTEM: '1' };
    const status = execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8', env });
    assert.equal(status.trim(), '?? .gitignore');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
