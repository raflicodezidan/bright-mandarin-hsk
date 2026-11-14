import type { Metadata } from "next";
import {
  JetBrains_Mono,
  Noto_Sans_SC,
  Plus_Jakarta_Sans,
} from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

const notoSansSc = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-noto-sc",
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Bright Mandarin",
    template: "%s · Bright Mandarin",
  },
  description: "Sistem tes online HSK Bright Mandarin.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="id"
      className={`${plusJakarta.variable} ${jetbrainsMono.variable} ${notoSansSc.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
