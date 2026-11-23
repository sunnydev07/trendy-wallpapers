export type WallpaperSourceType = "original" | "ai_generated" | "official_press" | "licensed_stock";

export type DeviceType = "desktop" | "ultrawide" | "mobile" | "tablet";

export type AspectRatio = "16:9" | "21:9" | "9:16" | "4:3" | "32:9";

export type SourceFilterValue = "all" | "human" | "ai" | "press";

export type SortOption = "popular" | "newest" | "views";

export interface Wallpaper {
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
  /** Resolved thumbnail URL (CDN URL in live mode, data URI or API path in demo mode) */
  thumb_url: string;
  /** Optional preview URL (<= 1200px) for the detail stage; full 4K/8K goes through /api/download */
  preview_url: string;
  downloads_count: number;
  views_count: number;
  is_textless: boolean;
  is_oled_dark: boolean;
  attribution_text: string;
  is_published: boolean;
  created_at: string;
}

export interface WallpaperFilters {
  q?: string;
  category?: string;
  resolution?: string;
  device?: DeviceType | "all";
  source?: SourceFilterValue;
  color?: string;
  textless?: boolean;
  oled?: boolean;
  sort?: SortOption;
  /** 1-based gallery page. */
  page?: number;
  /** Bounded result size for internal queries such as related wallpapers. */
  limit?: number;
}

export interface WallpaperQueryResult {
  items: Wallpaper[];
  page: number;
  hasNextPage: boolean;
}

export interface CategoryInfo {
  slug: string;
  name: string;
  headline: string;
  description: string;
  editorialIntro: string;
  accentHex: string;
  keywords: string[];
}

export interface ResolutionInfo {
  slug: string;
  label: string;
  dimensions: string;
  aspectRatio: string;
  headline: string;
  description: string;
  editorialNote: string;
  minWidth: number;
  minHeight: number;
  targetDevice?: DeviceType;
}

export interface WallpaperCollection {
  slug: string;
  title: string;
  subtitle: string;
  curator: string;
  updatedAt: string;
  accentHex: string;
  commentary: string[]; // 300+ words of original editorial commentary
  /** Optional frame-by-frame curator notes; rendered beneath the pack grid when present. */
  editorialNotes?: { slug: string; note: string }[];
  wallpaperSlugs: string[];
  tags: string[];
}

export interface GuideMeta {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  updatedAt: string;
  author: string;
  readTime: string;
  category: string;
  accentHex: string;
  tags: string[];
}

export interface GuideArticle extends GuideMeta {
  content: string;
}

export interface AiStylePreset {
  id: string;
  name: string;
  tagline: string;
  promptSuffix: string;
  accentHex: string;
  categorySlug: string;
  isOledDark: boolean;
}

export interface AiGenerationRequest {
  prompt: string;
  stylePresetId: string;
  aspectRatio: "16:9" | "21:9" | "9:16" | "4:3";
  phoneClockMargin?: boolean;
  modelKey?: "flux-schnell" | "flux-2-flash";
}

export interface AiQuotaStatus {
  remaining: number;
  limit: number;
  isAuthenticated: boolean;
  dailyBudgetUsd: number;
  dailySpentUsd: number;
  budgetExhausted: boolean;
  mode: "live" | "demo";
}

export interface AiGenerationResult {
  wallpaper: Wallpaper;
  quota: AiQuotaStatus;
  modelUsed: string;
  estimatedCostUsd: number;
  mode: "live" | "demo";
}

export interface DmcaReportInput {
  wallpaperUrl: string;
  wallpaperId?: string;
  reporterName: string;
  reporterEmail: string;
  claimDetails: string;
  goodFaithConfirmed: boolean;
}

export interface DownloadFormatOption {
  format: "webp" | "png" | "jpg";
  label: string;
  hint: string;
}
