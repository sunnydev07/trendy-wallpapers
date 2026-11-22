"use client";

import {
  Check,
  Monitor,
  Moon,
  RotateCcw,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Type,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useOptimistic, useRef, useTransition } from "react";
import type { DeviceType, SortOption, SourceFilterValue } from "@/types/wallpaper";

const COLOR_SWATCHES = [
  { hex: "#FF2E93", label: "Vice Magenta" },
  { hex: "#00F0FF", label: "Electric Cyan" },
  { hex: "#000000", label: "True OLED Black" },
  { hex: "#7C3AED", label: "Ultraviolet" },
  { hex: "#10B981", label: "Aurora Emerald" },
  { hex: "#F97316", label: "Sunset Coral" },
];

const SOURCE_OPTIONS: { value: SourceFilterValue; label: string }[] = [
  { value: "all", label: "All Sources" },
  { value: "human", label: "Human & Licensed" },
  { value: "ai", label: "AI Generated" },
];

const DEVICE_OPTIONS: { value: DeviceType | "all"; label: string }[] = [
  { value: "all", label: "All Devices" },
  { value: "desktop", label: "Desktop 16:9" },
  { value: "ultrawide", label: "Ultrawide 21:9" },
  { value: "mobile", label: "Mobile 9:16" },
];

export function updateFilterQuery(
  query: string,
  key: string,
  value: string | null,
  toggle = false
): string {
  const next = new URLSearchParams(query);
  const alreadySelected = toggle && next.get(key)?.toLowerCase() === value?.toLowerCase();
  if (!value || value === "all" || value === "0" || alreadySelected) {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  // Any changed filter/search/sort invalidates the current result page.
  if (key !== "page") next.delete("page");
  return next.toString();
}

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [isPending, startTransition] = useTransition();
  const [optimisticQuery, setOptimisticQuery] = useOptimistic(query);
  const pendingQuery = useRef(query);

  useEffect(() => {
    // Do not overwrite rapid edits with an intermediate navigation's URL.
    if (!isPending) pendingQuery.current = query;
  }, [query, pathname, isPending]);

  useEffect(() => {
    // Back/forward replaces the edit base, including during an in-flight filter change.
    const restoreHistoryQuery = () => {
      pendingQuery.current = new URLSearchParams(window.location.search).toString();
    };
    window.addEventListener("popstate", restoreHistoryQuery);
    return () => window.removeEventListener("popstate", restoreHistoryQuery);
  }, []);

  const activeParams = new URLSearchParams(optimisticQuery);
  const currentDevice = (activeParams.get("device") as DeviceType | "all") ?? "all";
  const currentSource = (activeParams.get("source") as SourceFilterValue) ?? "all";
  const currentColor = activeParams.get("color") ?? "";
  const currentTextless = activeParams.get("textless") === "1";
  const currentOled = activeParams.get("oled") === "1";
  const currentSort = (activeParams.get("sort") as SortOption) ?? "popular";

  const hasActiveFilters =
    currentDevice !== "all" ||
    currentSource !== "all" ||
    Boolean(currentColor) ||
    currentTextless ||
    currentOled ||
    currentSort !== "popular" ||
    Boolean(activeParams.get("q")) ||
    Boolean(activeParams.get("page"));

  const navigate = useCallback(
    (nextQuery: string) => {
      if (nextQuery === pendingQuery.current) return;
      // Synchronous accumulation also covers clicks before React renders again.
      pendingQuery.current = nextQuery;
      startTransition(() => {
        setOptimisticQuery(nextQuery);
        router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
      });
    },
    [pathname, router, setOptimisticQuery]
  );

  const updateParam = useCallback(
    (key: string, value: string | null, toggle = false) => {
      navigate(updateFilterQuery(pendingQuery.current, key, value, toggle));
    },
    [navigate]
  );

  return (
    <section
      aria-label="Wallpaper filters"
      className="glass-surface rounded-2xl p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Strict AI Transparency Filter Pill */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-[#FF2E93]" />
            Source
          </span>
          <div className="inline-flex max-w-full flex-wrap rounded-xl border border-white/10 bg-black/40 p-1">
            {SOURCE_OPTIONS.map((opt) => {
              const active = currentSource === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => updateParam("source", opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-gradient-to-r from-[#FF2E93] to-fuchsia-600 text-white shadow-sm"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Device Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {DEVICE_OPTIONS.map((opt) => {
            const active = currentDevice === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => updateParam("device", opt.value)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "border-[#00F0FF]/50 bg-[#00F0FF]/15 text-cyan-100"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:text-white"
                }`}
              >
                {opt.value === "mobile" ? (
                  <Smartphone className="h-3.5 w-3.5" />
                ) : (
                  <Monitor className="h-3.5 w-3.5" />
                )}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4 border-t border-white/[0.08] pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {/* Color Swatches */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-medium text-slate-400">Color:</span>
          <div className="flex items-center gap-2">
            {COLOR_SWATCHES.map((swatch) => {
              const active = currentColor.toUpperCase() === swatch.hex.toUpperCase();
              return (
                <button
                  key={swatch.hex}
                  type="button"
                  title={swatch.label}
                  aria-label={`Filter by ${swatch.label}`}
                  aria-pressed={active}
                  onClick={() => updateParam("color", swatch.hex, true)}
                  className={`relative flex h-6 w-6 items-center justify-center rounded-full border transition ${
                    active
                      ? "scale-110 border-white ring-2 ring-[#00F0FF]/60"
                      : "border-white/25 hover:scale-110"
                  }`}
                  style={{ backgroundColor: swatch.hex }}
                >
                  {active && <Check className="h-3 w-3 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Attribute Toggles + Sort */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={currentTextless}
            onClick={() => updateParam("textless", "1", true)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
              currentTextless
                ? "border-[#00F0FF]/50 bg-[#00F0FF]/15 text-cyan-100"
                : "border-white/10 bg-white/[0.03] text-slate-300 hover:text-white"
            }`}
          >
            <Type className="h-3.5 w-3.5" />
            Textless Only
          </button>

          <button
            type="button"
            aria-pressed={currentOled}
            onClick={() => updateParam("oled", "1", true)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
              currentOled
                ? "border-purple-400/50 bg-purple-500/20 text-purple-100"
                : "border-white/10 bg-white/[0.03] text-slate-300 hover:text-white"
            }`}
          >
            <Moon className="h-3.5 w-3.5" />
            True OLED Dark
          </button>

          <div className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 px-2.5 py-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
            <select
              aria-label="Sort wallpapers"
              value={currentSort}
              onChange={(e) => updateParam("sort", e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-200 focus:outline-none"
            >
              <option value="popular" className="bg-[#0B0D12]">
                Most Downloaded
              </option>
              <option value="newest" className="bg-[#0B0D12]">
                Newest First
              </option>
              <option value="views" className="bg-[#0B0D12]">
                Most Viewed
              </option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => navigate("")}
            disabled={!hasActiveFilters}
            className={`inline-flex items-center gap-1 rounded-xl border border-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-white/25 hover:text-white ${hasActiveFilters ? "" : "invisible"}`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>
      <p role="status" aria-live="polite" aria-atomic="true" className="mt-3 h-4 text-xs text-slate-400">
        {isPending ? "Updating wallpapers..." : ""}
      </p>
    </section>
  );
}
