import { NextRequest, NextResponse } from "next/server";
import { incrementViewCount } from "@/lib/data-provider";
import { isDemoMode } from "@/lib/env";
import { claimView, hashClientIp, limitViewRequests } from "@/lib/redis";

export const runtime = "nodejs";

const VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const WALLPAPER_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 2_048;

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "127.0.0.1";
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Invalid view payload." }, { status: 400 });
  }

  let payload: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Invalid view payload." }, { status: 400 });
    }
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid view payload." }, { status: 400 });
  }

  const record =
    payload && typeof payload === "object"
      ? (payload as { id?: unknown; visitorId?: unknown })
      : {};

  if (typeof record.id !== "string" || !record.id.trim()) {
    return NextResponse.json({ error: "Missing wallpaper id." }, { status: 400 });
  }
  const wallpaperId = record.id.trim();
  if (!WALLPAPER_ID_PATTERN.test(wallpaperId)) {
    return NextResponse.json({ error: "Invalid wallpaper id." }, { status: 400 });
  }
  // Live catalog ids are UUIDs; demo mode keeps supporting its seed identifiers.
  if (!isDemoMode() && !UUID_PATTERN.test(wallpaperId)) {
    return NextResponse.json({ error: "Invalid wallpaper id." }, { status: 400 });
  }

  const visitorId =
    typeof record.visitorId === "string" && VISITOR_ID_PATTERN.test(record.visitorId)
      ? record.visitorId
      : null;

  try {
    // Limiter and storage failures are best-effort: they must never surface to the visitor.
    const ipHash = hashClientIp(clientIp(request));
    const budget = await limitViewRequests(ipHash);
    if (!budget.allowed) {
      return NextResponse.json(
        { error: "Too many view requests. Please retry shortly.", code: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": "30", "Cache-Control": "no-store" } }
      );
    }

    // One view per visitor (or IP when a visitor id is unavailable) per wallpaper per day.
    const isNewView = await claimView(`tw:view:${wallpaperId}:${visitorId ?? ipHash}`);
    if (!isNewView) return NextResponse.json({ counted: false });

    const counted = await incrementViewCount(wallpaperId);
    return NextResponse.json({ counted });
  } catch {
    // Deduplication stays claimed on ambiguous failures: releasing it could double count
    // if the database committed but the response was lost.
    return NextResponse.json({ counted: false });
  }
}
