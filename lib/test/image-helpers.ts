// Pure, dependency-free (well, dev-only) encoders so tests can build REAL bytes
// for every format without committing any real images.
import jpeg from "jpeg-js";
import encodeWebpWasm, { init as initWebpEnc } from "@jsquash/webp/encode.js";
import webpEncWasm from "@jsquash/webp/codec/enc/webp_enc_simd.wasm";

export type Rgb = [number, number, number];

export interface Glyph {
  x: number;
  y: number;
  w: number;
  h: number;
  color: Rgb;
}

/** Flat-background RGBA buffer with an optional rectangular glyph. */
export function rgbaFill(
  width: number,
  height: number,
  bg: Rgb,
  glyph?: Glyph
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

/** A default-style avatar: colour `bg` with a centred white glyph. */
export function defaultAvatarRgba(width = 64, height = 64, bg: Rgb = [66, 133, 244]): Uint8Array {
  return rgbaFill(width, height, bg, {
    x: Math.round(width * 0.38),
    y: Math.round(height * 0.28),
    w: Math.round(width * 0.24),
    h: Math.round(height * 0.46),
    color: [255, 255, 255],
  });
}

/** A "photo-like" RGBA buffer: lots of colour, no single dominant. */
export function photoRgba(width = 64, height = 64): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  let seed = 99;
  for (let i = 0; i < width * height; i++) {
    seed = (seed * 1_103_515_245 + 12_345) >>> 0;
    data[i * 4] = seed & 0xff;
    data[i * 4 + 1] = (seed >>> 8) & 0xff;
    data[i * 4 + 2] = (seed >>> 16) & 0xff;
    data[i * 4 + 3] = 255;
  }
  return data;
}

// --- PNG ---

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

/** Encode RGBA pixels as an 8-bit PNG (colour type 6, filter 0). */
export async function encodePng(
  rgba: Uint8Array,
  width: number,
  height: number
): Promise<Uint8Array> {
  return encodePngTyped(rgba, width, height, 6, 4);
}

/** Encode pixels as a PNG of an arbitrary colour type (0/2/3/4/6). */
export async function encodePngTyped(
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

// --- GIF ---

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

/** Build a palette-index map: background 0, optional centred glyph index 1. */
export function indexFill(width: number, height: number, glyph = true): Uint8Array {
  const data = new Uint8Array(width * height);
  if (glyph) {
    const x0 = Math.round(width * 0.38);
    const x1 = Math.round(width * 0.62);
    const y0 = Math.round(height * 0.28);
    const y1 = Math.round(height * 0.74);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        data[y * width + x] = 1;
      }
    }
  }
  return data;
}

export function encodeGif(
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

// --- JPEG (real, via jpeg-js) ---

export function encodeJpeg(
  rgba: Uint8Array,
  width: number,
  height: number,
  quality = 90
): Uint8Array {
  const encoded = jpeg.encode({ data: rgba, width, height }, quality);
  return new Uint8Array(encoded.data);
}

// --- WEBP (real, via @jsquash/webp) ---

let webpEncReady: Promise<unknown> | null = null;
function ensureWebpEnc(): Promise<unknown> {
  if (!webpEncReady) {
    webpEncReady = WebAssembly.compile(webpEncWasm as BufferSource).then((m) =>
      initWebpEnc(m)
    );
  }
  return webpEncReady;
}

export async function encodeWebp(
  rgba: Uint8Array,
  width: number,
  height: number
): Promise<Uint8Array> {
  await ensureWebpEnc();
  const buffer = await encodeWebpWasm({
    data: new Uint8ClampedArray(rgba),
    width,
    height,
    colorSpace: "srgb",
  });
  return new Uint8Array(buffer);
}

/** A default-style avatar SVG (colour square + white block "glyph"). */
export function defaultAvatarSvg(): Uint8Array {
  return new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#4285f4"/><rect x="38" y="26" width="20" height="44" rx="3" fill="#ffffff"/></svg>'
  );
}
