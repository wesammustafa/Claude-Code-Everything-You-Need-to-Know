<!-- The source of the practice copy's README. Assembly writes it to the copy as README.md and replaces each "quest-release:" link prefix with this repository's address at the release tag. Edit this file, not the generated README. -->

# Claude Code practice

Your practice copy for [Claude Code: Everything You Need to Know](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know). The lessons live in the guide. This copy holds Claude Code Quest, the app that takes you through every core lesson and capstone one step at a time, the small project you practise on, and a check for every core lesson and capstone.

An independent educational project. Not affiliated with or endorsed by Anthropic.

## Start

You need Node.js 22 or later and git. There is nothing to install with npm.

1. In one terminal, at the root of your copy, start Claude Code Quest:

   ```bash
   npm run learn
   ```

   It prints the address it serves on and opens your browser there. If the browser does not open, open the printed address yourself.
2. In a second terminal, go into `project/` and start Claude Code there, not at the root of your copy:

   ```bash
   cd project
   ```

   The lessons happen in `project/`, and the course's own folders stay outside it.

In a Codespace, `npm run learn` prints the forwarded address to open instead. Keep that port private: the app is for you alone.

## What each folder is

- `project/`: the small project you practise on, a Markdown link checker with its tests. This is where you work, and where Claude Code runs.
- `learn/`: Claude Code Quest, built for this release. It is generated: never edit it.
- `checks/`: the check for each core lesson and capstone.
- `capstone/`: the briefs for the three capstones.
- `.practice/` at the root: Claude Code Quest's saved progress.

`checks/`, `capstone/`, `learn/` and the root `.practice/` are course machinery. They sit outside `project/`, the folder you work in.

## Check your work

Each core lesson and each capstone ends with a check. Claude Code Quest runs it for you, and you can also run it yourself from `project/`:

```bash
npm run check -- b-1
```

Each item prints `PASS` or `FAIL`, with a hint for what to fix.

## Track your progress

Every push runs the **Progress** workflow, which lists each check's result in the run's summary. It never fails: an exercise you have not finished shows as "not yet". For a checklist to tick off, open an issue from the **Track my progress** template.

## Reference solutions

Each core lesson and capstone has a reference solution at the release this copy came from. Read it after an honest attempt:

- Beginner: [b-1](quest-release:solutions/b-1/), [b-2](quest-release:solutions/b-2/), [b-3](quest-release:solutions/b-3/), [b-4](quest-release:solutions/b-4/), [b-5](quest-release:solutions/b-5/), [capstone](quest-release:solutions/b-capstone/)
- Intermediate: [i-1](quest-release:solutions/i-1/), [i-2](quest-release:solutions/i-2/), [i-3](quest-release:solutions/i-3/), [i-4](quest-release:solutions/i-4/), [i-5](quest-release:solutions/i-5/), [i-6](quest-release:solutions/i-6/), [i-7](quest-release:solutions/i-7/), [i-8](quest-release:solutions/i-8/), [capstone](quest-release:solutions/i-capstone/)
- Advanced: [a-1](quest-release:solutions/a-1/), [a-2](quest-release:solutions/a-2/), [a-3](quest-release:solutions/a-3/), [a-4](quest-release:solutions/a-4/), [a-5](quest-release:solutions/a-5/), [a-6](quest-release:solutions/a-6/), [a-7](quest-release:solutions/a-7/), [capstone](quest-release:solutions/a-capstone/)

## Already have an older copy?

To bring an older practice copy up to this release, follow [Already have a practice copy?](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know#already-have-a-practice-copy) in the guide's README.

## License

The project in `project/` is under the MIT License: see [project/LICENSE](project/LICENSE). `learn/` holds the license notice of every package it bundles.
