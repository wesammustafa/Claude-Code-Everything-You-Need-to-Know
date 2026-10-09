# Testing and publishing a plugin

<sub>**Advanced** · Elective · about 20 minutes, plus run time · Needs: [Share your setup with a team](../06-share-your-setup.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-09</sub>

## Goal

By the end of this Elective you can check a plugin's files with `claude plugin validate`, measure what it changes with `claude plugin eval`, and publish it in a marketplace that other people install and update from.

## You need

- The marketplace layout from [lesson 6](../06-share-your-setup.md): a marketplace that lists a plugin by a relative path.
- Where to practice: a new folder outside your other repositories, which becomes its own private GitHub repository. Electives have no template check.
- bash, `jq` and git 2.31 or later, on macOS, Linux or WSL 2. With an older git, `claude plugin eval` stops before running any case ([Requirements](https://code.claude.com/docs/en/plugin-evals#requirements)).
- The GitHub CLI, signed in with `gh auth login`. Claude Code clones a private marketplace with the git credentials your machine already holds, SSH or HTTPS, and never prompts for one; for HTTPS, `gh auth setup-git` after that sign-in stores one it can use ([Grant access to a private marketplace](https://code.claude.com/docs/en/plugins/host-marketplace#grant-access-to-a-private-marketplace)).
- Usage: moderate. Every eval run is a real model call on your account ([Test plugins with evals](https://code.claude.com/docs/en/plugin-evals)). The Worked example makes one run. Your turn's full run runs each case three times with the plugin and three times without it; its cheap variant runs each case once.

## The idea

Check a plugin two ways before you share it. `claude plugin validate` reads files: manifests and frontmatter; with `--strict`, a warning fails the run too ([Test and debug](https://code.claude.com/docs/en/plugins/create#test-and-debug)). `claude plugin eval` measures behavior: each case, a prompt plus graders (checks that score each run), runs in a fresh, isolated session with only your plugin loaded, three times by default (the with-arm), and as many times with no plugin (the without-arm). The difference between their scores, `WITH` and `W/OUT`, is `Δ`: what the plugin contributed ([How an eval run works](https://code.claude.com/docs/en/plugin-evals#how-an-eval-run-works)).

The `regex`, `tool_used`, `tool_order` and `file_exists` graders cost nothing; `llm` and `baseline` call a judge model. Give each case one grader on the result and one on the steps, such as "the skill ran" ([Choose and weight graders](https://code.claude.com/docs/en/plugin-evals#grade-the-result)).

Publishing is a `.claude-plugin/marketplace.json` in a git repository: once it's pushed, the plugin is published, with no submission form ([Publish and distribute a plugin](https://code.claude.com/docs/en/plugins/publish#publish-through-your-own-marketplace)). When a plugin sets a `version`, a user gets your next release only when you change it ([Release a new version](https://code.claude.com/docs/en/plugins/host-marketplace#release-a-new-version)).

> [!WARNING]
> Before you make a marketplace repository public, read every file in it: everyone can read a public repository ([About repositories](https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories#about-repository-visibility)), and anyone who can clone it can install from it ([Control who can install](https://code.claude.com/docs/en/plugins/publish#control-who-can-install)). A hook or a stdio MCP server you add in a later version runs on the machine of everyone who updates to it, with their rights ([Plugin security and trust](https://code.claude.com/docs/en/plugins/security#understand-what-a-plugin-can-do)).

## Worked example

1. Create a repository with one plugin, `commit-helper`, under `plugins/`, the layout [Create a marketplace](https://code.claude.com/docs/en/plugins/create-marketplace#create-a-marketplace) uses. Its one skill drafts commit messages. In every file and command, replace `<you>` with your GitHub user name and `Your Name` with your name:

   ```bash
   mkdir -p claude-plugins/.claude-plugin claude-plugins/plugins/commit-helper/{.claude-plugin,skills/commit-message}
   cd claude-plugins && git init
   mkdir -p .practice && echo '.practice/' >> "$(git rev-parse --git-path info/exclude)"
   echo '**/evals/results/' > .gitignore
   echo '# commit-helper: drafts commit messages in a short, consistent format.' > plugins/commit-helper/README.md
   ```

   `.practice/` holds the file the Check reads, ignored without a commit as in [Beginner lesson 1](../../beginner/01-install-and-look-around.md#you-need). The `.gitignore` line keeps out the results each eval run writes under `evals/results/` ([Write and refine cases](https://code.claude.com/docs/en/plugin-evals#write-and-refine-cases)), and the release checklist asks for the README ([Prepare your plugin for release](https://code.claude.com/docs/en/plugins/publish#prepare-your-plugin-for-release)). Then save the plugin's manifest, with the fields that checklist asks for, as `plugins/commit-helper/.claude-plugin/plugin.json`:

   ```json
   {
     "name": "commit-helper", "version": "1.0.0", "author": { "name": "Your Name" },
     "description": "Drafts commit messages in a short, consistent format.",
     "homepage": "https://github.com/<you>/claude-plugins", "repository": "https://github.com/<you>/claude-plugins"
   }
   ```

   The skill, as `plugins/commit-helper/skills/commit-message/SKILL.md`:

   ```markdown
   ---
   name: commit-message
   description: Drafts a commit message for a described change. Use when the user asks for a commit message.
   ---

   Write a commit message for the change the user describes: a subject line in the imperative mood, at most 50 characters, with no trailing period; a blank line; then one sentence on why.
   ```

   And the marketplace, as `.claude-plugin/marketplace.json`. Keep the entry's `name` the same as the manifest's ([Keep the entry name and the manifest name the same](https://code.claude.com/docs/en/plugins/create-marketplace#keep-the-entry-name-and-the-manifest-name-the-same)):

   ```json
   {
     "name": "<you>-plugins", "description": "Plugins from <you>", "owner": { "name": "Your Name" },
     "plugins": [{ "name": "commit-helper", "source": "./plugins/commit-helper", "description": "Drafts commit messages." }]
   }
   ```

2. Validate the plugin, then the marketplace: `claude plugin validate --strict ./plugins/commit-helper`, then `claude plugin validate --strict .`. Each run ends with `✔ Validation passed`. A marketplace run checks the marketplace file and the `plugin.json` of each plugin it lists by a relative path ([Problems that validation reports](https://code.claude.com/docs/en/plugins/create-marketplace#problems-that-validation-reports)), but doesn't open their skill files, so validate the plugin directory itself too ([Validate a directory](https://code.claude.com/docs/en/plugins/cli-reference#validate-a-directory)).
3. Write one eval case. `claude plugin eval init --bare` writes a blank case: a `prompt.md` and one placeholder grader, `graders/criteria.md`, which expects a rubric for a judge model. It runs nothing ([Write a case manually](https://code.claude.com/docs/en/plugin-evals#write-a-case-manually)). Replace the rubric with two graders that cost nothing:

   ```bash
   cd plugins/commit-helper
   claude plugin eval init --bare names-the-rename
   cd evals/names-the-rename && rm graders/criteria.md
   printf '%s\n' '---' 'max_turns: 10' 'allowed_tools: [Skill]' '---' '' 'Write me a commit message for this change: I renamed getUser to fetchUser and updated the three call sites.' > prompt.md
   printf '%s\n' '---' 'type: tool_used' 'tool: Skill' "input_match: 'commit-message'" '---' > graders/skill-fired.md
   printf '%s\n' '---' 'type: regex' "pattern: 'fetchUser'" '---' > graders/mentions-rename.md
   cd ../..
   ```

   A run gets only the read-only tools its case lists, so `allowed_tools: [Skill]` is what lets Claude run your skill ([prompt.md frontmatter](https://code.claude.com/docs/en/plugin-evals#prompt-md-fields)). `skill-fired` passes when Claude called the `Skill` tool with `commit-message` in its input, that is, ran the skill; `mentions-rename` checks the reply ([Grader types](https://code.claude.com/docs/en/plugin-evals#grader-types)). Have a regex look for a fact the prompt gives, such as `fetchUser`: Claude writes the reply, so its wording varies. `evals/names-the-rename/graders/` now holds `mentions-rename.md` and `skill-fired.md`.
4. Run the case once, with the plugin only, and keep the report on your machine: `claude plugin eval . --runs 1 --ablation none --no-publish` ([Command options](https://code.claude.com/docs/en/plugin-evals#command-options)). If it asks `Trust this plugin directory?`, answer `y`; inside a git repository, that trusts the whole repository, for interactive sessions too ([Trust the plugin directory](https://code.claude.com/docs/en/plugin-evals#trust-the-plugin-directory)). The summary table has `SCORE` and `PASS%` columns, and a `Report:` line gives the path of `report.html` under `evals/results/` ([Create your first eval suite](https://code.claude.com/docs/en/plugin-evals#create-your-first-eval-suite)). Your scores will differ.
5. Publish. Back at the repository's root (`cd ../..`), run `git add -A && git status --short`, read each file it lists, then:

   ```bash
   git commit -m "Publish commit-helper 1.0.0"
   gh repo create claude-plugins --private --source . --push
   ```

   `--source .` creates the GitHub repository from this one, and `--push` pushes your commit ([gh repo create](https://cli.github.com/manual/gh_repo_create)). The marketplace is now published to everyone who can clone the repository: you, for now. Making the repository public is what lets everyone install it.
6. Install it as a user would, from GitHub:

   ```bash
   claude plugin marketplace add <you>/claude-plugins
   claude plugin install commit-helper@<you>-plugins
   claude plugin details commit-helper
   ```

   The add prints `✔ Successfully added marketplace: <you>-plugins (declared in user settings)`, the install prints `✔ Successfully installed plugin: commit-helper@<you>-plugins (scope: user)`, and the details' `Component inventory` reads `Skills (1)  commit-message` ([Create a marketplace](https://code.claude.com/docs/en/plugins/create-marketplace#create-a-marketplace)). The marketplace's name comes from your `marketplace.json`, not from the repository ([Host your marketplace](https://code.claude.com/docs/en/plugins/host-marketplace#host-your-marketplace)). The plugin stays installed for you until the end of Your turn.

## Your turn

**Brief:** release `commit-helper` 1.0.1, gated by its evals, and update your installed copy.

**Acceptance criteria:**

- A second case, `ignores-unrelated`, has the same frontmatter as `names-the-rename`, so the skill could run, and sends a request the skill must leave alone, such as `Explain what a git rebase does.` A `tool_used` grader on `Skill` with `min: 0`, `max: 0` and `arm: both` checks that Claude didn't run the skill. `arm: both` is needed because a two-arm run otherwise leaves every `tool_used` grader on `Skill` out of the score ([Score against the no-plugin baseline](https://code.claude.com/docs/en/plugin-evals#compare-against-a-no-plugin-baseline)). A `regex` grader checks the reply, such as `pattern: 'rebase'` with `flags: i`.
- The skill makes one change a grader can see, such as starting each subject with a type like `refactor:`, checked by a new `regex` grader in `names-the-rename`. `version` in `plugin.json` is `1.0.1`, and the marketplace entry sets no `version` of its own ([Release a new version](https://code.claude.com/docs/en/plugins/host-marketplace#release-a-new-version)).
- Both strict validations pass, and one full run, `claude plugin eval . --threshold <score> --no-publish` from the plugin's folder, ends with every case at or above the threshold you chose, a score from 0 to 1 such as `0.8` ([Command options](https://code.claude.com/docs/en/plugin-evals#command-options)). Cheap variant: add `--runs 1 --ablation none`.
- `evals/` is committed, `evals/results/` isn't, and the release is pushed.
- `claude plugin update commit-helper@<you>-plugins` installs 1.0.1 and ends with `Restart to apply changes.` ([Plugin loading reference](https://code.claude.com/docs/en/plugins/loading#check-which-stage-a-plugin-reached)). If it says the plugin is already at the latest version, the new `version` isn't pushed yet.

Then, from the repository's root, save the plugin list with `claude plugin list --json > .practice/a-publish-list.json` ([JSON output](https://code.claude.com/docs/en/plugins/cli-reference#json-output)), and only then run `claude plugin marketplace remove <you>-plugins --scope user`. Removing a marketplace from its last scope also uninstalls its plugins ([plugin marketplace remove](https://code.claude.com/docs/en/plugins/cli-reference#plugin-marketplace-remove)), so the saved list is what the Check below reads. Deleting the repository is optional: `gh repo delete <you>/claude-plugins --yes` needs the `delete_repo` scope, which `gh auth refresh -s delete_repo` adds ([gh repo delete](https://cli.github.com/manual/gh_repo_delete)).

## Check

You are done when all of these are true, from the repository's root:

- [ ] `claude plugin validate --strict ./plugins/commit-helper` and `claude plugin validate --strict .` each end with `✔ Validation passed`.
- [ ] `git ls-files plugins/commit-helper/evals` lists the files of two cases and nothing under `results/`.
- [ ] The newest eval result covers both cases, and every case passed ([JSON result](https://code.claude.com/docs/en/plugin-evals#json-result)): `jq '.partial != true and .aggregates.casesTotal == 2 and .aggregates.casesPassed == .aggregates.casesTotal' "$(ls -d plugins/commit-helper/evals/results/*/ | tail -1)aggregate-result.json"` prints `true`.
- [ ] `jq -r '.[] | select(.id == "commit-helper@<you>-plugins") | .version' .practice/a-publish-list.json` prints `1.0.1`.
- [ ] Self-check (not tested): you can say what `Δ` measures, and why a two-arm run doesn't score "the skill ran".

If a validation fails only with `--strict`, the lines above the verdict name a warning to fix, such as a missing `description` or `version` ([Output and exit codes](https://code.claude.com/docs/en/plugins/cli-reference#output-and-exit-codes)). If `results/` is listed, run `git rm -r --cached plugins/commit-helper/evals/results`, check the `.gitignore` line and commit. If the result prints `false`, run both cases again when the newest run had only one, or open its `report.html` to see which grader failed: without `--threshold`, any case below a perfect score fails ([The run exits 1 but the results look fine](https://code.claude.com/docs/en/plugin-evals#the-run-exits-1-but-the-results-look-fine)). If the version check prints nothing or `1.0.0`, check that `<you>` is replaced, push the new `version` if needed, add the marketplace, install the plugin again, and save the list before you remove the marketplace.

## Watch out

- `claude plugin eval` runs the plugin's skills, hooks and agents on your machine, as you, and a suite that passes says nothing about whether the plugin is safe. Pass `--allow-tools`, `--scaffold` or `--allow-real-servers` only for a plugin and suite you've read ([What a run can access](https://code.claude.com/docs/en/plugin-evals#security)).
- Judge graders add model calls to every run, so keep them for what a free grader can't check. `--max-cost-usd` caps the run's list-price estimate, not your plan usage, and once you reach a usage limit mid-suite, later runs usually score 0 while the suite isn't marked `partial` ([Command options](https://code.claude.com/docs/en/plugin-evals#command-options), [Troubleshooting](https://code.claude.com/docs/en/plugin-evals#runs-fail-with-a-usage-limit-or-rate-limit-error-partway-through)).
- Treat a plugin's `name` as permanent: users install, enable and configure it by `name@marketplace`, so a renamed plugin is a different plugin to every existing install. Change `displayName` for a new label ([Prepare your plugin for release](https://code.claude.com/docs/en/plugins/publish#prepare-your-plugin-for-release)). Some marketplace names are reserved, such as any starting with `claudeai-`; if the add refuses yours, pick another ([Reserved names](https://code.claude.com/docs/en/plugins/marketplace-reference#reserved-names)).

## Go further

- [Run evals in CI](https://code.claude.com/docs/en/plugin-evals#run-evals-in-ci): `--trust-plugin`, pinned models, `--json` and a cost ceiling, for a job like the one in [GitHub Actions](../05-github-actions.md).
- [Submit to Anthropic's directory](https://code.claude.com/docs/en/plugins/publish#submit-to-anthropics-directory): list a plugin in the catalog people browse on claude.ai.
- [Host and maintain a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace): auto-update, release channels, and renaming or removing a plugin.

---

<sub>Sources: [Test plugins with evals](https://code.claude.com/docs/en/plugin-evals) · [Publish and distribute a plugin](https://code.claude.com/docs/en/plugins/publish) · [Create a Claude Code plugin](https://code.claude.com/docs/en/plugins/create) · [Create a marketplace](https://code.claude.com/docs/en/plugins/create-marketplace) · [Host and maintain a marketplace](https://code.claude.com/docs/en/plugins/host-marketplace) · [Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference) · [Plugin loading reference](https://code.claude.com/docs/en/plugins/loading) · [Marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference) · [Plugin security and trust](https://code.claude.com/docs/en/plugins/security) · GitHub: [About repositories](https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories) · GitHub CLI manual: [gh repo create](https://cli.github.com/manual/gh_repo_create), [gh repo delete](https://cli.github.com/manual/gh_repo_delete)</sub>

<sub>Back to the [Advanced index](../README.md) · Topic: [Plugins](../../topics/plugins.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=a-publish-plugin)</sub>
