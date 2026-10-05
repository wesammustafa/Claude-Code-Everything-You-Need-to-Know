# Install, sign in and look around

<sub>**Beginner** · Lesson 1 of 5 · about 20 minutes · Needs: [Beginner index](README.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

## Goal

By the end of this lesson you can install Claude Code, sign in, start it in a repository, and tell which version, model and account a session is using.

## You need

- A terminal and git, plus a Claude subscription (Pro, Max, Team or Enterprise; the free plan doesn't include Claude Code), a Claude Console account, or access through a supported cloud provider ([Quickstart](https://code.claude.com/docs/en/quickstart), [Advanced setup](https://code.claude.com/docs/en/setup)).
- Your copy of the practice template, cloned, as the [Beginner index](README.md#practice) describes, and Node.js LTS for its checks. In a Codespace on your copy, Claude Code is already installed: start at step 3.
- To practice in one of your own repositories instead, keep the template copy as well: the check runs from it. In your repository, set up the folder where lessons save snapshots, and tell git to ignore it without a commit ([gitignore](https://git-scm.com/docs/gitignore)):

  ```bash
  mkdir -p .practice
  echo '.practice/' >> "$(git rev-parse --git-path info/exclude)"
  ```

  **Windows:** `New-Item -ItemType Directory -Force .practice` and `Add-Content (git rev-parse --git-path info/exclude) '.practice/'`.
- Usage: light, meaning a few short prompts in one session. Inside Claude Code, `/usage` shows your session cost and plan usage limits ([Commands](https://code.claude.com/docs/en/commands)).

> [!NOTE]
> On native Windows, run every command in PowerShell. A command with no **Windows** line works there as written; where a **Windows** line follows a command, use it instead. Installing [Git for Windows](https://git-scm.com/downloads/win) lets Claude Code use Bash; without it, Claude Code uses PowerShell instead ([Quickstart](https://code.claude.com/docs/en/quickstart)).
>
> If PowerShell refuses to run `npm` with `running scripts is disabled on this system`, type `npm.cmd` wherever a lesson says `npm` (for example `npm.cmd run check -- b-1`), or allow local scripts for your account as [Troubleshoot installation](https://code.claude.com/docs/en/troubleshoot-install#running-scripts-is-disabled-on-this-system) shows.

## The idea

Claude Code is a program you run in a terminal, inside a project folder. It reads the files there and answers questions about them; in the next lessons it changes them too.

Before you trust an answer, know three things about the session:

- **the version**, because features and defaults change between releases;
- **the model**, because models differ in what they can do;
- **the account**, because it decides which features and models you can use.

The header Claude Code shows when it starts gives the version and the model. The `/status` command shows the version, model and account together ([Commands](https://code.claude.com/docs/en/commands)).

## Worked example

1. Install Claude Code ([Quickstart](https://code.claude.com/docs/en/quickstart)):

   ```bash
   curl -fsSL https://claude.ai/install.sh | bash
   ```

   **Windows:** `irm https://claude.ai/install.ps1 | iex`

   When it finishes, open a new terminal window.
2. Check the install. A working installation prints a version number followed by `(Claude Code)`:

   ```bash
   claude --version
   ```

   If your shell says `claude` isn't found or isn't recognized, the install folder isn't on your `PATH` yet: fix it with [Troubleshoot installation](https://code.claude.com/docs/en/troubleshoot-install#command-not-found-claude-after-installation) before you go on.
3. Go to your practice copy and save that output for the check:

   ```bash
   cd <your practice copy>
   mkdir -p .practice
   claude --version > .practice/version.txt
   ```

   **Windows:** `New-Item -ItemType Directory -Force .practice` replaces the `mkdir` line.
4. Start a session in the same folder:

   ```bash
   claude
   ```

   The first time, Claude Code asks you to sign in. At the login prompt in the terminal, choose your account type; with a Claude subscription or Console account, you then finish in your browser. If the browser shows a code instead of sending you back, paste it into the terminal at the `Paste code here if prompted` prompt ([Authentication](https://code.claude.com/docs/en/authentication)). With an API key or a cloud provider, follow the [Quickstart](https://code.claude.com/docs/en/quickstart) instead.

   In a repository you haven't trusted yet, Claude Code also shows the workspace trust dialog, which asks whether you trust the folder ([Security](https://code.claude.com/docs/en/security#additional-safeguards)). **No, exit** is highlighted at first, and pressing Enter on it quits Claude Code. You made this copy, so press the Down arrow to choose **Yes, I trust this folder**, then press Enter. Claude Code saves that trust for the whole repository, so it doesn't ask again here ([Configure permissions](https://code.claude.com/docs/en/permissions#project-allow-rules-and-workspace-trust)).

   The header above the prompt then shows the version, the model and the folder.
5. Type `/status`. The **Status** tab lists the version, the model and the account you signed in with (rows such as **Login method** and **Email**). Press `Esc` to close it ([Interactive mode](https://code.claude.com/docs/en/interactive-mode#general-controls)). Your version may be newer than the one at the top of this page: this guide is checked against the `stable` release channel, and Claude Code follows `latest` unless you choose otherwise ([Configure the release channel](https://code.claude.com/docs/en/setup#configure-release-channel)).
6. Ask two questions about the code:

   ```text
   what does this project do?
   ```

   ```text
   which file parses linkcheck.json, and how do I run the tests?
   ```

   Claude reads files to answer. Your wording will differ, but the answers should name `src/config.js` and `npm test`.
7. End the session with `/exit`.

## Your turn

Repeat the example in your practice copy, or in your own repository, with questions of your own:

1. In that folder, save `claude --version` to `.practice/version.txt`.
2. Start `claude` there. Your own repository shows the trust dialog again, because trust is saved per repository: choose **Yes, I trust this folder** only for code you know.
3. Open `/status` and note the model and the account.
4. Ask two questions of your own about the code, then end the session with `/exit`.

## Check

You are done when all of these are true:

- [ ] `.practice/version.txt` holds a line such as `X.Y.Z (Claude Code)`. Check it with `cat .practice/version.txt`.
- [ ] Self-check (not tested): you can say which model and which account `/status` showed.

Run `npm run check -- b-1` in your practice copy. In your own repository, run `npm run check -- b-1 --dir <your repo>` from your practice copy instead. An npm error such as `Could not read package.json` or `Missing script: "check"` means you ran it outside your practice copy: `cd` into the copy and run it again.

If the first item fails, run `claude --version` on its own: when it prints an error, fix it as Worked example step 2 describes; when it prints a version, save it again in the folder the check reads (your practice copy, or the repository you passed to `--dir`).

## Watch out

- A new session can edit most files and run most commands without asking you first ([Quickstart](https://code.claude.com/docs/en/quickstart)). In this lesson, only ask questions; the next lesson shows how to choose what Claude may do on its own. Even a question can lead Claude to run a command that writes files, such as running the tests to answer you: run `git status` when the session ends, and before lesson 2, commit or remove anything it lists.

## Go further

- [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works): what happens between your question and its answer.
- [Configure the release channel](https://code.claude.com/docs/en/setup#configure-release-channel): how to move to `stable`, which skips releases with major regressions.
- [Troubleshoot installation](https://code.claude.com/docs/en/troubleshoot-install): fixes for install and sign-in errors.

---

<sub>Sources: [Quickstart](https://code.claude.com/docs/en/quickstart) · [Advanced setup](https://code.claude.com/docs/en/setup) · [Authentication](https://code.claude.com/docs/en/authentication) · [Security](https://code.claude.com/docs/en/security) · [Configure permissions](https://code.claude.com/docs/en/permissions) · [Commands](https://code.claude.com/docs/en/commands) · [Interactive mode](https://code.claude.com/docs/en/interactive-mode) · [Troubleshoot installation](https://code.claude.com/docs/en/troubleshoot-install) · [gitignore](https://git-scm.com/docs/gitignore)</sub>

<sub>← [Beginner index](README.md) · [Permission modes and plan mode](02-permission-modes-and-plan-mode.md) → · Topic: [Models, effort and cost](../topics/models-effort-and-cost.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-1)</sub>
