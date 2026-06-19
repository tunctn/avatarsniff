import { describe, expect, test } from "vitest";
import { detectDefaultAvatar } from "../src/bytes";
// Importing the subpath registers the SVG rasteriser with the core.
import { decodeSvg } from "../src/svg";
import { defaultAvatarSvg } from "./image-helpers";

const svg = defaultAvatarSvg();

describe("avatarsniff/svg (real wasm rasterise, server-side)", () => {
  test("rasterises SVG bytes to RGBA pixels", async () => {
    const image = await decodeSvg(svg);
    expect(image).not.toBeNull();
    expect(image?.width).toBeGreaterThan(0);
    expect(image?.channels).toBe(4);
  });

  test("detects a default-style SVG avatar (colour square + white block)", async () => {
    const result = await detectDefaultAvatar(svg);
    expect(result.isDefault).toBe(true);
  });
});
