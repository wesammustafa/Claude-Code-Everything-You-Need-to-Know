# Keep a session on track

<sub>**Beginner** · Lesson 4 of 5 · about 25 minutes · Needs: [Your first change, from request to commit](03-first-change.md) · Verified against Claude Code v2.1.292 (stable) on 2026-10-19</sub>

## Goal

By the end of this lesson you can keep a session on track: back out of a change that went the wrong way, keep the context to what matters, and pick the right conversation up again later.

## You need

- Your copy of the practice template with no uncommitted changes, and Node.js LTS (a Codespace on your copy has it). Your turn runs a script that only the practice copy has, so do this whole lesson there. It needs the copy's `.practice/` folder: if earlier lessons didn't make it, run `mkdir .practice`.
- A second terminal in the same folder, for git.
- Usage: light.

## The idea

Everything in a conversation, your prompts, Claude's replies and every file it read, sits in the session's context window. A dead end left there crowds out what you need next ([Explore the context window](https://code.claude.com/docs/en/context-window#when-your-context-fills-up)). And sessions usually start in auto mode, where Claude edits without asking you first ([Choose a permission mode](https://code.claude.com/docs/en/permission-modes#which-mode-a-session-starts-in)), so you need a fast way back.

Before each prompt that starts a turn, Claude Code takes a checkpoint, and it tracks the files Claude then changes with its file editing tools. `/rewind`, or `Esc` twice on an empty prompt, lists your prompts: pick one, then choose what you want back ([Checkpointing](https://code.claude.com/docs/en/checkpointing#rewind-and-summarize)).

| You want | Choose |
|---|---|
| The files back, and Claude to remember what it tried | **Restore code** |
| Files and conversation back, to send a better prompt | **Restore code and conversation** |
| The files kept, and a long stretch of conversation shrunk | **Summarize from here** |

For the whole conversation ([Commands](https://code.claude.com/docs/en/commands)): `/context` shows what fills the window, as a colored grid; `/compact` summarizes it when you keep going on the same task; `/clear` starts empty for a new task; `/branch` copies it so you can try another direction and keep the original; and `/resume` opens an earlier one.

## Worked example

The job: tidy up `brokenLinks` in `src/check-links.js`. You'll try one approach, back out of it, and land the one you want.

1. Start `claude` in your practice copy. In auto mode, Claude edits files and runs most commands without asking; if Claude Code does ask about something, read it and answer as in [lesson 2](02-permission-modes-and-plan-mode.md).
2. Explore:

   ```text
   Explain how src/check-links.js finds broken links, and which files call brokenLinks.
   ```

   Your wording will differ, but Claude should name `src/cli.js` and `test/links.test.js` as the callers. Every file it reads to answer goes into the context window.
3. Try an approach:

   ```text
   Make brokenLinks asynchronous, reading files with fs/promises, and update its callers.
   ```

   In the second terminal, `git status --short` ([git status](https://git-scm.com/docs/git-status)) lists the files Claude changed, `src/check-links.js`, `src/cli.js` and usually `test/links.test.js`, and `git diff` ([git diff](https://git-scm.com/docs/git-diff)) shows the change. Say you decide against it: for a short command-line run, reading files asynchronously buys nothing, and every caller now has to wait for the function.
4. Put the files back. Type `/rewind`, or press `Esc` twice with an empty prompt. Pick the prompt from step 3 and choose **Restore code**. The files go back, and the conversation stays, so Claude still knows what it tried. In the second terminal, `git status --short` prints nothing. If a diff panel is open beside the conversation, it may still show the edit: Claude Code refreshes the panel each time Claude edits a file or runs a shell command ([Interactive mode](https://code.claude.com/docs/en/interactive-mode#diff-panel)), so trust git.

   If the menu offers only **Restore conversation**, the summarize options and **Never mind**, Claude changed the files with a command, which rewind can't undo: choose **Never mind**, press `Esc` to close the menu, and run `git restore src test` ([git restore](https://git-scm.com/docs/git-restore)) in the second terminal.
5. Shrink the dead end. The whole async attempt is still in the conversation. Type `/context` and note the messages part of the grid. Open the rewind menu again and pick the same prompt. Highlight **Summarize from here** with the arrow keys, type this where the row reads **add context (optional)**, and press `Enter`:

   ```text
   we tried async and dropped it: every caller had to change
   ```

   Everything from that prompt on becomes a summary, marked **Summarized conversation**: Claude keeps the lesson in less space, and `/context` now shows a smaller messages part. Summarizing also puts the step 3 prompt back in the input box ([Checkpointing](https://code.claude.com/docs/en/checkpointing#rewind-and-summarize)): press `Esc` twice quickly to clear it.
6. Ask for the approach you want, then commit it:

   ```text
   Keep brokenLinks synchronous. Instead, move the code that checks one file's links into its own function in src/check-links.js, and run the tests.
   ```

   Read the diff in the second terminal, and run `npm run linkcheck -- samples` there: it still prints `guide.md:5: broken link to missing.md`, the sample's one broken link. Then:

   ```text
   commit this with a message that says what changed
   ```

   `git status` in the second terminal ends with `nothing to commit, working tree clean`.
7. The job is done and the next one is unrelated, so clear rather than compact. Name the conversation you're leaving as you clear it ([Commands](https://code.claude.com/docs/en/commands)):

   ```text
   /clear check-links-refactor
   ```

   The new conversation starts with empty context, and the old one is saved under that name. `/compact` is for the other case: the same task, in a conversation grown long.
8. Type `/exit`. Later, open the refactor conversation again by its name ([Manage sessions](https://code.claude.com/docs/en/sessions#name-your-sessions)):

   ```bash
   claude --resume check-links-refactor
   ```

   It shows the refactor and its commit. `claude --continue` opens the most recent conversation in this folder instead, which after `/clear` can be the empty one.

## Your turn

A teammate offers a script that renames `findLinks` in `src/links.js` to `extractLinks`. Try it in a branch of the conversation, then back out. This time one of the changes is made by a command, to a file Claude hasn't edited in this conversation.

1. The conversation you resumed holds the whole refactor, and you're staying on the link checker, so compact rather than clear:

   ```text
   /compact keep what we changed in src/check-links.js and why
   ```

   Claude Code replaces the conversation so far with a summary that focuses on what you asked to keep ([Commands](https://code.claude.com/docs/en/commands)).
2. Branch the conversation ([Manage sessions](https://code.claude.com/docs/en/sessions#branch-a-session)):

   ```text
   /branch try-rename
   ```

   You're now in a copy of the conversation, and the original, `check-links-refactor`, stays as it was.
3. Ask:

   ```text
   Run node practice/b-4/rename-export.mjs, which renames findLinks in src/links.js. Then update its callers with your file editing tool, not a shell command.
   ```

4. In the second terminal, save what git sees: `git status --porcelain > .practice/b-4-before-rewind.txt`. It lists `src/links.js`, which the script changed, and the callers Claude updated, `src/check-links.js` and usually `test/links.test.js`.
5. Say the rename is off: another tool imports `findLinks` by that name. Before you rewind, decide which of those files **Restore code** will put back. Then rewind the step 3 prompt with **Restore code**, and save what git sees: `git status --porcelain > .practice/b-4-after-rewind.txt`.

   If the menu offers only **Restore conversation**, the summarize options and **Never mind**, Claude updated the callers with commands: choose **Never mind**, press `Esc`, run `git restore src test`, and repeat from step 3.
6. Read that file, and run `npm run linkcheck -- samples`. Get `src/` back to your last commit so the link check runs again, and run it to see.
7. Go back to the original conversation with `/resume check-links-refactor`.

## Check

You are done when all of these are true:

- [ ] A commit after your copy's first one changes `src/check-links.js`, which still exports a synchronous `brokenLinks`: `git log --stat -3` ([git log](https://git-scm.com/docs/git-log)) lists it.
- [ ] `.practice/b-4-before-rewind.txt` lists `src/links.js` and `src/check-links.js`: `cat .practice/b-4-before-rewind.txt`.
- [ ] `.practice/b-4-after-rewind.txt` lists `src/links.js` and no other file in `src/` or `test/`: `cat .practice/b-4-after-rewind.txt`.
- [ ] `src/` and `test/` have no uncommitted changes, your last commit's `src/links.js` still exports `findLinks`, and `npm run linkcheck -- samples` runs without an error.
- [ ] Self-check (not tested): the conversation `/resume check-links-refactor` opened doesn't mention the rename.

Run `npm run check -- b-4` in your practice copy.

If no commit changes `src/check-links.js`, finish Worked example step 6 and commit. If `.practice/b-4-before-rewind.txt` is missing a path, save it again once the script has run and Claude has updated the callers. If `.practice/b-4-after-rewind.txt` still lists `src/check-links.js` or `test/links.test.js`, rewind the step 3 prompt with **Restore code** and save again; if they stay changed, Claude changed them with a command: run `git restore src test`, then repeat Your turn from step 3. If it doesn't list `src/links.js`, and you didn't restore that file yourself, Claude had already edited `src/links.js` in this conversation, and rewind also puts back a command's change to a file Claude edited: run `git restore src test`, type `/exit`, start `claude` for a new session, and repeat Your turn from step 3. If the link check stops with an error about `findLinks`, or the check says your last commit no longer exports it, `src/links.js` still holds the script's rename: run `git restore src/links.js`, or, once the rename is in a commit, undo that commit with `git revert <sha>` ([git revert](https://git-scm.com/docs/git-revert)), with the sha `git log` lists for it.

## Watch out

- Rewind puts back the files Claude edited with its file editing tools. A command's change to any other file, such as `rm`, `mv` or a script, stays ([Checkpointing](https://code.claude.com/docs/en/checkpointing#bash-command-changes-not-tracked)), while a change to a file Claude already edited in the session can be put back with it ([Checkpointing](https://code.claude.com/docs/en/checkpointing#external-changes-not-tracked)). Commit your work so git can bring it back.

## Go further

- [Explore the context window](https://code.claude.com/docs/en/context-window): an interactive view of what fills a session.
- [Session management and 1M context](https://claude.com/blog/using-claude-code-session-management-and-1m-context): when to compact, clear or start fresh.
- [Manage sessions](https://code.claude.com/docs/en/sessions): naming, the session picker and branching in full.

---

<sub>Sources: [Commands](https://code.claude.com/docs/en/commands) · [Explore the context window](https://code.claude.com/docs/en/context-window) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [Checkpointing](https://code.claude.com/docs/en/checkpointing) · [Interactive mode](https://code.claude.com/docs/en/interactive-mode) · [Manage sessions](https://code.claude.com/docs/en/sessions) · [git status](https://git-scm.com/docs/git-status) · [git diff](https://git-scm.com/docs/git-diff) · [git restore](https://git-scm.com/docs/git-restore) · [git log](https://git-scm.com/docs/git-log) · [git revert](https://git-scm.com/docs/git-revert)</sub>

<sub>← [Your first change, from request to commit](03-first-change.md) · [Beginner index](README.md) · [Project memory with CLAUDE.md](05-project-memory.md) → · Topic: [Memory and context](../topics/memory-and-context.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-4)</sub>
