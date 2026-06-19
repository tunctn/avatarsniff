import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Match the build's esbuild `binary` loader: a `.wasm` import resolves to its
// bytes (so the opt-in webp/svg decoders work the same in tests as in dist).
const wasmAsBytes = {
  name: "wasm-as-bytes",
  enforce: "pre" as const,
  load(id: string): string | null {
    if (id.endsWith(".wasm")) {
      const base64 = readFileSync(id.split("?")[0]).toString("base64");
      return `export default Uint8Array.from(atob(${JSON.stringify(base64)}), (c) => c.charCodeAt(0));`;
    }
    return null;
  },
};

export default defineConfig({
  plugins: [wasmAsBytes],
  test: {
    // Route the wasm decoder packages through Vite (and the plugin above)
    // instead of letting Node import the raw .wasm and choke on its imports.
    server: {
      deps: {
        inline: [/@resvg\/resvg-wasm/, /@jsquash\/webp/],
      },
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // index.ts re-exports only; type-declaration files have no runtime code.
      exclude: ["src/index.ts", "src/types.ts", "src/**/*.d.ts"],
      // The pixel-analysis core is ~99% covered. The decoder has format/native
      // branches that can't be exercised in a plain Node test env (real canvas
      // rendering, interlaced GIF), so the global bar sits a touch lower.
      thresholds: {
        lines: 84,
        functions: 85,
        statements: 84,
        branches: 78,
      },
    },
  },
});
