import { beforeAll, describe, expect, test } from "vitest";
import { sniff } from "../src/sniff";
// Importing the subpath registers the WEBP decoder with the core.
import { decodeWebp } from "../src/webp";
import { defaultAvatarRgba, encodeWebp, photoRgba } from "./image-helpers";

let defaultWebp: Uint8Array;
let photoWebp: Uint8Array;

beforeAll(async () => {
  defaultWebp = await encodeWebp(defaultAvatarRgba(64, 64), 64, 64);
  photoWebp = await encodeWebp(photoRgba(64, 64), 64, 64);
});

describe("avatarsniff/webp (real wasm decode, server-side)", () => {
  test("decodes WEBP bytes to RGBA pixels", async () => {
    const image = await decodeWebp(defaultWebp);
    expect(image).not.toBeNull();
    expect(image?.width).toBe(64);
    expect(image?.height).toBe(64);
    expect(image?.channels).toBe(4);
    expect(image?.data.length).toBe(64 * 64 * 4);
  });

  test("importing the subpath lets sniff flag a default WEBP in Node", async () => {
    const result = await sniff(defaultWebp);
    expect(result.reason).not.toContain("could not decode");
    expect(result.isDefault).toBe(true);
  });

  test("a photo-style WEBP is not a default", async () => {
    expect((await sniff(photoWebp)).isDefault).toBe(false);
  });
});
