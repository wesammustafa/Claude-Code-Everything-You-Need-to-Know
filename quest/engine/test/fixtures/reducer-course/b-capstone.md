---
lesson: b-capstone
title: "Beginner capstone: fix a reported bug, from plan to commit"
source: docs/beginner/capstone.md
source-commit: 0c55f9e
stamp: "Verified against Claude Code v2.1.292 (stable) on 2026-10-15"
page: https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/blob/main/docs/beginner/capstone.md
stuck: https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-capstone
next: i-1
badge: Beginner
---

## intro
- minutes: "30 to 60 minutes"
- why: "This task puts the whole Beginner level together."
- can: "fix a reported bug, from plan to commit"
- can: "tell which model and account a session uses"
- can: "switch permission modes"
- can: "read the whole diff before committing"
- can: "keep a session on track"
- payoff: "fix a reported bug, from plan to commit"

## warm-up

### R1 | Warm-up | Rules for this project
- tier: challenge
- skill: memory
- from: b-5
- where: claude
- beat: ask
- ask: You want rules for this project only. Which file do you put them in?
- wrong: "the user file in `~/.claude/`"
- because: "the user file in `~/.claude/`: it applies to all your projects"
- right: "the `./CLAUDE.md` in this folder"
- reveal: "type `/memory` and choose **Project instructions**, the `./CLAUDE.md` in this folder."

### R2 | Warm-up | A change that went wrong
- tier: challenge
- skill: rewind
- from: b-4
- where: claude
- beat: type
- ask: A change Claude made went the wrong way. Which command do you run?
- accept: /rewind
- wrong: "/resume"
- because: "Picks up an earlier conversation"
- hint: "Goes back to an earlier prompt, restoring the code, the conversation or both"
- reveal: "Type `/rewind`"

## steps

### T1 | The task step 1 of 6 | Get ready
- tier: challenge
- skill: save-version
- where: terminal
- beat: do
- verify: check 0
- watching: .practice/version.txt
- evidence: .practice/version.txt
- goal: "Save the output of `claude --version` to `.practice/version.txt`."
- hint: "If you skipped the lessons: create the `.practice/` folder in your copy (`mkdir -p .practice`; **Windows:** `New-Item -ItemType Directory -Force .practice`)."
- beat: do
- verify: check 5
- watching: git show HEAD:CLAUDE.md
- say: Commit a `CLAUDE.md` that names the test command, `npm test`.
- expect: "`git show HEAD:CLAUDE.md` shows it."
- hint: "Lesson 5 gives you one; if yours doesn't name `npm test`, add it."
- hint: "If you skipped lesson 5, or did it only in your own repository: start `claude` in your copy and run `/init`."
- hint: "In the new `CLAUDE.md`, delete what it says about the course's own files (`checks/`, `learn/`, `capstone/` and `.github/`) and about `npm run check`, `npm run learn` and `npm run test:checks`, including any rule to keep your work off `main`: that rule is for the template repository, not your copy."
- hint: "Commit any change to `CLAUDE.md` on its own before you start (`git add CLAUDE.md`, then `git commit -m "Add CLAUDE.md"`)"
- why: "the fix commit may change only the files the plan names."
- beat: do
- verify: self
- done-label: I ran it
- say: If a session from `/init` is still open there, end it first.
- goal: "To try the bug by hand, make a new folder outside your practice copy and save `{ "files": ["docs"] }` in it as `linkcheck.json`."
- do: "Then run `npm run linkcheck -- <that folder>` in your copy"
- note: "Don't put a `linkcheck.json` in your copy, because the check counts it as a change."
- win-note: "**Windows:** save the file with `'{ "files": ["docs"] }' | Set-Content <that folder>\linkcheck.json`, not `>`."
- hint: "the bug report in `capstone/beginner-bug.md`"
- beat: ask
- ask: What did it print?
- right: "`All relative links resolve.`"
- stuck: "invalid JSON with exit code 2"
- because: "**Windows:** save the file with `'{ "files": ["docs"] }' | Set-Content <that folder>\linkcheck.json`, not `>`."
- other: I saw something different
- reveal: "Then run `npm run linkcheck -- <that folder>` in your copy: until the bug is fixed, it prints `All relative links resolve.`"
- beat: do
- verify: git-clean
- watching: git status
- say: Before you start, make sure your practice copy has nothing uncommitted.
- hint: "If `git status --porcelain` lists files, commit them or set them aside with `git stash push --include-untracked`."
- hint: "Don't put a `linkcheck.json` in your copy, because the check counts it as a change."
- why: "`.practice/capstone-before.txt`, saved while the plan was on screen, lists no changed files."

### T2 | The task step 2 of 6 | Plan the fix
- tier: challenge
- skill: plan-mode
- where: claude
- beat: do
- where: terminal
- verify: self
- done-label: plan mode is on
- goal: "Start a session and switch to plan mode before your first prompt."
- note: "Keep the session on track as you go: check `/context`, and compact or rewind when it helps."
- hint: "start `claude` in your copy"
- hint: "If `Shift+Tab` does nothing, press `Alt+M` instead"
- beat: do
- verify: self
- done-label: plan is on screen
- goal: "Then have Claude read the bug report and plan the fix."
- note: "A teammate filed the bug report in `capstone/beginner-bug.md` in your practice copy"
- do: "Ask for a plan that adds the test and runs it before changing the code, so you see it fail"
- hint: "write a failing test that reproduces the issue, then fix it"
- beat: ask
- ask: What does the plan on screen change?
- right: two source files and at least one test file
- option: one source file and at least one test file
- stuck: source files, but no test file
- because: "Ask for a plan that adds the test and runs it before changing the code, so you see it fail"
- other: I saw something different
- reveal: "The fix touches two source files and at least one test file."

### T3 | The task step 3 of 6 | Save the plan
- tier: challenge
- skill: snapshot
- where: shell
- beat: predict
- safety: plan-approval
- ask: Guess: if Claude asks you to approve the final plan, what do you do first?
- option: Approve the plan
- right: Save what git sees
- option: Ask Claude to run the tests
- reveal: "`.practice/capstone-before.txt`, saved while the plan was on screen, lists no changed files."
- beat: do
- verify: check 1 fresh since T2
- watching: .practice/capstone-before.txt
- evidence: .practice/capstone-before.txt
- say: Leave the final plan on screen, and save what git sees now.
- hint: "While the final plan is on screen, open another terminal in the same folder."
- hint: "Save `git status --porcelain` to `.practice/capstone-before.txt`."
- beat: do
- verify: file .practice/capstone-plan.txt fresh since T2
- watching: .practice/capstone-plan.txt
- goal: "Save the files the plan will change, every test file included, to `.practice/capstone-plan.txt`: one path per line, relative to the repository root, with forward slashes, such as `src/cli.js`."
- hint: "The fix touches two source files and at least one test file."
- hint: "The commit in `.practice/capstone-commit.txt` changes only files listed in `.practice/capstone-plan.txt`, including a test file."
- why: "the fix commit may change only the files the plan names."

### T4 | The task step 4 of 6 | Watch the test
- tier: challenge
- skill: run-tests
- where: claude
- beat: do
- verify: self
- done-label: approved
- goal: "Approve the plan."
- note: "To read the test output, not only Claude's summary, press `Ctrl+O` as in [lesson 3](03-first-change.md#worked-example), and `Esc` to go back"
- beat: ask
- ask: What did the new test do?
- option: it passed the first time it ran
- because: "write a failing test that reproduces the issue, then fix it"
- option: it never ran
- because: "Ask for a plan that adds the test and runs it before changing the code, so you see it fail"
- right: it failed, then passed
- other: I saw something different
- reveal: "Watch the new test fail, then pass after the fix."
- beat: do
- where: shell
- verify: check 3 4
- watching: npm test
- expect: "`npm run linkcheck -- <that folder>` exits with code 2."
- expect: "`npm test` passes."
- bottom: "npm run linkcheck -- <that folder>"

### T5 | The task step 5 of 6 | Review it
- tier: challenge
- skill: review-diff
- where: claude
- beat: do
- verify: self
- done-label: read it all
- goal: "Review the whole diff, the test file included, as in [lesson 3](03-first-change.md#worked-example)."
- note: "The diff panel's list leaves test files out until you click the line that counts them"
- hint: "`git diff` leaves out a new file until you run `git add -N <file>`"
- beat: do
- verify: self
- done-label: asked for one
- goal: "Ask for at least one correction that stays inside the files the plan names, and make sure `npm test` passes."
- hint: "The commit in `.practice/capstone-commit.txt` changes only files listed in `.practice/capstone-plan.txt`, including a test file."
- beat: do
- where: shell
- verify: check 4
- watching: npm test
- say: Once the correction is in, check the tests again.
- expect: "`npm test` passes."

### T6 | The task step 6 of 6 | Commit it
- tier: challenge
- skill: commit
- where: claude
- beat: do
- verify: self
- done-label: committed
- goal: "Commit the fix and its test together"
- hint: "The commit in `.practice/capstone-commit.txt` changes only files listed in `.practice/capstone-plan.txt`, including a test file."
- beat: do
- where: shell
- verify: check 2 fresh since T2
- watching: .practice/capstone-commit.txt
- evidence: .practice/capstone-commit.txt
- say: Save the commit for the check.
- hint: "The check reads only that commit, so if you change it later, save it again."
- bottom: "git rev-parse HEAD > .practice/capstone-commit.txt"
- why: "the fix commit may change only the files the plan names."
- beat: do
- where: shell
- verify: git-clean
- watching: git status
- say: Leave nothing uncommitted.
- hint: "The check reads only that commit, so if you change it later, save it again."
- hint: "If `git status --porcelain` lists files, commit them or set them aside with `git stash push --include-untracked`."

### C | Check | Check
- tier: challenge
- skill: check
- where: shell
- beat: do
- verify: check all
- goal: "Run `npm run check -- b-capstone` in your practice copy."
- hint: "Each item that fails prints what to fix."
- beat: type
- skill: plan-mode
- ask: Which key switches permission modes?
- accept: Shift+Tab
- accept: Alt+M
- hint: "Start a session and switch to plan mode before your first prompt."
- hint: "If `Shift+Tab` does nothing, press `Alt+M` instead"
- reveal: "I can switch permission modes with `Shift+Tab` and say which one a task needs."
- beat: self
- done-label: yes, I can
- note: "The check doesn't look at these parts of the Beginner Exit. Tick them yourself, honestly"
- self: "I can tell which model and account a session uses, with `/status`."
- beat: self
- done-label: yes, I can
- self: "I can switch permission modes with `Shift+Tab` and say which one a task needs."
- beat: self
- done-label: yes, I did
- self: "I read the whole diff before committing and asked Claude for at least one correction."
- beat: self
- done-label: yes, I can
- self: "I can keep a session on track with `/context`, `/clear`, `/compact`, `/rewind` and `/resume`."
- beat: self
- done-label: yes, I have
- self: "I've seen a new session follow a rule from CLAUDE.md that I didn't repeat in the prompt."
- note: "If you skipped lesson 5, its [Worked example](05-project-memory.md#worked-example) shows you how."
- after: "When every box on this page is ticked, you're ready for the [Intermediate level](../intermediate/README.md)."

## ladder

### `.practice/version.txt` holds the output of `claude --version`
- narrow "No `.practice/version.txt` yet": Which folder does the check name, and is it the folder where you saved the file?
- narrow "is empty. Run `claude --version` on its own": What does `claude --version` print when you run it on its own?
- narrow "should hold a line such as": What does `.practice/version.txt` hold now?

### `.practice/capstone-before.txt`, saved while the plan was on screen, lists no changed files
- narrow "While the plan is on screen, run": Did you save it from a terminal open in your practice copy, while the plan was still on screen?
- narrow "Files had changed before you approved the plan": Did you save it while the plan was still waiting for your approval, before Claude changed any file?
- hint: "If `git status --porcelain` lists files, commit them or set them aside with `git stash push --include-untracked`."
- hint: "Start a session and switch to plan mode before your first prompt."

### the commit in `.practice/capstone-commit.txt` changes only files listed in `.practice/capstone-plan.txt`, including a test
- narrow "Save the files the plan will change": Is there a `.practice/capstone-plan.txt` in your practice copy, with one path on each line?
- narrow "After you commit the fix, run": Is the fix committed, and did you save that commit to the file the check reads?
- narrow "which is not a commit in this repository": Does the file hold what `git rev-parse HEAD` prints in your practice copy?
- narrow "The commit changes files the plan didn't name": Is the saved commit your fix commit, not an earlier one such as the CLAUDE.md commit? If the plan you approved named the files it lists, did you save every one of them, each test file too?
- narrow "The commit changes no test file": Is the new test in the same commit as the fix?
- hint: "Commit the fix and its test together"
- hint: "Save the files the plan will change, every test file included, to `.practice/capstone-plan.txt`: one path per line, relative to the repository root, with forward slashes, such as `src/cli.js`."

### the reported bug is fixed: a missing folder in `linkcheck.json` makes the tool exit with code 2
- narrow "not 2. Read capstone/beginner-bug.md again": Which exit code does the bug report ask for when a folder in `linkcheck.json` doesn't exist?
- hint: "A teammate filed the bug report in `capstone/beginner-bug.md` in your practice copy: when `linkcheck.json` lists a folder that doesn't exist, the tool says every link resolves and exits with code 0."
- hint: "To try the bug by hand, make a new folder outside your practice copy and save `{ "files": ["docs"] }` in it as `linkcheck.json`."

### the tests pass
- narrow "`npm test` fails": What is the first failure `npm test` prints?
- narrow "has no `npm test` script": Is the check reading your practice copy, the one with the capstone's bug report?
- narrow "not an exit code": What does `.practice/b-3-tests.txt` hold now?
- narrow "says the tests exited with": Do the tests pass when you run them now?
- bottom: "npm test"

### a committed CLAUDE.md names the test command, `npm test`
- narrow "doesn't mention `npm test`": What does `git show HEAD:CLAUDE.md` print, and does it name the test command?
- narrow "There is no committed CLAUDE.md": Does `git show HEAD:CLAUDE.md` print the file, or an error?

### nothing is left uncommitted
- narrow "These changes are uncommitted": Which files does the check list, and do they belong in the fix commit?
- hint: "The check reads only that commit, so if you change it later, save it again."
- hint: "Don't put a `linkcheck.json` in your copy, because the check counts it as a change."

## card
- skill: review-diff
- show: "git add -N <file>"
- does: "`git diff` leaves out a new file until you run `git add -N <file>`"
