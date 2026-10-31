#!/bin/sh
# b-4: commit a synchronous refactor of brokenLinks, then try the rename,
# snapshot, rewind the edit to src/check-links.js, snapshot and restore.
set -eu
cp "$SOLUTION/src/check-links.js" src/check-links.js
cp "$SOLUTION/test/links.test.js" test/links.test.js
git add src/check-links.js test/links.test.js
git commit -q -m "Check each link target in its own function"
node practice/b-4/rename-export.mjs >/dev/null
# The callers' update, as Claude's file edit makes it.
node -e 'const fs = require("node:fs"); const f = "src/check-links.js"; fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(/\bfindLinks\b/g, "extractLinks"));'
mkdir -p .practice
git status --porcelain > .practice/b-4-before-rewind.txt
# Restore code puts back the file Claude edited; the script's change stays.
git checkout -- src/check-links.js
git status --porcelain > .practice/b-4-after-rewind.txt
git checkout -- src/links.js
