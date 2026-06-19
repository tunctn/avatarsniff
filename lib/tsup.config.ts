import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/webp.ts", "src/svg.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  treeshake: true,
  splitting: true,
  // No source maps in the published package - they added ~0.6 MB and inlined the
  // full source, and consumers of a leaf util rarely step into it.
  sourcemap: false,
  // Inline imported .wasm as bytes so the opt-in decoders are self-contained
  // and consumers install zero dependencies.
  loader: { ".wasm": "binary" },
});
