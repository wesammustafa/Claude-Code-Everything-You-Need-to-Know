# Dev containers

<sub>**Advanced** · Elective · about 20 minutes, plus run time · Needs: [Put bounds on autonomous runs](../07-bounded-runs.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-09</sub>

## Goal

By the end of this Elective you can run Claude Code inside a dev container, keep your sign-in across a rebuild, and let it work unattended behind a firewall.

## You need

- For the Worked example: your copy of the practice template on GitHub, and GitHub Codespaces on your account. Nothing to install on your computer: the copy's dev container installs Claude Code.
- For Your turn: one of your own repositories with no `.devcontainer/` folder, with its `.practice/` folder set up as [Beginner lesson 1](../../beginner/01-install-and-look-around.md#you-need) describes.
- Also for Your turn: Docker, VS Code with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) ([System requirements](https://code.visualstudio.com/docs/devcontainers/containers#_system-requirements)), and `jq`, on macOS, Linux or WSL 2. Without Docker, do the Worked example and the Check's self-check.
- Usage: light. A codespace also uses your GitHub account's Codespaces compute while it runs, and storage while it exists ([GitHub Codespaces billing](https://docs.github.com/en/billing/concepts/product-billing/github-codespaces)).

## The idea

A [dev container](https://code.claude.com/docs/en/devcontainer) is a Docker container your editor connects to, on your computer or a cloud host such as GitHub Codespaces. With Claude Code in it, Claude's commands run in the container, while its edits land in your repository. Unlike the Bash sandbox from [Intermediate lesson 4](../../intermediate/04-permissions-and-sandbox.md), which wraps only shell commands, it holds the whole Claude Code process: file tools, MCP servers and hooks too ([Compare sandboxing approaches](https://code.claude.com/docs/en/sandbox-environments#compare-sandboxing-approaches)).

Three pieces, each adding to the one before:

- The **Claude Code Dev Container Feature** adds the CLI to any dev container ([Add Claude Code to your dev container](https://code.claude.com/docs/en/devcontainer#add-claude-code-to-your-dev-container)).
- A **named volume** at `~/.claude`, plus `CLAUDE_CONFIG_DIR` set to that path, keeps your sign-in when a rebuild discards the home folder ([Persist authentication and settings across rebuilds](https://code.claude.com/docs/en/devcontainer#persist-authentication-and-settings-across-rebuilds)).
- The **reference container** adds a non-root user and a firewall that limits outbound traffic to the destinations its script allows. The docs support it for unattended `--dangerously-skip-permissions` runs, which skip permission prompts (bypass mode); the CLI refuses the flag as root ([Run without permission prompts](https://code.claude.com/docs/en/devcontainer#run-without-permission-prompts), [Dev containers](https://code.claude.com/docs/en/sandbox-environments#dev-containers)).

> [!WARNING]
> With `--dangerously-skip-permissions`, "dev containers do not prevent a malicious project from exfiltrating anything accessible inside the container, including the Claude Code credentials stored in `~/.claude`" ([Development containers](https://code.claude.com/docs/en/devcontainer)). VS Code's Dev Containers extension also reuses your local Git credentials in the container and forwards a running SSH agent, and the reference firewall lets GitHub and SSH through, so a run can push with them ([Sharing Git credentials with your container](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials)). Use a dev container only with repositories you trust, and never mount host secrets such as `~/.ssh` or cloud credential files into it.

## Worked example

1. On GitHub, open `.devcontainer/devcontainer.json` in your template copy:

   ```json
   {
     "name": "Claude Code practice",
     "image": "mcr.microsoft.com/devcontainers/base:ubuntu",
     "features": {
       "ghcr.io/devcontainers/features/node:1": { "version": "lts" },
       "ghcr.io/anthropics/devcontainer-features/claude-code:1.0": {}
     },
     "postCreateCommand": "sudo apt-get update && sudo apt-get install -y bubblewrap socat"
   }
   ```

   The `:1.0` tag pins the feature's install script, not Claude Code: the feature installs the latest release, which then updates itself ([Add Claude Code to your dev container](https://code.claude.com/docs/en/devcontainer#add-claude-code-to-your-dev-container)). The `postCreateCommand` installs `bubblewrap` and `socat`, which the Bash sandbox needs on Linux ([Set up Linux and WSL2](https://code.claude.com/docs/en/sandboxing#set-up-linux-and-wsl2)).
2. Select **Code**, then the **Codespaces** tab, and create a codespace on `main` ([Creating a codespace for a repository](https://docs.github.com/en/codespaces/developing-in-a-codespace/creating-a-codespace-for-a-repository)). It opens in the editor set in your Codespaces settings ([Setting your default editor for GitHub Codespaces](https://docs.github.com/en/codespaces/setting-your-user-preferences/setting-your-default-editor-for-github-codespaces)); steps 3 to 6 use VS Code, in the browser or the desktop app.
3. In its terminal:

   ```bash
   echo "$CODESPACES"; whoami; claude --version
   ```

   It prints three lines: `true` (GitHub sets `CODESPACES` in every codespace, [Default environment variables for your codespace](https://docs.github.com/en/codespaces/developing-in-a-codespace/default-environment-variables-for-your-codespace)), `vscode` (the image's non-root user, [Ubuntu image](https://github.com/devcontainers/images/tree/main/src/base-ubuntu)), and a version that can be newer than this page's stamp.
4. Run `claude`, sign in, and trust the folder when it asks. If the browser shows a code instead of returning to the terminal, paste it at the `Paste code here if prompted` prompt ([Log in to Claude Code](https://code.claude.com/docs/en/authentication#log-in-to-claude-code)). Then ask:

   ```text
   Run uname -a and whoami, then tell me which machine you're running on.
   ```

   Approve the command if Claude asks. Claude describes a Linux container, not your computer; your wording will differ. Quit with `/exit`.
5. Run `claude auth status --text`: you're signed in ([CLI commands](https://code.claude.com/docs/en/cli-reference#cli-commands)). Rebuild: open the Command Palette (`Ctrl+Shift+P`, or `Cmd+Shift+P` on a Mac), run **Codespaces: Rebuild Container**, and choose **Rebuild** ([Rebuilding the container in a codespace](https://docs.github.com/en/codespaces/developing-in-a-codespace/rebuilding-the-container-in-a-codespace)). When it reconnects:

   ```bash
   claude auth status --text; echo "exit $?"
   ```

   It ends with `exit 1`: not signed in. A rebuild keeps `/workspaces`, where your repository lives, and clears `~/.claude` ([Persisting data over a rebuild](https://docs.github.com/en/codespaces/developing-in-a-codespace/rebuilding-the-container-in-a-codespace#persisting-data-over-a-rebuild)).
6. Stop the codespace: run **Codespaces: Stop Codespace** from the Command Palette, or choose **Stop codespace** from the **...** menu next to it on [github.com/codespaces](https://github.com/codespaces). Closing the browser tab doesn't stop it ([Stopping and starting a codespace](https://docs.github.com/en/codespaces/developing-in-a-codespace/stopping-and-starting-a-codespace)).

## Your turn

**Brief:** put one of your own repositories in the [reference container](https://code.claude.com/docs/en/devcontainer#try-the-reference-container), with its firewall on and Claude Code pinned. Keep your sign-in across a rebuild, and let Claude finish one small task unattended, then review the result on your computer.

The docs' steps open Claude Code's own repository in the container; to use it with your project, you copy its `.devcontainer/` folder into your repository and adjust the Dockerfile for your project's tools ([Try the reference container](https://code.claude.com/docs/en/devcontainer#try-the-reference-container)). On a new branch, fetch the [three files](https://github.com/anthropics/claude-code/tree/d945a61bc6346abce607252d5667df8a3bf0461a/.devcontainer) at the commit this guide was checked against:

```bash
git switch -c try-devcontainer
mkdir -p .devcontainer
ref=d945a61bc6346abce607252d5667df8a3bf0461a
for f in devcontainer.json Dockerfile init-firewall.sh; do
  curl -fsSL "https://raw.githubusercontent.com/anthropics/claude-code/$ref/.devcontainer/$f" -o ".devcontainer/$f"
done
```

**Acceptance criteria:**

- You read all three files before the first build. `init-firewall.sh` runs as root each time the container starts: `devcontainer.json` runs it as the `postStartCommand` ([Dev Container metadata reference](https://containers.dev/implementors/json_reference/)), and the Dockerfile lets the `node` user run it with `sudo`.
- Before the first build, you add `claude.ai` and `platform.claude.com` to the domains `init-firewall.sh` resolves, next to `api.anthropic.com`: signing in and refreshing the sign-in need them ([Network access requirements](https://code.claude.com/docs/en/network-config#network-access-requirements)). Hosts can share an address, and the script stops at the first `ipset add` that meets an address it already added, so in the same loop change `ipset add allowed-domains "$ip"` to `ipset add -exist allowed-domains "$ip"`: `-exist` ignores an entry that's already in the set ([ipset](https://ipset.netfilter.org/ipset.man.html)).
- `devcontainer.json` pins Claude Code: the `CLAUDE_CODE_VERSION` build argument names a version you choose, such as `2.1.285`, in place of `latest`, and `containerEnv` adds `"DISABLE_AUTOUPDATER": "1"`. That's the docs' recipe: install a fixed version from the Dockerfile, and turn off auto-update ([Enforce organization policy](https://code.claude.com/docs/en/devcontainer#enforce-organization-policy)). The three files, with your changes, are committed on your branch.
- **Dev Containers: Reopen in Container** builds and opens it. The build log's `npm warn EBADENGINE` lines are expected: the reference image runs Node.js 20 and the npm package requires 22 or later, but npm only warns, the install completes and `claude` still runs ([Install with npm](https://code.claude.com/docs/en/setup#install-with-npm)). In its terminal (`` Ctrl+` ``), `whoami` prints `node`, `claude --version` prints your version, `curl -sS --connect-timeout 5 https://example.com` fails, and `curl -sS --connect-timeout 5 https://api.github.com/zen` succeeds.
- You sign in with `claude` once. After **Dev Containers: Rebuild Container**, `claude auth status` still exits with `0`: the reference mounts a named volume at `/home/node/.claude` and points `CLAUDE_CONFIG_DIR` at it, and Docker keeps a volume after its container is gone ([Volumes](https://docs.docker.com/engine/storage/volumes/)).
- One unattended run finishes in the container's terminal, on a task that needs no tool the image lacks, such as `claude -p "Add a one-line summary of this repository to the top of README.md" --dangerously-skip-permissions --model sonnet --max-turns 10` ([CLI flags](https://code.claude.com/docs/en/cli-reference#cli-flags)).
- In a terminal on your computer, after the checks in the first Watch out bullet, you save `git status --porcelain > .practice/a-dc-status.txt`, then read `git diff`, `.devcontainer/` included, before you commit or discard the run's change.

When every item in the Check below is true, tear down:

1. In the container's terminal, run `claude auth logout` ([CLI commands](https://code.claude.com/docs/en/cli-reference#cli-commands)). Until you sign out, the config volume holds your credentials, and the volume outlives the container.
2. Close the VS Code window that's connected to the container. Closing it stops the container by default (`shutdownAction` in the [Dev Container metadata reference](https://containers.dev/implementors/json_reference/)).
3. Remove the container: in VS Code's Remote Explorer, choose **Containers**, then right-click the container and remove it ([Managing containers](https://code.visualstudio.com/docs/devcontainers/containers#_managing-containers)), or run `docker rm <container>` ([docker container rm](https://docs.docker.com/reference/cli/docker/container/rm/)).
4. Remove the two volumes whose names start with `claude-code-config-` and `claude-code-bashhistory-`: `docker volume ls` lists them, then `docker volume rm <name>` removes each. Docker won't remove a volume a container still uses, so this step comes after step 3 ([docker volume rm](https://docs.docker.com/reference/cli/docker/volume/rm/)).

## Check

You are done when all of these are true:

- [ ] On your computer, `git ls-tree --name-only try-devcontainer .devcontainer/` lists the three files, and `git show try-devcontainer:.devcontainer/devcontainer.json | jq -r '.build.args.CLAUDE_CODE_VERSION, .containerEnv.DISABLE_AUTOUPDATER'` prints your version and `1`.
- [ ] In the container, `whoami` prints `node`, `claude --version` prints your version, the `example.com` request fails and the `api.github.com/zen` one succeeds.
- [ ] In the container, after a rebuild, `claude auth status >/dev/null; echo $?` prints `0`.
- [ ] On your computer, `.practice/a-dc-status.txt` lists the file the unattended run changed.
- [ ] Self-check (not tested): in the codespace, `claude auth status` exited with `1` after the rebuild, and you can name two things the container doesn't protect: anything readable or usable inside it, such as `~/.claude` and your forwarded Git credentials, and every file in the mounted project.

If jq reports a parse error, remove any comment or trailing comma you added to `devcontainer.json`. If `example.com` answers or `api.github.com` doesn't, the firewall script didn't succeed: run `sudo /usr/local/bin/init-firewall.sh` in the container and read its error. `Element cannot be added to the set: it's already added` means the `-exist` change is missing. If `claude auth status` exits with `1` after the rebuild, the volume's `target` and `CLAUDE_CONFIG_DIR` in `containerEnv` must name the same path ([Persist authentication and settings across rebuilds](https://code.claude.com/docs/en/devcontainer#persist-authentication-and-settings-across-rebuilds)). If the status file is empty, the run changed nothing, committed its change (`git log -1` shows it), or stopped at `--max-turns`, which exits with an error ([CLI flags](https://code.claude.com/docs/en/cli-reference#cli-flags)): read what it printed, and give it a smaller task if it ran out of turns.

## Watch out

- With `--dangerously-skip-permissions`, Claude can also rewrite `.devcontainer/` and `.git/`: they're protected paths, but bypass mode writes protected paths without asking ([Protected paths](https://code.claude.com/docs/en/permission-modes#protected-paths)). Through the mount, the change lands on your computer: the next rebuild uses `.devcontainer/`, and git runs the hooks in `.git/hooks`, or in the folder `.git/config` names, during commands such as `git commit` ([githooks](https://git-scm.com/docs/githooks)). Before you rebuild or run git on your computer, read `.git/config` and list `.git/hooks`, then compare `.devcontainer/` with the commit you made (`git log --oneline`, then `git diff <your commit> -- .devcontainer`).
- A codespace keeps running until you stop it or it times out, and a stopped one still uses storage ([Stopping and starting a codespace](https://docs.github.com/en/codespaces/developing-in-a-codespace/stopping-and-starting-a-codespace)). Delete it when you're done, from the **...** menu next to it on [github.com/codespaces](https://github.com/codespaces), or with `gh codespace delete` ([Deleting a codespace](https://docs.github.com/en/codespaces/developing-in-a-codespace/deleting-a-codespace)).
- The firewall blocks outbound traffic its script doesn't allow, for everything in the container, Claude's commands included. When your project needs another host, such as PyPI or a private registry, add it to the script's list of domains and rebuild ([Dev containers](https://code.claude.com/docs/en/sandbox-environments#dev-containers)). [Network access requirements](https://code.claude.com/docs/en/network-config#network-access-requirements) lists the hosts Claude Code's own features use.

## Go further

- [Choose a sandbox environment](https://code.claude.com/docs/en/sandbox-environments): dev containers next to the Bash sandbox, other containers, virtual machines and cloud sessions.
- [Enforce organization policy](https://code.claude.com/docs/en/devcontainer#enforce-organization-policy): managed settings built into the image, and why a file in the repository isn't an enforcement boundary.
- [Explore the .claude directory](https://code.claude.com/docs/en/claude-directory): what the volume at `~/.claude` holds, including credentials, settings and session history.

---

<sub>Sources: [Development containers](https://code.claude.com/docs/en/devcontainer) · [Choose a sandbox environment](https://code.claude.com/docs/en/sandbox-environments) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing) · [Authentication](https://code.claude.com/docs/en/authentication) · [Advanced setup](https://code.claude.com/docs/en/setup) · [CLI reference](https://code.claude.com/docs/en/cli-reference) · [Enterprise network configuration](https://code.claude.com/docs/en/network-config) · Claude Code: [reference dev container at d945a61](https://github.com/anthropics/claude-code/tree/d945a61bc6346abce607252d5667df8a3bf0461a/.devcontainer) · GitHub: [Creating a codespace for a repository](https://docs.github.com/en/codespaces/developing-in-a-codespace/creating-a-codespace-for-a-repository), [Setting your default editor for GitHub Codespaces](https://docs.github.com/en/codespaces/setting-your-user-preferences/setting-your-default-editor-for-github-codespaces), [Default environment variables for your codespace](https://docs.github.com/en/codespaces/developing-in-a-codespace/default-environment-variables-for-your-codespace), [Rebuilding the container in a codespace](https://docs.github.com/en/codespaces/developing-in-a-codespace/rebuilding-the-container-in-a-codespace), [Stopping and starting a codespace](https://docs.github.com/en/codespaces/developing-in-a-codespace/stopping-and-starting-a-codespace), [Deleting a codespace](https://docs.github.com/en/codespaces/developing-in-a-codespace/deleting-a-codespace), [GitHub Codespaces billing](https://docs.github.com/en/billing/concepts/product-billing/github-codespaces) · VS Code: [Developing inside a Container](https://code.visualstudio.com/docs/devcontainers/containers), [Sharing Git credentials with your container](https://code.visualstudio.com/remote/advancedcontainers/sharing-git-credentials) · [Dev Container metadata reference](https://containers.dev/implementors/json_reference/) · Dev Container images: [Ubuntu](https://github.com/devcontainers/images/tree/main/src/base-ubuntu) · Docker: [Volumes](https://docs.docker.com/engine/storage/volumes/), [docker container rm](https://docs.docker.com/reference/cli/docker/container/rm/), [docker volume rm](https://docs.docker.com/reference/cli/docker/volume/rm/) · Git: [githooks](https://git-scm.com/docs/githooks) · [ipset](https://ipset.netfilter.org/ipset.man.html)</sub>

<sub>Back to the [Advanced index](../README.md) · Topic: [Permissions and safety](../../topics/permissions-and-safety.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=a-dev-containers)</sub>
