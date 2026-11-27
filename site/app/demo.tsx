"use client";

import {
  DETECTOR_NAMES,
  type DefaultAvatarDetection,
  type DetectOptions,
  type DetectorName,
  sniff,
} from "avatarsniff";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SIZE = 64;

// 39 real fixtures copied from lib/test/fixtures into public/fixtures, plus one
// logo (5×8 grid).
// Clicking one feeds it through the exact same path as a user upload.
const SAMPLES: string[] = [
  "identicon-github-1.png",
  "initials-ui-ab.png",
  "real-picsum-3.jpg",
  "solid-fb8c00.png",
  "identicon-dicebear-4.png",
  "initials-dicebear-2.png",
  "person-mp.jpg",
  "real-picsum-13.jpg",
  "identicon-gravatar-2.png",
  "solid-1e88e5.png",
  "initials-ui-qw.png",
  "real-picsum-1.jpg",
  "identicon-dicebear-1.png",
  "initials-ui-ln.png",
  "solid-d81b60.png",
  "real-picsum-9.jpg",
  "identicon-github-3.png",
  "initials-dicebear-4.png",
  "real-picsum-5.jpg",
  "solid-43a047.png",
  "identicon-dicebear-5.png",
  "initials-ui-jd.png",
  "real-picsum-15.jpg",
  "identicon-gravatar-1.png",
  "solid-8e24aa.png",
  "initials-dicebear-1.png",
  "real-picsum-2.jpg",
  "identicon-dicebear-2.png",
  "initials-ui-mk.png",
  "solid-e53935.png",
  "real-picsum-11.jpg",
  "identicon-github-2.png",
  "initials-dicebear-3.png",
  "real-picsum-4.jpg",
  "identicon-dicebear-6.png",
  "solid-00897b.png",
  "initials-ui-ts.png",
  "real-picsum-7.jpg",
  "identicon-gravatar-3.png",
  // Not a fixture: a made-up, mirror-symmetric logo on white. It reads as an
  // identicon (the known false positive) until you switch identicon off.
  "logo-shield.png",
].map((f) => `/fixtures/${f}`);

// The library's defaults for the knobs the demo exposes. The lib doesn't export
// its DEFAULTS, so these mirror `DEFAULTS` in lib/src/analyze.ts - keep in sync.
const DEFAULT_THRESHOLDS = {
  scoreThreshold: 0.6,
  minSymmetry: 0.9,
  identiconMinSymmetry: 0.92,
} as const;

type Thresholds = { -readonly [K in keyof typeof DEFAULT_THRESHOLDS]: number };
type Toggles = Record<DetectorName, boolean>;

const DEFAULT_TOGGLES = Object.fromEntries(
  DETECTOR_NAMES.map((name) => [name, true])
) as Toggles;

const SLIDERS: { key: keyof Thresholds; hint: string }[] = [
  { key: "scoreThreshold", hint: "initials verdict cutoff" },
  { key: "minSymmetry", hint: "personIcon mirror symmetry" },
  { key: "identiconMinSymmetry", hint: "identicon mirror symmetry" },
];

function Options({
  toggles,
  thresholds,
  onToggle,
  onThreshold,
  onReset,
}: {
  toggles: Toggles;
  thresholds: Thresholds;
  onToggle: (name: DetectorName) => void;
  onThreshold: (key: keyof Thresholds, value: number) => void;
  onReset: () => void;
}) {
  const changed =
    DETECTOR_NAMES.some((n) => !toggles[n]) ||
    SLIDERS.some(({ key }) => thresholds[key] !== DEFAULT_THRESHOLDS[key]);
  return (
    <details className="group mt-4 border-2 border-[var(--px-ink)] bg-[var(--px-surface)]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 font-[family-name:var(--font-dogica)] text-[10px] uppercase tracking-wide select-none hover:text-[var(--px-accent)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--px-accent)]/30 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">
          ▸
        </span>
        Options
        {changed && (
          <span className="ml-auto text-[var(--px-accent)] normal-case">modified</span>
        )}
      </summary>
      <div className="flex flex-col gap-4 border-t-2 border-[var(--px-ink)] p-3">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[12px] text-muted-foreground">
            Detector families (<code className="font-mono">detect</code>)
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DETECTOR_NAMES.map((name) => (
              <label
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-2 border-2 px-2 py-1.5 font-mono text-[12px] transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-[var(--px-accent)]/30",
                  toggles[name]
                    ? "border-[var(--px-ink)] bg-[var(--px-surface-2)] text-foreground"
                    : "border-dashed border-[var(--px-ink)]/50 text-muted-foreground line-through"
                )}
                key={name}
              >
                <input
                  checked={toggles[name]}
                  className="size-4 shrink-0 accent-[var(--px-accent)]"
                  onChange={() => onToggle(name)}
                  type="checkbox"
                />
                {name}
              </label>
            ))}
          </div>
        </fieldset>
        {SLIDERS.map(({ key, hint }) => (
          <label className="flex flex-col gap-1.5" key={key}>
            <span className="flex items-baseline justify-between gap-2 text-[12px]">
              <span>
                <code className="font-mono text-foreground">{key}</code>{" "}
                <span className="text-muted-foreground">- {hint}</span>
              </span>
              <span className="font-mono tabular-nums">
                {thresholds[key].toFixed(2)}
              </span>
            </span>
            <input
              className="h-6 w-full cursor-pointer accent-[var(--px-accent)]"
              max={1}
              min={0}
              onChange={(e) => onThreshold(key, Number(e.target.value))}
              step={0.01}
              type="range"
              value={thresholds[key]}
            />
          </label>
        ))}
        <button
          className="self-start border-2 border-[var(--px-ink)] bg-[var(--px-surface-2)] px-3 py-1.5 font-[family-name:var(--font-dogica)] text-[9px] uppercase tracking-wide transition-colors hover:border-[var(--px-accent)] disabled:cursor-default disabled:opacity-50 disabled:hover:border-[var(--px-ink)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--px-accent)]/30"
          disabled={!changed}
          onClick={onReset}
          type="button"
        >
          Reset to defaults
        </button>
      </div>
    </details>
  );
}

function Verdict({ result }: { result: DefaultAvatarDetection | null }) {
  if (!result) {
    return null;
  }
  return (
    <>
      <Badge
        className={cn(
          "rounded-none border-2 font-[family-name:var(--font-dogica)] text-[8px] uppercase tracking-wide",
          result.isDefault
            ? "border-[var(--color-default-text)] bg-[var(--color-default-bg)] text-[var(--color-default-text)]"
            : "border-[var(--color-real-text)] bg-[var(--color-real-bg)] text-[var(--color-real-text)]"
        )}
        variant="outline"
      >
        {result.isDefault ? `default · ${result.matched}` : "real"}
      </Badge>
      <div className="min-h-8 text-[11.5px] leading-[1.4] text-muted-foreground">
        {result.reason}
      </div>
    </>
  );
}

// Read an image at a URL the exact way an upload is read: draw it 1:1 at its
// natural size (no destination scaling, so no smoothing blur — sniff
// downsamples internally) and grab the pixels. Works for both object URLs
// (uploads) and same-origin fixture paths. The pixels are kept so a changed
// option re-runs sniff without reloading the image.
function loadPixels(src: string): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || SIZE;
      const h = img.naturalHeight || SIZE;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, w, h));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function Demo() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [pixels, setPixels] = useState<ImageData | null>(null);
  const [result, setResult] = useState<DefaultAvatarDetection | null>(null);
  const [toggles, setToggles] = useState<Toggles>(DEFAULT_TOGGLES);
  const [thresholds, setThresholds] = useState<Thresholds>({
    ...DEFAULT_THRESHOLDS,
  });
  const latest = useRef<string | null>(null);

  const select = useCallback((src: string) => {
    latest.current = src;
    setUrl(src);
    setPixels(null);
    setResult(null);
    loadPixels(src).then((data) => {
      if (latest.current === src) {
        setPixels(data);
      }
    });
  }, []);

  // (Re-)run the check whenever the image or any option changes.
  useEffect(() => {
    if (!pixels) {
      return;
    }
    let stale = false;
    const options: DetectOptions = { ...thresholds, detect: toggles };
    sniff(pixels, options).then((r) => {
      if (!stale) {
        setResult(r);
      }
    });
    return () => {
      stale = true;
    };
  }, [pixels, toggles, thresholds]);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) {
        return;
      }
      select(URL.createObjectURL(file));
    },
    [select]
  );

  return (
    <div>
      <button
        className={cn(
          "flex h-[220px] w-full cursor-pointer flex-col items-center justify-center rounded-none border-2 border-dashed border-[var(--px-ink)] bg-[var(--px-surface)] p-8 text-center text-sm text-muted-foreground transition-colors hover:border-[var(--px-accent)] hover:bg-[var(--px-surface-2)] focus-visible:border-[var(--px-accent)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--px-accent)]/30",
          over && "border-[var(--px-accent)] bg-[var(--px-surface-2)]"
        )}
        onClick={() => inputRef.current?.click()}
        onDragLeave={() => setOver(false)}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        type="button"
      >
        <input
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
          ref={inputRef}
          type="file"
        />
        {url ? (
          <div className="flex flex-col items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="avatar"
              className="size-14 shrink-0 object-contain"
              height={56}
              src={url}
              width={56}
            />
            <div className="flex h-[60px] flex-col items-center gap-1.5">
              <Verdict result={result} />
            </div>
          </div>
        ) : (
          "Drop an avatar here, or click to upload. Everything runs in your browser."
        )}
      </button>

      <Options
        onReset={() => {
          setToggles(DEFAULT_TOGGLES);
          setThresholds({ ...DEFAULT_THRESHOLDS });
        }}
        onThreshold={(key, value) =>
          setThresholds((t) => ({ ...t, [key]: value }))
        }
        onToggle={(name) => setToggles((t) => ({ ...t, [name]: !t[name] }))}
        thresholds={thresholds}
        toggles={toggles}
      />

      <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
        …or click a sample below to classify it as if you'd uploaded it.
      </p>
      <div className="mt-3 grid grid-cols-8 gap-2">
        {SAMPLES.map((src) => (
          <button
            aria-label="classify sample avatar"
            className={cn(
              "cursor-pointer rounded-none border-2 bg-[var(--px-surface-2)] p-0 transition-colors hover:border-[var(--px-accent)] focus-visible:border-[var(--px-accent)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--px-accent)]/30",
              url === src
                ? "border-[var(--px-accent)]"
                : "border-[var(--px-ink)]"
            )}
            key={src}
            onClick={() => select(src)}
            type="button"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="sample avatar"
              className="aspect-square w-full object-cover [image-rendering:pixelated]"
              src={src}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
