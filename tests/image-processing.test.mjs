import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { inspectWallpaperBuffer, processSmartDownload } from "../src/lib/image-processing.ts";

test("grayscale uploads yield valid RGB hex palette", async () => {
  const buffer = await sharp({ create: { width: 80, height: 60, channels: 3, background: "#808080" } }).toColourspace("b-w").png().toBuffer();
  const meta = await inspectWallpaperBuffer(buffer);
  assert.ok(meta.dominantColors.every(color => /^#[A-F0-9]{6}$/.test(color)));
});
test("EXIF orientation is reflected in advertised dimensions", async () => {
  const buffer = await sharp({ create: { width: 80, height: 60, channels: 3, background: "#ffffff" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const meta = await inspectWallpaperBuffer(buffer);
  assert.deepEqual([meta.width, meta.height], [60, 80]);
});
test("oversized vector inputs are rejected before rasterization", async () => {
  const buffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10000" height="10000"><rect width="1" height="1"/></svg>');
  await assert.rejects(() => processSmartDownload(buffer, { width: 320, format: "png" }), /pixel|limit|large/i);
});
