import { Demo } from "./demo";

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

export default function Home() {
  return (
    <main className="wrap">
      <header>
        <h1>avatarsniff</h1>
        <p className="tagline">
          Sniff out generic default avatars, straight from the pixels.
        </p>
        <div className="links">
          <a
            className="btn"
            href="https://github.com/tunctn/avatarsniff"
            rel="noreferrer"
            target="_blank"
          >
            GitHub
          </a>
          <a className="btn" href="#demo">
            Try it
          </a>
        </div>
      </header>

      <p className="muted">
        A lot of users never set a profile picture, so providers serve a boring
        auto-generated default — an initial on a coloured square (Google),
        the Gravatar mystery-person, a solid placeholder. <strong>avatarsniff</strong>{" "}
        detects those from the image pixels so you can replace them with
        something better instead of showing the generic one. Decodes
        PNG/JPEG/GIF/WEBP/SVG up to 10MB, framework-agnostic, zero dependencies,
        server and client.
      </p>

      <h2>Install</h2>
      <div className="install">
        <span>pnpm add avatarsniff</span>
        <span className="copy">copy</span>
      </div>

      <h2 id="demo">Try it</h2>
      <p className="muted">
        These run entirely in your browser via <code className="inline">detectFromImageData</code>
        . The samples are drawn on a canvas and classified live — drop your own
        below.
      </p>
      <Demo />

      <h2>Browser</h2>
      <pre>
        <code>{USAGE}</code>
      </pre>

      <h2>Server (Node)</h2>
      <p className="muted">
        Batteries included and still zero-dependency (every decoder is bundled
        into the build): PNG, GIF and JPEG decode in pure JS on every runtime.
        For WEBP and SVG in plain Node, opt into a subpath —{" "}
        <code className="inline">import &quot;avatarsniff/webp&quot;</code> or{" "}
        <code className="inline">import &quot;avatarsniff/svg&quot;</code> — so
        their wasm only loads when you need it. Inputs over 10MB are rejected
        before decoding.
      </p>
      <pre>
        <code>{NODE_USAGE}</code>
      </pre>

      <h2>How it decides</h2>
      <p className="muted">
        It keys on structure, never a hard-coded palette (so it keeps working as
        providers add colours). An image is a default when the dominant
        background is a flat colour that is neither near-white nor near-black,
        there is a small near-white glyph (the initial), and there is almost no
        other coloured content.
      </p>

      <footer>
        MIT © <a href="https://github.com/tunctn">Tunc</a> · design nods to{" "}
        <a href="https://sonner.emilkowal.ski" rel="noreferrer" target="_blank">
          Sonner
        </a>
      </footer>
    </main>
  );
}
