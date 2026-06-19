import type { ImageFormat, RgbaImage } from "./types";

export type Decoder = (bytes: Uint8Array) => Promise<RgbaImage | null>;

// Stored on a global Symbol so the registry is a true singleton even when the
// core and an opt-in subpath (avatarsniff/webp, avatarsniff/svg) end up in
// separate, non-shared bundles (e.g. CJS, which can't code-split).
const REGISTRY_KEY = Symbol.for("avatarsniff.decoders");
type GlobalWithRegistry = typeof globalThis & {
  [REGISTRY_KEY]?: Map<ImageFormat, Decoder>;
};

function registry(): Map<ImageFormat, Decoder> {
  const g = globalThis as GlobalWithRegistry;
  if (!g[REGISTRY_KEY]) {
    g[REGISTRY_KEY] = new Map();
  }
  return g[REGISTRY_KEY];
}

/**
 * Register a decoder for a format. The opt-in `avatarsniff/webp` and
 * `avatarsniff/svg` entry points call this on import, so importing them makes
 * `decodeImage`/`detectDefaultAvatar` handle that format in plain Node too. You
 * can also register your own decoder for any format.
 */
export function registerDecoder(format: ImageFormat, decoder: Decoder): void {
  registry().set(format, decoder);
}

export function getDecoder(format: ImageFormat): Decoder | undefined {
  return registry().get(format);
}
