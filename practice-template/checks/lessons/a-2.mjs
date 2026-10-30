// @ts-check
/** @import { Item } from './index.mjs' */
// Choose an orchestration pattern (Advanced, lesson 2). The Learner picks a
// pattern for each of five backlog items by what it needs and what it costs,
// writes the choices to a file, and runs job 1 as parallel subagents in a
// session started with Intermediate lesson 6's delegation log, a
// SubagentStart hook that logs each subagent's type. An agent team is a
// pattern the Learner may name, and the chart's hint answers it. Naming the
// pattern for a job of their own is self-checked.

export const title = 'Choose an orchestration pattern';

const CHOICES = '.practice/a-2-choices.md';
// Intermediate lesson 6's hook file and the log it appends to.
const LOG = '.practice/i-6-agents.txt';
const HOOK = '.practice/i-6-hook.json';
// The subagent lesson 6 delegated to, which its log already names.
const EARLIER = 'test-gaps';
const HOOKED = `\`claude --settings ${HOOK}\``;
const FORMAT = '`<job number>: <pattern> because <reason>`';
const NAMES = '`main conversation`, `subagents`, `workflow`, `/batch` or `agent team`';

// What the text after a job number may start with, once an article goes.
/** @type {[string, RegExp][]} */
const PATTERNS = [
  ['subagents', /^(?:parallel\s+)?sub[\s-]?agents?\b/i],
  ['workflow', /^(?:dynamic\s+)?workflows?\b/i],
  ['batch', /^\/?batch\b/i],
  ['main conversation', /^(?:main\s+(?:conversation|session)|(?:single|one)\s+(?:conversation|session))\b/i],
  ['agent team', /^agent[\s-]+teams?\b/i],
];
/** @type {Record<string, string>} */
const LABEL = { 'main conversation': 'the main conversation', subagents: 'subagents', workflow: 'a workflow', batch: '`/batch`', 'agent team': 'an agent team' };

// The lesson's chart: its questions in order, and the answers that lead to
// each pattern. Where a wrong pick leaves the right path is the question that
// settles the job.
const QUESTIONS = [
  'Can one conversation do it without filling up?',
  'Must the workers talk to each other?',
  'Does it need cross-checked findings or a rerun?',
  'Is it one large change that splits into independent units?',
];
/** @type {Record<string, boolean[]>} */
const PATH = {
  'main conversation': [true],
  'agent team': [false, true],
  workflow: [false, false, true],
  batch: [false, false, false, true],
  subagents: [false, false, false, false],
};

// The five jobs in the lesson's Your turn, and the answer to each question on
// the way to the pattern that fits.
/** @type {Record<number, { pattern: string, why: string[] }>} */
const JOBS = {
  1: { pattern: 'subagents', why: [
    'No: reading the three largest files in your conversation would crowd it, and you only need the suspects.',
    'No: each reviewer checks its own file and reports what it found.',
    'No: three files, checked once, with no step that confirms the findings.',
    'No: nothing changes yet; the reviewers only report.',
  ] },
  2: { pattern: 'workflow', why: [
    'No: it covers the whole codebase.',
    'No: each finding is confirmed against the code, not argued out between workers.',
    'Yes: it covers the whole codebase, confirms each finding before it is listed and runs again for every release, so a script should hold the plan.',
  ] },
  3: { pattern: 'main conversation', why: [
    'Yes: each call site is a short read, and the rename must land as one change that keeps the build green.',
  ] },
  4: { pattern: 'subagents', why: [
    'No: three investigations, each reading code and rerunning the test, would crowd your conversation, and you only need what each found.',
    'No: each investigator checks one suspect and reports to you, and you weigh the results.',
    'No: three checks, done once, and you judge the results yourself.',
    'No: the checks change no code; they bring back what they found.',
  ] },
  5: { pattern: 'batch', why: [
    'No: every package\'s change would pass through one conversation.',
    'No: each package is moved on its own.',
    'No: it runs once, and each package\'s own tests confirm its change.',
    'Yes: one large change that splits into packages, each built, tested and landed on its own, one worktree each.',
  ] },
};
const NUMBERS = Object.keys(JOBS).map(Number);

const SEPARATOR = '[:.)|\\-\\u2013\\u2014]';
const JOB_LINE = new RegExp(`^(?:job\\s*#?\\s*([1-5])(?!\\d)\\s*${SEPARATOR}*|#?([1-5])(?!\\d)\\s*${SEPARATOR}+)\\s*(.*)$`, 'i');

const and = (/** @type {unknown[]} */ list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0]);

// The choice lines in the file, by job number. `1: subagents because ...`,
// `Job 1 - Subagents`, `- **2:** dynamic workflow`, `3. main session`,
// `4) agent teams` and a table row `| 4 | agent team | ... |` all count. A
// line's pattern is null when its text starts with none of the four, and
// `start` keeps that text's first words for the hint.
/** @param {string} text */
export function readChoices(text) {
  /** @type {Map<number, { pattern: string | null, start: string }[]>} */
  const jobs = new Map(NUMBERS.map((n) => [n, []]));
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/[*_`]/g, '')
      .replace(/^\s*(?:[-+>|(]\s*|#{1,6}\s+|\[[ xX]\]\s*)*/, '')
      .replace(/^\d+[.)]\s+(?=job\b)/i, '')
      .trim();
    const match = line.match(JOB_LINE);
    if (!match) continue;
    const rest = /** @type {string} */ (match[3]).replace(/^["'([\s]+/, '').replace(/^(?:an?|the)\s+/i, '');
    const found = PATTERNS.find(([, pattern]) => pattern.test(rest));
    const start = rest.replace(/\s+because\b.*$/i, '').split(/\s+/).filter(Boolean).slice(0, 4).join(' ');
    /** @type {{ pattern: string | null, start: string }[]} */ (jobs.get(Number(match[1] ?? match[2]))).push({ pattern: found ? found[0] : null, start });
  }
  return jobs;
}

/**
 * @param {number} n
 * @param {string} chosen
 */
function wrongPick(n, chosen) {
  const { pattern, why } = /** @type {{ pattern: string, why: string[] }} */ (JOBS[n]);
  const at = /** @type {boolean[]} */ (PATH[chosen]).findIndex((answer, i) => answer !== /** @type {boolean[]} */ (PATH[pattern])[i]);
  return `Job ${n} doesn't call for ${LABEL[chosen]}. ${QUESTIONS[at]} ${why[at]} It calls for ${LABEL[pattern]}.`;
}

// Subagent starts in lesson 6's log, one per line: the hook writes each
// subagent's type (`agent_type`). A line that names lesson 6's own subagent
// came from that lesson, so job 1's starts are the other lines. A hook that
// also logs an id, `agent_id<TAB>agent_type`, counts each id once, as a
// resumed subagent logs its id again.
/** @param {string} text */
export function startedAgents(text) {
  const ids = new Map();
  let unnamed = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const tab = line.indexOf('\t');
    const id = tab === -1 ? '' : line.slice(0, tab).trim();
    const type = (tab === -1 ? line : line.slice(tab + 1)).trim();
    if (type === EARLIER) continue;
    if (id) ids.set(id, (ids.get(id) ?? 0) + 1);
    else unnamed += 1;
  }
  return { ids, count: ids.size + unnamed };
}

/** @type {Item} */
export const fittingPatterns = {
  text: `\`${CHOICES}\` picks the cheapest pattern that fits each job`,
  local: true,
  check(repo) {
    const text = repo.read(CHOICES);
    if (text === null) return `There is no \`${CHOICES}\`. Write one line per job there, ${FORMAT}, where each pattern is ${NAMES}.`;
    const jobs = readChoices(text);
    if ([...jobs.values()].every((lines) => !lines.length)) return `\`${CHOICES}\` has no line that starts with a job number. Write one line per job, ${FORMAT}, where each pattern is ${NAMES}.`;
    const missing = [...jobs].filter(([, lines]) => !lines.length).map(([n]) => n);
    const problems = missing.length ? [`\`${CHOICES}\` has no line for job${missing.length > 1 ? 's' : ''} ${and(missing)}. Add one per job in the form ${FORMAT}.`] : [];
    for (const [n, lines] of jobs) {
      if (!lines.length) continue;
      const picked = /** @type {string[]} */ ([...new Set(lines.map((l) => l.pattern).filter(Boolean))]);
      if (!picked.length) {
        const { start } = /** @type {{ start: string }} */ (lines[0]);
        problems.push(start ? `Job ${n}'s line starts with "${start}", which isn't one of the patterns. Right after the job number, write ${NAMES}.` : `Job ${n}'s line names no pattern. Right after the job number, write ${NAMES}.`);
      } else if (picked.length > 1) {
        problems.push(`Job ${n} has lines that pick different patterns: ${and(picked.map((p) => LABEL[p]))}. Keep one line per job.`);
      } else if (picked[0] !== /** @type {{ pattern: string }} */ (JOBS[n]).pattern) {
        problems.push(wrongPick(n, /** @type {string} */ (picked[0])));
      }
    }
    return problems.length ? problems.join(' ') : true;
  },
};

/** @type {Item} */
export const parallelSubagents = {
  text: `\`${LOG}\` shows at least two subagents other than \`${EARLIER}\` starting for job 1`,
  local: true,
  check(repo) {
    const text = repo.read(LOG);
    if (text === null) {
      return repo.exists(HOOK)
        ? `There is no \`${LOG}\`. Start the session with ${HOOKED}, then run job 1.`
        : `There is no \`${LOG}\`. Save Intermediate lesson 6's hook file as \`${HOOK}\`, then run job 1 in a session started with ${HOOKED}.`;
    }
    const { count } = startedAgents(text);
    if (count >= 2) return true;
    if (!text.trim()) return `\`${LOG}\` is empty. The hook's command creates the file before \`jq\` runs, so check that \`jq --version\` works, then run job 1 again in a session started with ${HOOKED}.`;
    const seen = count === 1 ? 'one subagent starting' : `only lesson 6's \`${EARLIER}\``;
    return `\`${LOG}\` shows ${seen}, and job 1 needs at least two subagents. In a session started with ${HOOKED}, ask for one per file, in parallel.`;
  },
};

/** @type {Item[]} */
export const items = [fittingPatterns, parallelSubagents];
