# Team marketplace for Advanced lesson 6

`team-tools`, a demo team marketplace for the Advanced lesson "Share your setup with a team". It lists one plugin, `team-kit`, made of a skill, `onboard`, that tells Claude to read files only, and a read-only subagent, `config-reviewer`. Committed to your repository with the settings below, it loads for each teammate who clones the repository and trusts the folder, with no install command ([Manage Claude Code plugins for your organization](https://code.claude.com/docs/en/plugins/org#require-plugins-per-repository)).

## Copy it

From your repository's root, copy this folder as `team-marketplace/`, then give the marketplace file its real folder name. Claude Code reads a marketplace from `.claude-plugin/marketplace.json` ([Create a marketplace](https://code.claude.com/docs/en/plugins/create-marketplace)); this guide ships the file in `dot-claude-plugin/`, so neither this folder nor the guide's repository can be added as a marketplace by its folder path or as `owner/repo`.

```bash
cp -R <path-to-this-folder> team-marketplace
mv team-marketplace/dot-claude-plugin team-marketplace/.claude-plugin
```

Register only your copy as a marketplace: never this folder, the path to its `dot-claude-plugin/marketplace.json`, the guide's repository or a raw file URL from it.

## Validate it

```bash
claude plugin validate ./team-marketplace
claude plugin validate ./team-marketplace/plugins/team-kit --strict
```

The first run checks the marketplace file and its entries. The second checks the plugin's manifest and opens its skill and agent files, which a marketplace run doesn't; `--strict` fails on warnings too ([Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference#validate-a-directory)). Each run ends with `Validation passed` and exits 0.

## Share it with the team

Merge `settings.snippet.json` into your repository's `.claude/settings.json`, beside the keys already there. If the file already has a `permissions` deny list, add the rule to it instead of replacing it. Write the marketplace path relative to the repository root, as here:

```json
"permissions": { "deny": ["Read(.env)"] },
"extraKnownMarketplaces": {
  "team-tools": { "source": { "source": "directory", "path": "./team-marketplace" } }
},
"enabledPlugins": { "team-kit@team-tools": true }
```

Then commit `team-marketplace/` and `.claude/settings.json`.

`settings.snippet.json`:
- **What:** declares the `team-tools` marketplace by a relative `directory` path and turns on `team-kit@team-tools`, plus a `Read(.env)` deny rule. A relative path resolves against the repository's main checkout, so each clone finds its own copy and its worktrees share it ([Manage Claude Code plugins for your organization](https://code.claude.com/docs/en/plugins/org#require-plugins-per-repository)).
- **When:** Claude Code registers the marketplace only after a teammate accepts the workspace trust dialog for the folder; in a folder they haven't trusted, including a `-p` run there, it ignores the entry without a message ([All settings](https://code.claude.com/docs/en/settings-reference#extraknownmarketplaces)). A plugin the marketplace lists by a relative path then loads from the marketplace folder, with no install record ([Plugin loading reference](https://code.claude.com/docs/en/plugins/loading#enabled-in-project-settings-but-not-installed)).
- **Side effects:** none of its own; the plugin's are below.
- **Requires:** Claude Code, and this folder copied to `team-marketplace/` at the repository root. Platforms: any.
- **Remove:** see [Remove it](#remove-it).

`dot-claude-plugin/marketplace.json` and `plugins/team-kit/.claude-plugin/plugin.json`:
- **What:** a marketplace, `team-tools`, that lists `team-kit` by the relative path `./plugins/team-kit`, and the plugin's manifest, `team-kit` at version `0.1.0`. The entry name and the manifest name are the same, as the docs ask ([Create a marketplace](https://code.claude.com/docs/en/plugins/create-marketplace#keep-the-entry-name-and-the-manifest-name-the-same)).
- **When:** in a session where the plugin is enabled, `/team-kit:onboard` runs the skill ([Add components to a plugin](https://code.claude.com/docs/en/plugins/components#skills)), and `@agent-team-kit:config-reviewer` runs the subagent ([Create custom subagents](https://code.claude.com/docs/en/sub-agents#invoke-subagents-explicitly)). Claude can also use either one when your request matches its description.
- **Side effects:** none. The plugin has no hooks, monitors, MCP or LSP servers or `bin/` folder, so nothing in it runs code, and its skill pre-approves no tools with `allowed-tools`; its skill and subagent enter Claude's context as instructions ([Plugin security and trust](https://code.claude.com/docs/en/plugins/security#understand-what-a-plugin-can-do)). The subagent's only tools are Read, Grep and Glob. The skill and the subagent carry their own header blocks, as comments at the top of their frontmatter.
- **Requires:** Claude Code. Platforms: any; `test.sh` needs bash, jq and awk (macOS, Linux and WSL 2).
- **Remove:** see [Remove it](#remove-it).

To try the plugin yourself before you commit anything, load it for one session with `claude --plugin-dir ./team-marketplace/plugins/team-kit`; nothing is written to your settings for it ([Create a Claude Code plugin](https://code.claude.com/docs/en/plugins/create#develop-without-a-marketplace)).

> [!WARNING]
> A team plugin runs with each teammate's own rights. A plugin can execute arbitrary code on your machine with your user privileges, and its hooks and MCP servers run outside the sandbox ([Plugin security and trust](https://code.claude.com/docs/en/plugins/security)). This one carries neither, but anyone who can change `team-marketplace/` can add them, so review changes to that folder as you review code.

## Remove it

1. At the repository root, run `claude plugin marketplace remove team-tools --scope project`. It removes the marketplace from `.claude/settings.json`, and when no other settings scope declares it, Claude Code also deletes its cache and uninstalls any plugin you installed from it ([Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference#plugin-marketplace-remove)).
2. Delete the `team-kit@team-tools` entry under `enabledPlugins` in `.claude/settings.json` and the `team-marketplace/` folder, then commit.

To turn the plugin off for yourself alone, set `"team-kit@team-tools": false` in `.claude/settings.local.json` ([All settings](https://code.claude.com/docs/en/settings-reference#enabledplugins)).

Smoke test, without Claude: `bash test.sh`, from this folder or from your copy. It checks the files as shipped: once you add or move in your own components, or add a hook, MCP server or `bin/` folder, it may fail on purpose.

Tested in Claude Code v2.1.285 (stable) on macOS, 2026-10-09

Sources: [Manage Claude Code plugins for your organization](https://code.claude.com/docs/en/plugins/org), [Create a marketplace](https://code.claude.com/docs/en/plugins/create-marketplace), [Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference), [All settings](https://code.claude.com/docs/en/settings-reference), [Plugin loading reference](https://code.claude.com/docs/en/plugins/loading), [Add components to a plugin](https://code.claude.com/docs/en/plugins/components), [Create custom subagents](https://code.claude.com/docs/en/sub-agents), [Plugin security and trust](https://code.claude.com/docs/en/plugins/security), [Create a Claude Code plugin](https://code.claude.com/docs/en/plugins/create)
