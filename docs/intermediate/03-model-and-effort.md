# Pick the model and effort

<sub>**Intermediate** · Lesson 3 of 8 · about 20 minutes · Needs: [Turn a repeated workflow into a skill](01-first-skill.md) · Verified against Claude Code v2.1.292 (stable) on 2026-10-21</sub>

## Goal

By the end of this lesson you can diagnose a weak result before changing models, choose model and effort settings for a real task, and give a routine skill its own settings.

## You need

- The repository where you did [lesson 1](01-first-skill.md), with its committed skills, and a small change you intend to make. Use a terminal in that repository for edits and Git; use your practice copy only for the final check.
- Usage: light. You will request a short investigation and a changelog entry.

## The idea

The [model aliases](https://code.claude.com/docs/en/model-config#model-aliases) include `sonnet` for daily coding and `opus` for complex reasoning. Model choice sets the capability you start with; [effort](https://code.claude.com/docs/en/model-config#choose-an-effort-level) changes how much reasoning and verification Claude applies. See the [model descriptions](https://platform.claude.com/docs/en/about-claude/models/overview).

Before escalating, inspect the evidence:

| Evidence | Next experiment |
|---|---|
| A relevant file or failing example was missing | Supply it and retry |
| Claude skipped verification despite having the context | Try more effort |
| Context and verification were adequate, but the reasoning still failed | Try a more capable model |
| A precise, routine change will be reviewed | Try a smaller model with lower effort |

Change one variable, then compare against the same success criterion. Higher effort cannot supply a missing fixture.

A skill's [`model:` and `effort:` frontmatter](https://code.claude.com/docs/en/skills#frontmatter-reference) overrides the session while it is active. It need not give every task the same settings.

## Worked example

1. Start `claude` in your repository. Run `/status`: it shows the model. Run `/effort status`: it prints the effort level in force ([Commands](https://code.claude.com/docs/en/commands)). Notice what your session actually shows; the account and provider affect the available models.
2. Switch the model for this session only: run `/model`, move to Sonnet and press `s`. Run `/status` again to check the selected model. Your default for new sessions is unchanged ([Setting your model](https://code.claude.com/docs/en/model-config#setting-your-model)). Stay in auto mode for this lesson.
3. Investigate an error path in your own repository, without making an edit:

   ```text
   ultrathink: read the code and tests for one error path in this repository. Identify a case the tests might miss. Cite the files you used. Do not edit files or run network requests.
   ```

   `ultrathink` requests deeper reasoning for this turn without changing the session effort setting ([Use ultrathink](https://code.claude.com/docs/en/model-config#use-ultrathink-for-one-off-deep-reasoning)). Open a cited file and check whether the suspected gap is real. A plausible answer alone is not evidence.
4. Give the diagnostic skill its own effort. Add this line inside the frontmatter of `.claude/skills/five-whys/SKILL.md`:

   ```yaml
   effort: high
   ```

   `five-whys` investigates a cause from evidence, where verification matters. The skill overrides the session effort while active; an effort environment variable and any effort cap still take precedence ([Set the effort level](https://code.claude.com/docs/en/model-config#set-the-effort-level)). Review the skill diff and keep it for the final commit.

## Your turn

Tune a routine writing task differently from the diagnostic task. Decide what counts as a useful entry before you run it: the entry must describe the staged change for someone using your project.

1. Save this partial skill as `.claude/skills/changelog/SKILL.md`. Its `disable-model-invocation: true` field keeps invocation under your control ([Control who invokes a skill](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill)).

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

2. Choose the settings for a short entry whose input is an exact staged diff and whose output you will review. Use `model: sonnet` for this auto-mode exercise, and choose `effort: low` or `effort: medium`. Explain why this task needs different settings from a cause investigation. At this lesson's baseline, Haiku is not supported in auto mode, and an unsupported skill model leaves the session model in use ([Auto mode](https://code.claude.com/docs/en/permission-modes#eliminate-prompts-with-auto-mode), [skill model overrides](https://code.claude.com/docs/en/skills#frontmatter-reference)).
3. Make a small intended change in your repository. Review and stage only that change, keeping unrelated work out of the staged diff. Run `/changelog`. Review any permission request if one appears; auto mode may allow the edit without one. If the skill is unknown, run `/reload-skills` and retry. Read the new entry against the staged diff. If it invents a benefit or names only an internal implementation detail, correct the entry before committing.
4. Review the complete diff. Commit it with `CHANGELOG.md` and both skills. Check that the commit includes the diagnostic skill's effort line too.

## Check

You are done when all of these are true:

- [ ] The committed skill picks a smaller model and a low or medium effort: `git show HEAD:.claude/skills/changelog/SKILL.md | grep -E '^(model|effort):'` shows both.
- [ ] A committed `CHANGELOG.md` has a `- ` entry under `## Unreleased`: `git show HEAD:CHANGELOG.md` shows it.
- [ ] Self-check (not tested): you checked the investigation against a cited file and the entry against the staged diff, and can explain why the tasks use different settings.

Run `npm run check -- i-3 --dir <your repo>` from your practice copy, or `npm run check -- i-3` in the copy itself.

If the skill check says the model is larger than the task needs, revisit the precise input and reviewed output in Your turn step 2. If there's no entry, stage a change before you run `/changelog`, because the skill reads only staged changes.

## Watch out

- `/model <alias>` and `/effort <level>` save your choice as the default for new sessions. To change only the current session, press `s` in the picker or the slider.
- A model switch makes the next request read the conversation without cache hits. Claude Code may ask you to confirm while the cache is warm ([Switching models](https://code.claude.com/docs/en/prompt-caching#switching-models)).

## Go further

- [Models and effort](../reference/models.md): model aliases, effort levels and where each setting applies.
- [Model configuration](https://code.claude.com/docs/en/model-config): defaults by account and provider, and organization limits.
- [Choosing a Claude model and effort level in Claude Code](https://claude.com/blog/claude-model-and-effort-level-in-claude-code): Anthropic's guidance on choosing the next experiment after a weak result.

---

<sub>Sources: [Model configuration](https://code.claude.com/docs/en/model-config) · [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview) · [Commands](https://code.claude.com/docs/en/commands) · [Extend Claude with skills](https://code.claude.com/docs/en/skills) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching)</sub>

<sub>← [Organize project memory and see what loaded](02-organize-memory.md) · [Intermediate index](README.md) · [Permissions, settings scopes and the sandbox](04-permissions-and-sandbox.md) → · Topic: [Models, effort and cost](../topics/models-effort-and-cost.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=i-3)</sub>
