import { NextRequest, NextResponse } from "next/server";
import { incrementViewCount } from "@/lib/data-provider";
import { claimView, hashClientIp, limitViewRequests } from "@/lib/redis";

export const runtime = "nodejs";

const VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "127.0.0.1";
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
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
  const visitorId =
    typeof record.visitorId === "string" && VISITOR_ID_PATTERN.test(record.visitorId)
      ? record.visitorId
      : null;

  const ipHash = hashClientIp(clientIp(request));
  const budget = await limitViewRequests(ipHash);
  if (!budget.allowed) {
    return NextResponse.json(
      { error: "Too many view requests. Please retry shortly.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": "30" } }
    );
  }

  try {
    // One view per visitor (or IP when a visitor id is unavailable) per wallpaper per day.
    const isNewView = await claimView(`tw:view:${wallpaperId}:${visitorId ?? ipHash}`);
    if (!isNewView) return NextResponse.json({ counted: false });

    await incrementViewCount(wallpaperId);
    return NextResponse.json({ counted: true });
  } catch {
    // Best-effort analytics: storage failures must never surface to the visitor.
    return NextResponse.json({ counted: false });
  }
}
