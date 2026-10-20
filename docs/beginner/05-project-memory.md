# Project memory with CLAUDE.md

<sub>**Beginner** · Lesson 5 of 5 · about 20 minutes · Needs: [Your first change, from request to commit](03-first-change.md) · Verified against Claude Code v2.1.292 (stable) on 2026-10-19</sub>

## Goal

By the end of this lesson you can create a project CLAUDE.md, show that a new session follows it, and decide which memory file each instruction belongs in.

## You need

- Your copy of the practice template with no uncommitted changes, and Node.js LTS (a Codespace on your copy has it). Do this lesson in the practice copy: Your turn's notes are about its code. The lesson ends by giving one of your own repositories the same start.
- Usage: light.

## The idea

Each session starts with a fresh context window. Your instruction files load at the start of each one, and where you write an instruction decides who gets it ([How Claude remembers your project](https://code.claude.com/docs/en/memory#choose-where-to-put-claude-md-files)):

| Where | What goes in it | Who gets it |
|---|---|---|
| `./CLAUDE.md` | Commands, conventions, layout | The team: commit it |
| `~/.claude/CLAUDE.md` | Your habits for every project | Only you |
| `./CLAUDE.local.md` | Your notes for this project | Only you: add it to `.gitignore` |
| Auto memory | Notes Claude saves, such as what you ask it to remember | Only you, on this machine |

- `/init` writes a first `CLAUDE.md` from the code. Keep it brief and specific ([Write effective instructions](https://code.claude.com/docs/en/memory#write-effective-instructions)).
- Say "add this to CLAUDE.md" to put an instruction in the file; "remember" puts it in auto memory ([View and edit with `/memory`](https://code.claude.com/docs/en/memory#view-and-edit-with-%2Fmemory)).
- An edit to CLAUDE.md mid-session waits for the next `/clear`, `/compact` or new session ([Editing CLAUDE.md mid-session](https://code.claude.com/docs/en/prompt-caching#editing-claude-md-mid-session)).
- These files are context, not configuration Claude must obey: a rule that must never be broken needs a [hook](https://code.claude.com/docs/en/hooks-guide), which the [Intermediate level](../intermediate/README.md) teaches.

## Worked example

1. Start `claude` in your practice copy and run:

   ```text
   /init
   ```

   Claude reads the code and writes a `CLAUDE.md` with the commands and conventions it found. If Claude Code asks before it writes the file, allow it. In a second terminal, read the file with `cat CLAUDE.md`.
2. Edit it as you would before your team sees it. Open `CLAUDE.md` in your editor, or type `/memory` and choose **Project instructions**, the `./CLAUDE.md` in this folder. `/memory` also lists your user file in `~/.claude/`, which applies to all your projects, and has a toggle and a folder for auto memory ([View and edit with `/memory`](https://code.claude.com/docs/en/memory#view-and-edit-with-%2Fmemory)). A terminal editor such as Vim takes over the terminal until you save and quit.
   - In the practice copy, `/init` may also describe the course, and even this lesson: `checks/`, `learn/`, `capstone/` and `.github/`. Delete those parts, the `npm run check`, `npm run learn` and `npm run test:checks` lines, and any rule that says to keep your work off `main`: that rule is for the template repository, not your copy.
   - Compare each command that's left with the `scripts` in `package.json`. Keep `npm test`, which the [capstone](capstone.md) checks for.
   - Add a convention that shows up in files. Put it under a `## Conventions` heading, and add that heading at the end of the file if `/init` didn't write one:

     ```markdown
     - Every new JavaScript file in `src/` starts with the line `// SPDX-License-Identifier: MIT`.
     ```

     A license header is a common project rule, and no linkcheck file has one yet, so you'll see whether a session follows it. The rule names the files it covers: a `//` line at the top of a shell script or a JSON file would break either one, and every session reads this file.
3. Save `CLAUDE.md`, then commit it in the second terminal:

   ```bash
   git add CLAUDE.md
   git commit -m "Add project instructions for Claude Code"
   ```

4. Type `/exit`, then start a new session with `claude`, so it loads CLAUDE.md with your rule. Type `/context all` and find `CLAUDE.md` under **Memory files**: the session has loaded it. Plain `/context` can collapse that list, and `all` expands it ([Commands](https://code.claude.com/docs/en/commands)).
5. Ask for a change that creates a new file. The request doesn't mention the header:

   ```text
   Add src/stats.js with a function countLinks(markdown) that returns how many links findLinks finds. Add a test in test/stats.test.js, run the tests and commit.
   ```

   A new session normally starts in auto mode, so Claude may finish without asking you anything; if Claude Code asks, read what it wants to do before you answer ([Which mode a session starts in](https://code.claude.com/docs/en/permission-modes#which-mode-a-session-starts-in)).
6. In the second terminal, look at the first line of the new file and confirm nothing is left over:

   ```bash
   head -1 src/stats.js
   git status
   ```

   **Windows:** `Get-Content src/stats.js -TotalCount 1` replaces `head -1`.

   The first line should read `// SPDX-License-Identifier: MIT`, though you never asked for it in this session. `git status` ([git status](https://git-scm.com/docs/git-status)) should read `nothing to commit, working tree clean`. If it lists `src/stats.js`, Claude hasn't committed yet: ask it to.

## Your turn

These are four things you kept telling Claude during a week on linkcheck. Three of them belong in three different places, and one is wrong: fix it or leave it out.

```markdown
1. CLI errors go to stderr and start with `linkcheck:`.
2. Run the tests with `npm run tests` before you commit.
3. My sample docs are in `~/scratch/linkcheck-docs`: run the CLI on them when I ask for a smoke test.
4. Keep your replies short, with no summary at the end. I want that in every project.
```

Decide where each line goes before you write anything:

1. For each line, choose the project's `CLAUDE.md`, a `CLAUDE.local.md`, your user file, or nowhere. A line that goes in a committed file must be true: compare it with `package.json` and `src/cli.js`, because every session, and every teammate's, will read it.
2. Tell Claude in a session what goes in the project's file: `Add this to CLAUDE.md:` and the line. Edit the file yourself if you prefer.
3. Put what is yours alone for this project in a `CLAUDE.local.md` at the project root, and add the line `CLAUDE.local.md` to `.gitignore`.
4. A habit you want in every project goes in your user file: `/memory`, then **User instructions**. That file reaches every session you start, in every project, so this step is up to you.
5. Commit `CLAUDE.md` and `.gitignore`. `git status` should be clean, since git now ignores `CLAUDE.local.md`.

Afterwards, give one of your own repositories the same start: `/init`, compare each command it wrote with the code, then commit `CLAUDE.md` there. [Intermediate lesson 2](../intermediate/02-organize-memory.md) starts from that file. If the repository has an `AGENTS.md`, put `@AGENTS.md` on the first line of `CLAUDE.md`: by default, once a `CLAUDE.md` exists, Claude reads it instead of `AGENTS.md` ([AGENTS.md](https://code.claude.com/docs/en/memory#agents-md)).

## Check

You are done when all of these are true:

- [ ] A committed CLAUDE.md has a rule that every new JavaScript file in `src/` starts with a given line: `git show HEAD:CLAUDE.md` ([git show](https://git-scm.com/docs/git-show)) shows it.
- [ ] A commit made after that rule adds JavaScript files to `src/`, and each of them starts with the rule's line: `git log --stat -3` ([git log](https://git-scm.com/docs/git-log)) lists them.
- [ ] The committed CLAUDE.md holds the notes' rule for CLI errors, and every `npm run` script it names is in `package.json`.
- [ ] A committed `.gitignore` keeps `CLAUDE.local.md` out, git tracks no `CLAUDE.local.md`, and the committed CLAUDE.md holds neither personal note: `git check-ignore CLAUDE.local.md` ([git check-ignore](https://git-scm.com/docs/git-check-ignore)) prints its name.
- [ ] Self-check (not tested): the session that wrote `src/stats.js` started after you committed the rule, and its `/context all` listed `CLAUDE.md` under **Memory files**. Your `CLAUDE.local.md` holds the sample-docs note: git ignores that file, so the check can't see it.

Run `npm run check -- b-5` in your practice copy.

If CLAUDE.md isn't committed, run `git add CLAUDE.md` and commit it. If a new file doesn't start with the rule, start a new session and run `/context all`. When `CLAUDE.md` is missing under **Memory files**, the session can't see it: start `claude` in the folder that holds `CLAUDE.md`. When it is listed, Claude read the rule but didn't follow it. Either way, ask the session for a different new file, such as `src/summary.js` with a test, and to commit it: the check looks for a commit that adds new files to `src/`, so fixing the old file in place won't pass. If the check names an `npm run` script, it quotes the line: that script isn't in `package.json`, so fix or delete the line, even one that warns against the command, and commit CLAUDE.md. If the `.gitignore` item fails, add the line `CLAUDE.local.md` to `.gitignore` and commit it; a rule only in your global git excludes file doesn't count. If `CLAUDE.local.md` was committed, run `git rm --cached CLAUDE.local.md` ([git rm](https://git-scm.com/docs/git-rm)) and commit.

## Go further

- [Write an effective CLAUDE.md](https://code.claude.com/docs/en/best-practices#write-an-effective-claude-md): what to put in it and what to leave out.
- [Using CLAUDE.md files](https://claude.com/blog/using-claude-md-files): Anthropic's guide, with examples.
- [Auto memory](https://code.claude.com/docs/en/memory#auto-memory): what Claude saves for itself, where, and how to turn it off.

---

<sub>Sources: [How Claude remembers your project](https://code.claude.com/docs/en/memory) · [How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching) · [Commands](https://code.claude.com/docs/en/commands) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [Best practices](https://code.claude.com/docs/en/best-practices) · [Automate actions with hooks](https://code.claude.com/docs/en/hooks-guide) · [git status](https://git-scm.com/docs/git-status) · [git show](https://git-scm.com/docs/git-show) · [git log](https://git-scm.com/docs/git-log) · [git check-ignore](https://git-scm.com/docs/git-check-ignore) · [git rm](https://git-scm.com/docs/git-rm)</sub>

<sub>← [Keep a session on track](04-keep-a-session-on-track.md) · [Beginner index](README.md) · [Beginner capstone](capstone.md) → · Topic: [Memory and context](../topics/memory-and-context.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-5)</sub>
