// Every FAIL message of Intermediate lesson 6's check, each from a work
// folder that produces it: `files` to write, or `setup(dir, { write, commit })`.
// Each scenario breaks one thing, so one narrow question matches its message.
const AGENT = '.claude/agents/test-gaps.md';
const LOG = '.practice/i-6-agents.txt';
const agent = (fields) => `---\n${fields}\n---\n\nYou find code that no test exercises. You never change files.\n`;
const GOOD = 'name: test-gaps\ndescription: Finds exported functions that no test calls. Use when you want to know where tests are missing.\ntools: Read, Grep, Glob';
const good = agent(GOOD);
const swap = (pattern, line) => agent(GOOD.replace(pattern, line));

// Commits the subagent file with `text`, so only the item that reads that
// part of it can fail.
const committed = (text) => (dir, { write, commit }) => {
  write(dir, { [AGENT]: text });
  commit(dir, 'Add a test-gaps subagent', [AGENT]);
};

export const scenarios = [
  { item: 0, name: 'no subagent file', files: { 'README.md': '# A project\n' } },
  { item: 0, name: 'the subagent saved but not committed', files: { [AGENT]: good } },
  { item: 0, name: 'a committed name other than test-gaps', setup: committed(swap(/^name: .*$/m, 'name: gaps')) },
  { item: 0, name: 'the committed description still TODO', setup: committed(swap(/^description: .*$/m, 'description: TODO')) },
  { item: 1, name: 'no subagent file', files: { 'README.md': '# A project\n' } },
  { item: 1, name: 'the subagent saved but not committed', files: { [AGENT]: good } },
  { item: 1, name: 'the committed tools still TODO', setup: committed(swap(/^tools: .*$/m, 'tools: TODO')) },
  { item: 1, name: 'the committed file has no tools line', setup: committed(agent(GOOD.replace(/\ntools: .*$/m, ''))) },
  { item: 1, name: 'Bash among the committed tools', setup: committed(swap(/^tools: .*$/m, 'tools: Read, Grep, Glob, Bash')) },
  { item: 1, name: 'WebFetch among the committed tools', setup: committed(swap(/^tools: .*$/m, 'tools: Read, Grep, Glob, WebFetch')) },
  { item: 2, name: 'no delegation log', files: { 'README.md': '# A project\n' } },
  { item: 2, name: 'a log with only a built-in subagent', files: { [LOG]: 'Explore\n' } },
];
