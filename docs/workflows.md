# Dynamic Workflows — Orchestrating Agents at Scale

*~12 min read · [← Back to README](../README.md#dynamic-workflows)*

> **Mental model:** A dynamic workflow is a **JavaScript script that orchestrates subagents**. Claude writes the script for the task you describe, and a runtime executes it in the background while your session stays responsive. The difference from every other multi-agent feature: **the script holds the plan**, not Claude's turn-by-turn judgement.

Requires Claude Code v2.1.154+. Available on all paid plans, the Anthropic API, Amazon Bedrock, Google Cloud's Agent Platform, and Microsoft Foundry. On Pro, turn them on from the **Dynamic workflows** row in `/config`.

---

## Contents

- [Start here: `/deep-research`](#start-here-deep-research)
- [Who holds the plan?](#who-holds-the-plan)
- [Three ways to start a workflow](#three-ways-to-start-a-workflow)
- [Watching a run](#watching-a-run)
- [What the script looks like](#what-the-script-looks-like)
- [Saving a workflow for reuse](#saving-a-workflow-for-reuse)
- [Limits and behavior](#limits-and-behavior)
- [Permissions](#permissions)
- [Controlling cost](#controlling-cost)
- [Resuming a run](#resuming-a-run)
- [Turning workflows off](#turning-workflows-off)
- [Prompt patterns that work](#prompt-patterns-that-work)

---

## Start here: `/deep-research`

Don't write a script. Run the bundled one:

```text
/deep-research What changed in the Node.js permission model between v20 and v22?
```

It fans web searches across several angles, fetches and cross-checks the sources, votes on each claim, and returns a cited report with claims that failed cross-checking filtered out. Claude Code asks permission first; approve it, then run `/workflows` to watch.

This one command shows you the whole model in ~2 minutes: background execution, phases, fan-out, and adversarial verification. `/deep-research` runs only when you invoke it (as of v2.1.218 — earlier versions let Claude start it unprompted).

> It needs the WebSearch tool available in your session.

---

## Who holds the plan?

Subagents, skills, agent teams, and workflows can all run a multi-step task. The real distinction is **who decides what runs next**:

| | Subagents | Skills | Agent teams | Workflows |
|---|---|---|---|---|
| **What it is** | A worker Claude spawns | Instructions Claude follows | A lead supervising peer sessions | A script the runtime executes |
| **Who decides what runs next** | Claude, turn by turn | Claude, following the prompt | The lead agent, turn by turn | **The script** |
| **Where intermediate results live** | Claude's context window | Claude's context window | A shared task list | **Script variables** |
| **What's repeatable** | The worker definition | The instructions | The team definition | **The orchestration itself** |
| **Scale** | A few tasks per turn | Same as subagents | A handful of long-running peers | **Dozens to hundreds per run** |
| **Interruption** | Restarts the turn | Restarts the turn | Teammates keep running | **Resumable in the same session** |

Two consequences fall out of "the script holds the plan":

1. **Your context stays clean.** Intermediate results live in script variables, so Claude's context holds only the final answer. This is why a workflow can coordinate 200 agents when a conversation can't.
2. **Quality patterns become repeatable.** A script can have independent agents *adversarially review each other's findings* before anything is reported, or draft a plan from several angles and weigh them against each other. That's a more trustworthy result than a single pass — and it runs the same way every time.

> 💡 **When not to use one.** A workflow is overhead for anything a couple of subagents can handle. Reach for it when the task outgrows one conversation's coordination, or when you want the orchestration codified as a script you can read and rerun.

---

## Three ways to start a workflow

### 1. Run one that already exists

`/deep-research`, a workflow [you saved](#saving-a-workflow-for-reuse), or one shipped in a [plugin](https://code.claude.com/docs/en/plugins). Saved workflows appear in `/` autocomplete like any other command.

### 2. Ask for one in a single prompt

Include the keyword `ultracode`, or just say what you want in plain words — "use a workflow", "run a workflow". Claude treats a direct request as the same opt-in.

```text
ultracode: audit every API endpoint under src/routes/ for missing auth checks
```

Claude Code highlights the keyword and Claude writes a script instead of working turn by turn. The keyword only changes *how* the work is structured — the run stays inside your session's [permission mode](https://code.claude.com/docs/en/permission-modes), and its agents get the same permission checks and sandboxing as any other tool call.

**Dismiss it:** `Option+W` (macOS) or `Alt+W` (Windows/Linux) clears the highlight for this prompt; backspace right after the keyword also works. Turn it off entirely with **Ultracode keyword trigger** in `/config`.

**Where the keyword does *not* work** — by design, it's an opt-in only in a prompt *you* typed. It won't trigger from `-p`, a scheduled task, a webhook payload, or a relayed PR comment. (Before v2.1.210 it did fire from those routes.)

### 3. Let Claude decide for the whole session

```bash
/effort ultracode                 # this session
claude --effort ultracode         # from launch (v2.1.203+)
```

`ultracode` combines `xhigh` reasoning with automatic workflow orchestration: Claude plans a workflow for **every substantive task** instead of waiting to be asked. One request can become several workflows in a row — one to understand the code, one to make the change, one to verify it.

That means every request costs more and takes longer. It resets when you start a new session; drop back with `/effort high` for routine work. Only offered on models that support `xhigh`.

### Approving the run

The prompt shows the planned phases, plus **Yes, run it** / **Yes, and don't ask again for this workflow in this project** / **View raw script** / **No**. `Ctrl+G` opens the script in your editor; `Tab` lets you adjust the prompt first.

| Permission mode | When you're prompted |
|---|---|
| Manual (default), accept edits | Every run, unless you chose "don't ask again" for that workflow in this project |
| Auto | First launch only — a **Yes** records consent in user settings. Skipped entirely when `ultracode` is on |
| Bypass permissions, `claude -p`, Agent SDK | Never — the run starts immediately |

---

## Watching a run

Runs execute in the background, so the session stays usable. `/workflows` lists running and completed runs; select one and press Enter for its progress view (phases, agent counts, token totals, elapsed time). A one-line summary also appears in the task panel below the input box — press `↓` to focus it, Enter to expand.

| Key | Action |
|---|---|
| `↑` / `↓` | Select a phase or agent |
| `Enter` / `→` | Drill into a phase, then an agent — read its prompt, recent tool calls, and result |
| `Esc` / `←` | Back out one level |
| `j` / `k` | Scroll within agent detail when it overflows |
| `f` | Filter the phase's agent list by status; press again to cycle (v2.1.186+) |
| `p` | Pause or resume the run |
| `x` | Stop the selected agent — or the whole run when focus is on the run |
| `r` | Restart the selected running agent |
| `s` | [Save](#saving-a-workflow-for-reuse) this run's script as a command |

> ℹ️ In v2.1.203–v2.1.205, `←` didn't step back out of a phase or agent. Use `Esc` on those versions.

---

## What the script looks like

You don't write these by hand — but you should be able to read one, because reading it is how you audit what 50 agents are about to do. Here's the shape:

```javascript
export const meta = {
  name: 'audit-routes',
  description: 'Audit every route handler for missing auth checks',
}

const found = await agent('List every .ts file under src/routes/.', {
  schema: { type: 'object', required: ['files'],
            properties: { files: { type: 'array', items: { type: 'string' } } } },
})

const audits = await pipeline(found.files, file =>
  agent(`Audit ${file} for missing authentication checks.`, { label: file }),
)

return audits.filter(Boolean)
```

Plain JavaScript with top-level `await`. `agent()` spawns one subagent; `pipeline()` runs one per item in a list; passing a `schema` forces structured output so the script gets a validated object instead of prose it has to parse.

Every run writes its script to a file under your session directory in `~/.claude/projects/`, and Claude receives the path — so you can ask for it, diff it against a previous run, or edit it and ask Claude to relaunch from the edited version.

> 📂 **A working example lives in this repo:** [`.claude/workflows/stale-docs-audit.js`](../.claude/workflows/stale-docs-audit.js) — fans one reader agent per doc file, then has independent verifier agents try to *refute* each finding before it's reported. Clone the repo and run `/stale-docs-audit` to see it work.
>
> For the full script API, see the Workflow tool entry in the [Agent SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript).

---

## Saving a workflow for reuse

When a run does what you wanted, keep it. Run `/workflows`, select the run, press `s`. `Tab` toggles the location:

| Location | Scope |
|---|---|
| `.claude/workflows/` | Project — shared with everyone who clones the repo |
| `~/.claude/workflows/` | Personal — every project, only you. Honors `CLAUDE_CONFIG_DIR` |

Press Enter and it runs as `/<name>` from then on. If a project and personal workflow share a name, **the project one wins**.

**Monorepos** (v2.1.178+): saving to the project location writes to the closest existing `.claude/workflows/` between your cwd and the repo root. Project workflows load from *every* `.claude/workflows/` along that path, and the one closest to your cwd wins on name collisions.

**In a plugin:** put the script in a `workflows/` directory at the plugin root. Plugin workflows are namespaced — a plugin `acme-tools` with `meta.name: 'release-audit'` runs as `/acme-tools:release-audit`.

### Passing input with `args`

A saved workflow reads invocation input from a global named `args`:

```text
> Run /triage-issues on issues 1024, 1025, and 1030
```

Claude passes the list as **structured data**, so the script can call array and object methods on `args` directly — no parsing. If you omit input, `args` is `undefined`.

> 🔒 Since v2.1.216, Claude Code refuses to write a saved workflow through a symlink. For the project location it checks `.claude`, `.claude/workflows`, and the target file; for the personal location only the target file, so dotfiles-managed `~/.claude` still works.

---

## Limits and behavior

| Constraint | Why |
|---|---|
| **No mid-run user input** | Only agent permission prompts pause a run. For sign-off between stages, run each stage as its own workflow |
| **No direct filesystem or shell access from the script** | Agents read, write, and run commands. The script only coordinates them |
| **Up to 16 concurrent agents** (fewer on low-core machines) | Bounds local resource use — excess calls queue and run as slots free |
| **1,000 agents total per run** | Runaway-loop backstop, set far above any real workflow |

---

## Permissions

Worth internalizing, because it surprises people:

- **The subagents a workflow spawns always run in `acceptEdits` mode**, regardless of your session's permission mode. **File edits are auto-approved.** Your mode controls only the launch prompt.
- Agents inherit your [tool allowlist](https://code.claude.com/docs/en/settings#permission-settings).
- Shell commands, web fetches, and MCP tools *not* in your allowlist can still prompt you mid-run. On a long run, allowlist what the agents will need **before** starting — otherwise you'll be babysitting a background job.
- In `claude -p` and the Agent SDK there's nobody to prompt, so tool calls follow your configured rules without interactive confirmation.

---

## Controlling cost

A workflow spawns many agents, so one run can use meaningfully more tokens than doing the same work in conversation. Runs count against your plan's usage and rate limits like any other session.

**The cheapest habit: run it on a slice first.** One directory instead of the whole repo, a narrow question instead of a broad one. The `/workflows` view shows per-agent token usage live, and stopping a run there never loses completed work.

### Size guideline

Tells Claude how many agents to aim for. It's **advice, not a cap** — a prompt calling for different scale still overrides it. Requires v2.1.202+.

| Value | Agents Claude aims for |
|---|---|
| `unrestricted` | No guideline — sized to the task |
| `small` | Fewer than 5 |
| `medium` *(default)* | Fewer than 15 |
| `large` | Fewer than 50 |

```bash
/config workflowSizeGuideline=small
```

On v2.1.219+ you can also set `workflowSizeGuideline` in any settings file, which takes precedence over `/config`. Changes apply on the next prompt; the [runtime caps](#limits-and-behavior) always apply regardless.

### The large-run warning

When a workflow schedules more than **25 agents**, or its projected token total passes **1.5 million**, its progress line shows a `Large workflow` warning pointing you at `/workflows` (v2.1.203+). It's advisory — it doesn't pause anything. Choosing a size guideline replaces the 25-agent threshold with that guideline's count, and sessions with `ultracode` on don't show it at all (you already opted in).

### Model routing

Every agent uses your session's model unless the script routes a stage elsewhere or `CLAUDE_CODE_SUBAGENT_MODEL` is set (that env var overrides both). So: **check `/model` before a large run**, and when describing the task, ask Claude to use a smaller model for stages that don't need the strongest one.

---

## Resuming a run

Stop a run and you can resume it: agents that already completed return **cached** results, and the rest run live. Resume from `/workflows` with `p`, or ask Claude to relaunch with the same script.

> 💡 **The non-obvious consequence:** an agent still running when you stopped isn't saved and starts over. So a workflow that fans work across **many small agents preserves far more progress on interruption** than one built around a few long-running agents. Worth knowing before you write a script that does everything in three giant steps.

Resume works **within the same session only**. Exit Claude Code mid-run and the next session starts that workflow fresh.

---

## Turning workflows off

For yourself:

- Toggle **Dynamic workflows** off in `/config` — persists across sessions
- `"disableWorkflows": true` in `~/.claude/settings.json` — persists
- `CLAUDE_CODE_DISABLE_WORKFLOWS=1` — read at startup, applies wherever you set it

Organization-wide: `"disableWorkflows": true` in [managed settings](https://code.claude.com/docs/en/server-managed-settings), or the toggle on the [Claude Code admin settings](https://claude.ai/admin-settings/claude-code) page.

When disabled, bundled workflow commands disappear, the `ultracode` keyword stops triggering, and `ultracode` is removed from the `/effort` menu.

---

## Prompt patterns that work

You describe the shape; Claude writes the script. These are the shapes that pay off:

| Goal | Prompt |
|---|---|
| **Audit many files for one issue** | `use a workflow to audit every route handler under src/routes/ for missing authentication checks, and adversarially verify each finding before reporting it` |
| **Fix until a check passes** | `use a workflow to run npx tsc --noEmit and keep fixing the reported errors until the type check passes or two rounds in a row make no progress` |
| **Migrate many files in parallel** | `use a workflow to migrate every component under src/components/ from styled-components to Tailwind, working on each file in its own isolated copy` |
| **Review, then one summary** | `use a workflow to review every file changed in this PR for correctness issues, then merge the per-file findings into one ranked summary` |
| **Research across sources** | `use a workflow to research how our three competitors handle rate limiting: read their public docs and recent changelog entries in parallel, then compare the approaches` |
| **Find issues until the list stops growing** | `use a workflow to find flaky tests in this repo: run the suite repeatedly, record which tests fail intermittently, and stop once two rounds in a row find nothing new` |

Three phrases that reliably improve the script Claude writes:

- **"adversarially verify each finding"** — adds skeptic agents that try to *refute* results before they're reported. Kills plausible-but-wrong findings.
- **"in its own isolated copy"** — puts each agent in a separate git worktree so parallel edits can't conflict.
- **"until two rounds in a row find nothing new"** — replaces a guessed count with a convergence condition. Better for discovery work where you don't know the answer's size.

> 💡 Already have an orchestrator built another way — a folder of subagent prompts, or a skill that fans work out? Point Claude at it and ask for a workflow that does the same thing.

---

## See also

- [Official workflows docs](https://code.claude.com/docs/en/workflows) — authoritative reference
- [Run agents in parallel](https://code.claude.com/docs/en/agents) — subagents vs agent view vs teams vs workflows
- [Agent Teams guide](agent-teams.md) — the other multi-agent surface, and when to pick it instead
- [Effort levels](reference/effort-levels.md) — what `ultracode` changes
- [Slash commands](reference/commands.md) — `/workflows`, `/deep-research`, `/batch`

---

[← Back to README](../README.md#dynamic-workflows) · [Agent Teams](agent-teams.md) · [Skills](skills.md)
