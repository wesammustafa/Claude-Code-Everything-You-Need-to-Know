#!/bin/sh
# i-8: enable the setup plugin for the project in the shared settings, and
# write the plugin list `claude plugin list --json` saves after it is
# installed at project scope and the TypeScript plugin is trialled locally.
set -eu
cp "$SOLUTION/.claude/settings.json" .claude/settings.json
git add .claude/settings.json
git commit -q -m "Enable the Claude Code setup plugin for the project"
mkdir -p .practice
here=$(pwd -P)
cat > .practice/i-8-plugins.json <<JSON
[
  {
    "id": "claude-code-setup@claude-plugins-official",
    "scope": "project",
    "enabled": true,
    "projectPath": "$here",
    "projectEnabled": true
  },
  {
    "id": "typescript-lsp@claude-plugins-official",
    "scope": "local",
    "enabled": true,
    "projectPath": "$here"
  }
]
JSON
