import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  OutputTooLargeError,
  inspectWallpaperBuffer,
  normalizeQuality,
  processSmartDownload,
  resolveOutputDimensions,
} from "../src/lib/image-processing.ts";

test("width-only and height-only requests derive complete bounded geometry", () => {
  assert.deepEqual(
    resolveOutputDimensions({ width: 3840, height: 2160 }, { width: 1920, fit: "cover", preview: false }),
    { width: 1920, height: 1080 }
  );
  assert.deepEqual(
    resolveOutputDimensions({ width: 1080, height: 1920 }, { width: 1920, fit: "cover", preview: false }),
    { width: 1920, height: 3413 }
  );
  assert.deepEqual(
    resolveOutputDimensions({ width: 1080, height: 1920 }, { height: 1920, fit: "cover", preview: false }),
    { width: 1080, height: 1920 }
  );
});

test("inside fit computes the actual fitted dimensions without upscaling", () => {
  assert.deepEqual(
    resolveOutputDimensions({ width: 4000, height: 3000 }, { width: 1000, height: 1000, fit: "inside", preview: false }),
    { width: 1000, height: 750 }
  );
  assert.deepEqual(
    resolveOutputDimensions({ width: 800, height: 600 }, { width: 4000, height: 3000, fit: "inside", preview: false }),
    { width: 800, height: 600 }
  );
});

test("previews fit inside a 1200x1200 box and keep the source aspect", () => {
  assert.deepEqual(
    resolveOutputDimensions({ width: 1080, height: 1920 }, { fit: "cover", preview: true }),
    { width: 675, height: 1200 }
  );
  assert.deepEqual(
    resolveOutputDimensions({ width: 3840, height: 2160 }, { width: 3840, height: 2160, fit: "cover", preview: true }),
    { width: 1200, height: 675 }
  );
});

test("geometry arithmetic rejects oversized output before allocating buffers", () => {
  assert.throws(
    () => resolveOutputDimensions({ width: 8000, height: 4000 }, { fit: "cover", preview: false }),
    OutputTooLargeError
  );
  assert.throws(
    () => resolveOutputDimensions({ width: 7680, height: 4320 }, { width: 7680, height: 4321, fit: "cover", preview: false }),
    OutputTooLargeError
  );
  assert.throws(
    () => resolveOutputDimensions({ width: 7680, height: 7680 }, { width: 7680, fit: "cover", preview: false }),
    OutputTooLargeError
  );
});

test("quality normalization clamps to the encoder range", () => {
  assert.equal(normalizeQuality(undefined), 92);
  assert.equal(normalizeQuality(Number.NaN), 92);
  assert.equal(normalizeQuality(5), 60);
  assert.equal(normalizeQuality(200), 100);
  assert.equal(normalizeQuality(87.5), 88);
});

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
test("three-by-two photos are labelled 3:2, not 4:3", async () => {
  const buffer = await sharp({ create: { width: 90, height: 60, channels: 3, background: "#101010" } }).png().toBuffer();
  const meta = await inspectWallpaperBuffer(buffer);
  assert.equal(meta.aspectRatio, "3:2");
});
test("oversized vector inputs are rejected before rasterization", async () => {
  const buffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10000" height="10000"><rect width="1" height="1"/></svg>');
  await assert.rejects(() => processSmartDownload(buffer, { width: 320, format: "png" }), /pixel|limit|large/i);
});
