# Advanced

<sub>**Advanced** · about 4 hours, plus run time · Verified against Claude Code v2.1.292 (stable) on 2026-10-15</sub>

Beyond one session: parallel sessions, orchestration, unattended runs in scripts and CI, a setup your team shares, and limits that keep an autonomous run safe.

## You're ready for this level if you can

- [ ] Write a project skill that runs by name and loads on its own when it applies.
- [ ] Write a hook that enforces a rule, and show it firing.
- [ ] Delegate to a custom subagent with limited tools.
- [ ] Add an MCP server at project scope, and install a plugin from an Anthropic marketplace.
- [ ] Put permission rules in the right scope, turn on the sandbox, and pick the model and effort for a task.
- [ ] Organize project memory, and find out what loaded when an instruction isn't followed.

## Practice

Practice in your own repository, and run each check from your copy of the [practice template](https://github.com/wesammustafa/claude-code-practice) as `npm run check -- <lesson-id> --dir <your repo>`. The GitHub Actions lesson and the capstone are the exceptions: they run in a separate template copy, which you tear down afterwards so no workflow or secret is left behind.

To go step by step, run `npm run learn` in your copy and use Claude Code in a second terminal beside it. The app takes you through every lesson and the capstone, one step at a time, and checks your work as you go. Each page below teaches the same lesson on its own.

A copy you made for an earlier level may not have the Advanced checks or lessons: `npm run check` then lists no `a-` lessons. Bring them in from the template, in your copy:

```bash
git fetch https://github.com/wesammustafa/claude-code-practice main
git checkout FETCH_HEAD -- checks capstone learn
git commit -m "Add the Advanced checks and lessons"
```

A copy older than the app has no `learn` script, so `npm run learn` says `Missing script: "learn"`: run `node learn/app.mjs` instead.

## Lessons

1. [Parallel sessions with worktrees](01-parallel-sessions.md)
2. [Choose an orchestration pattern](02-orchestration-patterns.md)
3. [Run and save a dynamic workflow](03-dynamic-workflows.md)
4. [Script Claude Code with `claude -p`](04-headless.md)
5. [GitHub Actions](05-github-actions.md)
6. [Share your setup with a team](06-share-your-setup.md)
7. [Put bounds on autonomous runs](07-bounded-runs.md)

Each lesson takes about 20 minutes, and the capstone 60 to 90, plus the time an agent run takes.

## Capstone

[Add CI review your team can share](capstone.md): in a new template copy, one review skill that a bounded `claude -p` script and a pull request workflow with limits both run, built in two parallel worktree sessions beside a team marketplace, plus a saved dynamic workflow for a sweep before a release. Then tear down the workflow, the secret and, with an API key, the key.

## By the end of this level you can

- [ ] Run parallel sessions in worktrees and merge their work.
- [ ] Choose between subagents, `/batch`, a workflow or a team by need and cost, keep a session working until a check passes with `/goal`, and save a dynamic workflow.
- [ ] Write a `claude -p` script and a GitHub Actions workflow.
- [ ] Share a setup as committed config and a team marketplace plugin.
- [ ] Bound an autonomous run with least privilege, the sandbox, turn or spend limits, a review gate and a cost estimate.

## Electives

Optional lessons beside the core path:

- [Agent teams](electives/agent-teams.md): a lead and teammates that message each other, staffed from your own subagent definitions.
- [Agent view](electives/agent-view.md): hand tasks to background sessions from one screen, and step in only when one needs you.
- [`/loop` and cloud scheduled tasks](electives/goal-loop-routines.md): keep Claude working on an interval in your session, or on a schedule in the cloud.
- [Testing and publishing a plugin](electives/publish-a-plugin.md): check a plugin's files and behavior, then publish it in your own marketplace.
- [Dev containers](electives/dev-containers.md): run Claude Code in a container with a firewall, keep your sign-in, and let it work unattended.

## Official companions

- [Run agents in parallel](https://code.claude.com/docs/en/agents): Anthropic's comparison of the ways Claude Code takes on several tasks at once.
- [The AI-native SDLC playbook](https://academy.claude.com/courses/ai-native-sdlc-playbook): Claude Academy's course on reshaping a team's development lifecycle around AI.

## Beyond this guide

[Beyond this guide](beyond-this-guide.md): building your own agents and MCP servers, and running and rolling out Claude Code for an organization.

---

<sub>Sources: [Run agents in parallel](https://code.claude.com/docs/en/agents) · [The AI-native SDLC playbook](https://academy.claude.com/courses/ai-native-sdlc-playbook)</sub>

<sub>Up: [Claude Code: Everything You Need to Know](../../README.md#pick-your-level)</sub>
