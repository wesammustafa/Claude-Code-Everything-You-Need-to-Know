# Advanced

<sub>**Advanced** · about 3 hours 20 minutes, plus run time · Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

Beyond one session: parallel sessions, orchestration, unattended runs in scripts and CI, a setup your team shares, and limits that keep an autonomous run safe.

## You're ready for this level if you can

- [ ] Write a project skill that runs by name and loads on its own when it applies.
- [ ] Write a hook that enforces a rule, and show it firing.
- [ ] Delegate to a custom subagent with limited tools.
- [ ] Add an MCP server at project scope, and install a plugin from an Anthropic marketplace.
- [ ] Put permission rules in the right scope, turn on the sandbox, and pick the model and effort for a task.
- [ ] Organize project memory, and find out what loaded when an instruction isn't followed.

## Practice

Practice in your own repository, and run each check from your copy of the [practice template](https://github.com/wesammustafa/claude-code-practice) as `npm run check -- <lesson-id> --dir <your repo>`. The GitHub Actions lesson and the capstone are the exceptions: they run in a separate template copy, which you tear down afterwards so no live credential is left behind.

## Lessons

1. Parallel sessions with worktrees
2. Choose an orchestration pattern
3. Run and save a dynamic workflow
4. Script Claude Code with `claude -p`
5. GitHub Actions
6. Share your setup with a team
7. Put bounds on autonomous runs

Each lesson takes 10 to 20 minutes, plus the time an agent run takes. Lessons are linked here as they are published.

## Capstone

Add CI review to a template copy: a GitHub Actions workflow that uses a secret, a saved workflow run from two parallel worktree sessions merged into one branch, a `claude -p` script with limits, and a local team marketplace. Then tear down the workflow, the secret and the key.

## By the end of this level you can

- [ ] Run parallel sessions in worktrees and merge their work.
- [ ] Choose between subagents, a workflow or a team by need and cost, and run a dynamic workflow.
- [ ] Write a `claude -p` script and a GitHub Actions workflow.
- [ ] Share a setup as committed config and a team marketplace plugin.
- [ ] Bound an autonomous run with least privilege, the sandbox, turn or spend limits, a review gate and a cost estimate.

## Electives

Optional lessons beside the core path:

- Agent teams
- Agent view
- `/goal`, `/loop` and routines
- Testing and publishing a plugin
- Dev containers

## Official companions

- [Run agents in parallel](https://code.claude.com/docs/en/agents): Anthropic's comparison of the ways Claude Code takes on several tasks at once.
- [The AI-native SDLC playbook](https://academy.claude.com/courses/ai-native-sdlc-playbook): Claude Academy's course on reshaping a team's development lifecycle around AI.

---

<sub>Sources: [Run agents in parallel](https://code.claude.com/docs/en/agents) · [The AI-native SDLC playbook](https://academy.claude.com/courses/ai-native-sdlc-playbook)</sub>

<sub>Up: [Claude Code: Everything You Need to Know](../../README.md#pick-your-level)</sub>
