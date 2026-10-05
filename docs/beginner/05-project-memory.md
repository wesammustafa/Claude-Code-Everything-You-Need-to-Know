# Project memory with CLAUDE.md

<sub>**Beginner** · Lesson 5 of 5 · about 20 minutes · Needs: [Your first change, from request to commit](03-first-change.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

## Goal

By the end of this lesson you can create a project CLAUDE.md and show that a new session follows it.

## You need

- Your copy of the practice template with no uncommitted changes, and Node.js LTS (a Codespace on your copy has it). To practice in one of your own repositories instead, keep the template copy as well: the check runs from it. Set up the repository's `.practice/` folder as [lesson 1](01-install-and-look-around.md#you-need) describes, if you haven't yet.
- Usage: light.

## The idea

Each session starts with a fresh context window, so you can end up repeating your project's habits. A `CLAUDE.md` file at the project root fixes that: Claude Code reads it at the start of every session ([How Claude remembers your project](https://code.claude.com/docs/en/memory)).

- Put in it what every session should know: the build and test commands, conventions, the project's layout, "always do X" rules. Keep it short; the docs suggest under 200 lines.
- Commit it, so everyone who works on the project gets the same instructions.
- `/init` writes a first version for you from what it finds in the code.
- Claude treats CLAUDE.md as context, not as configuration it must obey. A rule that must never be broken needs a [hook](https://code.claude.com/docs/en/hooks-guide), which the [Intermediate level](../intermediate/README.md) teaches.

A session reads CLAUDE.md when it starts, so after you change the file, start a new session to be sure it uses the change.

## Worked example

1. Start `claude` in your practice copy and run:

   ```text
   /init
   ```

   Claude reads the code and writes a `CLAUDE.md` with the commands and conventions it found. Approve the file if it asks. In a second terminal, read it with `cat CLAUDE.md`.
2. Open `CLAUDE.md` in your editor, or type `/memory` and choose **Project instructions**, the `./CLAUDE.md` in this folder. Don't pick the user file in `~/.claude/`: it applies to all your projects ([View and edit with `/memory`](https://code.claude.com/docs/en/memory#view-and-edit-with-%2Fmemory)). A terminal editor such as Vim takes over the terminal until you save and quit.

   In the practice copy, `/init` may also describe the course's own files: `checks/`, `capstone/` and `.github/`. Delete what it says about them and about `npm run check`, including any rule that says to keep your work off `main`: that rule is for the template repository, not your copy. Keep the other commands, including `npm test`, which the [capstone](capstone.md) checks for.

   Then add a rule that shows up in files, so you can see whether a session follows it. Put it under a `## Conventions` heading, and add that heading at the end of the file if `/init` didn't write one:

   ```markdown
   - Every new source file starts with the line `// Part of linkcheck.`
   ```

   In the second terminal, save the rule's exact line for the check:

   ```bash
   echo '// Part of linkcheck.' > .practice/b-5-rule.txt
   ```

   **Windows:** `'// Part of linkcheck.' | Set-Content .practice/b-5-rule.txt`
3. Save `CLAUDE.md`, then commit it in the second terminal:

   ```bash
   git add CLAUDE.md
   git commit -m "Add project instructions for Claude Code"
   ```

4. Type `/exit`, then start a new session with `claude`, so it loads CLAUDE.md with your rule. Type `/context all` and find `CLAUDE.md` under **Memory files**: the session has loaded it. Plain `/context` can collapse that list, and `all` expands it ([Commands](https://code.claude.com/docs/en/commands)).
5. Ask for a change that creates a new file:

   ```text
   Add src/stats.js with a function countLinks(markdown) that returns how many links findLinks finds. Add a test in test/stats.test.js, run the tests and commit.
   ```

   Approve any permission prompts Claude shows.
6. In the second terminal, look at the first line of the new file, save the commit for the check, and confirm nothing is left over:

   ```bash
   head -1 src/stats.js
   git rev-parse HEAD > .practice/b-5-commit.txt
   git status
   ```

   **Windows:** `Get-Content src/stats.js -TotalCount 1` replaces `head -1`.

   The first line should read `// Part of linkcheck.`, though you never asked for it in this session. `git status` should read `nothing to commit, working tree clean`. If it lists `src/stats.js`, Claude hasn't committed yet: ask it to commit, then save the commit again.

## Your turn

Repeat the example in your practice copy, or your own repository, with a new rule and a new file. Your practice copy already has a `CLAUDE.md`, so skip `/init` there:

1. Open `CLAUDE.md` and replace the example's rule with a new one:

   ```markdown
   - Every new source file starts with the line `// linkcheck source.`
   ```

2. In the second terminal, save the new rule's exact line: `echo '// linkcheck source.' > .practice/b-5-rule.txt` (**Windows:** `'// linkcheck source.' | Set-Content .practice/b-5-rule.txt`).
3. Commit `CLAUDE.md` there.
4. Exit, start a new session, and check that `/context all` lists `CLAUDE.md` under **Memory files**.
5. Ask for a new file and its test, and let Claude commit:

   ```text
   Add src/external.js with a function countExternal(markdown) that returns how many of the links findLinks finds are external, according to isExternal. Add a test in test/external.test.js, run the tests and commit.
   ```

6. As in the example's step 6, check the first line of `src/external.js`, save the commit to `.practice/b-5-commit.txt`, and run `git status`.

In your own repository, start with `/init`; if the repository already has a `CLAUDE.md`, `/init` suggests improvements rather than overwriting it. Write the rule in your language's comment style, such as `# Part of my-project.`, save that exact line to `.practice/b-5-rule.txt` in step 2, and ask for a small new file. If the repository has an `AGENTS.md`, put `@AGENTS.md` on the first line of `CLAUDE.md`: by default, once a `CLAUDE.md` exists, Claude reads it instead of `AGENTS.md` ([AGENTS.md](https://code.claude.com/docs/en/memory#agents-md)).

## Check

You are done when all of these are true:

- [ ] A committed CLAUDE.md holds the rule saved in `.practice/b-5-rule.txt`: `git show HEAD:CLAUDE.md` shows it.
- [ ] The commit named in `.practice/b-5-commit.txt` adds at least one file other than tests and Markdown, and each such file starts with that rule: `git show --stat $(cat .practice/b-5-commit.txt)` lists them. **Windows:** `git show --stat (Get-Content .practice/b-5-commit.txt)`.
- [ ] Self-check (not tested): you started a new session after adding the rule to CLAUDE.md, and you can say why that matters.

Run `npm run check -- b-5` in your practice copy. In your own repository, run `npm run check -- b-5 --dir <your repo>` from your practice copy instead.

If CLAUDE.md isn't committed, run `git add CLAUDE.md` and commit it. If a new file doesn't start with the rule, start a new session and run `/context all`. When `CLAUDE.md` is missing under **Memory files**, the session can't see it: start `claude` in the folder that holds `CLAUDE.md`. When it is listed, Claude read the rule but didn't follow it. Either way, ask the session for a different new file, such as `src/summary.js` with a test, and to commit it. Then save that commit with `git rev-parse HEAD > .practice/b-5-commit.txt` and run the check again. Fixing the old file in place won't pass, because the check reads only the files that commit adds.

## Go further

- [Write an effective CLAUDE.md](https://code.claude.com/docs/en/best-practices#write-an-effective-claude-md): what to put in it and what to leave out.
- [Using CLAUDE.md files](https://claude.com/blog/using-claude-md-files): Anthropic's guide, with examples.

---

<sub>Sources: [How Claude remembers your project](https://code.claude.com/docs/en/memory) · [Commands](https://code.claude.com/docs/en/commands) · [Best practices](https://code.claude.com/docs/en/best-practices) · [Automate actions with hooks](https://code.claude.com/docs/en/hooks-guide)</sub>

<sub>← [Keep a session on track](04-keep-a-session-on-track.md) · [Beginner index](README.md) · [Beginner capstone](capstone.md) → · Topic: [Memory and context](../topics/memory-and-context.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-5)</sub>
