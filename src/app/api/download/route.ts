import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getWallpaperBySlug, incrementDownloadCount } from "@/lib/data-provider";
import { isR2Configured } from "@/lib/env";
import { processSmartDownload } from "@/lib/image-processing";
import { fetchFromR2 } from "@/lib/r2";
import { getDemoArtSvgForSlug } from "@/lib/seed-data";

export const runtime = "nodejs";

const MAX_DIMENSION = 7680;
const MAX_OUTPUT_PIXELS = 7680 * 4320;
const PREVIEW_MAX_WIDTH = 1200;
const CACHE_ENTRIES = 48;
const CACHE_BYTES = 96 * 1024 * 1024;

interface Processed {
  buffer: Buffer;
  contentType: string;
  extension: string;
  width: number;
  height: number;
}

const cache = new Map<string, Processed>();
const inflight = new Map<string, Promise<Processed>>();
let cacheBytes = 0;

function readDimension(
  params: URLSearchParams,
  key: "w" | "h"
): { value?: number } | { error: string } {
  const raw = params.get(key);
  if (raw === null) return {};
  if (!/^\d+$/.test(raw)) return { error: `${key} must be a positive integer.` };
  const value = Number.parseInt(raw, 10);
  if (value < 320 || value > MAX_DIMENSION) {
    return { error: `${key} must be between 320 and ${MAX_DIMENSION}.` };
  }
  return { value };
}

async function loadProcessed(
  key: string,
  build: () => Promise<Processed>
): Promise<Processed> {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const job = build().finally(() => inflight.delete(key));
  inflight.set(key, job);
  const processed = await job;

  cache.set(key, processed);
  cacheBytes += processed.buffer.byteLength;
  while (cache.size > CACHE_ENTRIES || cacheBytes > CACHE_BYTES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    const oldestEntry = cache.get(oldestKey);
    cache.delete(oldestKey);
    if (oldestEntry) cacheBytes -= oldestEntry.buffer.byteLength;
  }
  return processed;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug")?.trim() ?? "";
  const isPreview = searchParams.get("preview") === "1";

  if (!slug) {
    return NextResponse.json({ error: "Missing wallpaper slug." }, { status: 400 });
  }

  const formatParam = (searchParams.get("format") ?? "webp").toLowerCase();
  if (!["webp", "png", "jpg"].includes(formatParam)) {
    return NextResponse.json({ error: "Unsupported format." }, { status: 400 });
  }
  const fitParam = (searchParams.get("fit") ?? "cover").toLowerCase();
  if (!["cover", "contain", "inside"].includes(fitParam)) {
    return NextResponse.json({ error: "Unsupported fit." }, { status: 400 });
  }

  const width = readDimension(searchParams, "w");
  if ("error" in width) return NextResponse.json({ error: width.error }, { status: 400 });
  const height = readDimension(searchParams, "h");
  if ("error" in height) return NextResponse.json({ error: height.error }, { status: 400 });

  const qualityRaw = searchParams.get("q");
  if (qualityRaw !== null && !/^\d+$/.test(qualityRaw)) {
    return NextResponse.json({ error: "q must be an integer." }, { status: 400 });
  }
  const quality = qualityRaw === null ? 92 : Number.parseInt(qualityRaw, 10);

  if (width.value && height.value && width.value * height.value > MAX_OUTPUT_PIXELS) {
    return NextResponse.json({ error: "Requested output is too large." }, { status: 400 });
  }

  // Previews never rasterize beyond 1200px and are always served as WebP.
  let targetWidth = width.value;
  let targetHeight = height.value;
  let format = formatParam as "webp" | "png" | "jpg";
  if (isPreview) {
    format = "webp";
    if (!targetWidth && !targetHeight) targetWidth = PREVIEW_MAX_WIDTH;
    if (targetWidth && targetWidth > PREVIEW_MAX_WIDTH) {
      if (targetHeight) targetHeight = Math.round((targetHeight * PREVIEW_MAX_WIDTH) / targetWidth);
      targetWidth = PREVIEW_MAX_WIDTH;
    }
  }

  const wallpaper = await getWallpaperBySlug(slug);
  if (!wallpaper) {
    return NextResponse.json({ error: "Wallpaper not found." }, { status: 404 });
  }

  // A plain download exports the advertised native resolution.
  if (!targetWidth && !targetHeight && !isPreview) {
    targetWidth = Math.min(wallpaper.width, MAX_DIMENSION);
    targetHeight = Math.min(wallpaper.height, MAX_DIMENSION);
  }

  const cacheKey = [
    wallpaper.id,
    format,
    fitParam,
    targetWidth ?? "auto",
    targetHeight ?? "auto",
    quality,
  ].join(":");

  try {
    const processed = await loadProcessed(cacheKey, async () => {
      let sourceBuffer: Buffer | null = null;
      if (isR2Configured()) {
        sourceBuffer = await fetchFromR2(wallpaper.r2_original_key);
      }
      if (!sourceBuffer) {
        const demoSvg = getDemoArtSvgForSlug(wallpaper.slug, targetWidth, targetHeight);
        if (!demoSvg) {
          throw new Error("Source artwork unavailable for this wallpaper.");
        }
        sourceBuffer = Buffer.from(demoSvg, "utf8");
      }
      return processSmartDownload(sourceBuffer, {
        width: targetWidth,
        height: targetHeight,
        format,
        fit: fitParam as "cover" | "contain" | "inside",
        quality,
      });
    });

    const etag = `"${createHash("sha256").update(processed.buffer).digest("base64url")}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    if (!isPreview) {
      void incrementDownloadCount(wallpaper.id).catch(() => {});
    }

    const suffix =
      targetWidth && targetHeight
        ? `${targetWidth}x${targetHeight}`
        : `${wallpaper.width}x${wallpaper.height}`;
    const filename = `${wallpaper.slug}-${suffix}.${processed.extension}`;

    const headers = new Headers({
      "Content-Type": processed.contentType,
      "Content-Length": String(processed.buffer.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "CDN-Cache-Control": "public, max-age=31536000, immutable",
      "X-Wallpaper-Source": wallpaper.source_type,
      ETag: etag,
    });
    if (!isPreview) {
      headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    }

    return new NextResponse(new Uint8Array(processed.buffer), { status: 200, headers });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to process wallpaper download.";
    const status = /unavailable|not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
