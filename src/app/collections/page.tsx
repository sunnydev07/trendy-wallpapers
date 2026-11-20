import { ArrowRight, Layers } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getAllCollections, getCollectionBySlug } from "@/lib/data-provider";
import { getSiteUrl } from "@/lib/env";

export const metadata: Metadata = {
  title: "Curated Wallpaper Collections & Packs",
  description:
    "Hand-curated wallpaper packs: Vice City neon, true-OLED obsidian essentials, and cyberpunk battlestation panoramas — each with editorial notes and native-resolution downloads.",
};

export default async function CollectionsIndexPage() {
  const collections = getAllCollections();
  const siteUrl = getSiteUrl();

  const entries = await Promise.all(
    collections.map(async (collection) => {
      const data = await getCollectionBySlug(collection.slug);
      return { collection, wallpapers: data?.wallpapers ?? [] };
    })
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Curated Wallpaper Collections",
    url: `${siteUrl}/collections`,
    hasPart: entries.map(({ collection }) => ({
      "@type": "CollectionPage",
      name: collection.title,
      url: `${siteUrl}/collections/${collection.slug}`,
    })),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#00F0FF]/35 bg-[#00F0FF]/10 px-3.5 py-1 text-xs font-semibold text-cyan-200">
          <Layers className="h-3.5 w-3.5" />
          Curated Packs
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Wallpaper Collections
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
          Themed packs assembled by our display lab — each with editorial context,
          matched color tones, and native-resolution Smart Downloads.
        </p>
      </header>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {entries.map(({ collection, wallpapers }) => (
          <Link
            key={collection.slug}
            href={`/collections/${collection.slug}`}
            className="group flex flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#12151E]/90 transition hover:border-white/25"
          >
            <div className="grid grid-cols-3 gap-1 p-1">
              {wallpapers.slice(0, 3).map((wallpaper) => (
                <div
                  key={wallpaper.slug}
                  className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#0F1219]"
                >
                  <Image
                    src={wallpaper.thumb_url}
                    alt={wallpaper.title}
                    fill
                    unoptimized
                    sizes="(min-width: 1024px) 130px, 30vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: collection.accentHex }}
                />
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  {wallpapers.length} wallpapers · {collection.curator}
                </span>
              </div>
              <h2 className="mt-2 font-display text-lg font-bold text-white">
                {collection.title}
              </h2>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-400">
                {collection.subtitle}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#00F0FF]">
                Open pack
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
