# Separate course machinery from the Learner project

Practice copies keep the Starter project in `project/` and the generated app, Checks, capstone briefs, course data and progress store at the copy root. Learners start Claude Code in `project/`, so whole-project exploration such as `/init` does not read answer-bearing course machinery, while the copy remains self-contained and offline.

## Consequences

- Existing copies migrate Learner-owned files into `project/` during upgrade with their contents unchanged; `.practice/learn.json` remains at the copy root.
- README warnings, prompt habits and permission deny rules are not substitutes for this structural boundary.
