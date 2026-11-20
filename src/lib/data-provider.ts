import { cache } from "react";
import { unstable_cache } from "next/cache";
import type {
  CategoryInfo,
  DeviceType,
  ResolutionInfo,
  Wallpaper,
  WallpaperCollection,
  WallpaperFilters,
  WallpaperSourceType,
} from "@/types/wallpaper";
import { isDemoMode } from "./env";
import { getR2PublicUrl } from "./r2";
import { CATEGORIES, COLLECTIONS, getDemoWallpapers, RESOLUTIONS } from "./seed-data";
import { getSupabaseAdminClient, getSupabasePublicClient } from "./supabase";

/**
 * Public catalog snapshot window. Every filter is applied to this snapshot in memory so
 * demo and live mode return identical results, and no filter can be silently dropped by
 * database-side pagination.
 */
const CATALOG_LIMIT = 1000;
const CATALOG_REVALIDATE_SECONDS = 60;

interface WallpaperDbRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  source_type: WallpaperSourceType;
  category_slug: string;
  tags: string[];
  dominant_colors: string[];
  width: number;
  height: number;
  aspect_ratio: string;
  device_types: DeviceType[];
  r2_original_key: string;
  r2_thumb_key: string;
  downloads_count: number;
  views_count: number;
  is_textless: boolean;
  is_oled_dark: boolean;
  attribution_text: string;
  is_published: boolean;
  created_at: string;
}

function mapDbRowToWallpaper(row: WallpaperDbRow): Wallpaper {
  return {
    ...row,
    thumb_url: getR2PublicUrl(row.r2_thumb_key),
    // Detail stage uses a bounded preview; full 4K/8K goes through /api/download.
    preview_url: `/api/download?slug=${encodeURIComponent(row.slug)}&w=1200&format=webp&preview=1`,
  };
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function matchesColorHex(colors: string[], targetHex: string): boolean {
  const target = hexToRgb(targetHex);
  if (!target) return true;

  return colors.some((candidate) => {
    const rgb = hexToRgb(candidate);
    if (!rgb) return false;
    const dr = rgb[0] - target[0];
    const dg = rgb[1] - target[1];
    const db = rgb[2] - target[2];
    return dr * dr + dg * dg + db * db <= 85 * 85;
  });
}

export function applyInMemoryFilters(
  items: Wallpaper[],
  filters: WallpaperFilters = {}
): Wallpaper[] {
  let result = items.filter((item) => item.is_published);

  if (filters.q && filters.q.trim()) {
    const query = filters.q.trim().toLowerCase();
    result = result.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.category_slug.toLowerCase().includes(query) ||
        item.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }

  if (filters.category && filters.category !== "all") {
    const cat = filters.category.toLowerCase();
    result = result.filter(
      (item) =>
        item.category_slug === cat ||
        (cat === "ultrawide" && item.device_types.includes("ultrawide")) ||
        (cat === "mobile" && item.device_types.includes("mobile")) ||
        (cat === "minimalist-oled" && item.is_oled_dark)
    );
  }

  if (filters.resolution) {
    const res = filters.resolution.toLowerCase();
    if (res === "4k") {
      result = result.filter((item) => item.width >= 3840 && item.aspect_ratio === "16:9");
    } else if (res === "ultrawide") {
      result = result.filter(
        (item) => item.aspect_ratio === "21:9" || item.device_types.includes("ultrawide")
      );
    } else if (res === "mobile") {
      result = result.filter(
        (item) => item.aspect_ratio === "9:16" || item.device_types.includes("mobile")
      );
    } else if (res === "dual-monitor") {
      result = result.filter((item) => item.aspect_ratio === "32:9" || item.width >= 3440);
    } else if (res === "oled") {
      result = result.filter((item) => item.is_oled_dark);
    }
  }

  if (filters.device && filters.device !== "all") {
    result = result.filter((item) => item.device_types.includes(filters.device as DeviceType));
  }

  if (filters.source === "human") {
    result = result.filter(
      (item) =>
        item.source_type === "original" ||
        item.source_type === "official_press" ||
        item.source_type === "licensed_stock"
    );
  } else if (filters.source === "ai") {
    result = result.filter((item) => item.source_type === "ai_generated");
  }

  if (filters.color) {
    result = result.filter((item) => matchesColorHex(item.dominant_colors, filters.color!));
  }

  if (filters.textless) result = result.filter((item) => item.is_textless);
  if (filters.oled) result = result.filter((item) => item.is_oled_dark);

  const sort = filters.sort ?? "popular";
  if (sort === "newest") {
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } else if (sort === "views") {
    result.sort((a, b) => b.views_count - a.views_count);
  } else {
    result.sort((a, b) => b.downloads_count - a.downloads_count);
  }

  if (filters.limit && filters.limit > 0) result = result.slice(0, filters.limit);
  return result;
}

/** Stable primitive key so React `cache()` dedupes freshly built filter objects. */
export function filterCacheKey(filters: WallpaperFilters): string {
  return Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");
}

const loadLiveCatalog = unstable_cache(
  async (): Promise<Wallpaper[]> => {
    const supabase = getSupabasePublicClient();
    if (!supabase) throw new Error("Supabase is not configured for public reads.");

    const { data, error } = await supabase
      .from("wallpapers")
      .select("*")
      .eq("is_published", true)
      .order("downloads_count", { ascending: false })
      .limit(CATALOG_LIMIT);

    if (error) throw new Error(`Wallpaper catalog unavailable: ${error.message}`);
    return (data as WallpaperDbRow[]).map(mapDbRowToWallpaper);
  },
  ["wallpapers-catalog"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["wallpapers"] }
);

/** Demo reads stay live (new generations must appear immediately); live reads are cached. */
const getCatalog = cache(async (): Promise<Wallpaper[]> =>
  isDemoMode() ? getDemoWallpapers() : loadLiveCatalog()
);

const queryCatalog = cache(async (key: string, filters: WallpaperFilters) =>
  applyInMemoryFilters(await getCatalog(), filters)
);

export async function queryWallpapers(filters: WallpaperFilters = {}): Promise<Wallpaper[]> {
  return queryCatalog(filterCacheKey(filters), filters);
}

export const getWallpaperBySlug = cache(async (slug: string): Promise<Wallpaper | null> => {
  const catalog = await getCatalog();
  return catalog.find((wallpaper) => wallpaper.slug === slug) ?? null;
});

export async function getRelatedWallpapers(wallpaper: Wallpaper, limit = 6): Promise<Wallpaper[]> {
  const candidates = await queryWallpapers({ category: wallpaper.category_slug, limit: limit + 4 });
  const filtered = candidates.filter((item) => item.slug !== wallpaper.slug);
  if (filtered.length >= limit) return filtered.slice(0, limit);

  const fallback = await queryWallpapers({ limit: limit + 4 });
  const existing = new Set([wallpaper.slug, ...filtered.map((item) => item.slug)]);
  for (const item of fallback) {
    if (!existing.has(item.slug)) {
      filtered.push(item);
      existing.add(item.slug);
      if (filtered.length >= limit) break;
    }
  }
  return filtered;
}

export const getAllPublishedWallpaperSlugs = cache(
  async (): Promise<{ slug: string; updatedAt: string }[]> => {
    const catalog = await getCatalog();
    return catalog.map((wallpaper) => ({
      slug: wallpaper.slug,
      updatedAt: wallpaper.created_at,
    }));
  }
);

export async function incrementDownloadCount(wallpaperId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  await admin.rpc("increment_wallpaper_downloads", { row_id: wallpaperId });
}

export function getAllCategories(): CategoryInfo[] {
  return CATEGORIES;
}

export function getCategoryBySlug(slug: string): CategoryInfo | null {
  return CATEGORIES.find((category) => category.slug === slug) ?? null;
}

export function getAllResolutions(): ResolutionInfo[] {
  return RESOLUTIONS;
}

export function getResolutionBySlug(slug: string): ResolutionInfo | null {
  return RESOLUTIONS.find((resolution) => resolution.slug === slug) ?? null;
}

export function getAllCollections(): WallpaperCollection[] {
  return COLLECTIONS;
}

export const getCollectionBySlug = cache(
  async (slug: string): Promise<{ collection: WallpaperCollection; wallpapers: Wallpaper[] } | null> => {
    const collection = COLLECTIONS.find((item) => item.slug === slug);
    if (!collection) return null;

    const bySlug = new Map((await getCatalog()).map((wallpaper) => [wallpaper.slug, wallpaper]));
    const wallpapers = collection.wallpaperSlugs
      .map((item) => bySlug.get(item))
      .filter((item): item is Wallpaper => Boolean(item));

    return { collection, wallpapers };
  }
);
