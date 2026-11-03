#!/bin/sh
# b-3: check links with a title, skip protocol-relative links without the
# patch's flaw, save the tests' exit code and commit fix and tests together.
set -eu
# Your turn step 2 as the Guide words it. git apply skips, and exits 0 for,
# any path outside the folder it runs in, so check the patch landed.
git apply practice/b-3/protocol-relative.patch
if [ ! -f test/external.test.js ] || git diff --quiet -- src/links.js; then
  echo "b-3: git apply practice/b-3/protocol-relative.patch changed nothing" >&2
  exit 1
fi
cp "$SOLUTION/src/links.js" src/links.js
cp "$SOLUTION/test/links.test.js" "$SOLUTION/test/external.test.js" test/
mkdir -p .practice
if npm test --silent >/dev/null 2>&1; then echo 0; else echo $?; fi > .practice/b-3-tests.txt
git add src/links.js test/links.test.js test/external.test.js
git commit -q -m "Check links with a title and skip protocol-relative links"
