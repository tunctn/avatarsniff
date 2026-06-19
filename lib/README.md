# avatarsniff

Sniff out generic/default provider avatars — Google's initial-on-colour, the
Gravatar mystery-person, solid-colour placeholders — straight from image pixels.

A lot of users never set a profile picture, so providers serve a boring,
auto-generated default (a letter on a coloured square). `avatarsniff` detects
those so you can replace them with something better (your own generated avatar,
an upload prompt, etc.) instead of showing the generic one.

- **Batteries included, zero dependencies.** Decodes **PNG, JPEG, GIF, WEBP and
  SVG** (up to 10MB) with no native binaries and no install-time deps — every
  decoder is bundled into the build. PNG/GIF/JPEG are in the core; WEBP and SVG
  are opt-in subpaths (so their wasm only loads if you need them).
- **Server and client.** Same API in the browser, Node, Deno, Bun, edge
  runtimes and workers.
- **Framework-agnostic.** No React/Vue/Angular. Just `pnpm install`.
- **Structural heuristic** — keys on shape (flat colour + a small white glyph +
  almost no other content), never on a hard-coded palette, so it keeps working
  as providers add colours.

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
subpaths so their wasm (~228KB and ~3MB) only loads if you import them — the
core stays tiny.

## Install

```sh
pnpm install avatarsniff
```

## Usage

### From image bytes (batteries included) — server or client

```ts
import { detectDefaultAvatar, detectDefaultAvatarFromUrl } from "avatarsniff";

const result = await detectDefaultAvatar(pngOrGifBytes);
if (result.isDefault) {
  // generic provider default — swap in your own avatar
}

const fromUrl = await detectDefaultAvatarFromUrl(user.photoUrl);
// null if the URL is missing or the fetch fails
```

### Browser (canvas `ImageData`, fully synchronous)

```ts
import { detectFromImageData } from "avatarsniff";

const ctx = canvas.getContext("2d")!;
ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
const { isDefault } = detectFromImageData(
  ctx.getImageData(0, 0, canvas.width, canvas.height)
);
```

### Raw pixels (lowest level, anywhere)

```ts
import { analyzeImage } from "avatarsniff";

// `data` is RGB or RGBA bytes; alpha is flattened over white.
const result = analyzeImage({ data, width, height, channels: 4 });
```

### WEBP / SVG in plain Node (opt-in)

PNG, GIF and JPEG decode in core everywhere. To also decode WEBP and SVG in a
plain Node process (no canvas), import the opt-in subpath — it registers the
decoder so the core API picks it up:

```ts
import "avatarsniff/webp"; // registers the WEBP decoder (~228KB wasm)
import "avatarsniff/svg"; // registers the SVG rasteriser (~3MB wasm)
import { detectDefaultAvatar } from "avatarsniff";

await detectDefaultAvatar(webpBytes); // now decodes in plain Node too
```

Or call the decoders directly:

```ts
import { decodeWebp } from "avatarsniff/webp";
import { decodeSvg } from "avatarsniff/svg";

const image = await decodeSvg(svgBytes); // RgbaImage | null
```

The byte/URL helpers accept a `maxBytes` option (default **10MB**); larger inputs
are rejected before decoding.

## Result

```ts
interface DefaultAvatarDetection {
  isDefault: boolean;          // the verdict you usually want
  score: number;               // 0..1, higher = more default-like
  dominantFraction: number;    // share of the most common colour (the background)
  significantColors: number;
  glyphFraction: number;       // share of near-white pixels (the initial)
  coloredOtherFraction: number;// share of "real" content (high => a photo)
  reason: string;              // human-readable explanation
}
```

## How it decides

An image is a default avatar when **all** of these hold:

1. the dominant background is a flat colour that is **not** near-white and
   **not** near-black (providers use saturated mid-tones);
2. there is a small **near-white glyph** (the initial) — so solid blocks are out;
3. there is almost no **other coloured content** — so photos/illustrations on a
   flat background are out.

Every threshold is configurable via the optional `DetectOptions` argument.

## License

MIT © Tunç Türkmen
