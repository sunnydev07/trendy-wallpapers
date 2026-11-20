import assert from "node:assert/strict";
import test from "node:test";
import {
  DOWNLOAD_RENDER_LIMIT,
  VIEW_REQUESTS_PER_MINUTE,
  claimView,
  limitDownloadRequests,
  limitViewRequests,
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
