# Customize the status line

<sub>**Intermediate** · Elective · about 15 minutes · Needs: [Pick the model and effort](../03-model-and-effort.md) · Verified against Claude Code v2.1.285 (stable) on 2026-10-06</sub>

## Goal

By the end of this Elective you can give Claude Code a status line of your own, from a script that shows the model, the folder and how full the context window is.

## You need

- `jq`, and macOS or Linux: the script is bash. On Windows, [Windows configuration](https://code.claude.com/docs/en/statusline#windows-configuration) has PowerShell and Git Bash versions.
- Usage: none. The status line runs on your machine and uses no API tokens.

## The idea

The [status line](https://code.claude.com/docs/en/statusline) is a bar at the bottom of Claude Code that shows whatever your script prints. Claude Code runs the script with JSON about the session on stdin, such as the model's name and how full the context window is. It runs when the session starts, and again on events such as each new message from Claude.

There are two ways to set one up. `/statusline` followed by a description asks Claude Code to write the script and the setting for you. Or you write the script yourself and add a `statusLine` setting that runs it, which is what this Elective does, so you know what each part does.

## Worked example

1. Save this script as `~/.claude/statusline.sh`, then run `chmod +x ~/.claude/statusline.sh`:

   ```bash
   #!/bin/bash
   input=$(cat)
   MODEL=$(echo "$input" | jq -r '.model.display_name')
   DIR=$(echo "$input" | jq -r '.workspace.current_dir')
   PCT=$(echo "$input" | jq -r '.context_window.used_percentage // 0' | cut -d. -f1)
   echo "[$MODEL] ${DIR##*/} | ${PCT}% context"
   ```

2. Test it without Claude Code, with the kind of JSON it receives:

   ```bash
   echo '{"model":{"display_name":"Opus"},"workspace":{"current_dir":"/home/me/linkcheck"},"context_window":{"used_percentage":12.5}}' | ~/.claude/statusline.sh
   ```

   It prints `[Opus] linkcheck | 12% context`.
3. Add the setting to `~/.claude/settings.json`, your personal file, beside any keys already there:

   ```json
   "statusLine": {
     "type": "command",
     "command": "~/.claude/statusline.sh"
   }
   ```

4. Start `claude` and send a prompt. The bar shows your line, and the percentage grows as the conversation does. Claude Code runs it only in a folder whose trust dialog you accepted.

## Your turn

Add the current git branch to the line. In the script, before the `echo`, add:

```bash
BRANCH=$(git -C "$DIR" branch --show-current 2>/dev/null)
```

Then add ` | $BRANCH` to the `echo`, test the script again with the JSON from step 2, using a `current_dir` that is a git repository, and watch the bar in a session.

## Check

You are done when all of these are true:

- [ ] `jq .statusLine ~/.claude/settings.json` shows your command.
- [ ] Piping the step 2 JSON, with a `current_dir` in a git repository, into your script prints the model, the folder, the percentage and the branch.
- [ ] Self-check (not tested): in a session, the bar shows your line.

If the bar stays empty, run the script with the JSON from step 2: a script that exits with an error or prints nothing leaves the bar blank ([Troubleshooting](https://code.claude.com/docs/en/statusline#troubleshooting)). Then check that it is executable, with `chmod +x`, and that you accepted the folder's trust dialog.

## Go further

- [Available data](https://code.claude.com/docs/en/statusline#available-data): every field your script receives, such as cost, rate limits and the session's name.
- [Examples](https://code.claude.com/docs/en/statusline#examples): colors, several lines, clickable links and cached git status.

---

<sub>Sources: [Customize your status line](https://code.claude.com/docs/en/statusline)</sub>

<sub>Back to the [Intermediate index](../README.md) · Topic: [Models, effort and cost](../../topics/models-effort-and-cost.md) · [Stuck on this lesson?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml&lesson=i-status-line)</sub>
