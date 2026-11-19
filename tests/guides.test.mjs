import assert from "node:assert/strict";
import test from "node:test";
import { getAllGuides, getGuideBySlug } from "../src/lib/guides.ts";

test("guide index lists all authored articles", async () => {
  const guides = await getAllGuides();
  assert.equal(guides.length, 3);
  assert.ok(guides.every((g) => g.slug && g.title && g.readTime));
});

test("guide lookup returns full article content", async () => {
  const guide = await getGuideBySlug("4k-vs-oled-wallpaper-optimization-guide");
  assert.ok(guide);
  assert.ok(guide.content.length > 500);
});

test("path traversal slugs are rejected", async () => {
  assert.equal(await getGuideBySlug("../../.env"), null);
  assert.equal(await getGuideBySlug("a/b"), null);
});

test("repeated reads reuse the parsed article", async () => {
  const first = await getGuideBySlug("gta-6-vice-city-neon-aesthetic-setup-guide");
  const second = await getGuideBySlug("gta-6-vice-city-neon-aesthetic-setup-guide");
  assert.equal(first, second);
});
