import {
  ArrowLeft,
  Calendar,
  Download,
  Eye,
  Flag,
  Monitor,
  ShieldCheck,
  Tag,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { ColorPaletteChips } from "@/components/ColorPaletteChips";
import { DevicePreviewStage } from "@/components/DevicePreviewStage";
import { MasonryGrid } from "@/components/MasonryGrid";
import { SmartDownloadPanel } from "@/components/SmartDownloadPanel";
import {
  getAllPublishedWallpaperSlugs,
  getCategoryBySlug,
  getRelatedWallpapers,
  getWallpaperBySlug,
} from "@/lib/data-provider";
import { getSiteUrl } from "@/lib/env";

interface WallpaperDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllPublishedWallpaperSlugs();
  return slugs.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: WallpaperDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const wallpaper = await getWallpaperBySlug(slug);
  if (!wallpaper) {
    return { title: "Wallpaper Not Found" };
  }

  return {
    title: `${wallpaper.title} (${wallpaper.width}×${wallpaper.height} ${wallpaper.aspect_ratio})`,
    description: wallpaper.description.slice(0, 160),
    openGraph: {
      title: `${wallpaper.title} — Free ${wallpaper.aspect_ratio} Wallpaper`,
      description: wallpaper.description.slice(0, 160),
      type: "article",
    },
  };
}

export default async function WallpaperDetailPage({
  params,
}: WallpaperDetailPageProps) {
  const { slug } = await params;
  const wallpaper = await getWallpaperBySlug(slug);

  if (!wallpaper) {
    notFound();
  }

  const related = await getRelatedWallpapers(wallpaper, 6);
  const category = getCategoryBySlug(wallpaper.category_slug);
  const siteUrl = getSiteUrl();
  const pageUrl = `${siteUrl}/wallpaper/${wallpaper.slug}`;

  const sourceLabel =
    wallpaper.source_type === "ai_generated"
      ? "AI Generated"
      : wallpaper.source_type === "official_press"
        ? "Official Press"
        : "Original Artwork";

  // Structured Data (ImageObject JSON-LD) for Google Image & Rich Search indexing
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    name: wallpaper.title,
    description: wallpaper.description,
    contentUrl: `${siteUrl}/api/download?slug=${encodeURIComponent(wallpaper.slug)}&format=webp`,
    thumbnailUrl: wallpaper.thumb_url.startsWith("http")
      ? wallpaper.thumb_url
      : `${siteUrl}/api/download?slug=${encodeURIComponent(wallpaper.slug)}&w=600&format=webp&preview=1`,
    width: wallpaper.width,
    height: wallpaper.height,
    datePublished: wallpaper.created_at,
    creditText: wallpaper.attribution_text,
    license: `${siteUrl}/terms`,
    acquireLicensePage: pageUrl,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-slate-400">
        <Link
          href="/"
          className="inline-flex items-center gap-1 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Gallery
        </Link>
        <span>/</span>
        {category && (
          <>
            <Link
              href={`/category/${category.slug}`}
              className="hover:text-white"
            >
              {category.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="truncate text-slate-200">{wallpaper.title}</span>
      </nav>

      {/* Main Split Stage */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Interactive Preview & Editorial Description */}
        <div className="space-y-6 lg:col-span-8">
          <DevicePreviewStage wallpaper={wallpaper} />

          <ColorPaletteChips colors={wallpaper.dominant_colors} />

          {/* Editorial Context Card (150+ words for SEO & AdSense value) */}
          <article className="glass-surface rounded-3xl p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  wallpaper.source_type === "ai_generated"
                    ? "border-[#FF2E93]/40 bg-[#FF2E93]/15 text-pink-200"
                    : wallpaper.source_type === "official_press"
                      ? "border-[#00F0FF]/40 bg-[#00F0FF]/15 text-cyan-200"
                      : "border-white/15 bg-white/[0.06] text-slate-200"
                }`}
              >
                {sourceLabel}
              </span>
              {wallpaper.is_oled_dark && (
                <span className="rounded-full border border-purple-400/35 bg-purple-500/15 px-3 py-1 text-xs font-semibold text-purple-200">
                  True OLED Dark
                </span>
              )}
              {wallpaper.is_textless && (
                <span className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  Textless Master
                </span>
              )}
            </div>

            <h1 className="mt-4 font-display text-2xl font-bold text-white sm:text-3xl">
              {wallpaper.title}
            </h1>

            <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
              {wallpaper.description}
            </p>

            {/* Tags */}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-slate-500" />
              {wallpaper.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/?q=${encodeURIComponent(tag)}`}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-300 hover:border-white/25 hover:text-white"
                >
                  #{tag}
                </Link>
              ))}
            </div>

            {/* Attribution & Copyright Hygiene */}
            <div className="mt-6 flex flex-col justify-between gap-3 border-t border-white/[0.08] pt-5 text-xs text-slate-400 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#00F0FF]" />
                <span>{wallpaper.attribution_text}</span>
              </div>
              <Link
                href={`/dmca?url=${encodeURIComponent(pageUrl)}&id=${encodeURIComponent(wallpaper.id)}`}
                className="inline-flex items-center gap-1.5 text-slate-400 hover:text-rose-300"
              >
                <Flag className="h-3.5 w-3.5" />
                Report Copyright / DMCA
              </Link>
            </div>
          </article>
        </div>

        {/* Right: Smart Download Panel & Specs */}
        <div className="space-y-6 lg:col-span-4">
          <SmartDownloadPanel wallpaper={wallpaper} />

          {/* Technical Specs Card */}
          <div className="glass-surface rounded-3xl p-5">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-slate-300">
              Technical Specifications
            </h2>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                <dt className="flex items-center gap-1.5 text-slate-400">
                  <Monitor className="h-3.5 w-3.5" />
                  Native Resolution
                </dt>
                <dd className="font-mono font-semibold text-white">
                  {wallpaper.width} × {wallpaper.height}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                <dt className="text-slate-400">Aspect Ratio</dt>
                <dd className="font-mono font-semibold text-white">
                  {wallpaper.aspect_ratio}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                <dt className="flex items-center gap-1.5 text-slate-400">
                  <Download className="h-3.5 w-3.5" />
                  Downloads
                </dt>
                <dd className="font-mono font-semibold text-white">
                  {wallpaper.downloads_count.toLocaleString()}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
                <dt className="flex items-center gap-1.5 text-slate-400">
                  <Eye className="h-3.5 w-3.5" />
                  Views
                </dt>
                <dd className="font-mono font-semibold text-white">
                  {wallpaper.views_count.toLocaleString()}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-slate-400">
                  <Calendar className="h-3.5 w-3.5" />
                  Published
                </dt>
                <dd className="font-mono text-slate-200">
                  {new Date(wallpaper.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* CLS-safe AdSlot placed strictly >= 48px away from Download controls */}
      <AdSlot
        slot="wallpaper-detail-horizontal"
        format="horizontal"
        minHeight={120}
        label="Detail Page Display Slot"
        className="my-12"
      />

      {/* Related Wallpapers (Thumbnail-Only Grid) */}
      <section className="mt-14">
        <h2 className="font-display text-2xl font-bold text-white">
          Related {category ? category.name : "Wallpapers"}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          More textless, high-contrast backdrops in matching resolutions and color tones.
        </p>
        <div className="mt-6">
          <MasonryGrid wallpapers={related} showInFeedAds={false} />
        </div>
      </section>
    </div>
  );
}
