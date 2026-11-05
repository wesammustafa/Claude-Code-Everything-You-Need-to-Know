#!/bin/bash
# Blocks Edit and Write on .env files (but not .env.example), on anything in a
# secrets/ folder, and, as the hooks guide's script did, on package-lock.json
# and .git/. Exit 2 blocks the call; stderr goes to Claude. When jq fails or
# is missing, it exits 1, so "onFailure": "block" blocks the call.
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty') || {
  echo "protect-files.sh: can't read the file path: jq failed or is missing" >&2
  exit 1
}
FILE_PATH="${FILE_PATH//\\//}"
NAME=$(basename "$FILE_PATH")

case "$NAME" in
  .env.example) ;;
  .env | .env.*)
    echo "Blocked: $FILE_PATH is an environment file" >&2
    exit 2
    ;;
esac

case "/$FILE_PATH" in
  */secrets/*)
    echo "Blocked: $FILE_PATH is in a secrets folder" >&2
    exit 2
    ;;
  */package-lock.json | */.git/*)
    echo "Blocked: $FILE_PATH is protected" >&2
    exit 2
    ;;
esac

exit 0
