import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // avatarsniff is a workspace package; make sure Next transpiles its ESM.
  transpilePackages: ["avatarsniff"],
  // Lean, self-contained server bundle for the Docker image. Trace from the
  // monorepo root so the workspace `avatarsniff` package is included correctly.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
