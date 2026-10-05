# Give Claude a screenshot

<sub>**Beginner** · Elective · about 15 minutes · Needs: [Your first change, from request to commit](../03-first-change.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

## Goal

By the end of this Elective you can add a screenshot or an image to a conversation and get a change from what it shows.

## You need

- Your copy of the practice template with no uncommitted changes, and your system's screenshot tool.
- Usage: light.

## The idea

Some things are faster to show than to describe: an error on screen, a layout, a diagram. Claude Code reads images, and you can add one to the conversation in three ways ([Common workflows](https://code.claude.com/docs/en/common-workflows#work-with-images)):

- drag and drop the image into the Claude Code window;
- copy the image and paste it with `Ctrl+V` (`Alt+V` on Windows and WSL);
- give its path in your prompt, such as "Look at this image: /path/to/shot.png".

## Worked example

1. In your practice copy, run the link checker on its samples:

   ```bash
   npm run linkcheck -- samples
   ```

   It prints the broken link in `guide.md`, then `1 broken link(s)`.
2. Take a screenshot of that output and copy it.
3. Start `claude`, paste the image, and ask:

   ```text
   This is the link checker's output. Change the last line so it also says how many Markdown files were checked, like "1 broken link(s) in 2 files".
   ```

4. Review the plan or the edit, approve it, and run the command again. The last line now names the number of files.
5. Run `git diff` to see the change, then keep it or undo it with `git restore src`.

## Your turn

1. Run `npm test`, take a screenshot of the summary at the end, and save it as a file.
2. Start `claude` and ask about it by path: `Look at this image: <path>. What does each line of this summary mean?`
3. Ask for a small change based on the image, such as a clearer test name, and check it with `git diff`.

## Check

You are done when all of these are true:

- [ ] `git diff` shows the change you asked for from an image.
- [ ] Self-check (not tested): you added an image in two ways, by pasting and by path.

## Watch out

- An image goes to Claude with your prompt. Crop out anything private, such as tokens, email addresses or customer data, before you paste it.

## Go further

- [Work with images](https://code.claude.com/docs/en/common-workflows#work-with-images): more ways to use images, such as design mockups.

---

<sub>Sources: [Common workflows](https://code.claude.com/docs/en/common-workflows)</sub>

<sub>Back to the [Beginner index](../README.md) · Topic: [Memory and context](../../topics/memory-and-context.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=b-images)</sub>
