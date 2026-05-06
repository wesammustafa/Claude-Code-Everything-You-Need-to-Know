# Contributing

Thanks for your interest in improving this guide. This is a learning resource — clear, practical, and beginner-friendly explanations beat thorough-but-overwhelming ones.

## Ways to contribute

- **Spot something stale or wrong?** Open an issue with the section name and the problem.
- **Have a useful skill, hook pattern, or MCP server walkthrough?** PRs welcome — see the file layout below.
- **Want to expand a thin section?** SDLC walkthroughs, new workflow recipes, and real-world `.claude/` examples are all high-value.

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
README.md                        # Tutorial / landing page (~400 lines)
docs/
  skills.md                      # Full Skills guide
  reference/
    commands.md                  # Slash command cheatsheet
    models.md                    # Model specs and pricing
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

## Adding an MCP server walkthrough

1. Create `mcp-servers/<server-name>.md` mirroring the structure of [`mcp-servers/serena.md`](mcp-servers/serena.md): overview, prerequisites, install, examples, troubleshooting.
2. Add a row to the "Featured MCP servers" table in [README → MCP](README.md#model-context-protocol-mcp).
3. Update [`mcp-servers/README.md`](mcp-servers/README.md)'s comparison matrix.

## License

By contributing, you agree your contributions are licensed under the MIT license (see [`LICENSE`](LICENSE)).
