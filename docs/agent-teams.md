# Agent Teams — The Complete Guide

*~15 min read · [← Back to README](../README.md#agent-teams-experimental)*

> ⚠️ **Experimental and disabled by default.** Without `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, no team is set up at session start, no team directories are written, and Claude will not spawn or propose teammates. There are real [limitations](#limitations) around session resumption, task coordination, and shutdown.

> **Mental model:** An agent team is **multiple full Claude Code sessions** coordinated by a lead, sharing a task list and a mailbox. The thing that separates it from subagents isn't parallelism — it's **communication**. Teammates message each other directly, and *you* can message any teammate directly without going through the lead.

---

## Contents

- [Teams vs subagents](#teams-vs-subagents)
- [Enable it](#enable-it)
- [Your first team](#your-first-team)
- [Reuse your existing agent definitions](#reuse-your-existing-agent-definitions)
- [Models and effort](#models-and-effort)
- [Display modes](#display-modes)
- [Talking to teammates](#talking-to-teammates)
- [Plan approval](#plan-approval)
- [The shared task list](#the-shared-task-list)
- [Quality gates with hooks](#quality-gates-with-hooks)
- [Architecture](#architecture)
- [Permissions](#permissions)
- [What teammates know](#what-teammates-know)
- [Two patterns that earn their cost](#two-patterns-that-earn-their-cost)
- [Best practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)

---

## Teams vs subagents

Both parallelize work. Pick based on **whether your workers need to talk to each other**:

| | Subagents | Agent teams |
|---|---|---|
| **Context** | Own context window; results return to the caller | Own context window; fully independent |
| **Communication** | Report back to the main agent only | Teammates message **each other** directly |
| **Coordination** | Main agent manages all work | Shared task list with self-coordination |
| **Best for** | Focused tasks where only the result matters | Work requiring discussion and disagreement |
| **Token cost** | Lower — results summarized back | Higher — each teammate is a separate Claude instance |

Teams add coordination overhead and use significantly more tokens. They work best when teammates can operate **independently**. For sequential work, same-file edits, or heavy dependency chains, a single session or [subagents](https://code.claude.com/docs/en/sub-agents) win. If the job is bigger than a handful of peers can coordinate, you probably want a [dynamic workflow](workflows.md) instead.

---

## Enable it

Either in your shell environment, or — the more durable option — in settings:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1   # or add to ~/.zshrc
```

---

## Your first team

Describe the task and the teammates you want in plain language. This example works because the three roles are genuinely independent — nobody waits on anybody:

```text
I'm designing a CLI tool that helps developers track TODO comments across
their codebase. Spawn three teammates to explore this from different angles:
one on UX, one on technical architecture, one playing devil's advocate.
```

Claude populates the shared task list, spawns a teammate per perspective, and synthesizes findings at the end.

> ⚠️ **Claude may quietly use subagents instead.** Subagents appear in the *same* agent panel as teammates, so the panel alone doesn't prove a team formed. If you got subagents, ask again and explicitly request an agent team.

Teammates are listed in the **agent panel** below your prompt input:

| Key | Action |
|---|---|
| `↑` / `↓` | Select a teammate |
| `Enter` | Open its transcript and message it directly |
| `Esc` | Interrupt the selected teammate's current turn |
| `x` | Stop the selected teammate |
| `Ctrl+T` | Toggle the task list |

**Idle rows hide — they aren't dead.** Once every agent in the panel is idle, idle rows disappear after 30 seconds and return on the teammate's next turn; the teammate stays running and addressable the whole time (v2.1.199+). When more than three are idle, the surplus collapses into a single `N idle agents` row — `Enter` expands it.

---

## Reuse your existing agent definitions

This is the highest-leverage thing most people miss: a teammate can be spawned **from a subagent definition** you already have — project, user, plugin, or CLI-defined.

```text
Spawn a teammate using the security-reviewer agent type to audit the auth module.
```

The teammate honors that definition's `tools` allowlist and `model`, and the definition's body is **appended** to the teammate's system prompt rather than replacing it. Team coordination tools (`SendMessage`, task management) stay available even when `tools` restricts everything else.

So the role prompts in [`.claude/agents/`](../.claude/agents) and [`specialized-agents/`](../specialized-agents) work in both directions — delegate to them as subagents, or staff a team with them. Define the role once.

> ⚠️ The `skills` and `mcpServers` frontmatter fields are **not applied** when a definition runs as a teammate. Teammates load skills and MCP servers from your project and user settings, like a regular session.

---

## Models and effort

**Teammates do not inherit the lead's `/model` selection by default.** This trips up the common "deep lead, cheap teammates" plan, because you may already be getting something other than what you assumed.

- Set **Default teammate model** in `/config`. Choose **Default (leader's model)** to have teammates follow the lead.
- Or specify per spawn: `Spawn 4 teammates to refactor these modules in parallel. Use Sonnet for each teammate.`
- Teammates **do** inherit the lead's [effort level](reference/effort-levels.md) (v2.1.186+ in split-pane mode).

A teammate's model and fast mode are **fixed at spawn**, so `/model` and `/fast` only ever change the lead — even while you're viewing a teammate (v2.1.199 shows a notice saying so). `/effort` does apply to the viewed teammate's later turns.

---

## Display modes

| Mode | What you get | Requires |
|---|---|---|
| **`in-process`** *(default)* | All teammates in your main terminal, navigated with the agent panel | Nothing |
| **Split panes** | One pane per teammate, all output visible at once, click to interact | tmux **or** iTerm2 + [`it2`](https://github.com/mkusaka/it2) |

```json
{ "teammateMode": "auto" }
```

```bash
claude --teammate-mode auto     # single session; experimental, not in --help
```

- `"auto"` — split panes when you're already inside tmux, or on iTerm2 with `it2` installed; falls back to in-process.
- `"tmux"` — split panes, auto-detecting tmux vs iTerm2.
- `"iterm2"` — iTerm2 native panes explicitly (v2.1.186+); needs `it2` plus **iTerm2 → Settings → General → Magic → Enable Python API**.

> ℹ️ The default changed from `"auto"` to `"in-process"` in v2.1.179 — upgraded sessions that used to open split panes now stay in one terminal unless you set the mode.
>
> ⚠️ Split panes are **not supported** in VS Code's integrated terminal, Windows Terminal, or Ghostty. `tmux` works best on macOS; `tmux -CC` in iTerm2 is the suggested entrypoint.

---

## Talking to teammates

Each teammate is a full, independent Claude Code session, so you can redirect one mid-flight instead of restarting the whole team.

- **In-process:** select it in the agent panel, press `Enter`, type.
- **Split panes:** click into its pane.

While you're viewing a teammate, plain text and [skills](skills.md) go to *that teammate* — but built-in commands still run in the lead's session.

**Shutting one down** — refer to it by name. The lead sends a shutdown request; the teammate can approve and exit gracefully, or reject with an explanation.

```text
Ask the researcher teammate to shut down
```

Names matter: the lead assigns every teammate a name at spawn, and any teammate can message any other by that name. **Tell the lead what to call each teammate** in your spawn instruction so you have predictable handles later.

---

## Plan approval

For risky work, make a teammate plan before it touches anything. The teammate stays in read-only plan mode until the lead approves.

```text
Spawn an architect teammate to refactor the authentication module.
Require plan approval before they make any changes.
```

Rejected plans send feedback back; the teammate revises in plan mode and resubmits. **The lead approves autonomously** — it does not ask you. To influence it, give it criteria up front: *"only approve plans that include test coverage"*, *"reject plans that modify the database schema."*

---

## The shared task list

Tasks have three states — **pending**, **in progress**, **completed** — and can depend on other tasks. A pending task with unresolved dependencies can't be claimed until they complete, and dependents unblock automatically.

- **Lead assigns:** tell the lead which task goes to which teammate.
- **Self-claim:** after finishing, a teammate picks up the next unassigned, unblocked task itself.

Claiming uses **file locking**, so two teammates racing for the same task isn't a problem.

---

## Quality gates with hooks

Three [hook](../README.md#hooks) events make team rules enforceable rather than advisory. **Exit code 2 blocks** in all three:

| Hook | Fires when | Exit 2 |
|---|---|---|
| `TeammateIdle` | A teammate is about to go idle | Sends feedback and **keeps it working** |
| `TaskCreated` | A task is being created | Prevents creation, sends feedback |
| `TaskCompleted` | A task is being marked complete | Prevents completion, sends feedback |

`TaskCompleted` + exit 2 is the practical one: gate "done" on your test suite actually passing, so a teammate can't declare victory on red.

> ℹ️ The `team_name` field in these payloads carries a session-derived name and is **deprecated** since v2.1.178.

---

## Architecture

| Component | Role |
|---|---|
| **Team lead** | Your main session — spawns teammates, coordinates, synthesizes |
| **Teammates** | Separate Claude Code instances, one task at a time |
| **Task list** | Shared work items teammates claim and complete |
| **Mailbox** | Message passing between agents |

Teams are stored locally under a session-derived name — `session-` plus the first eight characters of the session ID:

| Path | Lifetime |
|---|---|
| `~/.claude/teams/{team-name}/config.json` | Removed when the session ends |
| `~/.claude/teams/{team-name}/inboxes/{agent-name}.json` | Per-agent mailbox |
| `~/.claude/tasks/{team-name}/` | **Persists** locally, never uploaded — resumed sessions keep their tasks. Retention follows `cleanupPeriodDays` |

> ⚠️ **Don't hand-edit or pre-author the team config.** It holds runtime state (session IDs, tmux pane IDs) and your changes are overwritten on the next state update. There is no project-level equivalent — a `.claude/teams/teams.json` in your project is just an ordinary file, not configuration. To define reusable roles, [use subagent definitions](#reuse-your-existing-agent-definitions).

Teammates *can* read `config.json` to discover each other: its `members` array holds each name and agent ID, with the lead always carrying agent type `team-lead`.

Mailbox entries are validated on read — malformed ones are reported and removed while valid messages still deliver. (Before v2.1.207 a single bad entry error-looped every second and blocked that mailbox until you deleted the file.)

---

## Permissions

- Teammates **start with the lead's permission settings**. If the lead runs `--dangerously-skip-permissions`, so does every teammate. You can change individual modes after spawning, but not per-teammate at spawn time.
- **Teammate permission prompts surface in the lead session** — approve them there yourself.
- A teammate **cannot consent on your behalf.** When one agent messages another via `SendMessage`, the receiver is told it came from another Claude session, not from you. A teammate denied an action can't relay it through a peer to get around the check, and in [auto mode](https://code.claude.com/docs/en/permission-modes) the classifier treats a relayed approval claim as untrusted input.
- [Plan approval](#plan-approval) is the deliberate exception: the lead grants those without prompting you.

---

## What teammates know

On spawn, a teammate loads the same project context as a regular session — `CLAUDE.md`, MCP servers, skills — plus the lead's spawn prompt.

**It does not get the lead's conversation history.** That's the single most common cause of a teammate doing the wrong thing. Put the specifics in the spawn prompt:

```text
Spawn a security reviewer teammate with the prompt: "Review the authentication
module at src/auth/ for security vulnerabilities. Focus on token handling,
session management, and input validation. The app uses JWT tokens stored in
httpOnly cookies. Report any issues with severity ratings."
```

How information moves after that: messages deliver **automatically** (the lead doesn't poll), a finishing teammate notifies the lead on going idle, and everyone sees task status. As of v2.1.198 a teammate whose turn dies on an API error reports the failure with the error text instead of appearing to finish normally. To reach everyone, send one message per recipient.

---

## Two patterns that earn their cost

### Parallel code review with distinct lenses

A single reviewer gravitates toward one class of issue at a time. Assign each teammate a different filter so they don't overlap:

```text
Spawn three teammates to review PR #142:
- One focused on security implications
- One checking performance impact
- One validating test coverage
Have them each review and report findings.
```

### Competing hypotheses — the scientific debate

This is the pattern that justifies teams over subagents, because it needs **inter-agent communication**:

```text
Users report the app exits after one message instead of staying connected.
Spawn 5 agent teammates to investigate different hypotheses. Have them talk to
each other to try to disprove each other's theories, like a scientific
debate. Update the findings doc with whatever consensus emerges.
```

The debate structure *is* the mechanism. Sequential investigation suffers from anchoring: once one theory gets explored, everything after it is biased toward that theory. With independent investigators actively trying to disprove each other, the surviving theory is far more likely to be the real root cause.

---

## Best practices

| ✅ Do | ❌ Don't |
|---|---|
| Start with **3–5 teammates** — the range that balances parallelism against coordination | Scale up before the work genuinely benefits; three focused teammates beat five scattered ones |
| Aim for **5–6 tasks per teammate** so nobody idles and the lead can reassign | Size tasks so large that teammates run for ages without a check-in |
| Give each teammate a **distinct, non-overlapping** slice | Let two teammates edit the same file — teams get no worktree isolation, so it's a straight overwrite |
| Put task specifics in the **spawn prompt** | Assume teammates saw your conversation — they didn't |
| Use **descriptive names** you can reference later | Use `agent1`, `agent2` |
| **Start with research and review** while learning | Start with parallel implementation |
| Pre-approve common operations in permission settings | Let teammate prompts pile up in the lead session |
| Check in, redirect, and synthesize as findings arrive | Leave a team running unattended for long stretches |

Two prompts worth keeping handy:

```text
Wait for your teammates to complete their tasks before proceeding
```

Use it when the lead starts implementing instead of delegating. And when the lead calls it done prematurely, just tell it to keep going.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Teammates never appear** | Check the agent panel below the input (`↑`/`↓`, then Enter). A vanished row is *hidden*, not stopped — message it by name to bring it back. Confirm the task was complex enough to warrant a team; ask explicitly for one |
| **Split panes don't open** | `which tmux`. For iTerm2, verify `it2` is installed and the Python API is enabled |
| **Too many permission prompts** | Pre-approve common operations in [permission settings](https://code.claude.com/docs/en/permissions) *before* spawning |
| **A teammate stopped on an error** | Open its transcript, then either give it new instructions or spawn a replacement. As of v2.1.198, messaging a teammate that's waiting to retry a failed API request wakes it to retry immediately |
| **A task looks stuck** | Task status can lag. Check whether the work is actually done, then update the status manually or tell the lead to nudge the teammate |
| **Lead quits before work is done** | Tell it to keep going |
| **Orphaned tmux session** | `tmux ls` then `tmux kill-session -t <name>` |

---

## Limitations

The honest list, as of v2.1.178+:

- **No session resumption with in-process teammates.** `/resume` and `/rewind` don't restore them; the lead may try to message teammates that no longer exist. Tell it to spawn new ones.
- **Task status can lag** — teammates sometimes fail to mark tasks complete, which blocks dependents.
- **Shutdown can be slow** — teammates finish the current request or tool call first.
- **One team per session.** No additional named teams, no sharing a team across sessions.
- **No nested teams.** Teammates can't spawn teammates; only the lead manages the team.
- **No background subagents from in-process teammates** — a teammate's background work can't outlive the lead's process, so `run_in_background` (or a definition with `background: true`) errors.
- **Lead is fixed.** You can't promote a teammate or transfer leadership.
- **Permissions are set at spawn.** Change individual modes afterward, but not per-teammate up front.
- **No worktree isolation.** Unlike agent view, teams don't isolate teammates in worktrees — [partition the files yourself](#best-practices).

> 💡 `CLAUDE.md` works normally: teammates read it from their working directory. It's the cleanest way to give every teammate the same project rules.

---

## See also

- [Official agent teams docs](https://code.claude.com/docs/en/agent-teams) — authoritative reference
- [Run agents in parallel](https://code.claude.com/docs/en/agents) — subagents vs agent view vs teams vs workflows
- [Dynamic Workflows](workflows.md) — when the job outgrows a handful of peers
- [Subagents](../README.md#ai-agents) — the lighter primitive, and this repo's 10 role prompts
- [Agent team token costs](https://code.claude.com/docs/en/costs#agent-team-token-costs)

---

[← Back to README](../README.md#agent-teams-experimental) · [Dynamic Workflows](workflows.md) · [Skills](skills.md)
