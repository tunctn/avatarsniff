import type { ImageFeatures } from "./features";
import type { DetectorName } from "./types";

/** Resolved (defaults-merged) tuning thresholds the detectors read. */
export interface ResolvedThresholds {
  minDominantFraction: number;
  maxSignificantColors: number;
  scoreThreshold: number;
  minGlyphFraction: number;
  maxColoredContent: number;
  solidMinDominantFraction: number;
  minSymmetry: number;
  maxGrayChroma: number;
  minPersonFigureFraction: number;
  identiconMinSymmetry: number;
  identiconMinForeground: number;
  identiconMaxColors: number;
}

export interface DetectorMatch {
  name: DetectorName;
  score: number;
  reason: string;
}

/** A detector inspects shared features and either claims the image or passes. */
export type Detector = (
  f: ImageFeatures,
  o: ResolvedThresholds
) => DetectorMatch | null;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** A near-white initial drawn on a flat *saturated* colour - the classic
 * Google/Slack/Atlassian default. */
const initials: Detector = (f, o) => {
  if (f.isLightBackground || f.isDarkBackground) {
    return null;
  }
  if (f.dominantChroma < 24) {
    return null; // grey background - a silhouette/identicon, not an initial
  }
  if (f.coloredOtherFraction > o.maxColoredContent) {
    return null; // photo/illustration
  }
  if (
    f.glyphFraction < o.minGlyphFraction ||
    f.dominantFraction < o.minDominantFraction ||
    f.significantColors > o.maxSignificantColors
  ) {
    return null;
  }
  const dominanceScore = clamp01(
    (f.dominantFraction - o.minDominantFraction) / (1 - o.minDominantFraction)
  );
  const simplicityScore = clamp01(
    (o.maxSignificantColors + 1 - f.significantColors) / o.maxSignificantColors
  );
  const score = clamp01(dominanceScore * 0.6 + simplicityScore * 0.4);
  if (score < o.scoreThreshold) {
    return null;
  }
  return {
    name: "initials",
    score,
    reason: `coloured background (${(f.dominantFraction * 100).toFixed(0)}% dominant) with a ${(f.glyphFraction * 100).toFixed(1)}% white glyph`,
  };
};

/** A flat saturated colour block with no glyph - a plain placeholder swatch. */
const solidColor: Detector = (f, o) => {
  if (f.isLightBackground || f.isDarkBackground) {
    return null;
  }
  if (f.dominantChroma < 24) {
    return null; // grey/white/black flat fill is not a coloured default
  }
  if (
    f.dominantFraction < o.solidMinDominantFraction ||
    f.significantColors > 1 ||
    f.glyphFraction >= o.minGlyphFraction
  ) {
    return null;
  }
  return {
    name: "solidColor",
    score: clamp01(f.dominantFraction),
    reason: `flat ${(f.dominantFraction * 100).toFixed(0)}% solid colour with no glyph`,
  };
};

/** A grey/desaturated person silhouette on a light background - the Gravatar
 * "mystery person", WhatsApp/X default-user style. */
const personIcon: Detector = (f, o) => {
  if (f.meanChroma > o.maxGrayChroma) {
    return null; // has colour - not a grey silhouette
  }
  if (f.symmetry < o.minSymmetry) {
    return null; // silhouettes are near-perfectly mirror-symmetric
  }
  const [r, g, b] = f.dominantRgb;
  const lightGreyBackground =
    Math.min(r, g, b) >= 150 && !f.isLightBackground && !f.isDarkBackground;
  if (!lightGreyBackground) {
    return null;
  }
  if (f.glyphFraction < o.minPersonFigureFraction) {
    return null; // no figure
  }
  return {
    name: "personIcon",
    score: clamp01((f.symmetry - o.minSymmetry) / (1 - o.minSymmetry)),
    reason: `grey person silhouette (${(f.glyphFraction * 100).toFixed(0)}% figure) on a light background`,
  };
};

/** A mirror-symmetric blocky pattern - GitHub/Gravatar/DiceBear identicons. */
const identicon: Detector = (f, o) => {
  if (f.symmetry < o.identiconMinSymmetry) {
    return null; // photos and asymmetric glyphs fall out here
  }
  if (f.significantColors > o.identiconMaxColors) {
    return null;
  }
  const foreground = 1 - f.dominantFraction;
  if (foreground < o.identiconMinForeground) {
    return null; // a solid block or a tiny glyph, not a pattern
  }
  return {
    name: "identicon",
    score: clamp01((f.symmetry - o.identiconMinSymmetry) / (1 - o.identiconMinSymmetry)),
    reason: `symmetric pattern (${(f.symmetry * 100).toFixed(0)}% mirror, ${(foreground * 100).toFixed(0)}% foreground)`,
  };
};

/**
 * The detectors in priority order. `personIcon` runs before `identicon` because
 * a grey silhouette is also symmetric - the more specific detector claims it
 * first.
 */
export const DETECTORS: { name: DetectorName; run: Detector }[] = [
  { name: "initials", run: initials },
  { name: "solidColor", run: solidColor },
  { name: "personIcon", run: personIcon },
  { name: "identicon", run: identicon },
];
