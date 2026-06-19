---
name: release
description: Cut a release of the avatarsniff npm package — run the gates, bump the version, build dist, publish to npm, then tag and push. Use when the user wants to release the lib, publish to npm, ship a new version, cut a release, or runs /release.
---

# Release (avatarsniff lib)

Publishes `lib/` (the `avatarsniff` package) to npm. The site is never part of a release.

## Things that bite here

- `pnpm <script>` fails locally (corepack is off), so run the lib binaries directly from `lib/`. In GitHub Actions, pnpm scripts work.
- `prepublishOnly` is `pnpm build`, which fails locally — so a **local** publish builds dist by hand and passes `--ignore-scripts`.
- `files: ["dist"]` — only `lib/dist` ships. Build before you publish or you ship stale bits.
- `gh` is authed to a work account and can't touch `tunctn`. Push tags over SSH; don't use `gh release`.

## Pick a lane

**CI publish (preferred).** You bump + tag + push; `.github/workflows/release.yml` runs the gates and publishes from the tag using the `NPM_TOKEN` secret. Reproducible, gets npm provenance. Do steps 1–3 and 6 below, skip 5.

**Local publish.** You do everything from this machine. Needs `npm login`. Do all steps.

## Steps

1. **Preflight.** Run `bash .claude/skills/release/scripts/preflight.sh`. It checks the tree is clean and on `main`, runs typecheck + coverage + build from `lib/`, and prints `npm pack --dry-run` so you can confirm only `dist/**` (plus README, LICENSE, package.json) ships. For a local publish, also confirm `npm whoami` succeeds — if not, ask the user to run `! npm login`.

2. **Choose the bump.** Ask patch / minor / major (or an explicit version). This is the first publish if `npm view avatarsniff version` 404s — start at the version already in `lib/package.json` (0.1.0) unless the user says otherwise.

3. **Bump.** From `lib/`: `npm version <patch|minor|major> --no-git-tag-version` (writes `package.json` only; we tag ourselves so the messages stay consistent).

4. **Rebuild dist.** From `lib/`: `./node_modules/.bin/tsup`.

5. **Publish (local lane only).** From `lib/`: `npm publish --ignore-scripts --access public`. The first publish creates the package. Supply the OTP if 2FA prompts.

6. **Tag + push.** `git commit -am "Release avatarsniff v<X.Y.Z>"`, `git tag v<X.Y.Z>`, `git push origin main --follow-tags` (SSH). In the CI lane, the pushed tag triggers the publish — don't also publish locally.

7. **Verify.** `npm view avatarsniff version` shows the new version; `npm view avatarsniff dist.tarball` resolves.

## What only the human can do

Surface these when relevant — they need an npm account and repo access you don't have:

- **CI lane:** create an npm **granular access token** with publish rights for `avatarsniff` (or an Automation token to skip 2FA), then add it as the `NPM_TOKEN` repo secret (`gh secret set NPM_TOKEN` if their gh is authed for `tunctn`, else the GitHub UI).
- **Local lane:** `npm login` in the session (`! npm login`), and the OTP at publish time if 2FA is on.
- Confirm the npm package name and first-publish access (`avatarsniff` is unscoped, so public by default).
