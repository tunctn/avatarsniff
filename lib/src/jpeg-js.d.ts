declare module "jpeg-js" {
  export interface DecodedJpeg {
    width: number;
    height: number;
    data: Uint8Array;
  }
  export function decode(
    data: Uint8Array | ArrayBuffer,
    opts?: { useTArray?: boolean; maxMemoryUsageInMB?: number }
  ): DecodedJpeg;
  export function encode(
    image: {
      data: Uint8Array | Uint8ClampedArray;
      width: number;
      height: number;
    },
    quality?: number
  ): { data: Uint8Array; width: number; height: number };
  const jpeg: { decode: typeof decode; encode: typeof encode };
  export default jpeg;
}
