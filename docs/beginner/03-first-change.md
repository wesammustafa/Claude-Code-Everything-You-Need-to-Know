# Your first change, from request to commit

<sub>**Beginner** · Lesson 3 of 5 · about 20 minutes · Needs: [Permission modes and plan mode](02-permission-modes-and-plan-mode.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

## Goal

By the end of this lesson you can take one change from request to commit: explore, plan, implement, test, review the diff, correct, and commit.

## You need

- Your copy of the practice template, and Node.js LTS (a Codespace on your copy has it).
- To practice in one of your own repositories instead, keep the template copy as well: the check runs from it. Set up the repository's `.practice/` folder as [lesson 1](01-install-and-look-around.md#you-need) describes, if you haven't yet.
- No uncommitted changes where you practice. If lesson 2's change is still there, set it aside with `git stash push --include-untracked -m b-2`; in your own repository, commit it instead if you want to keep it. Later lessons don't use what you set aside, and `git stash list` shows it.
- Usage: light.

## The idea

Asking for a change and accepting whatever comes back is how sessions go wrong. Anthropic's [best practices](https://code.claude.com/docs/en/best-practices#explore-first-then-plan-then-code) recommend four phases: explore, plan, implement and commit. This lesson adds a check at each step:

1. **Explore** in plan mode: Claude reads and answers, and changes nothing.
2. **Plan**, and approve it only when it matches what you want.
3. **Implement**, approving edits as they come.
4. **Test**: the tests are what tell you the change works, not the summary Claude writes.
5. **Review the diff** line by line.
6. **Correct** anything you don't want, in plain words.
7. **Commit**, so the change is saved and easy to undo.

## Worked example

The practice app checks Markdown links, but it skips any link with a title, such as `[setup](setup.md "Setup guide")`. You'll fix that.

1. Start `claude` in your practice copy and press `Shift+Tab` until the status bar reads `⏸ plan mode on`. Explore:

   ```text
   How does this app find links in a Markdown file? Which kinds of links would it miss?
   ```

   Your wording will differ, but Claude should point to `src/links.js` and mention links with a title.
2. Plan:

   ```text
   Plan a change so links with a title, like [setup](setup.md "Setup guide"), are checked too. Add a test for it to test/links.test.js.
   ```

   Read the plan. When it names only `src/links.js` and `test/links.test.js`, choose **Yes, manually approve edits**. If it names other files too, send it back as in [lesson 2](02-permission-modes-and-plan-mode.md#worked-example): in **Tell Claude what to change**, ask Claude to keep the change to those two files.
3. Implement and test. Approve each edit. Claude also asks before most commands, such as running the tests: read each one. Answer plain **Yes** when it does what the plan needs, as in lesson 2. Answer **No** and say what to do instead when it does more, such as a command that stashes, overwrites or moves files. Don't choose **Yes, and switch to auto mode**: background safety checks would then review the rest of this lesson's steps instead of you ([Choose a permission mode](https://code.claude.com/docs/en/permission-modes#switch-permission-modes)). Then ask, even if Claude already ran the tests, so you see the result yourself:

   ```text
   run the tests
   ```

   Claude Code collapses long command output to a short summary. Press `Ctrl+O` to expand it ([Interactive mode](https://code.claude.com/docs/en/interactive-mode#general-controls)), find the test summary near the end, and press `Esc` to go back. It should report `fail 0`.
4. Review the diff. Type `/diff` to see the changes Claude made, beside anything else you haven't committed ([Interactive mode](https://code.claude.com/docs/en/interactive-mode#review-changes-with-%2Fdiff)). One of two views opens:
   - A panel beside the conversation. Its list leaves test files out until you click the line that counts them, so click it. The panel can also open on its own once Claude edits files: if it's already open, read it there, because typing `/diff` closes it.
   - A list above the prompt. Select a file with the arrow keys, press `Enter` to read its diff, and press `Esc` to go back.

   Read each line, the test included. In a second terminal, `git diff` prints the uncommitted changes to files git already tracks. For a new file Claude created, run `git add -N <file>` first so it shows up ([git add](https://git-scm.com/docs/git-add#Documentation/git-add.txt--N)).
5. Correct. Read the new test. If it covers only double-quoted titles, ask:

   ```text
   The test covers only double-quoted titles. Add a case for a single-quoted title, like [faq](faq.md 'FAQ'), and run the tests again.
   ```

   If it already covers single quotes, ask for another small change you would want instead, such as giving each kind of title its own test. Then check the diff again.
6. Commit:

   ```text
   commit this with a message that says what changed
   ```

   Claude asks before it runs the commit. Read the whole command, then choose **Yes**. If it also creates a branch, that's fine: the check works on any branch. To keep the commit on your current branch, say so in your prompt. Then, in the second terminal, save the commit for the check and confirm nothing is left over:

   ```bash
   git rev-parse HEAD > .practice/b-3-commit.txt
   git status
   ```

   `git status` ends with `nothing to commit, working tree clean`.

## Your turn

Repeat the example with a second gap: links whose target sits in angle brackets, such as `[my notes](<my notes.md>)`.

1. Explore in plan mode: ask how the app reads a link's target.
2. Plan the change, with a test in `test/links.test.js`. Send the plan back if it names other files, then approve it with **Yes, manually approve edits**.
3. Approve the edits and any test commands with **Yes**, then ask Claude to run the tests.
4. Review the whole diff with `/diff`, the test file included.
5. Ask for one correction, even a small one, and check the diff again.
6. Once the correction is in, ask Claude to commit the change, its test and your correction together. Then, in the second terminal, run `git rev-parse HEAD > .practice/b-3-commit.txt`.

In your own repository, pick a small change of your own that comes with a test.

## Check

You are done when all of these are true:

- [ ] The commit named in `.practice/b-3-commit.txt` changes a test file and at least one other file: `git show --stat $(cat .practice/b-3-commit.txt)`. **Windows:** `git show --stat (Get-Content .practice/b-3-commit.txt)`.
- [ ] The tests pass: `npm test` reports `fail 0`.
- [ ] Nothing is left uncommitted: `git status --porcelain` prints nothing.
- [ ] Self-check (not tested): you read the whole diff before committing and asked Claude for at least one correction.

In the second terminal, run `npm run check -- b-3` in your practice copy. In your own repository, run `npm run check -- b-3 --dir <your repo>` from your practice copy instead. If that repository has no `npm test` script, first save your test command's exit code with `<your test command>; echo $? > .practice/b-3-tests.txt` (**Windows:** `<your test command>; $LASTEXITCODE > .practice/b-3-tests.txt`).

If the commit changes no test file, or only tests, the code and its test didn't land in one commit: ask Claude to amend the commit with the missing test (`git commit --amend`), or to combine the last two commits into one, as long as you haven't pushed them. Then save the commit again with `git rev-parse HEAD > .practice/b-3-commit.txt`. If the tests fail, read the first failure and ask Claude to fix the code, not the test. If `git status --porcelain` lists files, commit them or set them aside with `git stash push --include-untracked`.

## Go further

- [Common workflows](https://code.claude.com/docs/en/common-workflows): step-by-step guides for fixing bugs, refactoring and testing.
- [Prompt library](https://code.claude.com/docs/en/prompt-library): copy-ready prompts, tagged by task.
- [Give Claude a way to verify its work](https://code.claude.com/docs/en/best-practices#give-claude-a-way-to-verify-its-work): why a test beats a summary.

---

<sub>Sources: [Best practices](https://code.claude.com/docs/en/best-practices) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [Interactive mode](https://code.claude.com/docs/en/interactive-mode) · [Commands](https://code.claude.com/docs/en/commands) · [git add](https://git-scm.com/docs/git-add)</sub>

<sub>← [Permission modes and plan mode](02-permission-modes-and-plan-mode.md) · [Beginner index](README.md) · [Keep a session on track](04-keep-a-session-on-track.md) → · Topic: [Permissions and safety](../topics/permissions-and-safety.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-3)</sub>
