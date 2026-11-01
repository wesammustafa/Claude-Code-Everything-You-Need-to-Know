# Bug: a malformed percent escape crashes linkcheck

A teammate copied `[broken](bad%.md)` into a Markdown file. Running linkcheck on its folder throws `URIError: URI malformed`, so the remaining links are never checked.

Reproduce this outside `samples/`, then fix the checker:

- Malformed percent escapes are broken links; valid percent-encoded paths must still resolve.
- Report malformed targets with the same file, line and target fields as other broken links, then continue checking later links.
- A folder containing broken links exits with code 1. A folder whose links all resolve exits with code 0.
- Keep the existing sample fixtures unchanged.

Add a regression test that fails before the repair and passes after it. Cover a malformed escape, a valid encoded filename and a later broken link so a catch that simply stops the scan cannot pass. Don't commit until the fix has been reviewed; then commit the source fix and its regression test together.
