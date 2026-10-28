// The Intermediate capstone: get the practice repository ready for a new
// teammate, as capstone/intermediate-brief.md asks. The brief states needs,
// not mechanisms, so the check verifies outcomes and accepts any sound way to
// reach them: samples/ is protected by a committed Edit deny rule or by a
// PreToolUse hook that fails closed. It checks what each Intermediate Exit
// statement leaves in files and git, and the delegation log of the review the
// bug fix gets; picking a model and effort, and seeing each piece work in a
// session, are self-assessed on the capstone page.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { frontmatter } from '../frontmatter.mjs';
import { committedMode, editWriteScripts, missingJq, runCommitted } from '../hooks.mjs';
import { items as memory } from './i-2.mjs';
import { items as scopes } from './i-4.mjs';
import { items as mcp } from './i-7.mjs';
import { items as plugins } from './i-8.mjs';
import { testsPass, nothingUncommitted } from './b-3.mjs';

export const title = 'Intermediate capstone';

// Tools that only read code, as lesson 6 narrows them.
const READ_ONLY = new Set(['Read', 'Grep', 'Glob', 'LSP']);
const list = (value) => (Array.isArray(value) ? value : String(value ?? '').split(',')).map((t) => t.trim()).filter(Boolean);

function committedFiles(repo, dir, suffix) {
  try {
    return repo.git('ls-tree', '-r', '--name-only', 'HEAD', '--', dir).split('\n').filter((f) => f.endsWith(suffix));
  } catch {
    return [];
  }
}

function committedFile(repo, path) {
  try {
    return frontmatter(repo.git('show', `HEAD:${path}`));
  } catch {
    return null;
  }
}

const words = (text) => String(text ?? '').split(/\s+/).filter((w) => w && w !== 'TODO').length;

// The brief's skill runs the link checker: `npm run linkcheck` or src/cli.js.
const LINKCHECK = /npm run linkcheck|src\/cli\.js/;

const skill = {
  text: 'a committed project skill that runs the link checker by name and can load on its own',
  check(repo) {
    const ok = committedFiles(repo, '.claude/skills', '/SKILL.md').some((path) => {
      const file = committedFile(repo, path);
      const f = file?.fields;
      return f && LINKCHECK.test(file.body) && words(f.description) >= 8 && String(f['disable-model-invocation']) !== 'true' && String(f['user-invocable']) !== 'false';
    });
    return ok ? true : 'Commit a skill in `.claude/skills/<name>/SKILL.md` whose body runs the link checker (`npm run linkcheck -- <folder>`), with a description of what it does and when to use it, and no `disable-model-invocation: true` (lesson 1).';
  },
};

// The names of the committed subagents that review changes with tools that
// only read code.
function reviewers(repo) {
  return committedFiles(repo, '.claude/agents', '.md').flatMap((path) => {
    const f = committedFile(repo, path)?.fields;
    const tools = list(f?.tools);
    return f?.name && /review/i.test(`${f.name} ${f.description}`) && words(f.description) >= 5 && tools.length && tools.every((t) => READ_ONLY.has(t)) ? [String(f.name)] : [];
  });
}

const reviewer = {
  text: 'a committed reviewer subagent with only tools that read code',
  check(repo) {
    return reviewers(repo).length ? true : 'Commit a reviewer in `.claude/agents/`: a subagent whose name or description says it reviews changes, with a `tools` list of tools that only read code, such as `Read, Grep, Glob`, as in lesson 6.';
  },
};

// The review the bug fix gets, logged by the capstone's copy of lesson 6's
// SubagentStart hook.
const delegated = {
  text: '`.practice/i-capstone-agents.txt` shows Claude delegating to the committed reviewer',
  local: true,
  check(repo) {
    const log = repo.read('.practice/i-capstone-agents.txt');
    if (log === null) return 'There is no delegation log. Start a session with `claude --settings .practice/i-capstone-hook.json`, the hook file the capstone gives, and have your reviewer review the fix.';
    const ran = log.split(/\r?\n/).map((l) => l.trim());
    return reviewers(repo).some((name) => ran.includes(name)) ? true : 'The log names no committed reviewer. In a session started with the hook file, ask Claude to have your reviewer review the fix.';
  },
};

function committedSettings(repo) {
  try {
    return JSON.parse(repo.git('show', 'HEAD:.claude/settings.json'));
  } catch {
    return null;
  }
}

// A deny rule for Claude's file-editing tools on the samples/ folder, written
// as lesson 4 writes rules: relative, anchored at the settings source, or at
// any depth.
const SAMPLES_DENY = /^Edit\((?:\.\/|\/|\*\*\/)?samples\/(?:\*\*)?\)$/;

const hook = {
  text: 'Claude\'s file-editing tools can\'t change `samples/` but can edit the rest: a committed `Edit` deny rule, or a fail-closed `PreToolUse` hook',
  check(repo) {
    const settings = committedSettings(repo);
    if ((settings?.permissions?.deny ?? []).some((rule) => SAMPLES_DENY.test(rule))) return true;
    const scripts = editWriteScripts(settings).filter((s) => committedMode(repo, s) === '100755');
    if (!scripts.length) return 'Keep Claude out of samples/: commit an `Edit` deny rule such as `Edit(./samples/**)` in `.claude/settings.json`, as in lesson 4, or an executable `PreToolUse` hook for `Edit|Write`, as in lesson 5.';
    const samples = scripts.map((s) => runCommitted(repo, s, 'samples/guide.md'));
    const source = scripts.flatMap((s) => [runCommitted(repo, s, 'src/cli.js'), runCommitted(repo, s, 'src/samples.js')]);
    if ([...samples, ...source].some(missingJq)) return 'A hook needs `jq`, which isn\'t installed. Install it and run the check again.';
    const blocking = scripts.filter((_, i) => samples[i]?.status === 2);
    if (!blocking.length) return 'No Edit|Write hook exits with 2 for `samples/guide.md`, so Claude can still edit samples/.';
    if (!source.every((r) => r?.status === 0)) return 'An Edit|Write hook also blocks `src/cli.js` or `src/samples.js`: block the samples/ folder only.';
    // The same scripts, counting only the hook entries that fail closed.
    const groups = settings.hooks.PreToolUse.map((g) => ({ ...g, hooks: (g?.hooks ?? []).filter((h) => h?.onFailure === 'block') }));
    const closed = editWriteScripts({ hooks: { PreToolUse: groups } });
    return blocking.some((s) => closed.includes(s)) ? true : 'Add `"onFailure": "block"` to the hook that protects samples/, as in lesson 5, so a hook that can\'t run blocks the edit instead of letting it through.';
  },
};

// The brief puts the sandbox in the team's committed settings.
const sandbox = {
  text: 'the committed `.claude/settings.json` turns the sandbox on, and `.claude/settings.local.json` stays out of git',
  check(repo) {
    if (repo.git('ls-files', '--', '.claude/settings.local.json')) return '.claude/settings.local.json is committed, but it holds your own settings. Run `git rm --cached .claude/settings.local.json`, commit, and add it to `.gitignore`.';
    return committedSettings(repo)?.sandbox?.enabled === true ? true : 'The committed .claude/settings.json doesn\'t turn the sandbox on. Add `"sandbox": {"enabled": true}` to it and commit: `/sandbox` saves to your local file, which teammates don\'t get.';
  },
};

// Run the committed CLI in a disposable local copy. A working-tree-only fix
// must not satisfy the handoff that the teammate receives from git.
const bugFix = {
  text: 'the committed CLI reports malformed percent escapes as broken links and still resolves valid encoded paths',
  check(repo) {
    let sources;
    try {
      const paths = repo.gitLocal('ls-tree', '-r', '--name-only', 'HEAD', '--', 'src').split('\n').filter(path => path.endsWith('.js'));
      if (!paths.includes('src/cli.js')) throw new Error('missing CLI');
      sources = paths.map(path => [path, repo.gitLocal('show', `HEAD:${path}`)]);
    } catch {
      return 'Commit the CLI source for the malformed percent fix. See capstone/intermediate-bug.md.';
    }
    const dir = mkdtempSync(join(tmpdir(), 'intermediate-bug-'));
    try {
      writeFileSync(join(dir, 'package.json'), '{"type":"module"}\n');
      for (const [path, text] of sources) {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), text);
      }
      const fixture = join(dir, 'fixture');
      mkdirSync(fixture);
      writeFileSync(join(fixture, 'existing file.md'), '# Existing\n');
      const cases = [
        { markdown: '[bad](bad%.md)\n[valid](existing%20file.md)\n[bad UTF-8](bad%E0.md)\n[later](missing.md)\n', status: 1, targets: ['bad%.md', 'bad%E0.md', 'missing.md'] },
        { markdown: '[valid](existing%20file.md)\n', status: 0, targets: [] },
      ];
      for (const example of cases) {
        writeFileSync(join(fixture, 'guide.md'), example.markdown);
        const run = spawnSync(process.execPath, [join(dir, 'src', 'cli.js'), fixture], { cwd: dir, encoding: 'utf8', timeout: 5_000, maxBuffer: 128 * 1024 });
        if (run.error) return `The committed CLI could not run (${run.error.code}). Fix the malformed percent case without hanging.`;
        const report = run.stdout.split(/\r?\n/).filter(line => line.includes(': broken link to '));
        if (run.status !== example.status || run.stderr.trim() || report.length !== example.targets.length ||
          !example.targets.every(target => report.some(line => line.endsWith(`: broken link to ${target}`)))) {
          return 'The committed CLI mishandles malformed percent links or valid encoded paths. Recheck capstone/intermediate-bug.md.';
        }
      }
      return true;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
};

// An item reused from a lesson sends the learner back to that lesson's page
// when its file is missing or lacks what the lesson adds; here the capstone
// asks for it. Each swap is a [from, to] pair of message text. The wrapper
// shows the reused check's source, so the tests that read a check's code
// (its ways to fail, and whether it starts a process) still read that check.
function asCapstone(item, ...swaps) {
  const check = (repo) => {
    const outcome = item.check(repo);
    return typeof outcome === 'string' ? swaps.reduce((text, [from, to]) => text.replace(from, to), outcome) : outcome;
  };
  check.toString = () => item.check.toString();
  return { ...item, check };
}

const pinnedServer = asCapstone(mcp[0],
  ['Save the partial file from the lesson\'s Your turn there.', 'Write the one the capstone asks for there, as in lesson 7.'],
  ['Add it under `mcpServers`, as in the lesson.', 'Add it under `mcpServers`, as in lesson 7.']);
const setupPlugin = asCapstone(plugins[0], ['Add the `enabledPlugins` entry from the lesson and commit it.', 'Add the `enabledPlugins` entry the capstone asks for and commit it, as in lesson 8.']);
const teamRules = asCapstone(scopes[0], ['Save the partial file from the lesson\'s Your turn there.', 'Write the team settings the capstone asks for there, as in lesson 4.']);
const imports = asCapstone(memory[0], ['Commit the one you organize in this lesson.', 'Commit the one the capstone asks for, as in lesson 2.']);

// The items that start a process keep their places, 1, 9 and 11, which the
// app's list of slow items names.
export const items = [skill, hook, reviewer, pinnedServer, setupPlugin, teamRules, sandbox, imports, memory[1], testsPass, nothingUncommitted, bugFix, delegated, scopes[2]];
