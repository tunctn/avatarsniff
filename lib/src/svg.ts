import { initWasm, Resvg } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import { registerDecoder } from "./registry";
import type { RgbaImage } from "./types";

/**
 * Opt-in SVG rasteriser. Importing `avatarsniff/svg` registers it, so
 * `sniff`/`decodeImage` then rasterise SVG in plain Node too. The
 * resvg wasm (~2.5MB) is inlined into THIS bundle only - the core stays tiny and
 * consumers still install zero dependencies.
 */

let ready: Promise<unknown> | null = null;
function ensureReady(): Promise<unknown> {
  if (!ready) {
    ready = initWasm(resvgWasm);
  }
  return ready;
}

export async function decodeSvg(bytes: Uint8Array): Promise<RgbaImage | null> {
  try {
    await ensureReady();
    const rendered = new Resvg(new TextDecoder().decode(bytes)).render();
    // Copy out of wasm memory before freeing it.
    const result: RgbaImage = {
      data: new Uint8Array(rendered.pixels),
      width: rendered.width,
      height: rendered.height,
      channels: 4,
    };
    rendered.free();
    return result;
  } catch {
    return null;
  }
}

registerDecoder("svg", decodeSvg);
