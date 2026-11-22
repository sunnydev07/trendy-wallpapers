import assert from "node:assert/strict";
import test from "node:test";
import {
  ANON_DAILY_LIMIT,
  DOWNLOAD_RENDER_LIMIT,
  VIEW_REQUESTS_PER_MINUTE,
  claimView,
  consumeAiQuota,
  limitDownloadRequests,
  limitViewRequests,
  resetDemoQuotaForTests,
} from "../src/lib/redis.ts";

test("download render budget allows the limit then denies the next request", async () => {
  const id = `rate-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  for (let i = 0; i < DOWNLOAD_RENDER_LIMIT; i++) {
    const result = await limitDownloadRequests(id);
    assert.equal(result.allowed, true, `request ${i + 1} should be allowed`);
  }
  const denied = await limitDownloadRequests(id);
  assert.equal(denied.allowed, false);
  assert.equal(denied.remaining, 0);
});

test("view budget allows the limit then denies the next request", async () => {
  const id = `view-rate-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  for (let i = 0; i < VIEW_REQUESTS_PER_MINUTE; i++) {
    const result = await limitViewRequests(id);
    assert.equal(result.allowed, true, `view ${i + 1} should be allowed`);
  }
  assert.equal((await limitViewRequests(id)).allowed, false);
});

test("a view key is counted once until its dedupe window expires", async () => {
  const key = `view-dedupe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  assert.equal(await claimView(key), true);
  assert.equal(await claimView(key), false);
  assert.equal(await claimView(`${key}-other`), true);
});

test("distinct identifiers have independent budgets", async () => {
  const a = `ind-a-${Date.now()}`;
  const b = `ind-b-${Date.now()}`;
  for (let i = 0; i < DOWNLOAD_RENDER_LIMIT; i++) await limitDownloadRequests(a);
  assert.equal((await limitDownloadRequests(a)).allowed, false);
  assert.equal((await limitDownloadRequests(b)).allowed, true);
});

test("simultaneous last-slot reservations never exceed the daily limit", async () => {
  resetDemoQuotaForTests();
  const identifier = `quota-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const attempts = await Promise.all(
    Array.from({ length: ANON_DAILY_LIMIT + 5 }, () => consumeAiQuota(identifier, false, 0.003))
  );
  assert.equal(attempts.filter((attempt) => attempt.allowed).length, ANON_DAILY_LIMIT);
  assert.equal(
    attempts.filter((attempt) => attempt.reason === "rate_limited").length,
    attempts.length - ANON_DAILY_LIMIT
  );
  assert.equal(attempts.filter((attempt) => attempt.allowed)[0].quota.mode, "demo");
});

test("the daily budget denies generation before any slot is granted", async () => {
  resetDemoQuotaForTests();
  const original = process.env.DAILY_AI_BUDGET_USD;
  process.env.DAILY_AI_BUDGET_USD = "0.0009"; // 90 units, below the 300-unit generation cost
  try {
    const result = await consumeAiQuota(`budget-${Date.now()}`, false, 0.003);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "budget_exhausted");
    assert.equal(result.quota.remaining, ANON_DAILY_LIMIT);
  } finally {
    if (original === undefined) delete process.env.DAILY_AI_BUDGET_USD;
    else process.env.DAILY_AI_BUDGET_USD = original;
    resetDemoQuotaForTests();
  }
});

test("an allowed reservation reports integer-unit spend as USD", async () => {
  resetDemoQuotaForTests();
  const identifier = `spend-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const result = await consumeAiQuota(identifier, false, 0.003);
  assert.equal(result.allowed, true);
  assert.equal(result.quota.dailySpentUsd, 0.003);
  assert.equal(result.quota.remaining, ANON_DAILY_LIMIT - 1);
});
