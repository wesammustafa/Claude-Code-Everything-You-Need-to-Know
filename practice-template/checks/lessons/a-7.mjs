// Put bounds on autonomous runs (Advanced, lesson 7). The Learner commits
// scripts/bounded-run.sh, which takes a task and a result path and starts
// one `claude -p` run in dontAsk mode, with JSON output, a turn limit, a
// spend limit, --strict-mcp-config (so no `.mcp.json` server starts, even
// one rejected in `.claude/settings.local.json`, which `--setting-sources
// project` leaves out) and a committed settings file passed with
// --settings. That
// file allows only one folder or one command per rule, denies `git commit`
// and `git push`, and turns the sandbox on in strict mode, without
// auto-allow, refusing to start without it. The check runs the committed
// script with a stand-in for `claude`, so it spends no usage; when the
// script never reaches its `claude -p` call there, it reads the call from
// the script's text. It also reads the real slice run the Learner saved,
// whose cost must be under the spend limit. Reviewing the run's diff for
// changes outside the task is self-checked.
import { randomBytes } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { isAbsolute, join, posix, relative, sep } from 'node:path';
import { parseClaudeArgs, ruleList, scriptCalls } from '../claude-args.mjs';
import { committedMode, missingJq } from '../hooks.mjs';
import { commitHint, headText, parseJson } from '../marketplace.mjs';
import { notRun, runStubbed, scratchPath, stderrTail, STUB_SESSION, TIME_LIMIT } from '../stub-claude.mjs';

export const title = 'Put bounds on autonomous runs';

export const SCRIPT = 'scripts/bounded-run.sh';
export const SLICE = '.practice/a-7-slice.json';

const PROJECT = '.claude/settings.json';
const OUT = 'result.json';
const PATH_TOOLS = new Set(['Read', 'Edit', 'Write', 'NotebookEdit', 'MultiEdit', 'Glob', 'Grep']);
const SANDBOX = '`"sandbox": {"enabled": true, "failIfUnavailable": true, "allowUnsandboxedCommands": false, "autoAllowBashIfSandboxed": false}`';
const NARROW = 'Allow one folder or one command per rule, as in `Edit(./src/**)` or `Bash(npm test *)`.';
const AMOUNT = /^(\d+(\.\d*)?|\.\d+)$/;

const code = (text) => `\`${text}\``;
const quoted = (text) => (text.length > 120 ? `${text.slice(0, 120)}...` : text).replace(/\s+/g, ' ').trim();
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const usage = (script) => `\`${script} "<task>" <result.json>\``;
const squash = (flag) => flag.split('=')[0].replace(/^-+/, '').replace(/[-_]/g, '').toLowerCase();

// A sentence for an option Claude Code doesn't know, written like `flag`,
// or ''.
function misspelt(args, flag) {
  const typo = args.unknown.find((u) => squash(u) === squash(flag));
  return typo ? ` Claude Code doesn't know ${code(typo.split('=')[0])}, so it stops with an error before the run starts: write ${code(flag)}.` : '';
}

// The note for a committed file whose working copy differs, or ''.
function pending(repo, path) {
  try {
    repo.git('diff', '--quiet', 'HEAD', '--', path);
    return '';
  } catch {
    return ` Your copy of ${code(path)} has changes that aren't committed: if they fix this, commit them.`;
  }
}

// Up to three problems, then how many more, then the notes.
function report(problems, notes = '') {
  const more = problems.length > 3 ? ` And ${problems.length - 3} more: fix these and run the check again.` : '';
  return `${problems.slice(0, 3).join(' ')}${more}${notes}`;
}

const exitOf = (run) => run.status ?? run.signal;

// How a run ended, for a hint.
function ended(run) {
  if (run.timedOut) return `It was still running after ${TIME_LIMIT / 1000} seconds, so the check stopped it.`;
  if (missingJq(run)) return 'It needs `jq`, which isn\'t installed: install it and run the check again.';
  const tail = stderrTail(run);
  return `It exited with ${exitOf(run)}${tail ? `: ${tail}` : '.'}`;
}

// A path written in the script, relative to the Learner's repository, or
// null when it points outside it. Used for calls read from the text, which
// the check assumes run from the repository's root.
function inRepo(repo, path) {
  const roots = [repo.dir];
  try {
    roots.push(realpathSync(repo.dir));
  } catch {
    // The folder's own path is enough.
  }
  const target = isAbsolute(path) ? path : join(repo.dir, path);
  for (const root of roots) {
    const rel = relative(root, target);
    if (!isAbsolute(rel) && rel.split(sep)[0] !== '..') return rel.split(sep).join('/');
  }
  return null;
}

// The committed files the script may read before it calls `claude`: the
// JSON files in .claude/, and any file a `--settings` in its text names.
function companions(repo, text) {
  let listed = [];
  try {
    listed = repo.git('ls-tree', '-r', '-z', '--name-only', 'HEAD', '--', '.claude').split('\0');
  } catch {
    // Nothing is committed yet.
  }
  const named = scriptCalls(text ?? '')
    .map((argv) => parseClaudeArgs(argv).flags.settings)
    .filter((v) => typeof v === 'string' && v && !v.includes('$') && !v.trim().startsWith('{') && !isAbsolute(v))
    .map((v) => posix.normalize(v));
  const files = {};
  for (const path of [...listed.filter((p) => p.endsWith('.json') && !p.startsWith('.claude/worktrees/')), ...named]) {
    if (path.startsWith('..') || files[path] !== undefined) continue;
    const content = headText(repo, path);
    if (content !== null) files[path] = `${content}\n`;
  }
  return files;
}

// What the items read about the script, once per repository: the stand-in
// run with a task and a result path; its `claude -p` calls, or, when it
// made none, the calls in the committed text.
const cache = new WeakMap();

function analysis(repo, script) {
  if (!cache.has(repo)) cache.set(repo, new Map());
  const runs = cache.get(repo);
  if (!runs.has(script)) runs.set(script, analyze(repo, script));
  return runs.get(script);
}

function analyze(repo, script) {
  const id = randomBytes(6).toString('hex');
  const task = `Add a test for one function (STUB-TASK-${id}), then run the tests.`;
  const text = headText(repo, script);
  const run = runStubbed(repo, script, {
    args: (out) => [task, join(out, OUT)],
    commit: { 'README.md': '# Scratch repository for the practice check\n', 'src/example.js': 'export const answer = 42;\n', ...companions(repo, text) },
    reply: { type: 'result', subtype: 'success', is_error: false, num_turns: 1, result: `STUB-RESULT-${id}`, session_id: STUB_SESSION, total_cost_usd: 0, permission_denials: [] },
  });
  const made = (run.calls ?? []).map((c) => ({ ...c, args: parseClaudeArgs(c.argv), where: (path) => scratchPath(run, c, path) }));
  const print = made.filter((c) => c.args.print);
  const stray = made.filter((c) => !c.args.print && !c.args.flags.version && !c.args.flags.help);
  const written = print.length || text === null ? [] : scriptCalls(text)
    .map((argv) => ({ argv, args: parseClaudeArgs(argv), where: (path) => inRepo(repo, path), fromText: true }))
    .filter((c) => c.args.print);
  return { run, task, print, stray, calls: print.length ? print : written };
}

// The hint when the check has no `claude -p` call to read, or null.
function noCall(repo, a, script) {
  if (a.calls.length) return null;
  const skipped = notRun(a.run, script);
  if (skipped) return skipped;
  return `Run as ${usage(script)}, ${code(script)} never ran \`claude -p\`, and the check found no \`claude -p\` call in its text. ${ended(a.run)}${pending(repo, script)}`;
}

// The settings a call passes with --settings: `{ value, path, label }`, or
// `{ hint }` when the check can't read them; `none` when there is no flag.
const loaded = new WeakMap();

function settingsOf(repo, call) {
  if (!loaded.has(call)) loaded.set(call, loadSettings(repo, call));
  return loaded.get(call);
}

function loadSettings(repo, call) {
  const raw = call.args.flags.settings;
  const example = 'such as `--settings .claude/bounded-run.json`';
  if (raw === undefined) return { none: true, hint: `It passes no settings file: add \`--settings\` with the committed file that holds the bounds, ${example}.${misspelt(call.args, '--settings')}` };
  if (raw === null || !raw.trim()) return { hint: `\`--settings\` has no file after it: name the committed file that holds the bounds, ${example}.` };
  if (raw.trim().startsWith('{')) {
    try {
      const value = JSON.parse(raw);
      return isObject(value) ? { value, label: 'the inline `--settings` JSON' } : { hint: 'The inline `--settings` JSON isn\'t an object.' };
    } catch (error) {
      return { hint: `The inline \`--settings\` JSON isn't valid JSON: ${error.message}` };
    }
  }
  if (call.fromText && raw.includes('$')) return { hint: `\`--settings ${raw}\` gets its file from a variable the check can't work out: write the path in the script, ${example}.` };
  const path = call.where(raw);
  if (path === null || path === '') return { hint: `\`--settings\` names ${code(raw)}, which is outside your repository. Pass a file committed in it, ${example}.` };
  const text = headText(repo, path);
  if (text === null) {
    return { hint: repo.exists(path) ? `${commitHint(repo, path)} The run reads its bounds from that file.` : `\`--settings\` names ${code(path)}, which doesn't exist. Save the bounds there, as the lesson shows, and commit the file.` };
  }
  const { value, error } = parseJson(text);
  if (error) return { hint: `The committed ${code(path)} isn't valid JSON: ${error}${pending(repo, path)}` };
  if (!isObject(value)) return { hint: `The committed ${code(path)} isn't a JSON object.${pending(repo, path)}` };
  return { value, path, label: code(path) };
}

// What is wrong with one call's mode, output and settings file, for item 1.
function callProblems(repo, call) {
  const { flags } = call.args;
  const problems = [];
  const spelling = (flag) => misspelt(call.args, flag);
  const mode = flags.permissionMode;
  if (flags.dangerouslySkipPermissions) problems.push('Drop `--dangerously-skip-permissions`: it is the same as `--permission-mode bypassPermissions`, which skips your permission checks.');
  if (flags.allowDangerouslySkipPermissions) problems.push('Drop `--allow-dangerously-skip-permissions`: a bounded run never switches to `bypassPermissions`.');
  if (mode === undefined) problems.push(`It sets no permission mode: add \`--permission-mode dontAsk\`, so every call that would ask for permission is denied.${spelling('--permission-mode')}`);
  else if (mode === null) problems.push('`--permission-mode` has no mode after it: write `--permission-mode dontAsk`.');
  else if (mode.startsWith('-')) problems.push(`\`--permission-mode\` has no mode after it, so it takes ${code(mode)} as its value: write \`--permission-mode dontAsk\`.`);
  else if (mode.toLowerCase() === 'dontask' && mode !== 'dontAsk') problems.push(`Write \`dontAsk\` as Claude Code spells it, not ${code(mode)}.`);
  else if (mode !== 'dontAsk') problems.push(`It runs in ${code(mode)} mode: use \`--permission-mode dontAsk\`, so every call that would ask for permission is denied.`);

  const format = flags.outputFormat;
  if (format === undefined) problems.push(`It doesn't ask for JSON: add \`--output-format json\`.${spelling('--output-format')}`);
  else if (format === null) problems.push('`--output-format` has no format after it: write `--output-format json`.');
  else if (format.startsWith('-')) problems.push(`\`--output-format\` has no format after it, so it takes ${code(format)} as its value: write \`--output-format json\`.`);
  else if (format !== 'json') problems.push(`It asks for \`--output-format ${format}\`: use \`json\`, so the result path holds the run's result as one JSON object.`);

  if (!flags.strictMcpConfig) problems.push(`It doesn't keep the project's MCP servers out: add \`--strict-mcp-config\`, so the run starts no server you didn't pass with \`--mcp-config\`.${spelling('--strict-mcp-config')}`);

  const settings = settingsOf(repo, call);
  if (settings.hint) problems.push(settings.hint);
  return problems;
}

// Whether the task reached the call as its prompt, and where it went if not.
function taskProblems(a, call) {
  if (call.args.prompt?.includes(a.task) || call.stdin.includes(a.task)) return [];
  if (call.args.operands.join(' ').includes(a.task)) return ['It passes the task without quotes, so the shell splits it into words and Claude gets only the first. Write `"$1"`, in double quotes.'];
  const flag = Object.entries(call.args.flags).find(([, v]) => [v].flat().some((x) => typeof x === 'string' && x.includes(a.task)));
  if (flag) return [`The task ends up in the value of \`--${flag[0].replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`)}\`, not in the prompt. Write the prompt right after \`-p\`, as in \`claude -p "$1" ...\`.`];
  return ['The task in its first argument never reaches `claude -p`. Pass it as the prompt, right after `-p`, as in `claude -p "$1" ...`.'];
}

const isStubJson = (text) => {
  try {
    return JSON.parse(text)?.session_id === STUB_SESSION;
  } catch {
    return false;
  }
};

function savedProblems(a) {
  const saved = a.run.saved[`out/${OUT}`];
  const save = 'Redirect only its standard output to the path in the second argument: `claude -p "$1" ... > "$2"`.';
  if (saved === undefined) {
    const elsewhere = Object.keys(a.run.saved).find((p) => isStubJson(a.run.saved[p]));
    return [elsewhere ? `It saved the JSON \`claude -p\` printed to ${code(elsewhere)}, not to the path in its second argument. ${save}` : `It didn't save the JSON \`claude -p\` printed to the path in its second argument. ${save}`];
  }
  return isStubJson(saved) ? [] : [`The file at the path in its second argument isn't the JSON \`claude -p\` printed. ${save}`];
}

function modeHint(repo, script) {
  const mode = committedMode(repo, script);
  if (mode === null) return repo.exists(script) ? commitHint(repo, script) : `There is no ${code(script)}. Write it as the lesson shows, then commit it.`;
  if (mode === '100755') return null;
  if (mode === '100644') return `${code(script)} isn't executable. Run \`chmod +x ${script}\`, then \`git add ${script}\` and commit. On Windows, run \`git update-index --chmod=+x ${script}\` and commit.`;
  return `${code(script)} is committed as ${mode === '120000' ? 'a symbolic link' : 'something other than a file'}. Commit the script file itself, and make it executable.`;
}

export function boundedScript(script = SCRIPT) {
  return {
    text: `${code(script)} is committed and executable, takes a task and a result path, and starts \`claude -p\` in \`dontAsk\` mode with JSON output, no MCP server and a committed \`--settings\` file`,
    check(repo) {
      const mode = modeHint(repo, script);
      if (mode) return mode;
      const a = analysis(repo, script);
      const skipped = notRun(a.run, script);
      if (skipped) return skipped;
      if (!a.print.length) {
        const why = a.stray.length
          ? 'ran `claude` without `-p` (or `--print`), which starts an interactive session and waits for you. Add `-p`, with the task right after it.'
          : `never ran \`claude -p\`. ${ended(a.run)}`;
        return `Run as ${usage(script)}, ${code(script)} ${why}${pending(repo, script)}`;
      }
      const problems = [];
      if (a.print.length > 1) problems.push(`With one task, it ran \`claude -p\` ${a.print.length} times. Run it once.`);
      if (a.stray.length) problems.push('It also ran `claude` without `-p`, which starts an interactive session and waits for you. Run only the `claude -p` call.');
      problems.push(...taskProblems(a, a.print[0]), ...savedProblems(a));
      problems.push(...new Set(a.print.flatMap((c) => callProblems(repo, c))));
      return problems.length ? report(problems, pending(repo, script)) : true;
    },
  };
}

// What is wrong with one call's turn and spend limits.
function limitProblems(call) {
  const { flags } = call.args;
  const problems = [];
  const spelling = (flag) => misspelt(call.args, flag);
  const variable = (flag, value) => `\`${flag} ${value}\` gets its value from a variable the check can't work out: write the number in the script.`;
  const option = (value) => /^--?[A-Za-z]/.test(value);
  const taken = (flag, value, what) => `\`${flag}\` has no ${what} after it, so it takes ${code(value)} as its value: write ${what === 'number' ? 'a whole number of 1 or more' : 'an amount in US dollars, above 0'}.`;

  const turns = flags.maxTurns;
  if (turns === undefined) problems.push(`It sets no turn limit: add \`--max-turns\` with a whole number of 1 or more.${spelling('--max-turns')}`);
  else if (turns === null || !turns.trim()) problems.push('`--max-turns` has no number after it: write a whole number of 1 or more.');
  else if (option(turns)) problems.push(taken('--max-turns', turns, 'number'));
  else if (call.fromText && turns.includes('$')) problems.push(variable('--max-turns', turns));
  else if (!/^\d+$/.test(turns)) problems.push(`\`--max-turns ${turns}\` isn't a whole number: write one of 1 or more.`);
  else if (Number(turns) < 1) problems.push(`\`--max-turns ${turns}\` is below 1: write a whole number of 1 or more.`);

  const budget = flags.maxBudgetUsd;
  if (budget === undefined) problems.push(`It sets no spend limit: add \`--max-budget-usd\` with an amount in US dollars, above what a slice of the task costs.${spelling('--max-budget-usd')}`);
  else if (budget === null || !budget.trim()) problems.push('`--max-budget-usd` has no amount after it: write an amount in US dollars, above 0.');
  else if (option(budget)) problems.push(taken('--max-budget-usd', budget, 'amount'));
  else if (call.fromText && budget.includes('$')) problems.push(variable('--max-budget-usd', budget));
  else if (!AMOUNT.test(budget)) problems.push(`\`--max-budget-usd ${budget}\` isn't an amount: write a number of US dollars, without a \`$\` sign.`);
  else if (Number(budget) <= 0) problems.push(`\`--max-budget-usd ${budget}\` isn't above 0: write an amount in US dollars, above what a slice of the task costs.`);
  return problems;
}

export function runLimits(script = SCRIPT) {
  return {
    text: 'it sets a turn limit and a spend limit',
    check(repo) {
      const a = analysis(repo, script);
      const none = noCall(repo, a, script);
      if (none) return none;
      const problems = [...new Set(a.calls.flatMap(limitProblems))];
      return problems.length ? report(problems, pending(repo, script)) : true;
    },
  };
}

// The spend limit the script passes, as a number, or null.
function budgetOf(a) {
  const budget = a.calls[0]?.args.flags.maxBudgetUsd;
  return typeof budget === 'string' && AMOUNT.test(budget) && Number(budget) > 0 ? Number(budget) : null;
}

// Why an allow rule is wider than one folder or one command, or null.
export function wideReason(rule) {
  const m = rule.trim().match(/^([^()\s]+)(?:\(([\s\S]*)\))?$/);
  if (!m) return null;
  const [, tool, spec] = m;
  if (tool.includes('*')) return 'matches every tool whose name fits it';
  if (tool.startsWith('mcp__')) return spec === undefined && tool.split('__').filter(Boolean).length < 3 ? 'lets every tool of that MCP server through' : null;
  const all = spec === undefined || /^\*+$/.test(spec.trim());
  if (tool === 'Bash') {
    if (all) return 'lets every command through';
    const s = spec.trim();
    if (s.startsWith('*')) return 'starts with a wildcard, so it matches commands of every program';
    const program = s.match(/^([^\s*:]+)(?:\s+\*|:\*|\*)$/);
    return program ? `lets every \`${program[1]}\` command through, whatever its arguments` : null;
  }
  if (PATH_TOOLS.has(tool)) {
    const verb = ['Read', 'Glob', 'Grep'].includes(tool) ? 'read' : 'edit';
    if (all) return `lets the run ${verb} any file`;
    const s = spec.trim();
    const anchor = s.match(/^(\/\/|~\/|\.\/|\/)?/)[1] ?? '';
    const first = s.slice(anchor.length).split('/')[0];
    if (first && !first.includes('*') && first !== '.' && first !== '..') return null;
    if (first === '..') return `lets the run ${verb} files outside the project`;
    if (anchor === '//') return `lets the run ${verb} files anywhere on the disk`;
    if (anchor === '~/') return `lets the run ${verb} files anywhere in your home folder`;
    return `lets the run ${verb} files in every folder of the project`;
  }
  if (all) return `lets every use of \`${tool}\` through`;
  if (tool === 'WebFetch' && spec.trim() === 'domain:*') return 'lets the run fetch from every domain';
  return null;
}

// The git command an allow rule lets through, `commit` or `push`, or null.
function gitWrite(rule) {
  const m = rule.trim().match(/^Bash\(([\s\S]*)\)$/);
  return m?.[1].match(/(?:^|[\s;&|(])git\s+(?:-\S+\s+)*(commit|push)\b/)?.[1] ?? null;
}

// Whether a deny rule stops `command` with any arguments, and the bare
// command too: a bare `Bash`, `Bash(*)`, or one trailing wildcard after a
// prefix of it, as in `Bash(git push *)`, `Bash(git push:*)` or `Bash(git *)`.
// A rule with no wildcard, such as `Bash(git push)`, matches only the bare
// command.
export function stops(rule, command) {
  const r = rule.trim();
  if (r === 'Bash' || r === '*') return true;
  const m = r.match(/^Bash\(([\s\S]*)\)$/);
  if (!m) return false;
  const spec = m[1];
  if (/^\s*\*+\s*$/.test(spec)) return true;
  if ((spec.match(/\*/g) ?? []).length !== 1 || !spec.endsWith('*')) return false;
  const words = spec.match(/^(.*?)(?: \*|:\*)$/);
  if (words) return command === words[1] || command.startsWith(`${words[1]} `);
  return command.startsWith(spec.slice(0, -1));
}

// The rules of a settings object, as `{ rule, label }`.
function rulesOf(value, key, label) {
  const list = value?.permissions?.[key];
  return Array.isArray(list) ? list.filter((r) => typeof r === 'string' && r.trim()).map((rule) => ({ rule: rule.trim(), label })) : [];
}

// Whether the call loads the project's settings files: it does unless
// `--setting-sources` leaves `project` out.
function loadsProject(call) {
  const sources = call.args.flags.settingSources;
  return typeof sources !== 'string' || sources.split(',').map((s) => s.trim()).includes('project');
}

function projectSettings(repo) {
  const text = headText(repo, PROJECT);
  if (text === null) return {};
  const { value, error } = parseJson(text);
  if (error) return { hint: `The committed ${code(PROJECT)} isn't valid JSON: ${error}` };
  return isObject(value) ? { value } : { hint: `The committed ${code(PROJECT)} isn't a JSON object.` };
}

function ruleProblems(repo, call) {
  const settings = settingsOf(repo, call);
  if (settings.hint && !settings.none) return [settings.hint];
  const { allowedTools, disallowedTools } = call.args.flags;
  const allow = ruleList(allowedTools ?? []).map((rule) => ({ rule, label: '`--allowedTools`' }));
  const deny = ruleList(disallowedTools ?? []).map((rule) => ({ rule, label: '`--disallowedTools`' }));
  if (settings.value) {
    allow.push(...rulesOf(settings.value, 'allow', settings.label));
    deny.push(...rulesOf(settings.value, 'deny', settings.label));
  }
  // Only the run's own rules count here: a `-p` run in a folder you never
  // trusted leaves out the allow rules in .claude/settings.json.
  const own = allow.length;
  if (loadsProject(call) && settings.path !== PROJECT) {
    const project = projectSettings(repo);
    if (project.hint) return [project.hint];
    allow.push(...rulesOf(project.value, 'allow', code(PROJECT)));
    deny.push(...rulesOf(project.value, 'deny', code(PROJECT)));
  }

  const problems = [];
  const writes = allow.filter((a) => gitWrite(a.rule));
  for (const { rule, label } of writes.slice(0, 2)) problems.push(`${code(rule)} in ${label} lets the run use \`git ${gitWrite(rule)}\`. Take it out: the deny rules must stop it.`);
  const wide = allow.filter((a) => !gitWrite(a.rule)).map((a) => ({ ...a, why: wideReason(a.rule) })).filter((a) => a.why);
  for (const { rule, label, why } of wide.slice(0, 3)) problems.push(`${code(rule)} in ${label} ${why}.`);
  if (wide.length > 3) problems.push(`And ${wide.length - 3} more rules like these.`);
  if (wide.length) problems.push(NARROW);
  if (!own) problems.push(`Nothing the run is given allows a single call, so in \`dontAsk\` mode it can't edit a file or run your tests. In the bounds file's \`permissions.allow\`, allow the folders the task edits and its one command, as in \`"Edit(./src/**)"\` and \`"Bash(npm test *)"\`.`);

  for (const command of ['git commit', 'git push']) {
    if (deny.some((d) => stops(d.rule, command))) continue;
    const exact = deny.find((d) => d.rule.replace(/\s+/g, ' ') === `Bash(${command})`);
    problems.push(exact
      ? `${code(exact.rule)} in ${exact.label} matches only the bare \`${command}\`, not \`${command} ${command.endsWith('push') ? 'origin main' : '-m "..."'}\`. Write \`Bash(${command} *)\`: the trailing \` *\` also matches the bare command.`
      : `No deny rule stops \`${command}\`: add \`"Bash(${command} *)"\` to \`permissions.deny\` in the settings file.`);
  }
  const notes = settings.path ? pending(repo, settings.path) : '';
  return problems.length && notes ? [...problems, notes.trim()] : problems;
}

export function narrowRules(script = SCRIPT) {
  return {
    text: 'every allow rule names one command or one folder, and the deny rules stop `git commit` and `git push`',
    check(repo) {
      const a = analysis(repo, script);
      const none = noCall(repo, a, script);
      if (none) return none;
      const problems = [...new Set(a.calls.flatMap((c) => ruleProblems(repo, c)))];
      return problems.length ? problems.join(' ') : true;
    },
  };
}

function sandboxProblems(repo, call) {
  const settings = settingsOf(repo, call);
  if (settings.none) return [`The run gets no settings file, so nothing turns the sandbox on: pass the bounds file with \`--settings\`, and put ${SANDBOX} in it.`];
  if (settings.hint) return [settings.hint];
  const box = settings.value.sandbox;
  const notes = settings.path ? pending(repo, settings.path) : '';
  if (!isObject(box)) return [`${settings.label[0].toUpperCase()}${settings.label.slice(1)} has no \`sandbox\` settings. Add ${SANDBOX}.${notes}`];
  const problems = [];
  if (box.enabled !== true) problems.push('Set `"enabled": true` under `sandbox`: the sandbox is off unless a settings file turns it on.');
  if (box.failIfUnavailable !== true) problems.push('Set `"failIfUnavailable": true`: without it, a run whose sandbox can\'t start runs commands unsandboxed.');
  if (box.allowUnsandboxedCommands !== false) problems.push('Set `"allowUnsandboxedCommands": false`: without it, Claude can retry a command the sandbox blocked outside the sandbox.');
  if (box.autoAllowBashIfSandboxed !== false) problems.push('Set `"autoAllowBashIfSandboxed": false`: without it, sandboxed commands run without your allow rules or permission mode deciding, and only deny rules can stop one.');
  if (!problems.length) return [];
  return [`In ${settings.label}: ${problems.join(' ')}${notes}`];
}

export function strictSandbox(script = SCRIPT) {
  return {
    text: 'the settings file turns the sandbox on in strict mode without auto-allow, and makes the run refuse to start without it',
    check(repo) {
      const a = analysis(repo, script);
      const none = noCall(repo, a, script);
      if (none) return none;
      const problems = [...new Set(a.calls.flatMap((c) => sandboxProblems(repo, c)))];
      return problems.length ? problems.join(' ') : true;
    },
  };
}

// A saved run: the JSON `claude -p --output-format json` prints, or, from
// `--output-format stream-json`, the last result among its lines. Returns
// `{ value }`, or `{ missing }`, `{ text }` (not JSON) or `{ noResult }`.
function savedResult(repo, path) {
  const text = repo.read(path);
  if (text === null || !text.trim()) return { missing: true };
  try {
    return { value: JSON.parse(text) };
  } catch {
    // Not one JSON value: it may be stream-json, one JSON object per line.
  }
  const lines = text.split(/\r?\n/).filter((line) => line.trim()).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      return undefined;
    }
  });
  if (lines.length < 2 || !lines.some((v) => isObject(v))) return { text: true };
  const results = lines.filter((v) => v?.type === 'result');
  return results.length ? { value: results.at(-1) } : { noResult: true };
}

// The hint for a saved run that isn't a real run's result, or null.
function resultHint(saved, path, again) {
  if (saved.text) return `${code(path)} isn't JSON. Save only what \`claude -p --output-format json\` prints to its standard output there. ${again}`;
  if (saved.noResult) return `${code(path)} holds no result: the run didn't finish. ${again}`;
  if (saved.value?.type !== 'result') return `${code(path)} isn't the result of a \`claude -p\` run with \`--output-format json\`. ${again}`;
  if (saved.value.session_id === STUB_SESSION) return `${code(path)} holds the check's stand-in reply, not a real run: your script saved it there while the check ran it. Save the JSON only where the script's second argument says. ${again}`;
  return null;
}

export function sliceRun(record = SLICE, script = SCRIPT) {
  const again = 'Then run the slice again.';
  return {
    text: `${code(record)} holds a slice run whose cost is under your spend limit`,
    local: true,
    check(repo) {
      const saved = savedResult(repo, record);
      if (saved.missing) return `There is no ${code(record)} yet: run your script on a slice of the task, as the lesson's Worked example does: \`${script} "<a small part of the task>" ${record}\`.`;
      const wrong = resultHint(saved, record, again);
      if (wrong) return wrong;
      const run = saved.value;
      if (run.subtype === 'error_max_budget_usd') return `The slice stopped at your spend limit (\`error_max_budget_usd\`), so the limit is below what one slice costs. Raise \`--max-budget-usd\` in ${code(script)} and commit it. ${again}`;
      if (run.subtype === 'error_max_turns') return `The slice stopped at your turn limit (\`error_max_turns\`) before it finished. Raise \`--max-turns\` in ${code(script)}, or give it a smaller slice. ${again}`;
      if (run.subtype !== 'success') return `The slice ended with ${code(String(run.subtype))}, not \`success\`, so it doesn't show what a whole slice costs. ${again}`;
      if (run.is_error === true) return `The slice run failed${typeof run.result === 'string' && run.result.trim() ? `: "${quoted(run.result)}"` : ''}. Fix what it says. ${again}`;
      if (typeof run.total_cost_usd !== 'number' || !Number.isFinite(run.total_cost_usd) || run.total_cost_usd < 0) return `The run in ${code(record)} has no cost estimate in \`total_cost_usd\`, which is what the slice is for. Save the JSON \`claude -p\` prints unchanged. ${again}`;
      if (!Number.isInteger(run.num_turns)) return `The run in ${code(record)} has no turn count in \`num_turns\`, so it isn't the JSON \`claude -p\` saves. ${again}`;
      const budget = budgetOf(analysis(repo, script));
      if (budget === null) return `The check can't read a spend limit from ${code(script)} (see the second item), so it can't compare the slice's cost with it.`;
      if (run.total_cost_usd >= budget) return `The slice cost an estimated $${run.total_cost_usd} (\`total_cost_usd\`), and your spend limit, \`--max-budget-usd ${budget}\`, isn't above it. Set the limit above what the slice cost, scaled to the whole task, and commit ${code(script)}.`;
      return true;
    },
  };
}

export const items = [boundedScript(), runLimits(), narrowRules(), strictSandbox(), sliceRun()];
