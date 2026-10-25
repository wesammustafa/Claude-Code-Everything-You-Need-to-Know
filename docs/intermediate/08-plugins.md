# Install and manage plugins

<sub>**Intermediate** · Lesson 8 of 8 · about 25 minutes · Needs: [Turn a repeated workflow into a skill](01-first-skill.md), [Enforce a rule with a hook](05-hooks.md), [Delegate to a custom subagent](06-subagents.md), [Connect a tool with MCP](07-mcp.md) · Verified against Claude Code v2.1.308 (stable) on 2026-10-25</sub>

## Goal

By the end of this lesson you can judge a plugin before you install it, trial code intelligence locally on your own code, and share only the plugin your team chose.

## You need

- Your repository from [lesson 4](04-permissions-and-sandbox.md), with its `.claude/settings.json`, a working test command and no uncommitted changes. Choose a small code change you can verify. Run plugin and Git commands in a terminal in this repository; run the final check from your practice copy.
- A terminal session on your machine and a language with a [code intelligence plugin](https://code.claude.com/docs/en/plugins/code-intelligence). The JavaScript and TypeScript commands below also work for the practice repository; for another supported language, use its plugin and server from that page.
- Usage: light, plus downloading a plugin and its language server if you do not have them.

## The idea

A [plugin](https://code.claude.com/docs/en/plugins/overview) packages skills, agents, hooks, MCP servers or language servers. A marketplace is its catalog. `claude-plugins-official` is [Anthropic's official marketplace](https://code.claude.com/docs/en/plugins/anthropic-marketplaces), but most of what it lists comes from partners and other authors, and a marketplace's name tells you who publishes the catalog, not what each plugin does ([Plugin security and trust](https://code.claude.com/docs/en/plugins/security)). Review the components before installing.

The [install scope](https://code.claude.com/docs/en/plugins/install#choose-an-install-scope) decides who gets the enabled setting:

| Scope | Who gets it | Settings file |
|---|---|---|
| User | You, across projects | `~/.claude/settings.json` |
| Project | Your collaborators | `.claude/settings.json`, committed |
| Local | You, in this repository | `.claude/settings.local.json` |

A shared setting does not download the plugin to a teammate's machine. They install it too. A local trial lets you evaluate the result before proposing a team dependency.

[Code intelligence](https://code.claude.com/docs/en/plugins/code-intelligence#see-what-claude-gains) adds diagnostics and symbol navigation through a language server. Installing the plugin alone does not install that server. Confirm a real lookup, rather than treating an installed label as proof it works.

## Worked example

1. Install the language server first: a code intelligence plugin says which command starts it, but doesn't include it ([Install a code intelligence plugin](https://code.claude.com/docs/en/plugins/code-intelligence#install-a-code-intelligence-plugin)). For JavaScript or TypeScript, the plugin is `typescript-lsp` (Anthropic), and its [README](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/typescript-lsp) names the binary. On 2026-10-21, that server's [own installation instructions](https://github.com/typescript-language-server/typescript-language-server#installing) use the following command (`typescript-language-server`, Community). In a terminal in your repository:

   ```bash
   npm install -g typescript-language-server typescript@6
   command -v typescript-language-server
   ```

   For another supported language, use the matching plugin and binary from that page's table.
2. Start `claude` in your repository and stay in auto mode. Open the plugin:

   ```text
   /plugin install typescript-lsp@claude-plugins-official
   ```

   If Claude Code says `Marketplace "claude-plugins-official" not found`, the official marketplace isn't registered on this machine yet, for example because you've only used Claude Code in VS Code. Add it with `/plugin marketplace add anthropics/claude-plugins-official`, then open the plugin again ([Marketplace not found](https://code.claude.com/docs/en/plugins/troubleshooting#marketplace-claude-plugins-official-not-found)). Nothing installs until you review the details and choose a scope ([Install a plugin](https://code.claude.com/docs/en/plugins/install#install-a-plugin)). Read **Will install**, and **Context cost**, its token estimates for every turn and for when its skills and agents load. Then choose **Install for you, in this repo only (local scope)**. A confirmation says whether the plugin is active now or needs `/reload-plugins`.
3. Confirm the server starts: it starts the first time Claude edits a file the plugin handles. Ask Claude to introduce a type error or a syntax error in one of your source files and then fix it, and look for a `Found N new diagnostic issues` line after the edit ([Install a code intelligence plugin](https://code.claude.com/docs/en/plugins/code-intelligence#install-a-code-intelligence-plugin)). If none appears, open `/plugin` and check **Errors**, then verify the server binary is on the launching shell's `PATH`.

   Decide the small change you'll make, and choose a function it could affect. Replace the placeholders and ask:

   ```text
   Use the LSP tool to find the definition and references of <symbol> in <file>. I plan to <change>. Explain which callers that change could affect. Do not edit files yet.
   ```

   Inspect the `LSP` tool result and open a returned location. A text search alone does not demonstrate language-server navigation ([LSP tool behavior](https://code.claude.com/docs/en/tools-reference#lsp-tool-behavior)). Make the small intended change, run your tests, review the diff and commit it.

## Your turn

Share only the plugin the team chose, so nobody pulls in the trial you're still judging. Use `claude-code-setup` (Anthropic) to find a gap in this repository's setup.

1. Merge this block into `.claude/settings.json`, preserving the earlier settings, and replace the `TODO` with the plugin's full name, `<plugin>@<marketplace>` ([Project plugin settings](https://code.claude.com/docs/en/plugins/loading#enabled-in-project-settings-but-not-installed)):

   ```json
   "enabledPlugins": {
     "TODO: claude-code-setup at the official marketplace": true
   }
   ```

2. Review and commit `.claude/settings.json`. Keep your personal language-plugin trial out of the shared settings until the team chooses it.
3. Install the project plugin as a teammate would after pulling that commit:

   ```bash
   claude plugin install claude-code-setup@claude-plugins-official --scope project
   ```

   Review `git status`: if installation reformatted `.claude/settings.json`, review and commit that change too.
4. Exit the existing session with `/exit`, start `claude` in this repository, and request `Recommend Claude Code automations for this project.` The plugin's [read-only skill](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/claude-code-setup/README.md) recommends automations; it does not implement them. Look for its Skill tool call. If it did not load, invoke `/claude-code-setup:claude-automation-recommender` directly. Choose one recommendation that fills a real gap, rather than duplicating an existing skill or hook, and note why. Implementing it is optional.
5. Save a machine-readable install list from this repository's root ([JSON list output](https://code.claude.com/docs/en/plugins/cli-reference#plugin-list)):

   ```bash
   mkdir -p .practice
   claude plugin list --json > .practice/i-8-plugins.json
   ```

   The `--json` flag matters: the human-readable list is not JSON.

## Check

You are done when all of these are true:

- [ ] The committed settings turn the plugin on for the project: `git show HEAD:.claude/settings.json | jq .enabledPlugins` shows `"claude-code-setup@claude-plugins-official": true`.
- [ ] It's installed at project scope and enabled: `jq '.[] | select(.id == "claude-code-setup@claude-plugins-official") | {scope, enabled, projectEnabled}' .practice/i-8-plugins.json` shows `"project"`, `true` and `true`.
- [ ] Your code intelligence trial is installed at local scope and stays out of the committed settings: `jq '.[] | select(.scope == "local") | .id' .practice/i-8-plugins.json` shows your `-lsp` plugin.
- [ ] Self-check (not tested): you verified an LSP definition or reference, and chose a recommendation that fills a real gap.

Run `npm run check -- i-8 --dir <your repo>` from your practice copy, or `npm run check -- i-8` in the copy itself.

If the first item fails, check the name after `@`: it's the marketplace's name, `claude-plugins-official`, not its repository. If the second fails, install the project plugin in this repository and save the list again with `--json`. If the trial item fails, install your language's plugin with local scope, keep it out of `enabledPlugins` in `.claude/settings.json`, and save the list again.

## Watch out

- A plugin's hooks and servers can run with your user's rights. Read **Will install**, and keep the MCP configuration you reviewed in lesson 7. With auto-update on for its marketplace, a plugin's files can change after you reviewed them ([Plugin security and trust](https://code.claude.com/docs/en/plugins/security)).
- An installed language plugin can still lack a working server. Confirm the binary and an actual lookup before relying on its diagnostics.

Third-party: it can run code on your machine or give Claude new tools. Review it before installing; this guide does not audit it.

Listings checked against the listing bar on 2026-10-21.

## Go further

- [Anthropic's marketplaces](https://code.claude.com/docs/en/plugins/anthropic-marketplaces): where to browse the official catalog.
- [Code intelligence plugins](https://code.claude.com/docs/en/plugins/code-intelligence): language choices, server setup and troubleshooting.
- [Create a Claude Code plugin](https://code.claude.com/docs/en/plugins/create): package your own skills, hooks and subagents.

---

<sub>Sources: [Plugins overview](https://code.claude.com/docs/en/plugins/overview) · [Install and manage plugins](https://code.claude.com/docs/en/plugins/install) · [Anthropic's marketplaces](https://code.claude.com/docs/en/plugins/anthropic-marketplaces) · [Plugin loading reference](https://code.claude.com/docs/en/plugins/loading) · [Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference) · [Code intelligence plugins](https://code.claude.com/docs/en/plugins/code-intelligence) · [Troubleshoot plugins](https://code.claude.com/docs/en/plugins/troubleshooting) · [LSP tool behavior](https://code.claude.com/docs/en/tools-reference) · [Plugin security and trust](https://code.claude.com/docs/en/plugins/security) · [TypeScript plugin README](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/typescript-lsp) · [Language server installation](https://github.com/typescript-language-server/typescript-language-server#installing) · [claude-code-setup README](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/claude-code-setup/README.md)</sub>

<sub>← [Connect a tool with MCP](07-mcp.md) · [Intermediate index](README.md) · [Intermediate capstone](capstone.md) → · Topic: [Plugins](../topics/plugins.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=i-8)</sub>
