# Install and manage plugins

<sub>**Intermediate** · Lesson 8 of 8 · about 20 minutes · Needs: [Turn a repeated workflow into a skill](01-first-skill.md), [Enforce a rule with a hook](05-hooks.md), [Delegate to a custom subagent](06-subagents.md), [Connect a tool with MCP](07-mcp.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-06</sub>

## Goal

By the end of this lesson you can install a plugin from one of Anthropic's marketplaces at the scope that fits, see what it adds, and turn it off, update it or remove it.

## You need

- The repository from [lesson 4](04-permissions-and-sandbox.md), with its `.claude/settings.json`, and your copy of the practice template with Node.js LTS: the check runs from the copy.
- Usage: light.

## The idea

A [plugin](https://code.claude.com/docs/en/plugins/overview) packages the pieces of the last lessons, skills, subagents, hooks and MCP servers, so they install as one unit from a marketplace. Anthropic publishes three general-purpose marketplaces ([Anthropic's marketplaces](https://code.claude.com/docs/en/plugins/anthropic-marketplaces)):

- `claude-plugins-official`, which Claude Code adds for you the first time you start an interactive session;
- `claude-community`, third-party plugins their authors submitted to Anthropic;
- `claude-code-plugins`, a demo set.

You install a plugin as `<plugin>@<marketplace>`, at a scope that decides which settings file turns it on ([Choose an install scope](https://code.claude.com/docs/en/plugins/install#choose-an-install-scope)):

| Scope | Who gets it | `enabledPlugins` entry in |
|---|---|---|
| User | You, in every project | `~/.claude/settings.json` |
| Project | Everyone who works in the repository | `.claude/settings.json`, committed |
| Local | You, in this repository | `.claude/settings.local.json` |

Committing a project-scope entry turns the plugin on for your collaborators, but it may not be installed on their machines yet, so each of them runs `claude plugin install <plugin>@<marketplace> --scope project` once. An enabled plugin is part of every session: its skill descriptions sit in Claude's context, and its hooks and MCP servers run, as you.

## Worked example

1. In a session in your repository, open the official marketplace's `commit-commands` plugin (Anthropic):

   ```text
   /plugin install commit-commands@claude-plugins-official
   ```

   Nothing installs yet. The panel shows the plugin's description and, under **Will install**, the commands it adds. Read it before you choose.
2. Choose **Install for you, in this repo only (local scope)**. The install summary ends with `Plugin is now active.`
3. Type `/commit-commands:`. The plugin's commands are listed under its name, such as `/commit-commands:commit`.
4. Manage it from your shell ([Manage plugins from your shell](https://code.claude.com/docs/en/plugins/install#manage-plugins-from-your-shell)):

   ```bash
   claude plugin list
   claude plugin disable commit-commands@claude-plugins-official
   claude plugin uninstall commit-commands@claude-plugins-official --scope local
   ```

   `claude plugin list` shows the plugin's version, `Scope: local` and its status. `disable` turns it off and keeps it installed; `uninstall` removes it.

## Your turn

Turn on the `claude-code-setup` plugin (Anthropic) for everyone who works in your repository, then install it the way a teammate would.

1. Add this block to `.claude/settings.json`, beside the keys from earlier lessons, and replace the `TODO` with the plugin's full name, `<plugin>@<marketplace>`:

   ```json
   "enabledPlugins": {
     "TODO: claude-code-setup at the official marketplace": true
   }
   ```

2. Commit `.claude/settings.json`.
3. Install it as a teammate would after pulling your commit:

   ```bash
   claude plugin install claude-code-setup@claude-plugins-official --scope project
   ```

   It prints `Successfully installed plugin: claude-code-setup@claude-plugins-official (scope: project)`. Run `git status`: if the install changed `.claude/settings.json`, commit that change too.
4. Start `claude` and ask `Recommend Claude Code automations for this project.` Claude uses the plugin's read-only skill ([its README](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/claude-code-setup/README.md)) and suggests hooks, skills, subagents and MCP servers. Your wording will differ.
5. Save the plugin list for the check, in the repository's root: `claude plugin list --json > .practice/i-8-plugins.json`.

## Check

You are done when all of these are true:

- [ ] The committed settings turn the plugin on for the project: `git show HEAD:.claude/settings.json | jq .enabledPlugins` shows `"claude-code-setup@claude-plugins-official": true`.
- [ ] It's installed at project scope and enabled: `jq '.[] | select(.id == "claude-code-setup@claude-plugins-official") | {scope, enabled, projectEnabled}' .practice/i-8-plugins.json` shows `"project"`, `true` and `true`.
- [ ] Self-check (not tested): you can say what `disable` keeps that `uninstall` removes, and why a teammate may still need `claude plugin install` after pulling the settings.

Run `npm run check -- i-8 --dir <your repo>` from your practice copy, or `npm run check -- i-8` in the copy itself.

If the first item fails, check the name after `@`: it's the marketplace's name, `claude-plugins-official`, not its repository. If the second fails, run the install command in the repository itself, then save the list again from there.

## Watch out

- A plugin's hooks and MCP servers run with your user's rights, and Anthropic doesn't review third-party marketplaces. Read the **Will install** list first ([Plugin security and trust](https://code.claude.com/docs/en/plugins/security)).
- The official marketplace also lists a `chrome-devtools-mcp` plugin (Vendor: Google), pinned to a commit of the server's repository ([its catalog](https://github.com/anthropics/claude-plugins-official/blob/main/.claude-plugin/marketplace.json)). On 2026-10-06, [its manifest](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/1cec9cd1a3bbf1895c98fa4b4e0e2da5a36e4075/.claude-plugin/plugin.json) started the server from [lesson 7](07-mcp.md), at an earlier version and without that lesson's flags, so its usage statistics, CrUX lookups and update checks keep their defaults, which are on ([upstream README](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/chrome-devtools-mcp-v1.10.1/README.md)). Keep lesson 7's `.mcp.json` instead.
- Plugins from `claude-plugins-official` update on their own; a running session keeps the version it loaded until `/reload-plugins` or the next session. Plugins from the community marketplace don't, unless you turn auto-update on for it ([Keep plugins updated](https://code.claude.com/docs/en/plugins/install#keep-plugins-updated)).

Third-party: it can run code on your machine or give Claude new tools. Review it before installing; this guide does not audit it.

Listings checked against the listing bar on 2026-10-06.

## Go further

- [Anthropic's marketplaces](https://code.claude.com/docs/en/plugins/anthropic-marketplaces): the three marketplaces, and where to browse the official one. This is where to look for more plugins.
- [Plugins overview](https://code.claude.com/docs/en/plugins/overview): what a plugin can hold, and what an enabled one costs each session.
- [Create a Claude Code plugin](https://code.claude.com/docs/en/plugins/create): package your own skills, hooks and subagents.

---

<sub>Sources: [Plugins overview](https://code.claude.com/docs/en/plugins/overview) · [Install and manage plugins](https://code.claude.com/docs/en/plugins/install) · [Anthropic's marketplaces](https://code.claude.com/docs/en/plugins/anthropic-marketplaces) · [Plugin security and trust](https://code.claude.com/docs/en/plugins/security) · [claude-code-setup README](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/claude-code-setup/README.md) · [Official marketplace catalog](https://github.com/anthropics/claude-plugins-official/blob/main/.claude-plugin/marketplace.json) · [chrome-devtools-mcp plugin manifest](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/1cec9cd1a3bbf1895c98fa4b4e0e2da5a36e4075/.claude-plugin/plugin.json) · [Chrome DevTools MCP README](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/chrome-devtools-mcp-v1.10.1/README.md)</sub>

<sub>← [Connect a tool with MCP](07-mcp.md) · [Intermediate index](README.md) · [Intermediate capstone](capstone.md) → · Topic: [Plugins](../topics/plugins.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=i-8)</sub>
