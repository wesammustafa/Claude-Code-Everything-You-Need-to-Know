# Demo lesson

<sub>**Beginner** · Lesson 1 of 5 · about 20 minutes · Verified against Claude Code v2.1.285 (stable) on 2026-10-05</sub>

## Worked example

1. Type `/status`.
2. Save this script as `check.sh`:

   ```bash
   #!/bin/bash
   set -e

   claude --version > .practice/version.txt
   ```

3. End the session with `/exit`.

Your `CLAUDE.md` can name the test command:

````markdown
## Commands

```bash
npm test
```
````

A warm-up in a lesson file names the lesson it comes from:

~~~markdown
- from: b-0
```bash
npm test
```
~~~

## Your turn

1. Ask a question of your own.

## Check

Run the check.
