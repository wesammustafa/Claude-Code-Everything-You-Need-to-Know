# Subagent for Intermediate lesson 6

`code-reviewer`, a read-only subagent for the Intermediate lesson "Delegate to a custom subagent". It reviews code changes in its own context window and reports findings by severity. Its only tools are Read, Grep and Glob, so it can read and search files but can't edit them or run commands ([Create custom subagents](https://code.claude.com/docs/en/sub-agents#available-tools)). Without a shell it can't run `git diff`, so the main conversation gives it the changed files or the diff.

Copy it into `.claude/agents/` in your project:

```bash
mkdir -p .claude/agents
cp <path-to-this-folder>/dot-claude/agents/code-reviewer.md .claude/agents/
```

If `.claude/agents/` didn't exist when your session started, restart Claude Code so it sees the new folder ([Create custom subagents](https://code.claude.com/docs/en/sub-agents#write-subagent-files)). Then ask for it by name: `Use the code-reviewer agent to review my changes`.

The file's header block, as comments at the top of its frontmatter, says what it does, when it runs, its side effects, platforms, how to remove it, and its test line.

Smoke test, without Claude: `bash test.sh`.

Tested in Claude Code v2.1.285 (stable) on macOS, 2026-10-06
