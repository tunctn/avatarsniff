import { DETECTORS, type ResolvedThresholds } from "./detectors";
import { extractFeatures, type ImageFeatures } from "./features";
import type {
  DefaultAvatarDetection,
  DetectorName,
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
  solidMinDominantFraction: 0.92,
  minSymmetry: 0.9,
  maxGrayChroma: 18,
  minPersonFigureFraction: 0.1,
  identiconMinSymmetry: 0.92,
  identiconMinForeground: 0.12,
  identiconMaxColors: 6,
  // maxBytes is a decode-layer concern, not used by the pixel analysis.
} satisfies Required<Omit<DetectOptions, "maxBytes" | "detect">>;

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

/** Why the image was rejected - picks the most informative structural reason. */
function rejectionReason(
  f: ImageFeatures,
  o: typeof DEFAULTS
): string {
  if (f.isLightBackground) {
    return "near-white background - a logo/drawing/photo, not a default";
  }
  if (f.isDarkBackground) {
    return "near-black background - a dark photo/icon, not a default";
  }
  if (f.coloredOtherFraction > o.maxColoredContent) {
    return `${(f.coloredOtherFraction * 100).toFixed(1)}% coloured content - a photo/illustration, not a default`;
  }
  if (f.glyphFraction < o.minGlyphFraction && f.dominantFraction < o.solidMinDominantFraction) {
    return `no glyph (${(f.glyphFraction * 100).toFixed(1)}%) and not a flat block - not a default`;
  }
  return `not a recognised default (${(f.dominantFraction * 100).toFixed(0)}% dominant, ${f.significantColors} significant colours, ${(f.symmetry * 100).toFixed(0)}% symmetry)`;
}

/**
 * Analyse raw image pixels and decide whether they look like a generic/default
 * provider avatar. Pure: the same input always yields the same result.
 * Framework- and runtime-agnostic - no DOM, no Node, no native dependency.
 *
 * Runs an independent structural detector per family (initials, solidColor,
 * personIcon, identicon); the first to claim the image wins, and `matched`
 * reports which. Disable families via `options.detect` (each defaults on). The
 * heuristics key on *structure*, never on specific palette colours, so they
 * keep working as providers add new ones.
 */
export function analyzeImage(
  image: RgbaImage,
  options: DetectOptions = {}
): DefaultAvatarDetection {
  const opts = { ...DEFAULTS, ...options };
  const features = extractFeatures(image, opts);
  if (!features) {
    return notDefault("empty or non-RGB image");
  }

  const thresholds: ResolvedThresholds = opts;
  const toggles = options.detect ?? {};
  const base = {
    dominantFraction: features.dominantFraction,
    significantColors: features.significantColors,
    glyphFraction: features.glyphFraction,
    coloredOtherFraction: features.coloredOtherFraction,
  };

  for (const { name, run } of DETECTORS) {
    if (toggles[name] === false) {
      continue;
    }
    const match = run(features, thresholds);
    if (match) {
      return {
        isDefault: true,
        matched: match.name,
        score: match.score,
        reason: match.reason,
        ...base,
      };
    }
  }

  return {
    isDefault: false,
    matched: null,
    score: 0,
    reason: rejectionReason(features, opts),
    ...base,
  };
}

export type { DetectorName };
