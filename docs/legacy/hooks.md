# Hooks

> [!NOTE]
> From the previous edition, not yet re-verified. The guide is being rebuilt as lessons; this page keeps the earlier material reachable until they land.

> **Mental model:** Hooks are programmable checkpoints on Claude Code's lifecycle (before/after a tool call, session start, prompt submit, etc.). Your script inspects the proposed action and returns *allow* / *deny* / *modify*.

**Three cases that win most teams over:**

| Use case | What the hook does |
|---|---|
| Auto-format on save | Runs `prettier` / `ruff` / `gofmt` after every Edit so Claude's output matches your style |
| Block sensitive paths | Refuses changes to `.env`, `secrets/`, `infra/prod/` regardless of what Claude tries |
| Action audit log | Records every tool call to a file: a paper trail of what Claude did and when |

If none of those resonate, skip ahead.

<a id="setting-up-claude-hooks"></a>
## Setting up hooks

Hooks live in settings files at four scopes (later overrides earlier):

| Scope | Path |
|---|---|
| User-wide | `~/.claude/settings.json` |
| Project (committed) | `.claude/settings.json` |
| Project (local, gitignored) | `.claude/settings.local.json` |
| Enterprise managed policy | platform-specific |

**Quickest setup**: use the interactive menu:

```bash
/hooks    # browse, enable, configure hooks without touching JSON
```

## Hook Events

Hooks run in response to various events within Claude Code's lifecycle:
[examples](https://github.com/disler/claude-code-hooks-mastery)
- **`PreToolUse`**: Runs **after Claude creates tool parameters but before processing the tool call**.
- **`PostToolUse`**: Runs **immediately after a tool completes successfully**.
- **`Notification`**: Runs when Claude Code sends notifications, such as when permission is needed to use a tool or when prompt input has been idle.
- **`UserPromptSubmit`**: Runs when the user submits a prompt, **before Claude processes it**.
- **`Stop`**: Runs when the main Claude Code agent has finished responding (does not run if stopped by user interrupt).
- **`SubagentStop`**: Runs when a Claude Code subagent (Task tool call) has finished responding.
- **`SessionEnd`**: Runs when a Claude Code session ends.
- **`PreCompact`**: Runs before Claude Code is about to run a compact operation.
- **`SessionStart`**: Runs when Claude Code starts a new session or resumes an existing session.
- **`TeammateIdle`**: Runs when an agent teammate becomes idle (Agent Teams); exit code 2 sends the teammate back to work.
- **`TaskCompleted`**: Runs when a task is marked as completed; exit code 2 blocks the completion.

> These are the most-used events. The full catalog is **33 events** as of October 4, 2026 (SubagentStart, PermissionRequest, FileChanged, WorktreeCreate, PostCompact, …); see the [official hooks reference](https://code.claude.com/docs/en/hooks).

## Hook input

Hooks receive **JSON via stdin**. Every event includes `session_id`, `transcript_path`, and `cwd`. Event-specific fields:

| Hook Event | Event-specific fields |
|---|---|
| `PreToolUse` | `tool_name`, `tool_input` |
| `PostToolUse` | `tool_name`, `tool_input`, `tool_response` |
| `Notification` | `message` |
| `UserPromptSubmit` | `prompt` |
| `Stop` / `SubagentStop` | `stop_hook_active` |
| `PreCompact` | `trigger`, `custom_instructions` |
| `SessionStart` | `source` |
| `SessionEnd` | `reason` |
| `TeammateIdle` | `teammate_id`, `last_activity` |
| `TaskCompleted` | `task_id`, `task_name`, `completion_time` |

> [!NOTE]
> The `team_name` field in `TaskCreated` / `TaskCompleted` / `TeammateIdle` payloads is deprecated since v2.1.178 (one implicit team per session).

## Hook output

Two ways to communicate back: **exit codes** for simple control, **JSON in stdout** for fine-grained behavior.

| Exit code | Effect |
|---|---|
| `0` (success) | `stdout` shown in transcript mode (CTRL-R). For `UserPromptSubmit` / `SessionStart`, `stdout` is added to Claude's context. |
| `2` (blocking) | `stderr` fed back to Claude (or shown to user) to block the action. Stops tool calls in `PreToolUse`; stops prompt processing in `UserPromptSubmit`. |
| Other | `stderr` shown; execution continues. |

**Advanced: structured JSON in stdout.** Per-event decision fields:

| Event | JSON output |
|---|---|
| `PreToolUse` | `permissionDecision`: `"allow"` / `"deny"` / `"ask"`; `updatedInput` to modify tool parameters |
| `PostToolUse` | `decision`: `"block"` or `undefined`; `additionalContext` can be returned |
| `UserPromptSubmit` | `decision`: `"block"` or `undefined`; `additionalContext` can be returned |
| `Stop` / `SubagentStop` | `decision`: `"block"` or `undefined` |
| `SessionStart` | `additionalContext` |

## Security considerations

Hooks run **arbitrary shell commands automatically** with your user permissions: they can read, modify, or delete any file you can. Anthropic provides no warranty for what your hooks do.

**Best practices:**

- Validate and sanitize all inputs from stdin JSON
- Quote shell variables (`"$var"`, not `$var`)
- Block path traversal (`..`, absolute paths outside the project)
- Use absolute paths for invoked scripts so PATH attacks don't redirect
- Explicitly skip sensitive files (`.env`, `.git/`, `secrets/`)

Claude Code snapshots your hook configuration at session start and warns if hooks change mid-session; review before applying.

<a id="hook-execution-details-and-debugging"></a>
## Execution & debugging

- **Timeout**: defaults vary by hook type: 600s for `command`/`http`/`mcp_tool` hooks, 30s for `prompt` hooks, 60s for `agent` hooks (some events lower these, e.g. `UserPromptSubmit` command hooks get 30s). Configurable per hook.
- **Parallelization**: all matching hooks run in parallel; identical handlers are deduplicated automatically.
- **Environment**: hooks run in the current dir with Claude Code's env; `CLAUDE_PROJECT_DIR` is available.
- **Debug**: `/hooks` shows current config; `claude --debug` shows hook execution logs; test scripts manually with the JSON payload piped to stdin.

---

<sub>From the previous edition of [Claude Code: Everything You Need to Know](../../README.md).</sub>
