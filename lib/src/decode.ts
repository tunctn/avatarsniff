import { getDecoder } from "./registry";
import type { DecodeOptions, ImageFormat, RgbaImage } from "./types";

/**
 * Built-in, zero-dependency image decoding for PNG, JPEG, GIF, WEBP and SVG.
 *
 * Two layers, no npm or native dependencies:
 *
 *  1. **Native layer** - when the runtime provides `createImageBitmap` + a
 *     canvas (`OffscreenCanvas` or a DOM `<canvas>`), every format is decoded
 *     by the platform: browsers, web workers, Deno, Bun. SVG is rasterised via
 *     an `<img>` element when a DOM is present.
 *  2. **Pure-JS layer** - for plain Node (no canvas), PNG and GIF are decoded in
 *     pure JS (PNG inflate uses the built-in `DecompressionStream`) and JPEG via
 *     the bundled `jpeg-js` (a devDependency inlined into `dist`, so consumers
 *     still install zero dependencies). WEBP and SVG aren't decoded here; they
 *     return `null`, which callers treat as "not a default, keep it" - the right
 *     outcome for a real photo/graphic.
 *
 * Inputs larger than `maxBytes` (default 10MB) are rejected before decoding.
 */

export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

export function sniffFormat(bytes: Uint8Array): ImageFormat {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return "png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "gif";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "webp";
  }
  // SVG is text; sniff the first non-whitespace bytes for "<?xml" or "<svg".
  let i = 0;
  while (i < bytes.length && bytes[i] <= 0x20) {
    i++;
  }
  const head = String.fromCharCode(...bytes.subarray(i, i + 5)).toLowerCase();
  if (head.startsWith("<?xml") || head.startsWith("<svg")) {
    return "svg";
  }
  return "unknown";
}

// --- PNG (pure JS, built-in DecompressionStream inflate) ---

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 0x1_00_00_00 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(data as BodyInit).body?.pipeThrough(
    new DecompressionStream("deflate")
  );
  if (!stream) {
    throw new Error("no readable stream");
  }
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) {
    return a;
  }
  return pb <= pc ? b : c;
}

const PNG_CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

async function decodePng(bytes: Uint8Array): Promise<RgbaImage | null> {
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette: Uint8Array | null = null;
  let transparency: Uint8Array | null = null;
  const idat: Uint8Array[] = [];

  while (pos + 8 <= bytes.length) {
    const length = readUint32(bytes, pos);
    pos += 4;
    const type = String.fromCharCode(
      bytes[pos],
      bytes[pos + 1],
      bytes[pos + 2],
      bytes[pos + 3]
    );
    pos += 4;
    const data = bytes.subarray(pos, pos + length);
    pos += length + 4;
    if (type === "IHDR") {
      width = readUint32(data, 0);
      height = readUint32(data, 4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "tRNS") {
      transparency = data;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  const srcChannels = PNG_CHANNELS[colorType];
  if (!(width && height && srcChannels) || bitDepth !== 8 || interlace !== 0) {
    return null;
  }

  let total = 0;
  for (const c of idat) {
    total += c.length;
  }
  const compressed = new Uint8Array(total);
  let w = 0;
  for (const c of idat) {
    compressed.set(c, w);
    w += c.length;
  }
  const raw = await inflate(compressed);
  const stride = width * srcChannels;
  const out = new Uint8Array(height * stride);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++];
    for (let x = 0; x < stride; x++) {
      const cur = raw[rp++];
      const a = x >= srcChannels ? out[y * stride + x - srcChannels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c =
        x >= srcChannels && y > 0 ? out[(y - 1) * stride + x - srcChannels] : 0;
      let v = cur;
      if (filter === 1) {
        v = cur + a;
      } else if (filter === 2) {
        v = cur + b;
      } else if (filter === 3) {
        v = cur + ((a + b) >> 1);
      } else if (filter === 4) {
        v = cur + paeth(a, b, c);
      }
      out[y * stride + x] = v & 0xff;
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * srcChannels;
    let r = 0;
    let g = 0;
    let b = 0;
    let alpha = 255;
    if (colorType === 0) {
      r = g = b = out[s];
    } else if (colorType === 2) {
      r = out[s];
      g = out[s + 1];
      b = out[s + 2];
    } else if (colorType === 4) {
      r = g = b = out[s];
      alpha = out[s + 1];
    } else if (colorType === 6) {
      r = out[s];
      g = out[s + 1];
      b = out[s + 2];
      alpha = out[s + 3];
    } else if (colorType === 3) {
      if (!palette) {
        return null;
      }
      const idx = out[s];
      r = palette[idx * 3];
      g = palette[idx * 3 + 1];
      b = palette[idx * 3 + 2];
      if (transparency && idx < transparency.length) {
        alpha = transparency[idx];
      }
    }
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = alpha;
  }
  return { data: rgba, width, height, channels: 4 };
}

// --- GIF (pure JS, LZW) ---

function lzwDecode(
  data: Uint8Array,
  minCodeSize: number,
  pixelCount: number
): Uint8Array {
  const out = new Uint8Array(pixelCount);
  let outPos = 0;
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let dict: number[][] = [];
  const reset = () => {
    dict = [];
    for (let i = 0; i < clearCode; i++) {
      dict[i] = [i];
    }
    dict[clearCode] = [];
    dict[eoiCode] = [];
    codeSize = minCodeSize + 1;
  };
  reset();
  let bitBuffer = 0;
  let bitCount = 0;
  let dataPos = 0;
  let prev: number[] | null = null;
  const readCode = (): number => {
    while (bitCount < codeSize) {
      if (dataPos >= data.length) {
        return eoiCode;
      }
      bitBuffer |= data[dataPos++] << bitCount;
      bitCount += 8;
    }
    const code = bitBuffer & ((1 << codeSize) - 1);
    bitBuffer >>= codeSize;
    bitCount -= codeSize;
    return code;
  };
  for (;;) {
    const code = readCode();
    if (code === eoiCode) {
      break;
    }
    if (code === clearCode) {
      reset();
      prev = null;
      continue;
    }
    let entry: number[];
    if (dict[code]) {
      entry = dict[code];
    } else if (prev) {
      entry = [...prev, prev[0]];
    } else {
      break;
    }
    for (const value of entry) {
      if (outPos < pixelCount) {
        out[outPos++] = value;
      }
    }
    if (prev) {
      dict.push([...prev, entry[0]]);
      // The decoder builds the table one entry behind the encoder, so it must
      // grow the code size one entry early - the canonical GIF LZW off-by-one.
      if (dict.length === (1 << codeSize) - 1 && codeSize < 12) {
        codeSize++;
      }
    }
    prev = entry;
  }
  return out;
}

function deinterlace(pixels: Uint8Array, width: number, height: number): void {
  const result = new Uint8Array(pixels.length);
  const passes = [
    [0, 8],
    [4, 8],
    [2, 4],
    [1, 2],
  ];
  let srcRow = 0;
  for (const [start, step] of passes) {
    for (let row = start; row < height; row += step) {
      result.set(
        pixels.subarray(srcRow * width * 4, (srcRow + 1) * width * 4),
        row * width * 4
      );
      srcRow++;
    }
  }
  pixels.set(result);
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function decodeGif(bytes: Uint8Array): RgbaImage | null {
  let p = 6; // skip "GIF87a"/"GIF89a"
  const packed = bytes[p + 4];
  const gctFlag = (packed & 0x80) !== 0;
  const gctSize = 2 << (packed & 0x07);
  p += 7;
  let gct: Uint8Array | null = null;
  if (gctFlag) {
    gct = bytes.subarray(p, p + gctSize * 3);
    p += gctSize * 3;
  }
  let transparentIndex = -1;

  while (p < bytes.length) {
    const block = bytes[p++];
    if (block === 0x3b) {
      break;
    }
    if (block === 0x21) {
      const label = bytes[p++];
      if (label === 0xf9) {
        const size = bytes[p++];
        const flags = bytes[p];
        transparentIndex = flags & 0x01 ? bytes[p + 3] : -1;
        p += size;
        p++; // block terminator
      } else {
        let size = bytes[p++];
        while (size !== 0) {
          p += size;
          size = bytes[p++];
        }
      }
    } else if (block === 0x2c) {
      const iw = readUint16LE(bytes, p + 4);
      const ih = readUint16LE(bytes, p + 6);
      const ipacked = bytes[p + 8];
      p += 9;
      const lctFlag = (ipacked & 0x80) !== 0;
      const interlaced = (ipacked & 0x40) !== 0;
      const lctSize = 2 << (ipacked & 0x07);
      let ct = gct;
      if (lctFlag) {
        ct = bytes.subarray(p, p + lctSize * 3);
        p += lctSize * 3;
      }
      if (!ct) {
        return null;
      }
      const minCodeSize = bytes[p++];
      const data: number[] = [];
      let size = bytes[p++];
      while (size !== 0) {
        for (let i = 0; i < size; i++) {
          data.push(bytes[p + i]);
        }
        p += size;
        size = bytes[p++];
      }
      const indices = lzwDecode(new Uint8Array(data), minCodeSize, iw * ih);
      const rgba = new Uint8Array(iw * ih * 4);
      for (let i = 0; i < iw * ih; i++) {
        const idx = indices[i];
        if (idx === transparentIndex) {
          rgba[i * 4] = 255;
          rgba[i * 4 + 1] = 255;
          rgba[i * 4 + 2] = 255;
          rgba[i * 4 + 3] = 0;
          continue;
        }
        rgba[i * 4] = ct[idx * 3];
        rgba[i * 4 + 1] = ct[idx * 3 + 1];
        rgba[i * 4 + 2] = ct[idx * 3 + 2];
        rgba[i * 4 + 3] = 255;
      }
      if (interlaced) {
        deinterlace(rgba, iw, ih);
      }
      return { data: rgba, width: iw, height: ih, channels: 4 };
    } else {
      break;
    }
  }
  return null;
}

// --- JPEG (pure JS via the bundled jpeg-js decoder) ---

async function decodeJpeg(bytes: Uint8Array): Promise<RgbaImage | null> {
  try {
    // jpeg-js is a devDependency bundled into dist - consumers install nothing.
    const jpeg = (await import("jpeg-js")).default;
    const decoded = jpeg.decode(bytes, {
      useTArray: true,
      maxMemoryUsageInMB: 512,
    });
    return {
      data: decoded.data,
      width: decoded.width,
      height: decoded.height,
      channels: 4,
    };
  } catch {
    return null;
  }
}

// --- Native (platform) decode: covers all formats where available ---

function getCanvas(
  width: number,
  height: number
): { ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D } | null {
  if (typeof OffscreenCanvas !== "undefined") {
    const ctx = new OffscreenCanvas(width, height).getContext("2d");
    return ctx ? { ctx } : null;
  }
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    return ctx ? { ctx } : null;
  }
  return null;
}

function loadSvgImage(bytes: Uint8Array): Promise<HTMLImageElement> | null {
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return null;
  }
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: "image/svg+xml" })
  );
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("svg load failed"));
    };
    img.src = url;
  });
}

async function decodeNative(
  bytes: Uint8Array,
  format: ImageFormat
): Promise<RgbaImage | null> {
  try {
    let width: number;
    let height: number;
    let source: CanvasImageSource;
    if (format === "svg") {
      const pending = loadSvgImage(bytes);
      if (!pending) {
        return null;
      }
      const img = await pending;
      width = img.naturalWidth || img.width || 64;
      height = img.naturalHeight || img.height || 64;
      source = img;
    } else if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(new Blob([bytes as BlobPart]));
      width = bitmap.width;
      height = bitmap.height;
      source = bitmap;
    } else {
      return null;
    }
    const canvas = getCanvas(width, height);
    if (!canvas) {
      return null;
    }
    canvas.ctx.drawImage(source, 0, 0, width, height);
    const imageData = canvas.ctx.getImageData(0, 0, width, height);
    return {
      data: imageData.data,
      width: imageData.width,
      height: imageData.height,
      channels: 4,
    };
  } catch {
    return null;
  }
}

/**
 * Decode encoded image bytes (PNG, JPEG, GIF, WEBP, SVG) to RGBA pixels.
 * Returns `null` when the format can't be decoded in the current runtime or the
 * input exceeds `maxBytes`. Zero dependencies.
 */
export async function decodeImage(
  bytes: Uint8Array | ArrayBuffer,
  options: DecodeOptions = {}
): Promise<RgbaImage | null> {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  if (data.length === 0 || data.length > maxBytes) {
    return null;
  }
  const format = sniffFormat(data);
  try {
    // Native first: where available it decodes every format, including the ones
    // we don't implement in pure JS (JPEG/WEBP/SVG).
    const native = await decodeNative(data, format);
    if (native) {
      return native;
    }
    if (format === "png") {
      return await decodePng(data);
    }
    if (format === "gif") {
      return decodeGif(data);
    }
    if (format === "jpeg") {
      return await decodeJpeg(data);
    }
    // Opt-in decoders registered by avatarsniff/webp and avatarsniff/svg.
    const registered = getDecoder(format);
    if (registered) {
      return await registered(data);
    }
    return null;
  } catch {
    return null;
  }
}
