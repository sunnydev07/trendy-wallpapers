import { ArrowRight, Layers } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { MasonryGrid } from "@/components/MasonryGrid";
import { getAllCollections, getCollectionBySlug } from "@/lib/data-provider";
import { getAdSenseSlotId, getSiteUrl } from "@/lib/env";
import { serializeJsonLd } from "@/lib/json-ld";

interface CollectionPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllCollections().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCollectionBySlug(slug);
  if (!data) return { title: "Collection Not Found" };

  return {
    title: `${data.collection.title} — Curated Wallpaper Pack`,
    description: data.collection.subtitle,
  };
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  const data = await getCollectionBySlug(slug);

  if (!data) {
    notFound();
  }

  const { collection, wallpapers } = data;
  const otherCollections = getAllCollections().filter((c) => c.slug !== collection.slug);
  const siteUrl = getSiteUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: collection.title,
    description: collection.subtitle,
    url: `${siteUrl}/collections/${collection.slug}`,
    dateModified: collection.updatedAt,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />

      <header className="glass-surface rounded-3xl p-6 sm:p-10">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-white">
            <Layers className="h-3.5 w-3.5" style={{ color: collection.accentHex }} />
            Curated Pack
          </span>
          <span>•</span>
          <span>{collection.curator}</span>
          <span>•</span>
          <span>Updated {collection.updatedAt}</span>
        </div>

        <h1 className="mt-4 font-display text-3xl font-bold text-white sm:text-5xl">
          {collection.title}
        </h1>
        <p className="mt-3 text-base text-slate-300 sm:text-lg">
          {collection.subtitle}
        </p>

        {/* 300+ Word Editorial Commentary for AdSense & Reader Value */}
        <div className="mt-6 space-y-4 border-t border-white/[0.08] pt-6 text-sm leading-7 text-slate-300 sm:text-base">
          {collection.commentary.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      </header>

      <div className="mt-10">
        <MasonryGrid wallpapers={wallpapers} showInFeedAds={false} />
      </div>

      <AdSlot
        slot="collection-footer-display"
        adUnitId={getAdSenseSlotId("collection")}
        format="horizontal"
        minHeight={120}
        label="Collection Display Slot"
      />

      {/* Other Collections */}
      <section className="mt-12">
        <h2 className="font-display text-xl font-bold text-white">
          More Curated Packs
        </h2>
        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          {otherCollections.map((col) => (
            <Link
              key={col.slug}
              href={`/collections/${col.slug}`}
              className="glass-surface group flex items-center justify-between gap-4 rounded-2xl p-5 transition hover:border-white/20"
            >
              <div>
                <h3 className="font-display text-base font-bold text-white group-hover:text-[#00F0FF]">
                  {col.title}
                </h3>
                <p className="mt-1 text-xs text-slate-400">{col.subtitle}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-[#FF2E93]" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
