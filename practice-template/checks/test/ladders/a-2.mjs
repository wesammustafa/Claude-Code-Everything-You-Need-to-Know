// Every FAIL message of Advanced lesson 2's check, each from a work folder
// that produces it: `files` to write, or `setup(dir, { write, commit })`.
// Each scenario breaks one thing, so one narrow question matches its message.
const CHOICES = '.practice/a-2-choices.md';
const LOG = '.practice/i-6-agents.txt';
const HOOK = '.practice/i-6-hook.json';

// The five jobs' right patterns, one line each, with job `n` changed to
// `line` (or dropped when `line` is null).
const RIGHT = {
  1: '1: subagents because each file is checked once and reported back',
  2: '2: workflow because every finding is confirmed and it reruns each release',
  3: '3: main conversation because the edits and the build share one context',
  4: '4: subagents because each suspect is checked on its own and reported back',
  5: '5: /batch because each package changes and lands on its own',
};
const choices = (n, line) => `${Object.entries(RIGHT).map(([k, l]) => (Number(k) === n ? line : l)).filter((l) => l !== null).join('\n')}\n`;

export const scenarios = [
  { item: 0, name: 'no choices file', files: { 'README.md': '# A project\n' } },
  { item: 0, name: 'a file with no job lines', files: { [CHOICES]: 'Subagents for the audit, a workflow for the checklist.\n' } },
  { item: 0, name: 'no line for job 4', files: { [CHOICES]: choices(4, null) } },
  { item: 0, name: 'job 2 names something else', files: { [CHOICES]: choices(2, '2: a script because it reruns') } },
  { item: 0, name: 'job 5 names nothing', files: { [CHOICES]: choices(5, '5:') } },
  { item: 0, name: 'job 1 on two lines that disagree', files: { [CHOICES]: `${choices(0, null)}1: workflow because it is big\n` } },
  { item: 0, name: 'job 3 picked as subagents', files: { [CHOICES]: choices(3, '3: subagents because there are 40 files') } },
  { item: 1, name: 'no log and no hook file', files: { 'README.md': '# A project\n' } },
  { item: 1, name: 'no log, with the hook file saved', files: { [HOOK]: '{"hooks":{}}\n' } },
  { item: 1, name: 'an empty log', files: { [LOG]: '\n\n' } },
  { item: 1, name: 'one subagent started after test-gaps', files: { [LOG]: 'test-gaps\nExplore\n' } },
  { item: 1, name: 'only lesson 6\'s test-gaps', files: { [LOG]: 'test-gaps\n' } },
];
