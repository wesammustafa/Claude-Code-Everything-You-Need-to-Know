// The upgrade script on throwaway copies in the old layout, after README's
// fetch and checkout lines against a throwaway template.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { rewriteProjectPackage, upgrade } from '../upgrade.mjs';

const OLD_PACKAGE = `{
  "name": "claude-code-practice",
  "scripts": {
    "test": "node --test",
    "test:checks": "node --test \\"checks/test/*.test.mjs\\"",
    "check": "node checks/run.mjs",
    "learn": "node learn/app.mjs"
  },
  "license": "MIT"
}
`;

const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.excludesFile=', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function write(dir, files) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
}

function repo(files) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'upgrade-')));
  git(dir, 'init', '-q', '-b', 'main');
  write(dir, files);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'init');
  return dir;
}

const template = () => repo({
  'checks/run.mjs': 'new run\n',
  'checks/upgrade.mjs': 'new upgrade\n',
  'learn/app.mjs': 'new app\n',
  'capstone/brief.md': 'new brief\n',
  'package.json': '{ "scripts": { "learn": "node learn/app.mjs" } }\n',
  '.gitignore': '.practice/\nnode_modules/\n',
  '.gitattributes': 'learn/** linguist-generated\n',
  '.github/workflows/progress.yml': 'new progress\n',
  'project/package.json': '{}\n',
});

const old = () => repo({
  'checks/run.mjs': 'old run\n',
  'checks/test/a.test.mjs': 'old test\n',
  'learn/app.mjs': 'old app\n',
  'learn/lessons/b-1.mjs': 'old lesson\n',
  'capstone/brief.md': 'old brief\n',
  'src/a.js': 'a\n',
  'test/a.test.js': 'test a\n',
  'package.json': OLD_PACKAGE,
  '.gitignore': '.practice/\nnode_modules/\nignored.log\n',
  'LICENSE': 'MIT\n',
  '.github/workflows/assert-checks.yml': 'old assert\n',
  '.github/workflows/progress.yml': 'old progress\n',
  '.github/workflows/mine.yml': 'the Learner\'s\n',
  '.github/readme/learn-lesson-complete.gif': 'gif',
});

// README's commands, but the fetch reads the throwaway template.
function checkout(copy, tpl) {
  git(copy, 'fetch', '-q', tpl, 'main');
  git(copy, 'checkout', '--no-overlay', 'FETCH_HEAD', '--', 'checks', 'capstone', 'learn');
  git(copy, 'checkout', 'FETCH_HEAD', '--', '.github/workflows/progress.yml', '.gitattributes');
}

const read = (dir, path) => readFileSync(join(dir, path), 'utf8');

function cleanup(...dirs) {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

test('rewriteProjectPackage runs check from project/, drops the root scripts and keeps the format', () => {
  assert.equal(rewriteProjectPackage(OLD_PACKAGE), `{
  "name": "claude-code-practice",
  "scripts": {
    "test": "node --test",
    "check": "node ../checks/run.mjs"
  },
  "license": "MIT"
}
`);
  assert.equal(rewriteProjectPackage('{\r\n\t"scripts": {}\r\n}'), '{\r\n\t"scripts": {\r\n\t\t"check": "node ../checks/run.mjs"\r\n\t}\r\n}');
});

test('the upgrade moves tracked, modified, untracked and ignored files into project/ as renames', () => {
  const [tpl, copy] = [template(), old()];
  try {
    write(copy, { 'src/a.js': 'a, edited\n', 'src/extra.js': 'untracked\n', 'src/ignored.log': 'ignored\n', 'CLAUDE.md': 'memory\n', '.claude/settings.json': '{}\n', 'notes.md': 'mine\n' });
    checkout(copy, tpl);
    const { code, lines } = upgrade(copy);
    assert.equal(code, 0, lines.join('\n'));
    assert.equal(read(copy, 'project/src/a.js'), 'a, edited\n');
    assert.equal(read(copy, 'project/src/extra.js'), 'untracked\n');
    assert.equal(read(copy, 'project/src/ignored.log'), 'ignored\n');
    assert.equal(read(copy, 'project/CLAUDE.md'), 'memory\n');
    assert.equal(read(copy, 'project/.claude/settings.json'), '{}\n');
    assert.equal(read(copy, 'project/LICENSE'), 'MIT\n');
    assert.equal(read(copy, 'project/.gitignore'), '.practice/\nnode_modules/\nignored.log\n');
    assert.equal(read(copy, 'project/package.json'), rewriteProjectPackage(OLD_PACKAGE));
    assert.equal(read(copy, 'notes.md'), 'mine\n');
    assert.equal(read(copy, '.gitignore'), '.practice/\nnode_modules/\n');
    assert.equal(read(copy, 'package.json'), '{ "scripts": { "learn": "node learn/app.mjs" } }\n');
    for (const gone of ['src', 'test', 'LICENSE', 'CLAUDE.md', '.claude']) assert.ok(!existsSync(join(copy, gone)), gone);
    const staged = git(copy, 'diff', '--cached', '--name-status', '-M').split('\n');
    assert.ok(staged.some((l) => /^R\d+\tsrc\/a\.js\tproject\/src\/a\.js$/.test(l)), staged.join('\n'));
    assert.ok(staged.includes('R100\ttest/a.test.js\tproject/test/a.test.js'), staged.join('\n'));
    assert.match(lines.join('\n'), /git status, then commit/);
  } finally {
    cleanup(tpl, copy);
  }
});

test('the lesson files under .practice/ move to project/, and the save and its backups stay', () => {
  const [tpl, copy] = [template(), old()];
  try {
    write(copy, { '.practice/learn.json': 'save', '.practice/learn.json.unreadable': 'b1', '.practice/learn.json.unreadable-2': 'b2', '.practice/b-2-plan.txt': 'plan' });
    checkout(copy, tpl);
    assert.equal(upgrade(copy).code, 0);
    assert.equal(read(copy, '.practice/learn.json'), 'save');
    assert.equal(read(copy, '.practice/learn.json.unreadable'), 'b1');
    assert.equal(read(copy, '.practice/learn.json.unreadable-2'), 'b2');
    assert.equal(read(copy, 'project/.practice/b-2-plan.txt'), 'plan');
    assert.ok(!existsSync(join(copy, '.practice/b-2-plan.txt')));
  } finally {
    cleanup(tpl, copy);
  }
});

test('the Terminal app\'s files go, the Learner\'s workflows stay, and nothing lingers in checks/ or learn/', () => {
  const [tpl, copy] = [template(), old()];
  try {
    write(copy, { 'checks/stray.mjs': 'untracked\n' });
    checkout(copy, tpl);
    assert.equal(upgrade(copy).code, 0);
    assert.equal(read(copy, '.github/workflows/mine.yml'), 'the Learner\'s\n');
    assert.equal(read(copy, '.github/workflows/progress.yml'), 'new progress\n');
    for (const gone of ['.github/workflows/assert-checks.yml', '.github/readme/learn-lesson-complete.gif', 'checks/stray.mjs', 'checks/test', 'learn/lessons'])
      assert.ok(!existsSync(join(copy, gone)), gone);
    assert.equal(read(copy, 'checks/run.mjs'), 'new run\n');
    assert.equal(read(copy, '.practice/upgrade-kept/checks/stray.mjs'), 'untracked\n');
  } finally {
    cleanup(tpl, copy);
  }
});

test('a run that stopped partway finishes when run again', () => {
  const [tpl, copy] = [template(), old()];
  try {
    checkout(copy, tpl);
    mkdirSync(join(copy, 'project'));
    git(copy, 'mv', '--', 'src', 'project/src');
    const done = upgrade(copy);
    assert.equal(done.code, 0, done.lines.join('\n'));
    assert.equal(read(copy, 'project/src/a.js'), 'a\n');
    assert.ok(!existsSync(join(copy, 'test')) && existsSync(join(copy, 'project/test')));
    assert.match(read(copy, 'project/package.json'), /\.\.\/checks\/run\.mjs/);
  } finally {
    cleanup(tpl, copy);
  }
});

test('the upgrade refuses, changing nothing, before the checkout and when project/ exists; a second run says it is done', () => {
  const [tpl, copy] = [template(), old()];
  try {
    git(copy, 'fetch', '-q', tpl, 'main');
    const before = upgrade(copy);
    assert.equal(before.code, 1);
    assert.match(before.lines.join('\n'), /checks\/run\.mjs is not the template's/);
    assert.ok(existsSync(join(copy, 'src/a.js')) && !existsSync(join(copy, 'project')));
    checkout(copy, tpl);
    write(copy, { 'project/keep.txt': 'x' });
    const blocked = upgrade(copy);
    assert.equal(blocked.code, 1);
    assert.match(blocked.lines.join('\n'), /project\/ already exists/);
    assert.ok(existsSync(join(copy, 'src/a.js')));
    rmSync(join(copy, 'project'), { recursive: true });
    assert.equal(upgrade(copy).code, 0);
    const again = upgrade(copy);
    assert.equal(again.code, 0);
    assert.match(again.lines.join('\n'), /already upgraded/);
  } finally {
    cleanup(tpl, copy);
  }
});

test('the upgrade refuses without FETCH_HEAD', () => {
  const copy = old();
  try {
    const { code, lines } = upgrade(copy);
    assert.equal(code, 1);
    assert.match(lines.join('\n'), /FETCH_HEAD is missing/);
  } finally {
    cleanup(copy);
  }
});

test('a linked worktree under .claude/worktrees still works after the move', () => {
  const [tpl, copy] = [template(), old()];
  try {
    git(copy, 'worktree', 'add', '-q', '-b', 'x', '.claude/worktrees/x');
    checkout(copy, tpl);
    assert.equal(upgrade(copy).code, 0);
    const list = git(copy, 'worktree', 'list', '--porcelain');
    assert.match(list, new RegExp(`worktree ${join(copy, 'project/.claude/worktrees/x').replace(/\\/g, '/').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n`));
    assert.doesNotMatch(list, /prunable/);
    assert.equal(git(join(copy, 'project/.claude/worktrees/x'), 'rev-parse', '--abbrev-ref', 'HEAD').trim(), 'x');
  } finally {
    cleanup(tpl, copy);
  }
});
