import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/webp.ts", "src/svg.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  treeshake: true,
  splitting: true,
  sourcemap: true,
  // Inline imported .wasm as bytes so the opt-in decoders are self-contained
  // and consumers install zero dependencies.
  loader: { ".wasm": "binary" },
});
