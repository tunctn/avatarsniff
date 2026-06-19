import type { DetectOptions, RgbaImage } from "./types";

/**
 * Structural features of an avatar image, computed once from a downsampled RGB
 * copy and shared by every detector. Pure: the same image and options always
 * yield the same features.
 */
export interface ImageFeatures {
  /** Edge length the image was sampled to. */
  size: number;
  /** size * size. */
  totalPixels: number;
  /** Flat RGB buffer of the downsampled image (size * size * 3). */
  pixels: Uint8Array;
  /** Fraction of pixels in the single most common quantised colour. */
  dominantFraction: number;
  /** Bucket-centre RGB of the dominant colour. */
  dominantRgb: [number, number, number];
  /** Chroma (max-min channel) of the dominant colour; 0 = grey background. */
  dominantChroma: number;
  /** Quantised bucket coordinates of the dominant colour, per channel. */
  dominantBucket: [number, number, number];
  /** Distinct quantised colours each covering >= the noise floor. */
  significantColors: number;
  /** Fraction of near-white pixels (the glyph/figure). */
  glyphFraction: number;
  /** Fraction of pixels that are neither background nor near-white. */
  coloredOtherFraction: number;
  /** Mean per-pixel chroma (max-min channel), 0 = greyscale. */
  meanChroma: number;
  /** Vertical mirror symmetry in [0,1]; 1 = perfectly left-right symmetric. */
  symmetry: number;
  /** Dominant colour is near-white (every channel >= whiteCutoff). */
  isLightBackground: boolean;
  /** Dominant colour is near-black (every channel <= blackCutoff). */
  isDarkBackground: boolean;
  /** Number of quantisation levels per channel used. */
  levels: number;
  /** 256 / levels. */
  divisor: number;
}

/**
 * Downsample to `size`x`size` via nearest-neighbour, flattening any alpha over
 * white, into a flat RGB buffer - consistent whatever the source size/channels.
 */
function sampleRgb(image: RgbaImage, size: number): Uint8Array {
  const { data, width, height } = image;
  const channels = image.channels ?? Math.round(data.length / (width * height));
  const out = new Uint8Array(size * size * 3);
  for (let sy = 0; sy < size; sy++) {
    const srcY = Math.min(height - 1, Math.floor(((sy + 0.5) * height) / size));
    for (let sx = 0; sx < size; sx++) {
      const srcX = Math.min(width - 1, Math.floor(((sx + 0.5) * width) / size));
      const si = (srcY * width + srcX) * channels;
      let r = data[si];
      let g = data[si + 1];
      let b = data[si + 2];
      if (channels === 4) {
        const alpha = data[si + 3] / 255;
        r = Math.round(r * alpha + 255 * (1 - alpha));
        g = Math.round(g * alpha + 255 * (1 - alpha));
        b = Math.round(b * alpha + 255 * (1 - alpha));
      }
      const di = (sy * size + sx) * 3;
      out[di] = r;
      out[di + 1] = g;
      out[di + 2] = b;
    }
  }
  return out;
}

/**
 * Extract the shared structural features the detectors key on. Returns `null`
 * for an empty or non-RGB image (nothing can be a default).
 */
export function extractFeatures(
  image: RgbaImage,
  opts: Required<
    Pick<
      DetectOptions,
      | "sampleSize"
      | "quantizeBits"
      | "noiseFloor"
      | "glyphWhiteCutoff"
      | "whiteCutoff"
      | "blackCutoff"
    >
  >
): ImageFeatures | null {
  const { width, height } = image;
  const channels =
    image.channels ?? Math.round(image.data.length / (width * height));
  if (!(width && height) || channels < 3) {
    return null;
  }

  const size = opts.sampleSize;
  const totalPixels = size * size;
  const pixels = sampleRgb(image, size);

  const levels = 2 ** opts.quantizeBits;
  const divisor = 256 / levels;
  const counts = new Map<number, number>();
  let nearWhitePixels = 0;
  let chromaSum = 0;
  for (let i = 0; i < pixels.length; i += 3) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    chromaSum += max - min;
    if (min >= opts.glyphWhiteCutoff) {
      nearWhitePixels += 1;
    }
    const key =
      Math.floor(r / divisor) * levels * levels +
      Math.floor(g / divisor) * levels +
      Math.floor(b / divisor);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let dominantCount = 0;
  let dominantKey = 0;
  let significantColors = 0;
  const noiseThreshold = opts.noiseFloor * totalPixels;
  for (const [key, count] of counts) {
    if (count > dominantCount) {
      dominantCount = count;
      dominantKey = key;
    }
    if (count >= noiseThreshold) {
      significantColors += 1;
    }
  }

  const dominantB = dominantKey % levels;
  const dominantG = Math.floor(dominantKey / levels) % levels;
  const dominantR = Math.floor(dominantKey / (levels * levels)) % levels;
  const bucketCenter = (bucket: number) => (bucket + 0.5) * divisor;
  const dominantRgb = [dominantR, dominantG, dominantB].map(bucketCenter) as [
    number,
    number,
    number,
  ];

  // Coloured content: pixels neither near the dominant background (±1 bucket)
  // nor near-white (the glyph). ~0 for a flat default, high for a photo.
  let coloredOtherPixels = 0;
  for (let i = 0; i < pixels.length; i += 3) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    if (Math.min(r, g, b) >= opts.glyphWhiteCutoff) {
      continue;
    }
    const nearDominant =
      Math.abs(Math.floor(r / divisor) - dominantR) <= 1 &&
      Math.abs(Math.floor(g / divisor) - dominantG) <= 1 &&
      Math.abs(Math.floor(b / divisor) - dominantB) <= 1;
    if (!nearDominant) {
      coloredOtherPixels += 1;
    }
  }

  // Vertical mirror symmetry: fraction of pixels whose left-right mirror is the
  // same colour within tolerance. Generated patterns (identicons, silhouettes)
  // are near-perfectly symmetric; photos and asymmetric glyphs are not.
  let symMatches = 0;
  const tol = 36;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      const mi = (y * size + (size - 1 - x)) * 3;
      const diff =
        Math.abs(pixels[i] - pixels[mi]) +
        Math.abs(pixels[i + 1] - pixels[mi + 1]) +
        Math.abs(pixels[i + 2] - pixels[mi + 2]);
      if (diff <= tol) {
        symMatches += 1;
      }
    }
  }

  return {
    size,
    totalPixels,
    pixels,
    dominantFraction: dominantCount / totalPixels,
    dominantRgb,
    dominantChroma: Math.max(...dominantRgb) - Math.min(...dominantRgb),
    dominantBucket: [dominantR, dominantG, dominantB],
    significantColors,
    glyphFraction: nearWhitePixels / totalPixels,
    coloredOtherFraction: coloredOtherPixels / totalPixels,
    meanChroma: chromaSum / totalPixels,
    symmetry: symMatches / totalPixels,
    isLightBackground: dominantRgb.every((c) => c >= opts.whiteCutoff),
    isDarkBackground: dominantRgb.every((c) => c <= opts.blackCutoff),
    levels,
    divisor,
  };
}
