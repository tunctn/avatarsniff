import { decodeImage, sniff } from "avatarsniff";
import { z } from "zod";
import {
  FetchImageError,
  type FetchImageErrorCode,
  fetchImage,
  isPublicHost,
  MAX_BYTES,
} from "@/lib/fetch-image";
import { useLogger, withEvlog } from "@/lib/observability/server";

export const dynamic = "force-dynamic";

const sniffSchema = z.object({
  url: z
    .string()
    .trim()
    .max(2048, "That URL is too long.")
    .pipe(
      z.url({
        protocol: /^https?$/,
        hostname: z.regexes.hostname,
        error: "Enter a full http:// or https:// image URL.",
      })
    )
    // Runs even when the URL check above failed, so parse defensively.
    .refine((value) => URL.canParse(value) && isPublicHost(new URL(value).hostname), {
      error: "That address points at a private or local network.",
    }),
});

const STATUS: Record<FetchImageErrorCode, number> = {
  blocked: 400,
  timeout: 504,
  too_large: 413,
  http_status: 502,
  too_many_redirects: 502,
  network: 502,
};

// Check an avatar by URL: the server downloads it (so browser CORS doesn't
// matter) and runs it through the library. Private/local hosts, bodies over
// 10 MB and slow servers are refused; see lib/fetch-image.ts.
export const POST = withEvlog(async (request: Request) => {
  const log = useLogger();
  const parsed = sniffSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    log.set({ sniff: { invalid: true } });
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const url = new URL(parsed.data.url);
  log.set({ sniff: { host: url.hostname } });

  let bytes: Uint8Array;
  try {
    bytes = await fetchImage(url);
  } catch (err) {
    if (err instanceof FetchImageError) {
      log.set({ sniff: { failed: err.code } });
      return Response.json({ error: err.message }, { status: STATUS[err.code] });
    }
    throw err;
  }

  const image = await decodeImage(bytes, { maxBytes: MAX_BYTES });
  if (!image) {
    log.set({ sniff: { bytes: bytes.length, failed: "undecodable" } });
    return Response.json(
      { error: "That URL isn't an image we can decode (PNG, JPEG or GIF)." },
      { status: 422 }
    );
  }

  const result = await sniff(image);
  log.set({
    sniff: {
      bytes: bytes.length,
      isDefault: result.isDefault,
      matched: result.matched,
    },
  });
  return Response.json(result);
});
