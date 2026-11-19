import assert from "node:assert/strict";
import test from "node:test";
import {
  applyInMemoryFilters,
  filterCacheKey,
  getCollectionBySlug,
  getWallpaperBySlug,
  queryWallpapers,
} from "../src/lib/data-provider.ts";
import { SEED_WALLPAPERS } from "../src/lib/seed-data.ts";

test("filter cache key is stable across fresh objects and key order", () => {
  assert.equal(
    filterCacheKey({ source: "ai", device: "mobile" }),
    filterCacheKey({ device: "mobile", source: "ai" })
  );
  assert.equal(filterCacheKey({ source: "ai", device: undefined }), "source=ai");
});

test("search matches records beyond the first page instead of truncating", () => {
  const many = Array.from({ length: 70 }, (_, index) => ({
    ...SEED_WALLPAPERS[0],
    id: `id-${index}`,
    slug: `wall-${index}`,
    title: index === 65 ? "Rare Aurora Needle" : `Filler ${index}`,
    tags: [],
  }));
  const result = applyInMemoryFilters(many, { q: "rare aurora", limit: 10 });
  assert.equal(result.length, 1);
  assert.equal(result[0].slug, "wall-65");
});

test("category aliases match device traits like the demo catalog", () => {
  const ultrawide = applyInMemoryFilters(SEED_WALLPAPERS, { category: "ultrawide" });
  assert.ok(ultrawide.length > 0);
  assert.ok(ultrawide.every((w) => w.device_types.includes("ultrawide") || w.category_slug === "ultrawide"));
});

test("collections resolve their exact listed slugs", async () => {
  const collection = await getCollectionBySlug("vice-city-midnight-pack");
  assert.ok(collection);
  const slugs = collection.wallpapers.map((w) => w.slug);
  assert.deepEqual(slugs, collection.collection.wallpaperSlugs.filter((s) => slugs.includes(s)));
  assert.ok(slugs.length > 0);
});

test("unknown slugs and collections resolve to null", async () => {
  assert.equal(await getWallpaperBySlug("does-not-exist"), null);
  assert.equal(await getCollectionBySlug("does-not-exist"), null);
});

test("source transparency filter separates AI from human work", async () => {
  const ai = await queryWallpapers({ source: "ai" });
  const human = await queryWallpapers({ source: "human" });
  assert.ok(ai.every((w) => w.source_type === "ai_generated"));
  assert.ok(human.every((w) => w.source_type !== "ai_generated"));
});
