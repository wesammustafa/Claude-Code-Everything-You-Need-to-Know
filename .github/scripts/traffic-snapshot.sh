#!/usr/bin/env bash
# Prints a snapshot of how visitors reach the guide, for the maintainer to
# keep every two weeks:
#   - root-to-level click-through, from the repo page to each level's pages;
#   - the star total and the stars added in the last 30 days;
#   - search engines among the top referrers;
#   - lesson-feedback issues opened in the last 14 days.
#
#   .github/scripts/traffic-snapshot.sh [owner/repo] >> snapshots.md
#
# Run it yourself, signed in to gh with push access: the traffic API needs a
# permission the Actions token cannot get. GitHub reports only the top 10
# paths and referrers over 14 days, so a level outside them is recorded as
# "below the 10th", not as zero. Needs gh and jq.
set -euo pipefail

repo=${1:-wesammustafa/Claude-Code-Everything-You-Need-to-Know}
today=$(jq -nr 'now | strftime("%Y-%m-%d")')
since30=$(jq -nr '(now - 30 * 86400) | strftime("%Y-%m-%dT%H:%M:%SZ")')
since14=$(jq -nr '(now - 14 * 86400) | strftime("%Y-%m-%d")')

paths=$(gh api "repos/$repo/traffic/popular/paths")
referrers=$(gh api "repos/$repo/traffic/popular/referrers")
stars=$(gh api "repos/$repo" | jq '.stargazers_count')
recent_stars=$(gh api -H 'Accept: application/vnd.github.star+json' --paginate "repos/$repo/stargazers?per_page=100" \
  | jq -s --arg since "$since30" '[add[] | select(.starred_at >= $since)] | length')
feedback=$(gh issue list --repo "$repo" --label lesson-feedback --state all --search "created:>=$since14" --limit 1000 --json number \
  | jq 'length')

# Unique visitors to the repo root, and to a level's folder and index page.
root_uniques=$(jq --arg p "/$repo" '[.[] | select((.path | ascii_downcase) == ($p | ascii_downcase)) | .uniques] | add // 0' <<<"$paths")
level() {
  jq -r --arg base "/$repo" --arg level "$1" --argjson root "$root_uniques" '
    [.[] | select((.path | ascii_downcase) as $p
      | ($p == (($base + "/tree/main/docs/" + $level) | ascii_downcase))
        or ($p == (($base + "/blob/main/docs/" + $level + "/README.md") | ascii_downcase)))
    | .uniques]
    | if length == 0 then "below the 10th"
      else (add) as $u
        | "\($u) unique visitors" + (if $root > 0 then " (\(($u * 1000 / $root | round) / 10)% of the root)" else "" end)
      end' <<<"$paths"
}

search=$(jq -r '[.[] | select(.referrer | test("google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|brave|kagi"; "i"))
  | "\(.referrer) (\(.uniques) unique)"] | if length == 0 then "none in the top 10" else join(", ") end' <<<"$referrers")

cat <<REPORT
## Traffic snapshot, $today ($repo)

Unique visitors over the last 14 days. GitHub reports the top 10 paths and referrers only.

- Repo root: $root_uniques unique visitors
- Beginner: $(level beginner)
- Intermediate: $(level intermediate)
- Advanced: $(level advanced)
- Stars: $stars total, +$recent_stars in the last 30 days
- Search referrers: $search
- Lesson-feedback issues opened in the last 14 days: $feedback
REPORT
