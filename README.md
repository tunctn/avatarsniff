# avatarsniff

Detect generic/default provider avatars — Google's initial-on-colour, flat
solid-colour placeholders, the Gravatar mystery-person silhouette, GitHub/Gravatar
identicons — straight from image pixels, so you can replace them with something
better.

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

**👉 Full API, the decoding matrix, and the WEBP/SVG opt-in subpaths are in
[`lib/README.md`](./lib/README.md).**

## Repository

- [`lib/`](./lib) — the [`avatarsniff`](https://www.npmjs.com/package/avatarsniff)
  package. Framework- and runtime-agnostic, zero install dependencies.
- [`site/`](./site) — a Next.js demo of the detector (not published).

## Develop

```sh
pnpm install

pnpm --filter avatarsniff typecheck
pnpm --filter avatarsniff test
pnpm --filter avatarsniff build
```

## License

[MIT](./LICENSE) © Tunç Türkmen
