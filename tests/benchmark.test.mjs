import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyResult,
  parseArgs,
  percentile,
  summarize,
} from "../scripts/benchmark.mjs";

test("an unexpected status with an empty body is an explicit failure", () => {
  const result = classifyResult({
    route: "/api/download",
    status: 500,
    expected: 200,
    ms: 12.5,
    bytes: Buffer.alloc(0),
  });
  assert.equal(result.passed, false);
  assert.equal(result.failure, "Unexpected HTTP status");
});

test("matching statuses pass regardless of body content", () => {
  const result = classifyResult({
    route: "/",
    status: 200,
    expected: 200,
    ms: 4,
    bytes: Buffer.from("<html></html>"),
  });
  assert.equal(result.passed, true);
  assert.equal(result.failure, undefined);
});

test("percentiles use nearest-rank positions and stay within the sample range", () => {
  const values = Array.from({ length: 100 }, (_, index) => index + 1);
  assert.equal(percentile(values, 50), 50);
  assert.equal(percentile(values, 95), 95);
  assert.equal(percentile([], 95), null);
  const summary = summarize([1, 2, 3, 4]);
  assert.equal(summary.samples, 4);
  assert.equal(summary.min, 1);
  assert.equal(summary.max, 4);
  assert.equal(summary.p50, 2);
});

test("benchmark options are bounded and defaults stay read-only", () => {
  const options = parseArgs([]);
  assert.equal(options.samples, 30);
  assert.equal(options.includeMutations, false);
  assert.deepEqual(options.concurrency, [1]);

  assert.throws(() => parseArgs(["--concurrency=9"]), /between 1 and 6/);
  assert.throws(() => parseArgs(["--samples=0"]), /between 1 and 200/);
  const mutations = parseArgs(["--include-mutations", "--concurrency=1,2,2"]);
  assert.equal(mutations.includeMutations, true);
  assert.deepEqual(mutations.concurrency, [1, 2]);
});
