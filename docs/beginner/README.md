# Beginner

<sub>**Beginner** · about 2½ hours · Verified against Claude Code v2.1.292 (stable) on 2026-10-19</sub>

One session, one change, done well. You start Claude Code safely and check what it tells you against the code, decide when it asks and when to plan first, take a change from request to commit and catch what it gets wrong, stop or rewind a wrong turn and keep the conversation focused, and give the project a memory that new sessions follow.

## You're ready for this level if you can

- [ ] Work in a terminal: change folders, run commands and read their output.
- [ ] Use git: clone a repository, commit, and read `git status` and `git diff`.
- [ ] Have a Claude subscription (Pro, Max, Team or Enterprise; the free plan doesn't include Claude Code), a Claude Console account, or access through a supported cloud provider ([Quickstart](https://code.claude.com/docs/en/quickstart), [Advanced setup](https://code.claude.com/docs/en/setup)). Lesson 1 shows you how to sign in.

New to the terminal? The official [Terminal guide for new users](https://code.claude.com/docs/en/terminal-guide) walks you through opening one and installing Claude Code.

## Practice

Before lesson 1, make your own copy of the [practice template](https://github.com/wesammustafa/claude-code-practice): select **Use this template**, then **Create a new repository**, and clone your copy. Every Beginner lesson and the capstone run there, and lesson 5 ends in one of your own repositories.

To go step by step, run `npm run learn` in your copy and use Claude Code in a second terminal beside it. The app takes you through every core lesson and the capstone, one step at a time, and checks your work as you go. Each page below teaches the same lesson on its own.

Each core lesson and the capstone end with a check you run in your copy as `npm run check -- <id>`, where the id is `b-1` to `b-5` for the lessons and `b-capstone` for the capstone. The checks need Node.js LTS, which a Codespace on your copy has preinstalled. Every Beginner exercise runs in your template copy, because each one works with files planted there; only lesson 5's last step gives one of your own repositories a `CLAUDE.md`, which [Intermediate lesson 2](../intermediate/02-organize-memory.md) starts from.

On native Windows, if PowerShell refuses to run `npm` with `running scripts is disabled on this system` ([Troubleshoot installation](https://code.claude.com/docs/en/troubleshoot-install#running-scripts-is-disabled-on-this-system)), follow the Windows note in [lesson 1](01-install-and-look-around.md#you-need).

## Lessons

1. [Install, sign in and look around](01-install-and-look-around.md)
2. [Permission modes and plan mode](02-permission-modes-and-plan-mode.md)
3. [Your first change, from request to commit](03-first-change.md)
4. [Keep a session on track](04-keep-a-session-on-track.md)
5. [Project memory with CLAUDE.md](05-project-memory.md)

Each lesson takes 20 to 25 minutes, and the capstone 30 to 60.

## Capstone

[Fix a reported bug, from plan to commit](capstone.md): reproduce a reported bug in the practice template, plan the fix in plan mode with a test that fails before the fix and passes after it, review the diff against the report, and commit. Its check covers what it can see in files and git, and the capstone page lists the rest of the [Beginner Exit](#by-the-end-of-this-level-you-can) for you to tick yourself.

## By the end of this level you can

This list is the Beginner Exit ([Glossary](../reference/glossary.md)), which the capstone puts together in one task.

- [ ] Install Claude Code, start it safely in a repository, tell which model and account a session uses, and check its answers against the code.
- [ ] Choose a permission mode for a task, decide when a change needs a plan, and approve only a plan you would merge.
- [ ] Take one change from request to commit: explore, plan, implement, test, review the diff, correct, commit.
- [ ] Stop or rewind a wrong turn, and choose between clear, compact and resume.
- [ ] Create a short, true project CLAUDE.md and show that a new session follows it.

## Electives

Optional lessons beside the core path, each ending with a checklist you confirm yourself:

- [IDE extensions](electives/ide-extensions.md)
- [Screenshots and images](electives/screenshots-and-images.md)
- [The built-in teachers](electives/built-in-teachers.md): `/powerup`, the Learning and Explanatory output styles, and the `claude-code-guide` subagent

## Official companions

- [Quickstart](https://code.claude.com/docs/en/quickstart): Anthropic's walkthrough from install to a first change.
- [Claude Code 101](https://academy.claude.com/courses/claude-code-101): Claude Academy's beginner course.
- `/powerup`: interactive lessons inside Claude Code ([Commands](https://code.claude.com/docs/en/commands)).

## Next level

[Intermediate](../intermediate/README.md): one developer's setup.

---

<sub>Sources: [Quickstart](https://code.claude.com/docs/en/quickstart) · [Advanced setup](https://code.claude.com/docs/en/setup) · [Terminal guide for new users](https://code.claude.com/docs/en/terminal-guide) · [Troubleshoot installation](https://code.claude.com/docs/en/troubleshoot-install) · [Commands](https://code.claude.com/docs/en/commands) · [Output styles](https://code.claude.com/docs/en/output-styles) · [Create custom subagents](https://code.claude.com/docs/en/sub-agents)</sub>

<sub>Up: [Claude Code: Everything You Need to Know](../../README.md#pick-your-level)</sub>
