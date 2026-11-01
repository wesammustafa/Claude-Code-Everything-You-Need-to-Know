#!/bin/bash
INPUT=$(cat)
cd "$CLAUDE_PROJECT_DIR" || exit 1

if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0
fi
if ! npm test 2>&1; then
  echo "Blocked: the tests fail. Fix them before you finish." >&2
  exit 2
fi

exit 0
