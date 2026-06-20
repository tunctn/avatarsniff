import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Demo } from "./demo";
import { GuardDogHero } from "./guard-dog";
import { InstallTabs } from "./install-tabs";

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

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-[5px] border border-border bg-[var(--color-paper-2)] px-1.5 py-px font-mono text-[0.92em] text-foreground">
      {children}
    </code>
  );
}

const USAGE = `import { sniff } from "avatarsniff";

const ctx = canvas.getContext("2d");
ctx.drawImage(avatarImg, 0, 0, 64, 64);

const { isDefault, matched, reason } = await sniff(
  ctx.getImageData(0, 0, 64, 64)
);

if (isDefault) {
  // generic provider default (matched: "initials" | "identicon" | ...)
  // swap in your own avatar
}`;

const NODE_USAGE = `import { sniff } from "avatarsniff";

// one entry point - pass bytes, a URL, or canvas pixels
// decodes PNG/JPEG/GIF/WEBP/SVG, up to 10MB, zero deps
const result = await sniff(bytes); // Uint8Array | ArrayBuffer

const fromUrl = await sniff(user.photoUrl); // fetched for you
// null if the URL is missing or the fetch fails

// every detector family is on by default - opt out per call
await sniff(bytes, { detect: { identicon: false } });`;

const preClass =
  "overflow-x-auto rounded-md border border-border bg-[linear-gradient(to_top,var(--gray-2),var(--gray-1)_8px)] p-4 font-mono text-[13px] leading-[1.55] text-foreground";

export default async function Home() {
  const stars = await getStarCount();

  return (
    <main className="mx-auto max-w-[692px] px-6">
      <section className="flex flex-col items-center pt-[clamp(72px,14vh,128px)]">
        <GuardDogHero />

        <h1 className="relative z-10 -mt-2 mb-3 font-[family-name:var(--font-dogica)] text-[clamp(30px,7vw,42px)] font-bold leading-[1.1] tracking-normal [overflow-wrap:anywhere]">
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
          <InstallTabs />
        </section>

        <section className="flex flex-col gap-3" id="demo">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Try it</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            These run entirely in your browser through <Code>sniff</Code>. Each
            sample is drawn on a canvas and classified on the spot. Drop your own
            in below.
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
