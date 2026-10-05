# Choose who approves what: permission modes and plan mode

<sub>**Beginner** · Lesson 2 of 5 · about 15 minutes · Needs: [Install, sign in and look around](01-install-and-look-around.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-20 (sample)</sub>

## Goal

By the end of this lesson you can pick a permission mode for a task, switch modes during a session, and use plan mode to approve a plan before Claude changes any file.

## You need

- Your copy of the practice template, cloned locally, with no uncommitted changes. To practice in one of your own git repositories instead, keep the template copy as well: the check runs from it.
- Node.js LTS installed, or the template opened in Codespaces.
- One small change you want made, such as adding input validation to a function.

## Worked example

1. Look at the status bar. Your session probably starts in auto mode.
2. Press `Shift+Tab` until the status bar reads `⏸ plan mode on`. From auto, the first press gives Manual, then Accept edits, then Plan.
3. Ask for the change:

   ```text
   Add a check to parseConfig in src/config.js that rejects an empty file with a clear error message.
   ```

4. Claude reads files and may run commands to explore, but does not edit your files. Then it shows a plan and asks how to proceed. You see three choices: **Yes, and use auto mode**; **Yes, manually approve edits**; **No, keep planning**. While Claude plans, watch the status bar: it keeps reading `⏸ plan mode on`.
5. If the plan touches more than you asked for, for example a new test file, choose **No, keep planning** and say what to change:

   ```text
   Keep the change to src/config.js and its existing test file. Don't add new test files.
   ```

6. When the revised plan looks right, leave it on screen. Open another terminal in the same folder. In your own repository, first run `echo '.practice/' >> .git/info/exclude` once, so git [ignores](https://git-scm.com/docs/gitignore) the snapshot folder there without a commit. Then save what git sees before you approve:

   ```bash
   mkdir -p .practice
   git status --porcelain > .practice/b-2-before.txt
   ```

   Then write the files the plan says it will change into `.practice/b-2-plan.txt`, one path per line, for example:

   ```bash
   printf '%s\n' src/config.js test/config.test.js > .practice/b-2-plan.txt
   ```

   The template ignores `.practice/`, so these files do not show up in `git status`.
7. Back in Claude Code, choose **Yes, manually approve edits**. The session leaves plan mode, and Claude asks before each edit. Approve them one at a time.
8. Set the example's change aside so Your turn starts clean: `git stash push --include-untracked -m b-2-example`. Your `.practice/` folder stays, because git ignores it.

## Your turn

Repeat the example in your practice copy (or your own repository) with your own small change:

1. Switch to plan mode with `Shift+Tab`.
2. Ask for the change.
3. Send the plan back once with **No, keep planning** and one correction.
4. While the final plan is shown, run the commands from Worked example step 6 in another terminal, with your plan's file list (in your own repository, run the one-time exclude line first).
5. Approve it with **Yes, manually approve edits** and approve each edit.

Stop before committing. The next lesson takes the change to a commit.

## Check

You are done when all of these are true:

- [ ] Before you approved, you saved `git status --porcelain > .practice/b-2-before.txt` in another terminal, and it lists no files.
- [ ] After approving, every path that `git status --porcelain` lists (apart from `.practice/`) appears in `.practice/b-2-plan.txt`.
- [ ] Self-check (not tested): say, in one sentence, when you would pick Manual instead of Auto.

Run `npm run check -- b-2` before you commit. In your own repository, run `npm run check -- b-2 --dir <your repo>` from your template copy instead.

If `.practice/b-2-before.txt` lists files, check that the status bar read `⏸ plan mode on` when you sent the prompt, then look in the transcript for a command Claude ran that wrote a file. If a changed path is missing from `.practice/b-2-plan.txt`, compare the plan you approved with what Claude changed.

## Go further

- Type `/plan <your task>` to enter plan mode and start the task in one step. When you approve, the option you pick sets the mode you continue in.
- Official: [Analyze before you edit with plan mode](https://code.claude.com/docs/en/permission-modes#analyze-before-you-edit-with-plan-mode).

---

<sub>Sources: [Choose a permission mode](https://code.claude.com/docs/en/permission-modes)</sub>

<sub>← [Install, sign in and look around](01-install-and-look-around.md) · [Beginner index](README.md) · [Your first change, from request to commit](03-first-change.md) → · Topic: [Permissions and safety](../topics/permissions-and-safety.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-2)</sub>
