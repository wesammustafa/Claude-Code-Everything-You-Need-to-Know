This outlines the development practices and principles we require you to follow. Don't start
working on features until asked, this document is intended to get you into the right state
of mind.

1. Make sure you are on the main branch before you start (unless instructed to start on a specific branch)
2. Understand the code that is there before you begin to change it.
3. Create a branch for the feature, bugfix, or requested refactor you've been asked to work on.
4. Employ test-driven development. Red-Green-Refactor process (outlined below)
5. When committing to git, omit the Claude footer from comments.
6. Wrap up each feature, bug, or requested refactor by pushing the branch to github and submitting a pull request.
7. If you've been asked to work on multiple features, bugs, and/or refactors you can then move on to the next one.

# High-level flow

## One vs many
Sometimes you will be given one task. Sometimes you will be given a task list.
The list might be provided as a git repo issue list, for example.

If you are given many at once, start with the first, and complete them one by one, creating a branch for each and a pull-request when finished.

## Keep notes
Create a markdown file under the notes/features/ folder for the feature. If you are creating a feature branch, use the same name.

Use this notes file to record answers to clarifying questions, and other important things as you work on the feature. This can be your long-term memory in case the session is interrupted and you need to come back to it later.

These are your notes, so feel free to add, modify, re-arrange, and delete content in the notes file.

You may, if you wish, add other notes that might be helpful to you or future developers, but more isn't always better. Be breif and helpful.

## Understand the feature
1. First read the README.md and any relevant docs it points to.
1. Ask additional clarifying questions (if there are any important ambiguities) to test your understanding first. For example,
if you were asked to write a tic-tac-toe app, you might ask: "Should this be a TUI, or web-based, or something else?"
2. Update the README.md as needed to reflect insights gained or new information that would be relevent to you in the future or
to other developers on the team.

## Develop the feature
With an understanding of the code that's there and the feature you are implemented you may proceed with the
development flow.

# Development flow
With a solid understanding of the feature you are currently working on, follow this iterative process:
1. Red - Write a failing test that enforces new desired behavior. Run it, it should fail. Do not modify non-test code in the Red phase!
2. Green - Write the code in the simplest way that works to get all of the test to pass. Do not modify tests in the Green phase!
test & commit to git (only when all tests are passing) but don't push
3. Refactor - Refactor the code you wrote, and possibly the larger code-base, to enhance organization, readability, and maintainability.
This is an opportunity to improve the quality of the code. The idea is to leave the code in a slightly better state than you found it
when you started the feature. Also, you might be stretching the code in ways it wasn't ready for by implementing this feature. In the green
step you implement the simplest thing that would work, but in the refactor step, you consider how to improve the code affected by your change
to improve the overall quality of the codebase. Follow Martin Fowler's guidance on this.
a minor refactor can be committed in a single commit
major refactorings should be commited in stages
test & commit to git (only when all tests are passing)

Repeat this flow, one new test at a time, until you have completed the desired functionality.

# Commit message format
First line: a summary, no longer than 50 characters.
Second line: blank
Body: lines should be no longer than 72 characters.
Omit the "Claude" commit footer.
Include a link to the issue (if taken from git repo issues) on the last line.

## Refactor
When asked to refactor the code directly, in contrast to the Development flow Refactor phase, you should not start by writing a new test. The reason is that refactoring is the act of restructuring without changing behavior it should therefore not need a new test.

## Capturing additional guidance
Whenever I interrupt you to correct what you are doing. Please update this document and feel free to add additional prompt documents that will help me help you to remember the guidance given. This will need to be captured in a very generic way that is not specific to the current feature or project, it's a way to capture expert knowledge that can be applied to any problem.

## File location
This file is always located at $PROJECT_ROOT/.claude/commands/tdd.md
Other files that you may wish to create that are similar system-prompt-like markdown files that can be used in the future by me to guide you can be added to .claude/commands - just name them appropriately.

