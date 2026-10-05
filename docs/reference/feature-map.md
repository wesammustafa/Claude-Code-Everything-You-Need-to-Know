# Feature map

<sub>Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

Every current Claude Code feature and surface a Learner is likely to meet, with its stability label in the docs' own words and the plans or providers that have it. Each feature links its official page; a link to the lesson that teaches it is added when that lesson is published. For what changed recently, see the official [CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) and [What's new](https://code.claude.com/docs/en/whats-new).

How to read it:

- **Label** quotes the sentence where the docs mark a feature as beta, research preview or experimental. A dash means the docs carry no label.
- **Who gets it** comes from [Feature availability](https://code.claude.com/docs/en/feature-availability), or from the feature's own page where that page has no row. "Every provider" means a Claude subscription, the Claude Console, Claude Platform on AWS, Amazon Bedrock, Google Cloud's Agent Platform and Microsoft Foundry alike: the CLI and everything that runs locally work on all of them.
- The guide carries no prices or usage limits; see [claude.com/pricing](https://claude.com/pricing).

## Where you run it

| Feature | Label | Who gets it |
|---|---|---|
| [Terminal](https://code.claude.com/docs/en/quickstart); taught in [Install, sign in and look around](../beginner/01-install-and-look-around.md) | – | Every provider |
| [VS Code](https://code.claude.com/docs/en/vs-code); taught in [IDE extensions](../beginner/electives/ide-extensions.md) | – | Every provider |
| [JetBrains IDEs](https://code.claude.com/docs/en/jetbrains); taught in [IDE extensions](../beginner/electives/ide-extensions.md) | The page has no label sentence, but its settings path reads "Claude Code [Beta]" | Every provider |
| [Desktop app](https://code.claude.com/docs/en/desktop) | On Linux: "Linux support for the Claude desktop app is in beta." ([Linux](https://code.claude.com/docs/en/desktop-linux)) | A Claude subscription; on Bedrock, Agent Platform and Foundry through Claude Desktop on those providers |
| [Cloud sessions on the web](https://code.claude.com/docs/en/claude-code-on-the-web) | – | Pro, Max and Team; Enterprise with a premium or Chat + Claude Code seat |
| [Mobile](https://code.claude.com/docs/en/mobile) | – | A Claude subscription |
| [Remote Control](https://code.claude.com/docs/en/remote-control) | – | Pro and Max; Team and Enterprise once an admin turns it on |
| [Claude Code in Slack](https://code.claude.com/docs/en/slack) | – | Pro, Max, Team or Enterprise with Claude Code access; on Team and Enterprise it is being retired in favor of Claude Tag |
| [Claude Tag](https://claude.com/docs/claude-tag/overview) | Marked "Public Beta" on its page | Team and Enterprise, on Anthropic's own service |
| [Claude in Chrome](https://code.claude.com/docs/en/chrome) | – | Pro, Max, Team or Enterprise |
| [Computer use](https://code.claude.com/docs/en/computer-use) | "Computer use is a research preview on macOS that requires a Pro or Max plan." | Pro and Max |
| [Dispatch](https://code.claude.com/docs/en/desktop#sessions-from-dispatch) | – | Pro and Max |
| [Voice dictation](https://code.claude.com/docs/en/voice-dictation) | – | A Claude subscription |

## In a session

| Feature | Label | Who gets it |
|---|---|---|
| [Plan mode](https://code.claude.com/docs/en/permission-modes); taught in [Permission modes and plan mode](../beginner/02-permission-modes-and-plan-mode.md) | – | Every provider |
| [Auto mode](https://code.claude.com/docs/en/permission-modes); taught in [Permission modes and plan mode](../beginner/02-permission-modes-and-plan-mode.md) | – | A Claude subscription, the Console and Claude Platform on AWS; on Bedrock, Agent Platform and Foundry with newer models only. Team and Enterprise admins can turn it off |
| [Checkpointing and rewind](https://code.claude.com/docs/en/checkpointing); taught in [Keep a session on track](../beginner/04-keep-a-session-on-track.md) | – | Every provider |
| [CLAUDE.md memory](https://code.claude.com/docs/en/memory); taught in [Project memory with CLAUDE.md](../beginner/05-project-memory.md) | – | Every provider |
| [Sandbox](https://code.claude.com/docs/en/sandboxing) | – | Every provider |
| [Output styles](https://code.claude.com/docs/en/output-styles); taught in [the built-in teachers](../beginner/electives/built-in-teachers.md) | – | Every provider |
| [Status line](https://code.claude.com/docs/en/statusline) | – | Every provider |
| [`/goal`](https://code.claude.com/docs/en/goal) | – | Every provider |
| [`/powerup`](https://code.claude.com/docs/en/commands); taught in [the built-in teachers](../beginner/electives/built-in-teachers.md) | – | The docs state no limit |
| [Fast mode](https://code.claude.com/docs/en/fast-mode) | "Fast mode is in research preview." | A Claude subscription, paid for with usage credits (an Owner turns it on for Team and Enterprise), and Console organizations with access provisioned; not Claude Platform on AWS, Bedrock, Agent Platform or Foundry |
| [Advisor](https://code.claude.com/docs/en/advisor) | "The advisor tool is experimental and requires the Anthropic API." | A Claude subscription and the Console |
| [Web search](https://code.claude.com/docs/en/tools-reference#websearch-tool-behavior) | – | A Claude subscription, the Console and Claude Platform on AWS; not Bedrock; limited on Agent Platform and Foundry |

## Extending Claude Code

| Feature | Label | Who gets it |
|---|---|---|
| [Skills](https://code.claude.com/docs/en/skills) | – | Every provider |
| [Hooks](https://code.claude.com/docs/en/hooks-guide) | – | Every provider |
| [Agent hooks](https://code.claude.com/docs/en/hooks-guide#agent-based-hooks) | "Agent hooks are experimental." | As for hooks |
| [Subagents](https://code.claude.com/docs/en/sub-agents) | – | Every provider |
| [MCP](https://code.claude.com/docs/en/mcp) | – | Every provider; claude.ai connectors only when you sign in with a Claude subscription |
| [Plugins and marketplaces](https://code.claude.com/docs/en/plugins/overview) | – | Every provider |
| [Channels](https://code.claude.com/docs/en/channels) | "Channels are in research preview." | A Claude subscription (Team and Enterprise once an admin turns them on) and the Console; not Claude Platform on AWS, Bedrock, Agent Platform or Foundry |
| [Dev containers](https://code.claude.com/docs/en/devcontainer) | – | Every provider |

## Parallel and unattended work

| Feature | Label | Who gets it |
|---|---|---|
| [Worktrees](https://code.claude.com/docs/en/worktrees) | – | Every provider |
| [Dynamic workflows](https://code.claude.com/docs/en/workflows) | – | Every provider; on Pro, turn them on in `/config` |
| [Agent view](https://code.claude.com/docs/en/agent-view) | "Agent view is in research preview." | Every provider |
| [Agent teams](https://code.claude.com/docs/en/agent-teams) | "Agent teams are experimental and disabled by default." | Every provider |
| [Cross-session messaging](https://code.claude.com/docs/en/cross-session-messaging) | – | A Claude subscription; elsewhere between sessions on the same machine only |
| [Projects](https://code.claude.com/docs/en/claude-projects) | "Projects are in public beta on Pro and Max plans and rolling out gradually …" | Pro and Max; not yet Team or Enterprise |
| [`/loop` and scheduled prompts](https://code.claude.com/docs/en/scheduled-tasks) | – | Every provider |
| [Routines](https://code.claude.com/docs/en/routines) | "Routines are in research preview." | Pro, Max, Team and Enterprise |
| [Running Claude Code from scripts](https://code.claude.com/docs/en/headless) | – | Every provider |
| [GitHub Actions](https://code.claude.com/docs/en/github-actions) | – | A Claude subscription, the Console, Bedrock, Agent Platform and Foundry; not Claude Platform on AWS |
| [GitLab CI/CD](https://code.claude.com/docs/en/gitlab-ci-cd) | "Claude Code for GitLab CI/CD is currently in beta." | Every provider except Microsoft Foundry |

## Review and security

| Feature | Label | Who gets it |
|---|---|---|
| [Code Review](https://code.claude.com/docs/en/code-review) | "Code Review is in research preview, available for Team and Enterprise subscriptions." | Team and Enterprise |
| [Ultrareview](https://code.claude.com/docs/en/ultrareview) | "Ultrareview is a research preview feature." | A Claude subscription |
| [Security guidance plugin](https://code.claude.com/docs/en/security-guidance) | – | All plans; it needs Python 3.7 or later, and 3.10 or later for the agentic commit review and, on a third-party provider, for every model-backed review |
| [Claude Security](https://code.claude.com/docs/en/claude-security) | – | A paid plan, Anthropic API access or a third-party provider |

## Other

| Feature | Label | Who gets it |
|---|---|---|
| [Artifacts](https://code.claude.com/docs/en/artifacts) | – | Pro, Max, Team and Enterprise, on the Anthropic API |
| [`/design` and `/slides` templates](https://code.claude.com/docs/en/artifacts#start-from-a-slides-design-or-docs-template) | "Templates are in beta." | On by default on Pro, Max and Team; on Enterprise an Owner turns each template on |

---

<sub>Sources: [Feature availability](https://code.claude.com/docs/en/feature-availability) and each feature's linked page, checked on 2026-10-05.</sub>

<sub>Up: [Reference](README.md)</sub>
