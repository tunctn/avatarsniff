"use client";

import { sniff } from "avatarsniff";
import { useEffect, useState } from "react";

// ── Hayta, the guard dog ─────────────────────────────────────────────────────
// Each animation is a horizontal strip of 20×20 px frames in /public/hayta.
//
// `fps` is the per-animation playback speed — tune it here. Beat lengths are
// derived as whole cycles so an animation is NEVER cut mid-loop:
//   beat seconds = cycles × frames ÷ fps
// e.g. sit = 3 idle cycles @15fps = 2.0s · sniff = 1 cycle of the 20-frame strip
// @15fps = 1.33s · bark/happy = 2 cycles @15fps = 1.33s.
const DOG_SIZE = 52; // px on screen
const FRAME = 20; // source px per frame

type Anim = "idle" | "standing" | "walking" | "sniffing" | "barking" | "happy";

const ANIM: Record<Anim, { src: string; frames: number; fps: number }> = {
  idle: { src: "/hayta/idle.png", frames: 10, fps: 15 },
  standing: { src: "/hayta/standing.png", frames: 10, fps: 12 },
  walking: { src: "/hayta/walking.png", frames: 10, fps: 18 },
  sniffing: { src: "/hayta/sniffing.png", frames: 20, fps: 15 },
  barking: { src: "/hayta/barking.png", frames: 10, fps: 15 },
  happy: { src: "/hayta/happy.png", frames: 10, fps: 15 },
};

// Pure renderer. Every strip is kept mounted as its own layer with a constant
// background-image; only the active layer is visible. Nothing ever swaps its
// URL, so the browser never re-decodes mid-loop — no flash between animations.
function SpriteDog({
  anim,
  frame,
  faceLeft = false,
}: {
  anim: Anim;
  frame: number;
  faceLeft?: boolean;
}) {
  const scale = DOG_SIZE / FRAME;
  return (
    <div
      aria-hidden="true"
      style={{
        width: DOG_SIZE,
        height: DOG_SIZE,
        position: "relative",
        transform: faceLeft ? "scaleX(-1)" : undefined,
      }}
    >
      {(Object.keys(ANIM) as Anim[]).map((a) => {
        const sheet = ANIM[a];
        const active = a === anim;
        return (
          <div
            key={a}
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${sheet.src})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${sheet.frames * FRAME * scale}px ${FRAME * scale}px`,
              backgroundPosition: active
                ? `-${(frame % sheet.frames) * DOG_SIZE}px 0px`
                : "0 0",
              imageRendering: "pixelated",
              opacity: active ? 1 : 0,
            }}
          />
        );
      })}
    </div>
  );
}

// ── The 10 sniffable avatars (copied from the test fixtures) ─────────────────
const AVATARS = [
  "real-1.jpg",
  "initials-jd.png",
  "identicon-github.png",
  "real-2.jpg",
  "solid-blue.png",
  "person-mp.jpg",
  "initials-dicebear.png",
  "identicon-gravatar.png",
  "solid-pink.png",
  "identicon-dicebear.png",
].map((f) => `/avatars/${f}`);

const AVATAR_SIZE = 52; // px on screen
const PIXEL = 16; // avatar is downsampled to a 16×16 pixel circle
const RADIUS = 7.5; // circle radius in the 16px grid (8 touches the edges)

type Prepared = { isDefault: boolean; url: string };

// Load an avatar once: classify it at natural size with the real library (the
// dog's verdict), and bake a 16×16 pixel circle (hard edges, transparent
// corners) we upscale `pixelated` — so the circle itself is pixelated too.
function prepare(src: string): Promise<Prepared> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || 64;
      const h = img.naturalHeight || 64;
      const full = document.createElement("canvas");
      full.width = w;
      full.height = h;
      const fctx = full.getContext("2d", { willReadFrequently: true });
      const small = document.createElement("canvas");
      small.width = PIXEL;
      small.height = PIXEL;
      const sctx = small.getContext("2d", { willReadFrequently: true });
      if (!fctx || !sctx) {
        resolve({ isDefault: false, url: src });
        return;
      }
      fctx.drawImage(img, 0, 0);
      sctx.imageSmoothingEnabled = true; // clean downscale; CSS upscales blocky
      sctx.drawImage(img, 0, 0, PIXEL, PIXEL);
      // Hard circular mask: knock out pixels outside the radius.
      const id = sctx.getImageData(0, 0, PIXEL, PIXEL);
      const c = (PIXEL - 1) / 2;
      const r2 = RADIUS * RADIUS;
      for (let y = 0; y < PIXEL; y++) {
        for (let x = 0; x < PIXEL; x++) {
          const dx = x - c;
          const dy = y - c;
          if (dx * dx + dy * dy > r2) id.data[(y * PIXEL + x) * 4 + 3] = 0;
        }
      }
      sctx.putImageData(id, 0, 0);
      const url = small.toDataURL();
      sniff(fctx.getImageData(0, 0, w, h))
        .then((r) => resolve({ isDefault: Boolean(r?.isDefault), url }))
        .catch(() => resolve({ isDefault: false, url }));
    };
    img.onerror = () => resolve({ isDefault: false, url: src });
    img.src = src;
  });
}

// ── Choreography ─────────────────────────────────────────────────────────────
// 9-step cycle per avatar: sit (1.5s) · stand · walk over · stand · sniff (1s) ·
// stand · bark|love (1s) · stand · walk back. A 0.3s "standing" beat (first
// 3 frames) sits between every animation. Steps advance on FULL cycles
// so nothing is ever cut. The dog stops 5px off the avatar's right edge to sniff
// it:  [ AVATAR ][ 5px ][ DOG ].
const GAP = 5;
const AVATAR_X = -40; // avatar resting centre (left of middle)
const DOG_SNIFF = AVATAR_X + AVATAR_SIZE / 2 + GAP + DOG_SIZE / 2; // 5px gap, right edge
const DOG_HOME = 50; // where she sits when idle (right of middle)
const WALK_MS = Math.round((ANIM.walking.frames / ANIM.walking.fps) * 1000);

// Facing target per step (true = left, toward the avatar). Steps 7–8 face right
// to walk back. A change vs. the previous step flips at the beat's midpoint, on
// the same sprite — so she turns in place while sitting/standing, never mid-walk.
const FACE = [true, true, true, true, true, true, true, false, false];

type Step = { anim: Anim; frames: number; fps: number; cycles: number; dogX: number };

const stand = (dogX: number): Step => ({
  anim: "standing",
  frames: 3, // first 3 frames only
  fps: 10, // 3 frames @10fps = 0.3s
  cycles: 1,
  dogX,
});
const play = (anim: Anim, cycles: number, dogX: number): Step => ({
  anim,
  frames: ANIM[anim].frames,
  fps: ANIM[anim].fps,
  cycles,
  dogX,
});

// `isDefault` only changes the reaction step (6): bark vs. love.
function stepAt(idx: number, isDefault: boolean): Step {
  switch (idx) {
    case 0:
      return play("idle", 3, DOG_HOME); // sit, 1.5s
    case 1:
      return stand(DOG_HOME);
    case 2:
      return play("walking", 1, DOG_SNIFF); // walk over
    case 3:
      return stand(DOG_SNIFF);
    case 4:
      return play("sniffing", 1, DOG_SNIFF); // sniff, 1.0s
    case 5:
      return stand(DOG_SNIFF);
    case 6:
      return play(isDefault ? "barking" : "happy", 2, DOG_SNIFF); // 1.0s
    case 7:
      return stand(DOG_SNIFF); // turns right here (FACE[7]=false) before walking back
    default: // 8
      return play("walking", 1, DOG_HOME); // walk back
  }
}
const STEP_COUNT = 9;

export function GuardDogHero() {
  const [prepared, setPrepared] = useState<Prepared[] | null>(null);
  const [ready, setReady] = useState(false); // prepared + 0.5s grace
  const [{ i, step, tick }, setState] = useState({ i: 0, step: 0, tick: 0 });

  // Prepare avatars AND preload every sprite strip up front, so animation swaps
  // never flash an undecoded image.
  useEffect(() => {
    let live = true;
    const preload = Object.values(ANIM).map(
      (a) =>
        new Promise<void>((res) => {
          const im = new Image();
          im.onload = () => res();
          im.onerror = () => res();
          im.src = a.src;
        })
    );
    Promise.all([Promise.all(AVATARS.map(prepare)), ...preload]).then((out) => {
      if (live) setPrepared(out[0] as Prepared[]);
    });
    return () => {
      live = false;
    };
  }, []);

  // Hold the scene back until the avatars are prepared (so the first one is
  // already the pixelated circle, never the raw square) plus a tiny 0.05s grace.
  // A hard 1.5s fallback guarantees the loop starts even if prep ever stalls —
  // the dog never sits frozen on frame 0.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), prepared ? 50 : 1500);
    return () => clearTimeout(t);
  }, [prepared]);

  const isDefault = prepared?.[i]?.isDefault ?? false;
  const cur = stepAt(step, isDefault);

  // Drive everything off one frame ticker. A beat ends only after it has played
  // `frames × cycles` frames — a whole number of full loops — so nothing is cut.
  useEffect(() => {
    if (!ready) return;
    const total = cur.frames * cur.cycles;
    const id = setInterval(() => {
      setState((s) => {
        const nt = s.tick + 1;
        if (nt < total) return { ...s, tick: nt };
        return s.step === STEP_COUNT - 1
          ? { i: (s.i + 1) % AVATARS.length, step: 0, tick: 0 }
          : { i: s.i, step: s.step + 1, tick: 0 };
      });
    }, 1000 / cur.fps);
    return () => clearInterval(id);
  }, [i, step, ready, cur.frames, cur.cycles, cur.fps]);

  // Facing: flip at the beat's midpoint when it differs from the previous step.
  const curFace = FACE[step];
  const prevFace = FACE[(step + STEP_COUNT - 1) % STEP_COUNT];
  const half = (cur.frames * cur.cycles) / 2;
  const faceLeft =
    curFace === prevFace ? curFace : tick < half ? prevFace : curFace;

  // Avatar: slides up from below during the sit and holds through the sniff
  // (steps 0–5). On the reaction (step 6) it leaves — up if real, left if a
  // default — but only in the last 25% (the keyframe holds until 75%), so the
  // move is timed to the reaction's full length.
  const ease = "cubic-bezier(0.34,1.4,0.5,1)";
  const reactMs = Math.round((cur.frames * cur.cycles * 1000) / cur.fps);
  const avatarAnim =
    step === 6
      ? `${isDefault ? "guard-avatar-fail" : "guard-avatar-pass"} ${reactMs}ms ease-out forwards`
      : step <= 5
        ? `guard-avatar-enter 520ms ${ease} forwards`
        : undefined;
  const avatarHidden = step >= 7;
  const avatarUrl = prepared?.[i]?.url;

  return (
    <div
      aria-hidden="true"
      className="relative select-none mx-auto h-28 w-full max-w-[400px] overflow-hidden [--guard-inspect:-40px] [mask-image:linear-gradient(90deg,transparent,#000_14%,#000_86%,transparent)]"
    >
      {/* Incoming avatar — a pixelated 16×16 circle, no shadow, no border. Only
          rendered once prepared, so the raw square never paints on first load. */}
      {ready && avatarUrl && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          key={i}
        >
          <div
            className="will-change-transform"
            style={{
              animation: avatarAnim,
              opacity: avatarHidden ? 0 : undefined,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              src={avatarUrl}
              style={{
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                imageRendering: "pixelated",
              }}
            />
          </div>
        </div>
      )}

      {/* Hayta. */}
      <div
        className="absolute top-1/2 left-1/2 z-10 -translate-y-1/2 will-change-transform"
        style={{
          transform: `translateX(calc(-50% + ${cur.dogX}px))`,
          transition: `transform ${WALK_MS}ms ease-in-out`,
        }}
      >
        <div
          style={{
            animation:
              step === 6 && isDefault
                ? "guard-shake 320ms ease-in-out 2"
                : undefined,
          }}
        >
          <SpriteDog anim={cur.anim} faceLeft={faceLeft} frame={tick % cur.frames} />
        </div>
      </div>
    </div>
  );
}
