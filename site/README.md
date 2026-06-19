# avatarsniff-site

Landing page + live demo for [avatarsniff](https://github.com/tunctn/avatarsniff).
Next.js (App Router), no UI framework beyond React. The demo runs the library's
zero-dependency browser API (`detectFromImageData`) entirely client-side.

## Develop

The site depends on the library via a local path (`file:../avatarsniff`), so
check out both repos side by side and build the library once:

```sh
# in ../avatarsniff
pnpm install && pnpm build

# here
pnpm install
pnpm dev
```

Once `avatarsniff` is published to npm, swap the `file:../avatarsniff`
dependency for the released version.

## Build

```sh
pnpm build && pnpm start
```

Design nods to [Sonner](https://sonner.emilkowal.ski).
