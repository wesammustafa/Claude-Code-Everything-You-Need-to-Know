// Every FAIL message of Intermediate lesson 1's check, each from a work
// folder that produces it: `files` to write, or `setup(dir, { write, commit })`.
// Each scenario holds one problem, so its message matches one narrow question.
const SKILL = '.claude/skills/tdd/SKILL.md';
const DESCRIPTION = 'Builds a feature test-first, one behavior at a time, and shows the diff for review. Use when the user asks for a new function or feature with tests.';
const BODY = [
  '',
  'Build this test-first, one behavior at a time: $ARGUMENTS',
  '',
  '1. Red: write one failing test for the next behavior, and run the tests to see it fail.',
  '2. Green: write the least code that makes the new test pass, then run every test.',
  '3. Refactor: improve the names and structure without changing what the code does, and run the tests again.',
  '',
].join('\n');

// The skill's text, from its frontmatter lines (between the --- lines) and a
// body; a finished skill unless a scenario changes one part.
const skill = (front = ['name: tdd', `description: ${DESCRIPTION}`], body = BODY) => ['---', ...front, '---', body].join('\n');

// Commits `text` as the skill, as Your turn step 3 does.
const committed = (text) => (dir, { write, commit }) => {
  write(dir, { [SKILL]: text });
  commit(dir, 'Add a tdd skill', [SKILL]);
};

// Commits the finished skill, then the reviewed commit of a /tdd run's
// `files`, and saves that commit as Your turn step 4 does.
const saved = (files) => (dir, { write, commit }) => {
  committed(skill())(dir, { write, commit });
  write(dir, files);
  const sha = commit(dir, 'Add slugify', Object.keys(files));
  write(dir, { '.practice/i-1-commit.txt': `${sha}\n` });
};

// A committed .gitignore that matches .claude/, with the finished skill saved
// under it, as a learner whose ignore rule hides the folder from `git add`.
const ignored = (dir, { write, commit }) => {
  write(dir, { '.gitignore': '.claude/\n' });
  commit(dir, 'Ignore .claude', ['.gitignore']);
  write(dir, { [SKILL]: skill() });
};

export const scenarios = [
  { item: 0, name: 'no tdd skill in the work folder', files: {} },
  { item: 0, name: 'the finished skill saved but never committed', files: { [SKILL]: skill() } },
  { item: 0, name: 'an ignore rule hides .claude/ from git add, so the finished skill is saved but never committed', setup: ignored },
  { item: 0, name: 'the committed skill still has the Green and Refactor TODOs', setup: committed(skill(undefined, `${BODY}\n2. Green: TODO\n3. Refactor: TODO\n`)) },

  { item: 1, name: 'no tdd skill in the work folder', files: {} },
  { item: 1, name: 'the finished skill saved but never committed', files: { [SKILL]: skill() } },
  { item: 1, name: 'an ignore rule hides .claude/ from git add, so the finished skill is saved but never committed', setup: ignored },
  { item: 1, name: 'the committed skill has no frontmatter', setup: committed(BODY) },
  { item: 1, name: 'disable-model-invocation: true still in the committed frontmatter', setup: committed(skill(['name: tdd', `description: ${DESCRIPTION}`, 'disable-model-invocation: true'])) },
  { item: 1, name: 'user-invocable: false in the committed frontmatter', setup: committed(skill(['name: tdd', `description: ${DESCRIPTION}`, 'user-invocable: false'])) },
  { item: 1, name: 'the frontmatter names another skill', setup: committed(skill(['name: test-first', `description: ${DESCRIPTION}`])) },
  { item: 1, name: 'a description too short to say when to use it', setup: committed(skill(['name: tdd', 'description: Test-first features.'])) },

  { item: 2, name: 'no commit saved', setup: committed(skill()) },
  {
    item: 2,
    name: 'a commit this repository does not have',
    setup(dir, { write, commit }) {
      committed(skill())(dir, { write, commit });
      write(dir, { '.practice/i-1-commit.txt': '0123456789abcdef0123456789abcdef01234567\n' });
    },
  },
  {
    item: 2,
    name: 'the saved commit is the skill commit, as when the run\'s work was never committed',
    setup(dir, { write, commit }) {
      write(dir, { [SKILL]: skill() });
      const sha = commit(dir, 'Add a tdd skill', [SKILL]);
      write(dir, { '.practice/i-1-commit.txt': `${sha}\n` });
    },
  },
  { item: 2, name: 'the saved commit holds the code without its test', setup: saved({ 'src/slug.js': 'export const slugify = (heading) => heading.toLowerCase();\n' }) },
];
