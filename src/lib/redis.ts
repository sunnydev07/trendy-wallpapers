import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import crypto from "node:crypto";
import type { AiQuotaStatus } from "@/types/wallpaper";
import { getDailyAiBudgetUsd, isRedisConfigured } from "./env";

export const ANON_DAILY_LIMIT = 2;
export const AUTH_DAILY_LIMIT = 5;
export const FLUX_SCHNELL_COST_USD = 0.003;
export const FLUX_FLASH_COST_USD = 0.006;

let redisSingleton: Redis | null = null;
let anonLimiterSingleton: Ratelimit | null = null;
let authLimiterSingleton: Ratelimit | null = null;

// In-memory demo fallback so local development mirrors production quota UX accurately
const demoUsageMap = new Map<string, { count: number; date: string }>();
const demoSpendMap = new Map<string, number>();

function getUtcDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDailySpendKey(): string {
  return `tw:ai:daily_spend_usd:${getUtcDateKey()}`;
}

export function hashClientIp(rawIp: string): string {
  const salt = process.env.IP_HASH_SALT?.trim() || "trendy-wallpapers-v1-salt";
  return crypto
    .createHash("sha256")
    .update(`${salt}:${rawIp}`)
    .digest("hex")
    .slice(0, 32);
}

export function getRedisClient(): Redis | null {
  if (!isRedisConfigured()) return null;
  if (redisSingleton) return redisSingleton;

  redisSingleton = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    // A fresh 3s deadline per command so a stalled Upstash call can never hang a request.
    signal: () => AbortSignal.timeout(3000),
    retry: {
      retries: 1,
      backoff: () => 0,
    },
  });
  return redisSingleton;
}

function getRateLimiter(isAuthenticated: boolean): Ratelimit | null {
  const redis = getRedisClient();
  if (!redis) return null;

  if (isAuthenticated) {
    if (!authLimiterSingleton) {
      authLimiterSingleton = new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(AUTH_DAILY_LIMIT, "24 h"),
        prefix: "tw:rl:ai:auth",
      });
    }
    return authLimiterSingleton;
  }

  if (!anonLimiterSingleton) {
    anonLimiterSingleton = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(ANON_DAILY_LIMIT, "24 h"),
      prefix: "tw:rl:ai:anon",
    });
  }
  return anonLimiterSingleton;
}

export async function getDailyAiSpendUsd(): Promise<number> {
  const redis = getRedisClient();
  const key = getDailySpendKey();

  if (!redis) {
    return demoSpendMap.get(key) ?? 0;
  }

  let raw: number | string | null;
  try {
    raw = await redis.get<number | string>(key);
  } catch {
    throw new Error("Quota storage unavailable.");
  }
  const val = typeof raw === "number" ? raw : Number.parseFloat(raw ?? "0");
  return Number.isFinite(val) ? val : 0;
}

export async function incrementDailyAiSpendUsd(amountUsd: number): Promise<number> {
  const redis = getRedisClient();
  const key = getDailySpendKey();

  if (!redis) {
    const next = Number(((demoSpendMap.get(key) ?? 0) + amountUsd).toFixed(5));
    demoSpendMap.set(key, next);
    return next;
  }

  const next = await redis.incrbyfloat(key, amountUsd);
  // Expire daily spend counter after 48 hours so keys self-clean
  await redis.expire(key, 60 * 60 * 48);
  return Number(next);
}

export async function getAiQuotaStatus(
  identifier: string,
  isAuthenticated: boolean
): Promise<AiQuotaStatus> {
  const limit = isAuthenticated ? AUTH_DAILY_LIMIT : ANON_DAILY_LIMIT;
  const dailyBudgetUsd = getDailyAiBudgetUsd();
  const dailySpentUsd = await getDailyAiSpendUsd();
  const budgetExhausted = dailySpentUsd >= dailyBudgetUsd;

  const redis = getRedisClient();
  if (!redis) {
    const today = getUtcDateKey();
    const record = demoUsageMap.get(identifier);
    const used = record && record.date === today ? record.count : 0;
    return {
      remaining: Math.max(0, limit - used),
      limit,
      isAuthenticated,
      dailyBudgetUsd,
      dailySpentUsd: Number(dailySpentUsd.toFixed(4)),
      budgetExhausted,
      mode: "demo",
    };
  }

  const limiter = getRateLimiter(isAuthenticated);
  const remainingInfo = limiter ? await limiter.getRemaining(identifier) : { remaining: limit };

  return {
    remaining: Math.max(0, remainingInfo.remaining),
    limit,
    isAuthenticated,
    dailyBudgetUsd,
    dailySpentUsd: Number(dailySpentUsd.toFixed(4)),
    budgetExhausted,
    mode: "live",
  };
}

export interface ConsumeQuotaResult {
  allowed: boolean;
  reason?: "rate_limited" | "budget_exhausted" | "quota_unavailable";
  quota: AiQuotaStatus;
}

/**
 * Reserves the daily USD spend atomically, then consumes one generation slot.
 * A denied or unavailable rate-limit check refunds the reservation so quota storage
 * failures can never silently permit a paid generation.
 */
export async function consumeAiQuota(
  identifier: string,
  isAuthenticated: boolean,
  estimatedCostUsd: number
): Promise<ConsumeQuotaResult> {
  const limit = isAuthenticated ? AUTH_DAILY_LIMIT : ANON_DAILY_LIMIT;
  const dailyBudgetUsd = getDailyAiBudgetUsd();
  const redis = getRedisClient();

  if (!redis) {
    const today = getUtcDateKey();
    const currentSpend = await getDailyAiSpendUsd();
    if (currentSpend + estimatedCostUsd > dailyBudgetUsd) {
      const status = await getAiQuotaStatus(identifier, isAuthenticated);
      return { allowed: false, reason: "budget_exhausted", quota: { ...status, budgetExhausted: true } };
    }

    const record = demoUsageMap.get(identifier);
    const used = record && record.date === today ? record.count : 0;
    if (used >= limit) {
      return {
        allowed: false,
        reason: "rate_limited",
        quota: {
          remaining: 0,
          limit,
          isAuthenticated,
          dailyBudgetUsd,
          dailySpentUsd: Number(currentSpend.toFixed(4)),
          budgetExhausted: false,
          mode: "demo",
        },
      };
    }

    demoUsageMap.set(identifier, { count: used + 1, date: today });
    const nextSpend = await incrementDailyAiSpendUsd(estimatedCostUsd);
    return {
      allowed: true,
      quota: {
        remaining: Math.max(0, limit - (used + 1)),
        limit,
        isAuthenticated,
        dailyBudgetUsd,
        dailySpentUsd: Number(nextSpend.toFixed(4)),
        budgetExhausted: nextSpend >= dailyBudgetUsd,
        mode: "demo",
      },
    };
  }

  // Atomic reservation: increment first, roll back when the cap would be crossed.
  const spendKey = getDailySpendKey();
  const reservedSpend = Number(await redis.incrbyfloat(spendKey, estimatedCostUsd));
  await redis.expire(spendKey, 60 * 60 * 48);
  if (reservedSpend > dailyBudgetUsd) {
    await redis.incrbyfloat(spendKey, -estimatedCostUsd);
    const status = await getAiQuotaStatus(identifier, isAuthenticated);
    return { allowed: false, reason: "budget_exhausted", quota: { ...status, budgetExhausted: true } };
  }

  const limiter = getRateLimiter(isAuthenticated);
  if (!limiter) {
    await redis.incrbyfloat(spendKey, -estimatedCostUsd);
    return { allowed: false, reason: "quota_unavailable", quota: await getAiQuotaStatus(identifier, isAuthenticated) };
  }

  const result = await limiter.limit(identifier);
  // Upstash reports timeout with success: true; that must never grant paid work.
  if (result.reason === "timeout") {
    await redis.incrbyfloat(spendKey, -estimatedCostUsd);
    return { allowed: false, reason: "quota_unavailable", quota: await getAiQuotaStatus(identifier, isAuthenticated) };
  }

  if (!result.success) {
    await redis.incrbyfloat(spendKey, -estimatedCostUsd);
    return {
      allowed: false,
      reason: "rate_limited",
      quota: {
        remaining: 0,
        limit,
        isAuthenticated,
        dailyBudgetUsd,
        dailySpentUsd: Number((reservedSpend - estimatedCostUsd).toFixed(4)),
        budgetExhausted: false,
        mode: "live",
      },
    };
  }

  return {
    allowed: true,
    quota: {
      remaining: Math.max(0, result.remaining),
      limit,
      isAuthenticated,
      dailyBudgetUsd,
      dailySpentUsd: Number(reservedSpend.toFixed(4)),
      budgetExhausted: reservedSpend >= dailyBudgetUsd,
      mode: "live",
    },
  };
}

/**
 * Per-IP budget for uncached image renders. Cache hits and 304s bypass this so
 * legitimate browsing is never throttled; only fresh Sharp work is rate-limited.
 */
export const DOWNLOAD_RENDER_LIMIT = 20;
const demoDownloadMap = new Map<string, { count: number; window: number }>();
let downloadLimiterSingleton: Ratelimit | null = null;

function getDownloadLimiter(): Ratelimit | null {
  const redis = getRedisClient();
  if (!redis) return null;
  if (!downloadLimiterSingleton) {
    downloadLimiterSingleton = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(DOWNLOAD_RENDER_LIMIT, "60 s"),
      prefix: "tw:rl:download",
    });
  }
  return downloadLimiterSingleton;
}

export async function limitDownloadRequests(
  identifier: string
): Promise<{ allowed: boolean; remaining: number }> {
  const limiter = getDownloadLimiter();
  if (!limiter) {
    const window = Math.floor(Date.now() / 60_000);
    const record = demoDownloadMap.get(identifier);
    const count = record && record.window === window ? record.count : 0;
    if (count >= DOWNLOAD_RENDER_LIMIT) return { allowed: false, remaining: 0 };
    demoDownloadMap.set(identifier, { count: count + 1, window });
    return { allowed: true, remaining: DOWNLOAD_RENDER_LIMIT - count - 1 };
  }
  const result = await limiter.limit(identifier);
  // A storage timeout must not silently permit unlimited paid compute.
  if (result.reason === "timeout") return { allowed: false, remaining: 0 };
  return { allowed: result.success, remaining: Math.max(0, result.remaining) };
}
