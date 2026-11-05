// @ts-check
// Turn a repeated workflow into a skill (Intermediate, lesson 1). The Learner
// finishes the partial tdd skill so it runs by name and loads on its own,
// commits it, and saves the commit they made after reviewing a /tdd run's
// diff. Whether Claude loaded the skill on its own, and kept it out of a
// question, shows only in a session, so the lesson self-checks it.
import { flag, frontmatter } from '../frontmatter.mjs';
import { isTestFile } from '../paths.mjs';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Turn a repeated workflow into a skill';

const SKILL = '.claude/skills/tdd/SKILL.md';
const SAVE_COMMIT = '`git rev-parse HEAD > .practice/i-1-commit.txt`';

/** @param {Repo} repo */
function committedSkill(repo) {
  try {
    return repo.git('show', `HEAD:./${SKILL}`);
  } catch {
    return null;
  }
}

/** @param {Repo} repo */
function missing(repo) {
  if (repo.exists(SKILL)) return `${SKILL} is not committed. Run \`git add ${SKILL}\` and commit it.`;
  return `There is no ${SKILL}. Save the partial skill from the lesson's Your turn there, finish it, and commit it.`;
}

/** @type {Item[]} */
export const items = [
  {
    text: '`.claude/skills/tdd/SKILL.md` is committed, with no TODO left',
    check(repo) {
      const text = committedSkill(repo);
      if (text === null) return missing(repo);
      const todo = text.split(/\r?\n/).flatMap((line, i) => (/\bTODO\b/.test(line) ? [i + 1] : []));
      if (!todo.length) return true;
      return `The committed skill still has TODO on line${todo.length > 1 ? 's' : ''} ${todo.join(', ')}. Write the description and the Green and Refactor steps, then commit the file again.`;
    },
  },
  {
    text: 'the tdd skill can run as `/tdd` and load on its own: a description, and no `disable-model-invocation: true`',
    check(repo) {
      const text = committedSkill(repo);
      if (text === null) return missing(repo);
      const fm = frontmatter(text);
      if (!fm) return `${SKILL} must start with frontmatter between two --- lines.`;
      const { fields } = fm;
      // The folder name invokes a project skill whatever its frontmatter
      // `name` says, so `/tdd` runs it under any name.
      //
      // Each message echoes the parsed value, without the quotes or comment
      // the line may have. The learn copy's narrows match `: true` and
      // `: false`, the spellings the lesson's skill uses.
      const manual = fields['disable-model-invocation'];
      const hidden = fields['user-invocable'];
      if (flag(manual) === true) return `Delete the \`disable-model-invocation: ${manual}\` line and commit again: it stops Claude from loading the skill on its own.`;
      if (flag(hidden) === false) return `Delete the \`user-invocable: ${hidden}\` line and commit again: it stops \`/tdd\` from running the skill.`;
      const description = typeof fields.description === 'string' ? fields.description.trim() : '';
      const words = description.split(/\s+/).filter((w) => w && w !== 'TODO').length;
      if (words < 8) return 'Write a description of a sentence or two: what it does and when Claude should use it.';
      return true;
    },
  },
  {
    text: 'the commit in `.practice/i-1-commit.txt` changes a test and the code it tests',
    local: true,
    check(repo) {
      const saved = repo.read('.practice/i-1-commit.txt');
      if (saved === null || !saved.trim()) return `After you review and commit the /tdd run's test and code, run ${SAVE_COMMIT}.`;
      const sha = /** @type {string} */ (saved.trim().split(/\s+/)[0]);
      let files;
      try {
        files = repo.git('show', '--name-only', '--format=', sha).split('\n').filter(Boolean).map((f) => repo.local(f));
      } catch {
        return `\`.practice/i-1-commit.txt\` names ${sha}, which is not a commit in this repository.`;
      }
      const tests = files.filter(isTestFile);
      const code = files.filter((f) => !isTestFile(f) && !/\.md$/i.test(f) && !f.startsWith('.claude/'));
      if (tests.length && code.length) return true;
      return `That commit should hold a test and the code it tests. Run /tdd, review the diff, commit both, then ${SAVE_COMMIT}.`;
    },
  },
];
