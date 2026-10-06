<a id="ai-agents"></a>
<a id="running-agents-in-parallel"></a>
<a id="subagents--running-agents-in-parallel"></a>
# Subagents and running agents in parallel

> [!NOTE]
> From the previous edition, not yet re-verified. The guide is being rebuilt as lessons; this page keeps the earlier material reachable until they land.

Claude Code has **four** ways to run agents at once. They're easy to confuse, so start here: the question that separates them is **who coordinates the work**:

| Surface | Who coordinates | Reach for it when… |
|---|---|---|
| **[Subagents](../intermediate/06-subagents.md)** | Claude, turn by turn, inside one session | A side task would flood your main conversation with search results, logs, or file contents you'll never reference again |
| **Agent view**: `claude agents` *(research preview)* | **You**: hand off, check back later | You have several independent tasks and want to dispatch them, glance at status, and step in only when one needs you. Each dispatched session gets **its own worktree automatically** |
| **[Agent Teams](../../README.md#agent-teams-experimental)** *(experimental)* | A lead agent supervising peer sessions | Workers need to **talk to each other**: share findings, challenge each other, self-claim from a shared task list |
| **[Dynamic Workflows](../../README.md#dynamic-workflows)** | **A script**, not Claude's judgement | The job outgrows a handful of subagents, or you want findings cross-checked against each other: codebase-wide audits, 500-file migrations |

Two supporting tools that aren't a coordination style of their own:

- **[Git worktrees](#1-git-worktrees--parallel-branches-parallel-sessions)**: separate checkouts so parallel sessions never touch the same files.
- **`/batch`**: a bundled skill that researches the codebase, splits one large change into **5–30 independent units**, and spawns a background subagent per unit **in its own worktree, each opening a PR**. It's a packaged use of subagents + worktrees, and the fastest way to feel this whole category.

> [!TIP]
> **Checking on running work** depends on what you started: `/tasks` for anything backgrounded in the current session, `claude agents` for background sessions, `/workflows` for workflow runs. Note `/agents` (removed as a wizard in v2.1.198) is a different thing entirely from `claude agents`.

<a id="1-git-worktrees--parallel-branches-parallel-sessions"></a>
## 1. Git worktrees: parallel branches, parallel sessions

[Git worktrees](https://git-scm.com/docs/git-worktree) let one repo have multiple branches checked out at the same time, each in its own folder. Pair them with one Claude Code session per worktree to run independent streams of work.

```bash
git worktree add -b feature-a ../feature-a    # create the worktree
cd ../feature-a && claude                     # start Claude in it
# Repeat in another terminal for feature-b. Each session is independent.
git worktree remove ../feature-a              # clean up when done
```

> [!TIP]
> Use [tmux](https://github.com/tmux/tmux/wiki/Installing) to keep each worktree's session attached even when you close the terminal.
>
> [!TIP]
> Prefer not to manage them by hand? `claude agents` (agent view) puts **each dispatched session in its own worktree automatically**, and `/batch` does the same per unit of work.

Subagents now have their own lesson: [Delegate to a custom subagent](../intermediate/06-subagents.md).

---

<sub>From the previous edition of [Claude Code: Everything You Need to Know](../../README.md).</sub>
