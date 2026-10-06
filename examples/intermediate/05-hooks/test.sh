#!/usr/bin/env bash
# Smoke test for the lesson 5 hooks, without Claude: it pipes the JSON a hook
# receives into each script and checks the exit code, the output and the file
# on disk. It also parses settings.snippet.json and checks that each command it
# registers is one of these scripts. It shows no real notification: the
# notifier is a stand-in on a private PATH.
# Run: bash test.sh (needs bash, jq and python3). Writes only to a temporary
# folder, which it deletes.
set -euo pipefail
cd "$(dirname "$0")"
hooks=$PWD/dot-claude/hooks
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
event() { jq -nc --arg p "$1" '{hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: {file_path: $p}}'; }

for script in "$hooks"/*.sh; do
  [ -x "$script" ] || fail "$(basename "$script") is not executable"
done

# protect-files.sh: exit 2 and a Blocked: line on stderr for protected paths.
project=$tmp/project
mkdir -p "$project/src"
expect_exit() {
  local path=$1 want=$2 got=0
  event "$path" | "$hooks/protect-files.sh" 2> "$tmp/stderr" || got=$?
  [ "$got" = "$want" ] || fail "protect-files.sh: $path exited $got, expected $want"
  if [ "$want" = 2 ]; then grep -q '^Blocked: ' "$tmp/stderr" || fail "protect-files.sh: no Blocked: line for $path"; fi
}
expect_exit "$project/.env" 2
expect_exit "$project/package-lock.json" 2
expect_exit "$project/.git/config" 2
expect_exit "$project/src/app.js" 0
expect_exit 'C:\repo\.env' 2

# format-after-edit.sh: tidies files in the project, leaves the rest alone.
run_format() { event "$1" | CLAUDE_PROJECT_DIR=$project "$hooks/format-after-edit.sh" || fail "format-after-edit.sh exited non-zero for $1"; }
printf 'const a = 1;   \nconst b = 2;\t\n\n\n' > "$project/src/a.js"
run_format "$project/src/a.js"
[ "$(od -An -c "$project/src/a.js" | tr -d ' \n')" = 'consta=1;\nconstb=2;\n' ] || fail "format-after-edit.sh did not tidy a.js to one final newline"
printf 'x = 1  \r\ny = 2\r\n\r\n' > "$project/src/win.py"
run_format "$project/src/win.py"
[ "$(od -An -c "$project/src/win.py" | tr -d ' \n')" = 'x=1\r\ny=2\r\n' ] || fail "format-after-edit.sh did not keep CRLF line endings"
printf 'Two spaces make a break  \nhere\n' > "$project/notes.md"
run_format "$project/notes.md"
grep -q 'break  $' "$project/notes.md" || fail "format-after-edit.sh changed Markdown"
printf ' context  \n+added\n' > "$project/fix.patch"
run_format "$project/fix.patch"
grep -q '^ context  $' "$project/fix.patch" || fail "format-after-edit.sh changed a patch"
printf 'outside   \n' > "$tmp/outside.js"
run_format "$tmp/outside.js"
grep -q 'outside   $' "$tmp/outside.js" || fail "format-after-edit.sh changed a file outside the project"
run_format "$project/missing.js"
[ ! -e "$project/missing.js" ] || fail "format-after-edit.sh created a missing file"

# desktop-notify.sh: hands title and message to the notifier as arguments.
bin=$tmp/bin
mkdir -p "$bin"
for tool in jq cat; do ln -s "$(command -v "$tool")" "$bin/$tool"; done
note='{"hook_event_name":"Notification","message":"Claude needs your \"permission\" to use Bash","notification_type":"permission_prompt"}'
printf '#!/bin/sh\nprintf "%%s\\n" "$@" > "%s"\n' "$tmp/osascript-args" > "$bin/osascript"
chmod +x "$bin/osascript"
PATH=$bin "$(command -v bash)" "$hooks/desktop-notify.sh" <<<"$note" || fail "desktop-notify.sh exited non-zero"
grep -qx 'Claude Code' "$tmp/osascript-args" || fail "desktop-notify.sh did not pass the default title"
grep -qx 'Claude needs your "permission" to use Bash' "$tmp/osascript-args" || fail "desktop-notify.sh did not pass the message intact"
rm "$bin/osascript"
out=$(PATH=$bin "$(command -v bash)" "$hooks/desktop-notify.sh" <<<"$note") || fail "desktop-notify.sh exited non-zero without a notifier"
[ "$(jq -j '.terminalSequence' <<<"$out" | od -An -tx1 | tr -d ' ')" = '07' ] || fail "desktop-notify.sh did not fall back to the terminal bell"

# settings.snippet.json: valid JSON, the .env deny rule, and only these scripts.
jq -e '.permissions.deny | index("Read(.env)")' settings.snippet.json > /dev/null || fail "settings.snippet.json has no Read(.env) deny rule"
jq -r '.hooks[][].hooks[].command' settings.snippet.json | while read -r command; do
  name=${command##*/}
  [ "$command" = "\${CLAUDE_PROJECT_DIR}/.claude/hooks/$name" ] || fail "settings.snippet.json runs $command"
  [ -f "$hooks/$name" ] || fail "settings.snippet.json runs $name, which is not in dot-claude/hooks/"
done
jq -e '[.hooks[][].hooks[] | has("args")] | all' settings.snippet.json > /dev/null || fail "every hook in settings.snippet.json should use exec form (args)"

echo "PASS: lesson 5 hooks"
