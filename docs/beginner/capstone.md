# Beginner capstone: fix a reported bug, from plan to commit

<sub>**Beginner** · Capstone · 30 to 60 minutes · Needs: the five [Beginner lessons](README.md), or their skills · Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

This task puts the whole Beginner level together, with no step-by-step help. Its check covers every Beginner Exit statement that leaves a file or a commit behind. If it passes, you've shown those statements, whether you took the lessons or not.

## You need

- Your copy of the practice template, with no uncommitted changes, and Node.js LTS (a Codespace on your copy has it). The capstone runs in the template only.
- If you skipped the lessons: create the `.practice/` folder in your copy (`mkdir -p .practice`; **Windows:** `New-Item -ItemType Directory -Force .practice`). The template already tells git to ignore it.
- Usage: moderate.

## The task

A teammate filed the bug report in `capstone/beginner-bug.md` in your practice copy: when `linkcheck.json` lists a folder that doesn't exist, the tool says every link resolves and exits with code 0. Fix it the way the Beginner lessons taught:

1. Save the output of `claude --version` to `.practice/version.txt`.
2. In a session, read the bug report and plan the fix in plan mode. The fix touches two source files and a test.
3. While the plan is on screen, save `git status --porcelain` to `.practice/capstone-before.txt`, and the files the plan will change, one per line, to `.practice/capstone-plan.txt`.
4. Approve the plan. Add a test that fails before the fix, then make it pass.
5. Review the diff, ask for at least one correction, and make sure `npm test` passes.
6. Make sure the committed `CLAUDE.md` names the test command, `npm test`. If you did lesson 5, it does. If you skipped it, run `/init`, check that the file names `npm test`, and commit it on its own, before the fix: the check accepts only planned files in the fix commit.
7. Commit the fix, then save the commit with `git rev-parse HEAD > .practice/capstone-commit.txt`.

Keep the session on track as you go: check `/context`, and compact or rewind when it helps.

## Check

You are done when all of these are true:

- [ ] `.practice/version.txt` holds the output of `claude --version`.
- [ ] `.practice/capstone-before.txt`, saved while the plan was on screen, lists no changed files.
- [ ] The commit in `.practice/capstone-commit.txt` changes only files listed in `.practice/capstone-plan.txt`, including a test file.
- [ ] The bug is fixed: with `{ "files": ["docs"] }` and no `docs/` folder, `npm run linkcheck -- <that folder>` exits with code 2.
- [ ] `npm test` passes.
- [ ] A committed `CLAUDE.md` names the test command, `npm test`.
- [ ] `git status --porcelain` prints nothing.

Run `npm run check -- b-capstone` in your practice copy. Each item that fails prints what to fix.

## What the check can't see

Some of the Beginner Exit leaves nothing in files or git. Tick these yourself, honestly:

- [ ] I can tell which model and account a session uses, with `/status`.
- [ ] I can switch permission modes with `Shift+Tab` and say which one a task needs.
- [ ] I can keep a session on track with `/context`, `/clear`, `/compact`, `/rewind` and `/resume`.
- [ ] I've seen a new session follow a rule from CLAUDE.md that I didn't repeat in the prompt.

When every box on this page is ticked, you're ready for the [Intermediate level](../intermediate/README.md). Its "ready if" list is the Beginner Exit.

If this level helped, a star helps other developers find the guide.

---

<sub>Sources: the [Beginner lessons](README.md), which cite the official pages for each step.</sub>

<sub>← [Project memory with CLAUDE.md](05-project-memory.md) · [Beginner index](README.md) · [Intermediate index](../intermediate/README.md) → · [Stuck on this capstone?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-capstone)</sub>
