# Organize project memory and see what loaded

<sub>**Intermediate** · Lesson 2 of 8 · about 20 minutes · Needs: [Turn a repeated workflow into a skill](01-first-skill.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-06</sub>

## Goal

By the end of this lesson you can split a project's instructions into imports and scoped rules, and find out which instruction files loaded when Claude doesn't follow one.

## You need

- One of your own repositories with a committed `CLAUDE.md`, as [Beginner lesson 5](../beginner/05-project-memory.md) leaves it, and your copy of the practice template with Node.js LTS: the check runs from the copy. To practice in the template copy instead, use it for both. Set up the repository's `.practice/` folder as [Beginner lesson 1](../beginner/01-install-and-look-around.md#you-need) describes, if you haven't yet.
- `jq`, for the load log in the Worked example.
- Usage: light.

## The idea

A long `CLAUDE.md` is hard to maintain, and every line of it loads into every session. Two tools split it up ([How Claude remembers your project](https://code.claude.com/docs/en/memory)):

- An **import**, a line such as `@docs/conventions.md` in `CLAUDE.md`, loads another file along with it. It organizes the file but saves no context.
- A **rule** is a Markdown file in `.claude/rules/`. With `paths:` frontmatter it loads only when Claude works on a matching file.

| Instruction file | Loads |
|---|---|
| `CLAUDE.md` at the project root, and a rule without `paths:` | When the session starts |
| A file named in an `@path` import | With the file that imports it |
| A rule with `paths:` | When Claude reads a matching file with its Read tool |
| Auto memory, the notes Claude keeps for itself | When the session starts: the first 200 lines or 25KB of its `MEMORY.md` index |

When Claude ignores an instruction, first find out whether its file loaded. If it did, the wording is the likely problem: make it concrete, and remove any instruction that contradicts it ([Debug your configuration](https://code.claude.com/docs/en/debug-your-config#see-what-loaded-into-context)).

## Worked example

1. In your repository, add an import to `CLAUDE.md`. In the practice template, import `package.json`; in your own repository, a document your team keeps, such as `@docs/architecture.md`:

   ```markdown
   - npm scripts: @package.json
   ```

   An import's path runs until the first space, so don't put a period right after it.
2. Save a rule for your test files as `.claude/rules/testing.md`. Change the pattern to match where your tests live:

   ```markdown
   ---
   paths:
     - "test/**/*.js"
   ---

   # Testing

   - Use `node:test` and `node:assert/strict`; no other test libraries.
   ```

3. Save this load log to `.practice/i-2-hook.json`. It is an [`InstructionsLoaded` hook](https://code.claude.com/docs/en/hooks#instructionsloaded): each time a `CLAUDE.md`, a rule or an imported file loads, it appends the reason and the file's path to `.practice/i-2-loaded.txt`. It logs nothing else, and runs only in sessions you start with it:

   ```json
   {
     "hooks": {
       "InstructionsLoaded": [
         { "hooks": [ { "type": "command", "command": "jq -r '[.load_reason, .file_path] | @tsv' >> \"$CLAUDE_PROJECT_DIR/.practice/i-2-loaded.txt\"" } ] }
       ]
     }
   }
   ```

4. Start a session with the log, `claude --settings .practice/i-2-hook.json` ([CLI reference](https://code.claude.com/docs/en/cli-reference#cli-flags)), and run `/context all`: plain `/context` can collapse its list, and `all` expands it ([Commands](https://code.claude.com/docs/en/commands)). Under **Memory files** it lists the instruction files that loaded at the start, such as `CLAUDE.md` ([Set up a project CLAUDE.md](https://code.claude.com/docs/en/memory#set-up-a-project-claude-md)). The scoped rule isn't among them: nothing has read a test file yet.
5. Ask Claude to read a test file with its Read tool. Name the tool: Claude sometimes reads a file through a shell command, which doesn't load scoped rules.

   ```text
   Use your Read tool to read test/config.test.js, then tell me in one sentence what it checks.
   ```

   In a second terminal, `cat .practice/i-2-loaded.txt` shows every load with its reason: `session_start` for `CLAUDE.md`, `include` for `package.json`, and now `path_glob_match` for the rule.

## Your turn

A teammate's rule never takes effect. Find out why, and fix it.

1. Save this rule as `.claude/rules/cli.md`. In your own repository, write a rule for one of your source folders and misspell the folder's name in its pattern:

   ```markdown
   ---
   paths:
     - "source/**/*.js"
   ---

   # CLI output

   - Print errors to stderr, starting with `linkcheck:`.
   ```

2. Start a logged session, `claude --settings .practice/i-2-hook.json`, and ask Claude to use its Read tool on `src/cli.js`, or on a file in your folder.
3. Read the log: the rule never loaded. Compare its pattern with the files that exist, `git ls-files src`.
4. Fix the pattern, start a new logged session and repeat step 2. The log now has a `path_glob_match` line for `cli.md`.
5. Commit `CLAUDE.md` and `.claude/rules/`. Delete `.practice/i-2-hook.json` when you no longer need the log.

## Check

You are done when all of these are true:

- [ ] The committed `CLAUDE.md` imports a file that exists: `git show HEAD:CLAUDE.md | grep '@'` shows the import.
- [ ] Every committed rule with `paths:` matches a file: for each pattern, `git ls-files ':(glob)<pattern>'` lists at least one file. With the `:(glob)` prefix, git's `*` stays inside one folder and `**/` matches any number of folders, as in rules ([gitglossary: pathspec](https://git-scm.com/docs/gitglossary#Documentation/gitglossary.txt-aiddefpathspecapathspec)). Git doesn't expand braces, which rules do ([Path-specific rules](https://code.claude.com/docs/en/memory#path-specific-rules)), so check a pattern such as `src/**/*.{ts,tsx}` one extension at a time.
- [ ] The log shows the import and a scoped rule loading: `grep -E '^(include|path_glob_match)' .practice/i-2-loaded.txt` prints at least one line of each kind.
- [ ] Self-check (not tested): you can say which of your instruction files load at the start and which load later, and how you saw each one load.

Run `npm run check -- i-2 --dir <your repo>` from your practice copy, or `npm run check -- i-2` in the copy itself.

If the import check fails, look for punctuation right after the path, or a path written relative to the wrong folder: an import resolves from the file that holds it. If a rule matches no file, its pattern is relative to the project root, so `source/**` matches nothing in a project whose code is in `src/`. If the log has no `path_glob_match` line, start the session with `--settings .practice/i-2-hook.json` and ask for the Read tool by name.

## Watch out

- An import that points outside your working directory, such as `@~/notes.md`, asks for your approval the first time a project uses it; if you decline, it stays off ([Import additional files](https://code.claude.com/docs/en/memory#import-additional-files)).
- Claude Code reads the project's `CLAUDE.md` once, at the start. An edit to it reaches the session after `/clear`, `/compact` or a restart ([Editing CLAUDE.md mid-session](https://code.claude.com/docs/en/prompt-caching#editing-claude-md-mid-session)).
- To find instructions that contradict each other or name files that no longer exist, run `/doctor prompt-audit` ([Audit your instruction files](https://code.claude.com/docs/en/memory#audit-your-instruction-files)). It proposes edits and changes nothing until you ask.

## Go further

- [Explore the .claude directory](https://code.claude.com/docs/en/claude-directory): the files you write in `.claude/` and `~/.claude`, and when Claude Code loads each one.
- [Debug your configuration](https://code.claude.com/docs/en/debug-your-config): what to check when a setting, hook or server doesn't take effect.
- [Auto memory](https://code.claude.com/docs/en/memory#auto-memory): what Claude saves for itself, where, and how to turn it off.

---

<sub>Sources: [How Claude remembers your project](https://code.claude.com/docs/en/memory) · [Hooks reference](https://code.claude.com/docs/en/hooks) · [Debug your configuration](https://code.claude.com/docs/en/debug-your-config) · [How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching) · [CLI reference](https://code.claude.com/docs/en/cli-reference) · [Commands](https://code.claude.com/docs/en/commands) · [gitglossary](https://git-scm.com/docs/gitglossary)</sub>

<sub>← [Turn a repeated workflow into a skill](01-first-skill.md) · [Intermediate index](README.md) · [Pick the model and effort](03-model-and-effort.md) → · Topic: [Memory and context](../topics/memory-and-context.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=i-2)</sub>
