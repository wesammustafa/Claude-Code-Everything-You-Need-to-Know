// GitHub Actions (Advanced, lesson 5). In a copy of the template made for this
// lesson, set up by hand with a repository secret and no Claude GitHub App,
// the Learner commits a workflow they start by hand, in which a pinned
// anthropics/claude-code-action runs Claude in automation mode, with its
// credential from a repository secret and its limits in the file; runs it
// once; saves the `gh run list` JSON under .practice/; and then tears the
// workflow down. The workflow items read the history, newest first, so they
// pass before and after the teardown, and a later workflow on other events
// never stands in for this one. Once the lesson's file is in the history,
// they read only that file, so the Worked example's workflow, which also
// starts by hand, never stands in for it either. Who can start a run, and which issue or
// comment text reaches Claude as input, is a judgment the check can't see, so
// the lesson self-checks it. The Advanced capstone reuses the workflow items, as one item, with its
// own events.
import { claudeArgWords, claudeHistory, claudeWorkflowsAt, headBlob, uncommittedWorkflows } from '../actions.mjs';
import { ruleList } from '../claude-args.mjs';

export const title = 'GitHub Actions';

export const WORKFLOW = '.github/workflows/linkcheck-report.yml';
export const RUNS = '.practice/a-5-runs.json';
export const TURNS_MAX = 10;
export const TIMEOUT_MAX = 30;

// What the lesson's workflow starts on, its file, where the page says what to
// write, and two things the hints say about the setup: where the credential's
// secret came from, and what the action does without `github_token`. The
// lesson's copy has only the secret, saved with `gh secret set`, and no
// Claude GitHub App.
const LESSON = {
  triggers: ['workflow_dispatch'],
  file: WORKFLOW,
  guide: 'Your turn',
  secret: 'the secret you saved',
  noToken: 'the action authenticates as the Claude GitHub App, which this copy doesn\'t have',
};

const RUN_FIELDS = 'databaseId,status,conclusion,event,headSha,url,workflowName';
const CREDENTIALS = ['anthropic_api_key', 'claude_code_oauth_token'];
// A Claude API key or OAuth token written out.
const KEY = /sk-ant-[A-Za-z0-9_-]{20,}/;
const PINNED = /^(?:v\d+\.\d+\.\d+|[0-9a-f]{40})$/i;
const SECRET = /^\$\{\{\s*secrets(?:\.[A-Za-z_][A-Za-z0-9_]*|\[\s*(['"])[A-Za-z_][A-Za-z0-9_]*\1\s*\])\s*\}\}$/;
const JOB_TOKEN = /^\$\{\{\s*(?:github\.token|secrets\.GITHUB_TOKEN)\s*\}\}$/;
// The events of an @claude conversation, which quick setup's claude.yml runs on.
const CONVERSATION = new Set(['issues', 'issue_comment', 'pull_request_review', 'pull_request_review_comment']);
const FAILED = new Set(['failure', 'timed_out', 'startup_failure']);
const RUN_URL = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/actions\/runs\/\d+/i;
const GITHUB_REMOTE = /^(?:(?:https?|ssh|git):\/\/)?(?:[^@/]+@)?(?:www\.)?github\.com(?::\d+)?[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i;

const and = (list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0]);
const or = (list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} or ${list.at(-1)}` : list[0]);
const code = (text) => `\`${text}\``;
const short = (sha) => sha.slice(0, 7);
const onPhrase = (triggers) => (triggers.length === 1 ? code(`on: ${triggers[0]}`) : `\`on:\` with ${or(triggers.map(code))}`);
const startsOn = (triggers) => `that starts on ${or(triggers.map(code))}`;
const squash = (flag) => flag.split('=')[0].replace(/^-+/, '').replace(/[-_]/g, '').toLowerCase();

// The ways to write a Bash rule that matches every command.
function anyBash(entry) {
  if (entry === 'Bash') return true;
  const m = entry.match(/^Bash\((.*)\)$/s);
  return Boolean(m && /^\*+$/.test(m[1].replace(/[\s:]/g, '')));
}

// What item 1 reads: the pin, automation mode, the credential and the events.
function setupProblems(file, step, o) {
  const problems = [];
  const leaked = file.text.split('\n').findIndex((line) => KEY.test(line));
  if (leaked !== -1) problems.push(`Line ${leaked + 1} holds what looks like a Claude API key or token. Treat it as leaked: delete the key in the Claude Console now, because removing it from the file doesn't take it out of your history. Keep the credential only in a repository secret.`);
  if (!step.ref) problems.push(`Line ${step.line} runs \`anthropics/claude-code-action\` without a version. Pin a release tag (\`@vX.Y.Z\`) or that release's full commit SHA.`);
  else if (/^[0-9a-f]{7,39}$/i.test(step.ref)) problems.push(`\`@${step.ref}\` on line ${step.line} is a short commit SHA. Write the full 40-character SHA.`);
  else if (!PINNED.test(step.ref)) problems.push(`\`@${step.ref}\` on line ${step.line} can move to a new release, which changes the Claude Code version on the runner without a commit of yours. Pin a release tag (\`@vX.Y.Z\`) or that release's full commit SHA.`);

  const { prompt } = step.inputs;
  if (!prompt) problems.push(`The step on line ${step.line} has no \`prompt\`, so Claude waits for \`@claude\` in an issue or pull request (interactive mode). Add a \`prompt\` under \`with:\` that says what Claude should do, so it runs as soon as the workflow starts (automation mode).`);
  else if (!prompt.text?.trim()) problems.push(`The \`prompt\` on line ${prompt.line} is empty. Write what Claude should do there.`);

  const given = CREDENTIALS.filter((k) => step.inputs[k]);
  if (!given.length) problems.push(`The step on line ${step.line} passes no credential. Add \`anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}\` under \`with:\`, or \`claude_code_oauth_token: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}\` for a subscription token, naming ${o.secret}.`);
  for (const k of given) {
    const v = step.inputs[k];
    const text = (v.text ?? '').trim();
    if (!SECRET.test(text) && !KEY.test(text)) problems.push(`\`${k}\` on line ${v.line} isn't read from a secret. Write \`${k}: \${{ secrets.<NAME> }}\`, naming ${o.secret}, and keep the credential itself out of the file.`);
  }
  if (step.triggers.includes('pull_request_target')) problems.push('Remove `pull_request_target` from `on:`. GitHub warns that running untrusted code on it can grant unintended access to write privileges or secrets.');
  return problems;
}

// The flags in `claude_args` that set the turn limit and the tools.
function argProblems(args) {
  const { words, comment } = claudeArgWords(args.text);
  const problems = [];
  // Flags after an unquoted `#`, which the action never reads.
  const hidden = ['--max-turns', '--allowedTools', '--allowed-tools'].filter((f) => comment && new RegExp(`(^|\\s)${f}(=|\\s|$)`).test(comment));
  if (hidden.length) problems.push(`An unquoted \`#\` in \`claude_args\` starts a comment that, for the action, runs to the end of the value, so it never reads ${and(hidden.map(code))}. Move that comment to a line of its own, above \`claude_args\`.`);
  const spelling = (flags) => {
    const typo = words.find((w) => w.startsWith('--') && !flags.includes(w.split('=')[0]) && flags.some((f) => squash(w) === squash(f)));
    return typo ? ` Claude Code doesn't know ${code(typo.split('=')[0])}: write ${code(flags[0])}.` : '';
  };

  // The action reads a flag's value from the word after it, so it takes the
  // turn limit itself only from `--max-turns 5`; the page asks for that form.
  let turns;
  let joined = null;
  for (let i = 0; i < words.length; i += 1) {
    if (words[i] === '--max-turns') turns = words[i + 1] !== undefined && !words[i + 1].startsWith('--') ? words[i + 1] : null;
    else if (words[i].startsWith('--max-turns=')) joined = words[i];
  }
  const range = `a number from 1 to ${TURNS_MAX}`;
  const fits = (n) => /^\d+$/.test(n ?? '') && Number(n) >= 1 && Number(n) <= TURNS_MAX;
  if (joined) {
    const n = joined.slice('--max-turns='.length);
    problems.push(`Write ${fits(n) ? `\`--max-turns ${n}\` with a space` : `\`--max-turns\` with a space and ${range}`}, not ${code(joined)}: the action reads a flag's value from the word after it.`);
  }
  else if (turns === undefined) {
    if (!hidden.includes('--max-turns')) problems.push(`\`claude_args\` sets no turn limit: add \`--max-turns\` with ${range}.${spelling(['--max-turns'])}`);
  }
  else if (turns === null) problems.push(`\`--max-turns\` has no number after it: write ${range}.`);
  else if (!/^\d+$/.test(turns)) problems.push(`\`--max-turns ${turns}\` isn't a whole number: use ${range}.`);
  else if (Number(turns) < 1 || Number(turns) > TURNS_MAX) problems.push(`\`--max-turns ${turns}\` is ${Number(turns) < 1 ? 'below 1' : `above ${TURNS_MAX}`}: use ${range}.`);

  // Every word after `--allowedTools` up to the next option is a value.
  const values = [];
  let named = false;
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    if (w === '--allowedTools' || w === '--allowed-tools') {
      named = true;
      while (i + 1 < words.length && !words[i + 1].startsWith('--')) values.push(words[(i += 1)]);
    } else if (/^--(allowedTools|allowed-tools)=/.test(w)) {
      named = true;
      values.push(w.slice(w.indexOf('=') + 1));
    }
  }
  const example = 'as in `--allowedTools "Bash(<command> *)"`';
  if (!named) {
    if (!hidden.some((f) => f !== '--max-turns')) problems.push(`\`claude_args\` pre-approves no tool: add \`--allowedTools\` naming only the command Claude needs, ${example}.${spelling(['--allowedTools', '--allowed-tools'])}`);
    return problems;
  }
  const entries = ruleList(values);
  const count = (text, ch) => text.split(ch).length - 1;
  if (!entries.length) problems.push(`\`--allowedTools\` lists no tool: name only the command Claude needs, ${example}.`);
  else if (entries.some((e) => count(e, '(') !== count(e, ')'))) {
    problems.push(`\`--allowedTools\` gets ${and(values.slice(0, 4).map(code))}${values.length > 4 ? ' and more' : ''} as separate words, because the action splits \`claude_args\` at spaces outside quotes. Put each rule in quotes, as in \`--allowedTools "${values.join(' ')}"\`.`);
  }
  const broad = entries.find(anyBash);
  if (broad) problems.push(`\`--allowedTools\` lists ${code(broad)}, which lets Claude run any command. Name only the command it needs, as in \`Bash(<command> *)\`.`);
  return problems;
}

// What item 2 reads: the turn and tool limits, the time limit and the token.
function limitProblems(file, step, o) {
  const problems = [];
  const args = step.inputs.claude_args;
  if (!args?.text?.trim()) problems.push(`The step on line ${step.line} has no \`claude_args\`, so nothing limits the run. Add \`claude_args\` with \`--max-turns\` and a number from 1 to ${TURNS_MAX}, and \`--allowedTools\` naming only the command Claude needs, as in \`--allowedTools "Bash(<command> *)"\`.`);
  else problems.push(...argProblems(args));

  const range = `a number from 1 to ${TIMEOUT_MAX}`;
  const timeouts = [step.stepTimeout, step.jobTimeout].filter(Boolean);
  if (!timeouts.length) problems.push(`The job \`${step.job}\` sets no \`timeout-minutes\`, so only GitHub's default limit stops a run that hangs. Add \`timeout-minutes\` with ${range} to the job.`);
  for (const t of timeouts) {
    const v = (t.text ?? '').trim();
    if (!/^\d+$/.test(v)) problems.push(`\`timeout-minutes: ${v}\` on line ${t.line} isn't a whole number: write ${range}.`);
    else if (Number(v) < 1 || Number(v) > TIMEOUT_MAX) problems.push(`\`timeout-minutes: ${v}\` on line ${t.line} is ${Number(v) < 1 ? 'below 1' : `above ${TIMEOUT_MAX}`}: use ${range}.`);
  }

  // The job's own permissions replace the workflow's. `id-token: write` lets
  // the job ask for an OIDC token, which the action uses to sign in; it gives
  // no write access to the repository.
  const p = step.permissions;
  if (!p) problems.push(`Neither the workflow nor the job \`${step.job}\` sets \`permissions\`, so the job token gets the repository's default access, which can include write access. Add \`permissions:\` with \`contents: read\`.`);
  else if (p.all === 'write-all') problems.push(`\`permissions: write-all\` on line ${p.line} gives the job token write access to everything. Use \`contents: read\`.`);
  else {
    const writes = (p.scopes ?? []).filter((s) => s.level === 'write' && s.scope !== 'id-token');
    if (writes.length) {
      const named = writes.map((s) => code(`${s.scope}: write`));
      const lines = writes.map((s) => s.line);
      problems.push(`${and(named)} on line${lines.length > 1 ? 's' : ''} ${and(lines.map(String))} ${writes.length > 1 ? 'give' : 'gives'} the job token write access, and this job only reads. Make ${writes.length > 1 ? 'them' : 'it'} \`read\`, or remove ${writes.length > 1 ? 'them' : 'it'}.`);
    }
  }

  const token = step.inputs.github_token;
  if (!token) problems.push(`The step on line ${step.line} passes no \`github_token\`, so ${o.noToken}. Add \`github_token: \${{ github.token }}\` under \`with:\`, so Claude uses this job's token and the \`permissions\` you set.`);
  else if (!JOB_TOKEN.test((token.text ?? '').trim())) problems.push(`\`github_token\` on line ${token.line} isn't this job's own token, so the job's \`permissions\` don't limit it. Write \`github_token: \${{ github.token }}\`.`);
  return problems;
}

// Each repository's chosen workflow, by the events it may start on.
const chosen = new WeakMap();

// The workflow step the items evaluate: in the newest commit that holds a
// step on one of `triggers`, the one with a `prompt` and the fewest problems.
// Once the history holds `o.file`, only that file counts. `options` gives
// the hints' wording, as the items' options do. Returns
// `{ file, step, setup, limits }`, or null.
export function chosenWorkflow(repo, triggers, options = LESSON) {
  const o = { ...LESSON, ...options };
  if (!chosen.has(repo)) chosen.set(repo, new Map());
  const byTriggers = chosen.get(repo);
  const key = [...triggers, o.file, o.secret, o.noToken].join('\0');
  if (!byTriggers.has(key)) {
    let found = null;
    const history = claudeHistory(repo);
    const named = history.some(({ files }) => files.some((f) => f.path === o.file));
    for (const { files } of history) {
      const steps = files.filter((file) => !named || file.path === o.file).flatMap((file) => file.steps
        .filter((step) => step.triggers.some((t) => triggers.includes(t)))
        .map((step) => ({ file, step, setup: setupProblems(file, step, o), limits: limitProblems(file, step, o) })));
      if (!steps.length) continue;
      const rank = (c) => [c.step.inputs.prompt?.text?.trim() ? 0 : 1, c.setup.length + c.limits.length];
      [found] = steps.sort((a, b) => {
        const [x, y] = [rank(a), rank(b)];
        return x[0] - y[0] || x[1] - y[1];
      });
      break;
    }
    byTriggers.set(key, found);
  }
  return byTriggers.get(key);
}

function changed(repo, path) {
  try {
    repo.git('diff', '--quiet', 'HEAD', '--', path);
    return false;
  } catch {
    return true;
  }
}

function report(repo, { file }, problems) {
  const inHead = headBlob(repo, file.path) === file.blob;
  const where = inHead ? code(file.path) : `${code(file.path)} (as committed in ${short(file.commit)})`;
  const more = problems.length > 3 ? ` And ${problems.length - 3} more: fix these and run the check again.` : '';
  const pending = inHead && changed(repo, file.path) ? ` Your copy of ${code(file.path)} has changes that aren't committed: if they fix this, commit them.` : '';
  return `${where}: ${problems.slice(0, 3).join(' ')}${more}${pending}`;
}

// Why no committed workflow step starts on one of `triggers`.
function missingHint(repo, { triggers, file, guide }) {
  const byHand = triggers.includes('workflow_dispatch') ? ' GitHub starts a workflow by hand only once its file is on the default branch.' : '';
  const [loose] = uncommittedWorkflows(repo);
  if (loose) {
    return loose.tracked
      ? `Your copy of ${code(loose.path)} runs \`anthropics/claude-code-action\`, but that change isn't committed. Commit it, and push.${byHand}`
      : `${code(loose.path)} isn't committed. Run \`git add ${loose.path}\`, commit it, and push.${byHand}`;
  }
  const seen = new Map();
  for (const { files } of claudeHistory(repo)) for (const f of files) if (!seen.has(f.path)) seen.set(f.path, f);
  const files = [...seen.values()];
  const prompted = files.find((f) => f.steps.some((s) => s.inputs.prompt?.text?.trim()));
  if (prompted) {
    const events = prompted.steps[0].triggers;
    return `${code(prompted.path)} runs Claude with a \`prompt\`, but ${events.length ? `starts on ${and(events.map(code))}` : 'has no `on:` events the check can read'}. Start it with ${onPhrase(triggers)}, then commit and push.${byHand}`;
  }
  // This one is long already: GitHub's rule about manual runs waits for the
  // hint about the second workflow's commit (ticket 198).
  if (files.length) return `${code(files[0].path)} has no \`prompt\`, so it waits for \`@claude\` (interactive mode). You need a second workflow, ${code(file)}, that starts with ${onPhrase(triggers)} and has a \`prompt\`. Write it as ${guide} describes, then commit and push it.`;
  return `There is no committed workflow that runs \`anthropics/claude-code-action\`. Write ${code(file)} as ${guide} describes, then commit and push it.${byHand}`;
}

// The workflow items. Options: `triggers`, the events the workflow may start
// on, which pick it out of the history; `file`, the path a hint suggests;
// `guide`, where the page describes it; `secret` and `noToken`, as in LESSON.
export function pinnedWorkflow(options = LESSON) {
  const o = { ...LESSON, ...options };
  return {
    text: 'a committed workflow runs `anthropics/claude-code-action` pinned to a release or a commit SHA, in automation mode, with its credential from a secret and none in the file',
    check(repo) {
      const c = chosenWorkflow(repo, o.triggers, o);
      if (!c) return missingHint(repo, o);
      return c.setup.length ? report(repo, c, c.setup) : true;
    },
  };
}

export function workflowLimits(options = LESSON) {
  const o = { ...LESSON, ...options };
  return {
    text: `its limits are in the file: \`--max-turns\` of at most ${TURNS_MAX}, an \`--allowedTools\` list without unrestricted \`Bash\`, a read-only job token and \`timeout-minutes\``,
    check(repo) {
      const c = chosenWorkflow(repo, o.triggers, o);
      if (!c) return `There is no committed workflow ${startsOn(o.triggers)} and runs \`anthropics/claude-code-action\`, so the check can't read its limits. Commit one as the item above says.`;
      return c.limits.length ? report(repo, c, c.limits) : true;
    },
  };
}

// Both workflow items as one, as the Advanced capstone checks its review
// workflow: what each finds wrong, in one report on the file it read.
export function boundedWorkflow(options = LESSON) {
  const o = { ...LESSON, ...options };
  return {
    text: `a committed workflow runs \`anthropics/claude-code-action\` on ${or(o.triggers.map(code))}, pinned to a release or a commit SHA, in automation mode, with its credential from a secret and none in the file, a read-only job token, \`--max-turns\` of at most ${TURNS_MAX}, an \`--allowedTools\` list without unrestricted \`Bash\` and \`timeout-minutes\` of at most ${TIMEOUT_MAX}`,
    check(repo) {
      const c = chosenWorkflow(repo, o.triggers, o);
      if (!c) return missingHint(repo, o);
      const problems = [...c.setup, ...c.limits];
      return problems.length ? report(repo, c, problems) : true;
    },
  };
}

// `owner/repo` of a github.com `origin`, or null.
export function originRepo(repo) {
  try {
    const m = repo.git('remote', 'get-url', 'origin').match(GITHUB_REMOTE);
    return m ? `${m[1]}/${m[2]}` : null;
  } catch {
    return null;
  }
}

function isCommit(repo, sha) {
  try {
    repo.gitLocal('cat-file', '-e', `${sha}^{commit}`);
    return true;
  } catch {
    return false;
  }
}

// A saved run of the workflow: `record` holds `gh run list --json` output
// (or one run from `gh run view --json`), and `file` is the workflow the
// hints name.
export function dispatchedRun(record = RUNS, file = WORKFLOW) {
  const name = file.split('/').pop();
  const save = `\`gh run list --workflow ${name} --json ${RUN_FIELDS} > ${record}\``;
  const start = `\`gh workflow run ${name}\``;
  // The full command is in the first hint and on the lesson's ladder: the
  // others say only to save again, so each fits the app's card (ticket 198).
  const again = 'then save the list again';

  // How far one run gets: 0, not started by hand; 1, another repository;
  // 2, not finished; 3, not successful; 4, an unknown commit; 5, a commit
  // without the workflow; 6, passed.
  function review(repo, run, origin) {
    const id = /^\d+$/.test(String(run.databaseId ?? '')) ? String(run.databaseId) : '<run-id>';
    const which = id === '<run-id>' ? 'The run' : `Run ${id}`;
    if (run.event !== 'workflow_dispatch') return { stage: 0 };
    if (origin) {
      const m = typeof run.url === 'string' ? run.url.match(RUN_URL) : null;
      if (!m) return { stage: 1, hint: `${which} in ${code(record)} has no GitHub run URL, so the check can't tell which repository it ran in. Save the list again with its \`url\`.` };
      if (`${m[1]}/${m[2]}`.toLowerCase() !== origin.toLowerCase()) return { stage: 1, hint: `${which} ran in \`${m[1]}/${m[2]}\`, but this repository's \`origin\` is \`${origin}\`. Save the list in the copy you made for this lesson, and run the check there.` };
    }
    if (run.status !== 'completed') return { stage: 2, hint: `${which} hasn't finished: its \`status\` is ${code(String(run.status ?? 'missing'))}. Wait for it with \`gh run watch ${id}\`, ${again}.` };
    if (run.conclusion !== 'success') {
      const how = code(String(run.conclusion ?? 'missing'));
      return {
        stage: 3,
        hint: FAILED.has(run.conclusion)
          ? `${which} ended with ${how}. See why with \`gh run view ${id} --log-failed\`, fix the workflow, commit and push it, run it again with ${start}, ${again}.`
          : `${which} ended with ${how}. Run the workflow again with ${start}, wait for it to finish, ${again}.`,
      };
    }
    const sha = typeof run.headSha === 'string' && /^[0-9a-f]{40}$/i.test(run.headSha) ? run.headSha.toLowerCase() : null;
    if (!sha) return { stage: 4, hint: `${which} has no \`headSha\`, so the check can't tell which commit it ran on. Save the list with that field: ${save}.` };
    if (!isCommit(repo, sha)) return { stage: 4, hint: `${which} ran on commit ${short(sha)}, which this repository doesn't have. Run \`git pull\` to fetch it, then run the check again.` };
    // Once the history holds the lesson's file, the run must be on a commit
    // that holds it, as the workflow items read only that file then.
    const named = claudeHistory(repo).some(({ files }) => files.some((f) => f.path === file));
    const held = claudeWorkflowsAt(repo, sha).some((f) => (!named || f.path === file) && f.steps.some((s) => s.inputs.prompt?.text?.trim()));
    if (!held) return { stage: 5, hint: `${which} ran on commit ${short(sha)}, where ${named ? code(file) : 'no workflow'} ${named ? "doesn't run" : 'runs'} \`anthropics/claude-code-action\` with a \`prompt\`. Once your workflow is pushed, run it with ${start}, wait for it to finish, ${again}.` };
    return { stage: 6 };
  }

  return {
    text: `${code(record)} shows a completed, successful manual run on a commit that holds the workflow`,
    local: true,
    check(repo) {
      const text = repo.read(record);
      if (text === null || !text.trim()) return `There is no ${code(record)} yet. Once your run finishes, save the list: ${save}.`;
      let value;
      try {
        value = JSON.parse(text);
      } catch {
        return `${code(record)} isn't JSON. Save the list with \`--json\`, unchanged: ${save}.`;
      }
      const runs = (Array.isArray(value) ? value : [value]).filter((r) => r && typeof r === 'object' && !Array.isArray(r));
      if (!runs.length) return `${code(record)} lists no runs. Start the workflow with ${start}, wait for it to finish, ${again}.`;
      if (!runs.some((r) => ['status', 'conclusion', 'event', 'headSha'].some((k) => k in r))) return `${code(record)} doesn't hold the fields the check reads. Save the list with them: ${save}.`;
      const origin = originRepo(repo);
      // The run that got furthest; the first of those, as gh lists the newest first.
      const best = runs.map((r) => review(repo, r, origin)).reduce((a, b) => (b.stage > a.stage ? b : a));
      if (best.stage === 6) return true;
      if (best.stage > 0) return best.hint;
      const events = [...new Set(runs.map((r) => r.event).filter((e) => typeof e === 'string' && e))];
      if (events.length && events.every((e) => CONVERSATION.has(e))) return `${code(record)} lists only runs that \`@claude\` started (${and(events.map(code))}). Start your workflow by hand with ${start}, wait for it to finish, ${again}.`;
      return `${code(record)} lists no run started by hand (\`workflow_dispatch\`)${events.length ? `, only ${and(events.map(code))}` : ''}. Start your workflow with ${start}, wait for it to finish, ${again}.`;
    },
  };
}

export const items = [pinnedWorkflow(), workflowLimits(), dispatchedRun()];
