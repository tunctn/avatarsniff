import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import { sniff } from "../src/sniff";
import type { DetectorName } from "../src/types";

/**
 * Folder-driven fixtures, tested against real images only (fetch them with
 * `node test/fixtures/fetch.mjs`). Each per-family folder asserts both the
 * verdict and which detector family matched:
 *
 *   test/fixtures/initials/     committed - initials-on-colour     => initials
 *   test/fixtures/solidColor/   committed - flat colour blocks     => solidColor
 *   test/fixtures/personIcon/   committed - grey silhouettes       => personIcon
 *   test/fixtures/identicon/    committed - symmetric patterns     => identicon
 *   test/fixtures/real/         committed - real photos            => not a default
 *   test/fixtures/local-default/ git-ignored - any default avatar  => isDefault true
 *   test/fixtures/local-real/    git-ignored - real photos (faces) => isDefault false
 *
 * Empty folders are skipped, so CI/public clones stay green on whatever subset
 * of fixtures is present.
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

/** Per-family folders: assert the verdict *and* the matched detector. */
const FAMILY_GROUPS = [
  { folder: "initials", matched: "initials" },
  { folder: "solidColor", matched: "solidColor" },
  { folder: "personIcon", matched: "personIcon" },
  { folder: "identicon", matched: "identicon" },
] as const satisfies readonly { folder: string; matched: DetectorName }[];

/** Verdict-only folders (the matched family is unknown / mixed). */
const BOOL_GROUPS = [
  { folder: "real", expected: false },
  { folder: "local-default", expected: true },
  { folder: "local-real", expected: false },
] as const;

const total =
  FAMILY_GROUPS.reduce((n, g) => n + load(g.folder).length, 0) +
  BOOL_GROUPS.reduce((n, g) => n + load(g.folder).length, 0);

beforeAll(async () => {
  // Only load the wasm decoders if there are images that might need them.
  if (total > 0) {
    await import("../src/webp");
    await import("../src/svg");
  }
});

for (const { folder, matched } of FAMILY_GROUPS) {
  const items = load(folder);
  describe(`fixtures/${folder}`, () => {
    if (items.length === 0) {
      test.skip(`no images provided (run test/fixtures/fetch.mjs)`, () => {});
      return;
    }
    for (const { file, bytes } of items) {
      test(`${file} => default via ${matched}`, async () => {
        const result = await sniff(bytes);
        expect(result.isDefault).toBe(true);
        expect(result.matched).toBe(matched);
      });
    }
  });
}

for (const { folder, expected } of BOOL_GROUPS) {
  const items = load(folder);
  describe(`fixtures/${folder}`, () => {
    if (items.length === 0) {
      test.skip(`no images provided (drop files into test/fixtures/${folder})`, () => {});
      return;
    }
    for (const { file, bytes } of items) {
      test(`${file} => isDefault ${expected}`, async () => {
        const result = await sniff(bytes);
        expect(result.isDefault).toBe(expected);
      });
    }
  });
}
