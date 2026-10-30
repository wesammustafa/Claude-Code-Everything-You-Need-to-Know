// @ts-check
// Delegate to a custom subagent (Intermediate, lesson 6). The Learner
// finishes a read-only test-gaps subagent, commits it, and delegates to it in
// a session started with a SubagentStart hook that logs each subagent's name.
import { frontmatter } from '../frontmatter.mjs';
/** @import { Repo } from '../repo.mjs' */
/** @import { Item } from './index.mjs' */

export const title = 'Delegate to a custom subagent';

const AGENT = '.claude/agents/test-gaps.md';
// The tools a code-reading subagent needs; the web tools stay out too.
const READ_ONLY = new Set(['Read', 'Grep', 'Glob', 'LSP']);
const WEB = new Set(['WebFetch', 'WebSearch']);

/** @param {Repo} repo */
function committedFields(repo) {
  try {
    return frontmatter(repo.git('show', `HEAD:${AGENT}`))?.fields ?? {};
  } catch {
    return null;
  }
}

/** @param {Repo} repo */
function missing(repo) {
  return repo.exists(AGENT) ? `${AGENT} is not committed. Run \`git add ${AGENT}\` and commit it.` : `There is no ${AGENT}. Save the partial file from the lesson's Your turn there.`;
}

const list = (/** @type {unknown} */ value) => (Array.isArray(value) ? value : String(value ?? '').split(','))
  .map((t) => t.trim()).filter(Boolean);

/** @type {Item[]} */
export const items = [
  {
    text: '`.claude/agents/test-gaps.md` is committed with its name and a description of when to use it',
    check(repo) {
      const fields = committedFields(repo);
      if (fields === null) return missing(repo);
      if (fields.name !== 'test-gaps') return `The frontmatter name is "${fields.name ?? ''}". Set \`name: test-gaps\`: Claude Code skips an agent file without a name.`;
      const description = String(fields.description ?? '').trim();
      const words = description.split(/\s+/).filter((w) => w && w !== 'TODO').length;
      return words >= 8 ? true : 'Write a description of a sentence or two: what the subagent does and when Claude should hand it work. Claude reads it to decide when to delegate.';
    },
  },
  {
    text: 'its `tools` list only reads code: no tool that edits files, runs commands or reaches the web',
    check(repo) {
      const fields = committedFields(repo);
      if (fields === null) return missing(repo);
      const tools = list(fields.tools);
      if (!tools.length || tools.includes('TODO')) return 'Fill in `tools:` with the read-only tools it needs, such as `Read, Grep, Glob`. Without the field, a subagent inherits every tool.';
      const extra = tools.filter((t) => !READ_ONLY.has(t) && !WEB.has(t));
      if (extra.length) return `${extra.join(', ')} would let it change files or run commands, so it isn't read-only. Keep tools such as Read, Grep and Glob.`;
      const web = tools.filter((t) => WEB.has(t));
      return web.length ? `${web.join(', ')} reaches the web, which a subagent that reads your code doesn't need. Keep Read, Grep and Glob.` : true;
    },
  },
  {
    text: '`.practice/i-6-agents.txt` shows Claude delegating to test-gaps',
    local: true,
    check(repo) {
      const log = repo.read('.practice/i-6-agents.txt');
      if (log === null) return 'There is no log. Start the session with `claude --settings .practice/i-6-hook.json`, the hook file from the lesson, then delegate to the subagent.';
      return log.split(/\r?\n/).map((l) => l.trim()).includes('test-gaps') ? true : 'The log has no `test-gaps` line, so Claude didn\'t delegate to it. In a session started with the hook, ask: "Use the test-gaps agent to list the functions no test calls."';
    },
  },
];
