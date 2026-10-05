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
- The **JetBrains plugin** runs the `claude` command in the IDE's terminal and opens its changes in the IDE's diff viewer ([JetBrains IDEs](https://code.claude.com/docs/en/jetbrains)).

Either way, it's the same Claude Code: the same account, permission modes and CLAUDE.md.

## Worked example

In VS Code:

1. Open the Extensions view with `Cmd+Shift+X` (Mac) or `Ctrl+Shift+X` (Windows and Linux), search for "Claude Code", and click **Install**.
2. Open `src/config.js`. Click the Spark icon at the top right of the editor to open Claude Code, and sign in if it asks.
3. Select the body of `parseConfig` and press `Option+K` (Mac) or `Alt+K` (Windows and Linux). The prompt box gets a reference with the file path and line numbers, such as `@src/config.js#7-17`. Ask:

   ```text
   What happens if linkcheck.json holds an array instead of an object?
   ```

4. Switch the mode at the bottom of the prompt box to Manual, then ask for a small edit, such as a comment above `parseConfig`. The edit opens side by side with the original, and Claude asks for permission. Reject it.

In a JetBrains IDE:

1. Install the [Claude Code plugin](https://plugins.jetbrains.com/plugin/27310-claude-code-beta-) from the JetBrains Marketplace and restart the IDE.
2. Press `Cmd+Esc` (Mac) or `Ctrl+Esc` (Windows and Linux) to start Claude Code in the IDE's terminal.
3. Ask the same question and the same small edit: the change opens in the IDE's diff viewer.

## Your turn

1. Install the extension or the plugin for the editor you use.
2. Open `src/links.js`, select `findLinks`, and ask what kinds of links it finds, with the selection attached.
3. In Manual mode, ask for a small edit and reject it in the diff view.

## Check

You are done when all of these are true:

- [ ] The integration is installed. VS Code: `code --list-extensions` lists `anthropic.claude-code`. JetBrains: the plugin shows under **Settings** > **Plugins** > **Installed**.
- [ ] `git diff` prints nothing, because you rejected the edit.
- [ ] Self-check (not tested): you asked a question with a reference to the lines you had selected.

## Go further

- [Desktop quickstart](https://code.claude.com/docs/en/desktop-quickstart): Claude Code in the Claude desktop app.
- [VS Code commands and shortcuts](https://code.claude.com/docs/en/vs-code#vs-code-commands-and-shortcuts).

---

<sub>Sources: [VS Code](https://code.claude.com/docs/en/vs-code) · [JetBrains IDEs](https://code.claude.com/docs/en/jetbrains)</sub>

<sub>Back to the [Beginner index](../README.md) · Topic: [Memory and context](../../topics/memory-and-context.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-ide)</sub>
