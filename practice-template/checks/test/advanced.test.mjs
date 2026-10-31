// The Advanced checks, run the way a Learner runs them: against their own
// repository with --dir.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { claudeArgWords, parseYaml, readWorkflow as readActions } from '../actions.mjs';
import { parseClaudeArgs, ruleList, scriptCalls } from '../claude-args.mjs';
import { callHints, RESULT, SCRIPT, savedRun, scriptBehavior, scriptCall } from '../lessons/a-4.mjs';
import { chosenWorkflow, dispatchedRun, pinnedWorkflow, RUNS, WORKFLOW, workflowLimits } from '../lessons/a-5.mjs';
import { movedComponent, personalFiles, sharedSettings, strictValidation, teamMarketplace, validatedMarketplace, VALIDATE } from '../lessons/a-6.mjs';
import { boundedScript, narrowRules, runLimits, SCRIPT as RUNNER, SLICE, sliceRun, stops, strictSandbox, wideReason } from '../lessons/a-7.mjs';
import { CI, items as capstoneItems, noCommittedKey, REVIEW as REVIEW_WORKFLOW, RUN as CAPSTONE_RUN, SNAPSHOT as CAPSTONE_LISTING } from '../lessons/a-capstone.mjs';
import { nameProblem } from '../marketplace.mjs';
import { openRepo } from '../repo.mjs';
import { findBash, notRun, runStubbed, scratchPath, scrubbed, STUB_SESSION, stubText, within } from '../stub-claude.mjs';
import { readWorkflow } from '../workflow-script.mjs';
import { parseWorktrees } from '../worktrees.mjs';
import { check, commit, repo, setMode, withRepo, write } from './helpers.mjs';

const git = (dir, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const IGNORE = '.practice/\n.claude/worktrees/\n';
const LISTING = '.practice/a-1-worktrees.txt';

// A repository after lesson a-1: worktrees made where `claude --worktree`
// makes them, one commit in each, the listing saved while all of them
// existed, the first two branches merged, and the worktrees removed. The
// options change one step: `gitignore` is committed and `pending` written
// over it afterwards; `exclude` replaces .git/info/exclude; `globalIgnore`
// becomes the repository's excludes file, standing in for a global one;
// `listing` rewrites the saved listing, or drops it by returning null.
function parallelRepo({
  gitignore = IGNORE, pending, exclude, globalIgnore, files = {}, under = '.claude/worktrees',
  names = ['docs-pass', 'test-pass'], saveBefore = false, merge = 'each', keep = [], lock = [], reason, prune = [],
  listing = (text) => text, commits = 1,
} = {}) {
  return () => {
    const dir = repo({ ...(gitignore === null ? {} : { '.gitignore': gitignore }), 'README.md': '# demo\n', ...files });
    if (exclude) write(dir, { '.git/info/exclude': exclude });
    if (globalIgnore) {
      write(dir, { '.git/global-ignore': globalIgnore });
      git(dir, 'config', 'core.excludesFile', join(dir, '.git', 'global-ignore'));
    }
    commit(dir, 'Start');
    if (pending) write(dir, { '.gitignore': pending });
    const branch = (name) => `worktree-${name.replace(/\s+/g, '-')}`;
    const path = (name) => join(dir, under, name);
    for (const name of names) git(dir, 'worktree', 'add', '-q', '-b', branch(name), `${under}/${name}`);
    const save = () => {
      const text = listing(`${git(dir, 'worktree', 'list', '--porcelain')}\n`, dir);
      if (text !== null) write(dir, { [LISTING]: text });
    };
    if (saveBefore) save();
    for (const name of names) {
      for (let k = 1; k <= commits; k++) {
        write(path(name), { [`work/${branch(name)}.txt`]: `${name}\n`.repeat(k) });
        commit(path(name), `Work in ${name}${k > 1 ? `, part ${k}` : ''}`);
      }
    }
    if (!saveBefore) save();
    const [first, second] = names.map(branch);
    if (merge === 'each') {
      git(dir, 'merge', '-q', '--ff-only', first);
      git(dir, 'merge', '-q', '--no-ff', '--no-edit', second);
    } else if (merge === 'octopus') {
      git(dir, 'merge', '-q', '--no-edit', first, second);
    } else if (merge === 'one') {
      git(dir, 'merge', '-q', '--ff-only', first);
    } else if (merge === 'squash') {
      for (const b of [first, second]) {
        git(dir, 'merge', '-q', '--squash', b);
        git(dir, 'commit', '-q', '-m', `Squash ${b}`);
      }
    } else if (merge === 'rebase') {
      // A rebase onto the branch, then a fast-forward, copies each commit.
      for (const b of [first, second]) git(dir, 'cherry-pick', b);
    }
    for (const name of lock) git(dir, 'worktree', 'lock', ...(reason ? ['--reason', reason] : []), `${under}/${name}`);
    for (const name of prune) rmSync(path(name), { recursive: true, force: true });
    for (const name of names) if (![...keep, ...lock, ...prune].includes(name)) git(dir, 'worktree', 'remove', `${under}/${name}`);
    return dir;
  };
}

const a1 = (dir) => check(['a-1', '--dir', dir]);

test('a-1 passes for two worktree branches that split, merged one fast-forward and one with a merge commit, and removed', () => {
  withRepo(parallelRepo(), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 0, out);
  });
});

test('a-1 passes for both branches merged at once', () => {
  withRepo(parallelRepo({ merge: 'octopus' }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 0, out);
  });
});

test('a-1 accepts the rule written with or without its slashes, or in .claude/.gitignore', () => {
  for (const options of [
    { gitignore: '.practice/\n/.claude/worktrees/\n' },
    { gitignore: '.practice/\n.claude/worktrees\n' },
    { gitignore: '.practice/\n', files: { '.claude/.gitignore': 'worktrees/\n' } },
  ]) {
    withRepo(parallelRepo(options), (dir) => {
      const { code, out } = a1(dir);
      assert.equal(code, 0, `${JSON.stringify(options)}: ${out}`);
    });
  }
});

test('a-1 is not fooled by a global excludes file that ignores .claude/', () => {
  withRepo(parallelRepo({ globalIgnore: '.claude/\n' }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 0, out);
  });
  withRepo(parallelRepo({ gitignore: '.practice/\n', globalIgnore: '.claude/\n' }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 1, out);
    assert.match(out, /No committed `\.gitignore` ignores `\.claude\/worktrees\/`/);
    assert.match(out, /global git excludes file doesn't count/);
  });
});

test('a-1 fails when only .git/info/exclude ignores the folder', () => {
  withRepo(parallelRepo({ gitignore: '.practice/\n', exclude: '.practice/\n.claude/worktrees/\n' }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 1, out);
    assert.match(out, /Only `\.git\/info\/exclude` ignores/);
  });
});

test('a-1 reads the committed .gitignore when a rule in .git/info/exclude shadows it', () => {
  withRepo(parallelRepo({ exclude: '.practice/\n.claude/\n' }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 0, out);
  });
  withRepo(parallelRepo({ gitignore: '.practice/\n.claude/\n', exclude: '.practice/\n.claude/\n' }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 1, out);
    assert.match(out, /also ignores `\.claude\/settings\.json`/);
  });
});

test('a-1 fails while the rule is not committed, and says how to commit it', () => {
  withRepo(parallelRepo({ gitignore: '.practice/\n', pending: IGNORE }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 1, out);
    assert.match(out, /isn't committed\. Run `git add \.gitignore`/);
  });
});

test('a-1 still passes when the committed rule is there and .gitignore has another change pending', () => {
  withRepo(parallelRepo({ pending: `${IGNORE}dist/\n` }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 0, out);
  });
});

test('a-1 fails for a rule that also ignores the rest of .claude/, quoting it', () => {
  for (const [gitignore, pattern] of [
    ['.practice/\n.claude/\n', '.claude/'],
    ['.practice/\n.claude/*\n', '.claude/*'],
    ['.practice/\n.claude/\n!.claude/settings.json\n', '.claude/'],
    ['.practice/\n.claude/worktrees/\n.claude/*.json\n', '.claude/*.json'],
  ]) {
    withRepo(parallelRepo({ gitignore }), (dir) => {
      const { code, out } = a1(dir);
      assert.equal(code, 1, `${gitignore}: ${out}`);
      assert.ok(out.includes(`\`${pattern}\`, also ignores \`.claude/settings.json\``), out);
      assert.match(out, /Ignore only `\.claude\/worktrees\/`/);
    });
  }
});

test('a-1 says how to save the listing when there is none, and does not pass the cleanup without it', () => {
  withRepo(parallelRepo({ listing: () => null }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 1, out);
    assert.match(out, /run `git worktree list --porcelain > \.practice\/a-1-worktrees\.txt` from your main checkout/);
    assert.match(out, /FAIL {2}neither of those worktrees still exists/);
    assert.match(out, /There is no `\.practice\/a-1-worktrees\.txt`/);
  });
});

test('a-1 fails for a listing with only the main checkout in it', () => {
  withRepo(parallelRepo({ listing: (text) => `${text.split('\n\n')[0]}\n` }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 1, out);
    assert.match(out, /lists no worktree under `\.claude\/worktrees\/`/);
    assert.match(out, /claude --worktree <name>/);
  });
});

test('a-1 counts only the worktrees under .claude/worktrees/, and says why', () => {
  withRepo(parallelRepo({ gitignore: `${IGNORE}wt/\n`, under: 'wt' }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 1, out);
    assert.match(out, /It also lists `[^`]*\/wt\/docs-pass`/);
    assert.match(out, /counts only the worktrees `claude --worktree <name>` makes/);
  });
});

test('a-1 fails for a listing saved before both sessions committed', () => {
  const oneCommitted = (text, dir) => text.replace(git(dir, 'rev-parse', 'worktree-test-pass'), git(dir, 'rev-parse', 'HEAD'));
  for (const options of [{ saveBefore: true }, { listing: oneCommitted }]) {
    withRepo(parallelRepo(options), (dir) => {
      const { code, out } = a1(dir);
      assert.equal(code, 1, out);
      assert.match(out, /saved before both sessions committed/);
    });
  }
});

test('a-1 fails for a listing that names a commit this repository does not have', () => {
  const elsewhere = (text, dir) => text.replace(git(dir, 'rev-parse', 'worktree-docs-pass'), 'f'.repeat(40));
  withRepo(parallelRepo({ listing: elsewhere }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 1, out);
    assert.match(out, /names commit fffffff, which isn't in this repository/);
  });
});

test('a-1 fails while one branch\'s change is not in the branch, naming it', () => {
  withRepo(parallelRepo({ merge: 'one' }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 1, out);
    assert.match(out, /The change on `worktree-test-pass` isn't in your current branch/);
    assert.match(out, /`git merge worktree-test-pass`, or a rebase or a squash merge/);
  });
});

test('a-1 passes for squash merges and rebases, which bring the changes in as copies', () => {
  for (const merge of ['squash', 'rebase']) {
    withRepo(parallelRepo({ merge }), (dir) => {
      const { code, out } = a1(dir);
      assert.equal(code, 0, `${merge}: ${out}`);
    });
  }
});

test('a-1 passes for a squash merge of a branch with two commits, whose one patch is the branch\'s whole change', () => {
  withRepo(parallelRepo({ merge: 'squash', commits: 2 }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 0, out);
  });
});

test('a-1 fails when neither change is in the branch, naming both', () => {
  withRepo(parallelRepo({ merge: 'none' }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 1, out);
    assert.match(out, /The changes on `worktree-docs-pass` and `worktree-test-pass` aren't in your current branch/);
  });
});

test('a-1 passes when any two of the listed worktrees split and are merged, and leaves a third one alone', () => {
  withRepo(parallelRepo({ names: ['docs-pass', 'test-pass', 'spare'], keep: ['spare'] }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 0, out);
  });
});

test('a-1 fails while a worktree still exists, with the command that removes it', () => {
  withRepo(parallelRepo({ keep: ['test-pass'] }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 1, out);
    assert.match(out, /PASS {2}`\.practice\/a-1-worktrees\.txt` lists two worktrees/);
    assert.match(out, /`\.claude\/worktrees\/test-pass` still exists: once its branch is merged, run `git worktree remove \.claude\/worktrees\/test-pass` from your main checkout/);
  });
});

test('a-1 says to exit any session in a locked worktree it can\'t tell is a running Claude Code session\'s, and to unlock only if git still refuses; and to prune one whose folder is gone', () => {
  withRepo(parallelRepo({ lock: ['test-pass'] }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 1, out);
    assert.match(out, /`\.claude\/worktrees\/test-pass` still exists and is locked: exit any Claude Code session open in it\. Once its branch is merged, run `git worktree remove \.claude\/worktrees\/test-pass` from your main checkout, after `git worktree unlock` if git says it is still locked\./);
    // It can't see every session's lock, so it never says none is running.
    assert.doesNotMatch(out, /no Claude Code session/);
  });
  // A Claude Code session's lock whose process has exited.
  const gone = spawnSync(process.execPath, ['-e', '']).pid;
  withRepo(parallelRepo({ lock: ['test-pass'], reason: `claude session test-pass (pid ${gone} start Sun Oct 25 10:43:31 2026)` }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 1, out);
    assert.match(out, /still exists and is locked: exit any Claude Code session open in it\. Once its branch is merged, run `git worktree remove [^`]+` from your main checkout, after `git worktree unlock` if git says it is still locked\./);
    assert.doesNotMatch(out, /no Claude Code session/);
  });
  withRepo(parallelRepo({ prune: ['test-pass'] }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 1, out);
    assert.match(out, /whose folder is gone: run `git worktree prune`/);
  });
});

test('a-1 says to exit a Claude Code session still running in a worktree once its branch is merged, never to unlock it', () => {
  // This test's own process stands in for the session, so its pid is alive.
  withRepo(parallelRepo({ lock: ['test-pass'], reason: `claude session test-pass (pid ${process.pid} start Sun Oct 25 10:43:31 2026)` }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 1, out);
    assert.match(out, /`\.claude\/worktrees\/test-pass` still exists, and the Claude Code session in it is still running: once its branch is merged, run `\/exit` in that session and choose to remove the worktree, or keep it and then run `git worktree remove \.claude\/worktrees\/test-pass` from your main checkout\./);
    assert.doesNotMatch(out, /unlock/);
  });
});

test('a-1 reads a path with spaces, and quotes it in the command it gives', () => {
  withRepo(parallelRepo({ names: ['docs pass', 'test-pass'], keep: ['docs pass'] }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 1, out);
    assert.match(out, /PASS {2}`\.practice\/a-1-worktrees\.txt` lists two worktrees/);
    assert.match(out, /run `git worktree remove "\.claude\/worktrees\/docs pass"`/);
  });
});

// The listing as Windows PowerShell 5.1 saves it: UTF-16 with a byte-order
// mark and CRLF line ends, with Windows paths, plus records for a detached,
// locked worktree outside .claude/worktrees/ and a bare repository.
function fromWindows(text, dir) {
  const head = git(dir, 'rev-parse', 'HEAD');
  const records = text.replaceAll(realpathSync(dir), 'C:/Users/Jo Doe/repo').trimEnd().split('\n')
    .map((line) => (line.startsWith('worktree ') ? line.replace(/\//g, '\\') : line));
  records.push('', 'worktree C:\\Users\\Jo Doe\\review', `HEAD ${head}`, 'detached', 'locked "kept by\\na review tool"', '', 'worktree C:\\Users\\Jo Doe\\mirror.git', 'bare', '');
  return Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(records.join('\r\n'), 'utf16le')]);
}

test('a-1 reads a listing saved by Windows PowerShell, with Windows paths and extra records', () => {
  withRepo(parallelRepo({ listing: fromWindows }), (dir) => {
    const { code, out } = a1(dir);
    assert.equal(code, 0, out);
  });
});

test('the worktree parser keeps each record\'s flags, with a lock\'s or prune\'s reason, and drops refs/heads/', () => {
  const sha = 'a'.repeat(40);
  const text = [
    `worktree /repo`, `HEAD ${sha}`, 'branch refs/heads/main', '',
    `worktree /repo/.claude/worktrees/x y`, `HEAD ${sha}`, 'detached', 'locked', '',
    `worktree /repo/.claude/worktrees/z`, `HEAD ${sha.toUpperCase()}`, 'branch refs/heads/worktree-z', 'prunable gitdir file points to non-existent location', '',
    'worktree /bare.git', 'bare', '',
  ].join('\r\n');
  const [main, xy, z, bare] = parseWorktrees(text);
  assert.deepEqual(main, { path: '/repo', head: sha, branch: 'main', bare: false, detached: false, locked: false, prunable: false });
  assert.deepEqual(xy, { path: '/repo/.claude/worktrees/x y', head: sha, branch: null, bare: false, detached: true, locked: true, prunable: false });
  assert.equal(z.head, sha);
  assert.equal(z.branch, 'worktree-z');
  assert.equal(z.prunable, 'gitdir file points to non-existent location');
  assert.equal(parseWorktrees('worktree /repo/.claude/worktrees/a\nlocked claude session a (pid 7 start Sun Oct 25 10:43:31 2026)\n')[0].locked, 'claude session a (pid 7 start Sun Oct 25 10:43:31 2026)');
  assert.deepEqual([bare.bare, bare.head], [true, null]);
});

test('a-1 fails on an unsolved repository and passes on a solved one, as the template\'s assertions expect', () => {
  withRepo(() => {
    const dir = repo({ '.gitignore': '.practice/\nnode_modules/\n', 'README.md': '# demo\n' });
    commit(dir, 'Start');
    return dir;
  }, (dir) => {
    const { code, out } = check(['a-1', '--assert', 'fail', '--dir', dir]);
    assert.equal(code, 0, out);
  });
  withRepo(parallelRepo(), (dir) => {
    const { code, out } = check(['a-1', '--assert', 'pass', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

// A repository after lesson a-2: the five choices written down, and the log
// Intermediate lesson 6's SubagentStart hook wrote, first for lesson 6's
// test-gaps and then while job 1 ran as parallel subagents, one
// `agent_type` line per start. The options replace a file, or leave it out
// when null.
const CHOSEN = [
  '1: subagents because three files, one reviewer each, checked once, and only a short list comes back',
  '2: workflow because it covers the whole codebase, confirms each finding and runs again every release',
  '3: main conversation because the rename, its edits and the build share one context and land as one commit',
  '4: subagents because each suspect is checked on its own and reported back to me',
  '5: /batch because each package changes, tests and lands on its own',
  '',
].join('\n');
const STARTS = 'test-gaps\ngeneral-purpose\ngeneral-purpose\nExplore\n';
const LOG_HOOK = `jq -r '.agent_type' >> "$CLAUDE_PROJECT_DIR/.practice/i-6-agents.txt"`;
const HOOK_FILE = JSON.stringify({ hooks: { SubagentStart: [{ hooks: [{ type: 'command', command: LOG_HOOK }] }] } });

function patternRepo({ choices = CHOSEN, log = STARTS, hook = HOOK_FILE } = {}) {
  return () => {
    const dir = repo({ 'README.md': '# demo\n' });
    commit(dir, 'Start');
    for (const [path, text] of [['.practice/a-2-choices.md', choices], ['.practice/i-6-agents.txt', log], ['.practice/i-6-hook.json', hook]]) {
      if (text !== null) write(dir, { [path]: text });
    }
    return dir;
  };
}

const a2 = (dir) => check(['a-2', '--dir', dir]);
const choicesOf = (picks) => picks.map((p, i) => `${i + 1}: ${p} because it fits`).join('\n');

test('a-2 passes for the five patterns that fit and a log with three subagents after test-gaps', () => {
  withRepo(patternRepo(), (dir) => {
    const { code, out } = a2(dir);
    assert.equal(code, 0, out);
    assert.match(out, /2 of 2 passed/);
  });
});

test('a-2 reads the log lesson 6\'s hook writes, leaving out lesson 6\'s test-gaps', () => {
  withRepo(patternRepo({ log: null }), (dir) => {
    const hook = (type) => execFileSync('sh', ['-c', LOG_HOOK], {
      cwd: dir,
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
      input: JSON.stringify({ session_id: 'abc123', cwd: dir, hook_event_name: 'SubagentStart', agent_id: `agent-${type}`, agent_type: type }),
    });
    hook('test-gaps');
    hook('Explore');
    let { code, out } = a2(dir);
    assert.equal(code, 1, out);
    assert.match(out, /shows one subagent starting, and job 1 needs at least two subagents/);
    hook('fork');
    ({ code, out } = a2(dir));
    assert.equal(code, 0, out);
  });
});

test('a-2 counts an id once where a hook also logs ids, as a resumed subagent logs its id again', () => {
  withRepo(patternRepo({ log: 'agent-a1\tExplore\nagent-a1\tExplore\n' }), (dir) => {
    const { code, out } = a2(dir);
    assert.equal(code, 1, out);
    assert.match(out, /shows one subagent starting/);
  });
  withRepo(patternRepo({ log: 'agent-a1\tExplore\nagent-a2\tExplore\n' }), (dir) => {
    assert.equal(a2(dir).code, 0);
  });
});

test('a-2 accepts the choices written as list items, with job labels, bold and other separators', () => {
  const choices = [
    '# My choices',
    '',
    'Job 1 - Subagents, one per file',
    '- **2:** dynamic workflow, since it reruns',
    '3. main session because it is one line',
    '4) parallel subagents, one per suspect',
    'Job #5: `/batch`: one worktree a package',
  ].join('\n');
  withRepo(patternRepo({ choices }), (dir) => {
    const { code, out } = a2(dir);
    assert.equal(code, 0, out);
  });
});

test('a-2 accepts a table, task boxes, articles and quoted pattern names', () => {
  for (const choices of [
    '| Job | Pattern | Why |\n|---|---|---|\n| 1 | subagents | few files |\n| 2 | workflow | rerun |\n| 3 | main conversation | shared context |\n| 4 | subagents | report back |\n| 5 | /batch | units |\n',
    '- [x] 1: `subagents` because few\n- [x] 2: a dynamic workflow because rerun\n- [x] 3: the main conversation because shared context\n- [x] 4: subagent because report back\n- [x] 5: the batch skill because units\n',
    '(1) "sub-agents" because few\n(2) Workflow because rerun\n(3) one conversation because shared context\n(4) sub-agents because report back\n(5) "/batch" because units\n',
  ]) {
    withRepo(patternRepo({ choices }), (dir) => {
      const { code, out } = a2(dir);
      assert.equal(code, 0, `${choices}\n${out}`);
    });
  }
});

test('a-2 skips other lines for a job once one of its lines names a pattern', () => {
  const jobs = '1. Before Friday\'s release, audit the three largest source files\n2. Add that audit to the release checklist\n3. Rename a helper that about 40 files call\n4. A checkout test fails about one run in ten\n5. Move every package under packages/\n\n';
  withRepo(patternRepo({ choices: `${jobs}${CHOSEN}` }), (dir) => {
    const { code, out } = a2(dir);
    assert.equal(code, 0, out);
  });
});

test('a-2 reads files saved with CRLF line ends, a UTF-8 byte-order mark, or as UTF-16 by Windows PowerShell', () => {
  const utf16 = (text) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text.replace(/\n/g, '\r\n'), 'utf16le')]);
  for (const options of [
    { choices: CHOSEN.replace(/\n/g, '\r\n'), log: STARTS.replace(/\n/g, '\r\n') },
    { choices: `\ufeff${CHOSEN}`, log: `\ufeff${STARTS}` },
    { choices: utf16(CHOSEN), log: utf16(STARTS) },
  ]) {
    withRepo(patternRepo(options), (dir) => {
      const { code, out } = a2(dir);
      assert.equal(code, 0, out);
    });
  }
});

test('a-2 says where to save the choices and in what form when there are none', () => {
  withRepo(patternRepo({ choices: null }), (dir) => {
    const { code, out } = a2(dir);
    assert.equal(code, 1, out);
    assert.match(out, /There is no `\.practice\/a-2-choices\.md`\. Write one line per job there, `<job number>: <pattern> because <reason>`/);
    assert.match(out, /PASS {2}`\.practice\/i-6-agents\.txt`/);
  });
  withRepo(patternRepo({ choices: 'subagents, then a workflow, then the main conversation, then a team\n' }), (dir) => {
    const { code, out } = a2(dir);
    assert.equal(code, 1, out);
    assert.match(out, /has no line that starts with a job number/);
  });
});

test('a-2 names each job that has no line', () => {
  const lines = CHOSEN.split('\n');
  withRepo(patternRepo({ choices: [lines[0], lines[1], lines[3], lines[4]].join('\n') }), (dir) => {
    const { code, out } = a2(dir);
    assert.equal(code, 1, out);
    assert.match(out, /has no line for job 3\. Add one per job/);
  });
  withRepo(patternRepo({ choices: [lines[0], lines[2]].join('\n') }), (dir) => {
    const { code, out } = a2(dir);
    assert.equal(code, 1, out);
    assert.match(out, /has no line for jobs 2, 4 and 5\./);
  });
});

test('a-2 names the chart question that settles each job picked wrongly, an agent team included', () => {
  const Q1 = 'Can one conversation do it without filling up?';
  const Q2 = 'Must the workers talk to each other?';
  const Q3 = 'Does it need cross-checked findings or a rerun?';
  const Q4 = 'Is it one large change that splits into independent units?';
  for (const [picks, expected] of [
    [['main conversation', 'main conversation', 'subagents', 'main conversation', 'main conversation'], [
      `Job 1 doesn't call for the main conversation. ${Q1} No: reading the three largest files in your conversation would crowd it`,
      `Job 2 doesn't call for the main conversation. ${Q1} No: it covers the whole codebase.`,
      `Job 3 doesn't call for subagents. ${Q1} Yes: each call site is a short read, and the rename must land as one change that keeps the build green.`,
      `Job 4 doesn't call for the main conversation. ${Q1} No: three investigations, each reading code and rerunning the test`,
      `Job 5 doesn't call for the main conversation. ${Q1} No: every package's change would pass through one conversation.`,
    ]],
    [['agent team', 'agent team', 'batch', 'agent team', 'agent team'], [
      `Job 1 doesn't call for an agent team. ${Q2} No: each reviewer checks its own file`,
      `Job 2 doesn't call for an agent team. ${Q2} No: each finding is confirmed against the code`,
      `Job 3 doesn't call for \`/batch\`. ${Q1} Yes:`,
      `Job 4 doesn't call for an agent team. ${Q2} No: each investigator checks one suspect and reports to you`,
      `Job 5 doesn't call for an agent team. ${Q2} No: each package is moved on its own.`,
    ]],
    [['workflow', 'subagents', 'workflow', 'batch', 'workflow'], [
      `Job 1 doesn't call for a workflow. ${Q3} No: three files, checked once`,
      `Job 2 doesn't call for subagents. ${Q3} Yes: it covers the whole codebase, confirms each finding before it is listed and runs again for every release`,
      `Job 3 doesn't call for a workflow. ${Q1} Yes:`,
      `Job 4 doesn't call for \`/batch\`. ${Q4} No: the checks change no code`,
      `Job 5 doesn't call for a workflow. ${Q3} No: it runs once, and each package's own tests confirm its change.`,
    ]],
    [['batch', 'batch', 'main conversation', 'subagents', 'subagents'], [
      `Job 1 doesn't call for \`/batch\`. ${Q4} No: nothing changes yet; the reviewers only report.`,
      `Job 2 doesn't call for \`/batch\`. ${Q3} Yes:`,
      `Job 5 doesn't call for subagents. ${Q4} Yes: one large change that splits into packages`,
    ]],
  ]) {
    withRepo(patternRepo({ choices: choicesOf(picks) }), (dir) => {
      const { code, out } = a2(dir);
      assert.equal(code, 1, out);
      for (const text of expected) assert.ok(out.includes(text), `${picks}: missing "${text}" in ${out}`);
      assert.doesNotMatch(out, /It calls for an agent team/);
    });
  }
});

test('a-2 fails for a pattern that is not one of the five, or no pattern, and lists them', () => {
  withRepo(patternRepo({ choices: CHOSEN.replace('1: subagents', '1: delegate to helpers').replace(/^2: .*$/m, '2:') }), (dir) => {
    const { code, out } = a2(dir);
    assert.equal(code, 1, out);
    assert.match(out, /Job 1's line starts with "delegate to helpers", which isn't one of the patterns\. Right after the job number, write `main conversation`, `subagents`, `workflow`, `\/batch` or `agent team`\./);
    assert.match(out, /Job 2's line names no pattern\./);
  });
});

test('a-2 fails for a job with lines that pick different patterns', () => {
  withRepo(patternRepo({ choices: `${CHOSEN}1: workflow because it may grow\n` }), (dir) => {
    const { code, out } = a2(dir);
    assert.equal(code, 1, out);
    assert.match(out, /Job 1 has lines that pick different patterns: subagents and a workflow\. Keep one line per job\./);
  });
});

test('a-2 says how to start the logging session when there is no log, and to save lesson 6\'s hook file first', () => {
  withRepo(patternRepo({ log: null }), (dir) => {
    const { code, out } = a2(dir);
    assert.equal(code, 1, out);
    assert.match(out, /There is no `\.practice\/i-6-agents\.txt`\. Start the session with `claude --settings \.practice\/i-6-hook\.json`, then run job 1\./);
  });
  withRepo(patternRepo({ log: null, hook: null }), (dir) => {
    const { code, out } = a2(dir);
    assert.equal(code, 1, out);
    assert.match(out, /Save Intermediate lesson 6's hook file as `\.practice\/i-6-hook\.json`, then run job 1 in a session started with `claude --settings \.practice\/i-6-hook\.json`\./);
  });
});

test('a-2 points at jq for an empty log, ignoring blank lines', () => {
  for (const log of ['', '\n\n  \n']) {
    withRepo(patternRepo({ log }), (dir) => {
      const { code, out } = a2(dir);
      assert.equal(code, 1, out);
      assert.match(out, /is empty\. The hook's command creates the file before `jq` runs, so check that `jq --version` works/);
    });
  }
});

test('a-2 fails for a log with one subagent for job 1, or only lesson 6\'s, and asks for one subagent per file, in parallel', () => {
  for (const [log, shows] of [['test-gaps\ngeneral-purpose\n', 'one subagent starting'], ['general-purpose\n\n', 'one subagent starting'], ['test-gaps\n\n', 'only lesson 6\'s `test-gaps`']]) {
    withRepo(patternRepo({ log }), (dir) => {
      const { code, out } = a2(dir);
      assert.equal(code, 1, out);
      assert.ok(out.includes(`shows ${shows}, and job 1 needs at least two subagents. In a session started with \`claude --settings .practice/i-6-hook.json\`, ask for one per file, in parallel.`), out);
    });
  }
});

test('a-2 counts any agent type, a fork included', () => {
  for (const log of ['fork\n\nfork\n', 'test-gaps\nExplore\nmy-reviewer\n', 'general-purpose\ngeneral-purpose\n']) {
    withRepo(patternRepo({ log }), (dir) => {
      const { code, out } = a2(dir);
      assert.equal(code, 0, `${JSON.stringify(log)}: ${out}`);
    });
  }
});

test('a-2 fails on an unsolved repository and passes on a solved one, as the template\'s assertions expect', () => {
  withRepo(patternRepo({ choices: null, log: null, hook: null }), (dir) => {
    const { code, out } = check(['a-2', '--assert', 'fail', '--dir', dir]);
    assert.equal(code, 0, out);
  });
  withRepo(patternRepo(), (dir) => {
    const { code, out } = check(['a-2', '--assert', 'pass', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

// A repository after lesson a-3: paths built from import.meta.url in src/
// and test/, test/ migrated to import.meta.dirname in a later commit, as the
// Worked example's goal does, the saved audit workflow committed in
// .claude/workflows/, and the old form's pattern. The options replace a
// step: `script` (null for none) is saved at `path` and committed unless
// `commitScript` is false; `globalIgnore` becomes the repository's excludes
// file, standing in for a global one; `migrate` lists the folders the
// migration commit changes; `pattern` is text or null for none; `after`
// changes the working tree last.
const AUDIT = [
  '// Run with: /audit-dropped-errors on <folder>',
  'export const meta = {',
  "  name: 'audit-dropped-errors',",
  "  description: 'Audit a folder for errors that are caught and then ignored, and report only the findings a second agent confirms',",
  '}',
  '',
  'const folder = Array.isArray(args) ? args[0] : args',
  "if (!folder) throw new Error('Name a folder: Run /audit-dropped-errors on <folder>')",
  '',
  'const found = await agent(`List every file under ${folder}/, each as a path from the repository root.`, {',
  "  schema: { type: 'object', required: ['files'], properties: { files: { type: 'array', items: { type: 'string' } } } },",
  '})',
  'const findings = await pipeline(found.files, (file) =>',
  "  agent(`In ${file}, find each error that is caught and then ignored. Give each as path:line and why.`, { label: file }),",
  ')',
  'const confirmed = await pipeline(findings.filter(Boolean), (finding) =>',
  "  agent(`Try to refute this finding by reading the code. Reply CONFIRMED or REFUTED, with the reason.\\n${finding}`, { label: 'check' }),",
  ')',
  '',
  "return confirmed.filter(Boolean).join('\\n')",
  '',
].join('\n');
const OLD = {
  'src/paths.js': "import { dirname, join } from 'node:path';\nimport { fileURLToPath } from 'node:url';\n\nexport const root = join(dirname(fileURLToPath(import.meta.url)), '..');\n",
  'test/paths.test.js': "import { test } from 'node:test';\nimport { join } from 'node:path';\n\nconst fixtures = new URL('fixtures/', import.meta.url);\ntest('root', () => {});\n",
};
const NEW = {
  'src/paths.js': "import { join } from 'node:path';\n\nexport const root = join(import.meta.dirname, '..');\n",
  'test/paths.test.js': "import { test } from 'node:test';\nimport { join } from 'node:path';\n\nconst fixtures = join(import.meta.dirname, 'fixtures');\ntest('root', () => {});\n",
};
const PATTERN = 'import\\.meta\\.url\n';
const WORKFLOW_PATH = '.claude/workflows/audit-dropped-errors.js';
// Other lessons' tests reuse this source file.
const TOTAL = 'export function total(items) {\n  // TODO: round to cents before summing\n  return items.reduce((sum, i) => sum + i.price, 0);\n}\n';
const inFolders = (files, folders) => Object.fromEntries(Object.entries(files).filter(([path]) => folders.includes(path.split('/')[0])));

function workflowRepo({ script = AUDIT, path = WORKFLOW_PATH, commitScript = true, globalIgnore, migrate = ['test'], pattern = PATTERN, after } = {}) {
  return () => {
    const dir = repo({ 'README.md': '# demo\n', ...OLD });
    if (globalIgnore) {
      write(dir, { '.git/global-ignore': globalIgnore });
      git(dir, 'config', 'core.excludesFile', join(dir, '.git', 'global-ignore'));
    }
    commit(dir, 'Start');
    if (migrate.length) {
      const migrated = inFolders(NEW, migrate);
      write(dir, migrated);
      commit(dir, `Migrate ${migrate.join(' and ')}`, Object.keys(migrated));
    }
    for (const [i, text] of (Array.isArray(script) ? script : [script]).entries()) {
      if (text === null) continue;
      const at = Array.isArray(path) ? path[i] : path;
      write(dir, { [at]: text });
      if (commitScript) commit(dir, `Add ${at}`, [at]);
    }
    if (pattern !== null) write(dir, { '.practice/a-3-pattern.txt': pattern });
    after?.(dir);
    return dir;
  };
}

const a3 = (dir) => check(['a-3', '--dir', dir]);
const withMeta = (meta) => AUDIT.replace(/export const meta = \{[\s\S]*?\n\}\n/, `export const meta = ${meta}\n`);
const ARGS_LINE = 'const folder = Array.isArray(args) ? args[0] : args';

test('a-3 passes for a committed audit workflow that reads args and checks each finding, and a folder migrated at HEAD', () => {
  withRepo(workflowRepo(), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 0, out);
    assert.match(out, /2 of 2 passed/);
  });
});

test('a-3 accepts a workflow in a package\'s own .claude/workflows/, and comments before meta', () => {
  const commented = `/*\n * Audits a folder for dropped errors.\n */\n\n${AUDIT}`;
  withRepo(workflowRepo({ script: commented, path: 'packages/web/.claude/workflows/audit-dropped-errors.js' }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 0, out);
  });
});

test('a-3 says how to save a workflow when there is none', () => {
  withRepo(workflowRepo({ script: null }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 1, out);
    assert.match(out, /There is no workflow script in `\.claude\/workflows\/`\. When a workflow run finishes, run `\/workflows`, select the run, press `s`/);
  });
});

test('a-3 says to commit a workflow that is only in the working tree, naming the rule that ignores it', () => {
  withRepo(workflowRepo({ commitScript: false }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 1, out);
    assert.match(out, /`\.claude\/workflows\/audit-dropped-errors\.js` isn't committed\. Run `git add \.claude\/workflows\/audit-dropped-errors\.js` and commit it\./);
  });
  withRepo(workflowRepo({ commitScript: false, globalIgnore: '.claude/\n' }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 1, out);
    assert.match(out, /isn't committed, and line 1 of `[^`]*global-ignore`, `\.claude\/`, ignores it\. Run `git add -f \.claude\/workflows\/audit-dropped-errors\.js` and commit it\./);
  });
});

test('a-3 reads only .js files directly in .claude/workflows/, and says where to move another', () => {
  for (const path of ['.claude/workflows/audit-dropped-errors.mjs', '.claude/workflows/team/audit-dropped-errors.js']) {
    withRepo(workflowRepo({ path }), (dir) => {
      const { code, out } = a3(dir);
      assert.equal(code, 1, `${path}: ${out}`);
      assert.ok(out.includes(`\`${path}\` is under \`.claude/workflows/\`, but the check reads only \`.js\` files directly in that folder`), out);
      assert.match(out, /Move it to `\.claude\/workflows\/audit-dropped-errors\.js` and commit\./);
    });
  }
});

test('a-3 fails when meta is not the script\'s first statement', () => {
  withRepo(workflowRepo({ script: `const folder = args\n${AUDIT}` }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 1, out);
    assert.match(out, /doesn't start with `export const meta`: its code starts with `const folder = args`\. Claude Code needs `export const meta = \{ \.\.\. \}` as the script's first statement/);
  });
});

test('a-3 fails for a meta with anything but literal values, naming it and the line', () => {
  for (const [meta, what] of [
    ["{\n  ...base,\n  name: 'audit-dropped-errors',\n  description: 'Audit a folder',\n}", 'Line 3 of `.claude/workflows/audit-dropped-errors.js`: `meta` holds a spread, `...`.'],
    ["{\n  name: 'audit-dropped-errors',\n  description: describe('todo'),\n}", '`meta` holds a function call, `describe(...)`.'],
    ["{\n  name: NAME,\n  description: 'Audit a folder',\n}", '`meta` holds a variable, `NAME`.'],
    ["{\n  name,\n  description: 'Audit a folder',\n}", '`meta` holds a variable, `name`.'],
    ["{\n  name: 'audit-dropped-errors',\n  description: `Report ${KIND}`,\n}", '`meta` holds a template string with `${...}`.'],
    ["{\n  name: 'audit-' + 'errors',\n  description: 'Audit a folder',\n}", '`meta` holds an expression, `+`.'],
    ["{\n  name: 'audit-dropped-errors',\n  description: () => 'Audit a folder',\n}", 'Line 4 of `.claude/workflows/audit-dropped-errors.js`: `meta` holds a function.'],
    ["makeMeta('audit-dropped-errors')", '`meta` holds something other than an object literal.'],
  ]) {
    withRepo(workflowRepo({ script: withMeta(meta) }), (dir) => {
      const { code, out } = a3(dir);
      assert.equal(code, 1, `${meta}: ${out}`);
      assert.ok(out.includes(what), `${meta}: missing "${what}" in ${out}`);
      assert.match(out, /Claude Code drops `\/<name>` from `\/` autocomplete/);
    });
  }
});

test('a-3 fails for a meta without a name or a description', () => {
  withRepo(workflowRepo({ script: withMeta("{ name: 'audit-dropped-errors' }") }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 1, out);
    assert.match(out, /`meta` in `\.claude\/workflows\/audit-dropped-errors\.js` needs a non-empty `description` string\. Add it and commit\./);
  });
  withRepo(workflowRepo({ script: withMeta("{ name: '', description: 42 }") }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 1, out);
    assert.match(out, /needs a non-empty `name` string and a non-empty `description` string\. Add them and commit\./);
  });
});

test('a-3 prints a compile error with its line, and never runs the script', () => {
  const broken = `${AUDIT}const late = await agent(\nlet x = 1\n`;
  const lines = broken.split('\n').length - 1;
  withRepo(workflowRepo({ script: broken }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 1, out);
    assert.ok(out.includes(`doesn't compile (line ${lines}): missing ) after argument list`), out);
  });
  const touches = "export const meta = { name: 'x', description: 'Touches a file' }\nrequire('node:fs').writeFileSync('ran.txt', 'ran')\nreturn args\n";
  withRepo(workflowRepo({ script: touches }), (dir) => {
    a3(dir);
    assert.equal(execFileSync('ls', [dir], { encoding: 'utf8' }).includes('ran.txt'), false);
  });
});

test('a-3 fails when the script never reads the args global, saying why', () => {
  const noArgs = AUDIT.replace(ARGS_LINE, "const folder = 'src'");
  for (const [script, why] of [
    [noArgs, /never reads `args`, so it can't take a folder as input/],
    [noArgs.replace("const folder = 'src'", "// TODO: read the folder from args\nconst folder = 'args'"), /mentions `args` only in a comment, a string or a property name/],
    [noArgs.replace("const folder = 'src'", "const folder = options.args\nconst options = { args: 'src' }"), /mentions `args` only in a comment, a string or a property name/],
    [noArgs.replace("const folder = 'src'", "const args = 'src'\nconst folder = args"), /Line 7 of `\.claude\/workflows\/audit-dropped-errors\.js` declares its own `args`/],
  ]) {
    withRepo(workflowRepo({ script }), (dir) => {
      const { code, out } = a3(dir);
      assert.equal(code, 1, out);
      assert.match(out, why);
      assert.match(out, /Run `\/workflow-authoring`, ask Claude to change the script so it reads the folder from `args`, run `\/reload-skills`, and commit\./);
    });
  }
});

test('a-3 counts args read in a template, a ternary, a call or an object shorthand', () => {
  for (const read of ['const folder = `${args}`', 'const folder = args ? args : "src"', 'const folder = String(args)', 'const { folder } = { folder: args }', 'const input = { args }; const folder = input.args']) {
    withRepo(workflowRepo({ script: AUDIT.replace(ARGS_LINE, read) }), (dir) => {
      const { code, out } = a3(dir);
      assert.equal(code, 0, `${read}: ${out}`);
    });
  }
});

test('a-3 fails for a script with one agent() call, where no second agent checks the findings', () => {
  const once = AUDIT.replace(/const found[\s\S]*?\n\}\)\n/, 'const found = { files: [folder] }\n').replace(/const confirmed[\s\S]*?\n\)\n/, 'const confirmed = findings\n');
  withRepo(workflowRepo({ script: once }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 1, out);
    assert.match(out, /`\.claude\/workflows\/audit-dropped-errors\.js` calls `agent\(\)` only once, so no second agent checks what the first one finds\./);
  });
});

test('a-3 counts agent() calls, not methods, declarations, comments or strings', () => {
  const meta = "export const meta = { name: 'review', description: 'Review each file' }\nconst folder = args\n";
  for (const [body, ok] of [
    ["await agent('find')\nawait agent('check')\n", true],
    ["await parallel([() => agent('a'), () => agent('b')])\n", true],
    ["await agent('find')\nawait tools.agent('check')\n", false],
    ["await agent('find')\n// agent('check')\nconst s = \"agent('check')\"\n", false],
    ["await agent('find')\nasync function agent2() {}\n", false],
  ]) {
    withRepo(workflowRepo({ script: `${meta}${body}` }), (dir) => {
      assert.equal(a3(dir).code === 0, ok, body);
    });
  }
});

test('a-3 points out uncommitted changes to a committed script that fails', () => {
  const noArgs = AUDIT.replace(ARGS_LINE, "const folder = 'src'");
  withRepo(workflowRepo({ script: noArgs, after: (dir) => write(dir, { [WORKFLOW_PATH]: AUDIT }) }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 1, out);
    assert.match(out, /never reads `args`/);
    assert.match(out, /Your copy of `\.claude\/workflows\/audit-dropped-errors\.js` has changes that aren't committed: if they fix this, commit them\./);
  });
});

test('a-3 passes when any committed script meets the item, and otherwise speaks of the one that got furthest', () => {
  const noArgs = AUDIT.replace(ARGS_LINE, "const folder = 'src'");
  const paths = ['.claude/workflows/a-first.js', '.claude/workflows/b-second.js'];
  withRepo(workflowRepo({ script: [`const x = 1\n${AUDIT}`, AUDIT], path: paths }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 0, out);
  });
  withRepo(workflowRepo({ script: [`const x = 1\n${AUDIT}`, noArgs], path: paths }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 1, out);
    assert.match(out, /`\.claude\/workflows\/b-second\.js` never reads `args`/);
    assert.doesNotMatch(out, /a-first/);
  });
  withRepo(workflowRepo({ script: noArgs, after: (dir) => write(dir, { '.claude/workflows/fixed.js': AUDIT }) }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 1, out);
    assert.match(out, /never reads `args`.* Also, `\.claude\/workflows\/fixed\.js` isn't committed\. Run `git add \.claude\/workflows\/fixed\.js` and commit it\./);
  });
});

test('a-3 says to save the pattern when there is none, or it is empty', () => {
  withRepo(workflowRepo({ pattern: null }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 1, out);
    assert.match(out, /PASS {2}a committed script in `\.claude\/workflows\/`/);
    assert.match(out, /There is no `\.practice\/a-3-pattern\.txt`\. Save the `git grep -E` pattern that finds the old form there, on one line/);
  });
  withRepo(workflowRepo({ pattern: '\n  \n' }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 1, out);
    assert.match(out, /`\.practice\/a-3-pattern\.txt` is empty/);
  });
});

test('a-3 reads the pattern in backticks or quotes, with CRLF line ends', () => {
  for (const pattern of ['`import\\.meta\\.url`\n', "'import\\.meta\\.url'\r\n", '\nimport\\.meta\\.url\n']) {
    withRepo(workflowRepo({ pattern }), (dir) => {
      const { code, out } = a3(dir);
      assert.equal(code, 0, `${pattern}: ${out}`);
    });
  }
});

test('a-3 passes once one folder is migrated at HEAD, while the old form stays elsewhere', () => {
  withRepo(workflowRepo({ migrate: ['src'] }), (dir) => {
    assert.equal(a3(dir).code, 0);
  });
});

test('a-3 fails while the old form still matches in every folder at HEAD, and says to commit a migration left in the working tree', () => {
  withRepo(workflowRepo({ migrate: [] }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 1, out);
    assert.match(out, /`import\\\.meta\\\.url` still matches inside `src\/` and `test\/` at `HEAD`, in every folder where it ever matched/);
    assert.match(out, /Set the goal again for the folder you're migrating/);
  });
  withRepo(workflowRepo({ migrate: [], after: (dir) => write(dir, inFolders(NEW, ['test'])) }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 1, out);
    assert.match(out, /`test\/` is migrated in your working tree, but `import\\\.meta\\\.url` still matches there at `HEAD`\. Review the changes and commit them\./);
  });
});

// The practice copy's own course code (learn/, checks/, capstone/) is not the
// Learner's migration: a-3 neither lists it nor waits for it (r27).
const COURSE_CODE = { 'learn/app.mjs': "const here = new URL('.', import.meta.url);\n", 'checks/run.mjs': "const at = new URL('.', import.meta.url);\n" };
const withCourse = (dir) => { write(dir, COURSE_CODE); commit(dir, 'Course code', Object.keys(COURSE_CODE)); };

test('a-3 leaves the practice copy\'s course folders out of the migration: it passes when test/ is migrated, and names only the Learner\'s folders when none is', () => {
  withRepo(workflowRepo({ after: withCourse }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 0, out);
  });
  withRepo(workflowRepo({ migrate: [], after: withCourse }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 1, out);
    assert.match(out, /still matches inside `src\/` and `test\/` at `HEAD`/);
    assert.doesNotMatch(out, /`learn\/`|`checks\/`/);
  });
});

test('a-3 fails for a pattern that never matched, or that git cannot read', () => {
  withRepo(workflowRepo({ pattern: 'nothingLikeThis\n' }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 1, out);
    assert.match(out, /`nothingLikeThis` matches nothing in this repository's recent commits, so the check can't see a migration/);
  });
  withRepo(workflowRepo({ pattern: '(\n' }), (dir) => {
    const { code, out } = a3(dir);
    assert.equal(code, 1, out);
    assert.match(out, /git can't use the pattern in `\.practice\/a-3-pattern\.txt`, `\(`: /);
  });
});

test('the workflow reader can require an agent() call, as the Advanced capstone does', () => {
  const noArgs = AUDIT.replace(ARGS_LINE, "const folder = 'src'");
  assert.equal(readWorkflow(noArgs, { needAgentCall: true }).ok, true);
  assert.equal(readWorkflow(noArgs, { needArgs: true }).problem, 'args');
  const meta = "export const meta = { name: 'review', description: 'Review each file' }\n";
  for (const body of ['return args', "return tools.agent('x')", 'function agent() {}\nreturn 1', "// agent('x')\nconst s = \"agent('y')\""]) {
    assert.equal(readWorkflow(`${meta}${body}\n`, { needAgentCall: true }).problem, 'agent', body);
  }
  assert.equal(readWorkflow(`${meta}return parallel([() => agent('a'), () => agent('b')])\n`, { needAgentCall: true }).ok, true);
  assert.deepEqual(readWorkflow(`${meta}return 1\n`).meta, { name: 'review', description: 'Review each file' });
});

test('a-3 fails on an unsolved repository and passes on a solved one, as the template\'s assertions expect', () => {
  withRepo(workflowRepo({ script: null, migrate: [], pattern: null }), (dir) => {
    const { code, out } = check(['a-3', '--assert', 'fail', '--dir', dir]);
    assert.equal(code, 0, out);
  });
  withRepo(workflowRepo(), (dir) => {
    const { code, out } = check(['a-3', '--assert', 'pass', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

// A repository after lesson a-4: the review script committed and executable,
// and the JSON of one real run saved. The options replace a step: `script`
// (null for none) is saved with `mode` and committed unless `commitScript`
// is false; `result` (null for none) is the saved run, as an object, text or
// a Buffer; `after` changes the working tree last. The items run the script
// with a stand-in for `claude`, never Claude Code itself.
const PROMPT = 'Review this staged diff for bugs and missing tests. List each problem as file:line and one sentence, or say there are none.';
// What keeps the review to the three read tools, with no hooks and no MCP
// server, before the turn cap, so a cap with no number after it ends the line.
const LIMITS = `--tools "Read,Grep,Glob" --settings '{"disableAllHooks": true}' --strict-mcp-config`;
const FLAGS = `--output-format json --permission-mode dontAsk --allowedTools "Read,Grep,Glob" ${LIMITS} --max-turns 5`;
const CALL = `claude -p "${PROMPT}" \\\n  ${FLAGS}`;
const REVIEW = [
  '#!/usr/bin/env bash',
  '# Review the staged diff with Claude Code and save the JSON result.',
  'set -uo pipefail',
  'out="${1:-.practice/a-4-result.json}"',
  'if git diff --cached --quiet; then echo "Nothing is staged." >&2; exit 2; fi',
  'mkdir -p "$(dirname "$out")"',
  `git diff --cached | ${CALL} > "$out"`,
  'status=$?',
  'jq -r \'.result // empty\' "$out"',
  'if [ "$status" -ne 0 ] || [ "$(jq -r \'.is_error\' "$out")" != "false" ]; then',
  '  echo "The review failed: $(jq -r \'.subtype\' "$out")" >&2; exit 1',
  'fi',
  '',
].join('\n');
const REAL_RUN = {
  type: 'result', subtype: 'success', is_error: false, num_turns: 3,
  result: 'src/total.js:2: the sum is not rounded to cents, and no test covers it.',
  session_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', total_cost_usd: 0.01, permission_denials: [],
};

// The review script with each `[from, to]` replaced.
function edited(...pairs) {
  return pairs.reduce((text, [from, to]) => {
    assert.ok(text.includes(from), `the review script has no ${JSON.stringify(from)}`);
    return text.replace(from, () => to);
  }, REVIEW);
}
const withFlags = (flags) => edited([FLAGS, flags]);
const withCall = (call) => edited([CALL, call]);

function reviewRepo({ script = REVIEW, mode = 0o755, commitScript = true, result = REAL_RUN, after } = {}) {
  return () => {
    const dir = repo({ 'README.md': '# demo\n', 'src/total.js': TOTAL });
    commit(dir, 'Start');
    if (script !== null) {
      write(dir, { [SCRIPT]: script });
      setMode(dir, SCRIPT, mode);
      if (commitScript) commit(dir, 'Add the review script', [SCRIPT]);
    }
    if (result !== null) write(dir, { [RESULT]: typeof result === 'string' || Buffer.isBuffer(result) ? result : JSON.stringify(result, null, 2) });
    after?.(dir);
    return dir;
  };
}

const a4 = (dir) => check(['a-4', '--dir', dir]);
// One item on its own, which runs only what that item needs.
const callHint = (dir) => scriptCall(SCRIPT).check(openRepo(dir));
const behaviorHint = (dir) => scriptBehavior(SCRIPT).check(openRepo(dir));
const runHint = (dir) => savedRun(RESULT, SCRIPT).check(openRepo(dir));

test('a-4 passes for the lesson\'s script, committed and executable, and a real run saved', () => {
  withRepo(reviewRepo(), (dir) => {
    const { code, out } = a4(dir);
    assert.equal(code, 0, out);
    assert.match(out, /4 of 4 passed/);
  });
});

test('a-4 says to write the script, commit it or make it executable', () => {
  withRepo(reviewRepo({ script: null }), (dir) => {
    const { code, out } = a4(dir);
    assert.equal(code, 1, out);
    assert.match(out, /There is no `scripts\/review-staged\.sh`\. Write it as the lesson's Your turn describes, then commit it\./);
    assert.match(out, /Commit `scripts\/review-staged\.sh` first: the check runs the committed script\./);
  });
  withRepo(reviewRepo({ commitScript: false }), (dir) => {
    const { code, out } = a4(dir);
    assert.equal(code, 1, out);
    assert.match(out, /`scripts\/review-staged\.sh` isn't committed\. Run `git add scripts\/review-staged\.sh` and commit it\./);
  });
  withRepo(reviewRepo({ mode: 0o644 }), (dir) => {
    const { code, out } = a4(dir);
    assert.equal(code, 1, out);
    assert.match(out, /isn't executable\. Run `chmod \+x scripts\/review-staged\.sh`, then `git add scripts\/review-staged\.sh` and commit\. On Windows, run `git update-index --chmod=\+x scripts\/review-staged\.sh`/);
    assert.match(out, /3 of 4 passed/);
  });
});

test('a-4 runs the committed script, not the working copy, and points out uncommitted changes', () => {
  withRepo(reviewRepo({ script: withFlags(FLAGS.replace('--output-format json ', '')), after: (dir) => write(dir, { [SCRIPT]: REVIEW }) }), (dir) => {
    const hint = callHint(dir);
    assert.match(String(hint), /It doesn't ask for JSON/);
    assert.match(String(hint), /Your copy of `scripts\/review-staged\.sh` has changes that aren't committed: if they fix this, commit them\./);
  });
  withRepo(reviewRepo({ after: (dir) => write(dir, { [SCRIPT]: withFlags('--max-turns 5') }) }), (dir) => {
    assert.equal(callHint(dir), true);
  });
});

// The arguments a shell passes for `flags`, each quoted word whole.
const argvOf = (flags) => [...flags.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
const flagHints = (flags, prompt = ['-p', PROMPT]) => callHints([...prompt, ...argvOf(flags)]).join(' ');

test('a-4 accepts the flags written in other forms, and the prompt after -p wherever -p is', () => {
  for (const flags of [
    FLAGS.replace('--max-turns 5', '--max-turns=5'),
    FLAGS.replace('--permission-mode dontAsk', '--permission-mode=dontAsk'),
    FLAGS.replace('--allowedTools "Read,Grep,Glob"', '--allowed-tools Read Grep Glob'),
    FLAGS.replace('"Read,Grep,Glob"', '"Read Grep Glob"'),
    FLAGS.replace('"Read,Grep,Glob"', '"Read, Grep, Glob"'),
    FLAGS.replace('"Read,Grep,Glob"', 'Read --allowedTools "Grep,Glob"'),
    FLAGS.replace('"Read,Grep,Glob"', '"Read(./src/**)" Grep'),
    FLAGS.replace('--max-turns 5', '--max-turns 10'),
    `--model sonnet ${FLAGS} --max-budget-usd 1`,
  ]) {
    assert.equal(flagHints(flags), '', flags);
  }
  assert.equal(flagHints(FLAGS, ['--print', PROMPT]), '');
  assert.equal(flagHints(FLAGS, ['--model', 'sonnet', '-p', PROMPT]), '');
  // The same, end to end: the stand-in records the call the script makes.
  for (const script of [
    withFlags(`--max-turns=5 --permission-mode=dontAsk --output-format json --allowed-tools Read Grep Glob --strict-mcp-config --tools=Read,Grep,Glob --settings='{"disableAllHooks":true}'`),
    withCall(`claude --model sonnet -p "${PROMPT}" ${FLAGS}`),
  ]) {
    withRepo(reviewRepo({ script }), (dir) => {
      assert.equal(callHint(dir), true, script);
    });
  }
});

test('a-4 names each flag the call lacks or gets wrong', () => {
  for (const [flags, hint] of [
    [FLAGS.replace('--output-format json ', ''), /It doesn't ask for JSON: add `--output-format json`\./],
    [FLAGS.replace('--output-format json', '--output-format text'), /It asks for `--output-format text`: use `json`/],
    [FLAGS.replace('--permission-mode dontAsk ', ''), /It sets no permission mode: add `--permission-mode dontAsk`, so every call that would ask for permission is denied\./],
    [FLAGS.replace('dontAsk', 'dontask'), /Write `dontAsk` as Claude Code spells it, not `dontask`\./],
    [FLAGS.replace('dontAsk', 'acceptEdits'), /It runs in `acceptEdits` mode: use `--permission-mode dontAsk`/],
    [FLAGS.replace('dontAsk', 'bypassPermissions'), /It runs in `bypassPermissions` mode/],
    [`${FLAGS} --dangerously-skip-permissions`, /Drop `--dangerously-skip-permissions`: it is the same as `--permission-mode bypassPermissions`\./],
    [FLAGS.replace('"Read,Grep,Glob"', '"Read,Grep,Glob,Bash"'), /`--allowedTools` lists `Bash`, which is not `Read`, `Grep` or `Glob`\./],
    [FLAGS.replace('"Read,Grep,Glob"', '"Edit Write Read"'), /lists `Edit` and `Write`, which are not `Read`, `Grep` or `Glob`/],
    [FLAGS.replace('"Read,Grep,Glob"', '"Read,Bash(git diff *)"'), /lists `Bash\(git diff \*\)`, which is not/],
    [FLAGS.replace('"Read,Grep,Glob"', 'read,grep,glob'), /Write `Read` as Claude Code spells the tool, not `read`\./],
    [FLAGS.replace('--allowedTools "Read,Grep,Glob" ', ''), /It pre-approves no tools: add `--allowedTools "Read,Grep,Glob"`\./],
    [FLAGS.replace('"Read,Grep,Glob"', '""'), /`--allowedTools` lists no tool/],
    [FLAGS.replace('--max-turns 5', '--max-turns 0'), /`--max-turns 0` is below 1: use a number from 1 to 10\./],
    [FLAGS.replace('--max-turns 5', '--max-turns 11'), /`--max-turns 11` is above 10: use a number from 1 to 10\./],
    [FLAGS.replace('--max-turns 5', '--max-turns five'), /`--max-turns five` isn't a whole number/],
    [FLAGS.replace(' --max-turns 5', ''), /It sets no turn cap: add `--max-turns` with a number from 1 to 10\./],
    [FLAGS.replace('--max-turns', '--max_turns'), /Claude Code doesn't know `--max_turns`, so it stops with an error before the run starts: write `--max-turns`\./],
    [FLAGS.replace(' 5', ''), /`--max-turns` has no number after it/],
  ]) {
    assert.match(flagHints(flags), hint, flags);
  }
  // End to end, a misspelt flag the stand-in captured.
  withRepo(reviewRepo({ script: withFlags(FLAGS.replace('--allowedTools', '--allowedtools')) }), (dir) => {
    assert.match(String(callHint(dir)), /It pre-approves no tools: add `--allowedTools "Read,Grep,Glob"`\. Claude Code doesn't know `--allowedtools`, so it stops with an error before the run starts: write `--allowedTools`\./);
  });
});

test('a-4 wants --tools that keeps exactly the three read tools, and names any other tool it keeps or any it leaves out', () => {
  const base = ['-p', 'Review this diff.', '--output-format', 'json', '--permission-mode', 'dontAsk', '--allowedTools', 'Read,Grep,Glob', '--settings', '{"disableAllHooks": true}', '--strict-mcp-config', '--max-turns', '5'];
  assert.deepEqual(callHints([...base, '--tools', 'Read,Grep,Glob']), []);
  assert.deepEqual(callHints([...base, '--tools', 'Glob', 'Grep', 'Read']), []);
  assert.deepEqual(callHints(base), ['It doesn\'t restrict the tools: add `--tools "Read,Grep,Glob"`, so Claude can\'t use Bash, Edit or Write even when one of your rules allows them.']);
  assert.deepEqual(callHints([...base, '--tools', 'Read,Bash,Edit']), ['`--tools` keeps `Bash` and `Edit` available: list only `Read`, `Grep` and `Glob` there.']);
  assert.deepEqual(callHints([...base, '--tools', 'Read']), ['`--tools` leaves out `Grep` and `Glob`: list `Read`, `Grep` and `Glob` there, as `--tools "Read,Grep,Glob"` does.']);
  assert.deepEqual(callHints([...base, '--tools', '']), ['`--tools` leaves out `Read`, `Grep` and `Glob`: list `Read`, `Grep` and `Glob` there, as `--tools "Read,Grep,Glob"` does.']);
  assert.deepEqual(callHints([...base, '--tools']), ['`--tools` has no tools after it: write `--tools "Read,Grep,Glob"`.']);
  assert.match(callHints([...base.filter((a) => a !== '--strict-mcp-config'), '--Tools', 'Read,Grep,Glob', '--strict-mcp-config']).join(' '), /It doesn't restrict the tools: .* Claude Code doesn't know `--Tools`, so it stops with an error before the run starts: write `--tools`\./);
});

test('a-4 wants hooks off with --settings \'{"disableAllHooks": true}\' and no MCP server but the ones passed, and says what is missing', () => {
  const base = ['-p', 'Review this diff.', '--output-format', 'json', '--permission-mode', 'dontAsk', '--allowedTools', 'Read,Grep,Glob', '--tools', 'Read,Grep,Glob', '--max-turns', '5'];
  const hooksOff = ['--settings', '{"disableAllHooks": true}'];
  assert.deepEqual(callHints([...base, ...hooksOff, '--strict-mcp-config']), []);
  assert.deepEqual(callHints([...base, '--settings={"disableAllHooks":true,"model":"sonnet"}', '--strict-mcp-config']), []);
  // Each one missing, then each written wrong.
  assert.deepEqual(callHints([...base, '--strict-mcp-config']), ['It doesn\'t turn hooks off: add `--settings \'{"disableAllHooks": true}\'`, so the project\'s hooks can\'t run in the review.']);
  assert.deepEqual(callHints([...base, ...hooksOff]), ['It doesn\'t keep the project\'s MCP servers out: add `--strict-mcp-config`, so the run starts no server you didn\'t pass with `--mcp-config`.']);
  assert.deepEqual(callHints([...base, '--strict-mcp-config', '--settings']), ['`--settings` has nothing after it: write `--settings \'{"disableAllHooks": true}\'`.']);
  assert.deepEqual(callHints([...base, '--strict-mcp-config', '--settings', '.claude/review.json']), ['`--settings` gets `.claude/review.json`, which isn\'t inline JSON: write `--settings \'{"disableAllHooks": true}\'`.']);
  assert.deepEqual(callHints([...base, '--strict-mcp-config', '--settings', '{"disableAllHooks": true']), ['`--settings` gets `{"disableAllHooks": true`, which isn\'t inline JSON: write `--settings \'{"disableAllHooks": true}\'`.']);
  for (const json of ['{"disableAllHooks": false}', '{"disableAllHooks": "true"}', '{}']) {
    assert.deepEqual(callHints([...base, '--strict-mcp-config', '--settings', json]), ['The `--settings` JSON doesn\'t set `"disableAllHooks": true`, so the project\'s hooks still run: add it, as in `--settings \'{"disableAllHooks": true}\'`.'], json);
  }
  assert.match(callHints([...base, ...hooksOff, '--strict_mcp_config']).join(' '), /Claude Code doesn't know `--strict_mcp_config`, so it stops with an error before the run starts: write `--strict-mcp-config`\./);
  // End to end: the stand-in records what the committed script passes.
  withRepo(reviewRepo({ script: withFlags(FLAGS.replace(` --settings '{"disableAllHooks": true}'`, '')) }), (dir) => {
    assert.match(String(callHint(dir)), /^It doesn't turn hooks off: add `--settings '\{"disableAllHooks": true\}'`/);
  });
  withRepo(reviewRepo({ script: withFlags(FLAGS.replace(' --strict-mcp-config', '')) }), (dir) => {
    assert.match(String(callHint(dir)), /^It doesn't keep the project's MCP servers out: add `--strict-mcp-config`/);
  });
  withRepo(reviewRepo({ script: withFlags(FLAGS.replace(' --tools "Read,Grep,Glob"', '')) }), (dir) => {
    assert.match(String(callHint(dir)), /^It doesn't restrict the tools: add `--tools "Read,Grep,Glob"`/);
  });
});

test('a-4 fails a prompt that isn\'t right after -p, naming a word the tool list took', () => {
  withRepo(reviewRepo({ script: withCall(`claude -p --output-format json --permission-mode dontAsk --max-turns 5 --allowedTools "Read,Grep,Glob" "${PROMPT}"`) }), (dir) => {
    const hint = String(callHint(dir));
    assert.match(hint, /`--output-format` comes right after `-p`\. Write the prompt right after `-p`, as in `claude -p "<prompt>" --output-format json \.\.\.`\./);
    assert.match(hint, /`this` isn't a read-only tool: list only `Read`, `Grep` and `Glob` after `--allowedTools`, and write the prompt right after `-p`\./);
    assert.doesNotMatch(hint, /lists `Review`/);
  });
  const last = flagHints(`${FLAGS} "${PROMPT}"`, ['-p']);
  assert.match(last, /`--output-format` comes right after `-p`/);
  assert.doesNotMatch(last, /read-only tool/);
  assert.match(flagHints(`${FLAGS} -p`, []), /Nothing follows `-p`\. Write the prompt right after it/);
  assert.match(flagHints(FLAGS, ['-p', ' ']), /The prompt after `-p` is empty/);
});

test('a-4 fails a script that runs claude without -p, or never runs it, and says how it ended', () => {
  withRepo(reviewRepo({ script: withCall(`claude "${PROMPT}" ${FLAGS}`) }), (dir) => {
    assert.match(String(callHint(dir)), /With a staged change, `scripts\/review-staged\.sh` ran `claude` without `-p` \(or `--print`\), which starts an interactive session\./);
  });
  withRepo(reviewRepo({ script: edited([`git diff --cached | ${CALL} > "$out"`, 'echo "Claude is off today." >&2; exit 3']) }), (dir) => {
    assert.match(String(callHint(dir)), /never ran `claude -p`, so the check couldn't see its flags\. It exited with 3: Claude is off today\./);
  });
});

test('a-4 checks that the script pipes in the staged diff and nothing else', () => {
  for (const [script, hint] of [
    [edited([`git diff --cached | ${CALL}`, `git diff | ${CALL}`]), /What it piped into `claude -p` doesn't hold the staged change\. Pipe the staged diff in: `git diff --cached \| claude -p "<prompt>" \.\.\.`\./],
    [edited([`git diff --cached | ${CALL}`, `git diff HEAD | ${CALL}`]), /The diff it piped into `claude -p` also holds a change that isn't staged\. Pipe `git diff --cached`/],
    [edited([`git diff --cached | ${CALL}`, `claude -p "${PROMPT} $(git diff --cached)" ${FLAGS}`]), /It puts the diff in the prompt\. Pipe it in instead/],
  ]) {
    withRepo(reviewRepo({ script }), (dir) => {
      assert.match(String(behaviorHint(dir)), hint);
    });
  }
});

test('a-4 checks where the script saves the JSON, and that it prints the review', () => {
  withRepo(reviewRepo({ script: edited(['out="${1:-.practice/a-4-result.json}"', 'out=".practice/a-4-result.json"']) }), (dir) => {
    assert.match(String(behaviorHint(dir)), /It saved the JSON to `\.practice\/a-4-result\.json`, though its first argument named another path\. Use the argument when there is one: `out="\$\{1:-\.practice\/a-4-result\.json\}"`\./);
  });
  withRepo(reviewRepo({ script: edited(['out="${1:-.practice/a-4-result.json}"', 'out="$1"']) }), (dir) => {
    assert.match(String(behaviorHint(dir)), /Run without an argument, it didn't save the JSON to `\.practice\/a-4-result\.json` \(it exited with 1: .*unbound variable\)\. Use that path when there is no argument/);
  });
  withRepo(reviewRepo({ script: edited([`> "$out"\nstatus=$?\njq -r '.result // empty' "$out"`, `| tee /dev/stderr | jq -r .result > "$out"\nstatus=$?\ncat "$out"`]) }), (dir) => {
    assert.match(String(behaviorHint(dir)), /The file at the path in its first argument isn't the JSON `claude -p` printed\. Save that output unchanged\./);
  });
  withRepo(reviewRepo({ script: edited(['jq -r \'.result // empty\' "$out"\n', '']) }), (dir) => {
    assert.match(String(behaviorHint(dir)), /It didn't print the review\. Print the JSON's `result`, as `jq -r '\.result'` does\./);
  });
});

test('a-4 checks both exit rules apart: claude exiting non-zero, and is_error', () => {
  withRepo(reviewRepo({ script: edited(['> "$out"\nstatus=$?', '> "$out" || true\nstatus=$?'], ['if [ "$status" -ne 0 ] || [ "$(jq -r \'.is_error\' "$out")" != "false" ]; then', 'if [ "$(jq -r \'.is_error\' "$out")" = "true" ]; then']) }), (dir) => {
    const hint = String(behaviorHint(dir));
    assert.match(hint, /When `claude -p` exits non-zero and prints no JSON, as it does for a flag it can't read, it exited 0\. Exit non-zero whenever `claude -p` does\./);
    assert.doesNotMatch(hint, /is_error/);
  });
  withRepo(reviewRepo({ script: edited(['if [ "$status" -ne 0 ] || [ "$(jq -r \'.is_error\' "$out")" != "false" ]; then', 'if [ "$status" -ne 0 ]; then']) }), (dir) => {
    const hint = String(behaviorHint(dir));
    assert.match(hint, /When the JSON says `"is_error": true` and `claude -p` exits 0, it exited 0\. Exit non-zero whenever `is_error` is `true`/);
    assert.doesNotMatch(hint, /prints no JSON/);
  });
});

test('a-4 fails a script that calls Claude, exits 0 or says nothing when nothing is staged', () => {
  withRepo(reviewRepo({ script: edited(['if git diff --cached --quiet; then echo "Nothing is staged." >&2; exit 2; fi\n', '']) }), (dir) => {
    const hint = String(behaviorHint(dir));
    assert.match(hint, /With nothing staged, it still ran `claude -p`\. Test for a staged change first, as `git diff --cached --quiet` does/);
    assert.match(hint, /With nothing staged, it exited 0\./);
  });
  withRepo(reviewRepo({ script: edited(['if git diff --cached --quiet;', 'if git diff --quiet;']) }), (dir) => {
    assert.match(String(behaviorHint(dir)), /With nothing staged, it still ran `claude -p`/);
  });
  withRepo(reviewRepo({ script: edited(['then echo "Nothing is staged." >&2; exit 2; fi', 'then exit 0; fi']) }), (dir) => {
    const hint = String(behaviorHint(dir));
    assert.match(hint, /With nothing staged, it exited 0\. Exit non-zero, so whatever runs it can tell that no review ran\./);
    assert.match(hint, /With nothing staged, it printed nothing\. Say that nothing is staged\./);
    assert.doesNotMatch(hint, /still ran/);
  });
});

test('a-4 wants one claude -p call, and lets the script ask for the version first', () => {
  withRepo(reviewRepo({ script: edited(['status=$?\n', `status=$?\ngit diff --cached | ${CALL} > /dev/null\n`]) }), (dir) => {
    assert.match(String(behaviorHint(dir)), /With one staged change, it ran `claude -p` 2 times\. Run it once/);
  });
  withRepo(reviewRepo({ script: edited(['set -uo pipefail\n', 'set -uo pipefail\nclaude --version > /dev/null || { echo "Install Claude Code first." >&2; exit 1; }\n']) }), (dir) => {
    const { code, out } = a4(dir);
    assert.equal(code, 0, out);
  });
});

test('a-4 refuses to run a script that could reach the real Claude Code, and runs nothing', () => {
  const outside = mkdtempSync(join(tmpdir(), 'a4-ran-'));
  const ran = join(outside, 'ran');
  try {
    for (const [script, why] of [
      [withCall(`/usr/local/bin/claude -p "${PROMPT}" ${FLAGS}`), /calls Claude Code by its path, `\/usr\/local\/bin\/claude`/],
      [withCall(`"$HOME"/.local/bin/claude -p "${PROMPT}" ${FLAGS}`), /calls Claude Code by its path, `\/\.local\/bin\/claude`/],
      [withCall(`npx @anthropic-ai/claude-code -p "${PROMPT}" ${FLAGS}`), /runs Claude Code through `npx`/],
      [withCall(`bunx claude -p "${PROMPT}" ${FLAGS}`), /runs Claude Code through `bunx`/],
      [edited(['set -uo pipefail\n', 'set -uo pipefail\nexport PATH="$HOME/.local/bin:$PATH"\n']), /changes `PATH`/],
      [withCall(`bash -lc 'claude -p "${PROMPT}" ${FLAGS}'`), /starts a login shell, with `-l` or `--login`/],
      [withCall(`/bin/zsh --login -c 'claude -p "${PROMPT}" ${FLAGS}'`), /starts a login shell, with `-l` or `--login`/],
      [edited(['set -uo pipefail\n', 'set -uo pipefail\n. /etc/profile\n']), /reads `\/etc\/profile`/],
      [edited(['set -uo pipefail\n', 'set -uo pipefail\nsource "/etc/zprofile"\n']), /reads `\/etc\/zprofile`/],
      [edited(['set -uo pipefail\n', 'set -uo pipefail\neval "$(/usr/libexec/path_helper -s)"\n']), /runs `path_helper`/],
      [withCall(`claude.cmd -p "${PROMPT}" ${FLAGS}`), /calls `claude\.cmd`/],
      [withCall(`claude.ps1 -p "${PROMPT}" ${FLAGS}`), /calls `claude\.ps1`/],
      [withCall(`C:\\Users\\me\\npm\\claude.cmd -p "${PROMPT}" ${FLAGS}`), /calls Claude Code by its path, `C:\\Users\\me\\npm\\claude\.cmd`/],
      [withCall(`cmd //c claude -p "${PROMPT}" ${FLAGS}`), /starts `cmd`/],
      [withCall(`powershell.exe -Command claude -p "${PROMPT}" ${FLAGS}`), /starts `powershell`/],
      [withCall(`pwsh -c 'claude -p "${PROMPT}" ${FLAGS}'`), /starts `pwsh`/],
      [withCall(`wsl claude -p "${PROMPT}" ${FLAGS}`), /starts `wsl`/],
    ]) {
      const marked = script.replace('set -uo pipefail\n', () => `set -uo pipefail\ntouch "${ran}"\n`);
      withRepo(reviewRepo({ script: marked }), (dir) => {
        const { code, out } = a4(dir);
        assert.equal(code, 1, out);
        assert.match(out, why);
        assert.match(out, /which the stand-in can't replace, so the check didn't run it\. Call `claude` by name, leave `PATH` as it is, and commit\./);
        assert.equal(existsSync(ran), false, `the check ran ${script}`);
      });
    }
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
  withRepo(reviewRepo({ script: edited(['set -uo pipefail\n', 'set -uo pipefail\n# Not /usr/local/bin/claude: the check stands in for claude on PATH.\n']) }), (dir) => {
    assert.equal(callHint(dir), true);
  });
  // A shell that isn't a login shell, and an `-l` meant for another command.
  withRepo(reviewRepo({ script: edited(['set -uo pipefail\n', 'set -uo pipefail\nbash -c \'ls -l src\' > /dev/null\necho ssh -l nobody example.invalid > /dev/null\n']) }), (dir) => {
    assert.equal(callHint(dir), true);
  });
});

test('a-4 runs the script without an argument in a copy that has no .practice/ yet, and wants it to create the folder', () => {
  withRepo(reviewRepo({ script: edited(['mkdir -p "$(dirname "$out")"\n', '']) }), (dir) => {
    assert.equal(behaviorHint(dir), 'Run without an argument in a fresh copy, where `.practice/` doesn\'t exist yet, it couldn\'t write `.practice/a-4-result.json`. Create the folder first, as `mkdir -p "$(dirname "$out")"` does.');
  });
  withRepo(reviewRepo({ script: edited(['mkdir -p "$(dirname "$out")"', 'mkdir -p .practice']) }), (dir) => {
    assert.equal(behaviorHint(dir), true);
  });
});

test('a-4 fails a script with Windows line ends, and points at jq when it is missing', () => {
  withRepo(reviewRepo({ script: REVIEW.replace(/\n/g, '\r\n') }), (dir) => {
    const { code, out } = a4(dir);
    assert.equal(code, 1, out);
    assert.match(out, /The committed `scripts\/review-staged\.sh` has Windows line ends \(CRLF\), which bash can't run\./);
  });
  withRepo(reviewRepo({ script: edited(['jq -r \'.result // empty\' "$out"', 'echo "scripts/review-staged.sh: line 9: jq: command not found" >&2; exit 127']) }), (dir) => {
    assert.equal(behaviorHint(dir), 'The script needs `jq`, which isn\'t installed. Install it and run the check again.');
  });
});

test('a-4 reads the saved run, and says what is wrong with it', () => {
  const utf16 = (text) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text.replace(/\n/g, '\r\n'), 'utf16le')]);
  for (const result of [{ ...REAL_RUN, num_turns: 6 }, utf16(JSON.stringify(REAL_RUN, null, 2)), `﻿${JSON.stringify(REAL_RUN)}`]) {
    withRepo(reviewRepo({ result }), (dir) => {
      assert.equal(runHint(dir), true);
    });
  }
  for (const [result, hint] of [
    [null, /There is no `\.practice\/a-4-result\.json` yet: stage a change and run `scripts\/review-staged\.sh`, which saves the JSON there\./],
    ['Looks good to me.\n', /`\.practice\/a-4-result\.json` isn't JSON\./],
    [{ ...REAL_RUN, type: 'assistant' }, /isn't the result of a `claude -p` run with `--output-format json`/],
    [{ ...REAL_RUN, session_id: STUB_SESSION }, /holds the check's stand-in reply, not a real run/],
    [{ ...REAL_RUN, subtype: 'error_max_turns', is_error: true, result: undefined }, /stopped early \(`error_max_turns`\) and holds no review\. Raise the cap, up to 10, narrow the prompt, or check your flags\. Then stage a change and run `scripts\/review-staged\.sh` again\./],
    [{ ...REAL_RUN, is_error: true, result: 'Not logged in · Please run /login' }, /The run in `\.practice\/a-4-result\.json` failed: "Not logged in · Please run \/login"\. Fix what it says\./],
    [{ ...REAL_RUN, result: '  ' }, /holds no review in `result`/],
    [{ ...REAL_RUN, num_turns: 7 }, /took 7 turns, more than `--max-turns 5` allows, so it ran with a higher cap\./],
  ]) {
    withRepo(reviewRepo({ result }), (dir) => {
      assert.match(String(runHint(dir)), hint, JSON.stringify(result));
    });
  }
  // Without a script to read the cap from, the cap is 10.
  withRepo(reviewRepo({ script: null, result: { ...REAL_RUN, num_turns: 11 } }), (dir) => {
    assert.equal(runHint(dir), true);
  });
});

test('the stand-in records each call\'s arguments and stdin as they were, and answers --version', () => {
  const script = '#!/usr/bin/env bash\nv=$(claude --version)\nprintf \'staged\\n\' | claude -p "$(printf \'two\\nlines\')" --model "x y" > "$1"\necho "$v"\n';
  withRepo(reviewRepo({ script }), (dir) => {
    const run = runStubbed(openRepo(dir), SCRIPT, { args: (out) => [join(out, 'reply.json')], reply: { type: 'result', session_id: STUB_SESSION } });
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(run.calls.map((c) => c.argv), [['--version'], ['-p', 'two\nlines', '--model', 'x y']]);
    assert.equal(run.calls[1].stdin, 'staged\n');
    assert.equal(JSON.parse(run.saved['out/reply.json']).session_id, STUB_SESSION);
    assert.match(run.stdout, /\(Claude Code\)/);
  });
});

test('the stand-in runs the script without the sign-in variables, with a HOME of its own', () => {
  const script = '#!/usr/bin/env bash\nprintf "%s|%s|%s|%s|%s|%s" "${ANTHROPIC_API_KEY-unset}" "${ANTHROPIC_AUTH_TOKEN-unset}" "${CLAUDE_CODE_OAUTH_TOKEN-unset}" "${ANTHROPIC_BASE_URL-unset}" "$HOME" "$CLAUDE_CONFIG_DIR" > "$1"\n';
  const fake = { ANTHROPIC_API_KEY: 'not-a-key', ANTHROPIC_AUTH_TOKEN: 'not-a-token', CLAUDE_CODE_OAUTH_TOKEN: 'not-a-token', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9' };
  const before = Object.fromEntries(Object.keys(fake).map((k) => [k, process.env[k]]));
  withRepo(reviewRepo({ script }), (dir) => {
    let run;
    try {
      Object.assign(process.env, fake);
      run = runStubbed(openRepo(dir), SCRIPT, { args: (out) => [join(out, 'env.txt')] });
    } finally {
      for (const [k, v] of Object.entries(before)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
    const [key, auth, token, url, home, config] = run.saved['out/env.txt'].split('|');
    assert.deepEqual([key, auth, token, url], ['unset', 'unset', 'unset', 'unset']);
    assert.match(home, /stub-claude-[^/]+\/home$/);
    assert.match(config, /stub-claude-[^/]+\/config$/);
  });
});

test('the stand-in stops a script at the time limit, with whatever the script left running', async () => {
  const outside = mkdtempSync(join(tmpdir(), 'a4-beat-'));
  const beat = join(outside, 'beat');
  const dir = reviewRepo({ script: '#!/usr/bin/env bash\n( while :; do date > "$1"; sleep 0.1; done ) &\nsleep 30\n' })();
  try {
    const started = Date.now();
    const run = runStubbed(openRepo(dir), SCRIPT, { args: () => [beat], timeout: 1000 });
    assert.equal(run.timedOut, true);
    assert.ok(Date.now() - started < 10_000, 'the run went on past the time limit');
    const last = statSync(beat).mtimeMs;
    await wait(600);
    assert.equal(statSync(beat).mtimeMs, last, 'the background loop is still running');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test('on Windows the stand-in gets one PATH, its bin first, and no sign-in variable in any case', () => {
  const from = { Path: 'C:/real', PATH: 'C:/other', anthropic_api_key: 'k', Claude_Code_OAuth_Token: 't', ANTHROPIC_AUTH_TOKEN: 'a', KEEP: '1' };
  const env = scrubbed(undefined, 'C:/stub/bin', 'win32', from);
  assert.deepEqual(Object.keys(env).filter((k) => /^path$/i.test(k)), ['PATH']);
  assert.ok(env.PATH?.startsWith('C:/stub/bin;'), env.PATH);
  assert.deepEqual(Object.keys(env).sort(), ['KEEP', 'PATH']);
});

test('the stand-in refuses on Windows without Git Bash, and says to install Git for Windows', () => {
  const outside = mkdtempSync(join(tmpdir(), 'a4-win-'));
  const ran = join(outside, 'ran');
  try {
    withRepo(reviewRepo({ script: `#!/usr/bin/env bash\ntouch "${ran}"\n` }), (dir) => {
      const run = runStubbed(openRepo(dir), SCRIPT, { platform: 'win32', bash: null });
      assert.deepEqual(run, { windows: true });
      assert.equal(existsSync(ran), false, 'the stand-in ran the script on Windows without Git Bash');
      assert.equal(notRun(run, SCRIPT), 'The check didn\'t run `scripts/review-staged.sh`: on Windows it runs scripts with Git Bash and a stand-in for `claude`, and it found no Git Bash. Install Git for Windows, or run the check from WSL 2, macOS or Linux.');
      assert.equal(runStubbed(openRepo(dir), SCRIPT, { platform: 'linux' }).status, 0);
      assert.equal(existsSync(ran), true);
    });
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
});

test('Git Bash is found from git\'s own folder on Windows, never under the Windows folder or WindowsApps', () => {
  const has = (...paths) => (path) => paths.includes(path);
  const exec = 'C:\\Program Files\\Git\\mingw64\\libexec\\git-core';
  const env = { SystemRoot: 'C:\\WINDOWS' };
  assert.equal(findBash({ platform: 'win32', execPath: exec, env, exists: has('C:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/usr/bin/bash.exe') }), 'C:/Program Files/Git/bin/bash.exe');
  assert.equal(findBash({ platform: 'win32', execPath: exec, env, exists: has('C:/Program Files/Git/usr/bin/bash.exe') }), 'C:/Program Files/Git/usr/bin/bash.exe');
  assert.equal(findBash({ platform: 'win32', execPath: exec, env, exists: has() }), null);
  assert.equal(findBash({ platform: 'win32', execPath: 'C:/Windows/System32/git-core', env, exists: has('C:/Windows/System32/bin/bash.exe') }), null);
  assert.equal(findBash({ platform: 'win32', execPath: 'C:\\Users\\me\\AppData\\Local\\Microsoft\\WindowsApps\\git', env, exists: has('C:/Users/me/AppData/Local/Microsoft/WindowsApps/git/bin/bash.exe') }), null);
  assert.equal(findBash({ platform: 'linux', execPath: exec, exists: has() }), 'bash');
  assert.equal(findBash({ platform: 'darwin' }), 'bash');
});

test('on Windows the stand-in records the folder as Windows names it, and paths match whatever their case and slashes', () => {
  const text = stubText('C:\\Users\\RUNNER~1\\Temp\\stub-claude-x', 'win32');
  assert.match(text, /^d='C:\/Users\/RUNNER~1\/Temp\/stub-claude-x'$/m);
  assert.match(text, /^pwd -W > /m);
  assert.match(stubText('/tmp/stub-claude-x', 'linux'), /^pwd > /m);
  const roots = ['C:\\x\\repo'];
  assert.equal(within(roots, '/c/x/repo/a', 'win32'), 'a');
  assert.equal(within(roots, 'c:/X/Repo/src/b.js', 'win32'), 'src/b.js');
  assert.equal(within(roots, 'C:/x/other', 'win32'), null);
  assert.equal(within(roots, 'D:/x/repo', 'win32'), null);
  const run = { roots };
  assert.equal(scratchPath(run, { cwd: 'src' }, 'b.js', 'win32'), 'src/b.js');
  assert.equal(scratchPath(run, { cwd: '' }, '/c/x/repo/.claude/x.json', 'win32'), '.claude/x.json');
  assert.equal(scratchPath(run, { cwd: '' }, 'C:\\x\\repo\\.claude\\x.json', 'win32'), '.claude/x.json');
});

test('a script reaches the stand-in, not a real claude or claude.cmd earlier on PATH', () => {
  const outside = mkdtempSync(join(tmpdir(), 'a4-real-'));
  const real = join(outside, 'real');
  const marker = join(outside, 'reached');
  mkdirSync(real);
  for (const name of ['claude', 'claude.cmd']) {
    writeFileSync(join(real, name), `#!/bin/sh\ntouch "${marker}"\n`);
    chmodSync(join(real, name), 0o755);
  }
  const path = process.env.PATH;
  process.env.PATH = `${real}${delimiter}${path ?? ''}`;
  try {
    withRepo(reviewRepo({ script: '#!/usr/bin/env bash\nclaude -p "Say hi" > /dev/null\n' }), (dir) => {
      const run = runStubbed(openRepo(dir), SCRIPT);
      assert.equal(run.status, 0, run.stderr);
      assert.equal(run.calls?.length, 1);
      assert.equal(existsSync(marker), false, 'the script reached a claude before the stand-in');
    });
  } finally {
    process.env.PATH = path;
    rmSync(outside, { recursive: true, force: true });
  }
});

test('the argv reader takes values and lists as Claude Code does', () => {
  const p = (...argv) => parseClaudeArgs(argv);
  // A list keeps taking arguments until the next option, so it takes a
  // prompt written after it; the = form takes one value.
  assert.deepEqual(p('-p', '--allowedTools', 'Read', 'Say hi').flags.allowedTools, ['Read', 'Say hi']);
  assert.equal(p('-p', '--allowedTools', 'Read', 'Say hi').promptFirst, false);
  assert.equal(p('--allowedTools=Read', 'Say hi', '-p').prompt, 'Say hi');
  // Short flags combine; what follows -p in the same token comes next.
  assert.equal(p('-cp', 'Say hi').promptFirst, true);
  assert.deepEqual([p('-pc', 'Say hi').promptFirst, p('-pc', 'Say hi').next], [false, '-c']);
  // An optional value is the next argument unless that is an option; a
  // value is the next argument, whatever it starts with.
  assert.equal(p('-p', '--debug', 'Say hi').prompt, undefined);
  assert.equal(p('--debug', '-p', 'Say hi').prompt, 'Say hi');
  assert.equal(p('-p', 'x', '--append-system-prompt', '-be brief').flags.appendSystemPrompt, '-be brief');
  assert.equal(p('-p', 'x', '-rabc').flags.resume, 'abc');
  // Aliases share a name, a list adds up, and the last value wins.
  const r = p('-p', 'x', '--allowed-tools', 'Read', '--allowedTools', 'Grep', '--max-turns', '3', '--max-turns=5', '--max-budget-usd');
  assert.deepEqual([r.flags.allowedTools, r.flags.maxTurns, r.flags.maxBudgetUsd], [['Read', 'Grep'], '5', null]);
  assert.deepEqual(p('-p', 'x', '--allowedtools', 'Read').unknown, ['--allowedtools']);
  assert.deepEqual(p('-p', '--', '-x').operands, ['-x']);
  assert.deepEqual(ruleList(['Read, Grep', 'Bash(git diff *) Glob', ' ']), ['Read', 'Grep', 'Bash(git diff *)', 'Glob']);
});

test('a-4 fails on an unsolved repository and passes on a solved one, as the template\'s assertions expect', () => {
  withRepo(reviewRepo({ script: null, result: null }), (dir) => {
    const { code, out } = check(['a-4', '--assert', 'fail', '--dir', dir]);
    assert.equal(code, 0, out);
  });
  withRepo(reviewRepo(), (dir) => {
    const { code, out } = check(['a-4', '--assert', 'pass', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

// A repository after lesson a-5, in a copy of the template: the link check
// report workflow on a commit of its own, and the saved list of its runs, one
// run on that commit. The options change a step: `workflow` (null for none) is
// written at `path` and committed unless `commitWorkflow` is false;
// `teardown` deletes it in a later commit; `runs` builds the saved list from
// the workflow's commit (null for none; text or a Buffer as it is);
// `origin` is the remote (null for none); `after` changes the repository
// last. The checks never run gh, so no run happens.
const PIN = 'fd1c128679612beff4ca259c78021c506e8aa7a7';
const ORIGIN = 'git@github.com:learner/claude-actions-practice.git';
const RUN_AT = 'https://github.com/learner/claude-actions-practice/actions/runs/123456789';
const PROMPT_LINES = [
  '          prompt: |',
  '            Run `npm run linkcheck -- samples`. For each broken link it reports, explain in one sentence why it is broken.',
  "            Don't change any files.",
];
const ARGS = '--model sonnet --max-turns 8 --allowedTools "Bash(npm run linkcheck *)"';
const LINKCHECK_REPORT = [
  'name: Link check report',
  '',
  'on:',
  '  workflow_dispatch:',
  '',
  'permissions:',
  '  contents: read',
  '',
  'jobs:',
  '  report:',
  '    runs-on: ubuntu-latest',
  '    timeout-minutes: 10',
  '    steps:',
  '      - uses: actions/checkout@v7',
  '      - uses: actions/setup-node@v7',
  '        with:',
  '          node-version: lts/*',
  `      - uses: anthropics/claude-code-action@${PIN} # v1.0.237`,
  '        with:',
  '          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}',
  '          github_token: ${{ github.token }}',
  ...PROMPT_LINES,
  `          claude_args: ${ARGS}`,
  '',
].join('\n');
// Quick setup's interactive workflow, cut down: no prompt, @claude events.
const CLAUDE_YML = [
  'name: Claude Code',
  'on:',
  '  issue_comment:',
  '    types: [created]',
  '  issues:',
  '    types: [opened, assigned]',
  'jobs:',
  '  claude:',
  "    if: contains(github.event.comment.body, '@claude')",
  '    runs-on: ubuntu-latest',
  '    permissions:',
  '      contents: read',
  '      id-token: write',
  '    steps:',
  '      - uses: actions/checkout@v4',
  '      - uses: anthropics/claude-code-action@v1',
  '        with:',
  '          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}',
  '',
].join('\n');

const runOf = (sha, extra = {}) => ({ databaseId: 123456789, status: 'completed', conclusion: 'success', event: 'workflow_dispatch', headSha: sha, url: RUN_AT, workflowName: 'Link check report', ...extra });

// The lesson's workflow with each `[from, to]` replaced.
function reportWith(...pairs) {
  return pairs.reduce((text, [from, to]) => {
    assert.ok(text.includes(from), `the workflow has no ${JSON.stringify(from)}`);
    return text.replace(from, () => to);
  }, LINKCHECK_REPORT);
}
const withArgs = (args) => reportWith([`claude_args: ${ARGS}`, `claude_args: ${args}`]);

function actionsRepo({ workflow = LINKCHECK_REPORT, path = WORKFLOW, commitWorkflow = true, teardown = false, runs = (sha) => [runOf(sha)], origin = ORIGIN, after } = {}) {
  return () => {
    const dir = repo({ 'README.md': '# demo\n', 'samples/guide.md': '[setup](setup.md)\n' });
    if (origin) git(dir, 'remote', 'add', 'origin', origin);
    const start = commit(dir, 'Start');
    let added = start;
    if (workflow !== null) {
      write(dir, { [path]: workflow });
      if (commitWorkflow) added = commit(dir, 'Add the link check report workflow', [path]);
    }
    if (teardown) {
      git(dir, 'rm', '-q', path);
      commit(dir, 'Tear down the Claude workflow', []);
    }
    if (runs !== null) {
      const saved = typeof runs === 'function' ? runs(added, start) : runs;
      write(dir, { [RUNS]: typeof saved === 'string' || Buffer.isBuffer(saved) ? saved : JSON.stringify(saved, null, 2) });
    }
    after?.(dir, { added, start });
    return dir;
  };
}

const a5 = (dir) => check(['a-5', '--dir', dir]);
// One item on its own.
const setupHint = (dir, options) => pinnedWorkflow(options).check(openRepo(dir));
const limitsHint = (dir, options) => workflowLimits(options).check(openRepo(dir));
const runsHint = (dir) => dispatchedRun().check(openRepo(dir));

test('a-5 passes for the lesson\'s workflow, committed, and a saved manual run on its commit', () => {
  withRepo(actionsRepo(), (dir) => {
    const { code, out } = a5(dir);
    assert.equal(code, 0, out);
    assert.match(out, /3 of 3 passed/);
  });
});

test('a-5 still passes after the teardown deletes the workflow, since it reads the history', () => {
  withRepo(actionsRepo({ teardown: true }), (dir) => {
    assert.equal(existsSync(join(dir, WORKFLOW)), false);
    const { code, out } = a5(dir);
    assert.equal(code, 0, out);
  });
  // The same with quick setup's workflow beside it, both deleted.
  withRepo(actionsRepo({
    teardown: true,
    after: (dir) => {
      write(dir, { '.github/workflows/claude.yml': CLAUDE_YML });
      commit(dir, 'Add claude.yml', ['.github/workflows/claude.yml']);
      git(dir, 'rm', '-q', '.github/workflows/claude.yml');
      commit(dir, 'Remove claude.yml', []);
    },
  }), (dir) => {
    const { code, out } = a5(dir);
    assert.equal(code, 0, out);
  });
});

test('a-5 accepts the workflow written in other ways', () => {
  const steps = LINKCHECK_REPORT.split('\n');
  const atStepsIndent = steps.map((l, i) => (i > 12 ? l.replace(/^ {2}/, '') : l)).join('\n');
  for (const workflow of [
    withArgs(ARGS.replace('--allowedTools', '--allowed-tools')),
    withArgs('|\n            --model sonnet\n            # One command, and a cap.\n            --max-turns 8\n            --allowedTools "Bash(npm run linkcheck *)"'),
    withArgs('>-\n            --model sonnet --max-turns 8\n            --allowedTools "Bash(npm run linkcheck *)"'),
    withArgs(`'--max-turns 8 --allowedTools "Bash(npm run linkcheck *)"'`),
    withArgs(`"--max-turns 8 --allowedTools \\"Bash(npm run linkcheck *)\\""`),
    withArgs("--max-turns 8 --allowedTools 'Bash(npm run linkcheck *)' Read"),
    withArgs('--max-turns 8 --allowedTools=Bash(npm\\ run\\ linkcheck\\ *)'),
    withArgs('--max-turns 10 --allowedTools "Bash(npm run linkcheck *),Read"'),
    reportWith([`anthropics/claude-code-action@${PIN} # v1.0.237`, '"anthropics/claude-code-action@v1.0.237"']),
    reportWith([`anthropics/claude-code-action@${PIN} # v1.0.237`, `'anthropics/claude-code-action@${PIN}'`]),
    reportWith(['${{ github.token }}', '${{ secrets.GITHUB_TOKEN }}']),
    reportWith(['anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}', 'claude_code_oauth_token: ${{secrets.CLAUDE_CODE_OAUTH_TOKEN}}']),
    reportWith(['permissions:\n  contents: read\n\n', ''], ['    timeout-minutes: 10\n', '    timeout-minutes: 10\n    permissions:\n      contents: read\n      id-token: write\n']),
    reportWith(['permissions:\n  contents: read', 'permissions: read-all']),
    reportWith(['permissions:\n  contents: read', 'permissions: {}']),
    reportWith(['    timeout-minutes: 10\n', ''], ['        with:\n          anthropic_api_key', '        timeout-minutes: 15\n        with:\n          anthropic_api_key']),
    reportWith(['on:\n  workflow_dispatch:', 'on: workflow_dispatch']),
    reportWith(['on:\n  workflow_dispatch:', 'on: [push, workflow_dispatch]']),
    reportWith(['on:\n  workflow_dispatch:', '"on":\n  workflow_dispatch:\n    inputs:\n      folder:\n        default: samples']),
    reportWith([PROMPT_LINES.join('\n'), '          prompt: Run `npm run linkcheck -- samples` and explain\n            why each broken link is broken. Change no files.']),
    atStepsIndent,
  ]) {
    withRepo(actionsRepo({ workflow }), (dir) => {
      assert.equal(setupHint(dir), true, workflow);
      assert.equal(limitsHint(dir), true, workflow);
    });
  }
  // A .yaml file, and Windows line ends, end to end.
  for (const options of [{ path: '.github/workflows/linkcheck-report.yaml' }, { workflow: LINKCHECK_REPORT.replace(/\n/g, '\r\n') }]) {
    withRepo(actionsRepo(options), (dir) => {
      const { code, out } = a5(dir);
      assert.equal(code, 0, `${JSON.stringify(options)}: ${out}`);
    });
  }
});

test('a-5 names what the first item finds wrong, in the file and on its line', () => {
  const KEY_TEXT = `sk-ant-api03-${'Xy9_'.repeat(8)}`;
  for (const [workflow, hint] of [
    [reportWith([`@${PIN} # v1.0.237`, '@v1']), /`@v1` on line 18 can move to a new release, which changes the Claude Code version on the runner without a commit of yours\. Pin a release tag \(`@vX\.Y\.Z`\) or that release's full commit SHA\./],
    [reportWith([`@${PIN} # v1.0.237`, '@main']), /`@main` on line 18 can move to a new release/],
    [reportWith([`@${PIN} # v1.0.237`, '@fd1c128']), /`@fd1c128` on line 18 is a short commit SHA\. Write the full 40-character SHA\./],
    [reportWith([`@${PIN} # v1.0.237`, '']), /Line 18 runs `anthropics\/claude-code-action` without a version\./],
    [reportWith([PROMPT_LINES.join('\n') + '\n', '']), /The step on line 18 has no `prompt`, so Claude waits for `@claude` in an issue or pull request \(interactive mode\)\. Add a `prompt` under `with:`/],
    [reportWith([PROMPT_LINES.join('\n'), '          prompt: ""']), /The `prompt` on line 22 is empty\./],
    [reportWith(['${{ secrets.ANTHROPIC_API_KEY }}', KEY_TEXT]), /Line 20 holds what looks like a Claude API key or token\. Treat it as leaked: delete the key in the Claude Console now, because removing it from the file doesn't take it out of your history\./],
    [reportWith(['name: Link check report', `name: Link check report # was ${KEY_TEXT}`]), /Line 1 holds what looks like a Claude API key or token/],
    [reportWith(['${{ secrets.ANTHROPIC_API_KEY }}', '${{ env.CLAUDE_KEY }}']), /`anthropic_api_key` on line 20 isn't read from a secret\. Write `anthropic_api_key: \$\{\{ secrets\.<NAME> \}\}`/],
    [reportWith(['          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}\n', '']), /The step on line 18 passes no credential\. Add `anthropic_api_key: \$\{\{ secrets\.ANTHROPIC_API_KEY \}\}` under `with:`/],
    [reportWith(['  workflow_dispatch:', '  workflow_dispatch:\n  pull_request_target:']), /Remove `pull_request_target` from `on:`\. GitHub warns that running untrusted code on it can grant unintended access to write privileges or secrets\./],
  ]) {
    withRepo(actionsRepo({ workflow }), (dir) => {
      const got = String(setupHint(dir));
      assert.match(got, /^`\.github\/workflows\/linkcheck-report\.yml`: /, workflow);
      assert.match(got, hint, workflow);
      assert.doesNotMatch(got, /sk-ant-/, 'the hint repeats the key');
      assert.doesNotMatch(got, /undefined|null/, workflow);
    });
  }
});

test('a-5 names each limit the second item finds missing or too loose', () => {
  const longKey = '--max-turns 8 --allowedTools "Bash(npm run linkcheck *)"';
  for (const [workflow, hint] of [
    [withArgs(ARGS.replace('--max-turns 8', '--max-turns 50')), /`--max-turns 50` is above 10: use a number from 1 to 10\./],
    [withArgs(ARGS.replace('--max-turns 8', '--max-turns 0')), /`--max-turns 0` is below 1/],
    [withArgs(ARGS.replace('--max-turns 8', '--max-turns eight')), /`--max-turns eight` isn't a whole number/],
    [withArgs(ARGS.replace(' --max-turns 8', '')), /`claude_args` sets no turn limit: add `--max-turns` with a number from 1 to 10\./],
    [withArgs(ARGS.replace('--max-turns 8', '--max-turns=8')), /Write `--max-turns 8` with a space, not `--max-turns=8`: the action reads a flag's value from the word after it\./],
    [withArgs(ARGS.replace('--max-turns 8', '--max-turns=20')), /Write `--max-turns` with a space and a number from 1 to 10, not `--max-turns=20`/],
    [withArgs(ARGS.replace('--max-turns 8', '--max_turns 8')), /sets no turn limit: .* Claude Code doesn't know `--max_turns`: write `--max-turns`\./],
    [withArgs('--allowedTools "Bash(npm run linkcheck *)" --max-turns'), /`--max-turns` has no number after it/],
    [withArgs(ARGS.replace('"Bash(npm run linkcheck *)"', 'Bash')), /`--allowedTools` lists `Bash`, which lets Claude run any command\. Name only the command it needs, as in `Bash\(<command> \*\)`\./],
    [withArgs(ARGS.replace('"Bash(npm run linkcheck *)"', '"Read,Bash(*)"')), /lists `Bash\(\*\)`, which lets Claude run any command/],
    [withArgs(ARGS.replace('"Bash(npm run linkcheck *)"', '"Bash(:*)"')), /lists `Bash\(:\*\)`/],
    [withArgs(ARGS.replace('"Bash(npm run linkcheck *)"', '"Bash( *)"')), /lists `Bash\( \*\)`/],
    [withArgs(ARGS.replace('"Bash(npm run linkcheck *)"', 'Bash(npm run linkcheck *)')), /`--allowedTools` gets `Bash\(npm`, `run`, `linkcheck` and `\*\)` as separate words, because the action splits `claude_args` at spaces outside quotes\. Put each rule in quotes, as in `--allowedTools "Bash\(npm run linkcheck \*\)"`\./],
    [withArgs(ARGS.replace(' --allowedTools "Bash(npm run linkcheck *)"', '')), /`claude_args` pre-approves no tool: add `--allowedTools` naming only the command Claude needs, as in `--allowedTools "Bash\(<command> \*\)"`\./],
    [withArgs(ARGS.replace('--allowedTools', '--allowedtools')), /Claude Code doesn't know `--allowedtools`: write `--allowedTools`\./],
    [withArgs(ARGS.replace('"Bash(npm run linkcheck *)"', '""')), /`--allowedTools` lists no tool/],
    [withArgs(`|\n            --model sonnet # the cheaper model\n            ${longKey}`), /: An unquoted `#` in `claude_args` starts a comment that, for the action, runs to the end of the value, so it never reads `--max-turns` and `--allowedTools`\. Move that comment to a line of its own, above `claude_args`\.$/],
    [reportWith([`          claude_args: ${ARGS}\n`, '']), /The step on line 18 has no `claude_args`, so nothing limits the run\./],
    [reportWith(['    timeout-minutes: 10\n', '']), /The job `report` sets no `timeout-minutes`, so only GitHub's default limit stops a run that hangs\. Add `timeout-minutes` with a number from 1 to 30 to the job\./],
    [reportWith(['timeout-minutes: 10', 'timeout-minutes: 90']), /`timeout-minutes: 90` on line 12 is above 30: use a number from 1 to 30\./],
    [reportWith(['timeout-minutes: 10', 'timeout-minutes: ${{ inputs.minutes }}']), /`timeout-minutes: \$\{\{ inputs\.minutes \}\}` on line 12 isn't a whole number/],
    [reportWith(['permissions:\n  contents: read\n', '']), /Neither the workflow nor the job `report` sets `permissions`, so the job token gets the repository's default access, which can include write access\. Add `permissions:` with `contents: read`\./],
    [reportWith(['contents: read', 'contents: write']), /`contents: write` on line 7 gives the job token write access, and this job only reads\. Make it `read`, or remove it\./],
    [reportWith(['contents: read', 'contents: read\n  issues: write\n  pull-requests: write']), /`issues: write` and `pull-requests: write` on lines 8 and 9 give the job token write access/],
    [reportWith(['permissions:\n  contents: read', 'permissions: write-all']), /`permissions: write-all` on line 6 gives the job token write access to everything\. Use `contents: read`\./],
    [reportWith(['          github_token: ${{ github.token }}\n', '']), /The step on line 18 passes no `github_token`, so the action authenticates as the Claude GitHub App, which this copy doesn't have\. Add `github_token: \$\{\{ github\.token \}\}` under `with:`/],
    [reportWith(['${{ github.token }}', '${{ secrets.MY_TOKEN }}']), /`github_token` on line 21 isn't this job's own token, so the job's `permissions` don't limit it\./],
  ]) {
    withRepo(actionsRepo({ workflow }), (dir) => {
      const got = String(limitsHint(dir));
      assert.match(got, /^`\.github\/workflows\/linkcheck-report\.yml`: /, workflow);
      assert.match(got, hint, workflow);
      assert.doesNotMatch(got, /undefined|null/, workflow);
    });
  }
  // A job's own permissions replace the workflow's.
  withRepo(actionsRepo({ workflow: reportWith(['permissions:\n  contents: read', 'permissions: write-all'], ['    timeout-minutes: 10\n', '    timeout-minutes: 10\n    permissions:\n      contents: read\n']) }), (dir) => {
    assert.equal(limitsHint(dir), true);
  });
  // Four problems at once: three are named, then how many more.
  withRepo(actionsRepo({ workflow: reportWith([`          claude_args: ${ARGS}\n`, ''], ['    timeout-minutes: 10\n', ''], ['contents: read', 'contents: write'], ['          github_token: ${{ github.token }}\n', '']) }), (dir) => {
    assert.match(String(limitsHint(dir)), /And 1 more: fix these and run the check again\.$/);
  });
});

test('a-5 says to commit a workflow that is only in the working tree, and points out uncommitted fixes', () => {
  withRepo(actionsRepo({ commitWorkflow: false }), (dir) => {
    const { code, out } = a5(dir);
    assert.equal(code, 1, out);
    assert.match(out, /`\.github\/workflows\/linkcheck-report\.yml` isn't committed\. Run `git add \.github\/workflows\/linkcheck-report\.yml`, commit it, and push\. GitHub starts a workflow by hand only once its file is on the default branch\./);
    assert.match(out, /There is no committed workflow that starts on `workflow_dispatch` and runs `anthropics\/claude-code-action`, so the check can't read its limits\./);
  });
  withRepo(actionsRepo({ workflow: reportWith([`@${PIN} # v1.0.237`, '@v1']), after: (dir) => write(dir, { [WORKFLOW]: LINKCHECK_REPORT }) }), (dir) => {
    assert.match(String(setupHint(dir)), /`@v1` on line 18 can move.* Your copy of `\.github\/workflows\/linkcheck-report\.yml` has changes that aren't committed: if they fix this, commit them\./);
  });
  withRepo(actionsRepo({ workflow: 'name: Placeholder\non: workflow_dispatch\njobs: {}\n', after: (dir) => write(dir, { [WORKFLOW]: LINKCHECK_REPORT }) }), (dir) => {
    assert.match(String(setupHint(dir)), /Your copy of `\.github\/workflows\/linkcheck-report\.yml` runs `anthropics\/claude-code-action`, but that change isn't committed\. Commit it, and push\./);
  });
});

test('a-5 says the @claude workflow is not the one the lesson asks for, and names the events of one that starts otherwise', () => {
  withRepo(actionsRepo({ workflow: CLAUDE_YML, path: '.github/workflows/claude.yml' }), (dir) => {
    assert.match(String(setupHint(dir)), /`\.github\/workflows\/claude\.yml` has no `prompt`, so it waits for `@claude` \(interactive mode\)\. You need a second workflow, `\.github\/workflows\/linkcheck-report\.yml`, that starts with `on: workflow_dispatch` and has a `prompt`\. Write it as Your turn describes, then commit and push it\./);
  });
  withRepo(actionsRepo({ workflow: reportWith(['on:\n  workflow_dispatch:', 'on:\n  push:\n    branches: [main]']) }), (dir) => {
    assert.match(String(setupHint(dir)), /`\.github\/workflows\/linkcheck-report\.yml` runs Claude with a `prompt`, but starts on `push`\. Start it with `on: workflow_dispatch`, then commit and push\./);
  });
  withRepo(actionsRepo({ workflow: null }), (dir) => {
    assert.match(String(setupHint(dir)), /^There is no committed workflow that runs `anthropics\/claude-code-action`\. Write `\.github\/workflows\/linkcheck-report\.yml` as Your turn describes, then commit and push it\./);
  });
});

test('a-5 reads the newest commit that holds a manual workflow, and a later pull_request workflow never stands in for it', () => {
  const review = reportWith(['on:\n  workflow_dispatch:', 'on:\n  pull_request:'], [`@${PIN} # v1.0.237`, '@v1']);
  const later = (dir) => {
    write(dir, { '.github/workflows/claude-review.yml': review });
    commit(dir, 'Add the review workflow', ['.github/workflows/claude-review.yml']);
  };
  withRepo(actionsRepo({ after: later }), (dir) => {
    const { code, out } = a5(dir);
    assert.equal(code, 0, out);
    // The capstone's builder, limited to pull_request, reads the later one.
    const capstone = { triggers: ['pull_request'], file: '.github/workflows/claude-review.yml', guide: 'the brief' };
    assert.match(String(setupHint(dir, capstone)), /^`\.github\/workflows\/claude-review\.yml`: `@v1` on line 18 can move/);
    assert.equal(chosenWorkflow(openRepo(dir), ['pull_request'], capstone).file.path, '.github/workflows/claude-review.yml');
    assert.equal(chosenWorkflow(openRepo(dir), ['workflow_dispatch']).file.path, WORKFLOW);
  });
  // The Worked example's workflow also starts by hand, and never stands in
  // for the lesson's file once that file is in the history.
  const ask = reportWith([`claude_args: ${ARGS}`, 'claude_args: --max-turns 3 --allowedTools "Read"']);
  const askLater = (dir) => {
    write(dir, { '.github/workflows/ask-claude.yml': ask });
    commit(dir, 'Ask Claude by hand', ['.github/workflows/ask-claude.yml']);
  };
  withRepo(actionsRepo({ workflow: reportWith([`@${PIN} # v1.0.237`, '@v1']), after: askLater }), (dir) => {
    assert.match(String(setupHint(dir)), /^`\.github\/workflows\/linkcheck-report\.yml`: `@v1` on line 18/);
  });
  withRepo(actionsRepo({ workflow: null, after: askLater }), (dir) => {
    assert.equal(chosenWorkflow(openRepo(dir), ['workflow_dispatch']).file.path, '.github/workflows/ask-claude.yml');
  });
  // The newest version of the workflow counts, whichever way it changed.
  const edit = (text) => (dir) => {
    write(dir, { [WORKFLOW]: text });
    commit(dir, 'Change the workflow', [WORKFLOW]);
  };
  withRepo(actionsRepo({ after: edit(reportWith([`@${PIN} # v1.0.237`, '@v1'])) }), (dir) => {
    assert.match(String(setupHint(dir)), /`@v1` on line 18/);
  });
  withRepo(actionsRepo({ workflow: reportWith([`@${PIN} # v1.0.237`, '@v1']), after: edit(LINKCHECK_REPORT) }), (dir) => {
    assert.equal(setupHint(dir), true);
  });
  // After the teardown, a hint names the commit it read.
  withRepo(actionsRepo({ workflow: reportWith([`@${PIN} # v1.0.237`, '@v1']), teardown: true }), (dir) => {
    const added = git(dir, 'rev-parse', '--short=7', 'HEAD~1');
    assert.match(String(setupHint(dir)), new RegExp(`^\`\\.github/workflows/linkcheck-report\\.yml\` \\(as committed in ${added}\\): \`@v1\``));
  });
});

test('a-5 reads the workflow on both sides of a merge, after a merge that keeps the other side\'s workflows', () => {
  // After the teardown, a branch from the start that adds another workflow
  // is merged: the merge's workflows match that branch's alone.
  const merged = (dir, { start }) => {
    git(dir, 'checkout', '-q', '-b', 'other-ci', start);
    write(dir, { '.github/workflows/ci.yml': 'name: CI\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n' });
    commit(dir, 'Add CI', ['.github/workflows/ci.yml']);
    git(dir, 'checkout', '-q', '-');
    git(dir, 'merge', '-q', '--no-ff', '--no-edit', 'other-ci');
  };
  withRepo(actionsRepo({ teardown: true, after: merged }), (dir) => {
    assert.equal(git(dir, 'log', '--format=%H', '--', '.github/workflows').split('\n').length, 1, 'the merge hides nothing from git log, so this test shows nothing');
    const { code, out } = a5(dir);
    assert.equal(code, 0, out);
  });
});

test('a-5 picks the workflow with a prompt and the fewest problems among those of one commit', () => {
  const broken = reportWith([`@${PIN} # v1.0.237`, '@v1']);
  withRepo(actionsRepo({ after: (dir) => { write(dir, { '.github/workflows/a-broken.yml': broken }); commit(dir, 'Add another', ['.github/workflows/a-broken.yml']); } }), (dir) => {
    assert.equal(setupHint(dir), true);
  });
  const noPrompt = reportWith([PROMPT_LINES.join('\n') + '\n', '']);
  withRepo(actionsRepo({ workflow: broken, after: (dir) => { write(dir, { '.github/workflows/a-dispatch.yml': noPrompt }); commit(dir, 'Add another', ['.github/workflows/a-dispatch.yml']); } }), (dir) => {
    assert.match(String(setupHint(dir)), /^`\.github\/workflows\/linkcheck-report\.yml`: `@v1`/);
  });
});

test('a-5 reads the saved runs, and says what is wrong with them', () => {
  const utf16 = (text) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text.replace(/\n/g, '\r\n'), 'utf16le')]);
  for (const options of [
    { runs: (sha) => utf16(JSON.stringify([runOf(sha)], null, 2)) },
    { runs: (sha) => `﻿${JSON.stringify([runOf(sha)])}` },
    { runs: (sha) => runOf(sha) },
    { runs: (sha) => [runOf(sha, { status: 'in_progress', conclusion: '', databaseId: 2 }), runOf(sha)] },
    { runs: (sha) => [runOf(sha, { url: 'https://github.com/Learner/Claude-Actions-Practice/actions/runs/123456789' })] },
    { origin: 'https://github.com/learner/claude-actions-practice' },
    { origin: 'ssh://git@github.com/learner/claude-actions-practice.git' },
    { origin: null, runs: (sha) => [runOf(sha, { url: 'https://github.com/someone/else/actions/runs/1' })] },
    { origin: 'https://gitlab.com/learner/claude-actions-practice.git', runs: (sha) => [runOf(sha, { url: undefined })] },
  ]) {
    withRepo(actionsRepo(options), (dir) => {
      assert.equal(runsHint(dir), true, String(options.runs ?? options.origin));
    });
  }
  const SAVE = '`gh run list --workflow linkcheck-report\\.yml --json databaseId,status,conclusion,event,headSha,url,workflowName > \\.practice\\/a-5-runs\\.json`';
  for (const [runs, hint] of [
    [null, new RegExp(`^There is no \`\\.practice/a-5-runs\\.json\` yet\\. Once your run finishes, save the list: ${SAVE}\\.$`)],
    ['completed  success  Link check report\n', /`\.practice\/a-5-runs\.json` isn't JSON\. Save the list with `--json`, unchanged:/],
    [[], /`\.practice\/a-5-runs\.json` lists no runs\. Start the workflow with `gh workflow run linkcheck-report\.yml`/],
    [[{ name: 'Link check report' }], /doesn't hold the fields the check reads\. Save the list with them:/],
    [(sha) => [runOf(sha, { status: 'in_progress', conclusion: '' })], /Run 123456789 hasn't finished: its `status` is `in_progress`\. Wait for it with `gh run watch 123456789`, then save the list again\.$/],
    [(sha) => [runOf(sha, { conclusion: 'failure' })], /Run 123456789 ended with `failure`\. See why with `gh run view 123456789 --log-failed`, fix the workflow, commit and push it, run it again with `gh workflow run linkcheck-report\.yml`, then save the list again\.$/],
    [(sha) => [runOf(sha, { conclusion: 'cancelled' })], /Run 123456789 ended with `cancelled`\. Run the workflow again with `gh workflow run linkcheck-report\.yml`/],
    [(sha) => [runOf(sha, { event: 'issues' }), runOf(sha, { event: 'issue_comment' })], /`\.practice\/a-5-runs\.json` lists only runs that `@claude` started \(`issues` and `issue_comment`\)\. Start your workflow by hand with `gh workflow run linkcheck-report\.yml`/],
    [(sha) => [runOf(sha, { event: 'push' })], /lists no run started by hand \(`workflow_dispatch`\), only `push`\./],
    [(sha) => [runOf(sha, { url: 'https://github.com/someone/else/actions/runs/1' })], /Run 123456789 ran in `someone\/else`, but this repository's `origin` is `learner\/claude-actions-practice`\. Save the list in the copy you made for this lesson, and run the check there\./],
    [(sha) => [runOf(sha, { url: undefined })], /Run 123456789 in `\.practice\/a-5-runs\.json` has no GitHub run URL/],
    [(sha) => [runOf(sha, { headSha: undefined })], /Run 123456789 has no `headSha`/],
    [() => [runOf('0123456789abcdef0123456789abcdef01234567')], /Run 123456789 ran on commit 0123456, which this repository doesn't have\. Run `git pull` to fetch it, then run the check again\./],
    [(sha, start) => [runOf(start)], /ran on commit [0-9a-f]{7}, where `\.github\/workflows\/linkcheck-report\.yml` doesn't run `anthropics\/claude-code-action` with a `prompt`\. Once your workflow is pushed, run it with `gh workflow run linkcheck-report\.yml`/],
    [(sha) => [runOf(sha, { event: 'issues' }), runOf(sha, { conclusion: 'failure', databaseId: 7 })], /Run 7 ended with `failure`/],
  ]) {
    withRepo(actionsRepo({ runs }), (dir) => {
      assert.match(String(runsHint(dir)), hint, String(runs));
    });
  }
  // A run on a commit that holds only the @claude workflow, which has no
  // prompt: with the lesson's file in the history, the hint names that file.
  withRepo(actionsRepo({
    runs: null,
    after: (dir) => {
      write(dir, { '.github/workflows/claude.yml': CLAUDE_YML });
      const sha = commit(dir, 'Add claude.yml', ['.github/workflows/claude.yml']);
      git(dir, 'rm', '-q', WORKFLOW);
      const without = commit(dir, 'Drop the report', []);
      write(dir, { [RUNS]: JSON.stringify([runOf(without)]) });
      assert.ok(sha);
    },
  }), (dir) => {
    assert.match(String(runsHint(dir)), /where `\.github\/workflows\/linkcheck-report\.yml` doesn't run `anthropics\/claude-code-action` with a `prompt`/);
  });
  // With the workflow at another path, any workflow with a prompt counts.
  withRepo(actionsRepo({ path: '.github/workflows/report.yml', runs: (sha, start) => [runOf(start)] }), (dir) => {
    assert.match(String(runsHint(dir)), /where no workflow runs `anthropics\/claude-code-action` with a `prompt`/);
  });
});

test('the workflow reader takes the forms workflow files use, without a YAML library', () => {
  const read = (text) => readActions(text);
  assert.deepEqual(read('on: {workflow_dispatch: {}, push: {branches: [main]}}\njobs: {}\n').triggers, ['workflow_dispatch', 'push']);
  assert.deepEqual(read('on:\n  - push\n  - workflow_dispatch # by hand\njobs: {}\n').triggers, ['push', 'workflow_dispatch']);
  assert.deepEqual(read("'on': [ \"push\" ]\n").triggers, ['push']);
  const steps = read([
    'on: workflow_dispatch',
    'jobs:',
    '  a:',
    '    steps:',
    '      # - uses: anthropics/claude-code-action@v1',
    '      - name: Ask Claude',
    '        uses: Anthropics/Claude-Code-Action@v1.0.237 # pinned',
    '        with:',
    '          prompt: |',
    '            # Not a comment: part of the prompt.',
    '            Say hi.',
    '          claude_args: "--max-turns 2 --allowedTools \\"Read\\""',
    '  b:',
    '    steps:',
    '      - uses: anthropics/claude-code-action/base-action@v1',
    '',
  ].join('\n')).steps;
  assert.equal(steps.length, 1);
  assert.equal(steps[0].ref, 'v1.0.237');
  assert.equal(steps[0].line, 7);
  assert.equal(steps[0].inputs.prompt.text, '# Not a comment: part of the prompt.\nSay hi.');
  assert.equal(steps[0].inputs.claude_args.text, '--max-turns 2 --allowedTools "Read"');
  assert.equal(parseYaml('a: "one\n  two"\n').entries[0].value.text, 'one two');
  assert.equal(parseYaml('a: >\n  one\n  two\n\n  three\n').entries[0].value.text, 'one two\nthree');
  // claude_args as the action reads it: comment lines go, an inline # ends it.
  assert.deepEqual(claudeArgWords('# note\n--max-turns 3\n  --allowedTools "Bash(npm run linkcheck *)" \'Read\''), { words: ['--max-turns', '3', '--allowedTools', 'Bash(npm run linkcheck *)', 'Read'], comment: null });
  assert.deepEqual(claudeArgWords('--model sonnet # cheap\n--max-turns 3'), { words: ['--model', 'sonnet'], comment: '# cheap\n--max-turns 3' });
  assert.deepEqual(claudeArgWords('a#b "c#d"').words, ['a']);
  assert.deepEqual(claudeArgWords('--allowedTools Bash(npm\\ run\\ *) ""').words, ['--allowedTools', 'Bash(npm run *)', '']);
});

test('a-5 fails on an unsolved repository and passes on a solved one, as the template\'s assertions expect', () => {
  withRepo(actionsRepo({ workflow: null, runs: null }), (dir) => {
    const { code, out } = check(['a-5', '--assert', 'fail', '--dir', dir]);
    assert.equal(code, 0, out);
  });
  // The solutions branch: the workflow added, then torn down, so no branch
  // head carries a live Claude workflow, and a run record on the add commit.
  withRepo(actionsRepo({ teardown: true }), (dir) => {
    const { code, out } = check(['a-5', '--assert', 'pass', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

// A repository after lesson a-6: an Intermediate setup (a tdd skill, a
// test-gaps subagent and a protect-files hook in .claude/), then the example
// marketplace committed in `root`, registered in .claude/settings.json and
// turned on, the subagent moved into team-kit with git mv, the personal
// files ignored, and the strict validation of the plugin saved. The options
// change a step: `market` replaces the marketplace file; `settings` replaces
// the committed settings (null for none); `gitignore` is committed (null for
// none); `move` lists the [from, to] pairs moved with git mv; `files` writes
// or, with null, deletes files before the commit; `report` is the saved
// validation, as an object, text, a Buffer, a function of the folder and the
// plugin's path, or null for none; `after` changes the repository last.
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const TDD_SKILL = '---\nname: tdd\ndescription: Builds a feature test first, then the code, then refactors.\n---\n\nWrite a failing test first.\n';
const TEST_GAPS = '---\nname: test-gaps\ndescription: Lists the functions that no test calls. Use before adding tests.\ntools: Read, Grep, Glob\n---\n\nList them.\n';
const PROTECT_HOOK = '.claude/hooks/protect-files.sh';
const PROJECT_HOOKS = { PreToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command: '${CLAUDE_PROJECT_DIR}/.claude/hooks/protect-files.sh', args: [] }] }] };
const BASE_SETTINGS = { permissions: { allow: ['Bash(npm test)'], deny: ['Read(./.env)'] }, hooks: PROJECT_HOOKS };
const MARKETPLACE_ROOT = 'team-marketplace';
const TEAM_KIT = `${MARKETPLACE_ROOT}/plugins/team-kit`;
const TEAM_MARKET = { name: 'team-tools', description: 'A demo team marketplace.', owner: { name: 'Your team' }, plugins: [{ name: 'team-kit', source: './plugins/team-kit', description: 'The team\'s shared skills and subagents' }] };
const SHARED_SETTINGS = {
  ...BASE_SETTINGS,
  extraKnownMarketplaces: { 'team-tools': { source: { source: 'directory', path: './team-marketplace' } } },
  enabledPlugins: { 'team-kit@team-tools': true },
};
const PERSONAL_IGNORE = '.practice/\n.claude/settings.local.json\nCLAUDE.local.md\n';
const under = (root, path) => (root ? `${root}/${path}` : path);
const reportOf = (target, extra = {}) => ({ success: true, strict: true, target, manifest: { file: target, type: 'plugin', errors: [], warnings: [], notes: [] }, contents: [], ...extra });
const VALID_REPORT = (dir, plugin) => reportOf(join(realpathSync(dir), plugin, '.claude-plugin', 'plugin.json'));

function shareRepo({
  root = MARKETPLACE_ROOT, market = TEAM_MARKET, settings = SHARED_SETTINGS, gitignore = PERSONAL_IGNORE,
  move = [['.claude/agents/test-gaps.md', 'agents/test-gaps.md']], files = {}, report = VALID_REPORT, after,
} = {}) {
  return () => {
    const plugin = under(root, 'plugins/team-kit');
    const dir = repo({
      'README.md': '# demo\n',
      ...(gitignore === null ? {} : { '.gitignore': gitignore }),
      '.claude/settings.json': json(BASE_SETTINGS),
      '.claude/skills/tdd/SKILL.md': TDD_SKILL,
      '.claude/agents/test-gaps.md': TEST_GAPS,
      [PROTECT_HOOK]: '#!/bin/bash\nexit 0\n',
    });
    commit(dir, 'Start');
    write(dir, {
      [under(root, '.claude-plugin/marketplace.json')]: typeof market === 'string' ? market : json(market),
      [`${plugin}/.claude-plugin/plugin.json`]: json({ name: 'team-kit', version: '0.1.0', description: 'A team\'s shared setup', author: { name: 'Your team' } }),
      [`${plugin}/skills/onboard/SKILL.md`]: '---\nname: onboard\ndescription: Explains the shared setup to a new teammate.\n---\n\nExplain it.\n',
      [`${plugin}/agents/config-reviewer.md`]: '---\nname: config-reviewer\ndescription: Reviews the shared configuration.\ntools: Read, Grep, Glob\nmodel: inherit\n---\n\nReview it.\n',
    });
    if (settings === null) rmSync(join(dir, '.claude/settings.json'));
    else write(dir, { '.claude/settings.json': typeof settings === 'string' ? settings : json(settings) });
    for (const [from, to] of move) {
      const target = to.startsWith('.claude/') ? to : `${plugin}/${to}`;
      execFileSync('mkdir', ['-p', join(dir, target, '..')]);
      git(dir, 'mv', from, target);
    }
    for (const [path, text] of Object.entries(files)) {
      if (text === null) rmSync(join(dir, path), { recursive: true, force: true });
      else write(dir, { [path]: text });
    }
    commit(dir, 'Share the team\'s Claude Code setup');
    if (report !== null) {
      const saved = typeof report === 'function' ? report(dir, plugin) : report;
      write(dir, { [VALIDATE]: typeof saved === 'string' || Buffer.isBuffer(saved) ? saved : json(saved) });
    }
    after?.(dir, plugin);
    return dir;
  };
}

const a6 = (dir) => check(['a-6', '--dir', dir]);
// One item on its own.
const marketHint = (dir) => teamMarketplace.check(openRepo(dir));
const settingsHint = (dir) => sharedSettings.check(openRepo(dir));
const movedHint = (dir) => movedComponent.check(openRepo(dir));
const personalHint = (dir) => personalFiles.check(openRepo(dir));
const validateHint = (dir) => strictValidation().check(openRepo(dir));
const marketWith = (...entries) => ({ ...TEAM_MARKET, plugins: entries });
const settingsWith = (extra) => ({ ...BASE_SETTINGS, ...extra });
const registered = (source, key = 'team-tools') => settingsWith({ extraKnownMarketplaces: { [key]: { source } }, enabledPlugins: { 'team-kit@team-tools': true } });

test('a-6 passes for the example marketplace registered and turned on, a subagent moved into it, the personal files ignored and a strict validation saved', () => {
  withRepo(shareRepo(), (dir) => {
    const { code, out } = a6(dir);
    assert.equal(code, 0, out);
    assert.match(out, /4 of 4 passed/);
  });
});

test('a-6\'s first item names the marketplace\'s problem first, then the saved validation\'s', () => {
  const first = (dir) => validatedMarketplace.check(openRepo(dir));
  withRepo(shareRepo({ report: null }), (dir) => {
    assert.equal(marketHint(dir), true);
    assert.match(String(first(dir)), /There is no `\.practice\/a-6-validate\.json` yet/);
  });
  withRepo(shareRepo({ market: null, files: { [`${MARKETPLACE_ROOT}/.claude-plugin`]: null }, report: null }), (dir) => {
    assert.match(String(first(dir)), /There is no committed `\.claude-plugin\/marketplace\.json`/);
  });
});

test('a-6 accepts the other ways to write the registration', () => {
  for (const settings of [
    registered({ source: 'directory', path: 'team-marketplace' }),
    registered({ source: 'directory', path: './team-marketplace/' }),
    registered({ source: 'file', path: './team-marketplace/.claude-plugin/marketplace.json' }),
    settingsWith({ additionalMarketplaces: SHARED_SETTINGS.extraKnownMarketplaces, enabledPlugins: { 'team-kit@team-tools': true } }),
    // With both spellings, Claude Code reads extraKnownMarketplaces only.
    { ...SHARED_SETTINGS, additionalMarketplaces: { 'team-tools': { source: { source: 'github', repo: 'acme/elsewhere' } } } },
  ]) {
    withRepo(shareRepo({ settings }), (dir) => {
      assert.equal(settingsHint(dir), true, JSON.stringify(settings));
    });
  }
});

test('a-6 accepts a marketplace at the repository\'s root, registered as . or ./', () => {
  for (const path of ['.', './']) {
    withRepo(shareRepo({ root: '', settings: registered({ source: 'directory', path }) }), (dir) => {
      const { code, out } = a6(dir);
      assert.equal(code, 0, `${path}: ${out}`);
    });
  }
});

test('a-6 says how to start without a marketplace, to commit one, and to rename a folder still called dot-claude-plugin/', () => {
  withRepo(shareRepo({ market: null, files: { [`${MARKETPLACE_ROOT}/.claude-plugin`]: null } }), (dir) => {
    const { code, out } = a6(dir);
    assert.equal(code, 1, out);
    assert.match(out, /There is no committed `\.claude-plugin\/marketplace\.json`\. Download the example marketplace into `team-marketplace\/`/);
    assert.match(out, /No committed marketplace passes the item above yet/);
  });
  withRepo(shareRepo({ files: { [`${MARKETPLACE_ROOT}/.claude-plugin`]: null, [`${MARKETPLACE_ROOT}/dot-claude-plugin/marketplace.json`]: json(TEAM_MARKET) } }), (dir) => {
    assert.match(String(marketHint(dir)), /`team-marketplace\/dot-claude-plugin\/` isn't a marketplace until it's named `\.claude-plugin\/`.*Run `git mv team-marketplace\/dot-claude-plugin team-marketplace\/\.claude-plugin`/);
  });
  withRepo(shareRepo({
    files: { [`${MARKETPLACE_ROOT}/.claude-plugin`]: null },
    after: (dir) => write(dir, { [`${MARKETPLACE_ROOT}/.claude-plugin/marketplace.json`]: json(TEAM_MARKET) }),
  }), (dir) => {
    assert.equal(marketHint(dir), '`team-marketplace` isn\'t committed. Run `git add team-marketplace` and commit it.');
  });
  // The template's own folders and dependencies are never read.
  withRepo(shareRepo({ files: { [`${MARKETPLACE_ROOT}/.claude-plugin`]: null, 'node_modules/kit/.claude-plugin/marketplace.json': json(TEAM_MARKET) } }), (dir) => {
    assert.match(String(marketHint(dir)), /There is no committed `\.claude-plugin\/marketplace\.json`/);
  });
});

test('a-6 fails a marketplace name that Claude Code reserves or can\'t use', () => {
  assert.equal(nameProblem('team-tools'), null);
  for (const name of ['claude-plugins-official', 'Claude-Code-Plugins', 'GitHub', 'npm', 'skills-dir', 'healthcare', 'claude.code.plugins', 'anthropic-plugins.']) {
    assert.match(String(nameProblem(name)), /which Claude Code reserves/, name);
  }
  assert.match(nameProblem('claude.code.plugins'), /as another spelling of `claude-code-plugins`/);
  assert.match(nameProblem('claudeai-team'), /names starting with `claudeai-` are reserved for marketplaces hosted on claude\.ai/);
  for (const name of ['team tools', '.team', 'team..tools', 'tëam', 'team/tools']) assert.match(String(nameProblem(name)), /takes only letters, digits/, name);
  assert.equal(nameProblem(''), 'has no `name`');
  withRepo(shareRepo({ market: { ...TEAM_MARKET, name: 'claude-plugins-official' } }), (dir) => {
    const hint = String(marketHint(dir));
    assert.match(hint, /`team-marketplace\/\.claude-plugin\/marketplace\.json` names the marketplace `claude-plugins-official`, which Claude Code reserves\. Pick a name of your own/);
  });
});

test('a-6 fails a marketplace file that isn\'t JSON, or has no owner name or no plugins', () => {
  for (const [market, hint] of [
    ['{ "name": "team-tools", }', /The committed `team-marketplace\/\.claude-plugin\/marketplace\.json` isn't valid JSON/],
    ['[]', /isn't a JSON object with a `name`, an `owner` and a `plugins` list/],
    [{ ...TEAM_MARKET, owner: {} }, /needs an `owner` with a `name`, such as `"owner": \{ "name": "Your team" \}`/],
    [{ ...TEAM_MARKET, owner: 'Your team' }, /needs an `owner` with a `name`/],
    [{ ...TEAM_MARKET, plugins: [] }, /lists no plugins\. Add an entry to `plugins`/],
  ]) {
    withRepo(shareRepo({ market }), (dir) => {
      assert.match(String(marketHint(dir)), hint, JSON.stringify(market));
    });
  }
});

test('a-6 names what is wrong with each kind of entry', () => {
  for (const [entry, hint] of [
    [{ source: './plugins/team-kit' }, /The entry number 1 in `team-marketplace\/\.claude-plugin\/marketplace\.json` needs a `name`/],
    [{ name: 'team-kit', source: { source: 'github', repo: 'acme/team-kit' } }, /The entry `team-kit` in .* fetches its plugin from a `github` source, which each teammate would have to install\. Keep the plugin inside the marketplace folder and list it by a relative path, such as `"source": "\.\/plugins\/team-kit"`/],
    [{ name: 'team-kit' }, /has no `source`/],
    [{ name: 'team-kit', source: 'plugins/team-kit' }, /has the `source` `plugins\/team-kit`\. A relative path must start with `\.\/`: write `"source": "\.\/plugins\/team-kit"`/],
    [{ name: 'team-kit', source: './plugins/../../team-kit' }, /whose `\.\.` leaves the marketplace folder/],
    [{ name: 'team-kit', source: '.\\plugins\\team-kit' }, /writes its `source` with a backslash/],
    [{ name: 'team-kit', source: './plugins/missing' }, /lists `team-marketplace\/plugins\/missing\/`, where no plugin is committed/],
    [{ name: 'kit', source: './plugins/team-kit' }, /The entry `kit` in .* is named `kit`, but `team-marketplace\/plugins\/team-kit\/\.claude-plugin\/plugin\.json` names the plugin `team-kit`\. Use one name in both places/],
  ]) {
    withRepo(shareRepo({ market: marketWith(entry) }), (dir) => {
      assert.match(String(marketHint(dir)), hint, JSON.stringify(entry));
    });
  }
  // The entry that gets furthest speaks for the marketplace.
  withRepo(shareRepo({ market: marketWith({ name: 'other', source: 'other' }, { name: 'kit', source: './plugins/team-kit' }) }), (dir) => {
    assert.match(String(marketHint(dir)), /is named `kit`/);
  });
  // Any entry that passes is enough.
  withRepo(shareRepo({ market: marketWith({ name: 'other', source: './plugins/missing' }, TEAM_MARKET.plugins[0]) }), (dir) => {
    assert.equal(marketHint(dir), true);
  });
});

test('a-6 names what is wrong with the plugin an entry lists', () => {
  const manifest = `${TEAM_KIT}/.claude-plugin/plugin.json`;
  withRepo(shareRepo({ files: { [manifest]: '{}\n' } }), (dir) => {
    assert.match(String(marketHint(dir)), /The committed `team-marketplace\/plugins\/team-kit\/\.claude-plugin\/plugin\.json` has no `name`\. Set `"name": "team-kit"`/);
  });
  withRepo(shareRepo({ files: { [manifest]: '{ name }' } }), (dir) => {
    assert.match(String(marketHint(dir)), /plugin\.json` isn't valid JSON/);
  });
  // The plugin.json is on disk but not committed.
  withRepo(shareRepo({ files: { [manifest]: null }, after: (dir) => write(dir, { [manifest]: json({ name: 'team-kit' }) }) }), (dir) => {
    assert.match(String(marketHint(dir)), /^`team-marketplace\/plugins\/team-kit` isn't committed\. Run `git add team-marketplace\/plugins\/team-kit` and commit it\./);
  });
  withRepo(shareRepo({ files: { [manifest]: null } }), (dir) => {
    assert.match(String(marketHint(dir)), /lists `team-marketplace\/plugins\/team-kit\/`, which has no `\.claude-plugin\/plugin\.json`/);
  });
  withRepo(shareRepo({ move: [], files: { [`${TEAM_KIT}/skills`]: null, [`${TEAM_KIT}/agents`]: null } }), (dir) => {
    assert.match(String(marketHint(dir)), /The plugin in `team-marketplace\/plugins\/team-kit\/` commits no component: no skill in `skills\/<name>\/SKILL\.md`, no subagent in `agents\/` and no `hooks\/hooks\.json`/);
  });
});

test('a-6 fails a registration by a path on one machine, outside the repository or at another folder', () => {
  for (const [source, hint] of [
    [{ source: 'directory', path: '/Users/me/repo/team-marketplace' }, /`extraKnownMarketplaces\.team-tools` has the `path` `\/Users\/me\/repo\/team-marketplace`, a path on your machine, which a teammate's clone doesn't have\. Write it relative to the repository: `"path": "\.\/team-marketplace"`\. Then commit\./],
    [{ source: 'directory', path: '~/repo/team-marketplace' }, /a path on your machine/],
    [{ source: 'directory', path: 'C:\\repo\\team-marketplace' }, /a path on your machine/],
    [{ source: 'directory', path: '../repo/team-marketplace' }, /whose `\.\.` leaves the repository/],
    [{ source: 'directory', path: '.\\team-marketplace' }, /writes its `path` with a backslash/],
    [{ source: 'directory', path: './plugins' }, /has the `path` `\.\/plugins`, but the marketplace is in `team-marketplace\/\.claude-plugin\/marketplace\.json`/],
    [{ source: 'file', path: './team-marketplace' }, /but the marketplace is in .* Write `"path": "\.\/team-marketplace\/\.claude-plugin\/marketplace\.json"`/],
    [{ source: 'directory' }, /has no `path`\. Write `"path": "\.\/team-marketplace"`/],
    [{ source: 'github', repo: 'acme/team-marketplace' }, /registers the marketplace from a `github` source\. Register the committed folder instead: `"source": \{ "source": "directory", "path": "\.\/team-marketplace" \}`/],
    ['./team-marketplace', /has no `source` object/],
  ]) {
    withRepo(shareRepo({ settings: registered(source) }), (dir) => {
      assert.match(String(settingsHint(dir)), hint, JSON.stringify(source));
    });
  }
});

test('a-6 fails a registration under another key, or under the alias beside extraKnownMarketplaces', () => {
  withRepo(shareRepo({ settings: registered({ source: 'directory', path: './team-marketplace' }, 'team') }), (dir) => {
    assert.match(String(settingsHint(dir)), /`extraKnownMarketplaces` registers the marketplace under the key `team`, but the key must be the marketplace's `name` from `team-marketplace\/\.claude-plugin\/marketplace\.json`, `team-tools`/);
  });
  withRepo(shareRepo({ settings: registered({ source: 'directory', path: './elsewhere' }, 'other') }), (dir) => {
    assert.match(String(settingsHint(dir)), /`extraKnownMarketplaces` in the committed `\.claude\/settings\.json` registers no marketplace named `team-tools`\. Add `"extraKnownMarketplaces": \{ "team-tools": \{ "source": \{ "source": "directory", "path": "\.\/team-marketplace" \} \} \}`/);
  });
  withRepo(shareRepo({ settings: settingsWith({ enabledPlugins: { 'team-kit@team-tools': true } }) }), (dir) => {
    assert.match(String(settingsHint(dir)), /The committed `\.claude\/settings\.json` registers no marketplace\. Add `"extraKnownMarketplaces"/);
  });
  withRepo(shareRepo({ settings: { ...SHARED_SETTINGS, extraKnownMarketplaces: {}, additionalMarketplaces: SHARED_SETTINGS.extraKnownMarketplaces } }), (dir) => {
    assert.match(String(settingsHint(dir)), /sets both `extraKnownMarketplaces` and its other spelling, `additionalMarketplaces`, and Claude Code then reads only `extraKnownMarketplaces`/);
  });
});

test('a-6 names what is wrong with enabledPlugins', () => {
  for (const [enabledPlugins, hint] of [
    [{ 'team-kit@team-marketplace': true }, /`enabledPlugins` turns on `team-kit@team-marketplace`, but the part after `@` must be the marketplace's `name`, `team-tools`: write `"team-kit@team-tools": true`/],
    [{ 'team-kit@team-tools': 'true' }, /`enabledPlugins` sets `team-kit@team-tools` to `"true"`\. Use the JSON boolean `true`, without quotes/],
    [{ 'team-kit@team-tools': false }, /turns `team-kit@team-tools` off\. Set it to `true`, so the plugin is on for everyone, and turn it off for yourself only in `\.claude\/settings\.local\.json`/],
    [{ 'claude-code-setup@claude-plugins-official': true }, /registers `team-tools` but turns none of its plugins on\. Add `"enabledPlugins": \{ "team-kit@team-tools": true \}`/],
    [undefined, /turns none of its plugins on/],
  ]) {
    withRepo(shareRepo({ settings: { ...SHARED_SETTINGS, enabledPlugins } }), (dir) => {
      assert.match(String(settingsHint(dir)), hint, JSON.stringify(enabledPlugins));
    });
  }
});

test('a-6 says to create the settings, fix their JSON, or commit them, with -f when an ignore rule hides them', () => {
  withRepo(shareRepo({ settings: null }), (dir) => {
    assert.match(String(settingsHint(dir)), /There is no committed `\.claude\/settings\.json`\. Create it with `team-tools` under `extraKnownMarketplaces`, at the path `\.\/team-marketplace`, and `"enabledPlugins": \{ "team-kit@team-tools": true \}`/);
  });
  withRepo(shareRepo({ settings: '{ "enabledPlugins": }' }), (dir) => {
    assert.match(String(settingsHint(dir)), /The committed `\.claude\/settings\.json` isn't valid JSON/);
  });
  // A global excludes file that ignores .claude/ hid the file from `git add`.
  withRepo(shareRepo({
    after: (dir) => {
      git(dir, 'rm', '-q', '--cached', '.claude/settings.json');
      commit(dir, 'Drop the settings', []);
      write(dir, { '.git/global-ignore': '.claude/\n' });
      git(dir, 'config', 'core.excludesFile', join(dir, '.git', 'global-ignore'));
    },
  }), (dir) => {
    assert.match(String(settingsHint(dir)), /^`\.claude\/settings\.json` isn't committed, and line 1 of `.*global-ignore`, `\.claude\/`, ignores it\. Run `git add -f \.claude\/settings\.json` and commit it\.$/);
  });
  // The fix is in the working copy only.
  withRepo(shareRepo({
    settings: { ...SHARED_SETTINGS, enabledPlugins: {} },
    after: (dir) => write(dir, { '.claude/settings.json': json(SHARED_SETTINGS) }),
  }), (dir) => {
    assert.equal(settingsHint(dir), 'Your copy of `.claude/settings.json` registers the marketplace and turns the plugin on, but that change isn\'t committed. Run `git add .claude/settings.json` and commit it.');
  });
});

test('a-6 reads a marketplace.json and plugin.json that start with a byte-order mark, as claude plugin validate does, and names the mark in other JSON files', () => {
  const BOM = '\uFEFF';
  const plugin = `${TEAM_KIT}/.claude-plugin/plugin.json`;
  withRepo(shareRepo({ market: `${BOM}${json(TEAM_MARKET)}`, files: { [plugin]: `${BOM}${json({ name: 'team-kit', version: '0.1.0', description: 'A team\'s shared setup', author: { name: 'Your team' } })}` } }), (dir) => {
    const { code, out } = a6(dir);
    assert.equal(code, 0, out);
  });
  withRepo(shareRepo({ settings: `${BOM}${json(SHARED_SETTINGS)}` }), (dir) => {
    assert.equal(settingsHint(dir), 'The committed `.claude/settings.json` isn\'t valid JSON: it starts with a UTF-8 byte-order mark. Save it as UTF-8 without one, and commit.');
  });
  const hook = `${TEAM_KIT}/hooks/hooks.json`;
  withRepo(shareRepo({ move: [], files: { [hook]: `${BOM}${json({ hooks: { PreToolUse: [{ matcher: 'Edit', hooks: [{ type: 'command', command: 'true' }] }] } })}` } }), (dir) => {
    assert.equal(movedHint(dir), `The committed \`${hook}\` isn't valid JSON: it starts with a UTF-8 byte-order mark. Save it as UTF-8 without one, and commit.`);
  });
});

test('a-6 fails until a component of your own is in the plugin and gone from .claude/', () => {
  withRepo(shareRepo({ move: [] }), (dir) => {
    assert.match(String(movedHint(dir)), /The plugin holds only the example's `onboard` skill and `config-reviewer` subagent\. Move a skill, a subagent or a hook of your own into `team-marketplace\/plugins\/team-kit\/`/);
  });
  // Copied, not moved.
  withRepo(shareRepo({ move: [], files: { [`${TEAM_KIT}/agents/test-gaps.md`]: TEST_GAPS } }), (dir) => {
    assert.equal(movedHint(dir), '`team-marketplace/plugins/team-kit/agents/test-gaps.md` is in the plugin, but `.claude/agents/test-gaps.md` is still committed, so the subagent loads twice, as `test-gaps` and `team-kit:test-gaps`. Run `git rm .claude/agents/test-gaps.md` and commit.');
  });
  // The same subagent name in a file of another name.
  withRepo(shareRepo({ move: [], files: { [`${TEAM_KIT}/agents/review/gaps.md`]: TEST_GAPS } }), (dir) => {
    assert.match(String(movedHint(dir)), /but `\.claude\/agents\/test-gaps\.md` is still committed/);
  });
  // A skill moved instead of the subagent.
  withRepo(shareRepo({ move: [['.claude/skills/tdd', 'skills/tdd']] }), (dir) => {
    assert.equal(movedHint(dir), true);
  });
  // A copied skill, by its folder or by its frontmatter name on either side.
  for (const [files, twin] of [
    [{ [`${TEAM_KIT}/skills/tdd/SKILL.md`]: TDD_SKILL }, '.claude/skills/tdd'],
    [{ [`${TEAM_KIT}/skills/testing/SKILL.md`]: TDD_SKILL }, '.claude/skills/tdd'],
    [{ [`${TEAM_KIT}/skills/review/SKILL.md`]: '---\ndescription: Reviews a change.\n---\n\nReview it.\n', '.claude/skills/checklist/SKILL.md': '---\nname: review\ndescription: Reviews a change.\n---\n' }, '.claude/skills/checklist'],
  ]) {
    withRepo(shareRepo({ move: [], files }), (dir) => {
      const hint = String(movedHint(dir));
      assert.match(hint, /so the skill loads twice, as `\/(tdd|review)` and `\/team-kit:(tdd|review)`/, hint);
      assert.ok(hint.endsWith(`Run \`git rm -r ${twin}\` and commit.`), hint);
    });
  }
  // On disk in the plugin, but not committed.
  withRepo(shareRepo({ move: [], after: (dir) => write(dir, { [`${TEAM_KIT}/skills/release/SKILL.md`]: '---\ndescription: Cuts a release.\n---\n' }) }), (dir) => {
    assert.equal(movedHint(dir), '`team-marketplace/plugins/team-kit/skills/release/SKILL.md` isn\'t committed. Run `git add team-marketplace/plugins/team-kit/skills/release/SKILL.md` and commit it.');
  });
  withRepo(shareRepo({ market: { ...TEAM_MARKET, plugins: [] } }), (dir) => {
    assert.match(String(movedHint(dir)), /No committed marketplace lists a committed plugin yet/);
  });
});

test('a-6 doesn\'t count the practice copy\'s /tutor skill as a component you moved', () => {
  const tutor = { [`${TEAM_KIT}/skills/tutor/SKILL.md`]: '---\nname: tutor\ndescription: Coaches you through one lesson.\ndisable-model-invocation: true\n---\n\nTutor.\n' };
  withRepo(shareRepo({ move: [], files: tutor }), (dir) => {
    assert.equal(movedHint(dir), 'The plugin\'s `/tutor` skill came with the practice copy, so it isn\'t one of your own. Move it back to `.claude/skills/tutor/` with `git mv`, then move one of your own into the plugin, and commit.');
  });
  // Moved together with one of your own, it doesn't stop the item passing.
  withRepo(shareRepo({ files: tutor }), (dir) => {
    assert.equal(movedHint(dir), true);
  });
});

test('a-6 tells a copied or uncommitted /tutor skill apart from a component you moved', () => {
  const text = '---\nname: tutor\ndescription: Coaches you through one lesson.\ndisable-model-invocation: true\n---\n\nTutor.\n';
  // Copied: .claude/skills/tutor/ is still committed, so the hint removes the copy instead of moving it back.
  withRepo(shareRepo({ move: [], files: { '.claude/skills/tutor/SKILL.md': text, [`${TEAM_KIT}/skills/tutor/SKILL.md`]: text } }), (dir) => {
    assert.equal(movedHint(dir), 'The plugin\'s `/tutor` skill came with the practice copy, so it isn\'t one of your own. Remove the copy with `git rm -r team-marketplace/plugins/team-kit/skills/tutor`, then move one of your own into the plugin, and commit.');
  });
  // Uncommitted in the plugin, it is neither a component of your own nor a file to commit.
  withRepo(shareRepo({ move: [], after: (dir, plugin) => write(dir, { [`${plugin}/skills/tutor/SKILL.md`]: text }) }), (dir) => {
    assert.match(movedHint(dir), /^The plugin holds only the example's/);
  });
});

test('a-6 accepts a hook moved into hooks/hooks.json, and fails one still in the settings, still in .claude/ or whose script isn\'t committed', () => {
  const hooksWith = (command, args) => json({ hooks: { PreToolUse: [{ matcher: 'Edit|Write', hooks: [{ type: 'command', command, ...(args ? { args } : {}) }] }] } });
  const moved = { move: [[PROTECT_HOOK, 'scripts/protect-files.sh']], settings: { ...SHARED_SETTINGS, hooks: undefined } };
  for (const [command, args] of [['"${CLAUDE_PLUGIN_ROOT}/scripts/protect-files.sh"'], ['${CLAUDE_PLUGIN_ROOT}/scripts/protect-files.sh', []], ['bash', ['${CLAUDE_PLUGIN_ROOT}/scripts/protect-files.sh']]]) {
    withRepo(shareRepo({ ...moved, move: [...moved.move], files: { [`${TEAM_KIT}/hooks/hooks.json`]: hooksWith(command, args) } }), (dir) => {
      const { code, out } = a6(dir);
      assert.equal(code, 0, `${command}: ${out}`);
    });
  }
  const hook = `${TEAM_KIT}/hooks/hooks.json`;
  // Left in the settings too.
  withRepo(shareRepo({ ...moved, settings: SHARED_SETTINGS, files: { [hook]: hooksWith('"${CLAUDE_PLUGIN_ROOT}/scripts/protect-files.sh"') } }), (dir) => {
    assert.match(String(movedHint(dir)), /`\.claude\/settings\.json` still runs the same hook, `protect-files\.sh`, so it would run twice each time its event fires\. Remove that hook from `\.claude\/settings\.json` and commit\./);
  });
  withRepo(shareRepo({ move: [], settings: { ...SHARED_SETTINGS, hooks: undefined }, files: { [hook]: hooksWith('${CLAUDE_PROJECT_DIR}/.claude/hooks/protect-files.sh', []) } }), (dir) => {
    assert.match(String(movedHint(dir)), /The plugin's hook still runs `\$\{CLAUDE_PROJECT_DIR\}\/\.claude\/hooks\/protect-files\.sh`, a script in `\.claude\/`\. Move the script into the plugin/);
  });
  withRepo(shareRepo({ move: [], settings: { ...SHARED_SETTINGS, hooks: undefined }, files: { [hook]: hooksWith('"${CLAUDE_PLUGIN_ROOT}/scripts/check.sh"') } }), (dir) => {
    assert.equal(movedHint(dir), 'The hook in `team-marketplace/plugins/team-kit/hooks/hooks.json` runs `team-marketplace/plugins/team-kit/scripts/check.sh`, which isn\'t in the plugin. Put the script there, or fix the path after `${CLAUDE_PLUGIN_ROOT}/`, and commit.');
  });
  withRepo(shareRepo({
    move: [], settings: { ...SHARED_SETTINGS, hooks: undefined }, files: { [hook]: hooksWith('"${CLAUDE_PLUGIN_ROOT}/scripts/check.sh"') },
    after: (dir) => write(dir, { [`${TEAM_KIT}/scripts/check.sh`]: '#!/bin/bash\nexit 0\n' }),
  }), (dir) => {
    assert.equal(movedHint(dir), 'The hook in `team-marketplace/plugins/team-kit/hooks/hooks.json` runs `team-marketplace/plugins/team-kit/scripts/check.sh`, but it isn\'t committed. Run `git add team-marketplace/plugins/team-kit/scripts/check.sh` and commit it.');
  });
  for (const text of ['{ "hooks": ', json({ PreToolUse: [] })]) {
    withRepo(shareRepo({ move: [], files: { [hook]: text } }), (dir) => {
      assert.match(String(movedHint(dir)), /isn't valid JSON|holds no hook\. Put the entry under a top-level `hooks` key/, text);
    });
  }
});

test('a-6 fails while git tracks a personal file, or only an uncommitted or uncommon rule ignores it', () => {
  withRepo(shareRepo({ gitignore: '.practice/\nCLAUDE.local.md\n', files: { '.claude/settings.local.json': '{}\n' } }), (dir) => {
    assert.equal(personalHint(dir), 'git tracks `.claude/settings.local.json`, which is yours alone. Run `git rm --cached .claude/settings.local.json`, add the line `.claude/settings.local.json` to `.gitignore`, and commit.');
  });
  withRepo(shareRepo({ gitignore: '.practice/\n', files: { 'CLAUDE.local.md': '# mine\n' }, after: (dir) => git(dir, 'rm', '-q', '--cached', 'CLAUDE.local.md') }), (dir) => {
    const hint = String(personalHint(dir));
    assert.match(hint, /^`CLAUDE\.local\.md` is still in your last commit\. Commit its removal\. No committed `\.gitignore` ignores `\.claude\/settings\.local\.json`\./);
  });
  withRepo(shareRepo({ gitignore: '.practice/\n' }), (dir) => {
    assert.equal(personalHint(dir), 'No committed `.gitignore` ignores `.claude/settings.local.json` and `CLAUDE.local.md`. Add the lines `.claude/settings.local.json` and `CLAUDE.local.md` to `.gitignore` and commit it. A rule in your global git excludes file doesn\'t count: it isn\'t in the repository.');
  });
  withRepo(shareRepo({ gitignore: '.practice/\nCLAUDE.local.md\n', after: (dir) => write(dir, { '.git/info/exclude': '.practice/\n.claude/settings.local.json\n' }) }), (dir) => {
    assert.match(String(personalHint(dir)), /^Only `\.git\/info\/exclude` ignores `\.claude\/settings\.local\.json`/);
  });
  // Where Claude Code adds its rule: the global excludes file.
  withRepo(shareRepo({
    gitignore: '.practice/\nCLAUDE.local.md\n',
    after: (dir) => {
      write(dir, { '.git/global-ignore': '**/.claude/settings.local.json\n' });
      git(dir, 'config', 'core.excludesFile', join(dir, '.git', 'global-ignore'));
    },
  }), (dir) => {
    assert.match(String(personalHint(dir)), /^No committed `\.gitignore` ignores `\.claude\/settings\.local\.json`\..*global git excludes file doesn't count/);
  });
  withRepo(shareRepo({ gitignore: '.practice/\n', after: (dir) => write(dir, { '.gitignore': PERSONAL_IGNORE }) }), (dir) => {
    const hint = String(personalHint(dir));
    assert.match(hint, /`\.gitignore` ignores `\.claude\/settings\.local\.json`, but that rule isn't committed\. Run `git add \.gitignore` and commit it\./);
    assert.match(hint, /`\.gitignore` ignores `CLAUDE\.local\.md`, but that rule isn't committed/);
  });
  for (const gitignore of ['.practice/\n*.local.json\n*.local.md\n', '.practice/\n**/.claude/settings.local.json\n/CLAUDE.local.md\n']) {
    withRepo(shareRepo({ gitignore }), (dir) => {
      assert.equal(personalHint(dir), true, gitignore);
    });
  }
});

test('a-6 reads the saved validation, and says what is wrong with it', () => {
  const save = '`claude plugin validate ./team-marketplace/plugins/team-kit --strict --json > .practice/a-6-validate.json`';
  const utf16 = (text) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text.replace(/\n/g, '\r\n'), 'utf16le')]);
  const elsewhere = '/nonexistent-a6-checkout/claude-code-practice';
  for (const report of [
    (dir, plugin) => reportOf(join(realpathSync(dir), plugin)),
    // The folder as the Learner's shell named it, through a symlink such as macOS's /tmp.
    (dir, plugin) => reportOf(join(dir, plugin, '.claude-plugin', 'plugin.json')),
    reportOf(`${elsewhere}/${TEAM_KIT}/.claude-plugin/plugin.json`),
    reportOf(`C:\\Users\\me\\repo\\${TEAM_KIT.replace(/\//g, '\\')}`),
    (dir, plugin) => utf16(json(VALID_REPORT(dir, plugin))),
  ]) {
    withRepo(shareRepo({ report }), (dir) => {
      assert.equal(validateHint(dir), true, String(report));
    });
  }
  const other = mkdtempSync(join(tmpdir(), 'other-'));
  try {
    for (const [report, hint] of [
      [null, `There is no \`.practice/a-6-validate.json\` yet. From the repository's root, once the plugin is in place, run ${save}.`],
      ['✔ Validation passed\n', /holds the text report\. Save the JSON one, with `--json`/],
      ['oops', /isn't JSON\. Save the report unchanged/],
      [[], /it has no `success`/],
      [reportOf('x', { success: false, manifest: { errors: [{ path: 'name', message: 'Plugin name cannot contain spaces' }], warnings: ['No version'] } }), /records a validation that failed\. It reports: `Plugin name cannot contain spaces`; `No version`\. Fix what it reports, then save the report again/],
      [reportOf('x', { success: false, manifest: null }), /records a validation that failed\. Fix what it reports/],
      [(dir, plugin) => reportOf(join(realpathSync(dir), plugin), { strict: false }), /records a validation without `--strict`, which lets warnings through/],
      [reportOf(''), /has no `target`/],
      [(dir) => reportOf(join(realpathSync(dir), MARKETPLACE_ROOT, '.claude-plugin', 'marketplace.json')), /records a validation of the marketplace, which doesn't open the plugin's skill and agent files\. Validate the plugin directory/],
      [reportOf(other), /records a validation of `.*other-.*`, outside this repository, not of a plugin directory in it\. Validate the plugin folder again/],
      [(dir) => reportOf(realpathSync(dir)), /the repository itself, not of a plugin directory in it/],
      [(dir) => reportOf(join(realpathSync(dir), MARKETPLACE_ROOT)), /records a validation of `team-marketplace`, which isn't a committed plugin directory \(`\.\/team-marketplace\/plugins\/team-kit`\)/],
      [reportOf(`${elsewhere}/plugins/other/.claude-plugin/plugin.json`), /which isn't on this machine and doesn't end in a committed plugin directory\. Validate the plugin folder again/],
    ]) {
      withRepo(shareRepo({ report }), (dir) => {
        const result = validateHint(dir);
        if (typeof hint === 'string') assert.equal(result, hint);
        else assert.match(String(result), hint, JSON.stringify(report));
      });
    }
  } finally {
    rmSync(other, { recursive: true, force: true });
  }
});

test('a-6 fails on an unsolved repository and passes on a solved one, as the template\'s assertions expect', () => {
  withRepo(() => {
    const dir = repo({ '.gitignore': '.practice/\nnode_modules/\n', 'README.md': '# demo\n' });
    commit(dir, 'Start');
    return dir;
  }, (dir) => {
    const { code, out } = check(['a-6', '--assert', 'fail', '--dir', dir]);
    assert.equal(code, 0, out);
  });
  // The solutions branch: a new skill in team-kit that .claude/skills/ never
  // had, and a validation saved with its paths scrubbed.
  withRepo(shareRepo({
    move: [],
    files: { [`${TEAM_KIT}/skills/release-notes/SKILL.md`]: '---\ndescription: Drafts release notes from the commits since the last tag.\n---\n' },
    report: reportOf(`/tmp/claude-code-practice/${TEAM_KIT}/.claude-plugin/plugin.json`),
  }), (dir) => {
    const { code, out } = check(['a-6', '--assert', 'pass', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

// A repository after lesson a-7: the bounded runner and its bounds file
// committed, the Intermediate settings in .claude/settings.json, and the
// real slice run saved. The options
// replace a step: `script` (null for none) is saved with `mode` and committed
// unless `commitScript` is false; `bounds` (null for none) is the bounds
// file, as an object or text, committed unless `commitBounds` is false;
// `settings` is the committed .claude/settings.json (null for none);
// `gitignore` is committed first; `slice` (null for none) is the saved
// run, as an object, text or a Buffer; `after` changes the
// repository last. The items run the script with a stand-in for `claude`,
// never Claude Code itself.
const BOUNDS_PATH = '.claude/bounded-run.json';
const BOUNDED_CALL = [
  'claude -p "$1" \\',
  '  --setting-sources project \\',
  '  --strict-mcp-config \\',
  `  --settings ${BOUNDS_PATH} \\`,
  '  --permission-mode dontAsk \\',
  '  --model sonnet \\',
  '  --max-turns 15 \\',
  '  --max-budget-usd 2 \\',
  '  --output-format json > "$2"',
].join('\n');
const BOUNDED = [
  '#!/bin/bash',
  `# Runs one unattended task inside the bounds in ${BOUNDS_PATH}.`,
  'set -u',
  'if [ $# -ne 2 ]; then',
  '  echo \'Usage: scripts/bounded-run.sh "<task>" <result.json>\' >&2',
  '  exit 2',
  'fi',
  'before=$(git rev-parse --short HEAD)',
  BOUNDED_CALL,
  'status=$?',
  'jq \'{subtype, num_turns, total_cost_usd, denied: [.permission_denials[]? | .tool_input.command // .tool_name]}\' "$2"',
  'echo "HEAD before: $before, after: $(git rev-parse --short HEAD)"',
  'git status --short',
  'exit "$status"',
  '',
].join('\n');
const BOUNDS = {
  permissions: {
    allow: ['Edit(./src/**)', 'Edit(./test/**)', 'Bash(npm test *)'],
    deny: ['Agent', 'Read(./.env)', 'Read(./.env.*)', 'Bash(git commit *)', 'Bash(git push *)'],
  },
  sandbox: { enabled: true, failIfUnavailable: true, allowUnsandboxedCommands: false, autoAllowBashIfSandboxed: false },
};
const PROJECT_SETTINGS = { permissions: { allow: ['Bash(npm test)'], deny: ['Read(./.env)', 'Read(./.env.*)'] }, sandbox: { enabled: true } };
const SESSION = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const SLICE_RUN = {
  type: 'result', subtype: 'success', is_error: false, num_turns: 9, total_cost_usd: 0.42,
  result: 'Added test/total.test.js for total(); npm test passes. The commit was denied.',
  session_id: SESSION, permission_denials: [{ tool_name: 'Bash', tool_use_id: 'toolu_00000000000000000000000000', tool_input: { command: 'git commit -m "Add a test for total"' } }],
};

// The runner with each `[from, to]` replaced.
function runner(...pairs) {
  return pairs.reduce((text, [from, to]) => {
    assert.ok(text.includes(from), `the runner has no ${JSON.stringify(from)}`);
    return text.replace(from, () => to);
  }, BOUNDED);
}
const runnerCall = (call) => runner([BOUNDED_CALL, call]);
const boundsWith = (change) => {
  const bounds = structuredClone(BOUNDS);
  change(bounds);
  return bounds;
};

function boundedRepo({ script = BOUNDED, mode = 0o755, commitScript = true, bounds = BOUNDS, commitBounds = true, settings = PROJECT_SETTINGS, gitignore = '.practice/\n', slice = SLICE_RUN, after } = {}) {
  return () => {
    const dir = repo({ '.gitignore': gitignore, 'README.md': '# demo\n', 'src/total.js': TOTAL });
    if (settings !== null) write(dir, { '.claude/settings.json': typeof settings === 'string' ? settings : json(settings) });
    commit(dir, 'Start');
    if (bounds !== null) {
      write(dir, { [BOUNDS_PATH]: typeof bounds === 'string' ? bounds : json(bounds) });
      if (commitBounds) commit(dir, 'Add the bounds', [BOUNDS_PATH]);
    }
    if (script !== null) {
      write(dir, { [RUNNER]: script });
      setMode(dir, RUNNER, mode);
      if (commitScript) commit(dir, 'Add the bounded runner', [RUNNER]);
    }
    if (slice !== null) write(dir, { [SLICE]: typeof slice === 'string' || Buffer.isBuffer(slice) ? slice : JSON.stringify(slice, null, 2) });
    after?.(dir);
    return dir;
  };
}

const a7 = (dir) => check(['a-7', '--dir', dir]);
// One item on its own, which runs only what that item needs.
const runnerHint = (dir) => boundedScript().check(openRepo(dir));
const limitHint = (dir) => runLimits().check(openRepo(dir));
const ruleHint = (dir) => narrowRules().check(openRepo(dir));
const sandboxHint = (dir) => strictSandbox().check(openRepo(dir));
const sliceHint = (dir) => sliceRun().check(openRepo(dir));
// The first four items, which read the committed runner and bounds, from
// one run of it.
const committedHints = (dir) => {
  const opened = openRepo(dir);
  return [boundedScript(), runLimits(), narrowRules(), strictSandbox()].map((item) => item.check(opened));
};

test('a-7 passes for the lesson\'s runner and bounds, committed, and a slice run saved', () => {
  withRepo(boundedRepo(), (dir) => {
    const { code, out } = a7(dir);
    assert.equal(code, 0, out);
    assert.match(out, /5 of 5 passed/);
  });
});

test('a-7 says to write the runner, commit it or make it executable', () => {
  withRepo(boundedRepo({ script: null }), (dir) => {
    const { code, out } = a7(dir);
    assert.equal(code, 1, out);
    assert.match(out, /There is no `scripts\/bounded-run\.sh`\. Write it as the lesson shows, then commit it\./);
    assert.match(out, /Commit `scripts\/bounded-run\.sh` first: the check runs the committed script\./);
  });
  withRepo(boundedRepo({ commitScript: false }), (dir) => {
    assert.equal(runnerHint(dir), '`scripts/bounded-run.sh` isn\'t committed. Run `git add scripts/bounded-run.sh` and commit it.');
  });
  withRepo(boundedRepo({ mode: 0o644 }), (dir) => {
    const { code, out } = a7(dir);
    assert.equal(code, 1, out);
    assert.match(out, /isn't executable\. Run `chmod \+x scripts\/bounded-run\.sh`, then `git add scripts\/bounded-run\.sh` and commit\. On Windows, run `git update-index --chmod=\+x scripts\/bounded-run\.sh`/);
    assert.match(out, /4 of 5 passed/);
  });
});

test('a-7 runs the committed runner, not the working copy, and points out uncommitted changes', () => {
  withRepo(boundedRepo({ script: runner(['--permission-mode dontAsk', '--permission-mode auto']), after: (dir) => write(dir, { [RUNNER]: BOUNDED }) }), (dir) => {
    assert.match(String(runnerHint(dir)), /It runs in `auto` mode: use `--permission-mode dontAsk`, so every call that would ask for permission is denied\. Your copy of `scripts\/bounded-run\.sh` has changes that aren't committed: if they fix this, commit them\./);
  });
  withRepo(boundedRepo({ after: (dir) => write(dir, { [RUNNER]: runner(['--permission-mode dontAsk', '--permission-mode auto']) }) }), (dir) => {
    assert.equal(runnerHint(dir), true);
  });
});

test('a-7 accepts the call written in other ways', () => {
  const inline = `'${JSON.stringify(BOUNDS)}'`;
  for (const script of [
    // --flag=value, and the flags in another order.
    runnerCall(`claude --output-format=json --max-turns=15 --max-budget-usd=2.50 --permission-mode=dontAsk --strict-mcp-config --settings=${BOUNDS_PATH} -p "$1" > "$2"`),
    // Values in variables, quoted and not.
    runner(['set -u\n', 'set -u\nturns=15\nbudget=0.5\nbounds=.claude/bounded-run.json\n'], ['--max-turns 15', '--max-turns "$turns"'], ['--max-budget-usd 2', '--max-budget-usd $budget'], [`--settings ${BOUNDS_PATH}`, '--settings "$bounds"']),
    // The flags in an array.
    runnerCall(`limits=(--max-turns 15 --max-budget-usd .5)\nclaude -p "$1" --strict-mcp-config --settings ${BOUNDS_PATH} --permission-mode dontAsk "\${limits[@]}" --output-format json > "$2"`),
    // From the repository's root, with the settings file's full path.
    runnerCall(`root=$(git rev-parse --show-toplevel)\ncd "$root" || exit 1\nclaude -p "$1" --strict-mcp-config --settings "$root/${BOUNDS_PATH}" --permission-mode dontAsk --max-turns 15 --max-budget-usd 2 --output-format json > "$2"`),
    // From another folder, with a relative path from there.
    runnerCall(`out=$(cd "$(dirname "$2")" && pwd)/$(basename "$2")\ncd scripts || exit 1\nclaude -p "$1" --strict-mcp-config --settings ../${BOUNDS_PATH} --permission-mode dontAsk --max-turns 15 --max-budget-usd 2 --output-format json > "$out"`),
    // The task on stdin, or inside a longer prompt.
    runnerCall(`printf '%s\\n' "$1" | claude -p --strict-mcp-config --settings ${BOUNDS_PATH} --permission-mode dontAsk --max-turns 15 --max-budget-usd 2 --output-format json > "$2"`),
    runnerCall(`claude -p "Do this task, and only this: $1 Then stop." --strict-mcp-config --settings ${BOUNDS_PATH} --permission-mode dontAsk --max-turns 15 --max-budget-usd 2 --output-format json > "$2"`),
    // A runner that checks its bounds file before the run.
    runner(['set -u\n', `set -u\njq empty ${BOUNDS_PATH} || { echo "No valid ${BOUNDS_PATH}." >&2; exit 1; }\n`]),
    // The bounds inline, and the rules as flags.
    runnerCall(`claude -p "$1" --strict-mcp-config --settings ${inline} --permission-mode dontAsk --max-turns 15 --max-budget-usd 2 --output-format json > "$2"`),
    runnerCall(`claude -p "$1" --strict-mcp-config --settings '${JSON.stringify({ sandbox: BOUNDS.sandbox })}' --allowedTools "Edit(./src/**)" "Bash(npm test)" --disallowedTools "Bash(git commit:*),Bash(git push:*)" --permission-mode dontAsk --max-turns 15 --max-budget-usd 2 --output-format json > "$2"`),
  ]) {
    withRepo(boundedRepo({ script }), (dir) => {
      assert.deepEqual(committedHints(dir), [true, true, true, true], script);
    });
  }
});

test('a-7 names what the first item finds wrong with the call', () => {
  for (const [from, to, hint] of [
    ['--permission-mode dontAsk', '--permission-mode bypassPermissions', /It runs in `bypassPermissions` mode: use `--permission-mode dontAsk`/],
    ['--permission-mode dontAsk', '--permission-mode dontask', /Write `dontAsk` as Claude Code spells it, not `dontask`\./],
    ['--permission-mode dontAsk', '--permission-mode', /`--permission-mode` has no mode after it, so it takes `--model` as its value: write `--permission-mode dontAsk`\./],
    ['--output-format json', '--output-format', /`--output-format` has no format after it: write `--output-format json`\./],
    ['  --permission-mode dontAsk \\\n', '', /It sets no permission mode: add `--permission-mode dontAsk`/],
    ['--permission-mode dontAsk', '--dangerously-skip-permissions', /Drop `--dangerously-skip-permissions`: it is the same as `--permission-mode bypassPermissions`, which skips your permission checks\. It sets no permission mode/],
    ['--permission-mode dontAsk', '--permission-mode dontAsk --allow-dangerously-skip-permissions', /Drop `--allow-dangerously-skip-permissions`: a bounded run never switches to `bypassPermissions`\./],
    ['--permission-mode dontAsk', '--permissionMode dontAsk', /Claude Code doesn't know `--permissionMode`, so it stops with an error before the run starts: write `--permission-mode`\./],
    ['--output-format json', '--output-format text', /It asks for `--output-format text`: use `json`, so the result path holds the run's result as one JSON object\./],
    ['--output-format json', '--output-format stream-json --verbose', /It asks for `--output-format stream-json`: use `json`/],
    ['  --output-format json > "$2"', '  > "$2"', /It doesn't ask for JSON: add `--output-format json`\./],
    ['  --strict-mcp-config \\\n', '', /^It doesn't keep the project's MCP servers out: add `--strict-mcp-config`, so the run starts no server you didn't pass with `--mcp-config`\.$/],
    ['--strict-mcp-config', '--strict-mcp', /It doesn't keep the project's MCP servers out: add `--strict-mcp-config`/],
    ['--strict-mcp-config', '--strict_mcp_config', /It doesn't keep the project's MCP servers out: add `--strict-mcp-config`, so the run starts no server you didn't pass with `--mcp-config`\. Claude Code doesn't know `--strict_mcp_config`, so it stops with an error before the run starts: write `--strict-mcp-config`\./],
  ]) {
    withRepo(boundedRepo({ script: runner([from, to]) }), (dir) => {
      assert.match(String(runnerHint(dir)), hint, to);
    });
  }
});

test('a-7 checks that the task reaches claude -p as its prompt, and the JSON lands where the second argument says', () => {
  for (const [script, hint] of [
    [runner(['claude -p "$1"', 'claude -p $1']), /It passes the task without quotes, so the shell splits it into words and Claude gets only the first\. Write `"\$1"`, in double quotes\./],
    [runner(['claude -p "$1"', 'claude -p "Add the missing tests."']), /The task in its first argument never reaches `claude -p`\. Pass it as the prompt, right after `-p`/],
    [runner(['claude -p "$1"', 'claude -p --allowedTools "Edit(./src/**)" "$1"']), /The task ends up in the value of `--allowed-tools`, not in the prompt\. Write the prompt right after `-p`/],
    [runner(['--output-format json > "$2"', '--output-format json > .practice/a-7-slice.json']), /It saved the JSON `claude -p` printed to `\.practice\/a-7-slice\.json`, not to the path in its second argument\. Redirect only its standard output to the path in the second argument: `claude -p "\$1" \.\.\. > "\$2"`\./],
    [runner(['--output-format json > "$2"', '--output-format json > /dev/null']), /It didn't save the JSON `claude -p` printed to the path in its second argument\./],
    [runner(['--output-format json > "$2"', '--output-format json | jq .result > "$2"']), /The file at the path in its second argument isn't the JSON `claude -p` printed\./],
  ]) {
    withRepo(boundedRepo({ script }), (dir) => {
      assert.match(String(runnerHint(dir)), hint);
    });
  }
});

test('a-7 wants one claude -p call, and says how a runner that never makes one ended', () => {
  withRepo(boundedRepo({ script: runner(['status=$?\n', `status=$?\n${BOUNDED_CALL.replace('> "$2"', '> /dev/null')}\n`]) }), (dir) => {
    assert.match(String(runnerHint(dir)), /With one task, it ran `claude -p` 2 times\. Run it once\./);
  });
  withRepo(boundedRepo({ script: runner(['claude -p "$1"', 'claude "$1"']) }), (dir) => {
    assert.match(String(runnerHint(dir)), /Run as `scripts\/bounded-run\.sh "<task>" <result\.json>`, `scripts\/bounded-run\.sh` ran `claude` without `-p` \(or `--print`\), which starts an interactive session and waits for you\./);
  });
  withRepo(boundedRepo({ script: runner(['set -u\n', 'set -u\nclaude --version > /dev/null || exit 1\n']) }), (dir) => {
    assert.equal(runnerHint(dir), true);
  });
  // A runner with another interface: the stand-in sees no call, so the
  // other items read the call from the script's text.
  withRepo(boundedRepo({ script: runner(['if [ $# -ne 2 ]', 'if [ $# -ne 3 ]']) }), (dir) => {
    assert.match(String(runnerHint(dir)), /Run as `scripts\/bounded-run\.sh "<task>" <result\.json>`, `scripts\/bounded-run\.sh` never ran `claude -p`\. It exited with 2: Usage: scripts\/bounded-run\.sh "<task>" <result\.json>$/);
    assert.deepEqual(committedHints(dir).slice(1), [true, true, true]);
  });
  withRepo(boundedRepo({ script: runner(['if [ $# -ne 2 ]', 'if [ $# -ne 3 ]'], ['--max-turns 15', '--max-turns "$TURNS"'], ['--max-budget-usd 2', '--max-budget-usd 0']) }), (dir) => {
    assert.match(String(limitHint(dir)), /`--max-turns \$TURNS` gets its value from a variable the check can't work out: write the number in the script\. `--max-budget-usd 0` isn't above 0/);
  });
  withRepo(boundedRepo({ script: '#!/bin/bash\necho "Not written yet." >&2\nexit 1\n' }), (dir) => {
    const hints = committedHints(dir);
    assert.match(String(hints[0]), /never ran `claude -p`\. It exited with 1: Not written yet\./);
    for (const hint of hints.slice(1)) assert.match(String(hint), /`scripts\/bounded-run\.sh` never ran `claude -p`, and the check found no `claude -p` call in its text\. It exited with 1: Not written yet\./);
  });
});

test('a-7 refuses to run a runner that could reach the real Claude Code, and reads its call from the text', () => {
  const outside = mkdtempSync(join(tmpdir(), 'a7-ran-'));
  const ran = join(outside, 'ran');
  try {
    for (const [script, why] of [
      [runner(['claude -p "$1"', '~/.local/bin/claude -p "$1"']), /calls Claude Code by its path, `~\/\.local\/bin\/claude`/],
      [runner(['claude -p "$1"', 'npx @anthropic-ai/claude-code -p "$1"']), /runs Claude Code through `npx`/],
      [runner(['set -u\n', 'set -u\nPATH="$HOME/.local/bin:$PATH"\n']), /changes `PATH`/],
    ]) {
      withRepo(boundedRepo({ script: script.replace('set -u\n', () => `set -u\ntouch "${ran}"\n`) }), (dir) => {
        const [first, ...rest] = committedHints(dir);
        assert.match(String(first), why);
        assert.match(String(first), /which the stand-in can't replace, so the check didn't run it\./);
        assert.equal(existsSync(ran), false, `the check ran ${script}`);
        if (!/npx/.test(script)) assert.deepEqual(rest, [true, true, true]);
      });
    }
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
  withRepo(boundedRepo({ script: BOUNDED.replace(/\n/g, '\r\n') }), (dir) => {
    assert.match(String(runnerHint(dir)), /The committed `scripts\/bounded-run\.sh` has Windows line ends \(CRLF\), which bash can't run\./);
    assert.equal(limitHint(dir), true);
  });
});

test('a-7 says what is wrong with the settings file the call names', () => {
  withRepo(boundedRepo({ script: runner([`  --settings ${BOUNDS_PATH} \\\n`, '']) }), (dir) => {
    assert.match(String(runnerHint(dir)), /It passes no settings file: add `--settings` with the committed file that holds the bounds, such as `--settings \.claude\/bounded-run\.json`\./);
    assert.match(String(sandboxHint(dir)), /The run gets no settings file, so nothing turns the sandbox on: pass the bounds file with `--settings`/);
  });
  withRepo(boundedRepo({ commitBounds: false }), (dir) => {
    const hint = String(runnerHint(dir));
    assert.match(hint, /`\.claude\/bounded-run\.json` isn't committed\. Run `git add \.claude\/bounded-run\.json` and commit it\. The run reads its bounds from that file\./);
    assert.equal(ruleHint(dir), hint.match(/`\.claude\/bounded-run\.json` isn't committed\.[^]*that file\./)[0]);
  });
  // An ignore rule for .claude/, such as a global one, needs git add -f.
  withRepo(boundedRepo({ settings: null, gitignore: '.practice/\n.claude/\n', commitBounds: false }), (dir) => {
    assert.match(String(runnerHint(dir)), /isn't committed, and line 2 of `\.gitignore`, `\.claude\/`, ignores it\. Run `git add -f \.claude\/bounded-run\.json` and commit it\./);
  });
  withRepo(boundedRepo({ bounds: null }), (dir) => {
    assert.match(String(runnerHint(dir)), /`--settings` names `\.claude\/bounded-run\.json`, which doesn't exist\. Save the bounds there, as the lesson shows, and commit the file\./);
  });
  withRepo(boundedRepo({ bounds: '{ "permissions": { "allow": [ } }\n' }), (dir) => {
    assert.match(String(sandboxHint(dir)), /The committed `\.claude\/bounded-run\.json` isn't valid JSON: /);
  });
  withRepo(boundedRepo({ script: runner([`--settings ${BOUNDS_PATH}`, '--settings ~/bounded-run.json']) }), (dir) => {
    assert.match(String(runnerHint(dir)), /`--settings` names `[^`]*\/bounded-run\.json`, which is outside your repository\. Pass a file committed in it/);
  });
  withRepo(boundedRepo({ script: runner([`--settings ${BOUNDS_PATH}`, '--settings \'{"sandbox": {"enabled": true,}}\'']) }), (dir) => {
    assert.match(String(runnerHint(dir)), /The inline `--settings` JSON isn't valid JSON: /);
  });
});

test('a-7 names a byte-order mark at the start of the bounds file or the project settings', () => {
  withRepo(boundedRepo({ bounds: `\uFEFF${json(BOUNDS)}` }), (dir) => {
    assert.equal(sandboxHint(dir), 'The committed `.claude/bounded-run.json` isn\'t valid JSON: it starts with a UTF-8 byte-order mark. Save it as UTF-8 without one, and commit.');
  });
  withRepo(boundedRepo({ settings: `\uFEFF${json(PROJECT_SETTINGS)}` }), (dir) => {
    assert.equal(ruleHint(dir), 'The committed `.claude/settings.json` isn\'t valid JSON: it starts with a UTF-8 byte-order mark. Save it as UTF-8 without one, and commit.');
  });
});

test('a-7 names each turn and spend limit that is missing or not a usable number', () => {
  for (const [from, to, hint] of [
    ['  --max-turns 15 \\\n', '', /^It sets no turn limit: add `--max-turns` with a whole number of 1 or more\.$/],
    ['  --max-budget-usd 2 \\\n', '', /^It sets no spend limit: add `--max-budget-usd` with an amount in US dollars, above what a slice of the task costs\.$/],
    ['--max-turns 15', '--max-turns 0', /`--max-turns 0` is below 1: write a whole number of 1 or more\./],
    ['--max-turns 15', '--max-turns abc', /`--max-turns abc` isn't a whole number: write one of 1 or more\./],
    ['--max-turns 15', '--max-turns 7.5', /`--max-turns 7\.5` isn't a whole number/],
    ['--max-turns 15', '--max-turns "$TURNS"', /`--max-turns` has no number after it: write a whole number of 1 or more\./],
    ['--max-turns 15', '--max-turns', /`--max-turns` has no number after it, so it takes `--max-budget-usd` as its value: write a whole number of 1 or more\. .*It sets no spend limit/],
    ['--max-turns 15', '--max_turns 15', /Claude Code doesn't know `--max_turns`, so it stops with an error before the run starts: write `--max-turns`\./],
    ['--max-budget-usd 2', '--max-budget-usd 0', /`--max-budget-usd 0` isn't above 0: write an amount in US dollars, above what a slice of the task costs\./],
    ['--max-budget-usd 2', '--max-budget-usd -1', /`--max-budget-usd -1` isn't an amount: write a number of US dollars, without a `\$` sign\./],
    ['--max-budget-usd 2', '--max-budget-usd abc', /`--max-budget-usd abc` isn't an amount/],
    ['--max-budget-usd 2', '--max-budget-usd \'$2\'', /`--max-budget-usd \$2` isn't an amount: write a number of US dollars, without a `\$` sign\./],
  ]) {
    withRepo(boundedRepo({ script: runner(['set -u\n', ''], [from, to]) }), (dir) => {
      assert.match(String(limitHint(dir)), hint, to);
    });
  }
  // A flag commented out inside the continued command ends the command
  // there, so neither it nor the flags after it reach claude.
  withRepo(boundedRepo({ script: runner(['  --max-turns 15 \\', '  # --max-turns 15 \\']) }), (dir) => {
    const hint = String(limitHint(dir));
    assert.match(hint, /It sets no turn limit/);
    assert.match(hint, /It sets no spend limit/);
  });
});

test('a-7 tells a rule for one folder or one command from a wider one', () => {
  for (const rule of ['Edit(./src/**)', 'Edit(src/**)', 'Edit(/test/**)', 'Edit(docs/guide.md)', 'Read(./docs/**)', 'Bash(npm test)', 'Bash(npm test *)', 'Bash(npm run lint:*)', 'WebFetch(domain:example.com)', 'mcp__github__get_issue', 'Agent(Explore)', 'Workflow(todo-check)']) {
    assert.equal(wideReason(rule), null, rule);
  }
  for (const [rule, why] of [
    ['Bash', 'lets every command through'],
    ['Bash(*)', 'lets every command through'],
    ['Bash(npm *)', 'lets every `npm` command through, whatever its arguments'],
    ['Bash(npm:*)', 'lets every `npm` command through, whatever its arguments'],
    ['Bash(npm*)', 'lets every `npm` command through, whatever its arguments'],
    ['Bash(* --version)', 'starts with a wildcard, so it matches commands of every program'],
    ['Edit', 'lets the run edit any file'],
    ['Write', 'lets the run edit any file'],
    ['Read', 'lets the run read any file'],
    ['Edit(**)', 'lets the run edit any file'],
    ['Edit(./**)', 'lets the run edit files in every folder of the project'],
    ['Edit(/**)', 'lets the run edit files in every folder of the project'],
    ['Edit(**/*.ts)', 'lets the run edit files in every folder of the project'],
    ['Edit(../**)', 'lets the run edit files outside the project'],
    ['Edit(//**)', 'lets the run edit files anywhere on the disk'],
    ['Edit(~/**)', 'lets the run edit files anywhere in your home folder'],
    ['WebFetch', 'lets every use of `WebFetch` through'],
    ['WebFetch(domain:*)', 'lets the run fetch from every domain'],
    ['Workflow', 'lets every use of `Workflow` through'],
    ['mcp__github', 'lets every tool of that MCP server through'],
    ['mcp__github__*', 'matches every tool whose name fits it'],
  ]) {
    assert.equal(wideReason(rule), why, rule);
  }
});

test('a-7 counts a deny rule as stopping a git command only when it matches every form of it', () => {
  for (const rule of ['Bash(git push *)', 'Bash(git push:*)', 'Bash(git push*)', 'Bash(git *)', 'Bash(git:*)', 'Bash', 'Bash(*)', '*']) {
    assert.equal(stops(rule, 'git push'), true, rule);
  }
  for (const rule of ['Bash(git push)', 'Bash(git push origin *)', 'Bash(git * push *)', 'Bash(git pull *)', 'Bash(git commit *)', 'Read(./.git/**)', 'Bash(gitpush *)']) {
    assert.equal(stops(rule, 'git push'), false, rule);
  }
});

test('a-7 names allow rules wider than one folder or one command, wherever the run reads them', () => {
  withRepo(boundedRepo({ bounds: boundsWith((b) => b.permissions.allow.push('Bash(npm *)', 'Edit(**)')) }), (dir) => {
    assert.equal(ruleHint(dir), '`Bash(npm *)` in `.claude/bounded-run.json` lets every `npm` command through, whatever its arguments. `Edit(**)` in `.claude/bounded-run.json` lets the run edit any file. Allow one folder or one command per rule, as in `Edit(./src/**)` or `Bash(npm test *)`.');
  });
  withRepo(boundedRepo({ script: runner(['--permission-mode dontAsk', '--permission-mode dontAsk --allowedTools "Read,Edit(./src/**)"']) }), (dir) => {
    assert.match(String(ruleHint(dir)), /^`Read` in `--allowedTools` lets the run read any file\. Allow one folder/);
  });
  withRepo(boundedRepo({ bounds: boundsWith((b) => b.permissions.allow.push('Bash(git push *)')) }), (dir) => {
    assert.match(String(ruleHint(dir)), /`Bash\(git push \*\)` in `\.claude\/bounded-run\.json` lets the run use `git push`\. Take it out: the deny rules must stop it\./);
  });
  // A trusted folder adds the project's allow rules to the run's.
  withRepo(boundedRepo({ settings: { ...PROJECT_SETTINGS, permissions: { allow: ['Bash(npm *)'] } } }), (dir) => {
    assert.match(String(ruleHint(dir)), /`Bash\(npm \*\)` in `\.claude\/settings\.json` lets every `npm` command through/);
  });
  // Unless the run leaves the project's settings files out.
  withRepo(boundedRepo({ script: runner(['--setting-sources project', '--setting-sources user']), settings: { permissions: { allow: ['Bash(npm *)'] } } }), (dir) => {
    assert.equal(ruleHint(dir), true);
  });
  withRepo(boundedRepo({ settings: '{ "permissions": \n' }), (dir) => {
    assert.match(String(ruleHint(dir)), /^The committed `\.claude\/settings\.json` isn't valid JSON: /);
  });
});

test('a-7 fails bounds that allow nothing of their own', () => {
  const hint = /Nothing the run is given allows a single call, so in `dontAsk` mode it can't edit a file or run your tests\. In the bounds file's `permissions\.allow`/;
  withRepo(boundedRepo({ bounds: boundsWith((b) => delete b.permissions.allow) }), (dir) => {
    assert.match(String(ruleHint(dir)), hint);
  });
});

test('a-7 wants deny rules that stop git commit and git push with any arguments, from the file, the flags or the project', () => {
  withRepo(boundedRepo({ bounds: boundsWith((b) => { b.permissions.deny = ['Bash(git commit:*)', 'Bash(git push:*)']; }) }), (dir) => {
    assert.equal(ruleHint(dir), true);
  });
  withRepo(boundedRepo({ bounds: boundsWith((b) => { b.permissions.deny = ['Bash(git commit *)', 'Bash(git push)']; }) }), (dir) => {
    assert.equal(ruleHint(dir), '`Bash(git push)` in `.claude/bounded-run.json` matches only the bare `git push`, not `git push origin main`. Write `Bash(git push *)`: the trailing ` *` also matches the bare command.');
  });
  withRepo(boundedRepo({ bounds: boundsWith((b) => { b.permissions.deny = ['Read(./.env)']; }) }), (dir) => {
    assert.equal(ruleHint(dir), 'No deny rule stops `git commit`: add `"Bash(git commit *)"` to `permissions.deny` in the settings file. No deny rule stops `git push`: add `"Bash(git push *)"` to `permissions.deny` in the settings file.');
  });
  withRepo(boundedRepo({ bounds: boundsWith((b) => { b.permissions.deny = []; }), script: runner(['--permission-mode dontAsk', '--permission-mode dontAsk --disallowedTools "Bash(git commit *)" "Bash(git push *)"']) }), (dir) => {
    assert.equal(ruleHint(dir), true);
  });
  // Deny rules in .claude/settings.json hold whether or not the folder is trusted.
  const projectDeny = { ...PROJECT_SETTINGS, permissions: { ...PROJECT_SETTINGS.permissions, deny: ['Bash(git commit *)', 'Bash(git push *)'] } };
  withRepo(boundedRepo({ bounds: boundsWith((b) => { b.permissions.deny = []; }), settings: projectDeny }), (dir) => {
    assert.equal(ruleHint(dir), true);
  });
  withRepo(boundedRepo({ bounds: boundsWith((b) => { b.permissions.deny = []; }), settings: projectDeny, script: runner(['--setting-sources project', '--setting-sources user']) }), (dir) => {
    assert.match(String(ruleHint(dir)), /No deny rule stops `git commit`/);
  });
  withRepo(boundedRepo({ bounds: boundsWith((b) => { b.permissions.deny = ['Bash(git commit *)']; }), after: (dir) => write(dir, { [BOUNDS_PATH]: json(BOUNDS) }) }), (dir) => {
    assert.match(String(ruleHint(dir)), /No deny rule stops `git push`.*Your copy of `\.claude\/bounded-run\.json` has changes that aren't committed: if they fix this, commit them\./);
  });
});

test('a-7 names each sandbox setting the bounds file leaves out', () => {
  for (const [key, hint] of [
    ['enabled', /Set `"enabled": true` under `sandbox`: the sandbox is off unless a settings file turns it on\./],
    ['failIfUnavailable', /Set `"failIfUnavailable": true`: without it, a run whose sandbox can't start runs commands unsandboxed\./],
    ['allowUnsandboxedCommands', /Set `"allowUnsandboxedCommands": false`: without it, Claude can retry a command the sandbox blocked outside the sandbox\./],
    ['autoAllowBashIfSandboxed', /Set `"autoAllowBashIfSandboxed": false`: without it, sandboxed commands run without your allow rules or permission mode deciding, and only deny rules can stop one\./],
  ]) {
    withRepo(boundedRepo({ bounds: boundsWith((b) => delete b.sandbox[key]) }), (dir) => {
      const result = String(sandboxHint(dir));
      assert.match(result, /^In `\.claude\/bounded-run\.json`: /);
      assert.match(result, hint, key);
      assert.equal(result.match(/Set `/g).length, 1, result);
    });
  }
  withRepo(boundedRepo({ bounds: boundsWith((b) => { b.sandbox.enabled = 'true'; b.sandbox.autoAllowBashIfSandboxed = true; }) }), (dir) => {
    assert.match(String(sandboxHint(dir)), /Set `"enabled": true`.*Set `"autoAllowBashIfSandboxed": false`/);
  });
  withRepo(boundedRepo({ bounds: boundsWith((b) => delete b.sandbox) }), (dir) => {
    assert.equal(sandboxHint(dir), '`.claude/bounded-run.json` has no `sandbox` settings. Add `"sandbox": {"enabled": true, "failIfUnavailable": true, "allowUnsandboxedCommands": false, "autoAllowBashIfSandboxed": false}`.');
  });
  // The sandbox in .claude/settings.json isn't the run's bounds file.
  withRepo(boundedRepo({ bounds: boundsWith((b) => delete b.sandbox), settings: { ...PROJECT_SETTINGS, sandbox: BOUNDS.sandbox } }), (dir) => {
    assert.match(String(sandboxHint(dir)), /has no `sandbox` settings/);
  });
});

test('a-7 reads the saved slice, and says what is wrong with it', () => {
  const utf16 = (text) => Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text.replace(/\n/g, '\r\n'), 'utf16le')]);
  const stream = [{ type: 'system', subtype: 'init', session_id: SESSION, permissionMode: 'dontAsk' }, { type: 'assistant', session_id: SESSION, message: { content: [] } }, SLICE_RUN].map((m) => JSON.stringify(m)).join('\n');
  for (const slice of [`﻿${JSON.stringify(SLICE_RUN)}`, utf16(JSON.stringify(SLICE_RUN, null, 2)), `${stream}\n`, { ...SLICE_RUN, total_cost_usd: 1.99 }]) {
    withRepo(boundedRepo({ slice }), (dir) => {
      assert.equal(sliceHint(dir), true);
    });
  }
  for (const [slice, hint] of [
    [null, /^There is no `\.practice\/a-7-slice\.json` yet: run your script on a slice of the task, as the lesson's Worked example does: `scripts\/bounded-run\.sh "<a small part of the task>" \.practice\/a-7-slice\.json`\.$/],
    ['Added a test for total(). npm test passes.\n', /`\.practice\/a-7-slice\.json` isn't JSON\. Save only what `claude -p --output-format json` prints to its standard output there\. Then run the slice again\./],
    [`${stream.split('\n').slice(0, 2).join('\n')}\n`, /`\.practice\/a-7-slice\.json` holds no result: the run didn't finish\./],
    [{ ...SLICE_RUN, type: 'assistant' }, /isn't the result of a `claude -p` run with `--output-format json`/],
    [{ ...SLICE_RUN, session_id: STUB_SESSION }, /holds the check's stand-in reply, not a real run/],
    [{ ...SLICE_RUN, subtype: 'error_max_budget_usd', is_error: true }, /The slice stopped at your spend limit \(`error_max_budget_usd`\), so the limit is below what one slice costs\. Raise `--max-budget-usd` in `scripts\/bounded-run\.sh` and commit it\. Then run the slice again\./],
    [{ ...SLICE_RUN, subtype: 'error_max_turns', is_error: true }, /The slice stopped at your turn limit \(`error_max_turns`\) before it finished\. Raise `--max-turns` in `scripts\/bounded-run\.sh`, or give it a smaller slice\./],
    [{ ...SLICE_RUN, subtype: 'error_during_execution', is_error: true }, /The slice ended with `error_during_execution`, not `success`/],
    [{ ...SLICE_RUN, is_error: true, result: 'Not logged in · Please run /login' }, /The slice run failed: "Not logged in · Please run \/login"\. Fix what it says\./],
    [{ ...SLICE_RUN, total_cost_usd: undefined }, /has no cost estimate in `total_cost_usd`, which is what the slice is for/],
    [{ ...SLICE_RUN, num_turns: undefined }, /has no turn count in `num_turns`/],
    [{ ...SLICE_RUN, total_cost_usd: 2.37 }, /The slice cost an estimated \$2\.37 \(`total_cost_usd`\), and your spend limit, `--max-budget-usd 2`, isn't above it\. Set the limit above what the slice cost, scaled to the whole task, and commit `scripts\/bounded-run\.sh`\./],
    [{ ...SLICE_RUN, total_cost_usd: 2 }, /isn't above it/],
  ]) {
    withRepo(boundedRepo({ slice }), (dir) => {
      assert.match(String(sliceHint(dir)), hint, JSON.stringify(slice));
    });
  }
  withRepo(boundedRepo({ script: runner(['  --max-budget-usd 2 \\\n', '']) }), (dir) => {
    assert.equal(sliceHint(dir), 'The check can\'t read a spend limit from `scripts/bounded-run.sh` (see the second item), so it can\'t compare the slice\'s cost with it.');
  });
});

test('the script reader finds each claude call as the shell would pass it', () => {
  const text = [
    '#!/bin/bash',
    '# claude -p "a comment, not a call"',
    'turns=15',
    'export FLAGS="--output-format json --model sonnet"',
    'if [ $# -ne 2 ]; then echo "usage: claude -p <task>" >&2; exit 2; fi',
    'claude -p "$1" \\',
    '  --settings .claude/bounded-run.json \\',
    '  --max-turns "$turns" --max-budget-usd ${BUDGET:-2} $FLAGS 2>&1 > "$2"',
    'version=$(claude --version)',
    'printf "%s" "$1" | ~/.local/bin/claude -p --allowedTools \'Bash(npm test *)\' "Edit(./src/**)"',
    'cat <<EOF',
    'claude -p "inside a here-document"',
    'EOF',
    'claude -p "$1" \\',
    '  # --max-turns 5',
    '  --output-format json',
    '',
  ].join('\n');
  assert.deepEqual(scriptCalls(text), [
    ['-p', '$1', '--settings', '.claude/bounded-run.json', '--max-turns', '15', '--max-budget-usd', '2', '--output-format', 'json', '--model', 'sonnet'],
    ['--version'],
    ['-p', '--allowedTools', 'Bash(npm test *)', 'Edit(./src/**)'],
    ['-p', '$1'],
  ]);
  assert.deepEqual(scriptCalls('claude -p "$(cat prompt.txt)" --max-turns=$N\r\n'), [['-p', '$(cat prompt.txt)', '--max-turns=$N']]);
});

test('the stand-in records the folder each call ran in, and maps a path argument into the scratch repository', () => {
  const script = '#!/usr/bin/env bash\nclaude -p a --settings .claude/x.json\ncd src && claude -p b --settings ../.claude/x.json --add-dir "$PWD/.."\nclaude -p c --settings /etc/hosts\n';
  withRepo(boundedRepo({ script }), (dir) => {
    const run = runStubbed(openRepo(dir), RUNNER, { commit: { 'src/a.js': '' } });
    assert.deepEqual(run.calls.map((c) => c.cwd), ['', 'src', 'src']);
    assert.deepEqual(run.calls.map((c) => scratchPath(run, c, c.argv[3])), ['.claude/x.json', '.claude/x.json', null]);
    assert.equal(scratchPath(run, run.calls[1], run.calls[1].argv[5]), '');
  });
});

test('a-7 fails on an unsolved repository and passes on a solved one, as the template\'s assertions expect', () => {
  withRepo(boundedRepo({ script: null, bounds: null, slice: null }), (dir) => {
    const { code, out } = check(['a-7', '--assert', 'fail', '--dir', dir]);
    assert.equal(code, 0, out);
  });
  withRepo(boundedRepo(), (dir) => {
    const { code, out } = check(['a-7', '--assert', 'pass', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

// The Advanced capstone, in a new copy of the template: the worktrees
// ignored; two sessions at once, one adding the team's review skill and the
// review script that runs it, and one the team marketplace with the settings
// that register it, listed while both worktrees existed, merged and removed;
// the per-file review workflow saved; the review workflow on pull_request,
// which runs the same skill and cancels a superseded run, committed and,
// with `teardown`, deleted; and one run of the script saved. The options
// change a step:
// `gitignore` is committed first, with `files`; `script`, `settings`,
// `workflow` and `ci` (null for none) replace what is committed; `merge` is
// 'no-ff', 'squash' or 'one'; `listing` and `run` (null for none) are what
// is saved; `after` changes the repository last. The check runs the script
// with a stand-in for `claude` and never runs gh.
const CAPSTONE_START = {
  'README.md': '# linkcheck\n',
  'package.json': json({ name: 'linkcheck', private: true, type: 'module', scripts: { test: 'node -e "process.exit(0)"' } }),
  'src/total.js': TOTAL,
};
const KIT_FILES = {
  [`${MARKETPLACE_ROOT}/.claude-plugin/marketplace.json`]: json(TEAM_MARKET),
  [`${TEAM_KIT}/.claude-plugin/plugin.json`]: json({ name: 'team-kit', version: '0.1.0', description: 'A team\'s shared setup', author: { name: 'Your team' } }),
  [`${TEAM_KIT}/skills/onboard/SKILL.md`]: '---\nname: onboard\ndescription: Explains the shared setup to a new teammate.\n---\n\nExplain it.\n',
};
const TEAM_SETTINGS = {
  permissions: { deny: ['Read(.env)'] },
  extraKnownMarketplaces: { 'team-tools': { source: { source: 'directory', path: './team-marketplace' } } },
  enabledPlugins: { 'team-kit@team-tools': true },
};
const FILE_REVIEW_PATH = '.claude/workflows/file-review.js';
const FILE_REVIEW = [
  'export const meta = {',
  "  name: 'file-review',",
  "  description: 'Review each file under src/ and have a second agent verify each finding',",
  '}',
  '',
  "const listed = await agent('List every file under src/, one path from the repository root each.', {",
  "  schema: { type: 'object', required: ['paths'], properties: { paths: { type: 'array', items: { type: 'string' } } } },",
  '})',
  'const found = await pipeline(listed.paths, (path) => agent(`Review ${path} for bugs. Report each finding as path:line and one sentence.`))',
  'const verified = await pipeline(found, (finding) => agent(`Check this finding against the code and say whether it holds: ${finding}`))',
  "return verified.join('\\n')",
  '',
].join('\n');
const CLAUDE_REVIEW = [
  'name: Claude review',
  '',
  'on:',
  '  pull_request:',
  '    types: [opened, synchronize]',
  '',
  'permissions:',
  '  contents: read',
  '  pull-requests: read',
  '',
  'jobs:',
  '  review:',
  '    runs-on: ubuntu-latest',
  '    timeout-minutes: 10',
  '    steps:',
  '      - uses: actions/checkout@v7',
  '        with:',
  '          fetch-depth: 0',
  `      - uses: anthropics/claude-code-action@${PIN} # v1.0.237`,
  '        with:',
  '          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}',
  '          github_token: ${{ github.token }}',
  "          prompt: /team-review",
  '          claude_args: --model sonnet --max-turns 5 --allowedTools "Read,Grep,Glob,Bash(git diff *)"',
  '',
  'concurrency:',
  '  group: review-${{ github.event.pull_request.number }}',
  '  cancel-in-progress: true',
  '',
].join('\n');
const MADE_UP_KEY = `sk-ant-api03-${'Xy9_'.repeat(8)}`;
// CI's review run on the pull request, as `gh run list --json ...` saves it.
const CAPSTONE_CI = '.practice/a-capstone-ci.json';
const CI_RUN = { databaseId: 987654321, status: 'completed', conclusion: 'success', event: 'pull_request', url: 'https://github.com/learner/claude-capstone/actions/runs/987654321', workflowName: 'Claude review' };

// The review workflow with each `[from, to]` replaced.
function reviewWith(...pairs) {
  return pairs.reduce((text, [from, to]) => {
    assert.ok(text.includes(from), `the review workflow has no ${JSON.stringify(from)}`);
    return text.replace(from, () => to);
  }, CLAUDE_REVIEW);
}

// The capstone's review script runs the team's review skill and also caps
// spend, as lesson 7's runs do.
const CAPSTONE_SCRIPT = withFlags(`${FLAGS} --max-budget-usd 0.50`).replace(PROMPT, '/team-review');
const SKILL = '.claude/skills/team-review/SKILL.md';
const TEAM_REVIEW = '---\nname: team-review\ndescription: Reviews a change the team\'s way. Use before a commit and on each pull request.\n---\n\nReview the change you are given, or the branch\'s changes from git diff, for bugs and missing tests. List each finding as file:line and one sentence.\n';

function capstoneRepo({
  gitignore = IGNORE, files = {}, script = CAPSTONE_SCRIPT, skill = TEAM_REVIEW, settings = TEAM_SETTINGS, workflow = FILE_REVIEW, ci = CLAUDE_REVIEW,
  teardown = false, merge = 'no-ff', listing = (text) => text, run = REAL_RUN, ciRuns = [CI_RUN], after,
} = {}) {
  return () => {
    const dir = repo({ '.gitignore': gitignore, ...CAPSTONE_START, ...files });
    commit(dir, 'Start');
    const sessions = [
      ['review-script', { ...(script === null ? {} : { [SCRIPT]: script }), ...(skill === null ? {} : { [SKILL]: skill }) }],
      ['team-kit', { ...KIT_FILES, ...(settings === null ? {} : { '.claude/settings.json': typeof settings === 'string' ? settings : json(settings) }) }],
    ];
    const at = (name) => join(dir, '.claude', 'worktrees', name);
    for (const [name] of sessions) git(dir, 'worktree', 'add', '-q', '-b', `worktree-${name}`, `.claude/worktrees/${name}`);
    for (const [name, made] of sessions) {
      write(at(name), made);
      if (made[SCRIPT]) setMode(at(name), SCRIPT, 0o755);
      commit(at(name), `Build ${name}`);
    }
    const saved = listing(`${git(dir, 'worktree', 'list', '--porcelain')}\n`);
    if (saved !== null) write(dir, { [CAPSTONE_LISTING]: saved });
    for (const [name] of merge === 'one' ? sessions.slice(0, 1) : sessions) {
      if (merge === 'squash') {
        git(dir, 'merge', '-q', '--squash', `worktree-${name}`);
        git(dir, 'commit', '-q', '-m', `Squash worktree-${name}`);
      } else {
        git(dir, 'merge', '-q', '--no-ff', '--no-edit', `worktree-${name}`);
      }
    }
    for (const [name] of sessions) git(dir, 'worktree', 'remove', '--force', `.claude/worktrees/${name}`);
    if (workflow !== null) {
      write(dir, { [FILE_REVIEW_PATH]: workflow });
      commit(dir, 'Save the per-file review workflow', [FILE_REVIEW_PATH]);
    }
    if (ci !== null) {
      write(dir, { [REVIEW_WORKFLOW]: ci });
      commit(dir, 'Review each pull request with Claude', [REVIEW_WORKFLOW]);
    }
    if (teardown) {
      git(dir, 'rm', '-q', REVIEW_WORKFLOW);
      commit(dir, 'Tear down the review workflow', []);
    }
    if (run !== null) write(dir, { [CAPSTONE_RUN]: typeof run === 'string' || Buffer.isBuffer(run) ? run : JSON.stringify(run, null, 2) });
    if (ciRuns !== null) write(dir, { [CAPSTONE_CI]: typeof ciRuns === 'string' ? ciRuns : JSON.stringify(ciRuns, null, 2) });
    after?.(dir);
    return dir;
  };
}

const aCapstone = (dir) => check(['a-capstone', '--dir', dir]);
// One item on its own, found by its text.
const capstoneHint = (dir, pattern) => {
  const item = capstoneItems.find((i) => pattern.test(i.text));
  assert.ok(item, `no capstone item matches ${pattern}`);
  return item.check(openRepo(dir));
};
const CI_ITEM = /^a committed workflow runs `anthropics\/claude-code-action` on `pull_request`/;

test('the Advanced capstone passes for everything the brief asks for, committed, with the worktree listing and one run saved', () => {
  withRepo(capstoneRepo(), (dir) => {
    const { code, out } = aCapstone(dir);
    assert.equal(code, 0, out);
    assert.match(out, /17 of 17 passed/);
  });
});

test('the Advanced capstone still passes after the teardown deletes the review workflow, since it reads the history', () => {
  withRepo(capstoneRepo({ teardown: true }), (dir) => {
    assert.equal(existsSync(join(dir, REVIEW_WORKFLOW)), false);
    const { code, out } = aCapstone(dir);
    assert.equal(code, 0, out);
  });
});

test('the Advanced capstone wants the saved record of CI\'s review run: a completed, successful pull_request run of the review workflow', () => {
  const CI_RUN_ITEM = /pull_request` run of the review workflow$/;
  const hint = (ciRuns, more = {}) => {
    let out;
    withRepo(capstoneRepo({ ciRuns, ...more }), (dir) => {
      out = capstoneHint(dir, CI_RUN_ITEM);
    });
    return out;
  };
  // Passes: the newest run succeeded, an older one failed, another workflow ran too.
  assert.equal(hint([CI_RUN, { ...CI_RUN, databaseId: 1, conclusion: 'failure' }, { ...CI_RUN, workflowName: 'Progress', event: 'push' }]), true);
  // After the teardown, the name still comes from the history.
  assert.equal(hint([CI_RUN], { teardown: true }), true);
  // A review workflow with no name shows under its path.
  assert.equal(hint([{ ...CI_RUN, workflowName: '.github/workflows/claude-review.yml' }], { ci: CLAUDE_REVIEW.replace('name: Claude review\n', '') }), true);
  for (const [ciRuns, pattern] of [
    [null, /^There is no `\.practice\/a-capstone-ci\.json` yet\. Once the review run on your pull request finishes, save the list: `gh run list --workflow claude-review\.yml --json databaseId,status,conclusion,event,url,workflowName > \.practice\/a-capstone-ci\.json`\.$/],
    ['not json', /isn't JSON\./],
    [[], /lists no runs\. Open a pull request so the review runs/],
    [[{ databaseId: 1 }], /doesn't hold the fields the check reads/],
    [[{ ...CI_RUN, workflowName: 'Progress' }], /lists no run of your review workflow, `Claude review`, only `Progress`\./],
    [[{ ...CI_RUN, event: 'workflow_dispatch' }], /lists no run of `Claude review` that a pull request started \(`pull_request`\)/],
    [[{ ...CI_RUN, status: 'in_progress', conclusion: '' }], /^Run 987654321 hasn't finished: its `status` is `in_progress`\. Wait for it with `gh run watch 987654321`/],
    [[{ ...CI_RUN, conclusion: 'cancelled' }], /ended with `cancelled`: a newer push to the pull request cancels the review still running/],
    [[{ ...CI_RUN, conclusion: 'failure' }], /ended with `failure`\. See why with `gh run view 987654321 --log-failed`/],
    [[{ ...CI_RUN, conclusion: 'skipped' }], /ended with `skipped`\. Push to the pull request so the review runs again/],
  ]) {
    assert.match(String(hint(ciRuns)), pattern, JSON.stringify(ciRuns));
  }
  // With an origin, the run must be this repository's.
  const origin = (url) => (dir) => git(dir, 'remote', 'add', 'origin', url);
  assert.equal(hint([CI_RUN], { after: origin('git@github.com:learner/claude-capstone.git') }), true);
  assert.match(String(hint([CI_RUN], { after: origin('https://github.com/someone/else.git') })), /ran in `learner\/claude-capstone`, but this repository's `origin` is `someone\/else`/);
  assert.match(String(hint([{ ...CI_RUN, url: undefined }], { after: origin('git@github.com:learner/claude-capstone.git') })), /has no GitHub run URL/);
  // No review workflow in the history.
  assert.match(String(hint([CI_RUN], { ci: null })), /without a committed review workflow/);
});

test('the Advanced capstone reads its own saved files, not the ones the lessons save', () => {
  const lessonPaths = (dir) => {
    renameSync(join(dir, CAPSTONE_LISTING), join(dir, LISTING));
    renameSync(join(dir, CAPSTONE_RUN), join(dir, RESULT));
  };
  withRepo(capstoneRepo({ after: lessonPaths }), (dir) => {
    const { code, out } = aCapstone(dir);
    assert.equal(code, 1, out);
    assert.match(out, /14 of 17 passed/);
    assert.match(out, /run `git worktree list --porcelain > \.practice\/a-capstone-worktrees\.txt` from your main checkout/);
    assert.match(out, /stage a change and run `scripts\/review-staged\.sh \.practice\/a-capstone-run\.json`, which saves the JSON there/);
  });
});

test('the Advanced capstone wants the review script to cap spend, as lesson 7 does, and the saved run to cost less than the cap', () => {
  const SPEND = /caps spend with `--max-budget-usd`/;
  withRepo(capstoneRepo({ script: REVIEW }), (dir) => {
    assert.match(String(capstoneHint(dir, SPEND)), /sets no spend cap\. Add `--max-budget-usd`/);
  });
  withRepo(capstoneRepo({ script: withFlags(`${FLAGS} --max-budget-usd "$BUDGET"`) }), (dir) => {
    assert.match(String(capstoneHint(dir, SPEND)), /gets its amount from a variable the check can't work out/);
  });
  withRepo(capstoneRepo({ script: withFlags(`${FLAGS} --max-budget-usd 0`) }), (dir) => {
    assert.match(String(capstoneHint(dir, SPEND)), /`--max-budget-usd 0` isn't an amount above 0/);
  });
  withRepo(capstoneRepo({ run: { ...REAL_RUN, total_cost_usd: 0.5 } }), (dir) => {
    assert.match(String(capstoneHint(dir, SPEND)), /cost an estimated \$0\.5 \(`total_cost_usd`\), and your spend cap, `--max-budget-usd 0\.50`, isn't above it/);
  });
  withRepo(capstoneRepo({ run: { ...REAL_RUN, subtype: 'error_max_budget_usd', is_error: true } }), (dir) => {
    assert.match(String(capstoneHint(dir, SPEND)), /stopped at your spend cap \(`error_max_budget_usd`\)/);
  });
  withRepo(capstoneRepo({ run: (({ total_cost_usd, ...rest }) => rest)(REAL_RUN) }), (dir) => {
    assert.match(String(capstoneHint(dir, SPEND)), /has no cost estimate in `total_cost_usd`/);
  });
  withRepo(capstoneRepo(), (dir) => {
    assert.equal(capstoneHint(dir, SPEND), true);
  });
});

test('the Advanced capstone wants both worktree changes in the branch, merged or squashed, as lesson 1 does', () => {
  withRepo(capstoneRepo({ merge: 'one' }), (dir) => {
    assert.match(String(capstoneHint(dir, /lists two worktrees/)), /The change on `worktree-team-kit` isn't in your current branch\. From your main checkout, bring it in the way your team does: `git merge worktree-team-kit`/);
  });
  withRepo(capstoneRepo({ merge: 'squash' }), (dir) => {
    assert.equal(capstoneHint(dir, /lists two worktrees/), true);
  });
  withRepo(capstoneRepo({ listing: (text) => text.split('\n\n')[0] }), (dir) => {
    assert.match(String(capstoneHint(dir, /lists two worktrees/)), /lists no worktree besides the main checkout/);
  });
});

test('the Advanced capstone takes worktrees anywhere, and wants the ones inside the repository ignored', () => {
  // Worktrees made with git outside the repository need no ignore rule.
  const outside = () => {
    const parent = mkdtempSync(join(tmpdir(), 'capstone-'));
    const dir = join(parent, 'copy');
    execFileSync('mkdir', ['-p', dir]);
    git(dir, 'init', '-q');
    write(dir, { '.gitignore': '.practice/\n', 'README.md': '# demo\n' });
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'Start');
    for (const name of ['a', 'b']) {
      git(dir, 'worktree', 'add', '-q', '-b', `side-${name}`, join(parent, name));
      write(join(parent, name), { [`${name}.txt`]: `${name}\n` });
      git(join(parent, name), 'add', '-A');
      git(join(parent, name), 'commit', '-q', '-m', `Work ${name}`);
    }
    write(dir, { [CAPSTONE_LISTING]: `${git(dir, 'worktree', 'list', '--porcelain')}\n` });
    for (const name of ['a', 'b']) git(dir, 'merge', '-q', '--no-edit', `side-${name}`);
    return dir;
  };
  const dir = outside();
  try {
    assert.equal(capstoneHint(dir, /keeps the worktrees/), true);
    assert.equal(capstoneHint(dir, /lists two worktrees/), true);
  } finally {
    rmSync(dirname(dir), { recursive: true, force: true });
  }
  // Worktrees inside the repository, in a folder no committed rule ignores.
  withRepo(capstoneRepo({ gitignore: '.practice/\n' }), (d) => {
    assert.match(String(capstoneHint(d, /keeps the worktrees/)), /No committed `\.gitignore` ignores `\.claude\/worktrees\/(review-script|team-kit)\/`/);
  });
});

test('the Advanced capstone reads the listed worktrees from the git root when it sits above the project folder, as in a copy', () => {
  const nested = (gitignore) => () => {
    const dir = repo({ '.gitignore': gitignore, 'README.md': '# demo\n' }, { nested: true });
    commit(dir, 'Start');
    for (const name of ['a', 'b']) {
      git(dir, 'worktree', 'add', '-q', '-b', `side-${name}`, `.claude/worktrees/${name}`);
      write(join(dir, '.claude', 'worktrees', name, 'project'), { [`${name}.txt`]: `${name}\n` });
      commit(join(dir, '.claude', 'worktrees', name), `Work ${name}`);
    }
    write(dir, { [CAPSTONE_LISTING]: `${git(dir, 'worktree', 'list', '--porcelain')}\n` });
    return dir;
  };
  withRepo(nested(IGNORE), (dir) => {
    assert.equal(capstoneHint(dir, /keeps the worktrees/), true);
  });
  withRepo(nested('.practice/\n'), (dir) => {
    assert.match(String(capstoneHint(dir, /keeps the worktrees/)), /No committed `\.gitignore` ignores `\.claude\/worktrees\/(a|b)\/`/);
  });
});

test('the Advanced capstone wants the worktrees ignored in a committed .gitignore, whatever a global excludes file says', () => {
  const globalIgnore = (dir) => {
    write(dir, { '.git/global-ignore': '.claude/\n' });
    git(dir, 'config', 'core.excludesFile', join(dir, '.git', 'global-ignore'));
  };
  withRepo(capstoneRepo({ gitignore: '.practice/\n', after: globalIgnore }), (dir) => {
    assert.match(String(capstoneHint(dir, /keeps the worktrees/)), /No committed `\.gitignore` ignores `\.claude\/worktrees\//);
  });
  // With no listing yet, lesson 1's rule for .claude/worktrees/.
  withRepo(capstoneRepo({ gitignore: '.practice/\n', listing: () => null }), (dir) => {
    assert.match(String(capstoneHint(dir, /keeps the worktrees/)), /No committed `\.gitignore` ignores `\.claude\/worktrees\/`/);
  });
  const wide = (dir) => {
    write(dir, { '.gitignore': '.practice/\n.claude/\n' });
    commit(dir, 'Ignore all of .claude/', ['.gitignore']);
  };
  withRepo(capstoneRepo({ after: wide }), (dir) => {
    assert.match(String(capstoneHint(dir, /keeps the worktrees/)), /also ignores `\.claude\/settings\.json`/);
  });
});

test('the Advanced capstone wants a saved workflow whose second agent checks the first one\'s findings, and doesn\'t ask it to read args', () => {
  const noAgent = FILE_REVIEW.replace(/const listed[\s\S]*$/, "return 'nothing to review'\n");
  withRepo(capstoneRepo({ workflow: noAgent }), (dir) => {
    assert.match(String(capstoneHint(dir, /\.claude\/workflows\//)), /`\.claude\/workflows\/file-review\.js` never calls `agent\(\)`, so it starts no subagent\./);
  });
  const once = FILE_REVIEW.replace(/const listed[\s\S]*$/, "const found = await agent('Review each file under src/ for bugs.')\nreturn found\n");
  withRepo(capstoneRepo({ workflow: once }), (dir) => {
    assert.match(String(capstoneHint(dir, /\.claude\/workflows\//)), /calls `agent\(\)` only once, so no second agent checks what the first one finds/);
  });
  // Lesson 3's workflow, which also reads args, passes too.
  withRepo(capstoneRepo({ workflow: AUDIT }), (dir) => {
    assert.equal(capstoneHint(dir, /\.claude\/workflows\//), true);
  });
  withRepo(capstoneRepo({ workflow: null }), (dir) => {
    assert.match(String(capstoneHint(dir, /\.claude\/workflows\//)), /There is no workflow script in `\.claude\/workflows\/`/);
  });
});

test('the Advanced capstone holds the review script to lesson 4\'s rules', () => {
  withRepo(capstoneRepo({ script: null }), (dir) => {
    assert.match(String(capstoneHint(dir, /is committed and executable/)), /There is no `scripts\/review-staged\.sh`/);
  });
  withRepo(capstoneRepo({ script: withFlags(FLAGS.replace('dontAsk', 'acceptEdits')) }), (dir) => {
    assert.match(String(capstoneHint(dir, /^its `claude -p` call/)), /It runs in `acceptEdits` mode: use `--permission-mode dontAsk`/);
  });
  withRepo(capstoneRepo({ run: { ...REAL_RUN, subtype: 'error_max_turns', is_error: true } }), (dir) => {
    assert.match(String(capstoneHint(dir, /a-capstone-run\.json/)), /The run in `\.practice\/a-capstone-run\.json` stopped early \(`error_max_turns`\).* Raise the cap, up to 10, narrow the prompt, or check your flags\./);
  });
});

test('the Advanced capstone wants the review workflow on pull_request, and lesson 5\'s manual workflow never stands in for it', () => {
  const lesson5 = { [WORKFLOW]: LINKCHECK_REPORT };
  withRepo(capstoneRepo({ ci: null, files: lesson5 }), (dir) => {
    assert.match(String(capstoneHint(dir, CI_ITEM)), /`\.github\/workflows\/linkcheck-report\.yml` runs Claude with a `prompt`, but starts on `workflow_dispatch`\. Start it with `on: pull_request`, then commit and push\./);
  });
  withRepo(capstoneRepo({ ci: null }), (dir) => {
    assert.match(String(capstoneHint(dir, CI_ITEM)), /Write `\.github\/workflows\/claude-review\.yml` as part 5 of `capstone\/advanced-brief\.md` describes/);
  });
  // A later manual workflow doesn't shadow the review, and a review that
  // also starts by hand still counts.
  const later = (dir) => {
    write(dir, lesson5);
    commit(dir, 'Add the link check report', [WORKFLOW]);
  };
  withRepo(capstoneRepo({ after: later }), (dir) => {
    assert.equal(capstoneHint(dir, CI_ITEM), true);
    assert.equal(chosenWorkflow(openRepo(dir), CI.triggers, CI).file.path, REVIEW_WORKFLOW);
  });
  withRepo(capstoneRepo({ ci: reviewWith(['    types: [opened, synchronize]', '    types: [opened, synchronize]\n  workflow_dispatch:']) }), (dir) => {
    assert.equal(capstoneHint(dir, CI_ITEM), true);
  });
});

test('the Advanced capstone reports what is wrong with the review workflow\'s setup and limits together, on the file it read', () => {
  const loose = reviewWith([`@${PIN} # v1.0.237`, '@v1'], ['    timeout-minutes: 10\n', ''], ['          github_token: ${{ github.token }}\n', '']);
  withRepo(capstoneRepo({ ci: loose }), (dir) => {
    const got = String(capstoneHint(dir, CI_ITEM));
    assert.match(got, /^`\.github\/workflows\/claude-review\.yml`: `@v1` on line 18 can move to a new release/);
    assert.match(got, /The job `review` sets no `timeout-minutes`/);
    assert.match(got, /passes no `github_token`/);
  });
  // The copy has only the credential's secret: no hint sends the learner to
  // quick setup or relies on the Claude GitHub App.
  const bare = reviewWith(['          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}\n', ''], ['          github_token: ${{ github.token }}\n', '']);
  withRepo(capstoneRepo({ ci: bare }), (dir) => {
    const got = String(capstoneHint(dir, CI_ITEM));
    assert.match(got, /passes no credential\. Add `anthropic_api_key: \$\{\{ secrets\.ANTHROPIC_API_KEY \}\}` under `with:`, or `claude_code_oauth_token: \$\{\{ secrets\.CLAUDE_CODE_OAUTH_TOKEN \}\}` for a subscription token, naming the secret you saved with `gh secret set`\./);
    assert.match(got, /passes no `github_token`, so the action authenticates as the Claude GitHub App, which the capstone doesn't set up\. Add `github_token: \$\{\{ github\.token \}\}` under `with:`/);
    assert.doesNotMatch(got, /quick setup/);
  });
  withRepo(capstoneRepo({ ci: reviewWith(['${{ secrets.ANTHROPIC_API_KEY }}', '${{ env.CLAUDE_KEY }}']) }), (dir) => {
    assert.match(String(capstoneHint(dir, CI_ITEM)), /`anthropic_api_key` on line 21 isn't read from a secret\. Write `anthropic_api_key: \$\{\{ secrets\.<NAME> \}\}`, naming the secret you saved with `gh secret set`, and keep the credential itself out of the file\./);
  });
  for (const [ci, hint] of [
    [reviewWith(['--max-turns 5', '--max-turns 25']), /`--max-turns 25` is above 10/],
    [reviewWith(['"Read,Grep,Glob,Bash(git diff *)"', '"Read,Grep,Glob,Bash"']), /`--allowedTools` lists `Bash`, which lets Claude run any command/],
    [reviewWith(['  contents: read\n', '  contents: write\n']), /`contents: write` on line 8 gives the job token write access/],
    [reviewWith(['    types: [opened, synchronize]', '    types: [opened, synchronize]\n  pull_request_target:']), /Remove `pull_request_target` from `on:`/],
  ]) {
    withRepo(capstoneRepo({ ci }), (dir) => {
      assert.match(String(capstoneHint(dir, CI_ITEM)), hint, ci);
    });
  }
  // After the teardown, the hint names the commit it read.
  withRepo(capstoneRepo({ ci: reviewWith([`@${PIN} # v1.0.237`, '@v1']), teardown: true }), (dir) => {
    const added = git(dir, 'rev-parse', '--short=7', 'HEAD~1');
    assert.match(String(capstoneHint(dir, CI_ITEM)), new RegExp(`^\`\\.github/workflows/claude-review\\.yml\` \\(as committed in ${added}\\): \`@v1\``));
  });
});

test('the Advanced capstone fails for a Claude key or token committed at HEAD or in the workflow\'s commit, and never prints it', () => {
  const keyHint = (dir) => noCommittedKey.check(openRepo(dir));
  withRepo(capstoneRepo({ files: { 'notes/ci setup.txt': `Remember:\nANTHROPIC_API_KEY=${MADE_UP_KEY}\n` } }), (dir) => {
    const { code, out } = aCapstone(dir);
    assert.equal(code, 1, out);
    assert.match(out, /At `HEAD`, line 2 of `notes\/ci setup\.txt` holds what looks like a Claude API key or token\. Treat it as leaked/);
    assert.doesNotMatch(out, /sk-ant-/, 'the check repeats the key');
  });
  // In the workflow, then torn down: HEAD is clean, the commit the workflow
  // item reads isn't.
  withRepo(capstoneRepo({ ci: reviewWith(['${{ secrets.ANTHROPIC_API_KEY }}', MADE_UP_KEY]), teardown: true }), (dir) => {
    const added = git(dir, 'rev-parse', '--short=7', 'HEAD~1');
    const got = String(keyHint(dir));
    assert.match(got, new RegExp(`^In commit ${added}, where the check reads your workflow, line 21 of \`\\.github/workflows/claude-review\\.yml\` holds`));
    assert.doesNotMatch(got, /sk-ant-/);
    assert.doesNotMatch(String(capstoneHint(dir, CI_ITEM)), /sk-ant-/);
  });
  // Several places are counted; the checks' own made-up keys, and text too
  // short to be a key, are not.
  const many = Object.fromEntries([1, 2, 3, 4].map((n) => [`notes/${n}.txt`, `${MADE_UP_KEY}\n`]));
  withRepo(capstoneRepo({ files: many }), (dir) => {
    assert.match(String(keyHint(dir)), /line 1 of `notes\/1\.txt`, line 1 of `notes\/2\.txt`, line 1 of `notes\/3\.txt`, and 1 more hold/);
  });
  withRepo(capstoneRepo({ files: { 'checks/test/keys.test.mjs': `const key = '${MADE_UP_KEY}';\n`, 'notes/prefix.txt': 'Keys start with sk-ant-api03-.\n' } }), (dir) => {
    assert.equal(keyHint(dir), true);
  });
});

test('the Advanced capstone wants the team marketplace and its registration committed, as lesson 6 does', () => {
  withRepo(capstoneRepo({ settings: null }), (dir) => {
    assert.match(String(capstoneHint(dir, /registers that marketplace/)), /There is no committed `\.claude\/settings\.json`/);
  });
  withRepo(capstoneRepo({ settings: { ...TEAM_SETTINGS, extraKnownMarketplaces: { 'team-tools': { source: { source: 'directory', path: '/Users/me/claude-capstone/team-marketplace' } } } } }), (dir) => {
    assert.match(String(capstoneHint(dir, /registers that marketplace/)), /a path on your machine, which a teammate's clone doesn't have/);
  });
  withRepo(capstoneRepo({ after: (dir) => { git(dir, 'rm', '-q', '-r', MARKETPLACE_ROOT); commit(dir, 'Drop the marketplace', []); } }), (dir) => {
    assert.match(String(capstoneHint(dir, /team marketplace lists a plugin/)), /There is no committed `\.claude-plugin\/marketplace\.json`/);
  });
});

test('the Advanced capstone\'s hints point at the brief\'s parts, not at lesson sections the capstone page doesn\'t have', () => {
  const lessonSections = /Worked example|Your turn|as the lesson/;
  withRepo(capstoneRepo({ script: null }), (dir) => {
    const hint = String(capstoneHint(dir, /is committed and executable/));
    assert.equal(hint, 'There is no `scripts/review-staged.sh`. Write it as part 2 of `capstone/advanced-brief.md` describes, then commit it.');
  });
  withRepo(capstoneRepo({ settings: null }), (dir) => {
    const hint = String(capstoneHint(dir, /registers that marketplace/));
    assert.match(hint, /`"enabledPlugins": \{ "team-kit@team-tools": true \}`, as part 3 of `capstone\/advanced-brief\.md` describes, and commit it\.$/);
    assert.doesNotMatch(hint, lessonSections);
  });
  withRepo(capstoneRepo({ after: (dir) => { git(dir, 'rm', '-q', '-r', MARKETPLACE_ROOT); commit(dir, 'Drop the marketplace', []); } }), (dir) => {
    assert.equal(capstoneHint(dir, /team marketplace lists a plugin/), 'There is no committed `.claude-plugin/marketplace.json`. Put a marketplace with one plugin of yours in `team-marketplace/`, as part 3 of `capstone/advanced-brief.md` describes, and commit it.');
  });
  // Every hint of an empty copy.
  withRepo(() => {
    const dir = repo({ '.gitignore': '.practice/\nnode_modules/\n', ...CAPSTONE_START });
    commit(dir, 'Start');
    return dir;
  }, (dir) => {
    const { out } = aCapstone(dir);
    assert.doesNotMatch(out, lessonSections);
  });
  // The lessons keep their own sections.
  withRepo(reviewRepo({ script: null }), (dir) => {
    assert.match(String(a4(dir).out), /Write it as the lesson's Your turn describes/);
  });
  withRepo(shareRepo({ market: null, files: { [`${MARKETPLACE_ROOT}/.claude-plugin`]: null } }), (dir) => {
    assert.match(String(marketHint(dir)), /Download the example marketplace into `team-marketplace\/`, as the Worked example shows, and commit it\.$/);
  });
  withRepo(shareRepo({ settings: null }), (dir) => {
    assert.match(String(settingsHint(dir)), /, as the Worked example shows, and commit it\.$/);
  });
});

test('the Advanced capstone fails while the tests fail or something is left uncommitted', () => {
  const failing = { 'package.json': json({ name: 'linkcheck', private: true, scripts: { test: 'node -e "process.exit(1)"' } }) };
  withRepo(capstoneRepo({ files: failing }), (dir) => {
    assert.match(String(capstoneHint(dir, /^the tests pass$/)), /`npm test` fails/);
  });
  withRepo(capstoneRepo({ after: (dir) => write(dir, { 'src/new.js': '// not committed\n' }) }), (dir) => {
    assert.match(String(capstoneHint(dir, /uncommitted/)), /These changes are uncommitted: src\/new\.js/);
  });
});

test('the Advanced capstone wants the script and CI to run one committed review skill', () => {
  const REVIEW_ITEM = /both run one skill/;
  withRepo(capstoneRepo(), (dir) => {
    assert.equal(capstoneHint(dir, REVIEW_ITEM), true);
  });
  withRepo(capstoneRepo({ script: CAPSTONE_SCRIPT.replace('/team-review', PROMPT) }), (dir) => {
    assert.match(String(capstoneHint(dir, REVIEW_ITEM)), /The `claude -p` prompt in `scripts\/review-staged\.sh` doesn't run a skill, so its review lives only in the script/);
  });
  withRepo(capstoneRepo({ ci: reviewWith(['prompt: /team-review', "prompt: Review this pull request's changes for bugs."]) }), (dir) => {
    assert.match(String(capstoneHint(dir, REVIEW_ITEM)), /The review workflow's `prompt` doesn't run a skill, so CI reviews differently from the script, which runs `\/team-review`/);
  });
  withRepo(capstoneRepo({ ci: reviewWith(['prompt: /team-review', 'prompt: /other-review']) }), (dir) => {
    assert.match(String(capstoneHint(dir, REVIEW_ITEM)), /The script runs `\/team-review` and CI runs `\/other-review`/);
  });
  withRepo(capstoneRepo({ script: CAPSTONE_SCRIPT.replace('/team-review', '/team-kit:review'), ci: reviewWith(['prompt: /team-review', 'prompt: /team-kit:review']) }), (dir) => {
    assert.match(String(capstoneHint(dir, REVIEW_ITEM)), /`\/team-kit:review` is a plugin skill\. A CI checkout was never trusted/);
  });
  withRepo(capstoneRepo({ skill: null }), (dir) => {
    assert.match(String(capstoneHint(dir, REVIEW_ITEM)), /`\/team-review` names no skill committed at `\.claude\/skills\/team-review\/SKILL\.md`/);
  });
  withRepo(capstoneRepo({ script: null }), (dir) => {
    assert.match(String(capstoneHint(dir, REVIEW_ITEM)), /without a committed `scripts\/review-staged\.sh`/);
  });
  withRepo(capstoneRepo({ ci: null }), (dir) => {
    assert.match(String(capstoneHint(dir, REVIEW_ITEM)), /without a committed review workflow/);
  });
});

test('the Advanced capstone wants a new push to cancel the review still running', () => {
  const RUNS_ITEM = /`concurrency` group/;
  const GROUP = 'concurrency:\n  group: review-${{ github.event.pull_request.number }}\n  cancel-in-progress: true\n';
  const none = reviewWith([GROUP, '']);
  withRepo(capstoneRepo(), (dir) => {
    assert.equal(capstoneHint(dir, RUNS_ITEM), true);
  });
  withRepo(capstoneRepo({ ci: none.replace('    runs-on: ubuntu-latest', '    runs-on: ubuntu-latest\n    concurrency: { group: review, cancel-in-progress: true }') }), (dir) => {
    assert.equal(capstoneHint(dir, RUNS_ITEM), true);
  });
  withRepo(capstoneRepo({ ci: none }), (dir) => {
    assert.match(String(capstoneHint(dir, RUNS_ITEM)), /sets no `concurrency`, so five quick pushes start five reviews/);
  });
  withRepo(capstoneRepo({ ci: reviewWith([GROUP, 'concurrency: review\n']) }), (dir) => {
    assert.match(String(capstoneHint(dir, RUNS_ITEM)), /doesn't cancel a review still running: set `cancel-in-progress: true`/);
  });
  withRepo(capstoneRepo({ ci: null }), (dir) => {
    assert.match(String(capstoneHint(dir, RUNS_ITEM)), /without a committed review workflow/);
  });
});

test('the capstone brief names the files the Advanced capstone\'s check reads', () => {
  const brief = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'capstone', 'advanced-brief.md'), 'utf8');
  for (const path of [CAPSTONE_LISTING, CAPSTONE_RUN, SCRIPT, REVIEW_WORKFLOW, 'team-marketplace/', '.claude/workflows/', '.claude/skills/', 'concurrency', 'npm run check -- a-capstone']) {
    assert.ok(brief.includes(path), `the brief doesn't name ${path}`);
  }
  assert.doesNotMatch(brief, /\u2014/, 'the brief has an em dash');
});

test('the Advanced capstone fails on an unsolved repository and passes on a solved one, as the template\'s assertions expect', () => {
  withRepo(() => {
    const dir = repo({ '.gitignore': '.practice/\nnode_modules/\n', ...CAPSTONE_START });
    commit(dir, 'Start');
    return dir;
  }, (dir) => {
    const { code, out } = check(['a-capstone', '--assert', 'fail', '--dir', dir]);
    assert.equal(code, 0, out);
  });
  withRepo(capstoneRepo({ teardown: true }), (dir) => {
    const { code, out } = check(['a-capstone', '--assert', 'pass', '--dir', dir]);
    assert.equal(code, 0, out);
  });
});

test('the history reads never fetch an object a partial clone lacks', () => {
  const source = actionsRepo({ teardown: true, runs: null })();
  const clone = mkdtempSync(join(tmpdir(), 'partial-'));
  // Whether the clone holds `object`, without fetching it.
  const holds = (object, env = { GIT_NO_LAZY_FETCH: '1' }) => {
    try {
      execFileSync('git', ['cat-file', '-e', object], { cwd: clone, env: { ...process.env, ...env }, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };
  try {
    git(source, 'config', 'uploadpack.allowFilter', 'true');
    git(source, 'config', 'uploadpack.allowAnySHA1InWant', 'true');
    const blob = git(source, 'rev-parse', `HEAD~1:${WORKFLOW}`);
    git(clone, 'clone', '-q', '--filter=blob:none', `file://${source}`, '.');
    // A commit the remote has and the clone doesn't.
    git(source, 'checkout', '-q', '-b', 'later');
    const later = commit(source, 'A commit made after the clone');
    write(clone, { [RUNS]: JSON.stringify([runOf(later)]) });
    assert.equal(holds(blob), false, 'the clone already holds the workflow');
    assert.match(String(setupHint(clone)), /There is no committed workflow that runs `anthropics\/claude-code-action`/);
    assert.match(String(runsHint(clone)), new RegExp(`ran on commit ${later.slice(0, 7)}, which this repository doesn't have`));
    assert.equal(holds(blob), false, 'the check fetched the workflow');
    assert.equal(holds(`${later}^{commit}`), false, 'the check fetched the commit');
    // git itself would have fetched both.
    assert.equal(holds(blob, {}), true);
    assert.equal(holds(`${later}^{commit}`, {}), true);
  } finally {
    rmSync(source, { recursive: true, force: true });
    rmSync(clone, { recursive: true, force: true });
  }
});

