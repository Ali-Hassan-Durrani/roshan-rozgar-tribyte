import type { Metadata } from "next";
import { LangProvider } from "@/lib/i18n";
import "./globals.css";

// Fonts load from Google Fonts at runtime (no build-time fetch, which broke `next build`).
const FONTS =
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Nastaliq+Urdu:wght@400;500;600;700&display=swap";

export const metadata: Metadata = {
  title: "Roshan Rozgar — trusted workers at your door",
  description: "Hyper-local marketplace for skilled trade workers in Islamabad & Rawalpindi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body className="font-sans antialiased">
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
