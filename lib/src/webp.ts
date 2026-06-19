import decode, { init } from "@jsquash/webp/decode.js";
import webpWasm from "@jsquash/webp/codec/dec/webp_dec.wasm";
import { registerDecoder } from "./registry";
import type { RgbaImage } from "./types";

/**
 * Opt-in WEBP decoder. Importing `avatarsniff/webp` registers it, so
 * `detectDefaultAvatar`/`decodeImage` then handle WEBP in plain Node too. The
 * decoder's wasm (~138KB) is inlined into THIS bundle, so the core stays tiny
 * and consumers still install zero dependencies.
 */

let ready: Promise<unknown> | null = null;
function ensureReady(): Promise<unknown> {
  if (!ready) {
    ready = WebAssembly.compile(webpWasm as BufferSource).then((module) =>
      init(module)
    );
  }
  return ready;
}

export async function decodeWebp(bytes: Uint8Array): Promise<RgbaImage | null> {
  try {
    await ensureReady();
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
    const image = await decode(buffer);
    return {
      data: image.data,
      width: image.width,
      height: image.height,
      channels: 4,
    };
  } catch {
    return null;
  }
}

registerDecoder("webp", decodeWebp);
