import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import { env } from "@/lib/env";
import "./globals.css";

const umamiWebsiteId = env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Dogica Pixel by AV Reference (rmocci) - free for commercial use; bundling in
// an app requires attribution + the license notice. See ./fonts/dogica_pixel_license.txt
const dogica = localFont({
  src: [
    { path: "./fonts/dogicapixel.ttf", weight: "400", style: "normal" },
    { path: "./fonts/dogicapixelbold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-dogica",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const title = "avatarsniff - sniff out default avatars";
const description =
  "Detect generic/default provider avatars (Google's initial-on-colour, Gravatar mystery-person, solid placeholders) straight from image pixels. Framework-agnostic, zero-dependency core.";

export const metadata: Metadata = {
  metadataBase: new URL("https://avatarsniff.tunc.co"),
  title,
  description,
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "avatarsniff",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 2080,
        height: 802,
        alt: "avatarsniff — Sniff out generic default avatars, straight from the pixels.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      className={`${inter.variable} ${geistMono.variable} ${dogica.variable}`}
      lang="en"
    >
      <body>{children}</body>
      {umamiWebsiteId ? (
        <Script
          defer
          src="https://analytics.wust.co/script.js"
          data-website-id={umamiWebsiteId}
        />
      ) : null}
    </html>
  );
}
