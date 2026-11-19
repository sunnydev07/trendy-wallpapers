import { Cpu, Eye, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Trendy-Wallpapers",
  description:
    "Learn about Trendy-Wallpapers' curation standards, strict AI transparency policy, zero-login Smart Download architecture, and OLED display lab.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-12 sm:px-6 lg:px-8">
      <div className="glass-surface rounded-3xl p-8 sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#00F0FF]/35 bg-[#00F0FF]/10 px-3 py-1 text-xs font-semibold text-cyan-200">
          <Sparkles className="h-3.5 w-3.5" />
          Our Mission
        </span>

        <h1 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">
          Built for Modern Displays, Not Pop-Up Ad Traps
        </h1>

        <p className="mt-4 text-base leading-relaxed text-slate-300">
          Trendy-Wallpapers was engineered to fix everything broken about legacy
          wallpaper websites: fake download buttons, blurry upscaled JPEGs, mandatory
          account walls, and unlabeled AI slop mixed into curated human artwork.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.08] bg-black/35 p-5">
            <Eye className="h-5 w-5 text-[#FF2E93]" />
            <h2 className="mt-3 font-display text-base font-bold text-white">
              Strict AI Transparency
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Every record carries an explicit provenance tag—Original, Official Press,
              or AI Generated—so visitors can filter strictly for human art or explore
              community AI studio creations with one click.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-black/35 p-5">
            <Cpu className="h-5 w-5 text-[#00F0FF]" />
            <h2 className="mt-3 font-display text-base font-bold text-white">
              Zero-Login Smart Downloads
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Our server-side Sharp pipeline detects your screen&apos;s pixel resolution
              and exports lossless PNG, high-efficiency WebP, or MozJPEG at your exact
              aspect ratio with immutable edge caching.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-black/35 p-5">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h2 className="mt-3 font-display text-base font-bold text-white">
              Copyright &amp; Artist Respect
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Every wallpaper includes visible attribution metadata and a direct link to
              our live DMCA takedown desk so rights holders can request rapid review or
              removal.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-black/35 p-5">
            <Sparkles className="h-5 w-5 text-purple-400" />
            <h2 className="mt-3 font-display text-base font-bold text-white">
              OLED &amp; Ultrawide Craft
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              We inspect luminance ratios for true OLED black coverage and compose
              dedicated 21:9, 32:9, and 9:16 lock screen editions with clean negative
              space behind system clocks.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3 border-t border-white/[0.08] pt-6">
          <Link
            href="/"
            className="btn-neon rounded-xl px-5 py-2.5 text-sm font-semibold"
          >
            Explore Gallery
          </Link>
          <Link
            href="/contact"
            className="rounded-xl border border-white/15 bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.1]"
          >
            Contact Editorial Team
          </Link>
        </div>
      </div>
    </div>
  );
}
