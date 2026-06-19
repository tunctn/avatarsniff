import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { analyzeImage } from "../src/analyze";
import { decodeImage } from "../src/decode";
import { sniff } from "../src/sniff";

/** API behaviour, exercised against real fixture images (no synthetic avatars). */

function fixture(rel: string): Uint8Array {
  return new Uint8Array(
    readFileSync(fileURLToPath(new URL(`./fixtures/${rel}`, import.meta.url)))
  );
}

describe("matched family", () => {
  test("reports which detector fired", async () => {
    expect((await sniff(fixture("initials/dicebear-1.png"))).matched).toBe("initials");
    expect((await sniff(fixture("solidColor/solid-00897b.png"))).matched).toBe("solidColor");
    expect((await sniff(fixture("identicon/dicebear-1.png"))).matched).toBe("identicon");
  });

  test("matched is null for a real photo", async () => {
    const r = await sniff(fixture("real/picsum-2.jpg"));
    expect(r.isDefault).toBe(false);
    expect(r.matched).toBeNull();
  });
});

describe("detect toggles (default on, opt out with false)", () => {
  test("opting out of a family stops it matching", async () => {
    const bytes = fixture("identicon/dicebear-1.png");
    expect((await sniff(bytes)).isDefault).toBe(true);

    const off = await sniff(bytes, { detect: { identicon: false } });
    expect(off.isDefault).toBe(false);
    expect(off.matched).toBeNull();
  });

  test("opting out of one family leaves others working", async () => {
    const initials = fixture("initials/ui-ab.png");
    const r = await sniff(initials, { detect: { identicon: false } });
    expect(r.matched).toBe("initials");
  });

  test("disabling every family never reports a default", async () => {
    const r = await sniff(fixture("solidColor/solid-e53935.png"), {
      detect: { initials: false, solidColor: false, personIcon: false, identicon: false },
    });
    expect(r.isDefault).toBe(false);
  });
});

describe("sniff(ImageData)", () => {
  test("accepts a canvas ImageData shape (real decoded pixels)", async () => {
    const decoded = await decodeImage(fixture("initials/ui-jd.png"));
    expect(decoded).not.toBeNull();
    const { data, width, height } = decoded!;
    const channels = decoded!.channels ?? Math.round(data.length / (width * height));
    // Re-pack to RGBA, the shape a browser <canvas> ImageData provides.
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = data[i * channels];
      rgba[i * 4 + 1] = data[i * channels + 1];
      rgba[i * 4 + 2] = data[i * channels + 2];
      rgba[i * 4 + 3] = channels === 4 ? data[i * channels + 3] : 255;
    }
    const result = await sniff({ data: rgba, width, height });
    expect(result.isDefault).toBe(true);
    expect(result.matched).toBe("initials");
  });
});

describe("degenerate input", () => {
  test("an empty image is a safe non-default", () => {
    const result = analyzeImage({ data: new Uint8Array(0), width: 0, height: 0 });
    expect(result.isDefault).toBe(false);
    expect(result.matched).toBeNull();
    expect(result.reason).toContain("empty");
  });

  test("undecodable bytes report not-a-default", async () => {
    const result = await sniff(new Uint8Array([1, 2, 3, 4]));
    expect(result.isDefault).toBe(false);
    expect(result.matched).toBeNull();
  });
});
