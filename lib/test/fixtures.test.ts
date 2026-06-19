import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { detectDefaultAvatar } from "../src/bytes";

/**
 * Folder-driven fixtures. Drop real images into these folders and they're
 * covered automatically:
 *
 *   test/fixtures/default/        committed, public — generic default avatars
 *   test/fixtures/real/           committed, public — real photos/logos
 *   test/fixtures/local-default/  git-ignored — sensitive default avatars
 *   test/fixtures/local-real/     git-ignored — sensitive real photos (faces)
 *
 * Everything in a *default* folder must be detected as a default; everything in
 * a *real* folder must not be. Empty folders are skipped, so CI/public clones
 * stay green until images are added.
 */

const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i;

function dir(name: string): string {
  return fileURLToPath(new URL(`./fixtures/${name}/`, import.meta.url));
}

function load(name: string): { file: string; bytes: Uint8Array }[] {
  const d = dir(name);
  if (!existsSync(d)) {
    return [];
  }
  return readdirSync(d)
    .filter((f) => IMAGE.test(f))
    .map((f) => ({ file: f, bytes: new Uint8Array(readFileSync(d + f)) }));
}

const GROUPS = [
  { folder: "default", expected: true },
  { folder: "real", expected: false },
  { folder: "local-default", expected: true },
  { folder: "local-real", expected: false },
] as const;

const total = GROUPS.reduce((n, g) => n + load(g.folder).length, 0);

beforeAll(async () => {
  // Only load the wasm decoders if there are images that might need them.
  if (total > 0) {
    await import("../src/webp");
    await import("../src/svg");
  }
});

for (const { folder, expected } of GROUPS) {
  const items = load(folder);
  describe(`fixtures/${folder}`, () => {
    if (items.length === 0) {
      test.skip(`no images provided (drop files into test/fixtures/${folder})`, () => {
        // intentionally empty
      });
      return;
    }
    for (const { file, bytes } of items) {
      test(`${file} => isDefault ${expected}`, async () => {
        const result = await detectDefaultAvatar(bytes);
        expect(result.isDefault).toBe(expected);
      });
    }
  });
}
