---
lesson: a-capstone
stamp: "Verified against Claude Code v2.1.285 (stable) on 2026-10-05"
---

## steps

### T1 | The task step 1 of 2 | Version
- tier: challenge
- skill: save-version
- where: terminal
- beat: do
- verify: self
- goal: "Save the version."

### C | Check | Run the check
- beat: do
- verify: self
- goal: "Run the check."

### D1 | Tear down step 1 of 2 | Workflow
- tier: challenge
- skill: remove-workflow
- where: terminal
- beat: do
- verify: self
- goal: "Delete the workflow."
