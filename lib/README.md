# avatarsniff

[![npm version](https://img.shields.io/npm/v/avatarsniff.svg)](https://www.npmjs.com/package/avatarsniff)
[![bundle size](https://img.shields.io/bundlephobia/minzip/avatarsniff.svg)](https://bundlephobia.com/package/avatarsniff)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](https://www.npmjs.com/package/avatarsniff?activeTab=dependencies)
[![types included](https://img.shields.io/npm/types/avatarsniff.svg)](https://www.npmjs.com/package/avatarsniff)
[![license](https://img.shields.io/npm/l/avatarsniff.svg)](./LICENSE)

Sniff out generic/default provider avatars - Google's initial-on-colour, flat
solid-colour placeholders, the Gravatar mystery-person silhouette, GitHub/Gravatar
identicons - straight from image pixels.

A lot of users never set a profile picture, so providers serve a boring,
auto-generated default (a letter on a coloured square). `avatarsniff` detects
those so you can replace them with something better (your own generated avatar,
an upload prompt, etc.) instead of showing the generic one.

- **Batteries included, zero dependencies.** Decodes **PNG, JPEG, GIF, WEBP and
  SVG** (up to 10MB) with no native binaries and no install-time deps - every
  decoder is bundled into the build. PNG/GIF/JPEG are in the core; WEBP and SVG
  are opt-in subpaths (so their wasm only loads if you need them).
- **Server and client.** Same API in the browser, Node, Deno, Bun, edge
  runtimes and workers.
- **Framework-agnostic.** No React/Vue/Angular - just install and import.
- **Four structural detectors** - `initials`, `solidColor`, `personIcon`,
  `identicon`. Each keys on shape (flat colour, a white glyph, mirror symmetry),
  never on a hard-coded palette, so they keep working as providers add colours.
  Every family is on by default; opt out per call.

### Decoding matrix

| Format | Browser / Deno / Bun / worker | Node (no canvas) |
| ------ | ----------------------------- | ---------------- |
| PNG    | ✅ native or built-in          | ✅ built-in (pure JS) |
| GIF    | ✅ native or built-in          | ✅ built-in (pure JS) |
| JPEG   | ✅ native or built-in          | ✅ built-in (bundled `jpeg-js`) |
| WEBP   | ✅ native                      | ✅ `import "avatarsniff/webp"` |
| SVG    | ✅ rasterised                  | ✅ `import "avatarsniff/svg"` |

Every decoder is inlined into the build, so installing `avatarsniff` pulls
**zero** dependencies. PNG/GIF/JPEG are in the core. WEBP and SVG ship as opt-in
subpaths so their wasm (~228KB and ~3MB) only loads if you import them - the
core stays tiny.

## Install

```sh
npm  install avatarsniff
pnpm add     avatarsniff
yarn add     avatarsniff
```

## Usage

One entry point - `sniff` - figures out what you passed it. Always async.

### From image bytes or a URL (batteries included) - server or client

```ts
import { sniff } from "avatarsniff";

const result = await sniff(pngOrGifBytes); // Uint8Array | ArrayBuffer
if (result.isDefault) {
  // generic provider default (result.matched tells you which family)
  // swap in your own avatar
}

const fromUrl = await sniff(user.photoUrl); // string URL, fetched for you
// null if the URL is missing or the fetch fails
```

### In a server component / API route (the common case)

The usual question is "the provider gave me a `photoUrl` - should I show it, or
swap in my own avatar?" That's one call:

```tsx
// e.g. a Next.js server component
import { sniff } from "avatarsniff";

export async function Avatar({ user }: { user: { name: string; photoUrl: string } }) {
  const result = await sniff(user.photoUrl);
  // null (missing/failed fetch) or a real photo -> keep theirs; otherwise generate
  return result?.isDefault ? <GeneratedAvatar name={user.name} /> : <img src={user.photoUrl} alt="" />;
}
```

### Browser (canvas `ImageData`)

```ts
import { sniff } from "avatarsniff";

const ctx = canvas.getContext("2d")!;
ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
const { isDefault, matched } = await sniff(
  ctx.getImageData(0, 0, canvas.width, canvas.height)
);
```

> **Draw at the image's natural size, not a shrunken one.** `sniff` downsamples
> internally. If you scale the image down onto a small canvas first (with image
> smoothing on), the blur averages fine detail into grey and a busy identicon can
> read as a near-white photo. Either draw 1:1 at `img.naturalWidth/Height`, set
> `ctx.imageSmoothingEnabled = false`, or just pass the original bytes to `sniff`.

### Opt out of detector families

Every family runs by default. Disable any of `initials`, `solidColor`,
`personIcon`, `identicon` per call:

```ts
await sniff(bytes, { detect: { identicon: false, personIcon: false } });
```

### Tune the thresholds

Every threshold is an overridable field on the second argument (`DetectOptions`);
the defaults are conservative. A few you might reach for:

```ts
await sniff(bytes, {
  scoreThreshold: 0.6, // verdict cutoff in [0,1]; raise to be stricter
  minSymmetry: 0.9, // mirror-symmetry a generated pattern must reach (the main photo gate)
  maxColoredContent: 0.06, // max "real content" a default may have; raise to tolerate busier defaults
  sampleSize: 48, // edge length the image is downsampled to before sampling
  maxBytes: 10_000_000, // reject larger inputs before decoding (default 10MB)
});
```

See the `DetectOptions` type for the full list (background/glyph cutoffs,
per-family symmetry and foreground thresholds, colour quantisation, etc.) - all
are typed and documented inline.

### Raw pixels, synchronously (lowest level, anywhere)

`sniff` is async; for a synchronous call on pixels you already have, use
`analyzeImage`:

```ts
import { analyzeImage } from "avatarsniff";

// `data` is RGB or RGBA bytes; alpha is flattened over white.
const result = analyzeImage({ data, width, height, channels: 4 });
```

### WEBP / SVG in plain Node (opt-in)

PNG, GIF and JPEG decode in core everywhere. To also decode WEBP and SVG in a
plain Node process (no canvas), import the opt-in subpath - it registers the
decoder so the core API picks it up:

```ts
import "avatarsniff/webp"; // registers the WEBP decoder (~228KB wasm)
import "avatarsniff/svg"; // registers the SVG rasteriser (~3MB wasm)
import { sniff } from "avatarsniff";

await sniff(webpBytes); // now decodes in plain Node too
```

Or call the decoders directly:

```ts
import { decodeWebp } from "avatarsniff/webp";
import { decodeSvg } from "avatarsniff/svg";

const image = await decodeSvg(svgBytes); // RgbaImage | null
```

`sniff` accepts a `maxBytes` option (default **10MB**); larger inputs are
rejected before decoding.

## Result

```ts
type DetectorName = "initials" | "solidColor" | "personIcon" | "identicon";

interface DefaultAvatarDetection {
  isDefault: boolean;          // the verdict you usually want
  matched: DetectorName | null;// which family fired (null if none)
  score: number;               // 0..1, higher = more default-like
  dominantFraction: number;    // share of the most common colour (the background)
  significantColors: number;
  glyphFraction: number;       // share of near-white pixels (the initial)
  coloredOtherFraction: number;// share of "real" content (high => a photo)
  reason: string;              // human-readable explanation
}
```

`sniff` resolves to `null` only when there was nothing to sniff - a nullish input
or a URL that was missing/failed to fetch.

## How it decides

Each family is an independent structural detector; the first to match wins and is
reported in `matched`. The detectors never match specific palette colours, so
they keep working as providers add new ones.

- **`initials`** - a near-white glyph (the letter) on a flat **saturated** colour
  that is neither near-white nor near-black, with almost no other content.
- **`solidColor`** - a flat saturated colour block with no glyph.
- **`personIcon`** - a desaturated (grey) person silhouette on a light
  background, strongly mirror-symmetric.
- **`identicon`** - a mirror-symmetric blocky pattern (GitHub / Gravatar /
  DiceBear), small palette, substantial foreground.

Real photos are mainly ruled out by the symmetry test and by having lots of
coloured content. Every threshold is configurable via the optional
`DetectOptions` argument, and any family can be turned off with `detect`.

## Limitations

avatarsniff favours **recall over precision** - it would rather flag a default it
should keep than miss one. The structural detectors don't know what an image
*means*, only what it looks like, so a few real images can read as defaults:

- **Bilaterally symmetric logos** (a centred wordmark, a mirror-symmetric icon)
  can match `identicon`, which keys on mirror symmetry. This is the main known
  false positive. If your images are brand logos rather than user photos, disable
  it: `sniff(bytes, { detect: { identicon: false } })`.
- **Flat single-colour brand images** can match `solidColor`.
- **Undecodable input** (an unsupported format, a corrupt or truncated file)
  returns `null`, which you should treat as "not a default, keep it" - the safe
  outcome for a real photo we couldn't read.

If false positives matter for your data, raise `scoreThreshold` / `minSymmetry`
or turn off the families you don't expect (see [Tune the thresholds](#tune-the-thresholds)).

## License

MIT © Tunç Türkmen
