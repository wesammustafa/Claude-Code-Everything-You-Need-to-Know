---
name: check-links
description: Runs the link checker on a folder and explains each broken link it finds, with the file, the line and a likely fix. Use when someone asks to check links or find broken links in the docs.
---

Run `npm run linkcheck -- $ARGUMENTS` (use `.` when no folder is given).

For each broken link it reports, read the file around that line and say:

- what the link points at and why it is broken;
- a likely fix: the file or heading it probably meant.

Don't change any file in `samples/`: its broken link is there on purpose.
