import { analyzeImage } from "./analyze";
import type { DefaultAvatarDetection, DetectOptions } from "./types";

/** Minimal structural shape of a canvas `ImageData` (RGBA). */
export interface ImageDataLike {
  data: Uint8ClampedArray | Uint8Array | number[];
  width: number;
  height: number;
}

/**
 * Detect a default avatar from a canvas `ImageData` (or anything shaped like
 * it). Browser-friendly and dependency-free: draw the avatar to a `<canvas>`,
 * `getImageData(...)`, and pass it here.
 *
 * @example
 * const ctx = canvas.getContext("2d");
 * ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
 * const { isDefault } = detectFromImageData(
 *   ctx.getImageData(0, 0, canvas.width, canvas.height)
 * );
 */
export function detectFromImageData(
  imageData: ImageDataLike,
  options: DetectOptions = {}
): DefaultAvatarDetection {
  return analyzeImage(
    {
      data: imageData.data,
      width: imageData.width,
      height: imageData.height,
      channels: 4,
    },
    options
  );
}
