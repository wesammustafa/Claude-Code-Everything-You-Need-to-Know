# Intermediate

<sub>**Intermediate** · about 4 hours · Verified against Claude Code v2.1.292 (stable) on 2026-10-15</sub>

One developer's setup. You shape Claude Code to your own project: skills, project memory, model and effort, permissions and the sandbox, hooks, subagents, MCP servers and plugins.

## You're ready for this level if you can

- [ ] Install Claude Code, start it safely in a repository, tell which model and account a session uses, and check its answers against the code.
- [ ] Choose a permission mode for a task, decide when a change needs a plan, and approve only a plan you would merge.
- [ ] Take one change from request to commit: explore, plan, implement, test, review the diff, correct, commit.
- [ ] Stop or rewind a wrong turn, and choose between clear, compact and resume.
- [ ] Create a short, true project CLAUDE.md and show that a new session follows it.

## Practice

Practice in your own repository: shaping Claude Code to your project is the point of this level. Run each check from your copy of the [practice template](https://github.com/wesammustafa/claude-code-practice) as `npm run check -- <lesson-id> --dir <your repo>`. If you'd rather not change your own repository, use the template copy itself; the capstone runs there.

To go step by step, run `npm run learn` in your copy and use Claude Code in a second terminal beside it. The app takes you through every lesson and the capstone, one step at a time, asks which folder you practice in, and checks your work as you go. Each page below teaches the same lesson on its own.

A copy you made for the Beginner level may not have the Intermediate checks or lessons: `npm run check` then lists no `i-` lessons. Bring them in from the template, in your copy:

```bash
git fetch https://github.com/wesammustafa/claude-code-practice main
git checkout FETCH_HEAD -- checks capstone learn
git commit -m "Add the Intermediate checks and lessons"
```

A copy older than the app has no `learn` script, so `npm run learn` says `Missing script: "learn"`: run `node learn/app.mjs` instead.

## When to use what

Seven of the ways to extend Claude Code, each with the sign that you need it; [Extend Claude Code](https://code.claude.com/docs/en/features-overview#build-your-setup-over-time) lists the rest. Each links its lesson.

- **Project memory:** Claude gets a convention or command wrong twice. Add it to `CLAUDE.md`, or to a rule in `.claude/rules/` scoped to the files it applies to ([How Claude remembers your project](https://code.claude.com/docs/en/memory); lesson: [Organize project memory and see what loaded](02-organize-memory.md)).
- **Skills:** you give Claude the same instructions or workflow again and again. A project skill lives in `.claude/skills/<name>/SKILL.md` ([Extend Claude with skills](https://code.claude.com/docs/en/skills); lesson: [Turn a repeated workflow into a skill](01-first-skill.md)).
- **Hooks:** something must happen every time at a set point in a session, such as before a tool runs, whatever Claude decides. Hooks are defined in a settings file such as `.claude/settings.json` ([Hooks](https://code.claude.com/docs/en/hooks); lesson: [Enforce a rule with a hook](05-hooks.md)).
- **Subagents:** a side task should run in its own context window and report back. A project subagent lives in `.claude/agents/` ([Create custom subagents](https://code.claude.com/docs/en/sub-agents); lesson: [Delegate to a custom subagent](06-subagents.md)).
- **Dynamic workflows:** the job needs more agents than one conversation can coordinate. A saved project workflow lives in `.claude/workflows/` ([Workflows](https://code.claude.com/docs/en/workflows); lesson: [Run and save a dynamic workflow](../advanced/03-dynamic-workflows.md)).
- **MCP servers:** Claude needs tools or data outside your files, such as a browser, a database or an API. A project-scope server is listed in `.mcp.json` at the project root ([Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp); lesson: [Connect a tool with MCP](07-mcp.md)).
- **Code intelligence:** Claude reads many files to find where a symbol is defined or used. A code intelligence plugin gives it a language server instead ([Code intelligence plugins](https://code.claude.com/docs/en/plugins/code-intelligence); lesson: [Install and manage plugins](08-plugins.md)).

Permissions decide what Claude may do in all of these, and the [sandbox](https://code.claude.com/docs/en/sandboxing) limits what its shell commands can reach ([Permissions, settings scopes and the sandbox](04-permissions-and-sandbox.md)). Model and effort tune any of them ([Pick the model and effort](03-model-and-effort.md)).

They combine: a [plugin](https://code.claude.com/docs/en/plugins) packages skills, agents, hooks and MCP servers so they install as one unit ([Install and manage plugins](08-plugins.md)).

## Lessons

1. [Turn a repeated workflow into a skill](01-first-skill.md)
2. [Organize project memory and see what loaded](02-organize-memory.md)
3. [Pick the model and effort](03-model-and-effort.md)
4. [Permissions, settings scopes and the sandbox](04-permissions-and-sandbox.md)
5. [Enforce a rule with a hook](05-hooks.md)
6. [Delegate to a custom subagent](06-subagents.md)
7. [Connect a tool with MCP](07-mcp.md)
8. [Install and manage plugins](08-plugins.md)

Each lesson takes 20 to 25 minutes.

## Capstone

[Get a repository ready for a new teammate](capstone.md): turn a team lead's brief into setup a teammate gets from git, choosing the mechanism for each need, then fix a real bug with it.

## By the end of this level you can

- [ ] Write a project skill that runs by name and loads on its own when it applies.
- [ ] Write a hook that enforces a rule, and show it firing.
- [ ] Delegate to a custom subagent with limited tools.
- [ ] Add an MCP server at project scope, and install a plugin from an Anthropic marketplace.
- [ ] Put permission rules in the right scope, turn on the sandbox, and pick the model and effort for a task.
- [ ] Organize project memory, and find out what loaded when an instruction isn't followed.

## Electives

Optional lessons beside the core path:

- [Skill patterns](electives/skill-patterns.md): live data, supporting files and a context of its own.
- [Claude in Chrome](electives/claude-in-chrome.md): verify UI changes in your own browser.
- [The status line](electives/status-line.md): show the model, the folder and the context in a bar of your own.
- [Fast mode](electives/fast-mode.md): faster Opus answers, paid for beyond your plan.

## Official companions

- [Claude Code in action](https://academy.claude.com/courses/claude-code-in-action): Claude Academy's course on running long, hands-off sessions you can trust.
- [Introduction to agent skills](https://academy.claude.com/courses/introduction-to-agent-skills) and [Introduction to subagents](https://academy.claude.com/courses/introduction-to-subagents): Claude Academy's courses on skills and subagents.

## Next level

[Advanced](../advanced/README.md): beyond one session.

---

<sub>Sources: [Extend Claude Code](https://code.claude.com/docs/en/features-overview) · [How Claude remembers your project](https://code.claude.com/docs/en/memory) · [Extend Claude with skills](https://code.claude.com/docs/en/skills) · [Hooks](https://code.claude.com/docs/en/hooks) · [Create custom subagents](https://code.claude.com/docs/en/sub-agents) · [Workflows](https://code.claude.com/docs/en/workflows) · [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp) · [Plugins](https://code.claude.com/docs/en/plugins) · [Code intelligence plugins](https://code.claude.com/docs/en/plugins/code-intelligence) · [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing) · [Claude Code in action](https://academy.claude.com/courses/claude-code-in-action) · [Introduction to agent skills](https://academy.claude.com/courses/introduction-to-agent-skills) · [Introduction to subagents](https://academy.claude.com/courses/introduction-to-subagents)</sub>

<sub>Up: [Claude Code: Everything You Need to Know](../../README.md#pick-your-level)</sub>
