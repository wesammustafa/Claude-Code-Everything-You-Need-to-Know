# Learn from Claude Code itself

<sub>**Beginner** · Elective · about 15 minutes · Needs: [Install, sign in and look around](../01-install-and-look-around.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

## Goal

By the end of this Elective you can use Claude Code's built-in teaching aids: `/powerup`, the Learning and Explanatory output styles, and its guide to its own features.

## You need

- Your copy of the practice template.
- Usage: light.

## The idea

Claude Code can teach you while you work. Three aids are built in:

- **`/powerup`** runs quick interactive lessons on Claude Code's features, with animated demos ([Commands](https://code.claude.com/docs/en/commands)).
- **Output styles** change how Claude answers ([Output styles](https://code.claude.com/docs/en/output-styles)). In the **Explanatory** style, Claude adds short `Insight` blocks that explain the choices behind its code. The **Learning** style adds the same blocks and also leaves a few lines of real decisions for you to write.
- **The guide to Claude Code**: when you ask a question about Claude Code's own features, Claude can hand it to `claude-code-guide`, a built-in helper for exactly those questions ([Create custom subagents](https://code.claude.com/docs/en/sub-agents)).

Why write some of the code yourself? In an Anthropic study, developers who learned a new library with an AI assistant scored lower, on average, on a quiz about it than developers who coded by hand. The ones who scored well used the assistant to ask questions and get explanations, not just to produce code ([How AI assistance impacts the formation of coding skills](https://www.anthropic.com/research/AI-assistance-coding-skills)). The Learning style builds that habit in.

## Worked example

1. Start `claude` in your practice copy and run `/powerup`. Pick a lesson and follow it to the end.
2. Switch the output style:

   ```text
   /output-style learning
   ```

   Claude Code saves the choice to `.claude/settings.local.json` in this project.
3. Ask for a small change:

   ```text
   Add a function to src/links.js that counts the external links on a page, with a test.
   ```

   Claude explains its choices in `Insight` blocks and leaves a short piece marked for you to write. Write it, then ask Claude to run the tests.
4. Ask about Claude Code itself:

   ```text
   How do I make my own slash command in Claude Code?
   ```

   Your wording will differ, but the answer should point you to skills.

## Your turn

1. Run `/powerup` and finish one more lesson.
2. Switch to the Explanatory style with `/output-style explanatory`, ask Claude to explain `src/check-links.js`, and read its `Insight` blocks.
3. Ask one question about a Claude Code feature you haven't used yet.
4. When you're done, switch back with `/output-style default`.

## Check

You are done when all of these are true:

- [ ] While you practiced, `.claude/settings.local.json` held your choice: before step 4 of Your turn, `cat .claude/settings.local.json` shows an `outputStyle` entry for the Explanatory style.
- [ ] Self-check (not tested): you finished two `/powerup` lessons.

## Go further

- [Output styles](https://code.claude.com/docs/en/output-styles): every built-in style, and how to write your own.

---

<sub>Sources: [Commands](https://code.claude.com/docs/en/commands) · [Output styles](https://code.claude.com/docs/en/output-styles) · [Create custom subagents](https://code.claude.com/docs/en/sub-agents) · [How AI assistance impacts the formation of coding skills](https://www.anthropic.com/research/AI-assistance-coding-skills)</sub>

<sub>Back to the [Beginner index](../README.md) · Topic: [Memory and context](../../topics/memory-and-context.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-teachers)</sub>
