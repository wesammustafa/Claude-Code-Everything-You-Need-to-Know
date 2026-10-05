# Contributing

Thanks for your interest in improving this guide. This is a learning resource — clear, practical, and beginner-friendly explanations beat thorough-but-overwhelming ones.

## Ways to contribute

- **Spot something stale or wrong?** Open an issue with the section name and the problem.
- **Want to suggest a third-party tool, MCP server, skill, plugin, course or article?** Use the [Suggest a resource form](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=suggest-resource.yml). Unsolicited pull requests that add listings are closed; see the [Listing policy](#listing-policy).
- **Want to expand a thin section?** SDLC walkthroughs, new workflow recipes, and real-world `.claude/` examples are all high-value.

<a id="adding-an-mcp-server-walkthrough"></a>
## Listing policy

**Freeze:** since 2026-10-04, listing changes are frozen while the guide is reworked. Suggestions made through the [Suggest a resource form](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=suggest-resource.yml) stay open for the next content review.

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

## Doc style guide

**Do:**

- **Mental model first.** Open every concept with a one-line analogy or "think of it as…" before any bullets.
- **Practical example next.** A code block, command, or config snippet the reader can act on within 60 seconds.
- **Tables over walls of bullets** when content is comparable across rows.
- **Read-time markers** on long pages (e.g., `*~5 min read*`).
- **Semantic emojis only.** Keep a small set as visual markers (🚀 ⚡ 🧠 for navigation; ⚠️ for warnings; 💡 for tips). Don't sprinkle decorative emojis across headings — they break GitHub anchor slugs.

**Don't:**

- "In this section we will explore…", "as we mentioned earlier…", "it's worth noting that…" — cut filler phrases.
- Marketing language. "The ultimate guide to mastering…" reads as hype; lead with what the reader actually gets.
- Multi-paragraph docstrings. One short line max in code samples.

## File layout

```
README.md                        # Tutorial / landing page (~850 lines; long-form sections belong in docs/)
docs/
  skills.md                      # Full Skills guide
  reference/
    commands.md                  # Slash command cheatsheet
    models.md                    # Model specs and pricing
    effort-levels.md             # Reasoning effort guide
    faq.md                       # Consolidated Q&A
    changelog.md                 # Updates & deprecations
    further-reading.md           # External links
mcp-servers/                     # Per-server walkthroughs
specialized-agents/              # Role descriptions + system prompts + canvas flowcharts
.claude/                         # Working example of a project-level Claude Code setup
Images/                          # Diagrams and screenshots
```

When adding a topic that grows past ~400 lines, lift it into its own `docs/*.md` and replace the README section with a topic card + link.

## Anchor compatibility

The README has a stable URL fragment per section (e.g., `#claude-skills`, `#hooks`). When you rename or remove a heading:

1. Add an invisible HTML anchor that preserves the old slug:
   ```html
   <a id="old-slug-here"></a>
   ### New Heading
   ```
2. Run the diff before merging:
   ```bash
   diff <(git show main:README.md | grep -oE '^#{1,4} ' | sort -u) \
        <(grep -oE '^#{1,4} ' README.md | sort -u)
   ```

This keeps inbound links from social posts working even after restructures.

## Adding a skill

Skills live in [`.claude/commands/`](.claude/commands). To add one:

1. Create `.claude/commands/your-skill.md` with the [skill file format](docs/skills.md#skill-file-requirements).
2. Test it locally: `claude` → `/your-skill`.
3. Document it in [`docs/skills.md` → Available skills reference](docs/skills.md#available-skills-reference).
4. Open a PR with the skill file, the doc update, and a one-line entry in the README's [Skills section](README.md#claude-skills) if the skill is a marquee addition.

## License

By contributing, you agree your contributions are licensed under the MIT license (see [`LICENSE`](LICENSE)).
