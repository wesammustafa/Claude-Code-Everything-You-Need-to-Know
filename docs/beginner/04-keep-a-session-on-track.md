# Keep a session on track

<sub>**Beginner** · Lesson 4 of 5 · about 25 minutes · Needs: [Your first change, from request to commit](03-first-change.md) · Verified against Claude Code v2.1.308 (stable) on 2026-10-25</sub>

## Goal

By the end of this lesson you can keep a session on track: stop or rewind a change that went the wrong way, keep the context to what matters, and pick the right conversation up again later.

## You need

- Your copy of the practice template with no uncommitted changes, Node.js LTS (a Codespace on your copy has it) and a `.practice/` folder in it: if earlier lessons didn't make one, run `mkdir .practice`.
- A second terminal in the same folder, for git.
- Usage: light.

## The idea

Everything in a conversation, your prompts, Claude's replies and every file it read, sits in the session's context window. A dead end left there crowds out what you need next ([Explore the context window](https://code.claude.com/docs/en/context-window#when-your-context-fills-up)).

Press `Esc` once to stop Claude mid-action, as in lesson 1 ([Best practices](https://code.claude.com/docs/en/best-practices#course-correct-early-and-often)). Before each prompt that starts a turn, Claude Code takes a checkpoint, and it tracks the files Claude then changes with its file editing tools. `/rewind`, or `Esc` twice on an empty prompt, lists your prompts: pick one, then choose what you want back ([Checkpointing](https://code.claude.com/docs/en/checkpointing#rewind-and-summarize)).

| You want | Choose |
|---|---|
| The files back, and Claude to remember what it tried | **Restore code** |
| Files and conversation back, to send a better prompt | **Restore code and conversation** |
| The files kept, and a long stretch of conversation shrunk | **Summarize from here** |

For the whole conversation ([Commands](https://code.claude.com/docs/en/commands)): `/context` shows what fills the window, as a colored grid; `/compact` summarizes it when you keep going on the same task; `/clear` starts empty for a new task; and `/resume` opens an earlier one. After two failed corrections on the same thing, `/clear` and start again with a better prompt ([Best practices](https://code.claude.com/docs/en/best-practices#avoid-common-failure-patterns)).

## Worked example

The job: tidy up `brokenLinks` in `src/check-links.js`. You'll try one approach, back out of it, and land the one you want.

1. Start `claude` in your practice copy.
2. Explore:

   ```text
   Explain how src/check-links.js finds broken links, and which files in src/ and test/ call brokenLinks.
   ```

   Your wording will differ, but Claude should name `src/cli.js` and `test/links.test.js` as the callers. Every file it reads to answer goes into the context window: type `/context` to see what fills it.
3. Try an approach:

   ```text
   Make brokenLinks asynchronous, reading files with fs/promises, and update its callers.
   ```

   In the second terminal, `git status --short` ([git status](https://git-scm.com/docs/git-status)) lists the files Claude changed, `src/check-links.js`, `src/cli.js` and usually `test/links.test.js`, and `git diff` ([git diff](https://git-scm.com/docs/git-diff)) shows the change. Say you decide against it: for a short command-line run, reading files asynchronously buys nothing, and every caller now has to wait for the function.
4. Put the files and the conversation back, rather than asking Claude to undo it. Anthropic's [session management guide](https://claude.com/resources/articles/using-claude-code-session-management-and-1m-context) calls rewinding often the better correction: the attempt leaves the context, and you re-prompt with what you learned. Type `/rewind`, or press `Esc` twice with an empty prompt, pick the prompt from step 3 and choose **Restore code and conversation**. The files go back, the attempt leaves the conversation, and your step 3 prompt returns to the input box ([Checkpointing](https://code.claude.com/docs/en/checkpointing#rewind-and-summarize)). In the second terminal, `git status --short` prints nothing. If it lists files, Claude changed them in a way rewind doesn't track, usually with a command: run `git restore src test` ([git restore](https://git-scm.com/docs/git-restore)).

   If the menu offers only **Restore conversation**, the summarize options and **Never mind**, Claude changed the files in a way rewind doesn't track, usually with a command: choose **Restore conversation**, then run `git restore src test` in the second terminal.
5. Edit the prompt in the input box into the approach you want, and send it:

   ```text
   Don't make brokenLinks asynchronous: for a short command-line run it buys nothing. Keep it synchronous, and move the code that checks one file's links into its own function in src/check-links.js. Run the tests.
   ```

   Read the diff in the second terminal, and run `npm run linkcheck -- samples` there: it still prints `guide.md:5: broken link to missing.md`, the sample's one broken link. Then:

   ```text
   commit this with a message that says what changed
   ```

   `git status` in the second terminal ends with `nothing to commit, working tree clean`.
6. The job is done and the next one is unrelated, so clear rather than compact. Name the conversation you're leaving as you clear it ([Commands](https://code.claude.com/docs/en/commands)):

   ```text
   /clear check-links-refactor
   ```

   The new conversation starts with empty context, and the old one is saved under that name. `/compact` is for the other case: the same task, in a conversation grown long.
7. Type `/exit`. Later, open the refactor conversation again by its name ([Manage sessions](https://code.claude.com/docs/en/sessions#name-your-sessions)):

   ```bash
   claude --resume check-links-refactor
   ```

   It shows the refactor and its commit. `claude --continue` reopens the most recent session in this folder instead ([Manage sessions](https://code.claude.com/docs/en/sessions#resume-a-session)); the name takes you to this one. If Claude Code asks **Resume this conversation?**, choose by whether your next task still needs the saved conversation ([The "Resume this conversation?" dialog](https://code.claude.com/docs/en/sessions#resume-usage-limit-dialog)).

## Your turn

Try a teammate's rename script, then undo all of it: another tool imports `findLinks`. The script renames `findLinks` in `src/links.js` to `extractLinks`. This time one of the changes is made by a command, to a file Claude hasn't edited in this conversation.

1. The conversation you resumed holds the whole refactor, and you're staying on the link checker, so compact rather than clear:

   ```text
   /compact keep what we changed in src/check-links.js and why
   ```

   Claude Code replaces the conversation so far with a summary that focuses on what you asked to keep ([Commands](https://code.claude.com/docs/en/commands)).
2. Ask:

   ```text
   Run node practice/b-4/rename-export.mjs, which renames findLinks in src/links.js. Then update its callers with your file editing tool, not a shell command.
   ```

3. In the second terminal, save what git sees: `git status --porcelain > .practice/b-4-before-rewind.txt`. It lists `src/links.js`, which the script changed, and the callers Claude updated, `src/check-links.js` and usually `test/links.test.js`.
4. You're staying on this task, and Claude should remember what it tried, so this time use **Restore code**. Before you rewind, decide which of those files it will put back. Then rewind the step 2 prompt with **Restore code**, and save what git sees: `git status --porcelain > .practice/b-4-after-rewind.txt`.

   If the menu offers only **Restore conversation**, the summarize options and **Never mind**, Claude updated the callers in a way rewind doesn't track, usually with commands: choose **Never mind**, press `Esc`, run `git restore src test`, and repeat from step 2.
5. Read that file, and run `npm run linkcheck -- samples`. Get `src/` back to your last commit so the link check runs again, and run it to see.

## Check

You are done when all of these are true:

- [ ] A commit after your copy's first one changes `src/check-links.js`, which still exports a synchronous `brokenLinks`: `git log --stat -3` ([git log](https://git-scm.com/docs/git-log)) lists it.
- [ ] `.practice/b-4-before-rewind.txt` lists `src/links.js` and `src/check-links.js`: `cat .practice/b-4-before-rewind.txt`.
- [ ] `.practice/b-4-after-rewind.txt` lists `src/links.js` and no other file in `src/` or `test/`: `cat .practice/b-4-after-rewind.txt`.
- [ ] `src/` and `test/` have no uncommitted changes, your last commit's `src/links.js` still exports `findLinks`, and `npm run linkcheck -- samples` runs without an error.

Run `npm run check -- b-4` in your practice copy.

If no commit changes `src/check-links.js`, finish Worked example step 5 and commit. If `.practice/b-4-before-rewind.txt` is missing a path, save it again once the script has run and Claude has updated the callers. If `.practice/b-4-after-rewind.txt` lists the wrong files, read the check's message: it says whether a command made an edit, or Claude had already edited `src/links.js` in this conversation, and from which step to repeat Your turn. If the link check stops with an error about `findLinks`, or the check says your last commit no longer exports it, `src/links.js` still holds the script's rename: run `git restore src/links.js`, or, once the rename is in a commit, undo that commit with `git revert <sha>` ([git revert](https://git-scm.com/docs/git-revert)), with the sha `git log` lists for it.

## Watch out

- Rewind puts back the files Claude edited with its file editing tools. A command's change to any other file, such as `rm`, `mv` or a script, stays, while a change to a file Claude already edited in the session can be put back with it ([Checkpointing](https://code.claude.com/docs/en/checkpointing#bash-command-changes-not-tracked)). Commit your work so git can bring it back.

## Go further

- [Explore the context window](https://code.claude.com/docs/en/context-window): an interactive view of what fills a session.
- [Branch a session](https://code.claude.com/docs/en/sessions#branch-a-session): try another direction with `/branch` and keep the original conversation.
- [Summarize from here](https://code.claude.com/docs/en/checkpointing#guide-a-summary): shrink a long stretch of conversation, keep the files, and say what the summary should keep.

---

<sub>Sources: [Commands](https://code.claude.com/docs/en/commands) · [Explore the context window](https://code.claude.com/docs/en/context-window) · [Checkpointing](https://code.claude.com/docs/en/checkpointing) · [Best practices](https://code.claude.com/docs/en/best-practices) · [Manage sessions](https://code.claude.com/docs/en/sessions) · [Using Claude Code: session management and 1M context](https://claude.com/resources/articles/using-claude-code-session-management-and-1m-context) · [git status](https://git-scm.com/docs/git-status) · [git diff](https://git-scm.com/docs/git-diff) · [git restore](https://git-scm.com/docs/git-restore) · [git log](https://git-scm.com/docs/git-log) · [git revert](https://git-scm.com/docs/git-revert)</sub>

<sub>← [Your first change, from request to commit](03-first-change.md) · [Beginner index](README.md) · [Project memory with CLAUDE.md](05-project-memory.md) → · Topic: [Memory and context](../topics/memory-and-context.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-4)</sub>
