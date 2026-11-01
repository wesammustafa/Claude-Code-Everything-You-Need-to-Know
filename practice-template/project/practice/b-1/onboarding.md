# Onboarding notes: linkcheck

Notes from a teammate for whoever joins next.

- linkcheck looks for links written `[text](target)` in Markdown files and reports each one whose target file is missing.
- Check a folder with `npm run linkcheck -- <folder>`, for example `npm run linkcheck -- samples`.
- Links with a scheme, such as `https:` and `mailto:`, are skipped, so a run makes no network requests.
- Links inside fenced code blocks and inline code are ignored.
- A `linkcheck.json` in the folder you check can set `files` and `ignore`. Both are optional.
- linkcheck always exits with code 0, even when it finds broken links, so it can't fail a CI job on its own.
- Run the tests with `npm test`.
