# Rules for agents editing this guide

These rules apply when you edit this guide, a Markdown guide to learning Claude Code. If the user is learning Claude Code with this repo (running or changing its examples, asking questions), they do not apply: just help them. For anything this file does not cover (where to report problems, AI-assisted contributions, file layout, adding a skill), read [CONTRIBUTING.md](CONTRIBUTING.md), the full contributor policy this file digests.

## Verify every volatile claim

A volatile claim is anything that can go stale: a version or date; a price, plan availability, or usage or rate limit; a model name, model ID or default; the name or behavior of a command, flag, setting, environment variable, hook event, tool or frontmatter field; a stability label (copied word for word from Tier 1); any count or statistic; or a third-party status fact (owner, license, archived).

Before you write or change one, fetch the Tier 1 source for its domain:

| Claim domain | Tier 1 source |
|---|---|
| Claude Code behavior: commands, flags, settings, hook events, stability labels | code.claude.com/docs: find the page in https://code.claude.com/docs/llms.txt and fetch it with a `.md` suffix |
| When something shipped, versions, release channels | https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md (search the raw file, https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md, for the version or feature rather than reading it whole), and `npm view @anthropic-ai/claude-code dist-tags` for `latest` and `stable` |
| Models, model IDs, API limits | https://platform.claude.com/docs |
| Plan prices and plan features | https://claude.com/pricing and the plan articles on https://support.claude.com |
| API prices | https://platform.claude.com/docs/en/about-claude/pricing |
| MCP protocol | https://modelcontextprotocol.io |
| GitHub behavior | https://docs.github.com |
| A third-party tool's install and usage | That tool's own repo or docs |

- Tier 2 is any other first-party source: support.claude.com, anthropic.com news and engineering posts, claude.com/blog, Claude Academy (academy.claude.com), first-party repo READMEs and the official plugin `marketplace.json`. Tier 3 is everything else: attribute it in the sentence, and never use it as the only source for how Claude Code behaves.
- Verify against the frozen baseline: the `stable` version named in the Unreleased entry of [CHANGELOG.md](CHANGELOG.md).
- Write only facts you confirmed on a source you fetched. Leave out anything you could not confirm, and list it for the user.
- Link the Tier 1 page inline at a claim's first mention on each page, not at every repeat. Give every stamped page, and CONTRIBUTING, a one-line `Sources:` footer that lists every page its statements rely on ([CONTRIBUTING.md#how-to-cite](CONTRIBUTING.md#how-to-cite) says what may be left out and what may follow it), and update it whenever you add or remove a citation.
- Conflicts: the domain's Tier 1 source wins; within a tier, the more specific page wins, then the newer or version-anchored one; the docs win on current behavior, the CHANGELOG on when it changed. If still unresolved, write only what both support or leave it out, and record the conflict in the PR description.
- Never write prices, promos, plan limits, retirement dates, model spec tables or "as of" prose. Every other number, apart from the guide's own metadata such as a lesson's time estimate, needs a dated, linked source, or it is cut: [CONTRIBUTING.md#numbers-benchmarks-and-estimates](CONTRIBUTING.md#numbers-benchmarks-and-estimates).
- Teach only behavior a Tier 1 or Tier 2 source documents. If a lesson cannot work without undocumented behavior, stop and ask the maintainer; it goes in only with their sign-off.

## Pull requests

- One change per PR. Fill in the PR template. For its claim table, start a separate agent that tries to refute each changed claim against Tier 1, and copy that agent's results into the table; never fill the Result column yourself. Leave the box "I have personally verified any AI-assisted content in this PR" for the user to tick.
- Before you open a PR, run `node .github/scripts/check.mjs` on your working tree and fix every `FAIL`; CI runs the same command. If you change a rule, also run `node --test '.github/scripts/test/**/*.test.mjs'`.
- Lesson PRs, and example PRs whose example a core lesson or capstone uses, record a dry-run in a clean configuration: [CONTRIBUTING.md#pull-requests](CONTRIBUTING.md#pull-requests).

## Examples

Learner examples live under `examples/<level>/<NN-lesson>/`, never at a path Claude Code loads on its own: use `dot-claude/`, `dot-mcp.json`, `CLAUDE.example.md` and `AGENTS.example.md`. A marketplace manifest goes in `dot-claude-plugin/`, so neither the example's folder nor the guide repository can be added as a marketplace by its folder path or as `owner/repo`; a plugin keeps its own `.claude-plugin/plugin.json`, since Claude Code doesn't scan `.claude/plugins/` and `examples/` holds no `.claude/skills/`. Every executable example follows the [safety contract](CONTRIBUTING.md#adding-a-skill): (1) it runs only once copied into a project; (2) local only, with no network calls or keys, except the MCP lesson's pinned server; (3) it captures no transcripts and logs no tool input or output; (4) least privilege, with a `Read` deny rule for `.env` and no `Write`, `Edit` or broad `Bash(x:*)` allow rules; (5) a header block, including its test line; (6) a POSIX shell with only bash, jq, python3's standard library and git; (7) a smoke test that runs without Claude. The root `.claude/` is maintainer tooling: add nothing there.

## Listings

A listing is an external tool, MCP server, skill, plugin, course or article the guide points readers to as something to use or read. [CONTRIBUTING.md#listing-policy](CONTRIBUTING.md#listing-policy) has the full bar, labels, section line, security caveat and form. Add a listing only when the user links the accepted resource suggestion issue, or the content-review PR, that approved it; otherwise point them to the [Suggest a resource form](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=suggest-resource.yml).

The bar in brief: to add any other Vendor or Community item, a named lesson must need it; it needs a public repo with an OSI-approved license (CC BY, CC BY-SA or CC0 for docs-only resources), a default-branch commit in the last 90 days, and at least 1,000 GitHub stars, 1,000 weekly npm or PyPI downloads, or 10,000 marketplace installs on a stated date; nothing it says about Claude Code may contradict Tier 1; and its core function must not depend on a proprietary hosted service unless it is a vendor's own tool for its own product, labelled `needs a <vendor> account`. At review, remove an item that is archived or deprecated upstream, whose canonical URL or repo returns 404, that has no default-branch commit in 12 months, that has under 100 stars and under 1,000 weekly downloads with no Anthropic marketplace listing, or that contradicts Tier 1. Anthropic and MCP-project items (including the MCP reference servers, labelled Vendor) need only a lesson or reference page that uses them, a live URL and no "not maintained" or "not official" disclaimer.

## Editorial rules

- Renaming or removing a heading: put `<a id="old-slug"></a>` on the line above the new heading so links to the old slug keep working, and leave a Stub at a moved page's old path ([CONTRIBUTING.md#anchor-compatibility](CONTRIBUTING.md#anchor-compatibility)); the checks' `anchor-diff` and `stub-paths` rules catch a missing one. Headings carry no dates, versions, model names, "new" or year words, stability labels or emoji.
- Anchor date-sensitive claims to a version (`v2.1.x`) or a full date. Hedge third-party estimates and attribute them in the sentence.
- Prefer lists or stacked blocks to tables wider than three short columns. GitHub's file view joins consecutive lines, so end a line with a backslash where a paragraph needs a line break.
- In prose you write, use a comma, colon, parentheses or a new sentence where an em dash (U+2014) would go. Em dashes are fine inside quotations, identifiers and filenames.
- No emoji in headings, list markers, callouts or lesson text. Callouts are GitHub alerts; diagrams are Mermaid with `accTitle` and `accDescr`; terminal state is text, not a screenshot.
- Before you write a new page, read [CONTRIBUTING.md#doc-style-guide](CONTRIBUTING.md#doc-style-guide): the lesson anatomy, callouts, images and headings.
