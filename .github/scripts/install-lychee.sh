#!/usr/bin/env bash
# Installs a pinned, statically linked lychee on a Linux x86_64 runner and
# puts it on PATH.
set -euo pipefail

version=0.24.2
sha256=73657a111819a30c47c08352896796f23d64e4eb2b3ed39b6d32149241566fc5
name=lychee-x86_64-unknown-linux-musl

dir="${RUNNER_TEMP:-/tmp}/lychee"
mkdir -p "$dir"
curl -fsSL -o "$dir/$name.tar.gz" \
  "https://github.com/lycheeverse/lychee/releases/download/lychee-v$version/$name.tar.gz"
echo "$sha256  $dir/$name.tar.gz" | sha256sum --check --quiet
tar -xzf "$dir/$name.tar.gz" -C "$dir"
echo "$dir/$name" >> "${GITHUB_PATH:-/dev/null}"
"$dir/$name/lychee" --version
