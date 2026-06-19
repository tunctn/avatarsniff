/** Raw image pixels to analyse. Accepts 3-channel (RGB) or 4-channel (RGBA)
 * data - alpha is flattened over white. Works with anything that can produce a
 * pixel buffer: `sharp().raw()`, a `<canvas>` `ImageData`, `node-canvas`, etc. */
export interface RgbaImage {
  data: Uint8Array | Uint8ClampedArray | number[];
  width: number;
  height: number;
  /** 3 (RGB) or 4 (RGBA). Inferred from `data.length` when omitted. */
  channels?: number;
}

export type ImageFormat = "png" | "jpeg" | "gif" | "webp" | "svg" | "unknown";

/**
 * The families of default avatar the detector recognises. Each is an
 * independent structural detector; a verdict reports which one (if any) fired:
 *  - `initials`   - a near-white initial drawn on a flat saturated colour;
 *  - `solidColor` - a flat saturated colour block with no glyph;
 *  - `personIcon` - a grey/desaturated person silhouette on a light background;
 *  - `identicon`  - a mirror-symmetric blocky pattern (GitHub/Gravatar style).
 */
export type DetectorName = "initials" | "solidColor" | "personIcon" | "identicon";

export const DETECTOR_NAMES: readonly DetectorName[] = [
  "initials",
  "solidColor",
  "personIcon",
  "identicon",
];

/** Per-family on/off switches. Every family defaults to `true`; set one to
 * `false` to opt out of that detector. */
export type DetectorToggles = Partial<Record<DetectorName, boolean>>;

export interface DecodeOptions {
  /** Reject inputs larger than this many bytes before decoding (default 10MB). */
  maxBytes?: number;
}

export interface DetectOptions extends DecodeOptions {
  /** Which detector families to run. Each defaults to `true`; set a family to
   * `false` to skip it (e.g. `{ detect: { identicon: false } }`). */
  detect?: DetectorToggles;
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
  /** `solidColor`: min dominant fraction for a flat colour block (default 0.92). */
  solidMinDominantFraction?: number;
  /** `personIcon`/`identicon`: min vertical mirror-symmetry in [0,1] a generated
   * pattern must reach (default 0.9). Real photos sit well below this. */
  minSymmetry?: number;
  /** `personIcon`: max mean per-pixel chroma (max-min channel) for the image to
   * count as greyscale (default 18). */
  maxGrayChroma?: number;
  /** `personIcon`: min fraction of near-white pixels forming the figure
   * (default 0.1). */
  minPersonFigureFraction?: number;
  /** `identicon`: min symmetry for the pattern (default 0.92, slightly stricter
   * than `minSymmetry`). */
  identiconMinSymmetry?: number;
  /** `identicon`: min foreground fraction (non-dominant pixels) (default 0.12). */
  identiconMinForeground?: number;
  /** `identicon`: max significant colours allowed (default 6). */
  identiconMaxColors?: number;
}

export interface DefaultAvatarDetection {
  /** Confident verdict: true => looks like a generic/default provider avatar. */
  isDefault: boolean;
  /** Which detector family matched, or `null` when nothing did. */
  matched: DetectorName | null;
  /** Score in [0,1]; higher = more default-like. For logging/tuning. */
  score: number;
  /** Fraction of pixels belonging to the single most common quantised colour. */
  dominantFraction: number;
  /** Count of distinct quantised colours each covering >= the noise floor. */
  significantColors: number;
  /** Fraction of near-white pixels - the glyph (initial) on a real default. */
  glyphFraction: number;
  /** Fraction of pixels that are neither background nor glyph - actual content. */
  coloredOtherFraction: number;
  /** Short human-readable reason for the verdict. */
  reason: string;
}
