# Beginner capstone: fix a reported bug, from plan to commit

<sub>**Beginner** · Capstone · 30 to 60 minutes · Needs: the five [Beginner lessons](README.md), or their skills · Verified against Claude Code v2.1.292 (stable) on 2026-10-19</sub>

This task puts the whole Beginner level together. Unlike the lessons, it has no worked example: the steps say what to do, and you choose the prompts and make the calls. The [Beginner Exit](README.md#by-the-end-of-this-level-you-can) is the list of what you can do by the end of this level. The check reads the files and the commit this task leaves behind, and you tick the rest of the Exit yourself under [What the check can't see](#what-the-check-cant-see). When both are done, you've shown the Beginner Exit, whether you took the lessons or not.

## You need

- Your copy of the practice template, with no uncommitted changes, and Node.js LTS (a Codespace on your copy has it). If `git status --porcelain` ([git status](https://git-scm.com/docs/git-status)) lists files, commit them. The capstone runs in the template only.
- If you skipped the lessons: create the `.practice/` folder in your copy (`mkdir -p .practice`; **Windows:** `New-Item -ItemType Directory -Force .practice`). The template already tells git to ignore it.
- A committed `CLAUDE.md` in your copy that names the test command, `npm test`: `git show HEAD:CLAUDE.md` shows it. Lesson 5 gives you one; if yours doesn't name `npm test`, add it.
- If you skipped lesson 5: start `claude` in your copy and run `/init`. In the new `CLAUDE.md`, delete what it says about the course's own files (`checks/`, `learn/`, `capstone/` and `.github/`) and about `npm run check`, `npm run learn` and `npm run test:checks`, including any rule to keep your work off `main`: that rule is for the template repository, not your copy. Make sure the file names `npm test`, then end that session with `/exit`, so the task starts in a new one.
- Commit any change to `CLAUDE.md` on its own before you start (`git add CLAUDE.md`, then `git commit -m "Add CLAUDE.md"`): the fix commit may change only the files the plan names.
- Two terminals open in your copy: one for Claude Code, one for your own commands.
- Usage: moderate.

> [!NOTE]
> On native Windows, run every command in PowerShell. A command with no **Windows** line works there as written; where a **Windows** line follows a command, use it instead. If `Shift+Tab` does nothing, press `Alt+M` instead ([Interactive mode](https://code.claude.com/docs/en/interactive-mode#general-controls)).

## The task

A missing folder in `linkcheck.json` passes silently: make linkcheck fail on it, test first. A teammate filed the bug report in `capstone/beginner-bug.md` in your practice copy: the tool says every link resolves and exits with code 0. Read it first: its "What should happen" section is what done means.

Fix it the way the Beginner lessons taught:

1. Reproduce the bug before you fix it. In your own terminal, make a new folder outside your practice copy and save `{ "files": ["docs"] }` in it as `linkcheck.json`. Then run `npm run linkcheck -- <that folder>` in your copy: until the bug is fixed, it prints `All relative links resolve.` Don't put a `linkcheck.json` in your copy, because the check counts it as a change. **Windows:** save the file with `'{ "files": ["docs"] }' | Set-Content <that folder>\linkcheck.json`, not `>`. In Windows PowerShell 5.1, `>` writes UTF-16 ([about_Character_Encoding](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_character_encoding?view=powershell-5.1)), which the tool rejects as invalid JSON with exit code 2, even before the fix.
2. Start a new session in your copy. It usually starts in auto mode. Here you want to approve the plan before any file changes, so switch to plan mode before your first prompt: press `Shift+Tab` until the status bar shows `⏸ plan mode on`, or start the prompt with `/plan` ([Permission modes](https://code.claude.com/docs/en/permission-modes#analyze-before-you-edit-with-plan-mode)).
3. Have Claude read the bug report and plan the fix. Don't name the files to change: let Claude find them. Ask for a plan that adds the test first and runs it before changing the code, so you see it fail ([Best practices](https://code.claude.com/docs/en/best-practices#provide-specific-context-in-your-prompts): "write a failing test that reproduces the issue, then fix it").
4. Review the plan before you approve it. Open the files it names and check that the code it describes is there, as you checked Claude's answer in [lesson 1](01-install-and-look-around.md#your-turn). The plan should add a test of what the bug report's "What should happen" asks for, run it and see it fail before any source file changes, and change only the files the bug needs. If it falls short, use the plan menu to tell Claude what to change, as in [lesson 2](02-permission-modes-and-plan-mode.md#worked-example) ([Permission modes](https://code.claude.com/docs/en/permission-modes#review-and-approve-a-plan)).
5. While the final plan is on screen, in your own terminal, save `git status --porcelain` to `.practice/capstone-before.txt`. Save the files the plan will change, every test file included, to `.practice/capstone-plan.txt`: one path per line, relative to the repository root, with forward slashes, such as `src/cli.js`.
6. Approve with **Yes, and use auto mode**, as in [lesson 2](02-permission-modes-and-plan-mode.md#worked-example): you've approved what Claude will do, so it can work without a prompt for each edit. Watch the new test fail, then pass after the fix. Claude may write a test or run the tests with a shell command, so read the test output itself, not only Claude's summary: press `Ctrl+O`, as in [lesson 3](03-first-change.md#worked-example), and `Ctrl+O` again to go back ([Interactive mode](https://code.claude.com/docs/en/interactive-mode#general-controls)).
7. Review the whole diff, the tests included, against the bug report, as in [lesson 3](03-first-change.md#worked-example). If the diff panel is open beside the conversation, its list skips test files and generated files and counts them on one line: click that count line to see the test ([Diff panel](https://code.claude.com/docs/en/interactive-mode#diff-panel)). Does the error name the missing folder? Does the tool exit with code 2? Does the test check the case the report describes? `git diff` ([git diff](https://git-scm.com/docs/git-diff)) leaves out a new file until you run `git add -N <file>` ([git add](https://git-scm.com/docs/git-add#Documentation/git-add.txt--N)). Ask Claude to correct anything that falls short, inside the files the plan names, and make sure `npm test` passes.
8. Commit the fix and its test together, then save the commit with `git rev-parse HEAD > .practice/capstone-commit.txt` ([git rev-parse](https://git-scm.com/docs/git-rev-parse)). The check reads only that commit, so if you change it later, save it again.

If Claude's fix heads the wrong way, press `Esc`, or rewind and re-prompt as in [lesson 4](04-keep-a-session-on-track.md#worked-example), then check `git status`: rewind doesn't undo a shell command's change to a file Claude hadn't edited ([Checkpointing](https://code.claude.com/docs/en/checkpointing#bash-command-changes-not-tracked)).

## Check

You are done when all of these are true:

- [ ] `.practice/capstone-before.txt`, saved while the plan was on screen, lists no changed files.
- [ ] The commit in `.practice/capstone-commit.txt` changes only files listed in `.practice/capstone-plan.txt`, including a test file.
- [ ] The commit's test fails without its fix: with the other files the commit changes put back as they were before it, `npm test` fails.
- [ ] The bug is fixed: with the bug report's `linkcheck.json` in a folder outside your copy, `npm run linkcheck -- <that folder>` exits with code 2, and its error names the missing folder, `docs`.
- [ ] `npm test` passes.
- [ ] A committed `CLAUDE.md` names the test command, `npm test`.
- [ ] `git status --porcelain` prints nothing.

Run `npm run check -- b-capstone` in your practice copy. Each item that fails prints what to fix.

## What the check can't see

The check doesn't look at these parts of the Beginner Exit. Tick them yourself, honestly:

- [ ] I can tell which model and account a session uses, with `/status` ([Commands](https://code.claude.com/docs/en/commands)), and I check what Claude tells me against the code.
- [ ] I can say which permission mode a task needs: auto mode for work whose direction I trust, plan mode when I want to approve a plan before any change, and Manual mode when I want Claude Code to ask before most edits and commands. I skip the plan when I could describe the diff in one sentence.
- [ ] I read the whole diff, the tests included, against the bug report before committing, and asked Claude to correct anything that fell short, or found nothing to correct.
- [ ] I know how to get back on track: `Esc` to stop Claude mid-action, `/rewind` to put the code and the conversation back, and `git status` for anything a shell command changed. I know when I'd use the session commands: `/compact` to keep going on the same task in a long conversation, `/clear` to start a new task with empty context, and `/resume` to go back to an earlier conversation.
- [ ] I've seen a new session follow a rule from CLAUDE.md that I didn't repeat in the prompt. If you skipped lesson 5, its [Worked example](05-project-memory.md#worked-example) shows you how.

When every box on this page is ticked, you're ready for the [Intermediate level](../intermediate/README.md). Its "ready if" list is the Beginner Exit.

If this level helped, a star helps other developers find the guide.

---

<sub>Sources: [Permission modes](https://code.claude.com/docs/en/permission-modes) · [Commands](https://code.claude.com/docs/en/commands) · [Best practices](https://code.claude.com/docs/en/best-practices) · [Interactive mode](https://code.claude.com/docs/en/interactive-mode) · [Checkpointing](https://code.claude.com/docs/en/checkpointing) · [git add](https://git-scm.com/docs/git-add) · [about_Character_Encoding](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_character_encoding?view=powershell-5.1) · the [Beginner lessons](README.md), which cite the official pages for each step. · [git status](https://git-scm.com/docs/git-status) · [git diff](https://git-scm.com/docs/git-diff) · [git rev-parse](https://git-scm.com/docs/git-rev-parse)</sub>

<sub>← [Project memory with CLAUDE.md](05-project-memory.md) · [Beginner index](README.md) · [Intermediate index](../intermediate/README.md) → · [Stuck on this capstone?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-capstone)</sub>
