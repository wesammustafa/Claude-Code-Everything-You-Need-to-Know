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
- Claude treats CLAUDE.md as context, not as configuration it must obey. A rule that must never be broken needs a hook, which an Intermediate lesson teaches.

A session reads CLAUDE.md when it starts, so after you change the file, start a new session to be sure it uses the change.

## Worked example

1. Start `claude` in your practice copy and run:

   ```text
   /init
   ```

   Claude reads the code and writes a `CLAUDE.md` with the commands and conventions it found. Approve the file if it asks. In a second terminal, read it with `cat CLAUDE.md`.
2. Add a rule that shows up in files, so you can see whether a session follows it. Open the file with `/memory` or your editor, and add under a **Conventions** heading:

   ```markdown
   - Every new source file starts with the line `// Part of linkcheck.`
   ```

   Save the rule's exact line for the check:

   ```bash
   echo '// Part of linkcheck.' > .practice/b-5-rule.txt
   ```

   **Windows:** `'// Part of linkcheck.' | Set-Content .practice/b-5-rule.txt`
3. Commit the file:

   ```bash
   git add CLAUDE.md
   git commit -m "Add project instructions for Claude Code"
   ```

4. Type `/exit`, then start a new session with `claude`, so it reads the committed file.
5. Ask for a change that creates a new file:

   ```text
   Add src/stats.js with a function countLinks(markdown) that returns how many links findLinks finds. Add a test in test/stats.test.js, run the tests and commit.
   ```

   Approve any permission prompts Claude shows.
6. Look at the first line of the new file, then save the commit for the check:

   ```bash
   head -1 src/stats.js
   git rev-parse HEAD > .practice/b-5-commit.txt
   ```

   **Windows:** `Get-Content src/stats.js -TotalCount 1` replaces `head -1`.

   The first line should read `// Part of linkcheck.`, though you never asked for it in this session.

## Your turn

Do the example's six steps yourself, in your practice copy:

1. Run `/init` and read the `CLAUDE.md` it writes.
2. Add the `// Part of linkcheck.` rule and save it to `.practice/b-5-rule.txt`.
3. Commit `CLAUDE.md`.
4. Exit and start a new session.
5. Ask for `src/stats.js` and its test, and let Claude commit.
6. Check the first line of `src/stats.js` and save the commit to `.practice/b-5-commit.txt`.

In your own repository, write the rule with your language's comment style, such as `# Part of my-project.`, and ask for a small new file.

## Check

You are done when all of these are true:

- [ ] A committed CLAUDE.md holds the rule saved in `.practice/b-5-rule.txt`: `git show HEAD:CLAUDE.md` shows it.
- [ ] The commit named in `.practice/b-5-commit.txt` adds at least one file other than tests and Markdown, and each such file starts with that rule: `git show --stat $(cat .practice/b-5-commit.txt)` lists them. **Windows:** `git show --stat (Get-Content .practice/b-5-commit.txt)`.
- [ ] Self-check (not tested): you started a new session after committing CLAUDE.md, and you can say why that matters.

Run `npm run check -- b-5` in your practice copy. In your own repository, run `npm run check -- b-5 --dir <your repo>` from your practice copy instead.

If CLAUDE.md isn't committed, run `git add CLAUDE.md` and commit it. If a new file doesn't start with the rule, check that the rule is in the committed CLAUDE.md, start a new session, ask for a different new file, such as `src/summary.js`, and save that commit with `git rev-parse HEAD > .practice/b-5-commit.txt`.

## Go further

- [Write an effective CLAUDE.md](https://code.claude.com/docs/en/best-practices#write-an-effective-claude-md): what to put in it and what to leave out.
- [Using CLAUDE.md files](https://claude.com/blog/using-claude-md-files): Anthropic's guide, with examples.

---

<sub>Sources: [How Claude remembers your project](https://code.claude.com/docs/en/memory) · [Commands](https://code.claude.com/docs/en/commands) · [Best practices](https://code.claude.com/docs/en/best-practices)</sub>

<sub>← [Keep a session on track](04-keep-a-session-on-track.md) · [Beginner index](README.md) · [Beginner capstone](capstone.md) → · Topic: [Memory and context](../topics/memory-and-context.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-5)</sub>
