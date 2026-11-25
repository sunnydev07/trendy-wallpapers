import assert from "node:assert/strict";
import test from "node:test";
import { POST as dmcaPost } from "../src/app/api/dmca/route.ts";
import { getCategoryBySlug } from "../src/lib/data-provider.ts";
import {
  ImageTooLargeError,
  readBoundedBody,
  resolveOutputDimensions,
} from "../src/lib/image-processing.ts";
import { AI_STYLE_PRESETS } from "../src/lib/prompt-safety.ts";
import { parseQuotaUnits } from "../src/lib/redis.ts";
import { buildWallpaperSvgMarkup, demoMotifForPreset } from "../src/lib/seed-data.ts";

test("every AI style preset maps to a real catalog category", () => {
  for (const preset of AI_STYLE_PRESETS) {
    const category = getCategoryBySlug(preset.categorySlug);
    assert.ok(category, `Preset ${preset.id} references missing category "${preset.categorySlug}"`);
  }
});

test("inside fit with a single dimension does not upscale beyond source", () => {
  assert.deepEqual(
    resolveOutputDimensions(
      { width: 800, height: 600 },
      { width: 1600, fit: "inside", preview: false }
    ),
    { width: 800, height: 600 }
  );
  assert.deepEqual(
    resolveOutputDimensions(
      { width: 800, height: 600 },
      { height: 1200, fit: "inside", preview: false }
    ),
    { width: 800, height: 600 }
  );
});

test("readBoundedBody maps streaming overflow to ImageTooLargeError", async () => {
  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(2048));
        controller.close();
      },
    })
  );
  await assert.rejects(() => readBoundedBody(response, 1024), ImageTooLargeError);
});

test("demoMotifForPreset aligns synthwave-horizon and all OLED presets with distinct motifs", () => {
  assert.equal(demoMotifForPreset("cyberpunk-rain"), "cyberpunk");
  assert.equal(demoMotifForPreset("alpine-night-sky"), "aurora");
  assert.equal(demoMotifForPreset("liquid-glass-dark"), "liquid");
  assert.equal(demoMotifForPreset("minimalist-oled"), "oled");
  assert.equal(demoMotifForPreset("synthwave-horizon"), "horizon");
  assert.equal(demoMotifForPreset("vice-city-neon"), "vice");

  const horizonSvg = buildWallpaperSvgMarkup({
    title: "Test",
    colors: ["#0B0D12", "#F97316", "#00F0FF"],
    width: 480,
    height: 270,
    motif: demoMotifForPreset("synthwave-horizon"),
    seedIndex: 0,
  });
  assert.match(horizonSvg, /<line /);
});

test("DMCA endpoint rejects non-HTTP(S) wallpaper URLs", async () => {
  const response = await dmcaPost(
    new Request("http://localhost:3000/api/dmca", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallpaperUrl: "javascript:alert(1)",
        reporterName: "Test Reporter",
        reporterEmail: "reporter@example.com",
        claimDetails: "This test claim validates that non-HTTP URLs are rejected cleanly.",
        goodFaithConfirmed: true,
      }),
    })
  );
  assert.equal(response.status, 400);
});

test("parseQuotaUnits rejects fractional, negative, or non-numeric strings", () => {
  assert.equal(parseQuotaUnits(null), 0);
  assert.equal(parseQuotaUnits(undefined), 0);
  assert.equal(parseQuotaUnits(0), 0);
  assert.equal(parseQuotaUnits("300"), 300);
  assert.equal(parseQuotaUnits("12.34"), null);
  assert.equal(parseQuotaUnits("12abc"), null);
  assert.equal(parseQuotaUnits("-5"), null);
  assert.equal(parseQuotaUnits(12.5), null);
});
