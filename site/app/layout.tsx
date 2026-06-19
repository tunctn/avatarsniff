import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "avatarsniff — sniff out default avatars",
  description:
    "Detect generic/default provider avatars (Google's initial-on-colour, Gravatar mystery-person, solid placeholders) straight from image pixels. Framework-agnostic, zero-dependency core.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html className={`${inter.variable} ${geistMono.variable}`} lang="en">
      <body>{children}</body>
    </html>
  );
}
