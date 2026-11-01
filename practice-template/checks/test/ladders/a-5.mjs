// Every FAIL message of Advanced lesson 5's check, each from a new copy that
// produces it: `files` to write, or `setup(dir, { write, commit })`. Each
// scenario breaks one thing, so one narrow question matches its message.
import { execFileSync } from 'node:child_process';

const WORKFLOW = '.github/workflows/linkcheck-report.yml';
const CLAUDE = '.github/workflows/claude.yml';
const RUNS = '.practice/a-5-runs.json';
const PIN = 'fd1c128679612beff4ca259c78021c506e8aa7a7';
const ORIGIN = 'git@github.com:learner/claude-actions-practice.git';
const RUN_AT = 'https://github.com/learner/claude-actions-practice/actions/runs/123456789';
const ARGS = '--max-turns 8 --allowedTools "Bash(npm run linkcheck *)"';
// The lesson's workflow, as the advanced tests write it.
const REPORT = [
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
  '          prompt: |',
  '            Run the link checker on samples/ and explain each broken link.',
  "            Don't change any files.",
  `          claude_args: ${ARGS}`,
  '',
].join('\n');
// Quick setup's @claude workflow, cut down: no prompt, mention events.
const MENTIONS = [
  'name: Claude Code',
  'on:',
  '  issue_comment:',
  '    types: [created]',
  'jobs:',
  '  claude:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - uses: anthropics/claude-code-action@v1',
  '        with:',
  '          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}',
  '',
].join('\n');

// The lesson's workflow with `from` replaced by `to`.
const report = (from, to) => {
  if (!REPORT.includes(from)) throw new Error(`the workflow has no ${from}`);
  return REPORT.replace(from, () => to);
};
const withArgs = (args) => report(`claude_args: ${ARGS}`, `claude_args: ${args}`);
const git = (dir, ...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();

// Commits `text` as the workflow at `path`; returns the commit.
const committed = (text, path = WORKFLOW) => (dir, { write, commit }) => {
  write(dir, { 'README.md': '# demo\n' });
  commit(dir, 'Start');
  write(dir, { [path]: text });
  return commit(dir, 'Add the workflow', [path]);
};

// The lesson's workflow committed, and the run list `runs(added, start)`
// saved as it is (text) or as JSON; `origin` is the remote, or none.
const saved = (runs, { origin = null } = {}) => (dir, { write, commit }) => {
  if (origin) git(dir, 'remote', 'add', 'origin', origin);
  write(dir, { 'README.md': '# demo\n' });
  const start = commit(dir, 'Start');
  write(dir, { [WORKFLOW]: REPORT });
  const added = commit(dir, 'Add the workflow', [WORKFLOW]);
  if (runs === null) return;
  const list = typeof runs === 'function' ? runs(added, start) : runs;
  write(dir, { [RUNS]: typeof list === 'string' ? list : JSON.stringify(list, null, 2) });
};
const run = (sha, extra = {}) => ({ databaseId: 123456789, status: 'completed', conclusion: 'success', event: 'workflow_dispatch', headSha: sha, url: RUN_AT, workflowName: 'Link check report', ...extra });

export const scenarios = [
  // Item 0: the pin, automation mode, the credential and the events.
  { item: 0, name: 'no workflow at all', files: { 'README.md': '# demo\n' } },
  { item: 0, name: 'the workflow written but never added', files: { [WORKFLOW]: REPORT } },
  {
    item: 0,
    name: 'a fix to a committed workflow left uncommitted',
    setup: (dir, tools) => {
      committed('name: Placeholder\non: workflow_dispatch\njobs: {}\n')(dir, tools);
      tools.write(dir, { [WORKFLOW]: REPORT });
    },
  },
  { item: 0, name: 'only the @claude workflow committed', setup: committed(MENTIONS, CLAUDE) },
  { item: 0, name: 'the workflow starts on push', setup: committed(report('on:\n  workflow_dispatch:', 'on:\n  push:\n    branches: [main]')) },
  { item: 0, name: 'a key written into the file', setup: committed(report('${{ secrets.ANTHROPIC_API_KEY }}', `sk-ant-api03-${'Xy9_'.repeat(8)}`)) },
  { item: 0, name: 'the action with no version', setup: committed(report(`@${PIN} # v1.0.237`, '')) },
  { item: 0, name: 'a short commit SHA', setup: committed(report(`@${PIN} # v1.0.237`, '@fd1c128')) },
  { item: 0, name: 'the moving v1 tag', setup: committed(report(`@${PIN} # v1.0.237`, '@v1')) },
  {
    item: 0,
    name: 'no prompt',
    setup: committed(report("          prompt: |\n            Run the link checker on samples/ and explain each broken link.\n            Don't change any files.\n", '')),
  },
  { item: 0, name: 'an empty prompt', setup: committed(report("prompt: |\n            Run the link checker on samples/ and explain each broken link.\n            Don't change any files.", 'prompt: ""')) },
  { item: 0, name: 'no credential', setup: committed(report('          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}\n', '')) },
  { item: 0, name: 'the credential from an environment variable', setup: committed(report('${{ secrets.ANTHROPIC_API_KEY }}', '${{ env.CLAUDE_KEY }}')) },
  { item: 0, name: 'a pull_request_target trigger', setup: committed(report('  workflow_dispatch:', '  workflow_dispatch:\n  pull_request_target:')) },

  // Item 1: the turn and tool limits, the time limit and the token.
  { item: 1, name: 'no committed manual workflow', files: { 'README.md': '# demo\n' } },
  { item: 1, name: 'no claude_args', setup: committed(report(`          claude_args: ${ARGS}\n`, '')) },
  { item: 1, name: 'a comment that hides the flags', setup: committed(withArgs(`|\n            --model sonnet # the cheaper model\n            ${ARGS}`)) },
  { item: 1, name: 'the turn limit joined with an equals sign', setup: committed(withArgs(ARGS.replace('--max-turns 8', '--max-turns=8'))) },
  { item: 1, name: 'no turn limit', setup: committed(withArgs(ARGS.replace('--max-turns 8 ', ''))) },
  { item: 1, name: 'a turn limit with no number', setup: committed(withArgs('--allowedTools "Bash(npm run linkcheck *)" --max-turns')) },
  { item: 1, name: 'a turn limit above 10', setup: committed(withArgs(ARGS.replace('--max-turns 8', '--max-turns 50'))) },
  { item: 1, name: 'a turn limit in words', setup: committed(withArgs(ARGS.replace('--max-turns 8', '--max-turns eight'))) },
  { item: 1, name: 'a tool rule split at its spaces', setup: committed(withArgs(ARGS.replace('"Bash(npm run linkcheck *)"', 'Bash(npm run linkcheck *)'))) },
  { item: 1, name: 'all of Bash allowed', setup: committed(withArgs(ARGS.replace('"Bash(npm run linkcheck *)"', 'Bash'))) },
  { item: 1, name: 'no tool allowed', setup: committed(withArgs('--max-turns 8')) },
  { item: 1, name: 'an empty tool list', setup: committed(withArgs(ARGS.replace('"Bash(npm run linkcheck *)"', '""'))) },
  { item: 1, name: 'no time limit', setup: committed(report('    timeout-minutes: 10\n', '')) },
  { item: 1, name: 'a time limit above 30', setup: committed(report('timeout-minutes: 10', 'timeout-minutes: 90')) },
  { item: 1, name: 'no permissions', setup: committed(report('permissions:\n  contents: read\n', '')) },
  { item: 1, name: 'write-all permissions', setup: committed(report('permissions:\n  contents: read', 'permissions: write-all')) },
  { item: 1, name: 'contents write', setup: committed(report('contents: read', 'contents: write')) },
  { item: 1, name: 'no github_token', setup: committed(report('          github_token: ${{ github.token }}\n', '')) },
  { item: 1, name: 'another token', setup: committed(report('${{ github.token }}', '${{ secrets.MY_TOKEN }}')) },

  // Item 2: the saved run list.
  { item: 2, name: 'no saved run list', setup: saved(null) },
  { item: 2, name: 'the table, not JSON', setup: saved('completed  success  Link check report\n') },
  { item: 2, name: 'an empty list', setup: saved([]) },
  { item: 2, name: 'a list without the fields', setup: saved([{ name: 'Link check report' }]) },
  { item: 2, name: 'a run with no URL', setup: saved((sha) => [run(sha, { url: undefined })], { origin: ORIGIN }) },
  // The solutions file names the template's own origin, so this needs one of its own.
  { item: 2, name: 'a run from another repository', setup: saved((sha) => [run(sha, { url: 'https://github.com/someone/else/actions/runs/1' })], { origin: ORIGIN }) },
  { item: 2, name: 'a run still in progress', setup: saved((sha) => [run(sha, { status: 'in_progress', conclusion: '' })]) },
  { item: 2, name: 'a failed run', setup: saved((sha) => [run(sha, { conclusion: 'failure' })]) },
  { item: 2, name: 'a run with no commit', setup: saved((sha) => [run(sha, { headSha: undefined })]) },
  { item: 2, name: 'a run on a commit not pulled', setup: saved(() => [run('0123456789abcdef0123456789abcdef01234567')]) },
  { item: 2, name: 'a run on a commit before the workflow', setup: saved((sha, start) => [run(start)]) },
  { item: 2, name: 'only runs that @claude started', setup: saved((sha) => [run(sha, { event: 'issues' }), run(sha, { event: 'issue_comment' })]) },
  { item: 2, name: 'only a push run', setup: saved((sha) => [run(sha, { event: 'push' })]) },
];
