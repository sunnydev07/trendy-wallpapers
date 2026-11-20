import { Download, Monitor, Smartphone, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import type { Wallpaper } from "@/types/wallpaper";
import { getAdSenseSlotId } from "@/lib/env";
import { AdSlot } from "./AdSlot";

interface MasonryGridProps {
  wallpapers: Wallpaper[];
  showInFeedAds?: boolean;
  emptyMessage?: string;
}

function getSourceBadge(sourceType: Wallpaper["source_type"]) {
  if (sourceType === "ai_generated") {
    return {
      label: "AI Generated",
      className: "border-[#FF2E93]/40 bg-[#FF2E93]/15 text-pink-200",
    };
  }
  if (sourceType === "licensed_stock") {
    return {
      label: "Licensed Photo",
      className: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
    };
  }
  if (sourceType === "official_press") {
    return {
      label: "Official Press",
      className: "border-[#00F0FF]/40 bg-[#00F0FF]/15 text-cyan-200",
    };
  }
  return {
    label: "Original",
    className: "border-white/20 bg-black/55 text-slate-200",
  };
}

function formatCompactCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

/**
 * Zero-CLS thumbnail-only masonry grid.
 * - Reserves exact card geometry via CSS aspectRatio from stored width/height.
 * - Never loads full 4K/8K originals in grids (strictly thumb_url <= 480px).
 * - Injects a CLS-reserved <AdSlot /> after every 12th item when showInFeedAds is true.
 */
export function MasonryGrid({
  wallpapers,
  showInFeedAds = true,
  emptyMessage = "No wallpapers matched your current filters. Try clearing one or two filters to explore more.",
}: MasonryGridProps) {
  if (wallpapers.length === 0) {
    return (
      <div className="glass-surface flex flex-col items-center justify-center rounded-3xl px-6 py-20 text-center">
        <Sparkles className="h-8 w-8 text-[#00F0FF]" />
        <h3 className="mt-4 font-display text-lg font-semibold text-white">
          No matching wallpapers found
        </h3>
        <p className="mt-2 max-w-md text-sm text-slate-400">{emptyMessage}</p>
        <Link
          href="/"
          className="mt-6 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white hover:bg-white/[0.12]"
        >
          Reset all filters
        </Link>
      </div>
    );
  }

  // Chunk into groups of 12 so in-feed AdSlots span full width cleanly without disrupting masonry columns
  const chunks: Wallpaper[][] = [];
  for (let i = 0; i < wallpapers.length; i += 12) {
    chunks.push(wallpapers.slice(i, i + 12));
  }

  return (
    <div className="space-y-8">
      {chunks.map((chunk, chunkIdx) => (
        <Fragment key={`chunk-${chunkIdx}`}>
          <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
            {chunk.map((wallpaper) => {
              const badge = getSourceBadge(wallpaper.source_type);
              const isMobile = wallpaper.aspect_ratio === "9:16";

              return (
                <article
                  key={wallpaper.id}
                  className="group mb-5 inline-block w-full break-inside-avoid overflow-hidden align-top rounded-2xl border border-white/[0.08] bg-white/[0.03] ring-1 ring-inset ring-white/[0.06] transition duration-300 hover:border-white/20 hover:bg-white/[0.05]"
                >
                  <Link href={`/wallpaper/${wallpaper.slug}`} className="block">
                    <div
                      className="relative w-full overflow-hidden bg-[#0F1219]"
                      style={{
                        aspectRatio: `${wallpaper.width} / ${wallpaper.height}`,
                      }}
                    >
                      {/* Thumbnail-only grid guardrail: strictly render thumb_url (<= 480px) */}
                      <Image
                        src={wallpaper.thumb_url}
                        alt={`${wallpaper.title} — ${wallpaper.width}x${wallpaper.height} ${wallpaper.aspect_ratio} wallpaper`}
                        unoptimized
                        fill
                        sizes="(min-width: 1280px) 392px, (min-width: 1024px) calc((100vw - 104px) / 3), (min-width: 640px) calc((100vw - 68px) / 2), calc(100vw - 32px)"
                        loading="lazy"
                        decoding="async"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03] group-hover:transform-gpu"
                      />

                      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 via-black/25 to-transparent p-3">
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {wallpaper.is_oled_dark && (
                            <span className="rounded-full border border-purple-400/40 bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-200">
                              OLED
                            </span>
                          )}
                          <span className="rounded-full border border-white/15 bg-black/70 px-2 py-0.5 font-mono text-[10px] text-slate-200">
                            {wallpaper.aspect_ratio}
                          </span>
                        </div>
                      </div>

                      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3.5 opacity-95 transition group-hover:opacity-100">
                        <div className="min-w-0">
                          <h3 className="truncate font-display text-sm font-semibold text-white">
                            {wallpaper.title}
                          </h3>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-300">
                            <span className="inline-flex items-center gap-1">
                              {isMobile ? (
                                <Smartphone className="h-3 w-3 text-[#00F0FF]" />
                              ) : (
                                <Monitor className="h-3 w-3 text-[#00F0FF]" />
                              )}
                              {wallpaper.width}×{wallpaper.height}
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              <Download className="h-3 w-3 text-[#FF2E93]" />
                              {formatCompactCount(wallpaper.downloads_count)}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center -space-x-1">
                          {wallpaper.dominant_colors.slice(0, 3).map((hex) => (
                            <span
                              key={hex}
                              className="h-3.5 w-3.5 rounded-full border border-white/30"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>

          {showInFeedAds && chunk.length === 12 && (
            <AdSlot
              slot={`in-feed-grid-${chunkIdx + 1}`}
              adUnitId={getAdSenseSlotId("infeed")}
              format="fluid"
              minHeight={120}
              label="In-Feed Discovery Slot"
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}
