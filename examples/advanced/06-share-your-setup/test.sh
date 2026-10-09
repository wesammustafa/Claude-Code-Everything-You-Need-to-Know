#!/usr/bin/env bash
# Smoke test for the Advanced lesson 6 team marketplace, without Claude: the
# marketplace file and each plugin manifest parse and follow the naming and
# path rules from the plugin docs, the settings snippet declares the
# marketplace by a relative path, turns its plugins on and denies Read(.env),
# and each skill and subagent opens with valid frontmatter and a header test
# line, pre-approves no tools and stays read-only.
# It finds the marketplace file in dot-claude-plugin/, as this guide ships it,
# or in .claude-plugin/, as in your copy. The last check is for the starter as
# shipped: once you add a hook, MCP server or bin/ folder to your copy, it fails.
# Run: bash test.sh (needs bash, jq and awk). Reads files only.
set -euo pipefail
cd "$(dirname "$0")"

fail() { echo "FAIL: $*" >&2; exit 1; }
# The frontmatter block: the lines between the opening --- on line 1 and the next ---.
frontmatter() { awk 'NR == 1 { if ($0 != "---") exit 1; next } /^---$/ { exit } { print }' "$1"; }
field() { frontmatter "$1" | awk -v key="$2" 'index($0, key ": ") == 1 { print substr($0, length(key) + 3) }'; }
has_key() { frontmatter "$1" | grep -q "^$2:"; }
lower() { tr '[:upper:]' '[:lower:]' <<<"$1"; }

# Reserved marketplace names, copied in full from
# https://code.claude.com/docs/en/plugins/marketplace-reference#reserved-names
# on 2026-10-06. Names starting with claudeai- are reserved too (below).
reserved=" claude-code-marketplace claude-code-plugins claude-plugins-official anthropic-marketplace
  anthropic-plugins agent-skills anthropic-agent-skills life-sciences knowledge-work-plugins
  claude-for-legal claude-for-financial-services financial-services-plugins first-party-plugins
  claude-tag-plugins claude-community claude-plugins-community healthcare anthropic-plugin-directory
  claude-plugin-directory inline builtin skills-dir synced claude-plugin-test npm pip uv cargo github gh "
reserved=$(tr -s ' \n' '  ' <<<"$reserved")

if [ -f .claude-plugin/marketplace.json ]; then
  market=.claude-plugin/marketplace.json
elif [ -f dot-claude-plugin/marketplace.json ]; then
  market=dot-claude-plugin/marketplace.json
else
  fail "no marketplace file at .claude-plugin/marketplace.json or dot-claude-plugin/marketplace.json"
fi

# The marketplace file: required fields and a name Claude Code accepts.
jq -e . "$market" > /dev/null || fail "$market is not valid JSON"
name=$(jq -r '.name // ""' "$market")
[[ "$name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail "marketplace name '$name' must use letters, digits, '.', '_' and '-' and start with a letter or digit"
[[ "$name" != *..* ]] || fail "marketplace name '$name' contains '..'"
# Compare case-insensitively, and catch another spelling of a reserved name:
# a trailing dot, or a dot in place of a hyphen.
spelled=$(lower "$name")
spelled=${spelled%.}
spelled=${spelled//./-}
[[ "$reserved" != *" $spelled "* ]] || fail "marketplace name '$name' is reserved"
[[ "$spelled" != claudeai-* ]] || fail "marketplace names starting with claudeai- are reserved"
[ -n "$(jq -r '.owner.name // ""' "$market")" ] || fail "$market: owner.name is required"
[ -n "$(jq -r '.description // ""' "$market")" ] || fail "$market: no description, which validation warns about"
jq -e '.plugins | type == "array" and length > 0' "$market" > /dev/null || fail "$market lists no plugins"

# The settings snippet: valid JSON, the .env deny rule, no allow rules, and the
# marketplace declared by a relative directory path with its plugins turned on.
snippet=settings.snippet.json
jq -e . "$snippet" > /dev/null || fail "$snippet is not valid JSON"
jq -e '.permissions.deny | index("Read(.env)")' "$snippet" > /dev/null || fail "$snippet has no Read(.env) deny rule"
jq -e '(.permissions.allow // []) | length == 0' "$snippet" > /dev/null || fail "$snippet should add no allow rules"
[ "$(jq -r --arg m "$name" '.extraKnownMarketplaces[$m].source.source // ""' "$snippet")" = directory ] ||
  fail "$snippet does not declare '$name' as a directory marketplace"
path=$(jq -r --arg m "$name" '.extraKnownMarketplaces[$m].source.path // ""' "$snippet")
[[ "$path" == ./* && "$path" != *..* ]] || fail "$snippet: write the marketplace path relative to the repository root, such as ./team-marketplace, not '$path'"

# Each plugin entry, its manifest, and its components.
while IFS= read -r entry; do
  [[ "$entry" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail "plugin entry name '$entry' must use letters, digits, '.', '_' and '-'"
  src=$(jq -r --arg e "$entry" '.plugins[] | select(.name == $e) | .source | strings' "$market")
  [[ "$src" == ./* ]] || fail "$entry: source '$src' must be a relative path that starts with ./"
  [[ "$src" != *..* ]] || fail "$entry: source '$src' contains '..'"
  [[ "$src" != *\\* ]] || fail "$entry: source '$src' contains a backslash; use forward slashes"
  plugin=${src#./}
  manifest="$plugin/.claude-plugin/plugin.json"
  [ -f "$manifest" ] || fail "$entry: no $manifest"
  jq -e . "$manifest" > /dev/null || fail "$manifest is not valid JSON"
  [ "$(jq -r '.name // ""' "$manifest")" = "$entry" ] || fail "$manifest: name must equal the marketplace entry name, $entry"
  for key in description version author.name; do
    [ -n "$(jq -r ".$key // \"\"" "$manifest")" ] || fail "$manifest: no $key, which --strict validation fails"
  done
  # A plugin name that passes or reads as one of Anthropic's own fails --strict validation.
  [[ "$(lower "$entry")" != cc-plugin-* ]] || fail "plugin name '$entry' starts with cc-plugin-"
  for word in $(lower "$entry" | tr -s '._-' '   '); do
    case "$word" in claude | anthropic | anthropics) fail "plugin name '$entry' uses '$word', which fails plugin validation under --strict" ;; esac
  done
  [ "$(jq -r --arg id "$entry@$name" '.enabledPlugins[$id] // false' "$snippet")" = true ] || fail "$snippet does not turn on $entry@$name"

  for skill in "$plugin"/skills/*/SKILL.md; do
    [ -f "$skill" ] || continue
    frontmatter "$skill" > /dev/null || fail "$skill does not start with ---"
    [ -n "$(field "$skill" description)" ] || fail "$skill: no description"
    frontmatter "$skill" | grep -q '^# Not yet tested\|^# Tested in Claude Code' || fail "$skill: no test line in its header"
    ! has_key "$skill" allowed-tools || fail "$skill pre-approves tools with allowed-tools"
  done

  for agent in "$plugin"/agents/*.md; do
    [ -f "$agent" ] || continue
    frontmatter "$agent" > /dev/null || fail "$agent does not start with ---"
    stem=$(basename "$agent" .md)
    [ "$(field "$agent" name)" = "$stem" ] || fail "$agent: name must be $stem"
    [ -n "$(field "$agent" description)" ] || fail "$agent: no description"
    frontmatter "$agent" | grep -q '^# Not yet tested\|^# Tested in Claude Code' || fail "$agent: no test line in its header"
    tools=$(field "$agent" tools)
    [ -n "$tools" ] || fail "$agent: no single-line tools list, so it would inherit every tool"
    while read -r tool; do
      case "${tool%%(*}" in
        Edit | Write | NotebookEdit | Bash | PowerShell | Monitor) fail "$agent can use $tool" ;;
      esac
    done < <(tr ',' '\n' <<<"$tools")
    for key in hooks mcpServers permissionMode; do
      ! has_key "$agent" "$key" || fail "$agent sets $key, which a plugin subagent ignores"
    done
  done

  # The starter as shipped runs no code of its own.
  for item in hooks .mcp.json .lsp.json bin monitors; do
    [ ! -e "$plugin/$item" ] || fail "$plugin/$item: the starter plugin ships no hooks, MCP or LSP servers, bin/ or monitors/"
  done
done < <(jq -r '.plugins[].name' "$market")

echo "PASS: Advanced lesson 6 team marketplace"
