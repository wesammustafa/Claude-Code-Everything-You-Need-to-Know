# Skill patterns: live data, supporting files and a context of its own

<sub>**Intermediate** · Elective · about 20 minutes · Needs: [Turn a repeated workflow into a skill](../01-first-skill.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-06</sub>

## Goal

By the end of this Elective you can write a skill that pulls live data into its prompt, keeps long reference material in a separate file, and runs in its own subagent.

## You need

- A repository with some uncommitted changes to review, and the skills from [lesson 1](../01-first-skill.md).
- Usage: light.

## The idea

Lesson 1's skills were instructions and `$ARGUMENTS`. A few more patterns make a skill do more with less context ([Extend Claude with skills](https://code.claude.com/docs/en/skills)):

| Pattern | Written as | What it does |
|---|---|---|
| Live data | `` !`git diff HEAD` `` in the body | Claude Code runs the command before Claude reads the skill, and puts its output in its place |
| Supporting files | Files beside `SKILL.md`, linked from it | Long reference material that Claude reads only when it needs it |
| A context of its own | `context: fork` in the frontmatter | The skill becomes a subagent's prompt, and the subagent runs in the background. It doesn't see your conversation, and its result arrives when it finishes |
| Named arguments | `arguments: [focus]`, then `$focus` | Each word you type after the name fills its own placeholder |
| Tool grants | `allowed-tools: Read, Grep` | Claude may use these tools without asking, during the turn that runs the skill. It removes no other tool |

Keep `SKILL.md` short: once a skill runs, its whole text stays in the conversation. The docs suggest under 500 lines, with detail moved to supporting files.

## Worked example

1. Save this as `.claude/skills/changes-review/SKILL.md`:

   ```markdown
   ---
   name: changes-review
   description: Reviews the uncommitted changes in this repository against the team checklist. Use when the user asks for a review before committing.
   context: fork
   allowed-tools: Bash(git diff *)
   ---

   ## Changes

   !`git diff HEAD`

   ## Your task

   Review the changes above against [checklist.md](checklist.md). Report each problem with its file and line, then one line on whether the change is ready to commit.
   ```

2. Save the checklist beside it, as `.claude/skills/changes-review/checklist.md`:

   ```markdown
   - Every changed function has a test.
   - Errors are reported, not swallowed.
   - No secrets in code or config.
   ```

3. Make a small change in a source file, start `claude` and run `/changes-review`. Claude Code runs `git diff HEAD` and puts its output in the skill, then starts a subagent with it. The subagent reads the checklist, and its report arrives in your conversation when it finishes. The `allowed-tools` rule pre-approves `git diff` commands. `git diff HEAD` is read-only and would run without it, but outside auto mode an injected command your permission rules don't allow stops the skill.
4. For another skill that pre-approves tools, read this guide's [`claude-md-review`](../../../.claude/skills/claude-md-review/SKILL.md). Its `allowed-tools: Read, Glob, Grep` lets it read files without prompts; it doesn't stop Claude from using other tools ([Pre-approve tools for a skill](https://code.claude.com/docs/en/skills#pre-approve-tools-for-a-skill)).

## Your turn

Make the review take a focus:

1. Add `arguments: [focus]` to the frontmatter of `changes-review`.
2. Change the task to put the review's focus first: `Review the changes above against checklist.md, looking hardest at $focus.`
3. Run `/changes-review tests`, then `/changes-review secrets`, and compare the two reports.

## Check

You are done when all of these are true:

- [ ] `head -8 .claude/skills/changes-review/SKILL.md` shows `context: fork` and `arguments: [focus]`.
- [ ] `grep -c 'git diff HEAD' .claude/skills/changes-review/SKILL.md` prints 1, and `checklist.md` sits beside `SKILL.md`.
- [ ] Self-check (not tested): the two reports looked hardest at different things.

If `/changes-review` stops with `Shell command failed` or `Shell command permission check failed`, run `git diff HEAD` yourself, and check the `allowed-tools` line: an injected command that fails, or that your permission rules don't allow, aborts the whole skill ([Inject dynamic context](https://code.claude.com/docs/en/skills#inject-dynamic-context)).

## Go further

- [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices): how to write descriptions, structure supporting files and test a skill.
- [anthropics/skills](https://github.com/anthropics/skills): Anthropic's example skills. Some are source-available rather than open source, so read each one's license before you copy it.
- [Troubleshooting](https://code.claude.com/docs/en/skills#troubleshooting): skills that don't trigger, trigger too often, or stop being followed.

---

<sub>Sources: [Extend Claude with skills](https://code.claude.com/docs/en/skills) · [anthropics/skills](https://github.com/anthropics/skills)</sub>

<sub>Back to the [Intermediate index](../README.md) · Topic: [Skills](../../topics/skills.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=i-skill-patterns)</sub>
