# Pick the model and effort

<sub>**Intermediate** · Lesson 3 of 8 · about 15 minutes · Needs: [Turn a repeated workflow into a skill](01-first-skill.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-06</sub>

## Goal

By the end of this lesson you can pick a model and an effort level for a task, set them for a session or for one skill, and tell from a wrong result whether to raise the effort or pick a larger model.

## You need

- The repository where you did [lesson 1](01-first-skill.md), with its skills, and your copy of the practice template with Node.js LTS: the check runs from the copy.
- Usage: light. A larger model costs more per token, and a higher effort usually produces more tokens, so either tends to use more of your plan's usage.

## The idea

Two separate choices shape an answer ([Choosing a Claude model and effort level in Claude Code](https://claude.com/blog/claude-model-and-effort-level-in-claude-code)):

- The **model** decides how capable the answer can be.
- The **effort** decides how much work Claude does on each request: how many files it reads, how much it verifies, and how far it goes before it checks back with you ([Model configuration](https://code.claude.com/docs/en/model-config#adjust-effort-level)).

Anthropic's guidance is to start from the model's default effort for most tasks. When a result is wrong, find out why before you turn a knob:

| What happened, or what the task is | What to change |
|---|---|
| Claude lacked context: a vague prompt, a missing tool or skill | The context: the prompt, `CLAUDE.md`, a skill |
| Claude didn't try hard enough: it skipped a file or didn't run the tests | A higher effort |
| Claude had the context, tried, and was still wrong: a subtle bug, an unfamiliar domain, a design decision | A larger model, such as `opus` |
| Routine work: edits you can describe precisely, mechanical changes | A smaller model, such as `sonnet`, and a lower effort ([Choose an effort level](https://code.claude.com/docs/en/model-config#choose-an-effort-level)) |
| Deep planning, then routine work | `opusplan`: Opus in plan mode, then Sonnet to carry out the plan |

Where a choice applies decides how you set it. The [Models and effort](../reference/models.md) page lists the aliases and levels:

| Scope | Model | Effort |
|---|---|---|
| This session | `/model`, then `s` on a row | `/effort`, then `s` in the slider |
| Your default | `/model <alias>` | `/effort <level>` |
| One turn | – | `ultrathink` in the prompt asks for deeper reasoning; the level stays |
| One skill or subagent | `model:` in its frontmatter | `effort:` in its frontmatter |

## Worked example

1. Start `claude` in your repository. Run `/status`: it shows the model. Run `/effort status`: it prints the effort level in force ([Commands](https://code.claude.com/docs/en/commands)).
2. Switch the model for this session only: run `/model`, move to Sonnet and press `s`. `/status` now shows Sonnet, and your default for new sessions is unchanged ([Setting your model](https://code.claude.com/docs/en/model-config#setting-your-model)).
3. Ask for deeper reasoning on one turn, without changing the effort level:

   ```text
   ultrathink: which links could linkcheck report as broken although their file exists?
   ```

   Claude Code recognizes `ultrathink` and asks for deeper reasoning on that turn only. Phrases such as "think hard" are ordinary text ([Use ultrathink](https://code.claude.com/docs/en/model-config#use-ultrathink-for-one-off-deep-reasoning)).
4. Give one task its own effort. `five-whys`, from lesson 1, traces a cause from evidence, where verification matters. Add a line to its frontmatter in `.claude/skills/five-whys/SKILL.md`:

   ```yaml
   effort: high
   ```

   From now on the skill runs at `high` while it's active, over the session's level. An effort set with the `CLAUDE_CODE_EFFORT_LEVEL` variable, and any effort cap, still come first ([Set the effort level](https://code.claude.com/docs/en/model-config#set-the-effort-level)).

## Your turn

Give a routine task the smallest model and effort that do the job.

1. Save this skill as `.claude/skills/changelog/SKILL.md`:

   ```markdown
   ---
   name: changelog
   description: Adds a one-line entry for the staged changes to CHANGELOG.md. Use when the user asks for a changelog entry.
   model: TODO
   effort: TODO
   disable-model-invocation: true
   ---

   Read the staged changes with `git diff --staged`. Add one list item (`- `) under `## Unreleased` in CHANGELOG.md that says what changed for someone using the tool, creating the file and the heading if they don't exist. Change no other file.
   ```

2. Replace both `TODO`s, using the first table. In auto mode, use `sonnet`: auto mode doesn't support Haiku, so a skill set to `haiku` keeps the session's model there ([Eliminate permission prompts with auto mode](https://code.claude.com/docs/en/permission-modes#eliminate-prompts-with-auto-mode)).
3. Stage a small change of your own, run `/changelog`, and approve the edit. If Claude Code says the command is unknown, run `/reload-skills` first.
4. Commit the change, `CHANGELOG.md` and the skill together.

## Check

You are done when all of these are true:

- [ ] The committed skill picks a smaller model and a low or medium effort: `git show HEAD:.claude/skills/changelog/SKILL.md | grep -E '^(model|effort):'` shows both.
- [ ] A committed `CHANGELOG.md` has a `- ` entry under `## Unreleased`: `git show HEAD:CHANGELOG.md` shows it.
- [ ] Self-check (not tested): for a precise rename, a new feature with a clear scope, and a bug Claude keeps getting wrong with all the context, you can say which model and effort you'd pick, and why.

Run `npm run check -- i-3 --dir <your repo>` from your practice copy, or `npm run check -- i-3` in the copy itself.

If the skill check says the model is larger than the task needs, set `model: sonnet`: a change you can describe precisely is routine work. If there's no entry, stage a change before you run `/changelog`, because the skill reads only staged changes.

## Watch out

- `/model <alias>` and `/effort <level>` save your choice as the default for new sessions. To change only the current session, press `s` in the picker or the slider.
- Switching the model mid-session, and on most models changing the effort, makes the next request read the whole conversation with no cache hits; while the cache is warm, Claude Code asks you to confirm ([How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching#switching-models)).
- Set with `/effort`, `max` lasts for the current session only, and it can overthink: test it before you rely on it ([Choose an effort level](https://code.claude.com/docs/en/model-config#choose-an-effort-level)).

## Go further

- [Choosing a Claude model and effort level in Claude Code](https://claude.com/blog/claude-model-and-effort-level-in-claude-code): Anthropic's guide to the two settings, with the "try or know" test this lesson uses.
- [Models and effort](../reference/models.md): the model aliases, the effort levels and the ways to set them.
- [Model configuration](https://code.claude.com/docs/en/model-config): defaults by account and provider, and organization limits.

---

<sub>Sources: [Model configuration](https://code.claude.com/docs/en/model-config) · [Commands](https://code.claude.com/docs/en/commands) · [Choosing a Claude model and effort level in Claude Code](https://claude.com/blog/claude-model-and-effort-level-in-claude-code) · [Extend Claude with skills](https://code.claude.com/docs/en/skills) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching)</sub>

<sub>← [Organize project memory and see what loaded](02-organize-memory.md) · [Intermediate index](README.md) · [Permissions, settings scopes and the sandbox](04-permissions-and-sandbox.md) → · Topic: [Models, effort and cost](../topics/models-effort-and-cost.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=i-3)</sub>
