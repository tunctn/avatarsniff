#!/usr/bin/env node
/**
 * Fetch real default-avatar fixtures from public avatar-generation services and
 * real-photo negatives, into per-family folders. Reproducible: filenames are
 * deterministic, so re-running overwrites in place.
 *
 *   node test/fixtures/fetch.mjs
 *
 * Every image here is generated/served by a public API that exists for exactly
 * this purpose (or is openly licensed), so committing the output is fine:
 *
 *   - UI Avatars   (ui-avatars.com)        generated initials-on-colour       initials
 *   - DiceBear     (dicebear.com)          generated initials / identicons    initials, identicon
 *   - dummyimage   (dummyimage.com)        flat solid-colour placeholders     solidColor
 *   - Gravatar     (gravatar.com)          mystery-person + identicon defaults personIcon, identicon
 *   - GitHub       (github.com/identicons) identicon defaults                 identicon
 *   - Lorem Picsum (picsum.photos)         real photos (Unsplash, open)        real (negatives)
 *
 * Folder => expected verdict (see fixtures.test.ts):
 *   initials/ solidColor/ personIcon/ identicon/  => isDefault true (matched = folder)
 *   real/                                          => isDefault false
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

// Saturated, mid-tone backgrounds (never near-white / near-black) for the
// initials & solid-colour families.
const COLORS = [
  "e53935", "d81b60", "8e24aa", "5e35b1", "3949ab", "1e88e5", "00897b",
  "43a047", "fb8c00", "f4511e", "6d4c41", "546e7a", "00acc1", "c0ca33",
];
const INITIALS = ["AB", "JD", "MK", "TS", "RP", "LN", "EZ", "QW"];

/** @type {{family:string,name:string,url:string}[]} */
const items = [];

// initials - white initials on a flat saturated colour
INITIALS.forEach((ini, i) => {
  const bg = COLORS[i % COLORS.length];
  items.push({
    family: "initials",
    name: `ui-${ini.toLowerCase()}.png`,
    url: `https://ui-avatars.com/api/?name=${ini}&background=${bg}&color=ffffff&size=160&bold=true`,
  });
});
["Ada Lovelace", "Grace Hopper", "Alan Turing", "Linus T", "Margaret H", "Dennis R"].forEach(
  (seed, i) => {
    items.push({
      family: "initials",
      name: `dicebear-${i + 1}.png`,
      url: `https://api.dicebear.com/9.x/initials/png?seed=${encodeURIComponent(seed)}&size=160`,
    });
  }
);

// solidColor - flat colour, no glyph (text colour == background). placehold.co
// emits an 8-bit PNG the bundled decoder reads (dummyimage's sub-8-bit PNGs don't).
COLORS.slice(0, 10).forEach((hex) => {
  items.push({
    family: "solidColor",
    name: `solid-${hex}.png`,
    url: `https://placehold.co/160x160/${hex}/${hex}.png`,
  });
});

// personIcon - Gravatar's grey "mystery person" silhouette on flat light grey.
// The image is the same regardless of hash; vary the requested size.
[96, 128, 160, 200, 256].forEach((s) => {
  items.push({
    family: "personIcon",
    name: `gravatar-mp-${s}.jpg`,
    url: `https://www.gravatar.com/avatar/0000000000000000000000000000000${s}?d=mp&f=y&s=${s}`,
  });
});

// identicon - symmetric blocky patterns from three independent generators
for (let i = 1; i <= 6; i++) {
  const hash = String(i).repeat(32).slice(0, 32);
  items.push({
    family: "identicon",
    name: `gravatar-${i}.png`,
    url: `https://www.gravatar.com/avatar/${hash}?d=identicon&f=y&s=160`,
  });
}
["octocat", "torvalds", "gaearon", "sindresorhus", "yyx990803", "tj"].forEach((u, i) => {
  items.push({
    family: "identicon",
    name: `github-${i + 1}.png`,
    url: `https://github.com/identicons/${u}.png`,
  });
});
["alpha", "bravo", "charlie", "delta", "echo", "foxtrot"].forEach((seed, i) => {
  items.push({
    family: "identicon",
    name: `dicebear-${i + 1}.png`,
    url: `https://api.dicebear.com/9.x/identicon/png?seed=${seed}&size=160`,
  });
});

// real - actual photos (negatives). Seeded so each is a different stable image.
for (let i = 1; i <= 16; i++) {
  items.push({
    family: "real",
    name: `picsum-${i}.jpg`,
    url: `https://picsum.photos/seed/avatarsniff${i}/256`,
  });
}

async function run() {
  let ok = 0;
  let fail = 0;
  const limit = 6;
  for (let start = 0; start < items.length; start += limit) {
    const batch = items.slice(start, start + limit);
    await Promise.all(
      batch.map(async (it) => {
        const dest = join(HERE, it.family, it.name);
        try {
          const res = await fetch(it.url, { redirect: "follow" });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          const buf = Buffer.from(await res.arrayBuffer());
          await mkdir(dirname(dest), { recursive: true });
          await writeFile(dest, buf);
          ok++;
          console.log(`  ✓ ${it.family}/${it.name} (${buf.length}b)`);
        } catch (err) {
          fail++;
          console.warn(`  ✗ ${it.family}/${it.name} - ${err.message}`);
        }
      })
    );
  }
  console.log(`\nfetched ${ok} fixtures, ${fail} failed`);
  if (fail > 0) {
    process.exitCode = 1;
  }
}

run();
