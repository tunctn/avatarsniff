"use client";

import { type DefaultAvatarDetection, sniff } from "avatarsniff";
import { useCallback, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SIZE = 64;

// 40 real fixtures (5×8) copied from lib/test/fixtures into public/fixtures.
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
  "identicon-dicebear-3.png",
].map((f) => `/fixtures/${f}`);

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
        {result.isDefault ? "default" : "real"}
      </Badge>
      <div className="min-h-8 text-[11.5px] leading-[1.4] text-muted-foreground">
        {result.reason}
      </div>
    </>
  );
}

// Classify an image at a URL the exact way an upload is classified: draw it 1:1
// at its natural size (no destination scaling, so no smoothing blur — sniff
// downsamples internally) and sniff the resulting pixels. Works for both object
// URLs (uploads) and same-origin fixture paths.
function classify(src: string): Promise<DefaultAvatarDetection | null> {
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
      sniff(ctx.getImageData(0, 0, w, h)).then(resolve);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function Demo() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [result, setResult] = useState<DefaultAvatarDetection | null>(null);

  const select = useCallback((src: string) => {
    setUrl(src);
    setResult(null);
    classify(src).then(setResult);
  }, []);

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
