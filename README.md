# avatarsniff

Detect generic/default provider avatars — Google's initial-on-colour, flat
solid-colour placeholders, the Gravatar mystery-person silhouette, GitHub/Gravatar
identicons — straight from image pixels, so you can replace them with something
better.

This repository is a [pnpm](https://pnpm.io) workspace with two packages:

| Package | Path | Published | What it is |
| --- | --- | --- | --- |
| [`avatarsniff`](./lib) | `lib/` | [✅ npm](https://www.npmjs.com/package/avatarsniff) | The library. Framework- and runtime-agnostic, zero install dependencies. |
| `avatarsniff-site` | `site/` | private | Next.js 15 / React 19 demo, deployed to Coolify. |

**👉 If you just want to use the library, read [`lib/README.md`](./lib/README.md).**

## Install

```sh
npm  install avatarsniff
pnpm add     avatarsniff
yarn add     avatarsniff
```

```ts
import { sniff } from "avatarsniff";

const result = await sniff(bytesOrUrl);
if (result?.isDefault) {
  // generic provider default (result.matched says which family) — swap it out
}
```

Full API, the decoding matrix, and the WEBP/SVG opt-in subpaths are documented in
[`lib/README.md`](./lib/README.md).

## Develop

```sh
pnpm install            # from the repo root — installs both packages

# library (lib/)
pnpm --filter avatarsniff typecheck
pnpm --filter avatarsniff test
pnpm --filter avatarsniff build      # emits lib/dist (esm + cjs + dts)

# site (site/) — needs lib built first
pnpm --filter avatarsniff-site dev
```

The library bundles every decoder into `dist`, so the published package has **zero
runtime dependencies**. The site depends on the lib via `workspace:*` and is never
published to npm.

## Release

The library publishes to npm from CI when a `v*` tag is pushed
(`.github/workflows/release.yml`). The site deploys separately from the root
`Dockerfile`.

## License

[MIT](./LICENSE) © Tunç Türkmen
