"use client";

import { type DefaultAvatarDetection, detectFromImageData } from "avatarsniff";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const SIZE = 64;
type DrawFn = (ctx: CanvasRenderingContext2D) => void;

function drawDefault(bg: string, letter: string): DrawFn {
  return (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "#fff";
    ctx.font = "600 34px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, SIZE / 2, SIZE / 2 + 2);
  };
}

function drawPhoto(): DrawFn {
  return (ctx) => {
    const g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    g.addColorStop(0, "#ffb347");
    g.addColorStop(1, "#ff5e62");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(SIZE / 2, 26, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(SIZE / 2, 62, 20, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  };
}

function drawLogoOnWhite(): DrawFn {
  return (ctx) => {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "#e8552d";
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, 15, 0, Math.PI * 2);
    ctx.fill();
  };
}

function drawSolid(color: string): DrawFn {
  return (ctx) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, SIZE, SIZE);
  };
}

const SAMPLES: { label: string; draw: DrawFn }[] = [
  { label: "Google default", draw: drawDefault("#4285f4", "A") },
  { label: "Default (green)", draw: drawDefault("#1f9d55", "M") },
  { label: "Real photo", draw: drawPhoto() },
  { label: "Logo on white", draw: drawLogoOnWhite() },
  { label: "Solid colour", draw: drawSolid("#16a3a3") },
];

function Verdict({ result }: { result: DefaultAvatarDetection | null }) {
  if (!result) {
    return null;
  }
  return (
    <>
      <Badge
        className={cn(
          result.isDefault
            ? "border-[var(--color-default-border)] bg-[var(--color-default-bg)] text-[var(--color-default-text)]"
            : "border-[var(--color-real-border)] bg-[var(--color-real-bg)] text-[var(--color-real-text)]"
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

function Sample({ label, draw }: { label: string; draw: DrawFn }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<DefaultAvatarDetection | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return;
    }
    draw(ctx);
    setResult(detectFromImageData(ctx.getImageData(0, 0, SIZE, SIZE)));
  }, [draw]);
  return (
    <Card className="flex flex-col items-center gap-2 p-4 text-center transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
      <canvas
        className="size-14 rounded-full bg-[var(--color-subtle)] object-cover"
        height={SIZE}
        ref={ref}
        width={SIZE}
      />
      <div className="text-xs font-semibold">{label}</div>
      <Verdict result={result} />
    </Card>
  );
}

function Upload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [result, setResult] = useState<DefaultAvatarDetection | null>(null);

  const handleFile = useCallback((file: File | undefined) => {
    if (!file) {
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        return;
      }
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      setResult(detectFromImageData(ctx.getImageData(0, 0, SIZE, SIZE)));
      setUrl(objectUrl);
    };
    img.src = objectUrl;
  }, []);

  return (
    <button
      className={cn(
        "mt-4 w-full cursor-pointer rounded-lg border border-dashed border-[var(--color-border-strong)] bg-background p-8 text-center text-sm text-muted-foreground transition-colors hover:border-muted-foreground hover:bg-[var(--color-subtle)] focus-visible:border-[var(--color-focus)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--color-focus)]/20",
        over && "border-muted-foreground bg-[var(--color-subtle)]"
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
            alt="uploaded avatar"
            className="size-14 rounded-full object-cover"
            src={url}
          />
          <Verdict result={result} />
        </div>
      ) : (
        "Drop an avatar here, or click to upload. Everything runs in your browser."
      )}
    </button>
  );
}

export function Demo() {
  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(0,1fr))] gap-3 min-[480px]:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
        {SAMPLES.map((sample) => (
          <Sample draw={sample.draw} key={sample.label} label={sample.label} />
        ))}
      </div>
      <Upload />
    </div>
  );
}
