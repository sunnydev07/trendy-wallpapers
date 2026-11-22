import { Monitor } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { GalleryPagination } from "@/components/GalleryPagination";
import { MasonryGrid } from "@/components/MasonryGrid";
import {
  getAllResolutions,
  getResolutionBySlug,
  queryWallpapers,
} from "@/lib/data-provider";
import { getSiteUrl } from "@/lib/env";
import type { DeviceType, SortOption, SourceFilterValue } from "@/types/wallpaper";

interface ResolutionPageProps {
  params: Promise<{ res: string }>;
  searchParams: Promise<{
    device?: string;
    source?: string;
    color?: string;
    textless?: string;
    oled?: string;
    sort?: string;
    page?: string;
  }>;
}

function hasFiltering(query: Awaited<ResolutionPageProps["searchParams"]>): boolean {
  return Boolean(
    query.color ||
      query.page ||
      query.textless === "1" ||
      query.oled === "1" ||
      (query.device && query.device !== "all") ||
      (query.source && query.source !== "all") ||
      (query.sort && query.sort !== "popular")
  );
}

export async function generateStaticParams() {
  return getAllResolutions().map((r) => ({ res: r.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: ResolutionPageProps): Promise<Metadata> {
  const { res } = await params;
  const query = await searchParams;
  const info = getResolutionBySlug(res);
  if (!info) return { title: "Resolution Not Found" };

  return {
    title: info.headline,
    description: info.description,
    alternates: { canonical: `${getSiteUrl()}/resolution/${info.slug}` },
    robots: hasFiltering(query) ? { index: false, follow: true } : undefined,
  };
}

export default async function ResolutionPage({
  params,
  searchParams,
}: ResolutionPageProps) {
  const { res } = await params;
  const query = await searchParams;
  const info = getResolutionBySlug(res);

  if (!info) {
    notFound();
  }

  const page = /^\d+$/.test(query.page ?? "") ? Number.parseInt(query.page!, 10) : 1;

  const wallpapers = await queryWallpapers({
    resolution: info.slug,
    device: (query.device as DeviceType | "all") ?? "all",
    source: (query.source as SourceFilterValue) ?? "all",
    color: query.color || undefined,
    textless: query.textless === "1",
    oled: query.oled === "1",
    sort: (query.sort as SortOption) ?? "popular",
    page,
  });

  const allResolutions = getAllResolutions();
  const currentQuery = new URLSearchParams(
    Object.entries(query).filter(([, value]) => typeof value === "string" && value) as [string, string][]
  ).toString();

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <header className="glass-surface rounded-3xl p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00F0FF]/35 bg-[#00F0FF]/10 px-3 py-1 font-mono font-semibold text-cyan-200">
            <Monitor className="h-3.5 w-3.5" />
            {info.dimensions}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-slate-300">
            Aspect Ratio: {info.aspectRatio}
          </span>
        </div>

        <h1 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">
          {info.headline}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
          {info.editorialNote}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {allResolutions.map((item) => (
            <Link
              key={item.slug}
              href={`/resolution/${item.slug}`}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                item.slug === info.slug
                  ? "border-[#00F0FF]/50 bg-[#00F0FF]/15 text-white"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white"
              }`}
            >
              {item.label} ({item.dimensions})
            </Link>
          ))}
        </div>
      </header>

      <div className="mt-8">
        <Suspense
          fallback={
            <div className="glass-surface h-28 animate-pulse rounded-2xl" />
          }
        >
          <FilterBar />
        </Suspense>
      </div>

      <div className="mt-8">
        <MasonryGrid wallpapers={wallpapers.items} showInFeedAds={true} />
        <GalleryPagination
          pathname={`/resolution/${info.slug}`}
          page={wallpapers.page}
          hasNextPage={wallpapers.hasNextPage}
          query={currentQuery}
        />
      </div>
    </div>
  );
}
