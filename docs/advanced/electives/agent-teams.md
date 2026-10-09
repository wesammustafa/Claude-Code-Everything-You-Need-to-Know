# Agent teams

<sub>**Advanced** · Elective · about 20 minutes, plus run time · Needs: [Choose an orchestration pattern](../02-orchestration-patterns.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-09</sub>

> [!NOTE]
> "Agent teams are experimental and disabled by default." ([Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams))

## Goal

By the end of this Elective you can staff an agent team from your own subagent definitions, show that a team formed, and shut its teammates down by name.

## You need

- [Choose an orchestration pattern](../02-orchestration-patterns.md), and the subagent definitions you wrote in [Delegate to a custom subagent](../../intermediate/06-subagents.md).
- One of your own repositories, with its `.practice/` folder set up as [Beginner lesson 1](../../beginner/01-install-and-look-around.md#you-need) describes.
- macOS, Linux or WSL 2, and `jq`: the hooks that log the team are shell commands that use it.
- An interactive session: in a `-p` run, Claude doesn't spawn teammates ([Enable agent teams](https://code.claude.com/docs/en/agent-teams#enable-agent-teams)). The default in-process display, where teammates run inside your terminal, works in any terminal ([Choose a display mode](https://code.claude.com/docs/en/agent-teams#choose-a-display-mode)).
- Usage: heavy. Each teammate is a separate Claude instance with its own context window, and token usage scales with the number of active teammates ([Token usage](https://code.claude.com/docs/en/agent-teams#token-usage)). Cheap variant: change one small file in the Worked example, run two teammates in Your turn, and shut the teammates down as soon as they report.

## The idea

An agent team is several Claude Code sessions working together. Your session is the lead: it spawns teammates, each in its own context window. Teammates message each other directly, and you can message any of them, while subagents mainly return a result to the caller ([Compare with subagents](https://code.claude.com/docs/en/agent-teams#compare-with-subagents)).

A teammate loads your CLAUDE.md, MCP servers and skills plus the lead's spawn prompt, but not the lead's conversation, so the prompt carries the task ([Context and communication](https://code.claude.com/docs/en/agent-teams#context-and-communication)). Name a subagent definition in it, and the teammate runs with that definition's `tools` and instructions, and its `model` unless the spawn prompt names one; an in-process teammate also gets `SendMessage`, so a read-only one can still reach the others ([Use subagent definitions for teammates](https://code.claude.com/docs/en/agent-teams#use-subagent-definitions-for-teammates)).

Teams "use significantly more tokens than a single session" ([Token usage](https://code.claude.com/docs/en/agent-teams#token-usage)), and teammates share your working tree ([Choose an approach](https://code.claude.com/docs/en/agents#choose-an-approach)). Use them where independent views pay off: a review through distinct lenses, or rival hypotheses argued out.

## Worked example

1. In your repository, download the two read-only reviewers from this guide's [agent teams example](../../../examples/advanced/electives/agent-teams/README.md). Read them before you use them:

   ```bash
   mkdir -p .claude/agents
   for a in security-reviewer test-reviewer; do
     curl -fsSL "https://raw.githubusercontent.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/main/examples/advanced/electives/agent-teams/dot-claude/agents/$a.md" -o ".claude/agents/$a.md"
   done
   grep -H '^tools:' .claude/agents/security-reviewer.md .claude/agents/test-reviewer.md
   ```

   Each line ends in `tools: Read, Grep, Glob`: the reviewers can read files, but can't edit them or run commands, `git` included. Grep and Glob, the search tools, are absent by default on macOS, Linux and WSL; a subagent that lists them and leaves out Bash gets them back ([Glob tool behavior](https://code.claude.com/docs/en/tools-reference#glob-tool-behavior)). Both set `model: sonnet`. If a session is already open here and `.claude/agents/` is new, restart it: Claude Code watches only the agent folders that existed when the session started ([Write subagent files](https://code.claude.com/docs/en/sub-agents#write-subagent-files)).
2. Use a change you're working on, or make a throwaway one: change one tracked source file the way a real change would, for example a function that reads user input, with no new test. Leave it uncommitted. The reviewers can't run `git diff`, so save the change where they can read it:

   ```bash
   git diff > .practice/a-teams.diff
   ```

3. Save this as `.practice/a-teams.json`:

   ```json
   {
     "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" },
     "teammateMode": "in-process",
     "hooks": {
       "TeammateIdle": [
         { "hooks": [ { "type": "command", "command": "jq -r '.teammate_name' >> \"$CLAUDE_PROJECT_DIR/.practice/a-teams-teammates.txt\"" } ] }
       ]
     }
   }
   ```

   It turns agent teams on only for the sessions you start with it ([Enable agent teams](https://code.claude.com/docs/en/agent-teams#enable-agent-teams), [Claude spawns teammates instead of subagents](https://code.claude.com/docs/en/agent-teams#claude-spawns-teammates-instead-of-subagents)), and `teammateMode` keeps their teammates in the in-process display that these steps describe ([`teammateMode`](https://code.claude.com/docs/en/settings-reference#teammatemode)). Its hook, [`TeammateIdle`](https://code.claude.com/docs/en/hooks#teammateidle), writes each teammate's name to `.practice/a-teams-teammates.txt` when it is about to go idle.
4. Start the lead with the file:

   ```bash
   CLAUDE_CODE_ENABLE_TODO_TOOLS=1 claude --settings .practice/a-teams.json
   ```

   `--settings` applies the file's keys on top of your settings, for this session only ([CLI reference](https://code.claude.com/docs/en/cli-reference#cli-flags)). The variable gives the session the Task tools on every model; without it, Claude Code provides them only on the older models that [Task tool availability](https://code.claude.com/docs/en/tools-reference#task-tool-availability) lists, and teammates coordinate by message instead of a shared task list. Run `/context`: its custom subagents include `security-reviewer` and `test-reviewer` ([See what loaded into context](https://code.claude.com/docs/en/debug-your-config#see-what-loaded-into-context)).
5. Ask for the team. Give each teammate one lens, as the docs' [parallel code review](https://code.claude.com/docs/en/agent-teams#run-a-parallel-code-review) does, plus a name and an [agent type](https://code.claude.com/docs/en/agent-teams#use-subagent-definitions-for-teammates):

   ```text
   Create an agent team to review the change saved in .practice/a-teams.diff and the files it touches.
   Spawn two teammates: one named security, using the security-reviewer agent type, and one named
   tests, using the test-reviewer agent type. When both have reported, write one combined report
   to .practice/a-teams-review.md.
   ```

   Claude Code launches teammates without asking you to confirm ([How Claude starts agent teams](https://code.claude.com/docs/en/agent-teams#how-claude-starts-agent-teams)). A row for each appears in the agent panel below the prompt. Subagents show in the same panel, so the panel alone doesn't prove a team formed ([Start your first agent team](https://code.claude.com/docs/en/agent-teams#start-your-first-agent-team)): step 7's log does. `Ctrl+T` toggles the task list ([Talk to teammates directly](https://code.claude.com/docs/en/agent-teams#talk-to-teammates-directly)). The prompt names no model, so each teammate runs on its definition's `model`, unless you've set `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` ([Specify teammates and models](https://code.claude.com/docs/en/agent-teams#specify-teammates-and-models)). When both have reported, the lead writes the combined report (your wording will differ); approve the write if Claude Code asks.
6. Shut the teammates down by name:

   ```text
   Ask the security and tests teammates to shut down.
   ```

   Each teammate approves and exits, or rejects the request with an explanation ([Shut down teammates](https://code.claude.com/docs/en/agent-teams#shut-down-teammates)); if one rejects, read its reason and ask again. A teammate whose row has disappeared from the panel is hidden, not stopped, so name it in the request too ([Start your first agent team](https://code.claude.com/docs/en/agent-teams#start-your-first-agent-team)). Then exit the session. Claude Code removes the team's config when the session ends and keeps its task list for resumed sessions, so there's no separate cleanup step ([Architecture](https://code.claude.com/docs/en/agent-teams#architecture)).
7. Read the log:

   ```bash
   sort -u .practice/a-teams-teammates.txt
   ```

   It lists `security` and `tests`, so a team formed.

## Your turn

Debug with competing hypotheses, as the docs' [Investigate with competing hypotheses](https://code.claude.com/docs/en/agent-teams#investigate-with-competing-hypotheses) example does. Pick a real bug or puzzling behavior in your repository whose cause you don't know and that reading the code could explain. Write a read-only investigator definition, for example by copying `test-reviewer.md` to `.claude/agents/hypothesis-tester.md` and rewriting it. Start a new session the same way, so the lead starts clean, and have it spawn three teammates from your definition, each owning one hypothesis and messaging the others to challenge their theories. Cheap variant: two teammates.

Acceptance criteria:

- Your definition has its own `name` and `description`, `model: sonnet`, and a single-line `tools:` that names only `Read`, `Grep` and `Glob`, as the two reviewers' lines do and as the docs' read-only example does ([Quickstart: create your first subagent](https://code.claude.com/docs/en/sub-agents#quickstart-create-your-first-subagent)). A definition with no `tools` line inherits every tool available to subagents ([Frontmatter reference](https://code.claude.com/docs/en/sub-agents#supported-frontmatter-fields)).
- Every teammate runs from your definition, under a name you chose in the spawn prompt.
- The lead saves the explanation that survived, and the theories it ruled out, to `.practice/a-teams-debate.md`.
- No tracked file changes beyond your change from the Worked example.
- You ask every teammate, by name, to shut down.

## Check

You are done when all of these are true:

- [ ] Every definition a teammate used is read-only. This prints nothing when each has a single-line `tools:` that names only `Read`, `Grep` and `Glob` (use your definition's file name):

  ```bash
  for f in .claude/agents/security-reviewer.md .claude/agents/test-reviewer.md .claude/agents/hypothesis-tester.md; do
    grep -qxE 'tools: *(Read|Grep|Glob)( *, *(Read|Grep|Glob))* *' "$f" || echo "$f: tools: names more than Read, Grep and Glob, or is missing"
  done
  ```

- [ ] A team formed, not only subagents: `sort -u .practice/a-teams-teammates.txt` lists every teammate name you chose.
- [ ] Both results are saved: `ls .practice/a-teams-review.md .practice/a-teams-debate.md` lists both files.
- [ ] The teams changed no tracked file: `git diff | diff - .practice/a-teams.diff` prints nothing.
- [ ] Self-check (not tested): the debate report says which theories the teammates ruled out and why, and you asked every teammate, by name, to shut down.

If the teammates log is missing, no team formed: start the lead with the step 4 command and ask explicitly for an agent team. If `git diff` differs from your saved change, the lead or a teammate edited a tracked file: read the difference, undo that edit, and check each definition's `tools:` line. When you're done, keep the change, or undo a throwaway one with `git restore <file>`.

## Watch out

- Teammates start with your permission mode, except `dontAsk`, and if you run with `--dangerously-skip-permissions`, every teammate does too. Their permission prompts appear in your session for you to answer ([Permissions](https://code.claude.com/docs/en/agent-teams#permissions)). While teams are on, a subagent that Claude names launches as a teammate, so a team can form when you didn't ask for one: this Elective turns teams on only for sessions started with `--settings`, not in your user or project settings ([Enable agent teams](https://code.claude.com/docs/en/agent-teams#enable-agent-teams)).
- Each active teammate keeps using tokens until it exits or the session ends. Keep teams small, put Sonnet in the definitions, keep spawn prompts focused, and shut teammates down when their work is done ([Agent team token costs](https://code.claude.com/docs/en/costs#agent-team-token-costs)).
- Two teammates editing the same file overwrite each other's work, so give each its own files ([Avoid file conflicts](https://code.claude.com/docs/en/agent-teams#avoid-file-conflicts)). And `/resume` and `/rewind` don't bring in-process teammates back: after a resume, ask the lead to spawn new ones ([Limitations](https://code.claude.com/docs/en/agent-teams#limitations)).

## Go further

- [Enforce quality gates with hooks](https://code.claude.com/docs/en/agent-teams#enforce-quality-gates-with-hooks): `TeammateIdle`, `TaskCreated` and `TaskCompleted` hooks that exit with code 2 keep a teammate working, or stop a task from being created or completed, until your rule passes.
- [Have teammates plan before implementing](https://code.claude.com/docs/en/agent-teams#have-teammates-plan-before-implementing): read-only planning for teams that change code. Claude Code approves each plan as it arrives, without the lead reviewing it; the teammate's edits and commands still go through your permission prompts.
- [Choose a display mode](https://code.claude.com/docs/en/agent-teams#choose-a-display-mode): each teammate in its own tmux or iTerm2 pane, in place of the in-process panel.

---

<sub>Sources: [Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams) · [Run agents in parallel](https://code.claude.com/docs/en/agents) · [Create custom subagents](https://code.claude.com/docs/en/sub-agents) · [Hooks reference](https://code.claude.com/docs/en/hooks) · [Tools reference](https://code.claude.com/docs/en/tools-reference) · [All settings](https://code.claude.com/docs/en/settings-reference) · [CLI reference](https://code.claude.com/docs/en/cli-reference) · [Debug your configuration](https://code.claude.com/docs/en/debug-your-config) · [Manage costs effectively](https://code.claude.com/docs/en/costs)</sub>

<sub>Back to the [Advanced index](../README.md) · Topic: [Subagents and parallel work](../../topics/subagents-and-parallel-work.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=a-agent-teams)</sub>
