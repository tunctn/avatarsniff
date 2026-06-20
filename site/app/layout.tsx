import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "avatarsniff - sniff out default avatars",
  description:
    "Detect generic/default provider avatars (Google's initial-on-colour, Gravatar mystery-person, solid placeholders) straight from image pixels. Framework-agnostic, zero-dependency core.",
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
    </html>
  );
}
