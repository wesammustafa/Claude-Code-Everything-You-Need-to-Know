# Intermediate

<sub>**Intermediate** · about 3 hours · Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

One developer's setup. You shape Claude Code to your own project: skills, project memory, model and effort, permissions and the sandbox, hooks, subagents, MCP servers and plugins.

## You're ready for this level if you can

- [ ] Install Claude Code, sign in, start it in your repository, and tell which version, model and account you're on.
- [ ] Choose and switch permission modes, and approve a plan in plan mode before any change.
- [ ] Take one change from request to commit: explore, plan, implement, test, review the diff, correct, commit.
- [ ] Keep a session on track with context, clear, compact, rewind and resume.
- [ ] Create a project CLAUDE.md and show that a new session follows it.

## Practice

Practice in your own repository: shaping Claude Code to your project is the point of this level. Run each check from your copy of the [practice template](https://github.com/wesammustafa/claude-code-practice) as `npm run check -- <lesson-id> --dir <your repo>`. If you'd rather not change your own repository, use the template copy itself; the capstone runs there.

## When to use what

Five of the ways to extend Claude Code; [Extend Claude Code](https://code.claude.com/docs/en/features-overview) lists the rest. Until this level's lessons land, each links the previous edition's page as well, which is not yet re-verified.

- **Skills:** you give Claude the same instructions or workflow again and again. A project skill lives in `.claude/skills/<name>/SKILL.md` ([Extend Claude with skills](https://code.claude.com/docs/en/skills); previous edition: [Skills](../legacy/skills.md)).
- **Hooks:** something must happen every time at a set point in a session, such as before a tool runs, whatever Claude decides. Hooks are defined in a settings file such as `.claude/settings.json` ([Hooks](https://code.claude.com/docs/en/hooks); previous edition: [Hooks](../legacy/hooks.md)).
- **Subagents:** a side task should run in its own context window and report back. A project subagent lives in `.claude/agents/` ([Create custom subagents](https://code.claude.com/docs/en/sub-agents); previous edition: [Subagents and parallel work](../legacy/subagents-and-parallel-work.md)).
- **Dynamic workflows:** the job needs more agents than one conversation can coordinate. A saved project workflow lives in `.claude/workflows/` ([Workflows](https://code.claude.com/docs/en/workflows); previous edition: [Dynamic workflows](../workflows.md)).
- **MCP servers:** Claude needs tools or data outside your files, such as a browser, a database or an API. A project-scope server is listed in `.mcp.json` at the project root ([Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp); previous edition: [MCP](../legacy/mcp.md)).

They combine: a [plugin](https://code.claude.com/docs/en/plugins) packages skills, agents, hooks and MCP servers so they install as one unit.

## Lessons

1. Turn a repeated workflow into a skill
2. Organize project memory and see what loaded
3. Pick the model and effort
4. Permissions, settings scopes and the sandbox
5. Enforce a rule with a hook
6. Delegate to a custom subagent
7. Connect a tool with MCP
8. Install and manage plugins

Each lesson takes 10 to 20 minutes. Lessons are linked here as they are published.

## Capstone

Shape the practice template for a teammate: a skill, a hook that protects a folder, a read-only reviewer subagent, a project-scope MCP server and an official plugin, with project settings that keep secrets out of reach and turn the sandbox on.

## By the end of this level you can

- [ ] Write a project skill that runs by name and loads on its own when it applies.
- [ ] Write a hook that enforces a rule, and show it firing.
- [ ] Delegate to a custom subagent with limited tools.
- [ ] Add an MCP server at project scope, and install a plugin from an Anthropic marketplace.
- [ ] Put permission rules in the right scope, turn on the sandbox, and pick the model and effort for a task.
- [ ] Organize project memory, and find out what loaded when an instruction isn't followed.

## Electives

Optional lessons beside the core path:

- Skill patterns
- Claude in Chrome
- The status line
- Fast mode

## Official companions

- [Claude Code in action](https://academy.claude.com/courses/claude-code-in-action): Claude Academy's course on running long, hands-off sessions you can trust.
- [Introduction to agent skills](https://academy.claude.com/courses/introduction-to-agent-skills) and [Introduction to subagents](https://academy.claude.com/courses/introduction-to-subagents): Claude Academy's courses on skills and subagents.

## Next level

[Advanced](../advanced/README.md): beyond one session.

---

<sub>Sources: [Extend Claude Code](https://code.claude.com/docs/en/features-overview) · [Extend Claude with skills](https://code.claude.com/docs/en/skills) · [Hooks](https://code.claude.com/docs/en/hooks) · [Create custom subagents](https://code.claude.com/docs/en/sub-agents) · [Workflows](https://code.claude.com/docs/en/workflows) · [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp) · [Plugins](https://code.claude.com/docs/en/plugins) · [Claude Code in action](https://academy.claude.com/courses/claude-code-in-action) · [Introduction to agent skills](https://academy.claude.com/courses/introduction-to-agent-skills) · [Introduction to subagents](https://academy.claude.com/courses/introduction-to-subagents)</sub>

<sub>Up: [Claude Code: Everything You Need to Know](../../README.md#pick-your-level)</sub>
