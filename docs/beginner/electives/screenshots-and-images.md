# Give Claude a screenshot

<sub>**Beginner** · Elective · about 15 minutes · Needs: [Your first change, from request to commit](../03-first-change.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

## Goal

By the end of this Elective you can add a screenshot or an image to a conversation and get a change from what it shows.

## You need

- Your copy of the practice template with no uncommitted changes, and your system's screenshot tool.
- Usage: light.

> [!NOTE]
> In a Codespace, Claude Code runs inside the codespace, not on your computer ([Development containers](https://code.claude.com/docs/en/devcontainer)), so give it screenshots as files there. Save each screenshot on your computer, rename it to the name this page uses (`shot.png`, then `test-summary.png`), and drag it from your computer's file manager onto the `.practice` folder in the codespace's Explorer ([GitHub Codespaces](https://code.visualstudio.com/docs/remote/codespaces#_known-limitations-and-adaptations)). Where the Worked example says to paste, ask with its path instead, such as `Look at this image: .practice/shot.png`. In Your turn, skip the `mv` line.

## The idea

Some things are faster to show than to describe: an error on screen, a layout, a diagram. Claude Code reads images, and you can add one to the conversation in three ways ([Common workflows](https://code.claude.com/docs/en/common-workflows#work-with-images)):

- drag and drop the image into the Claude Code window;
- copy the image and paste it with `Ctrl+V` (`Cmd+V` also works in iTerm2; `Alt+V` on Windows and WSL) ([Interactive mode](https://code.claude.com/docs/en/interactive-mode#general-controls));
- give its path in your prompt, such as "Look at this image: /path/to/shot.png".

## Worked example

1. In your practice copy, run the link checker on its samples:

   ```bash
   npm run linkcheck -- samples
   ```

   It prints the broken link in `guide.md`, then `1 broken link(s)`.
2. Take a screenshot of that output and copy it to the clipboard. On a Mac, press `Ctrl` as well as the usual keys, such as `Ctrl+Shift+Cmd+4`: without it, macOS saves the screenshot as a file, on your desktop by default ([Take a screenshot on Mac](https://support.apple.com/en-us/102646)).
3. Start `claude` and paste the image. An `[Image #1]` chip appears in the prompt box ([Interactive mode](https://code.claude.com/docs/en/interactive-mode#general-controls)). If no chip appears, no image was added: drag the screenshot file into the Claude Code window, or give its path as in Your turn. Then ask:

   ```text
   This is the link checker's output. Change the last line so it also says how many Markdown files were checked, like "1 broken link(s) in 2 files".
   ```

4. Approve the edit if Claude asks. Then, in a second terminal in the same folder, run `npm run linkcheck -- samples` again. The last line now names the number of files.
5. In the second terminal, run `git diff` to see the change. Then set the example's change aside so Your turn starts clean:

   ```bash
   git stash push --include-untracked -m b-images-example
   ```

   `git status` then reads `nothing to commit, working tree clean`.

## Your turn

1. In the second terminal, run `npm test` and take a screenshot of the end of its output: the last few test names and the summary under them. Save it as a file, then move it into your practice copy's `.practice/` folder. Git ignores that folder, so the image never shows up as a change:

   ```bash
   mv "<your screenshot file>" .practice/test-summary.png
   ```

   **WSL:** Windows saves the file on its own drive, which WSL reaches under `/mnt/c` ([Working across file systems](https://learn.microsoft.com/en-us/windows/wsl/filesystems)): `C:\Users\<user name>\shot.png` is `/mnt/c/Users/<user name>/shot.png`.
2. In Claude Code (start `claude` if it isn't running), ask about it by path: `Look at this image: .practice/test-summary.png. What does each line of this summary mean?`
3. Ask for a small change based on the image, such as a clearer name for one of the tests it shows, and approve the edit if Claude asks. Check it with `git diff` in the second terminal.

## Check

This Elective has no `npm run check`: tick each item yourself. You are done when all of these are true:

- [ ] `git diff` shows the change you asked for from an image.
- [ ] Self-check (not tested): you added one image by pasting or dragging and another by path (in a Codespace, both by path).

When you're done, set your change aside so the next lesson starts clean: `git stash push --include-untracked -m b-images`. `git status` then reads `nothing to commit, working tree clean`.

## Watch out

- An image goes to Claude with your prompt. Crop out anything private, such as tokens, email addresses or customer data, before you paste it.

## Go further

- [Work with images](https://code.claude.com/docs/en/common-workflows#work-with-images): more ways to use images, such as design mockups.

---

<sub>Sources: [Common workflows](https://code.claude.com/docs/en/common-workflows) · [Interactive mode](https://code.claude.com/docs/en/interactive-mode) · [Development containers](https://code.claude.com/docs/en/devcontainer) · [GitHub Codespaces](https://code.visualstudio.com/docs/remote/codespaces) · [Take a screenshot on Mac](https://support.apple.com/en-us/102646) · [Working across file systems](https://learn.microsoft.com/en-us/windows/wsl/filesystems)</sub>

<sub>Back to the [Beginner index](../README.md) · Topic: [Memory and context](../../topics/memory-and-context.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-images)</sub>
