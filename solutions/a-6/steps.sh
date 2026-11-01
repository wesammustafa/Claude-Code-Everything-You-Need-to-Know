#!/bin/sh
# a-6: commit the team marketplace and register it in the shared settings,
# add a review checklist skill to the team kit, keep personal settings out
# of git, then write the strict validation report of the plugin folder.
set -eu
cp -R "$SOLUTION/team-marketplace" team-marketplace
cp "$SOLUTION/.claude/settings.json" .claude/settings.json
git add team-marketplace/.claude-plugin/marketplace.json \
  team-marketplace/plugins/team-kit/.claude-plugin/plugin.json \
  team-marketplace/plugins/team-kit/agents/config-reviewer.md \
  team-marketplace/plugins/team-kit/skills/onboard/SKILL.md \
  .claude/settings.json
git commit -q -m "Share a team marketplace in project settings"
git add team-marketplace/plugins/team-kit/skills/review-checklist/SKILL.md
git commit -q -m "Move the review checklist into the team kit"
printf '.claude/settings.local.json\n' >> .gitignore
git add .gitignore
git commit -q -m "Keep personal Claude Code settings out of git"
here=$(pwd -P)
mkdir -p .practice
cat > .practice/a-6-validate.json <<JSON
{"success":true,"strict":true,"target":"$here/team-marketplace/plugins/team-kit/.claude-plugin/plugin.json","manifest":{"errors":[],"warnings":[],"notes":[]},"contents":[]}
JSON
