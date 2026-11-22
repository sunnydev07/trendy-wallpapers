import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import crypto from "node:crypto";
import type { AiQuotaStatus } from "@/types/wallpaper";
import { getDailyAiBudgetUsd, isRedisConfigured } from "./env";

export const ANON_DAILY_LIMIT = 2;
export const AUTH_DAILY_LIMIT = 5;
export const FLUX_SCHNELL_COST_USD = 0.003;
export const FLUX_FLASH_COST_USD = 0.006;

/**
 * Quota spend is stored in integer units (1/100000 USD) so Redis INCR semantics,
 * Lua arithmetic, and `Promise.all` concurrency fixtures never compare floats.
 */
export const QUOTA_UNITS_PER_USD = 100_000;

/** Demo-map ceiling: expired entries are swept first, then new identities are denied. */
export const DEMO_IDENTITY_MAP_CAP = 10_000;

const QUOTA_KEY_TTL_SECONDS = 60 * 60 * 48;

let redisSingleton: Redis | null = null;

// In-memory demo fallback so local development mirrors production quota UX accurately.
const demoUsageMap = new Map<string, { count: number; date: string }>();
let demoSpendUnits = 0;
let demoSpendDate = "";

function getUtcDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDailySpendKey(date = getUtcDateKey()): string {
  return `tw:ai:spend_units:v2:${date}`;
}

function getDailyUsageKey(identifier: string, date = getUtcDateKey()): string {
  return `tw:ai:usage_units:v2:${date}:${identifier}`;
}

export function usdToQuotaUnits(amountUsd: number): number {
  if (!Number.isFinite(amountUsd) || amountUsd < 0) {
    throw new Error("Invalid quota amount.");
  }
  return Math.round(amountUsd * QUOTA_UNITS_PER_USD);
}

function unitsToUsd(units: number): number {
  return Number((units / QUOTA_UNITS_PER_USD).toFixed(5));
}

/** Returns null for missing, malformed, fractional, or negative counter values. */
function parseUnits(raw: unknown): number | null {
  if (raw === null || raw === undefined) return 0;
  const value = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

/**
 * Demo state is process-local by design (no shared storage in demo mode), but it still
 * uses one read-check-reserve step that never awaits, so concurrent demo requests cannot
 * both take the last slot.
 */
function syncDemoSpend(): number {
  const today = getUtcDateKey();
  if (demoSpendDate !== today) {
    demoSpendDate = today;
    demoSpendUnits = 0;
  }
  return demoSpendUnits;
}

function demoStatus(identifier: string, isAuthenticated: boolean): AiQuotaStatus {
  const limit = isAuthenticated ? AUTH_DAILY_LIMIT : ANON_DAILY_LIMIT;
  const dailyBudgetUsd = getDailyAiBudgetUsd();
  const spendUnits = syncDemoSpend();
  const today = getUtcDateKey();
  const record = demoUsageMap.get(identifier);
  const used = record && record.date === today ? record.count : 0;
  return {
    remaining: Math.max(0, limit - used),
    limit,
    isAuthenticated,
    dailyBudgetUsd,
    dailySpentUsd: unitsToUsd(spendUnits),
    budgetExhausted: spendUnits >= usdToQuotaUnits(dailyBudgetUsd),
    mode: "demo",
  };
}

function liveUnavailableStatus(isAuthenticated: boolean): AiQuotaStatus {
  return {
    remaining: 0,
    limit: isAuthenticated ? AUTH_DAILY_LIMIT : ANON_DAILY_LIMIT,
    isAuthenticated,
    dailyBudgetUsd: getDailyAiBudgetUsd(),
    dailySpentUsd: 0,
    budgetExhausted: false,
    mode: "live",
  };
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

/**
 * One Lua evaluation validates both counters, checks the per-identity limit and the
 * daily budget, and only then increments both. Denied attempts write nothing, so there
 * is no reserve-then-refund window that a concurrent request can observe.
 */
const RESERVE_QUOTA_SCRIPT = `
local spendRaw = redis.call('GET', KEYS[1])
local usageRaw = redis.call('GET', KEYS[2])
local cost = tonumber(ARGV[1])
local budget = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
if not cost or not budget or not limit or not ttl then return {0, 0, 0} end
local spend = 0
local usage = 0
if spendRaw then spend = tonumber(spendRaw) end
if usageRaw then usage = tonumber(usageRaw) end
if not spend or not usage then return {0, 0, 0} end
if spend < 0 or usage < 0 or spend % 1 ~= 0 or usage % 1 ~= 0 then return {0, 0, 0} end
if usage + 1 > limit then return {2, spend, usage} end
if spend + cost > budget then return {3, spend, usage} end
local newSpend = spend + cost
local newUsage = usage + 1
redis.call('SET', KEYS[1], newSpend, 'EX', ttl)
redis.call('SET', KEYS[2], newUsage, 'EX', ttl)
return {1, newSpend, newUsage}
`;

export async function getDailyAiSpendUsd(): Promise<number> {
  const redis = getRedisClient();
  if (!redis) return unitsToUsd(syncDemoSpend());

  let raw: unknown;
  try {
    raw = await redis.get(getDailySpendKey());
  } catch {
    throw new Error("Quota storage unavailable.");
  }
  const units = parseUnits(raw);
  if (units === null) throw new Error("Quota storage returned an invalid spend value.");
  return unitsToUsd(units);
}

export async function getAiQuotaStatus(
  identifier: string,
  isAuthenticated: boolean
): Promise<AiQuotaStatus> {
  const limit = isAuthenticated ? AUTH_DAILY_LIMIT : ANON_DAILY_LIMIT;
  const dailyBudgetUsd = getDailyAiBudgetUsd();
  const budgetUnits = usdToQuotaUnits(dailyBudgetUsd);
  const redis = getRedisClient();

  if (!redis) return demoStatus(identifier, isAuthenticated);

  let rawSpend: unknown;
  let rawUsage: unknown;
  try {
    [rawSpend, rawUsage] = await redis.mget(getDailySpendKey(), getDailyUsageKey(identifier));
  } catch {
    throw new Error("Quota storage unavailable.");
  }

  const spendUnits = parseUnits(rawSpend);
  const usageUnits = parseUnits(rawUsage);
  if (spendUnits === null || usageUnits === null) {
    throw new Error("Quota storage returned an invalid counter value.");
  }

  return {
    remaining: Math.max(0, limit - usageUnits),
    limit,
    isAuthenticated,
    dailyBudgetUsd,
    dailySpentUsd: unitsToUsd(spendUnits),
    budgetExhausted: spendUnits >= budgetUnits,
    mode: "live",
  };
}

export interface ConsumeQuotaResult {
  allowed: boolean;
  reason?: "rate_limited" | "budget_exhausted" | "quota_unavailable";
  quota: AiQuotaStatus;
}

/**
 * Reserves one generation slot and its estimated spend in a single atomic evaluation.
 * A missing or ambiguous distributed store fails closed: paid work must never fall back
 * to process-local accounting across multiple instances.
 */
export async function consumeAiQuota(
  identifier: string,
  isAuthenticated: boolean,
  estimatedCostUsd: number
): Promise<ConsumeQuotaResult> {
  const limit = isAuthenticated ? AUTH_DAILY_LIMIT : ANON_DAILY_LIMIT;
  const dailyBudgetUsd = getDailyAiBudgetUsd();
  const budgetUnits = usdToQuotaUnits(dailyBudgetUsd);
  const costUnits = usdToQuotaUnits(estimatedCostUsd);
  const redis = getRedisClient();

  if (!redis) {
    const spendUnits = syncDemoSpend();
    const today = getUtcDateKey();
    const record = demoUsageMap.get(identifier);
    const used = record && record.date === today ? record.count : 0;

    if (used >= limit) {
      return {
        allowed: false,
        reason: "rate_limited",
        quota: { ...demoStatus(identifier, isAuthenticated), remaining: 0, budgetExhausted: false },
      };
    }
    if (spendUnits + costUnits > budgetUnits) {
      return {
        allowed: false,
        reason: "budget_exhausted",
        quota: { ...demoStatus(identifier, isAuthenticated), budgetExhausted: true },
      };
    }

    demoUsageMap.set(identifier, { count: used + 1, date: today });
    demoSpendUnits = spendUnits + costUnits;
    demoSpendDate = today;

    return {
      allowed: true,
      quota: {
        remaining: Math.max(0, limit - (used + 1)),
        limit,
        isAuthenticated,
        dailyBudgetUsd,
        dailySpentUsd: unitsToUsd(demoSpendUnits),
        budgetExhausted: demoSpendUnits >= budgetUnits,
        mode: "demo",
      },
    };
  }

  let raw: unknown;
  try {
    raw = await redis.eval(
      RESERVE_QUOTA_SCRIPT,
      [getDailySpendKey(), getDailyUsageKey(identifier)],
      [String(costUnits), String(budgetUnits), String(limit), String(QUOTA_KEY_TTL_SECONDS)]
    );
  } catch {
    return {
      allowed: false,
      reason: "quota_unavailable",
      quota: liveUnavailableStatus(isAuthenticated),
    };
  }

  if (!Array.isArray(raw) || raw.length !== 3) {
    return {
      allowed: false,
      reason: "quota_unavailable",
      quota: liveUnavailableStatus(isAuthenticated),
    };
  }
  const [code, spendUnits, usageUnits] = raw.map((value) => Number(value));
  if (![code, spendUnits, usageUnits].every((value) => Number.isSafeInteger(value))) {
    return {
      allowed: false,
      reason: "quota_unavailable",
      quota: liveUnavailableStatus(isAuthenticated),
    };
  }

  const status: AiQuotaStatus = {
    remaining: Math.max(0, limit - usageUnits),
    limit,
    isAuthenticated,
    dailyBudgetUsd,
    dailySpentUsd: unitsToUsd(spendUnits),
    budgetExhausted: spendUnits >= budgetUnits,
    mode: "live",
  };

  if (code === 1) return { allowed: true, quota: status };
  if (code === 2) return { allowed: false, reason: "rate_limited", quota: { ...status, remaining: 0, budgetExhausted: false } };
  if (code === 3) return { allowed: false, reason: "budget_exhausted", quota: { ...status, budgetExhausted: true } };
  return { allowed: false, reason: "quota_unavailable", quota: liveUnavailableStatus(isAuthenticated) };
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

/**
 * Per-IP budget for view beacons. Duplicate visits are deduplicated separately; this
 * only stops one client from spraying the endpoint.
 */
export const VIEW_REQUESTS_PER_MINUTE = 60;
export const VIEW_DEDUPE_TTL_SECONDS = 60 * 60 * 24;

const demoViewLimitMap = new Map<string, { count: number; window: number }>();
const demoViewSeenMap = new Map<string, number>();
let viewLimiterSingleton: Ratelimit | null = null;

/**
 * Drops expired keys when a demo map grows past its cap. If nothing can be dropped the
 * caller denies new tracked work rather than evicting a live quota/dedupe record.
 */
function sweepDemoMap<K, V>(map: Map<K, V>, isExpired: (value: V) => boolean): boolean {
  if (map.size <= DEMO_IDENTITY_MAP_CAP) return true;
  for (const [key, value] of map) {
    if (isExpired(value)) map.delete(key);
  }
  return map.size <= DEMO_IDENTITY_MAP_CAP;
}

function getViewLimiter(): Ratelimit | null {
  const redis = getRedisClient();
  if (!redis) return null;
  if (!viewLimiterSingleton) {
    viewLimiterSingleton = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(VIEW_REQUESTS_PER_MINUTE, "60 s"),
      prefix: "tw:rl:views",
    });
  }
  return viewLimiterSingleton;
}

export async function limitViewRequests(
  identifier: string
): Promise<{ allowed: boolean; remaining: number }> {
  const limiter = getViewLimiter();
  if (!limiter) {
    const window = Math.floor(Date.now() / 60_000);
    if (
      !sweepDemoMap(demoViewLimitMap, (record) => record.window < window) &&
      !demoViewLimitMap.has(identifier)
    ) {
      return { allowed: false, remaining: 0 };
    }
    const record = demoViewLimitMap.get(identifier);
    const count = record && record.window === window ? record.count : 0;
    if (count >= VIEW_REQUESTS_PER_MINUTE) return { allowed: false, remaining: 0 };
    demoViewLimitMap.set(identifier, { count: count + 1, window });
    return { allowed: true, remaining: VIEW_REQUESTS_PER_MINUTE - count - 1 };
  }
  const result = await limiter.limit(identifier);
  // A storage timeout must not silently permit unlimited traffic.
  if (result.reason === "timeout") return { allowed: false, remaining: 0 };
  return { allowed: result.success, remaining: Math.max(0, result.remaining) };
}

/**
 * Records a view once per key and reports whether it was new. Backed by a Redis
 * SET NX with TTL so refreshes and repeat visits inside the window are not counted
 * twice; demo mode uses an in-memory map with the same expiry semantics.
 */
export async function claimView(
  key: string,
  ttlSeconds = VIEW_DEDUPE_TTL_SECONDS
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    const now = Date.now();
    const hasRoom =
      sweepDemoMap(demoViewSeenMap, (expiresAt) => expiresAt <= now) || demoViewSeenMap.has(key);
    if (!hasRoom) return false;
    const expiresAt = demoViewSeenMap.get(key);
    if (expiresAt && expiresAt > now) return false;
    demoViewSeenMap.set(key, now + ttlSeconds * 1000);
    return true;
  }

  const claimed = await redis.set(key, "1", { nx: true, ex: ttlSeconds });
  return claimed === "OK";
}

export async function limitDownloadRequests(
  identifier: string
): Promise<{ allowed: boolean; remaining: number }> {
  const limiter = getDownloadLimiter();
  if (!limiter) {
    const window = Math.floor(Date.now() / 60_000);
    if (
      !sweepDemoMap(demoDownloadMap, (record) => record.window < window) &&
      !demoDownloadMap.has(identifier)
    ) {
      return { allowed: false, remaining: 0 };
    }
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

/** Clears process-local demo accounting so test fixtures start from a known window. */
export function resetDemoQuotaForTests(): void {
  demoUsageMap.clear();
  demoSpendUnits = 0;
  demoSpendDate = "";
}
