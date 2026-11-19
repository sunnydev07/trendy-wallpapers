import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getAdminUploadSecret, isR2Configured, isSupabaseAdminConfigured } from "@/lib/env";
import {
  generateThumbnailBuffer,
  inspectWallpaperBuffer,
} from "@/lib/image-processing";
import { uploadToR2 } from "@/lib/r2";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { DeviceType, WallpaperSourceType } from "@/types/wallpaper";

export const runtime = "nodejs";

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
    const formData = await request.formData();
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
    ];
    const sourceType: WallpaperSourceType = allowedSources.includes(
      sourceTypeRaw as WallpaperSourceType
    )
      ? (sourceTypeRaw as WallpaperSourceType)
      : "original";

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Uploaded file must be an image." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);

    let metadata: Awaited<ReturnType<typeof inspectWallpaperBuffer>>;
    let thumbBuffer: Buffer;
    try {
      [metadata, thumbBuffer] = await Promise.all([
        inspectWallpaperBuffer(originalBuffer),
        generateThumbnailBuffer(originalBuffer, 480),
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unreadable image data.";
      return NextResponse.json({ error: `Invalid image file: ${message}` }, { status: 400 });
    }

    const slug = `${slugify(title)}-${Date.now().toString(36).slice(-4)}`;
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const deviceTypes = inferDeviceTypes(metadata.width, metadata.height);

    const originalExt = file.type === "image/jpeg" ? "jpg" : "png";
    const r2OriginalKey = `originals/${slug}.${originalExt}`;
    const r2ThumbKey = `thumbs/${slug}.webp`;

    if (isR2Configured()) {
      await Promise.all([
        uploadToR2({
          key: r2OriginalKey,
          body: originalBuffer,
          contentType: file.type || "image/png",
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

    return NextResponse.json({
      status: "processed_demo",
      mode: "demo",
      slug,
      metadata,
      r2OriginalKey,
      r2ThumbKey,
      thumbBytes: thumbBuffer.byteLength,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected upload error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
