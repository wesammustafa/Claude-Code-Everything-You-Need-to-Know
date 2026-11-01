# Brief: one review for every pull request, within limits

**From:** the team lead

We want one review for every pull request, the same on laptops and in CI, with nothing it runs left unbounded. Build it in this repository and commit all of it: the team gets only what's in git.

## What we need

1. **Two jobs at once.** Parts 2 and 3 don't depend on each other: build them at the same time, in two Claude Code sessions that can't touch each other's files, and get both changes onto `main`, however our team lands branches. Keep those working copies out of git. After both sessions commit, and while both working copies exist, save `git worktree list --porcelain` to `.practice/a-capstone-worktrees.txt`.
2. **One review, everywhere.** Our review instructions live in the repository once, as a skill in `.claude/skills/`, and every review runs them. `scripts/review-staged.sh` sends the staged changes to `claude -p` with that review and saves the JSON result: read-only tools, anything else refused without a permission prompt, a turn limit of 10 or fewer, and a spend cap with `--max-budget-usd`, above what one review costs. Run it once on a staged one-line change and save its result to `.practice/a-capstone-run.json`; that run must cost less than the cap.
3. **Our plugin, for everyone.** A marketplace inside the repository, `team-marketplace/`, with one plugin of ours. The committed `.claude/settings.json` registers it by a relative path and turns the plugin on, so nobody installs anything by hand.
4. **A sweep before a release.** A dynamic workflow that reviews each file under `src/` and has a second agent check each finding, saved to `.claude/workflows/` and committed.
5. **CI review with limits.** `.github/workflows/claude-review.yml` runs the same review on each pull request with `anthropics/claude-code-action`: pinned to a release tag or a full commit SHA, its credential from a repository secret, Claude acting with the job's own read-only token, a turn limit of 10 or fewer, allowed tools without unrestricted Bash, and a job timeout of 30 minutes or fewer. Five quick pushes must not run five reviews to the end: a `concurrency` group cancels the review a new push replaces. Its only GitHub setup is that secret, with no GitHub App. Claude reviews; a person merges.

## Done when

- `npm test` passes and nothing is left uncommitted.
- `npm run check -- a-capstone` passes.
- Then tear down, as the guide's capstone page says: delete the review workflow, the secret and, for an API key, the key itself, so no live credential is left behind.
