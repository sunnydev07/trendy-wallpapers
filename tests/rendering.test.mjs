import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { SEED_WALLPAPERS, buildWallpaperSvgMarkup, getDemoArtSvgForSlug } from "../src/lib/seed-data.ts";

for (const motif of ["vice", "cyberpunk", "oled", "horizon", "aurora", "liquid"]) {
  test(`${motif} artwork uses gradients without raster blur filters`, async () => {
    const svg = buildWallpaperSvgMarkup({ title: "Test", colors: ["#000000", "#FF2E93", "#00F0FF"], width: 480, height: 270, motif, seedIndex: 1 });
    assert.ok(!svg.includes("feGaussianBlur"), "SVG contains costly Gaussian blur");
    assert.ok(!svg.includes("<filter"), "SVG contains a raster filter");
    assert.match(svg, /radialGradient/);
    const image = await sharp(Buffer.from(svg)).png().toBuffer();
    assert.ok(image.length > 100);
  });
}
test("every demo thumbnail stays at or below 480 pixels wide", () => {
  for (const wallpaper of SEED_WALLPAPERS) {
    const svg = decodeURIComponent(wallpaper.thumb_url.split(",").slice(1).join(","));
    const width = Number(svg.match(/<svg[^>]*\bwidth="(\d+)"/)[1]);
    assert.ok(width <= 480, `${wallpaper.slug} thumbnail is ${width}px`);
  }
});
test("demo SVG preserves source aspect ratio for width-only requests", () => {
  const svg = getDemoArtSvgForSlug("vice-boulevard-twilight-4k", 1200);
  assert.match(svg, /width="1200" height="675"/);
});
