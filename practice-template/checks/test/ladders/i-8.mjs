// Every FAIL message of Intermediate lesson 8's check, each from a work
// folder that produces it: `files` to write, or `setup(dir, { write, commit })`.
// Each scenario breaks one thing, so one narrow question matches its message.
const SHARED = '.claude/settings.json';
const LIST = '.practice/i-8-plugins.json';
const ID = 'claude-code-setup@claude-plugins-official';
const LSP = 'typescript-lsp@claude-plugins-official';
const settings = (enabledPlugins) => `${JSON.stringify({ permissions: { allow: ['Bash(npm test)'], deny: ['Read(./.env)', 'Read(./.env.*)'] }, enabledPlugins }, null, 2)}\n`;
const TEAM = settings({ [ID]: true });

// Commits the shared file with `text`, so only item 0 can fail.
const shared = (text) => (dir, { write, commit }) => {
  write(dir, { [SHARED]: text });
  commit(dir, 'Turn on claude-code-setup for the project', [SHARED]);
};

// Commits the team's settings and saves `list` as the plugin list, so only
// item 1, or item 2, can fail.
const saved = (list) => (dir, { write, commit }) => {
  shared(TEAM)(dir, { write, commit });
  if (list !== null) write(dir, { [LIST]: list });
};

export const scenarios = [
  { item: 0, name: 'no shared settings file', files: {} },
  { item: 0, name: 'the settings saved but not committed', files: { [SHARED]: TEAM } },
  { item: 0, name: 'the TODO name committed', setup: shared(settings({ 'TODO: claude-code-setup at the official marketplace': true })) },
  { item: 0, name: 'the marketplace named by its repository', setup: shared(settings({ 'claude-code-setup@anthropics/claude-plugins-official': true })) },
  { item: 1, name: 'no saved plugin list', setup: saved(null) },
  { item: 1, name: 'a plugin list cut short', setup: saved('[\n  {\n    "id": "claude-code-setup@claude-plugins-official",\n') },
  { item: 1, name: 'the plugin installed at local scope', setup: saved(`${JSON.stringify([{ id: ID, scope: 'local', enabled: true, projectEnabled: true }], null, 2)}\n`) },

  { item: 2, name: 'no saved plugin list', setup: saved(null) },
  { item: 2, name: 'a plugin list cut short', setup: saved('[\n  {\n    "id": "typescript-lsp@claude-plugins-official",\n') },
  { item: 2, name: 'no code intelligence plugin in the list', setup: saved(`${JSON.stringify([{ id: ID, scope: 'project', enabled: true, projectEnabled: true }], null, 2)}\n`) },
  {
    item: 2,
    name: 'the trial turned on in the committed settings',
    setup(dir, { write, commit }) {
      shared(settings({ [ID]: true, [LSP]: true }))(dir, { write, commit });
      write(dir, { [LIST]: `${JSON.stringify([{ id: LSP, scope: 'local', enabled: true, projectPath: dir }], null, 2)}\n` });
    },
  },
];
