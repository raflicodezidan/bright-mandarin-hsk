import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Sans_SC, Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-poppins",
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
      className={`${poppins.variable} ${plexMono.variable} ${notoSansSc.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
