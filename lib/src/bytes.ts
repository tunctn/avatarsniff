import { analyzeImage } from "./analyze";
import { decodeImage } from "./decode";
import type { DefaultAvatarDetection, DetectOptions } from "./types";

/**
 * Detect a default avatar straight from encoded image bytes — batteries
 * included, zero dependencies. PNG (the default-avatar format) is decoded by
 * the built-in decoder on every runtime; other formats use the platform's
 * native decoder when available. Undecodable bytes report as not-a-default, so
 * a real photo we can't decode is safely kept rather than wrongly replaced.
 */
export async function detectDefaultAvatar(
  bytes: Uint8Array | ArrayBuffer,
  options: DetectOptions = {}
): Promise<DefaultAvatarDetection> {
  const image = await decodeImage(bytes, options);
  if (!image) {
    return {
      isDefault: false,
      score: 0,
      dominantFraction: 0,
      significantColors: 0,
      glyphFraction: 0,
      coloredOtherFraction: 0,
      reason: "could not decode image (unsupported format in this runtime)",
    };
  }
  return analyzeImage(image, options);
}

/**
 * Fetch an image URL and detect whether it is a default avatar. Returns `null`
 * when the URL is missing or the fetch fails — the caller decides what that
 * means (e.g. keep the existing image).
 */
export async function detectDefaultAvatarFromUrl(
  url: string | null | undefined,
  options: DetectOptions = {}
): Promise<DefaultAvatarDetection | null> {
  if (!url) {
    return null;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return await detectDefaultAvatar(await response.arrayBuffer(), options);
  } catch {
    return null;
  }
}
