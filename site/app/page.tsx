import { CodeBlock } from "@/components/ui/code-block";
import { env } from "@/lib/env";
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
      headers: {
        Accept: "application/vnd.github+json",
        // Authenticated requests get 5,000 req/hour vs 60 unauthenticated.
        ...(env.GITHUB_TOKEN && {
          Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        }),
      },
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
    <code className="border border-[var(--px-ink)] bg-[var(--px-surface-2)] px-1.5 py-px font-mono text-[0.92em] text-foreground">
      {children}
    </code>
  );
}

// Shared pixel button: square, 2px ink border, hard offset shadow that you
// walk into on hover/press. Dogica face for the arcade-label feel. Self-contained
// (layout + focus + interaction) so it doesn't stack with shadcn's buttonVariants
// base — that base injected a competing `transition-all` and a higher-specificity
// `active:translate-y-px`, which fought this press animation and made the shadow
// and position jump on hover/press.
const pxBtn =
  "inline-flex shrink-0 select-none items-center justify-center rounded-none border-2 border-[var(--px-ink)] font-[family-name:var(--font-dogica)] shadow-[3px_3px_0_0_var(--px-ink)] outline-none transition-[transform,box-shadow] duration-75 hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_var(--px-ink)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none focus-visible:border-[var(--px-accent)] focus-visible:ring-[3px] focus-visible:ring-[var(--px-accent)]/30";

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

export default async function Home() {
  const stars = await getStarCount();

  return (
    <main className="mx-auto max-w-[692px] px-6">
      <section className="flex flex-col items-center pt-[clamp(72px,14vh,128px)]">
        <GuardDogHero />

        <h1 className="relative z-10 -mt-2 mb-3 inline-flex items-end font-[family-name:var(--font-dogica)] text-[clamp(30px,7vw,42px)] font-bold leading-[1.1] tracking-normal [overflow-wrap:anywhere]">
          <a className="inline-flex items-end" href="https://avatarsniff.tunc.co">
            avatarsniff
            <span aria-hidden="true" className="px-caret" />
          </a>
        </h1>
        <p className="mb-4 max-w-[34ch] text-center text-[17px] text-muted-foreground">
          Sniff out generic default avatars, straight from the pixels.
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          <a
            className={cn(
              pxBtn,
              "h-11 w-[152px] bg-[var(--px-accent)] text-[11px] uppercase tracking-wide text-[var(--px-accent-ink)]"
            )}
            href="#demo"
          >
            Try it
          </a>
          <a
            className={cn(
              pxBtn,
              "h-11 min-w-[152px] gap-1.5 bg-[var(--px-surface)] px-6 text-[11px] uppercase tracking-wide text-foreground"
            )}
            href="https://github.com/tunctn/avatarsniff"
            rel="noreferrer"
            target="_blank"
          >
            GitHub
            {stars !== null && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <span aria-hidden="true" className="text-[var(--px-accent)]">
                  ★
                </span>
                {formatStars(stars)}
                <span className="sr-only"> stars on GitHub</span>
              </span>
            )}
          </a>
        </div>

        <a
          className="mt-3 font-[family-name:var(--font-dogica)] text-[10px] uppercase tracking-wide text-muted-foreground underline decoration-[var(--px-accent)] decoration-2 underline-offset-4 transition-colors hover:text-foreground"
          href="https://github.com/tunctn/avatarsniff/blob/main/lib/README.md"
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
          <h2 className="px-h2 text-[14px] font-bold">Install</h2>
          <InstallTabs />
        </section>

        <section className="flex flex-col gap-3" id="demo">
          <h2 className="px-h2 text-[14px] font-bold">Try it</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            This runs entirely in your browser through <Code>sniff</Code>. Drop
            your own avatar in, or click any of the real samples below to
            classify it on the spot.
          </p>
          <Demo />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="px-h2 text-[14px] font-bold">Browser</h2>
          <CodeBlock code={USAGE} lang="ts" title="browser.ts" />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="px-h2 text-[14px] font-bold">
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
          <CodeBlock code={NODE_USAGE} lang="ts" title="server.ts" />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="px-h2 text-[14px] font-bold">
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

      <footer className="mt-24 flex items-center gap-2 border-t-2 border-[var(--px-ink)] py-8 font-[family-name:var(--font-dogica)] text-[10px] uppercase tracking-wide text-muted-foreground">
        <span aria-hidden="true" className="size-2 bg-[var(--px-accent)]" />
        MIT ©{" "}
        <a
          className="text-foreground underline decoration-[var(--px-accent)] decoration-2 underline-offset-4 hover:text-[var(--px-accent)]"
          href="https://github.com/tunctn"
        >
          Tunç Türkmen
        </a>
      </footer>
    </main>
  );
}
