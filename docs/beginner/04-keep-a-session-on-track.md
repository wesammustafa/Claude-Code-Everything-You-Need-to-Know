# Keep a session on track

<sub>**Beginner** · Lesson 4 of 5 · about 20 minutes · Needs: [Your first change, from request to commit](03-first-change.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

## Goal

By the end of this lesson you can keep a session on track: see how full its context is, clear or compact it, rewind a change, and resume an earlier conversation.

## You need

- Your copy of the practice template with no uncommitted changes, and Node.js LTS (a Codespace on your copy has it). To practice in one of your own repositories instead, keep the template copy as well: the check runs from it. Set up the repository's `.practice/` folder as [lesson 1](01-install-and-look-around.md#you-need) describes, if you haven't yet.
- Usage: light.

## The idea

Everything in a conversation, your prompts, Claude's replies and every file it read, sits in the session's context window. The window is large but not endless, and a long, wandering conversation leaves Claude less room for the work that matters now ([Explore the context window](https://code.claude.com/docs/en/context-window)). Five commands keep it in hand ([Commands](https://code.claude.com/docs/en/commands)):

| Command | What it does |
|---|---|
| `/context` | Shows how full the context window is, as a colored grid |
| `/compact` | Summarizes the conversation so far, to free space |
| `/clear` | Starts a new conversation with empty context |
| `/rewind` | Goes back to an earlier prompt, restoring the code, the conversation or both |
| `/resume` | Picks up an earlier conversation |

Compact when you want to keep going on the same task; clear when you start a different one. Rewind when a change went the wrong way ([Checkpointing](https://code.claude.com/docs/en/checkpointing)).

## Worked example

1. Start `claude` in your practice copy and type `/context`. The grid shows how much of the window is used, broken down by category, including your messages and the memory files that loaded ([Explore the context window](https://code.claude.com/docs/en/context-window)).
2. Fill it a little:

   ```text
   Explain how src/check-links.js decides that a link is broken.
   ```

   Run `/context` again: the messages part has grown.
3. Compact, telling Claude what to keep:

   ```text
   /compact keep what we learned about check-links.js
   ```

   The conversation is replaced by a summary, and `/context` shows more free space.
4. Make a change to undo. Ask for it, and approve the edit if Claude asks:

   ```text
   In src/cli.js, change the success message to "All relative links are fine."
   ```

   In a second terminal, save what git sees:

   ```bash
   git status --porcelain > .practice/b-4-before-rewind.txt
   ```

   The file lists `src/cli.js`.
5. Rewind. Type `/rewind`, or press `Esc` twice with an empty prompt. Pick the prompt from step 4 and choose **Restore code and conversation**. Then, in the second terminal:

   ```bash
   git status --porcelain > .practice/b-4-after-rewind.txt
   ```

   This file is empty: the edit is gone.
6. Type `/clear`. The conversation starts over with empty context, and the old one stays available.
7. Type `/exit`, then reopen the most recent conversation in this folder ([Manage sessions](https://code.claude.com/docs/en/sessions)):

   ```bash
   claude --continue
   ```

   If it opens the empty conversation from step 6, run `/resume` and pick the earlier one. Inside a session, `/resume` with no argument opens a picker of earlier conversations.

## Your turn

Repeat the example in your practice copy, or your own repository:

1. Run `/context`, ask one question about the code, and run `/context` again.
2. Run `/compact` with a sentence about what to keep.
3. Ask for a small edit to one file, approving it if Claude asks. Save `git status --porcelain > .practice/b-4-before-rewind.txt`.
4. Rewind that prompt with **Restore code and conversation**, and save `git status --porcelain > .practice/b-4-after-rewind.txt`.
5. Run `/clear`, then `/exit`, then `claude --continue`.

## Check

You are done when all of these are true:

- [ ] `.practice/b-4-before-rewind.txt` lists the file Claude changed: `cat .practice/b-4-before-rewind.txt`.
- [ ] `.practice/b-4-after-rewind.txt` lists no files: `cat .practice/b-4-after-rewind.txt` prints nothing.
- [ ] Self-check (not tested): you can say when you'd use `/compact` and when `/clear`.

Run `npm run check -- b-4` in your practice copy. In your own repository, run `npm run check -- b-4 --dir <your repo>` from your practice copy instead.

If the first file lists nothing, you saved it before the edit was made; make the edit again, save the file after it, then rewind again. If the second file still lists the file, open `/rewind` again and choose an option that restores code.

## Watch out

- Rewind undoes only the edits Claude made with its file editing tools. Changes made by commands it ran, such as deleting a file with `rm`, stay ([Checkpointing](https://code.claude.com/docs/en/checkpointing#bash-command-changes-not-tracked)); commit your work so git can bring it back.

## Go further

- [Explore the context window](https://code.claude.com/docs/en/context-window): an interactive view of what fills a session.
- [Session management and 1M context](https://claude.com/blog/using-claude-code-session-management-and-1m-context): when to compact, clear or start fresh.

---

<sub>Sources: [Commands](https://code.claude.com/docs/en/commands) · [Explore the context window](https://code.claude.com/docs/en/context-window) · [Checkpointing](https://code.claude.com/docs/en/checkpointing) · [Manage sessions](https://code.claude.com/docs/en/sessions)</sub>

<sub>← [Your first change, from request to commit](03-first-change.md) · [Beginner index](README.md) · [Project memory with CLAUDE.md](05-project-memory.md) → · Topic: [Memory and context](../topics/memory-and-context.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-4)</sub>
