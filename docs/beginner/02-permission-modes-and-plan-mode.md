# Choose who approves what: permission modes and plan mode

<sub>**Beginner** · Lesson 2 of 5 · about 20 minutes · Needs: [Install, sign in and look around](01-install-and-look-around.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

## Goal

By the end of this lesson you can pick a permission mode for a task, switch modes during a session, and use plan mode to approve a plan before Claude edits your files.

## You need

- Your copy of the practice template, cloned, with no uncommitted changes, and Node.js LTS for its checks (a Codespace on your copy has both). To practice in one of your own repositories instead, commit or stash your work there first so it has no uncommitted changes either, and keep the template copy as well: the check runs from it. Set up the repository's `.practice/` folder as [lesson 1](01-install-and-look-around.md#you-need) describes, if you haven't yet.
- Usage: light.

> [!NOTE]
> On native Windows, run the commands in PowerShell and use the lines marked **Windows** where they differ. If `Shift+Tab` does nothing, press `Alt+M` instead ([Interactive mode](https://code.claude.com/docs/en/interactive-mode)).

## The idea

A [permission mode](https://code.claude.com/docs/en/permission-modes) decides which actions Claude can take without asking you first. You switch modes with `Shift+Tab`, and the status bar under the prompt always shows the one in force.

Four modes matter now:

| Status bar shows | Mode | Claude does this without asking |
|---|---|---|
| `⏸ manual mode on` | Manual | Reads only |
| `⏵⏵ accept edits on` | Accept edits | Reads, edits files, runs common file commands |
| `⏸ plan mode on` | Plan | Reads, plus commands a background safety check approves when auto mode is available, then writes a plan. It can't edit your files until you approve the plan |
| `⏵⏵ auto mode on` | Auto | Everything, with background safety checks |

Manual suits sensitive work and unfamiliar code, where you want to review every action yourself. Auto suits long tasks, where it saves you from approving every step.

Plan mode is the habit to build first: you see the whole change as a plan before Claude edits any of your files.

## Worked example

1. Start `claude` in your practice copy and look at the status bar. A new session usually starts in auto mode.
2. Press `Shift+Tab` until the status bar reads `⏸ plan mode on`. From auto, the first press gives Manual, then Accept edits, then Plan.
3. Ask for the change:

   ```text
   Make parseConfig in src/config.js reject an empty file with a clear error message, and add a test for it.
   ```

4. Claude reads files and may run commands to explore, but doesn't edit your files. If it needs a decision from you first, it asks a [multiple-choice question](https://code.claude.com/docs/en/tools-reference#askuserquestion-tool-behavior): pick an option or type your own answer, and it keeps planning. Then it shows a plan and asks how to proceed, with three choices:
   - **Yes, and use auto mode** (it reads **Yes, auto-accept edits** if auto mode isn't available to you)
   - **Yes, manually approve edits**
   - A text field that reads **Tell Claude what to change** (the [docs](https://code.claude.com/docs/en/permission-modes#review-and-approve-a-plan) call this choice **No, keep planning**)

   The first choice is highlighted when the menu opens. Until you choose, the session stays in plan mode.
5. Send the plan back once, even if it already looks right, so you practice it. Use `Down arrow` to move the highlight to **Tell Claude what to change**, type this correction on that line, and press `Enter`:

   ```text
   Keep the change to src/config.js and test/config.test.js. Don't add new files.
   ```

   Claude revises the plan and shows the menu again. If you press `Enter` before typing, Claude Code shows `User rejected Claude's plan:` and the session stays in plan mode, waiting for you: type the correction at the prompt instead.
6. When the revised plan looks right, leave it on screen and open another terminal in the same folder. Save what git sees, and the files the plan says it will change, one path per line, written the way `git status` shows them (relative to the repository root, with forward slashes):

   ```bash
   git status --porcelain > .practice/b-2-before.txt
   printf '%s\n' src/config.js test/config.test.js > .practice/b-2-plan.txt
   ```

   **Windows:** `'src/config.js','test/config.test.js' | Set-Content .practice/b-2-plan.txt` replaces the `printf` line.
7. Back in Claude Code, use `Down arrow` to move the highlight to **Yes, manually approve edits** and press `Enter`. Pressing `Enter` on the highlighted first choice would let Claude edit without asking you. The session leaves plan mode for Manual mode, so Claude asks before each edit and before most shell commands, such as running the tests.

   Read each request and answer with plain **Yes**: the other Yes choices stop Claude asking again for that kind of action, or switch the session to Accept edits or auto mode ([Configure permissions](https://code.claude.com/docs/en/permissions#permission-system)). If a command does more than the plan needs, choose **No** and tell Claude what to do instead. When Claude is done, save what git sees now, in the other terminal:

   ```bash
   git status --porcelain > .practice/b-2-after.txt
   ```

8. Set the example's change aside so Your turn starts clean. Git ignores `.practice/`, so your snapshots stay:

   ```bash
   git stash push --include-untracked -m b-2-example
   ```

## Your turn

Repeat the example in your practice copy, or your own repository, with a small change of your own:

1. Switch to plan mode with `Shift+Tab` until the status bar reads `⏸ plan mode on`.
2. Ask for the change, and answer any question Claude asks.
3. Send the plan back once: type one correction in **Tell Claude what to change** and press `Enter`.
4. While the final plan is on screen, run step 6's commands in another terminal, with your plan's file list.
5. Approve with **Yes, manually approve edits**, read and approve each edit and command as in step 7, then save `git status --porcelain > .practice/b-2-after.txt`.

Stop before committing. The next lesson starts from a clean tree and takes a new change to a commit.

## Check

You are done when all of these are true:

- [ ] `.practice/b-2-before.txt`, saved while the plan was on screen, lists no files. `cat .practice/b-2-before.txt` prints nothing.
- [ ] Every path in `.practice/b-2-after.txt` appears in `.practice/b-2-plan.txt`.
- [ ] Self-check (not tested): say, in one sentence, when you would pick Manual instead of Auto.

In the other terminal, run `npm run check -- b-2` in your practice copy. In your own repository, run `npm run check -- b-2 --dir <your repo>` from your practice copy instead.

If `.practice/b-2-before.txt` lists files, either the tree wasn't clean when Your turn started (the worked example's files there mean step 8 was skipped; in your own repository, they are your uncommitted work), or Claude wrote a file before you approved: check that the status bar read `⏸ plan mode on` when you sent the prompt, and look in the session for a command Claude ran that wrote a file. Either way, set the changes aside with `git stash push --include-untracked` (or commit your own work), then repeat Your turn from step 1 so the snapshots are saved again. If a changed path is missing from `.practice/b-2-plan.txt`, check that the plan file writes it the way `git status` does, then compare the plan you approved with what Claude changed.

## Go further

- Type `/plan <your task>` to enter plan mode and start the task in one step ([Commands](https://code.claude.com/docs/en/commands)).
- [Analyze before you edit with plan mode](https://code.claude.com/docs/en/permission-modes#analyze-before-you-edit-with-plan-mode): planning in more depth, including editing a plan before you approve it.

---

<sub>Sources: [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [Interactive mode](https://code.claude.com/docs/en/interactive-mode) · [Commands](https://code.claude.com/docs/en/commands) · [Tools reference](https://code.claude.com/docs/en/tools-reference) · [Configure permissions](https://code.claude.com/docs/en/permissions)</sub>

<sub>← [Install, sign in and look around](01-install-and-look-around.md) · [Beginner index](README.md) · [Your first change, from request to commit](03-first-change.md) → · Topic: [Permissions and safety](../topics/permissions-and-safety.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-2)</sub>
