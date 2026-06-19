import type {
  DefaultAvatarDetection,
  DetectOptions,
  RgbaImage,
} from "./types";

const DEFAULTS = {
  sampleSize: 48,
  quantizeBits: 4,
  noiseFloor: 0.02,
  minDominantFraction: 0.55,
  maxSignificantColors: 4,
  scoreThreshold: 0.6,
  whiteCutoff: 224,
  blackCutoff: 40,
  glyphWhiteCutoff: 200,
  minGlyphFraction: 0.008,
  maxColoredContent: 0.06,
  // maxBytes is a decode-layer concern, not used by the pixel analysis.
} satisfies Required<Omit<DetectOptions, "maxBytes">>;

function clamp01(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function notDefault(reason: string): DefaultAvatarDetection {
  return {
    isDefault: false,
    score: 0,
    dominantFraction: 0,
    significantColors: 0,
    glyphFraction: 0,
    coloredOtherFraction: 0,
    reason,
  };
}

/**
 * Downsample an image to `size` x `size` via nearest-neighbour and flatten any
 * alpha over white, returning a flat RGB buffer. Keeps results consistent
 * whatever the source size or channel count is.
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
 * Analyse raw image pixels and decide whether they look like a generic/default
 * provider avatar (a single initial drawn in white on a flat colour). Pure: the
 * same input always yields the same result. Framework- and runtime-agnostic —
 * no DOM, no Node, no native dependency.
 *
 * The heuristic keys on *structure*, never on specific palette colours (so it
 * keeps working as providers add new ones):
 *  - the background is a flat, saturated colour (not near-white, not near-black);
 *  - there is a small near-white glyph (the initial), so solid blocks are out;
 *  - there is almost no other coloured content, so photos/illustrations are out.
 */
export function analyzeImage(
  image: RgbaImage,
  options: DetectOptions = {}
): DefaultAvatarDetection {
  const opts = { ...DEFAULTS, ...options };
  const { width, height } = image;
  const channels =
    image.channels ?? Math.round(image.data.length / (width * height));
  if (!(width && height) || channels < 3) {
    return notDefault("empty or non-RGB image");
  }

  const size = opts.sampleSize;
  const pixels = sampleRgb(image, size);
  const totalPixels = size * size;

  // Quantise each channel into `levels` buckets to collapse anti-aliasing
  // fringe. key = r * levels^2 + g * levels + b (arithmetic, no bitwise).
  const levels = 2 ** opts.quantizeBits;
  const divisor = 256 / levels;
  const counts = new Map<number, number>();
  let nearWhitePixels = 0;
  for (let i = 0; i < pixels.length; i += 3) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    if (Math.min(r, g, b) >= opts.glyphWhiteCutoff) {
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
  const dominantRgb = [dominantR, dominantG, dominantB].map(bucketCenter);
  const isLightBackground = dominantRgb.every((c) => c >= opts.whiteCutoff);
  const isDarkBackground = dominantRgb.every((c) => c <= opts.blackCutoff);

  // Coloured content: pixels neither near the dominant background (±1 bucket)
  // nor near-white (the glyph). ~0 for a real default, high for a photo.
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

  const dominantFraction = dominantCount / totalPixels;
  const glyphFraction = nearWhitePixels / totalPixels;
  const coloredOtherFraction = coloredOtherPixels / totalPixels;

  const dominanceScore = clamp01(
    (dominantFraction - opts.minDominantFraction) /
      (1 - opts.minDominantFraction)
  );
  const simplicityScore = clamp01(
    (opts.maxSignificantColors + 1 - significantColors) /
      opts.maxSignificantColors
  );
  const score = clamp01(dominanceScore * 0.6 + simplicityScore * 0.4);

  const hasGlyph = glyphFraction >= opts.minGlyphFraction;
  const isPhotoLike = coloredOtherFraction > opts.maxColoredContent;
  const isDefault =
    !(isLightBackground || isDarkBackground || isPhotoLike) &&
    hasGlyph &&
    dominantFraction >= opts.minDominantFraction &&
    significantColors <= opts.maxSignificantColors &&
    score >= opts.scoreThreshold;

  let reason: string;
  if (isDefault) {
    reason = `coloured background (${(dominantFraction * 100).toFixed(0)}% dominant) with a ${(glyphFraction * 100).toFixed(1)}% white glyph`;
  } else if (isLightBackground) {
    reason = "near-white background — a logo/drawing/photo, not a default";
  } else if (isDarkBackground) {
    reason = "near-black background — a dark photo/icon, not a default";
  } else if (isPhotoLike) {
    reason = `${(coloredOtherFraction * 100).toFixed(1)}% coloured content — a photo/illustration, not a default`;
  } else if (!hasGlyph) {
    reason = `no white glyph (${(glyphFraction * 100).toFixed(1)}%) — a solid block or icon, not a default`;
  } else {
    reason = `not flat enough (${(dominantFraction * 100).toFixed(0)}% dominant, ${significantColors} significant colours)`;
  }

  return {
    isDefault,
    score,
    dominantFraction,
    significantColors,
    glyphFraction,
    coloredOtherFraction,
    reason,
  };
}
