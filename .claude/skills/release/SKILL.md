---
name: release
description: Cut a release of the avatarsniff npm package - run the preflight gates, bump the version, then tag and push so CI publishes to npm. Use when the user wants to release the lib, publish to npm, ship a new version, cut a release, or runs /release.
---

# Release (avatarsniff lib)

Publishes `lib/` (the `avatarsniff` package) to npm. The site is never part of a release.

**Releases are always CI-driven.** You bump the version, tag, and push; the pushed `v*` tag triggers `.github/workflows/release.yml`, which runs the gates against the tagged commit and publishes via **OIDC trusted publishing** (tokenless, gets npm provenance automatically). **Do not publish from this machine** - there is no local-publish lane.

> History: npm killed classic automation tokens (Dec 2025) and granular write tokens don't bypass 2FA-for-writes, so there is no token that publishes from CI. v0.1.1 (the first publish) was bootstrapped with one manual `npm publish`; everything after is OIDC.

## Things that bite here

- `pnpm <script>` fails locally (corepack is off), so run the lib binaries directly from `lib/` for the local preflight. In GitHub Actions, pnpm scripts work.
- `files: ["dist"]` - only `lib/dist` ships. The workflow rebuilds dist before publishing, so nothing needs building locally.
- `gh` is authed to a work account and can't touch `tunctn`. Push tags over SSH; don't use `gh release`.

## Steps

1. **Preflight.** Run `bash .claude/skills/release/scripts/preflight.sh`. It checks the tree is clean and on `main`, runs typecheck + coverage + build from `lib/`, runs `attw --pack` (catches dual ESM/CJS type-resolution bugs), and prints `npm pack --dry-run` so you can confirm only `dist/**` (plus README, LICENSE, package.json) ships. This never publishes - it just mirrors the gates CI will run so you fail fast locally.

2. **Choose the bump.** Ask patch / minor / major (or an explicit version). This is the first publish if `npm view avatarsniff version` 404s - start at the version already in `lib/package.json` (0.1.0) unless the user says otherwise.

3. **Bump.** From `lib/`: `npm version <patch|minor|major> --no-git-tag-version` (writes `package.json` only; we tag ourselves so the messages stay consistent).

4. **Tag + push.** `git commit -am "Release avatarsniff v<X.Y.Z>"`, `git tag v<X.Y.Z>`, `git push origin main --follow-tags` (SSH). The pushed `v*` tag triggers `release.yml`, which runs the gates and publishes. Don't publish locally.

5. **Verify.** Watch the Release workflow run go green, then `npm view avatarsniff version` shows the new version and `npm view avatarsniff dist.tarball` resolves.

## What only the human can do

Surface these when relevant - they need npm account access you don't have:

- One-time: configure the **trusted publisher** at npmjs.com -> `avatarsniff` -> Settings -> Trusted Publisher -> GitHub Actions, with org/user `tunctn`, repo `avatarsniff`, workflow filename `release.yml` (must match exactly or publish 404s). Once set, releases need no secret.
- If a publish 404s with an OIDC token-exchange error, the trusted publisher isn't configured (or the workflow filename/repo doesn't match).
