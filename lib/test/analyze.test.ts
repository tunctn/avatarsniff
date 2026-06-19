import { describe, expect, test } from "vitest";
import { analyzeImage } from "../src/analyze";
import { detectFromImageData } from "../src/image-data";
import type { RgbaImage } from "../src/types";

type Rgb = [number, number, number];
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: Rgb;
}

/** Build an RGB test image with a flat background and optional filled rects. */
function image(
  width: number,
  height: number,
  background: Rgb,
  rects: Rect[] = []
): RgbaImage {
  const data = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    data[i * 3] = background[0];
    data[i * 3 + 1] = background[1];
    data[i * 3 + 2] = background[2];
  }
  for (const rect of rects) {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        if (x < width && y < height) {
          const i = (y * width + x) * 3;
          data[i] = rect.color[0];
          data[i + 1] = rect.color[1];
          data[i + 2] = rect.color[2];
        }
      }
    }
  }
  return { data, width, height, channels: 3 };
}

const WHITE: Rgb = [255, 255, 255];
const GOOGLE_BLUE: Rgb = [66, 133, 244];

describe("analyzeImage", () => {
  test("flags a white initial on a coloured background (default avatar)", () => {
    const result = analyzeImage(
      image(64, 64, GOOGLE_BLUE, [{ x: 24, y: 18, w: 16, h: 28, color: WHITE }])
    );
    expect(result.isDefault).toBe(true);
    expect(result.glyphFraction).toBeGreaterThan(0.008);
    expect(result.reason).toContain("white glyph");
  });

  test("keeps a thin initial (low glyph fraction) as a default", () => {
    // A skinny "I" glyph — only ~1.5% of the frame, but still a real default.
    const result = analyzeImage(
      image(64, 64, [230, 90, 30], [{ x: 30, y: 16, w: 4, h: 30, color: WHITE }])
    );
    expect(result.isDefault).toBe(true);
  });

  test("does not flag a near-white background (logo/drawing on white)", () => {
    const result = analyzeImage(
      image(64, 64, WHITE, [{ x: 24, y: 18, w: 16, h: 28, color: [20, 20, 20] }])
    );
    expect(result.isDefault).toBe(false);
    expect(result.reason).toContain("near-white");
  });

  test("does not flag a white glyph on a near-black background", () => {
    const result = analyzeImage(
      image(64, 64, [18, 18, 18], [{ x: 24, y: 18, w: 16, h: 28, color: WHITE }])
    );
    expect(result.isDefault).toBe(false);
    expect(result.reason).toContain("near-black");
  });

  test("does not flag a solid single-colour block (no glyph)", () => {
    const result = analyzeImage(image(64, 64, [30, 110, 200]));
    expect(result.isDefault).toBe(false);
    expect(result.reason).toContain("no white glyph");
  });

  test("does not flag a colourful illustration on a flat colour", () => {
    const result = analyzeImage(
      image(64, 64, [20, 160, 160], [
        { x: 6, y: 34, w: 30, h: 26, color: [210, 40, 60] },
        { x: 44, y: 8, w: 8, h: 12, color: WHITE },
      ])
    );
    expect(result.isDefault).toBe(false);
    expect(result.reason).toContain("coloured content");
  });

  test("does not flag a busy multi-colour image", () => {
    const colors: Rgb[] = [
      [200, 20, 20],
      [20, 200, 20],
      [20, 20, 200],
      [200, 200, 20],
      [200, 20, 200],
      [20, 200, 200],
    ];
    const rects: Rect[] = colors.map((color, i) => ({
      x: (i % 3) * 22,
      y: Math.floor(i / 3) * 32,
      w: 22,
      h: 32,
      color,
    }));
    const result = analyzeImage(image(66, 64, [10, 10, 10], rects));
    expect(result.isDefault).toBe(false);
  });

  test("returns a safe verdict for an empty/degenerate image", () => {
    const result = analyzeImage({ data: new Uint8Array(0), width: 0, height: 0 });
    expect(result.isDefault).toBe(false);
    expect(result.reason).toContain("empty");
  });

  test("flattens RGBA transparency over white (transparent => not default)", () => {
    // Transparent background (alpha 0) with an opaque dark blob; flattening
    // turns the background white, so it is excluded.
    const width = 32;
    const height = 32;
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      data[i * 4 + 3] = 0; // fully transparent
    }
    for (let y = 10; y < 22; y++) {
      for (let x = 10; x < 22; x++) {
        const i = (y * width + x) * 4;
        data[i] = 20;
        data[i + 1] = 20;
        data[i + 2] = 20;
        data[i + 3] = 255;
      }
    }
    const result = analyzeImage({ data, width, height, channels: 4 });
    expect(result.isDefault).toBe(false);
    expect(result.reason).toContain("near-white");
  });

  test("detectFromImageData accepts a canvas ImageData shape", () => {
    const width = 48;
    const height = 48;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = GOOGLE_BLUE[0];
      data[i * 4 + 1] = GOOGLE_BLUE[1];
      data[i * 4 + 2] = GOOGLE_BLUE[2];
      data[i * 4 + 3] = 255;
    }
    for (let y = 12; y < 36; y++) {
      for (let x = 20; x < 30; x++) {
        const i = (y * width + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      }
    }
    const result = detectFromImageData({ data, width, height });
    expect(result.isDefault).toBe(true);
  });
});
