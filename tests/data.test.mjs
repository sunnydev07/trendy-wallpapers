import assert from "node:assert/strict";
import test from "node:test";
import {
  GALLERY_PAGE_SIZE,
  MAX_SEARCH_LENGTH,
  applyInMemoryFilters,
  filterCacheKey,
  getCollectionBySlug,
  getWallpaperBySlug,
  normalizeWallpaperFilters,
  queryWallpapers,
} from "../src/lib/data-provider.ts";
import { SEED_WALLPAPERS, getDemoWallpapers } from "../src/lib/seed-data.ts";

test("filter cache key is stable across fresh objects and equivalent defaults", () => {
  assert.equal(filterCacheKey({ source: "ai", device: "mobile" }), filterCacheKey({ device: "mobile", source: "ai" }));
  assert.equal(filterCacheKey({ source: "ai", device: "all" }), filterCacheKey({ device: undefined, source: "ai" }));
  assert.equal(filterCacheKey({ q: "  rain  " }), filterCacheKey({ q: "rain" }));
  assert.equal(filterCacheKey({ color: "#ff2e93" }), filterCacheKey({ color: "#FF2E93" }));
});

test("separator-containing search text cannot collide with another filter set", () => {
  assert.notEqual(filterCacheKey({ q: "rain&source=ai" }), filterCacheKey({ q: "rain", source: "ai" }));
});

test("filter normalization applies defaults, caps search text, and ignores unknown enums", () => {
  const normalized = normalizeWallpaperFilters({
    q: `  ${"a".repeat(MAX_SEARCH_LENGTH + 50)}  `,
    device: "watch",
    source: "robot",
    sort: "random",
    color: "not-a-color",
    page: -3,
  });
  assert.equal(normalized.q.length, MAX_SEARCH_LENGTH);
  assert.equal(normalized.device, "all");
  assert.equal(normalized.source, "all");
  assert.equal(normalized.sort, "popular");
  assert.equal(normalized.color, undefined);
  assert.equal(normalized.page, 1);
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

test("equal sort values break ties deterministically by id", () => {
  const base = SEED_WALLPAPERS[0];
  const items = [
    { ...base, id: "b-id", slug: "b", downloads_count: 5, tags: [] },
    { ...base, id: "a-id", slug: "a", downloads_count: 5, tags: [] },
  ];
  assert.deepEqual(
    applyInMemoryFilters(items, { sort: "popular" }).map((item) => item.id),
    ["a-id", "b-id"]
  );
  assert.deepEqual(
    applyInMemoryFilters(items, { sort: "newest" }).map((item) => item.id),
    ["a-id", "b-id"]
  );
});

test("category aliases match device traits like the demo catalog", () => {
  const ultrawide = applyInMemoryFilters(SEED_WALLPAPERS, { category: "ultrawide" });
  assert.ok(ultrawide.length > 0);
  assert.ok(ultrawide.every((w) => w.device_types.includes("ultrawide") || w.category_slug === "ultrawide"));
});

test("gallery queries return at most one page and paginate without overlap", async () => {
  const all = getDemoWallpapers();
  const first = await queryWallpapers({});
  assert.equal(first.page, 1);
  assert.ok(first.items.length <= GALLERY_PAGE_SIZE);
  assert.ok(first.items.length > 0);
  assert.equal(first.hasNextPage, all.length > GALLERY_PAGE_SIZE);

  if (first.hasNextPage) {
    const second = await queryWallpapers({ page: 2 });
    assert.equal(second.page, 2);
    assert.ok(second.items.length > 0);
    const firstIds = new Set(first.items.map((item) => item.id));
    assert.ok(second.items.every((item) => !firstIds.has(item.id)));
  }
});

test("internal limit queries respect page offsets", async () => {
  const first = await queryWallpapers({ limit: 4, page: 1 });
  assert.ok(first.items.length <= 4);
  if (first.hasNextPage) {
    const second = await queryWallpapers({ limit: 4, page: 2 });
    const firstIds = new Set(first.items.map((item) => item.id));
    assert.ok(second.items.every((item) => !firstIds.has(item.id)));
  }
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
  const ai = (await queryWallpapers({ source: "ai" })).items;
  const human = (await queryWallpapers({ source: "human" })).items;
  assert.ok(ai.every((w) => w.source_type === "ai_generated"));
  assert.ok(human.every((w) => w.source_type !== "ai_generated"));
});
