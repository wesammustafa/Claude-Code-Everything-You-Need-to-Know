# Choose who approves what: permission modes and plan mode

<sub>**Beginner** · Lesson 2 of 5 · about 25 minutes · Needs: [Install, sign in and look around](01-install-and-look-around.md) · Verified against Claude Code v2.1.308 (stable) on 2026-10-25</sub>

## Goal

By the end of this lesson you can pick a permission mode for a task, decide whether a change needs a plan, and use plan mode to approve only a plan you would merge, before Claude edits your files.

## You need

- Your copy of the practice template, cloned, with no uncommitted changes, and Node.js LTS for its checks (a Codespace on your copy has both).
- A second terminal open in the same folder, for git.
- Usage: light.

> [!NOTE]
> On native Windows, run the commands in PowerShell and use the lines marked **Windows** where they differ. If `Shift+Tab` does nothing, press `Alt+M` instead ([Interactive mode](https://code.claude.com/docs/en/interactive-mode)).

## The idea

A [permission mode](https://code.claude.com/docs/en/permission-modes) decides which actions Claude takes without asking you first. A new session starts in auto mode, where a second model, the classifier, reviews actions instead of you and blocks anything that escalates beyond your request. Ordinary source-file edits in your working directory don't reach the classifier: auto mode approves them ([How the classifier evaluates actions](https://code.claude.com/docs/en/permission-modes#how-the-classifier-evaluates-actions)). Whether an edit belongs in the change is yours to judge. `Shift+Tab` switches modes, and the status bar under the prompt shows the one in force:

- **Auto**, `⏵⏵ auto mode on`: no routine prompts. For most work, where you trust the general direction.
- **Plan**, `⏸ plan mode on`: Claude explores and writes a plan, and can't edit your files until you approve it.
- **Manual**, `⏸ manual mode on`: Claude asks before edits and most commands. For sensitive work, or whenever approving each step is the point.
- **Accept edits**, `⏵⏵ accept edits on`: file edits and common file commands, such as `mkdir`, `mv` and `rm`, run without asking inside your working directory ([Auto-approve file edits](https://code.claude.com/docs/en/permission-modes#auto-approve-file-edits-with-acceptedits-mode)). For code you'll review afterwards.

Plan when you're unsure of the approach, the change touches several files, or you don't know the code. If you could describe the diff in one sentence, such as a typo fix, skip the plan ([Best practices](https://code.claude.com/docs/en/best-practices#explore-first-then-plan-then-code)). When you do plan, approve only a plan you would merge.

## Worked example

1. Start `claude` in your practice copy. The status bar usually reads `⏵⏵ auto mode on` ([Which mode a session starts in](https://code.claude.com/docs/en/permission-modes#which-mode-a-session-starts-in)).
2. The change makes `parseConfig` in `src/config.js` reject an empty file, with a test: two files, in code you haven't read, so plan it. Press `Shift+Tab` until the status bar reads `⏸ plan mode on`. Each press moves to the next mode, and the status bar names it.
3. Ask for the change:

   ```text
   Make parseConfig in src/config.js reject an empty file with a clear error message, and add a test for it.
   ```

4. Claude reads files and may run commands to explore, but doesn't edit your files. If it needs a decision from you first, it asks a [multiple-choice question](https://code.claude.com/docs/en/tools-reference#askuserquestion-tool-behavior): pick an option or type your own answer, and it keeps planning. Then it shows a plan and asks how to proceed, with these choices:
   - Usually **Yes, and use auto mode** (it reads **Yes, auto-accept edits** if auto mode isn't available to you)
   - **Yes, manually approve edits**
   - A choice to keep planning and revise the plan (the [docs](https://code.claude.com/docs/en/permission-modes#review-and-approve-a-plan) call this choice **No, keep planning**)

   Check which choice is highlighted before you press `Enter`: **Yes, and use auto mode** approves the plan and switches to auto mode. Until you approve, the session stays in plan mode.
5. Read the plan the way you would read a teammate's: which files change, and what each change does. Say you want the error to name the file, so whoever sees it knows what to fix. The plan is the cheapest place to change your mind, because nothing is edited yet. Use the plan menu to send this revision, then press `Enter`:

   ```text
   Make the error say "linkcheck.json is empty", and keep the change to src/config.js and test/config.test.js.
   ```

   Send it with `Enter`, not `Shift+Tab`, which approves the plan on this menu ([CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)). Claude revises the plan and shows the menu again. Your change can be below the top of the plan, so scroll to find it.
6. Leave the revised plan on screen, open another terminal in the same folder and run `git status` ([git status](https://git-scm.com/docs/git-status)). It says `nothing to commit, working tree clean`: plan mode hasn't changed a file.
7. Back in Claude Code, use `Down arrow` to move the highlight to **Yes, manually approve edits** and press `Enter`. Here approving each step is the point: you watch the plan land. After a plan you trust, **Yes, and use auto mode** is the everyday choice. The session switches to Manual mode, so Claude asks before each edit and before most shell commands, such as running the tests. Read each request:
   - An edit or a command the plan needs: **Yes**.
   - The test command, `npm test`: **Yes**, or **Yes, and don't ask again** if you would rather not be asked about it again. That saves a rule for this repository in `.claude/settings.local.json` ([Configure permissions](https://code.claude.com/docs/en/permissions#permission-system)), so keep it for commands whose effects you know.
   - A command that does more than the plan needs, such as `npm test && git add -A` ([git add](https://git-scm.com/docs/git-add)): **No**. To say what to do instead, move the highlight to **No**, press `Tab`, type it and press `Enter` ([Add a comment](https://code.claude.com/docs/en/permissions#add-a-comment-when-you-answer-a-permission-prompt)).

   Answer with the arrow keys and `Enter`. Skip **Yes, and switch to auto mode**, which ends the step-by-step review ([Switch permission modes](https://code.claude.com/docs/en/permission-modes#switch-permission-modes)), and don't press `Shift+Tab` here: on an edit request it picks the choice that allows edits for the rest of the session, when the request offers one ([Interactive mode](https://code.claude.com/docs/en/interactive-mode#general-controls)).
8. When Claude is done, run `git status` in the other terminal again. It lists `src/config.js` and `test/config.test.js`, the two files the plan named. If it lists another file, look in the session for the edit or command that wrote it.
9. You reviewed each edit as it landed, so commit the example's change, and Your turn starts from a clean tree ([git commit](https://git-scm.com/docs/git-commit)):

   ```bash
   git commit -am "Reject an empty linkcheck.json"
   ```

## Your turn

Work a teammate's ticket so that nothing ships you'd reject in review. The ticket is `practice/b-2/ticket.md` in your practice copy.

1. Read the ticket yourself first.
2. Start a fresh conversation for the new task: type `/exit`, then start `claude` again. To enter plan mode and start the task in one step, type `/plan` before it ([Commands](https://code.claude.com/docs/en/commands)):

   ```text
   /plan Work the ticket in practice/b-2/ticket.md
   ```

   Check that the status bar reads `⏸ plan mode on`, and answer any question Claude asks.
3. Read the plan as its reviewer. For each change, ask whether you would merge it as part of this ticket. If the plan includes a request you wouldn't merge, use the plan menu to send it back, in your own words, with your reason. If the plan already leaves one out, read Claude's reason and decide whether you agree. Revise until the plan is one you would approve.
4. While the final plan is on screen, save what git sees, and the files the plan says it will change, in the other terminal. Write each path the way `git status` shows it: relative to the repository root, with forward slashes, one per line. For a plan that changed `src/links.js` and `test/links.test.js`, it would be:

   ```bash
   mkdir -p .practice
   git status --porcelain > .practice/b-2-before.txt
   printf '%s\n' src/links.js test/links.test.js > .practice/b-2-plan.txt
   ```

   **Windows:** `New-Item -ItemType Directory -Force .practice` replaces the `mkdir` line, and `'src/links.js','test/links.test.js' | Set-Content .practice/b-2-plan.txt` replaces the `printf` line.
5. Approve the plan you reviewed. After a plan you trust, **Yes, and use auto mode** is the everyday choice; if Claude Code asks before an action, read it before you answer.
6. When Claude is done, save what git sees now:

   ```bash
   git status --porcelain > .practice/b-2-after.txt
   ```

   Then read `git diff` and commit the change, new files included, with a message that says what it does. `git status` then reads `nothing to commit, working tree clean`.

## Check

You are done when all of these are true:

- [ ] `.practice/b-2-before.txt`, saved while the plan was on screen, lists no changed files
- [ ] Every file in `.practice/b-2-after.txt` is listed in `.practice/b-2-plan.txt`
- [ ] An unknown key in `linkcheck.json`, such as `ignores`, makes the tool exit with code 2 and name the key
- [ ] A broken link still makes the tool exit with code 1 and report the link

In the other terminal, run `npm run check -- b-2` in your practice copy.

If `.practice/b-2-before.txt` lists files, the tree wasn't clean when Your turn started (commit the example, Worked example step 9), or Claude wrote a file before you approved: start again from a clean tree, in plan mode, at Your turn step 2. If a file in `.practice/b-2-after.txt` is missing from `.practice/b-2-plan.txt`, compare the plan you approved with what Claude changed, and write each path in the plan file the way `git status` does. If the unknown-key item fails, compare what Claude changed with the ticket's first request, and tell Claude what is missing. If a broken link no longer fails the tool, the plan you approved carried the ticket's last request: a build that passes with broken links hides the problem the tool exists to find, and once linkcheck catches the typo, `"ignore": ["vendor/"]` skips the vendor links. Ask Claude to undo that part, save `.practice/b-2-after.txt` again and commit.

## Watch out

- A limit you state in the conversation, such as "don't push", makes auto mode's classifier block matching actions, but it can be lost when the conversation is compacted ([Boundaries you state in conversation](https://code.claude.com/docs/en/permission-modes#boundaries-you-state-in-conversation)).

## Go further

- While a plan is on screen, press `Ctrl+G` to open it in your default text editor and edit it before Claude proceeds ([Review and approve a plan](https://code.claude.com/docs/en/permission-modes#review-and-approve-a-plan)).
- When auto mode blocks an action, `/permissions` lists it under **Recently denied**, where you can press `r` to retry it with your approval ([When auto mode falls back](https://code.claude.com/docs/en/permission-modes#when-auto-mode-falls-back)).
- [Analyze before you edit with plan mode](https://code.claude.com/docs/en/permission-modes#analyze-before-you-edit-with-plan-mode): what plan mode lets Claude run while it plans.

---

<sub>Sources: [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [Best practices](https://code.claude.com/docs/en/best-practices) · [Interactive mode](https://code.claude.com/docs/en/interactive-mode) · [Commands](https://code.claude.com/docs/en/commands) · [Tools reference](https://code.claude.com/docs/en/tools-reference) · [Configure permissions](https://code.claude.com/docs/en/permissions) · [Claude Code CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) · [git status](https://git-scm.com/docs/git-status) · [git add](https://git-scm.com/docs/git-add) · [git commit](https://git-scm.com/docs/git-commit)</sub>

<sub>← [Install, sign in and look around](01-install-and-look-around.md) · [Beginner index](README.md) · [Your first change, from request to commit](03-first-change.md) → · Topic: [Permissions and safety](../topics/permissions-and-safety.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-2)</sub>
