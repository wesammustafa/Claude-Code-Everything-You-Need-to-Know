# Install and manage plugins

<sub>**Intermediate** · Lesson 8 of 8 · about 25 minutes · Needs: [Turn a repeated workflow into a skill](01-first-skill.md), [Enforce a rule with a hook](05-hooks.md), [Delegate to a custom subagent](06-subagents.md), [Connect a tool with MCP](07-mcp.md) · Verified against Claude Code v2.1.292 (stable) on 2026-10-21</sub>

## Goal

By the end of this lesson you can choose a plugin's scope, use a plugin workflow and code intelligence on your code, and disable or remove a plugin you no longer need.

## You need

- Your repository from [lesson 4](04-permissions-and-sandbox.md), with its `.claude/settings.json`, a working test command and no uncommitted changes. Choose a small code change you can verify. Run plugin and Git commands in a terminal in this repository; run the final check from your practice copy.
- A terminal session on your machine and a language with a [code intelligence plugin](https://code.claude.com/docs/en/plugins/code-intelligence). The JavaScript and TypeScript commands below also work for the practice repository; for another supported language, use its plugin and server from that page.
- Usage: light, plus downloading a plugin and its language server if you do not have them.

## The idea

A [plugin](https://code.claude.com/docs/en/plugins/overview) packages skills, agents, hooks, MCP servers or language servers. A marketplace is its catalog; `claude-plugins-official` is [Anthropic's official marketplace](https://code.claude.com/docs/en/plugins/anthropic-marketplaces). Review the components before installing.

The [install scope](https://code.claude.com/docs/en/plugins/install#choose-an-install-scope) decides who gets the enabled setting:

| Scope | Who gets it | Settings file |
|---|---|---|
| User | You, across projects | `~/.claude/settings.json` |
| Project | Your collaborators | `.claude/settings.json`, committed |
| Local | You, in this repository | `.claude/settings.local.json` |

A shared setting does not download the plugin to a teammate's machine. They install it too. A local trial lets you evaluate the result before proposing a team dependency.

[Code intelligence](https://code.claude.com/docs/en/plugins/code-intelligence#see-what-claude-gains) adds diagnostics and symbol navigation through a language server. Installing the plugin alone does not install that server. Confirm a real lookup, rather than treating an installed label as proof it works.

## Worked example

1. Start `claude` in your repository and stay in auto mode. Open the `commit-commands` plugin (Anthropic):

   ```text
   /plugin install commit-commands@claude-plugins-official
   ```

   Nothing installs until you review the details and choose a scope ([Install a plugin](https://code.claude.com/docs/en/plugins/install#install-a-plugin)). Read **Will install**, then choose **Install for you, in this repo only (local scope)**. Plugin commands have the plugin's prefix, such as `/commit-commands:commit`.
2. Add code intelligence for your language. For JavaScript or TypeScript, use `typescript-lsp` (Anthropic). Its [README](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/typescript-lsp) names the required language server. On 2026-10-21, that server's [own installation instructions](https://github.com/typescript-language-server/typescript-language-server#installing) use the following command (`typescript-language-server`, Community):

   ```bash
   npm install -g typescript-language-server typescript@6
   command -v typescript-language-server
   claude plugin install typescript-lsp@claude-plugins-official --scope local
   ```

   For another supported language, use the matching plugin and binary from the [official table](https://code.claude.com/docs/en/plugins/code-intelligence#install-a-code-intelligence-plugin). Exit the old Claude Code session with `/exit`, then start `claude` again from this repository. Shell-installed plugins load in a new session; `/reload-plugins` can apply them to an existing session ([Plugin commands](https://code.claude.com/docs/en/plugins/cli-reference)).

   Choose a function your planned change could affect. Replace the placeholders and ask:

   ```text
   Use the LSP tool to find the definition and references of <symbol> in <file>. Explain which caller my planned change could affect. Do not edit files yet.
   ```

   Inspect the `LSP` tool result and open a returned location. A text search alone does not demonstrate language-server navigation ([LSP tool behavior](https://code.claude.com/docs/en/tools-reference#lsp-tool-behavior)). If the server cannot start, open `/plugin` and check **Errors**, then verify the server binary is on the launching shell's `PATH`. Make the small intended change and run your tests. After a matching-file edit, the server can report diagnostics; inspect any reported issue rather than assuming the build is correct.
3. Review the complete diff, including unstaged files, and keep only the intended change in this commit. Run the plugin's commit workflow ([its command](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/commit-commands/commands/commit.md)):

   ```text
   /commit-commands:commit Commit only the reviewed change. Do not push. Do not add AI attribution or co-author trailers.
   ```

   Read `git show --stat HEAD` and the commit diff. Confirm it contains the tested change and no unrelated files. The plugin has now done repository work, rather than merely appearing in a list.
4. Manage the trial from a terminal in this repository ([Plugin commands](https://code.claude.com/docs/en/plugins/cli-reference)):

   ```bash
   claude plugin list
   claude plugin disable commit-commands@claude-plugins-official --scope local
   claude plugin uninstall commit-commands@claude-plugins-official --scope local
   ```

   `disable` turns the plugin off and keeps it installed; `uninstall` removes the installation. Leave the language plugin enabled for the rest of the lesson.

## Your turn

Choose what the team should share, rather than sharing every plugin from your trial. Use `claude-code-setup` (Anthropic) to identify and implement a useful improvement to this repository.

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
4. Exit the existing session with `/exit`, start `claude` in this repository, and request `Recommend Claude Code automations for this project.` The plugin's [read-only skill](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/claude-code-setup/README.md) recommends automations; it does not implement them. Look for its Skill tool call. If it did not load, invoke `/claude-code-setup:claude-automation-recommender` directly. Choose a recommendation that addresses a real gap rather than duplicating an existing skill or hook. Ask Claude to implement one small improvement using your existing tools, without adding another plugin or server. Test it, review the diff and commit it. Ask for a smaller proposal if the recommendations are too broad.
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
- [ ] Self-check (not tested): you verified an LSP definition or reference, inspected the plugin-created commit, and tested the improvement you chose from the recommendations.

Run `npm run check -- i-8 --dir <your repo>` from your practice copy, or `npm run check -- i-8` in the copy itself.

If the first item fails, check the name after `@`: it's the marketplace's name, `claude-plugins-official`, not its repository. If the second fails, install the project plugin in this repository and save the list again with `--json`.

## Watch out

- A plugin's hooks and servers can run with your user's rights. Read **Will install**, and keep the MCP configuration you reviewed in lesson 7 ([Plugin security and trust](https://code.claude.com/docs/en/plugins/security)).
- An installed language plugin can still lack a working server. Confirm the binary and an actual lookup before relying on its diagnostics.

Third-party: it can run code on your machine or give Claude new tools. Review it before installing; this guide does not audit it.

Listings checked against the listing bar on 2026-10-21.

## Go further

- [Anthropic's marketplaces](https://code.claude.com/docs/en/plugins/anthropic-marketplaces): where to browse the official catalog.
- [Code intelligence plugins](https://code.claude.com/docs/en/plugins/code-intelligence): language choices, server setup and troubleshooting.
- [Create a Claude Code plugin](https://code.claude.com/docs/en/plugins/create): package your own skills, hooks and subagents.

---

<sub>Sources: [Plugins overview](https://code.claude.com/docs/en/plugins/overview) · [Install and manage plugins](https://code.claude.com/docs/en/plugins/install) · [Anthropic's marketplaces](https://code.claude.com/docs/en/plugins/anthropic-marketplaces) · [Plugin loading reference](https://code.claude.com/docs/en/plugins/loading) · [Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference) · [Code intelligence plugins](https://code.claude.com/docs/en/plugins/code-intelligence) · [LSP tool behavior](https://code.claude.com/docs/en/tools-reference) · [Plugin security and trust](https://code.claude.com/docs/en/plugins/security) · [Commit workflow](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/commit-commands/commands/commit.md) · [TypeScript plugin README](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/typescript-lsp) · [Language server installation](https://github.com/typescript-language-server/typescript-language-server#installing) · [claude-code-setup README](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/claude-code-setup/README.md)</sub>

<sub>← [Connect a tool with MCP](07-mcp.md) · [Intermediate index](README.md) · [Intermediate capstone](capstone.md) → · Topic: [Plugins](../topics/plugins.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=i-8)</sub>
