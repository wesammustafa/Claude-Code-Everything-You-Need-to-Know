# Claude Code Quest cloud handoff

Prepared on 2026-11-02 from the local repository and worktrees. This document is the transferable record. The previous conversation and the private `.scratch/` tracker are not available in the cloud checkout.

## Evidence conventions

- **Verified** means inspected in Git or exercised by a command during this handoff.
- **Reported** means recorded in the local tracker but not independently rerun during this handoff.
- **Not started** means no implementation evidence was found. It is not a claim about the previous conversation.
- Test results below apply to the individual worktree named, not to an integrated branch containing several tickets.

## 1. Objective

### Primary interrupted task: ticket 318

The active task is `318 Polished README GIFs, and the sample Learner is Ali`.

Expected outcome:

1. Replace the sample Learner `Sam` with `Ali` throughout the app, e2e helpers, engine, host, server, tests and fixtures. The sample identity is `Ali Learner`, `ali@example.com`, and the greeting is `Hi Ali!`.
2. Recapture `pip-step-done.gif`, `pip-level-done.gif`, and `pip-looks-around.gif` from the final app with a professional, consistent first impression.
3. Keep the same scenes and general framing, with each GIF at 2x its README display width, at least 24 fps, clean motion, no cursor or loading artefacts, no personal paths, and no names other than Ali.
4. Review every frame, including the opening frame, reaction peak and loop seam. The action should start within half a second and Pip's reaction should not be cut short.
5. Keep each GIF roughly 1 to 2 MB where the quality earns it, with the largest at most 3 MB. Remove unproductive repeated frames and noise.
6. Set `PIP_GIF_BUDGET` to the largest measured GIF plus about 15 percent in `.github/scripts/rules/images.mjs`, update `CONTRIBUTING.md` and the image fixtures, and pass the Guide checks.

### Broader interrupted work

The cutover dry-runs also produced tickets 295 to 317. Their purpose is to fix app, lesson-content, Reference solution and harness defects before completing the cutover validation. Ticket 270, the Edition and Publish, and ticket 271, template housekeeping, must not proceed until their dependencies and owner gates are satisfied.

## 2. Current State

### Verified Git state

- `origin/main` is `a3dff9a`, `Claude Code Quest cutover series (#161)`.
- The root checkout's local `main` is clean at `89af496`, 23 commits ahead and 88 behind `origin/main`. It is an old local stack. Do not use it as the continuation base and do not push it.
- The interrupted ticket 318 worktree was `.claude/worktrees/318-readme-gifs`, on `quest/318-readme-gifs` at `a3dff9a`, with 44 modified paths. Its current work is preserved in the central handoff branch described below.
- Sixteen other handoff branches preserve the dirty Quest worktrees. Each branch is independent and based on the worktree's original base, mostly `e624989`, not integrated with the other ticket fixes.
- Tickets 298, 308, 311, 312 and 315 have no assigned worktree or implementation evidence. Ticket 314 has a clean worktree and no implementation evidence.
- Tickets 316 and 317 have clean assigned worktrees, but their actual implementation is in the ignored root `.scratch/learn-app/` harness. That code is complete enough to pass its tests, but is intentionally not committed and is not available in the cloud checkout.
- Many older clean `quest/*` branches are stacked construction history. Commits ahead of `origin/main` do not by themselves mean unfinished work because the final changes often landed through squash merges. Do not reopen those branches merely because they are old or ahead.
- A separate recurring process refreshes `refs/backup/*`, and another Claude session is running. Do not stop it. The handoff branches are stable commits and do not depend on those changing refs.
- All 141 current local Quest refs have exact archive copies on `origin`: local branches under `quest/local/*`, backup refs under `quest/local-backup/*`, and the older WIP ref under `quest/local-wip/*`. A scan of 160 previously unpublished commits found no secrets or private files before these archive pushes. The archive verification reported zero missing or mismatched SHAs. The old local `main`, local-only agent configuration and ignored `.scratch/` content are not included.

### Completed implementation, awaiting final acceptance

- Ticket 318: Ali replacement and all three replacement GIFs are present. Guide self-tests, Guide checks, typecheck and lint pass. Full Quest tests were started; see Testing for the final recorded result. GIF dimensions and sizes are confirmed. A complete frame-by-frame quality review is not recorded.
- Tickets 295, 296, 297, 299, 300, 301, 302, 303, 305, 306, 307, 309 and 310: implementations are present with the targeted results under Testing.
- Tickets 304 and 313: implementations are present, but each has one explained failing test. They are not done.
- Tickets 316 and 317: local ignored harness changes are present and all 26 discovered harness tests pass. They still require integration into the owner's private local process and the remaining real runs.
- The `e2e-flakes` snapshot contains two Playwright stability changes. Those changed specs have not been run during this handoff.

### Not started or no implementation evidence

- Ticket 298, b-2 plan-file wording, blocked by 295.
- Ticket 308, i-4 wording, blocked by 295.
- Ticket 311, i-6 ordering and wording, blocked by 296.
- Ticket 312, i-7 wording, blocked by 296.
- Ticket 315, a-3 goal and workflow notes, blocked by 295.
- Ticket 314, persist passed Check results and show pending slow items.
- The remaining real dry-runs, final integration, full release verification and owner approval gates.

### Reported dry-run status

The local research record says 11 of 23 Lessons were marked passed, many only after driver workarounds. Ten never started because parallel runs contended for one clean config. i-8 passed its Check but was not Learner-completable, and a-3 passed its terminal Check but could not start in the app. These are historical reported results, not a fresh validation of the current fixes.

## 3. Implementation Details

### Central ticket 318 branch

`quest/handoff-2026-11-02` starts from `b3ab2c4`, the verified ticket 318 backup snapshot, and adds this handoff.

Important changes:

- `quest/host/src/fake.ts` and the engine, host, server and client tests replace the sample identity with Ali.
- `quest/client/e2e/{b1-slice.spec.ts,overviews.ts,practice-copy.ts,snapshots.ts}` use the Ali identity.
- `assets/readme/pip-step-done.gif`: 1440 x 1060, 95 decoded frames, 4.70 seconds, 333,358 bytes. README display width is 720.
- `assets/readme/pip-level-done.gif`: 1120 x 1240, 92 decoded frames, 4.03 seconds, 1,290,758 bytes. README display width is 560.
- `assets/readme/pip-looks-around.gif`: 720 x 552, 181 decoded frames, 6.87 seconds, 1,238,119 bytes. README display width is 360.
- `README.md` updates capture dates and the level-complete alt text and caption.
- `.github/scripts/rules/images.mjs`, `CONTRIBUTING.md`, and the `image-readme-gif-too-big` fixture raise `PIP_GIF_BUDGET` from 900 KB to 1400 KB.
- No `Sam`, `sam@example`, or `/home/sam` matches remain under `quest/` or `.github/` in this snapshot.

### Independent dry-run fix branches

- `quest/handoff-295-practice-copy-git-root` at `3c4cf53`: keeps one repository at the Practice copy root. Adds an alternate root read path through `altOf` in `quest/engine/src/engine.ts`, alternate file matching and stamps in `quest/host/src/files.ts`, and root fallback helpers in `practice-template/checks/repo.mjs`. Updates workflow discovery, affected Checks, course steps and docs. Thirty-two paths changed. This is D1 option (b), read project first and then the git root, rather than making `project/` a second repository.
- `quest/handoff-296-check-from-copy-root` at `1a4a98e`: adds the root `check` script `cd project && node ../checks/run.mjs` in `quest/release/src/template.mjs` and updates template tests.
- `quest/handoff-297-b-1-step-text` at `ad53808`: corrects b-1's working directory, wording, link and Y4 beat order in `course/steps/b-1.md` and `docs/beginner/01-install-and-look-around.md`; also aligns shared wording in b-3.
- `quest/handoff-299-b-5-w2-note` at `a156e2f`: rewrites the b-5 `/init` question and names the course-only lines to remove in the step and Guide page.
- `quest/handoff-300-reference-solution-five-whys` at `91a9ef3`: adds the five-whys skill to `solutions/i-1`, updates i-1 and i-3 replay scripts, adjusts the walk seed, and adds replay coverage. The formerly untracked skill file is included and its blob was verified against the worktree.
- `quest/handoff-301-reference-solution-b-5-import` at `0dce0d8`: removes the premature `@package.json` import from b-5's solution and adds it in i-2's solution with replay tests.
- `quest/handoff-302-welcome-on-welcomed-copy` at `d28d59b`: changes a welcomed copy's Welcome action to `Continue: <next lesson>`, sends `lesson.open`, and adds component and e2e coverage.
- `quest/handoff-303-i-1-y2-do-list` at `818d422`: adds the closing line `One more edit follows the question.` and a snapshot test.
- `quest/handoff-304-i-2-beat-fixes` at `6d0dfb5`: makes i-2 W4 self-verified, exposes the Y2 prompt as a run line, and removes the premature Y4 log note in both course copies. One fingerprint-sensitive snapshot fixture fails.
- `quest/handoff-305-verify-answer-on-do` at `2d48430`: rejects `verify: answer` on non-ask beats in `quest/engine/src/content.ts` and updates parser fixtures and tests.
- `quest/handoff-306-i-3-y1-w4-beats` at `9e6961e`: merges the partial i-3 skill block into one beat and moves the review instruction to `after`.
- `quest/handoff-307-restamp-2-1-309-leftovers` at `a8d7d47`: updates legacy lesson stamps and marks the two examples as not yet tested at the edition version. It does not establish Tier 1 re-verification or a Claude session dry-run for those examples.
- `quest/handoff-309-i-5-gate-status` at `0d7d348`: runs an all-slow Check beat on arrival, preserves its result across later non-slow polls, and adds engine and Playwright tests. The Playwright test remains to be run.
- `quest/handoff-310-completion-check-summary` at `27465ff`: renders completion lines through `InlineText` and merges passing Check runs by item index so slow items remain in the completion summary. Restart clears the replay's old summary.
- `quest/handoff-313-i-capstone-content` at `671d45b`: adds a commit-setup beat before delegation, clarifies logged reviews and settings diffs, improves Check 12's uncommitted-reviewer message, and updates capstone tests. One new assertion has a case mismatch.
- `quest/handoff-e2e-flakes` at `faa505f`: pauses the Welcome pointer test clock and stubs its health check; rewrites the Playground keyboard test to judge each button by its own new log entry. Based on older `a391786`; no current-main validation has been done.

### Ignored harness work, not pushed

The root `.scratch/learn-app/tools/realrun.sh` and `.scratch/learn-app/playbook/real-runs.md` contain tickets 316 and 317:

- Atomic per-config locking uses `mkdir` under `$LEARN_RUNS/state/cfg.lock-<hash>`, live-holder checks, stale-lock reclaim and release on finish or abort.
- Symlink resolution finds the harness's real directory.
- `find -H` covers temporary symlinked paths.
- The URL opens `#/lesson/<id>`.
- The npm global prefix is included in `OUTSIDE`.
- Copy runs `npm run build` and requires a fresh server bundle.
- The playbook says b-1 W1 is skipped under the pinned install and documents one `LEARN_CFG` per lane.

These files are private by repository rule. Do not commit `.scratch/` or copy private session records into a public branch. The cloud agent needs the owner to provide these two files through an approved private channel, or must reconstruct the changes from the summary above. This is the only known implementation not preserved on GitHub.

## 4. Git State and Branch Use

Start with:

```bash
git fetch origin
git switch quest/handoff-2026-11-02
```

The central branch contains ticket 318 and this file. Check out each independent `quest/handoff-*` branch only when working on that ticket. Do not merge all branches into one integration branch up front: several touch the same engine, host, course and test files, and the project requires one change per PR.

The handoff branches were created from exact backup commits. Every original worktree and original branch remains intact. No reset, clean, force-push, rebase or deletion was used.

## 5. Remaining Work

Work in this order:

1. **Read this file and inspect the branch diff before editing.** Do not assume the private tracker exists. Treat each ticket branch as unfinished until its acceptance and required tests pass.
2. **Finish ticket 318.** Record the full Quest test result. Inspect every GIF frame, the loop seam and displayed-size readability. Resolve the frame-rate evidence described under Known Issues. Run the image self-tests and Guide check again after any change. Do not recapture merely to repeat completed work if the existing GIFs pass review.
3. **Fix ticket 304's fixture setup.** The product reset is working: the saved fixture has no current fingerprint after the lesson's verification changed. Give the test an explicit current fingerprint or deliberately construct a current save, then rerun the snapshot and content tests. Do not weaken fingerprint migration behavior to make the fixture pass.
4. **Fix ticket 313's failed assertion.** The test expects `No reviewer is committed yet`, while the implementation returns `no reviewer is committed yet` inside a longer sentence. Choose the intended casing and rerun the Intermediate Checks and ladders.
5. **Complete each existing ticket's acceptance checks.** In particular, run the new e2e tests for 302 and 309, the real-template `lesson-quotes` check for 297 and 299, and Tier 1 re-verification plus any required session tests for 307. Run the changed `e2e-flakes` specs on a current base before using them.
6. **Recover or reconstruct the private 316/317 harness files with the owner.** Do not publish private configs, logs or session records. Keep the 26-test harness suite green.
7. **Implement missing tickets in dependency order.** Start 314 independently. After 295, do 298, 308 and 315. After 296, do 311 and 312. Use the acceptance points in Current State and the dry-run findings summarized here.
8. **Integrate one ticket per PR onto the then-current `origin/main`.** Resolve overlapping engine and course changes deliberately. Run the repository's full verification on the integrated result, not only the isolated branches.
9. **Resume real dry-runs serially or with separately authorized clean configs.** Re-run fixed Lessons before declaring them passed. Complete b-3, b-4, b-capstone, a-1, a-2, a-4, a-5, a-6, a-7 and a-capstone, plus fresh evidence for the previously workaround-driven passes.
10. **Only after every cutover gate is green, consider 270 and 271.** The Publish, template deletion and housekeeping steps require their explicit owner moments. Do not perform them autonomously from this handoff.

## 6. Testing

### Ticket 318

Passed in `.claude/worktrees/318-readme-gifs`:

- `npm run guide:selftest`: 115 tests passed.
- `npm run guide`: all listed rules passed.
- `npm run typecheck`: passed.
- `npm run lint`: ESLint and Prettier passed.
- `git diff --check` for ticket 318 and the other inspected snapshots: passed.
- Secret scan of all 17 backup diffs: no private keys, token patterns, personal paths or unapproved email addresses found.
- GIF metadata was read with `ffprobe`. All widths are exactly 2x their README display widths.
- First frames and sampled contact sheets at two samples per second were visually inspected. They showed the intended scenes and Ali greeting, with no obvious personal path or browser chrome. This is not a frame-by-frame review.

The first `npm run test:quest` attempt ran for 15 minutes before the command timed out with no final summary. A later unrestricted rerun completed in 1063.02 seconds: 180 test files passed and one failed; 3,109 tests passed, one failed and two skipped. The only failure was `quest/release/test/replay.test.ts > the replay's contract > both CLIs resolve a relative path from INIT_CWD, where npm was typed`, which exceeded its 5,000 ms timeout during the full-suite load. The identical isolated test then passed in 834 ms. This is a load-sensitive test timeout, but the full suite remains red until the timeout is addressed and a complete run passes. No implementation was changed during these verification runs.

### Dry-run fix branches

- 295: typecheck passed; five targeted Vitest files passed, 198 tests.
- 296: `quest/release/test/template.test.ts`, 50 tests passed.
- 297: lesson tests, 39 passed; `npm run guide` passed with a `lesson-quotes` warning requiring the real template check.
- 299: lesson tests, 39 passed; `npm run guide` passed with the same kind of external-template warning.
- 300: `quest/release/test/replay.test.ts`, 14 tests passed, including both new i-1 seed tests and the full fail-then-pass replay.
- 301: `quest/release/test/replay.test.ts`, 14 tests passed, including both new b-5/i-2 import tests.
- 302: `quest/client/src/screens/screens.test.tsx`, 418 tests passed. The run printed existing jsdom `scrollTo` notices and HTML nesting warnings for `figure`/`figcaption` inside `p`; those warnings were not triaged.
- 303: snapshot tests, 37 passed; lesson tests, 39 passed.
- 304: content and redo tests passed, but the three-file run had 136 passes and one failure. The isolated snapshot failure also reproduced, and passed on the older base. Root cause was confirmed with a direct driver probe: the save lacked a current fingerprint and the edited i-2 verification caused the intended changed-Lesson reset to overview.
- 305: three targeted engine files, 107 tests passed.
- 306: lesson tests, 39 passed; snapshot tests, 36 passed.
- 307: lesson tests, 39 passed; `npm run guide` passed; both example smoke tests passed. These smoke tests do not prove the removed session-test claims.
- 309: `quest/engine/test/lesson-flow-checks.test.mjs`, 45 tests passed. The new Playwright scenario was not run.
- 310: three targeted engine/client files, 70 tests passed.
- 313: `node --test practice-template/checks/test/intermediate.test.mjs practice-template/checks/test/learn-ladders.test.mjs`: 75 passed, one failed. The failure is only the new reviewer-message assertion's uppercase/lowercase mismatch; the actual Check behavior and message were present.
- 316 and 317: `python3 -m unittest discover -s .scratch/learn-app/tools/test -p 'test_realrun_*.py' -v`: 26 tests passed, covering concurrent lock acquisition, stale locks, finish restoration, symlinks, temporary paths, npm prefix and lesson URLs.

### Not run during this handoff

- The complete `npm run verify` on any integrated tree.
- `npm run build`, `npm run e2e`, `npm run proof`, `npm run budgets`, and platform-specific CI on the handoff branches.
- The changed Playwright specs in `quest/handoff-e2e-flakes`.
- New real Claude Code dry-runs, Codespace runs, owner walkthrough, VoiceOver pass, Edition gate, Publish or template housekeeping.

## 7. Known Issues

- **318 frame-rate acceptance is not settled.** `ffprobe` reports `avg_frame_rate` 25/1 for step and level, and 100/3 for looks. Counting decoded frames over full duration, including intentional terminal holds, gives 20.21, 22.83 and 26.35 frames per second respectively. The first two therefore need an explicit acceptance decision or a capture/encoding adjustment against the ticket's at-least-24-fps wording. Do not claim this criterion passes from `r_frame_rate` alone.
- **318 full visual review is incomplete.** The existing review was sampled, not all 95, 92 and 181 frames. A separate decoded-frame analysis found no exact consecutive duplicates. At 32 x 32 RGB resolution, first-to-last mean absolute differences were 1.764 for step, 16.021 for level and 1.265 for looks, so level has the largest loop-seam change. Loop equality and subtle dithering or dropped-frame artefacts remain unverified.
- **318 full Quest suite is red on a load-sensitive timeout.** The completed run's only failure was the replay CLI test's 5-second timeout under load; it passed alone in 834 ms. The timeout needs an intentional fix and a complete green rerun before ticket 318 can be called verified.
- **304 has one red test**, caused by a stale fixture save rather than evidence that the new fingerprint behavior is wrong. It must be fixed and rerun before the ticket is called done.
- **313 has one red test**, caused by reviewer-message casing. It must be fixed and rerun before the ticket is called done.
- **297 and 299 still need the real-template quote check** using `LEARN_DIR`; the normal Guide check only warned about it.
- **307 does not yet prove current-version behavior.** It replaces stale test lines with `Not yet tested in a session at this edition's version`; Tier 1 verification and required session testing remain.
- **Several branches share an older base.** Revalidate after integrating with current main and with each other. In particular, 295, 309 and 310 overlap in the engine, and content tickets may change course fingerprints and snapshots.
- **The private 316/317 implementation is not on GitHub.** This is a transfer limitation imposed by the repository's `.scratch/` rule, not a missing test result.
- **Owner-only dry-run items remain:** choose serial runs or separate signed-in configs, agree the a-1 push remote, attend the GitHub and secret steps for a-5 and a-capstone, and decide how to handle Chrome prompts and remaining quota.
- A local private q-b-1 log reportedly contains an unredacted personal email. Do not read it into a public artifact or commit it. The i-8 run also reportedly left global npm packages behind; owner cleanup is undecided.

## 8. Constraints

- Keep the app local-first: bind `127.0.0.1`, make no runtime outbound requests, never call the Claude API, never read `.env`, and run only the Check child and read-only git.
- Read only the Practice copy and chosen Work folders. Write only `.practice/` through the store. Never log file contents, credentials, headers or tokens.
- Every word about Claude Code shown by the app must be an exact Guide quote. The app's own words state no Claude Code fact. Name no keyboard key on screen or in a step file.
- Preserve the Learner vocabulary: Lesson, Level, Step, Check, Badge, Mastery and Practice copy. Do not use game terminology.
- Keep Pip script-free and event-driven. Do not add Luau, export from the Free Rive Editor, or introduce a new renderer as part of these fixes.
- Strict TypeScript settings and existing lint rules must not be weakened. Checks remain plain JavaScript with `// @ts-check` and JSDoc. Do not edit the Starter project to make a check pass.
- Dependencies are exact and `npm ci` is required. New bundled dependencies need owner approval, an allowed license and notices.
- Use one change and one commit per ticket when preparing final PRs. No AI attribution in commits, PRs or files.
- Keep `.scratch/` ignored. Do not publish credentials, personal settings, session transcripts, private logs or real-run configs.
- Do not force-push, overwrite remote branches, delete work, merge to `main`, tag, Publish or delete template branches from this handoff.
- Guide content changes require the project's Tier 1 verification and citation rules. App source, app words and step files use no em dash or emoji.

## 9. Environment

Required setup in a fresh checkout:

```bash
nvm use
npm ci
npx playwright install chromium
```

The repository pins Node 26 in `.nvmrc`. Node 26.13.0 and npm 11.20.0 were used for this handoff. GIF inspection used `ffprobe` and `ffmpeg`; `gifski` is available on the maintainer's machine if recapture or re-encoding is needed.

Common verification commands from the repository root:

```bash
npm run guide:selftest
npm run guide
npm run typecheck
npm run lint
npm run test:quest
npm run test:lessons
npm run test:checks
npm run test:starter
npm run build
npm run e2e
npm run verify
npm run proof
npm run budgets
```

Environment variable names used by the existing tooling, with no values supplied here:

- `LEARN_DIR`: the real template's lesson directory for the external quote check.
- `LEARN_QUEST`: checkout used by the real-run harness.
- `LEARN_RUNS`, `LEARN_CFG`, `LEARN_BASELINE`, `LEARN_COPIES`, `CLAUDE_BIN`, `LEARN_GIT_EXCLUDES`: real-run paths, config selection, baseline and excludes handling.
- `CODESPACE_NAME`, `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN`: Codespace forwarded-address validation.
- `SOLUTION`, `COPY`: Reference solution replay inputs.
- `DISABLE_UPDATES`: prevents the pinned real-run Claude Code from updating.

No secret value is included in this document. Owner sign-in and credential steps remain owner steps.

## 10. Continuation Instructions

Claude Code Cloud should continue from `quest/handoff-2026-11-02` and treat this document plus the pushed branch diffs as the available evidence. It does not need the previous local conversation.

Do not redo the branch audit or recapture work that already passes review. Do not claim any ticket complete from implementation presence alone. Start with the ordered checklist, preserve the independent branch structure, and run new verification after each change and again after integration.

When a required private harness file or owner credential is needed, stop only that step, report the exact blocker, and continue unrelated validation that is safe. Never work around the `.scratch/` privacy rule or the owner-only Publish and credential gates.
