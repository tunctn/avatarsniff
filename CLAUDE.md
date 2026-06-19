# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

A single git repo (`tunctn/avatarsniff`) - a pnpm workspace with two packages:

- `lib/` - `avatarsniff`, the published npm package. **This is where nearly all work happens.** `files: ["dist"]`, so `pnpm add avatarsniff` only ever ships `lib/dist` - the site never reaches npm consumers.
- `site/` - `avatarsniff-site` (`private: true`, never published), a Next.js 15 / React 19 demo deployed to Coolify. Depends on the lib via `"avatarsniff": "workspace:*"` (pnpm symlinks `site/node_modules/avatarsniff → ../../lib`) + `transpilePackages: ["avatarsniff"]`. The lib must be built (`lib/dist/`) before the site builds.

One root `pnpm-workspace.yaml` (`packages: [lib, site]`, `allowBuilds: { esbuild, sharp }`) and one root `pnpm-lock.yaml` cover both packages.

## Commands

`pnpm install` (from the root) works. But the global `pnpm` binary fails to run *scripts* locally (corepack disabled - a deps-check spawn error), so **run the binaries directly** from inside `lib/`:

```bash
# from lib/
./node_modules/.bin/vitest run                        # full test suite
./node_modules/.bin/vitest run test/analyze.test.ts   # single file
./node_modules/.bin/vitest run -t "name of test"      # single test by name
./node_modules/.bin/vitest run --coverage             # coverage (gate in vitest.config.ts)
./node_modules/.bin/tsc --noEmit                      # typecheck
./node_modules/.bin/tsup                              # build dist/ (esm + cjs + dts)

# from site/ - needs lib/dist built first (run tsup above)
./node_modules/.bin/next dev                           # local dev
./node_modules/.bin/next build                         # prod build (standalone output)
```

In CI and the Docker build, `pnpm` scripts work fine (corepack-provided pnpm 11), so those use `pnpm --filter avatarsniff <script>` etc. CI is `.github/workflows/ci.yml` (Node 24): typecheck + coverage + build the lib, then build the site.

## Deploy (site → Coolify)

Root `Dockerfile` builds the whole workspace: `corepack` → `pnpm install --frozen-lockfile` → build lib → build site → run Next's standalone server (`node site/server.js`). **Build context must be the repo root** so `lib/` is present. In Coolify: Build Pack = Dockerfile, Base Directory = `/`, Dockerfile = `/Dockerfile`. Standalone output is configured in `site/next.config.mjs` (`output: "standalone"` + `outputFileTracingRoot` = repo root).

## Publishing the lib

Independent of the site. From `lib/`: `npm publish` (name `avatarsniff` is free; bump `version` first). `prepublishOnly` runs `pnpm build`, which fails locally - so build manually (`./node_modules/.bin/tsup`) and `npm publish --ignore-scripts`, or run via `pnpm publish` where scripts work.

## Architecture (lib)

A framework- and runtime-agnostic default-avatar detector with **zero install dependencies** - all decoders are bundled into `dist` (devDeps inlined by tsup).

**Pipeline:** encoded bytes → `decode.ts` (→ RGBA pixels) → `analyze.ts` (→ verdict). The single public entry point is `sniff` in `sniff.ts` — a polymorphic, always-async function that sniffs its input: encoded bytes (`Uint8Array`/`ArrayBuffer`) are decoded then analysed, raw pixels (a canvas `ImageData` or any `RgbaImage`) are analysed directly, and a URL `string` is fetched first. It returns `null` only for nullish input or a missing/failed URL. `analyzeImage` (sync, pixels→verdict) is exported for the lowest-level use. `index.ts` is the public surface - re-exports only.

**Decoding (`decode.ts`)** tries layers in order: (1) **native** - `createImageBitmap` + canvas, available in browsers/Deno/Bun/workers, decodes every format including ones not implemented in JS; (2) **pure-JS** - hand-written PNG (inflate via built-in `DecompressionStream`) and GIF (LZW) decoders, plus JPEG via the bundled `jpeg-js`. Undecodable input returns `null`, which callers treat as *not a default, keep it* - the safe outcome for a real photo we can't read.

**Opt-in WEBP/SVG (`webp.ts`, `svg.ts`):** importing `avatarsniff/webp` or `avatarsniff/svg` self-registers a decoder via `registry.ts`. The registry lives on a global `Symbol.for("avatarsniff.decoders")` so it stays a singleton even across separate CJS bundles that can't code-split. This keeps the core ~18KB; each subpath inlines its own wasm (jSquash webp ~138KB, resvg ~3MB) so it only loads when imported.

**The detectors are purely *structural*** - they never match specific palette colours, so they keep working as providers add new ones. The image is downsampled (default 48×48) and `features.ts` (`extractFeatures`) computes one shared feature set (dominant colour/fraction, significant colours, glyph fraction, coloured-other fraction, mean chroma, vertical mirror **symmetry**, light/dark background). `detectors.ts` then runs one detector per family, in priority order, first match wins:

- **`initials`** - near-white glyph on a flat *saturated* colour (dominance+simplicity score). The original heuristic.
- **`solidColor`** - flat saturated colour block, no glyph (dominant ≥ ~0.92, one significant colour).
- **`personIcon`** - greyscale (low mean chroma) + high symmetry + light-grey background + a sizeable near-white figure. Gravatar mystery-person / WhatsApp-style silhouettes.
- **`identicon`** - high mirror symmetry + small palette + substantial foreground. GitHub/Gravatar/DiceBear identicons. Runs after `personIcon` (a silhouette is also symmetric).

`analyze.ts` is the orchestrator: merges `DEFAULTS`, calls `extractFeatures`, loops `DETECTORS` (skipping any disabled via `options.detect`), and returns `{ isDefault, matched, score, … }`. `matched` is the `DetectorName` that fired (or `null`). Per-family opt-out: `detect: { identicon: false }` (every family defaults on). Every threshold is an overridable `DetectOptions` field (defaults in `DEFAULTS`); tune there, don't hardcode. Real photos are mainly rejected by the symmetry gate (≤ ~0.55) - the known precision cost is that bilaterally-symmetric *logos* can read as `identicon`.

When adding a `.wasm`-importing module, the build's esbuild `binary` loader and the test env's `wasm-as-bytes` Vite plugin (in `vitest.config.ts`) must agree so wasm resolves to bytes identically in `dist` and in tests.

## Tests & fixtures

Detection is tested against **real images only**. `test/fixtures/fetch.mjs` crawls public avatar-generation services (UI Avatars, DiceBear, placehold.co, Gravatar, GitHub identicons) and real photos (Lorem Picsum) into per-family folders, and the committed output is the test corpus - run `node test/fixtures/fetch.mjs` to refresh it.

`test/fixtures.test.ts` is folder-driven. Per-family folders (`initials/ solidColor/ personIcon/ identicon/`) assert both `isDefault` **and** the `matched` family; `real/` asserts `isDefault: false`. `local-default/` and `local-real/` are git-ignored (`test/fixtures/local-*/`) for faces/PII, assert `isDefault` only, and skip in CI. Empty folders skip. See `test/fixtures/README.md`.

Decoder tests (`decode.test.ts`, `webp.test.ts`, `svg.test.ts`) still synthesize encoded bytes via `test/image-helpers.ts` - that exercises the decoders themselves, separate from the real-image detection corpus.

## Conventions

- Commits: no `Co-Authored-By` trailer (global rule).
- `gh` CLI is authed as a work account and cannot touch the personal `tunctn` repos; personal pushes go over SSH.
