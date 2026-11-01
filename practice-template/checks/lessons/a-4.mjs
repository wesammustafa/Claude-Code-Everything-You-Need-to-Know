// @ts-check
// Script Claude Code with `claude -p` (Advanced, lesson 4). The Learner
// commits scripts/review-staged.sh, which pipes the staged diff into one
// `claude -p` call that asks for JSON, runs in dontAsk mode, pre-approves
// only Read, Grep and Glob, restricts the tools to those three with
// --tools, turns hooks off with --settings '{"disableAllHooks": true}',
// starts no MCP server with --strict-mcp-config and caps its turns (a
// tool --allowedTools doesn't name still runs when a project rule approves
// it, and a project's Stop hook can send the run back to work); saves the
// JSON to the path in
// its first argument, or .practice/a-4-result.json without one; prints the
// review; and exits non-zero when the run fails or nothing is staged. The
// check runs the committed script with a stand-in for `claude`, so it
// spends no usage, and reads the result of one real run the Learner saved.
// Seeing a run stop at the turn cap is self-checked. The Advanced capstone
// reuses these items with its own result file.
import { randomBytes } from 'node:crypto';
import { join, posix } from 'node:path';
import { parseClaudeArgs, ruleList } from '../claude-args.mjs';
import { committedMode, missingJq } from '../hooks.mjs';
import { notRun, runStubbed, stderrTail, STUB_SESSION, TIME_LIMIT } from '../stub-claude.mjs';
/** @import { Ran, Stubbed, Call as StubClaudeCall } from '../stub-claude.mjs' */
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Script Claude Code with `claude -p`';

export const SCRIPT = 'scripts/review-staged.sh';
export const RESULT = '.practice/a-4-result.json';
export const CAP_MAX = 10;

const JQ = 'The script needs `jq`, which isn\'t installed. Install it and run the check again.';
const OUT = 'review.json';
const READ_ONLY = /^(Read|Grep|Glob)(\(.*\))?$/s;
const TOOL_NAME = /^(?:[A-Z]\w*|mcp__\S+|\*)(\(.*\))?$/s;

const and = (/** @type {unknown[]} */ list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0]);
const code = (/** @type {string} */ text) => `\`${text}\``;
const quoted = (/** @type {string} */ text) => (text.length > 120 ? `${text.slice(0, 120)}...` : text).replace(/\s+/g, ' ').trim();

// What the scratch repository holds, and what the stand-in answers, in each
// run: a review of a staged change; the same without an argument, in a
// repository without `.practice/`, as a fresh copy is; `claude`
// exiting non-zero with an error on stderr and no JSON, as it does for a
// flag it can't read; JSON that says the run failed while `claude` exits 0;
// and nothing staged. The two failures test the script's two exit rules
// apart. Every run but the last has a staged change, and every run a change
// that isn't staged.
/**
 * @typedef {{ review: string, staged: string, unstaged: string }} Markers
 * @typedef {{ stage: boolean, practice?: boolean, args: (out: string) => string[], reply: (m: Markers) => object | null, stderr?: string, exit?: number }} Scenario
 */

/** @type {Record<string, Scenario>} */
const SCENARIOS = {
  review: { stage: true, args: (out) => [join(out, OUT)], reply: (m) => ({ subtype: 'success', is_error: false, result: m.review, num_turns: 1 }) },
  noArgument: { stage: true, practice: false, args: () => [], reply: (m) => ({ subtype: 'success', is_error: false, result: m.review, num_turns: 1 }) },
  failed: { stage: true, args: (out) => [join(out, OUT)], reply: () => null, stderr: 'error: the stand-in for claude failed before the run', exit: 1 },
  isError: { stage: true, args: (out) => [join(out, OUT)], reply: () => ({ subtype: 'success', is_error: true, result: 'The stand-in reports a failed run.', num_turns: 1 }) },
  nothingStaged: { stage: false, args: (out) => [join(out, OUT)], reply: (m) => ({ subtype: 'success', is_error: false, result: m.review, num_turns: 1 }) },
};

// The most stand-in runs one script gets in one check: one a scenario, kept
// for the items that share it (scenario).
export const STUB_RUNS = Object.keys(SCENARIOS).length;

const README = '# Scratch repository for the practice check\n';
const SOURCE = 'export const answer = 42;\n';

/** @param {string} name */
function plan(name) {
  const id = randomBytes(6).toString('hex');
  // No marker holds another, so each shows on its own.
  const m = { staged: `change-in-the-index-${id}`, unstaged: `change-not-added-${id}`, review: `STUB-REVIEW-${id}` };
  const s = /** @type {Scenario} */ (SCENARIOS[name]);
  return {
    markers: m,
    options: {
      args: s.args,
      commit: { 'README.md': README, 'src/example.js': SOURCE },
      stage: s.stage ? { 'src/example.js': `${SOURCE}// ${m.staged}\n` } : {},
      change: { 'README.md': `${README}\n${m.unstaged}\n` },
      reply: s.reply(m) && { type: 'result', session_id: STUB_SESSION, total_cost_usd: 0, permission_denials: [], ...s.reply(m) },
      stderr: s.stderr,
      exit: s.exit ?? 0,
      practice: s.practice ?? true,
    },
  };
}

// Each repository's runs, by script and scenario, so the items share them.
/**
 * A stand-in run with its calls read: callers pass it to notRun first, and
 * read the rest only when that finds nothing.
 * @typedef {Ran & Stubbed & { markers: Markers, print: Call[], stray: Call[] }} ScenarioRun
 * @typedef {StubClaudeCall & { args: ReturnType<typeof parseClaudeArgs> }} Call
 */

/** @type {WeakMap<Repo, Map<string, ScenarioRun>>} */
const cache = new WeakMap();

/**
 * @param {Repo} repo
 * @param {string} script
 * @param {string} name
 * @returns {ScenarioRun}
 */
function scenario(repo, script, name) {
  if (!cache.has(repo)) cache.set(repo, new Map());
  const runs = /** @type {Map<string, ScenarioRun>} */ (cache.get(repo));
  const key = `${script}\n${name}`;
  if (!runs.has(key)) {
    const { markers, options } = plan(name);
    const run = /** @type {ScenarioRun} */ (runStubbed(repo, script, options));
    const parsed = (run.calls ?? []).map((c) => ({ ...c, args: parseClaudeArgs(c.argv) }));
    run.markers = markers;
    run.print = parsed.filter((c) => c.args.print);
    // Calls without -p, apart from `claude --version` and `claude --help`.
    run.stray = parsed.filter((c) => !c.args.print && !c.args.flags.version && !c.args.flags.help);
    runs.set(key, run);
  }
  return /** @type {ScenarioRun} */ (runs.get(key));
}

/**
 * @param {Repo} repo
 * @param {string} script
 */
function pending(repo, script) {
  try {
    repo.git('diff', '--quiet', 'HEAD', '--', script);
    return '';
  } catch {
    return ` Your copy of ${code(script)} has changes that aren't committed: if they fix this, commit them.`;
  }
}

// A run's exit code, or the signal that ended it.
const exitOf = (/** @type {ScenarioRun} */ run) => run.status ?? run.signal;

const timedOut = `was still running after ${TIME_LIMIT / 1000} seconds, so the check stopped it`;

// How a run ended, for a hint.
/** @param {ScenarioRun} run */
function ended(run) {
  if (run.timedOut) return `It ${timedOut}.`;
  if (missingJq(run)) return JQ;
  const tail = stderrTail(run);
  return `It exited with ${exitOf(run)}${tail ? `: ${tail}` : '.'}`;
}

// The turn cap the script passes, or CAP_MAX when the check can't tell.
/**
 * @param {Repo} repo
 * @param {string} script
 */
function capOf(repo, script) {
  const value = scenario(repo, script, 'review').print?.[0]?.args.flags.maxTurns;
  return /^\d+$/.test(value ?? '') && Number(value) >= 1 ? Number(value) : CAP_MAX;
}

const squash = (/** @type {string} */ flag) => /** @type {string} */ (flag.split('=')[0]).replace(/^-+/, '').replace(/[-_]/g, '').toLowerCase();

// What's wrong with the arguments of one `claude -p` call, as sentences;
// none when nothing is.
/** @param {string[]} argv */
export function callHints(argv) {
  const args = parseClaudeArgs(argv);
  /** @type {string[]} */
  const problems = [];
  // An option Claude Code doesn't know, written like one the call needs.
  const spelling = (/** @type {string} */ flag) => {
    const typo = args.unknown.find((u) => squash(u) === squash(flag));
    return typo ? ` Claude Code doesn't know ${code(/** @type {string} */ (typo.split('=')[0]))}, so it stops with an error before the run starts: write ${code(flag)}.` : '';
  };
  const example = 'as in `claude -p "<prompt>" --output-format json ...`';
  if (!args.promptFirst) {
    problems.push(args.next === undefined
      ? `Nothing follows \`-p\`. Write the prompt right after it, ${example}.`
      : `${code(args.next)} comes right after \`-p\`. Write the prompt right after \`-p\`, ${example}.`);
  } else if (!/** @type {string} */ (args.prompt).trim()) {
    problems.push('The prompt after `-p` is empty. Write what Claude should do with the diff there.');
  }

  const { outputFormat, permissionMode, allowedTools, maxTurns, dangerouslySkipPermissions } = args.flags;
  if (outputFormat === undefined) problems.push(`It doesn't ask for JSON: add \`--output-format json\`.${spelling('--output-format')}`);
  else if (outputFormat === null) problems.push('`--output-format` has no format after it: write `--output-format json`.');
  else if (outputFormat !== 'json') problems.push(`It asks for \`--output-format ${outputFormat}\`: use \`json\`, so the script can save the result and read it.`);

  if (permissionMode === undefined) problems.push(`It sets no permission mode: add \`--permission-mode dontAsk\`, so every call that would ask for permission is denied.${spelling('--permission-mode')}`);
  else if (permissionMode === null) problems.push('`--permission-mode` has no mode after it: write `--permission-mode dontAsk`.');
  else if (permissionMode.toLowerCase() === 'dontask' && permissionMode !== 'dontAsk') problems.push(`Write \`dontAsk\` as Claude Code spells it, not ${code(permissionMode)}.`);
  else if (permissionMode !== 'dontAsk') problems.push(`It runs in ${code(permissionMode)} mode: use \`--permission-mode dontAsk\`, so every call that would ask for permission is denied.`);
  if (dangerouslySkipPermissions) problems.push('Drop `--dangerously-skip-permissions`: it is the same as `--permission-mode bypassPermissions`.');

  // A value with a word that can't be a tool name, such as a prompt written
  // after the list, is reported by that word alone.
  const values = allowedTools ?? [];
  const words = values.flatMap((/** @type {unknown} */ v) => ruleList([v]).filter((e) => !TOOL_NAME.test(e)));
  const entries = ruleList(values.filter((/** @type {unknown} */ v) => ruleList([v]).every((e) => TOOL_NAME.test(e))));
  const others = [...new Set(entries.filter((e) => !READ_ONLY.test(e)))];
  if (allowedTools === undefined) problems.push(`It pre-approves no tools: add \`--allowedTools "Read,Grep,Glob"\`.${spelling('--allowedTools')}`);
  else if (!ruleList(values).length) problems.push('`--allowedTools` lists no tool: write `--allowedTools "Read,Grep,Glob"`.');
  if (words.length) {
    const [word] = /** @type {[string]} */ (words);
    problems.push(/^(read|grep|glob)$/i.test(word)
      ? `Write ${code(/** @type {string} */ (word[0]).toUpperCase() + word.slice(1).toLowerCase())} as Claude Code spells the tool, not ${code(word)}.`
      : `${code(word)} isn't a read-only tool: list only \`Read\`, \`Grep\` and \`Glob\` after \`--allowedTools\`, and write the prompt right after \`-p\`.`);
  }
  if (others.length) {
    const shown = others.slice(0, 3).map(code);
    problems.push(`\`--allowedTools\` lists ${and(shown)}${others.length > 3 ? ` and ${others.length - 3} more` : ''}, ${others.length > 1 ? 'which are' : 'which is'} not \`Read\`, \`Grep\` or \`Glob\`. Claude gets the diff on stdin, so list only those three.`);
  }

  // `--tools` keeps exactly the three, so no rule can approve another
  // built-in tool, such as Bash for the project's test command.
  const { tools } = args.flags;
  const toolValues = (Array.isArray(tools) ? tools : [tools]).filter((v) => v !== null && v !== undefined);
  if (tools === undefined) problems.push(`It doesn't restrict the tools: add \`--tools "Read,Grep,Glob"\`, so Claude can't use Bash, Edit or Write even when one of your rules allows them.${spelling('--tools')}`);
  else if (!toolValues.length) problems.push('`--tools` has no tools after it: write `--tools "Read,Grep,Glob"`.');
  else {
    const listed = ruleList(toolValues);
    const kept = [...new Set(listed.filter((t) => !/^(Read|Grep|Glob)$/.test(t)))];
    const missing = ['Read', 'Grep', 'Glob'].filter((t) => !listed.includes(t));
    if (kept.length) problems.push(`\`--tools\` keeps ${and(kept.slice(0, 3).map(code))}${kept.length > 3 ? ` and ${kept.length - 3} more` : ''} available: list only \`Read\`, \`Grep\` and \`Glob\` there.`);
    else if (missing.length) problems.push(`\`--tools\` leaves out ${and(missing.map(code))}: list \`Read\`, \`Grep\` and \`Glob\` there, as \`--tools "Read,Grep,Glob"\` does.`);
  }

  // Hooks off for the run: a project's hooks run in a `-p` session, and a
  // Stop hook can send the reviewer back to work.
  const { settings } = args.flags;
  const hooksOff = '`--settings \'{"disableAllHooks": true}\'`';
  if (settings === undefined) problems.push(`It doesn't turn hooks off: add ${hooksOff}, so the project's hooks can't run in the review.${spelling('--settings')}`);
  else if (settings === null || !settings.trim()) problems.push(`\`--settings\` has nothing after it: write ${hooksOff}.`);
  else {
    let value;
    try {
      value = JSON.parse(settings);
    } catch {
      value = undefined;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) problems.push(`\`--settings\` gets ${code(quoted(settings))}, which isn't inline JSON: write ${hooksOff}.`);
    else if (value.disableAllHooks !== true) problems.push(`The \`--settings\` JSON doesn't set \`"disableAllHooks": true\`, so the project's hooks still run: add it, as in ${hooksOff}.`);
  }

  // No MCP server but the ones the call passes: a `-p` run connects the
  // project's `.mcp.json` servers without asking.
  if (!args.flags.strictMcpConfig) problems.push(`It doesn't keep the project's MCP servers out: add \`--strict-mcp-config\`, so the run starts no server you didn't pass with \`--mcp-config\`.${spelling('--strict-mcp-config')}`);

  if (maxTurns === undefined) problems.push(`It sets no turn cap: add \`--max-turns\` with a number from 1 to ${CAP_MAX}.${spelling('--max-turns')}`);
  else if (maxTurns === null) problems.push(`\`--max-turns\` has no number after it: write one from 1 to ${CAP_MAX}.`);
  else if (!/^\d+$/.test(maxTurns)) problems.push(`\`--max-turns ${maxTurns}\` isn't a whole number: use one from 1 to ${CAP_MAX}.`);
  else if (Number(maxTurns) < 1 || Number(maxTurns) > CAP_MAX) problems.push(`\`--max-turns ${maxTurns}\` is ${Number(maxTurns) < 1 ? 'below 1' : `above ${CAP_MAX}`}: use a number from 1 to ${CAP_MAX}.`);
  return problems;
}

// `guide` is where the page describes the script.
/** @param {string} script */
/**
 * @param {string} script
 * @returns {Item}
 */
export function committedScript(script, guide = 'the lesson\'s Your turn') {
  return {
    text: `${code(script)} is committed and executable`,
    check(repo) {
      const mode = committedMode(repo, script);
      if (mode === null) return repo.exists(script) ? `${code(script)} isn't committed. Run \`git add ${script}\` and commit it.` : `There is no ${code(script)}. Write it as ${guide} describes, then commit it.`;
      if (mode === '100755') return true;
      if (mode === '100644') return `${code(script)} isn't executable. Run \`chmod +x ${script}\`, then \`git add ${script}\` and commit. On Windows, run \`git update-index --chmod=+x ${script}\` and commit.`;
      return `${code(script)} is committed as ${mode === '120000' ? 'a symbolic link' : 'something other than a file'}. Commit the script file itself, and make it executable.`;
    },
  };
}

/**
 * @param {string} script
 * @returns {Item}
 */
export function scriptCall(script) {
  return {
    text: `its \`claude -p\` call asks for JSON in \`dontAsk\` mode, allows only \`Read\`, \`Grep\` and \`Glob\`, with no hook or MCP server, caps turns at ${CAP_MAX} or fewer, and has the prompt right after \`-p\``,
    check(repo) {
      const run = scenario(repo, script, 'review');
      const skipped = notRun(run, script);
      if (skipped) return skipped;
      if (!run.print.length) {
        const why = run.stray.length
          ? `ran \`claude\` without \`-p\` (or \`--print\`), which starts an interactive session. Add \`-p\`, with the prompt right after it.`
          : `never ran \`claude -p\`, so the check couldn't see its flags. ${ended(run)}`;
        return `With a staged change, ${code(script)} ${why}${pending(repo, script)}`;
      }
      const problems = [...new Set(run.print.flatMap((c) => callHints(c.argv)))];
      return problems.length ? `${problems.join(' ')}${pending(repo, script)}` : true;
    },
  };
}

const isStubJson = (/** @type {string} */ text) => {
  try {
    return JSON.parse(text)?.session_id === STUB_SESSION;
  } catch {
    return false;
  }
};

// The review of a staged change, in a run that finished: one call, the staged
// diff on its stdin and nothing else, exit 0, the review printed and the JSON
// saved where the first argument says.
/**
 * @param {ScenarioRun} run
 * @param {string} fallback
 */
function reviewProblems(run, fallback) {
  const m = run.markers;
  if (!run.print.length) return [`With a staged change, the script never ran \`claude -p\`. ${ended(run)}`];
  /** @type {string[]} */
  const problems = [];
  if (run.print.length > 1) problems.push(`With one staged change, it ran \`claude -p\` ${run.print.length} times. Run it once, with the whole staged diff on stdin.`);
  if (run.stray.length) problems.push('It also ran `claude` without `-p`, which starts an interactive session. Run only the `claude -p` call.');
  const [call] = /** @type {[Call]} */ (run.print);
  if (!call.stdin.includes(m.staged)) {
    problems.push(call.argv.some((a) => a.includes(m.staged))
      ? 'It puts the diff in the prompt. Pipe it in instead: `git diff --cached | claude -p "<prompt>" ...`.'
      : 'What it piped into `claude -p` doesn\'t hold the staged change. Pipe the staged diff in: `git diff --cached | claude -p "<prompt>" ...`.');
  } else if (call.stdin.includes(m.unstaged)) {
    problems.push('The diff it piped into `claude -p` also holds a change that isn\'t staged. Pipe `git diff --cached`, which holds only what is staged.');
  }
  if (run.status !== 0) problems.push(`With a staged change and a run that succeeded, it exited with ${exitOf(run)}${stderrTail(run) ? ` (${stderrTail(run)})` : ''}. Exit 0 when the review succeeds.`);
  if (!run.stdout.includes(m.review)) problems.push('It didn\'t print the review. Print the JSON\'s `result`, as `jq -r \'.result\'` does.');
  const saved = run.saved[`out/${OUT}`];
  const save = `Save the output of \`claude -p\` to the path in the first argument, or to ${code(fallback)} without one: \`out="\${1:-${fallback}}"\`, then \`> "$out"\`.`;
  if (saved === undefined) problems.push(run.saved[fallback] !== undefined ? `It saved the JSON to ${code(fallback)}, though its first argument named another path. Use the argument when there is one: \`out="\${1:-${fallback}}"\`.` : `It didn't save the JSON to the path in its first argument. ${save}`);
  else if (!isStubJson(saved)) problems.push('The file at the path in its first argument isn\'t the JSON `claude -p` printed. Save that output unchanged.');
  return problems;
}

/**
 * @param {ScenarioRun} run
 * @param {string} fallback
 */
function defaultProblems(run, fallback) {
  if (run.timedOut) return [`Run without an argument, it ${timedOut}.`];
  const saved = run.saved[fallback];
  if (saved === undefined) {
    const folder = posix.dirname(fallback);
    if (run.stderr.includes(fallback) && /No such file or directory/.test(run.stderr)) return [`Run without an argument in a fresh copy, where ${code(`${folder}/`)} doesn't exist yet, it couldn't write ${code(fallback)}. Create the folder first, as \`mkdir -p "$(dirname "$out")"\` does.`];
    const how = run.status !== 0 ? ` (it exited with ${exitOf(run)}${stderrTail(run) ? `: ${stderrTail(run)}` : ''})` : '';
    return [`Run without an argument, it didn't save the JSON to ${code(fallback)}${how}. Use that path when there is no argument: \`out="\${1:-${fallback}}"\`.`];
  }
  return isStubJson(saved) ? [] : [`Run without an argument, it saved something other than the JSON \`claude -p\` printed to ${code(fallback)}.`];
}

/**
 * @param {ScenarioRun} failed
 * @param {ScenarioRun} isError
 */
function failureProblems(failed, isError) {
  /** @type {string[]} */
  const problems = [];
  if (failed.timedOut) problems.push(`When \`claude -p\` exits non-zero, it ${timedOut}. Exit non-zero too, without waiting or trying again.`);
  else if (failed.status === 0) problems.push('When `claude -p` exits non-zero and prints no JSON, as it does for a flag it can\'t read, it exited 0. Exit non-zero whenever `claude -p` does.');
  if (isError.timedOut) problems.push(`When the JSON says \`"is_error": true\`, it ${timedOut}.`);
  else if (isError.status === 0) problems.push('When the JSON says `"is_error": true` and `claude -p` exits 0, it exited 0. Exit non-zero whenever `is_error` is `true`: test `jq -r \'.is_error\'`.');
  return problems;
}

/** @param {ScenarioRun} run */
function emptyProblems(run) {
  if (run.timedOut) return [`With nothing staged, it ${timedOut}.`];
  /** @type {string[]} */
  const problems = [];
  if (run.print.length) problems.push('With nothing staged, it still ran `claude -p`. Test for a staged change first, as `git diff --cached --quiet` does, and stop before calling Claude.');
  if (run.status === 0) problems.push('With nothing staged, it exited 0. Exit non-zero, so whatever runs it can tell that no review ran.');
  if (!`${run.stdout}${run.stderr}`.trim()) problems.push('With nothing staged, it printed nothing. Say that nothing is staged.');
  return problems;
}

// `fallback` is where the script saves the JSON without an argument: the
// lesson's path, which the capstone's script keeps.
/**
 * @param {string} script
 * @returns {Item}
 */
export function scriptBehavior(script, fallback = RESULT) {
  return {
    text: 'it pipes the staged diff in, saves the JSON where its argument says, prints the result, exits non-zero when the run fails, and doesn\'t call Claude when nothing is staged',
    check(repo) {
      const review = scenario(repo, script, 'review');
      const skipped = notRun(review, script);
      if (skipped) return skipped;
      if (missingJq(review)) return JQ;
      // A script that hangs on a staged change would hang in every run.
      if (review.timedOut) return `With a staged change, ${code(script)} ${timedOut}.${pending(repo, script)}`;
      const [noArgument, failed, isError, nothingStaged] = /** @type {[ScenarioRun, ScenarioRun, ScenarioRun, ScenarioRun]} */ (['noArgument', 'failed', 'isError', 'nothingStaged'].map((n) => scenario(repo, script, n)));
      if ([noArgument, failed, isError, nothingStaged].some(missingJq)) return JQ;
      const problems = [...reviewProblems(review, fallback), ...defaultProblems(noArgument, fallback), ...failureProblems(failed, isError), ...emptyProblems(nothingStaged)];
      if (!problems.length) return true;
      const more = problems.length > 3 ? ` And ${problems.length - 3} more: fix these and run the check again.` : '';
      return `${problems.slice(0, 3).join(' ')}${more}${pending(repo, script)}`;
    },
  };
}

// A real run the Learner saved. Its turn count may be one above the cap:
// the cap counts only the turns that use tools, and `num_turns` counts the
// final answer too (How the agent loop works). The lesson's dry-run confirms
// the bound.
/**
 * @param {string} result
 * @param {string} script
 * @returns {Item}
 */
export function savedRun(result, script) {
  const run = `stage a change and run \`${script}${result === RESULT ? '' : ` ${result}`}\``;
  const again = `Then ${run} again.`;
  return {
    text: `${code(result)} holds a run that succeeded within your cap`,
    local: true,
    check(repo) {
      const text = repo.read(result);
      if (text === null || !text.trim()) return `There is no ${code(result)} yet: ${run}, which saves the JSON there.`;
      let value;
      try {
        value = JSON.parse(text);
      } catch {
        return `${code(result)} isn't JSON. Save the output of \`claude -p --output-format json\` there unchanged. ${again}`;
      }
      if (value?.type !== 'result') return `${code(result)} isn't the result of a \`claude -p\` run with \`--output-format json\`. ${again}`;
      if (value.session_id === STUB_SESSION) return `${code(result)} holds the check's stand-in reply, not a real run: your script saved it there while the check ran it. Save the JSON only where the script's first argument says. ${again}`;
      if (value.subtype !== 'success') return `The run in ${code(result)} stopped early (${code(String(value.subtype))}) and holds no review.${value.subtype === 'error_max_turns' ? ` Raise the cap, up to ${CAP_MAX}, narrow the prompt, or check your flags.` : ''} ${again}`;
      if (value.is_error !== false) return `The run in ${code(result)} failed${typeof value.result === 'string' && value.result.trim() ? `: "${quoted(value.result)}"` : ''}. Fix what it says. ${again}`;
      if (typeof value.result !== 'string' || !value.result.trim()) return `The run in ${code(result)} holds no review in \`result\`. ${again}`;
      if (typeof value.session_id !== 'string' || !value.session_id) return `The run in ${code(result)} has no \`session_id\`, so it isn't the JSON \`claude -p\` saves. ${again}`;
      const cap = capOf(repo, script);
      if (!Number.isInteger(value.num_turns) || value.num_turns < 1) return `The run in ${code(result)} has no turn count in \`num_turns\`, so it isn't the JSON \`claude -p\` saves. ${again}`;
      if (value.num_turns > cap + 1) return `The run in ${code(result)} took ${value.num_turns} turns, more than \`--max-turns ${cap}\` allows, so it ran with a higher cap. ${again}`;
      return true;
    },
  };
}

/** @type {Item[]} */
export const items = [committedScript(SCRIPT), scriptCall(SCRIPT), scriptBehavior(SCRIPT), savedRun(RESULT, SCRIPT)];
