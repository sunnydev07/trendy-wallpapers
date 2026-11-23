import { cache } from "react";
import { unstable_cache } from "next/cache";
import type {
  CategoryInfo,
  DeviceType,
  ResolutionInfo,
  Wallpaper,
  WallpaperCollection,
  WallpaperFilters,
  WallpaperQueryResult,
  WallpaperSourceType,
} from "@/types/wallpaper";
import { isDemoMode } from "./env";
import { getR2PublicUrl } from "./r2";
import {
  CATEGORIES,
  COLLECTIONS,
  getDemoWallpapers,
  incrementDemoWallpaperViews,
  RESOLUTIONS,
} from "./seed-data";
import { getSupabaseAdminClient, getSupabasePublicClient } from "./supabase";

const CATALOG_REVALIDATE_SECONDS = 60;

/** Gallery pages show 24 cards; live queries fetch one extra row to detect a next page. */
export const GALLERY_PAGE_SIZE = 24;

/** Upper bound shared by the UI and the SQL function. */
export const MAX_SEARCH_LENGTH = 200;

const MAX_PAGE = 1000;
const MAX_INTERNAL_LIMIT = 50;
const SQL_BATCH_SIZE = 1000;

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

const KNOWN_DEVICES = new Set<string>(["desktop", "ultrawide", "mobile", "tablet"]);
const KNOWN_SOURCES = new Set<string>(["all", "human", "ai", "press"]);
const KNOWN_SORTS = new Set<string>(["popular", "newest", "views"]);

function normalizeHexColor(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const clean = raw.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return undefined;
  return `#${clean.toUpperCase()}`;
}

/**
 * One canonical filter shape for cache keys, demo filtering, and the SQL parameters.
 * Missing/unknown URL values become defaults, search text is trimmed and capped at the
 * shared 200-character maximum, and only positive integer pages/limits survive.
 */
export function normalizeWallpaperFilters(filters: WallpaperFilters = {}): WallpaperFilters {
  const q = typeof filters.q === "string" ? filters.q.trim().slice(0, MAX_SEARCH_LENGTH) : "";
  const category =
    typeof filters.category === "string" ? filters.category.trim().toLowerCase() : "";
  const resolution =
    typeof filters.resolution === "string" ? filters.resolution.trim().toLowerCase() : "";
  const device =
    typeof filters.device === "string" && KNOWN_DEVICES.has(filters.device)
      ? (filters.device as DeviceType)
      : "all";
  const source =
    typeof filters.source === "string" && KNOWN_SOURCES.has(filters.source)
      ? filters.source
      : "all";
  const sort =
    typeof filters.sort === "string" && KNOWN_SORTS.has(filters.sort) ? filters.sort : "popular";
  const page =
    typeof filters.page === "number" && Number.isInteger(filters.page) && filters.page > 0
      ? Math.min(filters.page, MAX_PAGE)
      : 1;
  const limit =
    typeof filters.limit === "number" && Number.isInteger(filters.limit) && filters.limit > 0
      ? Math.min(filters.limit, MAX_INTERNAL_LIMIT)
      : undefined;

  return {
    q: q || undefined,
    category: category && category !== "all" ? category : undefined,
    resolution: resolution && resolution !== "all" ? resolution : undefined,
    device,
    source,
    color: normalizeHexColor(filters.color),
    textless: filters.textless === true,
    oled: filters.oled === true,
    sort,
    page,
    limit,
  };
}

function compareIds(a: Wallpaper, b: Wallpaper): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function applyInMemoryFilters(
  items: Wallpaper[],
  filters: WallpaperFilters = {}
): Wallpaper[] {
  const normalized = normalizeWallpaperFilters(filters);
  let result = items.filter((item) => item.is_published);

  if (normalized.q) {
    const query = normalized.q.toLowerCase();
    result = result.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.category_slug.toLowerCase().includes(query) ||
        item.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }

  if (normalized.category) {
    const cat = normalized.category;
    result = result.filter(
      (item) =>
        item.category_slug === cat ||
        (cat === "ultrawide" && item.device_types.includes("ultrawide")) ||
        (cat === "mobile" && item.device_types.includes("mobile")) ||
        (cat === "minimalist-oled" && item.is_oled_dark)
    );
  }

  if (normalized.resolution) {
    const res = normalized.resolution;
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

  if (normalized.device && normalized.device !== "all") {
    result = result.filter((item) => item.device_types.includes(normalized.device as DeviceType));
  }

  if (normalized.source === "human") {
    result = result.filter(
      (item) =>
        item.source_type === "original" ||
        item.source_type === "official_press" ||
        item.source_type === "licensed_stock"
    );
  } else if (normalized.source === "ai") {
    result = result.filter((item) => item.source_type === "ai_generated");
  } else if (normalized.source === "press") {
    result = result.filter((item) => item.source_type === "official_press");
  }

  if (normalized.color) {
    const target = normalized.color;
    result = result.filter((item) => matchesColorHex(item.dominant_colors, target));
  }

  if (normalized.textless) result = result.filter((item) => item.is_textless);
  if (normalized.oled) result = result.filter((item) => item.is_oled_dark);

  const sort = normalized.sort ?? "popular";
  if (sort === "newest") {
    // Parse each timestamp once instead of inside the comparator.
    const timestamps = new Map(result.map((item) => [item.id, new Date(item.created_at).getTime()]));
    result.sort(
      (a, b) =>
        (timestamps.get(b.id) ?? 0) - (timestamps.get(a.id) ?? 0) || compareIds(a, b)
    );
  } else if (sort === "views") {
    result.sort((a, b) => b.views_count - a.views_count || compareIds(a, b));
  } else {
    result.sort((a, b) => b.downloads_count - a.downloads_count || compareIds(a, b));
  }

  if (normalized.limit) result = result.slice(0, normalized.limit);
  return result;
}

/** Deterministic primitive key so React `cache()` dedupes freshly built filter objects. */
export function filterCacheKey(filters: WallpaperFilters): string {
  return JSON.stringify(normalizeWallpaperFilters(filters));
}

/** Demo reads stay live (new generations must appear immediately); live reads are cached. */
const getCatalog = cache(
  async (): Promise<Wallpaper[]> => (isDemoMode() ? getDemoWallpapers() : [])
);

function toQueryResult(rows: Wallpaper[], page: number, pageSize: number): WallpaperQueryResult {
  return {
    items: rows.slice(0, pageSize),
    page,
    hasNextPage: rows.length > pageSize,
  };
}

function pageSizeOf(filters: WallpaperFilters): number {
  return filters.limit ?? GALLERY_PAGE_SIZE;
}

async function queryDemoCatalog(filters: WallpaperFilters): Promise<WallpaperQueryResult> {
  const page = filters.page ?? 1;
  const pageSize = pageSizeOf(filters);
  const all = await getCatalog();
  const filtered = applyInMemoryFilters(all, { ...filters, page: undefined, limit: undefined });
  const start = (page - 1) * pageSize;
  return toQueryResult(filtered.slice(start, start + pageSize + 1), page, pageSize);
}

async function queryLiveCatalog(filters: WallpaperFilters): Promise<WallpaperQueryResult> {
  const supabase = getSupabasePublicClient();
  if (!supabase) throw new Error("Supabase is not configured for public reads.");

  const page = filters.page ?? 1;
  const pageSize = pageSizeOf(filters);
  const offset = (page - 1) * pageSize;

  const { data, error } = await supabase.rpc("query_wallpapers", {
    p_q: filters.q ?? "",
    p_category: filters.category ?? null,
    p_resolution: filters.resolution ?? null,
    p_device: !filters.device || filters.device === "all" ? null : filters.device,
    p_source: !filters.source || filters.source === "all" ? null : filters.source,
    p_color: filters.color ?? null,
    p_textless: filters.textless === true,
    p_oled: filters.oled === true,
    p_sort: filters.sort ?? "popular",
    p_limit: pageSize + 1,
    p_offset: offset,
  });

  if (error) throw new Error(`Wallpaper query unavailable: ${error.message}`);
  return toQueryResult(
    ((data ?? []) as WallpaperDbRow[]).map(mapDbRowToWallpaper),
    page,
    pageSize
  );
}

/**
 * Only default page-1 listings are persistently cached. Arbitrary text/color/filter
 * combinations and deeper pages rely on per-render request deduplication so the
 * persistent cache keyspace cannot grow without bound.
 */
function isPersistentlyCacheable(filters: WallpaperFilters): boolean {
  return (
    (filters.page ?? 1) === 1 &&
    !filters.q &&
    !filters.color &&
    !filters.textless &&
    !filters.oled &&
    !filters.limit &&
    (filters.device ?? "all") === "all" &&
    (filters.source ?? "all") === "all" &&
    (filters.sort ?? "popular") === "popular"
  );
}

const cacheableListing = unstable_cache(
  async (key: string) => queryLiveCatalog(JSON.parse(key) as WallpaperFilters),
  ["wallpapers-listing"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["wallpapers"] }
);

const queryCatalog = cache(async (key: string): Promise<WallpaperQueryResult> => {
  const filters = JSON.parse(key) as WallpaperFilters;
  if (isDemoMode()) return queryDemoCatalog(filters);
  return isPersistentlyCacheable(filters) ? cacheableListing(key) : queryLiveCatalog(filters);
});

export async function queryWallpapers(
  filters: WallpaperFilters = {}
): Promise<WallpaperQueryResult> {
  return queryCatalog(filterCacheKey(filters));
}

const loadDemoWallpaperBySlug = cache(
  async (slug: string): Promise<Wallpaper | null> =>
    (await getCatalog()).find((wallpaper) => wallpaper.slug === slug) ?? null
);

const loadLiveWallpaperBySlug = unstable_cache(
  async (slug: string): Promise<Wallpaper | null> => {
    const supabase = getSupabasePublicClient();
    if (!supabase) throw new Error("Supabase is not configured for public reads.");
    const { data, error } = await supabase
      .from("wallpapers")
      .select("*")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (error) throw new Error(`Wallpaper lookup unavailable: ${error.message}`);
    return data ? mapDbRowToWallpaper(data as WallpaperDbRow) : null;
  },
  ["wallpaper-detail"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: ["wallpapers"] }
);

export const getWallpaperBySlug = cache(
  async (slug: string): Promise<Wallpaper | null> =>
    isDemoMode() ? loadDemoWallpaperBySlug(slug) : loadLiveWallpaperBySlug(slug)
);

async function fetchWallpapersBySlugs(slugs: string[]): Promise<Wallpaper[]> {
  if (slugs.length === 0) return [];
  if (isDemoMode()) {
    const bySlug = new Map((await getCatalog()).map((wallpaper) => [wallpaper.slug, wallpaper]));
    return slugs
      .map((slug) => bySlug.get(slug))
      .filter((item): item is Wallpaper => Boolean(item) && item!.is_published);
  }

  const supabase = getSupabasePublicClient();
  if (!supabase) throw new Error("Supabase is not configured for public reads.");
  const { data, error } = await supabase
    .from("wallpapers")
    .select("*")
    .in("slug", slugs)
    .eq("is_published", true);
  if (error) throw new Error(`Collection lookup unavailable: ${error.message}`);

  const bySlug = new Map(
    ((data ?? []) as WallpaperDbRow[]).map((row) => {
      const wallpaper = mapDbRowToWallpaper(row);
      return [wallpaper.slug, wallpaper] as const;
    })
  );
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((item): item is Wallpaper => Boolean(item));
}

export async function getRelatedWallpapers(wallpaper: Wallpaper, limit = 6): Promise<Wallpaper[]> {
  const candidates = (
    await queryWallpapers({ category: wallpaper.category_slug, limit: limit + 4 })
  ).items;
  const filtered = candidates.filter((item) => item.slug !== wallpaper.slug);
  if (filtered.length >= limit) return filtered.slice(0, limit);

  const fallback = (await queryWallpapers({ limit: limit + 4 })).items;
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

/**
 * Complete published-slug enumeration for the sitemap. The live path uses an ID cursor
 * in 1,000-row batches, so growth never truncates sitemap coverage at a snapshot cap.
 */
export const getAllPublishedWallpaperSlugs = cache(
  async (): Promise<{ slug: string; updatedAt: string }[]> => {
    if (isDemoMode()) {
      return (await getCatalog()).map((wallpaper) => ({
        slug: wallpaper.slug,
        updatedAt: wallpaper.created_at,
      }));
    }

    const supabase = getSupabasePublicClient();
    if (!supabase) throw new Error("Supabase is not configured for public reads.");

    const slugs: { slug: string; updatedAt: string }[] = [];
    let cursor: string | null = null;
    for (;;) {
      let query = supabase
        .from("wallpapers")
        .select("id,slug,created_at")
        .eq("is_published", true)
        .order("id", { ascending: true })
        .limit(SQL_BATCH_SIZE);
      if (cursor) query = query.gt("id", cursor);

      const { data, error } = await query;
      if (error) throw new Error(`Sitemap slug enumeration failed: ${error.message}`);
      const rows = (data ?? []) as { id: string; slug: string; created_at: string }[];
      for (const row of rows) slugs.push({ slug: row.slug, updatedAt: row.created_at });
      if (rows.length < SQL_BATCH_SIZE) break;
      cursor = rows[rows.length - 1].id;
    }
    return slugs;
  }
);

/**
 * Bounded popular subset for `generateStaticParams`. Every other published slug stays
 * dynamically resolvable instead of being omitted from the catalog.
 */
export const getPopularWallpaperSlugs = cache(
  async (limit = 100): Promise<{ slug: string }[]> => {
    if (isDemoMode()) {
      return (await getCatalog()).slice(0, Math.max(0, limit)).map((wallpaper) => ({
        slug: wallpaper.slug,
      }));
    }

    const supabase = getSupabasePublicClient();
    if (!supabase) throw new Error("Supabase is not configured for public reads.");
    const { data, error } = await supabase
      .from("wallpapers")
      .select("slug")
      .eq("is_published", true)
      .order("downloads_count", { ascending: false })
      .order("id", { ascending: true })
      .limit(Math.min(Math.max(1, limit), 500));
    if (error) throw new Error(`Static parameter enumeration failed: ${error.message}`);
    return ((data ?? []) as { slug: string }[]).map((row) => ({ slug: row.slug }));
  }
);

export async function incrementDownloadCount(wallpaperId: string): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  if (!admin) return false;
  const { error } = await admin.rpc("increment_wallpaper_downloads", { row_id: wallpaperId });
  return !error;
}

export async function incrementViewCount(wallpaperId: string): Promise<boolean> {
  if (isDemoMode()) return incrementDemoWallpaperViews(wallpaperId);

  const admin = getSupabaseAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.rpc("increment_wallpaper_views", { row_id: wallpaperId });
  if (error) return false;
  return data === true;
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

    const wallpapers = await fetchWallpapersBySlugs(collection.wallpaperSlugs);
    return { collection, wallpapers };
  }
);
