"use client";

import { type DefaultAvatarDetection, detectFromImageData } from "avatarsniff";
import { useCallback, useEffect, useRef, useState } from "react";

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
      <span className={`verdict ${result.isDefault ? "default" : "real"}`}>
        {result.isDefault ? "default" : "real"}
      </span>
      <div className="reason">{result.reason}</div>
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
    <div className="card">
      <canvas height={SIZE} ref={ref} width={SIZE} />
      <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
      <Verdict result={result} />
    </div>
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
      className={`drop ${over ? "over" : ""}`}
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
        onChange={(e) => handleFile(e.target.files?.[0])}
        ref={inputRef}
        type="file"
      />
      {url ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="uploaded avatar" src={url} />
          <Verdict result={result} />
        </div>
      ) : (
        <>Drop an avatar image here, or click to upload — detected in your browser.</>
      )}
    </button>
  );
}

export function Demo() {
  return (
    <div>
      <div className="grid">
        {SAMPLES.map((sample) => (
          <Sample draw={sample.draw} key={sample.label} label={sample.label} />
        ))}
      </div>
      <Upload />
    </div>
  );
}
