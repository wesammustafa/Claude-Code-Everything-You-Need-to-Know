# Your first change, from request to commit

<sub>**Beginner** · Lesson 3 of 5 · about 20 minutes · Needs: [Permission modes and plan mode](02-permission-modes-and-plan-mode.md) · Verified against Claude Code v2.1.292 (stable) on 2026-10-19</sub>

## Goal

By the end of this lesson you can take a change from request to commit, and review a change well enough to catch what it gets wrong before it is committed.

## You need

- Your copy of the practice template, and Node.js LTS (a Codespace on your copy has it). Practice in the template copy, not in your own repository: Your turn reviews a patch planted there.
- No uncommitted changes. If lesson 2's change is still there, set it aside with `git stash push --include-untracked -m b-2` ([git stash](https://git-scm.com/docs/git-stash)). Later lessons don't use it, and `git stash list` shows it.
- A second terminal open in the same folder, for git.
- Usage: light.

## The idea

Asking for a change and accepting whatever comes back is how sessions go wrong. Anthropic's [best practices](https://code.claude.com/docs/en/best-practices#explore-first-then-plan-then-code) recommend four phases: explore, plan, implement and commit.

A new session usually starts in auto mode, and as [lesson 2](02-permission-modes-and-plan-mode.md#the-idea) showed, auto mode approves ordinary source-file edits in your project without the classifier seeing them ([How the classifier evaluates actions](https://code.claude.com/docs/en/permission-modes#how-the-classifier-evaluates-actions)). For these source edits, no second model reviews Claude's changes: you do. Whether the change is right is yours to judge, in two places: the plan, before Claude starts, and the diff, before anything is committed.

1. **Explore** in plan mode: Claude reads, and doesn't edit your files.
2. **Plan**, and approve it only when it changes the files you expect.
3. **Implement** in auto mode, and keep working while Claude does.
4. **Test**: read the real output, not Claude's summary.
5. **Review the diff**, the tests included, and **correct** what you find.
6. **Commit**, so the change is saved and easy to undo.

## Worked example

The practice app checks Markdown links, but it skips any link with a title, such as `[setup](setup.md "Setup guide")`. You'll fix that.

1. Start `claude` in your practice copy. The status bar usually reads `⏵⏵ auto mode on`. Press `Shift+Tab` until it reads `⏸ plan mode on`: from auto, the presses go to Manual, Accept edits, then Plan ([Choose a permission mode](https://code.claude.com/docs/en/permission-modes#switch-permission-modes)). Explore:

   ```text
   How does this app find links in a Markdown file? Which kinds of links would it miss?
   ```

   Your wording will differ, but Claude should point to `src/links.js` and mention links with a title.
2. Plan:

   ```text
   Plan a change so links with a title, in double or single quotes, are checked too, like [setup](setup.md "Setup guide") and [faq](faq.md 'FAQ'). Add a test for each to test/links.test.js.
   ```

   Read the plan before you choose. It should change only `src/links.js` and `test/links.test.js`; a file it reads or names as needing no change is fine. If it also changes another file, such as `src/cli.js`, or adds one, send it back as in [lesson 2](02-permission-modes-and-plan-mode.md#worked-example): use the plan menu to ask Claude to keep the change to those two files.

   When the plan is right, choose **Yes, and use auto mode** (it reads **Yes, auto-accept edits** if auto mode isn't available to you). Claude edits and runs the tests without asking. If Claude Code does ask about an action, read it before you answer.
3. While Claude works, or once it's done, ask a side question:

   ```text
   /btw in one sentence, why does the current pattern skip a link with a title?
   ```

   Claude answers in an overlay, from what the session has already read, without tools and without interrupting the work. The question and answer never enter the conversation, so they don't steer Claude. Press `Space`, `Enter` or `Esc` to close it ([Interactive mode](https://code.claude.com/docs/en/interactive-mode#side-questions-with-%2Fbtw)). To change what Claude does, send a normal message instead.
4. Read the test output yourself. When Claude is done, ask, even if it already ran the tests:

   ```text
   run the tests
   ```

   Claude Code collapses long command output to a short summary. Press `Ctrl+O` to open the transcript viewer, find the test summary near the end, and press `Ctrl+O` again to go back ([Interactive mode](https://code.claude.com/docs/en/interactive-mode#general-controls)). It should report `fail 0`.

   This lesson's tests finish quickly. On a real project the tests, a build or a dev server can run for minutes: ask Claude to run the command in the background, or press `Ctrl+B` while it runs (in tmux, press it twice), and Claude can answer you while it runs. `/tasks` lists background work and stops a task you no longer need ([Background Bash commands](https://code.claude.com/docs/en/interactive-mode#background-bash-commands), [Tools reference](https://code.claude.com/docs/en/tools-reference#background-commands)).
5. Review the diff. Type `/diff` to see the changes in your working tree, Claude's edits included ([Interactive mode](https://code.claude.com/docs/en/interactive-mode#review-changes-with-%2Fdiff)). One of two views opens:
   - A panel beside the conversation. Its list leaves test files and generated files out and counts them on a line of their own: click that line to see the test. The panel may already be open: read it there, because typing `/diff` closes it.
   - A dialog above the prompt. Select a file with the arrow keys, press `Enter` to read its diff, and press `Esc` to go back.

   Read each line, the test included, and ask: does the test cover both kinds of quotes, and does the code leave the title out of the target? To read the diff in the second terminal instead, run `git diff` ([git diff](https://git-scm.com/docs/git-diff)). It leaves out a file git doesn't track yet until you run `git add -N <file>` ([git add](https://git-scm.com/docs/git-add#Documentation/git-add.txt--N)). If it stops at a `:` prompt, git is showing it in a pager, usually `less`: press `q` to leave it ([git config](https://git-scm.com/docs/git-config#Documentation/git-config.txt-corepager), [less FAQ](https://www.greenwoodsoftware.com/less/faq.html#dashe)).
6. Correct what the review found, in plain words. For example, if the test covers only double quotes:

   ```text
   The test covers only double-quoted titles. Add a case for a single-quoted title, like [faq](faq.md 'FAQ'), and run the tests again.
   ```

   Then read the diff again. If the review found nothing to correct, go on: Your turn has something to find.
7. Commit:

   ```text
   commit this with a message that says what changed
   ```

   If Claude puts the commit on a new branch, that's fine: the check works on any branch. To keep it on your current branch, say so in your prompt. In the second terminal, `git status` ([git status](https://git-scm.com/docs/git-status)) ends with `nothing to commit, working tree clean`.

## Your turn

A teammate sent a patch, `practice/b-3/protocol-relative.patch`. Its description says what it changes, and its test passes. Decide whether it does only what it says, and fix it before it goes into a commit.

1. Read the patch, its description first. In the second terminal, run `cat practice/b-3/protocol-relative.patch` (**Windows:** `Get-Content practice/b-3/protocol-relative.patch`), or open it in your editor. For each kind of link the checker handles, ask: does the new line skip it, and does the description say it should? The description's last sentence is a claim you can test.
2. Apply it, so its change is in your working tree: `git apply practice/b-3/protocol-relative.patch`. This changes the files and makes no commit ([git apply](https://git-scm.com/docs/git-apply)). `git status` lists `src/links.js` as modified and `test/external.test.js` under `Untracked files`. Run `git add -N test/external.test.js`, so `git diff` shows the new file too. `npm test` passes: passing tests don't make the patch right.
3. Tell Claude what the patch gets wrong, in your own words, and ask for a fix and a test that would fail on the patch's version.
4. Review the result as in the [Worked example](#worked-example)'s steps 4 and 5: read the test output yourself, then the whole diff, the tests included. In `/diff`, read the `Current` view: a turn view shows only Claude's own edits, so it leaves out the patch's lines ([Interactive mode](https://code.claude.com/docs/en/interactive-mode#review-changes-with-%2Fdiff)).
5. Ask Claude to commit the fix, its test and the patch's test together. `git status` ends with `nothing to commit, working tree clean`.

## Check

You are done when all of these are true:

- [ ] Links with a title, in double or single quotes, are checked.
- [ ] Protocol-relative links, such as `//cdn.example.com/app.js`, are skipped, and every other link is checked as before.
- [ ] Your tests catch the planted flaw: with the patch's `isExternal` put back, they fail.
- [ ] Your last commit changes a test file and at least one other file: `git show --stat HEAD` ([git show](https://git-scm.com/docs/git-show)).
- [ ] The tests pass: `npm test` reports `fail 0`.
- [ ] Nothing is left uncommitted: `git status --porcelain` prints nothing.
- [ ] Self-check (not tested): you found the patch's flaw by reading it, and you read each diff, the tests included, before it was committed.

In the second terminal, run `npm run check -- b-3` in your practice copy. The check writes a few Markdown files to a temporary folder and runs the app on them, and runs your tests once more with the patch's version of `isExternal`.

If titled links are still skipped, or reported with the title in the target, the worked example isn't finished: ask Claude to leave the title out of the target, with a test for each kind of quotes. If the check says a link is still skipped, the patch's flaw is still there: compare its description with what its new line skips. If `//cdn.example.com/app.js` is reported as broken, the patch isn't applied: run the `git apply` in Your turn, step 2. If your tests still pass with the patch's version, none of them covers what the patch broke: ask Claude for one that fails on it. Once you commit, the check names the link the patch gets wrong. If your last commit has no test file, or only tests, ask Claude to amend it (`git commit --amend` ([git commit](https://git-scm.com/docs/git-commit))), or to combine it with the commit before, as long as you haven't pushed them. If the tests fail, read the first failure and ask Claude to fix the code, not the test. If `git status --porcelain` lists files, commit them or set them aside with `git stash push --include-untracked`.

## Go further

- [Common workflows](https://code.claude.com/docs/en/common-workflows): step-by-step guides for fixing bugs, refactoring and testing.
- [Give Claude a way to verify its work](https://code.claude.com/docs/en/best-practices#give-claude-a-way-to-verify-its-work): why a test beats a summary.
- [Prompt library](https://code.claude.com/docs/en/prompt-library): copy-ready prompts, tagged by task.

---

<sub>Sources: [Best practices](https://code.claude.com/docs/en/best-practices) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [Interactive mode](https://code.claude.com/docs/en/interactive-mode) · [Tools reference](https://code.claude.com/docs/en/tools-reference) · [git add](https://git-scm.com/docs/git-add) · [git apply](https://git-scm.com/docs/git-apply) · [git config](https://git-scm.com/docs/git-config) · [less FAQ](https://www.greenwoodsoftware.com/less/faq.html) · [git stash](https://git-scm.com/docs/git-stash) · [git diff](https://git-scm.com/docs/git-diff) · [git status](https://git-scm.com/docs/git-status) · [git show](https://git-scm.com/docs/git-show) · [git commit](https://git-scm.com/docs/git-commit)</sub>

<sub>← [Permission modes and plan mode](02-permission-modes-and-plan-mode.md) · [Beginner index](README.md) · [Keep a session on track](04-keep-a-session-on-track.md) → · Topic: [Permissions and safety](../topics/permissions-and-safety.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-3)</sub>
