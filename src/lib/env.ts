/**
 * Validated environment helpers and feature-flag detection for live vs demo mode.
 * Safe to import from server code; client-safe public getters are clearly separated.
 */

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export function getAdSenseClientId(): string | null {
  const id = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();
  return id && id.startsWith("ca-pub-") ? id : null;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim() &&
      process.env.R2_BUCKET_NAME?.trim() &&
      process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim()
  );
}

export function isRedisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
      process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  );
}

export function isFalConfigured(): boolean {
  return Boolean(process.env.FAL_KEY?.trim());
}

export function isDemoMode(): boolean {
  return !isSupabaseConfigured();
}

export function getDailyAiBudgetUsd(): number {
  const parsed = Number.parseFloat(process.env.DAILY_AI_BUDGET_USD ?? "5.00");
  if (!Number.isFinite(parsed) || parsed <= 0) return 5.0;
  return parsed;
}

export function getAdminUploadSecret(): string | null {
  const secret = process.env.ADMIN_UPLOAD_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
}

export function getR2PublicBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim() ?? "";
  return base.replace(/\/+$/, "");
}
