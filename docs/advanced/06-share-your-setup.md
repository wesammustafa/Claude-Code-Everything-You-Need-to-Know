# Share your setup with a team

<sub>**Advanced** · Lesson 6 of 7 · about 20 minutes · Needs: [GitHub Actions](05-github-actions.md) · Verified against Claude Code v2.1.308 (stable) on 2026-10-25</sub>

## Goal

By the end of this lesson you can share your Claude Code setup with a team: commit the settings everyone should get, keep your personal files out of git, and give the team a plugin that loads from a marketplace inside the repository.

## You need

- Your own repository with your Intermediate setup: the committed `.claude/settings.json` from [Intermediate lesson 4](../intermediate/04-permissions-and-sandbox.md), and the skills, hooks and subagents from lessons 1, 5 and 6. Set up its `.practice/` folder as the [Intermediate index](../intermediate/README.md#prepare-your-own-repository) describes, if you haven't yet.
- Your copy of the practice template with Node.js LTS and the Advanced checks ([Practice](README.md#practice)): the check runs from the copy.
- bash, `curl` and git, on macOS, Linux or WSL 2.
- Usage: light.

## The idea

What everyone should get is committed: `.claude/settings.json`, `CLAUDE.md`, `.claude/rules/`, skills, agents and `.mcp.json` ([Explore the .claude directory](https://code.claude.com/docs/en/claude-directory#file-reference)). What is yours stays out of git: `.claude/settings.local.json` and `CLAUDE.local.md` ([Choose the right file](https://code.claude.com/docs/en/claude-directory#choose-the-right-file), [What's not shown](https://code.claude.com/docs/en/claude-directory#what%E2%80%99s-not-shown)). Your local file outranks the shared one, so a teammate can override a team setting for themselves without a commit, though lists such as permission rules merge instead ([Settings files and precedence](https://code.claude.com/docs/en/settings#settings-precedence)).

A committed `.claude/` folder already shares skills, agents and hooks with everyone who clones this one repository. The docs say to keep that standalone setup while it serves one project, and to make a plugin when you want to share the setup with teammates, install it in several projects, or publish versioned releases ([Create a Claude Code plugin](https://code.claude.com/docs/en/plugins/create#decide-when-to-use-a-plugin)). Inside one repository, a plugin can live in `.claude/skills/<name>/` ([Share the plugin through a repository](https://code.claude.com/docs/en/plugins/create#load-a-plugin-for-everyone-in-one-repository)) or in a marketplace folder. This lesson uses a marketplace: when a second repository needs the kit, you move that folder to its own repository and keep the same plugin (Go further).

A plugin shares skills, agents and hooks as one unit, and a marketplace is a folder whose `.claude-plugin/marketplace.json` lists plugins ([Create a marketplace](https://code.claude.com/docs/en/plugins/create-marketplace)). Commit a marketplace inside the repository, declare it in `extraKnownMarketplaces` by a relative `directory` path, and turn its plugin on in `enabledPlugins`. Each teammate gets the plugin once they accept the workspace trust dialog for the folder ([Manage Claude Code plugins for your organization](https://code.claude.com/docs/en/plugins/org#require-plugins-per-repository)), and installs nothing: a plugin listed by a relative path loads from the marketplace itself ([Plugin loading reference](https://code.claude.com/docs/en/plugins/loading#enabled-in-project-settings-but-not-installed)).

## Worked example

Your teammates keep asking how the repository's Claude Code setup works. Share a skill that explains it with everyone who clones the repository.

1. At your repository's root, download this guide's [example marketplace](../../examples/advanced/06-share-your-setup/README.md) into `team-marketplace/`. Read each file before you commit it:

   ```bash
   base=https://raw.githubusercontent.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/main/examples/advanced/06-share-your-setup
   curl -fsSL --create-dirs "$base/dot-claude-plugin/marketplace.json" -o team-marketplace/.claude-plugin/marketplace.json
   for f in plugins/team-kit/.claude-plugin/plugin.json plugins/team-kit/skills/onboard/SKILL.md plugins/team-kit/agents/config-reviewer.md; do
     curl -fsSL --create-dirs "$base/$f" -o "team-marketplace/$f"
   done
   ```

   The marketplace, `team-tools`, lists one plugin, `team-kit`, by the relative path `./plugins/team-kit`. The plugin holds a skill, `onboard`, that tells Claude to explain the repository's shared setup without changing files, and a subagent, `config-reviewer`, that can only read and search. The first `curl` saves the marketplace file as `.claude-plugin/marketplace.json`, the path a marketplace uses ([Create a marketplace](https://code.claude.com/docs/en/plugins/create-marketplace)).
2. Validate the marketplace, then the plugin:

   ```bash
   claude plugin validate ./team-marketplace
   claude plugin validate ./team-marketplace/plugins/team-kit --strict
   ```

   Each run ends with `✔ Validation passed` ([Create a marketplace](https://code.claude.com/docs/en/plugins/create-marketplace#create-a-marketplace)). A marketplace run checks the marketplace file and its entries but doesn't open the skill and agent files of the plugins it lists ([Validate a directory](https://code.claude.com/docs/en/plugins/cli-reference#validate-a-directory)), so the second run validates the plugin directory, and `--strict` turns warnings into failures ([Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference#plugin-validate)).
3. Share it in `.claude/settings.json`. Add these keys beside the ones from the Intermediate lessons; if `enabledPlugins` is already there from lesson 8, add the `team-kit` line to it:

   ```json
   "extraKnownMarketplaces": {
     "team-tools": {
       "source": { "source": "directory", "path": "./team-marketplace" }
     }
   },
   "enabledPlugins": {
     "team-kit@team-tools": true
   }
   ```

   The key under `extraKnownMarketplaces` is the marketplace's `name` ([Manage Claude Code plugins for your organization](https://code.claude.com/docs/en/plugins/org#require-a-marketplace-and-its-plugins)), and the plugin's id is `<entry name>@<marketplace name>`, here `team-kit@team-tools` ([Entry name and manifest name](https://code.claude.com/docs/en/plugins/loading#entry-name-and-manifest-name)). A `directory` source names a local folder in `path` ([All settings](https://code.claude.com/docs/en/settings-reference#extraknownmarketplaces)). The example's [`settings.snippet.json`](../../examples/advanced/06-share-your-setup/settings.snippet.json) holds the same keys plus a deny rule for `.env`, for a repository that has none.
4. Commit both:

   ```bash
   git add team-marketplace .claude/settings.json
   git commit -m "Share the team's Claude Code setup"
   ```

   If git reports a path as ignored, `git check-ignore -v <path>` shows the rule that matches it; add the path with `git add -f`, as in [Intermediate lesson 1](../intermediate/01-first-skill.md).
5. Start `claude` at the repository's root, and accept the trust dialog if it appears. After the session starts, Claude Code registers the marketplace your settings declare and loads `team-kit` from it, with no install command ([Plugin loading reference](https://code.claude.com/docs/en/plugins/loading#plugins-and-marketplaces-that-aren%E2%80%99t-on-disk-at-session-start)). Run `/team-kit:onboard` ([Add components to a plugin](https://code.claude.com/docs/en/plugins/components#skills)). Claude reads the committed setup and explains what the repository shares and what stays personal; your wording will differ. The subagent loads too, as `team-kit:config-reviewer` ([Add components to a plugin](https://code.claude.com/docs/en/plugins/components#agents)).
6. Turn the plugin off for yourself only. Add this key to `.claude/settings.local.json`, beside the sandbox setting Intermediate lesson 4 saved there; if `enabledPlugins` is already there, add the `team-kit` line to it. If you're creating the file, wrap the key in `{ }`:

   ```json
   "enabledPlugins": {
     "team-kit@team-tools": false
   }
   ```

   Save the file, then run `/reload-plugins` ([Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference#reload-plugins)). `/team-kit:onboard` is gone from your session, while the committed file still turns the plugin on for everyone else: your local file outranks the project's ([All settings](https://code.claude.com/docs/en/settings-reference#enabledplugins)). Then delete the entry, save the file and run `/reload-plugins` again. If `git status` lists `.claude/settings.local.json`, don't commit it: Your turn adds it to `.gitignore`.

## Your turn

**Brief:** give every teammate the same Claude Code kit from git, and let each of them opt out without a commit. Your team wants the kit in its other repositories too, so start the move: take one piece of your Intermediate setup into `team-kit`, so everyone who clones this repository gets it from the plugin, and the same plugin can later serve the others. Take a skill, such as `tdd` from Intermediate lesson 1, or a subagent, such as `test-gaps` from lesson 6. For a harder move, take a hook from lesson 5: its entry goes in the plugin's `hooks/hooks.json`, in the same shape as in a settings file, with its script inside the plugin, called through `${CLAUDE_PLUGIN_ROOT}` ([Add components to a plugin](https://code.claude.com/docs/en/plugins/components#hooks)).

**Acceptance criteria:**

- The component lives in `team-marketplace/plugins/team-kit/`, as `skills/<name>/SKILL.md`, `agents/<name>.md` or an entry in `hooks/hooks.json`, and the original is gone from `.claude/`; a moved hook is also gone from `.claude/settings.json`.
- `claude plugin validate ./team-marketplace/plugins/team-kit --strict` passes. Save its report for the check, from the repository's root: `claude plugin validate ./team-marketplace/plugins/team-kit --strict --json > .practice/a-6-validate.json`.
- A committed `.gitignore` lists `.claude/settings.local.json` and `CLAUDE.local.md`, and git tracks neither. The rule Claude Code adds for the local settings file goes in your global git excludes file, which teammates don't share ([Settings files and precedence](https://code.claude.com/docs/en/settings#keep-personal-settings-out-of-a-repository)), and the docs say to create `CLAUDE.local.md` by hand and add it to `.gitignore` yourself ([Explore the .claude directory](https://code.claude.com/docs/en/claude-directory#what%E2%80%99s-not-shown)). Add its rule even if you have no `CLAUDE.local.md`.
- Everything is committed, and in a new session the component runs under the plugin's name, such as `/team-kit:tdd` or the `team-kit:test-gaps` subagent.

Because `team-kit` is listed by a relative path in a marketplace on your disk, Claude Code loads it in place: an edit under `team-marketplace/` takes effect at the next session start or after `/reload-plugins`, with no version change ([Plugin loading reference](https://code.claude.com/docs/en/plugins/loading#in-place-and-copied-plugins)).

## Check

You are done when all of these are true:

- [ ] A committed team marketplace lists a plugin by a relative path, and `.practice/a-6-validate.json` records a strict validation of that plugin that passed.
- [ ] The committed `.claude/settings.json` registers that marketplace by a relative path and turns the plugin on.
- [ ] A component you moved is in the plugin and gone from `.claude/`.
- [ ] A committed `.gitignore` keeps `.claude/settings.local.json` and `CLAUDE.local.md` out, and git tracks neither.
- [ ] Self-check (not tested): you can say why a teammate gets `team-kit` with no `claude plugin install`, when each teammate had to install `claude-code-setup` in [Intermediate lesson 8](../intermediate/08-plugins.md).

Run `npm run check -- a-6 --dir <your repo>` from your practice copy.

If the first item fails, run `claude plugin validate ./team-marketplace` and compare the entry's `name` with the plugin's `plugin.json`. If the second fails, check that the key under `extraKnownMarketplaces` is the marketplace's `name`, that the `path` is relative, such as `./team-marketplace`, and that the plugin's value is `true`, not `"true"`. If the third fails, run `git status`: the original may still be committed under `.claude/`, or the plugin's copy may not be committed yet. If the fourth fails, run `git rm --cached` on the tracked file, add both lines to `.gitignore` and commit.

## Watch out

- Everyone who trusts the repository runs what `team-kit` holds, with their own rights. A plugin's hooks and MCP server processes run outside the sandbox, and permission rules don't cover the code they run ([Plugin security and trust](https://code.claude.com/docs/en/plugins/security#understand-what-a-plugin-can-do)). Review a change under `team-marketplace/` as you review code.
- The marketplace waits, without a message, until each teammate accepts the trust dialog for the folder, and a `claude -p` run adds it only in a folder whose trust was already accepted ([Manage Claude Code plugins for your organization](https://code.claude.com/docs/en/plugins/org#require-plugins-per-repository)). CI is such a run: a fresh checkout was never trusted, so it doesn't get `team-kit` from these settings ([When each surface applies the plugin keys](https://code.claude.com/docs/en/plugins/org#when-each-surface-applies-the-plugin-keys)). The committed allow rules wait for the same dialog ([Configure permissions](https://code.claude.com/docs/en/permissions#project-allow-rules-and-workspace-trust)).
- A component left in both `.claude/` and the plugin loads twice: `/tdd` and `/team-kit:tdd` both work, and a hook runs twice each time its event fires ([Create a Claude Code plugin](https://code.claude.com/docs/en/plugins/create#convert-an-existing-claude-setup)).

## Go further

- [Host and maintain a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace): move the marketplace to its own repository once several repositories need it, and release versions.
- [Manage Claude Code plugins for your organization](https://code.claude.com/docs/en/plugins/org): require or restrict marketplaces and plugins on every machine through managed settings.
- [A team's shared settings](https://code.claude.com/docs/en/settings-example#a-teams-shared-settings): a complete committed settings file to compare with yours.

---

<sub>Sources: [Settings files and precedence](https://code.claude.com/docs/en/settings) · [Explore the .claude directory](https://code.claude.com/docs/en/claude-directory) · [Create a Claude Code plugin](https://code.claude.com/docs/en/plugins/create) · [Manage Claude Code plugins for your organization](https://code.claude.com/docs/en/plugins/org) · [Plugin loading reference](https://code.claude.com/docs/en/plugins/loading) · [Create a marketplace](https://code.claude.com/docs/en/plugins/create-marketplace) · [Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference) · [All settings](https://code.claude.com/docs/en/settings-reference) · [Add components to a plugin](https://code.claude.com/docs/en/plugins/components) · [Plugin security and trust](https://code.claude.com/docs/en/plugins/security) · [Configure permissions](https://code.claude.com/docs/en/permissions)</sub>

<sub>← [GitHub Actions](05-github-actions.md) · [Advanced index](README.md) · [Put bounds on autonomous runs](07-bounded-runs.md) → · Topic: [Plugins](../topics/plugins.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=a-6)</sub>
