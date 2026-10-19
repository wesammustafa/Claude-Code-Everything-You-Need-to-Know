# Install, sign in and look around

<sub>**Beginner** · Lesson 1 of 5 · about 20 minutes · Needs: [Beginner index](README.md) · Verified against Claude Code v2.1.292 (stable) on 2026-10-19</sub>

## Goal

By the end of this lesson you can install Claude Code, sign in, start it in a repository, and tell which version, model and account a session is using.

## You need

- A terminal and git, plus a Claude subscription (Pro, Max, Team or Enterprise; the free plan doesn't include Claude Code), a Claude Console account, or access through a supported cloud provider ([Quickstart](https://code.claude.com/docs/en/quickstart), [Advanced setup](https://code.claude.com/docs/en/setup)).
- Your copy of the practice template, cloned, as the [Beginner index](README.md#practice) describes, and Node.js LTS for its checks. In a Codespace on your copy, Claude Code is already installed: start at step 3.
- Every Beginner lesson and the capstone run in your practice copy, because each one works with files that only the copy has, such as this lesson's onboarding notes. Lesson 5 ends by giving one of your own repositories a `CLAUDE.md`, and the [Intermediate level](../intermediate/README.md) practices in your own repository.
- Usage: light, meaning a few short prompts in one session. Inside Claude Code, `/usage` shows your session cost and plan usage limits ([Commands](https://code.claude.com/docs/en/commands)).

> [!NOTE]
> On native Windows, run every command in PowerShell. A command with no **Windows** line works there as written; where a **Windows** line follows a command, use it instead. Installing [Git for Windows](https://git-scm.com/downloads/win) lets Claude Code use Bash; without it, Claude Code uses PowerShell instead ([Quickstart](https://code.claude.com/docs/en/quickstart)).
>
> If PowerShell refuses to run `npm` with `running scripts is disabled on this system`, type `npm.cmd` wherever a lesson says `npm` (for example `npm.cmd run check -- b-1`), or allow local scripts for your account as [Troubleshoot installation](https://code.claude.com/docs/en/troubleshoot-install#running-scripts-is-disabled-on-this-system) shows.

## The idea

Claude Code is a program you run in a terminal, inside a project folder. It reads the files there, answers questions about them, and can change them and run commands.

The first job you give it in a new repository is usually to explain the code. Treat the answer as you would a new colleague's: before you act on it, open the file it names and check.

Before you trust any answer, know three things about the session:

- **the version**, because features and defaults change between releases;
- **the model**, because models differ in what they can do;
- **the account**, because it decides the model a session starts on and which features you can use ([Model configuration](https://code.claude.com/docs/en/model-config#default-model-setting), [Authentication](https://code.claude.com/docs/en/authentication)).

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
3. Go to your practice copy and start a session there: put the full path to your copy's folder in place of `<your practice copy>`, in quotes if the path has a space. In a Codespace, that is `/workspaces/` followed by your copy's name ([Codespaces deep dive](https://docs.github.com/en/codespaces/about-codespaces/deep-dive), [Codespaces with GitHub CLI](https://docs.github.com/en/codespaces/developing-in-a-codespace/using-github-codespaces-with-github-cli)):

   ```bash
   cd <your practice copy>
   claude
   ```

   The first time, Claude Code asks you to sign in. At the login prompt in the terminal, choose your account type; with a Claude subscription or Console account, you then finish in your browser. If the browser shows a code instead of sending you back, paste it into the terminal at the `Paste code here if prompted` prompt ([Authentication](https://code.claude.com/docs/en/authentication)). With an API key or a cloud provider, follow the [Quickstart](https://code.claude.com/docs/en/quickstart) instead.

   In a repository you haven't trusted yet, Claude Code then shows the workspace trust dialog ([Security](https://code.claude.com/docs/en/security#additional-safeguards)). Trust a folder only when you know where its code came from: once you trust it, the repository's own `.claude/settings.json` can grant Claude permissions, such as allow rules, and the dialog lists them first ([Configure permissions](https://code.claude.com/docs/en/permissions#project-allow-rules-and-workspace-trust)). For a stranger's fork you just cloned, leave without trusting it and read its `.claude/` folder first. For your own practice copy, read the dialog and choose to trust the folder. Claude Code saves the trust for the whole repository, so it doesn't ask again here.

   The header above the prompt shows the version, the model and the folder. The status bar under the prompt usually reads `⏵⏵ auto mode on`: auto mode is the built-in starting mode, where Claude works without asking you about routine actions and a separate classifier model reviews actions before they run and blocks anything that goes beyond your request ([Choose a permission mode](https://code.claude.com/docs/en/permission-modes#eliminate-prompts-with-auto-mode)). Claude Code may also show a one-time notice about it. If it reads `⏸ manual mode on` instead, something chose Manual, for example a setting or your organization, or auto mode isn't available to your session ([Which mode a session starts in](https://code.claude.com/docs/en/permission-modes#which-mode-a-session-starts-in)). This lesson works the same way in either mode. Lesson 2 covers the modes.
4. Type `/status`. The **Status** tab lists the version, the model and the account you signed in with (rows such as **Login method** and **Email**). It is the screen to compare when your session differs from a teammate's, such as a model they can pick and you can't: compare the account rows first. If `ANTHROPIC_API_KEY` is set in your shell, Claude Code uses that key once you approve it, not your subscription, and `/status` marks the credential that isn't in use ([Authentication](https://code.claude.com/docs/en/authentication#authentication-precedence)). Press `Esc` to close it ([Interactive mode](https://code.claude.com/docs/en/interactive-mode#general-controls)). Your version may be newer than the one at the top of this page: this guide is checked against the `stable` release channel, and Claude Code follows `latest` unless you choose otherwise ([Configure the release channel](https://code.claude.com/docs/en/setup#configure-release-channel)).
5. Ask two questions about the code:

   ```text
   what does this project do?
   ```

   ```text
   which file parses linkcheck.json, and how do I run the tests?
   ```

   Claude reads files to answer, and may run a command, such as the tests, without asking. Your wording will differ, but the answers should name `src/config.js` and `npm test`.
6. Check the answer against the source. Open `src/config.js` in your editor: its first lines say it parses `linkcheck.json` and name the two fields it reads, `files` and `ignore`. In `package.json`, the `test` script is what `npm test` runs. Keep the session open for Your turn.

## Your turn

Your team wants linkcheck in CI, so that a pull request with a broken link fails. A teammate's onboarding notes, `practice/b-1/onboarding.md` in your practice copy, say things about linkcheck that the CI job would depend on, and one of those claims is wrong. Find it before anyone plans the job around it.

1. In the same session, ask Claude to check the notes:

   ```text
   check each claim in practice/b-1/onboarding.md against the code. For each one, say whether the code agrees, and cite the file and line.
   ```

2. For each claim Claude says the code contradicts, open the file and line it cites and read them yourself. Decide which claim is wrong from the code, not from the notes or from Claude's answer. If Claude also names cases a claim leaves out, that's fine: correct only a claim the code contradicts.
3. Correct that claim in your editor, in one sentence that says what the code does, and leave the other claims as they are. If Claude already edited the note, read its change with `git diff` ([git diff](https://git-scm.com/docs/git-diff)) and keep it only if it matches the code.
4. End the session with `/exit`, then run `git status` ([git status](https://git-scm.com/docs/git-status)): it should list only `practice/b-1/onboarding.md`. Commit it, so lesson 2 starts from a clean tree ([git commit](https://git-scm.com/docs/git-commit)):

   ```bash
   git commit -am "Correct the onboarding notes"
   ```

## Check

You are done when all of these are true:

- [ ] `claude --version` prints a Claude Code version, a line such as `X.Y.Z (Claude Code)`.
- [ ] The claim in `practice/b-1/onboarding.md` that the code contradicts is corrected: it now says what the code does.
- [ ] Self-check (not tested): you can say which model and which login method `/status` showed, and it is the account you meant to use.

Run `npm run check -- b-1` in your practice copy. The check runs `claude --version` itself, in the terminal you run it from. An npm error such as `Could not read package.json` or `Missing script: "check"` means you ran it outside your practice copy: `cd` into the copy and run it again.

If the first item fails, run `claude --version` in that terminal: when it prints an error, fix it as Worked example step 2 describes, then open a new terminal and run the check again. If the second item fails, read the check's message: it quotes the claim that is still wrong, or says what the corrected claim lacks. Open the file and line Claude cited for that claim, and write what the code does.

## Watch out

- In auto mode, Claude can edit files and run commands without asking you first, and even a question can lead it to run one, such as the tests. "Auto mode reduces permission prompts but does not guarantee safety" ([Choose a permission mode](https://code.claude.com/docs/en/permission-modes#eliminate-prompts-with-auto-mode)). In this lesson, ask only for reading, and if Claude Code asks before an action, read what it wants to do before you answer. Lesson 2 shows how to choose what Claude may do on its own.

## Go further

- [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works): what happens between your question and its answer.
- [Configure the release channel](https://code.claude.com/docs/en/setup#configure-release-channel): how to move to `stable`, which skips releases with major regressions.
- [Troubleshoot installation](https://code.claude.com/docs/en/troubleshoot-install): fixes for install and sign-in errors.

---

<sub>Sources: [Quickstart](https://code.claude.com/docs/en/quickstart) · [Advanced setup](https://code.claude.com/docs/en/setup) · [Authentication](https://code.claude.com/docs/en/authentication) · [Model configuration](https://code.claude.com/docs/en/model-config) · [Security](https://code.claude.com/docs/en/security) · [Configure permissions](https://code.claude.com/docs/en/permissions) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [Commands](https://code.claude.com/docs/en/commands) · [Interactive mode](https://code.claude.com/docs/en/interactive-mode) · [Troubleshoot installation](https://code.claude.com/docs/en/troubleshoot-install) · [Codespaces deep dive](https://docs.github.com/en/codespaces/about-codespaces/deep-dive) · [Codespaces with GitHub CLI](https://docs.github.com/en/codespaces/developing-in-a-codespace/using-github-codespaces-with-github-cli) · [git diff](https://git-scm.com/docs/git-diff) · [git status](https://git-scm.com/docs/git-status) · [git commit](https://git-scm.com/docs/git-commit)</sub>

<sub>← [Beginner index](README.md) · [Permission modes and plan mode](02-permission-modes-and-plan-mode.md) → · Topic: [Models, effort and cost](../topics/models-effort-and-cost.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-1)</sub>
