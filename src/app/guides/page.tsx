import { ArrowRight, BookOpen, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getAdSenseSlotId } from "@/lib/env";
import { AdSlot } from "@/components/AdSlot";
import { getAllGuides } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Display & Wallpaper Setup Guides",
  description:
    "Original engineering guides on 4K vs OLED wallpaper optimization, Vice City Neon desk lighting, and 21:9/32:9 ultrawide aspect ratio mastery.",
};

export default async function GuidesIndexPage() {
  const guides = await getAllGuides();

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <header className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#00F0FF]/35 bg-[#00F0FF]/10 px-3.5 py-1 text-xs font-semibold text-cyan-200">
          <BookOpen className="h-3.5 w-3.5" />
          Editorial Knowledge Base
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Display &amp; Setup Guides
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
          In-depth technical walkthroughs written by our display lab covering OLED pixel
          physics, color-banded gradient prevention, multi-monitor aspect ratios, and
          neon desk color harmony.
        </p>
      </header>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        {guides.map((guide) => (
          <article
            key={guide.slug}
            className="glass-surface group flex flex-col justify-between rounded-3xl p-6 transition hover:border-white/20 hover:bg-white/[0.06]"
          >
            <div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span
                  className="rounded-full border border-white/15 px-2.5 py-0.5 font-semibold text-white"
                  style={{ backgroundColor: `${guide.accentHex}22` }}
                >
                  {guide.category}
                </span>
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Clock className="h-3.5 w-3.5" />
                  {guide.readTime}
                </span>
              </div>

              <h2 className="mt-4 font-display text-xl font-bold leading-snug text-white group-hover:text-[#00F0FF]">
                <Link href={`/guides/${guide.slug}`}>{guide.title}</Link>
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                {guide.excerpt}
              </p>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-white/[0.08] pt-4 text-xs">
              <span className="text-slate-500">{guide.publishedAt}</span>
              <Link
                href={`/guides/${guide.slug}`}
                className="inline-flex items-center gap-1 font-semibold text-[#FF2E93] hover:text-white"
              >
                Read guide
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </article>
        ))}
      </div>

      <AdSlot
        slot="guides-index-bottom"
        adUnitId={getAdSenseSlotId("guide")}
        format="horizontal"
        minHeight={120}
        label="Guides Index Display Slot"
      />
    </div>
  );
}
