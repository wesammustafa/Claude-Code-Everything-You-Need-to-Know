# Reviewer subagents for the agent teams Elective

> [!NOTE]
> Agent teams are experimental and disabled by default.

Two read-only subagents for the Advanced Elective "Agent teams": `security-reviewer`, which looks for injection, unsafe input handling, exposed secrets and missing access checks, and `test-reviewer`, which looks for changed behavior without a test, tests that can't fail and missing edge cases. Each reports findings by severity. Their only tools are Read, Grep and Glob, so they can read and search files but can't edit them or run commands ([Create custom subagents](https://code.claude.com/docs/en/sub-agents#available-tools)). Without a shell they can't run `git diff`, so name the changed files in your prompt, or save the diff to a file first and name that file. Both run on Sonnet (`model: sonnet`).

Copy them into `.claude/agents/` in your project:

```bash
mkdir -p .claude/agents
cp <path-to-this-folder>/dot-claude/agents/*.md .claude/agents/
```

If `.claude/agents/` didn't exist when your session started, restart Claude Code so it sees the new folder ([Create custom subagents](https://code.claude.com/docs/en/sub-agents#write-subagent-files)). To confirm both loaded, run `/context`, which lists custom subagents with the source each loaded from ([Debug your configuration](https://code.claude.com/docs/en/debug-your-config)), or type `@` and find them in the typeahead.

Each file's header block, as comments at the top of its frontmatter, says what it does, when it runs, its side effects, platforms, how to remove it, and its test line. In short:
- **What:** two project subagents that review code changes, each through one lens, and change no files.
- **Runs:** when Claude delegates a review to one of them, when you ask for one by name, or as a teammate's role when agent teams are on and a spawn prompt names its agent type.
- **Side effects:** none. Read, Grep and Glob only.
- **Requires:** Claude Code; for teammates, agent teams turned on and an interactive session. Platforms: any; `test.sh` needs bash and awk.
- **Remove:** delete `.claude/agents/security-reviewer.md` and `.claude/agents/test-reviewer.md`.

## As teammates

Agent teams need `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` set to `1`, in your shell or under `env` in settings, and an interactive session: with `-p`, Claude doesn't spawn teammates ([Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams#enable-agent-teams)). For one session:

```bash
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude
```

Then name the agent types in your spawn prompt, as the docs do:

```text
Spawn two teammates using the security-reviewer and test-reviewer agent types to review the changes in <the changed files, or your saved diff>. Have them each report findings.
```

Each teammate is limited to its definition's `tools` (an in-process teammate also gets the message and task tools Claude Code adds) and runs on its definition's `model` unless your spawn prompt names another; the docs list how the body and the other fields apply ([Use subagent definitions for teammates](https://code.claude.com/docs/en/agent-teams#use-subagent-definitions-for-teammates)).

> [!WARNING]
> While agent teams are on, a subagent that Claude names launches as a teammate, so a team can form when you didn't ask for one ([Enable agent teams](https://code.claude.com/docs/en/agent-teams#enable-agent-teams)). Teammates start with your permission mode, except `dontAsk`, and their permission prompts appear in your session for you to answer. If you run with `--dangerously-skip-permissions`, every teammate does too ([Permissions](https://code.claude.com/docs/en/agent-teams#permissions)).

## As subagents, the cheap variant

Agent teams use significantly more tokens than a single session ([Token usage](https://code.claude.com/docs/en/agent-teams#token-usage)). The same two files work as ordinary subagents in one session with agent teams off: ask `Use the security-reviewer agent to review <files>`, then the same for `test-reviewer`. Keep the variable unset for this, because with agent teams on, a subagent that Claude names launches as a teammate.

Smoke test, without Claude: `bash test.sh`.

Tested in Claude Code v2.1.285 (stable) on macOS, 2026-10-09

Sources: [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams), [Create custom subagents](https://code.claude.com/docs/en/sub-agents), [Debug your configuration](https://code.claude.com/docs/en/debug-your-config)
