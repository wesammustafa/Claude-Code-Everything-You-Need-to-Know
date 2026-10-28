// Pick the model and effort (Intermediate, lesson 3). The Learner fills in
// the model and effort of a skill for a routine, precisely described task,
// and commits the entry a /changelog run wrote. Picking the model and effort
// for other tasks is judgement, self-checked here and at the capstone.
import { frontmatter } from '../frontmatter.mjs';

export const title = 'Pick the model and effort';

const SKILL = '.claude/skills/changelog/SKILL.md';
const SMALL = /^(sonnet|claude-sonnet-[\w.-]+)(\[1m\])?$|^(haiku|claude-haiku-[\w.-]+)$/;
const LARGE = /^(opus|fable|best|opusplan|claude-opus-[\w.-]+|claude-fable-[\w.-]+)(\[1m\])?$/;
const LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'];

function committed(repo, path) {
  try {
    return repo.git('show', `HEAD:${path}`);
  } catch {
    return null;
  }
}

export const items = [
  {
    text: 'the committed changelog skill runs a smaller model at low or medium effort',
    check(repo) {
      const text = committed(repo, SKILL);
      if (text === null) return repo.exists(SKILL) ? `${SKILL} is not committed. Run \`git add ${SKILL}\` and commit it.` : `There is no ${SKILL}. Save the partial skill from the lesson's Your turn there.`;
      const fields = frontmatter(text)?.fields ?? {};
      const model = String(fields.model ?? '').trim();
      const effort = String(fields.effort ?? '').trim();
      if (!model || model === 'TODO') return 'Set `model:` in the skill: the alias of the model this task needs, such as `haiku`.';
      if (LARGE.test(model)) return `\`model: ${model}\` picks a larger model than this task needs: a change you can describe precisely is routine work. Use \`haiku\` where it resolves to Haiku 5.5, as on the Anthropic API, or \`sonnet\`.`;
      if (!SMALL.test(model)) return `\`model: ${model}\` isn't a model alias or name Claude Code knows. Use \`sonnet\` or \`haiku\`.`;
      if (!LEVELS.includes(effort)) return `Set \`effort:\` to one of ${LEVELS.join(', ')}.`;
      if (LEVELS.indexOf(effort) > 1) return `\`effort: ${effort}\` asks for a higher effort than a routine, reviewed change needs. Use \`low\` or \`medium\`.`;
      return true;
    },
  },
  {
    text: 'a committed CHANGELOG.md has an entry under `## Unreleased`',
    check(repo) {
      const text = committed(repo, 'CHANGELOG.md');
      const hint = 'Stage a small change, run `/changelog`, and commit the change with the entry it writes.';
      if (text === null) return `There is no committed CHANGELOG.md. ${hint}`;
      const lines = text.split(/\r?\n/);
      // Keep a Changelog writes the heading `## [Unreleased]`: a learner's own
      // changelog may already hold it, and the entry goes under it.
      const at = lines.findIndex((l) => /^##\s+(\[Unreleased\]|Unreleased\b)/i.test(l.trim()));
      if (at === -1) return `CHANGELOG.md has no \`## Unreleased\` heading. ${hint}`;
      const next = lines.slice(at + 1).findIndex((l) => /^#{1,2}\s/.test(l));
      const section = lines.slice(at + 1, next === -1 ? undefined : at + 1 + next);
      return section.some((l) => /^\s*[-*]\s+\S/.test(l)) ? true : `\`## Unreleased\` in CHANGELOG.md has no entry. ${hint}`;
    },
  },
];
