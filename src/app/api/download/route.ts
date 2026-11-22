import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getWallpaperBySlug, incrementDownloadCount } from "@/lib/data-provider";
import { isR2Configured } from "@/lib/env";
import {
  ImagePipelineBusyError,
  ImagePipelineTimeoutError,
  ImageProcessingBusyError,
  ImageTooLargeError,
  InvalidImageError,
  OutputTooLargeError,
  inspectImageMetadata,
  normalizeQuality,
  processSmartDownload,
  resolveOutputDimensions,
  runImagePipeline,
} from "@/lib/image-processing";
import { R2ObjectTooLargeError, R2UpstreamError, fetchFromR2 } from "@/lib/r2";
import { hashClientIp, limitDownloadRequests } from "@/lib/redis";
import { getDemoArtSvgForSlug, readCuratedOriginal, readLocalUpload } from "@/lib/seed-data";

export const runtime = "nodejs";

const MAX_DIMENSION = 7680;
const CACHE_ENTRIES = 48;
const CACHE_BYTES = 96 * 1024 * 1024;
const CACHE_CONTROL = "public, max-age=60, s-maxage=300";

class SourceUnavailableError extends Error {
  constructor(message = "Source artwork unavailable for this wallpaper.") {
    super(message);
    this.name = "SourceUnavailableError";
  }
}

interface Processed {
  buffer: Buffer;
  contentType: string;
  extension: string;
  width: number;
  height: number;
  etag: string;
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
): Promise<{ processed: Processed; cached: boolean }> {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return { processed: hit, cached: true };
  }

  const pending = inflight.get(key);
  if (pending) return { processed: await pending, cached: true };

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
  return { processed, cached: false };
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "127.0.0.1";
}

async function loadSourceBuffer(
  originalKey: string,
  slug: string,
  planned: { width: number; height: number } | null,
  signal: AbortSignal
): Promise<Buffer> {
  if (isR2Configured()) {
    const remote = await fetchFromR2(originalKey, { signal });
    if (remote) return remote;
  }

  const local = await readLocalUpload(originalKey);
  if (local) return local;

  const curated = await readCuratedOriginal(originalKey);
  if (curated) return curated;

  const demoSvg = getDemoArtSvgForSlug(slug, planned?.width, planned?.height);
  if (!demoSvg) throw new SourceUnavailableError();
  return Buffer.from(demoSvg, "utf8");
}

function errorResponse(err: unknown): NextResponse {
  if (err instanceof ImagePipelineBusyError || err instanceof ImageProcessingBusyError) {
    return NextResponse.json(
      { error: err.message, code: "IMAGE_BUSY" },
      { status: 503, headers: { "Retry-After": "3", "Cache-Control": "no-store" } }
    );
  }
  if (err instanceof ImagePipelineTimeoutError) {
    return NextResponse.json(
      { error: err.message, code: "IMAGE_BUSY" },
      { status: 503, headers: { "Retry-After": "5", "Cache-Control": "no-store" } }
    );
  }
  if (err instanceof ImageTooLargeError || err instanceof R2ObjectTooLargeError) {
    return NextResponse.json(
      { error: err.message, code: "IMAGE_TOO_LARGE" },
      { status: 413, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (err instanceof OutputTooLargeError) {
    return NextResponse.json(
      { error: err.message, code: "OUTPUT_TOO_LARGE" },
      { status: 413, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (err instanceof InvalidImageError) {
    return NextResponse.json(
      { error: err.message, code: "INVALID_IMAGE" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (err instanceof SourceUnavailableError) {
    return NextResponse.json(
      { error: err.message, code: "SOURCE_UNAVAILABLE" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (err instanceof R2UpstreamError) {
    return NextResponse.json(
      { error: err.message, code: "UPSTREAM_UNAVAILABLE" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
  const name = err instanceof Error ? err.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return NextResponse.json(
      { error: "Image rendering timed out.", code: "RENDER_TIMEOUT" },
      { status: 504, headers: { "Cache-Control": "no-store" } }
    );
  }
  const message = err instanceof Error ? err.message : "Failed to process wallpaper download.";
  return NextResponse.json(
    { error: message },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
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

  // Previews never rasterize beyond a 1200x1200 box and are always served as WebP.
  const format = (isPreview ? "webp" : formatParam) as "webp" | "png" | "jpg";
  // PNG ignores quality entirely, so it must not divide the cache by equivalent values.
  const quality = format === "png"
    ? undefined
    : normalizeQuality(qualityRaw === null ? 92 : Number.parseInt(qualityRaw, 10));

  const wallpaper = await getWallpaperBySlug(slug);
  if (!wallpaper) {
    return NextResponse.json({ error: "Wallpaper not found." }, { status: 404 });
  }

  let planned: { width: number; height: number } | null = null;
  try {
    // Catalog metadata is only an early intent check; decoded metadata enforces the
    // same bounds again before any resize is encoded.
    planned = resolveOutputDimensions(
      { width: wallpaper.width, height: wallpaper.height },
      { width: width.value, height: height.value, fit: fitParam as "cover" | "contain" | "inside", preview: isPreview }
    );
  } catch (err) {
    if (width.value || height.value || isPreview) return errorResponse(err);
    // An inconsistent catalog row must not block a native download; decoded metadata
    // resolves the real geometry below.
    planned = null;
  }

  const cacheKey = [
    wallpaper.id,
    wallpaper.r2_original_key,
    format,
    fitParam,
    isPreview ? "preview" : "full",
    planned?.width ?? "auto",
    planned?.height ?? "auto",
    quality ?? "na",
  ].join(":");

  const hasCachedDerivative = cache.has(cacheKey) || inflight.has(cacheKey);
  try {
    // Only fresh renders consume the per-IP budget; cache hits, 304s, and coalesced
    // identical requests are free.
    if (!hasCachedDerivative) {
      const budget = await limitDownloadRequests(hashClientIp(clientIp(request)));
      if (!budget.allowed) {
        return NextResponse.json(
          { error: "Too many download requests. Please retry shortly.", code: "RATE_LIMITED" },
          { status: 429, headers: { "Retry-After": "30", "Cache-Control": "no-store" } }
        );
      }
    }

    const { processed, cached } = await loadProcessed(cacheKey, () =>
      runImagePipeline(async () => {
        const sourceBuffer = await loadSourceBuffer(
          wallpaper.r2_original_key,
          wallpaper.slug,
          planned,
          request.signal
        );

        let targetWidth = planned?.width;
        let targetHeight = planned?.height;
        if (!targetWidth && !targetHeight) {
          // Native export: use the decoded, orientation-correct source dimensions instead
          // of stretching the image to possibly-inconsistent catalog metadata.
          const sourceMeta = await inspectImageMetadata(sourceBuffer);
          const native = resolveOutputDimensions(sourceMeta, { fit: "cover", preview: false });
          targetWidth = native.width;
          targetHeight = native.height;
        }

        const result = await processSmartDownload(sourceBuffer, {
          width: targetWidth,
          height: targetHeight,
          format,
          fit: fitParam as "cover" | "contain" | "inside",
          quality,
        });

        return {
          ...result,
          etag: `"${createHash("sha256").update(result.buffer).digest("base64url")}"`,
        };
      }, request.signal)
    );

    const headers = new Headers({
      "Cache-Control": CACHE_CONTROL,
      "CDN-Cache-Control": CACHE_CONTROL,
      ETag: processed.etag,
    });

    if (request.headers.get("if-none-match") === processed.etag) {
      return new NextResponse(null, { status: 304, headers });
    }

    // Count a download only when it was actually rendered, not on repeat cache hits.
    // The RPC result is inspected so a database-side failure is not reported as counted.
    if (!isPreview && !cached) {
      void incrementDownloadCount(wallpaper.id)
        .then((counted) => {
          if (!counted) console.warn("Download counter was not updated.");
        })
        .catch(() => undefined);
    }

    headers.set("Content-Type", processed.contentType);
    headers.set("Content-Length", String(processed.buffer.byteLength));
    headers.set("X-Wallpaper-Source", wallpaper.source_type);

    const filename = `${wallpaper.slug}-${processed.width}x${processed.height}.${processed.extension}`;
    if (!isPreview) {
      headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    }

    return new NextResponse(new Uint8Array(processed.buffer), { status: 200, headers });
  } catch (err) {
    return errorResponse(err);
  }
}

