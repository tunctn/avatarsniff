/** Raw image pixels to analyse. Accepts 3-channel (RGB) or 4-channel (RGBA)
 * data — alpha is flattened over white. Works with anything that can produce a
 * pixel buffer: `sharp().raw()`, a `<canvas>` `ImageData`, `node-canvas`, etc. */
export interface RgbaImage {
  data: Uint8Array | Uint8ClampedArray | number[];
  width: number;
  height: number;
  /** 3 (RGB) or 4 (RGBA). Inferred from `data.length` when omitted. */
  channels?: number;
}

export type ImageFormat = "png" | "jpeg" | "gif" | "webp" | "svg" | "unknown";

export interface DecodeOptions {
  /** Reject inputs larger than this many bytes before decoding (default 10MB). */
  maxBytes?: number;
}

export interface DetectOptions extends DecodeOptions {
  /** Edge length the image is downsampled to before sampling (default 48). */
  sampleSize?: number;
  /** Bits dropped per channel when quantising colours (default 4 => 16 levels). */
  quantizeBits?: number;
  /** Min fraction a colour must cover to count as "significant" (default 0.02). */
  noiseFloor?: number;
  /** Background must cover at least this fraction of the frame (default 0.55). */
  minDominantFraction?: number;
  /** Max significant colours allowed for a default (default 4). */
  maxSignificantColors?: number;
  /** Verdict score threshold in [0,1] (default 0.6). */
  scoreThreshold?: number;
  /** Per-channel value at/above which the dominant background is "white"
   * (default 224). A near-white background is a logo/photo on white. */
  whiteCutoff?: number;
  /** Per-channel value at/below which the dominant background is "black"
   * (default 40). Provider defaults never use near-black backgrounds. */
  blackCutoff?: number;
  /** Per-channel value at/above which a pixel is part of the white glyph
   * (default 200). */
  glyphWhiteCutoff?: number;
  /** Min fraction of near-white pixels for the image to have a glyph
   * (default 0.008). Solid blocks have ~none; even thin letters clear this. */
  minGlyphFraction?: number;
  /** Max fraction of "coloured content" (neither background nor glyph) a
   * default may have (default 0.06). Photos/illustrations have lots. */
  maxColoredContent?: number;
}

export interface DefaultAvatarDetection {
  /** Confident verdict: true => looks like a generic/default provider avatar. */
  isDefault: boolean;
  /** Score in [0,1]; higher = more default-like. For logging/tuning. */
  score: number;
  /** Fraction of pixels belonging to the single most common quantised colour. */
  dominantFraction: number;
  /** Count of distinct quantised colours each covering >= the noise floor. */
  significantColors: number;
  /** Fraction of near-white pixels — the glyph (initial) on a real default. */
  glyphFraction: number;
  /** Fraction of pixels that are neither background nor glyph — actual content. */
  coloredOtherFraction: number;
  /** Short human-readable reason for the verdict. */
  reason: string;
}
