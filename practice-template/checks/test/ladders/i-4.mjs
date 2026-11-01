// Every FAIL message of Intermediate lesson 4's check, each from a work
// folder that produces it: `files` to write, or `setup(dir, { write, commit })`.
// Each scenario breaks one thing, so one narrow question matches its message.
const SHARED = '.claude/settings.json';
const LOCAL = '.claude/settings.local.json';
const rules = (allow, deny = ['Read(./.env)', 'Read(./.env.*)']) => `${JSON.stringify({ permissions: { allow, deny } }, null, 2)}\n`;
const TEAM = rules(['Bash(npm test)']);
const SANDBOX = '{\n  "sandbox": {\n    "enabled": true\n  }\n}\n';

// Commits the shared file with `text`, and leaves the sandbox on in the
// uncommitted personal file, so only item 0 can fail.
const shared = (text) => (dir, { write, commit }) => {
  write(dir, { [SHARED]: text });
  commit(dir, 'Add team permission rules', [SHARED]);
  write(dir, { [LOCAL]: SANDBOX });
};

// Commits the team's rules, so only item 1 can fail.
const team = (dir, { write, commit }) => {
  write(dir, { [SHARED]: TEAM });
  commit(dir, 'Add team permission rules', [SHARED]);
};

export const scenarios = [
  { item: 0, name: 'no shared settings file', files: { [LOCAL]: SANDBOX } },
  { item: 0, name: 'the shared file saved but not committed', files: { [SHARED]: TEAM, [LOCAL]: SANDBOX } },
  { item: 0, name: 'a trailing comma in the committed file', setup: shared('{\n  "permissions": {\n    "allow": ["Bash(npm test)"],\n    "deny": ["Read(./.env)", "Read(./.env.*)"],\n  }\n}\n') },
  { item: 0, name: 'the partial file committed with its TODOs', setup: shared(rules(['TODO: the command that runs your tests'], ['TODO: reading .env', 'TODO: reading .env.local and the other .env.* files'])) },
  { item: 0, name: 'no deny rule for .env itself', setup: shared(rules(['Bash(npm test)'], ['Read(./.env.*)'])) },
  { item: 0, name: 'no deny rule for the .env.* files', setup: shared(rules(['Bash(npm test)'], ['Read(./.env)'])) },
  { item: 0, name: 'a broad allow rule', setup: shared(rules(['Bash(npm *)'])) },
  { item: 0, name: 'no allow rule for a command', setup: shared(rules([])) },
  {
    item: 1,
    name: 'the personal file committed',
    setup(dir, helpers) {
      team(dir, helpers);
      helpers.write(dir, { [LOCAL]: SANDBOX });
      helpers.commit(dir, 'Add my settings', [LOCAL]);
    },
  },
  {
    item: 1,
    name: 'a personal file that does not parse',
    setup(dir, helpers) {
      team(dir, helpers);
      helpers.write(dir, { [LOCAL]: '{\n  "sandbox": {\n    "enabled": true,\n  }\n}\n' });
    },
  },
  { item: 1, name: 'the sandbox never turned on', setup: team },
  {
    item: 1,
    name: 'a local disable overrides the shared sandbox enable',
    setup(dir, helpers) {
      helpers.write(dir, { [SHARED]: JSON.stringify({ permissions: { allow: ['Bash(npm test)'], deny: ['Read(./.env)', 'Read(./.env.*)'] }, sandbox: { enabled: true } }) });
      helpers.commit(dir, 'Share sandbox settings', [SHARED]);
      helpers.write(dir, { [LOCAL]: JSON.stringify({ sandbox: { enabled: false } }) });
    },
  },

  { item: 2, name: 'no committed shared settings file', files: { [SHARED]: TEAM } },
  { item: 2, name: 'the partial ask rule committed with its TODO', setup: shared(`${JSON.stringify({ permissions: { allow: ['Bash(npm test)'], ask: ['TODO: a command the team approves each time'], deny: ['Read(./.env)', 'Read(./.env.*)'] } }, null, 2)}\n`) },
  { item: 2, name: 'the push rule under deny, and no ask rule', setup: shared(`${JSON.stringify({ permissions: { allow: ['Bash(npm test)'], deny: ['Read(./.env)', 'Read(./.env.*)', 'Bash(git push *)'] } }, null, 2)}\n`) },
];
