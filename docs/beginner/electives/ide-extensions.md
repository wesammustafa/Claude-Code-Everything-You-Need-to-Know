# Use Claude Code in your editor

<sub>**Beginner** · Elective · about 15 minutes · Needs: [Install, sign in and look around](../01-install-and-look-around.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

## Goal

By the end of this Elective you can run Claude Code inside VS Code or a JetBrains IDE, point it at the lines you're looking at, and review its edits in the editor's diff view.

## You need

- Your copy of the practice template, with no uncommitted changes, open in VS Code or a JetBrains IDE such as IntelliJ IDEA or PyCharm.
- For JetBrains, the Claude Code command-line tool from lesson 1: the plugin runs it in the IDE's terminal.
- Usage: light.

## The idea

The terminal isn't the only place Claude Code runs. Two editor integrations put it next to your code:

- The **VS Code extension** has its own chat panel and brings its own copy of Claude Code. In Manual mode, it shows each proposed edit side by side with the original and asks before applying it ([VS Code](https://code.claude.com/docs/en/vs-code)).
- The **JetBrains plugin** runs the `claude` command in the IDE's terminal and opens the edits it proposes in the IDE's diff viewer ([JetBrains IDEs](https://code.claude.com/docs/en/jetbrains)).

Either way, it's the same Claude Code: the same account, permission modes and CLAUDE.md.

## Worked example

In VS Code:

1. Open the Extensions view with `Cmd+Shift+X` (Mac) or `Ctrl+Shift+X` (Windows and Linux), search for "Claude Code", and click **Install**. The extension doesn't work in Restricted Mode, so if VS Code shows a Restricted Mode banner or asks whether to trust the folder, trust it: this copy is your own code ([Workspace Trust](https://code.visualstudio.com/docs/editing/workspaces/workspace-trust)).
2. Open `src/config.js`. Click the Spark icon at the top right of the editor to open Claude Code, and sign in if it asks. No icon? Click `✻ Claude Code` in the status bar at the bottom right instead.
3. Select the body of `parseConfig` and press `Option+K` (Mac) or `Alt+K` (Windows and Linux). The prompt box gets a reference with the file path and line numbers, such as `@src/config.js#7-17`. Ask:

   ```text
   What happens if linkcheck.json holds an array instead of an object?
   ```

4. Switch the mode at the bottom of the prompt box to Manual, then ask for a small edit, such as a comment above `parseConfig`. The edit opens side by side with the original, and Claude asks for permission in the chat panel. Choose **No** there ([Configure permissions](https://code.claude.com/docs/en/permissions#add-a-comment-when-you-answer-a-permission-prompt)). The **Reject this change** buttons inside the diff only revert one change in the proposal; they don't finish the review.

In a JetBrains IDE:

1. Install the [Claude Code plugin](https://plugins.jetbrains.com/plugin/27310-claude-code-beta-) from the JetBrains Marketplace and restart the IDE.
2. Click the Claude Code button in the IDE, or press `Cmd+Esc` (Mac) or `Ctrl+Esc` (Windows and Linux), to start Claude Code in the IDE's terminal. If nothing happens, open the IDE's terminal and run `claude`: started there, it connects to the IDE on its own. If the IDE shows "Cannot launch Claude Code", it can't find `claude` on your `PATH`: set the full path to `claude` under **Settings** > **Tools** > **Claude Code \[Beta]** > **Claude command** ([plugin settings](https://code.claude.com/docs/en/jetbrains#general-settings)).
3. Open `src/config.js`, select the body of `parseConfig`, and press `Cmd+Option+K` (Mac) or `Alt+Ctrl+K` (Windows and Linux). The prompt gets a reference such as `@src/config.js#L7-17`. Ask the same question.
4. Press `Shift+Tab` until the status bar under the prompt reads `⏸ manual mode on` ([Choose a permission mode](https://code.claude.com/docs/en/permission-modes#switch-permission-modes)). On native Windows, if `Shift+Tab` does nothing, press `Alt+M` instead ([Interactive mode](https://code.claude.com/docs/en/interactive-mode)). Then ask for the same small edit: it opens in the IDE's diff viewer, and Claude asks for permission in the terminal. Choose **No**.

## Your turn

1. Install the extension or the plugin for the editor you use.
2. Open `src/links.js`, select the whole `findLinks` function, and press the reference shortcut: `Option+K` (Mac) or `Alt+K` (Windows and Linux) in VS Code, `Cmd+Option+K` (Mac) or `Alt+Ctrl+K` (Windows and Linux) in JetBrains. Then ask what kinds of links it finds.
3. Switch to Manual mode as in the Worked example, ask for a small edit, and look it over in the diff view. Then choose **No** at Claude's permission prompt: in the chat panel in VS Code, in the terminal in JetBrains.

## Check

This Elective has no `npm run check`: tick each item yourself. You are done when all of these are true:

- [ ] The integration is installed. VS Code: the Extensions view (`Cmd+Shift+X` or `Ctrl+Shift+X`) shows Claude Code as installed. JetBrains: the plugin shows under **Settings** > **Plugins** > **Installed**.
- [ ] `git diff` prints nothing, because you rejected the edit.
- [ ] Self-check (not tested): you asked a question with a reference to the lines you had selected.

If `git diff` shows the edit, it was applied: the session wasn't in Manual mode, or you approved it. Discard it with `git restore <file>`, using the file `git diff` names. Then switch to Manual, ask for the edit again, and choose **No**.

## Go further

- [Desktop quickstart](https://code.claude.com/docs/en/desktop-quickstart): Claude Code in the Claude desktop app.
- [VS Code commands and shortcuts](https://code.claude.com/docs/en/vs-code#vs-code-commands-and-shortcuts).

---

<sub>Sources: [VS Code](https://code.claude.com/docs/en/vs-code) · [JetBrains IDEs](https://code.claude.com/docs/en/jetbrains) · [Configure permissions](https://code.claude.com/docs/en/permissions) · [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) · [Interactive mode](https://code.claude.com/docs/en/interactive-mode) · [Workspace Trust](https://code.visualstudio.com/docs/editing/workspaces/workspace-trust)</sub>

<sub>Back to the [Beginner index](../README.md) · Topic: [Memory and context](../../topics/memory-and-context.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-ide)</sub>
