import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CopyPill } from "./copy-pill";
import { Demo } from "./demo";

const REPO = "tunctn/avatarsniff";

// Fetch the GitHub star count, cached for an hour. Returns null on any
// failure (rate limit, network) so the button just renders without a count.
async function getStarCount(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: number };
    return typeof data.stargazers_count === "number"
      ? data.stargazers_count
      : null;
  } catch {
    return null;
  }
}

const formatStars = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${n}`;

const HERO_CHIPS: { label: string; style: React.CSSProperties }[] = [
  {
    label: "M",
    style: {
      transform: "translateX(-160%) translateY(-12%) scale(0.86)",
      background: "var(--chip-green)",
    },
  },
  {
    label: "A",
    style: {
      transform: "translateX(-95%) translateY(-44%) scale(0.93)",
      background: "var(--chip-google)",
    },
  },
  {
    label: "S",
    style: {
      transform: "translateX(-50%) translateY(-56%) scale(1)",
      background: "var(--chip-violet)",
      zIndex: 2,
    },
  },
  {
    label: "●",
    style: {
      transform: "translateX(-5%) translateY(-44%) scale(0.93)",
      background: "var(--color-paper)",
      color: "var(--chip-logo)",
      fontSize: 26,
    },
  },
  {
    label: "",
    style: {
      transform: "translateX(60%) translateY(-12%) scale(0.86)",
      background: "var(--chip-teal)",
    },
  },
];

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-[5px] border border-border bg-[var(--color-paper-2)] px-1.5 py-px font-mono text-[0.92em] text-foreground">
      {children}
    </code>
  );
}

const USAGE = `import { detectFromImageData } from "avatarsniff";

const ctx = canvas.getContext("2d");
ctx.drawImage(avatarImg, 0, 0, 64, 64);

const { isDefault, reason } = detectFromImageData(
  ctx.getImageData(0, 0, 64, 64)
);

if (isDefault) {
  // generic provider default — swap in your own avatar
}`;

const NODE_USAGE = `import { detectDefaultAvatar, detectDefaultAvatarFromUrl } from "avatarsniff";

// batteries included — decodes PNG/JPEG/GIF/WEBP/SVG, up to 10MB, zero deps
const result = await detectDefaultAvatar(bytes);

const fromUrl = await detectDefaultAvatarFromUrl(user.photoUrl);
// null if the URL is missing or the fetch fails`;

const preClass =
  "overflow-x-auto rounded-md border border-border bg-[linear-gradient(to_top,var(--gray-2),var(--gray-1)_8px)] p-4 font-mono text-[13px] leading-[1.55] text-foreground";

export default async function Home() {
  const stars = await getStarCount();

  return (
    <main className="mx-auto max-w-[692px] px-6">
      <section className="flex flex-col items-center pt-[clamp(72px,14vh,128px)]">
        <div
          aria-hidden="true"
          className="relative mx-auto h-24 w-full max-w-[400px] [mask-image:linear-gradient(0deg,transparent_0,#000_42%)]"
        >
          {HERO_CHIPS.map((chip, i) => (
            <div
              className="absolute bottom-0 left-1/2 grid size-[52px] place-items-center rounded-full border border-border text-[22px] font-semibold text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
              key={i}
              style={chip.style}
            >
              {chip.label}
            </div>
          ))}
        </div>

        <h1 className="relative z-10 -mt-2 mb-3 text-[clamp(34px,8vw,48px)] font-bold leading-none tracking-[-0.04em] [overflow-wrap:anywhere]">
          avatarsniff
        </h1>
        <p className="mb-4 max-w-[34ch] text-center text-[17px] text-muted-foreground">
          Sniff out generic default avatars, straight from the pixels.
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          <a
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-10 w-[152px] rounded-md text-[13px] font-semibold"
            )}
            href="#demo"
          >
            Try it
          </a>
          <a
            className={cn(
              buttonVariants({ variant: "raise", size: "lg" }),
              "h-10 min-w-[152px] gap-1.5 rounded-md px-6 text-[13px] font-semibold"
            )}
            href="https://github.com/tunctn/avatarsniff"
            rel="noreferrer"
            target="_blank"
          >
            GitHub
            {stars !== null && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <span aria-hidden="true">★</span>
                {formatStars(stars)}
                <span className="sr-only"> stars on GitHub</span>
              </span>
            )}
          </a>
        </div>

        <a
          className="mt-3 text-sm text-muted-foreground underline decoration-[var(--color-border-strong)] underline-offset-2 transition-colors hover:decoration-muted-foreground"
          href="https://github.com/tunctn/avatarsniff#readme"
          rel="noreferrer"
          target="_blank"
        >
          Documentation
        </a>
      </section>

      <div className="mt-24 flex flex-col gap-16">
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          A lot of users never set a profile picture, so providers serve a boring
          auto-generated default: an initial on a coloured square (Google), the
          Gravatar mystery-person, or a solid placeholder.{" "}
          <strong className="font-semibold text-foreground">avatarsniff</strong>{" "}
          reads the pixels and catches those, so you can swap in something better
          instead of the generic one. Decodes PNG/JPEG/GIF/WEBP/SVG up to 10MB.
          Framework-agnostic, zero dependencies, server and client.
        </p>

        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Install</h2>
          <CopyPill command="pnpm add avatarsniff" />
        </section>

        <section className="flex flex-col gap-3" id="demo">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Try it</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            These run entirely in your browser through{" "}
            <Code>detectFromImageData</Code>. Each sample is drawn on a canvas and
            classified on the spot. Drop your own in below.
          </p>
          <Demo />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Browser</h2>
          <pre className={preClass}>
            <code>{USAGE}</code>
          </pre>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
            Server (Node)
          </h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Batteries included, and still zero-dependency: every decoder is
            bundled into the build, so PNG, GIF and JPEG decode in pure JS on any
            runtime. For WEBP and SVG in plain Node, opt into a subpath{" "}
            (<Code>import &quot;avatarsniff/webp&quot;</Code> or{" "}
            <Code>import &quot;avatarsniff/svg&quot;</Code>) so the wasm only loads
            when you actually need it. It rejects anything over 10MB before
            decoding.
          </p>
          <pre className={preClass}>
            <code>{NODE_USAGE}</code>
          </pre>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
            How it decides
          </h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            It keys on structure, never a hard-coded palette, so it keeps working
            as providers add new colours. An image counts as a default when the
            background is one flat colour that&apos;s neither near-white nor
            near-black, a small near-white glyph (the initial) sits on top, and
            there&apos;s almost no other coloured content.
          </p>
        </section>
      </div>

      <footer className="mt-24 border-t border-border py-8 text-sm text-muted-foreground">
        MIT ©{" "}
        <a
          className="font-medium text-foreground hover:underline"
          href="https://github.com/tunctn"
        >
          Tunç Türkmen
        </a>
      </footer>
    </main>
  );
}
