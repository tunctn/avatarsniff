#!/usr/bin/env bash
# Release preflight for the avatarsniff lib. Run from anywhere in the repo:
#   bash .claude/skills/release/scripts/preflight.sh
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT/lib"

branch="$(git rev-parse --abbrev-ref HEAD)"
[ "$branch" = "main" ] || echo "! on '$branch', not 'main'"

if [ -n "$(git status --porcelain)" ]; then
  echo "! working tree is dirty — commit or stash before releasing"
fi

if npm whoami >/dev/null 2>&1; then
  echo "▸ npm: authed as $(npm whoami)"
else
  echo "! npm: not logged in — needed for a local publish (run: npm login)"
fi

echo "▸ typecheck"
./node_modules/.bin/tsc --noEmit

echo "▸ tests + coverage"
./node_modules/.bin/vitest run --coverage

echo "▸ build dist"
./node_modules/.bin/tsup

echo "▸ package contents (dry run):"
npm pack --dry-run

echo "✓ preflight passed — review the file list above, then bump + publish"
