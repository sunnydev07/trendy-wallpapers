import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { readBoundedJson } from "@/lib/request-body";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

/** The claim body is capped at 3,000 characters; 16 KB leaves room for JSON overhead. */
const MAX_DMCA_BODY_BYTES = 16 * 1024;

const DmcaSchema = z.object({
  wallpaperUrl: z.string().url("Please enter the full URL of the wallpaper."),
  wallpaperId: z.string().uuid().optional().or(z.literal("")),
  reporterName: z.string().min(2, "Please provide your full legal name.").max(120),
  reporterEmail: z.string().email("Please enter a valid contact email."),
  claimDetails: z
    .string()
    .min(25, "Please describe the copyrighted work and ownership basis (min 25 chars).")
    .max(3000),
  goodFaithConfirmed: z.literal(true, {
    errorMap: () => ({
      message: "You must confirm the good-faith DMCA statement to submit.",
    }),
  }),
});

export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await readBoundedJson(request, MAX_DMCA_BODY_BYTES);
  } catch {
    return NextResponse.json(
      { error: "Unable to parse DMCA report payload." },
      { status: 400 }
    );
  }

  const parsed = DmcaSchema.safeParse(json);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? "Invalid DMCA submission.";
    return NextResponse.json({ error: firstIssue }, { status: 400 });
  }

  const { wallpaperUrl, wallpaperId, reporterName, reporterEmail, claimDetails } = parsed.data;

  try {
    const admin = getSupabaseAdminClient();
    if (admin) {
      const { data, error } = await admin
        .from("dmca_reports")
        .insert({
          wallpaper_id: wallpaperId || null,
          wallpaper_url: wallpaperUrl,
          reporter_name: reporterName,
          reporter_email: reporterEmail,
          claim_details: claimDetails,
          status: "pending",
        })
        .select("id, created_at")
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: `Could not record DMCA notice: ${error?.message ?? "no row returned"}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        status: "received",
        referenceId: data.id,
        receivedAt: data.created_at,
        mode: "live",
      });
    }

    if (isSupabaseConfigured()) {
      // Credentials exist but the privileged writer is missing: never claim a notice was stored.
      return NextResponse.json(
        {
          error:
            "The moderation store is not configured on this deployment, so this notice could not be recorded. Contact us directly with the details.",
          code: "STORAGE_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    // Demo mode confirmation receipt (not persisted).
    return NextResponse.json({
      status: "received",
      referenceId: `DMCA-DEMO-${Date.now().toString(36).toUpperCase()}`,
      receivedAt: new Date().toISOString(),
      mode: "demo",
      simulated: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected DMCA error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
