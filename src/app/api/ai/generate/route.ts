import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import {
  hasPartialPaidConfiguration,
  isPaidGenerationReady,
} from "@/lib/env";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import {
  ImageTooLargeError,
  MAX_IMAGE_BYTES,
  computeAspectRatioLabel,
  contentTypeForFormat,
  generateThumbnailBuffer,
  inspectImageMetadata,
  inspectWallpaperBuffer,
  normalizeStoredFormat,
  processSmartDownload,
  readBoundedBody,
  type DecodedImageMetadata,
} from "@/lib/image-processing";
import {
  composeWallpaperPrompt,
  sanitizeAndValidatePrompt,
} from "@/lib/prompt-safety";
import { getR2PublicUrl, uploadToR2 } from "@/lib/r2";
import {
  consumeAiQuota,
  FLUX_FLASH_COST_USD,
  FLUX_SCHNELL_COST_USD,
  getAiQuotaStatus,
  hashClientIp,
} from "@/lib/redis";
import {
  buildWallpaperSvgMarkup,
  registerDemoWallpaper,
  svgToDataUri,
} from "@/lib/seed-data";
import {
  getSupabaseAdminClient,
  getSupabaseServerClient,
} from "@/lib/supabase";
import type { DeviceType, Wallpaper } from "@/types/wallpaper";

export const runtime = "nodejs";

/** Below the 90-second client deadline, with margin for response handling. */
const REQUEST_BUDGET_MS = 80_000;
const PROVIDER_BUDGET_MS = 60_000;
const DOWNLOAD_BUDGET_MS = 30_000;

const MODEL_MAP = {
  "flux-schnell": {
    falId: "fal-ai/flux/schnell",
    costUsd: FLUX_SCHNELL_COST_USD,
  },
  "flux-2-flash": {
    falId: "fal-ai/flux-2/flash",
    costUsd: FLUX_FLASH_COST_USD,
  },
} as const;

type FalImageSize = "landscape_16_9" | "portrait_16_9" | "landscape_4_3";

const ASPECT_DIMENSIONS: Record<
  "16:9" | "21:9" | "9:16" | "4:3",
  { width: number; height: number; falSize: FalImageSize; devices: DeviceType[] }
> = {
  "16:9": {
    width: 1920,
    height: 1080,
    falSize: "landscape_16_9",
    devices: ["desktop"],
  },
  "21:9": {
    width: 2560,
    height: 1080,
    falSize: "landscape_16_9",
    devices: ["ultrawide", "desktop"],
  },
  "9:16": {
    width: 1080,
    height: 1920,
    falSize: "portrait_16_9",
    devices: ["mobile"],
  },
  "4:3": {
    width: 1600,
    height: 1200,
    falSize: "landscape_4_3",
    devices: ["tablet", "desktop"],
  },
};

const GenerateBodySchema = z.object({
  prompt: z.string().min(4).max(360),
  stylePresetId: z.string().default("vice-city-neon"),
  aspectRatio: z.enum(["16:9", "21:9", "9:16", "4:3"]).default("16:9"),
  phoneClockMargin: z.boolean().optional().default(false),
  modelKey: z.enum(["flux-schnell", "flux-2-flash"]).optional().default("flux-schnell"),
});

function extractClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

function slugifyPrompt(prompt: string): string {
  const base = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `${base || "ai-wallpaper"}-${suffix}`;
}

function buildTitleFromPrompt(prompt: string, presetName: string): string {
  const cleaned = prompt
    .replace(/[^\w\s-]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  return cleaned ? `${cleaned} — ${presetName}` : `${presetName} AI Wallpaper`;
}

function buildSeoDescription(
  prompt: string,
  presetName: string,
  aspectRatio: string,
  width: number,
  height: number
): string {
  return `${buildTitleFromPrompt(prompt, presetName)} is an AI-generated, textless ${aspectRatio} wallpaper created in the Trendy-Wallpapers AI Studio using the ${presetName} aesthetic preset. Inspired by the prompt "${prompt}", this composition is framed at ${width}×${height} with crisp tonal separation, deep dark-mode surfaces, and balanced focal weight so desktop icons, docks, or smartphone lock screen widgets stay effortlessly legible. Every AI generation published through our studio is transparently labeled as AI Generated, indexed with its dominant 5-color hex palette for peripheral and setup matching, and available via our zero-login Smart Download pipeline in WebP, PNG, or JPG at your exact display resolution.`;
}

async function resolveRequesterIdentity(request: NextRequest) {
  const rawIp = extractClientIp(request);
  const ipHash = hashClientIp(rawIp);

  const supabase = await getSupabaseServerClient();
  if (supabase) {
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) {
        return {
          userId: data.user.id,
          ipHash,
          identifier: `user:${data.user.id}`,
          isAuthenticated: true,
        };
      }
    } catch {
      // Fall back to anonymous IP hash cleanly
    }
  }

  return {
    userId: null,
    ipHash,
    identifier: `ip:${ipHash}`,
    isAuthenticated: false,
  };
}

export async function GET(request: NextRequest) {
  try {
    const identity = await resolveRequesterIdentity(request);
    const quota = await getAiQuotaStatus(identity.identifier, identity.isAuthenticated);
    return NextResponse.json({ quota });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Quota storage unavailable.";
    return NextResponse.json({ error: message, code: "QUOTA_UNAVAILABLE" }, { status: 503 });
  }
}

async function handleGeneration(request: NextRequest) {
  let parsedBody: z.infer<typeof GenerateBodySchema>;
  try {
    const json = await request.json();
    parsedBody = GenerateBodySchema.parse(json);
  } catch {
    return NextResponse.json(
      { error: "Invalid generation request payload." },
      { status: 400 }
    );
  }

  // 1. Server-side content safety check BEFORE touching quota or Fal.ai
  const safety = sanitizeAndValidatePrompt(parsedBody.prompt);
  if (!safety.safe) {
    return NextResponse.json(
      { error: safety.reason ?? "Prompt rejected by safety filter." },
      { status: 400 }
    );
  }

  // Paid generation needs the entire write/queue/budget pipeline. Partial configuration
  // is an attempted live deployment: pause before spending quota or dispatching work.
  const liveReady = isPaidGenerationReady();
  if (!liveReady && hasPartialPaidConfiguration()) {
    return NextResponse.json(
      {
        error:
          "AI generation is temporarily unavailable because the live service configuration is incomplete.",
        code: "SERVICE_UNAVAILABLE",
      },
      { status: 503 }
    );
  }

  const identity = await resolveRequesterIdentity(request);
  const modelConfig = MODEL_MAP[parsedBody.modelKey];

  // 2. Atomic daily budget + per-identity slot reservation
  const quotaCheck = await consumeAiQuota(
    identity.identifier,
    identity.isAuthenticated,
    modelConfig.costUsd
  );

  if (!quotaCheck.allowed) {
    if (quotaCheck.reason === "quota_unavailable") {
      return NextResponse.json(
        {
          error:
            "Quota storage is unreachable right now, so generation is paused to prevent overspend. Please retry shortly.",
          code: "QUOTA_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    if (quotaCheck.reason === "budget_exhausted") {
      return NextResponse.json(
        {
          error:
            "Today's global AI Studio generation budget has been reached to keep the service free. Guest generation resumes at 00:00 UTC.",
          code: "BUDGET_EXHAUSTED",
          quota: quotaCheck.quota,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: identity.isAuthenticated
          ? "You have reached your 5 daily AI wallpaper generations. Check back in 24 hours."
          : "You have used your 2 free daily guest generations. Sign in for 5/day or check back tomorrow.",
        code: "RATE_LIMITED",
        quota: quotaCheck.quota,
      },
      { status: 429 }
    );
  }

  const { finalPrompt, preset } = composeWallpaperPrompt({
    userPrompt: safety.sanitizedPrompt,
    stylePresetId: parsedBody.stylePresetId,
    aspectRatio: parsedBody.aspectRatio,
    phoneClockMargin: parsedBody.phoneClockMargin,
  });

  const dims = ASPECT_DIMENSIONS[parsedBody.aspectRatio];
  const slug = slugifyPrompt(safety.sanitizedPrompt);
  const title = buildTitleFromPrompt(safety.sanitizedPrompt, preset.name);

  // 3. Live Fal.ai + R2 + Supabase SEO Flywheel
  if (liveReady) {
    const controller = new AbortController();
    const deadlineTimer = setTimeout(
      () => controller.abort(new DOMException("Generation deadline exceeded.", "TimeoutError")),
      REQUEST_BUDGET_MS
    );
    let dispatched = false;
    let providerRequestId: string | null = null;

    try {
      fal.config({ credentials: process.env.FAL_KEY! });

      dispatched = true;
      const falResult = (await fal.subscribe(modelConfig.falId, {
        input: {
          prompt: finalPrompt,
          image_size: dims.falSize,
          num_inference_steps: 4,
          num_images: 1,
          enable_safety_checker: true,
        },
        abortSignal: controller.signal,
        timeout: PROVIDER_BUDGET_MS,
        onEnqueue: (requestId) => {
          providerRequestId = requestId;
        },
      })) as { data?: { images?: { url: string; width?: number; height?: number }[] } };

      const imageUrl = falResult?.data?.images?.[0]?.url;
      if (!imageUrl) {
        throw new Error("Fal.ai returned no image URL.");
      }

      if (controller.signal.aborted) throw new Error("Generation deadline exceeded.");

      const fetched = await fetchWithTimeout(imageUrl, { signal: controller.signal }, DOWNLOAD_BUDGET_MS);
      if (!fetched.ok) {
        throw new Error("Failed to download generated artwork from Fal.ai.");
      }

      const downloaded = await readBoundedBody(fetched, MAX_IMAGE_BYTES, controller.signal);
      const downloadedMeta = await inspectImageMetadata(downloaded);
      const decodedFormat = normalizeStoredFormat(downloadedMeta.format);
      if (!decodedFormat) {
        throw new Error(`Provider returned an unsupported image format: ${downloadedMeta.format}.`);
      }

      // Fal renders 16:9 for ultrawide presets; crop to the advertised ratio before storing.
      let originalBuffer: Buffer = downloaded;
      let originalFormat = decodedFormat;
      let finalMeta: DecodedImageMetadata = downloadedMeta;
      if (Math.abs(downloadedMeta.width / downloadedMeta.height - dims.width / dims.height) > 0.01) {
        const cropped = await processSmartDownload(downloaded, {
          width: dims.width,
          height: dims.height,
          format: "png",
          fit: "cover",
          quality: 100,
        });
        originalBuffer = cropped.buffer;
        originalFormat = "png";
        finalMeta = {
          width: cropped.width,
          height: cropped.height,
          aspectRatio: computeAspectRatioLabel(cropped.width, cropped.height),
          format: "png",
        };
      }

      // One metadata decode for the crop decision and one color analysis pass on the
      // final stored bytes; the thumbnail job stays a single Sharp render.
      const [meta, thumbBuffer] = await Promise.all([
        inspectWallpaperBuffer(originalBuffer, { metadata: finalMeta }),
        generateThumbnailBuffer(originalBuffer, 480),
      ]);

      const assetSuffix = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const r2OriginalKey = `originals/ai/${slug}-${assetSuffix}.${originalFormat}`;
      const r2ThumbKey = `thumbs/ai/${slug}-${assetSuffix}.webp`;

      await Promise.all([
        uploadToR2({
          key: r2OriginalKey,
          body: originalBuffer,
          contentType: contentTypeForFormat(originalFormat),
          signal: controller.signal,
        }),
        uploadToR2({
          key: r2ThumbKey,
          body: thumbBuffer,
          contentType: "image/webp",
          signal: controller.signal,
        }),
      ]);

      const description = buildSeoDescription(
        safety.sanitizedPrompt,
        preset.name,
        parsedBody.aspectRatio,
        meta.width,
        meta.height
      );

      let savedWallpaper: Wallpaper = {
        id: crypto.randomUUID(),
        slug,
        title,
        description,
        source_type: "ai_generated",
        category_slug: preset.categorySlug,
        tags: [
          "ai generated",
          preset.id,
          parsedBody.aspectRatio,
          ...safety.sanitizedPrompt.toLowerCase().split(/\s+/).slice(0, 4),
        ],
        dominant_colors: meta.dominantColors,
        width: meta.width,
        height: meta.height,
        aspect_ratio: parsedBody.aspectRatio,
        device_types: dims.devices,
        r2_original_key: r2OriginalKey,
        r2_thumb_key: r2ThumbKey,
        thumb_url: getR2PublicUrl(r2ThumbKey),
        preview_url: `/api/download?slug=${encodeURIComponent(slug)}&w=1200&format=webp&preview=1`,
        downloads_count: 0,
        views_count: 1,
        is_textless: true,
        is_oled_dark: meta.isOledDark || preset.isOledDark,
        attribution_text: `AI Generated (${modelConfig.falId}) — Trendy-Wallpapers Studio`,
        is_published: true,
        created_at: new Date().toISOString(),
      };

      const admin = getSupabaseAdminClient();
      if (!admin) {
        return NextResponse.json(
          { error: "Artwork store is unavailable, so the generation was not published." },
          { status: 502 }
        );
      }

      const { data: inserted, error: insertError } = await admin
        .from("wallpapers")
        .insert({
          slug: savedWallpaper.slug,
          title: savedWallpaper.title,
          description: savedWallpaper.description,
          source_type: "ai_generated",
          category_slug: savedWallpaper.category_slug,
          tags: savedWallpaper.tags,
          dominant_colors: savedWallpaper.dominant_colors,
          width: savedWallpaper.width,
          height: savedWallpaper.height,
          aspect_ratio: savedWallpaper.aspect_ratio,
          device_types: savedWallpaper.device_types,
          r2_original_key: savedWallpaper.r2_original_key,
          r2_thumb_key: savedWallpaper.r2_thumb_key,
          is_textless: true,
          is_oled_dark: savedWallpaper.is_oled_dark,
          attribution_text: savedWallpaper.attribution_text,
          is_published: true,
        })
        .select("id, created_at")
        .single();

      if (insertError || !inserted) {
        return NextResponse.json(
          {
            error: `Generated artwork could not be published: ${insertError?.message ?? "no row returned"}`,
            code: "PUBLISH_FAILED",
          },
          { status: 502 }
        );
      }

      savedWallpaper = {
        ...savedWallpaper,
        id: inserted.id,
        created_at: inserted.created_at,
      };
      revalidateTag("wallpapers");

      // The generation ledger is audit data; the wallpaper row is already committed.
      // Supabase reports operation failures through `error`, not only rejections.
      const { error: ledgerError } = await admin.from("ai_generations").insert({
        user_id: identity.userId,
        ip_hash: identity.ipHash,
        prompt: safety.sanitizedPrompt,
        style_preset: preset.id,
        aspect_ratio: parsedBody.aspectRatio,
        model_used: modelConfig.falId,
        cost_usd: modelConfig.costUsd,
        wallpaper_id: inserted.id,
      });
      if (ledgerError) {
        console.warn(
          `AI generation ledger write failed for ${providerRequestId ?? "unknown request"}: ${ledgerError.message}`
        );
      }

      return NextResponse.json({
        wallpaper: savedWallpaper,
        quota: quotaCheck.quota,
        modelUsed: modelConfig.falId,
        estimatedCostUsd: modelConfig.costUsd,
        mode: "live",
      });
    } catch (err) {
      const aborted =
        controller.signal.aborted ||
        (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError"));

      if (aborted) {
        return NextResponse.json(
          {
            error: dispatched
              ? "Generation timed out after dispatch. It may still complete and consume quota; check your quota before retrying."
              : "Generation timed out before the provider was dispatched.",
            code: dispatched ? "GENERATION_STATUS_UNKNOWN" : "GENERATION_TIMEOUT",
            requestId: providerRequestId,
          },
          { status: 504 }
        );
      }

      if (err instanceof ImageTooLargeError) {
        return NextResponse.json(
          { error: "Generated artwork exceeded the supported image size.", code: "UPSTREAM_TOO_LARGE" },
          { status: 502 }
        );
      }

      const message = err instanceof Error ? err.message : "AI generation service error.";
      return NextResponse.json({ error: message }, { status: 502 });
    } finally {
      clearTimeout(deadlineTimer);
    }
  }

  // 4. Graceful Local Demo Mode Simulation (registers a real navigable /wallpaper/[slug])
  const palette = preset.isOledDark
    ? ["#000000", preset.accentHex, "#00F0FF", "#6366F1", "#111827"]
    : ["#0B0D12", preset.accentHex, "#00F0FF", "#5B21B6", "#1E293B"];

  const motif =
    preset.id === "minimalist-oled"
      ? "oled"
      : preset.id === "cyberpunk-rain"
        ? "cyberpunk"
        : preset.id === "alpine-night-sky"
          ? "aurora"
          : preset.id === "liquid-glass-dark"
            ? "liquid"
            : "vice";

  const thumbW = 480;
  const thumbH = Math.round((dims.height / dims.width) * thumbW);
  const thumbSvg = buildWallpaperSvgMarkup({
    title,
    colors: palette,
    width: thumbW,
    height: thumbH,
    motif,
    seedIndex: slug.length,
  });

  const previewSvg = buildWallpaperSvgMarkup({
    title,
    colors: palette,
    width: 1200,
    height: Math.round((dims.height / dims.width) * 1200),
    motif,
    seedIndex: slug.length,
  });

  const demoWallpaper: Wallpaper = {
    id: crypto.randomUUID(),
    slug,
    title,
    description: buildSeoDescription(
      safety.sanitizedPrompt,
      preset.name,
      parsedBody.aspectRatio,
      dims.width,
      dims.height
    ),
    source_type: "ai_generated",
    category_slug: preset.categorySlug,
    tags: [
      "ai generated",
      preset.id,
      parsedBody.aspectRatio,
      ...safety.sanitizedPrompt.toLowerCase().split(/\s+/).slice(0, 4),
    ],
    dominant_colors: palette,
    width: dims.width,
    height: dims.height,
    aspect_ratio: parsedBody.aspectRatio,
    device_types: dims.devices,
    r2_original_key: `originals/ai/${slug}.png`,
    r2_thumb_key: `thumbs/ai/${slug}.webp`,
    thumb_url: svgToDataUri(thumbSvg),
    preview_url: svgToDataUri(previewSvg),
    downloads_count: 1,
    views_count: 1,
    is_textless: true,
    is_oled_dark: preset.isOledDark,
    attribution_text: `AI Generated (Demo Simulation — ${modelConfig.falId}) — Trendy-Wallpapers`,
    is_published: true,
    created_at: new Date().toISOString(),
  };

  await registerDemoWallpaper(demoWallpaper);

  return NextResponse.json({
    wallpaper: demoWallpaper,
    quota: quotaCheck.quota,
    modelUsed: `${modelConfig.falId} (demo)`,
    estimatedCostUsd: modelConfig.costUsd,
    mode: "demo",
  });
}

export async function POST(request: NextRequest) {
  try {
    return await handleGeneration(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed.";
    const unavailable = /quota storage unavailable|timed out/i.test(message);
    return NextResponse.json(
      { error: message, code: unavailable ? "QUOTA_UNAVAILABLE" : "GENERATION_FAILED" },
      { status: unavailable ? 503 : 500 }
    );
  }
}
