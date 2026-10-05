# Learn from Claude Code itself

<sub>**Beginner** · Elective · about 20 minutes · Needs: [Install, sign in and look around](../01-install-and-look-around.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

## Goal

By the end of this Elective you can use Claude Code's built-in teaching aids: `/powerup`, the Learning and Explanatory output styles, and its guide to its own features.

## You need

- Your copy of the practice template with no uncommitted changes.
- Usage: light.

## The idea

Claude Code can teach you while you work. Three aids are built in:

- **`/powerup`** runs quick interactive lessons on Claude Code's features, with animated demos ([Commands](https://code.claude.com/docs/en/commands)).
- **Output styles** change how Claude answers ([Output styles](https://code.claude.com/docs/en/output-styles)). In the **Explanatory** style, Claude adds short `Insight` blocks that explain the choices behind its code. The **Learning** style adds the same blocks and also leaves a few lines of real decisions for you to write.
- **The guide to Claude Code**: `claude-code-guide` is a built-in helper for questions about Claude Code's own features ([Create custom subagents](https://code.claude.com/docs/en/sub-agents)). Name it in your prompt, or Claude may answer from its own knowledge instead.

Why write some of the code yourself? In an Anthropic study, developers who learned a new library with an AI assistant scored lower, on average, on a quiz about it than developers who coded by hand. The ones who scored well used the assistant to ask questions and get explanations, not just to produce code ([How AI assistance impacts the formation of coding skills](https://www.anthropic.com/research/AI-assistance-coding-skills)). The Learning style builds that habit in.

## Worked example

1. Start `claude` in your practice copy and run `/powerup`. Pick a lesson, try what it shows, and follow the hints on screen. A lesson counts as finished when you press `Enter` on its card (`Enter to mark done`). If a `/powerup` lesson names a `default` mode, that is Manual mode ([Choose a permission mode](https://code.claude.com/docs/en/permission-modes)), which [lesson 2](../02-permission-modes-and-plan-mode.md) covers.
2. Switch the output style:

   ```text
   /output-style learning
   ```

   Claude Code saves the choice to `.claude/settings.local.json` in this project, so every session you start here keeps this style until you run `/output-style default`. Your turn ends with that step; if you stop before it, run it yourself.
3. Ask for a small change that leaves a decision to you:

   ```text
   Add a function to src/links.js that counts the external links on a page, with a test. Leave the decision about repeated links to me.
   ```

   Claude explains its choices in `Insight` blocks, though not in every reply. When it reaches that decision, it adds a `TODO(human)` comment to the file and stops with a `Learn by Doing` request that says what to write ([Output styles](https://code.claude.com/docs/en/output-styles#learning)). Open the file it names in your editor, write your lines at the `TODO(human)` comment, save, and tell Claude you're done. Claude comments on your code and finishes the task; if it doesn't run the tests, ask it to. A style is an instruction, not a guarantee: if Claude writes all the code itself, ask it to leave the repeated-links decision to you.
4. When the tests pass, set the change aside so later lessons start clean. Open a second terminal in the same folder and run:

   ```bash
   git stash push --include-untracked -m b-teachers
   ```

5. Back in Claude Code, ask about Claude Code itself, and name the helper so Claude hands the question to it ([Invoke subagents explicitly](https://code.claude.com/docs/en/sub-agents#invoke-subagents-explicitly)):

   ```text
   Use the claude-code-guide agent: how do I make my own slash command in Claude Code?
   ```

   When Claude hands it over, the transcript shows a `claude-code-guide(...)` row with a short task description in the brackets. If no such row appears, Claude answered without the helper: send the prompt again. Your wording will differ, but the answer should point you to skills, a `SKILL.md` file under `.claude/skills/` ([Extend Claude with skills](https://code.claude.com/docs/en/skills)). It may also mention the older `.claude/commands/` folder, which still works.

## Your turn

1. Run `/powerup` and finish one more lesson.
2. Switch to the Explanatory style with `/output-style explanatory`, ask Claude to explain `src/check-links.js`, and read its `Insight` blocks. Then, in your second terminal, save the setting for the check:

   ```bash
   cp .claude/settings.local.json .practice/b-teachers-style.json
   ```

3. Ask `claude-code-guide` about a Claude Code feature you haven't used yet: start your prompt with `Use the claude-code-guide agent:`, and look for its row in the transcript. If you asked the helper something earlier in this session, Claude may send the question to that same helper: the transcript then shows `Resuming agent` instead of a new `claude-code-guide(...)` row, and that counts too.
4. When you're done, switch back with `/output-style default`.

## Check

This Elective has no `npm run check`: tick each item yourself. You are done when all of these are true:

- [ ] `.practice/b-teachers-style.json`, saved in step 2 of Your turn, has an `outputStyle` entry for the Explanatory style. Check it with `cat .practice/b-teachers-style.json`.
- [ ] Self-check (not tested): you finished two `/powerup` lessons.

If the file is missing or names another style, run `/output-style explanatory` in Claude Code, repeat the `cp` command in your second terminal, then run `/output-style default`.

## Go further

- [Output styles](https://code.claude.com/docs/en/output-styles): every built-in style, and how to write your own.

---

<sub>Sources: [Commands](https://code.claude.com/docs/en/commands) · [Output styles](https://code.claude.com/docs/en/output-styles) · [Create custom subagents](https://code.claude.com/docs/en/sub-agents) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [Extend Claude with skills](https://code.claude.com/docs/en/skills) · [How AI assistance impacts the formation of coding skills](https://www.anthropic.com/research/AI-assistance-coding-skills)</sub>

<sub>Back to the [Beginner index](../README.md) · Topic: [Memory and context](../../topics/memory-and-context.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-teachers)</sub>
