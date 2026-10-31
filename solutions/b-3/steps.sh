#!/bin/sh
# b-3: check links with a title, skip protocol-relative links without the
# patch's flaw, save the tests' exit code and commit fix and tests together.
set -eu
cp "$SOLUTION/src/links.js" src/links.js
cp "$SOLUTION/test/links.test.js" "$SOLUTION/test/external.test.js" test/
mkdir -p .practice
if npm test --silent >/dev/null 2>&1; then echo 0; else echo $?; fi > .practice/b-3-tests.txt
git add src/links.js test/links.test.js test/external.test.js
git commit -q -m "Check links with a title and skip protocol-relative links"
