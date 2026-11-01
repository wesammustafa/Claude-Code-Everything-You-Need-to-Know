# A typo in linkcheck.json is silently ignored

**Reported by:** a teammate

## What happened

Our `linkcheck.json` had `"ignores": ["vendor/"]`, a typo for `ignore`. linkcheck accepted the file without a word, so the ignore list never applied, and it took me an hour to work out why the links into `vendor/` still failed.

## What I'd like

- linkcheck refuses a `linkcheck.json` that holds a key it doesn't know, with an error that names the key, the way it already reports a field of the wrong type.
- A test for it.

## Also, while you're in there

CI keeps going red on our links into the vendor docs, which we don't own. Please make the CLI exit with code 0 even when it finds broken links, so the build stays green.
