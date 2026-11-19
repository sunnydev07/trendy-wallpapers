import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { getAdSenseClientId, getSiteUrl, isDemoMode } from "@/lib/env";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Trendy-Wallpapers — 4K, Ultrawide & True OLED Wallpapers + AI Studio",
    template: "%s | Trendy-Wallpapers",
  },
  description:
    "Discover textless 4K UHD, 21:9 Ultrawide, Vice City Neon, and True Black OLED wallpapers with instant Smart Downloads, transparent AI labeling, and an on-demand AI Wallpaper Studio.",
  keywords: [
    "4k wallpapers",
    "gta 6 vice city wallpaper",
    "true oled dark wallpapers",
    "3440x1440 ultrawide wallpaper",
    "ai wallpaper generator",
    "mobile amoled lock screen",
  ],
  openGraph: {
    type: "website",
    siteName: "Trendy-Wallpapers",
    title: "Trendy-Wallpapers — 4K, Ultrawide & True OLED Wallpapers",
    description:
      "Zero login walls, thumbnail-first speed, exact screen resolution Smart Downloads, and transparent AI art filtering.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trendy-Wallpapers — 4K, Ultrawide & OLED Wallpapers",
    description:
      "Curated 4K, Ultrawide, and OLED wallpapers with Smart Download cropping and AI Wallpaper Studio.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adsenseClientId = getAdSenseClientId();
  const demoMode = isDemoMode();

  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} dark`}>
      <body className="min-h-screen bg-[#0B0D12] text-slate-100 antialiased selection:bg-[#FF2E93]/35 selection:text-white">
        {adsenseClientId && (
          <Script
            id="google-adsense-script"
            async
            strategy="afterInteractive"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClientId}`}
            crossOrigin="anonymous"
          />
        )}

        <div className="relative flex min-h-screen flex-col">
          {/* Subtle atmospheric top glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_at_top,_rgba(255,46,147,0.12),_rgba(0,240,255,0.05)_45%,_transparent_75%)]"
          />
          <Navbar demoMode={demoMode} />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
