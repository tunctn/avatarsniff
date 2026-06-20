import sharp from "/Users/tunc/Projects/personal/avatarsniff/node_modules/.pnpm/sharp@0.34.5/node_modules/sharp/lib/index.js";

const SRC = "site/public/hayta/idle.png";
const OUT = "site/app/icon.png";
const FRAME_W = 20, FRAME_H = 20, SIZE = 512;

// crop first frame
const raw = await sharp(SRC)
  .extract({ left: 0, top: 0, width: FRAME_W, height: FRAME_H })
  .toBuffer();

// trim the transparent border down to the dog's bbox
const frame = await sharp(raw)
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 0 })
  .toBuffer();

const trimmed = await sharp(frame).metadata();
console.log(`trimmed bbox: ${trimmed.width}x${trimmed.height}`);

// nearest-neighbor upscale, contain into square with transparent padding
await sharp(frame)
  .resize(SIZE, SIZE, {
    fit: "contain",
    kernel: "nearest",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toFile(OUT);

const meta = await sharp(OUT).metadata();
console.log(`wrote ${OUT}: ${meta.width}x${meta.height}`);
