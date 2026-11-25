import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAdminUploadSecret, isDemoMode, isR2Configured, isSupabaseAdminConfigured } from "@/lib/env";
import { BoundedBodyError, readBoundedStream } from "@/lib/fetch-with-timeout";
import {
  ImageTooLargeError,
  MAX_IMAGE_BYTES,
  MAX_MULTIPART_BYTES,
  contentTypeForFormat,
  generateThumbnailBuffer,
  inspectImageMetadata,
  inspectWallpaperBuffer,
  normalizeStoredFormat,
  type DecodedImageMetadata,
} from "@/lib/image-processing";
import { uploadToR2 } from "@/lib/r2";
import { registerDemoWallpaper, saveLocalUpload } from "@/lib/seed-data";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { DeviceType, WallpaperSourceType } from "@/types/wallpaper";

export const runtime = "nodejs";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function inferDeviceTypes(width: number, height: number): DeviceType[] {
  const ratio = width / Math.max(1, height);
  if (ratio < 0.85) return ["mobile"];
  if (ratio >= 2.1) return ["ultrawide", "desktop"];
  return ["desktop"];
}

/**
 * Reads the multipart body through a bounded stream before parsing. An honest or
 * dishonest Content-Length cannot make the route buffer more than 45 MiB.
 */
async function parseBoundedFormData(request: NextRequest): Promise<FormData> {
  const declared = Number(request.headers.get("content-length") ?? Number.NaN);
  if (Number.isFinite(declared) && declared > MAX_MULTIPART_BYTES) {
    throw new ImageTooLargeError("Upload exceeds the 45 MB request limit.");
  }

  const contentType = request.headers.get("content-type") ?? "";
  let body: Buffer;
  try {
    body = await readBoundedStream(request.body, MAX_MULTIPART_BYTES);
  } catch (error) {
    if (error instanceof BoundedBodyError) {
      throw new ImageTooLargeError("Upload exceeds the 45 MB request limit.");
    }
    throw error;
  }

  return new Request(request.url, {
    method: "POST",
    headers: { "content-type": contentType },
    body: new Uint8Array(body),
  }).formData();
}

export async function POST(request: NextRequest) {
  const expectedSecret = getAdminUploadSecret();
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!expectedSecret) {
    return NextResponse.json(
      {
        error:
          "ADMIN_UPLOAD_SECRET is not configured. Set a 16+ char secret in environment variables to enable admin uploads.",
      },
      { status: 503 }
    );
  }

  if (token !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized upload request." }, { status: 401 });
  }

  try {
    let formData: FormData;
    try {
      formData = await parseBoundedFormData(request);
    } catch (error) {
      if (error instanceof ImageTooLargeError) {
        return NextResponse.json(
          { error: error.message },
          { status: 413, headers: { "Cache-Control": "no-store" } }
        );
      }
      return NextResponse.json({ error: "Invalid multipart upload body." }, { status: 400 });
    }

    const file = formData.get("file");
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const categorySlug = String(formData.get("category_slug") ?? "gta-6-vice-city").trim();
    const sourceTypeRaw = String(formData.get("source_type") ?? "original").trim();
    const attributionText =
      String(formData.get("attribution_text") ?? "").trim() ||
      "Original Artwork — Trendy-Wallpapers";
    const tagsRaw = String(formData.get("tags") ?? "");
    const isTextless = String(formData.get("is_textless") ?? "true") !== "false";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing image file field." }, { status: 400 });
    }

    if (!title || title.length < 3) {
      return NextResponse.json(
        { error: "Title must be at least 3 characters." },
        { status: 400 }
      );
    }

    if (description.length < 60) {
      return NextResponse.json(
        {
          error:
            "Description should be at least 60 characters (150+ words recommended for SEO & AdSense quality).",
        },
        { status: 400 }
      );
    }

    const allowedSources: WallpaperSourceType[] = [
      "original",
      "ai_generated",
      "official_press",
      "licensed_stock",
    ];
    const sourceType: WallpaperSourceType = allowedSources.includes(
      sourceTypeRaw as WallpaperSourceType
    )
      ? (sourceTypeRaw as WallpaperSourceType)
      : "original";

    // Declared MIME is an early allowlist check only; the decoded bytes decide identity.
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG or WebP images are accepted." },
        { status: 415, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image exceeds the 40 MB limit." },
        { status: 413, headers: { "Cache-Control": "no-store" } }
      );
    }

    const originalBuffer = Buffer.from(await file.arrayBuffer());

    let decodedMeta: DecodedImageMetadata;
    try {
      decodedMeta = await inspectImageMetadata(originalBuffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unreadable image data.";
      return NextResponse.json({ error: `Invalid image file: ${message}` }, { status: 400 });
    }

    const originalExt = normalizeStoredFormat(decodedMeta.format);
    if (!originalExt) {
      return NextResponse.json(
        { error: `Unsupported decoded image format: ${decodedMeta.format}.` },
        { status: 415, headers: { "Cache-Control": "no-store" } }
      );
    }

    let metadata: Awaited<ReturnType<typeof inspectWallpaperBuffer>>;
    let thumbBuffer: Buffer;
    try {
      [metadata, thumbBuffer] = await Promise.all([
        inspectWallpaperBuffer(originalBuffer, { metadata: decodedMeta }),
        generateThumbnailBuffer(originalBuffer, 480),
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unreadable image data.";
      return NextResponse.json({ error: `Invalid image file: ${message}` }, { status: 400 });
    }

    const slug = `${slugify(title)}-${crypto.randomUUID().slice(0, 8)}`;
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const deviceTypes = inferDeviceTypes(metadata.width, metadata.height);

    const r2OriginalKey = `originals/${slug}.${originalExt}`;
    const r2ThumbKey = `thumbs/${slug}.webp`;
    const originalContentType = contentTypeForFormat(originalExt);

    if (isR2Configured()) {
      await Promise.all([
        uploadToR2({
          key: r2OriginalKey,
          body: originalBuffer,
          contentType: originalContentType,
        }),
        uploadToR2({
          key: r2ThumbKey,
          body: thumbBuffer,
          contentType: "image/webp",
        }),
      ]);
    }

    const admin = getSupabaseAdminClient();
    if (isSupabaseAdminConfigured() && admin) {
      const { data, error } = await admin
        .from("wallpapers")
        .insert({
          slug,
          title,
          description,
          source_type: sourceType,
          category_slug: categorySlug,
          tags,
          dominant_colors: metadata.dominantColors,
          width: metadata.width,
          height: metadata.height,
          aspect_ratio: metadata.aspectRatio,
          device_types: deviceTypes,
          r2_original_key: r2OriginalKey,
          r2_thumb_key: r2ThumbKey,
          is_textless: isTextless,
          is_oled_dark: metadata.isOledDark,
          attribution_text: attributionText,
          is_published: true,
        })
        .select("*")
        .single();

      if (error) {
        return NextResponse.json(
          { error: `Database insert failed: ${error.message}` },
          { status: 500 }
        );
      }

      revalidateTag("wallpapers");

      return NextResponse.json({
        status: "published",
        mode: "live",
        wallpaper: data,
      });
    }

    if (isDemoMode()) {
      const stored = await saveLocalUpload(slug, originalExt, originalBuffer, thumbBuffer);
      const created = new Date().toISOString();

      await registerDemoWallpaper({
        id: crypto.randomUUID(),
        slug,
        title,
        description,
        source_type: sourceType,
        category_slug: categorySlug,
        tags,
        dominant_colors: metadata.dominantColors,
        width: metadata.width,
        height: metadata.height,
        aspect_ratio: metadata.aspectRatio,
        device_types: deviceTypes,
        r2_original_key: stored.originalKey,
        r2_thumb_key: stored.thumbKey,
        thumb_url: `/api/demo-image/${slug}`,
        preview_url: `/api/download?slug=${encodeURIComponent(slug)}&w=1200&format=webp&preview=1`,
        downloads_count: 0,
        views_count: 1,
        is_textless: isTextless,
        is_oled_dark: metadata.isOledDark,
        attribution_text: attributionText,
        is_published: true,
        created_at: created,
      });
      revalidateTag("wallpapers");

      return NextResponse.json({
        status: "published_demo",
        mode: "demo",
        slug,
        detailUrl: `/wallpaper/${slug}`,
        metadata,
      });
    }

    return NextResponse.json(
      {
        error:
          "Live database write credentials (SUPABASE_SERVICE_ROLE_KEY) are not configured, so the upload was not persisted.",
        code: "STORAGE_UNAVAILABLE",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected upload error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
