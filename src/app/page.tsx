import { ArrowRight, Layers, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { FilterBar } from "@/components/FilterBar";
import { MasonryGrid } from "@/components/MasonryGrid";
import {
  getAllCategories,
  getAllCollections,
  getAllResolutions,
  queryWallpapers,
} from "@/lib/data-provider";
import type { DeviceType, SortOption, SourceFilterValue } from "@/types/wallpaper";

interface HomePageProps {
  searchParams: Promise<{
    q?: string;
    device?: string;
    source?: string;
    color?: string;
    textless?: string;
    oled?: string;
    sort?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";

  const wallpapers = await queryWallpapers({
    q: q || undefined,
    device: (params.device as DeviceType | "all") ?? "all",
    source: (params.source as SourceFilterValue) ?? "all",
    color: params.color || undefined,
    textless: params.textless === "1",
    oled: params.oled === "1",
    sort: (params.sort as SortOption) ?? "popular",
  });

  const resolutions = getAllResolutions();
  const categories = getAllCategories();
  const collections = getAllCollections();

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <section className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-slate-300">
          <Sparkles className="h-3.5 w-3.5 text-[#FF2E93]" />
          <span>Zero Login Walls • Smart Resolution Cropping • Transparent AI Filter</span>
        </div>

        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
          4K, Ultrawide &amp;{" "}
          <span className="bg-gradient-to-r from-[#FF2E93] via-fuchsia-400 to-[#00F0FF] bg-clip-text text-transparent">
            True OLED
          </span>{" "}
          Wallpapers
        </h1>

        <p className="mt-4 text-base leading-relaxed text-slate-400 sm:text-lg">
          Curated Vice City Neon, Cyberpunk, and pitch-black OLED masters—previewed live
          on your phone or desktop and exported at your exact native pixel resolution.
        </p>

        {/* Hero Search Form */}
        <form action="/" method="GET" className="mt-7">
          <div className="glass-surface flex items-center gap-2 rounded-2xl p-2 focus-within:border-[#00F0FF]/50">
            <Search className="ml-3 h-5 w-5 shrink-0 text-slate-400" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search Vice City, 3440x1440, OLED, cyberpunk, aurora..."
              aria-label="Search wallpapers"
              className="w-full bg-transparent px-2 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              className="btn-neon shrink-0 rounded-xl px-5 py-2.5 text-xs font-semibold sm:text-sm"
            >
              Search
            </button>
          </div>
        </form>

        {/* Quick Resolution & Category Pills */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {resolutions.map((res) => (
            <Link
              key={res.slug}
              href={`/resolution/${res.slug}`}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-[#00F0FF]/40 hover:bg-white/[0.08] hover:text-white"
            >
              {res.label}
              <span className="ml-1.5 font-mono text-[10px] text-slate-400">
                {res.aspectRatio}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Filter Bar */}
      <div className="mt-10">
        <Suspense
          fallback={
            <div className="glass-surface h-28 animate-pulse rounded-2xl" />
          }
        >
          <FilterBar />
        </Suspense>
      </div>

      {/* Results Header */}
      <div className="mt-8 flex items-center justify-between gap-4">
        <h2 className="font-display text-lg font-bold text-white">
          {q ? `Results for "${q}"` : "Trending Wallpapers"}
          <span className="ml-2 font-mono text-xs font-normal text-slate-400">
            ({wallpapers.length} shown)
          </span>
        </h2>

        <div className="hidden items-center gap-2 sm:flex">
          {categories.slice(0, 4).map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-slate-300 hover:border-white/20 hover:text-white"
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Zero-CLS Masonry Gallery */}
      <div className="mt-5">
        <MasonryGrid wallpapers={wallpapers} showInFeedAds={true} />
      </div>

      {/* Curated Collections Strip */}
      <section className="mt-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#00F0FF]">
              <Layers className="h-3.5 w-3.5" />
              Editorial Packs
            </div>
            <h2 className="mt-1 font-display text-2xl font-bold text-white">
              Curated Wallpaper Collections
            </h2>
          </div>
          <Link
            href="/guides"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-300 hover:text-white"
          >
            Read Display Guides
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
          {collections.map((col) => (
            <Link
              key={col.slug}
              href={`/collections/${col.slug}`}
              className="glass-surface group flex flex-col justify-between rounded-3xl p-6 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              <div>
                <span
                  className="inline-block h-2 w-10 rounded-full"
                  style={{ backgroundColor: col.accentHex }}
                />
                <h3 className="mt-4 font-display text-lg font-bold text-white group-hover:text-[#00F0FF]">
                  {col.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {col.subtitle}
                </p>
              </div>
              <div className="mt-6 flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>{col.wallpaperSlugs.length} curated pieces</span>
                <span className="inline-flex items-center gap-1 text-[#FF2E93]">
                  Explore pack <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
