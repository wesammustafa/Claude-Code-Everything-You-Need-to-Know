# Beginner capstone: fix a reported bug, from plan to commit

<sub>**Beginner** · Capstone · 30 to 60 minutes · Needs: the five [Beginner lessons](README.md), or their skills · Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

This task puts the whole Beginner level together. Unlike the lessons, it has no worked example: the steps say what to do, and you choose the prompts. The [Beginner Exit](README.md#by-the-end-of-this-level-you-can) is the list of what you can do by the end of this level. The check reads the files and the commit this task leaves behind, and you tick the rest of the Exit yourself under [What the check can't see](#what-the-check-cant-see). When both are done, you've shown the Beginner Exit, whether you took the lessons or not.

## You need

- Your copy of the practice template, with no uncommitted changes, and Node.js LTS (a Codespace on your copy has it). If `git status --porcelain` lists files, commit them or set them aside with `git stash push --include-untracked`. The capstone runs in the template only.
- If you skipped the lessons: create the `.practice/` folder in your copy (`mkdir -p .practice`; **Windows:** `New-Item -ItemType Directory -Force .practice`). The template already tells git to ignore it.
- A committed `CLAUDE.md` in your copy that names the test command, `npm test`: `git show HEAD:CLAUDE.md` shows it. Lesson 5 gives you one; if yours doesn't name `npm test`, add it.
- If you skipped lesson 5, or did it only in your own repository: start `claude` in your copy and run `/init`. In the new `CLAUDE.md`, delete what it says about the course's own files (`checks/`, `capstone/` and `.github/`) and about `npm run check`, including any rule to keep your work off `main`: that rule is for the template repository, not your copy. Make sure the file names `npm test`.
- Commit any change to `CLAUDE.md` on its own before you start (`git add CLAUDE.md`, then `git commit -m "Add CLAUDE.md"`): the fix commit may change only the files the plan names.
- Usage: moderate.

> [!NOTE]
> On native Windows, run every command in PowerShell. A command with no **Windows** line works there as written; where a **Windows** line follows a command, use it instead. If `Shift+Tab` does nothing, press `Alt+M` instead ([Interactive mode](https://code.claude.com/docs/en/interactive-mode)).

## The task

A teammate filed the bug report in `capstone/beginner-bug.md` in your practice copy: when `linkcheck.json` lists a folder that doesn't exist, the tool says every link resolves and exits with code 0.

To try the bug by hand, make a new folder outside your practice copy and save `{ "files": ["docs"] }` in it as `linkcheck.json`. Then run `npm run linkcheck -- <that folder>` in your copy: until the bug is fixed, it prints `All relative links resolve.` Don't put a `linkcheck.json` in your copy, because the check counts it as a change. **Windows:** save the file with `'{ "files": ["docs"] }' | Set-Content <that folder>\linkcheck.json`, not `>`. In Windows PowerShell 5.1, `>` writes UTF-16 ([about_Character_Encoding](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_character_encoding?view=powershell-5.1)), which the tool rejects as invalid JSON with exit code 2, even before the fix.

Fix it the way the Beginner lessons taught:

1. Save the output of `claude --version` to `.practice/version.txt`.
2. Start a session and switch to plan mode before your first prompt. Then have Claude read the bug report and plan the fix. The fix touches two source files and a test. Ask for a plan that adds the test and runs it before changing the code, so you see it fail ([Best practices](https://code.claude.com/docs/en/best-practices#provide-specific-context-in-your-prompts): "write a failing test that reproduces the issue, then fix it").
3. While the final plan is on screen, open another terminal in the same folder. Save `git status --porcelain` to `.practice/capstone-before.txt`. Save the files the plan will change, the test file included, to `.practice/capstone-plan.txt`: one path per line, relative to the repository root, with forward slashes, such as `src/cli.js`.
4. Approve the plan. Watch the new test fail, then pass after the fix.
5. Review the whole diff, the test file included, as in [lesson 3](03-first-change.md#worked-example). `git diff` leaves out a new file until you run `git add -N <file>` ([git add](https://git-scm.com/docs/git-add#Documentation/git-add.txt--N)). Ask for at least one correction that stays inside the files the plan names, and make sure `npm test` passes.
6. Commit the fix and its test together, then save the commit with `git rev-parse HEAD > .practice/capstone-commit.txt`. The check reads only that commit, so if you change it later, save it again.

Keep the session on track as you go: check `/context`, and compact or rewind when it helps.

## Check

You are done when all of these are true:

- [ ] `.practice/version.txt` holds the output of `claude --version`.
- [ ] `.practice/capstone-before.txt`, saved while the plan was on screen, lists no changed files.
- [ ] The commit in `.practice/capstone-commit.txt` changes only files listed in `.practice/capstone-plan.txt`, including a test file.
- [ ] The bug is fixed: with the bug report's `linkcheck.json` in a folder outside your copy, `npm run linkcheck -- <that folder>` exits with code 2.
- [ ] `npm test` passes.
- [ ] A committed `CLAUDE.md` names the test command, `npm test`.
- [ ] `git status --porcelain` prints nothing.

Run `npm run check -- b-capstone` in your practice copy. Each item that fails prints what to fix.

## What the check can't see

The check doesn't look at these parts of the Beginner Exit. Tick them yourself, honestly:

- [ ] I can tell which model and account a session uses, with `/status`.
- [ ] I can switch permission modes with `Shift+Tab` and say which one a task needs.
- [ ] I read the whole diff before committing and asked Claude for at least one correction.
- [ ] I can keep a session on track with `/context`, `/clear`, `/compact`, `/rewind` and `/resume`.
- [ ] I've seen a new session follow a rule from CLAUDE.md that I didn't repeat in the prompt. If you skipped lesson 5, its [Worked example](05-project-memory.md#worked-example) shows you how.

When every box on this page is ticked, you're ready for the [Intermediate level](../intermediate/README.md). Its "ready if" list is the Beginner Exit.

If this level helped, a star helps other developers find the guide.

---

<sub>Sources: [Best practices](https://code.claude.com/docs/en/best-practices) · [Interactive mode](https://code.claude.com/docs/en/interactive-mode) · [git add](https://git-scm.com/docs/git-add) · [about_Character_Encoding](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_character_encoding?view=powershell-5.1) · the [Beginner lessons](README.md), which cite the official pages for each step.</sub>

<sub>← [Project memory with CLAUDE.md](05-project-memory.md) · [Beginner index](README.md) · [Intermediate index](../intermediate/README.md) → · [Stuck on this capstone?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-capstone)</sub>
