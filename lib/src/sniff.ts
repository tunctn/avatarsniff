import { analyzeImage } from "./analyze";
import { decodeImage } from "./decode";
import type {
  DefaultAvatarDetection,
  DetectOptions,
  RgbaImage,
} from "./types";

/** Minimal structural shape of a canvas `ImageData` (RGBA pixels). */
export interface ImageDataLike {
  data: Uint8ClampedArray | Uint8Array | number[];
  width: number;
  height: number;
}

/**
 * Anything `sniff` accepts:
 *  - encoded bytes (`Uint8Array` / `ArrayBuffer`) — decoded, then analysed;
 *  - raw pixels (a canvas `ImageData` or any `RgbaImage`) — analysed directly;
 *  - a URL string — fetched, then decoded and analysed;
 *  - `null` / `undefined` — resolves to `null` (nothing to sniff).
 */
export type SniffInput =
  | Uint8Array
  | ArrayBuffer
  | ImageDataLike
  | RgbaImage
  | string
  | null
  | undefined;

function notDefault(reason: string): DefaultAvatarDetection {
  return {
    isDefault: false,
    matched: null,
    score: 0,
    dominantFraction: 0,
    significantColors: 0,
    glyphFraction: 0,
    coloredOtherFraction: 0,
    reason,
  };
}

/**
 * Detect whether an avatar is a generic provider default. The one entry point —
 * it sniffs out what you passed and does the right thing:
 *
 * ```ts
 * await sniff(bytes);                 // Uint8Array / ArrayBuffer
 * await sniff(canvasImageData);       // browser <canvas> getImageData()
 * await sniff(user.photoUrl);         // URL string (fetched for you)
 * await sniff(bytes, { detect: { identicon: false } });
 * ```
 *
 * Always async. Returns `null` only when there was nothing to sniff — a
 * nullish input, or a URL that was missing or failed to fetch — so the caller
 * can keep the existing image. Undecodable bytes resolve to a not-a-default
 * verdict (a real photo we can't read is safely kept, not wrongly replaced).
 */
export function sniff(
  input: string | null | undefined,
  options?: DetectOptions
): Promise<DefaultAvatarDetection | null>;
export function sniff(
  input: Uint8Array | ArrayBuffer | ImageDataLike | RgbaImage,
  options?: DetectOptions
): Promise<DefaultAvatarDetection>;
export async function sniff(
  input: SniffInput,
  options: DetectOptions = {}
): Promise<DefaultAvatarDetection | null> {
  if (input == null) {
    return null;
  }

  // URL — fetch, then sniff the bytes. Null on a missing/failed fetch.
  if (typeof input === "string") {
    try {
      const response = await fetch(input);
      if (!response.ok) {
        return null;
      }
      return await sniff(new Uint8Array(await response.arrayBuffer()), options);
    } catch {
      return null;
    }
  }

  // Encoded bytes — decode to pixels first.
  if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
    const image = await decodeImage(input as Uint8Array | ArrayBuffer, options);
    if (!image) {
      return notDefault(
        "could not decode image (unsupported format in this runtime)"
      );
    }
    return analyzeImage(image, options);
  }

  // Raw pixels — a canvas ImageData or an RgbaImage. `channels` is inferred from
  // the buffer length when absent (ImageData is always 4).
  const pixels = input as ImageDataLike | RgbaImage;
  return analyzeImage(
    {
      data: pixels.data,
      width: pixels.width,
      height: pixels.height,
      channels: (pixels as RgbaImage).channels,
    },
    options
  );
}
