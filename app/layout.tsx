import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
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
      className={`${plexSans.variable} ${plexMono.variable} ${notoSansSc.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
