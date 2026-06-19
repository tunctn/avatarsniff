// Built with the esbuild "binary" loader (and the matching vitest plugin), so a
// `.wasm` import resolves to its bytes, inlined into the bundle.
declare module "*.wasm" {
  const bytes: Uint8Array;
  export default bytes;
}
