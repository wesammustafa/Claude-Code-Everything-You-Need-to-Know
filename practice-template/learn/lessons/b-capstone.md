---
lesson: b-capstone
title: "Beginner capstone: fix a reported bug, from plan to commit"
source: docs/beginner/capstone.md
source-commit: 676831f
stamp: "Verified against Claude Code v2.1.308 (stable) on 2026-10-25"
page: https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/blob/main/docs/beginner/capstone.md
stuck: https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-capstone
next: i-1
badge: Beginner
---

## intro
- minutes: "30 to 60 minutes"
- why: "A missing folder in `linkcheck.json` passes silently: make linkcheck fail on it, test first."
- can: "fix a reported bug, from plan to commit"
- payoff: "fix a reported bug, from plan to commit"

## steps

### T1 | The task step 1 of 8 | Prepare and reproduce
- tier: challenge
- skill: commit
- where: terminal
- beat: do
- verify: check 5
- watching: the committed CLAUDE.md
- goal: "A committed `CLAUDE.md` in your copy that names the test command, `npm test`"
- note: "A teammate filed the bug report in `capstone/beginner-bug.md` in your practice copy: the tool says every link resolves and exits with code 0. Read it first: its "What should happen" section is what done means."
- hint: "If you skipped lesson 5: start `claude` in your copy and run `/init`."
- hint: "In the new `CLAUDE.md`, delete what it says about the course's own files (`checks/`, `learn/`, `capstone/` and `.github/`) and about `npm run check`, `npm run learn` and `npm run test:checks`, including any rule to keep your work off `main`: that rule is for the template repository, not your copy."
- hint: "Make sure the file names `npm test`, then end that session with `/exit`, so the task starts in a new one."
- bottom: "Commit any change to `CLAUDE.md` on its own before you start (`git add CLAUDE.md`, then `git commit -m "Add CLAUDE.md"`)"
- beat: do
- verify: git-clean
- goal: "Your copy of the practice template, with no uncommitted changes"
- hint: "If `git status --porcelain` ([git status](https://git-scm.com/docs/git-status)) lists files, commit them."
- beat: do
- verify: self
- goal: "Reproduce the bug before you fix it."
- do: "make a new folder outside your practice copy and save `{ "files": ["docs"] }` in it as `linkcheck.json`."
- hint: "Then run `npm run linkcheck -- <that folder>` in your copy: until the bug is fixed, it prints `All relative links resolve.`"
- win-note: "**Windows:** save the file with `'{ "files": ["docs"] }' | Set-Content <that folder>\linkcheck.json`, not `>`."

### T2 | The task step 2 of 8 | Start in plan mode
- tier: challenge
- skill: plan-mode
- where: terminal
- beat: do
- verify: self
- goal: "Start a new session in your copy."
- hint: "start `claude` in your copy"
- beat: do
- where: claude
- verify: self
- goal: "Here you want to approve the plan before any file changes, so switch to plan mode before your first prompt"
- hint: "press `Shift+Tab` until the status bar shows `⏸ plan mode on`, or start the prompt with `/plan`"

### T3 | The task step 3 of 8 | Plan test-first
- tier: challenge
- skill: plan-ask
- where: claude
- beat: do
- verify: self
- goal: "Have Claude read the bug report and plan the fix."
- do: "Ask for a plan that adds the test first and runs it before changing the code, so you see it fail"
- hint: "Don't name the files to change: let Claude find them."

### T4 | The task step 4 of 8 | Review the plan against the code
- tier: challenge
- skill: review-diff
- where: claude
- beat: do
- verify: self
- goal: "Review the plan before you approve it."
- hint: "Open the files it names and check that the code it describes is there,"
- hint: "If it falls short, use the plan menu to tell Claude what to change,"

### T5 | The task step 5 of 8 | Record the plan moment
- tier: challenge
- skill: snapshot
- where: shell
- beat: do
- verify: check 0 fresh since T3
- evidence: .practice/capstone-before.txt
- goal: "While the final plan is on screen, in your own terminal, save `git status --porcelain` to `.practice/capstone-before.txt`."
- hint: "If you skipped the lessons: create the `.practice/` folder in your copy"
- hint: "`mkdir -p .practice`; **Windows:** `New-Item -ItemType Directory -Force .practice`"
- watching: .practice/capstone-before.txt
- beat: do
- verify: file .practice/capstone-plan.txt fresh since T3
- goal: "Save the files the plan will change, every test file included, to `.practice/capstone-plan.txt`"
- note: "one path per line, relative to the repository root, with forward slashes, such as `src/cli.js`."
- hint: "The commit in `.practice/capstone-commit.txt` changes only files listed in `.practice/capstone-plan.txt`, including a test file."

### T6 | The task step 6 of 8 | Watch red become green
- tier: challenge
- skill: run-tests
- where: claude
- beat: do
- verify: self
- goal: "Approve with **Yes, and use auto mode**, as in [lesson 2](02-permission-modes-and-plan-mode.md#worked-example)"
- hint: "Watch the new test fail, then pass after the fix."
- hint: "press `Ctrl+O`, as in [lesson 3](03-first-change.md#worked-example), and `Ctrl+O` again to go back"

### T7 | The task step 7 of 8 | Review the whole result
- tier: challenge
- skill: review-diff
- where: claude
- beat: do
- verify: self
- goal: "Review the whole diff, the tests included, against the bug report"
- hint: "If the diff panel is open beside the conversation, its list skips test files and generated files and counts them on one line: click that count line to see the test ([Diff panel](https://code.claude.com/docs/en/interactive-mode#diff-panel))."
- hint: "Does the error name the missing folder? Does the tool exit with code 2? Does the test check the case the report describes?"
- hint: "Ask Claude to correct anything that falls short, inside the files the plan names, and make sure `npm test` passes."

### T8 | The task step 8 of 8 | Save the reviewed commit
- tier: challenge
- skill: commit
- where: shell
- beat: do
- verify: check 1 2 fresh since T3
- evidence: .practice/capstone-commit.txt
- watching: .practice/capstone-commit.txt
- goal: "Commit the fix and its test together"
- note: "then save the commit with `git rev-parse HEAD > .practice/capstone-commit.txt`"
- hint: "The check reads only that commit, so if you change it later, save it again."

### C | Check | Check
- tier: challenge
- skill: check
- where: shell
- beat: do
- verify: check all
- goal: "Run `npm run check -- b-capstone`"

- beat: self
- self: "I can tell which model and account a session uses, with `/status` ([Commands](https://code.claude.com/docs/en/commands)), and I check what Claude tells me against the code."
- beat: self
- self: "I can say which permission mode a task needs: auto mode for work whose direction I trust, plan mode when I want to approve a plan before any change, and Manual mode when I want Claude Code to ask before most edits and commands. I skip the plan when I could describe the diff in one sentence."
- beat: self
- self: "I read the whole diff, the tests included, against the bug report before committing, and asked Claude to correct anything that fell short, or found nothing to correct."
- beat: self
- self: "I know how to get back on track: `Esc` to stop Claude mid-action, `/rewind` to put the code and the conversation back, and `git status` for anything a shell command changed. I know when I'd use the session commands: `/compact` to keep going on the same task in a long conversation, `/clear` to start a new task with empty context, and `/resume` to go back to an earlier conversation."
- beat: self
- self: "I've seen a new session follow a rule from CLAUDE.md that I didn't repeat in the prompt. If you skipped lesson 5, its [Worked example](05-project-memory.md#worked-example) shows you how."

## ladder

### `.practice/capstone-before.txt`, saved while the plan was on screen, lists no changed files
- narrow "While the plan is on screen": Was the before snapshot saved while approval was still pending?
- narrow "Files had changed before": Was the tree clean before this plan was approved?
- back: T4 Revisit the decision and evidence from this step before trying the same action again.

### the commit in `.practice/capstone-commit.txt` changes only files listed in `.practice/capstone-plan.txt`, including a test
- narrow "Save the files the plan": Did you record every path in the final approved plan?
- narrow "After you commit the fix": Did you save the SHA of the reviewed fix commit?
- narrow "which is not a commit": Does the saved SHA exist in this practice copy?
- narrow "files the plan didn't name": Does each changed path belong to the approved plan?
- narrow "changes no test file": Does the saved fix commit include its regression test?
- narrow "changes only tests": Is the code fix included in the same commit as its test?
- back: T4 Revisit the decision and evidence from this step before trying the same action again.

### the commit's test fails without its fix: with the other files it changes as they were before it, `npm test` fails
- narrow "After you commit the fix": Did you save the SHA of the reviewed fix commit?
- narrow "which is not a commit": Does the saved SHA exist in this practice copy?
- narrow "changes no test file": Does the saved fix commit include its regression test?
- narrow "changes only tests": Is the code fix included in the same commit as its test?
- narrow "could not copy": Can the repository be copied locally for the regression check?
- narrow "could not check out": Can git read the saved commit in the temporary copy?
- narrow "first commit in this repository": Is there a version of the code from before the fix to test?
- narrow "did not finish": Did npm report failing tests, rather than a runner error?
- narrow "still passes, so": Would the new test fail if the source fix were removed?
- back: T3 Revisit the decision and evidence from this step before trying the same action again.

### the reported bug is fixed: a missing folder in `linkcheck.json` makes the tool exit with code 2 and name the folder
- narrow "not 2.": Does the missing-folder case fail with the required exit code?
- narrow "doesn't name the missing folder": Does the error identify the folder the user needs to fix?
- back: T3 Revisit the decision and evidence from this step before trying the same action again.

### the tests pass
- narrow "`npm test` fails.": What is the first failing test before later errors?
- narrow "This repository has no": Does the practice copy still have its test script?
- narrow "not an exit code.": Was a numeric command exit code recorded?
- narrow "not 0.": Do the tests pass before their result is recorded?
- back: T7 Revisit the decision and evidence from this step before trying the same action again.

### a committed CLAUDE.md names the test command, `npm test`
- narrow "doesn't mention `npm test`": Does the committed project memory name the real test command?
- narrow "There is no committed CLAUDE.md.": Were the project instructions committed before starting the fix?

### nothing is left uncommitted
- narrow "These changes are uncommitted": Which files remain outside the reviewed fix commit?
- hint: "Don't put a `linkcheck.json` in your copy, because the check counts it as a change."
- back: T8 Revisit the decision and evidence from this step before trying the same action again.

## card
- skill: review-diff
- show: "git add -N <file>"
- does: "leaves out a new file until you run `git add -N <file>`"
