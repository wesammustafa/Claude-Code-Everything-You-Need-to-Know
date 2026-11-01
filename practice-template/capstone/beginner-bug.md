# Bug: a missing folder in linkcheck.json is silently skipped

**Reported by:** a teammate

## What happens

With this `linkcheck.json`:

```json
{ "files": ["docs"] }
```

saved in an empty folder outside this repository, `npm run linkcheck -- <that folder>` prints `All relative links resolve.` and exits with code 0, although there is no `docs/` folder.

## What should happen

The tool should stop with an error that names the missing folder, `docs`, and exit with code 2, the same code it uses for a broken `linkcheck.json`.

## Notes

- Add a test that fails before the fix and passes after it.
