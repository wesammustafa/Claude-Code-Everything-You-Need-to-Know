# Contributing

Thanks for your interest in improving this guide. This is a learning resource — clear, practical, and beginner-friendly explanations beat thorough-but-overwhelming ones.

## Ways to contribute

| You want to | Do this |
|---|---|
| Report a stale or wrong fact | Open a [stale-content issue](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=stale-content.yml) with a link to a source that shows the current fact. |
| Get stuck on a lesson | Use the lesson's "Stuck on this lesson?" link, which opens a [lesson-feedback issue](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=lesson-feedback.yml) with the lesson filled in. |
| Report a broken link, script or example | Open a [bug report](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=bug.yml). |
| Suggest a third-party tool, MCP server, skill, plugin, course or article | Use the [Suggest a resource form](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=suggest-resource.yml). Unsolicited pull requests that add listings are closed; see the [Listing policy](#listing-policy). |
| Improve an explanation or fix a fact | Open a pull request. Follow [Sources and citations](#sources-and-citations), [Pull requests](#pull-requests) and the [Doc style guide](#doc-style-guide). |
| Expand a thin section | Open a pull request. SDLC walkthroughs, new workflow recipes, and copy-ready examples for a lesson (see [Adding a skill](#adding-a-skill)) are all high-value. |

### While the guide is reworked

The guide is being reworked into lessons in three levels.

- Fixes to content the rework keeps are welcome and reviewed as usual.
- A pull request that changes content scheduled for removal is closed with thanks and the one-line reason for the cut.
- Pull requests that add listings are closed under the [Listing policy](#listing-policy).
- Stale-content issues get a first response within 7 days: a correction, or the Tier 1 source that settles it. Lesson-feedback issues get a first response within 7 days too.

## Sources and citations

### Which source counts

Each kind of claim has one **Tier 1** source. It is the authoritative source for that kind of claim.

| Claim | Tier 1 source |
|---|---|
| Claude Code behavior: commands, flags, settings, hook events, stability labels | [code.claude.com/docs](https://code.claude.com/docs) |
| When something shipped, versions, release channels | The [anthropics/claude-code CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md); the npm `latest` and `stable` dist-tags of `@anthropic-ai/claude-code` |
| Models, model IDs, API limits | [platform.claude.com docs](https://platform.claude.com/docs) |
| Plan prices and plan features | [claude.com/pricing](https://claude.com/pricing) and the plan support articles on [support.claude.com](https://support.claude.com) |
| API prices | [platform.claude.com pricing](https://platform.claude.com/docs/en/about-claude/pricing) |
| MCP protocol | [modelcontextprotocol.io](https://modelcontextprotocol.io) |
| GitHub behavior | [docs.github.com](https://docs.github.com) |
| A third-party tool's install and usage | That tool's own repo or docs |

- **Tier 2** is any other first-party source: support.claude.com, anthropic.com news and engineering posts, claude.com/blog, [Claude Academy](https://academy.claude.com), first-party repo READMEs, and the official plugin [`marketplace.json`](https://github.com/anthropics/claude-plugins-official/blob/main/.claude-plugin/marketplace.json).
- **Tier 3** is everything else. Attribute it in the sentence, and never use it as the only source for how Claude Code behaves.

### When sources disagree

1. The Tier 1 source for that kind of claim wins.
2. Within one tier, the more specific page beats the general one, then the newer or version-anchored page beats the older one.
3. The docs win on current behavior; the CHANGELOG wins on when something changed.
4. If that does not settle it, state only what both sources support, or leave the claim out. Never pick a side silently: record the conflict in the PR description.

Two open conflicts, recorded on 2026-10-05:

- The [setup page](https://code.claude.com/docs/en/setup) says the npm package requires "Node.js 22 or later"; the support article [Your first day in Claude Code](https://support.claude.com/en/articles/14552382-your-first-day-in-claude-code) says "npm (Node 18+)". The setup page wins: it is Tier 1, the article is Tier 2.
- The [output styles docs](https://code.claude.com/docs/en/output-styles) list Learning as a built-in style; the official `marketplace.json` calls it "the unshipped Learning output style". The docs win for the same reason.

### What needs a citation

A **volatile claim** is a statement that can go stale. Every volatile claim needs a source:

- a version or a date
- a price, plan availability, or a usage or rate limit
- a model name, model ID or default
- the name or behavior of a command, flag, setting, environment variable, hook event, tool or frontmatter field
- a stability label (preview, beta, research preview, deprecated), copied word for word from the Tier 1 source
- any count or statistic
- a third-party status fact: owner, license, archived

Mental models, analogies, the guide's own advice, and how-to steps whose commands are already cited on the same page need no citation.

### How to cite

- Link the Tier 1 page inline at the first mention of each volatile claim on a page, not at every repeat.
- Give each page a one-line `Sources:` footer that lists the pages it relies on. It ends the page, except on a lesson, where the navigation links follow it.
- Anchor date-sensitive claims to a version (`v2.1.x`) or a full date.
- Do not add access dates inline.

```markdown
Set `disable-model-invocation: true` to stop Claude from loading a skill on its own ([Skills](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill)).

Sources: [Skills](https://code.claude.com/docs/en/skills), [Permissions](https://code.claude.com/docs/en/permissions)
```

### What the guide does not carry

- No prices, promos, plan limits, retirement dates, model spec tables or "as of" prose. A page's stamp carries the date for everything on it. Any other figure a lesson truly needs is written with the full date in the sentence (`on <full date>, ...`) plus its link.
- Stability labels are quoted word for word in a `> [!NOTE]` alert under the heading, never in the heading text.
- A future date is rare. It gets a full date, a Tier 1 link, and an expiry marker after the sentence: `<!-- expires: YYYY-MM-DD -->`. The pull request checks warn, without failing, once a marker is due within 30 days.

### The stamp

Lessons, Electives, capstones, level indexes, topic indexes and reference pages that are not stubs carry a stamp as the last field of the header line under their H1:

```text
Verified against Claude Code vX.Y.Z (stable) on YYYY-MM-DD
```

It certifies that on that date every volatile claim on the page was checked against its Tier 1 source at that `stable` version, and that the page's exercise and check, if any, were dry-run there. It does not certify third-party items beyond the [listing bar](#the-listing-bar), or behavior on other release channels and surfaces. The README, the community files, stubs and pages from the previous edition carry no stamp.

The `stamps` rule in the [checks](#checks) fails on a stamped page whose Stamp is missing or malformed. Once README carries a trust strip, it also fails if the strip's version differs from the latest edition entry in [CHANGELOG.md](CHANGELOG.md).

### Editions and corrections

Each release has an entry in [CHANGELOG.md](CHANGELOG.md), newest first:

- an edition: `## vYYYY.MM - YYYY-MM-DD`, with the line `Verified against Claude Code vX.Y.Z (stable).` under it;
- a correction: `## vYYYY.MM.N - YYYY-MM-DD`.

Pushing a `v*` tag runs the edition gate. On an edition tag, every stamped page's Stamp must name the edition's version. On a correction tag, every stamped page changed since the previous tag must carry a Stamp dated after that tag's entry.

### Numbers, benchmarks and estimates

| Kind | Rule |
|---|---|
| Any number | No number without a dated, linked source. Cut unsourced numbers, or reword the sentence without them. The guide's own metadata, such as a lesson's time estimate, needs no source. |
| Third-party adoption counts (stars, downloads, installs) | Keep them out of the guide's text; they belong in the resource suggestion issue that reviewed the item. Exception: an ecosystem figure a lesson needs, written with the full date in the sentence (`on <full date>, ...`) plus its link, never `as of`. The README's own star badge is fine. |
| Vendor benchmarks | Always attribute them in the sentence ("Anthropic reports ...") and link them. |
| Third-party plan-limit estimates | Cut them and link the official plan pages instead: [What is the Pro plan?](https://support.claude.com/en/articles/8325606-what-is-the-pro-plan), [What is the Max plan?](https://support.claude.com/en/articles/11049741-what-is-the-max-plan), [Use Claude Code with your Pro or Max plan](https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan). |
| Author heuristics | Reword them as advice with no invented precision: "usually the fix is upstream", not "~80% of the time". |

### Undocumented behavior

The guide does not teach behavior that no Tier 1 or Tier 2 source documents. If a lesson cannot work without it, raise it with the maintainer; it goes in only with the maintainer's sign-off.

<a id="adding-an-mcp-server-walkthrough"></a>
## Listing policy

A listing is an external item the guide points you to as something to use or read: a tool, MCP server, skill, plugin, course or article.

### Where listings appear

- A third-party item appears only where a lesson uses it. Items from Anthropic or the MCP project may also appear on a reference page that uses them.
- No catalogs. Each topic ends with one "Find more" pointer: Anthropic's plugin marketplaces and the [MCP Registry](https://registry.modelcontextprotocol.io) (labelled "preview", [its own wording](https://modelcontextprotocol.io/registry/about)), plus at most two curated lists that clear the listing bar.
- Unlinked, name-only lists are cut.

### Labels

Each listing carries one label:

| Label | Meaning |
|---|---|
| **Anthropic** | Made by Anthropic |
| **Vendor** | A maker's own tool for its own product, such as Microsoft's Playwright MCP server or the MCP project's reference servers |
| **Community** | Any other third-party item |

Each section with listings carries one line, `Listings checked against the listing bar on <full date>.` Rows carry no dates.

### The listing bar

To add any other Vendor or Community item, every add rule must hold. At each review, an item is removed if any removal rule holds. Tier 1 means the authoritative source for that kind of claim, such as [code.claude.com/docs](https://code.claude.com/docs) for Claude Code behavior.

| Check | Add rule (all must hold) | Removal rule (any one removes it) |
|---|---|---|
| Lesson | A named lesson needs it | No rule |
| License | Public repo with an [OSI-approved license](https://opensource.org/licenses) (CC BY, CC BY-SA or CC0 for docs-only resources) | No rule |
| Activity | A default-branch commit within the last 90 days | No default-branch commit in 12 months |
| Adoption | At least 1,000 GitHub stars, or at least 1,000 weekly npm or PyPI downloads, or at least 10,000 marketplace installs, measured on a stated date | Under 100 stars and under 1,000 weekly downloads, with no Anthropic marketplace listing |
| Accuracy | Nothing it says about Claude Code contradicts Tier 1 | It contradicts Tier 1 |
| Hosted service | Its core function does not depend on a proprietary hosted service, unless it is a vendor's own tool for its own product, labelled `needs a <vendor> account` | No rule |
| Status | No rule | Archived or deprecated upstream, or its canonical URL or repo returns 404 |

**Anthropic and MCP-project items** need only a lesson or reference page that uses them, a live URL, and no "not maintained" or "not official" disclaimer. This includes the MCP project's reference servers, which carry the Vendor label because the label names the maker.

### Security caveat

Every section that lists an item that runs code or gets tool access (MCP servers, hooks, plugins, skills with scripts) carries this line once:

> Third-party: it can run code on your machine or give Claude new tools. Review it before installing; this guide does not audit it.

The guide does not security-audit listings.

### Suggesting a resource

- Listings are added at a content review, not through contributors' pull requests. A listing added at a review links that review's pull request. To suggest one, use the [Suggest a resource form](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=suggest-resource.yml); its required fields ask for the evidence the bar needs.
- An unsolicited pull request that adds a listing is closed with a reply that points to the form.
- Suggestions that clear the bar wait for the next content review. Nothing merges ad hoc.
- Suggesting your own project is allowed. Disclose your affiliation; the same bar applies.

## AI-assisted contributions

AI-assisted contributions are allowed, and you do not need to disclose them. You own every claim you submit, the same citation rules apply, and pull requests with claims that cannot be verified are closed, whoever or whatever wrote them.

## Pull requests

Each pull request carries one change. Fill in every section of the [pull request template](.github/PULL_REQUEST_TEMPLATE.md) that applies.

- **Baseline.** Changes are verified against one `stable` Claude Code version, named in the Unreleased entry of [CHANGELOG.md](CHANGELOG.md) and frozen while an edition is built. A later `stable` release is pulled in early only when it removes, renames or changes the default of something a lesson teaches, as its own pull request. Before an edition ships, a final pass verifies every stamped page at the then-current `stable` and re-stamps it.
- **Claim table.** Every volatile claim added or changed links its Tier 1 source. The description holds a claim table (claim, source, result), filled by a second, independent pass that tried to refute each claim against Tier 1: a separate agent for agent-made pull requests, the reviewer for human ones.
- **Tested field.** A pull request that touches `examples/` or `.claude/` states `Tested in Claude Code vX.Y.Z on <OS>`, or "smoke test only" if the change was not run in a session.
- **Dry-run.** Lesson pull requests, and example pull requests whose example a core lesson or capstone uses, record a dry-run of each exercise and check at the baseline, in a clean configuration:
  1. Install the baseline version with `curl -fsSL https://claude.ai/install.sh | bash -s <version>` ([Advanced setup](https://code.claude.com/docs/en/setup)).
  2. After the install, export `DISABLE_UPDATES=1` in the dry-run shell. A native install keeps updating itself in the background ([Advanced setup](https://code.claude.com/docs/en/setup#auto-updates)), and this variable blocks every update path ([Environment variables](https://code.claude.com/docs/en/env-vars)).
  3. Point `CLAUDE_CONFIG_DIR` at a fresh folder whose only file is a `settings.json` holding `{"syncClaudeAiSkills": false, "syncClaudeAiPlugins": false, "disableClaudeAiConnectors": true}`, or use a dedicated test account with the same settings ([Settings](https://code.claude.com/docs/en/settings)). An empty config folder alone still loads the synced skills, plugins and connectors of the claude.ai account you sign in with.
  4. Record `claude --version` at the start and at the end (a run whose two versions differ does not count), the `/skills` and `/mcp` output, the OS, the steps run and the check output, in the template's dry-run section.
- **Images.** Capture hygiene and contrast ([Diagrams and images](#diagrams-and-images)) are review items in the template, because CI cannot judge them.
- **Review.** The maintainer reviews and merges every pull request ([CODEOWNERS](.github/CODEOWNERS)).

### Checks

Before you open a pull request, run the guide's checks on your working tree, from the repo root:

```bash
node .github/scripts/check.mjs
```

It needs Node.js LTS, git, Ruby (for YAML), jq (for the examples' smoke tests), [shellcheck](https://github.com/koalaman/shellcheck) and [lychee](https://github.com/lycheeverse/lychee) 0.24 on your `PATH`; set `LYCHEE` or `SHELLCHECK` to point at a binary elsewhere. Each rule prints `PASS`, `FAIL`, `WARN` or `SKIP` with its name, and the command exits non-zero if any rule fails. Pull request CI runs the same command with `--base` set to the target branch; diff-scoped rules compare against `origin/main` locally.

| Rule | Fails when |
|---|---|
| `internal-links` | A link or fragment inside the repo does not resolve |
| `anchor-diff` | An anchor in `anchors.txt`, or on the base branch, is gone |
| `stub-paths` | A page path in `paths.txt` is gone |
| `stamps` | A stamped page's Stamp is missing or malformed, or the trust strip disagrees with the CHANGELOG |
| `edition-gate` | On a release tag only: a stamped page does not match the release |
| `expiry` | Never on a pull request, where it warns about markers due within 30 days |
| `em-dash` | An added line has an em dash outside code and double quotes |
| `images` | An image lacks alt text, a Mermaid block lacks its accessibility lines, or a file under `assets/` breaks the naming, reference or size rules |
| `lesson-lint` | A lesson or Elective breaks the [lesson anatomy](#lessons) |
| `static-validation` | JSON, YAML, skill or agent frontmatter, a workflow script or a shell script does not parse or lint |
| `inertness` | `examples/` holds a path Claude Code can load on its own |
| `smoke-tests` | An example's `test.sh` fails (only when the change touches `examples/`) |

Each rule has known-bad fixtures under `.github/scripts/fixtures/`, one folder per case: `fixture.json` names the rule and the expected result, `tree/` holds the files, `base/` the state before a change, and `generate.mjs` writes anything that would be live Claude Code config if committed. If you change a rule, run the self-test too:

```bash
node --test '.github/scripts/test/**/*.test.mjs'
```

## Maintainer routine

Scheduled checks keep watch between editions. Each opens or updates one tracking issue and never opens a pull request:

| Workflow | Runs | Issue |
|---|---|---|
| Weekly external links | Mondays | Broken external links |
| Daily expiry markers | Daily | Expired facts in the guide |
| Weekly version drift | Mondays | New Claude Code stable release |

Every month, the maintainer:

1. Runs the stale-docs audit in a Claude Code session at the repo root, `/stale-docs-audit`, and files the `issueBody` it returns as one issue. It sorts every volatile claim in README, the docs pages and the example READMEs as stale, unverifiable or ok.
2. Runs `gh workflow list --all` and turns any disabled scheduled workflow back on with `gh workflow enable <workflow>`. In a public repository, GitHub disables scheduled workflows after 60 days without repository activity ([Disabling and enabling a workflow](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)).

Every two weeks, the maintainer runs `.github/scripts/traffic-snapshot.sh` and keeps its output. It records how many visitors go from the repo page to each level, the stars added in the last 30 days, search referrers and lesson-feedback issues. It needs the maintainer's own `gh` login, because the traffic API needs push access, and it records a level outside GitHub's top 10 paths as "below the 10th" ([Repository traffic](https://docs.github.com/en/rest/metrics/traffic)).

## Doc style guide

The guide is moving to lessons in three levels: Beginner, Intermediate and Advanced. New pages follow these rules. Pages from the previous edition are brought in line when they are rewritten.

### Lessons

A lesson takes 10 to 20 minutes and moves the reader one step toward one can-do statement of its level. Every lesson has this shape, in this order:

1. An H1 with the lesson title, as the first line.
2. One `<sub>` header line under it: the level in bold, the position ("Lesson N of M"), "about N minutes", Needs (links to earlier lessons), and [the stamp](#the-stamp).
3. Six fixed slots, with these exact headings, so every lesson has the same anchors:
   - **Goal:** one sentence, "By the end of this lesson you can ...".
   - **You need:** earlier lessons, the environment, and where to practice. A variant callout (native Windows, a plan difference) goes here, at most one per variant.
   - **The idea:** the working model in about 150 words at most, plus the lesson's one optional diagram.
   - **Worked example:** numbered steps on a realistic task, with real commands and the observable state after each step.
   - **Your turn:** the exercise. Beginner repeats the example with exact steps; Intermediate finishes or fixes a partial file; Advanced gets a brief and acceptance criteria.
   - **Check:** a task list of observable criteria, with any ready-made test it needs; then the `npm run check -- <id>` line where a check exists (core lessons and capstones, not Electives); then at most one "if not" diagnosis per tested item.
4. Optional slots: **Watch out** (at most 3 bullets: safety, then cost, then gotchas) and **Go further** (at most 3 links).
5. A footer: the `Sources:` line; previous, level index and next; one `Topic:` link; and "Stuck on this lesson?".

Checks test state a script can read: git state, files, exit codes and settings files, never the wording of Claude's reply. Session-only views, such as the status bar or the `/hooks` and `/context` listings, belong in the Worked example, or in the Check's one self-check item, which is marked as not tested. A state that exists only for a moment, such as a plan before you approve it, is saved by the reader to a file under `.practice/`, which the check reads. Model-written text in an example is marked as illustrative ("your wording will differ").

Beginner lesson bodies carry no version numbers, prices or stability labels, and at most one caveat, about safety. Intermediate lessons carry at most two caveats, and Advanced lessons at most three.

The `lesson-lint` check enforces this shape on every lesson (`docs/<level>/NN-*.md`) and Elective (`docs/<level>/electives/*.md`). An Elective's header line says `Elective` in place of the position, and its Check has no `npm run check` line.

### Callouts

Callouts are GitHub alerts, at most two per lesson, each with one meaning:

- `> [!NOTE]` for a variant, or a stability label quoted word for word;
- `> [!WARNING]` for safety: secrets, permissions, code that runs with your rights;
- `> [!CAUTION]` for anything irreversible;
- `> [!TIP]` for an optional shortcut.

`[!IMPORTANT]` is not used. Cost notes and gotchas go in the Watch out slot as plain bullets. No emoji in headings, list markers, callouts or lesson text. Quote the product's own interface symbols inside code formatting, for example `⏸ plan mode on`.

### Diagrams and images

- Diagrams are Mermaid, with `accTitle:` and `accDescr:` lines. The sentence before the diagram states its takeaway in words.
- Terminal state that the docs give as text is shown as text in a code block, not as a screenshot.
- A screen capture is allowed only when recognizing the real interface is the point and text cannot show it: at most three across the Beginner level. Each is taken in the practice template, cropped to the relevant interface (no startup banner, no Anthropic logo), scrubbed of personal paths, usernames, account emails, org names and tokens, given a 1px border, and captioned `Claude Code vX.Y.Z (stable), YYYY-MM-DD`.
- Every image has alt text that says what the reader should learn from it, not "screenshot" and not a repeat of the caption.
- Text in a diagram or image reaches 4.5:1 contrast in GitHub's light and dark themes; other marks reach 3:1.
- No third-party images (logos, icons, slides, product screenshots), no animation and no embedded video.
- The `images` check enforces the alt text, the Mermaid lines, and the names, references and budget below.
- New images go under `assets/`: `assets/brand/` for the guide's identity and `assets/lessons/<lesson-id>/` for captures. Names are kebab-case, and paths are explicit and relative. Budget: an SVG up to 50 KB, a capture up to 200 KB. Every image that is not a capture ships its editable source beside it. Hand-drawn SVG is for the guide's identity pieces only.

### Headings

- Headings carry no dates, versions, model names, "new" or year words, stability labels or emoji.
- A renamed heading keeps its old slug as an `<a id>` on the line above it ([Anchor compatibility](#anchor-compatibility)). No duplicate ids within a page, and no `{#custom-id}` syntax.

### Writing

**Do:**

- Lead with what the reader does and what they see.
- Use a table when rows are comparable, but prefer lists or stacked blocks to tables wider than three short columns.
- End a line with a backslash where a paragraph needs a line break: GitHub's file view joins consecutive lines ([Line breaks](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#line-breaks)).
- Use relative `.md` links and explicit relative image paths. No front matter.
- Anchor date-sensitive claims to a version (`v2.1.x`) or a full date.
- Hedge and attribute third-party estimates in the sentence that states them.

**Don't:**

- Filler such as "In this section we will explore", "as we mentioned earlier" or "it's worth noting that". Cut it.
- Marketing language. "The ultimate guide to mastering..." reads as hype; lead with what the reader actually gets.
- Multi-paragraph docstrings. One short line at most in code samples.
- Em dashes in new prose. Keep them only inside quotations, identifiers and filenames. The `em-dash` check skips text in backticks, code blocks and double quotes; any other line that must keep one carries `<!-- allow-em-dash -->`.
- Claims about features you have not verified.

## File layout

The folder layout changes while the guide is reworked into three levels, so this file does not list it yet. For examples, see [Adding a skill](#adding-a-skill).

## Anchor compatibility

Listed anchors and page paths from `main` as it was when the rework started keep resolving: [`.github/compat/anchors.txt`](.github/compat/anchors.txt) lists the anchors of `README.md`, the `docs/` pages and `mcp-servers/README.md`, and [`.github/compat/paths.txt`](.github/compat/paths.txt) the paths of the `docs/` and `mcp-servers/` pages, plus the `specialized-agents/README.md` Stub that stands in for the removed `specialized-agents/` folder, each of which must stay a page or a Stub. Only pull requests that add Stubs edit the two lists.

When you rename or remove a heading:

1. Add an invisible HTML anchor that preserves the old slug:
   ```html
   <a id="old-slug-here"></a>
   ### New Heading
   ```
2. Run the [checks](#checks). The `anchor-diff` rule fails, naming each missing id, if an anchor in `anchors.txt`, or an anchor on the base branch in `README.md` or `docs/` (pages under `docs/legacy/` excepted), no longer exists.

When you move or remove a page in `paths.txt`, leave a Stub at the old path: an H1, a line such as `This page moved to [Hooks](../intermediate/05-hooks.md).` (or one saying it was removed in an edition, with a one-clause reason and a link to the CHANGELOG entry), and the old page's anchors as `<a id>` lines. The `stub-paths` rule fails if a listed path is gone.

This keeps inbound links from social posts working even after restructures.

## Adding a skill

Learner examples go under `examples/<level>/<NN-lesson>/` (an Elective's under `examples/<level>/electives/<name>/`), in the folder of the lesson that uses them. Each folder mirrors the project layout, but nothing in it may sit at a path Claude Code discovers on its own: use `dot-claude/` for `.claude/`, `dot-mcp.json` for `.mcp.json`, and `CLAUDE.example.md` and `AGENTS.example.md` for `CLAUDE.md` and `AGENTS.md`. A skill goes in `dot-claude/skills/<name>/SKILL.md`, which means "copy to `.claude/skills/<name>/SKILL.md` in your project", where Claude Code loads project skills. A real `.claude/` folder there would not stay inert: Claude Code loads skills from a nested `.claude/skills/` once Claude works on files in that folder ([Skills](https://code.claude.com/docs/en/skills#where-skills-live)).

Every executable example (hook, script, workflow, settings snippet, skill with `allowed-tools`, plugin) meets this safety contract:

1. **Copy to use.** It runs only after a Learner copies it into their own project.
2. **Local only.** No network calls, third-party APIs or keys. The one exception is the MCP lesson's server, named in that lesson and installed at a pinned version.
3. **No capture.** Nothing copies transcripts or logs tool input or output. An example that must log keeps the log bounded, in an ignored folder, and says so in its header.
4. **Least privilege.** A settings snippet has narrow allow rules, never `Write`, `Edit` or broad `Bash(x:*)` entries, and a `Read` deny rule for `.env`. Grant a skill's `allowed-tools` sparingly: Claude Code applies a project skill's `allowed-tools` even in a `-p` run in a folder you've never trusted ([Skills](https://code.claude.com/docs/en/skills#pre-approve-tools-for-a-skill)).
5. **Header block.** Every file and every example README says what it does, when it runs (event and matcher), its side effects, requirements and platforms, how to turn it off or remove it, and its test line: `Tested in Claude Code vX.Y.Z (stable) on <OS>, YYYY-MM-DD` or `Not yet tested in a session at this edition's version`.
6. **Platform.** A POSIX shell (macOS, Linux, WSL2). Dependencies are limited to bash, jq, python3's standard library and git, apart from rule 2's MCP server. No `uv`, no pip packages, no `.env` loading.
7. **Smoke test.** It ships a test that runs without Claude: hooks get sample JSON piped in, with exit codes and output asserted; settings snippets parse as JSON; skills and agents have valid frontmatter.

Report a security problem in an example as [SECURITY.md](SECURITY.md) describes.

The root `.claude/` is reserved for maintainer tooling. Do not add skills or other examples there.

## License

By contributing, you agree your contributions are licensed under the MIT license (see [`LICENSE`](LICENSE)).

Sources: [Extend Claude with skills](https://code.claude.com/docs/en/skills), [Advanced setup](https://code.claude.com/docs/en/setup), [Environment variables](https://code.claude.com/docs/en/env-vars), [Settings](https://code.claude.com/docs/en/settings), [Output styles](https://code.claude.com/docs/en/output-styles), [Your first day in Claude Code](https://support.claude.com/en/articles/14552382-your-first-day-in-claude-code), [The MCP Registry](https://modelcontextprotocol.io/registry/about), [official plugin `marketplace.json`](https://github.com/anthropics/claude-plugins-official/blob/main/.claude-plugin/marketplace.json), [Basic writing and formatting syntax](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)
