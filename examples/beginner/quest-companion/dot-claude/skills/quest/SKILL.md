---
# What: a project skill that reads Claude Code Quest's saved progress in your practice copy and answers where you are: the lesson, the step and what its check looks for.
# Runs: when you type /quest, or when Claude matches your request to the description.
# Side effects: none intended. It reads .practice/learn.json and the lesson's step file and changes no files; each tool call still follows your permission settings.
# Requires: Claude Code, in a practice copy where Claude Code Quest has saved progress. Platforms: any.
# Remove: delete .claude/skills/quest/.
# Not yet tested in a session at this edition's version
name: quest
description: Says where you are in Claude Code Quest, the practice copy's learning app, and what the current step's check looks for. Use when the user asks which lesson or step they are on, what the quest wants next, or why a check is failing.
argument-hint: "[question]"
disable-model-invocation: true
---

Answer this about my place in Claude Code Quest: $ARGUMENTS

If no question is given, say which lesson and step I am on and what the step asks for, then stop.

1. Read `.practice/learn.json` at the root of this practice copy. Under `lessons`, the lesson whose `step` is not null and whose `complete` is false is the one in play; its `step` names the step (`W1`, `Y2`, `C` and so on) and `done` lists the steps finished. If no lesson has a step, say the app has not started a lesson yet and stop.
2. Read `learn/course.json`, the course the app plays. Under `lessons`, find the entry whose `id` is that lesson: its `title`; `content.steps`, each step with its `id`, `title`, `part` and `beats`, whose `lines` hold the step's `goal`, `run`, `hint`, `verify` and the rest; `items`, the check's items with the words each one looks for; and `content.ladder`, the first question the app asks when an item fails.
3. Say, in a few lines: the lesson's title, the step's title and goal, and which part of the lesson it is in (Worked example, Your turn or Check). Quote its `run` lines in code spans when it has any.
4. If the step's `verify` says `check`, say in plain words what each item it names looks for, from the lesson's `items`, and the first question its ladder asks when it fails.
5. If I asked why a check fails, compare what the ladder looks for with the files it names, read those files, and say what differs. Do not edit them: the lesson is for me to do.

Read only `.practice/learn.json`, `learn/course.json`, `checks/` and the files a step names. Change no files.
