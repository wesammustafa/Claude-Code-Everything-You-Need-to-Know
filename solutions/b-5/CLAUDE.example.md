# linkcheck

A small command-line tool that reports relative Markdown links whose file is missing.

## Commands

- Run the tests: `npm test`
- Check a folder: `npm run linkcheck -- <folder>`
- npm scripts: @package.json

## Conventions

- Every new JavaScript file in `src/` starts with the line `// Part of linkcheck.`
- CLI errors go to stderr and start with `linkcheck:`.
- Tests live in `test/`, one test file per source file.
