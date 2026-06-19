import { afterEach, describe, expect, test, vi } from "vitest";
import { sniff } from "../src/sniff";
import { DEFAULT_MAX_BYTES, decodeImage, sniffFormat } from "../src/decode";
import {
  defaultAvatarRgba,
  defaultAvatarSvg,
  encodeJpeg,
  encodeWebp,
  photoRgba,
} from "./image-helpers";

type Rgb = [number, number, number];

// ---------------------------------------------------------------------------
// PNG encoder (filter 0, 8-bit RGBA) - pure, dependency-free, for real decode
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xff_ff_ff_ff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xff_ff_ff_ff) >>> 0;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Uint8Array.from(type, (ch) => ch.charCodeAt(0));
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(typeBytes, 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(concat(typeBytes, data)));
  return out;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const body = new Response(data as BodyInit).body;
  if (!body) {
    throw new Error("no body");
  }
  return new Uint8Array(
    await new Response(
      body.pipeThrough(new CompressionStream("deflate"))
    ).arrayBuffer()
  );
}

async function encodePng(
  rgba: Uint8Array,
  width: number,
  height: number
): Promise<Uint8Array> {
  const stride = width * 4;
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  let png = concat(sig, pngChunk("IHDR", ihdr));
  png = concat(png, pngChunk("IDAT", await deflate(raw)));
  return concat(png, pngChunk("IEND", new Uint8Array(0)));
}

async function encodePngTyped(
  pixels: Uint8Array,
  width: number,
  height: number,
  colorType: number,
  channels: number,
  palette?: Rgb[]
): Promise<Uint8Array> {
  const stride = width * channels;
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(pixels.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  let png = concat(sig, pngChunk("IHDR", ihdr));
  if (palette) {
    const plte = new Uint8Array(palette.length * 3);
    palette.forEach((c, i) => {
      plte[i * 3] = c[0];
      plte[i * 3 + 1] = c[1];
      plte[i * 3 + 2] = c[2];
    });
    png = concat(png, pngChunk("PLTE", plte));
  }
  png = concat(png, pngChunk("IDAT", await deflate(raw)));
  return concat(png, pngChunk("IEND", new Uint8Array(0)));
}

// ---------------------------------------------------------------------------
// GIF encoder (LZW) - pure, dependency-free, for real decode
// ---------------------------------------------------------------------------

function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let dict = new Map<string, number>();
  let next = eoiCode + 1;
  const reset = () => {
    dict = new Map();
    for (let i = 0; i < clearCode; i++) {
      dict.set(String(i), i);
    }
    next = eoiCode + 1;
    codeSize = minCodeSize + 1;
  };
  const out: number[] = [];
  let buffer = 0;
  let bitCount = 0;
  const write = (code: number) => {
    buffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      out.push(buffer & 0xff);
      buffer >>= 8;
      bitCount -= 8;
    }
  };
  reset();
  write(clearCode);
  let w = String(indices[0]);
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const wk = `${w},${k}`;
    if (dict.has(wk)) {
      w = wk;
    } else {
      write(dict.get(w) as number);
      dict.set(wk, next++);
      if (next === 1 << codeSize && codeSize < 12) {
        codeSize++;
      }
      w = String(k);
    }
  }
  write(dict.get(w) as number);
  write(eoiCode);
  if (bitCount > 0) {
    out.push(buffer & 0xff);
  }
  return new Uint8Array(out);
}

function encodeGif(
  indices: Uint8Array,
  width: number,
  height: number,
  palette: Rgb[]
): Uint8Array {
  const colorBits = Math.max(2, Math.ceil(Math.log2(palette.length)));
  const gctSize = 1 << colorBits;
  const bytes: number[] = [];
  for (const ch of "GIF89a") {
    bytes.push(ch.charCodeAt(0));
  }
  bytes.push(width & 0xff, width >> 8, height & 0xff, height >> 8);
  bytes.push(0x80 | ((colorBits - 1) << 4) | (colorBits - 1), 0, 0);
  for (let i = 0; i < gctSize; i++) {
    const c = palette[i] ?? [0, 0, 0];
    bytes.push(c[0], c[1], c[2]);
  }
  // biome-ignore format: image descriptor
  bytes.push(0x2c, 0, 0, 0, 0, width & 0xff, width >> 8, height & 0xff, height >> 8, 0);
  bytes.push(colorBits);
  const lzw = lzwEncode(indices, colorBits);
  let off = 0;
  while (off < lzw.length) {
    const n = Math.min(255, lzw.length - off);
    bytes.push(n);
    for (let i = 0; i < n; i++) {
      bytes.push(lzw[off + i]);
    }
    off += n;
  }
  bytes.push(0, 0x3b);
  return new Uint8Array(bytes);
}

// ---------------------------------------------------------------------------
// pixel helpers
// ---------------------------------------------------------------------------

function rgbaFill(
  width: number,
  height: number,
  bg: Rgb,
  glyph?: { x: number; y: number; w: number; h: number; color: Rgb }
): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = bg[0];
    data[i * 4 + 1] = bg[1];
    data[i * 4 + 2] = bg[2];
    data[i * 4 + 3] = 255;
  }
  if (glyph) {
    for (let y = glyph.y; y < glyph.y + glyph.h; y++) {
      for (let x = glyph.x; x < glyph.x + glyph.w; x++) {
        const i = (y * width + x) * 4;
        data[i] = glyph.color[0];
        data[i + 1] = glyph.color[1];
        data[i + 2] = glyph.color[2];
      }
    }
  }
  return data;
}

/** Index map: background palette index 0, a centred glyph of palette index 1. */
function indexFill(width: number, height: number, glyph = true): Uint8Array {
  const data = new Uint8Array(width * height);
  if (glyph) {
    for (let y = 18; y < 46; y++) {
      for (let x = 24; x < 40; x++) {
        data[y * width + x] = 1;
      }
    }
  }
  return data;
}

const DEFAULT_PIXELS = rgbaFill(64, 64, [66, 133, 244], {
  x: 24,
  y: 18,
  w: 16,
  h: 28,
  color: [255, 255, 255],
});

function mockNativeDecode(pixels: Uint8Array, width: number, height: number) {
  const ctx = {
    drawImage: () => undefined,
    getImageData: () => ({ data: pixels, width, height }),
  };
  vi.stubGlobal(
    "OffscreenCanvas",
    class {
      getContext() {
        return ctx;
      }
    }
  );
  vi.stubGlobal("createImageBitmap", () =>
    Promise.resolve({ width, height, close: () => undefined })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------

describe("sniffFormat", () => {
  test("detects every supported format", () => {
    expect(sniffFormat(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
      "png"
    );
    expect(sniffFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(sniffFormat(Uint8Array.from("GIF89a", (c) => c.charCodeAt(0)))).toBe(
      "gif"
    );
    expect(
      sniffFormat(Uint8Array.from("RIFF1234WEBPVP8 ", (c) => c.charCodeAt(0)))
    ).toBe("webp");
    expect(
      sniffFormat(new TextEncoder().encode('<svg xmlns="..."></svg>'))
    ).toBe("svg");
    expect(
      sniffFormat(new TextEncoder().encode('  <?xml version="1.0"?><svg/>'))
    ).toBe("svg");
    expect(sniffFormat(new Uint8Array([1, 2, 3, 4]))).toBe("unknown");
  });
});

describe("server-side pure-JS decode (no native canvas)", () => {
  test("decodes a PNG and flags a default avatar", async () => {
    const png = await encodePng(DEFAULT_PIXELS, 64, 64);
    const image = await decodeImage(png);
    expect(image?.width).toBe(64);
    const result = await sniff(png);
    expect(result.isDefault).toBe(true);
  });

  test("decodes a GIF and flags a default avatar", async () => {
    const gif = encodeGif(indexFill(64, 64), 64, 64, [
      [66, 133, 244],
      [255, 255, 255],
    ]);
    expect(sniffFormat(gif)).toBe("gif");
    const image = await decodeImage(gif);
    expect(image?.width).toBe(64);
    expect(image?.height).toBe(64);
    const result = await sniff(gif);
    expect(result.isDefault).toBe(true);
  });

  test("decodes a solid saturated GIF as a solidColor default", async () => {
    const gif = encodeGif(indexFill(48, 48, false), 48, 48, [
      [22, 160, 160],
      [255, 255, 255],
    ]);
    const result = await sniff(gif);
    expect(result.isDefault).toBe(true);
    expect(result.matched).toBe("solidColor");
  });

  test("does not flag a plain white PNG", async () => {
    const png = await encodePng(rgbaFill(64, 64, [255, 255, 255]), 64, 64);
    expect((await sniff(png)).isDefault).toBe(false);
  });

  test("decodes a real JPEG (default-style) with the bundled pure-JS decoder", async () => {
    const jpg = encodeJpeg(defaultAvatarRgba(64, 64), 64, 64);
    expect(sniffFormat(jpg)).toBe("jpeg");
    const image = await decodeImage(jpg);
    expect(image).not.toBeNull();
    expect(image?.width).toBe(64);
    expect(image?.channels).toBe(4);
    // colour bg + white glyph survives JPEG => still flagged
    expect((await sniff(jpg)).isDefault).toBe(true);
  });

  test("decodes a real photo-style JPEG as not-a-default", async () => {
    const jpg = encodeJpeg(photoRgba(64, 64), 64, 64);
    expect((await sniff(jpg)).isDefault).toBe(false);
  });

  test("fails open (not-a-default) for WEBP/SVG with no decoder registered", async () => {
    const webp = await encodeWebp(defaultAvatarRgba(64, 64), 64, 64);
    const svg = defaultAvatarSvg();
    expect(sniffFormat(webp)).toBe("webp");
    expect(sniffFormat(svg)).toBe("svg");
    // this file never imports avatarsniff/webp|svg, so nothing decodes them
    expect(await decodeImage(webp)).toBeNull();
    expect(await decodeImage(svg)).toBeNull();
    expect((await sniff(webp)).isDefault).toBe(false);
    expect((await sniff(svg)).reason).toContain(
      "could not decode"
    );
  });
});

describe("client-side native decode (createImageBitmap / canvas)", () => {
  for (const [format, bytes] of [
    ["png", new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
    ["jpeg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
    ["gif", Uint8Array.from("GIF89a", (c) => c.charCodeAt(0))],
    ["webp", Uint8Array.from("RIFF0000WEBPVP8 ", (c) => c.charCodeAt(0))],
  ] as const) {
    test(`decodes ${format} via the platform decoder`, async () => {
      mockNativeDecode(DEFAULT_PIXELS, 64, 64);
      const image = await decodeImage(bytes);
      expect(image?.width).toBe(64);
      expect((await sniff(bytes)).isDefault).toBe(true);
    });
  }

  test("rasterises SVG via an <img> element when a DOM is present", async () => {
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 64;
      naturalHeight = 64;
      width = 64;
      height = 64;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal("document", {});
    vi.stubGlobal("Image", MockImage);
    vi.stubGlobal("URL", {
      createObjectURL: () => "blob:svg",
      revokeObjectURL: () => undefined,
    });
    const ctx = {
      drawImage: () => undefined,
      getImageData: () => ({ data: DEFAULT_PIXELS, width: 64, height: 64 }),
    };
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        getContext() {
          return ctx;
        }
      }
    );
    const svg = new TextEncoder().encode('<svg width="64" height="64"></svg>');
    const result = await sniff(svg);
    expect(result.isDefault).toBe(true);
  });
});

describe("PNG colour types", () => {
  test("decodes 8-bit grayscale (colour type 0)", async () => {
    const w = 16;
    const h = 16;
    const gray = new Uint8Array(w * h).fill(120);
    const png = await encodePngTyped(gray, w, h, 0, 1);
    const image = await decodeImage(png);
    expect(image?.width).toBe(w);
    expect(Array.from(image?.data.slice(0, 4) ?? [])).toEqual([
      120, 120, 120, 255,
    ]);
  });

  test("decodes 8-bit grayscale + alpha (colour type 4)", async () => {
    const w = 12;
    const h = 12;
    const pixels = new Uint8Array(w * h * 2);
    for (let i = 0; i < w * h; i++) {
      pixels[i * 2] = 90; // gray
      pixels[i * 2 + 1] = 255; // alpha
    }
    const png = await encodePngTyped(pixels, w, h, 4, 2);
    const image = await decodeImage(png);
    expect(image?.width).toBe(w);
    expect(Array.from(image?.data.slice(0, 4) ?? [])).toEqual([90, 90, 90, 255]);
  });

  test("decodes an indexed/palette default avatar (colour type 3)", async () => {
    const w = 64;
    const h = 64;
    const indices = new Uint8Array(w * h);
    for (let y = 18; y < 46; y++) {
      for (let x = 24; x < 40; x++) {
        indices[y * w + x] = 1;
      }
    }
    const png = await encodePngTyped(indices, w, h, 3, 1, [
      [66, 133, 244],
      [255, 255, 255],
    ]);
    expect((await sniff(png)).isDefault).toBe(true);
  });
});

describe("native decode fallbacks", () => {
  test("uses a DOM <canvas> when OffscreenCanvas is absent", async () => {
    const ctx = {
      drawImage: () => undefined,
      getImageData: () => ({ data: DEFAULT_PIXELS, width: 64, height: 64 }),
    };
    vi.stubGlobal("createImageBitmap", () =>
      Promise.resolve({ width: 64, height: 64, close: () => undefined })
    );
    vi.stubGlobal("document", {
      createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
    });
    const result = await sniff(
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
    );
    expect(result.isDefault).toBe(true);
  });

  test("returns null when no canvas is available", async () => {
    vi.stubGlobal("createImageBitmap", () =>
      Promise.resolve({ width: 10, height: 10, close: () => undefined })
    );
    expect(
      await decodeImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))
    ).toBeNull();
  });
});

describe("size cap (up to 10MB)", () => {
  test("default cap is 10MB", () => {
    expect(DEFAULT_MAX_BYTES).toBe(10 * 1024 * 1024);
  });

  test("rejects input larger than the cap before decoding", async () => {
    const tooBig = new Uint8Array(DEFAULT_MAX_BYTES + 1);
    expect(await decodeImage(tooBig)).toBeNull();
    expect((await sniff(tooBig)).isDefault).toBe(false);
  });

  test("honours a custom maxBytes", async () => {
    const png = await encodePng(rgbaFill(8, 8, [10, 20, 30]), 8, 8);
    expect(await decodeImage(png, { maxBytes: 8 })).toBeNull();
    expect(await decodeImage(png, { maxBytes: DEFAULT_MAX_BYTES })).not.toBeNull();
  });

  test("rejects empty input", async () => {
    expect(await decodeImage(new Uint8Array(0))).toBeNull();
  });

  test("decodes a multi-megabyte image within the cap", async () => {
    // 700x700 noisy RGBA PNG => a few MB of bytes, well under 10MB.
    const size = 700;
    const rgba = new Uint8Array(size * size * 4);
    let seed = 123_456_789;
    for (let i = 0; i < rgba.length; i += 4) {
      // LCG noise => incompressible => bytes stay large (a few MB).
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      rgba[i] = seed & 0xff;
      rgba[i + 1] = (seed >>> 8) & 0xff;
      rgba[i + 2] = (seed >>> 16) & 0xff;
      rgba[i + 3] = 255;
    }
    const png = await encodePng(rgba, size, size);
    expect(png.length).toBeGreaterThan(1_000_000);
    expect(png.length).toBeLessThanOrEqual(DEFAULT_MAX_BYTES);
    const image = await decodeImage(png);
    expect(image?.width).toBe(size);
    // noisy => lots of colour => never a default
    expect((await sniff(png)).isDefault).toBe(false);
  });
});

describe("sniff(url)", () => {
  test("returns null for a missing url or failed fetch", async () => {
    expect(await sniff(undefined)).toBeNull();
    expect(await sniff("")).toBeNull();
    expect(
      await sniff("http://127.0.0.1:0/x.png")
    ).toBeNull();
  });
});
