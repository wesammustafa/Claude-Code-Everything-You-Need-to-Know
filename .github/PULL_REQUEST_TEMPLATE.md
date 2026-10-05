## What this changes

<!-- One or two sentences on what changed and why. If two sources disagreed, name both and say what you kept. -->

## Checklist

Tick each item that applies, or write "n/a" after it. The full rules are in [CONTRIBUTING.md](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/blob/main/CONTRIBUTING.md).

- [ ] Facts that can go stale, such as versions, dates, prices, limits, model names, command or setting names, stability labels and counts, link their Tier 1 source inline at first mention on each page. Date-sensitive ones name a version (`v2.1.x`) or a full date. See [Sources and citations](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/blob/main/CONTRIBUTING.md#sources-and-citations).
- [ ] No unsourced numbers: every number, other than a lesson's time estimate, has a dated, linked source, or it is cut.
- [ ] Renamed or removed headings keep an `<a id="old-slug"></a>` compatibility anchor.
- [ ] Any new listing (an external tool, MCP server, skill, plugin, course or article for readers to use) links the accepted resource suggestion issue, or the content-review PR, that approved it: #___. No issue yet? [Suggest the resource](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/issues/new?template=suggest-resource.yml) instead. See [Listing policy](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/blob/main/CONTRIBUTING.md#listing-policy).
- [ ] Tested in Claude Code vX.Y.Z on <OS>, or "smoke test only". Required when this PR touches `examples/` or `.claude/`.
- [ ] Captures are taken in the practice template, cropped, scrubbed of personal details and captioned with the version and date. See [Diagrams and images](https://github.com/wesammustafa/Claude-Code-Everything-You-Need-to-Know/blob/main/CONTRIBUTING.md#diagrams-and-images).
- [ ] Text in new diagrams and images reaches 4.5:1 contrast in GitHub's light and dark themes, and other marks 3:1.
- [ ] I have personally verified any AI-assisted content in this PR.

## Claim table

<!-- Every volatile claim this PR adds or changes. A second, independent pass fills the Result column by trying to refute each claim against its Tier 1 source: a separate agent for agent-made PRs, the reviewer for human ones. Write "No volatile claims changed" if there are none. -->

| Claim | Tier 1 source | Result |
|---|---|---|
| | | |

## Dry-run

<!-- Required on PRs that touch a lesson under docs/<level>/ or an example a core lesson or capstone uses; otherwise write "n/a". Run in a clean configuration at the baseline in CHANGELOG.md, as described in CONTRIBUTING.md#pull-requests. -->

- `claude --version` at the start:
- `claude --version` at the end:
- OS:
- Configuration: a fresh `CLAUDE_CONFIG_DIR` whose `settings.json` turns off synced skills, synced plugins and claude.ai connectors, or a dedicated test account
- `/skills` output:
- `/mcp` output:
- Steps run:
- Check output:
