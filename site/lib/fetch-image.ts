import "server-only";

import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { DEFAULT_MAX_BYTES } from "avatarsniff";

// Fetches an image from a visitor-supplied URL for /api/sniff. Plain `fetch`
// can't be made safe for that: it follows redirects to any host, and the DNS
// answer it connects to can differ from the one we checked. So this uses
// node:http(s) with a `lookup` hook that rejects private addresses at connect
// time (no DNS-rebinding gap), follows redirects by hand (each hop goes
// through the same hook), caps the body at the library's 10 MB limit while
// streaming, and gives up after a few seconds overall.

export const MAX_BYTES = DEFAULT_MAX_BYTES;
export const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;

export type FetchImageErrorCode =
  | "blocked"
  | "timeout"
  | "too_large"
  | "http_status"
  | "too_many_redirects"
  | "network";

export class FetchImageError extends Error {
  readonly code: FetchImageErrorCode;

  constructor(message: string, code: FetchImageErrorCode) {
    super(message);
    this.name = "FetchImageError";
    this.code = code;
  }
}

// Everything that isn't a public unicast address: loopback, private, CGNAT,
// link-local (incl. cloud metadata 169.254.169.254), multicast, reserved,
// documentation and benchmarking ranges.
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

/** True if `address` (an IP literal) is not a public unicast address. */
export function isBlockedAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, "");
  const family = isIP(bare);
  if (family === 4) {
    return blocked.check(bare, "ipv4");
  }
  if (family === 6) {
    // IPv4-mapped (::ffff:a.b.c.d / ::ffff:xxxx:xxxx) and IPv4-compatible
    // addresses reach the IPv4 host, so judge them by the IPv4 rules.
    const mapped = toMappedIPv4(bare);
    if (mapped) {
      return blocked.check(mapped, "ipv4");
    }
    return blocked.check(bare, "ipv6");
  }
  return true;
}

function toMappedIPv4(ipv6: string): string | null {
  const lower = ipv6.toLowerCase();
  const dotted = lower.match(/^(?:0*:)*(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    return dotted[1];
  }
  const hex = lower.match(/^(?:0*:)*ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = Number.parseInt(hex[1], 16);
    const lo = Number.parseInt(hex[2], 16);
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return null;
}

// Resolves like the default lookup, then refuses the connection if any
// resolved address is non-public.
const safeLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) {
      callback(err, "", 0);
      return;
    }
    const list = addresses as LookupAddress[];
    const bad = list.find((a) => isBlockedAddress(a.address));
    if (bad || list.length === 0) {
      callback(
        new FetchImageError(
          "That address points at a private or local network.",
          "blocked"
        ),
        "",
        0
      );
      return;
    }
    if (options.all) {
      (callback as unknown as (e: null, a: LookupAddress[]) => void)(
        null,
        list
      );
    } else {
      callback(null, list[0].address, list[0].family);
    }
  });
};

function requestOnce(
  url: URL,
  signal: AbortSignal
): Promise<{ redirect: URL } | { body: Uint8Array }> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.get(
      url,
      {
        lookup: safeLookup,
        signal,
        headers: {
          // Ask for formats the core decoder handles, so content-negotiating
          // hosts (ui-avatars, etc.) don't answer with SVG or WebP.
          accept: "image/png,image/jpeg,image/gif;q=0.9,image/*;q=0.5",
          "user-agent": "avatarsniff-demo (+https://github.com/tunctn/avatarsniff)",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          try {
            resolve({ redirect: new URL(res.headers.location, url) });
          } catch {
            reject(new FetchImageError("Bad redirect.", "network"));
          }
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          reject(
            new FetchImageError(
              `The server answered HTTP ${status}.`,
              "http_status"
            )
          );
          return;
        }
        const declared = Number(res.headers["content-length"]);
        if (Number.isFinite(declared) && declared > MAX_BYTES) {
          res.destroy();
          reject(tooLarge());
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            res.destroy();
            reject(tooLarge());
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ body: new Uint8Array(Buffer.concat(chunks)) }));
        res.on("error", reject);
      }
    );
    req.on("error", reject);
  });
}

function tooLarge() {
  return new FetchImageError(
    `The image is larger than ${MAX_BYTES / 1024 / 1024} MB.`,
    "too_large"
  );
}

/** False for localhost names and private/local IP literals. Names that
 * resolve to private addresses are caught later, at connect time. */
export function isPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost")) {
    return false;
  }
  return !(isIP(host.replace(/^\[|\]$/g, "")) && isBlockedAddress(host));
}

function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchImageError("Only http and https URLs are allowed.", "blocked");
  }
  if (!isPublicHost(url.hostname)) {
    throw new FetchImageError(
      "That address points at a private or local network.",
      "blocked"
    );
  }
}

/** Download the image at `input`, refusing non-public hosts (every redirect
 * hop included), bodies over 10 MB and anything slower than TIMEOUT_MS. */
export async function fetchImage(input: URL): Promise<Uint8Array> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = input;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      assertPublicUrl(url);
      const result = await requestOnce(url, signal);
      if ("body" in result) {
        return result.body;
      }
      url = result.redirect;
    }
  } catch (err) {
    if (err instanceof FetchImageError) {
      throw err;
    }
    if (signal.aborted) {
      throw new FetchImageError(
        `The image took longer than ${TIMEOUT_MS / 1000} seconds to download.`,
        "timeout"
      );
    }
    throw new FetchImageError("Couldn't reach that URL.", "network");
  }
  throw new FetchImageError("Too many redirects.", "too_many_redirects");
}
