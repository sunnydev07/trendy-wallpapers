import { Newspaper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { GalleryPagination } from "@/components/GalleryPagination";
import { MasonryGrid } from "@/components/MasonryGrid";
import {
  getAllCategories,
  getCategoryBySlug,
  queryWallpapers,
} from "@/lib/data-provider";
import { getSiteUrl } from "@/lib/env";
import type { DeviceType, SortOption, SourceFilterValue } from "@/types/wallpaper";

interface CategoryPageProps {
  params: Promise<{ category: string }>;
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

function hasFiltering(query: Awaited<CategoryPageProps["searchParams"]>): boolean {
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
  return getAllCategories().map((cat) => ({ category: cat.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: CategoryPageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const query = await searchParams;
  const info = getCategoryBySlug(slug);
  if (!info) return { title: "Category Not Found" };

  return {
    title: info.headline,
    description: info.description,
    keywords: info.keywords,
    alternates: { canonical: `${getSiteUrl()}/category/${info.slug}` },
    robots: hasFiltering(query) ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const { category: slug } = await params;
  const query = await searchParams;
  const info = getCategoryBySlug(slug);

  if (!info) {
    notFound();
  }

  const page = /^\d+$/.test(query.page ?? "") ? Number.parseInt(query.page!, 10) : 1;

  const wallpapers = await queryWallpapers({
    category: info.slug,
    device: (query.device as DeviceType | "all") ?? "all",
    source: (query.source as SourceFilterValue) ?? "all",
    color: query.color || undefined,
    textless: query.textless === "1",
    oled: query.oled === "1",
    sort: (query.sort as SortOption) ?? "popular",
    page,
  });

  const allCategories = getAllCategories();
  const currentQuery = new URLSearchParams(
    Object.entries(query).filter(([, value]) => typeof value === "string" && value) as [string, string][]
  ).toString();

  // Shortcut chip: applies the press filter while keeping any other active filters.
  const isPressFilterActive = query.source === "press";
  const pressParams = new URLSearchParams(currentQuery);
  pressParams.delete("page");
  if (isPressFilterActive) {
    pressParams.delete("source");
  } else {
    pressParams.set("source", "press");
  }
  const pressQuery = pressParams.toString();

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <header className="glass-surface rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-2.5">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: info.accentHex }}
          />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Curated Category
          </span>
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
          {info.headline}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
          {info.editorialIntro}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {allCategories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                cat.slug === info.slug
                  ? "border-white/30 bg-white/15 text-white"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white"
              }`}
            >
              {cat.name}
            </Link>
          ))}

          {info.slug === "gta-6-vice-city" && (
            <Link
              href={`/category/${info.slug}${pressQuery ? `?${pressQuery}` : ""}`}
              aria-current={isPressFilterActive ? "true" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                isPressFilterActive
                  ? "border-amber-400/50 bg-amber-400/15 text-amber-100"
                  : "border-amber-400/25 bg-amber-400/[0.06] text-amber-200 hover:border-amber-300/50 hover:text-amber-100"
              }`}
            >
              <Newspaper className="h-3.5 w-3.5" />
              GTA V Press
            </Link>
          )}
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
          pathname={`/category/${info.slug}`}
          page={wallpapers.page}
          hasNextPage={wallpapers.hasNextPage}
          query={currentQuery}
        />
      </div>
    </div>
  );
}
