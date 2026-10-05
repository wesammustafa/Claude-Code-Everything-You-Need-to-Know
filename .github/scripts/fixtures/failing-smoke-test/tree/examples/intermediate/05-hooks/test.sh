#!/usr/bin/env bash
# Smoke test: the hook must block .env.
echo "expected exit 2, got 0" >&2
exit 1
