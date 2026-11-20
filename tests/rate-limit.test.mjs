import assert from "node:assert/strict";
import test from "node:test";
import { DOWNLOAD_RENDER_LIMIT, limitDownloadRequests } from "../src/lib/redis.ts";

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

test("distinct identifiers have independent budgets", async () => {
  const a = `ind-a-${Date.now()}`;
  const b = `ind-b-${Date.now()}`;
  for (let i = 0; i < DOWNLOAD_RENDER_LIMIT; i++) await limitDownloadRequests(a);
  assert.equal((await limitDownloadRequests(a)).allowed, false);
  assert.equal((await limitDownloadRequests(b)).allowed, true);
});
