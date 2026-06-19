import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
