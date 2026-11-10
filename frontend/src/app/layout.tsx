import type { Metadata } from "next";
import { Noto_Nastaliq_Urdu, Plus_Jakarta_Sans } from "next/font/google";
import { LangProvider } from "@/lib/i18n";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", weight: ["400", "500", "600", "700", "800"] });
const nastaliq = Noto_Nastaliq_Urdu({ subsets: ["arabic"], variable: "--font-nastaliq", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Roshan Rozgar — trusted workers at your door",
  description: "Hyper-local marketplace for skilled trade workers in Islamabad & Rawalpindi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} ${nastaliq.variable} font-sans antialiased`}>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
