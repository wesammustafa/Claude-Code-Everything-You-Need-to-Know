# Verify UI changes in the browser with Claude in Chrome

<sub>**Intermediate** · Elective · about 15 minutes · Needs: [Connect a tool with MCP](../07-mcp.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-06</sub>

## Goal

By the end of this Elective you can connect Claude Code to your own browser, and have Claude check a page you changed: its console, what it shows, and a screenshot.

## You need

- Google Chrome or Microsoft Edge with the [Claude in Chrome extension](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn), version 1.0.36 or later ([Prerequisites](https://code.claude.com/docs/en/chrome#prerequisites)).
- A Pro, Max, Team or Enterprise plan, signed in with `/login`. With an API key, Claude Code keeps Chrome integration off.
- macOS, Linux or native Windows: Chrome integration isn't supported in WSL.
- One of your own repositories with its `.practice/` folder, and `python3` to serve a page locally.
- Usage: light.

## The idea

[Claude in Chrome](https://code.claude.com/docs/en/chrome) connects Claude Code to the browser you use every day, through its extension. Claude opens its own tabs in a visible window, so you watch it work, and it stops to let you handle a login page or a CAPTCHA.

Unlike [lesson 7](../07-mcp.md)'s Chrome DevTools MCP server, which you ran with a temporary profile, it shares your browser's login state: Claude can reach any site you're signed in to. The extension's site permissions decide which sites Claude may browse, click and type on.

> [!WARNING]
> Claude acts with your logins. Keep it to the sites the task needs, and read each `Claude in Chrome wants to` prompt before you allow a site.

## Worked example

1. Save a page with a bug in it, then serve the folder to this computer only:

   ```bash
   cat > .practice/ui-demo.html <<'EOF'
   <!doctype html>
   <title>Linkcheck status</title>
   <h1>Linkcheck status</h1>
   <p id="status">Loading...</p>
   <script>document.getElementById('stauts').textContent = 'Ready';</script>
   EOF
   python3 -m http.server 8000 --bind 127.0.0.1 --directory .practice
   ```

2. In a second terminal, start Claude Code with Chrome: `claude --chrome`. The first time, a dialog explains the integration; press `Enter`.
3. Run `/chrome`. When it shows `Status: Enabled` and `Extension: Installed`, the integration works. If not, quit Claude Code, restart Chrome, and run `claude --chrome` again: the first time, Claude Code installs a connection file that Chrome reads only at startup ([Extension not detected](https://code.claude.com/docs/en/chrome#extension-not-detected)).
4. Ask:

   ```text
   Open http://127.0.0.1:8000/ui-demo.html and tell me what the page shows. Read its console for errors, reloading the page if you need to catch errors from page load, and save a screenshot of it to disk.
   ```

   Approve each prompt that starts with `Claude in Chrome wants to`; for the site, you can allow all its actions for the session. Claude opens a tab, tells you the page still says `Loading...` and what the console shows, and gives the screenshot's path. Your wording will differ.

## Your turn

Fix the bug, and have Claude prove the fix in the browser.

1. Ask Claude to fix the script in `.practice/ui-demo.html` so the page says `Ready`.
2. Ask it to reload the page in Chrome, read the console again, and save a new screenshot.

## Check

You are done when all of these are true:

- [ ] `/chrome` shows `Status: Enabled` and `Extension: Installed`.
- [ ] Both screenshots exist: `ls -l` on each path Claude reported.
- [ ] Self-check (not tested): after the fix, the console showed no errors, and the new screenshot shows `Ready`.

If Claude doesn't use the browser, start the session with `--chrome`, or run `/chrome` and select **Enabled by default**. That keeps the browser tools loaded in every session, which uses more context.

## Go further

- [Use Claude Code with Chrome](https://code.claude.com/docs/en/chrome): more workflows, from filling forms to recording a GIF, and troubleshooting.
- [Get started with Claude in Chrome](https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome): the extension itself, including its shortcuts and permissions.

---

<sub>Sources: [Use Claude Code with Chrome](https://code.claude.com/docs/en/chrome)</sub>

<sub>Back to the [Intermediate index](../README.md) · Topic: [MCP](../../topics/mcp.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=i-chrome)</sub>
