// Every FAIL message of Intermediate lesson 3's check, each from a work
// folder that produces it: `files` to write, or `setup(dir, { write, commit })`.
// Each scenario holds one problem, so its message matches one narrow question.
const SKILL = '.claude/skills/changelog/SKILL.md';
const BODY = 'Read the staged changes with `git diff --staged`. Add one list item (`- `) under `## Unreleased` in CHANGELOG.md that says what changed for someone using the tool, creating the file and the heading if they don\'t exist. Change no other file.\n';

// The skill with its model and effort lines; the page's partial skill when
// both are TODO.
const skill = (model, effort) => [
  '---',
  'name: changelog',
  'description: Adds a one-line entry for the staged changes to CHANGELOG.md. Use when the user asks for a changelog entry.',
  `model: ${model}`,
  `effort: ${effort}`,
  'disable-model-invocation: true',
  '---',
  '',
  BODY,
].join('\n');

// Commits `text` as the skill, as Your turn step 4 does.
const committed = (text) => (dir, { write, commit }) => {
  write(dir, { [SKILL]: text });
  commit(dir, 'Add a changelog skill', [SKILL]);
};

// Commits `text` as CHANGELOG.md beside a change, as Your turn step 4 does.
const changelog = (text) => (dir, { write, commit }) => {
  write(dir, { 'README.md': '# Demo\n\nA small change.\n', 'CHANGELOG.md': text });
  commit(dir, 'Describe the demo', ['README.md', 'CHANGELOG.md']);
};

export const scenarios = [
  { item: 0, name: 'no changelog skill in the work folder', files: {} },
  { item: 0, name: 'the finished skill saved but never committed', files: { [SKILL]: skill('sonnet', 'low') } },
  { item: 0, name: 'the committed skill still says model: TODO', setup: committed(skill('TODO', 'low')) },
  { item: 0, name: 'the committed skill picks opus', setup: committed(skill('opus', 'low')) },
  { item: 0, name: 'the committed skill names a model Claude Code does not know', setup: committed(skill('small', 'low')) },
  { item: 0, name: 'the committed skill still says effort: TODO', setup: committed(skill('sonnet', 'TODO')) },
  { item: 0, name: 'the committed skill asks for high effort', setup: committed(skill('sonnet', 'high')) },

  { item: 1, name: 'no committed CHANGELOG.md', files: { 'CHANGELOG.md': '# Changelog\n\n## Unreleased\n\n- Describe the demo.\n' } },
  { item: 1, name: 'a committed CHANGELOG.md with no Unreleased heading', setup: changelog('# Changelog\n\n## 1.0.0\n\n- First release.\n') },
  { item: 1, name: 'a committed Unreleased heading with no entry under it', setup: changelog('# Changelog\n\n## Unreleased\n\n## 1.0.0\n\n- First release.\n') },
];
