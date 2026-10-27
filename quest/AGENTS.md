# Rules for agents working on Claude Code Quest

These rules apply when you change Claude Code Quest, the web learning app: its source in `quest/`, the course in `course/`, the Practice template's files in `practice-template/` and the Reference solutions in `solutions/`. The Guide's contributor policy in [CONTRIBUTING.md](../CONTRIBUTING.md) still applies to every Guide page you touch; its App code section is the full policy this file digests.

## Safety contract

Every change keeps the app safety contract:

- the app binds `127.0.0.1` and makes no outbound request at runtime (no telemetry, CDN, web font or update check);
- reads only the Practice copy and the Learner's Work folders, writes only `.practice/` through the store, and runs only the Check child and read-only git;
- never reads `.env` files, never calls the Claude API, never logs file contents or command output beyond the verification lines;
- its own wording states no Claude Code fact;
- every bundled dependency is pinned, on the license allowlist and credited in the notices.

## Copy

- Make every word about Claude Code that the app shows an exact quote from a Guide page. The app's own words state no Claude Code fact.
- Name no key, anywhere on screen or in a step file.
- Let Pip say only what the app saw, in app words: never as a chat, never as Claude, and never judging work.
- Use the Learner's words: Lesson, Level, Step, Check, Badge, Mastery, Practice copy. Never put these on screen: world, mission, beat, XP, score, rank, level up, achievement, trophy, medal, or "Quest" alone.
- Write Mastery as "Every command shown", "With hints" or "On your own".
- Show a Check's Not yet in amber, reassuring, never red and never blaming.

## Dependencies

- Add a dependency bundled into the Practice template only with the owner's OK, and only under a license on the allowlist: MIT, ISC, BSD-2-Clause, BSD-3-Clause or Apache-2.0; MIT-Modern-Variant or MIT-0 for code compiled into Rive's WASM; OFL-1.1 for fonts.
- Pin every dependency to an exact version and install with `npm ci`.
- Name each new dev dependency, with its reason, in the pull request that adds it.

## Code and tests

- Write every `quest/` package in strict TypeScript, extending `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`), with a reference in the root `tsconfig.json`. `tsc -b` only type-checks. Never weaken a compiler option or a lint rule to make a check pass.
- Keep the Checks plain JavaScript, checked through `// @ts-check` and JSDoc, and leave the Starter project as it is.
- Test a `quest/` package with Vitest inside that package; the Checks' tests live in `practice-template/checks/test/` and the Guide's rules' tests in `.github/scripts/test/`, both on `node:test`.
- Verify a change from the repo root: `npm run typecheck`, `npm run lint` (ESLint, then `prettier --check quest`), `npm run test:quest`, `npm run build` (the client, and the server bundle once it exists), `npm run e2e` (Playwright on the built client, served by `vite preview` on `127.0.0.1`; install its browser once with `npx playwright install chromium`), `npm run guide`, and `npm run verify` for everything CI runs.

## Pip

- Keep Pip's rig script-free: never add a Luau script.
- Never export Pip from the Rive Editor on the Free plan.
- Build the rig only with the pinned Rive CLI, through the build script.
- Never commit the `CLAUDE.md` or `AGENTS.md` that `rive create` writes.

## Writing

- No em dashes and no emoji, in the app's words, the step files or the source.
- No AI attribution in commits, pull requests or files.
